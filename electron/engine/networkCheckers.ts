import { execFile } from 'node:child_process';
import net from 'node:net';
import { promisify } from 'node:util';
import { CheckState } from './statusClassifier';

const execFileAsync = promisify(execFile);

export interface BasicNetworkCheckOutput {
  state: CheckState;
  networkConnected: boolean;
  httpResponseReceived: boolean;
  applicationHealthy: boolean;
  responseTime: number | null;
  errorMessage: string | null;
  detailsJson?: string | null;
}

function extractHost(target: string): string {
  try {
    if (target.startsWith('http://') || target.startsWith('https://')) {
      return new URL(target).hostname;
    }
  } catch {
    // fallback
  }
  return target.split(':')[0].trim();
}

export async function performTcpCheck(params: {
  target: string;
  port: number;
  timeoutSeconds: number;
}): Promise<BasicNetworkCheckOutput> {
  const host = extractHost(params.target);
  const start = performance.now();

  return new Promise((resolve) => {
    const socket = net.createConnection({
      host,
      port: params.port,
      timeout: Math.max(1000, params.timeoutSeconds * 1000),
    });

    socket.on('connect', () => {
      const elapsed = Math.max(1, Math.round(performance.now() - start));
      socket.destroy();
      resolve({
        state: 'UP',
        networkConnected: true,
        httpResponseReceived: false,
        applicationHealthy: true,
        responseTime: elapsed,
        errorMessage: null,
        detailsJson: JSON.stringify({ host, port: params.port }),
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        state: 'DOWN',
        networkConnected: false,
        httpResponseReceived: false,
        applicationHealthy: false,
        responseTime: null,
        errorMessage: `TCP timeout connecting to ${host}:${params.port}`,
      });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({
        state: 'DOWN',
        networkConnected: false,
        httpResponseReceived: false,
        applicationHealthy: false,
        responseTime: null,
        errorMessage: `TCP error (${host}:${params.port}): ${err.message}`,
      });
    });
  });
}

export async function performPingCheck(params: {
  target: string;
  timeoutSeconds: number;
}): Promise<BasicNetworkCheckOutput> {
  const host = extractHost(params.target);
  const isWin = process.platform === 'win32';
  const args = isWin
    ? ['-n', '1', '-w', String(params.timeoutSeconds * 1000), host]
    : ['-c', '1', '-W', String(Math.max(1, params.timeoutSeconds)), host];

  const start = performance.now();
  try {
    const { stdout } = await execFileAsync('ping', args, {
      timeout: Math.max(2000, (params.timeoutSeconds + 2) * 1000),
    });
    const elapsed = Math.max(1, Math.round(performance.now() - start));
    const timeMatch = stdout.match(/time[=<]\s*(\d+(?:\.\d+)?)\s*ms/i);
    const rtt = timeMatch ? Math.round(Number(timeMatch[1])) : elapsed;

    return {
      state: 'UP',
      networkConnected: true,
      httpResponseReceived: false,
      applicationHealthy: true,
      responseTime: rtt,
      errorMessage: null,
      detailsJson: JSON.stringify({ host, packetLoss: 0, rttMs: rtt }),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ping failed';
    if (msg.includes('ENOENT')) {
      return {
        state: 'DOWN',
        networkConnected: false,
        httpResponseReceived: false,
        applicationHealthy: false,
        responseTime: null,
        errorMessage: 'ICMP ping utility unavailable on this system',
      };
    }
    return {
      state: 'DOWN',
      networkConnected: false,
      httpResponseReceived: false,
      applicationHealthy: false,
      responseTime: null,
      errorMessage: `Host unreachable via ICMP ping (${host})`,
    };
  }
}

export interface DomainRdapResult {
  domain: string;
  registrar: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  errorMessage: string | null;
}

export async function performDomainRdapCheck(
  target: string
): Promise<DomainRdapResult> {
  const domain = extractHost(target).replace(/^www\./i, '');
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json' },
    });
    if (!res.ok) {
      return {
        domain,
        registrar: null,
        expiresAt: null,
        daysRemaining: null,
        errorMessage: `RDAP lookup unavailable (HTTP ${res.status})`,
      };
    }
    const data = (await res.json()) as {
      events?: Array<{ eventAction?: string; eventDate?: string }>;
      entities?: Array<{
        roles?: string[];
        vcardArray?: [string, Array<[string, unknown, string, string]>];
      }>;
    };

    const expEvent = data.events?.find((e) => e.eventAction === 'expiration');
    const expiresAt = expEvent?.eventDate ?? null;
    const daysRemaining = expiresAt
      ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
      : null;

    let registrar: string | null = null;
    const regEntity = data.entities?.find((e) =>
      e.roles?.includes('registrar')
    );
    const fnEntry = regEntity?.vcardArray?.[1]?.find((item) => item[0] === 'fn');
    if (fnEntry && typeof fnEntry[3] === 'string') {
      registrar = fnEntry[3];
    }

    return {
      domain,
      registrar,
      expiresAt,
      daysRemaining,
      errorMessage: expiresAt ? null : 'Expiration date not published in RDAP',
    };
  } catch (err) {
    return {
      domain,
      registrar: null,
      expiresAt: null,
      daysRemaining: null,
      errorMessage:
        err instanceof Error ? `RDAP lookup failed: ${err.message}` : 'RDAP lookup failed',
    };
  }
}
