import { describe, expect, it } from 'vitest';
import { calculateUptimeStats } from '../electron/engine/uptime';
import { CheckRecord } from '../electron/db/database';

function makeCheck(
  overrides: Partial<CheckRecord> & {
    checkedAt: string;
    state: 'UP' | 'DEGRADED' | 'DOWN';
  }
): CheckRecord {
  const reachable = overrides.state !== 'DOWN' ? 1 : 0;
  const healthy = overrides.state === 'UP' ? 1 : 0;
  return {
    id: 1,
    monitorId: 'mon-1',
    responseTime: overrides.state === 'DOWN' ? null : 50,
    statusCode:
      overrides.state === 'UP' ? 200 : overrides.state === 'DEGRADED' ? 404 : null,
    networkConnected: reachable,
    httpResponseReceived: reachable,
    applicationHealthy: healthy,
    success: healthy,
    errorMessage: overrides.state === 'UP' ? null : 'Issue',
    ...overrides,
  };
}

describe('calculateUptimeStats', () => {
  it('returns null uptime and latency when no checks exist', () => {
    const stats = calculateUptimeStats([], Date.now());
    expect(stats.uptime24h).toBeNull();
    expect(stats.uptime7d).toBeNull();
    expect(stats.uptime30d).toBeNull();
    expect(stats.uptimeTotal).toBeNull();
    expect(stats.appHealthTotal).toBeNull();
    expect(stats.avgResponseTimeMs).toBeNull();
    expect(stats.totalChecks).toBe(0);
  });

  it('separates server reachability (UP+DEGRADED) from application health (UP only)', () => {
    const now = new Date('2026-11-13T12:00:00.000Z').getTime();
    const checks: CheckRecord[] = [
      makeCheck({
        id: 1,
        checkedAt: new Date(now - 1 * 3600_000).toISOString(),
        state: 'UP',
        responseTime: 40,
      }),
      makeCheck({
        id: 2,
        checkedAt: new Date(now - 2 * 3600_000).toISOString(),
        state: 'DEGRADED',
        responseTime: 60,
      }),
      makeCheck({
        id: 3,
        checkedAt: new Date(now - 3 * 3600_000).toISOString(),
        state: 'UP',
        responseTime: 80,
      }),
      makeCheck({
        id: 4,
        checkedAt: new Date(now - 4 * 3600_000).toISOString(),
        state: 'DOWN',
        responseTime: null,
      }),
    ];

    const stats = calculateUptimeStats(checks, now);
    // Reachable: 3 of 4 (UP + DEGRADED) -> 75%
    expect(stats.uptime24h).toBe(75);
    expect(stats.uptimeTotal).toBe(75);
    // App health: 2 of 4 (UP only) -> 50%
    expect(stats.appHealthTotal).toBe(50);
    expect(stats.upChecks).toBe(2);
    expect(stats.degradedChecks).toBe(1);
    expect(stats.downChecks).toBe(1);
    expect(stats.minResponseTimeMs).toBe(40);
    expect(stats.maxResponseTimeMs).toBe(80);
    expect(stats.avgResponseTimeMs).toBe(60);
  });
});
