import React from 'react';
import {
  Activity,
  AlertOctagon,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Monitor,
  MonitorDetailPayload,
  TimeRangeFilter,
} from '@/types';
import { StatCard } from '@/components/StatCard';
import {
  formatDurationSeconds,
  formatShortTime,
  formatTimestamp,
  formatUptime,
} from '@/utils/format';

interface MonitorDetailProps {
  detail: MonitorDetailPayload | null;
  loading: boolean;
  range: TimeRangeFilter;
  onRangeChange: (range: TimeRangeFilter) => void;
  onBack: () => void;
  onEdit: (monitor: Monitor) => void;
  onDelete: (monitor: Monitor) => void;
  onTogglePause: (monitor: Monitor) => void;
  onRunManualCheck: (monitor: Monitor) => void;
  checking: boolean;
}

const TIME_RANGES: TimeRangeFilter[] = ['1h', '6h', '24h', '7d', '30d'];

export const MonitorDetail: React.FC<MonitorDetailProps> = ({
  detail,
  loading,
  range,
  onRangeChange,
  onBack,
  onEdit,
  onDelete,
  onTogglePause,
  onRunManualCheck,
  checking,
}) => {
  if (loading && !detail) {
    return (
      <div className="space-y-4">
        <div className="h-12 animate-pulse rounded border border-white/[0.08] bg-[#101114]" />
        <div className="h-32 animate-pulse rounded border border-white/[0.08] bg-[#101114]" />
        <div className="h-64 animate-pulse rounded border border-white/[0.08] bg-[#101114]" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded border border-white/[0.08] bg-[#09090b] p-8 text-center font-mono text-xs text-zinc-500">
        Monitor not found.
      </div>
    );
  }

  const { monitor, checks, incidents } = detail;

  const chartPoints = [...checks]
    .reverse()
    .filter((c) => c.responseTime !== null)
    .map((c) => ({
      time: formatShortTime(c.checkedAt),
      responseTime: c.responseTime as number,
    }));

  const handleOpenExternal = () => {
    if (window.surfMonitorAPI) {
      void window.surfMonitorAPI.openExternal(monitor.url);
    } else {
      window.open(monitor.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Identity & Actions */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/[0.08] bg-[#101114] text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-100"
            title="Back to monitors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
                {monitor.name}
              </h1>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
                  monitor.status === 'UP'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                    : monitor.status === 'DEGRADED'
                      ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                      : monitor.status === 'DOWN'
                        ? 'border-rose-500/25 bg-rose-500/10 text-rose-400'
                        : 'border-white/[0.1] bg-[#101114] text-zinc-300'
                }`}
              >
                {monitor.status}
              </span>
            </div>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="mt-0.5 flex items-center gap-1 font-mono text-xs text-zinc-500 transition-colors hover:text-emerald-400"
            >
              <span>{monitor.url}</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-0.5">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                className={`rounded px-2 py-1 font-mono text-[11px] transition-colors ${
                  range === r
                    ? 'bg-white/[0.09] text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={checking}
            onClick={() => onRunManualCheck(monitor)}
            className="flex items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors hover:border-white/[0.16] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-emerald-400 ${
                checking ? 'animate-spin' : ''
              }`}
            />
            <span>{checking ? 'Checking...' : 'Run Check'}</span>
          </button>

          <button
            type="button"
            onClick={() => onTogglePause(monitor)}
            className="flex items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors hover:border-white/[0.16]"
          >
            {monitor.enabled ? (
              <>
                <Pause className="h-3.5 w-3.5 text-amber-400" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-emerald-400" />
                <span>Resume</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onEdit(monitor)}
            className="flex items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors hover:border-white/[0.16]"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(monitor)}
            className="flex items-center gap-1.5 rounded border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 font-mono text-xs text-rose-400 transition-colors hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Connected KPI & Connectivity/App Health Strip */}
      <section className="overflow-hidden rounded border border-white/[0.08]">
        <div className="grid grid-cols-1 divide-y divide-white/[0.08] sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
          <StatCard
            label="24h Availability"
            value={formatUptime(monitor.stats.uptime24h)}
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            label="Connectivity"
            value={
              monitor.networkConnected === null
                ? 'No data'
                : monitor.networkConnected
                  ? 'Connected'
                  : 'Unreachable'
            }
            icon={Activity}
            tone={
              monitor.networkConnected === false
                ? 'danger'
                : monitor.networkConnected === true
                  ? 'success'
                  : 'default'
            }
          />
          <StatCard
            label="Application Health"
            value={
              monitor.applicationHealthy === null
                ? 'No data'
                : monitor.applicationHealthy
                  ? 'Healthy'
                  : 'Unexpected HTTP'
            }
            icon={AlertOctagon}
            tone={
              monitor.applicationHealthy === false
                ? 'warning'
                : monitor.applicationHealthy === true
                  ? 'success'
                  : 'default'
            }
          />
          <StatCard
            label="Avg Response"
            value={
              monitor.stats.avgResponseTimeMs !== null
                ? `${monitor.stats.avgResponseTimeMs} ms`
                : 'No data'
            }
            icon={Clock}
            tone="default"
          />
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.08] border-t border-white/[0.08] sm:grid-cols-5 sm:divide-y-0">
          <div className="bg-[#09090b] p-3.5">
            <div className="font-mono text-[11px] text-zinc-400">7d Availability</div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-100">
              {formatUptime(monitor.stats.uptime7d)}
            </div>
          </div>
          <div className="bg-[#09090b] p-3.5">
            <div className="font-mono text-[11px] text-zinc-400">UP / DEGRADED / DOWN</div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-100">
              {monitor.stats.upChecks} / {monitor.stats.degradedChecks} / {monitor.stats.downChecks}
            </div>
          </div>
          <div className="bg-[#09090b] p-3.5">
            <div className="font-mono text-[11px] text-zinc-400">App Health Rate</div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-100">
              {formatUptime(monitor.stats.appHealthTotal)}
            </div>
          </div>
          <div className="bg-[#09090b] p-3.5">
            <div className="font-mono text-[11px] text-zinc-400">Min Latency</div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-100">
              {monitor.stats.minResponseTimeMs !== null
                ? `${monitor.stats.minResponseTimeMs} ms`
                : '—'}
            </div>
          </div>
          <div className="bg-[#09090b] p-3.5">
            <div className="font-mono text-[11px] text-zinc-400">Max Latency</div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-100">
              {monitor.stats.maxResponseTimeMs !== null
                ? `${monitor.stats.maxResponseTimeMs} ms`
                : '—'}
            </div>
          </div>
        </div>
      </section>

      {monitor.lastError && (
        <div
          className={`rounded border px-4 py-2.5 font-mono text-xs ${
            monitor.status === 'DEGRADED'
              ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
              : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
          }`}
        >
          Last check detail: {monitor.lastError}
        </div>
      )}

      {/* Response-Time Graph */}
      <section className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Response Time ({range})
            </h2>
            <p className="font-mono text-[11px] text-zinc-500">
              Real HTTP check durations from SQLite
            </p>
          </div>
          <span className="font-mono text-[11px] text-zinc-500">
            {chartPoints.length} points
          </span>
        </div>

        {chartPoints.length === 0 ? (
          <div className="flex h-44 items-center justify-center rounded border border-dashed border-white/[0.08] font-mono text-xs text-zinc-500">
            No response-time history in this window yet.
          </div>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartPoints}
                margin={{ top: 6, right: 8, left: -16, bottom: 0 }}
              >
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
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  name="Latency (ms)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Configuration & Recent Check History */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 rounded border border-white/[0.08] bg-[#09090b] p-4">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Configuration
          </h3>
          <dl className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between">
              <dt className="text-zinc-500">HTTP Method</dt>
              <dd className="text-zinc-200">{monitor.method}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Expected Status</dt>
              <dd className="text-zinc-200">{monitor.expectedStatusCodes}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Interval</dt>
              <dd className="text-zinc-200">{monitor.interval}s</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Timeout</dt>
              <dd className="text-zinc-200">{monitor.timeout}s</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Last HTTP Status</dt>
              <dd className="text-zinc-200">{monitor.httpStatusCode ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Last Check</dt>
              <dd className="text-zinc-200">
                {formatTimestamp(monitor.lastCheckedAt)}
              </dd>
            </div>
          </dl>

          {incidents.length > 0 && (
            <div className="border-t border-white/[0.08] pt-3">
              <h4 className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                Outage Incidents ({incidents.length})
              </h4>
              <div className="mt-2 space-y-2">
                {incidents.slice(0, 5).map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded border border-white/[0.07] bg-[#101114] p-2 font-mono text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          inc.status === 'open'
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }
                      >
                        {inc.status.toUpperCase()}
                      </span>
                      <span className="text-zinc-500">
                        {formatDurationSeconds(inc.durationSeconds)}
                      </span>
                    </div>
                    {inc.errorMessage && (
                      <div className="mt-1 truncate text-zinc-400">
                        {inc.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded border border-white/[0.08] bg-[#09090b] p-4 lg:col-span-2">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent Check History ({checks.length})
          </h3>
          <div className="mt-3 max-h-80 overflow-y-auto">
            {checks.length === 0 ? (
              <p className="py-8 text-center font-mono text-xs text-zinc-500">
                No checks recorded in this time window yet.
              </p>
            ) : (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[11px] text-zinc-500">
                    <th className="py-2 font-medium">State</th>
                    <th className="py-2 font-medium">HTTP</th>
                    <th className="py-2 font-medium">Latency</th>
                    <th className="py-2 font-medium">Detail</th>
                    <th className="py-2 text-right font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {checks.slice(0, 50).map((chk) => {
                    const st = chk.state || (chk.success === 1 ? 'UP' : 'DOWN');
                    return (
                      <tr key={chk.id} className="hover:bg-white/[0.02]">
                        <td className="py-2">
                          <span
                            className={
                              st === 'UP'
                                ? 'text-emerald-400'
                                : st === 'DEGRADED'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }
                          >
                            {st}
                          </span>
                        </td>
                        <td className="py-2 text-zinc-300">
                          {chk.statusCode ?? '—'}
                        </td>
                        <td className="py-2 text-zinc-300">
                          {chk.responseTime !== null
                            ? `${chk.responseTime} ms`
                            : '—'}
                        </td>
                        <td className="max-w-[200px] truncate py-2 text-zinc-400">
                          {chk.errorMessage ?? '—'}
                        </td>
                        <td className="py-2 text-right text-[11px] text-zinc-500">
                          {formatTimestamp(chk.checkedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
