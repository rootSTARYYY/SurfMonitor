import crypto from 'node:crypto';
import https from 'node:https';
import { HttpMethod } from '../db/database';
import { decryptSecret, redactSecrets } from '../security/secrets';
import {
  CheckState,
  classifyHttpResponse,
  DEFAULT_EXPECTED_STATUS_CODES,
} from './statusClassifier';

export interface HttpMonitorConfig {
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  contentType?: string;
  authType?: 'none' | 'basic' | 'bearer';
  authUsername?: string;
  authSecretEncrypted?: string;
  redirectBehavior?: 'manual' | 'follow' | 'error';
  sslVerify?: boolean;
  retries?: number;
  maxResponseTimeMs?: number;
  expectedText?: string;
  forbiddenText?: string;
  jsonPath?: string;
  jsonExpectedValue?: string;
  expectedContentType?: string;
  keywordMustContain?: string[];
  keywordMustNotContain?: string[];
  keywordCaseSensitive?: boolean;
}

export interface HttpCheckResult {
  monitorId: string;
  checkedAt: string;
  responseTime: number | null;
  statusCode: number | null;
  state: CheckState;
  networkConnected: boolean;
  httpResponseReceived: boolean;
  applicationHealthy: boolean;
  success: boolean;
  errorMessage: string | null;
  detailsJson: string | null;
  bodyText?: string;
}

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function extractJsonPath(obj: unknown, pathExpr: string): unknown {
  const clean = pathExpr.replace(/^\$\.?/, '');
  if (!clean) return obj;
  const tokens = clean
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let current: unknown = obj;
  for (const token of tokens) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

function classifyNetworkError(
  err: unknown,
  timeoutSeconds: number,
  secretsToRedact: string[]
): string {
  if (!(err instanceof Error)) return 'Unknown network error';
  if (err.name === 'AbortError') {
    return `Request timeout after ${timeoutSeconds}s`;
  }
  const cause = (err as Error & { cause?: { code?: string; message?: string } })
    .cause;
  const code = cause?.code ?? (err as Error & { code?: string }).code ?? '';
  const msg = redactSecrets(cause?.message ?? err.message ?? '', secretsToRedact);

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `DNS resolution failed (${code})`;
  }
  if (code === 'ECONNREFUSED') return 'Connection refused';
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
    return `Network unreachable (${code})`;
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return 'Connection timeout';
  }
  if (
    code.startsWith('CERT_') ||
    code.startsWith('ERR_TLS_') ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ) {
    return `TLS connection failure (${code})`;
  }
  return msg || 'Network connection failed';
}

function buildTargetUrl(
  rawUrl: string,
  queryParams?: Record<string, string>
): string {
  const url = new URL(rawUrl);
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (k.trim()) {
        url.searchParams.set(k.trim(), v);
      }
    }
  }
  return url.toString();
}

async function executeSingleAttempt(params: {
  monitorId: string;
  url: string;
  method: HttpMethod;
  timeoutSeconds: number;
  expectedStatusCodes: string;
  config: HttpMonitorConfig;
}): Promise<HttpCheckResult> {
  const checkedAt = new Date().toISOString();
  const secretsToRedact: string[] = [];
  const targetUrl = buildTargetUrl(params.url, params.config.queryParams);

  const headers: Record<string, string> = {
    'User-Agent': 'SurfMonitor/2.0.0',
    ...(params.config.headers ?? {}),
  };

  if (params.config.contentType && !headers['Content-Type']) {
    headers['Content-Type'] = params.config.contentType;
  }

  if (params.config.authType === 'bearer' && params.config.authSecretEncrypted) {
    const token = decryptSecret(params.config.authSecretEncrypted);
    if (token) {
      secretsToRedact.push(token);
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (
    params.config.authType === 'basic' &&
    params.config.authSecretEncrypted
  ) {
    const pass = decryptSecret(params.config.authSecretEncrypted);
    if (pass) secretsToRedact.push(pass);
    const user = params.config.authUsername ?? '';
    const encoded = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
    secretsToRedact.push(encoded);
    headers['Authorization'] = `Basic ${encoded}`;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, params.timeoutSeconds * 1000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const hasBody =
      params.method !== 'GET' &&
      params.method !== 'HEAD' &&
      Boolean(params.config.body);

    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method: params.method,
      headers,
      signal: controller.signal,
      redirect: params.config.redirectBehavior ?? 'manual',
      body: hasBody ? params.config.body : undefined,
    };

    // Note: if sslVerify === false on https, use node:https fallback
    let statusCode: number;
    let statusText: string;
    let respContentType = '';
    let bodyText = '';

    if (targetUrl.startsWith('https://') && params.config.sslVerify === false) {
      const result = await new Promise<{
        status: number;
        statusText: string;
        contentType: string;
        body: string;
      }>((resolve, reject) => {
        const req = https.request(
          targetUrl,
          {
            method: params.method,
            headers,
            rejectUnauthorized: false,
            timeout: timeoutMs,
          },
          (res) => {
            const chunks: Buffer[] = [];
            let size = 0;
            res.on('data', (chunk: Buffer) => {
              if (size < 512_000) {
                chunks.push(chunk);
                size += chunk.length;
              }
            });
            res.on('end', () => {
              resolve({
                status: res.statusCode ?? 0,
                statusText: res.statusMessage ?? '',
                contentType: String(res.headers['content-type'] ?? ''),
                body: Buffer.concat(chunks).toString('utf8'),
              });
            });
          }
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy(Object.assign(new Error('Timeout'), { name: 'AbortError' }));
        });
        if (hasBody && params.config.body) req.write(params.config.body);
        req.end();
      });
      statusCode = result.status;
      statusText = result.statusText;
      respContentType = result.contentType;
      bodyText = result.body;
    } else {
      const response = await fetch(targetUrl, fetchOptions);
      statusCode = response.status;
      statusText = response.statusText;
      respContentType = response.headers.get('content-type') ?? '';
      const needsBody = Boolean(
        params.config.expectedText ||
          params.config.forbiddenText ||
          params.config.jsonPath ||
          params.config.keywordMustContain?.length ||
          params.config.keywordMustNotContain?.length
      );
      if (needsBody && params.method !== 'HEAD') {
        const rawText = await response.text();
        bodyText = rawText.slice(0, 512_000);
      } else if (response.body) {
        void response.body.cancel().catch(() => {});
      }
    }

    const elapsed = Math.max(1, Math.round(performance.now() - start));
    const classified = classifyHttpResponse(
      statusCode,
      statusText,
      params.expectedStatusCodes
    );

    const assertionFailures: string[] = [];
    if (!classified.applicationHealthy && classified.errorMessage) {
      assertionFailures.push(classified.errorMessage);
    }

    if (
      params.config.maxResponseTimeMs &&
      elapsed > params.config.maxResponseTimeMs
    ) {
      assertionFailures.push(
        `Response time ${elapsed}ms exceeded max ${params.config.maxResponseTimeMs}ms`
      );
    }

    if (
      params.config.expectedContentType &&
      !respContentType
        .toLowerCase()
        .includes(params.config.expectedContentType.toLowerCase())
    ) {
      assertionFailures.push(
        `Expected Content-Type "${params.config.expectedContentType}", got "${respContentType || 'none'}"`
      );
    }

    if (
      params.config.expectedText &&
      !bodyText.includes(params.config.expectedText)
    ) {
      assertionFailures.push(
        `Expected response text "${params.config.expectedText}" not found`
      );
    }

    if (
      params.config.forbiddenText &&
      bodyText.includes(params.config.forbiddenText)
    ) {
      assertionFailures.push(
        `Forbidden response text "${params.config.forbiddenText}" was present`
      );
    }

    if (params.config.jsonPath) {
      try {
        const parsed = JSON.parse(bodyText) as unknown;
        const val = extractJsonPath(parsed, params.config.jsonPath);
        if (val === undefined) {
          assertionFailures.push(
            `JSON property "${params.config.jsonPath}" does not exist`
          );
        } else if (
          params.config.jsonExpectedValue !== undefined &&
          params.config.jsonExpectedValue !== '' &&
          String(val) !== params.config.jsonExpectedValue
        ) {
          assertionFailures.push(
            `JSON "${params.config.jsonPath}" expected "${params.config.jsonExpectedValue}", got "${String(val)}"`
          );
        }
      } catch {
        assertionFailures.push('Invalid JSON response body');
      }
    }

    // Keyword monitoring rules
    const caseSensitive = params.config.keywordCaseSensitive ?? false;
    const hay = caseSensitive ? bodyText : bodyText.toLowerCase();
    for (const kw of params.config.keywordMustContain ?? []) {
      const needle = caseSensitive ? kw : kw.toLowerCase();
      if (needle && !hay.includes(needle)) {
        assertionFailures.push(`Missing required keyword "${kw}"`);
      }
    }
    for (const kw of params.config.keywordMustNotContain ?? []) {
      const needle = caseSensitive ? kw : kw.toLowerCase();
      if (needle && hay.includes(needle)) {
        assertionFailures.push(`Found forbidden keyword "${kw}"`);
      }
    }

    const healthy = assertionFailures.length === 0;
    const finalState: CheckState = healthy ? 'UP' : 'DEGRADED';

    return {
      monitorId: params.monitorId,
      checkedAt,
      responseTime: elapsed,
      statusCode,
      state: finalState,
      networkConnected: true,
      httpResponseReceived: true,
      applicationHealthy: healthy,
      success: healthy,
      errorMessage: healthy ? null : assertionFailures.join('; '),
      detailsJson: JSON.stringify({
        contentType: respContentType,
        bodyBytes: Buffer.byteLength(bodyText, 'utf8'),
        bodyHash: bodyText
          ? crypto.createHash('sha256').update(bodyText).digest('hex').slice(0, 16)
          : null,
        assertionsPassed: healthy,
      }),
      bodyText,
    };
  } catch (err) {
    const elapsed = Math.max(1, Math.round(performance.now() - start));
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      monitorId: params.monitorId,
      checkedAt,
      responseTime: isAbort ? null : elapsed,
      statusCode: null,
      state: 'DOWN',
      networkConnected: false,
      httpResponseReceived: false,
      applicationHealthy: false,
      success: false,
      errorMessage: classifyNetworkError(
        err,
        params.timeoutSeconds,
        secretsToRedact
      ),
      detailsJson: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function performHttpCheck(params: {
  monitorId: string;
  url: string;
  method: HttpMethod;
  timeoutSeconds: number;
  expectedStatusCodes?: string;
  config?: HttpMonitorConfig;
}): Promise<HttpCheckResult> {
  const expected = params.expectedStatusCodes || DEFAULT_EXPECTED_STATUS_CODES;
  const config = params.config ?? {};

  if (!isValidHttpUrl(params.url)) {
    return {
      monitorId: params.monitorId,
      checkedAt: new Date().toISOString(),
      responseTime: null,
      statusCode: null,
      state: 'DOWN',
      networkConnected: false,
      httpResponseReceived: false,
      applicationHealthy: false,
      success: false,
      errorMessage: 'Invalid URL: only HTTP and HTTPS are supported',
      detailsJson: null,
    };
  }

  const maxRetries = Math.min(3, Math.max(0, config.retries ?? 0));
  let lastResult = await executeSingleAttempt({
    ...params,
    expectedStatusCodes: expected,
    config,
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (lastResult.state === 'UP') break;
    lastResult = await executeSingleAttempt({
      ...params,
      expectedStatusCodes: expected,
      config,
    });
  }

  return lastResult;
}
