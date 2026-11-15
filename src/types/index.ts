export type PageId =
  | 'overview'
  | 'monitors'
  | 'monitor-detail'
  | 'groups'
  | 'services'
  | 'dependency-map'
  | 'incidents'
  | 'ssl'
  | 'dns'
  | 'network'
  | 'heartbeats'
  | 'intelligence'
  | 'notifications'
  | 'reports'
  | 'maintenance'
  | 'servers'
  | 'server-detail'
  | 'containers'
  | 'remote-services'
  | 'pm2'
  | 'pm2-detail'
  | 'server-groups'
  | 'terminal'
  | 'sftp'
  | 'commands'
  | 'installer'
  | 'apps'
  | 'templates'
  | 'backups'
  | 'automation'
  | 'settings';

export type CheckState = 'UP' | 'DEGRADED' | 'DOWN';
export type MonitorStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'PAUSED' | 'NO_DATA';
export type MonitorType =
  | 'http'
  | 'ssl'
  | 'dns'
  | 'tcp'
  | 'ping'
  | 'keyword'
  | 'heartbeat'
  | 'content'
  | 'domain';

export type HttpMethod =
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS';

export type CheckIntervalSeconds = 30 | 60 | 120 | 300;
export type TimeRangeFilter = '1h' | '6h' | '24h' | '7d' | '30d';
export type AnalyticsRange = '24h' | '7d' | '30d';
export type IncidentSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface UptimeStats {
  uptime24h: number | null;
  uptime7d: number | null;
  uptime30d: number | null;
  uptimeTotal: number | null;
  appHealthTotal: number | null;
  avgResponseTimeMs: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
  totalChecks: number;
  upChecks: number;
  degradedChecks: number;
  downChecks: number;
}

export interface MonitorHistoryTick {
  checkedAt: string;
  state: CheckState;
  responseTime: number | null;
  statusCode: number | null;
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  monitorType: MonitorType;
  method: HttpMethod;
  interval: CheckIntervalSeconds;
  timeout: number;
  expectedStatusCodes: string;
  groupId: string | null;
  tags: string[];
  hasAuthSecret: boolean;
  config: Record<string, unknown>;
  enabled: boolean;
  status: MonitorStatus;
  networkConnected: boolean | null;
  httpResponseReceived: boolean | null;
  applicationHealthy: boolean | null;
  responseTimeMs: number | null;
  httpStatusCode: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  stats: UptimeStats;
  recentHistory: MonitorHistoryTick[];
  createdAt: string;
  updatedAt: string;
}

export interface MonitorFormData {
  name: string;
  url: string;
  monitorType: MonitorType;
  intervalSeconds: CheckIntervalSeconds;
  timeoutSeconds: number;
  method: HttpMethod;
  expectedStatusCodes: string;
  groupId: string | null;
  tags: string[];
  config: Record<string, unknown>;
}

export interface CheckRecordDTO {
  id: number;
  monitorId: string;
  checkedAt: string;
  responseTime: number | null;
  statusCode: number | null;
  state: CheckState;
  networkConnected: number;
  httpResponseReceived: number;
  applicationHealthy: number;
  success: number;
  errorMessage: string | null;
  detailsJson?: string | null;
}

export interface RecentCheckDTO extends CheckRecordDTO {
  monitorName: string;
  monitorUrl: string;
  monitorMethod: HttpMethod;
}

export interface IncidentDTO {
  id: string;
  monitorId: string;
  monitorName?: string;
  monitorUrl?: string;
  title: string | null;
  description: string | null;
  severity: IncidentSeverity;
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  status: 'open' | 'resolved';
  incidentType: 'DOWN' | 'DEGRADED';
  acknowledged: number;
  acknowledgedAt: string | null;
  resolutionNote: string | null;
  errorMessage: string | null;
}

export interface IncidentEventDTO {
  id: number;
  incidentId: string;
  eventType: string;
  message: string;
  createdAt: string;
}

export interface MonitorGroupDTO {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceHealthDTO {
  serviceId: string;
  name: string;
  description: string;
  health: 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  directState: 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  derivedFromDependency: boolean;
  rootCauseServiceIds: string[];
  rootCauseMonitorIds: string[];
  componentCount: number;
  staleThresholdSeconds: number;
}

export interface ServiceDependencyDTO {
  id: string;
  serviceId: string;
  dependsOnServiceId: string;
  isCritical: number;
  createdAt: string;
}

export interface ServicesOverviewPayload {
  services: ServiceHealthDTO[];
  links: Array<{ serviceId: string; monitorId: string; isCritical: number }>;
  dependencies: ServiceDependencyDTO[];
}


export type SmtpProvider = 'custom' | 'brevo' | 'gmail' | 'outlook';
export type SmtpSecurityMode = 'none' | 'starttls' | 'tls';

export interface SafeSmtpChannelConfig {
  provider: SmtpProvider;
  host: string;
  port: number;
  security: SmtpSecurityMode;
  authEnabled: boolean;
  username: string;
  hasPassword: boolean;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
}

export interface NotificationChannelDTO {
  id: string;
  name: string;
  type: 'discord' | 'telegram' | 'email' | 'desktop' | 'webhook';
  enabled: boolean;
  createdAt: string;
}

export interface NotificationHistoryDTO {
  id: number;
  channelId: string;
  monitorId: string | null;
  incidentId: string | null;
  eventType: string;
  status: 'sent' | 'failed' | 'suppressed';
  errorMessage: string | null;
  sentAt: string;
}

export interface MaintenanceWindowDTO {
  id: string;
  name: string;
  monitorId: string | null;
  groupId: string | null;
  startsAt: string;
  endsAt: string;
  enabled: number;
  createdAt: string;
}

export interface SslResultDTO {
  id: number;
  monitorId: string;
  checkedAt: string;
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  hostnameValid: number;
  chainValid: number;
  tlsVersion: string | null;
  errorMessage: string | null;
}

export interface DnsResultDTO {
  id: number;
  monitorId: string;
  checkedAt: string;
  recordType: string;
  resolver: string;
  lookupMs: number;
  recordsJson: string;
  changed: number;
  errorMessage: string | null;
}

export interface OverviewPayload {
  monitors: Monitor[];
  recentChecks: RecentCheckDTO[];
  latencyPoints: Array<{
    time: string;
    responseTime: number;
    state: CheckState;
  }>;
}

export interface MonitorDetailPayload {
  monitor: Monitor;
  checks: CheckRecordDTO[];
  incidents: IncidentDTO[];
  sslResults: SslResultDTO[];
  dnsResults: DnsResultDTO[];
  domainResults: Array<{
    id: number;
    domain: string;
    registrar: string | null;
    expiresAt: string | null;
    daysRemaining: number | null;
    errorMessage: string | null;
    checkedAt: string;
  }>;
  heartbeatEvents: Array<{
    id: number;
    receivedAt: string;
    sourceIp: string | null;
  }>;
  latestContent: {
    checkedAt: string;
    contentHash: string;
    snippet: string;
    changed: number;
  } | null;
}

export interface AnalyticsPayload {
  monitors: Monitor[];
  checks: CheckRecordDTO[];
  stats: UptimeStats;
}

export type SchedulerEventPayload =
  | { type: 'check-completed'; monitorId: string; check: CheckRecordDTO }
  | {
      type: 'status-changed';
      monitorId: string;
      monitorName: string;
      status: CheckState;
    }
  | { type: 'monitor-updated'; monitorId: string }
  | { type: 'monitor-deleted'; monitorId: string }
  | { type: 'incident-updated'; monitorId: string };

export type ThemePreference = 'dark' | 'midnight' | 'oled';


export interface AppSettings {
  theme: ThemePreference;
  defaultIntervalSeconds: CheckIntervalSeconds;
  defaultTimeoutSeconds: number;
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  retentionDays: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'alert';
  read: boolean;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'warning' | 'info';
}

export interface CustomThemeRecord {
  id: string;
  name: string;
  themeJson: string;
  isDefault: number;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeStatePayload {
  themes: CustomThemeRecord[];
  activeThemeId: string;
  safeMode: boolean;
}

export interface UserProfileState {
  username: string | null;
  onboardingCompleted: boolean;
}

export interface ElectronAppInfo {
  name: string;
  version: string;
  platform: string;
  electron: string;
  chrome: string;
  node: string;
  dbPath: string;
  heartbeatPort: number;
  loginItemEnabled: boolean;
}


export interface ServerMetricDTO {
  id: number;
  serverId: string;
  collectedAt: string;
  cpuPercent: number;
  ramPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  diskPercent: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  netRxBytesPerSec: number;
  netTxBytesPerSec: number;
  uptimeSeconds: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  detailsJson: string | null;
}

export interface RemoteServerDTO {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  hostFingerprint: string | null;
  agentPort: number;
  groupName: string;
  tags: string[];
  pollIntervalSeconds: number;
  cpuThreshold: number;
  ramThreshold: number;
  diskThreshold: number;
  enabled: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  hostname: string | null;
  osInfo: string | null;
  kernelVersion: string | null;
  cpuCores: number | null;
  totalMemoryBytes: number | null;
  agentVersion: string | null;
  lastSeenAt: string | null;
  lastError: string | null;
  latestMetric: ServerMetricDTO | null;
  createdAt: string;
  updatedAt: string;
}

export interface DockerContainerDTO {
  id: string;
  fullId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: string | null;
}

export interface RemoteServiceDTO {
  name: string;
  displayName: string;
  description: string;
  activeState: string;
  enabledState: string;
  platform: 'linux' | 'windows';
}

export interface RemoteAuditLogDTO {
  id: number;
  serverId: string;
  action: string;
  target: string;
  status: 'success' | 'failed';
  details: string | null;
  createdAt: string;
}


export interface Pm2InstanceDTO {
  id: string;
  serverId: string;
  linuxUser: string;
  pm2Path: string | null;
  daemonAvailable: number;
  accessible: number;
  processCount: number;
  lastError: string | null;
  updatedAt: string;
}

export interface Pm2ProcessDTO {
  id: string;
  serverId: string;
  processKey: string;
  pmId: number;
  name: string;
  linuxUser: string;
  status: string;
  state: 'online' | 'stopped' | 'errored' | 'launching' | 'unknown';
  cpu: number;
  memoryBytes: number;
  uptimeSeconds: number;
  restarts: number;
  unstableRestarts: number;
  execMode: string;
  instances: number;
  nodeVersion: string | null;
  scriptPath: string | null;
  cwd: string | null;
  lastRestartAt: string | null;
  pid: number | null;
  envName: string | null;
  intentionalStop: number;
  updatedAt: string;
}

export interface Pm2MetricHistoryDTO {
  id: number;
  serverId: string;
  processKey: string;
  collectedAt: string;
  cpu: number;
  memoryBytes: number;
  restarts: number;
  state: string;
}

export interface Pm2StateEventDTO {
  id: number;
  serverId: string;
  processKey: string;
  processName: string;
  linuxUser: string;
  previousState: string;
  newState: string;
  eventType: string;
  message: string;
  createdAt: string;
}

export interface Pm2AlertConfigDTO {
  serverId: string;
  cpuThreshold: number;
  memoryMbThreshold: number;
  restartSpikeThreshold: number;
  cooldownSeconds: number;
  enabled: number;
}

export interface Pm2LogsPayload {
  stdout: { exists: boolean; lines: string[] };
  stderr: { exists: boolean; lines: string[] };
}


export interface InstallerConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'password' | 'boolean' | 'select';
  required?: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  description?: string;
  options?: Array<{ label: string; value: string }>;
  advancedOnly?: boolean;
  secret?: boolean;
}

export interface DiscoveredVersionDTO {
  tag: string;
  version: string;
  channel: 'stable' | 'beta' | 'rc' | 'older';
  publishedAt: string | null;
  releaseNotesUrl: string | null;
}

export interface VersionDiscoveryResultDTO {
  installerId: string;
  upstreamSource: string;
  upstreamUrl: string;
  latestStable: DiscoveredVersionDTO | null;
  latestBeta: DiscoveredVersionDTO | null;
  versions: DiscoveredVersionDTO[];
  fetchedAt: string;
  fromCache: boolean;
  staleReason?: string;
}

export interface InstallerCatalogItem {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  publisher: string;
  source: 'official' | 'community';
  verificationStatus: 'production_ready' | 'beta' | 'experimental' | 'community';
  supportedOs: string[];
  supportedArch: string[];
  minDiskMb: number;
  minRamMb: number;
  requiredPorts: number[];
  dependencies: string[];
  requiredPrivileges: 'root_or_sudo' | 'user';
  supportsOneClick: boolean;
  supportsGuided: boolean;
  rollbackAvailable: boolean;
  rollbackNote: string;
  docsUrl?: string;
  configSchema: InstallerConfigField[];
  policy: 'always_review' | 'automatic' | 'per_installer';
  installedCount?: number;
}

export interface PreflightResultDTO {
  passed: boolean;
  osName: string;
  osVersion: string;
  arch: string;
  pkgManager: string;
  freeDiskMb: number;
  freeMemMb: number;
  isRootOrSudo: boolean;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    actual: string;
    required: string;
    blocking: boolean;
  }>;
}

export interface DeploymentPlanDTO {
  installerId: string;
  installerName: string;
  version: string;
  serverId: string;
  serverName: string;
  installDir: string;
  packages: string[];
  servicesToCreate: string[];
  portsToOpen: number[];
  filesToModify: string[];
  configSummary: Array<{ label: string; value: string; secret?: boolean }>;
  requiredPrivileges: 'root_or_sudo' | 'user';
  estimatedDiskMb: number;
  estimatedRamMb: number;
  rollbackAvailable: boolean;
  rollbackNote: string;
  hasDestructiveOperations: boolean;
  destructiveWarnings: string[];
}

export interface InstallationJobDTO {
  id: string;
  serverId: string;
  installerId: string;
  installerName: string;
  version: string;
  source: string;
  mode: string;
  status: string;
  approvalPolicy: string;
  approvedByUser: number;
  configJson: string;
  planJson: string;
  preflightJson: string;
  logs: string;
  errorMessage: string | null;
  failedStep: string | null;
  recoveryInstructions: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface InstalledAppDTO {
  id: string;
  serverId: string;
  installerId: string;
  name: string;
  version: string;
  source: string;
  installDir: string;
  serviceName: string | null;
  containerName: string | null;
  port: number | null;
  url: string | null;
  status: string;
  lastHealthCheckAt: string | null;
  lastHealthStatus: string | null;
  updateAvailable: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentTemplateDTO {
  id: string;
  name: string;
  description: string;
  category: string;
  installerIds: string[];
  estimatedRamMb: number;
  estimatedDiskMb: number;
  variables: Array<{ key: string; label: string; defaultValue: string; secret?: boolean }>;
  notes: string;
}

export interface SftpEntryDTO {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number;
  permissions: string;
}

export interface SavedCommandDTO {
  id: string;
  name: string;
  description: string;
  commandTemplate: string;
  variablesJson: string;
  isDestructive: number;
  createdAt: string;
}

export interface ServerBackupDTO {
  id: string;
  serverId: string;
  appId: string | null;
  backupType: string;
  targetPath: string;
  archivePath: string;
  sizeBytes: number;
  verified: number;
  verificationNote: string | null;
  retentionDays: number;
  createdAt: string;
}

export interface BackupScheduleDTO {
  id: string;
  serverId: string;
  backupType: string;
  targetPath: string;
  intervalHours: number;
  retentionDays: number;
  enabled: number;
  lastRunAt: string | null;
}

export interface AutomationRuleDTO {
  id: string;
  name: string;
  description: string;
  serverId: string;
  triggerType: string;
  conditionJson: string;
  actionType: string;
  actionConfigJson: string;
  cooldownSeconds: number;
  maxRetries: number;
  enabled: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

export interface ServerGroupDTO {
  id: string;
  name: string;
  description: string;
  color: string;
  serverIds: string[];
}

declare global {
  interface Window {
    surfMonitorAPI?: {
      getAppInfo: () => Promise<ElectronAppInfo>;
      openExternal: (url: string) => Promise<boolean>;
      setDesktopPrefs: (prefs: {
        launchOnStartup?: boolean;
        minimizeToTray?: boolean;
      }) => Promise<boolean>;
      getMonitors: () => Promise<Monitor[]>;
      getMonitorDetail: (
        id: string,
        range: TimeRangeFilter
      ) => Promise<MonitorDetailPayload>;
      createMonitor: (data: Record<string, unknown>) => Promise<Monitor>;
      updateMonitor: (
        id: string,
        data: Record<string, unknown>
      ) => Promise<Monitor>;
      deleteMonitor: (id: string) => Promise<boolean>;
      toggleMonitor: (id: string, enabled: boolean) => Promise<Monitor>;
      runManualCheck: (id: string) => Promise<CheckRecordDTO | null>;
      getOverviewData: (range: TimeRangeFilter) => Promise<OverviewPayload>;
      getAnalyticsData: (range: AnalyticsRange) => Promise<AnalyticsPayload>;
      getIncidents: () => Promise<IncidentDTO[]>;
      getIncidentEvents: (incidentId: string) => Promise<IncidentEventDTO[]>;
      addIncidentNote: (
        incidentId: string,
        note: string
      ) => Promise<IncidentEventDTO[]>;
      updateIncident: (
        id: string,
        updates: Record<string, unknown>
      ) => Promise<IncidentDTO | undefined>;
      getGroups: () => Promise<MonitorGroupDTO[]>;
      createGroup: (input: Record<string, unknown>) => Promise<MonitorGroupDTO>;
      deleteGroup: (id: string) => Promise<boolean>;
      getServicesOverview: () => Promise<ServicesOverviewPayload>;
      createService: (
        input: Record<string, unknown>
      ) => Promise<{ id: string; name: string }>;
      deleteService: (id: string) => Promise<boolean>;
      linkServiceMonitor: (
        serviceId: string,
        monitorId: string,
        isCritical: boolean
      ) => Promise<boolean>;
      unlinkServiceMonitor: (
        serviceId: string,
        monitorId: string
      ) => Promise<boolean>;
      addServiceDependency: (
        serviceId: string,
        dependsOnServiceId: string,
        isCritical: boolean
      ) => Promise<ServiceDependencyDTO>;
      removeServiceDependency: (id: string) => Promise<boolean>;
      getNotificationChannels: () => Promise<NotificationChannelDTO[]>;
      createNotificationChannel: (
        input: Record<string, unknown>
      ) => Promise<NotificationChannelDTO>;
      deleteNotificationChannel: (id: string) => Promise<boolean>;
      getNotificationChannelSafe: (id: string) => Promise<{ id: string; name: string; type: string; smtp?: SafeSmtpChannelConfig }>;
      updateNotificationChannel: (id: string, input: { name: string; config: Record<string, unknown>; clearPassword?: boolean }) => Promise<NotificationChannelDTO>;
      testSmtpConnection: (input: { channelId?: string; config: Record<string, unknown> }) => Promise<{ ok: boolean; message?: string; error?: string }>;
      sendSmtpTestEmail: (input: { channelId?: string; config: Record<string, unknown> }) => Promise<{ ok: boolean; message?: string; error?: string }>;
      testNotificationChannel: (
        id: string
      ) => Promise<{ ok: boolean; error?: string }>;
      getNotificationHistory: () => Promise<NotificationHistoryDTO[]>;
      analyzeRedirects: (url: string) => Promise<{
        originalUrl: string;
        finalUrl: string;
        hops: Array<{ url: string; statusCode: number; location: string | null }>;
        redirectCount: number;
        loopDetected: boolean;
        errorMessage: string | null;
      }>;
      analyzeSecurityHeaders: (url: string) => Promise<{
        url: string;
        statusCode: number | null;
        present: Array<{ name: string; value: string }>;
        missing: Array<{ name: string; recommendation: string }>;
        errorMessage: string | null;
      }>;
      getBrokenLinkScans: () => Promise<
        Array<{
          id: string;
          targetUrl: string;
          startedAt: string;
          completedAt: string | null;
          pagesScanned: number;
          brokenCount: number;
          status: string;
        }>
      >;
      getBrokenLinkResults: (
        scanId: string
      ) => Promise<
        Array<{
          id: number;
          pageUrl: string;
          linkUrl: string;
          statusCode: number | null;
          broken: number;
          errorMessage: string | null;
        }>
      >;
      runBrokenLinkScan: (
        targetUrl: string,
        maxPages?: number,
        maxDepth?: number
      ) => Promise<{
        scanId: string;
        scans: Array<{
          id: string;
          targetUrl: string;
          startedAt: string;
          completedAt: string | null;
          pagesScanned: number;
          brokenCount: number;
          status: string;
        }>;
        results: Array<{
          id: number;
          pageUrl: string;
          linkUrl: string;
          statusCode: number | null;
          broken: number;
          errorMessage: string | null;
        }>;
      }>;
      getMaintenanceWindows: () => Promise<MaintenanceWindowDTO[]>;
      createMaintenanceWindow: (
        input: Record<string, unknown>
      ) => Promise<MaintenanceWindowDTO>;
      deleteMaintenanceWindow: (id: string) => Promise<boolean>;
      updateMaintenanceWindow: (id: string, updates: { endsAt?: string; enabled?: boolean }) => Promise<boolean>;
      getBackups: () => Promise<
        Array<{
          id: string;
          filePath: string;
          sizeBytes: number;
          createdAt: string;
          type: string;
        }>
      >;
      createBackup: () => Promise<{
        id: string;
        filePath: string;
        sizeBytes: number;
        createdAt: string;
        type: string;
      }>;
      cleanupDatabase: (
        retentionDays: number
      ) => Promise<{ checksDeleted: number; notificationsDeleted: number }>;
      exportMonitorsJson: () => Promise<string | null>;
      exportIncidentsCsv: () => Promise<string | null>;
      pickSshKeyFile: () => Promise<{ path: string; content: string } | null>;
      getRemoteServers: () => Promise<RemoteServerDTO[]>;
      getRemoteServerDetail: (id: string) => Promise<{
        server: RemoteServerDTO;
        metrics: ServerMetricDTO[];
        auditLogs: RemoteAuditLogDTO[];
      }>;
      testSshConnection: (params: Record<string, unknown>) => Promise<{
        sshConnected: boolean;
        hostFingerprint: string | null;
        agentInstalled: boolean;
        agentHealthy: boolean;
        agentVersion: string | null;
        error: string | null;
      }>;
      installRemoteAgent: (params: Record<string, unknown>) => Promise<{
        ok: boolean;
        token: string | null;
        fingerprint: string | null;
        output: string;
      }>;
      createRemoteServer: (input: Record<string, unknown>) => Promise<string>;
      updateRemoteServer: (id: string, input: Record<string, unknown>) => Promise<string>;
      upgradeRemoteServerAgent: (id: string) => Promise<{ ok: boolean; token: string | null; fingerprint: string | null; output: string }>;
      getPm2Overview: () => Promise<{ servers: RemoteServerDTO[]; instances: Pm2InstanceDTO[]; processes: Pm2ProcessDTO[] }>;
      refreshPm2: (serverId?: string) => Promise<{ servers: RemoteServerDTO[]; instances: Pm2InstanceDTO[]; processes: Pm2ProcessDTO[] }>;
      getPm2ProcessDetail: (serverId: string, processKey: string) => Promise<{ process: Pm2ProcessDTO; history: Pm2MetricHistoryDTO[]; events: Pm2StateEventDTO[]; alertConfig: Pm2AlertConfigDTO }>;
      getPm2ProcessLogs: (serverId: string, linuxUser: string, pmId: number, lines?: number) => Promise<Pm2LogsPayload>;
      runPm2Action: (serverId: string, linuxUser: string, pmId: number, action: string) => Promise<unknown>;
      savePm2AlertConfig: (config: Pm2AlertConfigDTO) => Promise<Pm2AlertConfigDTO>;
      deleteRemoteServer: (id: string) => Promise<boolean>;
      toggleRemoteServer: (id: string, enabled: boolean) => Promise<boolean>;
      pollRemoteServerNow: (id: string) => Promise<boolean>;
      getDockerContainers: (serverId: string) => Promise<{
        available: boolean;
        version?: string;
        containers: DockerContainerDTO[];
      }>;
      runDockerAction: (
        serverId: string,
        containerId: string,
        action: string
      ) => Promise<unknown>;
      getRemoteServices: (serverId: string) => Promise<{
        services: RemoteServiceDTO[];
      }>;
      runRemoteServiceAction: (
        serverId: string,
        serviceName: string,
        action: string
      ) => Promise<unknown>;
      onRemoteEvent: (
        callback: (event: { serverId: string }) => void
      ) => () => void;
      getProfileState: () => Promise<UserProfileState>;
      setUsername: (username: string) => Promise<UserProfileState>;
      completeOnboarding: (username?: string) => Promise<UserProfileState>;
      getPersistedSettings: () => Promise<Record<string, unknown> | null>;
      savePersistedSettings: (obj: Record<string, unknown>) => Promise<boolean>;
      getStartupTimings: () => Promise<Record<string, number>>;
      getThemeState: () => Promise<ThemeStatePayload>;
      saveCustomTheme: (input: {
        id: string;
        name: string;
        themeJson: string;
        isDefault?: boolean;
      }) => Promise<CustomThemeRecord>;
      deleteCustomTheme: (id: string) => Promise<boolean>;
      setActiveThemeId: (id: string) => Promise<boolean>;
      setThemeSafeMode: (enabled: boolean) => Promise<boolean>;
      exportThemeFile: (defaultFilename: string, content: string) => Promise<string | null>;
      importThemeFile: (kind: 'json' | 'css') => Promise<string | null>;
      pickThemeBgImage: () => Promise<string | null>;
      getInstallerCatalog: () => Promise<InstallerCatalogItem[]>;
      getInstallerVersions: (installerId: string, forceRefresh?: boolean) => Promise<VersionDiscoveryResultDTO>;
      listDeploymentTemplates: () => Promise<DeploymentTemplateDTO[]>;
      runInstallerPreflight: (
        installerId: string,
        serverId: string,
        config: Record<string, unknown>
      ) => Promise<{ preflight: PreflightResultDTO; plan: DeploymentPlanDTO; policy: string }>;
      startInstallationJob: (params: Record<string, unknown>) => Promise<InstallationJobDTO>;
      cancelInstallationJob: (jobId: string) => Promise<boolean>;
      listInstallationJobs: (limit?: number) => Promise<InstallationJobDTO[]>;
      getInstallationJob: (jobId: string) => Promise<InstallationJobDTO | null>;
      setInstallerPolicy: (installerId: string, policy: string) => Promise<boolean>;
      listCommunityInstallers: () => Promise<Array<Record<string, unknown>>>;
      importCommunityInstaller: () => Promise<{ saved: Record<string, unknown>; warnings: string[] } | null>;
      setCommunityInstallerTrust: (packageId: string, trustStatus: string) => Promise<boolean>;
      deleteCommunityInstaller: (packageId: string) => Promise<boolean>;
      onInstallerJobEvent: (cb: (payload: { jobId: string; status: string; logLine?: string }) => void) => () => void;

      listInstalledApps: (serverId?: string) => Promise<InstalledAppDTO[]>;
      runInstalledAppAction: (appId: string, action: 'start' | 'stop' | 'restart' | 'logs') => Promise<{ code: number; stdout: string; stderr: string }>;
      deleteInstalledApp: (appId: string) => Promise<boolean>;

      openTerminalSession: (sessionId: string, serverId: string, cols: number, rows: number) => Promise<boolean>;
      writeTerminalSession: (sessionId: string, data: string) => Promise<boolean>;
      resizeTerminalSession: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
      closeTerminalSession: (sessionId: string) => Promise<boolean>;
      onTerminalData: (cb: (payload: { sessionId: string; data: string }) => void) => () => void;
      onTerminalExit: (cb: (payload: { sessionId: string; code?: number }) => void) => () => void;

      sftpList: (serverId: string, remotePath: string) => Promise<SftpEntryDTO[]>;
      sftpRead: (serverId: string, remotePath: string) => Promise<string>;
      sftpWrite: (serverId: string, remotePath: string, content: string) => Promise<boolean>;
      sftpUpload: (serverId: string, remoteDir: string) => Promise<string | null>;
      sftpDownload: (serverId: string, remotePath: string) => Promise<string | null>;
      sftpMkdir: (serverId: string, remotePath: string) => Promise<boolean>;
      sftpRename: (serverId: string, oldPath: string, newPath: string) => Promise<boolean>;
      sftpStat: (serverId: string, remotePath: string) => Promise<{ size: number; mtime: number; permissions: string; isDir: boolean }>;
      sftpDelete: (serverId: string, remotePath: string, isDir: boolean) => Promise<boolean>;

      listSavedCommands: () => Promise<SavedCommandDTO[]>;
      saveCommand: (c: Record<string, unknown>) => Promise<SavedCommandDTO>;
      deleteSavedCommand: (id: string) => Promise<boolean>;
      executeMultiServerCommand: (serverIds: string[], commandText: string, commandId?: string) => Promise<Array<{ serverId: string; serverName: string; code: number; output: string }>>;
      listCommandExecutions: () => Promise<Array<Record<string, unknown>>>;

      listServerBackups: (serverId?: string) => Promise<ServerBackupDTO[]>;
      createServerBackup: (input: Record<string, unknown>) => Promise<ServerBackupDTO>;
      restoreServerBackup: (backupId: string) => Promise<boolean>;
      deleteServerBackup: (id: string) => Promise<boolean>;
      listBackupSchedules: () => Promise<BackupScheduleDTO[]>;
      saveBackupSchedule: (s: Record<string, unknown>) => Promise<BackupScheduleDTO>;
      deleteBackupSchedule: (id: string) => Promise<boolean>;

      listAutomationRules: () => Promise<AutomationRuleDTO[]>;
      saveAutomationRule: (r: Record<string, unknown>) => Promise<AutomationRuleDTO>;
      deleteAutomationRule: (id: string) => Promise<boolean>;
      runAutomationRuleNow: (id: string) => Promise<{ ok: boolean; output: string }>;
      listAutomationExecutions: (ruleId?: string) => Promise<Array<Record<string, unknown>>>;

      listServerGroups: () => Promise<ServerGroupDTO[]>;
      saveServerGroup: (g: Record<string, unknown>) => Promise<ServerGroupDTO>;
      deleteServerGroup: (id: string) => Promise<boolean>;

      onMonitorEvent: (
        callback: (event: SchedulerEventPayload) => void
      ) => () => void;
    };
  }
}
