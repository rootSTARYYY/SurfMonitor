import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Surf Agent v5.0.0 Verification', () => {
  const agentPath = path.resolve(__dirname, '../agent/surf-agent.mjs');
  const agentSrc = fs.readFileSync(agentPath, 'utf8');

  it('declares AGENT_VERSION 5.0.0 and removes v4 AI assistant endpoints', () => {
    expect(agentSrc).toContain("const AGENT_VERSION = '5.0.0'");
    expect(agentSrc).not.toContain('/v1/diagnostics');
    expect(agentSrc).not.toContain('runLocalDiagnostics');
  });

  it('implements performance booster, DDoS anomaly detection, self-integrity, and capacity forecasting', () => {
    for (const route of [
      '/health',
      '/metrics',
      '/v1/metrics/snapshot',
      '/v1/performance/analysis',
      '/v1/performance/profiles',
      '/v1/performance/profiles/apply',
      '/v1/performance/profiles/rollback',
      '/v1/capacity/forecast',
      '/v1/network/anomalies',
      '/v1/security/mitigations/block-ip',
      '/v1/security/overview',
      '/v1/events',
    ]) {
      expect(agentSrc).toContain(route);
    }
    expect(agentSrc).toContain('checkSelfIntegrity');
    expect(agentSrc).toContain('computeCapacityForecast');
  });
});
