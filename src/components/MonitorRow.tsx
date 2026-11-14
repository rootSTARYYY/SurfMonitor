import React from 'react';
import { ExternalLink, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Monitor, MonitorStatus } from '@/types';
import { formatRelativeTime, formatUptime } from '@/utils/format';

interface MonitorRowProps {
  monitor: Monitor;
  onSelect?: (monitorId: string) => void;
  onEdit?: (monitor: Monitor) => void;
  onDelete?: (monitor: Monitor) => void;
  onTogglePause?: (monitor: Monitor) => void;
  showActions?: boolean;
}

const STATUS_CONFIG: Record<
  MonitorStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  UP: {
    label: 'UP',
    dotClass: 'bg-emerald-500',
    badgeClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  },
  DEGRADED: {
    label: 'DEGRADED',
    dotClass: 'bg-amber-500',
    badgeClass: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  },
  DOWN: {
    label: 'DOWN',
    dotClass: 'bg-rose-500',
    badgeClass: 'border-rose-500/25 bg-rose-500/10 text-rose-400',
  },
  PAUSED: {
    label: 'PAUSED',
    dotClass: 'bg-zinc-500',
    badgeClass: 'border-white/[0.1] bg-white/[0.04] text-zinc-400',
  },
  NO_DATA: {
    label: 'NO DATA',
    dotClass: 'bg-zinc-400',
    badgeClass: 'border-white/[0.1] bg-white/[0.03] text-zinc-400',
  },
};

export const MonitorRow: React.FC<MonitorRowProps> = ({
  monitor,
  onSelect,
  onEdit,
  onDelete,
  onTogglePause,
  showActions = false,
}) => {
  const statusStyle = STATUS_CONFIG[monitor.status];

  const handleOpenExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.surfMonitorAPI) {
      void window.surfMonitorAPI.openExternal(monitor.url);
    } else {
      window.open(monitor.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={onSelect ? () => onSelect(monitor.id) : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(monitor.id);
              }
            }
          : undefined
      }
      className={`group flex flex-col justify-between gap-3 border-b border-white/[0.07] bg-[#09090b] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#0e1015] lg:flex-row lg:items-center ${
        onSelect ? 'cursor-pointer' : ''
      }`}
    >
      {/* Identity & URL */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${statusStyle.dotClass}`}
          title={statusStyle.label}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-zinc-100 transition-colors group-hover:text-emerald-300">
              {monitor.name}
            </span>
            <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {monitor.method} · {monitor.interval}s
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenExternal}
            className="mt-0.5 flex items-center gap-1 truncate font-mono text-[11px] text-zinc-500 transition-colors hover:text-emerald-400"
          >
            <span className="truncate">{monitor.url}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
          </button>
        </div>
      </div>

      {/* Real History Ticks + Telemetry */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-5">
        <div
          className="hidden items-center gap-0.5 xl:flex"
          title="Recent check history"
        >
          {monitor.recentHistory.length === 0 ? (
            <span className="font-mono text-[10px] text-zinc-600">
              No history
            </span>
          ) : (
            monitor.recentHistory.slice(-20).map((tick, idx) => (
              <span
                key={`${monitor.id}-tick-${idx}`}
                className={`h-4 w-1 rounded-[1px] ${
                  monitor.status === 'PAUSED'
                    ? 'bg-zinc-700'
                    : tick.state === 'UP'
                      ? 'bg-emerald-500'
                      : tick.state === 'DEGRADED'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                }`}
              />
            ))
          )}
        </div>

        <div className="w-12 text-left sm:text-right">
          <div className="font-mono text-[10px] text-zinc-500">HTTP</div>
          <div className="font-mono text-xs text-zinc-300">
            {monitor.httpStatusCode ?? '—'}
          </div>
        </div>

        <div className="w-16 text-left sm:text-right">
          <div className="font-mono text-[10px] text-zinc-500">Latency</div>
          <div className="font-mono text-xs text-zinc-200">
            {monitor.status === 'PAUSED'
              ? 'Paused'
              : monitor.responseTimeMs !== null
                ? `${monitor.responseTimeMs} ms`
                : monitor.status === 'NO_DATA'
                  ? '—'
                  : 'Timeout'}
          </div>
        </div>

        <div className="w-16 text-left sm:text-right">
          <div className="font-mono text-[10px] text-zinc-500">Uptime</div>
          <div className="font-mono text-xs text-zinc-200">
            {formatUptime(monitor.stats.uptime24h ?? monitor.stats.uptimeTotal)}
          </div>
        </div>

        <div className="hidden w-20 text-right md:block">
          <div className="font-mono text-[10px] text-zinc-500">Checked</div>
          <div className="truncate font-mono text-[11px] text-zinc-400">
            {formatRelativeTime(monitor.lastCheckedAt)}
          </div>
        </div>

        <span
          className={`inline-flex w-24 items-center justify-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] ${statusStyle.badgeClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dotClass}`} />
          {statusStyle.label}
        </span>

        {showActions && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {onTogglePause && (
              <button
                type="button"
                onClick={() => onTogglePause(monitor)}
                className="rounded border border-transparent p-1.5 text-zinc-400 transition-colors hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-zinc-100"
                title={monitor.enabled ? 'Pause monitor' : 'Resume monitor'}
                aria-label={
                  monitor.enabled
                    ? `Pause ${monitor.name}`
                    : `Resume ${monitor.name}`
                }
              >
                {monitor.enabled ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(monitor)}
                className="rounded border border-transparent p-1.5 text-zinc-400 transition-colors hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-zinc-100"
                title="Edit monitor"
                aria-label={`Edit ${monitor.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(monitor)}
                className="rounded border border-transparent p-1.5 text-zinc-400 transition-colors hover:border-rose-500/25 hover:bg-rose-500/10 hover:text-rose-400"
                title="Delete monitor"
                aria-label={`Delete ${monitor.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
