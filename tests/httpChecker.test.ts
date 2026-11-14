import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isValidHttpUrl, performHttpCheck } from '../electron/engine/httpChecker';

let server: http.Server;
let baseUrl = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (req.url === '/health-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', nested: { ok: true } }));
      return;
    }
    if (req.url === '/bad-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{invalid-json');
      return;
    }
    if (req.url === '/redirect') {
      res.writeHead(301, { Location: '/ok' });
      res.end();
      return;
    }
    if (req.url === '/unauthorized') {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('unauthorized');
      return;
    }
    if (req.url === '/not-found') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Cannot GET /not-found');
      return;
    }
    if (req.url === '/server-error') {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('internal error');
      return;
    }
    if (req.url === '/unavailable') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('service unavailable');
      return;
    }
    if (req.url === '/slow-200') {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('slow ok');
      }, 150);
      return;
    }
    if (req.url === '/slow') {
      setTimeout(() => {
        res.writeHead(200);
        res.end('late');
      }, 2500);
      return;
    }
    res.writeHead(200);
    res.end('ok');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('httpChecker response & assertion classification', () => {
  it('validates only HTTP and HTTPS URLs', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true);
    expect(isValidHttpUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('not-a-url')).toBe(false);
  });

  it('classifies HTTP 200 and passing JSON assertion as UP', async () => {
    const res = await performHttpCheck({
      monitorId: 'm1',
      url: `${baseUrl}/health-json`,
      method: 'GET',
      timeoutSeconds: 5,
      config: {
        jsonPath: 'status',
        jsonExpectedValue: 'healthy',
      },
    });
    expect(res.state).toBe('UP');
    expect(res.applicationHealthy).toBe(true);
  });

  it('classifies failed JSON assertion and invalid JSON as DEGRADED', async () => {
    const failedAssert = await performHttpCheck({
      monitorId: 'm1',
      url: `${baseUrl}/health-json`,
      method: 'GET',
      timeoutSeconds: 5,
      config: {
        jsonPath: 'status',
        jsonExpectedValue: 'degraded',
      },
    });
    expect(failedAssert.state).toBe('DEGRADED');
    expect(failedAssert.networkConnected).toBe(true);

    const invalidJson = await performHttpCheck({
      monitorId: 'm1',
      url: `${baseUrl}/bad-json`,
      method: 'GET',
      timeoutSeconds: 5,
      config: {
        jsonPath: 'status',
      },
    });
    expect(invalidJson.state).toBe('DEGRADED');
    expect(invalidJson.errorMessage).toContain('Invalid JSON');
  });

  it('classifies slow response exceeding maxResponseTimeMs as DEGRADED', async () => {
    const res = await performHttpCheck({
      monitorId: 'm1',
      url: `${baseUrl}/slow-200`,
      method: 'GET',
      timeoutSeconds: 5,
      config: { maxResponseTimeMs: 20 },
    });
    expect(res.state).toBe('DEGRADED');
    expect(res.errorMessage).toContain('exceeded max');
  });

  it('classifies HTTP 301 as UP with default 200-399', async () => {
    const res = await performHttpCheck({
      monitorId: 'm1',
      url: `${baseUrl}/redirect`,
      method: 'GET',
      timeoutSeconds: 5,
    });
    expect(res.state).toBe('UP');
    expect(res.statusCode).toBe(301);
  });

  it('classifies HTTP 401, 404, 500, and 503 as DEGRADED', async () => {
    for (const [path, code] of [
      ['/unauthorized', 401],
      ['/not-found', 404],
      ['/server-error', 500],
      ['/unavailable', 503],
    ] as const) {
      const res = await performHttpCheck({
        monitorId: 'm1',
        url: `${baseUrl}${path}`,
        method: 'GET',
        timeoutSeconds: 5,
      });
      expect(res.state).toBe('DEGRADED');
      expect(res.statusCode).toBe(code);
      expect(res.networkConnected).toBe(true);
    }
  });

  it('classifies DNS failure, connection refused, and timeout as DOWN', async () => {
    const dnsRes = await performHttpCheck({
      monitorId: 'm1',
      url: 'http://nonexistent.invalid.local-test-domain',
      method: 'GET',
      timeoutSeconds: 2,
    });
    expect(dnsRes.state).toBe('DOWN');
    expect(dnsRes.networkConnected).toBe(false);

    const refRes = await performHttpCheck({
      monitorId: 'm1',
      url: 'http://127.0.0.1:59999/unreachable',
      method: 'GET',
      timeoutSeconds: 2,
    });
    expect(refRes.state).toBe('DOWN');
    expect(refRes.networkConnected).toBe(false);

    const toRes = await performHttpCheck({
      monitorId: 'm1',
      url: `${baseUrl}/slow`,
      method: 'GET',
      timeoutSeconds: 1,
    });
    expect(toRes.state).toBe('DOWN');
    expect(toRes.errorMessage).toContain('timeout');
  });
});
