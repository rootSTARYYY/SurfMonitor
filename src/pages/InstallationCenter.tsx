import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  History,
  Layers,
  PackageCheck,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Square,
  Upload,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  DeploymentPlanDTO,
  InstallationJobDTO,
  InstallerCatalogItem,
  PreflightResultDTO,
  RemoteServerDTO,
  VersionDiscoveryResultDTO,
} from '@/types';

interface InstallationCenterProps {
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'containers', label: 'Containers' },
  { id: 'hosting_panels', label: 'Hosting Panels' },
  { id: 'databases', label: 'Databases' },
  { id: 'web_servers', label: 'Web Servers' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'security', label: 'Security' },
  { id: 'devtools', label: 'Dev Tools' },
];

export const InstallationCenter: React.FC<InstallationCenterProps> = ({ servers, onNotify }) => {
  const [catalog, setCatalog] = useState<InstallerCatalogItem[]>([]);
  const [jobs, setJobs] = useState<InstallationJobDTO[]>([]);
  const [community, setCommunity] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [subTab, setSubTab] = useState<'catalog' | 'history' | 'community'>('catalog');

  const [selectedInstaller, setSelectedInstaller] = useState<InstallerCatalogItem | null>(null);
  const [targetServerId, setTargetServerId] = useState<string>('');
  const [mode, setMode] = useState<'one_click' | 'guided'>('one_click');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [preflight, setPreflight] = useState<PreflightResultDTO | null>(null);
  const [plan, setPlan] = useState<DeploymentPlanDTO | null>(null);
  const [checkingPreflight, setCheckingPreflight] = useState(false);
  const [approved, setApproved] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionDiscoveryResultDTO | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const loadAll = async () => {
    const api = window.surfMonitorAPI;
    if (!api) return;
    const [cat, jList, comm] = await Promise.all([
      api.getInstallerCatalog(),
      api.listInstallationJobs(100),
      api.listCommunityInstallers(),
    ]);
    setCatalog(cat);
    setJobs(jList);
    setCommunity(comm);
  };

  useEffect(() => {
    void loadAll();
    const unsub = window.surfMonitorAPI?.onInstallerJobEvent(() => {
      void window.surfMonitorAPI?.listInstallationJobs(100).then(setJobs);
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!targetServerId && servers.length > 0) {
      setTargetServerId(servers[0].id);
    }
  }, [servers, targetServerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [catalog, search, category]);

  const fetchVersionsFor = async (installerId: string, force = false) => {
    setLoadingVersions(true);
    try {
      const v = await window.surfMonitorAPI?.getInstallerVersions(installerId, force);
      if (v) {
        setVersionInfo(v);
        if (v.latestStable) {
          setConfig((prev) => (prev.selectedVersion ? prev : { ...prev, selectedVersion: v.latestStable!.tag }));
        }
      }
    } finally {
      setLoadingVersions(false);
    }
  };

  const openInstaller = (item: InstallerCatalogItem) => {
    setSelectedInstaller(item);
    setMode(item.supportsOneClick ? 'one_click' : 'guided');
    const defaults: Record<string, unknown> = {};
    for (const f of item.configSchema) {
      if (f.defaultValue !== undefined) defaults[f.key] = f.defaultValue;
    }
    setConfig(defaults);
    setPreflight(null);
    setPlan(null);
    setApproved(false);
    setVersionInfo(null);
    void fetchVersionsFor(item.id, false);
  };

  const handleRunPreflight = async () => {
    if (!selectedInstaller || !targetServerId || !window.surfMonitorAPI) return;
    setCheckingPreflight(true);
    setPreflight(null);
    setPlan(null);
    setApproved(false);
    try {
      const res = await window.surfMonitorAPI.runInstallerPreflight(
        selectedInstaller.id,
        targetServerId,
        config
      );
      setPreflight(res.preflight);
      setPlan(res.plan);
    } catch (err) {
      onNotify('Preflight failed', 'error', err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingPreflight(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedInstaller || !targetServerId || !window.surfMonitorAPI) return;
    try {
      const job = await window.surfMonitorAPI.startInstallationJob({
        installerId: selectedInstaller.id,
        serverId: targetServerId,
        mode,
        config,
        approvedByUser: approved,
      });
      setActiveJobId(job.id);
      setSelectedInstaller(null);
      setSubTab('history');
      onNotify('Installation started', 'success', `${selectedInstaller.name} queued on server.`);
      await loadAll();
    } catch (err) {
      onNotify('Deployment blocked', 'error', err instanceof Error ? err.message : String(err));
    }
  };

  const handleImportCommunity = async () => {
    try {
      const res = await window.surfMonitorAPI?.importCommunityInstaller();
      if (!res) return;
      onNotify('Community package imported', 'warning', res.warnings[0] ?? 'Marked untrusted by default.');
      await loadAll();
    } catch (err) {
      onNotify('Import failed', 'error', err instanceof Error ? err.message : String(err));
    }
  };

  const activeJob = jobs.find((j) => j.id === activeJobId) ?? jobs[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Installation Center
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Guided &amp; one-click software deployment with preflight checks, plan approval, and live verification
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded border border-white/[0.08] bg-[#0e1014] p-0.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setSubTab('catalog')}
              className={`rounded px-2.5 py-1 ${subTab === 'catalog' ? 'bg-white/[0.09] text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              Catalog ({catalog.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('history')}
              className={`rounded px-2.5 py-1 ${subTab === 'history' ? 'bg-white/[0.09] text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              Jobs &amp; Logs ({jobs.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('community')}
              className={`rounded px-2.5 py-1 ${subTab === 'community' ? 'bg-white/[0.09] text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              Community ({community.length})
            </button>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="flex h-8 items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2.5 font-mono text-xs text-zinc-300 hover:bg-white/[0.05]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {subTab === 'catalog' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded border border-white/[0.08] bg-[#09090b] px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search installers (Docker, Pterodactyl, PostgreSQL, Uptime Kuma...)"
                className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    category === c.id
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/[0.08] bg-[#09090b] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {servers.length === 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-xs text-amber-200">
              No SSH servers configured yet. Add a server in Infrastructure → Servers to deploy software.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-md border border-white/[0.08] bg-[#09090b] p-4 transition-colors hover:border-white/[0.16]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{item.name}</h3>
                        <span className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                          {item.version}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                        <span>{item.publisher}</span>
                        <span>•</span>
                        <span
                          className={
                            item.source === 'official' ? 'text-emerald-400' : 'text-amber-400'
                          }
                        >
                          {item.source === 'official' ? 'Official Verified' : 'Community (Untrusted)'}
                        </span>
                      </div>
                    </div>
                    {item.source === 'official' ? (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-zinc-400">{item.description}</p>

                  <div className="flex flex-wrap gap-1.5 font-mono text-[10px] text-zinc-500">
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5">
                      OS: {item.supportedOs.join(', ')}
                    </span>
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5">
                      Min: {item.minRamMb}MB RAM / {item.minDiskMb}MB Disk
                    </span>
                    {item.requiredPorts.length > 0 && (
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5">
                        Ports: {item.requiredPorts.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <select
                    value={item.policy}
                    onChange={async (e) => {
                      await window.surfMonitorAPI?.setInstallerPolicy(item.id, e.target.value);
                      await loadAll();
                    }}
                    className="rounded border border-white/[0.08] bg-[#101114] px-2 py-1 font-mono text-[10px] text-zinc-300"
                    title="Execution approval policy"
                  >
                    <option value="always_review">Policy: Always Review</option>
                    <option value="automatic">Policy: Automatic (Safe)</option>
                  </select>

                  <div className="flex items-center gap-2">
                    {item.docsUrl && (
                      <button
                        type="button"
                        onClick={() => void window.surfMonitorAPI?.openExternal(item.docsUrl!)}
                        className="rounded border border-white/[0.08] p-1.5 text-zinc-400 hover:text-zinc-200"
                        title="Official Documentation"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={servers.length === 0}
                      onClick={() => openInstaller(item)}
                      className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {item.supportsOneClick ? 'Install' : 'Guided Setup'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {subTab === 'history' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2 rounded-md border border-white/[0.08] bg-[#09090b] p-3">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-300">
              <History className="h-3.5 w-3.5 text-emerald-400" />
              Installation Jobs
            </div>
            {jobs.length === 0 ? (
              <p className="py-6 text-center font-mono text-xs text-zinc-500">No installation jobs yet.</p>
            ) : (
              <div className="max-h-[540px] space-y-1.5 overflow-y-auto">
                {jobs.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setActiveJobId(j.id)}
                    className={`w-full rounded border p-2.5 text-left transition-colors ${
                      activeJob?.id === j.id
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-white/[0.06] bg-[#101114] hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-100">{j.installerName}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                          j.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : j.status === 'failed' || j.status === 'cancelled'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {j.status}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-zinc-500">
                      {j.id} • {new Date(j.createdAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-md border border-white/[0.08] bg-[#09090b] p-4">
            {activeJob ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      {activeJob.installerName} — {activeJob.id}
                    </h3>
                    <p className="font-mono text-[11px] text-zinc-500">
                      Status: {activeJob.status} • Mode: {activeJob.mode} • Policy: {activeJob.approvalPolicy}
                    </p>
                  </div>
                  {(activeJob.status === 'installing' || activeJob.status === 'queued') && (
                    <button
                      type="button"
                      onClick={() => void window.surfMonitorAPI?.cancelInstallationJob(activeJob.id)}
                      className="flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-mono text-xs text-rose-300 hover:bg-rose-500/25"
                    >
                      <Square className="h-3 w-3" />
                      Cancel Job
                    </button>
                  )}
                </div>

                {activeJob.errorMessage && (
                  <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 font-mono text-xs text-rose-200">
                    <div className="font-semibold">Failure Details:</div>
                    <div className="mt-1">{activeJob.errorMessage}</div>
                    {activeJob.recoveryInstructions && (
                      <div className="mt-2 text-zinc-300">
                        Recovery Note: {activeJob.recoveryInstructions}
                      </div>
                    )}
                  </div>
                )}

                <pre className="max-h-[460px] overflow-auto rounded border border-white/[0.08] bg-[#060709] p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {activeJob.logs || 'Waiting for logs...'}
                </pre>
              </div>
            ) : (
              <p className="py-16 text-center font-mono text-xs text-zinc-500">
                Select a job to inspect live logs and verification output.
              </p>
            )}
          </div>
        </div>
      )}

      {subTab === 'community' && (
        <div className="space-y-3 rounded-md border border-white/[0.08] bg-[#09090b] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Community Installer Packages</h2>
              <p className="font-mono text-xs text-zinc-500">
                Community packages are SHA-256 verified and marked Untrusted by default. Review manifests before running.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleImportCommunity()}
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-emerald-500"
            >
              <Upload className="h-3.5 w-3.5" />
              Import .json Manifest
            </button>
          </div>

          {community.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-zinc-500">
              No community installer packages imported.
            </p>
          ) : (
            <div className="space-y-2">
              {community.map((c) => (
                <div
                  key={String(c.packageId)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/[0.08] bg-[#101114] p-3"
                >
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">
                      {String(c.name)} <span className="font-mono text-zinc-500">v{String(c.version)}</span>
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      Publisher: {String(c.publisher)} • SHA-256: {String(c.sha256).slice(0, 16)}... • Trust: {String(c.trustStatus)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={async () => {
                        await window.surfMonitorAPI?.setCommunityInstallerTrust(
                          String(c.packageId),
                          c.trustStatus === 'revoked' ? 'untrusted' : 'revoked'
                        );
                        await loadAll();
                      }}
                      className="rounded border border-amber-500/30 px-2 py-1 text-amber-300 hover:bg-amber-500/10"
                    >
                      {c.trustStatus === 'revoked' ? 'Unblock' : 'Revoke'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await window.surfMonitorAPI?.deleteCommunityInstaller(String(c.packageId));
                        await loadAll();
                      }}
                      className="rounded border border-rose-500/30 px-2 py-1 text-rose-300 hover:bg-rose-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guided / One-Click Deployment Modal */}
      {selectedInstaller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/[0.12] bg-[#0e1014] p-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">
                  Deploy {selectedInstaller.name}
                </h2>
                <p className="font-mono text-[11px] text-zinc-500">
                  {selectedInstaller.publisher} • {selectedInstaller.version}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstaller(null)}
                className="font-mono text-xs text-zinc-400 hover:text-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Target Server
                  </label>
                  <select
                    value={targetServerId}
                    onChange={(e) => setTargetServerId(e.target.value)}
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.host})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Installation Mode
                  </label>
                  <div className="flex rounded border border-white/[0.1] bg-[#09090b] p-0.5 font-mono text-xs">
                    {selectedInstaller.supportsOneClick && (
                      <button
                        type="button"
                        onClick={() => setMode('one_click')}
                        className={`flex-1 rounded py-1 ${mode === 'one_click' ? 'bg-emerald-600 text-white' : 'text-zinc-400'}`}
                      >
                        One-Click
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMode('guided')}
                      className={`flex-1 rounded py-1 ${mode === 'guided' ? 'bg-emerald-600 text-white' : 'text-zinc-400'}`}
                    >
                      Guided
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Upstream Version Discovery */}
              <div className="space-y-2 rounded border border-white/[0.08] bg-[#09090b] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-[11px] font-semibold text-zinc-200">
                    Version Selection ({versionInfo?.upstreamSource ?? 'Fetching upstream...'})
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    {versionInfo && (
                      <span className={versionInfo.fromCache ? 'text-amber-300' : 'text-emerald-400'}>
                        {versionInfo.fromCache ? 'Cached' : 'Live'} • {new Date(versionInfo.fetchedAt).toLocaleTimeString()}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={loadingVersions}
                      onClick={() => void fetchVersionsFor(selectedInstaller.id, true)}
                      className="rounded border border-white/[0.1] px-2 py-0.5 text-zinc-300 hover:bg-white/[0.05]"
                    >
                      {loadingVersions ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {versionInfo?.staleReason && (
                  <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 font-mono text-[10px] text-amber-200">
                    {versionInfo.staleReason}
                  </div>
                )}

                {versionInfo && versionInfo.versions.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={String(config.selectedVersion ?? versionInfo.latestStable?.tag ?? '')}
                      onChange={(e) => setConfig({ ...config, selectedVersion: e.target.value })}
                      className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100"
                    >
                      {versionInfo.versions.map((v) => (
                        <option key={v.tag} value={v.tag}>
                          {v.tag} [{v.channel.toUpperCase()}] {v.publishedAt ? `(${v.publishedAt.slice(0, 10)})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                      {versionInfo.latestStable && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                          Stable: {versionInfo.latestStable.tag}
                        </span>
                      )}
                      {versionInfo.latestBeta && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                          Beta: {versionInfo.latestBeta.tag}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {(() => {
                  const sel = versionInfo?.versions.find((v) => v.tag === config.selectedVersion);
                  if (sel && (sel.channel === 'beta' || sel.channel === 'rc')) {
                    return (
                      <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 font-mono text-[11px] text-amber-200">
                        Warning: You selected a pre-release ({sel.tag}). Use Latest Stable for production servers.
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {selectedInstaller.configSchema
                .filter((f) => mode === 'guided' || !f.advancedOnly)
                .map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block font-mono text-[11px] text-zinc-300">
                      {field.label} {field.required && <span className="text-rose-400">*</span>}
                    </label>
                    {field.type === 'boolean' ? (
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={Boolean(config[field.key])}
                          onChange={(e) => setConfig({ ...config, [field.key]: e.target.checked })}
                          className="accent-emerald-500"
                        />
                        <span>{field.description || 'Enabled'}</span>
                      </label>
                    ) : field.type === 'select' ? (
                      <select
                        value={String(config[field.key] ?? field.defaultValue ?? '')}
                        onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                        className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100"
                      >
                        {field.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                        value={String(config[field.key] ?? '')}
                        placeholder={field.placeholder}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                          })
                        }
                        className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100"
                      />
                    )}
                  </div>
                ))}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={checkingPreflight}
                  onClick={() => void handleRunPreflight()}
                  className="flex items-center gap-1.5 rounded border border-white/[0.12] bg-[#14171d] px-3 py-1.5 font-mono text-xs text-zinc-100 hover:bg-white/[0.08]"
                >
                  <Wrench className="h-3.5 w-3.5 text-emerald-400" />
                  {checkingPreflight ? 'Running Preflight...' : 'Run Preflight & Preview Plan'}
                </button>
              </div>

              {preflight && plan && (
                <div className="space-y-3 rounded border border-white/[0.08] bg-[#09090b] p-3.5">
                  <div className="font-mono text-xs font-semibold text-zinc-200">
                    Preflight Checks ({preflight.osName} {preflight.osVersion} • {preflight.arch})
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {preflight.checks.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded border border-white/[0.06] bg-[#101114] px-2.5 py-1.5 font-mono text-[11px]"
                      >
                        <span className="text-zinc-300">{c.label}</span>
                        <span className={`flex items-center gap-1 ${c.passed ? 'text-emerald-400' : c.blocking ? 'text-rose-400' : 'text-amber-400'}`}>
                          {c.passed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {c.actual}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/[0.08] pt-2.5 font-mono text-[11px] text-zinc-400">
                    <div><strong className="text-zinc-200">Packages:</strong> {plan.packages.join(', ')}</div>
                    <div><strong className="text-zinc-200">Services:</strong> {plan.servicesToCreate.join(', ') || 'None'}</div>
                    <div><strong className="text-zinc-200">Ports:</strong> {plan.portsToOpen.join(', ') || 'None'}</div>
                    <div><strong className="text-zinc-200">Rollback:</strong> {plan.rollbackNote}</div>
                  </div>

                  {plan.destructiveWarnings.length > 0 && (
                    <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 font-mono text-[11px] text-amber-200">
                      <AlertTriangle className="mb-1 inline h-3.5 w-3.5" /> {plan.destructiveWarnings.join(' ')}
                    </div>
                  )}

                  <label className="flex items-center gap-2 font-mono text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={approved}
                      onChange={(e) => setApproved(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    I have reviewed the deployment plan and approve executing this installation.
                  </label>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-white/[0.08] pt-3">
              <button
                type="button"
                onClick={() => setSelectedInstaller(null)}
                className="rounded border border-white/[0.1] px-3 py-1.5 font-mono text-xs text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!preflight?.passed || !approved}
                onClick={() => void handleDeploy()}
                className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-1.5 font-mono text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                Execute Deployment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
