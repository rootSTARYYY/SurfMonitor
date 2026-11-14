import React, { useMemo } from 'react';
import { Award, CheckCircle2, Clock, TrendingDown } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsPayload, AnalyticsRange } from '@/types';
import { StatCard } from '@/components/StatCard';
import { formatShortTime, formatUptime } from '@/utils/format';

interface AnalyticsProps {
  data: AnalyticsPayload | null;
  loading: boolean;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
}

const RANGES: AnalyticsRange[] = ['24h', '7d', '30d'];

export const Analytics: React.FC<AnalyticsProps> = ({
  data,
  loading,
  range,
  onRangeChange,
}) => {
  const monitors = data?.monitors ?? [];
  const checks = data?.checks ?? [];
  const stats = data?.stats;

  const responseSeries = useMemo(
    () =>
      checks
        .filter((c) => c.responseTime !== null)
        .slice(-120)
        .map((c) => ({
          time: formatShortTime(c.checkedAt),
          latencyMs: c.responseTime as number,
        })),
    [checks]
  );

  const monitorComparisonData = useMemo(
    () =>
      monitors.map((m) => ({
        name: m.name,
        avgLatency: m.stats.avgResponseTimeMs ?? 0,
        uptime: m.stats.uptimeTotal ?? 0,
      })),
    [monitors]
  );

  const bestAndWorst = useMemo(() => {
    const withData = monitors.filter((m) => m.stats.uptimeTotal !== null);
    if (withData.length === 0) {
      return { best: null, worst: null };
    }
    const sorted = [...withData].sort(
      (a, b) => (b.stats.uptimeTotal ?? 0) - (a.stats.uptimeTotal ?? 0)
    );
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1],
    };
  }, [monitors]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Analytics
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Genuine uptime, latency, and check volume from SQLite records
          </p>
        </div>

        <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-0.5">
          {RANGES.map((r) => (
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

      {/* KPI Grid */}
      <div className="grid grid-cols-1 divide-y divide-white/[0.08] overflow-hidden rounded border border-white/[0.08] sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
        <StatCard
          label="Avg Latency"
          value={
            loading && !data
              ? '—'
              : stats?.avgResponseTimeMs !== null &&
                  stats?.avgResponseTimeMs !== undefined
                ? `${stats.avgResponseTimeMs} ms`
                : 'No data'
          }
          sublabel={
            stats?.minResponseTimeMs !== null &&
            stats?.maxResponseTimeMs !== null &&
            stats?.minResponseTimeMs !== undefined
              ? `${stats.minResponseTimeMs}–${stats.maxResponseTimeMs}ms`
              : undefined
          }
          icon={Clock}
          tone="default"
        />
        <StatCard
          label="Availability"
          value={
            loading && !data
              ? '—'
              : formatUptime(stats?.uptimeTotal ?? null)
          }
          sublabel={
            stats
              ? `${stats.upChecks + stats.degradedChecks}/${stats.totalChecks} reachable`
              : undefined
          }
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Best Performing"
          value={bestAndWorst.best ? bestAndWorst.best.name : 'No data'}
          sublabel={
            bestAndWorst.best
              ? formatUptime(bestAndWorst.best.stats.uptimeTotal)
              : undefined
          }
          icon={Award}
          tone="success"
        />
        <StatCard
          label="Worst Performing"
          value={bestAndWorst.worst ? bestAndWorst.worst.name : 'No data'}
          sublabel={
            bestAndWorst.worst
              ? formatUptime(bestAndWorst.worst.stats.uptimeTotal)
              : undefined
          }
          icon={TrendingDown}
          tone="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 divide-y divide-white/[0.08] overflow-hidden rounded border border-white/[0.08] bg-[#09090b] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              Response Time Over Time
            </h2>
            <p className="font-mono text-[11px] text-zinc-500">
              Recorded HTTP latency ({range})
            </p>
          </div>
          {responseSeries.length === 0 ? (
            <div className="flex h-52 items-center justify-center rounded border border-dashed border-white/[0.08] font-mono text-xs text-zinc-500">
              Insufficient check history in this range.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={responseSeries}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
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
                    dataKey="latencyMs"
                    name="Latency (ms)"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              Monitor Latency Comparison
            </h2>
            <p className="font-mono text-[11px] text-zinc-500">
              Average response time per monitor
            </p>
          </div>
          {monitorComparisonData.length === 0 ? (
            <div className="flex h-52 items-center justify-center rounded border border-dashed border-white/[0.08] font-mono text-xs text-zinc-500">
              No monitors configured yet.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monitorComparisonData}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
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
                  <Bar
                    dataKey="avgLatency"
                    name="Avg Latency (ms)"
                    fill="#8b5cf6"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
