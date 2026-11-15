import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Columns2,
  Download,
  Edit3,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Rows2,
  Save,
  Search,
  Server,
  Sliders,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { RemoteServerDTO, SavedCommandDTO, ServerGroupDTO, SftpEntryDTO } from '@/types';
import { FileBrowserSkeleton, TerminalLoadingState } from '@/components/Skeleton';
import {
  DEFAULT_TERMINAL_CONFIG,
  TerminalAppearanceConfig,
  XtermPane,
} from '@/components/XtermPane';

interface TerminalSessionTab {
  sessionId: string;
  serverId: string;
  label: string;
  host: string;
  username: string;
  connected: boolean;
  connectedAt: number;
  clearCounter: number;
}

const TERM_CFG_KEY = 'surf_terminal_config_v5';

export const TerminalPage: React.FC<{
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}> = ({ servers, onNotify }) => {
  const [tabs, setTabs] = useState<TerminalSessionTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [secondaryTabId, setSecondaryTabId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const [selectedServerId, setSelectedServerId] = useState(servers[0]?.id ?? '');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [connecting, setConnecting] = useState(false);
  const [termConfig, setTermConfig] = useState<TerminalAppearanceConfig>(() => {
    try {
      const raw = localStorage.getItem(TERM_CFG_KEY);
      return raw ? { ...DEFAULT_TERMINAL_CONFIG, ...JSON.parse(raw) } : DEFAULT_TERMINAL_CONFIG;
    } catch {
      return DEFAULT_TERMINAL_CONFIG;
    }
  });

  const writersRef = useRef<Map<string, (chunk: string) => void>>(new Map());
  const tabsRef = useRef<TerminalSessionTab[]>([]);
  tabsRef.current = tabs;

  useEffect(() => {
    return () => {
      for (const t of tabsRef.current) {
        void window.surfMonitorAPI?.closeTerminalSession(t.sessionId);
      }
    };
  }, []);
  const pendingBufferRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    try {
      localStorage.setItem(TERM_CFG_KEY, JSON.stringify(termConfig));
    } catch {}
  }, [termConfig]);

  useEffect(() => {
    if (!selectedServerId && servers.length > 0) setSelectedServerId(servers[0].id);
  }, [servers, selectedServerId]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const api = window.surfMonitorAPI;
    if (!api) return;
    const unsubData = api.onTerminalData(({ sessionId, data }) => {
      const writer = writersRef.current.get(sessionId);
      if (writer) {
        writer(data);
      } else {
        const prev = pendingBufferRef.current.get(sessionId) ?? '';
        pendingBufferRef.current.set(sessionId, (prev + data).slice(-60_000));
      }
    });
    const unsubExit = api.onTerminalExit(({ sessionId, code }) => {
      writersRef.current.get(sessionId)?.(`\r\n\x1b[33m[Session closed${code !== undefined ? ` (exit ${code})` : ''}]\x1b[0m\r\n`);
      setTabs((prev) =>
        prev.map((t) => (t.sessionId === sessionId ? { ...t, connected: false } : t))
      );
    });
    return () => {
      unsubData();
      unsubExit();
    };
  }, []);

  const registerOutputWriter = (sessionId: string, writeFn: (chunk: string) => void) => {
    writersRef.current.set(sessionId, writeFn);
    const buffered = pendingBufferRef.current.get(sessionId);
    if (buffered) {
      writeFn(buffered);
      pendingBufferRef.current.delete(sessionId);
    }
    return () => {
      writersRef.current.delete(sessionId);
    };
  };

  const openNewTab = async (serverIdOverride?: string) => {
    const sid = serverIdOverride || selectedServerId;
    if (!sid || !window.surfMonitorAPI) return;
    const srv = servers.find((s) => s.id === sid);
    const sessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setConnecting(true);
    try {
      await window.surfMonitorAPI.openTerminalSession(sessionId, sid, 120, 34);
      const newTab: TerminalSessionTab = {
        sessionId,
        serverId: sid,
        label: srv?.name ?? sid,
        host: srv?.host ?? '',
        username: srv?.username ?? 'root',
        connected: true,
        connectedAt: Date.now(),
        clearCounter: 0,
      };
      setTabs((prev) => [...prev, newTab]);
      if (!activeTabId) {
        setActiveTabId(sessionId);
      } else if (splitMode !== 'none' && !secondaryTabId) {
        setSecondaryTabId(sessionId);
      } else {
        setActiveTabId(sessionId);
      }
    } catch (err) {
      onNotify('SSH Terminal failed', 'error', err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  const reconnectTab = async (tab: TerminalSessionTab) => {
    if (!window.surfMonitorAPI) return;
    try {
      await window.surfMonitorAPI.closeTerminalSession(tab.sessionId);
      await window.surfMonitorAPI.openTerminalSession(tab.sessionId, tab.serverId, 120, 34);
      setTabs((prev) =>
        prev.map((t) => (t.sessionId === tab.sessionId ? { ...t, connected: true, connectedAt: Date.now() } : t))
      );
      onNotify('Reconnected', 'success', tab.label);
    } catch (err) {
      onNotify('Reconnect failed', 'error', err instanceof Error ? err.message : String(err));
    }
  };

  const activeTab = tabs.find((t) => t.sessionId === activeTabId) ?? null;
  const secondaryTab = tabs.find((t) => t.sessionId === secondaryTabId) ?? null;

  const formatDuration = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
  };

  return (
    <div
      className={`flex flex-col space-y-2.5 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#09090b] p-4' : 'h-[calc(100vh-110px)]'
      }`}
    >
      {/* Professional Terminal Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-[#0e1014] px-3 py-2">
        <div className="flex items-center gap-2">
          <select
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1 text-xs text-zinc-100"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.username}@{s.host})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={servers.length === 0}
            onClick={() => void openNewTab()}
            className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 font-mono text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> New Tab
          </button>

          {activeTab && (
            <span className="hidden items-center gap-2 font-mono text-[11px] text-zinc-400 md:flex">
              <span className={`h-2 w-2 rounded-full ${activeTab.connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span>{activeTab.username}@{activeTab.host}</span>
              <span className="text-zinc-600">•</span>
              <span>{activeTab.connected ? formatDuration(nowTick - activeTab.connectedAt) : 'Disconnected'}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => {
              const next = splitMode === 'none' ? 'horizontal' : splitMode === 'horizontal' ? 'vertical' : 'none';
              setSplitMode(next);
              if (next !== 'none' && tabs.length >= 2 && !secondaryTabId) {
                const other = tabs.find((t) => t.sessionId !== activeTabId);
                if (other) setSecondaryTabId(other.sessionId);
              }
            }}
            className={`flex items-center gap-1 rounded border px-2 py-1 ${
              splitMode !== 'none' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/[0.08] text-zinc-300 hover:bg-white/[0.05]'
            }`}
            title="Cycle Split Panes (None / Side-by-Side / Stacked)"
          >
            {splitMode === 'vertical' ? <Rows2 className="h-3.5 w-3.5" /> : <Columns2 className="h-3.5 w-3.5" />}
            <span>{splitMode === 'none' ? 'Split' : splitMode}</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            className="flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-zinc-300 hover:bg-white/[0.05]"
          >
            <Search className="h-3.5 w-3.5" /> Search
          </button>

          {activeTab && (
            <>
              <button
                type="button"
                onClick={() =>
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.sessionId === activeTab.sessionId ? { ...t, clearCounter: t.clearCounter + 1 } : t
                    )
                  )
                }
                className="rounded border border-white/[0.08] px-2 py-1 text-zinc-300 hover:bg-white/[0.05]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={async () => {
                  await window.surfMonitorAPI?.closeTerminalSession(activeTab.sessionId);
                  setTabs((prev) => prev.filter((x) => x.sessionId !== activeTab.sessionId));
                  setActiveTabId(null);
                  onNotify('Disconnected', 'info', activeTab.label);
                }}
                className="rounded border border-rose-500/30 px-2 py-1 text-rose-300 hover:bg-rose-500/10"
              >
                Disconnect
              </button>
              <button
                type="button"
                onClick={() => void reconnectTab(activeTab)}
                className="flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-zinc-300 hover:bg-white/[0.05]"
              >
                <RotateCw className="h-3 w-3" /> Reconnect
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className="flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-zinc-300 hover:bg-white/[0.05]"
          >
            <Sliders className="h-3.5 w-3.5" /> Settings
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="rounded border border-white/[0.08] p-1 text-zinc-300 hover:bg-white/[0.05]"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 rounded border border-white/[0.08] bg-[#0e1014] px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search terminal scrollback..."
            className="flex-1 bg-transparent font-mono text-xs text-zinc-100 focus:outline-none"
          />
          <button type="button" onClick={() => setSearchOpen(false)} className="text-zinc-500 hover:text-zinc-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {settingsOpen && (
        <div className="grid grid-cols-2 gap-3 rounded border border-white/[0.1] bg-[#0e1014] p-3 font-mono text-xs sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-[10px] text-zinc-400">Font Family</label>
            <input
              type="text"
              value={termConfig.fontFamily}
              onChange={(e) => setTermConfig({ ...termConfig, fontFamily: e.target.value })}
              className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-1 text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-400">Font Size</label>
            <input
              type="number"
              min={10}
              max={24}
              value={termConfig.fontSize}
              onChange={(e) => setTermConfig({ ...termConfig, fontSize: Number(e.target.value) || 13 })}
              className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-1 text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-400">Cursor Style</label>
            <select
              value={termConfig.cursorStyle}
              onChange={(e) => setTermConfig({ ...termConfig, cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })}
              className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-1 text-zinc-100"
            >
              <option value="block">Block</option>
              <option value="underline">Underline</option>
              <option value="bar">Bar</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-400">Scrollback</label>
            <input
              type="number"
              min={500}
              max={50000}
              value={termConfig.scrollback}
              onChange={(e) => setTermConfig({ ...termConfig, scrollback: Number(e.target.value) || 5000 })}
              className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-1 text-zinc-100"
            />
          </div>
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={termConfig.copyOnSelect}
              onChange={(e) => setTermConfig({ ...termConfig, copyOnSelect: e.target.checked })}
              className="accent-emerald-500"
            />
            Copy on Select
          </label>
        </div>
      )}

      {/* Session Tabs */}
      {tabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <div
              key={t.sessionId}
              className={`flex items-center gap-2 rounded border px-2.5 py-1 font-mono text-xs ${
                activeTabId === t.sessionId
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/[0.08] bg-[#101114] text-zinc-400'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTabId(t.sessionId)}
                onDoubleClick={() => {
                  const renamed = window.prompt('Rename terminal tab:', t.label);
                  if (renamed?.trim()) {
                    setTabs((prev) =>
                      prev.map((x) => (x.sessionId === t.sessionId ? { ...x, label: renamed.trim() } : x))
                    );
                  }
                }}
                className="flex items-center gap-1.5"
                title="Double-click to rename tab"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${t.connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <TerminalIcon className="h-3 w-3" />
                <span>{t.label}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await window.surfMonitorAPI?.closeTerminalSession(t.sessionId);
                  setTabs((prev) => prev.filter((x) => x.sessionId !== t.sessionId));
                  if (activeTabId === t.sessionId) setActiveTabId(null);
                  if (secondaryTabId === t.sessionId) setSecondaryTabId(null);
                }}
              >
                <X className="h-3 w-3 hover:text-rose-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Terminal Viewport */}
      {connecting ? (
        <TerminalLoadingState />
      ) : activeTab ? (
        <div
          className={`grid min-h-0 flex-1 gap-2 ${
            splitMode === 'horizontal'
              ? 'grid-cols-2'
              : splitMode === 'vertical'
                ? 'grid-rows-2'
                : 'grid-cols-1'
          }`}
        >
          <XtermPane
            key={activeTab.sessionId}
            sessionId={activeTab.sessionId}
            config={termConfig}
            searchQuery={searchQuery}
            clearSignal={activeTab.clearCounter}
            onDataSend={(d) => void window.surfMonitorAPI?.writeTerminalSession(activeTab.sessionId, d)}
            onResizeSend={(c, r) => void window.surfMonitorAPI?.resizeTerminalSession(activeTab.sessionId, c, r)}
            registerOutputWriter={registerOutputWriter}
          />
          {splitMode !== 'none' && secondaryTab && secondaryTab.sessionId !== activeTab.sessionId && (
            <XtermPane
              key={secondaryTab.sessionId}
              sessionId={secondaryTab.sessionId}
              config={termConfig}
              searchQuery={searchQuery}
              clearSignal={secondaryTab.clearCounter}
              onDataSend={(d) => void window.surfMonitorAPI?.writeTerminalSession(secondaryTab.sessionId, d)}
              onResizeSend={(c, r) => void window.surfMonitorAPI?.resizeTerminalSession(secondaryTab.sessionId, c, r)}
              registerOutputWriter={registerOutputWriter}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-white/[0.08] bg-[#09090b] p-12 text-center font-mono text-xs text-zinc-500">
          <TerminalIcon className="mb-3 h-8 w-8 text-emerald-400/70" />
          <p>Select a server and click <strong>New Tab</strong> to open a live interactive xterm.js PTY session.</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Supports nano, vim, htop, ANSI 256 colors, UTF-8 box-drawing, Ctrl+C, split panes, and right-click copy/paste.
          </p>
        </div>
      )}
    </div>
  );
};

export const SftpPage: React.FC<{
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}> = ({ servers, onNotify }) => {
  const [serverId, setServerId] = useState(servers[0]?.id ?? '');
  const [cwd, setCwd] = useState('/');
  const [entries, setEntries] = useState<SftpEntryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [transfers, setTransfers] = useState<Array<{ id: string; direction: 'upload' | 'download'; name: string; status: string }>>([]);

  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingOriginalMtime, setEditingOriginalMtime] = useState<number>(0);
  const [editingContent, setEditingContent] = useState('');
  const [editingDirty, setEditingDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SftpEntryDTO[] | null>(null);

  const dirCacheRef = useRef<Map<string, { entries: SftpEntryDTO[]; ts: number }>>(new Map());
  const PAGE_SIZE = 150;

  useEffect(() => {
    if (!serverId && servers.length > 0) setServerId(servers[0].id);
  }, [servers, serverId]);

  const invalidateCache = (dir = cwd) => {
    dirCacheRef.current.delete(`${serverId}:${dir}`);
  };

  const loadDir = async (dir = cwd, forceRefresh = false) => {
    if (!serverId || !window.surfMonitorAPI) return;
    const cacheKey = `${serverId}:${dir}`;
    const cached = dirCacheRef.current.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.ts < 30_000) {
      setEntries(cached.entries);
      setCwd(dir);
      setPage(0);
      return;
    }
    setLoading(true);
    try {
      const list = await window.surfMonitorAPI.sftpList(serverId, dir);
      dirCacheRef.current.set(cacheKey, { entries: list, ts: Date.now() });
      setEntries(list);
      setCwd(dir);
      setPage(0);
      setSelectedPaths(new Set());
    } catch (err) {
      onNotify('SFTP error', 'error', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverId) void loadDir('/', true);
    return () => {
      if (serverId) void window.surfMonitorAPI?.closeSftpSession(serverId);
    };
  }, [serverId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (!showHidden && e.name.startsWith('.')) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, showHidden, search]);

  const pageEntries = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const enqueueTransfer = async (direction: 'upload' | 'download', remotePathOrDir: string, label: string) => {
    const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setTransfers((prev) => [{ id, direction, name: label, status: 'transferring' }, ...prev.slice(0, 14)]);
    try {
      if (direction === 'upload') {
        const dest = await window.surfMonitorAPI?.sftpUpload(serverId, remotePathOrDir);
        setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: dest ? 'completed' : 'cancelled' } : t)));
        if (dest) {
          invalidateCache(remotePathOrDir);
          await loadDir(remotePathOrDir, true);
        }
      } else {
        const saved = await window.surfMonitorAPI?.sftpDownload(serverId, remotePathOrDir);
        setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: saved ? 'completed' : 'cancelled' } : t)));
      }
    } catch {
      setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'failed' } : t)));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">SFTP File Manager</h1>
          <p className="font-mono text-xs text-zinc-500">
            Pooled SFTP session with directory caching, paginated large-folder rendering &amp; conflict-safe editor
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void enqueueTransfer('upload', cwd, `Upload to ${cwd}`)}
            className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1.5 font-mono text-xs text-white"
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
          <button
            type="button"
            onClick={async () => {
              const name = window.prompt('New file name:');
              if (!name) return;
              const p = cwd === '/' ? `/${name}` : `${cwd}/${name}`;
              await window.surfMonitorAPI?.sftpWrite(serverId, p, '');
              invalidateCache();
              await loadDir(cwd, true);
            }}
            className="flex items-center gap-1 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-200"
          >
            <FilePlus className="h-3.5 w-3.5" /> New File
          </button>
          <button
            type="button"
            onClick={async () => {
              const name = window.prompt('New folder name:');
              if (!name) return;
              const p = cwd === '/' ? `/${name}` : `${cwd}/${name}`;
              await window.surfMonitorAPI?.sftpMkdir(serverId, p);
              invalidateCache();
              await loadDir(cwd, true);
            }}
            className="flex items-center gap-1 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-200"
          >
            <FolderPlus className="h-3.5 w-3.5" /> New Folder
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/[0.08] bg-[#09090b] px-3 py-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const parts = cwd.split('/').filter(Boolean);
              parts.pop();
              void loadDir('/' + parts.join('/'));
            }}
            className="rounded border border-white/[0.1] px-2 py-0.5 text-zinc-300 hover:bg-white/[0.05]"
          >
            .. Up
          </button>
          <span className="text-zinc-200">{cwd}</span>
          {loading && <span className="text-[10px] text-emerald-400">Loading...</span>}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter folder..."
            className="rounded border border-white/[0.08] bg-[#101114] px-2 py-0.5 text-[11px] text-zinc-200"
          />
          {selectedPaths.size > 0 && (
            <button
              type="button"
              onClick={() => setDeleteTarget(entries.filter((e) => selectedPaths.has(e.path)))}
              className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300"
            >
              Delete ({selectedPaths.size})
            </button>
          )}
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="accent-emerald-500" />
            Hidden
          </label>
          <button type="button" onClick={() => void loadDir(cwd, true)} className="text-zinc-400 hover:text-zinc-100" title="Bypass cache & refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <FileBrowserSkeleton rows={8} />
      ) : (
      <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#09090b]">
        <table className="w-full text-left font-mono text-xs">
          <thead className="border-b border-white/[0.08] bg-[#101114] text-[10px] uppercase text-zinc-500">
            <tr>
              <th className="w-8 px-3 py-2">
                <CheckSquare className="h-3.5 w-3.5" />
              </th>
              <th className="px-3 py-2">Name ({filtered.length})</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Perms</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {pageEntries.map((item) => (
              <tr key={item.path} className="hover:bg-white/[0.03]">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedPaths.has(item.path)}
                    onChange={(e) => {
                      const next = new Set(selectedPaths);
                      if (e.target.checked) next.add(item.path);
                      else next.delete(item.path);
                      setSelectedPaths(next);
                    }}
                    className="accent-emerald-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (item.isDir) {
                        void loadDir(item.path);
                      } else {
                        const text = await window.surfMonitorAPI?.sftpRead(serverId, item.path);
                        if (text !== undefined) {
                          setEditingPath(item.path);
                          setEditingOriginalMtime(item.mtime);
                          setEditingContent(text);
                          setEditingDirty(false);
                        }
                      }
                    }}
                    className="flex items-center gap-2 text-zinc-200 hover:text-emerald-300"
                  >
                    {item.isDir ? <Folder className="h-3.5 w-3.5 text-amber-400" /> : <FileText className="h-3.5 w-3.5 text-zinc-400" />}
                    <span>{item.name}</span>
                  </button>
                </td>
                <td className="px-3 py-2 text-zinc-500">{item.isDir ? '—' : `${(item.size / 1024).toFixed(1)} KB`}</td>
                <td className="px-3 py-2 text-zinc-500">{item.permissions}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const nextName = window.prompt('Rename to:', item.name);
                        if (!nextName || nextName === item.name) return;
                        const dest = cwd === '/' ? `/${nextName}` : `${cwd}/${nextName}`;
                        await window.surfMonitorAPI?.sftpRename(serverId, item.path, dest);
                        invalidateCache();
                        await loadDir(cwd, true);
                      }}
                      className="rounded border border-white/[0.1] p-1 text-zinc-300 hover:bg-white/[0.06]"
                      title="Rename"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    {!item.isDir && (
                      <button
                        type="button"
                        onClick={() => void enqueueTransfer('download', item.path, item.name)}
                        className="rounded border border-white/[0.1] p-1 text-zinc-300 hover:bg-white/[0.06]"
                        title="Download"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget([item])}
                      className="rounded border border-rose-500/30 p-1 text-rose-300 hover:bg-rose-500/10"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between font-mono text-xs text-zinc-400">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-white/[0.1] px-2.5 py-1 disabled:opacity-40">Prev</button>
            <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-white/[0.1] px-2.5 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {transfers.length > 0 && (
        <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-3 font-mono text-[11px]">
          <div className="mb-1.5 font-semibold text-zinc-300">Transfer Queue</div>
          <div className="space-y-1">
            {transfers.map((t) => (
              <div key={t.id} className="flex justify-between text-zinc-400">
                <span>[{t.direction.toUpperCase()}] {t.name}</span>
                <span className={t.status === 'completed' ? 'text-emerald-400' : t.status === 'failed' ? 'text-rose-400' : 'text-amber-300'}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-white/[0.12] bg-[#0e1014] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-zinc-200">
                {editingPath} {editingDirty && <span className="text-amber-400">(unsaved)</span>}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (editingDirty && !window.confirm('Discard unsaved changes?')) return;
                  setEditingPath(null);
                }}
                className="font-mono text-xs text-zinc-400"
              >
                Close
              </button>
            </div>
            <textarea
              rows={18}
              value={editingContent}
              onChange={(e) => {
                setEditingContent(e.target.value);
                setEditingDirty(true);
              }}
              className="w-full rounded border border-white/[0.1] bg-[#060709] p-3 font-mono text-xs text-zinc-100"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  const latest = await window.surfMonitorAPI?.sftpStat(serverId, editingPath).catch(() => null);
                  if (latest && editingOriginalMtime && latest.mtime > editingOriginalMtime) {
                    if (!window.confirm('Remote file was modified since you opened it. Overwrite anyway?')) return;
                  }
                  await window.surfMonitorAPI?.sftpWrite(serverId, editingPath, editingContent);
                  onNotify('File saved', 'success', editingPath);
                  setEditingDirty(false);
                  setEditingPath(null);
                  invalidateCache();
                  await loadDir(cwd, true);
                }}
                className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white"
              >
                <Save className="h-3.5 w-3.5" /> Save Remote File
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-lg border border-rose-500/30 bg-[#0e1014] p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Confirm Delete</h3>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              Delete {deleteTarget.length} item(s)? ({deleteTarget.map((d) => d.name).slice(0, 3).join(', ')})
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded border border-white/[0.1] px-3 py-1 font-mono text-xs text-zinc-300">Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  for (const d of deleteTarget) {
                    await window.surfMonitorAPI?.sftpDelete(serverId, d.path, d.isDir);
                  }
                  setDeleteTarget(null);
                  invalidateCache();
                  await loadDir(cwd, true);
                }}
                className="rounded bg-rose-600 px-3 py-1 font-mono text-xs text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CommandCenterPage: React.FC<{
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}> = ({ servers, onNotify }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [commandText, setCommandText] = useState('uptime && df -h /');
  const [saved, setSaved] = useState<SavedCommandDTO[]>([]);
  const [results, setResults] = useState<Array<{ serverId: string; serverName: string; code: number; output: string }>>([]);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const list = await window.surfMonitorAPI?.listSavedCommands();
    if (list) setSaved(list);
  };

  useEffect(() => {
    void load();
  }, []);

  const execute = async () => {
    if (selectedIds.length === 0 || !commandText.trim()) return;
    setRunning(true);
    try {
      const res = await window.surfMonitorAPI?.executeMultiServerCommand(selectedIds, commandText);
      if (res) setResults(res);
    } catch (err) {
      onNotify('Execution failed', 'error', err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Command Center</h1>
        <p className="font-mono text-xs text-zinc-500">Execute reviewed commands across multiple servers with full output history</p>
      </div>

      <div className="space-y-3 rounded-md border border-white/[0.08] bg-[#09090b] p-4">
        <div className="font-mono text-xs text-zinc-300">Target Servers ({selectedIds.length} selected):</div>
        <div className="flex flex-wrap gap-2">
          {servers.map((s) => {
            const active = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setSelectedIds((prev) => (active ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                }
                className={`rounded border px-2.5 py-1 font-mono text-xs ${
                  active ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/[0.08] bg-[#101114] text-zinc-400'
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>

        <textarea
          rows={3}
          value={commandText}
          onChange={(e) => setCommandText(e.target.value)}
          className="w-full rounded border border-white/[0.1] bg-[#060709] p-2.5 font-mono text-xs text-zinc-100"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={running || selectedIds.length === 0}
            onClick={() => void execute()}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" /> {running ? 'Running...' : 'Execute on Selected'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const name = window.prompt('Save command template as:');
              if (!name) return;
              await window.surfMonitorAPI?.saveCommand({ id: `cmd-${Date.now()}`, name, commandTemplate: commandText });
              await load();
            }}
            className="rounded border border-white/[0.1] px-3 py-1.5 font-mono text-xs text-zinc-300"
          >
            Save Template
          </button>
          {saved.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCommandText(c.commandTemplate)}
              className="rounded border border-white/[0.08] bg-[#101114] px-2 py-1 font-mono text-[11px] text-zinc-400 hover:text-zinc-100"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.serverId} className="rounded-md border border-white/[0.08] bg-[#09090b] p-3">
              <div className="mb-1 flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-zinc-200">{r.serverName}</span>
                <span className={r.code === 0 ? 'text-emerald-400' : 'text-rose-400'}>exit {r.code}</span>
              </div>
              <pre className="max-h-48 overflow-auto rounded bg-[#060709] p-2 font-mono text-[11px] text-zinc-300">
                {r.output || '(no output)'}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ServerGroupsPage: React.FC<{
  servers: RemoteServerDTO[];
  onNotify: (title: string, tone: 'success' | 'error' | 'warning' | 'info', description?: string) => void;
}> = ({ servers, onNotify }) => {
  const [groups, setGroups] = useState<ServerGroupDTO[]>([]);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = async () => {
    const list = await window.surfMonitorAPI?.listServerGroups();
    if (list) setGroups(list);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Server Groups</h1>
        <p className="font-mono text-xs text-zinc-500">Organize remote hosts by environment, region, or workload</p>
      </div>

      <div className="space-y-3 rounded-md border border-white/[0.08] bg-[#09090b] p-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name (e.g., Production EU)"
            className="flex-1 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100"
          />
          <button
            type="button"
            onClick={async () => {
              if (!name.trim()) return;
              await window.surfMonitorAPI?.saveServerGroup({ id: `sgrp-${Date.now()}`, name: name.trim(), serverIds: selectedIds });
              setName('');
              setSelectedIds([]);
              onNotify('Server group saved', 'success');
              await load();
            }}
            className="rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white"
          >
            Create Group
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {servers.map((s) => {
            const on = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedIds((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                className={`rounded border px-2 py-1 font-mono text-[11px] ${on ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/[0.08] text-zinc-400'}`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className="rounded-md border border-white/[0.08] bg-[#09090b] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-zinc-100">{g.name}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await window.surfMonitorAPI?.deleteServerGroup(g.id);
                  await load();
                }}
                className="text-rose-400 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 font-mono text-xs text-zinc-400">
              {g.serverIds.length} servers: {g.serverIds.map((id) => servers.find((s) => s.id === id)?.name ?? id).join(', ') || 'None'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
