import crypto from 'node:crypto';
import { assertSafeExternalUrl } from '../security/ssrfGuard';

export interface RedirectHop {
  url: string;
  statusCode: number;
  location: string | null;
}

export interface RedirectAnalysisResult {
  originalUrl: string;
  finalUrl: string;
  hops: RedirectHop[];
  redirectCount: number;
  loopDetected: boolean;
  errorMessage: string | null;
}

export interface SecurityHeaderReport {
  url: string;
  statusCode: number | null;
  present: Array<{ name: string; value: string }>;
  missing: Array<{ name: string; recommendation: string }>;
  errorMessage: string | null;
}

const SECURITY_HEADERS: Array<{ name: string; recommendation: string }> = [
  {
    name: 'strict-transport-security',
    recommendation: 'Enforce HTTPS with HSTS (max-age=31536000; includeSubDomains).',
  },
  {
    name: 'content-security-policy',
    recommendation: 'Define a Content-Security-Policy to restrict script and asset origins.',
  },
  {
    name: 'x-content-type-options',
    recommendation: 'Set X-Content-Type-Options: nosniff to prevent MIME sniffing.',
  },
  {
    name: 'x-frame-options',
    recommendation: 'Set X-Frame-Options: DENY or SAMEORIGIN to mitigate clickjacking.',
  },
  {
    name: 'referrer-policy',
    recommendation: 'Set Referrer-Policy (e.g. strict-origin-when-cross-origin).',
  },
  {
    name: 'permissions-policy',
    recommendation: 'Restrict browser features with Permissions-Policy.',
  },
];

export async function analyzeRedirects(
  rawUrl: string,
  maxHops = 10
): Promise<RedirectAnalysisResult> {
  const hops: RedirectHop[] = [];
  const visited = new Set<string>();
  let currentUrl = rawUrl;

  try {
    for (let i = 0; i <= maxHops; i++) {
      await assertSafeExternalUrl(currentUrl, false);
      if (visited.has(currentUrl)) {
        return {
          originalUrl: rawUrl,
          finalUrl: currentUrl,
          hops,
          redirectCount: hops.length,
          loopDetected: true,
          errorMessage: `Redirect loop detected at ${currentUrl}`,
        };
      }
      visited.add(currentUrl);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
        });
        if (res.body) void res.body.cancel().catch(() => {});

        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
          const nextUrl = new URL(location, currentUrl).toString();
          hops.push({ url: currentUrl, statusCode: res.status, location: nextUrl });
          currentUrl = nextUrl;
        } else {
          hops.push({ url: currentUrl, statusCode: res.status, location: null });
          return {
            originalUrl: rawUrl,
            finalUrl: currentUrl,
            hops,
            redirectCount: Math.max(0, hops.length - 1),
            loopDetected: false,
            errorMessage: null,
          };
        }
      } finally {
        clearTimeout(timer);
      }
    }

    return {
      originalUrl: rawUrl,
      finalUrl: currentUrl,
      hops,
      redirectCount: hops.length,
      loopDetected: true,
      errorMessage: `Exceeded maximum redirect limit (${maxHops})`,
    };
  } catch (err) {
    return {
      originalUrl: rawUrl,
      finalUrl: currentUrl,
      hops,
      redirectCount: hops.length,
      loopDetected: false,
      errorMessage: err instanceof Error ? err.message : 'Redirect analysis failed',
    };
  }
}

export async function analyzeSecurityHeaders(
  rawUrl: string
): Promise<SecurityHeaderReport> {
  try {
    await assertSafeExternalUrl(rawUrl, false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(rawUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (res.body) void res.body.cancel().catch(() => {});

      const present: Array<{ name: string; value: string }> = [];
      const missing: Array<{ name: string; recommendation: string }> = [];

      for (const h of SECURITY_HEADERS) {
        const val = res.headers.get(h.name);
        if (val) {
          present.push({ name: h.name, value: val });
        } else {
          missing.push(h);
        }
      }

      return {
        url: rawUrl,
        statusCode: res.status,
        present,
        missing,
        errorMessage: null,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      url: rawUrl,
      statusCode: null,
      present: [],
      missing: SECURITY_HEADERS,
      errorMessage:
        err instanceof Error ? err.message : 'Security header inspection failed',
    };
  }
}

export function normalizeContentForDiff(
  html: string,
  ignorePatterns: string[] = [],
  caseSensitive = false
): { hash: string; snippet: string } {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const pat of ignorePatterns) {
    if (pat.trim()) {
      text = text.split(pat.trim()).join('');
    }
  }

  const normalized = caseSensitive ? text : text.toLowerCase();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return {
    hash,
    snippet: text.slice(0, 4000),
  };
}

export async function crawlBrokenLinks(params: {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
}): Promise<{
  pagesScanned: number;
  results: Array<{
    pageUrl: string;
    linkUrl: string;
    statusCode: number | null;
    broken: boolean;
    errorMessage: string | null;
  }>;
}> {
  const maxPages = Math.min(25, Math.max(1, params.maxPages ?? 10));
  const maxDepth = Math.min(3, Math.max(0, params.maxDepth ?? 1));

  const startParsed = await assertSafeExternalUrl(params.startUrl, false);
  const origin = startParsed.origin;

  const visitedPages = new Set<string>();
  const checkedLinks = new Map<
    string,
    { statusCode: number | null; broken: boolean; errorMessage: string | null }
  >();
  const queue: Array<{ url: string; depth: number }> = [
    { url: startParsed.toString(), depth: 0 },
  ];
  const results: Array<{
    pageUrl: string;
    linkUrl: string;
    statusCode: number | null;
    broken: boolean;
    errorMessage: string | null;
  }> = [];

  while (queue.length > 0 && visitedPages.size < maxPages) {
    const item = queue.shift()!;
    if (visitedPages.has(item.url)) continue;
    visitedPages.add(item.url);

    try {
      await assertSafeExternalUrl(item.url, false);
      const res = await fetch(item.url, { method: 'GET', redirect: 'follow' });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        if (res.body) void res.body.cancel().catch(() => {});
        continue;
      }
      const html = (await res.text()).slice(0, 500_000);
      const hrefMatches = Array.from(
        html.matchAll(/href=["']([^"'#]+)["']/gi)
      ).map((m) => m[1]);

      for (const rawHref of hrefMatches.slice(0, 40)) {
        if (
          rawHref.startsWith('mailto:') ||
          rawHref.startsWith('tel:') ||
          rawHref.startsWith('javascript:')
        ) {
          continue;
        }
        let resolvedUrl: string;
        try {
          const u = new URL(rawHref, item.url);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
          resolvedUrl = u.toString();
        } catch {
          continue;
        }

        let check = checkedLinks.get(resolvedUrl);
        if (!check) {
          try {
            await assertSafeExternalUrl(resolvedUrl, false);
            const linkRes = await fetch(resolvedUrl, {
              method: 'HEAD',
              redirect: 'follow',
            });
            if (linkRes.body) void linkRes.body.cancel().catch(() => {});
            const broken = linkRes.status >= 400;
            check = {
              statusCode: linkRes.status,
              broken,
              errorMessage: broken ? `HTTP ${linkRes.status}` : null,
            };
          } catch (err) {
            check = {
              statusCode: null,
              broken: true,
              errorMessage:
                err instanceof Error ? err.message : 'Request failed',
            };
          }
          checkedLinks.set(resolvedUrl, check);
        }

        results.push({
          pageUrl: item.url,
          linkUrl: resolvedUrl,
          statusCode: check.statusCode,
          broken: check.broken,
          errorMessage: check.errorMessage,
        });

        if (
          item.depth < maxDepth &&
          resolvedUrl.startsWith(origin) &&
          !visitedPages.has(resolvedUrl)
        ) {
          queue.push({ url: resolvedUrl, depth: item.depth + 1 });
        }
      }
    } catch {
      // Skip page on fetch/SSRF failure
    }
  }

  return {
    pagesScanned: visitedPages.size,
    results,
  };
}
