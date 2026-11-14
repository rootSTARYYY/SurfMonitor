import { contextBridge, ipcRenderer } from 'electron';

const surfMonitorAPI = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  setDesktopPrefs: (prefs: {
    launchOnStartup?: boolean;
    minimizeToTray?: boolean;
  }) => ipcRenderer.invoke('app:set-desktop-prefs', prefs),

  getMonitors: () => ipcRenderer.invoke('monitors:list'),
  getMonitorDetail: (id: string, range: string) =>
    ipcRenderer.invoke('monitors:detail', id, range),
  createMonitor: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('monitors:create', data),
  updateMonitor: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke('monitors:update', id, data),
  deleteMonitor: (id: string) => ipcRenderer.invoke('monitors:delete', id),
  toggleMonitor: (id: string, enabled: boolean) =>
    ipcRenderer.invoke('monitors:toggle', id, enabled),
  runManualCheck: (id: string) =>
    ipcRenderer.invoke('monitors:manual-check', id),

  getOverviewData: (range: string) =>
    ipcRenderer.invoke('overview:data', range),
  getAnalyticsData: (range: string) =>
    ipcRenderer.invoke('analytics:data', range),

  getIncidents: () => ipcRenderer.invoke('incidents:list'),
  getIncidentEvents: (incidentId: string) =>
    ipcRenderer.invoke('incidents:events', incidentId),
  addIncidentNote: (incidentId: string, note: string) =>
    ipcRenderer.invoke('incidents:add-note', incidentId, note),
  updateIncident: (id: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('incidents:update', id, updates),

  getGroups: () => ipcRenderer.invoke('groups:list'),
  createGroup: (input: Record<string, unknown>) =>
    ipcRenderer.invoke('groups:create', input),
  deleteGroup: (id: string) => ipcRenderer.invoke('groups:delete', id),

  getServicesOverview: () => ipcRenderer.invoke('services:overview'),
  createService: (input: Record<string, unknown>) =>
    ipcRenderer.invoke('services:create', input),
  deleteService: (id: string) => ipcRenderer.invoke('services:delete', id),
  linkServiceMonitor: (
    serviceId: string,
    monitorId: string,
    isCritical: boolean
  ) => ipcRenderer.invoke('services:link-monitor', serviceId, monitorId, isCritical),
  unlinkServiceMonitor: (serviceId: string, monitorId: string) =>
    ipcRenderer.invoke('services:unlink-monitor', serviceId, monitorId),
  addServiceDependency: (
    serviceId: string,
    dependsOnServiceId: string,
    isCritical: boolean
  ) =>
    ipcRenderer.invoke(
      'services:add-dependency',
      serviceId,
      dependsOnServiceId,
      isCritical
    ),
  removeServiceDependency: (id: string) =>
    ipcRenderer.invoke('services:remove-dependency', id),

  getNotificationChannels: () => ipcRenderer.invoke('notifications:channels'),
  createNotificationChannel: (input: Record<string, unknown>) =>
    ipcRenderer.invoke('notifications:create-channel', input),
  deleteNotificationChannel: (id: string) =>
    ipcRenderer.invoke('notifications:delete-channel', id),
  getNotificationChannelSafe: (id: string) =>
    ipcRenderer.invoke('notifications:get-channel-safe', id),
  updateNotificationChannel: (id: string, input: Record<string, unknown>) =>
    ipcRenderer.invoke('notifications:update-channel', id, input),
  testSmtpConnection: (input: { channelId?: string; config: Record<string, unknown> }) =>
    ipcRenderer.invoke('notifications:test-smtp-connection', input),
  sendSmtpTestEmail: (input: { channelId?: string; config: Record<string, unknown> }) =>
    ipcRenderer.invoke('notifications:send-smtp-test-email', input),
  testNotificationChannel: (id: string) =>
    ipcRenderer.invoke('notifications:test-channel', id),
  getNotificationHistory: () => ipcRenderer.invoke('notifications:history'),

  analyzeRedirects: (url: string) => ipcRenderer.invoke('intel:redirects', url),
  analyzeSecurityHeaders: (url: string) =>
    ipcRenderer.invoke('intel:security-headers', url),
  getBrokenLinkScans: () => ipcRenderer.invoke('intel:broken-links-list'),
  getBrokenLinkResults: (scanId: string) =>
    ipcRenderer.invoke('intel:broken-links-results', scanId),
  runBrokenLinkScan: (targetUrl: string, maxPages?: number, maxDepth?: number) =>
    ipcRenderer.invoke('intel:run-broken-links', targetUrl, maxPages, maxDepth),

  getMaintenanceWindows: () => ipcRenderer.invoke('maintenance:list'),
  createMaintenanceWindow: (input: Record<string, unknown>) =>
    ipcRenderer.invoke('maintenance:create', input),
  deleteMaintenanceWindow: (id: string) =>
    ipcRenderer.invoke('maintenance:delete', id),
  updateMaintenanceWindow: (id: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('maintenance:update', id, updates),

  getBackups: () => ipcRenderer.invoke('backup:list'),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  cleanupDatabase: (retentionDays: number) =>
    ipcRenderer.invoke('db:cleanup', retentionDays),
  exportMonitorsJson: () => ipcRenderer.invoke('export:monitors-json'),
  exportIncidentsCsv: () => ipcRenderer.invoke('export:incidents-csv'),

  // Remote Infrastructure (Phases 14 & 15)
  pickSshKeyFile: () => ipcRenderer.invoke('servers:pick-key-file'),
  getRemoteServers: () => ipcRenderer.invoke('servers:list'),
  getRemoteServerDetail: (id: string) => ipcRenderer.invoke('servers:detail', id),
  testSshConnection: (params: Record<string, unknown>) =>
    ipcRenderer.invoke('servers:test-ssh', params),
  installRemoteAgent: (params: Record<string, unknown>) =>
    ipcRenderer.invoke('servers:install-agent', params),
  createRemoteServer: (input: Record<string, unknown>) =>
    ipcRenderer.invoke('servers:create', input),
  updateRemoteServer: (id: string, input: Record<string, unknown>) =>
    ipcRenderer.invoke('servers:update', id, input),
  upgradeRemoteServerAgent: (id: string) =>
    ipcRenderer.invoke('servers:upgrade-agent', id),
  getPm2Overview: () => ipcRenderer.invoke('pm2:list-all'),
  refreshPm2: (serverId?: string) => ipcRenderer.invoke('pm2:refresh', serverId),
  getPm2ProcessDetail: (serverId: string, processKey: string) =>
    ipcRenderer.invoke('pm2:detail', serverId, processKey),
  getPm2ProcessLogs: (serverId: string, linuxUser: string, pmId: number, lines?: number) =>
    ipcRenderer.invoke('pm2:logs', serverId, linuxUser, pmId, lines),
  runPm2Action: (serverId: string, linuxUser: string, pmId: number, action: string) =>
    ipcRenderer.invoke('pm2:action', serverId, linuxUser, pmId, action),
  savePm2AlertConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke('pm2:save-alert-config', config),
  deleteRemoteServer: (id: string) => ipcRenderer.invoke('servers:delete', id),
  toggleRemoteServer: (id: string, enabled: boolean) =>
    ipcRenderer.invoke('servers:toggle-connect', id, enabled),
  pollRemoteServerNow: (id: string) =>
    ipcRenderer.invoke('servers:poll-now', id),
  getDockerContainers: (serverId: string) =>
    ipcRenderer.invoke('servers:docker-list', serverId),
  runDockerAction: (serverId: string, containerId: string, action: string) =>
    ipcRenderer.invoke('servers:docker-action', serverId, containerId, action),
  getRemoteServices: (serverId: string) =>
    ipcRenderer.invoke('servers:services-list', serverId),
  runRemoteServiceAction: (
    serverId: string,
    serviceName: string,
    action: string
  ) =>
    ipcRenderer.invoke('servers:service-action', serverId, serviceName, action),

  // Licensing & Settings (v2.2.0)
  getLicenseState: () => ipcRenderer.invoke('license:get-state'),
  activateLicense: (key: string, analyticsEnabled = true, username?: string) =>
    ipcRenderer.invoke('license:activate', key, analyticsEnabled, username),
  startTrial: (username: string) =>
    ipcRenderer.invoke('trial:start', username),
  setUsername: (username: string) =>
    ipcRenderer.invoke('profile:set-username', username),
  setDiscordInviteUrl: (url: string) =>
    ipcRenderer.invoke('license:set-discord-invite', url),
  validateLicenseNow: () => ipcRenderer.invoke('license:validate-now'),
  clearLocalLicense: () => ipcRenderer.invoke('license:clear-local'),
  setLicenseAnalytics: (enabled: boolean) =>
    ipcRenderer.invoke('license:set-analytics', enabled),
  getThemeState: () => ipcRenderer.invoke('themes:get-state'),
  saveCustomTheme: (input: { id: string; name: string; themeJson: string; isDefault?: boolean }) =>
    ipcRenderer.invoke('themes:save', input),
  deleteCustomTheme: (id: string) => ipcRenderer.invoke('themes:delete', id),
  setActiveThemeId: (id: string) => ipcRenderer.invoke('themes:set-active', id),
  exportThemeFile: (defaultFileName: string, content: string) =>
    ipcRenderer.invoke('themes:export-file', defaultFileName, content),
  importThemeFile: (kind?: 'json' | 'css') =>
    ipcRenderer.invoke('themes:import-file', kind),
  pickThemeBgImage: () => ipcRenderer.invoke('themes:pick-bg-image'),
  getPersistedSettings: () => ipcRenderer.invoke('settings:get'),
  savePersistedSettings: (obj: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:save', obj),
  getStartupTimings: () => ipcRenderer.invoke('startup:get-timings'),
  onLicenseUpdated: (callback: (state: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      callback(payload);
    };
    ipcRenderer.on('license:updated', listener);
    return () => {
      ipcRenderer.removeListener('license:updated', listener);
    };
  },

  onMonitorEvent: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      callback(payload);
    };
    ipcRenderer.on('monitor:event', listener);
    return () => {
      ipcRenderer.removeListener('monitor:event', listener);
    };
  },

  onRemoteEvent: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      callback(payload);
    };
    ipcRenderer.on('remote:event', listener);
    return () => {
      ipcRenderer.removeListener('remote:event', listener);
    };
  },
};

contextBridge.exposeInMainWorld('surfMonitorAPI', surfMonitorAPI);
