import { SurfDatabase } from '../db/database';

export type ReleaseChannel = 'stable' | 'beta' | 'rc' | 'older';

export interface DiscoveredVersion {
  tag: string;
  version: string;
  channel: ReleaseChannel;
  publishedAt: string | null;
  releaseNotesUrl: string | null;
}

export interface VersionDiscoveryResult {
  installerId: string;
  upstreamSource: string;
  upstreamUrl: string;
  latestStable: DiscoveredVersion | null;
  latestBeta: DiscoveredVersion | null;
  versions: DiscoveredVersion[];
  fetchedAt: string;
  fromCache: boolean;
  staleReason?: string;
}

interface UpstreamSpec {
  provider: 'github_releases' | 'github_tags' | 'nodejs_dist' | 'distro';
  repo?: string;
  url: string;
}

const UPSTREAM_MAP: Record<string, UpstreamSpec> = {
  'official-pterodactyl-panel': {
    provider: 'github_releases',
    repo: 'pterodactyl/panel',
    url: 'https://api.github.com/repos/pterodactyl/panel/releases?per_page=20',
  },
  'official-pterodactyl-wings': {
    provider: 'github_releases',
    repo: 'pterodactyl/wings',
    url: 'https://api.github.com/repos/pterodactyl/wings/releases?per_page=20',
  },
  'official-uptime-kuma': {
    provider: 'github_releases',
    repo: 'louislam/uptime-kuma',
    url: 'https://api.github.com/repos/louislam/uptime-kuma/releases?per_page=20',
  },
  'official-docker-engine': {
    provider: 'github_releases',
    repo: 'moby/moby',
    url: 'https://api.github.com/repos/moby/moby/releases?per_page=15',
  },
  'official-nodejs': {
    provider: 'nodejs_dist',
    url: 'https://nodejs.org/dist/index.json',
  },
  'official-postgresql': {
    provider: 'github_tags',
    repo: 'postgres/postgres',
    url: 'https://api.github.com/repos/postgres/postgres/tags?per_page=20',
  },
  'official-mariadb': {
    provider: 'github_releases',
    repo: 'MariaDB/server',
    url: 'https://api.github.com/repos/MariaDB/server/releases?per_page=15',
  },
  'official-redis': {
    provider: 'github_releases',
    repo: 'redis/redis',
    url: 'https://api.github.com/repos/redis/redis/releases?per_page=15',
  },
  'official-nginx': {
    provider: 'github_tags',
    repo: 'nginx/nginx',
    url: 'https://api.github.com/repos/nginx/nginx/tags?per_page=15',
  },
  'official-fail2ban': {
    provider: 'github_releases',
    repo: 'fail2ban/fail2ban',
    url: 'https://api.github.com/repos/fail2ban/fail2ban/releases?per_page=10',
  },
  'official-ufw': {
    provider: 'distro',
    url: 'https://launchpad.net/ufw',
  },
};

export function classifyReleaseChannel(tag: string, prereleaseFlag = false): ReleaseChannel {
  const lower = tag.toLowerCase();
  if (prereleaseFlag || /-(alpha|beta|dev|nightly)/.test(lower)) return 'beta';
  if (/-rc/.test(lower)) return 'rc';
  return 'stable';
}

export function parseGitHubReleasesPayload(
  installerId: string,
  upstreamUrl: string,
  items: Array<{ tag_name?: string; prerelease?: boolean; draft?: boolean; published_at?: string; html_url?: string }>
): VersionDiscoveryResult {
  const versions: DiscoveredVersion[] = [];
  for (const r of items) {
    if (r.draft || !r.tag_name) continue;
    const tag = r.tag_name.trim();
    const channel = classifyReleaseChannel(tag, Boolean(r.prerelease));
    versions.push({
      tag,
      version: tag.replace(/^v/i, ''),
      channel,
      publishedAt: r.published_at ?? null,
      releaseNotesUrl: r.html_url ?? null,
    });
  }

  const latestStable = versions.find((v) => v.channel === 'stable') ?? null;
  const latestBeta = versions.find((v) => v.channel === 'beta' || v.channel === 'rc') ?? null;

  return {
    installerId,
    upstreamSource: 'GitHub Releases API',
    upstreamUrl,
    latestStable,
    latestBeta,
    versions,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };
}

export class VersionDiscoveryService {
  private readonly cacheTtlMs = 6 * 60 * 60 * 1000; // 6 hours

  constructor(private db: SurfDatabase) {}

  public async getVersions(installerId: string, forceRefresh = false): Promise<VersionDiscoveryResult> {
    const spec = UPSTREAM_MAP[installerId];
    const cacheKey = `version_cache_${installerId}`;
    const rawCache = this.db.getAppSetting(cacheKey);
    const cached = rawCache ? (JSON.parse(rawCache) as VersionDiscoveryResult) : null;

    if (!forceRefresh && cached && Date.now() - Date.parse(cached.fetchedAt) < this.cacheTtlMs) {
      return { ...cached, fromCache: true };
    }

    if (!spec || spec.provider === 'distro') {
      return {
        installerId,
        upstreamSource: 'Distribution Package Repository',
        upstreamUrl: spec?.url ?? '',
        latestStable: {
          tag: 'distro-stable',
          version: 'Distro Stable',
          channel: 'stable',
          publishedAt: null,
          releaseNotesUrl: spec?.url ?? null,
        },
        latestBeta: null,
        versions: [
          {
            tag: 'distro-stable',
            version: 'Distro Stable',
            channel: 'stable',
            publishedAt: null,
            releaseNotesUrl: spec?.url ?? null,
          },
        ],
        fetchedAt: new Date().toISOString(),
        fromCache: false,
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(spec.url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'SurfMonitor/5.0.0',
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Upstream HTTP ${res.status} (${res.statusText})`);
      }

      const data = (await res.json()) as unknown;
      let result: VersionDiscoveryResult;

      if (spec.provider === 'github_releases' && Array.isArray(data)) {
        result = parseGitHubReleasesPayload(installerId, spec.url, data);
      } else if (spec.provider === 'github_tags' && Array.isArray(data)) {
        const mapped = (data as Array<{ name?: string }>).map((t) => ({
          tag_name: t.name,
          prerelease: /-(alpha|beta|rc)/i.test(t.name ?? ''),
        }));
        result = parseGitHubReleasesPayload(installerId, spec.url, mapped);
        result.upstreamSource = 'GitHub Tags API';
      } else if (spec.provider === 'nodejs_dist' && Array.isArray(data)) {
        const lts = (data as Array<{ version: string; lts: string | false; date: string }>)
          .filter((d) => d.lts)
          .slice(0, 12);
        const versions: DiscoveredVersion[] = lts.map((d) => ({
          tag: d.version,
          version: d.version.replace(/^v/, ''),
          channel: 'stable',
          publishedAt: d.date,
          releaseNotesUrl: `https://nodejs.org/en/blog/release/${d.version}`,
        }));
        result = {
          installerId,
          upstreamSource: 'Node.js Official Distribution Index',
          upstreamUrl: spec.url,
          latestStable: versions[0] ?? null,
          latestBeta: null,
          versions,
          fetchedAt: new Date().toISOString(),
          fromCache: false,
        };
      } else {
        throw new Error('Unexpected upstream payload');
      }

      this.db.setAppSetting(cacheKey, JSON.stringify(result));
      return result;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          staleReason: `Upstream unavailable (${reason}); showing last known good result.`,
        };
      }
      return {
        installerId,
        upstreamSource: spec.url,
        upstreamUrl: spec.url,
        latestStable: null,
        latestBeta: null,
        versions: [],
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        staleReason: `Version discovery failed: ${reason}`,
      };
    }
  }
}
