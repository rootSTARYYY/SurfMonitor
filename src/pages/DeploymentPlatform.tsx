import React, { useEffect, useState } from 'react';
import {
  Box,
  ExternalLink,
  Layers,
  Play,
  RefreshCw,
  RotateCw,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react';
import { DeploymentTemplateDTO, InstalledAppDTO, RemoteServerDTO } from '@/types';

export const ApplicationManagerPage: React.FC<{
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}> = ({ servers, onNotify }) => {
  const [apps, setApps] = useState<InstalledAppDTO[]>([]);
  const [logsText, setLogsText] = useState<string | null>(null);
  const [logsTitle, setLogsTitle] = useState('');

  const load = async () => {
    const list = await window.surfMonitorAPI?.listInstalledApps();
    if (list) setApps(list);
  };

  useEffect(() => {
    void load();
  }, []);

  const serverName = (id: string) => servers.find((s) => s.id === id)?.name ?? id;

  const runAction = async (app: InstalledAppDTO, action: 'start' | 'stop' | 'restart' | 'logs') => {
    try {
      const res = await window.surfMonitorAPI?.runInstalledAppAction(app.id, action);
      if (!res) return;
      if (action === 'logs') {
        setLogsTitle(`${app.name} Logs`);
        setLogsText(res.stdout || res.stderr || 'No logs returned.');
      } else {
        onNotify(`App ${action}`, res.code === 0 ? 'success' : 'error', app.name);
        await load();
      }
    } catch (err) {
      onNotify('Action failed', 'error', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Application Manager</h1>
          <p className="font-mono text-xs text-zinc-500">
            Track, control, and inspect applications deployed across your servers
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex h-8 items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2.5 font-mono text-xs text-zinc-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-8 text-center font-mono text-xs text-zinc-500">
          No applications registered yet. Deploy software from the Installation Center to manage them here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {apps.map((app) => (
            <div key={app.id} className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-zinc-100">{app.name}</span>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {app.version}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-zinc-500">
                    Server: {serverName(app.serverId)} • Source: {app.source}
                  </div>
                  {app.installDir && (
                    <div className="font-mono text-[10px] text-zinc-500">Dir: {app.installDir}</div>
                  )}
                </div>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
                    app.status === 'running' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-500/20 text-zinc-400'
                  }`}
                >
                  {app.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-3 font-mono text-[11px]">
                {app.url && (
                  <button
                    type="button"
                    onClick={() => void window.surfMonitorAPI?.openExternal(app.url!)}
                    className="flex items-center gap-1 rounded border border-white/[0.1] px-2 py-1 text-zinc-200 hover:bg-white/[0.06]"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </button>
                )}
                {(app.serviceName || app.containerName) && (
                  <>
                    <button
                      type="button"
                      onClick={() => void runAction(app, 'start')}
                      className="flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <Play className="h-3 w-3" /> Start
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(app, 'stop')}
                      className="flex items-center gap-1 rounded border border-amber-500/30 px-2 py-1 text-amber-300 hover:bg-amber-500/10"
                    >
                      <Square className="h-3 w-3" /> Stop
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(app, 'restart')}
                      className="flex items-center gap-1 rounded border border-white/[0.1] px-2 py-1 text-zinc-200 hover:bg-white/[0.06]"
                    >
                      <RotateCw className="h-3 w-3" /> Restart
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(app, 'logs')}
                      className="flex items-center gap-1 rounded border border-white/[0.1] px-2 py-1 text-zinc-200 hover:bg-white/[0.06]"
                    >
                      <Terminal className="h-3 w-3" /> Logs
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await window.surfMonitorAPI?.deleteInstalledApp(app.id);
                    await load();
                  }}
                  className="ml-auto flex items-center gap-1 rounded border border-rose-500/30 px-2 py-1 text-rose-300 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3 w-3" /> Untrack
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {logsText !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-white/[0.12] bg-[#0e1014] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold text-zinc-200">{logsTitle}</h3>
              <button type="button" onClick={() => setLogsText(null)} className="font-mono text-xs text-zinc-400">
                Close
              </button>
            </div>
            <pre className="max-h-[420px] overflow-auto rounded border border-white/[0.08] bg-[#060709] p-3 font-mono text-[11px] text-zinc-300">
              {logsText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export const DeploymentTemplatesPage: React.FC<{
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}> = ({ servers, onNotify }) => {
  const [templates, setTemplates] = useState<DeploymentTemplateDTO[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<DeploymentTemplateDTO | null>(null);
  const [serverId, setServerId] = useState(servers[0]?.id ?? '');
  const [vars, setVars] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    void window.surfMonitorAPI?.listDeploymentTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    if (!serverId && servers.length > 0) setServerId(servers[0].id);
  }, [servers, serverId]);

  const openTpl = (t: DeploymentTemplateDTO) => {
    setSelectedTpl(t);
    const init: Record<string, string> = {};
    for (const v of t.variables) init[v.key] = v.defaultValue;
    setVars(init);
    setApproved(false);
  };

  const deployTemplate = async () => {
    if (!selectedTpl || !serverId || !window.surfMonitorAPI) return;
    try {
      for (const instId of selectedTpl.installerIds) {
        await window.surfMonitorAPI.startInstallationJob({
          installerId: instId,
          serverId,
          mode: 'guided',
          config: vars,
          approvedByUser: approved,
        });
      }
      onNotify('Template queued', 'success', `${selectedTpl.name} installers queued.`);
      setSelectedTpl(null);
    } catch (err) {
      onNotify('Template deployment failed', 'error', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Deployment Templates</h1>
        <p className="font-mono text-xs text-zinc-500">
          Multi-component application stacks with ordered execution and preflight checks
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="flex flex-col justify-between rounded-md border border-white/[0.08] bg-[#09090b] p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">{t.name}</h3>
              </div>
              <p className="text-xs text-zinc-400">{t.description}</p>
              <div className="font-mono text-[10px] text-zinc-500">
                Stack: {t.installerIds.join(' → ')}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="font-mono text-[10px] text-zinc-500">
                Est: {t.estimatedRamMb}MB RAM / {t.estimatedDiskMb}MB Disk
              </span>
              <button
                type="button"
                disabled={servers.length === 0}
                onClick={() => openTpl(t)}
                className="rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                Configure Stack
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/[0.12] bg-[#0e1014] p-5">
            <h3 className="text-base font-semibold text-zinc-100">{selectedTpl.name}</h3>
            <p className="mt-1 font-mono text-[11px] text-zinc-500">{selectedTpl.notes}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[11px] text-zinc-400">Target Server</label>
                <select
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100"
                >
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
                  ))}
                </select>
              </div>
              {selectedTpl.variables.map((v) => (
                <div key={v.key}>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-300">{v.label}</label>
                  <input
                    type={v.secret ? 'password' : 'text'}
                    value={vars[v.key] ?? ''}
                    onChange={(e) => setVars({ ...vars, [v.key]: e.target.value })}
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100"
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 font-mono text-xs text-zinc-200">
                <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="accent-emerald-500" />
                Approve executing all {selectedTpl.installerIds.length} stack components
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelectedTpl(null)} className="rounded border border-white/[0.1] px-3 py-1.5 font-mono text-xs text-zinc-300">
                Cancel
              </button>
              <button
                type="button"
                disabled={!approved}
                onClick={() => void deployTemplate()}
                className="rounded bg-emerald-600 px-4 py-1.5 font-mono text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                Deploy Stack
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
