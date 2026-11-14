import React, { useState } from 'react';
import {
  FolderKanban,
  GitFork,
  Layers,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Monitor,
  MonitorGroupDTO,
  ServiceHealthDTO,
  ServicesOverviewPayload,
} from '@/types';

/* ---------------- MONITOR GROUPS PAGE ---------------- */
interface GroupsPageProps {
  groups: MonitorGroupDTO[];
  monitors: Monitor[];
  onRefresh: () => void;
  onSelectMonitor: (id: string) => void;
}

export const GroupsPage: React.FC<GroupsPageProps> = ({
  groups,
  monitors,
  onRefresh,
  onSelectMonitor,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#10b981');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !window.surfMonitorAPI) return;
    await window.surfMonitorAPI.createGroup({
      name: name.trim(),
      description: description.trim(),
      color,
    });
    setName('');
    setDescription('');
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!window.surfMonitorAPI) return;
    await window.surfMonitorAPI.deleteGroup(id);
    onRefresh();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Monitor Groups</h1>
        <p className="font-mono text-xs text-zinc-500">
          Organize monitors by environment, platform, or team
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded border border-white/[0.08] bg-[#09090b] p-4"
      >
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block font-mono text-[11px] text-zinc-400">
            Group Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. LunarX Infrastructure"
            className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block font-mono text-[11px] text-zinc-400">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Production services & APIs"
            className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[11px] text-zinc-400">
            Color
          </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-white/[0.1] bg-[#101114] p-0.5"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create Group</span>
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((grp) => {
          const members = monitors.filter((m) => m.groupId === grp.id);
          const up = members.filter((m) => m.status === 'UP').length;
          return (
            <div
              key={grp.id}
              className="rounded border border-white/[0.08] bg-[#09090b] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: grp.color }}
                  />
                  <FolderKanban className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-100">
                    {grp.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(grp.id)}
                  className="rounded p-1 text-zinc-500 hover:text-rose-400"
                  title="Delete group (monitors are preserved)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {grp.description && (
                <p className="mt-1 text-xs text-zinc-500">{grp.description}</p>
              )}
              <div className="mt-3 font-mono text-[11px] text-zinc-400">
                {members.length} monitors · {up} UP
              </div>
              <div className="mt-2 space-y-1">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMonitor(m.id)}
                    className="flex w-full items-center justify-between rounded bg-[#101114] px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 hover:bg-white/[0.05]"
                  >
                    <span className="truncate">{m.name}</span>
                    <span
                      className={
                        m.status === 'UP'
                          ? 'text-emerald-400'
                          : m.status === 'DEGRADED'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }
                    >
                      {m.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------------- SERVICES PAGE ---------------- */
interface ServicesPageProps {
  overview: ServicesOverviewPayload | null;
  monitors: Monitor[];
  onRefresh: () => void;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({
  overview,
  monitors,
  onRefresh,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedMonitor, setSelectedMonitor] = useState('');
  const [depFrom, setDepFrom] = useState('');
  const [depTo, setDepTo] = useState('');
  const [depError, setDepError] = useState<string | null>(null);

  const services = overview?.services ?? [];

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !window.surfMonitorAPI) return;
    await window.surfMonitorAPI.createService({
      name: name.trim(),
      description: description.trim(),
    });
    setName('');
    setDescription('');
    onRefresh();
  };

  const handleLinkMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedMonitor || !window.surfMonitorAPI) return;
    await window.surfMonitorAPI.linkServiceMonitor(
      selectedService,
      selectedMonitor,
      true
    );
    onRefresh();
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depFrom || !depTo || !window.surfMonitorAPI) return;
    setDepError(null);
    try {
      await window.surfMonitorAPI.addServiceDependency(depFrom, depTo, true);
      onRefresh();
    } catch (err) {
      setDepError(
        err instanceof Error ? err.message : 'Failed to add dependency'
      );
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">
          Services &amp; Components
        </h1>
        <p className="font-mono text-xs text-zinc-500">
          Logical application health computed from component monitors &amp; upstream dependencies
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <form
          onSubmit={handleCreateService}
          className="space-y-3 rounded border border-white/[0.08] bg-[#09090b] p-4"
        >
          <div className="text-xs font-semibold text-zinc-200">New Service</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. LunarX API"
            className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Backend REST service"
            className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Create Service
          </button>
        </form>

        <form
          onSubmit={handleLinkMonitor}
          className="space-y-3 rounded border border-white/[0.08] bg-[#09090b] p-4"
        >
          <div className="text-xs font-semibold text-zinc-200">
            Attach Monitor to Service
          </div>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
          >
            <option value="">Select service...</option>
            {services.map((s) => (
              <option key={s.serviceId} value={s.serviceId}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={selectedMonitor}
            onChange={(e) => setSelectedMonitor(e.target.value)}
            className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
          >
            <option value="">Select monitor...</option>
            {monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full rounded border border-white/[0.12] bg-[#101114] py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.05]"
          >
            Link Component
          </button>
        </form>

        <form
          onSubmit={handleAddDependency}
          className="space-y-3 rounded border border-white/[0.08] bg-[#09090b] p-4"
        >
          <div className="text-xs font-semibold text-zinc-200">
            Add Service Dependency
          </div>
          {depError && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 font-mono text-[11px] text-rose-400">
              {depError}
            </div>
          )}
          <select
            value={depFrom}
            onChange={(e) => setDepFrom(e.target.value)}
            className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
          >
            <option value="">Service...</option>
            {services.map((s) => (
              <option key={s.serviceId} value={s.serviceId}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={depTo}
            onChange={(e) => setDepTo(e.target.value)}
            className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
          >
            <option value="">Depends on...</option>
            {services.map((s) => (
              <option key={s.serviceId} value={s.serviceId}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full rounded border border-white/[0.12] bg-[#101114] py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.05]"
          >
            Add Dependency
          </button>
        </form>
      </div>

      {/* Service Health Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((svc: ServiceHealthDTO) => (
          <div
            key={svc.serviceId}
            className="rounded border border-white/[0.08] bg-[#09090b] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-100">
                  {svc.name}
                </span>
              </div>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                  svc.health === 'UP'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                    : svc.health === 'DEGRADED'
                      ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                      : svc.health === 'DOWN'
                        ? 'border-rose-500/25 bg-rose-500/10 text-rose-400'
                        : 'border-white/[0.1] bg-white/[0.04] text-zinc-400'
                }`}
              >
                {svc.health}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {svc.description || `${svc.componentCount} linked monitors`}
            </p>
            {svc.derivedFromDependency && (
              <div className="mt-2 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-mono text-[10px] text-amber-300">
                Derived from upstream dependency failure
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------- DEPENDENCY MAP PAGE ---------------- */
interface DependencyMapProps {
  overview: ServicesOverviewPayload | null;
}

export const DependencyMapPage: React.FC<DependencyMapProps> = ({
  overview,
}) => {
  const [zoom, setZoom] = useState(1);
  const services = overview?.services ?? [];
  const deps = overview?.dependencies ?? [];

  const positions = services.map((s, idx) => ({
    ...s,
    x: 120 + (idx % 3) * 260,
    y: 80 + Math.floor(idx / 3) * 140,
  }));
  const posMap = new Map(positions.map((p) => [p.serviceId, p]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">
            Dependency Map
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Interactive service dependency graph &amp; root-cause highlighting
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="rounded border border-white/[0.1] bg-[#101114] p-1.5 text-zinc-300 hover:bg-white/[0.05]"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="font-mono text-xs text-zinc-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
            className="rounded border border-white/[0.1] bg-[#101114] p-1.5 text-zinc-300 hover:bg-white/[0.05]"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded border border-dashed border-white/[0.1] bg-[#09090b] text-center">
          <GitFork className="h-6 w-6 text-zinc-500" />
          <p className="mt-2 font-mono text-xs text-zinc-400">
            Create services and dependencies in the Services tab to visualize your topology.
          </p>
        </div>
      ) : (
        <div className="h-[460px] overflow-auto rounded border border-white/[0.08] bg-[#09090b] p-4">
          <svg
            width={900 * zoom}
            height={500 * zoom}
            viewBox="0 0 900 500"
            className="mx-auto"
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#52525b" />
              </marker>
            </defs>

            {deps.map((d) => {
              const from = posMap.get(d.serviceId);
              const to = posMap.get(d.dependsOnServiceId);
              if (!from || !to) return null;
              return (
                <line
                  key={d.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={d.isCritical ? '#f59e0b' : '#52525b'}
                  strokeWidth={1.75}
                  strokeDasharray={d.isCritical ? undefined : '4 4'}
                  markerEnd="url(#arrow)"
                />
              );
            })}

            {positions.map((node) => {
              const stroke =
                node.health === 'UP'
                  ? '#10b981'
                  : node.health === 'DEGRADED'
                    ? '#f59e0b'
                    : node.health === 'DOWN'
                      ? '#ef4444'
                      : '#52525b';
              return (
                <g
                  key={node.serviceId}
                  transform={`translate(${node.x - 85}, ${node.y - 28})`}
                >
                  <rect
                    width="170"
                    height="56"
                    rx="4"
                    fill="#111216"
                    stroke={stroke}
                    strokeWidth="1.5"
                  />
                  <text
                    x="12"
                    y="23"
                    fill="#f4f4f5"
                    fontSize="12"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {node.name.slice(0, 20)}
                  </text>
                  <text
                    x="12"
                    y="42"
                    fill={stroke}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {node.health} · {node.componentCount} comp
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
