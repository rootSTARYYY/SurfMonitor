import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Client, ConnectConfig } from 'ssh2';
import { RemoteServerRecord } from '../db/database';
import { decryptSecret } from '../security/secrets';

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

  public disconnect(serverId: string): void {
    const client = this.pool.get(serverId);
    if (client) {
      client.end();
      this.pool.delete(serverId);
    }
  }

  public disconnectAll(): void {
    for (const c of this.pool.values()) {
      c.end();
    }
    this.pool.clear();
  }
}
