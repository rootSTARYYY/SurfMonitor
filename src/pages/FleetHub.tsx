import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Cpu,
  Gauge,
  HardDrive,
  Layers,
  RefreshCw,
  RotateCcw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Zap,
} from 'lucide-react';
import { RemoteServerDTO } from '@/types';
import { DataStateBanner, PageSkeleton, SkeletonCard } from '@/components/Skeleton';

interface FleetHubProps {
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}

type FleetTab = 'fleet' | 'performance' | 'protection' | 'integrity' | 'bulk' | 'settings';

export const FleetHubPage: React.FC<FleetHubProps> = ({ servers, onNotify }) => {
  const [tab, setTab] = useState<FleetTab>('fleet');
  const [serverId, setServerId] = useState(servers[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'error'>('all');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [overview, setOverview] = useState<{
    health: Record<string, unknown> | null;
    events: Array<Record<string, unknown>>;
    ports: Array<Record<string, unknown>>;
  } | null>(null);
  const [perfAnalysis, setPerfAnalysis] = useState<Record<string, unknown> | null>(null);
  const [perfProfiles, setPerfProfiles] = useState<{ profiles: Array<Record<string, unknown>>; hasBackup: boolean } | null>(null);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [anomalies, setAnomalies] = useState<Record<string, unknown> | null>(null);
  const [security, setSecurity] = useState<Record<string, unknown> | null>(null);
  const [agentSettings, setAgentSettings] = useState<Record<string, unknown> | null>(null);

  const [blockIp, setBlockIp] = useState('');
  const [blockDuration, setBlockDuration] = useState(600);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkResults, setBulkResults] = useState<Array<{ serverId: string; name: string; status: string }>>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => {
    if (!serverId && servers.length > 0) setServerId(servers[0].id);
  }, [servers, serverId]);

  const loadServerAgentData = async () => {
    if (!serverId || !window.surfMonitorAPI) return;
    setLoading(true);
    setLoadError(null);
    try {
      const ov = await window.surfMonitorAPI.getAgentOverview(serverId);
      const ver = String((ov?.health as Record<string, unknown> | null)?.version ?? '');
      const isV5 = ver.startsWith('5.');
      const [perf, profs, fc, anom, sec, cfg] = isV5
        ? await Promise.all([
            window.surfMonitorAPI.getAgentPerfAnalysis(serverId).catch(() => null),
            window.surfMonitorAPI.getAgentPerfProfiles(serverId).catch(() => null),
            window.surfMonitorAPI.getAgentCapacityForecast(serverId).catch(() => null),
            window.surfMonitorAPI.getAgentNetworkAnomalies(serverId).catch(() => null),
            window.surfMonitorAPI.getAgentSecurity(serverId).catch(() => null),
            window.surfMonitorAPI.getAgentSettings(serverId).catch(() => null),
          ])
        : [null, null, null, null, null, null];
      if (!isV5 && ov?.health) {
        setLoadError(`Remote server is running Surf Agent ${ver || 'v3.x'}. Click "Update Agent" above to upgrade in place to v5.0.0.`);
      }
      setOverview(ov);
      setPerfAnalysis(perf);
      setPerfProfiles(profs);
      setForecast(fc);
      setAnomalies(anom);
      setSecurity(sec);
      setAgentSettings(cfg);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Agent unreachable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverId) void loadServerAgentData();
  }, [serverId]);

  const filteredFleet = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers.filter((s) => {
      if (statusFilter === 'connected' && s.connectionStatus !== 'connected') return false;
      if (statusFilter === 'error' && s.connectionStatus === 'connected') return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.host.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [servers, search, statusFilter]);

  const onlineCount = servers.filter((s) => s.connectionStatus === 'connected').length;
  const offlineCount = servers.length - onlineCount;
  const health = overview?.health as Record<string, unknown> | null;
  const integrity = (health?.integrity ?? security?.integrity) as Record<string, unknown> | undefined;

  const runBulkAgentUpdate = async () => {
    if (bulkSelected.length === 0 || !window.surfMonitorAPI) return;
    setBulkRunning(true);
    const results: Array<{ serverId: string; name: string; status: string }> = [];
    for (const sid of bulkSelected) {
      const srv = servers.find((s) => s.id === sid);
      try {
        const res = await window.surfMonitorAPI.upgradeRemoteServerAgent(sid);
        results.push({ serverId: sid, name: srv?.name ?? sid, status: res.ok ? 'Updated to v5.0.0' : 'Failed' });
      } catch (err) {
        results.push({ serverId: sid, name: srv?.name ?? sid, status: err instanceof Error ? err.message : 'Failed' });
      }
      setBulkResults([...results]);
    }
    setBulkRunning(false);
    onNotify('Bulk agent update finished', 'info', `${results.length} server(s) processed.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Fleet &amp; Surf Agent <span className="font-mono text-xs text-emerald-400">v5.0.0</span>
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Performance optimization, DDoS anomaly protection, integrity monitoring &amp; multi-server fleet control
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
                onNotify(res?.ok ? 'Agent updated to v5.0.0' : 'Upgrade failed', res?.ok ? 'success' : 'error');
                await loadServerAgentData();
              } catch (err) {
                onNotify('Upgrade failed', 'error', err instanceof Error ? err.message : String(err));
              }
            }}
            className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-xs text-emerald-300 hover:bg-emerald-500/20"
          >
            Update Agent
          </button>
          <button
            type="button"
            onClick={() => void loadServerAgentData()}
            className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-1 font-mono text-xs">
        {(
          [
            { id: 'fleet', label: 'Fleet Overview', icon: Server },
            { id: 'performance', label: 'Performance & Capacity', icon: Gauge },
            { id: 'protection', label: 'Network & DDoS', icon: Shield },
            { id: 'integrity', label: 'Integrity & Security', icon: ShieldCheck },
            { id: 'bulk', label: 'Bulk Operations', icon: Layers },
            { id: 'settings', label: 'Events & Settings', icon: Sliders },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors ${
                tab === t.id ? 'bg-white/[0.09] text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loadError && tab !== 'fleet' && tab !== 'bulk' && (
        <DataStateBanner
          mode="offline"
          title="Agent Connection Unavailable"
          description={loadError}
          onRetry={() => void loadServerAgentData()}
        />
      )}

      {tab === 'fleet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
              <div className="font-mono text-[10px] text-zinc-500">Total Servers</div>
              <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">{servers.length}</div>
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
              <div className="font-mono text-[10px] text-zinc-500">Online Agents</div>
              <div className="mt-1 font-mono text-xl font-semibold text-emerald-400">{onlineCount}</div>
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
              <div className="font-mono text-[10px] text-zinc-500">Offline / Warning</div>
              <div className="mt-1 font-mono text-xl font-semibold text-rose-400">{offlineCount}</div>
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
              <div className="font-mono text-[10px] text-zinc-500">Selected Agent</div>
              <div className="mt-1 font-mono text-base font-semibold text-emerald-300">
                {String(health?.version ?? '—')}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter fleet by hostname or label..."
              className="flex-1 rounded border border-white/[0.08] bg-[#09090b] px-3 py-1.5 text-xs text-zinc-100"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'connected' | 'error')}
              className="rounded border border-white/[0.08] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-200"
            >
              <option value="all">All Statuses</option>
              <option value="connected">Online Only</option>
              <option value="error">Offline / Errors</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#09090b]">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-white/[0.08] bg-[#101114] text-[10px] uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5">Server</th>
                  <th className="px-4 py-2.5">Host</th>
                  <th className="px-4 py-2.5">Agent Version</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredFleet.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 font-semibold text-zinc-100">{s.name}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{s.username}@{s.host}:{s.port}</td>
                    <td className="px-4 py-2.5 text-zinc-300">{s.agentVersion ?? 'unknown'}</td>
                    <td className="px-4 py-2.5">
                      <span className={s.connectionStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}>
                        {s.connectionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setServerId(s.id);
                          setTab('performance');
                        }}
                        className="rounded border border-white/[0.1] px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.06]"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'performance' && (
        loading && !perfAnalysis ? (
          <PageSkeleton cards={3} rows={4} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-semibold text-zinc-200">
                  <Cpu className="h-4 w-4 text-emerald-400" />
                  Bottleneck Analysis ({String(perfAnalysis?.status ?? 'unknown').toUpperCase()})
                </div>
                {perfProfiles?.hasBackup && (
                  <button
                    type="button"
                    onClick={async () => {
                      await window.surfMonitorAPI?.rollbackAgentPerfProfile(serverId);
                      onNotify('Sysctl profile rolled back', 'success');
                      await loadServerAgentData();
                    }}
                    className="flex items-center gap-1 rounded border border-amber-500/30 px-2.5 py-1 font-mono text-[11px] text-amber-300"
                  >
                    <RotateCcw className="h-3 w-3" /> Rollback Last Optimization
                  </button>
                )}
              </div>

              {((perfAnalysis?.bottlenecks as Array<Record<string, unknown>>) ?? []).length === 0 ? (
                <p className="font-mono text-xs text-emerald-400">No active CPU, memory, swap, inode, or service bottlenecks detected.</p>
              ) : (
                <div className="space-y-1.5">
                  {((perfAnalysis?.bottlenecks as Array<Record<string, unknown>>) ?? []).map((b, i) => (
                    <div key={i} className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 font-mono text-xs text-amber-200">
                      <strong>{String(b.type)}:</strong> {String(b.evidence)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(perfProfiles?.profiles ?? []).map((prof) => (
                <div key={String(prof.id)} className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100">{String(prof.name)}</h3>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Apply ${String(prof.name)} sysctl profile? Previous values are backed up for rollback.`)) return;
                        try {
                          await window.surfMonitorAPI?.applyAgentPerfProfile(serverId, String(prof.id));
                          onNotify('Optimization profile applied', 'success', String(prof.name));
                          await loadServerAgentData();
                        } catch (err) {
                          onNotify('Apply failed', 'error', err instanceof Error ? err.message : String(err));
                        }
                      }}
                      className="rounded bg-emerald-600 px-2.5 py-1 font-mono text-[11px] text-white hover:bg-emerald-500"
                    >
                      Apply Profile
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400">{String(prof.description)}</p>
                  <div className="font-mono text-[10px] text-zinc-500">
                    Trade-offs: {String(prof.tradeoffs)}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center gap-2 font-semibold text-zinc-200">
                <HardDrive className="h-4 w-4 text-emerald-400" />
                Capacity Planning &amp; Forecasting
              </div>
              {forecast?.sufficientData ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-zinc-300">
                  <div className="rounded border border-white/[0.06] bg-[#101114] p-2.5">
                    7-Day Forecast: Disk {(forecast.forecast7d as Record<string, number>)?.diskPercent}% • RAM {(forecast.forecast7d as Record<string, number>)?.ramPercent}%
                  </div>
                  <div className="rounded border border-white/[0.06] bg-[#101114] p-2.5">
                    30-Day Forecast: Disk {(forecast.forecast30d as Record<string, number>)?.diskPercent}% • RAM {(forecast.forecast30d as Record<string, number>)?.ramPercent}%
                  </div>
                  <div className="rounded border border-white/[0.06] bg-[#101114] p-2.5">
                    Confidence: {String(forecast.confidence)} ({String(forecast.sampleCount)} samples)
                  </div>
                </div>
              ) : (
                <p className="text-zinc-400">{String(forecast?.message ?? 'Collecting baseline samples...')}</p>
              )}
            </div>
          </div>
        )
      )}

      {tab === 'protection' && (
        loading && !anomalies ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-xs text-amber-200">
              <ShieldAlert className="mr-1.5 inline h-4 w-4" />
              {String(
                anomalies?.volumetricLimitationNote ??
                  'Host-level mitigation cannot stop large volumetric DDoS attacks; upstream ISP or CDN mitigation is required.'
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 font-mono">
              <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
                <div className="text-[10px] text-zinc-500">Traffic Status</div>
                <div className="mt-1 text-base font-semibold uppercase text-emerald-400">
                  {String(anomalies?.classification ?? 'normal')}
                </div>
              </div>
              <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
                <div className="text-[10px] text-zinc-500">Inbound Rate</div>
                <div className="mt-1 text-base font-semibold text-zinc-100">
                  {Math.round(Number(anomalies?.rxBytesPerSec ?? 0) / 1024)} KB/s
                </div>
              </div>
              <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
                <div className="text-[10px] text-zinc-500">TCP Established</div>
                <div className="mt-1 text-base font-semibold text-zinc-100">
                  {Number(anomalies?.tcpEstablished ?? 0)}
                </div>
              </div>
              <div className="rounded border border-white/[0.08] bg-[#09090b] p-3">
                <div className="text-[10px] text-zinc-500">SYN_RECV</div>
                <div className="mt-1 text-base font-semibold text-zinc-100">
                  {Number(anomalies?.tcpSynRecv ?? 0)}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-3">
              <div className="font-mono text-xs font-semibold text-zinc-200">Temporary Host-Level IP Mitigation (Auto-Expiring)</div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={blockIp}
                  onChange={(e) => setBlockIp(e.target.value)}
                  placeholder="Source IP (e.g., 203.0.113.45)"
                  className="flex-1 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100"
                />
                <input
                  type="number"
                  min={60}
                  max={86400}
                  value={blockDuration}
                  onChange={(e) => setBlockDuration(Number(e.target.value))}
                  className="w-28 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100"
                  title="Duration (seconds)"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!blockIp.trim()) return;
                    if (!window.confirm(`Temporarily block ${blockIp} via UFW for ${blockDuration}s?`)) return;
                    try {
                      await window.surfMonitorAPI?.blockIpMitigation(serverId, blockIp.trim(), blockDuration);
                      onNotify('Temporary IP block applied', 'success', blockIp.trim());
                      setBlockIp('');
                      await loadServerAgentData();
                    } catch (err) {
                      onNotify('Mitigation failed', 'error', err instanceof Error ? err.message : String(err));
                    }
                  }}
                  className="rounded bg-rose-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-rose-500"
                >
                  Apply Temporary Block
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {tab === 'integrity' && (
        <div className="space-y-4">
          <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-200">Agent Self-Protection &amp; SHA-256 Baseline</span>
              <span className={integrity?.tamperDetected ? 'text-rose-400' : 'text-emerald-400'}>
                {integrity?.tamperDetected ? 'TAMPER DETECTED' : 'Baseline Intact'}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500">
              Established: {String(integrity?.establishedAt ?? '—')} • Last Checked: {String(integrity?.lastCheckedAt ?? '—')}
            </div>
            <div className="text-[11px] text-zinc-400">
              Note: A root-level attacker with OS control can alter system binaries; integrity baselines detect unexpected file modifications for audit and alerting.
            </div>
          </div>

          <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 font-mono text-xs">
            <div className="mb-2 font-semibold text-zinc-200">Firewall &amp; SSH Audit ({String(security?.firewallBackend ?? 'unknown')})</div>
            <pre className="max-h-56 overflow-auto rounded bg-[#060709] p-2.5 text-[11px] text-zinc-300">
              {String(security?.firewallStatus ?? 'Unavailable')}
            </pre>
          </div>
        </div>
      )}

      {tab === 'bulk' && (
        <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-3">
          <div className="font-mono text-xs font-semibold text-zinc-200">
            Rolling Fleet Agent Update (v5.0.0)
          </div>
          <div className="flex flex-wrap gap-2">
            {servers.map((s) => {
              const on = bulkSelected.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setBulkSelected((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                  className={`rounded border px-2.5 py-1 font-mono text-xs ${
                    on ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/[0.08] text-zinc-400'
                  }`}
                >
                  {s.name} ({s.agentVersion ?? 'v3.x'})
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={bulkRunning || bulkSelected.length === 0}
            onClick={() => void runBulkAgentUpdate()}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" />
            {bulkRunning ? 'Updating Fleet...' : `Update ${bulkSelected.length} Server(s) to v5.0.0`}
          </button>

          {bulkResults.length > 0 && (
            <div className="space-y-1 font-mono text-[11px]">
              {bulkResults.map((r) => (
                <div key={r.serverId} className="flex justify-between rounded border border-white/[0.06] bg-[#101114] px-3 py-1.5">
                  <span className="text-zinc-200">{r.name}</span>
                  <span className={r.status.includes('Updated') ? 'text-emerald-400' : 'text-rose-400'}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
            <div className="mb-2 flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-200">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              Agent Event Stream ({overview?.events.length ?? 0})
            </div>
            {!overview?.events.length ? (
              <p className="py-4 font-mono text-xs text-zinc-500">No active anomalies or threshold alerts.</p>
            ) : (
              <div className="max-h-52 space-y-1.5 overflow-y-auto font-mono text-[11px]">
                {overview.events.map((e) => (
                  <div key={String(e.id)} className="rounded border border-white/[0.06] bg-[#101114] p-2">
                    <span className="text-amber-300">{String(e.title)}</span> — <span className="text-zinc-400">{String(e.detail)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {agentSettings && (
            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4 space-y-3 font-mono text-xs">
              <div className="font-semibold text-zinc-200">Agent Intervals &amp; Recovery Policy</div>
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
                  <label className="mb-1 block text-[10px] text-zinc-400">Disk Alert Threshold (%)</label>
                  <input
                    type="number"
                    value={Number(agentSettings.diskAlertThreshold ?? 90)}
                    onChange={(e) => setAgentSettings({ ...agentSettings, diskAlertThreshold: Number(e.target.value) })}
                    className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-zinc-400">Traffic Spike Multiplier</label>
                  <input
                    type="number"
                    value={Number(agentSettings.trafficSpikeMultiplier ?? 4)}
                    onChange={(e) => setAgentSettings({ ...agentSettings, trafficSpikeMultiplier: Number(e.target.value) })}
                    className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await window.surfMonitorAPI?.saveAgentSettings(serverId, agentSettings);
                  onNotify('Agent configuration saved', 'success');
                }}
                className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500"
              >
                Save Configuration
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
