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

  // User Profile & Onboarding (v4.2.0)
  getProfileState: () => ipcRenderer.invoke('profile:get-state'),
  setUsername: (username: string) =>
    ipcRenderer.invoke('profile:set-username', username),
  completeOnboarding: (username?: string) =>
    ipcRenderer.invoke('profile:complete-onboarding', username),
  getPersistedSettings: () => ipcRenderer.invoke('settings:get'),
  savePersistedSettings: (obj: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:save', obj),
  getStartupTimings: () => ipcRenderer.invoke('startup:get-timings'),
  getThemeState: () => ipcRenderer.invoke('themes:get-state'),
  saveCustomTheme: (input: { id: string; name: string; themeJson: string; isDefault?: boolean }) =>
    ipcRenderer.invoke('themes:save', input),
  deleteCustomTheme: (id: string) => ipcRenderer.invoke('themes:delete', id),
  setActiveThemeId: (id: string) => ipcRenderer.invoke('themes:set-active', id),
  setThemeSafeMode: (enabled: boolean) => ipcRenderer.invoke('themes:set-safe-mode', enabled),
  exportThemeFile: (defaultFilename: string, content: string) =>
    ipcRenderer.invoke('themes:export-file', defaultFilename, content),
  importThemeFile: (kind: 'json' | 'css') =>
    ipcRenderer.invoke('themes:import-file', kind),
  pickThemeBgImage: () => ipcRenderer.invoke('themes:pick-bg-image'),

  // Surf Agent v4.0.0 APIs
  getAgentOverview: (serverId: string) => ipcRenderer.invoke('agent:overview', serverId),
  getAgentPerfAnalysis: (serverId: string) => ipcRenderer.invoke('agent:perf-analysis', serverId),
  getAgentPerfProfiles: (serverId: string) => ipcRenderer.invoke('agent:perf-profiles', serverId),
  applyAgentPerfProfile: (serverId: string, profileId: string) => ipcRenderer.invoke('agent:perf-apply', serverId, profileId),
  rollbackAgentPerfProfile: (serverId: string) => ipcRenderer.invoke('agent:perf-rollback', serverId),
  getAgentCapacityForecast: (serverId: string) => ipcRenderer.invoke('agent:capacity-forecast', serverId),
  getAgentNetworkAnomalies: (serverId: string) => ipcRenderer.invoke('agent:network-anomalies', serverId),
  blockIpMitigation: (serverId: string, ip: string, durationSec: number) => ipcRenderer.invoke('agent:block-ip', serverId, ip, durationSec),
  getAgentSecurity: (serverId: string) => ipcRenderer.invoke('agent:security', serverId),
  getAgentActivity: (serverId: string) => ipcRenderer.invoke('agent:activity', serverId),
  getAgentSettings: (serverId: string) => ipcRenderer.invoke('agent:get-settings', serverId),
  saveAgentSettings: (serverId: string, settingsObj: Record<string, unknown>) =>
    ipcRenderer.invoke('agent:save-settings', serverId, settingsObj),

  // v5.0.0 Platform APIs
  getInstallerCatalog: () => ipcRenderer.invoke('installer:get-catalog'),
  getInstallerVersions: (installerId: string, forceRefresh?: boolean) => ipcRenderer.invoke('installer:get-versions', installerId, forceRefresh),
  listDeploymentTemplates: () => ipcRenderer.invoke('installer:list-templates'),
  runInstallerPreflight: (installerId: string, serverId: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke('installer:preflight', installerId, serverId, config),
  startInstallationJob: (params: Record<string, unknown>) =>
    ipcRenderer.invoke('installer:start-job', params),
  cancelInstallationJob: (jobId: string) => ipcRenderer.invoke('installer:cancel-job', jobId),
  listInstallationJobs: (limit?: number) => ipcRenderer.invoke('installer:list-jobs', limit),
  getInstallationJob: (jobId: string) => ipcRenderer.invoke('installer:get-job', jobId),
  setInstallerPolicy: (installerId: string, policy: string) =>
    ipcRenderer.invoke('installer:set-policy', installerId, policy),
  listCommunityInstallers: () => ipcRenderer.invoke('installer:list-community'),
  importCommunityInstaller: () => ipcRenderer.invoke('installer:import-community'),
  setCommunityInstallerTrust: (packageId: string, trustStatus: string) =>
    ipcRenderer.invoke('installer:set-community-trust', packageId, trustStatus),
  deleteCommunityInstaller: (packageId: string) =>
    ipcRenderer.invoke('installer:delete-community', packageId),
  onInstallerJobEvent: (cb: (payload: unknown) => void): (() => void) => {
    const l = (_e: Electron.IpcRendererEvent, p: unknown) => cb(p);
    ipcRenderer.on('installer:job-event', l);
    return () => ipcRenderer.removeListener('installer:job-event', l);
  },

  listInstalledApps: (serverId?: string) => ipcRenderer.invoke('apps:list', serverId),
  runInstalledAppAction: (appId: string, action: string) => ipcRenderer.invoke('apps:action', appId, action),
  deleteInstalledApp: (appId: string) => ipcRenderer.invoke('apps:delete', appId),

  openTerminalSession: (sessionId: string, serverId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:open', sessionId, serverId, cols, rows),
  writeTerminalSession: (sessionId: string, data: string) =>
    ipcRenderer.invoke('terminal:write', sessionId, data),
  resizeTerminalSession: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
  listActiveSshConnections: () => ipcRenderer.invoke('ssh:list-connections'),
  disconnectSshServer: (serverId: string) => ipcRenderer.invoke('ssh:disconnect', serverId),
  closeSftpSession: (serverId: string) => ipcRenderer.invoke('sftp:close', serverId),
  closeTerminalSession: (sessionId: string) =>
    ipcRenderer.invoke('terminal:close', sessionId),
  onTerminalData: (cb: (payload: { sessionId: string; data: string }) => void): (() => void) => {
    const l = (_e: Electron.IpcRendererEvent, p: { sessionId: string; data: string }) => cb(p);
    ipcRenderer.on('terminal:data', l);
    return () => ipcRenderer.removeListener('terminal:data', l);
  },
  onTerminalExit: (cb: (payload: { sessionId: string; code?: number }) => void): (() => void) => {
    const l = (_e: Electron.IpcRendererEvent, p: { sessionId: string; code?: number }) => cb(p);
    ipcRenderer.on('terminal:exit', l);
    return () => ipcRenderer.removeListener('terminal:exit', l);
  },

  sftpList: (serverId: string, remotePath: string) => ipcRenderer.invoke('sftp:list', serverId, remotePath),
  sftpRead: (serverId: string, remotePath: string) => ipcRenderer.invoke('sftp:read', serverId, remotePath),
  sftpWrite: (serverId: string, remotePath: string, content: string) => ipcRenderer.invoke('sftp:write', serverId, remotePath, content),
  sftpUpload: (serverId: string, remoteDir: string) => ipcRenderer.invoke('sftp:upload', serverId, remoteDir),
  sftpDownload: (serverId: string, remotePath: string) => ipcRenderer.invoke('sftp:download', serverId, remotePath),
  sftpMkdir: (serverId: string, remotePath: string) => ipcRenderer.invoke('sftp:mkdir', serverId, remotePath),
  sftpRename: (serverId: string, oldPath: string, newPath: string) => ipcRenderer.invoke('sftp:rename', serverId, oldPath, newPath),
  sftpStat: (serverId: string, remotePath: string) => ipcRenderer.invoke('sftp:stat', serverId, remotePath),
  sftpDelete: (serverId: string, remotePath: string, isDir: boolean) => ipcRenderer.invoke('sftp:delete', serverId, remotePath, isDir),

  listSavedCommands: () => ipcRenderer.invoke('commands:list'),
  saveCommand: (c: Record<string, unknown>) => ipcRenderer.invoke('commands:save', c),
  deleteSavedCommand: (id: string) => ipcRenderer.invoke('commands:delete', id),
  executeMultiServerCommand: (serverIds: string[], commandText: string, commandId?: string) =>
    ipcRenderer.invoke('commands:execute', serverIds, commandText, commandId),
  listCommandExecutions: () => ipcRenderer.invoke('commands:history'),

  listServerBackups: (serverId?: string) => ipcRenderer.invoke('server-backups:list', serverId),
  createServerBackup: (input: Record<string, unknown>) => ipcRenderer.invoke('server-backups:create', input),
  restoreServerBackup: (backupId: string) => ipcRenderer.invoke('server-backups:restore', backupId),
  deleteServerBackup: (id: string) => ipcRenderer.invoke('server-backups:delete', id),
  listBackupSchedules: () => ipcRenderer.invoke('server-backups:list-schedules'),
  saveBackupSchedule: (s: Record<string, unknown>) => ipcRenderer.invoke('server-backups:save-schedule', s),
  deleteBackupSchedule: (id: string) => ipcRenderer.invoke('server-backups:delete-schedule', id),

  listAutomationRules: () => ipcRenderer.invoke('automation:list'),
  saveAutomationRule: (r: Record<string, unknown>) => ipcRenderer.invoke('automation:save', r),
  deleteAutomationRule: (id: string) => ipcRenderer.invoke('automation:delete', id),
  runAutomationRuleNow: (id: string) => ipcRenderer.invoke('automation:run-now', id),
  listAutomationExecutions: (ruleId?: string) => ipcRenderer.invoke('automation:history', ruleId),

  listServerGroups: () => ipcRenderer.invoke('server-groups:list'),
  saveServerGroup: (g: Record<string, unknown>) => ipcRenderer.invoke('server-groups:save', g),
  deleteServerGroup: (id: string) => ipcRenderer.invoke('server-groups:delete', id),
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
