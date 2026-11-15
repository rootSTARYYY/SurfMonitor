import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Surf Agent v4.0.0 Verification', () => {
  const agentPath = path.resolve(__dirname, '../agent/surf-agent.mjs');
  const agentSrc = fs.readFileSync(agentPath, 'utf8');

  it('declares AGENT_VERSION 4.0.0 and preserves v3.x + v4.0.0 API routes', () => {
    expect(agentSrc).toContain("const AGENT_VERSION = '4.0.0'");
    for (const route of [
      '/health',
      '/v1/agent/health',
      '/v1/agent/capabilities',
      '/metrics',
      '/v1/metrics/snapshot',
      '/v1/processes',
      '/v1/network/ports',
      '/v1/events',
      '/v1/agent/activity',
      '/v1/agent/settings',
      '/v1/security/overview',
      '/v1/diagnostics',
      '/pm2',
      '/docker/containers',
      '/services',
    ]) {
      expect(agentSrc).toContain(route);
    }
  });

  it('uses native /proc collectors and local-first diagnostics without external AI dependency', () => {
    expect(agentSrc).toContain('/proc/stat');
    expect(agentSrc).toContain('/proc/meminfo');
    expect(agentSrc).toContain('/proc/net/dev');
    expect(agentSrc).toContain('/proc/diskstats');
    expect(agentSrc).toContain('runLocalDiagnostics');
    expect(agentSrc).toContain('local_deterministic');
  });
});
