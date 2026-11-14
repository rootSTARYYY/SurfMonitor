import { CheckRecord } from '../db/database';

export interface UptimeStats {
  uptime24h: number | null;
  uptime7d: number | null;
  uptime30d: number | null;
  uptimeTotal: number | null;
  appHealthTotal: number | null;
  avgResponseTimeMs: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
  totalChecks: number;
  upChecks: number;
  degradedChecks: number;
  downChecks: number;
}

function isReachable(check: CheckRecord): boolean {
  // Server is reachable when UP or DEGRADED (networkConnected === 1 or state !== 'DOWN')
  if (check.state) {
    return check.state !== 'DOWN';
  }
  return check.networkConnected === 1 || check.success === 1;
}

function isHealthy(check: CheckRecord): boolean {
  if (check.state) {
    return check.state === 'UP';
  }
  return check.applicationHealthy === 1 && check.success === 1;
}

function computeReachabilityPct(checks: CheckRecord[]): number | null {
  if (checks.length === 0) return null;
  const reachable = checks.reduce(
    (acc, c) => acc + (isReachable(c) ? 1 : 0),
    0
  );
  return Number(((reachable / checks.length) * 100).toFixed(2));
}

function computeHealthPct(checks: CheckRecord[]): number | null {
  if (checks.length === 0) return null;
  const healthy = checks.reduce((acc, c) => acc + (isHealthy(c) ? 1 : 0), 0);
  return Number(((healthy / checks.length) * 100).toFixed(2));
}

export function calculateUptimeStats(
  checks: CheckRecord[],
  nowMs: number = Date.now()
): UptimeStats {
  const ms24h = nowMs - 24 * 60 * 60 * 1000;
  const ms7d = nowMs - 7 * 24 * 60 * 60 * 1000;
  const ms30d = nowMs - 30 * 24 * 60 * 60 * 1000;

  const checks24h: CheckRecord[] = [];
  const checks7d: CheckRecord[] = [];
  const checks30d: CheckRecord[] = [];
  const latencies: number[] = [];

  let upChecks = 0;
  let degradedChecks = 0;
  let downChecks = 0;

  for (const check of checks) {
    const t = new Date(check.checkedAt).getTime();
    if (t >= ms24h) checks24h.push(check);
    if (t >= ms7d) checks7d.push(check);
    if (t >= ms30d) checks30d.push(check);

    if (check.state === 'UP') {
      upChecks++;
    } else if (check.state === 'DEGRADED') {
      degradedChecks++;
    } else if (check.state === 'DOWN') {
      downChecks++;
    } else if (check.success === 1) {
      upChecks++;
    } else {
      downChecks++;
    }

    if (check.responseTime !== null && check.responseTime >= 0) {
      latencies.push(check.responseTime);
    }
  }

  let avgResponseTimeMs: number | null = null;
  let minResponseTimeMs: number | null = null;
  let maxResponseTimeMs: number | null = null;

  if (latencies.length > 0) {
    let sum = 0;
    let min = latencies[0];
    let max = latencies[0];
    for (const val of latencies) {
      sum += val;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    avgResponseTimeMs = Math.round(sum / latencies.length);
    minResponseTimeMs = min;
    maxResponseTimeMs = max;
  }

  return {
    uptime24h: computeReachabilityPct(checks24h),
    uptime7d: computeReachabilityPct(checks7d),
    uptime30d: computeReachabilityPct(checks30d),
    uptimeTotal: computeReachabilityPct(checks),
    appHealthTotal: computeHealthPct(checks),
    avgResponseTimeMs,
    minResponseTimeMs,
    maxResponseTimeMs,
    totalChecks: checks.length,
    upChecks,
    degradedChecks,
    downChecks,
  };
}
