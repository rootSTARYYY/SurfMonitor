import { describe, expect, it } from 'vitest';
import {
  classifySshError,
  extractMarkedSection,
  parseAgentHttpResponse,
} from '../electron/remote/sshManager';

describe('PM2 Integration Validation & Normalization Rules', () => {
  const SAFE_USER_RE = /^[a-z_][a-z0-9_-]{0,31}$/;
  const SAFE_PM_ID_RE = /^[0-9]{1,6}$/;
  const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart']);

  it('rejects command injection in Linux usernames and PM2 IDs', () => {
    expect(SAFE_USER_RE.test('root')).toBe(true);
    expect(SAFE_USER_RE.test('ubuntu')).toBe(true);
    expect(SAFE_USER_RE.test('root; rm -rf /')).toBe(false);
    expect(SAFE_USER_RE.test('$(whoami)')).toBe(false);

    expect(SAFE_PM_ID_RE.test('0')).toBe(true);
    expect(SAFE_PM_ID_RE.test('12')).toBe(true);
    expect(SAFE_PM_ID_RE.test('1 && id')).toBe(false);
    expect(SAFE_PM_ID_RE.test('-1')).toBe(false);

    expect(ALLOWED_ACTIONS.has('restart')).toBe(true);
    expect(ALLOWED_ACTIONS.has('delete')).toBe(false);
    expect(ALLOWED_ACTIONS.has('resurrect')).toBe(false);
  });

  it('redacts tokens and secrets from PM2 log lines', () => {
    const redact = (line: string) =>
      line
        .replace(/\b(Bearer|Token|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [REDACTED]')
        .replace(/\b(slk_|slp_|sk_|pk_|ghp_|gho_|AIza)[A-Za-z0-9_-]{8,}\b/g, '$1[REDACTED]')
        .replace(
          /([A-Za-z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)[A-Za-z0-9_]*\s*[:=]\s*)([^\s'"]+|'[^']*'|"[^"]*")/gi,
          '$1[REDACTED]'
        );

    expect(redact('Authorization: Bearer super_secret_token_12345')).toBe(
      'Authorization: Bearer [REDACTED]'
    );
    expect(redact('SUNLICENSE_API_KEY=slk_9dMzQkEvw_lbjq2uaBpEAt7TRpUWe7EZ')).toBe(
      'SUNLICENSE_API_KEY=[REDACTED]'
    );
    expect(redact('DB_PASSWORD=mysecretpass')).toBe('DB_PASSWORD=[REDACTED]');
  });
});

describe('SSH & Agent HTTP Response Parsing Resilience', () => {
  it('parses valid JSON responses cleanly', () => {
    const out = parseAgentHttpResponse<{ ok: boolean }>(
      200,
      'application/json; charset=utf-8',
      '{"ok":true}'
    );
    expect(out.ok).toBe(true);
  });

  it('distinguishes HTTP 401 agent authentication failure from SSH auth failure', () => {
    expect(() =>
      parseAgentHttpResponse(401, 'application/json', '{"error":"Unauthorized"}')
    ).toThrow(/Agent authentication failed \(HTTP 401\)/);

    expect(
      classifySshError(new Error('All configured authentication methods failed'))
    ).toMatch(/SSH authentication failed/);
  });

  it('handles HTTP 404, HTML, plain text, and empty bodies without crashing', () => {
    expect(() => parseAgentHttpResponse(404, 'text/plain', 'Not found')).toThrow(
      /Agent endpoint not found \(HTTP 404\)/
    );
    expect(() =>
      parseAgentHttpResponse(200, 'text/html', '<html><body>Welcome</body></html>')
    ).toThrow(/non-JSON \(HTML\)/);
    expect(() =>
      parseAgentHttpResponse(200, 'text/plain', '>>>> In-memory PM2 is out-of-date')
    ).toThrow(/non-JSON \(text\/plain\)/);
    expect(() =>
      parseAgentHttpResponse(200, 'application/json', '   ')
    ).toThrow(/empty response body/);
  });

  it('extracts marked command output despite MOTD and shell startup banners', () => {
    const noisyStdout =
      'Welcome to Ubuntu 22.04.5 LTS\nLast login: Sat Nov 14\n__SURF_START__installed:active__SURF_END__\nGoodbye\n';
    expect(extractMarkedSection(noisyStdout)).toBe('installed:active');
  });
});
