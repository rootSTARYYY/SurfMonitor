import tls from 'node:tls';
import { CheckState } from './statusClassifier';

export interface SslCheckOutput {
  state: CheckState;
  networkConnected: boolean;
  httpResponseReceived: boolean;
  applicationHealthy: boolean;
  responseTime: number | null;
  errorMessage: string | null;
  ssl: {
    subject: string | null;
    issuer: string | null;
    validFrom: string | null;
    validTo: string | null;
    daysRemaining: number | null;
    hostnameValid: boolean;
    chainValid: boolean;
    tlsVersion: string | null;
  };
}

function normalizeCertField(val: string | string[] | undefined): string | null {
  if (Array.isArray(val)) return val.join(', ');
  return val ?? null;
}

export async function performSslCheck(params: {
  url: string;
  timeoutSeconds: number;
  warningThresholds?: number[];
}): Promise<SslCheckOutput> {
  const start = performance.now();
  let host: string;
  let port = 443;

  try {
    const parsed = new URL(params.url);
    host = parsed.hostname;
    port = parsed.port ? Number(parsed.port) : 443;
  } catch {
    return {
      state: 'DOWN',
      networkConnected: false,
      httpResponseReceived: false,
      applicationHealthy: false,
      responseTime: null,
      errorMessage: 'Invalid URL for SSL inspection',
      ssl: {
        subject: null,
        issuer: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        hostnameValid: false,
        chainValid: false,
        tlsVersion: null,
      },
    };
  }

  const thresholds = params.warningThresholds?.length
    ? params.warningThresholds
    : [30, 14, 7, 3, 1];
  const maxWarnDays = Math.max(...thresholds);

  return new Promise<SslCheckOutput>((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: Math.max(1000, params.timeoutSeconds * 1000),
      },
      () => {
        const elapsed = Math.max(1, Math.round(performance.now() - start));
        const cert = socket.getPeerCertificate(true);
        const tlsVersion = socket.getProtocol() ?? null;
        const chainValid = socket.authorized;
        const authErr = socket.authorizationError
          ? String(socket.authorizationError)
          : null;

        socket.end();

        if (!cert || !cert.valid_to) {
          resolve({
            state: 'DOWN',
            networkConnected: true,
            httpResponseReceived: false,
            applicationHealthy: false,
            responseTime: elapsed,
            errorMessage: 'No peer TLS certificate presented',
            ssl: {
              subject: null,
              issuer: null,
              validFrom: null,
              validTo: null,
              daysRemaining: null,
              hostnameValid: false,
              chainValid: false,
              tlsVersion,
            },
          });
          return;
        }

        const validToMs = new Date(cert.valid_to).getTime();
        const daysRemaining = Math.floor(
          (validToMs - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const hostnameErr = tls.checkServerIdentity(host, cert);
        const hostnameValid = hostnameErr === undefined;

        let state: CheckState = 'UP';
        const issues: string[] = [];

        if (daysRemaining <= 0) {
          state = 'DOWN';
          issues.push(`Certificate expired (${daysRemaining}d)`);
        } else {
          if (!hostnameValid) {
            state = 'DEGRADED';
            issues.push(`Hostname mismatch: ${hostnameErr?.message ?? host}`);
          }
          if (!chainValid) {
            state = 'DEGRADED';
            issues.push(`Certificate chain error: ${authErr ?? 'untrusted'}`);
          }
          if (daysRemaining <= maxWarnDays) {
            state = 'DEGRADED';
            issues.push(`Certificate expires in ${daysRemaining} days`);
          }
        }

        resolve({
          state,
          networkConnected: true,
          httpResponseReceived: true,
          applicationHealthy: state === 'UP',
          responseTime: elapsed,
          errorMessage: issues.length > 0 ? issues.join('; ') : null,
          ssl: {
            subject:
              normalizeCertField(cert.subject?.CN) ??
              JSON.stringify(cert.subject ?? {}),
            issuer:
              normalizeCertField(cert.issuer?.O) ??
              normalizeCertField(cert.issuer?.CN),
            validFrom: cert.valid_from ?? null,
            validTo: cert.valid_to ?? null,
            daysRemaining,
            hostnameValid,
            chainValid,
            tlsVersion,
          },
        });
      }
    );

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        state: 'DOWN',
        networkConnected: false,
        httpResponseReceived: false,
        applicationHealthy: false,
        responseTime: null,
        errorMessage: `TLS handshake timeout after ${params.timeoutSeconds}s`,
        ssl: {
          subject: null,
          issuer: null,
          validFrom: null,
          validTo: null,
          daysRemaining: null,
          hostnameValid: false,
          chainValid: false,
          tlsVersion: null,
        },
      });
    });

    socket.on('error', (err) => {
      resolve({
        state: 'DOWN',
        networkConnected: false,
        httpResponseReceived: false,
        applicationHealthy: false,
        responseTime: null,
        errorMessage: `TLS connection failure: ${err.message}`,
        ssl: {
          subject: null,
          issuer: null,
          validFrom: null,
          validTo: null,
          daysRemaining: null,
          hostnameValid: false,
          chainValid: false,
          tlsVersion: null,
        },
      });
    });
  });
}
