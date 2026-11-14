export type CheckState = 'UP' | 'DEGRADED' | 'DOWN';

export const DEFAULT_EXPECTED_STATUS_CODES = '200-399';

interface StatusRule {
  min: number;
  max: number;
}

export function parseExpectedStatusExpression(
  expression: string
): StatusRule[] | null {
  const trimmed = expression.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const rules: StatusRule[] = [];

  for (const part of parts) {
    const normalized = part.replace(/–/g, '-');
    if (/^\d{3}$/.test(normalized)) {
      const code = Number(normalized);
      if (code < 100 || code > 599) return null;
      rules.push({ min: code, max: code });
    } else if (/^\d{3}\s*-\s*\d{3}$/.test(normalized)) {
      const [startStr, endStr] = normalized.split('-').map((s) => s.trim());
      const start = Number(startStr);
      const end = Number(endStr);
      if (start < 100 || end > 599 || start > end) return null;
      rules.push({ min: start, max: end });
    } else {
      return null;
    }
  }

  return rules;
}

export function isValidExpectedStatusExpression(expression: string): boolean {
  return parseExpectedStatusExpression(expression) !== null;
}

export function isExpectedHttpStatus(
  statusCode: number,
  expectedExpression: string = DEFAULT_EXPECTED_STATUS_CODES
): boolean {
  const rules =
    parseExpectedStatusExpression(expectedExpression) ??
    parseExpectedStatusExpression(DEFAULT_EXPECTED_STATUS_CODES)!;

  return rules.some((rule) => statusCode >= rule.min && statusCode <= rule.max);
}

export function classifyHttpResponse(
  statusCode: number,
  statusText: string,
  expectedExpression: string = DEFAULT_EXPECTED_STATUS_CODES
): {
  state: 'UP' | 'DEGRADED';
  networkConnected: true;
  httpResponseReceived: true;
  applicationHealthy: boolean;
  errorMessage: string | null;
} {
  const healthy = isExpectedHttpStatus(statusCode, expectedExpression);
  return {
    state: healthy ? 'UP' : 'DEGRADED',
    networkConnected: true,
    httpResponseReceived: true,
    applicationHealthy: healthy,
    errorMessage: healthy
      ? null
      : `Unexpected HTTP ${statusCode}${statusText ? ` ${statusText}` : ''} (expected ${expectedExpression})`,
  };
}
