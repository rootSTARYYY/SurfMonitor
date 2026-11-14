import React, { useState } from 'react';
import {
  Globe,
  HeartPulse,
  Link2,
  Network,
  Play,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Monitor } from '@/types';
import { MonitorRow } from '@/components/MonitorRow';

interface FilteredMonitorsPageProps {
  title: string;
  subtitle: string;
  monitors: Monitor[];
  onSelectMonitor: (id: string) => void;
  onRunCheck: (m: Monitor) => void;
  heartbeatPort?: number;
}

export const FilteredMonitorsPage: React.FC<FilteredMonitorsPageProps> = ({
  title,
  subtitle,
  monitors,
  onSelectMonitor,
  onRunCheck,
  heartbeatPort,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
        <p className="font-mono text-xs text-zinc-500">{subtitle}</p>
      </div>

      {heartbeatPort && (
        <div className="rounded border border-emerald-500/25 bg-emerald-500/5 p-3 font-mono text-xs text-zinc-300">
          <div className="flex items-center gap-2 font-semibold text-emerald-400">
            <HeartPulse className="h-4 w-4" />
            <span>Local Heartbeat Receiver Active on 127.0.0.1:{heartbeatPort}</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Send a GET or POST request to{' '}
            <code className="text-zinc-200">
              http://127.0.0.1:{heartbeatPort}/heartbeat/&lt;monitorId&gt;
            </code>{' '}
            from local scheduled jobs. For remote servers, expose via a reverse proxy or tunnel.
          </p>
        </div>
      )}

      {monitors.length === 0 ? (
        <div className="rounded border border-dashed border-white/[0.1] bg-[#09090b] p-12 text-center font-mono text-xs text-zinc-500">
          No monitors of this type configured yet. Click Add Monitor to create one.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-white/[0.08]">
          {monitors.map((m) => (
            <div key={m.id} className="relative">
              <MonitorRow monitor={m} onSelect={onSelectMonitor} />
              {heartbeatPort && (
                <div className="border-b border-white/[0.06] bg-[#0c0e13] px-4 py-1.5 font-mono text-[11px] text-zinc-400">
                  Endpoint:{' '}
                  <span className="text-emerald-400">
                    http://127.0.0.1:{heartbeatPort}/heartbeat/{m.id}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRunCheck(m)}
                className="absolute right-32 top-3 hidden rounded border border-white/[0.1] bg-[#101114] px-2 py-1 font-mono text-[10px] text-zinc-300 hover:border-white/[0.2] sm:inline-flex sm:items-center sm:gap-1"
              >
                <Play className="h-2.5 w-2.5 text-emerald-400" />
                Check
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------------- WEBSITE INTELLIGENCE PAGE ---------------- */
export const WebsiteIntelligencePage: React.FC = () => {
  const [targetUrl, setTargetUrl] = useState('https://example.com');
  const [loading, setLoading] = useState(false);

  const [redirects, setRedirects] = useState<{
    finalUrl: string;
    redirectCount: number;
    loopDetected: boolean;
    hops: Array<{ url: string; statusCode: number; location: string | null }>;
    errorMessage: string | null;
  } | null>(null);

  const [secHeaders, setSecHeaders] = useState<{
    statusCode: number | null;
    present: Array<{ name: string; value: string }>;
    missing: Array<{ name: string; recommendation: string }>;
    errorMessage: string | null;
  } | null>(null);

  const [brokenResults, setBrokenResults] = useState<
    Array<{
      id: number;
      pageUrl: string;
      linkUrl: string;
      statusCode: number | null;
      broken: number;
      errorMessage: string | null;
    }>
  >([]);

  const runRedirects = async () => {
    if (!window.surfMonitorAPI) return;
    setLoading(true);
    try {
      setRedirects(await window.surfMonitorAPI.analyzeRedirects(targetUrl));
    } finally {
      setLoading(false);
    }
  };

  const runHeaders = async () => {
    if (!window.surfMonitorAPI) return;
    setLoading(true);
    try {
      setSecHeaders(
        await window.surfMonitorAPI.analyzeSecurityHeaders(targetUrl)
      );
    } finally {
      setLoading(false);
    }
  };

  const runBrokenLinks = async () => {
    if (!window.surfMonitorAPI) return;
    setLoading(true);
    try {
      const res = await window.surfMonitorAPI.runBrokenLinkScan(
        targetUrl,
        10,
        1
      );
      setBrokenResults(res.results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">
          Website Intelligence
        </h1>
        <p className="font-mono text-xs text-zinc-500">
          SSRF-protected redirect chain analyzer, security headers audit, and broken link scanner
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded border border-white/[0.08] bg-[#09090b] p-4">
        <input
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          className="min-w-[260px] flex-1 rounded border border-white/[0.1] bg-[#101114] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void runRedirects()}
          className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-3 py-2 font-mono text-xs text-zinc-200 hover:bg-white/[0.05]"
        >
          <Globe className="h-3.5 w-3.5 text-emerald-400" />
          <span>Analyze Redirects</span>
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void runHeaders()}
          className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-3 py-2 font-mono text-xs text-zinc-200 hover:bg-white/[0.05]"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Security Headers</span>
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void runBrokenLinks()}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-2 font-mono text-xs text-white hover:bg-emerald-500"
        >
          <Link2 className="h-3.5 w-3.5" />
          <span>Scan Broken Links</span>
        </button>
      </div>

      {redirects && (
        <section className="rounded border border-white/[0.08] bg-[#09090b] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">
              Redirect Chain ({redirects.redirectCount} redirects)
            </h2>
            {redirects.loopDetected && (
              <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-400">
                LOOP DETECTED
              </span>
            )}
          </div>
          {redirects.errorMessage && (
            <p className="mt-2 font-mono text-xs text-rose-400">
              {redirects.errorMessage}
            </p>
          )}
          <div className="mt-3 space-y-1.5 font-mono text-xs">
            {redirects.hops.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-[#101114] px-3 py-2"
              >
                <span className="truncate text-zinc-300">{h.url}</span>
                <span className="text-emerald-400">HTTP {h.statusCode}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {secHeaders && (
        <section className="grid grid-cols-1 gap-4 rounded border border-white/[0.08] bg-[#09090b] p-4 lg:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              Present Headers ({secHeaders.present.length})
            </h3>
            <div className="mt-2 space-y-1.5 font-mono text-[11px]">
              {secHeaders.present.map((h) => (
                <div key={h.name} className="rounded bg-[#101114] p-2">
                  <div className="text-zinc-200">{h.name}</div>
                  <div className="mt-0.5 truncate text-zinc-500">{h.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <ShieldAlert className="h-4 w-4" />
              Missing Headers ({secHeaders.missing.length})
            </h3>
            <div className="mt-2 space-y-1.5 font-mono text-[11px]">
              {secHeaders.missing.map((h) => (
                <div key={h.name} className="rounded bg-[#101114] p-2">
                  <div className="text-zinc-200">{h.name}</div>
                  <div className="mt-0.5 text-zinc-500">
                    {h.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {brokenResults.length > 0 && (
        <section className="rounded border border-white/[0.08] bg-[#09090b] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <SearchCheck className="h-4 w-4 text-emerald-400" />
            Broken Link Report ({brokenResults.filter((r) => r.broken === 1).length} broken of {brokenResults.length} links)
          </h2>
          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] text-zinc-500">
                  <th className="py-2">Link URL</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {brokenResults.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-md truncate py-2 text-zinc-300">
                      {r.linkUrl}
                    </td>
                    <td className="py-2 text-zinc-400">
                      {r.statusCode ?? 'ERR'}
                    </td>
                    <td className="py-2">
                      <span
                        className={
                          r.broken === 1 ? 'text-rose-400' : 'text-emerald-400'
                        }
                      >
                        {r.broken === 1 ? r.errorMessage || 'BROKEN' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export { Network as NetworkIcon };
