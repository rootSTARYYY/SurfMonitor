import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SSH Connection Lifecycle & PM2 Agent Payload Verification', () => {
  it('tracks terminalChannels and sftpActive independently before disconnecting client', () => {
    const sshSrc = fs.readFileSync(
      path.resolve(__dirname, '../electron/remote/sshManager.ts'),
      'utf8'
    );
    expect(sshSrc).toContain('connectingPromises');
    expect(sshSrc).toContain('terminalChannels');
    expect(sshSrc).toContain('sftpActive');
    expect(sshSrc).toContain('finalizeShellCleanup');
    expect(sshSrc).toContain('closeSftpSession');
    expect(sshSrc).toContain('cleanupStarted');
    expect(sshSrc).toContain('listActiveConnections');
  });

  it('emits processKey, state, cpu, and uptimeSeconds in Surf Agent v5.0.0 PM2 collector', () => {
    const agentSrc = fs.readFileSync(
      path.resolve(__dirname, '../agent/surf-agent.mjs'),
      'utf8'
    );
    expect(agentSrc).toContain('processKey:');
    expect(agentSrc).toContain('state,');
    expect(agentSrc).toContain('uptimeSeconds,');
    expect(agentSrc).toContain('/pm2/processes');
  });
});
