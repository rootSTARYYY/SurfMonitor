import React, { useEffect, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Zap,
} from 'lucide-react';
import { AutomationRuleDTO, BackupScheduleDTO, RemoteServerDTO, ServerBackupDTO } from '@/types';

export const BackupCenterPage: React.FC<{
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}> = ({ servers, onNotify }) => {
  const [backups, setBackups] = useState<ServerBackupDTO[]>([]);
  const [schedules, setSchedules] = useState<BackupScheduleDTO[]>([]);
  const [serverId, setServerId] = useState(servers[0]?.id ?? '');
  const [backupType, setBackupType] = useState('files');
  const [targetPath, setTargetPath] = useState('/etc/nginx');
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ServerBackupDTO | null>(null);

  const load = async () => {
    const api = window.surfMonitorAPI;
    if (!api) return;
    const [bList, sList] = await Promise.all([api.listServerBackups(), api.listBackupSchedules()]);
    setBackups(bList);
    setSchedules(sList);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!serverId && servers.length > 0) setServerId(servers[0].id);
  }, [servers, serverId]);

  const handleCreateBackup = async () => {
    if (!serverId || !targetPath.trim()) return;
    setCreating(true);
    try {
      const b = await window.surfMonitorAPI?.createServerBackup({
        serverId,
        backupType,
        targetPath: targetPath.trim(),
        retentionDays: 30,
      });
      onNotify(
        b?.verified ? 'Backup created & verified' : 'Backup created (unverified)',
        b?.verified ? 'success' : 'warning',
        b?.archivePath
      );
      await load();
    } catch (err) {
      onNotify('Backup failed', 'error', err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Backup &amp; Recovery Center</h1>
          <p className="font-mono text-xs text-zinc-500">
            Create verified remote archives, manage retention schedules, and safely restore server files
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex h-8 items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2.5 font-mono text-xs text-zinc-300"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
        <div className="mb-3 font-mono text-xs font-semibold text-zinc-200">Create Manual Server Backup</div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={backupType}
            onChange={(e) => setBackupType(e.target.value)}
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100"
          >
            <option value="files">Server Files / Directory</option>
            <option value="config">App Configuration</option>
            <option value="docker_volume">Docker Volume Path</option>
          </select>
          <input
            type="text"
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
            placeholder="/var/www/pterodactyl"
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100"
          />
          <button
            type="button"
            disabled={creating || servers.length === 0}
            onClick={() => void handleCreateBackup()}
            className="flex items-center justify-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            <Archive className="h-3.5 w-3.5" />
            {creating ? 'Archiving...' : 'Run Backup'}
          </button>
        </div>
      </div>

      <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-xs font-semibold text-zinc-200">Backup History ({backups.length})</span>
          <span className="font-mono text-[10px] text-zinc-500">Schedules active: {schedules.length}</span>
        </div>
        {backups.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-zinc-500">No server backups recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/[0.07] bg-[#101114] p-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-100">
                    <span>{b.targetPath}</span>
                    {b.verified ? (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                        Unverified
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-zinc-500">
                    Archive: {b.archivePath} • {(b.sizeBytes / 1024).toFixed(1)} KB • {new Date(b.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setRestoreTarget(b)}
                    className="flex items-center gap-1 rounded border border-amber-500/30 px-2.5 py-1 text-amber-300 hover:bg-amber-500/10"
                  >
                    <RotateCcw className="h-3 w-3" /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await window.surfMonitorAPI?.deleteServerBackup(b.id);
                      await load();
                    }}
                    className="rounded border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-[#0e1014] p-5">
            <div className="flex items-center gap-2 text-amber-300">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Confirm Destructive Restore</h3>
            </div>
            <p className="mt-2 text-xs text-zinc-300">
              Restoring <code className="text-zinc-100">{restoreTarget.archivePath}</code> will overwrite existing files at{' '}
              <code className="text-zinc-100">{restoreTarget.targetPath}</code>.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRestoreTarget(null)} className="rounded border border-white/[0.1] px-3 py-1.5 font-mono text-xs text-zinc-300">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await window.surfMonitorAPI?.restoreServerBackup(restoreTarget.id);
                    onNotify('Backup restored', 'success', restoreTarget.targetPath);
                  } catch (err) {
                    onNotify('Restore failed', 'error', err instanceof Error ? err.message : String(err));
                  } finally {
                    setRestoreTarget(null);
                  }
                }}
                className="rounded bg-amber-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-amber-500"
              >
                Approve &amp; Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AutomationCenterPage: React.FC<{
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}> = ({ servers, onNotify }) => {
  const [rules, setRules] = useState<AutomationRuleDTO[]>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState('');
  const [serverId, setServerId] = useState(servers[0]?.id ?? '');
  const [actionType, setActionType] = useState('restart_pm2');
  const [targetVal, setTargetVal] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(60);

  const load = async () => {
    const api = window.surfMonitorAPI;
    if (!api) return;
    const [rList, hList] = await Promise.all([api.listAutomationRules(), api.listAutomationExecutions()]);
    setRules(rList);
    setHistory(hList);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!serverId && servers.length > 0) setServerId(servers[0].id);
  }, [servers, serverId]);

  const handleSave = async () => {
    if (!name.trim() || !serverId || !targetVal.trim()) return;
    const actionConfig =
      actionType === 'restart_pm2'
        ? { processName: targetVal.trim() }
        : actionType === 'restart_docker'
          ? { containerName: targetVal.trim() }
          : { command: targetVal.trim() };
    await window.surfMonitorAPI?.saveAutomationRule({
      id: `rule-${Date.now()}`,
      name: name.trim(),
      description: `${actionType}: ${targetVal.trim()}`,
      serverId,
      triggerType: 'interval',
      conditionJson: JSON.stringify({ intervalMinutes }),
      actionType,
      actionConfigJson: JSON.stringify(actionConfig),
      cooldownSeconds: 300,
      maxRetries: 3,
      enabled: true,
    });
    setName('');
    setTargetVal('');
    onNotify('Automation rule saved', 'success');
    await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Automation Center</h1>
        <p className="font-mono text-xs text-zinc-500">
          Rule-based server operations with cooldown &amp; retry-loop protection
        </p>
      </div>

      <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
        <div className="mb-3 font-mono text-xs font-semibold text-zinc-200">New Automation Rule</div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rule name"
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100"
          />
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100"
          >
            <option value="restart_pm2">Restart PM2 Process</option>
            <option value="restart_docker">Restart Docker Container</option>
            <option value="run_command">Run Maintenance Command</option>
          </select>
          <input
            type="text"
            value={targetVal}
            onChange={(e) => setTargetVal(e.target.value)}
            placeholder={actionType === 'run_command' ? 'Command' : 'Process / Container name'}
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={5}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              className="w-20 rounded border border-white/[0.1] bg-[#101114] px-2 py-1.5 font-mono text-xs text-zinc-100"
              title="Interval (minutes)"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
          <div className="mb-3 flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-200">
            <Zap className="h-3.5 w-3.5 text-emerald-400" /> Active Rules ({rules.length})
          </div>
          {rules.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-zinc-500">No automation rules configured.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border border-white/[0.07] bg-[#101114] p-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-100">{r.name}</div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      {r.description} • Cooldown {r.cooldownSeconds}s • Last: {r.lastStatus ?? 'never'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await window.surfMonitorAPI?.runAutomationRuleNow(r.id);
                        onNotify(res?.ok ? 'Rule executed' : 'Rule failed', res?.ok ? 'success' : 'error', res?.output);
                        await load();
                      }}
                      className="flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 font-mono text-[10px] text-emerald-300"
                    >
                      <Play className="h-3 w-3" /> Run Now
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await window.surfMonitorAPI?.deleteAutomationRule(r.id);
                        await load();
                      }}
                      className="rounded border border-rose-500/30 p-1 text-rose-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
          <div className="mb-3 flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-200">
            <Clock className="h-3.5 w-3.5 text-zinc-400" /> Execution History
          </div>
          {history.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-zinc-500">No automation runs yet.</p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {history.map((h) => (
                <div key={String(h.id)} className="rounded border border-white/[0.06] bg-[#101114] p-2 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className={h.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>
                      {String(h.status).toUpperCase()}
                    </span>
                    <span className="text-zinc-500">{new Date(String(h.executedAt)).toLocaleTimeString()}</span>
                  </div>
                  {(h.errorMessage || h.output) && (
                    <div className="mt-1 truncate text-zinc-400">{String(h.errorMessage || h.output)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
