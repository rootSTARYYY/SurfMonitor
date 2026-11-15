import crypto from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Client, ClientChannel, ConnectConfig, SFTPWrapper } from 'ssh2';
import { RemoteServerRecord } from '../db/database';
import { decryptSecret, redactSecrets } from '../security/secrets';

export interface ConnectionStageDiagnostics {
  sshConnection: 'ok' | 'failed';
  sshAuthentication: 'ok' | 'failed' | 'pending';
  agentInstallation: 'ok' | 'missing' | 'unknown';
  agentServiceStatus: 'active' | 'inactive' | 'unknown';
  agentPortForwarding: 'ok' | 'failed' | 'pending';
  agentAuthentication: 'ok' | 'failed' | 'pending';
  agentApiVerification: 'ok' | 'failed' | 'pending';
}

export interface SshTestResult {
  sshConnected: boolean;
  hostFingerprint: string | null;
  agentInstalled: boolean;
  agentHealthy: boolean;
  agentVersion: string | null;
  error: string | null;
  stages?: ConnectionStageDiagnostics;
}

export function classifySshError(err: unknown): string {
  if (!(err instanceof Error)) return 'Unknown SSH error';
  const msg = err.message || '';
  if (
    msg.includes('All configured authentication methods failed') ||
    msg.includes('Encrypted private key detected') ||
    msg.includes('bad decrypt')
  ) {
    return 'SSH authentication failed: check SSH username, private key, or passphrase';
  }
  if (msg.includes('Timed out while waiting for handshake')) {
    return 'SSH connection timeout: server did not respond in time';
  }
  if (msg.includes('Host key verification failed')) {
    return 'SSH host key verification failed: fingerprint mismatch';
  }
  if (
    msg.includes('ENETUNREACH') ||
    msg.includes('EHOSTUNREACH') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED')
  ) {
    return `SSH network unreachable: ${msg}`;
  }
  return msg;
}

export function parseAgentHttpResponse<T>(
  statusCode: number,
  contentTypeHeader: string | undefined,
  rawBody: string
): T {
  const body = rawBody ?? '';
  const trimmed = body.trim();
  const contentType = (contentTypeHeader || '').toLowerCase();
  const isJsonType = contentType.includes('application/json');

  if (statusCode === 401 || statusCode === 403) {
    throw new Error(
      `Agent authentication failed (HTTP ${statusCode}): verify SURF_AGENT_TOKEN matches /etc/surf-monitor-agent.env`
    );
  }

  if (statusCode === 404) {
    throw new Error(
      'Agent endpoint not found (HTTP 404): update the remote Surf Monitor Agent to v3.1.0'
    );
  }

  if (statusCode >= 400) {
    if (isJsonType && trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
        if (parsed.error || parsed.message) {
          throw new Error(`Agent HTTP ${statusCode}: ${parsed.error || parsed.message}`);
        }
      } catch (inner) {
        if (inner instanceof Error && inner.message.startsWith('Agent HTTP ')) {
          throw inner;
        }
      }
    }
    const snippet = trimmed.replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(
      `Agent HTTP ${statusCode}${snippet ? `: ${snippet}` : ' (empty error body)'}`
    );
  }

  if (!trimmed) {
    throw new Error('Agent returned an empty response body where JSON was expected');
  }

  if (contentType && !isJsonType) {
    const snippet = trimmed.replace(/\s+/g, ' ').slice(0, 120);
    const kind =
      contentType.includes('text/html') || trimmed.startsWith('<')
        ? 'HTML'
        : contentType.split(';')[0];
    throw new Error(
      `Agent returned non-JSON (${kind}) response starting with: ${snippet}`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const snippet = trimmed.replace(/\s+/g, ' ').slice(0, 120);
    throw new Error(
      `Agent returned malformed JSON starting with: ${snippet}`
    );
  }
}

export function extractMarkedSection(
  stdout: string,
  startMarker = '__SURF_START__',
  endMarker = '__SURF_END__'
): string {
  const s = stdout.indexOf(startMarker);
  if (s === -1) return stdout.trim();
  const afterStart = s + startMarker.length;
  const e = stdout.indexOf(endMarker, afterStart);
  if (e === -1) return stdout.slice(afterStart).trim();
  return stdout.slice(afterStart, e).trim();
}

export class SshManager {
  private pool = new Map<string, Client>();

  private connectClient(opts: {
    host: string;
    port: number;
    username: string;
    privateKey: string;
    passphrase?: string;
    expectedFingerprint?: string | null;
  }): Promise<{ client: Client; fingerprint: string }> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      let capturedFingerprint = '';

      const cfg: ConnectConfig = {
        host: opts.host,
        port: opts.port,
        username: opts.username,
        privateKey: opts.privateKey,
        passphrase: opts.passphrase || undefined,
        readyTimeout: 12000,
        keepaliveInterval: 15000,
        hostVerifier: (key: Buffer) => {
          const hash = crypto.createHash('sha256').update(key).digest('base64');
          capturedFingerprint = `SHA256:${hash}`;
          if (
            opts.expectedFingerprint &&
            opts.expectedFingerprint !== capturedFingerprint
          ) {
            return false;
          }
          return true;
        },
      };

      client.once('ready', () => {
        resolve({ client, fingerprint: capturedFingerprint });
      });

      client.once('error', (err) => {
        client.end();
        reject(err);
      });

      client.connect(cfg);
    });
  }

  private execSshCommand(
    client: Client,
    command: string
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';
        stream.on('data', (d: Buffer) => {
          stdout += d.toString('utf8');
        });
        stream.stderr.on('data', (d: Buffer) => {
          stderr += d.toString('utf8');
        });
        stream.on('close', (code: number) => {
          resolve({ code: code ?? 0, stdout, stderr });
        });
      });
    });
  }

  private async tunneledHttpRequest<T>(
    client: Client,
    agentPort: number,
    agentToken: string,
    method: 'GET' | 'POST',
    reqPath: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      client.forwardOut(
        '127.0.0.1',
        0,
        '127.0.0.1',
        agentPort,
        (err, stream) => {
          if (err) {
            reject(
              new Error(
                `Agent port forwarding failed on 127.0.0.1:${agentPort} (is surf-monitor-agent running?)`
              )
            );
            return;
          }

          const req = http.request(
            {
              createConnection: () => stream as unknown as import('node:net').Socket,
              hostname: '127.0.0.1',
              port: agentPort,
              path: reqPath,
              method,
              timeout: 10000,
              headers: {
                Authorization: `Bearer ${agentToken}`,
                Accept: 'application/json',
              },
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on('data', (c: Buffer) => chunks.push(c));
              res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                try {
                  const parsed = parseAgentHttpResponse<T>(
                    res.statusCode ?? 500,
                    typeof res.headers['content-type'] === 'string'
                      ? res.headers['content-type']
                      : undefined,
                    body
                  );
                  resolve(parsed);
                } catch (parseErr) {
                  reject(parseErr);
                }
              });
            }
          );

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy(new Error('Agent request timeout'));
          });
          req.end();
        }
      );
    });
  }

  public async testConnection(params: {
    host: string;
    port: number;
    username: string;
    privateKey: string;
    passphrase?: string;
    expectedFingerprint?: string | null;
    agentPort?: number;
    agentToken?: string;
  }): Promise<SshTestResult> {
    let client: Client | null = null;
    const stages: ConnectionStageDiagnostics = {
      sshConnection: 'failed',
      sshAuthentication: 'pending',
      agentInstallation: 'unknown',
      agentServiceStatus: 'unknown',
      agentPortForwarding: 'pending',
      agentAuthentication: 'pending',
      agentApiVerification: 'pending',
    };

    try {
      const conn = await this.connectClient(params);
      client = conn.client;
      stages.sshConnection = 'ok';
      stages.sshAuthentication = 'ok';

      const agentPort = params.agentPort ?? 47200;

      // Resilient stage check unaffected by MOTD or shell startup banners
      try {
        const diag = await this.execSshCommand(
          client,
          'printf "__SURF_START__"; [ -f /opt/surf-monitor-agent/surf-agent.mjs ] && echo -n "installed:" || echo -n "missing:"; systemctl is-active surf-monitor-agent 2>/dev/null || echo -n "inactive"; printf "__SURF_END__"'
        );
        const extracted = extractMarkedSection(diag.stdout);
        const [instPart, svcPart] = extracted.split(':');
        stages.agentInstallation = instPart === 'installed' ? 'ok' : 'missing';
        stages.agentServiceStatus =
          svcPart?.trim() === 'active' ? 'active' : 'inactive';
      } catch {
        // Non-fatal
      }

      if (!params.agentToken) {
        return {
          sshConnected: true,
          hostFingerprint: conn.fingerprint,
          agentInstalled: stages.agentInstallation === 'ok',
          agentHealthy: false,
          agentVersion: null,
          error: null,
          stages,
        };
      }

      try {
        const health = await this.tunneledHttpRequest<{
          ok: boolean;
          version: string;
        }>(client, agentPort, params.agentToken, 'GET', '/health');
        stages.agentPortForwarding = 'ok';
        stages.agentAuthentication = 'ok';
        stages.agentApiVerification = health.ok ? 'ok' : 'failed';

        return {
          sshConnected: true,
          hostFingerprint: conn.fingerprint,
          agentInstalled: true,
          agentHealthy: Boolean(health.ok),
          agentVersion: health.version ?? null,
          error: null,
          stages,
        };
      } catch (agentErr) {
        const msg = agentErr instanceof Error ? agentErr.message : 'Agent error';
        if (msg.includes('port forwarding failed')) {
          stages.agentPortForwarding = 'failed';
        } else if (msg.includes('Agent authentication failed')) {
          stages.agentPortForwarding = 'ok';
          stages.agentAuthentication = 'failed';
        } else {
          stages.agentPortForwarding = 'ok';
          stages.agentAuthentication = 'ok';
          stages.agentApiVerification = 'failed';
        }

        return {
          sshConnected: true,
          hostFingerprint: conn.fingerprint,
          agentInstalled: stages.agentInstallation === 'ok',
          agentHealthy: false,
          agentVersion: null,
          error: msg,
          stages,
        };
      }
    } catch (err) {
      const classified = classifySshError(err);
      if (classified.startsWith('SSH authentication failed')) {
        stages.sshConnection = 'ok';
        stages.sshAuthentication = 'failed';
      }
      return {
        sshConnected: false,
        hostFingerprint: null,
        agentInstalled: false,
        agentHealthy: false,
        agentVersion: null,
        error: classified,
        stages,
      };
    } finally {
      client?.end();
    }
  }

  public async installAgent(params: {
    host: string;
    port: number;
    username: string;
    privateKey: string;
    passphrase?: string;
    agentPort?: number;
    agentDir: string;
    existingToken?: string;
  }): Promise<{ ok: boolean; token: string | null; fingerprint: string | null; output: string }> {
    const conn = await this.connectClient(params);
    const client = conn.client;
    const token =
      params.existingToken?.trim() || crypto.randomBytes(32).toString('hex');
    const agentPort = params.agentPort ?? 47200;

    try {
      const agentSrc = fs
        .readFileSync(path.join(params.agentDir, 'surf-agent.mjs'), 'utf8')
        .replace(/\r\n/g, '\n');
      const installSrc = fs
        .readFileSync(path.join(params.agentDir, 'install.sh'), 'utf8')
        .replace(/\r\n/g, '\n');

      await new Promise<void>((resolve, reject) => {
        client.sftp((err, sftp) => {
          if (err) return reject(err);
          sftp.mkdir('/tmp/surf-agent-install', () => {
            sftp.writeFile(
              '/tmp/surf-agent-install/surf-agent.mjs',
              agentSrc,
              (e1) => {
                if (e1) return reject(e1);
                sftp.writeFile(
                  '/tmp/surf-agent-install/install.sh',
                  installSrc,
                  (e2) => {
                    if (e2) return reject(e2);
                    resolve();
                  }
                );
              }
            );
          });
        });
      });

      const cmd = `chmod +x /tmp/surf-agent-install/install.sh && SURF_AGENT_PORT=${agentPort} SURF_AGENT_TOKEN=${token} sudo -n bash /tmp/surf-agent-install/install.sh || SURF_AGENT_PORT=${agentPort} SURF_AGENT_TOKEN=${token} bash /tmp/surf-agent-install/install.sh; rm -rf /tmp/surf-agent-install`;
      const res = await this.execSshCommand(client, cmd);
      if (res.code !== 0) {
        const errText = (res.stderr || res.stdout).trim();
        throw new Error(`Agent install exited with code ${res.code}: ${errText}`);
      }

      return {
        ok: true,
        token,
        fingerprint: conn.fingerprint,
        output: res.stdout,
      };
    } finally {
      client.end();
    }
  }

  public async getConnectedClient(
    server: RemoteServerRecord
  ): Promise<Client> {
    const existing = this.pool.get(server.id);
    if (existing) return existing;

    const privateKey = decryptSecret(server.encryptedPrivateKey);
    const passphrase = server.encryptedPassphrase
      ? decryptSecret(server.encryptedPassphrase)
      : undefined;

    const { client } = await this.connectClient({
      host: server.host,
      port: server.port,
      username: server.username,
      privateKey,
      passphrase,
      expectedFingerprint: server.hostFingerprint,
    });

    client.once('close', () => {
      if (this.pool.get(server.id) === client) {
        this.pool.delete(server.id);
      }
    });
    client.once('error', () => {
      if (this.pool.get(server.id) === client) {
        this.pool.delete(server.id);
      }
    });

    this.pool.set(server.id, client);
    return client;
  }

  public async requestAgent<T>(
    server: RemoteServerRecord,
    method: 'GET' | 'POST',
    reqPath: string
  ): Promise<T> {
    const client = await this.getConnectedClient(server);
    const token = decryptSecret(server.encryptedAgentToken);
    return this.tunneledHttpRequest<T>(
      client,
      server.agentPort,
      token,
      method,
      reqPath
    );
  }

  private shells = new Map<string, ClientChannel>();
  private shellDecoders = new Map<string, StringDecoder>();
  private sftpPool = new Map<string, SFTPWrapper>();

  public async execOnServer(
    server: RemoteServerRecord,
    command: string,
    opts?: {
      timeoutMs?: number;
      secrets?: string[];
      onStdout?: (chunk: string) => void;
      onStderr?: (chunk: string) => void;
      signal?: AbortSignal;
    }
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const client = await this.getConnectedClient(server);
    const secrets = opts?.secrets ?? [];
    const timeoutMs = opts?.timeoutMs ?? 120_000;

    return new Promise((resolve, reject) => {
      if (opts?.signal?.aborted) {
        return reject(new Error('Operation cancelled before execution'));
      }
      client.exec(command, (err, stream) => {
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            try { stream.close(); } catch {}
            reject(new Error(`Command timed out after ${Math.round(timeoutMs / 1000)}s`));
          }
        }, timeoutMs);

        const onAbort = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try { stream.close(); } catch {}
            reject(new Error('Operation cancelled by user'));
          }
        };
        opts?.signal?.addEventListener('abort', onAbort, { once: true });

        stream.on('data', (d: Buffer) => {
          const text = redactSecrets(d.toString('utf8'), secrets);
          stdout += text;
          opts?.onStdout?.(text);
        });
        stream.stderr.on('data', (d: Buffer) => {
          const text = redactSecrets(d.toString('utf8'), secrets);
          stderr += text;
          opts?.onStderr?.(text);
        });
        stream.on('close', (code: number) => {
          clearTimeout(timer);
          opts?.signal?.removeEventListener('abort', onAbort);
          if (!settled) {
            settled = true;
            resolve({ code: code ?? 0, stdout, stderr });
          }
        });
      });
    });
  }

  public async inspectServerSystem(server: RemoteServerRecord): Promise<{
    osName: string;
    osVersion: string;
    arch: string;
    pkgManager: string;
    freeDiskMb: number;
    freeMemMb: number;
    isRootOrSudo: boolean;
    listeningPorts: number[];
  }> {
    const probe = [
      'echo "__OS__=$(. /etc/os-release 2>/dev/null && echo \"$ID|$VERSION_ID\" || uname -s)"',
      'echo "__ARCH__=$(uname -m)"',
      'echo "__UID__=$(id -u)"',
      'echo "__SUDO__=$(sudo -n true 2>/dev/null && echo yes || echo no)"',
      'echo "__PKG__=$(command -v apt-get >/dev/null && echo apt-get || (command -v dnf >/dev/null && echo dnf || (command -v yum >/dev/null && echo yum || echo unknown)))"',
      `echo "__DISK__=$(df -Pm / | awk 'NR==2{print $4}')"`,
      `echo "__MEM__=$(free -m | awk '/^Mem:/{print $7}')"`,
      `echo "__PORTS__=$(ss -tuln 2>/dev/null | awk 'NR>1{print $5}' | sed 's/.*://' | sort -un | tr '\\n' ',')"`,
    ].join(' && ');

    const res = await this.execOnServer(server, probe, { timeoutMs: 15000 });
    const lines = res.stdout.split(/\r?\n/);
    const getVal = (prefix: string) => {
      const line = lines.find((l) => l.startsWith(prefix));
      return line ? line.slice(prefix.length).trim() : '';
    };
    const osPair = getVal('__OS__=').split('|');
    const osName = (osPair[0] || 'linux').toLowerCase();
    const osVersion = osPair[1] || '';
    const arch = getVal('__ARCH__=') || 'x86_64';
    const uid = Number(getVal('__UID__=') || '1000');
    const hasSudo = getVal('__SUDO__=') === 'yes';
    const pkgManager = getVal('__PKG__=') || 'unknown';
    const freeDiskMb = Number(getVal('__DISK__=') || '0') || 0;
    const freeMemMb = Number(getVal('__MEM__=') || '0') || 0;
    const portsRaw = getVal('__PORTS__=');
    const listeningPorts = portsRaw
      .split(',')
      .map((p) => Number(p.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    return {
      osName,
      osVersion,
      arch,
      pkgManager,
      freeDiskMb,
      freeMemMb,
      isRootOrSudo: uid === 0 || hasSudo,
      listeningPorts,
    };
  }

  public async openShellSession(
    sessionId: string,
    server: RemoteServerRecord,
    cols: number,
    rows: number,
    onData: (chunk: string) => void,
    onExit: (code?: number) => void,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    const client = await this.getConnectedClient(server);
    return new Promise((resolve, reject) => {
      client.shell(
        {
          term: 'xterm-256color',
          cols,
          rows,
        },
        {
          env: {
            TERM: 'xterm-256color',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US.UTF-8',
          },
        },
        (err, stream) => {
          if (err) return reject(err);
          const decoder = new StringDecoder(encoding);
          this.shells.set(sessionId, stream);
          this.shellDecoders.set(sessionId, decoder);
          stream.on('data', (d: Buffer) => {
            const text = decoder.write(d);
            if (text) onData(text);
          });
          stream.stderr?.on('data', (d: Buffer) => {
            const text = decoder.write(d);
            if (text) onData(text);
          });
          stream.on('close', (code: number) => {
            const rem = decoder.end();
            if (rem) onData(rem);
            this.shells.delete(sessionId);
            this.shellDecoders.delete(sessionId);
            onExit(code);
          });
          resolve();
        }
      );
    });
  }

  public writeShellSession(sessionId: string, data: string): boolean {
    const stream = this.shells.get(sessionId);
    if (!stream) return false;
    stream.write(data);
    return true;
  }

  public resizeShellSession(sessionId: string, cols: number, rows: number): boolean {
    const stream = this.shells.get(sessionId);
    if (!stream) return false;
    stream.setWindow(rows, cols, 0, 0);
    return true;
  }

  public closeShellSession(sessionId: string): void {
    const stream = this.shells.get(sessionId);
    if (stream) {
      try { stream.end(); } catch {}
      this.shells.delete(sessionId);
    }
  }

  private async getPooledSftp(server: RemoteServerRecord): Promise<SFTPWrapper> {
    const existing = this.sftpPool.get(server.id);
    if (existing) return existing;
    const client = await this.getConnectedClient(server);
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) return reject(err);
        sftp.once('close', () => {
          if (this.sftpPool.get(server.id) === sftp) this.sftpPool.delete(server.id);
        });
        sftp.once('end', () => {
          if (this.sftpPool.get(server.id) === sftp) this.sftpPool.delete(server.id);
        });
        this.sftpPool.set(server.id, sftp);
        resolve(sftp);
      });
    });
  }

  public async sftpList(
    server: RemoteServerRecord,
    remotePath: string
  ): Promise<Array<{ name: string; path: string; isDir: boolean; size: number; mtime: number; permissions: string }>> {
    const sftp = await this.getPooledSftp(server);
    const target = remotePath || '/';
    return new Promise((resolve, reject) => {
      sftp.readdir(target, (err, list) => {
        if (err) return reject(err);
        const mapped = list
          .map((item) => {
            const mode = item.attrs.mode ?? 0;
            const isDir = (mode & 0o170000) === 0o040000;
            const joined = target === '/' ? `/${item.filename}` : `${target.replace(/\/$/, '')}/${item.filename}`;
            return {
              name: item.filename,
              path: joined,
              isDir,
              size: item.attrs.size ?? 0,
              mtime: (item.attrs.mtime ?? 0) * 1000,
              permissions: (mode & 0o777).toString(8).padStart(3, '0'),
            };
          })
          .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
        resolve(mapped);
      });
    });
  }

  public async sftpReadFile(server: RemoteServerRecord, remotePath: string, maxBytes = 512_000): Promise<string> {
    const sftp = await this.getPooledSftp(server);
    return new Promise((resolve, reject) => {
      const stream = sftp.createReadStream(remotePath, { start: 0, end: maxBytes - 1 });
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('error', (e: Error) => { reject(e); });
      stream.on('end', () => { resolve(Buffer.concat(chunks).toString('utf8')); });
    });
  }

  public async sftpWriteFile(server: RemoteServerRecord, remotePath: string, content: string): Promise<void> {
    const sftp = await this.getPooledSftp(server);
    return new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(remotePath);
      stream.on('error', (e: Error) => { reject(e); });
      stream.on('close', () => { resolve(); });
      stream.end(Buffer.from(content, 'utf8'));
    });
  }

  public async sftpUploadFile(server: RemoteServerRecord, localPath: string, remotePath: string): Promise<void> {
    const sftp = await this.getPooledSftp(server);
    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async sftpDownloadFile(server: RemoteServerRecord, remotePath: string, localPath: string): Promise<void> {
    const sftp = await this.getPooledSftp(server);
    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async sftpMkdir(server: RemoteServerRecord, remotePath: string): Promise<void> {
    const sftp = await this.getPooledSftp(server);
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async sftpDelete(server: RemoteServerRecord, remotePath: string, isDir: boolean): Promise<void> {
    const sftp = await this.getPooledSftp(server);
    return new Promise((resolve, reject) => {
      const fn = isDir ? sftp.rmdir.bind(sftp) : sftp.unlink.bind(sftp);
      fn(remotePath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async sftpChmod(server: RemoteServerRecord, remotePath: string, modeOctal: string): Promise<void> {
    const sftp = await this.getPooledSftp(server);
    const mode = parseInt(modeOctal, 8);
    return new Promise((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }


  public async sftpRename(server: RemoteServerRecord, oldPath: string, newPath: string): Promise<void> {
    const sftp = await this.getPooledSftp(server);
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async sftpStat(server: RemoteServerRecord, remotePath: string): Promise<{ size: number; mtime: number; permissions: string; isDir: boolean }> {
    const sftp = await this.getPooledSftp(server);
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);
        const mode = stats.mode ?? 0;
        resolve({
          size: stats.size ?? 0,
          mtime: (stats.mtime ?? 0) * 1000,
          permissions: (mode & 0o777).toString(8).padStart(3, '0'),
          isDir: (mode & 0o170000) === 0o040000,
        });
      });
    });
  }

  public disconnect(serverId: string): void {
    const sftp = this.sftpPool.get(serverId);
    if (sftp) { try { sftp.end(); } catch {} this.sftpPool.delete(serverId); }
    const client = this.pool.get(serverId);
    if (client) {
      client.end();
      this.pool.delete(serverId);
    }
  }

  public disconnectAll(): void {
    for (const id of this.shells.keys()) this.closeShellSession(id);
    for (const c of this.pool.values()) {
      c.end();
    }
    this.pool.clear();
  }
}
