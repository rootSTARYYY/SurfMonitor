import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Globe, Plus, Search } from 'lucide-react';
import { Monitor, MonitorStatus } from '@/types';
import { MonitorRow } from '@/components/MonitorRow';

interface MonitorsProps {
  monitors: Monitor[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenAddModal: () => void;
  onSelectMonitor: (monitorId: string) => void;
  onEditMonitor: (monitor: Monitor) => void;
  onDeleteMonitor: (monitor: Monitor) => void;
  onTogglePause: (monitor: Monitor) => void;
}

type StatusFilter = 'all' | MonitorStatus;
type SortKey = 'name' | 'uptime' | 'latency';

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'UP', label: 'UP' },
  { value: 'DEGRADED', label: 'DEGRADED' },
  { value: 'DOWN', label: 'DOWN' },
  { value: 'PAUSED', label: 'PAUSED' },
  { value: 'NO_DATA', label: 'NO DATA' },
];

export const Monitors: React.FC<MonitorsProps> = ({
  monitors,
  searchQuery,
  onSearchChange,
  onOpenAddModal,
  onSelectMonitor,
  onEditMonitor,
  onDeleteMonitor,
  onTogglePause,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const filteredMonitors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = monitors.filter((m) => {
      const matchesStatus =
        statusFilter === 'all' || m.status === statusFilter;
      const matchesQuery =
        !query ||
        m.name.toLowerCase().includes(query) ||
        m.url.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });

    return [...list].sort((a, b) => {
      if (sortKey === 'uptime') {
        return (
          (b.stats.uptime24h ?? b.stats.uptimeTotal ?? -1) -
          (a.stats.uptime24h ?? a.stats.uptimeTotal ?? -1)
        );
      }
      if (sortKey === 'latency') {
        return (a.responseTimeMs ?? 99999) - (b.responseTimeMs ?? 99999);
      }
      return a.name.localeCompare(b.name);
    });
  }, [monitors, searchQuery, statusFilter, sortKey]);

  const counts = useMemo(
    () => ({
      all: monitors.length,
      UP: monitors.filter((m) => m.status === 'UP').length,
      DEGRADED: monitors.filter((m) => m.status === 'DEGRADED').length,
      DOWN: monitors.filter((m) => m.status === 'DOWN').length,
      PAUSED: monitors.filter((m) => m.status === 'PAUSED').length,
      NO_DATA: monitors.filter((m) => m.status === 'NO_DATA').length,
    }),
    [monitors]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded border border-white/[0.08] bg-[#09090b] p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by name or URL..."
            className="w-full rounded border border-white/[0.08] bg-[#101114] py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded border border-white/[0.08] bg-[#101114] p-0.5">
            {FILTER_OPTIONS.map((opt) => {
              const active = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] transition-colors ${
                    active
                      ? 'bg-white/[0.09] text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] opacity-70">
                    {counts[opt.value]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#101114] px-2 py-1">
            <ArrowUpDown className="h-3 w-3 text-zinc-500" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort monitors"
              className="bg-transparent font-mono text-[11px] text-zinc-300 focus:outline-none"
            >
              <option value="name" className="bg-[#101114]">
                Sort: Name
              </option>
              <option value="uptime" className="bg-[#101114]">
                Sort: Uptime
              </option>
              <option value="latency" className="bg-[#101114]">
                Sort: Latency
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Monitor</span>
          </button>
        </div>
      </div>

      {monitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-white/[0.1] bg-[#09090b] px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <Globe className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-100">
            No monitors configured yet
          </h3>
          <p className="mt-1 max-w-sm text-xs text-zinc-500">
            Add your first website or API endpoint to start real HTTP uptime
            monitoring.
          </p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="mt-5 flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Your First Monitor</span>
          </button>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-white/[0.08] bg-[#09090b] px-6 py-12 text-center">
          <p className="text-sm font-medium text-zinc-200">
            No monitors match your current filter
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              setStatusFilter('all');
            }}
            className="mt-3 rounded border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.08]"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-white/[0.08]">
          {filteredMonitors.map((monitor) => (
            <MonitorRow
              key={monitor.id}
              monitor={monitor}
              showActions
              onSelect={onSelectMonitor}
              onEdit={onEditMonitor}
              onDelete={onDeleteMonitor}
              onTogglePause={onTogglePause}
            />
          ))}
        </div>
      )}
    </div>
  );
};
