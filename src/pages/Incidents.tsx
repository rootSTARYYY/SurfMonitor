import React, { useState } from 'react';
import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { IncidentDTO } from '@/types';
import { formatDurationSeconds, formatTimestamp } from '@/utils/format';

interface IncidentsProps {
  incidents: IncidentDTO[];
  onSelectMonitor: (monitorId: string) => void;
}

export const Incidents: React.FC<IncidentsProps> = ({
  incidents,
  onSelectMonitor,
}) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const filtered = incidents.filter(
    (inc) => filter === 'all' || inc.status === filter
  );
  const openIncidents = filtered.filter((i) => i.status === 'open');
  const resolvedIncidents = filtered.filter((i) => i.status === 'resolved');

  const renderRow = (inc: IncidentDTO) => {
    const isOpen = inc.status === 'open';
    return (
      <div
        key={inc.id}
        className="flex flex-col justify-between gap-3 border-b border-white/[0.07] bg-[#09090b] p-4 transition-colors last:border-b-0 hover:bg-[#0e1015] sm:flex-row sm:items-center"
      >
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {isOpen ? (
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            <button
              type="button"
              onClick={() => onSelectMonitor(inc.monitorId)}
              className="text-sm font-medium text-zinc-100 hover:text-emerald-300"
            >
              {inc.monitorName ?? inc.monitorId}
            </button>
            {inc.monitorUrl && (
              <span className="font-mono text-[11px] text-zinc-500">
                {inc.monitorUrl}
              </span>
            )}
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase ${
                isOpen
                  ? 'border-rose-500/25 bg-rose-500/10 text-rose-400'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {inc.status}
            </span>
          </div>

          <p className="font-mono text-xs text-zinc-400">
            {inc.errorMessage ?? 'Endpoint unreachable'}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-0.5 font-mono text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Started: {formatTimestamp(inc.startedAt)}
            </span>
            <span>Duration: {formatDurationSeconds(inc.durationSeconds)}</span>
            {inc.resolvedAt && (
              <span>Recovered: {formatTimestamp(inc.resolvedAt)}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Incidents
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Automatic outage &amp; recovery tracking from SQLite
          </p>
        </div>

        <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-0.5">
          {(['all', 'open', 'resolved'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] capitalize transition-colors ${
                filter === status
                  ? 'bg-white/[0.09] text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded border border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0c0d11] px-4 py-2.5">
          <span className="text-xs font-semibold text-zinc-200">
            Active Incidents
          </span>
          <span className="font-mono text-[11px] text-rose-400">
            {openIncidents.length} open
          </span>
        </div>
        {openIncidents.length === 0 ? (
          <div className="bg-[#09090b] px-4 py-8 text-center font-mono text-xs text-zinc-500">
            No active incidents.
          </div>
        ) : (
          openIncidents.map(renderRow)
        )}
      </section>

      <section className="overflow-hidden rounded border border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0c0d11] px-4 py-2.5">
          <span className="text-xs font-semibold text-zinc-200">
            Resolved Incidents
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            {resolvedIncidents.length} resolved
          </span>
        </div>
        {resolvedIncidents.length === 0 ? (
          <div className="bg-[#09090b] px-4 py-8 text-center font-mono text-xs text-zinc-500">
            No resolved incidents recorded yet.
          </div>
        ) : (
          resolvedIncidents.map(renderRow)
        )}
      </section>
    </div>
  );
};
