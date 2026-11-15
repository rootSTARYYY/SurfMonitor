import { describe, expect, it } from 'vitest';
import {
  computeManifestSha256,
  parseAndValidateCommunityManifest,
} from '../electron/installer/community';
import { OFFICIAL_INSTALLERS } from '../electron/installer/engine';
import { DEPLOYMENT_TEMPLATES } from '../electron/installer/templates';

describe('Surf Monitor v5.0.0 Installer Engine', () => {
  it('validates official installers have unique IDs, schemas, and plans', () => {
    const ids = new Set(OFFICIAL_INSTALLERS.map((i) => i.id));
    expect(ids.size).toBe(OFFICIAL_INSTALLERS.length);
    expect(ids.has('official-docker-engine')).toBe(true);
    expect(ids.has('official-pterodactyl-panel')).toBe(true);
    expect(ids.has('official-pterodactyl-wings')).toBe(true);
    expect(ids.has('official-uptime-kuma')).toBe(true);
    expect(ids.has('official-postgresql')).toBe(true);
    expect(ids.has('official-mariadb')).toBe(true);
    expect(ids.has('official-redis')).toBe(true);
  });

  it('validates community installer manifest and detects SHA-256 mismatch', () => {
    const raw = JSON.stringify({
      manifestVersion: 1,
      packageId: 'comm.sample-tool',
      name: 'Sample Tool',
      version: '1.0.0',
      description: 'Test package',
      category: 'devtools',
      publisher: { name: 'Community Author' },
      supportedOs: ['ubuntu'],
      supportedArch: ['x86_64'],
      minDiskMb: 128,
      minRamMb: 128,
      requiredPorts: [],
      requiredPrivileges: 'user',
      permissions: ['echo hello'],
      configSchema: [],
      installCommands: [{ label: 'Echo', command: 'echo hello' }],
      verifyCommand: 'echo ok',
    });

    const sha = computeManifestSha256(raw);
    const ok = parseAndValidateCommunityManifest(raw, sha);
    expect(ok.valid).toBe(true);
    expect(ok.warnings.length).toBeGreaterThan(0);

    const badHash = parseAndValidateCommunityManifest(raw, '0000deadbeef');
    expect(badHash.valid).toBe(false);
    expect(badHash.errors[0]).toContain('SHA-256 mismatch');
  });

  it('ensures deployment templates reference valid official installer IDs', () => {
    const officialIds = new Set(OFFICIAL_INSTALLERS.map((i) => i.id));
    for (const tpl of DEPLOYMENT_TEMPLATES) {
      expect(tpl.installerIds.length).toBeGreaterThan(0);
      for (const id of tpl.installerIds) {
        expect(officialIds.has(id)).toBe(true);
      }
    }
  });
});
