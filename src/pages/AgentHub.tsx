import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Cpu,
  History,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { RemoteServerDTO } from '@/types';

interface AgentHubProps {
  servers: RemoteServerDTO[];
  initialPrompt?: { serverId?: string; query: string } | null;
  onClearInitialPrompt?: () => void;
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}

type AgentTab = 'overview' | 'assistant' | 'security' | 'capabilities' | 'settings' | 'activity';

const QUICK_PROMPTS = [
  'Why is port 443 occupied? (Pterodactyl conflict)',
  'Why is my server using so much RAM?',
  'What is consuming all my disk space?',
  'How can I protect this server against DDoS attacks?',
];

export const AgentHubPage: React.FC<AgentHubProps> = ({
  servers,
  initialPrompt,
  onClearInitialPrompt,
  onNotify,
}) => {
  const [tab, setTab] = useState<AgentTab>(initialPrompt ? 'assistant' : 'overview');
  const [serverId, setServerId] = useState(initialPrompt?.serverId || servers[0]?.id || '');
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState<{
    health: Record<string, unknown> | null;
    capabilities: Record<string, unknown> | null;
    events: Array<Record<string, unknown>>;
    processes: Array<Record<string, unknown>>;
    ports: Array<Record<string, unknown>>;
  } | null>(null);
  const [security, setSecurity] = useState<Record<string, unknown> | null>(null);
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [agentSettings, setAgentSettings] = useState<Record<string, unknown> | null>(null);

  const [query, setQuery] = useState(initialPrompt?.query ?? '');
  const [diagReport, setDiagReport] = useState<Record<string, unknown> | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => {
    if (!serverId && servers.length > 0) setServerId(servers[0].id);
  }, [servers, serverId]);

  useEffect(() => {
    if (initialPrompt) {
      if (initialPrompt.serverId) setServerId(initialPrompt.serverId);
      setQuery(initialPrompt.query);
      setTab('assistant');
      onClearInitialPrompt?.();
    }
  }, [initialPrompt]);

  const loadData = async () => {
    if (!serverId || !window.surfMonitorAPI) return;
    setLoading(true);
    try {
      const [ov, sec, act, cfg] = await Promise.all([
        window.surfMonitorAPI.getAgentOverview(serverId).catch(() => null),
        window.surfMonitorAPI.getAgentSecurity(serverId).catch(() => null),
        window.surfMonitorAPI.getAgentActivity(serverId).catch(() => ({ activity: [] })),
        window.surfMonitorAPI.getAgentSettings(serverId).catch(() => null),
      ]);
      setOverview(ov);
      setSecurity(sec);
      setActivity(act?.activity ?? []);
      setAgentSettings(cfg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [serverId]);

  const runDiagnostics = async (customQuery?: string) => {
    const q = (customQuery ?? query).trim();
    if (!q || !serverId || !window.surfMonitorAPI) return;
    setDiagnosing(true);
    try {
      const report = await window.surfMonitorAPI.runAgentDiagnostics(serverId, q);
      setDiagReport(report);
    } catch (err) {
      onNotify('Diagnostics failed', 'error', err instanceof Error ? err.message : String(err));
    } finally {
      setDiagnosing(false);
    }
  };

  const health = overview?.health as Record<string, unknown> | null;
  const selfMetrics = (health?.selfMetrics as Record<string, unknown> | undefined) ?? {};
  const agentVersion = String(health?.version ?? 'Not connected / v3.x');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Surf Agent <span className="font-mono text-xs text-emerald-400">v4.0.0</span>
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Local-first server intelligence, diagnostics, DDoS/firewall protection &amp; performance telemetry
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.host})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!serverId}
            onClick={async () => {
              if (!serverId) return;
              try {
                const res = await window.surfMonitorAPI?.upgradeRemoteServerAgent(serverId);
                onNotify(res?.ok ? 'Agent upgraded to v4.0.0' : 'Upgrade failed', res?.ok ? 'success' : 'error');
                await loadData();
              } catch (err) {
                onNotify('Upgrade error', 'error', err instanceof Error ? err.message : String(err));
              }
            }}
            className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-xs text-emerald-300 hover:bg-emerald-500/20"
          >
            Update Agent
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-1 font-mono text-xs">
        {(
          [
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'assistant', label: 'Agent Assistant', icon: Bot },
            { id: 'security', label: 'Protection & Security', icon: Shield },
            { id: 'capabilities', label: 'Capabilities', icon: Wrench },
            { id: 'settings', label: 'Agent Settings', icon: Sliders },
            { id: 'activity', label: 'Activity', icon: History },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors ${
                tab === item.id ? 'bg-white/[0.09] text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
              <div className="font-mono text-[10px] text-zinc-500">Agent Version</div>
              <div className="mt-1 font-mono text-base font-semibold text-emerald-400">{agentVersion}</div>
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
              <div className="font-mono text-[10px] text-zinc-500">Agent RAM (RSS)</div>
              <div className="mt-1 font-mono text-base font-semibold text-zinc-100">
                {selfMetrics.rssMb !== undefined ? `${selfMetrics.rssMb} MB` : '—'}
              </div>
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
              <div className="font-mono text-[10px] text-zinc-500">Event Loop Lag</div>
              <div className="mt-1 font-mono text-base font-semibold text-zinc-100">
                {selfMetrics.eventLoopLagMs !== undefined ? `${selfMetrics.eventLoopLagMs} ms` : '—'}
              </div>
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
              <div className="font-mono text-[10px] text-zinc-500">Listening Ports</div>
              <div className="mt-1 font-mono text-base font-semibold text-zinc-100">
                {overview?.ports.length ?? 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
              <div className="mb-2 font-mono text-xs font-semibold text-zinc-200">
                Real-Time Events ({overview?.events.length ?? 0})
              </div>
              {!overview?.events.length ? (
                <p className="py-6 text-center font-mono text-xs text-zinc-500">No threshold or failure events detected.</p>
              ) : (
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {overview.events.map((e) => (
                    <div key={String(e.id)} className="rounded border border-white/[0.06] bg-[#101114] p-2 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className={e.severity === 'critical' ? 'text-rose-400' : 'text-amber-300'}>
                          {String(e.title)}
                        </span>
                        <span className="text-zinc-500">{new Date(String(e.timestamp)).toLocaleTimeString()}</span>
                      </div>
                      <div className="mt-0.5 text-zinc-400">{String(e.detail)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
              <div className="mb-2 font-mono text-xs font-semibold text-zinc-200">
                Listening Ports &amp; Process Ownership
              </div>
              {!overview?.ports.length ? (
                <p className="py-6 text-center font-mono text-xs text-zinc-500">Connect to a Surf Agent v4.0.0 server to view ports.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto font-mono text-[11px]">
                  <table className="w-full text-left">
                    <thead className="text-[10px] text-zinc-500">
                      <tr>
                        <th className="py-1">Port</th>
                        <th className="py-1">Proto</th>
                        <th className="py-1">Process</th>
                        <th className="py-1">PID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {overview.ports.slice(0, 30).map((p, i) => (
                        <tr key={i}>
                          <td className="py-1 text-emerald-400">{String(p.port)}</td>
                          <td className="py-1 text-zinc-400">{String(p.proto)}</td>
                          <td className="py-1 text-zinc-200">{String(p.process ?? '—')}</td>
                          <td className="py-1 text-zinc-500">{String(p.pid ?? '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'assistant' && (
        <div className="space-y-4">
          <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Local-First Diagnostic Assistant (No External AI Required)
              </div>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                100% Local Rules + Live Server Data
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => {
                    setQuery(qp);
                    void runDiagnostics(qp);
                  }}
                  className="rounded border border-white/[0.08] bg-[#101114] px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:border-emerald-500/40"
                >
                  {qp}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runDiagnostics();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about port 443 conflicts, high RAM, disk usage, Nginx, Docker, or DDoS protection..."
                className="flex-1 rounded border border-white/[0.1] bg-[#101114] px-3 py-2 text-xs text-zinc-100"
              />
              <button
                type="submit"
                disabled={diagnosing || !serverId}
                className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 font-mono text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {diagnosing ? 'Analyzing...' : 'Diagnose'}
              </button>
            </form>
          </div>

          {diagReport && (
            <div className="space-y-4">
              <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
                <div className="mb-2 font-mono text-xs font-semibold text-zinc-200">
                  Confirmed Server Findings
                </div>
                <ul className="space-y-1.5 font-mono text-xs text-zinc-300">
                  {((diagReport.facts as string[]) ?? []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {((diagReport.solutions as Array<Record<string, unknown>>) ?? []).map((sol) => (
                  <div
                    key={String(sol.id)}
                    className={`rounded-md border p-4 ${
                      sol.recommended
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-white/[0.08] bg-[#09090b]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-zinc-100">{String(sol.title)}</h3>
                      {Boolean(sol.recommended) && (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-400">{String(sol.explanation)}</p>
                    <div className="mt-3 space-y-1 font-mono text-[11px]">
                      <div className="text-emerald-300">
                        + Pros: {((sol.advantages as string[]) ?? []).join(' • ')}
                      </div>
                      <div className="text-amber-300">
                        − Cons: {((sol.disadvantages as string[]) ?? []).join(' • ')}
                      </div>
                      <div className="text-zinc-400">
                        Risks: {String(sol.risks)} • Downtime: {sol.downtimeExpected ? 'Yes' : 'No'} • Rollback:{' '}
                        {sol.rollbackAvailable ? 'Available' : 'Manual'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-xs text-amber-200">
            <ShieldAlert className="mr-1.5 inline h-4 w-4" />
            {String(
              security?.volumetricLimitationNote ??
                'On-host firewalls and Fail2ban cannot mitigate large volumetric DDoS attacks; upstream ISP or CDN (e.g. Cloudflare) protection is required.'
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-2 font-mono text-xs">
              <div className="font-semibold text-zinc-200">Detected Security Posture</div>
              <div className="text-zinc-400">Firewall Backend: <span className="text-zinc-100">{String(security?.firewallBackend ?? 'unknown')}</span></div>
              <div className="text-zinc-400">Fail2ban: <span className="text-zinc-100">{security?.fail2banActive ? 'Active' : 'Not Active'}</span></div>
              {((security?.warnings as string[]) ?? []).map((w, i) => (
                <div key={i} className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">{w}</div>
              ))}
            </div>
            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
              <div className="mb-2 font-mono text-xs font-semibold text-zinc-200">Firewall Output</div>
              <pre className="max-h-56 overflow-auto rounded bg-[#060709] p-2.5 font-mono text-[11px] text-zinc-300">
                {String(security?.firewallStatus ?? 'Connect to Surf Agent v4.0.0 to inspect firewall rules.')}
              </pre>
            </div>
          </div>
        </div>
      )}

      {tab === 'capabilities' && (
        <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-3">
          <div className="font-mono text-xs font-semibold text-zinc-200">Installed Agent Capabilities &amp; Permissions</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries((overview?.capabilities?.capabilities as Record<string, { available?: boolean }>) ?? {}).map(
              ([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded border border-white/[0.07] bg-[#101114] px-3 py-2 font-mono text-xs">
                  <span className="capitalize text-zinc-200">{k}</span>
                  <span className={v?.available ? 'text-emerald-400' : 'text-zinc-500'}>
                    {v?.available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              )
            )}
          </div>
          <div className="font-mono text-[11px] text-zinc-400">
            Registered Permissions:{' '}
            {((overview?.capabilities?.permissions as string[]) ?? []).join(', ') || 'Connect to inspect'}
          </div>
        </div>
      )}

      {tab === 'settings' && agentSettings && (
        <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-3 font-mono text-xs">
          <div className="font-semibold text-zinc-200">Adaptive Collection &amp; Remediation Policy</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400">Remediation Policy</label>
              <select
                value={String(agentSettings.remediationPolicy ?? 'approval_required')}
                onChange={(e) => setAgentSettings({ ...agentSettings, remediationPolicy: e.target.value })}
                className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
              >
                <option value="observe_only">Observe Only</option>
                <option value="approval_required">Approval Required</option>
                <option value="restricted_auto">Restricted Automation</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400">Process Interval (ms)</label>
              <input
                type="number"
                value={Number(agentSettings.processIntervalMs ?? 5000)}
                onChange={(e) => setAgentSettings({ ...agentSettings, processIntervalMs: Number(e.target.value) })}
                className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400">Disk Alert Threshold (%)</label>
              <input
                type="number"
                value={Number(agentSettings.diskAlertThreshold ?? 90)}
                onChange={(e) => setAgentSettings({ ...agentSettings, diskAlertThreshold: Number(e.target.value) })}
                className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await window.surfMonitorAPI?.saveAgentSettings(serverId, agentSettings);
              onNotify('Agent settings saved', 'success');
            }}
            className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500"
          >
            Save Agent Configuration
          </button>
        </div>
      )}

      {tab === 'activity' && (
        <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
          <div className="mb-2 font-mono text-xs font-semibold text-zinc-200">Agent Activity Audit Log</div>
          {activity.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-zinc-500">No operations recorded yet.</p>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto font-mono text-[11px]">
              {activity.map((a) => (
                <div key={String(a.id)} className="flex justify-between rounded border border-white/[0.06] bg-[#101114] px-3 py-2">
                  <span className="text-zinc-200">{String(a.operation)} {a.target ? `→ ${String(a.target)}` : ''}</span>
                  <span className="text-zinc-500">{String(a.status)} • {new Date(String(a.timestamp)).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
