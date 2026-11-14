import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  Database,
  Download,
  HardDrive,
  Info,
  User,
  Sparkles,
  Monitor,
  Palette,
  Search,
  Server,
  Shield,
  Sliders,
  Terminal,
  Trash2,
} from 'lucide-react';
import {
  AppSettings,
  CheckIntervalSeconds,
  ElectronAppInfo,
  UserProfileState,
} from '@/types';
import { formatTimestamp } from '@/utils/format';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ThemeStudio } from '@/components/ThemeStudio';
import { SurfTheme } from '@/theme/themeEngine';

interface SettingsProps {
  settings: AppSettings;
  userProfile: UserProfileState | null;
  initialTab?: SettingsTab;
  onUpdateSettings: (next: AppSettings) => void;
  onProfileUpdated: (next: UserProfileState) => void;
  onReplayOnboarding: () => void;
  onResetDefaults: () => void;
  themeStudio?: {
    activeTheme: SurfTheme;
    draftTheme: SurfTheme;
    customThemes: SurfTheme[];
    defaultThemeId: string | null;
    safeMode: boolean;
    onDraftChange: (next: SurfTheme) => void;
    onApplyAndSave: (theme: SurfTheme, makeDefault?: boolean) => Promise<void>;
    onSelectTheme: (theme: SurfTheme) => Promise<void>;
    onDeleteCustomTheme: (id: string) => Promise<void>;
    onCancelDraft: () => void;
  };
}

export type SettingsTab =
  | 'general'
  | 'appearance'
  | 'monitoring'
  | 'notifications'
  | 'servers'
  | 'security'
  | 'profile'
  | 'advanced'
  | 'about';

const CATEGORIES: Array<{
  id: SettingsTab;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'general', label: 'General', keywords: 'startup tray close minimize', icon: Sliders },
  { id: 'appearance', label: 'Appearance', keywords: 'theme dark oled density motion', icon: Palette },
  { id: 'monitoring', label: 'Monitoring', keywords: 'interval timeout retries status codes retention', icon: Activity },
  { id: 'notifications', label: 'Notifications', keywords: 'desktop alerts sound discord telegram email', icon: Bell },
  { id: 'servers', label: 'Servers & Agents', keywords: 'ssh agent polling remote', icon: Server },
  { id: 'security', label: 'Security & Privacy', keywords: 'database backup analytics privacy path', icon: Shield },
  { id: 'profile', label: 'Profile', keywords: 'username greeting personalization account', icon: User },
  { id: 'advanced', label: 'Advanced', keywords: 'diagnostics startup timings export reset', icon: Terminal },
  { id: 'about', label: 'About Surf Monitor', keywords: 'version electron node build', icon: Info },
];

export const Settings: React.FC<SettingsProps> = ({
  settings,
  userProfile,
  initialTab = 'general',
  onUpdateSettings,
  onProfileUpdated,
  onReplayOnboarding,
  onResetDefaults,
  themeStudio,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [usernameInput, setUsernameInput] = useState(userProfile?.username ?? '');
  const [search, setSearch] = useState('');
  const [appInfo, setAppInfo] = useState<ElectronAppInfo | null>(null);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [backups, setBackups] = useState<
    Array<{ id: string; filePath: string; sizeBytes: number; createdAt: string }>
  >([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);


  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (userProfile?.username !== undefined) {
      setUsernameInput(userProfile.username ?? '');
    }
  }, [userProfile?.username]);
  const [confirmResetPrefs, setConfirmResetPrefs] = useState(false);

  useEffect(() => {
    if (window.surfMonitorAPI) {
      void window.surfMonitorAPI.getAppInfo().then(setAppInfo);
      void window.surfMonitorAPI.getBackups().then(setBackups);
      void window.surfMonitorAPI.getStartupTimings().then(setTimings);
    }
  }, []);

  const filteredCategories = CATEGORIES.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.label.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q)
    );
  });

  const handleDesktopToggle = async (
    key: 'launchOnStartup' | 'minimizeToTray',
    value: boolean
  ) => {
    onUpdateSettings({ ...settings, [key]: value });
    await window.surfMonitorAPI?.setDesktopPrefs({ [key]: value });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>
          <p className="font-mono text-xs text-zinc-500">
            Application preferences, licensing, backups, and diagnostics
          </p>
        </div>

        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings..."
            className="w-full rounded border border-white/[0.08] bg-[#101114] py-1.5 pl-8 pr-3 text-xs text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
      </div>

      {statusMsg && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-xs text-emerald-300">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Category Navigation */}
        <nav className="space-y-0.5 rounded border border-white/[0.08] bg-[#09090b] p-2">
          {filteredCategories.map((cat) => {
            const Icon = cat.icon;
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white/[0.08] text-emerald-400'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Settings Panel */}
        <div className="rounded border border-white/[0.08] bg-[#09090b] p-5 lg:col-span-3">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                General &amp; Startup Behavior
              </h2>
              <div className="divide-y divide-white/[0.06]">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">
                      Launch on Windows startup
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Automatically start Surf Monitor when signing into Windows.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.launchOnStartup}
                    onClick={() =>
                      void handleDesktopToggle(
                        'launchOnStartup',
                        !settings.launchOnStartup
                      )
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
                      settings.launchOnStartup
                        ? 'border-emerald-500/40 bg-emerald-600'
                        : 'border-white/[0.1] bg-[#101114]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        settings.launchOnStartup
                          ? 'translate-x-4'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">
                      Minimize / Close to system tray
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Keep monitoring active in the background when closed.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.minimizeToTray}
                    onClick={() =>
                      void handleDesktopToggle(
                        'minimizeToTray',
                        !settings.minimizeToTray
                      )
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
                      settings.minimizeToTray
                        ? 'border-emerald-500/40 bg-emerald-600'
                        : 'border-white/[0.1] bg-[#101114]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        settings.minimizeToTray
                          ? 'translate-x-4'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && themeStudio && (
            <ThemeStudio {...themeStudio} />
          )}

          {activeTab === 'monitoring' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                Monitoring Defaults &amp; Retention
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Default Interval
                  </label>
                  <select
                    value={settings.defaultIntervalSeconds}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        defaultIntervalSeconds: Number(
                          e.target.value
                        ) as CheckIntervalSeconds,
                      })
                    }
                    className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-2 font-mono text-xs text-zinc-100"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Request Timeout
                  </label>
                  <select
                    value={settings.defaultTimeoutSeconds}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        defaultTimeoutSeconds: Number(e.target.value),
                      })
                    }
                    className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-2 font-mono text-xs text-zinc-100"
                  >
                    {[5, 10, 15, 30].map((s) => (
                      <option key={s} value={s}>
                        {s}s
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    History Retention (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={settings.retentionDays}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        retentionDays: Number(e.target.value) || 30,
                      })
                    }
                    className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-2 font-mono text-xs text-zinc-100"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                Desktop &amp; Alert Notifications
              </h2>
              <p className="text-xs text-zinc-400">
                Windows native notifications use application identity{' '}
                <code className="text-emerald-400">Surf Monitor</code> (
                <code className="text-zinc-300">com.surfmonitor.app</code>).
                Manage Discord, Telegram, SMTP Email, and Webhook channels in the
                Notifications tab.
              </p>
            </div>
          )}

          {activeTab === 'servers' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                Servers &amp; Remote Agents
              </h2>
              <p className="text-xs text-zinc-400">
                SSH-tunneled agents bind exclusively to remote{' '}
                <code className="text-emerald-400">127.0.0.1:47200</code> with
                per-server Bearer tokens encrypted via Electron{' '}
                <code className="text-zinc-300">safeStorage</code>.
              </p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-zinc-100">
                Security, Privacy &amp; Backups
              </h2>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const bkp = await window.surfMonitorAPI?.createBackup();
                    if (bkp) {
                      setBackups((p) => [bkp, ...p]);
                      setStatusMsg(`Backup created: ${bkp.filePath}`);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-emerald-500"
                >
                  <HardDrive className="h-3.5 w-3.5" />
                  Create SQLite Backup
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await window.surfMonitorAPI?.cleanupDatabase(
                      settings.retentionDays
                    );
                    if (res) {
                      setStatusMsg(
                        `Pruned ${res.checksDeleted} old checks & ${res.notificationsDeleted} notifications.`
                      );
                    }
                  }}
                  className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Run Retention Cleanup
                </button>
              </div>

              {backups.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto font-mono text-[11px] text-zinc-400">
                  {backups.map((b) => (
                    <div key={b.id} className="flex justify-between">
                      <span className="truncate">{b.filePath}</span>
                      <span>{formatTimestamp(b.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Profile &amp; Personalization
                </h2>
                <p className="font-mono text-[11px] text-zinc-500">
                  Stored locally in SQLite · No account or internet connection required
                </p>
              </div>

              <div className="rounded border border-white/[0.08] bg-[#101114] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">
                    Display Name
                  </span>
                  <span className="rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1 font-mono text-xs text-emerald-400">
                    Preview: Hello, {usernameInput.trim() || userProfile?.username || 'User'}!
                  </span>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!window.surfMonitorAPI) return;
                    try {
                      const next = await window.surfMonitorAPI.setUsername(usernameInput);
                      onProfileUpdated(next);
                      setStatusMsg('Username updated.');
                    } catch (err) {
                      setStatusMsg(err instanceof Error ? err.message : 'Invalid username');
                    }
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    maxLength={32}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Enter your username..."
                    className="min-w-[200px] flex-1 rounded border border-white/[0.1] bg-[#09090b] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded bg-emerald-600 px-3.5 py-1.5 font-mono text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    Save Username
                  </button>
                </form>
              </div>

              <div className="flex items-center justify-between rounded border border-white/[0.08] bg-[#101114] p-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Workspace Appearance
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                    Customize colors, typography, layout density, and custom CSS in Theme Studio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('appearance')}
                  className="rounded border border-white/[0.12] bg-[#09090b] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.05]"
                >
                  Open Theme Studio
                </button>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                Diagnostics &amp; Exports
              </h2>
              <div className="grid grid-cols-2 gap-3 rounded border border-white/[0.08] bg-[#101114] p-4 font-mono text-xs sm:grid-cols-4">
                <div>
                  <div className="text-[10px] text-zinc-500">Config Load</div>
                  <div className="mt-0.5 text-zinc-200">
                    {timings.configMs ?? '—'} ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">SQLite Init</div>
                  <div className="mt-0.5 text-zinc-200">
                    {timings.databaseMs ?? '—'} ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Profile Load</div>
                  <div className="mt-0.5 text-zinc-200">
                    {timings.profileLoadMs ?? '—'} ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Total Startup</div>
                  <div className="mt-0.5 text-emerald-400">
                    {timings.totalStartupMs ?? '—'} ms
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void window.surfMonitorAPI?.exportMonitorsJson()}
                  className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-300"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  Export Monitors (JSON)
                </button>
                <button
                  type="button"
                  onClick={() => void window.surfMonitorAPI?.exportIncidentsCsv()}
                  className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-300"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  Export Incidents (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetPrefs(true)}
                  className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 font-mono text-xs text-rose-400"
                >
                  Reset Preferences
                </button>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                About Surf Monitor
              </h2>
              <div className="grid grid-cols-2 gap-3 rounded border border-white/[0.08] bg-[#101114] p-4 font-mono text-xs sm:grid-cols-3">
                <div>
                  <div className="text-[10px] text-zinc-500">Application</div>
                  <div className="mt-0.5 text-zinc-200">
                    {appInfo?.name ?? 'Surf Monitor'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Version</div>
                  <div className="mt-0.5 text-zinc-200">
                    {appInfo?.version ?? '4.2.2'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Electron</div>
                  <div className="mt-0.5 flex items-center gap-1 text-zinc-300">
                    <Monitor className="h-3 w-3 text-zinc-500" />
                    {appInfo?.electron ?? '33'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Node.js</div>
                  <div className="mt-0.5 text-zinc-300">
                    {appInfo?.node ?? '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-zinc-500">Database Path</div>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-zinc-300">
                    <Database className="h-3 w-3 shrink-0 text-zinc-500" />
                    {appInfo?.dbPath ?? 'userData/surf-monitor.db'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/[0.08] bg-[#101114] p-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Welcome Introduction
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                    Replay the Surf Monitor v4.2.2 feature walkthrough without modifying your data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onReplayOnboarding}
                  className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Replay Introduction
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


      <ConfirmDialog
        isOpen={confirmResetPrefs}
        title="Reset Preferences"
        description="Reset appearance, monitoring defaults, and desktop preferences to defaults? Your monitors, servers, and history will not be deleted."
        confirmLabel="Reset Preferences"
        onConfirm={() => {
          setConfirmResetPrefs(false);
          onResetDefaults();
          setStatusMsg('Preferences reset to defaults.');
        }}
        onCancel={() => setConfirmResetPrefs(false)}
      />
    </div>
  );
};
