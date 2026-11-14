import Database from 'better-sqlite3';
import {
  CheckState,
  DEFAULT_EXPECTED_STATUS_CODES,
} from '../engine/statusClassifier';

export type HttpMethod =
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS';

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

export type IncidentSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface MonitorRecord {
  id: string;
  name: string;
  url: string;
  monitorType: MonitorType;
  method: HttpMethod;
  interval: number;
  timeout: number;
  expectedStatusCodes: string;
  groupId: string | null;
  tags: string; // JSON array
  configJson: string; // JSON object
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMonitorInput {
  name: string;
  url: string;
  monitorType?: MonitorType;
  method?: HttpMethod;
  interval: number;
  timeout: number;
  expectedStatusCodes?: string;
  groupId?: string | null;
  tags?: string[];
  configJson?: string;
}

export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  monitorType?: MonitorType;
  method?: HttpMethod;
  interval?: number;
  timeout?: number;
  expectedStatusCodes?: string;
  groupId?: string | null;
  tags?: string[];
  configJson?: string;
  enabled?: boolean;
}

export interface CheckRecord {
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
  detailsJson: string | null;
}

export interface InsertCheckInput {
  monitorId: string;
  checkedAt: string;
  responseTime: number | null;
  statusCode: number | null;
  state: CheckState;
  networkConnected: boolean;
  httpResponseReceived: boolean;
  applicationHealthy: boolean;
  success: boolean;
  errorMessage: string | null;
  detailsJson?: string | null;
}

export interface IncidentRecord {
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
  rootCauseMonitorId: string | null;
  errorMessage: string | null;
}

export interface IncidentEventRecord {
  id: number;
  incidentId: string;
  eventType: string;
  message: string;
  createdAt: string;
}

export interface MonitorGroupRecord {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRecord {
  id: string;
  name: string;
  description: string;
  staleThresholdSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceMonitorLink {
  serviceId: string;
  monitorId: string;
  isCritical: number;
}

export interface ServiceDependencyRecord {
  id: string;
  serviceId: string;
  dependsOnServiceId: string;
  isCritical: number;
  createdAt: string;
}

export interface NotificationChannelRecord {
  id: string;
  name: string;
  type: 'discord' | 'telegram' | 'email' | 'desktop' | 'webhook';
  configEncrypted: string;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRuleRecord {
  id: string;
  channelId: string;
  monitorId: string | null;
  serviceId: string | null;
  eventsJson: string;
  cooldownSeconds: number;
  enabled: number;
}

export interface NotificationHistoryRecord {
  id: number;
  channelId: string;
  monitorId: string | null;
  incidentId: string | null;
  eventType: string;
  status: 'sent' | 'failed' | 'suppressed';
  errorMessage: string | null;
  sentAt: string;
}



export interface Pm2InstanceRecord {
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

export interface Pm2ProcessRecord {
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

export interface Pm2MetricHistoryRecord {
  id: number;
  serverId: string;
  processKey: string;
  collectedAt: string;
  cpu: number;
  memoryBytes: number;
  restarts: number;
  state: string;
}

export interface Pm2StateEventRecord {
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

export interface Pm2AlertConfigRecord {
  serverId: string;
  cpuThreshold: number;
  memoryMbThreshold: number;
  restartSpikeThreshold: number;
  cooldownSeconds: number;
  enabled: number;
}

export interface MaintenanceWindowRecord {
  id: string;
  name: string;
  monitorId: string | null;
  groupId: string | null;
  startsAt: string;
  endsAt: string;
  enabled: number;
  createdAt: string;
}

export interface SslResultRecord {
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

export interface DnsResultRecord {
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

export interface ContentSnapshotRecord {
  id: number;
  monitorId: string;
  checkedAt: string;
  contentHash: string;
  snippet: string;
  changed: number;
  diffSummary: string | null;
}

export interface HeartbeatEventRecord {
  id: number;
  monitorId: string;
  receivedAt: string;
  sourceIp: string | null;
  payload: string | null;
}

export interface DomainResultRecord {
  id: number;
  monitorId: string;
  checkedAt: string;
  domain: string;
  registrar: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  errorMessage: string | null;
}

export interface BrokenLinkScanRecord {
  id: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string | null;
  pagesScanned: number;
  brokenCount: number;
  status: 'running' | 'completed' | 'failed';
}

export interface BrokenLinkResultRecord {
  id: number;
  scanId: string;
  pageUrl: string;
  linkUrl: string;
  statusCode: number | null;
  broken: number;
  errorMessage: string | null;
}

export interface BackupHistoryRecord {
  id: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  type: 'manual' | 'automatic';
}

export interface CheckTransitionResult {
  check: CheckRecord;
  previousState: CheckState | 'UNKNOWN';
  newState: CheckState;
  incidentChanged: boolean;
  incidentId?: string;
}


export interface RemoteServerRecord {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  encryptedPrivateKey: string;
  encryptedPassphrase: string;
  encryptedAgentToken: string;
  hostFingerprint: string | null;
  agentPort: number;
  groupName: string;
  tags: string;
  pollIntervalSeconds: number;
  cpuThreshold: number;
  ramThreshold: number;
  diskThreshold: number;
  enabled: number;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  hostname: string | null;
  osInfo: string | null;
  kernelVersion: string | null;
  cpuCores: number | null;
  totalMemoryBytes: number | null;
  agentVersion: string | null;
  lastSeenAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServerMetricRecord {
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

export interface RemoteAuditLogRecord {
  id: number;
  serverId: string;
  action: string;
  target: string;
  status: 'success' | 'failed';
  details: string | null;
  createdAt: string;
}



export interface UserProfileRecord {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrialStateRecord {
  id: string;
  machineIdHash: string;
  status: 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'CONVERTED';
  startedAt: string;
  expiresAt: string;
  signedEntitlement: string | null;
  lastServerTime: string | null;
  maxObservedUtcMs: number;
  lastValidatedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface EntitlementHistoryRecord {
  id: number;
  eventType: string;
  status: string;
  source: string;
  details: string | null;
  createdAt: string;
}


export interface CustomThemeRecord {
  id: string;
  name: string;
  themeJson: string;
  isDefault: number;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseStateRecord {
  id: string;
  encryptedLicenseKey: string;
  maskedKey: string;
  machineId: string;
  status: string;
  productName: string | null;
  planName: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  lastAttemptAt: string | null;
  lastResultCode: string | null;
  offlineGraceUntil: string | null;
  machinesUsed: number | null;
  machinesLimit: number | null;
  analyticsEnabled: number;
  updatedAt: string;
}

export class SurfDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.initializeSchema();
  }

  private ensureColumn(
    table: string,
    column: string,
    definition: string
  ): void {
    const cols = this.db
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monitor_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#10b981',
        icon TEXT NOT NULL DEFAULT 'folder',
        tags TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monitors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        monitorType TEXT NOT NULL DEFAULT 'http',
        method TEXT NOT NULL DEFAULT 'GET',
        interval INTEGER NOT NULL,
        timeout INTEGER NOT NULL,
        expectedStatusCodes TEXT NOT NULL DEFAULT '200-399',
        groupId TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        configJson TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (groupId) REFERENCES monitor_groups(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitorId TEXT NOT NULL,
        checkedAt TEXT NOT NULL,
        responseTime INTEGER,
        statusCode INTEGER,
        state TEXT NOT NULL DEFAULT 'UP',
        networkConnected INTEGER NOT NULL DEFAULT 1,
        httpResponseReceived INTEGER NOT NULL DEFAULT 1,
        applicationHealthy INTEGER NOT NULL DEFAULT 1,
        success INTEGER NOT NULL CHECK(success IN (0, 1)),
        errorMessage TEXT,
        detailsJson TEXT,
        FOREIGN KEY (monitorId) REFERENCES monitors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        monitorId TEXT NOT NULL,
        title TEXT,
        description TEXT,
        severity TEXT NOT NULL DEFAULT 'high',
        startedAt TEXT NOT NULL,
        resolvedAt TEXT,
        durationSeconds INTEGER,
        status TEXT NOT NULL CHECK(status IN ('open', 'resolved')),
        incidentType TEXT NOT NULL DEFAULT 'DOWN',
        acknowledged INTEGER NOT NULL DEFAULT 0,
        acknowledgedAt TEXT,
        resolutionNote TEXT,
        rootCauseMonitorId TEXT,
        errorMessage TEXT,
        FOREIGN KEY (monitorId) REFERENCES monitors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS incident_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incidentId TEXT NOT NULL,
        eventType TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (incidentId) REFERENCES incidents(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        staleThresholdSeconds INTEGER NOT NULL DEFAULT 300,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS service_monitors (
        serviceId TEXT NOT NULL,
        monitorId TEXT NOT NULL,
        isCritical INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (serviceId, monitorId),
        FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (monitorId) REFERENCES monitors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS service_dependencies (
        id TEXT PRIMARY KEY,
        serviceId TEXT NOT NULL,
        dependsOnServiceId TEXT NOT NULL,
        isCritical INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        UNIQUE(serviceId, dependsOnServiceId),
        FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (dependsOnServiceId) REFERENCES services(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notification_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        configEncrypted TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_rules (
        id TEXT PRIMARY KEY,
        channelId TEXT NOT NULL,
        monitorId TEXT,
        serviceId TEXT,
        eventsJson TEXT NOT NULL DEFAULT '["DOWN","RECOVERY"]',
        cooldownSeconds INTEGER NOT NULL DEFAULT 300,
        enabled INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (channelId) REFERENCES notification_channels(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notification_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channelId TEXT NOT NULL,
        monitorId TEXT,
        incidentId TEXT,
        eventType TEXT NOT NULL,
        status TEXT NOT NULL,
        errorMessage TEXT,
        sentAt TEXT NOT NULL,
        FOREIGN KEY (channelId) REFERENCES notification_channels(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS maintenance_windows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        monitorId TEXT,
        groupId TEXT,
        startsAt TEXT NOT NULL,
        endsAt TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ssl_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitorId TEXT NOT NULL,
        checkedAt TEXT NOT NULL,
        subject TEXT,
        issuer TEXT,
        validFrom TEXT,
        validTo TEXT,
        daysRemaining INTEGER,
        hostnameValid INTEGER NOT NULL DEFAULT 0,
        chainValid INTEGER NOT NULL DEFAULT 0,
        tlsVersion TEXT,
        errorMessage TEXT,
        FOREIGN KEY (monitorId) REFERENCES monitors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS dns_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitorId TEXT NOT NULL,
        checkedAt TEXT NOT NULL,
        recordType TEXT NOT NULL,
        resolver TEXT NOT NULL,
        lookupMs INTEGER NOT NULL,
        recordsJson TEXT NOT NULL,
        changed INTEGER NOT NULL DEFAULT 0,
        errorMessage TEXT,
        FOREIGN KEY (monitorId) REFERENCES monitors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS content_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitorId TEXT NOT NULL,
        checkedAt TEXT NOT NULL,
        contentHash TEXT NOT NULL,
        snippet TEXT NOT NULL,
        changed INTEGER NOT NULL DEFAULT 0,
        diffSummary TEXT,
        FOREIGN KEY (monitorId) REFERENCES monitors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS heartbeat_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitorId TEXT NOT NULL,
        receivedAt TEXT NOT NULL,
        sourceIp TEXT,
        payload TEXT,
        FOREIGN KEY (monitorId) REFERENCES monitors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS domain_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitorId TEXT NOT NULL,
        checkedAt TEXT NOT NULL,
        domain TEXT NOT NULL,
        registrar TEXT,
        expiresAt TEXT,
        daysRemaining INTEGER,
        errorMessage TEXT,
        FOREIGN KEY (monitorId) REFERENCES monitors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS broken_link_scans (
        id TEXT PRIMARY KEY,
        targetUrl TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        completedAt TEXT,
        pagesScanned INTEGER NOT NULL DEFAULT 0,
        brokenCount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'running'
      );

      CREATE TABLE IF NOT EXISTS broken_link_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scanId TEXT NOT NULL,
        pageUrl TEXT NOT NULL,
        linkUrl TEXT NOT NULL,
        statusCode INTEGER,
        broken INTEGER NOT NULL DEFAULT 0,
        errorMessage TEXT,
        FOREIGN KEY (scanId) REFERENCES broken_link_scans(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS backup_history (
        id TEXT PRIMARY KEY,
        filePath TEXT NOT NULL,
        sizeBytes INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        type TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_checks_monitor_checked ON checks(monitorId, checkedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_checks_checkedAt ON checks(checkedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_monitor_status ON incidents(monitorId, status);
      CREATE INDEX IF NOT EXISTS idx_incident_events_inc ON incident_events(incidentId, createdAt ASC);
      CREATE INDEX IF NOT EXISTS idx_ssl_monitor ON ssl_results(monitorId, checkedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_dns_monitor ON dns_results(monitorId, checkedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_heartbeat_monitor ON heartbeat_events(monitorId, receivedAt DESC);

      CREATE TABLE IF NOT EXISTS remote_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        username TEXT NOT NULL,
        encryptedPrivateKey TEXT NOT NULL,
        encryptedPassphrase TEXT NOT NULL DEFAULT '',
        encryptedAgentToken TEXT NOT NULL,
        hostFingerprint TEXT,
        agentPort INTEGER NOT NULL DEFAULT 47200,
        groupName TEXT NOT NULL DEFAULT 'Default',
        tags TEXT NOT NULL DEFAULT '[]',
        pollIntervalSeconds INTEGER NOT NULL DEFAULT 15,
        cpuThreshold INTEGER NOT NULL DEFAULT 90,
        ramThreshold INTEGER NOT NULL DEFAULT 90,
        diskThreshold INTEGER NOT NULL DEFAULT 90,
        enabled INTEGER NOT NULL DEFAULT 1,
        connectionStatus TEXT NOT NULL DEFAULT 'disconnected',
        hostname TEXT,
        osInfo TEXT,
        kernelVersion TEXT,
        cpuCores INTEGER,
        totalMemoryBytes INTEGER,
        agentVersion TEXT,
        lastSeenAt TEXT,
        lastError TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS server_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serverId TEXT NOT NULL,
        collectedAt TEXT NOT NULL,
        cpuPercent REAL NOT NULL,
        ramPercent REAL NOT NULL,
        ramUsedBytes INTEGER NOT NULL,
        ramTotalBytes INTEGER NOT NULL,
        diskPercent REAL NOT NULL,
        diskUsedBytes INTEGER NOT NULL,
        diskTotalBytes INTEGER NOT NULL,
        netRxBytesPerSec INTEGER NOT NULL DEFAULT 0,
        netTxBytesPerSec INTEGER NOT NULL DEFAULT 0,
        uptimeSeconds INTEGER NOT NULL DEFAULT 0,
        loadAvg1 REAL NOT NULL DEFAULT 0,
        loadAvg5 REAL NOT NULL DEFAULT 0,
        loadAvg15 REAL NOT NULL DEFAULT 0,
        detailsJson TEXT,
        FOREIGN KEY (serverId) REFERENCES remote_servers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS remote_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serverId TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (serverId) REFERENCES remote_servers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_server_metrics_sid ON server_metrics(serverId, collectedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_remote_audit_sid ON remote_audit_logs(serverId, createdAt DESC);



      CREATE TABLE IF NOT EXISTS pm2_instances (
        id TEXT PRIMARY KEY,
        serverId TEXT NOT NULL,
        linuxUser TEXT NOT NULL,
        pm2Path TEXT,
        daemonAvailable INTEGER NOT NULL DEFAULT 0,
        accessible INTEGER NOT NULL DEFAULT 0,
        processCount INTEGER NOT NULL DEFAULT 0,
        lastError TEXT,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (serverId) REFERENCES remote_servers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pm2_processes (
        id TEXT PRIMARY KEY,
        serverId TEXT NOT NULL,
        processKey TEXT NOT NULL,
        pmId INTEGER NOT NULL,
        name TEXT NOT NULL,
        linuxUser TEXT NOT NULL,
        status TEXT NOT NULL,
        state TEXT NOT NULL,
        cpu REAL NOT NULL DEFAULT 0,
        memoryBytes INTEGER NOT NULL DEFAULT 0,
        uptimeSeconds INTEGER NOT NULL DEFAULT 0,
        restarts INTEGER NOT NULL DEFAULT 0,
        unstableRestarts INTEGER NOT NULL DEFAULT 0,
        execMode TEXT NOT NULL DEFAULT 'fork',
        instances INTEGER NOT NULL DEFAULT 1,
        nodeVersion TEXT,
        scriptPath TEXT,
        cwd TEXT,
        lastRestartAt TEXT,
        pid INTEGER,
        envName TEXT,
        intentionalStop INTEGER NOT NULL DEFAULT 0,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (serverId) REFERENCES remote_servers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pm2_metric_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serverId TEXT NOT NULL,
        processKey TEXT NOT NULL,
        collectedAt TEXT NOT NULL,
        cpu REAL NOT NULL DEFAULT 0,
        memoryBytes INTEGER NOT NULL DEFAULT 0,
        restarts INTEGER NOT NULL DEFAULT 0,
        state TEXT NOT NULL,
        FOREIGN KEY (serverId) REFERENCES remote_servers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pm2_state_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serverId TEXT NOT NULL,
        processKey TEXT NOT NULL,
        processName TEXT NOT NULL,
        linuxUser TEXT NOT NULL,
        previousState TEXT NOT NULL,
        newState TEXT NOT NULL,
        eventType TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (serverId) REFERENCES remote_servers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pm2_alert_configs (
        serverId TEXT PRIMARY KEY,
        cpuThreshold REAL NOT NULL DEFAULT 90,
        memoryMbThreshold REAL NOT NULL DEFAULT 1024,
        restartSpikeThreshold INTEGER NOT NULL DEFAULT 3,
        cooldownSeconds INTEGER NOT NULL DEFAULT 300,
        enabled INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (serverId) REFERENCES remote_servers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_pm2_proc_sid ON pm2_processes(serverId, linuxUser, pmId);
      CREATE INDEX IF NOT EXISTS idx_pm2_hist_sid_key ON pm2_metric_history(serverId, processKey, collectedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_pm2_events_sid ON pm2_state_events(serverId, createdAt DESC);


      CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trial_state (
        id TEXT PRIMARY KEY,
        machineIdHash TEXT NOT NULL,
        status TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        signedEntitlement TEXT,
        lastServerTime TEXT,
        maxObservedUtcMs INTEGER NOT NULL DEFAULT 0,
        lastValidatedAt TEXT,
        lastError TEXT,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entitlement_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventType TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        details TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entitlement_hist_time ON entitlement_history(createdAt DESC);


      CREATE TABLE IF NOT EXISTS custom_themes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        themeJson TEXT NOT NULL,
        isDefault INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS license_state (
        id TEXT PRIMARY KEY,
        encryptedLicenseKey TEXT NOT NULL,
        maskedKey TEXT NOT NULL,
        machineId TEXT NOT NULL,
        status TEXT NOT NULL,
        productName TEXT,
        planName TEXT,
        activatedAt TEXT,
        expiresAt TEXT,
        lastValidatedAt TEXT,
        lastAttemptAt TEXT,
        lastResultCode TEXT,
        offlineGraceUntil TEXT,
        machinesUsed INTEGER,
        machinesLimit INTEGER,
        analyticsEnabled INTEGER NOT NULL DEFAULT 1,
        updatedAt TEXT NOT NULL
      );


    `);

    // Safe column migrations for existing databases
    this.ensureColumn('monitors', 'monitorType', "TEXT NOT NULL DEFAULT 'http'");
    this.ensureColumn('monitors', 'expectedStatusCodes', "TEXT NOT NULL DEFAULT '200-399'");
    this.ensureColumn('monitors', 'groupId', 'TEXT');
    this.ensureColumn('monitors', 'tags', "TEXT NOT NULL DEFAULT '[]'");
    this.ensureColumn('monitors', 'configJson', "TEXT NOT NULL DEFAULT '{}'");

    this.ensureColumn('checks', 'state', "TEXT NOT NULL DEFAULT 'UP'");
    this.ensureColumn('checks', 'networkConnected', 'INTEGER NOT NULL DEFAULT 1');
    this.ensureColumn('checks', 'httpResponseReceived', 'INTEGER NOT NULL DEFAULT 1');
    this.ensureColumn('checks', 'applicationHealthy', 'INTEGER NOT NULL DEFAULT 1');
    this.ensureColumn('checks', 'detailsJson', 'TEXT');

    this.ensureColumn('incidents', 'title', 'TEXT');
    this.ensureColumn('incidents', 'description', 'TEXT');
    this.ensureColumn('incidents', 'severity', "TEXT NOT NULL DEFAULT 'high'");
    this.ensureColumn('incidents', 'incidentType', "TEXT NOT NULL DEFAULT 'DOWN'");
    this.ensureColumn('incidents', 'acknowledged', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('incidents', 'acknowledgedAt', 'TEXT');
    this.ensureColumn('incidents', 'resolutionNote', 'TEXT');
    this.ensureColumn('incidents', 'rootCauseMonitorId', 'TEXT');
  }

  // --- Monitors ---
  public getAllMonitors(): MonitorRecord[] {
    return this.db
      .prepare('SELECT * FROM monitors ORDER BY createdAt DESC')
      .all() as MonitorRecord[];
  }

  public getEnabledMonitors(): MonitorRecord[] {
    return this.db
      .prepare('SELECT * FROM monitors WHERE enabled = 1 ORDER BY createdAt DESC')
      .all() as MonitorRecord[];
  }

  public getMonitorById(id: string): MonitorRecord | undefined {
    return this.db
      .prepare('SELECT * FROM monitors WHERE id = ?')
      .get(id) as MonitorRecord | undefined;
  }

  public createMonitor(input: CreateMonitorInput): MonitorRecord {
    const now = new Date().toISOString();
    const id = `mon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare(
        `INSERT INTO monitors (
          id, name, url, monitorType, method, interval, timeout,
          expectedStatusCodes, groupId, tags, configJson, enabled, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.url,
        input.monitorType ?? 'http',
        input.method ?? 'GET',
        input.interval,
        input.timeout,
        input.expectedStatusCodes || DEFAULT_EXPECTED_STATUS_CODES,
        input.groupId ?? null,
        JSON.stringify(input.tags ?? []),
        input.configJson ?? '{}',
        now,
        now
      );
    return this.getMonitorById(id)!;
  }

  public updateMonitor(
    id: string,
    input: UpdateMonitorInput
  ): MonitorRecord | undefined {
    const existing = this.getMonitorById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE monitors SET
          name = ?, url = ?, monitorType = ?, method = ?, interval = ?, timeout = ?,
          expectedStatusCodes = ?, groupId = ?, tags = ?, configJson = ?, enabled = ?, updatedAt = ?
         WHERE id = ?`
      )
      .run(
        input.name ?? existing.name,
        input.url ?? existing.url,
        input.monitorType ?? existing.monitorType,
        input.method ?? existing.method,
        input.interval ?? existing.interval,
        input.timeout ?? existing.timeout,
        input.expectedStatusCodes ?? existing.expectedStatusCodes,
        input.groupId !== undefined ? input.groupId : existing.groupId,
        input.tags !== undefined ? JSON.stringify(input.tags) : existing.tags,
        input.configJson ?? existing.configJson,
        input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled,
        now,
        id
      );

    return this.getMonitorById(id);
  }

  public deleteMonitor(id: string): boolean {
    const res = this.db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Checks & Incidents ---
  public recordCheckAndUpdateIncident(
    input: InsertCheckInput
  ): CheckTransitionResult {
    const tx = this.db.transaction((): CheckTransitionResult => {
      const prevRow = this.db
        .prepare(
          'SELECT state FROM checks WHERE monitorId = ? ORDER BY checkedAt DESC, id DESC LIMIT 1'
        )
        .get(input.monitorId) as { state: CheckState } | undefined;

      const previousState: CheckState | 'UNKNOWN' = prevRow
        ? prevRow.state
        : 'UNKNOWN';

      const insertRes = this.db
        .prepare(
          `INSERT INTO checks (
             monitorId, checkedAt, responseTime, statusCode,
             state, networkConnected, httpResponseReceived, applicationHealthy,
             success, errorMessage, detailsJson
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.monitorId,
          input.checkedAt,
          input.responseTime,
          input.statusCode,
          input.state,
          input.networkConnected ? 1 : 0,
          input.httpResponseReceived ? 1 : 0,
          input.applicationHealthy ? 1 : 0,
          input.success ? 1 : 0,
          input.errorMessage,
          input.detailsJson ?? null
        );

      const check = this.db
        .prepare('SELECT * FROM checks WHERE id = ?')
        .get(insertRes.lastInsertRowid) as CheckRecord;

      const monitor = this.getMonitorById(input.monitorId);
      let incidentChanged = false;
      let incidentId: string | undefined;

      if (input.state === 'DOWN') {
        const openDown = this.db
          .prepare(
            "SELECT * FROM incidents WHERE monitorId = ? AND status = 'open' AND incidentType = 'DOWN' LIMIT 1"
          )
          .get(input.monitorId) as IncidentRecord | undefined;

        if (!openDown) {
          const incId = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const title = `${monitor?.name ?? input.monitorId} is DOWN`;
          this.db
            .prepare(
              `INSERT INTO incidents (
                 id, monitorId, title, description, severity, startedAt,
                 status, incidentType, errorMessage
               ) VALUES (?, ?, ?, ?, 'critical', ?, 'open', 'DOWN', ?)`
            )
            .run(
              incId,
              input.monitorId,
              title,
              input.errorMessage ?? 'Connection failure',
              input.checkedAt,
              input.errorMessage
            );
          this.addIncidentEvent(
            incId,
            'monitor_failure',
            input.errorMessage ?? 'Monitor transitioned to DOWN'
          );
          incidentChanged = true;
          incidentId = incId;
        } else {
          incidentId = openDown.id;
        }
      } else {
        const openDown = this.db
          .prepare(
            "SELECT * FROM incidents WHERE monitorId = ? AND status = 'open' AND incidentType = 'DOWN' LIMIT 1"
          )
          .get(input.monitorId) as IncidentRecord | undefined;

        if (openDown) {
          const durationSeconds = Math.max(
            0,
            Math.round(
              (new Date(input.checkedAt).getTime() -
                new Date(openDown.startedAt).getTime()) /
                1000
            )
          );
          this.db
            .prepare(
              `UPDATE incidents
               SET status = 'resolved', resolvedAt = ?, durationSeconds = ?, resolutionNote = ?
               WHERE id = ?`
            )
            .run(
              input.checkedAt,
              durationSeconds,
              `Automatically resolved (${input.state})`,
              openDown.id
            );
          this.addIncidentEvent(
            openDown.id,
            'automatic_resolution',
            `Monitor recovered to ${input.state}`
          );
          incidentChanged = true;
          incidentId = openDown.id;
        }
      }

      return {
        check,
        previousState,
        newState: input.state,
        incidentChanged,
        incidentId,
      };
    });

    return tx();
  }

  public getChecksForMonitor(
    monitorId: string,
    sinceIso?: string,
    limit = 200
  ): CheckRecord[] {
    if (sinceIso) {
      return this.db
        .prepare(
          `SELECT * FROM checks
           WHERE monitorId = ? AND checkedAt >= ?
           ORDER BY checkedAt DESC, id DESC
           LIMIT ?`
        )
        .all(monitorId, sinceIso, limit) as CheckRecord[];
    }
    return this.db
      .prepare(
        `SELECT * FROM checks
         WHERE monitorId = ?
         ORDER BY checkedAt DESC, id DESC
         LIMIT ?`
      )
      .all(monitorId, limit) as CheckRecord[];
  }

  public getAllChecksSince(sinceIso?: string, limit = 5000): CheckRecord[] {
    if (sinceIso) {
      return this.db
        .prepare(
          `SELECT * FROM checks
           WHERE checkedAt >= ?
           ORDER BY checkedAt DESC, id DESC
           LIMIT ?`
        )
        .all(sinceIso, limit) as CheckRecord[];
    }
    return this.db
      .prepare(
        `SELECT * FROM checks
         ORDER BY checkedAt DESC, id DESC
         LIMIT ?`
      )
      .all(limit) as CheckRecord[];
  }

  public getRecentChecksWithMonitor(limit = 25): Array<
    CheckRecord & {
      monitorName: string;
      monitorUrl: string;
      monitorMethod: HttpMethod;
    }
  > {
    return this.db
      .prepare(
        `SELECT c.*, m.name AS monitorName, m.url AS monitorUrl, m.method AS monitorMethod
         FROM checks c
         INNER JOIN monitors m ON m.id = c.monitorId
         ORDER BY c.checkedAt DESC, c.id DESC
         LIMIT ?`
      )
      .all(limit) as Array<
      CheckRecord & {
        monitorName: string;
        monitorUrl: string;
        monitorMethod: HttpMethod;
      }
    >;
  }

  // --- Incidents & Events ---
  public getAllIncidents(): IncidentRecord[] {
    return this.db
      .prepare(
        `SELECT i.*, m.name AS monitorName, m.url AS monitorUrl
         FROM incidents i
         INNER JOIN monitors m ON m.id = i.monitorId
         ORDER BY i.startedAt DESC`
      )
      .all() as IncidentRecord[];
  }

  public getIncidentEvents(incidentId: string): IncidentEventRecord[] {
    return this.db
      .prepare(
        'SELECT * FROM incident_events WHERE incidentId = ? ORDER BY createdAt ASC, id ASC'
      )
      .all(incidentId) as IncidentEventRecord[];
  }

  public addIncidentEvent(
    incidentId: string,
    eventType: string,
    message: string
  ): void {
    this.db
      .prepare(
        'INSERT INTO incident_events (incidentId, eventType, message, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run(incidentId, eventType, message, new Date().toISOString());
  }

  public updateIncident(
    id: string,
    updates: {
      severity?: IncidentSeverity;
      acknowledged?: boolean;
      status?: 'open' | 'resolved';
      resolutionNote?: string;
    }
  ): IncidentRecord | undefined {
    const existing = this.db
      .prepare('SELECT * FROM incidents WHERE id = ?')
      .get(id) as IncidentRecord | undefined;
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const nextStatus = updates.status ?? existing.status;
    let resolvedAt = existing.resolvedAt;
    let durationSeconds = existing.durationSeconds;

    if (updates.status === 'resolved' && existing.status !== 'resolved') {
      resolvedAt = now;
      durationSeconds = Math.max(
        0,
        Math.round(
          (new Date(now).getTime() - new Date(existing.startedAt).getTime()) /
            1000
        )
      );
      this.addIncidentEvent(
        id,
        'manual_resolution',
        updates.resolutionNote || 'Manually resolved'
      );
    } else if (updates.status === 'open' && existing.status === 'resolved') {
      resolvedAt = null;
      durationSeconds = null;
      this.addIncidentEvent(id, 'reopened', 'Incident reopened');
    }

    if (updates.acknowledged === true && existing.acknowledged === 0) {
      this.addIncidentEvent(id, 'acknowledged', 'Incident acknowledged');
    }

    if (updates.severity && updates.severity !== existing.severity) {
      this.addIncidentEvent(
        id,
        'severity_changed',
        `Severity changed to ${updates.severity}`
      );
    }

    this.db
      .prepare(
        `UPDATE incidents SET
          severity = ?,
          acknowledged = ?,
          acknowledgedAt = ?,
          status = ?,
          resolvedAt = ?,
          durationSeconds = ?,
          resolutionNote = ?
         WHERE id = ?`
      )
      .run(
        updates.severity ?? existing.severity,
        updates.acknowledged !== undefined
          ? updates.acknowledged
            ? 1
            : 0
          : existing.acknowledged,
        updates.acknowledged === true && !existing.acknowledgedAt
          ? now
          : existing.acknowledgedAt,
        nextStatus,
        resolvedAt,
        durationSeconds,
        updates.resolutionNote ?? existing.resolutionNote,
        id
      );

    return this.db
      .prepare(
        `SELECT i.*, m.name AS monitorName, m.url AS monitorUrl
         FROM incidents i
         INNER JOIN monitors m ON m.id = i.monitorId
         WHERE i.id = ?`
      )
      .get(id) as IncidentRecord | undefined;
  }

  // --- Monitor Groups ---
  public getAllGroups(): MonitorGroupRecord[] {
    return this.db
      .prepare('SELECT * FROM monitor_groups ORDER BY name ASC')
      .all() as MonitorGroupRecord[];
  }

  public createGroup(input: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    tags?: string[];
  }): MonitorGroupRecord {
    const now = new Date().toISOString();
    const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.db
      .prepare(
        `INSERT INTO monitor_groups (id, name, description, color, icon, tags, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.description ?? '',
        input.color ?? '#10b981',
        input.icon ?? 'folder',
        JSON.stringify(input.tags ?? []),
        now,
        now
      );
    return this.db
      .prepare('SELECT * FROM monitor_groups WHERE id = ?')
      .get(id) as MonitorGroupRecord;
  }

  public updateGroup(
    id: string,
    input: { name?: string; description?: string; color?: string; tags?: string[] }
  ): MonitorGroupRecord | undefined {
    const existing = this.db
      .prepare('SELECT * FROM monitor_groups WHERE id = ?')
      .get(id) as MonitorGroupRecord | undefined;
    if (!existing) return undefined;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE monitor_groups SET name = ?, description = ?, color = ?, tags = ?, updatedAt = ? WHERE id = ?`
      )
      .run(
        input.name ?? existing.name,
        input.description ?? existing.description,
        input.color ?? existing.color,
        input.tags !== undefined ? JSON.stringify(input.tags) : existing.tags,
        now,
        id
      );
    return this.db
      .prepare('SELECT * FROM monitor_groups WHERE id = ?')
      .get(id) as MonitorGroupRecord;
  }

  public deleteGroup(id: string): boolean {
    const res = this.db
      .prepare('DELETE FROM monitor_groups WHERE id = ?')
      .run(id);
    return res.changes > 0;
  }

  // --- Services & Dependencies ---
  public getAllServices(): ServiceRecord[] {
    return this.db
      .prepare('SELECT * FROM services ORDER BY name ASC')
      .all() as ServiceRecord[];
  }

  public createService(input: {
    name: string;
    description?: string;
    staleThresholdSeconds?: number;
  }): ServiceRecord {
    const now = new Date().toISOString();
    const id = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.db
      .prepare(
        `INSERT INTO services (id, name, description, staleThresholdSeconds, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.description ?? '',
        input.staleThresholdSeconds ?? 300,
        now,
        now
      );
    return this.db
      .prepare('SELECT * FROM services WHERE id = ?')
      .get(id) as ServiceRecord;
  }

  public deleteService(id: string): boolean {
    const res = this.db.prepare('DELETE FROM services WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public getServiceMonitorLinks(): ServiceMonitorLink[] {
    return this.db
      .prepare('SELECT * FROM service_monitors')
      .all() as ServiceMonitorLink[];
  }

  public setServiceMonitor(
    serviceId: string,
    monitorId: string,
    isCritical: boolean
  ): void {
    this.db
      .prepare(
        `INSERT INTO service_monitors (serviceId, monitorId, isCritical)
         VALUES (?, ?, ?)
         ON CONFLICT(serviceId, monitorId) DO UPDATE SET isCritical = excluded.isCritical`
      )
      .run(serviceId, monitorId, isCritical ? 1 : 0);
  }

  public removeServiceMonitor(serviceId: string, monitorId: string): void {
    this.db
      .prepare(
        'DELETE FROM service_monitors WHERE serviceId = ? AND monitorId = ?'
      )
      .run(serviceId, monitorId);
  }

  public getAllServiceDependencies(): ServiceDependencyRecord[] {
    return this.db
      .prepare('SELECT * FROM service_dependencies')
      .all() as ServiceDependencyRecord[];
  }

  public addServiceDependency(
    serviceId: string,
    dependsOnServiceId: string,
    isCritical: boolean
  ): ServiceDependencyRecord {
    const id = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.db
      .prepare(
        `INSERT INTO service_dependencies (id, serviceId, dependsOnServiceId, isCritical, createdAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        id,
        serviceId,
        dependsOnServiceId,
        isCritical ? 1 : 0,
        new Date().toISOString()
      );
    return this.db
      .prepare('SELECT * FROM service_dependencies WHERE id = ?')
      .get(id) as ServiceDependencyRecord;
  }

  public removeServiceDependency(id: string): boolean {
    const res = this.db
      .prepare('DELETE FROM service_dependencies WHERE id = ?')
      .run(id);
    return res.changes > 0;
  }

  // --- Notification Channels, Rules & History ---
  public getNotificationChannels(): NotificationChannelRecord[] {
    return this.db
      .prepare('SELECT * FROM notification_channels ORDER BY createdAt DESC')
      .all() as NotificationChannelRecord[];
  }

  public createNotificationChannel(input: {
    name: string;
    type: NotificationChannelRecord['type'];
    configEncrypted: string;
  }): NotificationChannelRecord {
    const now = new Date().toISOString();
    const id = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.db
      .prepare(
        `INSERT INTO notification_channels (id, name, type, configEncrypted, enabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .run(id, input.name, input.type, input.configEncrypted, now, now);
    return this.db
      .prepare('SELECT * FROM notification_channels WHERE id = ?')
      .get(id) as NotificationChannelRecord;
  }

  public updateNotificationChannel(
    id: string,
    updates: { name?: string; configEncrypted?: string; enabled?: boolean }
  ): NotificationChannelRecord | undefined {
    const existing = this.db
      .prepare('SELECT * FROM notification_channels WHERE id = ?')
      .get(id) as NotificationChannelRecord | undefined;
    if (!existing) return undefined;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE notification_channels
         SET name = ?, configEncrypted = ?, enabled = ?, updatedAt = ?
         WHERE id = ?`
      )
      .run(
        updates.name ?? existing.name,
        updates.configEncrypted ?? existing.configEncrypted,
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : existing.enabled,
        now,
        id
      );
    return this.db
      .prepare('SELECT * FROM notification_channels WHERE id = ?')
      .get(id) as NotificationChannelRecord | undefined;
  }

  public toggleNotificationChannel(id: string, enabled: boolean): void {
    this.db
      .prepare(
        'UPDATE notification_channels SET enabled = ?, updatedAt = ? WHERE id = ?'
      )
      .run(enabled ? 1 : 0, new Date().toISOString(), id);
  }

  public deleteNotificationChannel(id: string): boolean {
    const res = this.db
      .prepare('DELETE FROM notification_channels WHERE id = ?')
      .run(id);
    return res.changes > 0;
  }

  public recordNotificationHistory(input: {
    channelId: string;
    monitorId?: string | null;
    incidentId?: string | null;
    eventType: string;
    status: 'sent' | 'failed' | 'suppressed';
    errorMessage?: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO notification_history (channelId, monitorId, incidentId, eventType, status, errorMessage, sentAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.channelId,
        input.monitorId ?? null,
        input.incidentId ?? null,
        input.eventType,
        input.status,
        input.errorMessage ?? null,
        new Date().toISOString()
      );
  }

  public getNotificationHistory(limit = 100): NotificationHistoryRecord[] {
    return this.db
      .prepare('SELECT * FROM notification_history ORDER BY sentAt DESC LIMIT ?')
      .all(limit) as NotificationHistoryRecord[];
  }

  public getLastSentNotificationTime(
    channelId: string,
    monitorId: string,
    eventType: string
  ): string | null {
    const row = this.db
      .prepare(
        `SELECT sentAt FROM notification_history
         WHERE channelId = ? AND monitorId = ? AND eventType = ? AND status = 'sent'
         ORDER BY sentAt DESC LIMIT 1`
      )
      .get(channelId, monitorId, eventType) as { sentAt: string } | undefined;
    return row?.sentAt ?? null;
  }

  // --- SSL, DNS, Content, Heartbeat, Domain, Broken Links ---
  public saveSslResult(input: Omit<SslResultRecord, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO ssl_results (
          monitorId, checkedAt, subject, issuer, validFrom, validTo,
          daysRemaining, hostnameValid, chainValid, tlsVersion, errorMessage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.monitorId,
        input.checkedAt,
        input.subject,
        input.issuer,
        input.validFrom,
        input.validTo,
        input.daysRemaining,
        input.hostnameValid,
        input.chainValid,
        input.tlsVersion,
        input.errorMessage
      );
  }

  public getSslResults(monitorId?: string, limit = 50): SslResultRecord[] {
    if (monitorId) {
      return this.db
        .prepare(
          'SELECT * FROM ssl_results WHERE monitorId = ? ORDER BY checkedAt DESC LIMIT ?'
        )
        .all(monitorId, limit) as SslResultRecord[];
    }
    return this.db
      .prepare('SELECT * FROM ssl_results ORDER BY checkedAt DESC LIMIT ?')
      .all(limit) as SslResultRecord[];
  }

  public saveDnsResult(input: Omit<DnsResultRecord, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO dns_results (
          monitorId, checkedAt, recordType, resolver, lookupMs, recordsJson, changed, errorMessage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.monitorId,
        input.checkedAt,
        input.recordType,
        input.resolver,
        input.lookupMs,
        input.recordsJson,
        input.changed,
        input.errorMessage
      );
  }

  public getLatestDnsResult(
    monitorId: string,
    recordType: string
  ): DnsResultRecord | undefined {
    return this.db
      .prepare(
        'SELECT * FROM dns_results WHERE monitorId = ? AND recordType = ? ORDER BY checkedAt DESC LIMIT 1'
      )
      .get(monitorId, recordType) as DnsResultRecord | undefined;
  }

  public getDnsResults(monitorId?: string, limit = 100): DnsResultRecord[] {
    if (monitorId) {
      return this.db
        .prepare(
          'SELECT * FROM dns_results WHERE monitorId = ? ORDER BY checkedAt DESC LIMIT ?'
        )
        .all(monitorId, limit) as DnsResultRecord[];
    }
    return this.db
      .prepare('SELECT * FROM dns_results ORDER BY checkedAt DESC LIMIT ?')
      .all(limit) as DnsResultRecord[];
  }

  public saveContentSnapshot(input: Omit<ContentSnapshotRecord, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO content_snapshots (monitorId, checkedAt, contentHash, snippet, changed, diffSummary)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.monitorId,
        input.checkedAt,
        input.contentHash,
        input.snippet,
        input.changed,
        input.diffSummary
      );
  }

  public getLatestContentSnapshot(
    monitorId: string
  ): ContentSnapshotRecord | undefined {
    return this.db
      .prepare(
        'SELECT * FROM content_snapshots WHERE monitorId = ? ORDER BY checkedAt DESC LIMIT 1'
      )
      .get(monitorId) as ContentSnapshotRecord | undefined;
  }

  public recordHeartbeat(
    monitorId: string,
    sourceIp: string | null,
    payload: string | null
  ): void {
    this.db
      .prepare(
        'INSERT INTO heartbeat_events (monitorId, receivedAt, sourceIp, payload) VALUES (?, ?, ?, ?)'
      )
      .run(monitorId, new Date().toISOString(), sourceIp, payload);
  }

  public getHeartbeatEvents(
    monitorId: string,
    limit = 50
  ): HeartbeatEventRecord[] {
    return this.db
      .prepare(
        'SELECT * FROM heartbeat_events WHERE monitorId = ? ORDER BY receivedAt DESC LIMIT ?'
      )
      .all(monitorId, limit) as HeartbeatEventRecord[];
  }

  public saveDomainResult(input: Omit<DomainResultRecord, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO domain_results (monitorId, checkedAt, domain, registrar, expiresAt, daysRemaining, errorMessage)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.monitorId,
        input.checkedAt,
        input.domain,
        input.registrar,
        input.expiresAt,
        input.daysRemaining,
        input.errorMessage
      );
  }

  public getDomainResults(monitorId?: string, limit = 50): DomainResultRecord[] {
    if (monitorId) {
      return this.db
        .prepare(
          'SELECT * FROM domain_results WHERE monitorId = ? ORDER BY checkedAt DESC LIMIT ?'
        )
        .all(monitorId, limit) as DomainResultRecord[];
    }
    return this.db
      .prepare('SELECT * FROM domain_results ORDER BY checkedAt DESC LIMIT ?')
      .all(limit) as DomainResultRecord[];
  }

  // --- Maintenance Windows ---
  public getMaintenanceWindows(): MaintenanceWindowRecord[] {
    return this.db
      .prepare('SELECT * FROM maintenance_windows ORDER BY startsAt DESC')
      .all() as MaintenanceWindowRecord[];
  }

  public createMaintenanceWindow(input: {
    name: string;
    monitorId?: string | null;
    groupId?: string | null;
    startsAt: string;
    endsAt: string;
  }): MaintenanceWindowRecord {
    const id = `mw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO maintenance_windows (id, name, monitorId, groupId, startsAt, endsAt, enabled, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(
        id,
        input.name,
        input.monitorId ?? null,
        input.groupId ?? null,
        input.startsAt,
        input.endsAt,
        now
      );
    return this.db
      .prepare('SELECT * FROM maintenance_windows WHERE id = ?')
      .get(id) as MaintenanceWindowRecord;
  }

  public deleteMaintenanceWindow(id: string): boolean {
    const res = this.db
      .prepare('DELETE FROM maintenance_windows WHERE id = ?')
      .run(id);
    return res.changes > 0;
  }

  public isMonitorInMaintenance(
    monitorId: string,
    groupId: string | null,
    nowIso = new Date().toISOString()
  ): boolean {
    const row = this.db
      .prepare(
        `SELECT id FROM maintenance_windows
         WHERE enabled = 1 AND startsAt <= ? AND endsAt >= ?
         AND (monitorId = ? OR (groupId IS NOT NULL AND groupId = ?) OR (monitorId IS NULL AND groupId IS NULL))
         LIMIT 1`
      )
      .get(nowIso, nowIso, monitorId, groupId);
    return Boolean(row);
  }

  // --- Broken Link Scans ---
  public createBrokenLinkScan(targetUrl: string): BrokenLinkScanRecord {
    const id = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO broken_link_scans (id, targetUrl, startedAt, pagesScanned, brokenCount, status)
         VALUES (?, ?, ?, 0, 0, 'running')`
      )
      .run(id, targetUrl, now);
    return this.db
      .prepare('SELECT * FROM broken_link_scans WHERE id = ?')
      .get(id) as BrokenLinkScanRecord;
  }

  public completeBrokenLinkScan(
    scanId: string,
    pagesScanned: number,
    brokenCount: number,
    status: 'completed' | 'failed',
    results: Array<{
      pageUrl: string;
      linkUrl: string;
      statusCode: number | null;
      broken: boolean;
      errorMessage: string | null;
    }>
  ): void {
    const tx = this.db.transaction(() => {
      const insertStmt = this.db.prepare(
        `INSERT INTO broken_link_results (scanId, pageUrl, linkUrl, statusCode, broken, errorMessage)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const r of results) {
        insertStmt.run(
          scanId,
          r.pageUrl,
          r.linkUrl,
          r.statusCode,
          r.broken ? 1 : 0,
          r.errorMessage
        );
      }
      this.db
        .prepare(
          `UPDATE broken_link_scans SET completedAt = ?, pagesScanned = ?, brokenCount = ?, status = ? WHERE id = ?`
        )
        .run(new Date().toISOString(), pagesScanned, brokenCount, status, scanId);
    });
    tx();
  }

  public getBrokenLinkScans(): BrokenLinkScanRecord[] {
    return this.db
      .prepare('SELECT * FROM broken_link_scans ORDER BY startedAt DESC LIMIT 20')
      .all() as BrokenLinkScanRecord[];
  }

  public getBrokenLinkResults(scanId: string): BrokenLinkResultRecord[] {
    return this.db
      .prepare('SELECT * FROM broken_link_results WHERE scanId = ?')
      .all(scanId) as BrokenLinkResultRecord[];
  }

  // --- Backups, Retention & Settings ---
  public async backupTo(destPath: string): Promise<void> {
    await this.db.backup(destPath);
  }

  public recordBackupHistory(input: BackupHistoryRecord): void {
    this.db
      .prepare(
        'INSERT INTO backup_history (id, filePath, sizeBytes, createdAt, type) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        input.id,
        input.filePath,
        input.sizeBytes,
        input.createdAt,
        input.type
      );
  }

  public getBackupHistory(): BackupHistoryRecord[] {
    return this.db
      .prepare('SELECT * FROM backup_history ORDER BY createdAt DESC LIMIT 30')
      .all() as BackupHistoryRecord[];
  }

  public cleanupOldRecords(retentionDays: number): {
    checksDeleted: number;
    notificationsDeleted: number;
  } {
    const cutoff = new Date(
      Date.now() - Math.max(1, retentionDays) * 86_400_000
    ).toISOString();
    const cRes = this.db
      .prepare('DELETE FROM checks WHERE checkedAt < ?')
      .run(cutoff);
    const nRes = this.db
      .prepare('DELETE FROM notification_history WHERE sentAt < ?')
      .run(cutoff);
    this.db.prepare('DELETE FROM pm2_metric_history WHERE collectedAt < ?').run(cutoff);
    this.db.prepare('DELETE FROM pm2_state_events WHERE createdAt < ?').run(cutoff);
    return {
      checksDeleted: cRes.changes,
      notificationsDeleted: nRes.changes,
    };
  }


  // --- Remote Servers, Metrics & Audit Logs ---
  public getAllRemoteServers(): RemoteServerRecord[] {
    return this.db
      .prepare('SELECT * FROM remote_servers ORDER BY createdAt DESC')
      .all() as RemoteServerRecord[];
  }

  public getRemoteServerById(id: string): RemoteServerRecord | undefined {
    return this.db
      .prepare('SELECT * FROM remote_servers WHERE id = ?')
      .get(id) as RemoteServerRecord | undefined;
  }

  public createRemoteServer(input: {
    name: string;
    host: string;
    port: number;
    username: string;
    encryptedPrivateKey: string;
    encryptedPassphrase?: string;
    encryptedAgentToken: string;
    hostFingerprint?: string | null;
    agentPort?: number;
    groupName?: string;
    tags?: string[];
    pollIntervalSeconds?: number;
    cpuThreshold?: number;
    ramThreshold?: number;
    diskThreshold?: number;
  }): RemoteServerRecord {
    const now = new Date().toISOString();
    const id = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.db
      .prepare(
        `INSERT INTO remote_servers (
          id, name, host, port, username, encryptedPrivateKey, encryptedPassphrase,
          encryptedAgentToken, hostFingerprint, agentPort, groupName, tags,
          pollIntervalSeconds, cpuThreshold, ramThreshold, diskThreshold,
          enabled, connectionStatus, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'disconnected', ?, ?)`
      )
      .run(
        id,
        input.name,
        input.host,
        input.port,
        input.username,
        input.encryptedPrivateKey,
        input.encryptedPassphrase ?? '',
        input.encryptedAgentToken,
        input.hostFingerprint ?? null,
        input.agentPort ?? 47200,
        input.groupName ?? 'Default',
        JSON.stringify(input.tags ?? []),
        input.pollIntervalSeconds ?? 15,
        input.cpuThreshold ?? 90,
        input.ramThreshold ?? 90,
        input.diskThreshold ?? 90,
        now,
        now
      );
    return this.getRemoteServerById(id)!;
  }

  public updateRemoteServer(
    id: string,
    updates: Partial<{
      name: string;
      host: string;
      port: number;
      username: string;
      encryptedPrivateKey: string;
      encryptedPassphrase: string;
      encryptedAgentToken: string;
      hostFingerprint: string | null;
      agentPort: number;
      groupName: string;
      tags: string[];
      pollIntervalSeconds: number;
      cpuThreshold: number;
      ramThreshold: number;
      diskThreshold: number;
      enabled: boolean;
    }>
  ): RemoteServerRecord | undefined {
    const existing = this.getRemoteServerById(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE remote_servers SET
          name = ?, host = ?, port = ?, username = ?,
          encryptedPrivateKey = ?, encryptedPassphrase = ?, encryptedAgentToken = ?,
          hostFingerprint = ?, agentPort = ?, groupName = ?, tags = ?,
          pollIntervalSeconds = ?, cpuThreshold = ?, ramThreshold = ?, diskThreshold = ?,
          enabled = ?, updatedAt = ?
         WHERE id = ?`
      )
      .run(
        updates.name ?? existing.name,
        updates.host ?? existing.host,
        updates.port ?? existing.port,
        updates.username ?? existing.username,
        updates.encryptedPrivateKey ?? existing.encryptedPrivateKey,
        updates.encryptedPassphrase ?? existing.encryptedPassphrase,
        updates.encryptedAgentToken ?? existing.encryptedAgentToken,
        updates.hostFingerprint !== undefined
          ? updates.hostFingerprint
          : existing.hostFingerprint,
        updates.agentPort ?? existing.agentPort,
        updates.groupName ?? existing.groupName,
        updates.tags !== undefined ? JSON.stringify(updates.tags) : existing.tags,
        updates.pollIntervalSeconds ?? existing.pollIntervalSeconds,
        updates.cpuThreshold ?? existing.cpuThreshold,
        updates.ramThreshold ?? existing.ramThreshold,
        updates.diskThreshold ?? existing.diskThreshold,
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : existing.enabled,
        now,
        id
      );
    return this.getRemoteServerById(id);
  }

  public updateRemoteServerRuntime(
    id: string,
    runtime: {
      connectionStatus: RemoteServerRecord['connectionStatus'];
      hostname?: string | null;
      osInfo?: string | null;
      kernelVersion?: string | null;
      cpuCores?: number | null;
      totalMemoryBytes?: number | null;
      agentVersion?: string | null;
      lastSeenAt?: string | null;
      lastError?: string | null;
      hostFingerprint?: string | null;
    }
  ): void {
    const existing = this.getRemoteServerById(id);
    if (!existing) return;
    this.db
      .prepare(
        `UPDATE remote_servers SET
          connectionStatus = ?,
          hostname = COALESCE(?, hostname),
          osInfo = COALESCE(?, osInfo),
          kernelVersion = COALESCE(?, kernelVersion),
          cpuCores = COALESCE(?, cpuCores),
          totalMemoryBytes = COALESCE(?, totalMemoryBytes),
          agentVersion = COALESCE(?, agentVersion),
          lastSeenAt = COALESCE(?, lastSeenAt),
          lastError = ?,
          hostFingerprint = COALESCE(?, hostFingerprint),
          updatedAt = ?
         WHERE id = ?`
      )
      .run(
        runtime.connectionStatus,
        runtime.hostname ?? null,
        runtime.osInfo ?? null,
        runtime.kernelVersion ?? null,
        runtime.cpuCores ?? null,
        runtime.totalMemoryBytes ?? null,
        runtime.agentVersion ?? null,
        runtime.lastSeenAt ?? null,
        runtime.lastError ?? null,
        runtime.hostFingerprint ?? null,
        new Date().toISOString(),
        id
      );
  }

  public deleteRemoteServer(id: string): boolean {
    const res = this.db
      .prepare('DELETE FROM remote_servers WHERE id = ?')
      .run(id);
    return res.changes > 0;
  }

  public recordServerMetric(input: Omit<ServerMetricRecord, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO server_metrics (
          serverId, collectedAt, cpuPercent, ramPercent, ramUsedBytes, ramTotalBytes,
          diskPercent, diskUsedBytes, diskTotalBytes, netRxBytesPerSec, netTxBytesPerSec,
          uptimeSeconds, loadAvg1, loadAvg5, loadAvg15, detailsJson
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.serverId,
        input.collectedAt,
        input.cpuPercent,
        input.ramPercent,
        input.ramUsedBytes,
        input.ramTotalBytes,
        input.diskPercent,
        input.diskUsedBytes,
        input.diskTotalBytes,
        input.netRxBytesPerSec,
        input.netTxBytesPerSec,
        input.uptimeSeconds,
        input.loadAvg1,
        input.loadAvg5,
        input.loadAvg15,
        input.detailsJson
      );
  }

  public getServerMetrics(
    serverId: string,
    limit = 120
  ): ServerMetricRecord[] {
    return this.db
      .prepare(
        'SELECT * FROM server_metrics WHERE serverId = ? ORDER BY collectedAt DESC LIMIT ?'
      )
      .all(serverId, limit) as ServerMetricRecord[];
  }

  public recordAuditLog(input: {
    serverId: string;
    action: string;
    target: string;
    status: 'success' | 'failed';
    details?: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO remote_audit_logs (serverId, action, target, status, details, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.serverId,
        input.action,
        input.target,
        input.status,
        input.details ?? null,
        new Date().toISOString()
      );
  }

  public getAuditLogs(serverId?: string, limit = 100): RemoteAuditLogRecord[] {
    if (serverId) {
      return this.db
        .prepare(
          'SELECT * FROM remote_audit_logs WHERE serverId = ? ORDER BY createdAt DESC LIMIT ?'
        )
        .all(serverId, limit) as RemoteAuditLogRecord[];
    }
    return this.db
      .prepare('SELECT * FROM remote_audit_logs ORDER BY createdAt DESC LIMIT ?')
      .all(limit) as RemoteAuditLogRecord[];
  }

  public cleanupOldServerMetrics(retentionDays: number): number {
    const cutoff = new Date(
      Date.now() - Math.max(1, retentionDays) * 86_400_000
    ).toISOString();
    return this.db
      .prepare('DELETE FROM server_metrics WHERE collectedAt < ?')
      .run(cutoff).changes;
  }


  // --- License State & App Settings ---
  public getLicenseState(): LicenseStateRecord | undefined {
    return this.db
      .prepare("SELECT * FROM license_state WHERE id = 'primary'")
      .get() as LicenseStateRecord | undefined;
  }

  public saveLicenseState(input: Omit<LicenseStateRecord, 'id' | 'updatedAt'>): LicenseStateRecord {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO license_state (
          id, encryptedLicenseKey, maskedKey, machineId, status, productName, planName,
          activatedAt, expiresAt, lastValidatedAt, lastAttemptAt, lastResultCode,
          offlineGraceUntil, machinesUsed, machinesLimit, analyticsEnabled, updatedAt
        ) VALUES ('primary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          encryptedLicenseKey = excluded.encryptedLicenseKey,
          maskedKey = excluded.maskedKey,
          machineId = excluded.machineId,
          status = excluded.status,
          productName = excluded.productName,
          planName = excluded.planName,
          activatedAt = COALESCE(license_state.activatedAt, excluded.activatedAt),
          expiresAt = excluded.expiresAt,
          lastValidatedAt = excluded.lastValidatedAt,
          lastAttemptAt = excluded.lastAttemptAt,
          lastResultCode = excluded.lastResultCode,
          offlineGraceUntil = excluded.offlineGraceUntil,
          machinesUsed = excluded.machinesUsed,
          machinesLimit = excluded.machinesLimit,
          analyticsEnabled = excluded.analyticsEnabled,
          updatedAt = excluded.updatedAt`
      )
      .run(
        input.encryptedLicenseKey,
        input.maskedKey,
        input.machineId,
        input.status,
        input.productName,
        input.planName,
        input.activatedAt,
        input.expiresAt,
        input.lastValidatedAt,
        input.lastAttemptAt,
        input.lastResultCode,
        input.offlineGraceUntil,
        input.machinesUsed,
        input.machinesLimit,
        input.analyticsEnabled,
        now
      );
    return this.getLicenseState()!;
  }


  // --- v4.0.0 User Profile, Trial State & Entitlement History ---
  public getUserProfile(): UserProfileRecord | undefined {
    return this.db
      .prepare("SELECT * FROM user_profile WHERE id = 'primary'")
      .get() as UserProfileRecord | undefined;
  }

  public saveUserProfile(username: string): UserProfileRecord {
    const now = new Date().toISOString();
    const existing = this.getUserProfile();
    this.db
      .prepare(
        `INSERT INTO user_profile (id, username, createdAt, updatedAt)
         VALUES ('primary', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           username = excluded.username,
           updatedAt = excluded.updatedAt`
      )
      .run(username, existing?.createdAt ?? now, now);
    return this.getUserProfile()!;
  }

  public getTrialState(): TrialStateRecord | undefined {
    return this.db
      .prepare("SELECT * FROM trial_state WHERE id = 'primary'")
      .get() as TrialStateRecord | undefined;
  }

  public saveTrialState(
    input: Omit<TrialStateRecord, 'id' | 'updatedAt'>
  ): TrialStateRecord {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO trial_state (
          id, machineIdHash, status, startedAt, expiresAt, signedEntitlement,
          lastServerTime, maxObservedUtcMs, lastValidatedAt, lastError, updatedAt
        ) VALUES ('primary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          machineIdHash = excluded.machineIdHash,
          status = excluded.status,
          startedAt = excluded.startedAt,
          expiresAt = excluded.expiresAt,
          signedEntitlement = excluded.signedEntitlement,
          lastServerTime = excluded.lastServerTime,
          maxObservedUtcMs = excluded.maxObservedUtcMs,
          lastValidatedAt = excluded.lastValidatedAt,
          lastError = excluded.lastError,
          updatedAt = excluded.updatedAt`
      )
      .run(
        input.machineIdHash,
        input.status,
        input.startedAt,
        input.expiresAt,
        input.signedEntitlement,
        input.lastServerTime,
        input.maxObservedUtcMs,
        input.lastValidatedAt,
        input.lastError,
        now
      );
    return this.getTrialState()!;
  }

  public recordEntitlementEvent(
    eventType: string,
    status: string,
    source: string,
    details: string | null = null
  ): void {
    this.db
      .prepare(
        `INSERT INTO entitlement_history (eventType, status, source, details, createdAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(eventType, status, source, details, new Date().toISOString());
  }

  public getEntitlementHistory(limit = 50): EntitlementHistoryRecord[] {
    return this.db
      .prepare('SELECT * FROM entitlement_history ORDER BY createdAt DESC LIMIT ?')
      .all(limit) as EntitlementHistoryRecord[];
  }

  public clearLicenseState(): void {
    this.db.prepare("DELETE FROM license_state WHERE id = 'primary'").run();
  }

  public getAppSetting(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  public setAppSetting(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, value);
  }



  public updateMaintenanceWindow(
    id: string,
    updates: Partial<{ endsAt: string; enabled: boolean }>
  ): boolean {
    const row = this.db
      .prepare('SELECT * FROM maintenance_windows WHERE id = ?')
      .get(id) as MaintenanceWindowRecord | undefined;
    if (!row) return false;
    const res = this.db
      .prepare('UPDATE maintenance_windows SET endsAt = ?, enabled = ? WHERE id = ?')
      .run(
        updates.endsAt ?? row.endsAt,
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : row.enabled,
        id
      );
    return res.changes > 0;
  }

  // --- PM2 Process Monitoring & History ---
  public upsertPm2Instances(
    serverId: string,
    instances: Array<{
      linuxUser: string;
      pm2Path: string | null;
      daemonAvailable: boolean;
      accessible: boolean;
      processCount: number;
      error: string | null;
    }>
  ): void {
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM pm2_instances WHERE serverId = ?').run(serverId);
      const stmt = this.db.prepare(
        `INSERT INTO pm2_instances (
          id, serverId, linuxUser, pm2Path, daemonAvailable, accessible, processCount, lastError, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const inst of instances) {
        stmt.run(
          `${serverId}:${inst.linuxUser}`,
          serverId,
          inst.linuxUser,
          inst.pm2Path,
          inst.daemonAvailable ? 1 : 0,
          inst.accessible ? 1 : 0,
          inst.processCount,
          inst.error,
          now
        );
      }
    });
    tx();
  }

  public getPm2Instances(serverId?: string): Pm2InstanceRecord[] {
    if (serverId) {
      return this.db
        .prepare('SELECT * FROM pm2_instances WHERE serverId = ? ORDER BY linuxUser ASC')
        .all(serverId) as Pm2InstanceRecord[];
    }
    return this.db
      .prepare('SELECT * FROM pm2_instances ORDER BY serverId ASC, linuxUser ASC')
      .all() as Pm2InstanceRecord[];
  }

  public upsertPm2Processes(
    serverId: string,
    processes: Array<{
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
    }>
  ): void {
    const now = new Date().toISOString();
    const existingRows = this.getPm2Processes(serverId);
    const existingMap = new Map(existingRows.map((r) => [r.processKey, r]));
    const incomingKeys = new Set(processes.map((p) => p.processKey));

    const tx = this.db.transaction(() => {
      for (const old of existingRows) {
        if (!incomingKeys.has(old.processKey)) {
          this.db.prepare('DELETE FROM pm2_processes WHERE id = ?').run(old.id);
        }
      }
      const stmt = this.db.prepare(
        `INSERT INTO pm2_processes (
          id, serverId, processKey, pmId, name, linuxUser, status, state,
          cpu, memoryBytes, uptimeSeconds, restarts, unstableRestarts,
          execMode, instances, nodeVersion, scriptPath, cwd, lastRestartAt,
          pid, envName, intentionalStop, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          pmId = excluded.pmId, name = excluded.name, linuxUser = excluded.linuxUser,
          status = excluded.status, state = excluded.state, cpu = excluded.cpu,
          memoryBytes = excluded.memoryBytes, uptimeSeconds = excluded.uptimeSeconds,
          restarts = excluded.restarts, unstableRestarts = excluded.unstableRestarts,
          execMode = excluded.execMode, instances = excluded.instances,
          nodeVersion = excluded.nodeVersion, scriptPath = excluded.scriptPath,
          cwd = excluded.cwd, lastRestartAt = excluded.lastRestartAt,
          pid = excluded.pid, envName = excluded.envName,
          intentionalStop = excluded.intentionalStop, updatedAt = excluded.updatedAt`
      );
      for (const proc of processes) {
        const prev = existingMap.get(proc.processKey);
        const intentional =
          proc.state === 'online'
            ? 0
            : (prev?.intentionalStop ?? 0);
        stmt.run(
          `${serverId}:${proc.processKey}`,
          serverId,
          proc.processKey,
          proc.pmId,
          proc.name,
          proc.linuxUser,
          proc.status,
          proc.state,
          proc.cpu,
          proc.memoryBytes,
          proc.uptimeSeconds,
          proc.restarts,
          proc.unstableRestarts,
          proc.execMode,
          proc.instances,
          proc.nodeVersion,
          proc.scriptPath,
          proc.cwd,
          proc.lastRestartAt,
          proc.pid,
          proc.envName,
          intentional,
          now
        );
      }
    });
    tx();
  }

  public markPm2IntentionalStop(
    serverId: string,
    processKey: string,
    intentional: boolean
  ): void {
    this.db
      .prepare('UPDATE pm2_processes SET intentionalStop = ? WHERE serverId = ? AND processKey = ?')
      .run(intentional ? 1 : 0, serverId, processKey);
  }

  public getPm2Processes(serverId?: string): Pm2ProcessRecord[] {
    if (serverId) {
      return this.db
        .prepare('SELECT * FROM pm2_processes WHERE serverId = ? ORDER BY linuxUser ASC, pmId ASC')
        .all(serverId) as Pm2ProcessRecord[];
    }
    return this.db
      .prepare('SELECT * FROM pm2_processes ORDER BY serverId ASC, linuxUser ASC, pmId ASC')
      .all() as Pm2ProcessRecord[];
  }

  public getPm2ProcessByKey(
    serverId: string,
    processKey: string
  ): Pm2ProcessRecord | undefined {
    return this.db
      .prepare('SELECT * FROM pm2_processes WHERE serverId = ? AND processKey = ?')
      .get(serverId, processKey) as Pm2ProcessRecord | undefined;
  }

  public recordPm2Metrics(
    serverId: string,
    collectedAt: string,
    processes: Array<{
      processKey: string;
      cpu: number;
      memoryBytes: number;
      restarts: number;
      state: string;
    }>
  ): void {
    const stmt = this.db.prepare(
      `INSERT INTO pm2_metric_history (
        serverId, processKey, collectedAt, cpu, memoryBytes, restarts, state
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const tx = this.db.transaction(() => {
      for (const p of processes) {
        stmt.run(serverId, p.processKey, collectedAt, p.cpu, p.memoryBytes, p.restarts, p.state);
      }
    });
    tx();
  }

  public getPm2MetricHistory(
    serverId: string,
    processKey: string,
    limit = 60
  ): Pm2MetricHistoryRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM pm2_metric_history
         WHERE serverId = ? AND processKey = ?
         ORDER BY collectedAt DESC LIMIT ?`
      )
      .all(serverId, processKey, limit) as Pm2MetricHistoryRecord[];
  }

  public recordPm2StateEvent(input: {
    serverId: string;
    processKey: string;
    processName: string;
    linuxUser: string;
    previousState: string;
    newState: string;
    eventType: string;
    message: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO pm2_state_events (
          serverId, processKey, processName, linuxUser, previousState, newState, eventType, message, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.serverId,
        input.processKey,
        input.processName,
        input.linuxUser,
        input.previousState,
        input.newState,
        input.eventType,
        input.message,
        new Date().toISOString()
      );
  }

  public getPm2StateEvents(
    serverId: string,
    processKey?: string,
    limit = 40
  ): Pm2StateEventRecord[] {
    if (processKey) {
      return this.db
        .prepare(
          `SELECT * FROM pm2_state_events
           WHERE serverId = ? AND processKey = ?
           ORDER BY createdAt DESC LIMIT ?`
        )
        .all(serverId, processKey, limit) as Pm2StateEventRecord[];
    }
    return this.db
      .prepare(
        `SELECT * FROM pm2_state_events
         WHERE serverId = ?
         ORDER BY createdAt DESC LIMIT ?`
      )
      .all(serverId, limit) as Pm2StateEventRecord[];
  }

  public getPm2AlertConfig(serverId: string): Pm2AlertConfigRecord {
    const row = this.db
      .prepare('SELECT * FROM pm2_alert_configs WHERE serverId = ?')
      .get(serverId) as Pm2AlertConfigRecord | undefined;
    return (
      row ?? {
        serverId,
        cpuThreshold: 90,
        memoryMbThreshold: 1024,
        restartSpikeThreshold: 3,
        cooldownSeconds: 300,
        enabled: 1,
      }
    );
  }

  public savePm2AlertConfig(input: Pm2AlertConfigRecord): Pm2AlertConfigRecord {
    this.db
      .prepare(
        `INSERT INTO pm2_alert_configs (
          serverId, cpuThreshold, memoryMbThreshold, restartSpikeThreshold, cooldownSeconds, enabled
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(serverId) DO UPDATE SET
          cpuThreshold = excluded.cpuThreshold,
          memoryMbThreshold = excluded.memoryMbThreshold,
          restartSpikeThreshold = excluded.restartSpikeThreshold,
          cooldownSeconds = excluded.cooldownSeconds,
          enabled = excluded.enabled`
      )
      .run(
        input.serverId,
        input.cpuThreshold,
        input.memoryMbThreshold,
        input.restartSpikeThreshold,
        input.cooldownSeconds,
        input.enabled
      );
    return this.getPm2AlertConfig(input.serverId);
  }


  // --- v4.1.0 Custom Themes Persistence ---
  public getCustomThemes(): CustomThemeRecord[] {
    return this.db
      .prepare('SELECT * FROM custom_themes ORDER BY updatedAt DESC')
      .all() as CustomThemeRecord[];
  }

  public saveCustomTheme(input: {
    id: string;
    name: string;
    themeJson: string;
    isDefault?: boolean;
  }): CustomThemeRecord {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM custom_themes WHERE id = ?')
      .get(input.id) as CustomThemeRecord | undefined;
    if (input.isDefault) {
      this.db.prepare('UPDATE custom_themes SET isDefault = 0').run();
    }
    this.db
      .prepare(
        `INSERT INTO custom_themes (id, name, themeJson, isDefault, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           themeJson = excluded.themeJson,
           isDefault = excluded.isDefault,
           updatedAt = excluded.updatedAt`
      )
      .run(
        input.id,
        input.name,
        input.themeJson,
        input.isDefault !== undefined ? (input.isDefault ? 1 : 0) : (existing?.isDefault ?? 0),
        existing?.createdAt ?? now,
        now
      );
    return this.db
      .prepare('SELECT * FROM custom_themes WHERE id = ?')
      .get(input.id) as CustomThemeRecord;
  }

  public deleteCustomTheme(id: string): boolean {
    const res = this.db.prepare('DELETE FROM custom_themes WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public getActiveThemeId(): string {
    const saved = this.getAppSetting('active_theme_id');
    if (saved) return saved;
    // Migrate legacy v3.x/v4.0 appearance preset seamlessly
    const rawSettings = this.getAppSetting('user_settings_v2');
    if (rawSettings) {
      try {
        const parsed = JSON.parse(rawSettings) as { theme?: string };
        if (parsed.theme === 'midnight') return 'preset-midnight';
        if (parsed.theme === 'oled') return 'preset-oled';
      } catch {}
    }
    return 'preset-dark';
  }

  public setActiveThemeId(id: string): void {
    this.setAppSetting('active_theme_id', id);
  }

  public close(): void {
    this.db.close();
  }
}
