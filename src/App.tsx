import React, { useCallback, useEffect, useState } from 'react';
import {
  AnalyticsPayload,
  AnalyticsRange,
  AppSettings,
  IncidentDTO,
  MaintenanceWindowDTO,
  Monitor,
  MonitorDetailPayload,
  MonitorFormData,
  MonitorGroupDTO,
  NotificationChannelDTO,
  NotificationHistoryDTO,
  NotificationItem,
  OverviewPayload,
  UserProfileState,
  RemoteServerDTO,
  PageId,
  SchedulerEventPayload,
  ServicesOverviewPayload,
  TimeRangeFilter,
  ToastItem,
} from '@/types';
import { DegradedSystemItem, Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { AddMonitorModal } from '@/components/AddMonitorModal';
import { AddServerModal } from '@/components/AddServerModal';
import { OnboardingExperience } from '@/components/OnboardingExperience';
import { ToastContainer } from '@/components/ToastContainer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Overview } from '@/pages/Overview';
import { Monitors } from '@/pages/Monitors';
import { MonitorDetail } from '@/pages/MonitorDetail';
import { Analytics } from '@/pages/Analytics';
import { Settings, SettingsTab } from '@/pages/Settings';
import { applyThemeToDocument, BUILT_IN_THEMES, SurfTheme, validateAndMigrateTheme } from '@/theme/themeEngine';
import {
  DependencyMapPage,
  GroupsPage,
  ServicesPage,
} from '@/pages/GroupsAndServices';
import {
  FilteredMonitorsPage,
  WebsiteIntelligencePage,
} from '@/pages/ProtocolViews';
import {
  ServerDetailPage,
  ServerManagerPage,
  UnifiedContainersPage,
} from '@/pages/RemoteInfrastructure';
import {
  IncidentsPage,
  MaintenancePage,
  NotificationsPage,
} from '@/pages/ManagementPages';
import { Pm2ProcessDetailPage, Pm2ProcessesPage } from '@/pages/Pm2Processes';

const SETTINGS_STORAGE_KEY = 'surf_monitor_settings_v3';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultIntervalSeconds: 60,
  defaultTimeoutSeconds: 10,
  launchOnStartup: false,
  minimizeToTray: true,
  retentionDays: 30,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(
    null
  );
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [remoteServers, setRemoteServers] = useState<RemoteServerDTO[]>([]);
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<RemoteServerDTO | null>(null);
  const [selectedPm2Target, setSelectedPm2Target] = useState<{ serverId: string; processKey: string } | null>(null);
  const [pm2Count, setPm2Count] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfileState | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [replayingOnboarding, setReplayingOnboarding] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('general');
  const [activeTheme, setActiveTheme] = useState<SurfTheme>(BUILT_IN_THEMES[0]);
  const [draftTheme, setDraftTheme] = useState<SurfTheme | null>(null);
  const [customThemes, setCustomThemes] = useState<SurfTheme[]>([]);
  const [defaultThemeId, setDefaultThemeId] = useState<string | null>(null);
  const [themeSafeMode, setThemeSafeMode] = useState(false);

  const [overviewRange, setOverviewRange] = useState<TimeRangeFilter>('24h');
  const [detailRange, setDetailRange] = useState<TimeRangeFilter>('24h');
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('7d');

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [overviewData, setOverviewData] = useState<OverviewPayload | null>(
    null
  );
  const [detailData, setDetailData] = useState<MonitorDetailPayload | null>(
    null
  );
  const [analyticsData, setAnalyticsData] = useState<AnalyticsPayload | null>(
    null
  );
  const [incidents, setIncidents] = useState<IncidentDTO[]>([]);
  const [groups, setGroups] = useState<MonitorGroupDTO[]>([]);
  const [servicesOverview, setServicesOverview] =
    useState<ServicesOverviewPayload | null>(null);
  const [channels, setChannels] = useState<NotificationChannelDTO[]>([]);
  const [notifHistory, setNotifHistory] = useState<NotificationHistoryDTO[]>(
    []
  );
  const [maintenanceWindows, setMaintenanceWindows] = useState<
    MaintenanceWindowDTO[]
  >([]);
  const [heartbeatPort, setHeartbeatPort] = useState(45821);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Monitor | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      void window.surfMonitorAPI?.savePersistedSettings(settings as unknown as Record<string, unknown>);
    } catch {
      // ignore
    }
  }, [settings]);

  const pushToast = useCallback(
    (title: string, tone: ToastItem['tone'] = 'info', description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, description, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const refreshCoreData = useCallback(async () => {
    const api = window.surfMonitorAPI;
    if (!api) {
      setLoadingOverview(false);
      return;
    }

    try {
      const [
        monList,
        ovData,
        incList,
        grpList,
        svcOv,
        chList,
        nHist,
        mwList,
        info,
        srvList,
      ] = await Promise.all([
        api.getMonitors(),
        api.getOverviewData(overviewRange),
        api.getIncidents(),
        api.getGroups(),
        api.getServicesOverview(),
        api.getNotificationChannels(),
        api.getNotificationHistory(),
        api.getMaintenanceWindows(),
        api.getAppInfo(),
        api.getRemoteServers(),
      ]);
      setMonitors(monList);
      setOverviewData(ovData);
      setIncidents(incList);
      setGroups(grpList);
      setServicesOverview(svcOv);
      setChannels(chList);
      setNotifHistory(nHist);
      setMaintenanceWindows(mwList);
      setHeartbeatPort(info.heartbeatPort || 45821);
      setRemoteServers(srvList);
      try {
        const pm2Res = await api.getPm2Overview();
        setPm2Count(pm2Res.processes?.length ?? 0);
      } catch {
        setPm2Count(0);
      }
    } catch (err) {
      pushToast(
        'Failed to load data',
        'error',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoadingOverview(false);
    }
  }, [overviewRange, pushToast]);

  const refreshDetail = useCallback(
    async (monitorId: string, range: TimeRangeFilter) => {
      const api = window.surfMonitorAPI;
      if (!api) return;
      setLoadingDetail(true);
      try {
        setDetailData(await api.getMonitorDetail(monitorId, range));
      } catch {
        setDetailData(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    []
  );

  const refreshAnalytics = useCallback(async (range: AnalyticsRange) => {
    const api = window.surfMonitorAPI;
    if (!api) return;
    setLoadingAnalytics(true);
    try {
      setAnalyticsData(await api.getAnalyticsData(range));
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    const api = window.surfMonitorAPI;
    if (!api) {
      setLicenseChecked(true);
      return;
    }
    void api.getThemeState?.().then((tState) => {
      const parsedCustom: SurfTheme[] = [];
      let defId: string | null = null;
      for (const rec of tState.themes ?? []) {
        try {
          const parsed = validateAndMigrateTheme(JSON.parse(rec.themeJson));
          parsed.id = rec.id;
          parsed.name = rec.name;
          parsedCustom.push(parsed);
          if (rec.isDefault === 1) defId = rec.id;
        } catch {}
      }
      setCustomThemes(parsedCustom);
      setDefaultThemeId(defId);
      setThemeSafeMode(Boolean(tState.safeMode));
      const all = [...BUILT_IN_THEMES, ...parsedCustom];
      const found = all.find((t) => t.id === tState.activeThemeId) ?? all.find((t) => t.id === defId) ?? BUILT_IN_THEMES[0];
      setActiveTheme(found);
      applyThemeToDocument(found, Boolean(tState.safeMode));
    });
    void api.getProfileState().then((prof) => {
      setUserProfile(prof);
      setProfileLoaded(true);
    });
    void api.getPersistedSettings().then((saved) => {
      if (saved) {
        setSettings((prev) => ({ ...prev, ...(saved as Partial<AppSettings>) }));
      }
    });
  }, []);

  useEffect(() => {
    
    void refreshCoreData();
  }, [refreshCoreData]);

  useEffect(() => {
    if (activePage === 'monitor-detail' && selectedMonitorId) {
      void refreshDetail(selectedMonitorId, detailRange);
    }
  }, [activePage, selectedMonitorId, detailRange, refreshDetail]);

  useEffect(() => {
    if (activePage === 'reports') {
      void refreshAnalytics(analyticsRange);
    }
  }, [activePage, analyticsRange, refreshAnalytics]);

  useEffect(() => {
    const api = window.surfMonitorAPI;
    if (!api) return;

    const unsubscribe = api.onMonitorEvent((event: SchedulerEventPayload) => {
      void refreshCoreData();

      if (
        activePage === 'monitor-detail' &&
        selectedMonitorId &&
        event.monitorId === selectedMonitorId
      ) {
        if (event.type === 'monitor-deleted') {
          setSelectedMonitorId(null);
          setActivePage('monitors');
        } else {
          void refreshDetail(selectedMonitorId, detailRange);
        }
      }

      if (activePage === 'reports') {
        void refreshAnalytics(analyticsRange);
      }

      if (event.type === 'status-changed') {
        const tone =
          event.status === 'UP'
            ? 'success'
            : event.status === 'DEGRADED'
              ? 'warning'
              : 'error';
        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            title: `${event.monitorName} is ${event.status}`,
            message: `Transitioned to ${event.status}`,
            timestamp: new Date().toLocaleTimeString(),
            type:
              event.status === 'UP'
                ? 'info'
                : event.status === 'DEGRADED'
                  ? 'warning'
                  : 'alert',
            read: false,
          },
          ...prev.slice(0, 29),
        ]);
        pushToast(`${event.monitorName} → ${event.status}`, tone);
      }
    });

    const unsubRemote = api.onRemoteEvent(() => {
      void refreshCoreData();
    });
    return () => {
      unsubscribe();
      unsubRemote();
    };
  }, [
    activePage,
    selectedMonitorId,
    detailRange,
    analyticsRange,
    refreshCoreData,
    refreshDetail,
    refreshAnalytics,
    pushToast,
  ]);

  const handleNavigate = (page: PageId) => {
    setActivePage(page);
    if (page !== 'monitor-detail') setSelectedMonitorId(null);
  };

  const handleSelectMonitor = (monitorId: string) => {
    setSelectedMonitorId(monitorId);
    setActivePage('monitor-detail');
  };

  const handleSaveMonitor = async (
    data: MonitorFormData,
    existingId?: string
  ) => {
    const api = window.surfMonitorAPI;
    if (!api) throw new Error('Electron IPC bridge unavailable');

    const payload = {
      name: data.name,
      url: data.url,
      monitorType: data.monitorType,
      method: data.method,
      interval: data.intervalSeconds,
      timeout: data.timeoutSeconds,
      expectedStatusCodes: data.expectedStatusCodes,
      groupId: data.groupId,
      tags: data.tags,
      config: data.config,
    };

    if (existingId) {
      await api.updateMonitor(existingId, payload);
      pushToast('Monitor updated', 'success', `${data.name} saved.`);
    } else {
      await api.createMonitor(payload);
      pushToast('Monitor created', 'success', `${data.name} added.`);
    }

    await refreshCoreData();
    if (existingId && selectedMonitorId === existingId) {
      await refreshDetail(existingId, detailRange);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !window.surfMonitorAPI) return;
    const deletedName = deleteTarget.name;
    const deletedId = deleteTarget.id;
    setDeleteTarget(null);
    await window.surfMonitorAPI.deleteMonitor(deletedId);
    if (selectedMonitorId === deletedId) {
      setSelectedMonitorId(null);
      setActivePage('monitors');
    }
    pushToast('Monitor deleted', 'info', `${deletedName} removed.`);
    await refreshCoreData();
  };

  const handleTogglePause = async (monitor: Monitor) => {
    if (!window.surfMonitorAPI) return;
    const nextEnabled = !monitor.enabled;
    await window.surfMonitorAPI.toggleMonitor(monitor.id, nextEnabled);
    pushToast(
      nextEnabled ? 'Monitor resumed' : 'Monitor paused',
      'info',
      monitor.name
    );
    await refreshCoreData();
  };

  const handleRunManualCheck = async (monitor: Monitor) => {
    if (!window.surfMonitorAPI || manualChecking) return;
    setManualChecking(true);
    try {
      await window.surfMonitorAPI.runManualCheck(monitor.id);
      pushToast('Check completed', 'success', monitor.name);
      await refreshCoreData();
      if (selectedMonitorId === monitor.id) {
        await refreshDetail(monitor.id, detailRange);
      }
    } finally {
      setManualChecking(false);
    }
  };

  const activeIncidentCount = incidents.filter(
    (i) => i.status === 'open'
  ).length;

  const selectedMonitor =
    monitors.find((m) => m.id === selectedMonitorId) ?? detailData?.monitor ?? null;

  const breadcrumbs =
    activePage === 'monitor-detail' && selectedMonitor
      ? [
          { label: 'Monitors', onClick: () => handleNavigate('monitors') },
          { label: selectedMonitor.name },
          { label: 'Details' },
        ]
      : [
          { label: 'Workspace', onClick: () => handleNavigate('overview') },
          { label: activePage.replace('-', ' ').toUpperCase() },
        ];

  useEffect(() => {
    applyThemeToDocument(draftTheme ?? activeTheme, themeSafeMode);
  }, [draftTheme, activeTheme, themeSafeMode]);

  if (!profileLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#09090b] font-mono text-xs text-zinc-500">
        Loading Surf Monitor...
      </div>
    );
  }

  if (replayingOnboarding || (window.surfMonitorAPI && userProfile && !userProfile.onboardingCompleted)) {
    return (
      <OnboardingExperience
        existingUsername={userProfile?.username ?? null}
        isReplay={replayingOnboarding}
        onComplete={(next) => {
          setUserProfile(next);
          setReplayingOnboarding(false);
        }}
      />
    );
  }

  const degradedItems: DegradedSystemItem[] = [
    ...monitors
      .filter((m) => m.status === 'DOWN' || m.status === 'DEGRADED')
      .map((m) => ({
        id: m.id,
        kind: 'monitor' as const,
        name: m.name,
        status: m.status,
        detail: m.lastError ?? (m.httpStatusCode ? `HTTP ${m.httpStatusCode}` : null),
      })),
    ...remoteServers
      .filter((s) => s.enabled && s.connectionStatus === 'error')
      .map((s) => ({
        id: s.id,
        kind: 'server' as const,
        name: s.name,
        status: s.connectionStatus,
        detail: s.lastError ?? s.host,
      })),
  ];

  const liveTheme = draftTheme ?? activeTheme;
  const isRightSidebar = liveTheme.layout.sidebarPosition === 'right';

  return (
    <div
      className={`surf-app-shell relative flex h-screen w-screen overflow-hidden text-zinc-100 ${
        isRightSidebar ? 'flex-row-reverse' : ''
      }`}
    >
      {liveTheme.background.mode === 'image' && liveTheme.background.imageDataUrl && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `url(${liveTheme.background.imageDataUrl})`,
              backgroundSize: liveTheme.background.imageSize,
              backgroundPosition: liveTheme.background.imagePosition,
              opacity: liveTheme.background.imageOpacity,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: liveTheme.background.overlayColor,
              opacity: liveTheme.background.overlayOpacity,
            }}
          />
        </div>
      )}
      <Sidebar
        activePage={activePage}
        activeIncidentCount={activeIncidentCount}
        monitorCount={monitors.length}
        serverCount={remoteServers.length}
        pm2Count={pm2Count}
        degradedItems={degradedItems}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onNavigate={handleNavigate}
        onSelectDegradedItem={(item) => {
          if (item.kind === 'monitor') {
            handleSelectMonitor(item.id);
          } else {
            setSelectedServerId(item.id);
            setActivePage('server-detail');
          }
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          breadcrumbs={breadcrumbs}
          searchQuery={searchQuery}
          onSearchSubmit={(q) => {
            setSearchQuery(q);
            if (q.trim() && activePage !== 'monitors') setActivePage('monitors');
          }}
          onOpenAddMonitor={() => {
            setEditingMonitor(null);
            setIsModalOpen(true);
          }}
          notifications={notifications}
          onMarkNotificationRead={(id) =>
            setNotifications((prev) =>
              prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            )
          }
          onMarkAllNotificationsRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
          }
          userProfile={userProfile}
          userStats={{
            totalMonitors: monitors.length,
            operationalMonitors: monitors.filter((m) => m.status === 'UP').length,
            issueMonitors: monitors.filter((m) => m.status === 'DOWN' || m.status === 'DEGRADED').length,
            activeServers: remoteServers.filter((s) => s.connectionStatus === 'connected').length,
            totalServers: remoteServers.length,
            totalPm2Processes: pm2Count,
            appVersion: '4.2.0',
          }}
          onOpenProfileSettings={() => {
            setSettingsInitialTab('profile');
            handleNavigate('settings');
          }}
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px]">
            {activePage === 'overview' && (
              <Overview
                data={overviewData}
                loading={loadingOverview}
                range={overviewRange}
                onRangeChange={setOverviewRange}
                onNavigate={handleNavigate}
                onSelectMonitor={handleSelectMonitor}
                onOpenAddMonitor={() => {
                  setEditingMonitor(null);
                  setIsModalOpen(true);
                }}
                servers={remoteServers}
                activeIncidentCount={activeIncidentCount}
              />
            )}

            {activePage === 'monitors' && (
              <Monitors
                monitors={monitors}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onOpenAddModal={() => {
                  setEditingMonitor(null);
                  setIsModalOpen(true);
                }}
                onSelectMonitor={handleSelectMonitor}
                onEditMonitor={(m) => {
                  setEditingMonitor(m);
                  setIsModalOpen(true);
                }}
                onDeleteMonitor={(m) => setDeleteTarget(m)}
                onTogglePause={(m) => void handleTogglePause(m)}
              />
            )}

            {activePage === 'monitor-detail' && (
              <MonitorDetail
                detail={detailData}
                loading={loadingDetail}
                range={detailRange}
                onRangeChange={setDetailRange}
                onBack={() => handleNavigate('monitors')}
                onEdit={(m) => {
                  setEditingMonitor(m);
                  setIsModalOpen(true);
                }}
                onDelete={(m) => setDeleteTarget(m)}
                onTogglePause={(m) => void handleTogglePause(m)}
                onRunManualCheck={(m) => void handleRunManualCheck(m)}
                checking={manualChecking}
              />
            )}

            {activePage === 'groups' && (
              <GroupsPage
                groups={groups}
                monitors={monitors}
                onRefresh={() => void refreshCoreData()}
                onSelectMonitor={handleSelectMonitor}
              />
            )}

            {activePage === 'services' && (
              <ServicesPage
                overview={servicesOverview}
                monitors={monitors}
                onRefresh={() => void refreshCoreData()}
              />
            )}

            {activePage === 'dependency-map' && (
              <DependencyMapPage overview={servicesOverview} />
            )}

            {activePage === 'incidents' && (
              <IncidentsPage
                incidents={incidents}
                onRefresh={() => void refreshCoreData()}
                onSelectMonitor={handleSelectMonitor}
              />
            )}

            {activePage === 'ssl' && (
              <FilteredMonitorsPage
                title="SSL Certificate Monitoring"
                subtitle="TLS certificate expiry, chain validation, and hostname checks"
                monitors={monitors.filter((m) => m.monitorType === 'ssl')}
                onSelectMonitor={handleSelectMonitor}
                onRunCheck={(m) => void handleRunManualCheck(m)}
              />
            )}

            {activePage === 'dns' && (
              <FilteredMonitorsPage
                title="DNS Record Monitoring"
                subtitle="A, AAAA, CNAME, MX, TXT, NS, SOA, and CAA resolution & change detection"
                monitors={monitors.filter((m) => m.monitorType === 'dns')}
                onSelectMonitor={handleSelectMonitor}
                onRunCheck={(m) => void handleRunManualCheck(m)}
              />
            )}

            {activePage === 'network' && (
              <FilteredMonitorsPage
                title="TCP &amp; ICMP Ping Monitoring"
                subtitle="Port connectivity and ICMP reachability checks"
                monitors={monitors.filter(
                  (m) => m.monitorType === 'tcp' || m.monitorType === 'ping'
                )}
                onSelectMonitor={handleSelectMonitor}
                onRunCheck={(m) => void handleRunManualCheck(m)}
              />
            )}

            {activePage === 'heartbeats' && (
              <FilteredMonitorsPage
                title="Heartbeat Monitors"
                subtitle="Cron &amp; scheduled job check-in monitoring with grace periods"
                monitors={monitors.filter((m) => m.monitorType === 'heartbeat')}
                onSelectMonitor={handleSelectMonitor}
                onRunCheck={(m) => void handleRunManualCheck(m)}
                heartbeatPort={heartbeatPort}
              />
            )}

            {activePage === 'intelligence' && <WebsiteIntelligencePage />}

            {activePage === 'notifications' && (
              <NotificationsPage
                channels={channels}
                history={notifHistory}
                onRefresh={() => void refreshCoreData()}
              />
            )}

            {activePage === 'reports' && (
              <Analytics
                data={analyticsData}
                loading={loadingAnalytics}
                range={analyticsRange}
                onRangeChange={setAnalyticsRange}
              />
            )}

            {activePage === 'maintenance' && (
              <MaintenancePage
                windows={maintenanceWindows}
                monitors={monitors}
                onRefresh={() => void refreshCoreData()}
              />
            )}

            {activePage === 'servers' && (
              <ServerManagerPage
                servers={remoteServers}
                onOpenAddServer={() => {
                  setEditingServer(null);
                  setIsAddServerOpen(true);
                }}
                onEditServer={(srv) => {
                  setEditingServer(srv);
                  setIsAddServerOpen(true);
                }}
                onSelectServer={(id) => {
                  setSelectedServerId(id);
                  setActivePage('server-detail');
                }}
                onRefresh={() => void refreshCoreData()}
              />
            )}

            {activePage === 'server-detail' && selectedServerId && (
              <ServerDetailPage
                serverId={selectedServerId}
                onBack={() => setActivePage('servers')}
                onEditServer={(srv) => {
                  setEditingServer(srv);
                  setIsAddServerOpen(true);
                }}
              />
            )}

            {activePage === 'pm2' && (
              <Pm2ProcessesPage
                onSelectProcess={(serverId, processKey) => {
                  setSelectedPm2Target({ serverId, processKey });
                  setActivePage('pm2-detail');
                }}
                onNotify={pushToast}
              />
            )}

            {activePage === 'pm2-detail' && selectedPm2Target && (
              <Pm2ProcessDetailPage
                serverId={selectedPm2Target.serverId}
                processKey={selectedPm2Target.processKey}
                onBack={() => setActivePage('pm2')}
                onNotify={pushToast}
              />
            )}

            {activePage === 'containers' && (
              <UnifiedContainersPage
                servers={remoteServers}
                onSelectServer={(id) => {
                  setSelectedServerId(id);
                  setActivePage('server-detail');
                }}
              />
            )}

            {activePage === 'settings' && (
              <Settings
                settings={settings}
                userProfile={userProfile}
                initialTab={settingsInitialTab}
                onUpdateSettings={setSettings}
                onProfileUpdated={setUserProfile}
                onReplayOnboarding={() => setReplayingOnboarding(true)}
                onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
                themeStudio={{
                  activeTheme,
                  draftTheme: draftTheme ?? activeTheme,
                  customThemes,
                  defaultThemeId,
                  safeMode: themeSafeMode,
                  onDraftChange: (next) => setDraftTheme(next),
                  onCancelDraft: () => setDraftTheme(null),
                  onSelectTheme: async (theme) => {
                    setActiveTheme(theme);
                    setDraftTheme(null);
                    await window.surfMonitorAPI?.setActiveThemeId(theme.id);
                    pushToast('Theme applied', 'success', theme.name);
                  },
                  onApplyAndSave: async (theme, makeDefault = false) => {
                    const savedRec = await window.surfMonitorAPI?.saveCustomTheme({
                      id: theme.id,
                      name: theme.name,
                      themeJson: JSON.stringify(theme),
                      isDefault: makeDefault,
                    });
                    if (savedRec) {
                      setCustomThemes((prev) => {
                        const filtered = prev.filter((t) => t.id !== theme.id);
                        return [theme, ...filtered];
                      });
                      if (makeDefault) setDefaultThemeId(theme.id);
                    }
                    setActiveTheme(theme);
                    setDraftTheme(null);
                    await window.surfMonitorAPI?.setActiveThemeId(theme.id);
                    pushToast('Theme saved', 'success', theme.name);
                  },
                  onDeleteCustomTheme: async (id) => {
                    await window.surfMonitorAPI?.deleteCustomTheme(id);
                    setCustomThemes((prev) => prev.filter((t) => t.id !== id));
                    if (activeTheme.id === id) {
                      setActiveTheme(BUILT_IN_THEMES[0]);
                      await window.surfMonitorAPI?.setActiveThemeId(BUILT_IN_THEMES[0].id);
                    }
                    if (draftTheme?.id === id) setDraftTheme(null);
                    pushToast('Theme deleted', 'info');
                  },
                }}
              />
            )}
          </div>
        </main>
      </div>

      <AddMonitorModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMonitor(null);
        }}
        onSave={handleSaveMonitor}
        editingMonitor={editingMonitor}
        groups={groups}
        defaultIntervalSeconds={settings.defaultIntervalSeconds}
        defaultTimeoutSeconds={settings.defaultTimeoutSeconds}
      />

      <AddServerModal
        isOpen={isAddServerOpen}
        editingServer={editingServer}
        onClose={() => {
          setIsAddServerOpen(false);
          setEditingServer(null);
        }}
        onCreated={() => {
          void refreshCoreData();
          pushToast(
            editingServer ? 'Server updated' : 'Server added',
            'success',
            editingServer ? 'Server configuration saved.' : 'Polling remote agent over SSH tunnel.'
          );
        }}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Monitor"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}" (${deleteTarget.url}) and all of its historical checks from SQLite?`
            : ''
        }
        confirmLabel="Delete Monitor"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }
      />
    </div>
  );
};

export default App;
