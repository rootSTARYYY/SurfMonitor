import { describe, expect, it } from 'vitest';
import {
  classifyReleaseChannel,
  parseGitHubReleasesPayload,
} from '../electron/installer/versionDiscovery';

describe('Upstream Version Discovery & Channel Classification', () => {
  it('separates Pterodactyl stable and beta pre-releases accurately', () => {
    const res = parseGitHubReleasesPayload(
      'official-pterodactyl-panel',
      'https://api.github.com/repos/pterodactyl/panel/releases',
      [
        {
          tag_name: 'v2.0.0-beta.2',
          prerelease: true,
          published_at: '2026-10-01T00:00:00Z',
          html_url: 'https://github.com/pterodactyl/panel/releases/tag/v2.0.0-beta.2',
        },
        {
          tag_name: 'v1.15.2',
          prerelease: false,
          published_at: '2026-09-15T00:00:00Z',
          html_url: 'https://github.com/pterodactyl/panel/releases/tag/v1.15.2',
        },
      ]
    );

    expect(res.latestStable?.tag).toBe('v1.15.2');
    expect(res.latestBeta?.tag).toBe('v2.0.0-beta.2');
    expect(res.versions).toHaveLength(2);
    expect(res.fromCache).toBe(false);
  });

  it('classifies rc and beta tags properly', () => {
    expect(classifyReleaseChannel('v1.15.2', false)).toBe('stable');
    expect(classifyReleaseChannel('v2.0.0-beta.2', false)).toBe('beta');
    expect(classifyReleaseChannel('v2.0.0-rc.1', false)).toBe('rc');
  });
});
