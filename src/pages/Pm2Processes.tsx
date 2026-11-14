import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  FileText,
  Play,
  RefreshCw,
  RotateCw,
  Search,
  Server,
  Square,
  Terminal,
  UserCheck,
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
  Pm2AlertConfigDTO,
  Pm2InstanceDTO,
  Pm2LogsPayload,
  Pm2MetricHistoryDTO,
  Pm2ProcessDTO,
  Pm2StateEventDTO,
  RemoteServerDTO,
} from '@/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDurationSeconds, formatShortTime, formatTimestamp } from '@/utils/format';

function formatMemoryMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stateBadgeClass(state: Pm2ProcessDTO['state']): string {
  switch (state) {
    case 'online':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'errored':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    case 'stopped':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
}

interface Pm2OverviewProps {
  onSelectProcess: (serverId: string, processKey: string) => void;
  onNotify: (title: string, tone: 'success' | 'error' | 'info', desc?: string) => void;
}

export const Pm2ProcessesPage: React.FC<Pm2OverviewProps> = ({
  onSelectProcess,
  onNotify,
}) => {
  const [servers, setServers] = useState<RemoteServerDTO[]>([]);
  const [instances, setInstances] = useState<Pm2InstanceDTO[]>([]);
  const [processes, setProcesses] = useState<Pm2ProcessDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [serverFilter, setServerFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    run: () => Promise<void>;
  } | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    const api = window.surfMonitorAPI;
    if (!api) return;
    if (forceRefresh) setRefreshing(true);
    try {
      const res = forceRefresh
        ? await api.refreshPm2(serverFilter !== 'all' ? serverFilter : undefined)
        : await api.getPm2Overview();
      setServers(res.servers ?? []);
      setInstances(res.instances ?? []);
      setProcesses(res.processes ?? []);
    } catch (err) {
      onNotify(
        'Failed to load PM2 processes',
        'error',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverFilter, onNotify]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const serverNameMap = useMemo(
    () => new Map(servers.map((s) => [s.id, s.name])),
    [servers]
  );

  const uniqueUsers = useMemo(
    () => Array.from(new Set(processes.map((p) => p.linuxUser))).sort(),
    [processes]
  );

  const filteredProcesses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return processes.filter((p) => {
      if (serverFilter !== 'all' && p.serverId !== serverFilter) return false;
      if (userFilter !== 'all' && p.linuxUser !== userFilter) return false;
      if (statusFilter !== 'all' && p.state !== statusFilter) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.linuxUser.toLowerCase().includes(q) &&
        !(serverNameMap.get(p.serverId) ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [processes, serverFilter, userFilter, statusFilter, search, serverNameMap]);

  const totalCount = processes.length;
  const onlineCount = processes.filter((p) => p.state === 'online').length;
  const stoppedCount = processes.filter((p) => p.state === 'stopped').length;
  const erroredCount = processes.filter((p) => p.state === 'errored').length;
  const totalRestarts = processes.reduce((acc, p) => acc + p.restarts, 0);

  const triggerAction = (
    proc: Pm2ProcessDTO,
    action: 'start' | 'stop' | 'restart'
  ) => {
    const srvName = serverNameMap.get(proc.serverId) ?? proc.serverId;
    const execute = async () => {
      const k = `${proc.serverId}:${proc.processKey}`;
      setBusyKey(k);
      try {
        await window.surfMonitorAPI?.runPm2Action(
          proc.serverId,
          proc.linuxUser,
          proc.pmId,
          action
        );
        onNotify(`PM2 ${action} succeeded`, 'success', `${proc.name} (${proc.linuxUser}) on ${srvName}`);
        await loadData(false);
      } catch (err) {
        onNotify(
          `PM2 ${action} failed`,
          'error',
          err instanceof Error ? err.message : 'Operation failed'
        );
      } finally {
        setBusyKey(null);
      }
    };

    if (action === 'start') {
      void execute();
      return;
    }

    setConfirmAction({
      title: `${action === 'restart' ? 'Restart' : 'Stop'} PM2 Process`,
      message: `Are you sure you want to ${action} "${proc.name}" (pm_id ${proc.pmId}, user ${proc.linuxUser}) on ${srvName}?`,
      run: execute,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">PM2 Processes</h1>
          <p className="font-mono text-xs text-zinc-500">
            Multi-user PM2 discovery, process telemetry, log inspection &amp; lifecycle control
          </p>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadData(true)}
          className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.05] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh PM2'}</span>
        </button>
      </div>

      {/* 6 Overview Cards */}
      <section className="grid grid-cols-2 divide-y divide-white/[0.08] overflow-hidden rounded border border-white/[0.08] bg-[#09090b] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Total Processes</div>
          <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">{totalCount}</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Online</div>
          <div className="mt-1 font-mono text-xl font-semibold text-emerald-400">{onlineCount}</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Stopped</div>
          <div className="mt-1 font-mono text-xl font-semibold text-zinc-400">{stoppedCount}</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Errored</div>
          <div className={`mt-1 font-mono text-xl font-semibold ${erroredCount > 0 ? 'text-rose-400' : 'text-zinc-100'}`}>
            {erroredCount}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Total Restarts</div>
          <div className="mt-1 font-mono text-xl font-semibold text-amber-300">{totalRestarts}</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">PM2 Instances</div>
          <div className="mt-1 font-mono text-xl font-semibold text-sky-400">{instances.length}</div>
        </div>
      </section>

      {/* Discovered PM2 User Instances */}
      {instances.length > 0 && (
        <section className="rounded border border-white/[0.08] bg-[#09090b] p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Discovered Linux PM2 Daemons
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {instances.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center justify-between rounded border border-white/[0.06] bg-[#101115] px-3 py-2 font-mono text-[11px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-zinc-200">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="font-semibold">{inst.linuxUser}</span>
                    <span className="text-zinc-500">
                      @ {serverNameMap.get(inst.serverId) ?? inst.serverId}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                    {inst.lastError
                      ? inst.lastError
                      : inst.pm2Path ?? 'PM2 binary not found'}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                    inst.accessible === 1
                      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                      : 'border-rose-500/25 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {inst.accessible === 1 ? `${inst.processCount} procs` : 'Inaccessible'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-white/[0.08] bg-[#09090b] p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by process name, Linux user, or server..."
            className="w-full rounded border border-white/[0.08] bg-[#101114] py-1.5 pl-8 pr-3 text-xs text-zinc-100 focus:outline-none"
          />
        </div>
        <select
          value={serverFilter}
          onChange={(e) => setServerFilter(e.target.value)}
          className="rounded border border-white/[0.08] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none"
        >
          <option value="all">All Servers</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded border border-white/[0.08] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none"
        >
          <option value="all">All Linux Users</option>
          {uniqueUsers.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#101114] p-0.5 font-mono text-[11px]">
          {['all', 'online', 'stopped', 'errored'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded px-2 py-1 capitalize ${
                statusFilter === st
                  ? 'bg-white/[0.09] text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Process Table */}
      <section className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b]">
        {loading ? (
          <div className="py-12 text-center font-mono text-xs text-zinc-500">
            Loading PM2 processes...
          </div>
        ) : filteredProcesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <Terminal className="h-7 w-7 text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-200">
              No PM2 processes discovered yet
            </p>
            <p className="mt-1 max-w-md font-mono text-xs text-zinc-500">
              Ensure your Linux server is connected and its agent is updated to v3.1.0 (open Server Details and click Update Agent if upgrading an older VPS).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] font-mono text-[11px] text-zinc-500">
                  <th className="px-4 py-2.5 font-medium">Process</th>
                  <th className="px-4 py-2.5 font-medium">Server</th>
                  <th className="px-4 py-2.5 font-medium">Linux User</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">CPU</th>
                  <th className="px-4 py-2.5 font-medium">Memory</th>
                  <th className="px-4 py-2.5 font-medium">Uptime</th>
                  <th className="px-4 py-2.5 font-medium">Restarts</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredProcesses.map((proc) => {
                  const k = `${proc.serverId}:${proc.processKey}`;
                  const isBusy = busyKey === k;
                  return (
                    <tr
                      key={proc.id}
                      onClick={() => onSelectProcess(proc.serverId, proc.processKey)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-zinc-100">{proc.name}</div>
                        <div className="font-mono text-[10px] text-zinc-500">
                          id:{proc.pmId} • {proc.execMode}
                          {proc.pid ? ` • pid ${proc.pid}` : ''}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-300">
                        <span className="inline-flex items-center gap-1.5">
                          <Server className="h-3 w-3 text-zinc-500" />
                          {serverNameMap.get(proc.serverId) ?? proc.serverId}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-300">
                        {proc.linuxUser}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${stateBadgeClass(
                            proc.state
                          )}`}
                        >
                          {proc.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-200">
                        {proc.cpu.toFixed(1)}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-200">
                        {formatMemoryMb(proc.memoryBytes)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-400">
                        {proc.state === 'online'
                          ? formatDurationSeconds(proc.uptimeSeconds)
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-300">
                        {proc.restarts}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-2.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => triggerAction(proc, 'restart')}
                            title="Restart process"
                            className="rounded border border-white/[0.08] bg-[#101114] p-1.5 text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40"
                          >
                            <RotateCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                          </button>
                          {proc.state === 'online' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => triggerAction(proc, 'stop')}
                              title="Stop process"
                              className="rounded border border-white/[0.08] bg-[#101114] p-1.5 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                            >
                              <Square className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => triggerAction(proc, 'start')}
                              title="Start process"
                              className="rounded border border-white/[0.08] bg-[#101114] p-1.5 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectProcess(proc.serverId, proc.processKey)}
                            title="Details & Logs"
                            className="rounded border border-white/[0.08] bg-[#101114] p-1.5 text-sky-400 hover:bg-sky-500/10"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.message ?? ''}
        confirmLabel="Confirm"
        onConfirm={async () => {
          const fn = confirmAction?.run;
          setConfirmAction(null);
          if (fn) await fn();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

/* ---------------- PM2 PROCESS DETAIL & LOG VIEWER ---------------- */
interface Pm2DetailProps {
  serverId: string;
  processKey: string;
  onBack: () => void;
  onNotify: (title: string, tone: 'success' | 'error' | 'info', desc?: string) => void;
}

export const Pm2ProcessDetailPage: React.FC<Pm2DetailProps> = ({
  serverId,
  processKey,
  onBack,
  onNotify,
}) => {
  const [proc, setProc] = useState<Pm2ProcessDTO | null>(null);
  const [history, setHistory] = useState<Pm2MetricHistoryDTO[]>([]);
  const [events, setEvents] = useState<Pm2StateEventDTO[]>([]);
  const [alertCfg, setAlertCfg] = useState<Pm2AlertConfigDTO | null>(null);

  const [logs, setLogs] = useState<Pm2LogsPayload | null>(null);
  const [logStream, setLogStream] = useState<'all' | 'stdout' | 'stderr'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [logLines, setLogLines] = useState(120);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    run: () => Promise<void>;
  } | null>(null);

  const loadDetail = useCallback(async () => {
    const api = window.surfMonitorAPI;
    if (!api) return;
    const res = await api.getPm2ProcessDetail(serverId, processKey);
    setProc(res.process);
    setHistory(res.history);
    setEvents(res.events);
    setAlertCfg(res.alertConfig);
  }, [serverId, processKey]);

  const loadLogs = useCallback(
    async (p: Pm2ProcessDTO) => {
      const api = window.surfMonitorAPI;
      if (!api) return;
      setLoadingLogs(true);
      try {
        const res = await api.getPm2ProcessLogs(
          serverId,
          p.linuxUser,
          p.pmId,
          logLines
        );
        setLogs(res);
      } catch (err) {
        onNotify(
          'Failed to fetch PM2 logs',
          'error',
          err instanceof Error ? err.message : undefined
        );
      } finally {
        setLoadingLogs(false);
      }
    },
    [serverId, logLines, onNotify]
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (proc) {
      void loadLogs(proc);
    }
  }, [proc?.pmId, proc?.linuxUser, logLines]);

  const runAction = (action: 'start' | 'stop' | 'restart') => {
    if (!proc) return;
    const execute = async () => {
      setBusyAction(true);
      try {
        await window.surfMonitorAPI?.runPm2Action(
          serverId,
          proc.linuxUser,
          proc.pmId,
          action
        );
        onNotify(`PM2 ${action} succeeded`, 'success', proc.name);
        await loadDetail();
        await loadLogs(proc);
      } catch (err) {
        onNotify(
          `PM2 ${action} failed`,
          'error',
          err instanceof Error ? err.message : undefined
        );
      } finally {
        setBusyAction(false);
      }
    };

    if (action === 'start') {
      void execute();
      return;
    }

    setConfirmAction({
      title: `${action === 'restart' ? 'Restart' : 'Stop'} ${proc.name}`,
      message: `Confirm ${action} for "${proc.name}" (user ${proc.linuxUser}, pm_id ${proc.pmId})?`,
      run: execute,
    });
  };

  if (!proc) {
    return (
      <div className="p-8 text-center font-mono text-xs text-zinc-500">
        Loading PM2 process details...
      </div>
    );
  }

  const chartData = history.map((h) => ({
    time: formatShortTime(h.collectedAt),
    cpu: h.cpu,
    memoryMb: Number((h.memoryBytes / (1024 * 1024)).toFixed(1)),
  }));

  const combinedLogs = [
    ...(logStream !== 'stderr'
      ? (logs?.stdout.lines ?? []).map((line) => ({ stream: 'stdout' as const, line }))
      : []),
    ...(logStream !== 'stdout'
      ? (logs?.stderr.lines ?? []).map((line) => ({ stream: 'stderr' as const, line }))
      : []),
  ].filter(
    (entry) =>
      !logSearch.trim() ||
      entry.line.toLowerCase().includes(logSearch.trim().toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-7 w-7 items-center justify-center rounded border border-white/[0.08] bg-[#101114] text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-100">{proc.name}</h1>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${stateBadgeClass(
                  proc.state
                )}`}
              >
                {proc.status}
              </span>
            </div>
            <p className="font-mono text-xs text-zinc-500">
              user: {proc.linuxUser} • pm_id: {proc.pmId} • {proc.execMode} ({proc.instances}x)
              {proc.nodeVersion ? ` • Node ${proc.nodeVersion}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busyAction}
            onClick={() => runAction('restart')}
            className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.06]"
          >
            <RotateCw className={`h-3.5 w-3.5 ${busyAction ? 'animate-spin' : ''}`} />
            <span>Restart</span>
          </button>
          {proc.state === 'online' ? (
            <button
              type="button"
              disabled={busyAction}
              onClick={() => runAction('stop')}
              className="flex items-center gap-1.5 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 font-mono text-xs text-rose-300 hover:bg-rose-500/20"
            >
              <Square className="h-3.5 w-3.5" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={busyAction}
              onClick={() => runAction('start')}
              className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-300 hover:bg-emerald-500/20"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Start</span>
            </button>
          )}
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-3 rounded border border-white/[0.08] bg-[#09090b] p-4 font-mono text-xs md:grid-cols-4">
        <div>
          <div className="text-[10px] text-zinc-500">CPU / Memory</div>
          <div className="mt-1 text-zinc-100">
            {proc.cpu.toFixed(1)}% / {formatMemoryMb(proc.memoryBytes)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Uptime / PID</div>
          <div className="mt-1 text-zinc-100">
            {proc.state === 'online' ? formatDurationSeconds(proc.uptimeSeconds) : '—'} •{' '}
            {proc.pid ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Restarts / Last Restart</div>
          <div className="mt-1 text-zinc-100">
            {proc.restarts} • {proc.lastRestartAt ? formatShortTime(proc.lastRestartAt) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Environment</div>
          <div className="mt-1 text-zinc-100">{proc.envName ?? 'default'}</div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] text-zinc-500">Script Path</div>
          <div className="mt-1 truncate text-zinc-300">{proc.scriptPath ?? '—'}</div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] text-zinc-500">Working Directory</div>
          <div className="mt-1 truncate text-zinc-300">{proc.cwd ?? '—'}</div>
        </div>
      </div>

      {/* CPU & Memory Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <Cpu className="h-3.5 w-3.5 text-emerald-400" />
            <span>CPU Usage (%)</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#111216', borderColor: 'rgba(255,255,255,0.12)', fontSize: '11px', fontFamily: 'monospace' }} />
                <Area type="monotone" dataKey="cpu" stroke="#10b981" fill="#10b981" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <Activity className="h-3.5 w-3.5 text-sky-400" />
            <span>Memory Usage (MB)</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} unit="MB" />
                <Tooltip contentStyle={{ backgroundColor: '#111216', borderColor: 'rgba(255,255,255,0.12)', fontSize: '11px', fontFamily: 'monospace' }} />
                <Area type="monotone" dataKey="memoryMb" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Log Viewer */}
      <section className="rounded border border-white/[0.08] bg-[#09090b] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Process Logs</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search logs..."
              className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1 font-mono text-xs text-zinc-100 focus:outline-none"
            />
            <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#101114] p-0.5 font-mono text-[11px]">
              {(['all', 'stdout', 'stderr'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setLogStream(st)}
                  className={`rounded px-2 py-0.5 uppercase ${
                    logStream === st
                      ? 'bg-white/[0.09] text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <select
              value={logLines}
              onChange={(e) => setLogLines(Number(e.target.value))}
              className="rounded border border-white/[0.1] bg-[#101114] px-2 py-1 font-mono text-xs text-zinc-200 focus:outline-none"
            >
              <option value={60}>60 lines</option>
              <option value={120}>120 lines</option>
              <option value={250}>250 lines</option>
            </select>
            <button
              type="button"
              disabled={loadingLogs}
              onClick={() => void loadLogs(proc)}
              className="flex items-center gap-1 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1 font-mono text-xs text-zinc-200 hover:bg-white/[0.05]"
            >
              <RefreshCw className={`h-3 w-3 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto rounded border border-white/[0.06] bg-[#060608] p-3 font-mono text-[11px] leading-relaxed">
          {combinedLogs.length === 0 ? (
            <div className="py-6 text-center text-zinc-500">
              {loadingLogs ? 'Fetching logs from VPS...' : 'No log lines available.'}
            </div>
          ) : (
            combinedLogs.map((entry, idx) => (
              <div
                key={idx}
                className={`flex gap-2 py-0.5 ${
                  entry.stream === 'stderr' ? 'text-rose-300' : 'text-zinc-300'
                }`}
              >
                <span
                  className={`shrink-0 rounded px-1 text-[9px] uppercase ${
                    entry.stream === 'stderr'
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {entry.stream === 'stderr' ? 'ERR' : 'OUT'}
                </span>
                <span className="break-all">{entry.line}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* State Timeline & Alert Thresholds */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded border border-white/[0.08] bg-[#09090b] p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100">
            Process Status &amp; Restart Timeline
          </h2>
          {events.length === 0 ? (
            <div className="py-6 text-center font-mono text-xs text-zinc-500">
              No state transitions or restart spikes recorded yet.
            </div>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded border border-white/[0.06] bg-[#101115] p-2.5 font-mono text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-zinc-200">
                      {ev.eventType === 'RECOVERED' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      )}
                      {ev.eventType}
                    </span>
                    <span className="text-zinc-500">{formatTimestamp(ev.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-zinc-400">{ev.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {alertCfg && (
          <section className="rounded border border-white/[0.08] bg-[#09090b] p-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-100">
              Server PM2 Alert Thresholds
            </h2>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">CPU %</label>
                <input
                  type="number"
                  value={alertCfg.cpuThreshold}
                  onChange={(e) =>
                    setAlertCfg({ ...alertCfg, cpuThreshold: Number(e.target.value) })
                  }
                  className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">Memory (MB)</label>
                <input
                  type="number"
                  value={alertCfg.memoryMbThreshold}
                  onChange={(e) =>
                    setAlertCfg({
                      ...alertCfg,
                      memoryMbThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">
                  Restart Spike Count
                </label>
                <input
                  type="number"
                  value={alertCfg.restartSpikeThreshold}
                  onChange={(e) =>
                    setAlertCfg({
                      ...alertCfg,
                      restartSpikeThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">
                  Cooldown (sec)
                </label>
                <input
                  type="number"
                  value={alertCfg.cooldownSeconds}
                  onChange={(e) =>
                    setAlertCfg({
                      ...alertCfg,
                      cooldownSeconds: Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={alertCfg.enabled === 1}
                  onChange={(e) =>
                    setAlertCfg({ ...alertCfg, enabled: e.target.checked ? 1 : 0 })
                  }
                />
                Enable PM2 Incident Alerts
              </label>
              <button
                type="button"
                onClick={async () => {
                  const saved = await window.surfMonitorAPI?.savePm2AlertConfig(alertCfg);
                  if (saved) setAlertCfg(saved);
                  onNotify('PM2 alert thresholds saved', 'success');
                }}
                className="rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs font-medium text-white hover:bg-emerald-500"
              >
                Save Thresholds
              </button>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.message ?? ''}
        confirmLabel="Confirm"
        onConfirm={async () => {
          const fn = confirmAction?.run;
          setConfirmAction(null);
          if (fn) await fn();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};
