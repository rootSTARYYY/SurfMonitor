import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Plus,
  Server,
  ShieldAlert,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Monitor,
  OverviewPayload,
  PageId,
  RemoteServerDTO,
  TimeRangeFilter,
} from '@/types';
import { MonitorRow } from '@/components/MonitorRow';
import { DashboardSkeleton } from '@/components/Skeleton';
import { formatShortTime, formatTimestamp, formatUptime } from '@/utils/format';

interface OverviewProps {
  data: OverviewPayload | null;
  loading: boolean;
  range: TimeRangeFilter;
  onRangeChange: (range: TimeRangeFilter) => void;
  onNavigate: (page: PageId) => void;
  onSelectMonitor: (monitorId: string) => void;
  onOpenAddMonitor: () => void;
  servers?: RemoteServerDTO[];
  activeIncidentCount?: number;
}

const TIME_RANGES: TimeRangeFilter[] = ['1h', '6h', '24h', '7d', '30d'];
type StatusFilter = 'ALL' | 'UP' | 'DEGRADED' | 'DOWN';

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return Math.round(sorted[idx]);
}

export const Overview: React.FC<OverviewProps> = ({
  data,
  loading,
  range,
  onRangeChange,
  onNavigate,
  onSelectMonitor,
  onOpenAddMonitor,
  servers = [],
  activeIncidentCount = 0,
}) => {
  const [chartMode, setChartMode] = useState<'p50' | 'p95'>('p50');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const monitors: Monitor[] = data?.monitors ?? [];
  const recentChecks = data?.recentChecks ?? [];

  const totalMonitors = monitors.length;
  const upCount = monitors.filter((m) => m.status === 'UP').length;
  const degradedCount = monitors.filter((m) => m.status === 'DEGRADED').length;
  const downCount = monitors.filter((m) => m.status === 'DOWN').length;
  const issueCount = degradedCount + downCount;

  const monitorsWithUptime = monitors.filter(
    (m) => m.stats.uptime24h !== null || m.stats.uptimeTotal !== null
  );
  const overallAvailability =
    monitorsWithUptime.length > 0
      ? Number(
          (
            monitorsWithUptime.reduce(
              (acc, m) =>
                acc + (m.stats.uptime24h ?? m.stats.uptimeTotal ?? 0),
              0
            ) / monitorsWithUptime.length
          ).toFixed(2)
        )
      : null;

  const respondingMonitors = monitors.filter(
    (m) => m.responseTimeMs !== null && m.status !== 'PAUSED'
  );
  const avgResponseTime =
    respondingMonitors.length > 0
      ? Math.round(
          respondingMonitors.reduce(
            (acc, m) => acc + (m.responseTimeMs ?? 0),
            0
          ) / respondingMonitors.length
        )
      : null;

  const p95Latency = useMemo(() => {
    const vals = (data?.latencyPoints ?? []).map((p) => p.responseTime);
    return vals.length > 0 ? percentile(vals, 95) : null;
  }, [data?.latencyPoints]);

  // Bucket raw samples into smooth intervals for readability
  const chartData = useMemo(() => {
    const raw = data?.latencyPoints ?? [];
    if (raw.length === 0) return [];
    const targetBuckets = 36;
    const step = Math.max(1, Math.ceil(raw.length / targetBuckets));
    const buckets: Array<{ time: string; value: number }> = [];
    for (let i = 0; i < raw.length; i += step) {
      const slice = raw.slice(i, i + step);
      const vals = slice.map((s) => s.responseTime);
      const val =
        chartMode === 'p95'
          ? percentile(vals, 95)
          : Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      buckets.push({
        time: formatShortTime(slice[slice.length - 1].time),
        value: val,
      });
    }
    return buckets;
  }, [data?.latencyPoints, chartMode]);

  const filteredMonitors = useMemo(() => {
    if (statusFilter === 'ALL') return monitors;
    return monitors.filter((m) => m.status === statusFilter);
  }, [monitors, statusFilter]);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const connectedServers = servers.filter(
    (s) => s.connectionStatus === 'connected'
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Infrastructure Overview
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Real-time connectivity &amp; HTTP application health telemetry
          </p>
        </div>

        <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] transition-colors ${
                range === r
                  ? 'bg-white/[0.09] text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Compact 5-Column Horizontal KPI Strip */}
      <section
        aria-label="Key statistics"
        data-tour="overview-kpis"
        className="grid grid-cols-2 divide-y divide-white/[0.08] overflow-hidden rounded border border-white/[0.08] bg-[#09090b] sm:grid-cols-3 md:grid-cols-5 md:divide-x md:divide-y-0"
      >
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Total Monitors</div>
          <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">
            {loading && !data ? '—' : totalMonitors}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Healthy</span>
          </div>
          <div className="mt-1 font-mono text-xl font-semibold text-emerald-400">
            {loading && !data ? '—' : upCount}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">
            Issues (Deg / Down)
          </div>
          <div
            className={`mt-1 font-mono text-xl font-semibold ${
              issueCount > 0 ? 'text-rose-400' : 'text-zinc-100'
            }`}
          >
            {loading && !data ? '—' : issueCount}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Availability</div>
          <div
            className={`mt-1 font-mono text-xl font-semibold ${
              overallAvailability !== null && overallAvailability < 95
                ? 'text-amber-400'
                : 'text-zinc-100'
            }`}
          >
            {loading && !data ? '—' : formatUptime(overallAvailability)}
          </div>
        </div>
        <div className="col-span-2 px-4 py-3 sm:col-span-1">
          <div className="font-mono text-[11px] text-zinc-500">Avg Latency</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-semibold text-zinc-100">
              {loading && !data
                ? '—'
                : avgResponseTime !== null
                  ? `${avgResponseTime}ms`
                  : 'No data'}
            </span>
            {p95Latency !== null && (
              <span className="font-mono text-[10px] text-zinc-500">
                P95: {p95Latency}ms
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 2-Column Middle Split: Response Time Chart + Infrastructure & Incidents */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b] p-4 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Response Time History
              </h2>
              <p className="font-mono text-[11px] text-zinc-500">
                {chartMode === 'p95' ? 'P95 peak' : 'Bucketed average'} HTTP latency ({range}) • {(data?.latencyPoints ?? []).length} samples
              </p>
            </div>
            <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-0.5">
              {(['p50', 'p95'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setChartMode(m)}
                  className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase transition-colors ${
                    chartMode === m
                      ? 'bg-white/[0.09] text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="flex h-44 items-center justify-center rounded border border-dashed border-white/[0.08] font-mono text-xs text-zinc-500">
              No check latency recorded in this time window yet.
            </div>
          ) : (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 8, left: -14, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="overviewLatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={42}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    unit="ms"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111216',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#f4f4f5',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name={chartMode === 'p95' ? 'P95 Latency (ms)' : 'Avg Latency (ms)'}
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#overviewLatGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="flex flex-col justify-between rounded border border-white/[0.08] bg-[#09090b] p-4 lg:col-span-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">
                Infrastructure &amp; Incidents
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('servers')}
                className="font-mono text-[11px] text-emerald-400 hover:text-emerald-300"
              >
                Servers →
              </button>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
              {connectedServers.length} of {servers.length} servers connected
            </p>

            {servers.length === 0 ? (
              <div className="mt-4 rounded border border-dashed border-white/[0.08] p-3 text-center font-mono text-[11px] text-zinc-500">
                No remote servers registered yet.
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {servers.slice(0, 2).map((srv) => {
                  const cpu = srv.latestMetric?.cpuPercent ?? 0;
                  const ram = srv.latestMetric?.ramPercent ?? 0;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => onNavigate('servers')}
                      className="w-full rounded border border-white/[0.06] bg-[#101115] p-2.5 text-left transition-colors hover:border-white/[0.15]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                          <Server className="h-3.5 w-3.5 text-emerald-400" />
                          {srv.name}
                        </span>
                        <span
                          className={`font-mono text-[10px] ${
                            srv.connectionStatus === 'connected'
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {srv.connectionStatus}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5 font-mono text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="w-7 text-zinc-500">CPU</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, cpu)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-zinc-300">
                            {cpu.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-7 text-zinc-500">RAM</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-sky-500"
                              style={{ width: `${Math.min(100, ram)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-zinc-300">
                            {ram.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('incidents')}
            className={`mt-3 flex items-center justify-between rounded border px-3 py-2 font-mono text-xs transition-colors ${
              activeIncidentCount > 0
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-500/50'
                : 'border-white/[0.08] bg-[#101115] text-zinc-300 hover:border-white/[0.16]'
            }`}
          >
            <span className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />
              {activeIncidentCount} Active Incidents
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      </div>

      {/* Monitor Status Overview */}
      <section className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Monitor Status Overview
            </h2>
            <p className="font-mono text-[11px] text-zinc-500">
              Click any monitor to inspect connectivity, application health, and check logs
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-0.5 font-mono text-[11px]">
              {(
                [
                  { id: 'ALL', label: `All (${totalMonitors})` },
                  { id: 'UP', label: `Up (${upCount})` },
                  { id: 'DEGRADED', label: `Degraded (${degradedCount})` },
                  { id: 'DOWN', label: `Down (${downCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded px-2 py-0.5 transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-white/[0.09] text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('monitors')}
              className="flex items-center gap-1.5 font-mono text-xs text-emerald-400 transition-colors hover:text-emerald-300"
            >
              <span>Manage monitors</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {monitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-200">
              No monitors configured yet
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-500">
              Add a website to begin real-time HTTP uptime monitoring.
            </p>
            <button
              type="button"
              onClick={onOpenAddMonitor}
              className="mt-4 flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Monitor</span>
            </button>
          </div>
        ) : filteredMonitors.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-xs text-zinc-500">
            No monitors match the selected status filter.
          </div>
        ) : (
          <div>
            {filteredMonitors.map((monitor) => (
              <MonitorRow
                key={monitor.id}
                monitor={monitor}
                onSelect={onSelectMonitor}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Checks */}
      <section className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b]">
        <div className="border-b border-white/[0.08] px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            Recent Checks
          </h2>
          <p className="font-mono text-[11px] text-zinc-500">
            Latest HTTP checks stored in SQLite
          </p>
        </div>

        {recentChecks.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-xs text-zinc-500">
            No checks recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] font-mono text-[11px] text-zinc-500">
                  <th className="px-4 py-2.5 font-medium">State</th>
                  <th className="px-4 py-2.5 font-medium">Monitor</th>
                  <th className="px-4 py-2.5 font-medium">Details</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Checked At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {recentChecks.map((chk) => {
                  const st =
                    chk.state || (chk.success === 1 ? 'UP' : 'DOWN');
                  return (
                    <tr
                      key={chk.id}
                      onClick={() => onSelectMonitor(chk.monitorId)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono">
                        <span className="inline-flex items-center gap-2 text-zinc-200">
                          {st === 'UP' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : st === 'DEGRADED' ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                          )}
                          {st}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-zinc-300">
                        {chk.monitorName}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                          <span className="rounded border border-white/[0.08] bg-[#111216] px-1.5 py-0.5 text-zinc-300">
                            method {chk.monitorMethod}
                          </span>
                          {chk.statusCode !== null && (
                            <span className="rounded border border-white/[0.08] bg-[#111216] px-1.5 py-0.5 text-zinc-300">
                              status {chk.statusCode}
                            </span>
                          )}
                          {chk.responseTime !== null && (
                            <span className="rounded border border-white/[0.08] bg-[#111216] px-1.5 py-0.5 text-zinc-300">
                              latency {chk.responseTime}ms
                            </span>
                          )}
                          {chk.errorMessage && (
                            <span className="rounded border border-white/[0.08] bg-[#111216] px-1.5 py-0.5 text-zinc-400">
                              {chk.errorMessage}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[11px] text-zinc-500">
                        {formatTimestamp(chk.checkedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
