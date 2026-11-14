import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Box,
  Cpu,
  HardDrive,
  DownloadCloud,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCw,
  Server,
  Square,
  Terminal,
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
  DockerContainerDTO,
  RemoteAuditLogDTO,
  RemoteServerDTO,
  RemoteServiceDTO,
  ServerMetricDTO,
} from '@/types';
import { formatRelativeTime, formatShortTime, formatTimestamp } from '@/utils/format';
import { ConfirmDialog } from '@/components/ConfirmDialog';

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(1)} ${units[idx]}`;
}

/* ---------------- SERVER MANAGER PAGE ---------------- */
interface ServerManagerProps {
  servers: RemoteServerDTO[];
  onOpenAddServer: () => void;
  onEditServer: (server: RemoteServerDTO) => void;
  onSelectServer: (id: string) => void;
  onRefresh: () => void;
}

export const ServerManagerPage: React.FC<ServerManagerProps> = ({
  servers,
  onOpenAddServer,
  onEditServer,
  onSelectServer,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<RemoteServerDTO | null>(null);

  const filtered = servers.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesQ =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.host.toLowerCase().includes(q) ||
      (s.hostname ?? '').toLowerCase().includes(q);
    const matchesS =
      statusFilter === 'all' || s.connectionStatus === statusFilter;
    return matchesQ && matchesS;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">
            Remote Servers
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            SSH-tunneled Linux &amp; Windows infrastructure agents
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddServer}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Server</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded border border-white/[0.08] bg-[#09090b] p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search servers by name, IP, or hostname..."
          className="min-w-[220px] flex-1 rounded border border-white/[0.08] bg-[#101114] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
        />
        <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#101114] p-0.5 font-mono text-[11px]">
          {['all', 'connected', 'disconnected', 'error'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded px-2.5 py-1 capitalize ${
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

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-white/[0.1] bg-[#09090b] py-16 text-center">
          <Server className="h-7 w-7 text-zinc-500" />
          <p className="mt-3 text-sm font-medium text-zinc-200">
            No remote servers configured
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            Connect a Linux VPS via SSH key to stream CPU, RAM, Disk, Docker &amp; systemd telemetry.
          </p>
          <button
            type="button"
            onClick={onOpenAddServer}
            className="mt-4 flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add First Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((srv) => {
            const isConn = srv.connectionStatus === 'connected';
            const m = isConn ? srv.latestMetric : null;
            return (
              <div
                key={srv.id}
                onClick={() => onSelectServer(srv.id)}
                className="cursor-pointer rounded border border-white/[0.08] bg-[#09090b] p-4 transition-colors hover:border-white/[0.16] hover:bg-[#0e1015]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isConn
                            ? 'bg-emerald-500'
                            : srv.connectionStatus === 'error'
                              ? 'bg-rose-500'
                              : 'bg-zinc-500'
                        }`}
                      />
                      <span className="text-sm font-semibold text-zinc-100">
                        {srv.name}
                      </span>
                      <span className="rounded border border-white/[0.08] bg-[#101114] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                        {srv.groupName}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                      {srv.username}@{srv.host}:{srv.port} ·{' '}
                      {srv.osInfo ?? 'Linux'} · Agent{' '}
                      {srv.agentVersion ?? '—'}
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        await window.surfMonitorAPI?.toggleRemoteServer(
                          srv.id,
                          !srv.enabled
                        );
                        onRefresh();
                      }}
                      className="rounded border border-white/[0.08] bg-[#101114] p-1.5 text-zinc-300 hover:bg-white/[0.05]"
                      title={srv.enabled ? 'Disconnect' : 'Connect'}
                    >
                      <Power
                        className={`h-3.5 w-3.5 ${
                          srv.enabled ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await window.surfMonitorAPI?.pollRemoteServerNow(srv.id);
                        onRefresh();
                      }}
                      className="rounded border border-white/[0.08] bg-[#101114] p-1.5 text-zinc-300 hover:bg-white/[0.05]"
                      title="Poll now"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditServer(srv)}
                      className="rounded border border-white/[0.08] bg-[#101114] p-1.5 text-zinc-300 hover:bg-white/[0.05]"
                      title="Edit server"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(srv)}
                      className="rounded border border-white/[0.08] bg-[#101114] p-1.5 text-zinc-400 hover:text-rose-400"
                      title="Delete server"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {srv.lastError && !isConn && (
                  <div className="mt-2 rounded border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 font-mono text-[11px] text-rose-300">
                    {srv.lastError}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/[0.06] pt-3 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-zinc-500">CPU</div>
                    <div className="text-zinc-100">
                      {m ? `${m.cpuPercent}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500">RAM</div>
                    <div className="text-zinc-100">
                      {m ? `${m.ramPercent}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500">Disk</div>
                    <div className="text-zinc-100">
                      {m ? `${m.diskPercent}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500">Last Seen</div>
                    <div className="text-zinc-400">
                      {formatRelativeTime(srv.lastSeenAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Remove Remote Server"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.name}" (${deleteTarget.host}) and all stored server metrics?`
            : ''
        }
        confirmLabel="Remove Server"
        onConfirm={async () => {
          if (deleteTarget) {
            await window.surfMonitorAPI?.deleteRemoteServer(deleteTarget.id);
            setDeleteTarget(null);
            onRefresh();
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

/* ---------------- SERVER DETAIL PAGE ---------------- */
interface ServerDetailProps {
  serverId: string;
  onBack: () => void;
  onEditServer?: (server: RemoteServerDTO) => void;
}

export const ServerDetailPage: React.FC<ServerDetailProps> = ({
  serverId,
  onBack,
  onEditServer,
}) => {
  const [server, setServer] = useState<RemoteServerDTO | null>(null);
  const [metrics, setMetrics] = useState<ServerMetricDTO[]>([]);
  const [auditLogs, setAuditLogs] = useState<RemoteAuditLogDTO[]>([]);
  const [containers, setContainers] = useState<DockerContainerDTO[]>([]);
  const [dockerVersion, setDockerVersion] = useState<string | null>(null);
  const [services, setServices] = useState<RemoteServiceDTO[]>([]);
  const [tab, setTab] = useState<'metrics' | 'docker' | 'services' | 'audit'>(
    'metrics'
  );
  const [upgradingAgent, setUpgradingAgent] = useState(false);
  const [agentMsg, setAgentMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    desc: string;
    run: () => Promise<void>;
  } | null>(null);

  const loadAll = useCallback(async () => {
    const api = window.surfMonitorAPI;
    if (!api) return;
    const detail = await api.getRemoteServerDetail(serverId);
    setServer(detail.server);
    setMetrics(detail.metrics);
    setAuditLogs(detail.auditLogs);

    if (detail.server.connectionStatus === 'connected') {
      try {
        const d = await api.getDockerContainers(serverId);
        setDockerVersion(d.available ? (d.version ?? 'available') : null);
        setContainers(d.containers);
      } catch {
        setContainers([]);
      }
      try {
        const s = await api.getRemoteServices(serverId);
        setServices(s.services);
      } catch {
        setServices([]);
      }
    }
  }, [serverId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!server) {
    return (
      <div className="p-8 text-center font-mono text-xs text-zinc-500">
        Loading server telemetry...
      </div>
    );
  }

  const chartData = metrics.map((m) => ({
    time: formatShortTime(m.collectedAt),
    cpu: m.cpuPercent,
    ram: m.ramPercent,
    disk: m.diskPercent,
  }));

  const latest = server.connectionStatus === 'connected' ? server.latestMetric : null;

  return (
    <div className="space-y-5">
      {agentMsg && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-xs text-emerald-300">
          {agentMsg}
        </div>
      )}
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
            <h1 className="text-lg font-semibold text-zinc-100">
              {server.name}
            </h1>
            <p className="font-mono text-xs text-zinc-500">
              {server.hostname ?? server.host} · {server.osInfo ?? 'Linux'} ·
              Kernel {server.kernelVersion ?? '—'} ·{' '}
              {server.cpuCores ?? '—'} cores ·{' '}
              {formatBytes(server.totalMemoryBytes)} RAM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEditServer && (
            <button
              type="button"
              onClick={() => onEditServer(server)}
              className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.05]"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          )}
          <button
            type="button"
            disabled={upgradingAgent}
            onClick={async () => {
              setUpgradingAgent(true);
              setAgentMsg(null);
              try {
                const res = await window.surfMonitorAPI?.upgradeRemoteServerAgent(server.id);
                setAgentMsg(res?.ok ? 'Agent updated to v3.1.0 with PM2 support.' : 'Agent update failed.');
                await loadAll();
              } catch (err) {
                setAgentMsg(err instanceof Error ? err.message : 'Agent update failed');
              } finally {
                setUpgradingAgent(false);
              }
            }}
            className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <DownloadCloud className="h-3.5 w-3.5" />
            <span>{upgradingAgent ? 'Updating...' : 'Update Agent'}</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await window.surfMonitorAPI?.pollRemoteServerNow(server.id);
              await loadAll();
            }}
            className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.05]"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.08] font-mono text-xs">
        {(
          [
            ['metrics', 'Resource Telemetry'],
            ['docker', `Docker (${containers.length})`],
            ['services', `Services (${services.length})`],
            ['audit', `Audit Log (${auditLogs.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`border-b-2 px-4 py-2 transition-colors ${
              tab === id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'metrics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
              <div className="flex items-center justify-between font-mono text-xs text-zinc-400">
                <span>CPU Usage</span>
                <Cpu className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                {latest ? `${latest.cpuPercent}%` : '—'}
              </div>
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
              <div className="font-mono text-xs text-zinc-400">RAM Usage</div>
              <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                {latest ? `${latest.ramPercent}%` : '—'}
              </div>
              {latest && (
                <div className="font-mono text-[10px] text-zinc-500">
                  {formatBytes(latest.ramUsedBytes)} /{' '}
                  {formatBytes(latest.ramTotalBytes)}
                </div>
              )}
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
              <div className="flex items-center justify-between font-mono text-xs text-zinc-400">
                <span>Disk Usage</span>
                <HardDrive className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                {latest ? `${latest.diskPercent}%` : '—'}
              </div>
            </div>
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
              <div className="font-mono text-xs text-zinc-400">
                Network I/O
              </div>
              <div className="mt-2 font-mono text-sm font-semibold text-zinc-100">
                {latest
                  ? `↓ ${formatBytes(latest.netRxBytesPerSec)}/s`
                  : '—'}
              </div>
              {latest && (
                <div className="font-mono text-xs text-zinc-400">
                  ↑ {formatBytes(latest.netTxBytesPerSec)}/s
                </div>
              )}
            </div>
          </div>

          <div className="rounded border border-white/[0.08] bg-[#09090b] p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-100">
              Historical CPU &amp; RAM Utilization
            </h2>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis dataKey="time" stroke="#71717a" fontSize={10} />
                  <YAxis stroke="#71717a" fontSize={10} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111216',
                      borderColor: 'rgba(255,255,255,0.12)',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ram" name="RAM %" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="disk" name="Disk %" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'docker' && (
        <div className="space-y-3">
          <div className="font-mono text-xs text-zinc-400">
            Docker Engine: {dockerVersion ?? 'Not detected on remote host'}
          </div>
          <div className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b]">
            {containers.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-emerald-400" />
                    <span className="font-mono text-xs font-semibold text-zinc-100">
                      {c.name}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {c.id}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
                    {c.image} · {c.status}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={async () => {
                      await window.surfMonitorAPI?.runDockerAction(
                        server.id,
                        c.id,
                        'start'
                      );
                      await loadAll();
                    }}
                    className="rounded border border-white/[0.1] p-1.5 text-emerald-400 hover:bg-white/[0.05]"
                    title="Start"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        title: `Stop Container ${c.name}?`,
                        desc: 'Stopping this container may interrupt running services.',
                        run: async () => {
                          await window.surfMonitorAPI?.runDockerAction(
                            server.id,
                            c.id,
                            'stop'
                          );
                          await loadAll();
                        },
                      })
                    }
                    className="rounded border border-white/[0.1] p-1.5 text-rose-400 hover:bg-white/[0.05]"
                    title="Stop"
                  >
                    <Square className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        title: `Restart Container ${c.name}?`,
                        desc: 'Restarting will briefly interrupt connections.',
                        run: async () => {
                          await window.surfMonitorAPI?.runDockerAction(
                            server.id,
                            c.id,
                            'restart'
                          );
                          await loadAll();
                        },
                      })
                    }
                    className="rounded border border-white/[0.1] p-1.5 text-amber-400 hover:bg-white/[0.05]"
                    title="Restart"
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await window.surfMonitorAPI?.runDockerAction(
                        server.id,
                        c.id,
                        c.state === 'paused' ? 'unpause' : 'pause'
                      );
                      await loadAll();
                    }}
                    className="rounded border border-white/[0.1] p-1.5 text-zinc-300 hover:bg-white/[0.05]"
                    title={c.state === 'paused' ? 'Unpause' : 'Pause'}
                  >
                    <Pause className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'services' && (
        <div className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b]">
          {services.map((svc) => (
            <div
              key={svc.name}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5 last:border-b-0"
            >
              <div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Terminal className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="font-semibold text-zinc-100">{svc.name}</span>
                  <span
                    className={
                      svc.activeState === 'active'
                        ? 'text-emerald-400'
                        : 'text-zinc-500'
                    }
                  >
                    {svc.activeState}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {svc.description}
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={async () => {
                    await window.surfMonitorAPI?.runRemoteServiceAction(
                      server.id,
                      svc.name,
                      'start'
                    );
                    await loadAll();
                  }}
                  className="rounded border border-white/[0.1] px-2 py-1 text-emerald-400 hover:bg-white/[0.05]"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmAction({
                      title: `Stop Service ${svc.name}?`,
                      desc: 'Stopping a system service may disrupt host functionality.',
                      run: async () => {
                        await window.surfMonitorAPI?.runRemoteServiceAction(
                          server.id,
                          svc.name,
                          'stop'
                        );
                        await loadAll();
                      },
                    })
                  }
                  className="rounded border border-white/[0.1] px-2 py-1 text-rose-400 hover:bg-white/[0.05]"
                >
                  Stop
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmAction({
                      title: `Restart Service ${svc.name}?`,
                      desc: 'Confirm restarting this service.',
                      run: async () => {
                        await window.surfMonitorAPI?.runRemoteServiceAction(
                          server.id,
                          svc.name,
                          'restart'
                        );
                        await loadAll();
                      },
                    })
                  }
                  className="rounded border border-white/[0.1] px-2 py-1 text-amber-400 hover:bg-white/[0.05]"
                >
                  Restart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b] p-4 font-mono text-xs">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="flex justify-between border-b border-white/[0.06] py-2 last:border-b-0"
            >
              <span className="text-zinc-200">
                {log.action} → {log.target}
              </span>
              <span
                className={
                  log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                }
              >
                {log.status}
              </span>
              <span className="text-zinc-500">
                {formatTimestamp(log.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.desc ?? ''}
        confirmLabel="Confirm"
        onConfirm={async () => {
          if (confirmAction) {
            const fn = confirmAction.run;
            setConfirmAction(null);
            await fn();
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

/* ---------------- UNIFIED CONTAINERS & SERVICES VIEWS ---------------- */
export const UnifiedContainersPage: React.FC<{
  servers: RemoteServerDTO[];
  onSelectServer: (id: string) => void;
}> = ({ servers, onSelectServer }) => {
  const [selectedServerId, setSelectedServerId] = useState<string>('all');
  const [rows, setRows] = useState<
    Array<{ server: RemoteServerDTO; container: DockerContainerDTO }>
  >([]);

  useEffect(() => {
    const load = async () => {
      const api = window.surfMonitorAPI;
      if (!api) return;
      const connected = servers.filter((s) => s.connectionStatus === 'connected');
      const all: Array<{
        server: RemoteServerDTO;
        container: DockerContainerDTO;
      }> = [];
      for (const srv of connected) {
        if (selectedServerId !== 'all' && srv.id !== selectedServerId) continue;
        try {
          const res = await api.getDockerContainers(srv.id);
          for (const c of res.containers) {
            all.push({ server: srv, container: c });
          }
        } catch {
          // skip
        }
      }
      setRows(all);
    };
    void load();
  }, [servers, selectedServerId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">
            Docker Containers
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Unified container inventory across connected Linux servers
          </p>
        </div>
        <select
          value={selectedServerId}
          onChange={(e) => setSelectedServerId(e.target.value)}
          className="rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-200"
        >
          <option value="all">All Connected Servers</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded border border-dashed border-white/[0.1] bg-[#09090b] p-12 text-center font-mono text-xs text-zinc-500">
          No Docker containers found on connected servers.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b]">
          {rows.map(({ server, container }) => (
            <div
              key={`${server.id}-${container.id}`}
              onClick={() => onSelectServer(server.id)}
              className="flex cursor-pointer items-center justify-between border-b border-white/[0.06] px-4 py-3 hover:bg-[#0e1015]"
            >
              <div>
                <div className="font-mono text-xs font-semibold text-zinc-100">
                  {container.name}{' '}
                  <span className="text-zinc-500">({server.name})</span>
                </div>
                <div className="font-mono text-[11px] text-zinc-400">
                  {container.image} · {container.status}
                </div>
              </div>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                  container.state === 'running'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/[0.1] bg-white/[0.04] text-zinc-400'
                }`}
              >
                {container.state}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
