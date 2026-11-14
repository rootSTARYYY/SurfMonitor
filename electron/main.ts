import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from 'electron';

// Fix Windows notification sender identity (avoid electron.app.Electron)
app.setName('Surf Monitor');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.surfmonitor.app');
}

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  CheckRecord,
  HttpMethod,
  IncidentSeverity,
  MonitorRecord,
  MonitorType,
  NotificationChannelRecord,
  SurfDatabase,
} from './db/database';
import {
  calculateAllServiceHealth,
  wouldCreateCircularDependency,
} from './engine/dependencyEngine';
import { HttpMonitorConfig, isValidHttpUrl } from './engine/httpChecker';
import { NotificationService, normalizeSmtpConfig, sendSmtpTestEmail, testSmtpConnection } from './engine/notificationService';
import { MonitoringScheduler, SchedulerEvent } from './engine/scheduler';
import {
  DEFAULT_EXPECTED_STATUS_CODES,
  isValidExpectedStatusExpression,
} from './engine/statusClassifier';
import { calculateUptimeStats, UptimeStats } from './engine/uptime';
import {
  analyzeRedirects,
  analyzeSecurityHeaders,
  crawlBrokenLinks,
} from './engine/websiteIntelligence';
import { RemotePoller } from './remote/remotePoller';
import { SshManager } from './remote/sshManager';
import { decryptSecret, encryptSecret } from './security/secrets';

const isDev = !app.isPackaged;
const DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const HEARTBEAT_PORT = 45821;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let startupTimings: Record<string, number> = {};
let tray: Tray | null = null;
let db: SurfDatabase | null = null;
let scheduler: MonitoringScheduler | null = null;
let notifier: NotificationService | null = null;
let heartbeatServer: http.Server | null = null;
let sshManager: SshManager | null = null;
let remotePoller: RemotePoller | null = null;
let isQuitting = false;
let minimizeToTray = true;

const ALLOWED_INTERVALS = new Set([30, 60, 120, 300]);
const ALLOWED_METHODS = new Set<HttpMethod>([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);
const ALLOWED_TYPES = new Set<MonitorType>([
  'http',
  'ssl',
  'dns',
  'tcp',
  'ping',
  'keyword',
  'heartbeat',
  'content',
  'domain',
]);

export type DerivedMonitorStatus =
  | 'UP'
  | 'DEGRADED'
  | 'DOWN'
  | 'PAUSED'
  | 'NO_DATA';

export interface MonitorSummaryDTO {
  id: string;
  name: string;
  url: string;
  monitorType: MonitorType;
  method: HttpMethod;
  interval: number;
  timeout: number;
  expectedStatusCodes: string;
  groupId: string | null;
  tags: string[];
  hasAuthSecret: boolean;
  config: Record<string, unknown>;
  enabled: boolean;
  status: DerivedMonitorStatus;
  networkConnected: boolean | null;
  httpResponseReceived: boolean | null;
  applicationHealthy: boolean | null;
  responseTimeMs: number | null;
  httpStatusCode: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  stats: UptimeStats;
  recentHistory: Array<{
    checkedAt: string;
    state: 'UP' | 'DEGRADED' | 'DOWN';
    responseTime: number | null;
    statusCode: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

function getRangeCutoffIso(range: string): string | undefined {
  const now = Date.now();
  switch (range) {
    case '1h':
      return new Date(now - 1 * 3600_000).toISOString();
    case '6h':
      return new Date(now - 6 * 3600_000).toISOString();
    case '24h':
      return new Date(now - 24 * 3600_000).toISOString();
    case '7d':
      return new Date(now - 7 * 24 * 3600_000).toISOString();
    case '30d':
      return new Date(now - 30 * 24 * 3600_000).toISOString();
    default:
      return new Date(now - 24 * 3600_000).toISOString();
  }
}

function deriveCheckState(check: CheckRecord): 'UP' | 'DEGRADED' | 'DOWN' {
  if (
    check.state === 'UP' ||
    check.state === 'DEGRADED' ||
    check.state === 'DOWN'
  ) {
    return check.state;
  }
  return check.success === 1
    ? 'UP'
    : check.statusCode !== null
      ? 'DEGRADED'
      : 'DOWN';
}

function sanitizeConfigForRenderer(
  rawJson: string
): { safeConfig: Record<string, unknown>; hasAuthSecret: boolean } {
  try {
    const parsed = JSON.parse(rawJson || '{}') as Record<string, unknown>;
    const hasAuthSecret = Boolean(parsed.authSecretEncrypted);
    const safeConfig = { ...parsed };
    delete safeConfig.authSecretEncrypted;
    return { safeConfig, hasAuthSecret };
  } catch {
    return { safeConfig: {}, hasAuthSecret: false };
  }
}

function buildMonitorSummary(
  database: SurfDatabase,
  monitor: MonitorRecord
): MonitorSummaryDTO {
  const checks = database.getChecksForMonitor(monitor.id, undefined, 500);
  const stats = calculateUptimeStats(checks);
  const latest: CheckRecord | undefined = checks[0];

  let status: DerivedMonitorStatus;
  if (monitor.enabled !== 1) {
    status = 'PAUSED';
  } else if (!latest) {
    status = 'NO_DATA';
  } else {
    status = deriveCheckState(latest);
  }

  let parsedTags: string[] = [];
  try {
    parsedTags = JSON.parse(monitor.tags || '[]') as string[];
  } catch {
    parsedTags = [];
  }

  const { safeConfig, hasAuthSecret } = sanitizeConfigForRenderer(
    monitor.configJson
  );

  return {
    id: monitor.id,
    name: monitor.name,
    url: monitor.url,
    monitorType: (monitor.monitorType || 'http') as MonitorType,
    method: monitor.method,
    interval: monitor.interval,
    timeout: monitor.timeout,
    expectedStatusCodes:
      monitor.expectedStatusCodes || DEFAULT_EXPECTED_STATUS_CODES,
    groupId: monitor.groupId ?? null,
    tags: parsedTags,
    hasAuthSecret,
    config: safeConfig,
    enabled: monitor.enabled === 1,
    status,
    networkConnected: latest ? latest.networkConnected === 1 : null,
    httpResponseReceived: latest ? latest.httpResponseReceived === 1 : null,
    applicationHealthy: latest ? latest.applicationHealthy === 1 : null,
    responseTimeMs: latest?.responseTime ?? null,
    httpStatusCode: latest?.statusCode ?? null,
    lastCheckedAt: latest?.checkedAt ?? null,
    lastError: latest?.errorMessage ?? null,
    stats,
    recentHistory: checks
      .slice(0, 24)
      .reverse()
      .map((c) => ({
        checkedAt: c.checkedAt,
        state: deriveCheckState(c),
        responseTime: c.responseTime,
        statusCode: c.statusCode,
      })),
    createdAt: monitor.createdAt,
    updatedAt: monitor.updatedAt,
  };
}

function validateMonitorPayload(
  payload: unknown,
  existingConfigJson?: string
): {
  name: string;
  url: string;
  monitorType: MonitorType;
  method: HttpMethod;
  interval: number;
  timeout: number;
  expectedStatusCodes: string;
  groupId: string | null;
  tags: string[];
  configJson: string;
} {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid monitor payload');
  }
  const p = payload as Record<string, unknown>;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const url = typeof p.url === 'string' ? p.url.trim() : '';
  const monitorType = (
    typeof p.monitorType === 'string' ? p.monitorType : 'http'
  ) as MonitorType;
  const method = (
    typeof p.method === 'string' ? p.method : 'GET'
  ) as HttpMethod;
  const interval = Number(p.interval);
  const timeout = Number(p.timeout);
  const rawExpected =
    typeof p.expectedStatusCodes === 'string' && p.expectedStatusCodes.trim()
      ? p.expectedStatusCodes.trim()
      : DEFAULT_EXPECTED_STATUS_CODES;

  if (name.length < 2 || name.length > 120) {
    throw new Error('Monitor name must be between 2 and 120 characters');
  }
  if (!ALLOWED_TYPES.has(monitorType)) {
    throw new Error('Invalid monitor type');
  }
  if (
    (monitorType === 'http' ||
      monitorType === 'ssl' ||
      monitorType === 'keyword' ||
      monitorType === 'content') &&
    !isValidHttpUrl(url)
  ) {
    throw new Error('Only valid http:// and https:// URLs are allowed');
  }
  if (!url) {
    throw new Error('Target URL or hostname is required');
  }
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error('Invalid HTTP method');
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    throw new Error('Check interval must be 30, 60, 120, or 300 seconds');
  }
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60) {
    throw new Error('Timeout must be an integer between 1 and 60 seconds');
  }
  if (!isValidExpectedStatusExpression(rawExpected)) {
    throw new Error('Invalid expected HTTP status codes expression');
  }

  const groupId = typeof p.groupId === 'string' && p.groupId ? p.groupId : null;
  const tags = Array.isArray(p.tags)
    ? p.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];

  const rawCfg =
    p.config && typeof p.config === 'object'
      ? ({ ...(p.config as Record<string, unknown>) } as HttpMonitorConfig &
          Record<string, unknown>)
      : {};

  // Preserve or encrypt authentication secret
  if (typeof rawCfg.authSecretPlain === 'string' && rawCfg.authSecretPlain) {
    rawCfg.authSecretEncrypted = encryptSecret(rawCfg.authSecretPlain);
    delete rawCfg.authSecretPlain;
  } else if (existingConfigJson) {
    try {
      const prev = JSON.parse(existingConfigJson) as Record<string, unknown>;
      if (prev.authSecretEncrypted && rawCfg.authType !== 'none') {
        rawCfg.authSecretEncrypted = String(prev.authSecretEncrypted);
      }
    } catch {
      // ignore
    }
  }

  return {
    name,
    url,
    monitorType,
    method,
    interval,
    timeout,
    expectedStatusCodes: rawExpected,
    groupId,
    tags,
    configJson: JSON.stringify(rawCfg),
  };
}

function emitToRenderer(event: SchedulerEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('monitor:event', event);
  }
}

function getAppIconPath(): string | undefined {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const candidate = path.join(app.getAppPath(), 'build', iconFile);
  return fs.existsSync(candidate) ? candidate : undefined;
}

function createTray(): void {
  if (tray) return;
  const pngPath = path.join(app.getAppPath(), 'build', 'icon.png');
  const trayIcon = fs.existsSync(pngPath)
    ? nativeImage.createFromPath(pngPath).resize({ width: 16, height: 16 })
    : nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVR42mNgGGjACMRNQAwC/0GYCU0NUDwXSAPl/wMxOxY5sJgN1IApGpgNxN8hYhga2QPE1xFiGBo5AMQ3EGIYGjkExLcQYhgauQnEdxFiGBr5BcSf0dUCANiSEz1x/69UAAAAAElFTkSuQmCC'
      );
  tray = new Tray(trayIcon);
  tray.setToolTip('Surf Monitor');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Surf Monitor',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Pause Monitoring',
      click: () => {
        scheduler?.pauseAll();
      },
    },
    {
      label: 'Resume Monitoring',
      click: () => {
        scheduler?.resumeAll();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function startHeartbeatServer(): void {
  if (heartbeatServer) return;
  heartbeatServer = http.createServer((req, res) => {
    if (req.method === 'POST' || req.method === 'GET') {
      const match = req.url?.match(/^\/heartbeat\/([a-zA-Z0-9_-]+)/);
      if (match && db) {
        const monitorId = match[1];
        const mon = db.getMonitorById(monitorId);
        if (mon && mon.monitorType === 'heartbeat') {
          db.recordHeartbeat(monitorId, req.socket.remoteAddress ?? null, null);
          void scheduler?.runManualCheck(monitorId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, monitorId }));
          return;
        }
      }
    }
    res.writeHead(404);
    res.end('Not found');
  });
  heartbeatServer.listen(HEARTBEAT_PORT, '127.0.0.1', () => {});
  heartbeatServer.on('error', () => {
    // Port may already be in use in dev reloads
  });
}

function createWindow(): void {
  const iconPath = getAppIconPath();
  mainWindow = new BrowserWindow({
    ...(iconPath ? { icon: iconPath } : {}),
    width: 1400,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: 'Surf Monitor',
    backgroundColor: '#09090b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });



  mainWindow.on('close', (event) => {
    if (!isQuitting && minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[SurfMonitor] Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`
      );
    }
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isValidHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    void mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


function registerIpcHandlers(): void {
  ipcMain.handle('app:get-info', () => ({
    name: 'Surf Monitor',
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    dbPath: path.join(app.getPath('userData'), 'surf-monitor.db'),
    heartbeatPort: HEARTBEAT_PORT,
    loginItemEnabled: app.getLoginItemSettings().openAtLogin,
  }));

  ipcMain.handle('app:open-external', async (_event, url: string) => {
    if (typeof url === 'string' && isValidHttpUrl(url)) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle(
    'app:set-desktop-prefs',
    (_event, prefs: { launchOnStartup?: boolean; minimizeToTray?: boolean }) => {
      if (typeof prefs.launchOnStartup === 'boolean') {
        app.setLoginItemSettings({ openAtLogin: prefs.launchOnStartup });
      }
      if (typeof prefs.minimizeToTray === 'boolean') {
        minimizeToTray = prefs.minimizeToTray;
      }
      return true;
    }
  );

  // --- Monitors ---
  ipcMain.handle('monitors:list', () => {
    if (!db) throw new Error('Database not initialized');
    return db.getAllMonitors().map((m) => buildMonitorSummary(db!, m));
  });

  ipcMain.handle(
    'monitors:detail',
    (_event, id: unknown, range: unknown = '24h') => {
      if (!db) throw new Error('Database not initialized');
      if (typeof id !== 'string' || !id) throw new Error('Invalid monitor ID');

      const monitor = db.getMonitorById(id);
      if (!monitor) throw new Error('Monitor not found');

      const sinceIso = getRangeCutoffIso(
        typeof range === 'string' ? range : '24h'
      );
      return {
        monitor: buildMonitorSummary(db, monitor),
        checks: db.getChecksForMonitor(id, sinceIso, 300),
        incidents: db.getAllIncidents().filter((inc) => inc.monitorId === id),
        sslResults: db.getSslResults(id, 10),
        dnsResults: db.getDnsResults(id, 20),
        domainResults: db.getDomainResults(id, 10),
        heartbeatEvents: db.getHeartbeatEvents(id, 20),
        latestContent: db.getLatestContentSnapshot(id) ?? null,
      };
    }
  );

  ipcMain.handle('monitors:create', (_event, payload: unknown) => {
    if (!db || !scheduler) throw new Error('Engine not initialized');
    const validated = validateMonitorPayload(payload);
    const created = db.createMonitor(validated);
    scheduler.scheduleMonitor(created, true);
    emitToRenderer({ type: 'monitor-updated', monitorId: created.id });
    return buildMonitorSummary(db, created);
  });

  ipcMain.handle(
    'monitors:update',
    (_event, id: unknown, payload: unknown) => {
      if (!db || !scheduler) throw new Error('Engine not initialized');
      if (typeof id !== 'string' || !id) throw new Error('Invalid monitor ID');
      const existing = db.getMonitorById(id);
      if (!existing) throw new Error('Monitor not found');

      const validated = validateMonitorPayload(payload, existing.configJson);
      const updated = db.updateMonitor(id, validated);
      if (!updated) throw new Error('Monitor not found');

      if (updated.enabled === 1) {
        scheduler.scheduleMonitor(updated, false);
      } else {
        scheduler.unscheduleMonitor(updated.id);
      }
      emitToRenderer({ type: 'monitor-updated', monitorId: updated.id });
      return buildMonitorSummary(db, updated);
    }
  );

  ipcMain.handle('monitors:delete', (_event, id: unknown) => {
    if (!db || !scheduler) throw new Error('Engine not initialized');
    if (typeof id !== 'string' || !id) throw new Error('Invalid monitor ID');
    scheduler.unscheduleMonitor(id);
    const deleted = db.deleteMonitor(id);
    if (deleted) {
      emitToRenderer({ type: 'monitor-deleted', monitorId: id });
    }
    return deleted;
  });

  ipcMain.handle(
    'monitors:toggle',
    (_event, id: unknown, enabled: unknown) => {
      if (!db || !scheduler) throw new Error('Engine not initialized');
      if (typeof id !== 'string' || !id) throw new Error('Invalid monitor ID');
      if (typeof enabled !== 'boolean') throw new Error('Invalid enabled flag');
      const updated = db.updateMonitor(id, { enabled });
      if (!updated) throw new Error('Monitor not found');
      if (enabled) scheduler.scheduleMonitor(updated, true);
      else scheduler.unscheduleMonitor(updated.id);
      emitToRenderer({ type: 'monitor-updated', monitorId: updated.id });
      return buildMonitorSummary(db, updated);
    }
  );

  ipcMain.handle('monitors:manual-check', async (_event, id: unknown) => {
    if (!db || !scheduler) throw new Error('Engine not initialized');
    if (typeof id !== 'string' || !id) throw new Error('Invalid monitor ID');
    return scheduler.runManualCheck(id);
  });

  // --- Overview & Analytics ---
  ipcMain.handle('overview:data', (_event, range: unknown = '24h') => {
    if (!db) throw new Error('Database not initialized');
    const sinceIso = getRangeCutoffIso(
      typeof range === 'string' ? range : '24h'
    );
    const monitors = db
      .getAllMonitors()
      .map((m) => buildMonitorSummary(db!, m));
    const recentChecks = db.getRecentChecksWithMonitor(20);
    const rangeChecks = db.getAllChecksSince(sinceIso, 500);

    return {
      monitors,
      recentChecks,
      latencyPoints: [...rangeChecks]
        .reverse()
        .filter((c) => c.responseTime !== null)
        .map((c) => ({
          time: c.checkedAt,
          responseTime: c.responseTime as number,
          state: deriveCheckState(c),
        })),
    };
  });

  ipcMain.handle('analytics:data', (_event, range: unknown = '7d') => {
    if (!db) throw new Error('Database not initialized');
    const sinceIso = getRangeCutoffIso(
      typeof range === 'string' ? range : '7d'
    );
    const monitors = db
      .getAllMonitors()
      .map((m) => buildMonitorSummary(db!, m));
    const checks = db.getAllChecksSince(sinceIso, 5000);
    const stats = calculateUptimeStats(checks);
    return { monitors, checks: [...checks].reverse(), stats };
  });

  // --- Incidents ---
  ipcMain.handle('incidents:list', () => {
    if (!db) throw new Error('Database not initialized');
    return db.getAllIncidents();
  });

  ipcMain.handle('incidents:events', (_event, incidentId: string) => {
    if (!db) throw new Error('Database not initialized');
    return db.getIncidentEvents(incidentId);
  });

  ipcMain.handle(
    'incidents:add-note',
    (_event, incidentId: string, note: string) => {
      if (!db) throw new Error('Database not initialized');
      if (!note.trim()) throw new Error('Note cannot be empty');
      db.addIncidentEvent(incidentId, 'manual_note', note.trim());
      return db.getIncidentEvents(incidentId);
    }
  );

  ipcMain.handle(
    'incidents:update',
    (
      _event,
      id: string,
      updates: {
        severity?: IncidentSeverity;
        acknowledged?: boolean;
        status?: 'open' | 'resolved';
        resolutionNote?: string;
      }
    ) => {
      if (!db) throw new Error('Database not initialized');
      return db.updateIncident(id, updates);
    }
  );

  // --- Groups, Services & Dependencies ---
  ipcMain.handle('groups:list', () => db?.getAllGroups() ?? []);
  ipcMain.handle(
    'groups:create',
    (
      _event,
      input: { name: string; description?: string; color?: string; tags?: string[] }
    ) => {
      if (!db) throw new Error('Database not initialized');
      return db.createGroup(input);
    }
  );
  ipcMain.handle('groups:delete', (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    return db.deleteGroup(id);
  });

  ipcMain.handle('services:overview', () => {
    if (!db) throw new Error('Database not initialized');
    const services = db.getAllServices();
    const monitors = db.getAllMonitors();
    const links = db.getServiceMonitorLinks();
    const deps = db.getAllServiceDependencies();
    const latestChecksByMonitor = new Map<string, CheckRecord>();
    for (const m of monitors) {
      const latest = db.getChecksForMonitor(m.id, undefined, 1)[0];
      if (latest) latestChecksByMonitor.set(m.id, latest);
    }
    const health = calculateAllServiceHealth({
      services,
      monitors,
      latestChecksByMonitor,
      serviceMonitorLinks: links,
      dependencies: deps,
    });
    return { services: health, links, dependencies: deps };
  });

  ipcMain.handle(
    'services:create',
    (
      _event,
      input: { name: string; description?: string; staleThresholdSeconds?: number }
    ) => {
      if (!db) throw new Error('Database not initialized');
      return db.createService(input);
    }
  );

  ipcMain.handle('services:delete', (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    return db.deleteService(id);
  });

  ipcMain.handle(
    'services:link-monitor',
    (_event, serviceId: string, monitorId: string, isCritical: boolean) => {
      if (!db) throw new Error('Database not initialized');
      db.setServiceMonitor(serviceId, monitorId, isCritical);
      return true;
    }
  );

  ipcMain.handle(
    'services:unlink-monitor',
    (_event, serviceId: string, monitorId: string) => {
      if (!db) throw new Error('Database not initialized');
      db.removeServiceMonitor(serviceId, monitorId);
      return true;
    }
  );

  ipcMain.handle(
    'services:add-dependency',
    (
      _event,
      serviceId: string,
      dependsOnServiceId: string,
      isCritical: boolean
    ) => {
      if (!db) throw new Error('Database not initialized');
      const existing = db.getAllServiceDependencies();
      if (
        wouldCreateCircularDependency(existing, serviceId, dependsOnServiceId)
      ) {
        throw new Error(
          'Circular dependency rejected: this relationship would create a cycle.'
        );
      }
      return db.addServiceDependency(serviceId, dependsOnServiceId, isCritical);
    }
  );

  ipcMain.handle('services:remove-dependency', (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    return db.removeServiceDependency(id);
  });

  // --- Notifications ---
  ipcMain.handle('notifications:channels', () => {
    if (!db) throw new Error('Database not initialized');
    return db.getNotificationChannels().map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      enabled: c.enabled === 1,
      createdAt: c.createdAt,
    }));
  });

  ipcMain.handle(
    'notifications:create-channel',
    (
      _event,
      input: {
        name: string;
        type: NotificationChannelRecord['type'];
        config: Record<string, unknown>;
      }
    ) => {
      if (!db) throw new Error('Database not initialized');
      const encrypted = encryptSecret(JSON.stringify(input.config));
      const created = db.createNotificationChannel({
        name: input.name,
        type: input.type,
        configEncrypted: encrypted,
      });
      return {
        id: created.id,
        name: created.name,
        type: created.type,
        enabled: created.enabled === 1,
        createdAt: created.createdAt,
      };
    }
  );

  ipcMain.handle('notifications:get-channel-safe', (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    const ch = db.getNotificationChannels().find((c) => c.id === id);
    if (!ch) throw new Error('Channel not found');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(decryptSecret(ch.configEncrypted)) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    if (ch.type === 'email') {
      const norm = normalizeSmtpConfig(parsed);
      return {
        id: ch.id,
        name: ch.name,
        type: ch.type,
        smtp: {
          provider: norm.provider ?? 'custom',
          host: norm.host,
          port: norm.port,
          security: norm.security,
          authEnabled: norm.authEnabled,
          username: norm.username ?? '',
          hasPassword: Boolean(norm.password),
          senderName: norm.senderName ?? '',
          senderEmail: norm.senderEmail ?? '',
          recipientEmail: norm.recipientEmail,
        },
      };
    }
    return { id: ch.id, name: ch.name, type: ch.type };
  });

  ipcMain.handle(
    'notifications:update-channel',
    (
      _event,
      id: string,
      input: {
        name: string;
        config: Record<string, unknown>;
        clearPassword?: boolean;
      }
    ) => {
      if (!db) throw new Error('Database not initialized');
      const ch = db.getNotificationChannels().find((c) => c.id === id);
      if (!ch) throw new Error('Channel not found');
      let merged = { ...input.config };
      if (ch.type === 'email') {
        let prevCfg: Record<string, unknown> = {};
        try {
          prevCfg = JSON.parse(decryptSecret(ch.configEncrypted)) as Record<string, unknown>;
        } catch {
          prevCfg = {};
        }
        const prevPass = String(prevCfg.password ?? prevCfg.pass ?? '');
        if (input.clearPassword) {
          merged.password = '';
        } else if (!merged.password && prevPass) {
          merged.password = prevPass;
        }
      }
      const updated = db.updateNotificationChannel(id, {
        name: input.name,
        configEncrypted: encryptSecret(JSON.stringify(merged)),
      });
      if (!updated) throw new Error('Channel not found');
      return {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        enabled: updated.enabled === 1,
        createdAt: updated.createdAt,
      };
    }
  );

  ipcMain.handle(
    'notifications:test-smtp-connection',
    async (_event, input: { channelId?: string; config: Record<string, unknown> }) => {
      if (!db) throw new Error('Database not initialized');
      const cfg = { ...input.config };
      if (input.channelId && !cfg.password) {
        const ch = db.getNotificationChannels().find((c) => c.id === input.channelId);
        if (ch) {
          try {
            const prev = JSON.parse(decryptSecret(ch.configEncrypted)) as Record<string, unknown>;
            if (prev.password || prev.pass) cfg.password = prev.password ?? prev.pass;
          } catch {}
        }
      }
      return testSmtpConnection(cfg);
    }
  );

  ipcMain.handle(
    'notifications:send-smtp-test-email',
    async (_event, input: { channelId?: string; config: Record<string, unknown> }) => {
      if (!db) throw new Error('Database not initialized');
      const cfg = { ...input.config };
      if (input.channelId && !cfg.password) {
        const ch = db.getNotificationChannels().find((c) => c.id === input.channelId);
        if (ch) {
          try {
            const prev = JSON.parse(decryptSecret(ch.configEncrypted)) as Record<string, unknown>;
            if (prev.password || prev.pass) cfg.password = prev.password ?? prev.pass;
          } catch {}
        }
      }
      return sendSmtpTestEmail(cfg);
    }
  );

  ipcMain.handle('notifications:delete-channel', (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    return db.deleteNotificationChannel(id);
  });

  ipcMain.handle('notifications:test-channel', async (_event, id: string) => {
    if (!db || !notifier) throw new Error('Notifier not initialized');
    const ch = db.getNotificationChannels().find((c) => c.id === id);
    if (!ch) throw new Error('Channel not found');
    return notifier.sendToChannel(ch, {
      monitorName: 'Test Monitor',
      currentState: 'UP',
      previousState: 'UNKNOWN',
      timestamp: new Date().toISOString(),
      responseTimeMs: 42,
      errorDetails: 'Test notification from Surf Monitor v2.0.0',
      eventType: 'TEST',
    });
  });

  ipcMain.handle('notifications:history', () => {
    return db?.getNotificationHistory(100) ?? [];
  });

  // --- Website Intelligence ---
  ipcMain.handle('intel:redirects', (_event, url: string) =>
    analyzeRedirects(url)
  );
  ipcMain.handle('intel:security-headers', (_event, url: string) =>
    analyzeSecurityHeaders(url)
  );
  ipcMain.handle('intel:broken-links-list', () =>
    db?.getBrokenLinkScans() ?? []
  );
  ipcMain.handle('intel:broken-links-results', (_event, scanId: string) =>
    db?.getBrokenLinkResults(scanId) ?? []
  );
  ipcMain.handle(
    'intel:run-broken-links',
    async (_event, targetUrl: string, maxPages = 10, maxDepth = 1) => {
      if (!db) throw new Error('Database not initialized');
      const scan = db.createBrokenLinkScan(targetUrl);
      try {
        const res = await crawlBrokenLinks({
          startUrl: targetUrl,
          maxPages,
          maxDepth,
        });
        const brokenCount = res.results.filter((r) => r.broken).length;
        db.completeBrokenLinkScan(
          scan.id,
          res.pagesScanned,
          brokenCount,
          'completed',
          res.results
        );
      } catch {
        db.completeBrokenLinkScan(scan.id, 0, 0, 'failed', []);
      }
      return {
        scanId: scan.id,
        scans: db.getBrokenLinkScans(),
        results: db.getBrokenLinkResults(scan.id),
      };
    }
  );


  // --- Remote Infrastructure (Phases 14 & 15) ---
  ipcMain.handle('servers:pick-key-file', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Select SSH Private Key',
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return {
      path: res.filePaths[0],
      content: fs.readFileSync(res.filePaths[0], 'utf8'),
    };
  });

  ipcMain.handle('servers:list', () => {
    if (!db) throw new Error('Database not initialized');
    return db.getAllRemoteServers().map((s) => {
      const latestMetric = db!.getServerMetrics(s.id, 1)[0] ?? null;
      return {
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        username: s.username,
        hostFingerprint: s.hostFingerprint,
        agentPort: s.agentPort,
        groupName: s.groupName,
        tags: JSON.parse(s.tags || '[]') as string[],
        pollIntervalSeconds: s.pollIntervalSeconds,
        cpuThreshold: s.cpuThreshold,
        ramThreshold: s.ramThreshold,
        diskThreshold: s.diskThreshold,
        enabled: s.enabled === 1,
        connectionStatus: s.connectionStatus,
        hostname: s.hostname,
        osInfo: s.osInfo,
        kernelVersion: s.kernelVersion,
        cpuCores: s.cpuCores,
        totalMemoryBytes: s.totalMemoryBytes,
        agentVersion: s.agentVersion,
        lastSeenAt: s.lastSeenAt,
        lastError: s.lastError,
        latestMetric: s.connectionStatus === 'connected' ? latestMetric : null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });
  });

  ipcMain.handle('servers:detail', (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    const s = db.getRemoteServerById(id);
    if (!s) throw new Error('Server not found');
    const metrics = db.getServerMetrics(id, 60);
    const auditLogs = db.getAuditLogs(id, 50);
    return {
      server: {
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        username: s.username,
        hostFingerprint: s.hostFingerprint,
        agentPort: s.agentPort,
        groupName: s.groupName,
        tags: JSON.parse(s.tags || '[]') as string[],
        pollIntervalSeconds: s.pollIntervalSeconds,
        cpuThreshold: s.cpuThreshold,
        ramThreshold: s.ramThreshold,
        diskThreshold: s.diskThreshold,
        enabled: s.enabled === 1,
        connectionStatus: s.connectionStatus,
        hostname: s.hostname,
        osInfo: s.osInfo,
        kernelVersion: s.kernelVersion,
        cpuCores: s.cpuCores,
        totalMemoryBytes: s.totalMemoryBytes,
        agentVersion: s.agentVersion,
        lastSeenAt: s.lastSeenAt,
        lastError: s.lastError,
        latestMetric: s.connectionStatus === 'connected' ? (metrics[0] ?? null) : null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      },
      metrics: [...metrics].reverse(),
      auditLogs,
    };
  });

  ipcMain.handle(
    'servers:test-ssh',
    async (
      _event,
      params: {
        host: string;
        port: number;
        username: string;
        privateKey: string;
        passphrase?: string;
        agentPort?: number;
        agentToken?: string;
      }
    ) => {
      if (!sshManager) throw new Error('SSH manager not initialized');
      return sshManager.testConnection(params);
    }
  );

  ipcMain.handle(
    'servers:install-agent',
    async (
      _event,
      params: {
        host: string;
        port: number;
        username: string;
        privateKey: string;
        passphrase?: string;
        agentPort?: number;
      }
    ) => {
      if (!sshManager) throw new Error('SSH manager not initialized');
      const agentDir = isDev
        ? path.join(__dirname, '../agent')
        : path.join(process.resourcesPath, 'agent');
      return sshManager.installAgent({ ...params, agentDir });
    }
  );

  ipcMain.handle(
    'servers:create',
    (
      _event,
      input: {
        name: string;
        host: string;
        port: number;
        username: string;
        privateKey: string;
        passphrase?: string;
        agentToken: string;
        hostFingerprint?: string | null;
        agentPort?: number;
        groupName?: string;
        tags?: string[];
        pollIntervalSeconds?: number;
        cpuThreshold?: number;
        ramThreshold?: number;
        diskThreshold?: number;
      }
    ) => {
      if (!db || !remotePoller) throw new Error('Engine not initialized');
      const created = db.createRemoteServer({
        name: input.name.trim(),
        host: input.host.trim(),
        port: Number(input.port) || 22,
        username: input.username.trim(),
        encryptedPrivateKey: encryptSecret(input.privateKey),
        encryptedPassphrase: input.passphrase
          ? encryptSecret(input.passphrase)
          : '',
        encryptedAgentToken: encryptSecret(input.agentToken),
        hostFingerprint: input.hostFingerprint ?? null,
        agentPort: Number(input.agentPort) || 47200,
        groupName: input.groupName || 'Default',
        tags: input.tags ?? [],
        pollIntervalSeconds: Number(input.pollIntervalSeconds) || 15,
        cpuThreshold: Number(input.cpuThreshold) || 90,
        ramThreshold: Number(input.ramThreshold) || 90,
        diskThreshold: Number(input.diskThreshold) || 90,
      });
      remotePoller.scheduleServer(created, true);
      return created.id;
    }
  );

  ipcMain.handle(
    'servers:update',
    (
      _event,
      id: string,
      input: {
        name?: string;
        host?: string;
        port?: number;
        username?: string;
        privateKey?: string;
        passphrase?: string;
        agentToken?: string;
        hostFingerprint?: string | null;
        agentPort?: number;
        groupName?: string;
        tags?: string[];
        pollIntervalSeconds?: number;
        cpuThreshold?: number;
        ramThreshold?: number;
        diskThreshold?: number;
      }
    ) => {
      if (!db || !remotePoller || !sshManager) throw new Error('Engine not initialized');
      const existing = db.getRemoteServerById(id);
      if (!existing) throw new Error('Server not found');

      const updates: Parameters<SurfDatabase['updateRemoteServer']>[1] = {
        name: input.name !== undefined ? input.name.trim() : undefined,
        host: input.host !== undefined ? input.host.trim() : undefined,
        port: input.port !== undefined ? Number(input.port) || 22 : undefined,
        username: input.username !== undefined ? input.username.trim() : undefined,
        hostFingerprint: input.hostFingerprint !== undefined ? input.hostFingerprint : undefined,
        agentPort: input.agentPort !== undefined ? Number(input.agentPort) || 47200 : undefined,
        groupName: input.groupName,
        tags: input.tags,
        pollIntervalSeconds:
          input.pollIntervalSeconds !== undefined ? Number(input.pollIntervalSeconds) || 15 : undefined,
        cpuThreshold: input.cpuThreshold !== undefined ? Number(input.cpuThreshold) : undefined,
        ramThreshold: input.ramThreshold !== undefined ? Number(input.ramThreshold) : undefined,
        diskThreshold: input.diskThreshold !== undefined ? Number(input.diskThreshold) : undefined,
      };

      if (input.privateKey && input.privateKey.trim()) {
        updates.encryptedPrivateKey = encryptSecret(input.privateKey.trim());
      }
      if (input.passphrase !== undefined && input.passphrase !== '') {
        updates.encryptedPassphrase = encryptSecret(input.passphrase);
      }
      if (input.agentToken && input.agentToken.trim()) {
        updates.encryptedAgentToken = encryptSecret(input.agentToken.trim());
      }

      sshManager.disconnect(id);
      const updated = db.updateRemoteServer(id, updates);
      if (!updated) throw new Error('Server not found');
      if (updated.enabled === 1) {
        remotePoller.scheduleServer(updated, true);
      }
      return updated.id;
    }
  );

  ipcMain.handle('servers:upgrade-agent', async (_event, id: string) => {
    if (!db || !sshManager || !remotePoller) throw new Error('Engine not initialized');
    const srv = db.getRemoteServerById(id);
    if (!srv) throw new Error('Server not found');
    const agentDir = isDev
      ? path.join(__dirname, '../agent')
      : path.join(process.resourcesPath, 'agent');
    const res = await sshManager.installAgent({
      host: srv.host,
      port: srv.port,
      username: srv.username,
      privateKey: decryptSecret(srv.encryptedPrivateKey),
      passphrase: srv.encryptedPassphrase ? decryptSecret(srv.encryptedPassphrase) : undefined,
      agentPort: srv.agentPort,
      agentDir,
      existingToken: srv.encryptedAgentToken ? decryptSecret(srv.encryptedAgentToken) : undefined,
    });
    if (res.ok && res.token) {
      db.updateRemoteServer(id, {
        encryptedAgentToken: encryptSecret(res.token),
        hostFingerprint: res.fingerprint ?? srv.hostFingerprint,
      });
      sshManager.disconnect(id);
      await remotePoller.pollServer(id);
    }
    db.recordAuditLog({
      serverId: id,
      action: 'agent:upgrade',
      target: srv.host,
      status: res.ok ? 'success' : 'failed',
    });
    return res;
  });

  // --- PM2 Process Monitoring & Management ---
  ipcMain.handle('pm2:list-all', () => {
    if (!db) throw new Error('Database not initialized');
    const servers = db.getAllRemoteServers();
    const instances = db.getPm2Instances();
    const processes = db.getPm2Processes();
    return { servers, instances, processes };
  });

  ipcMain.handle('pm2:refresh', async (_event, serverId?: string) => {
    if (!db || !remotePoller) throw new Error('Engine not initialized');
    const targets = serverId
      ? [db.getRemoteServerById(serverId)].filter(Boolean)
      : db.getAllRemoteServers().filter((s) => s.enabled === 1);
    for (const srv of targets) {
      if (srv) await remotePoller.pollPm2ForServer(srv, true);
    }
    return {
      servers: db.getAllRemoteServers(),
      instances: db.getPm2Instances(),
      processes: db.getPm2Processes(),
    };
  });

  ipcMain.handle('pm2:detail', (_event, serverId: string, processKey: string) => {
    if (!db) throw new Error('Database not initialized');
    const processRecord = db.getPm2ProcessByKey(serverId, processKey);
    if (!processRecord) throw new Error('PM2 process not found');
    return {
      process: processRecord,
      history: [...db.getPm2MetricHistory(serverId, processKey, 60)].reverse(),
      events: db.getPm2StateEvents(serverId, processKey, 40),
      alertConfig: db.getPm2AlertConfig(serverId),
    };
  });

  ipcMain.handle(
    'pm2:logs',
    async (_event, serverId: string, linuxUser: string, pmId: number, lines = 120) => {
      if (!db || !sshManager) throw new Error('Engine not initialized');
      const srv = db.getRemoteServerById(serverId);
      if (!srv) throw new Error('Server not found');
      const safeLines = Math.min(300, Math.max(10, Number(lines) || 120));
      return sshManager.requestAgent(
        srv,
        'GET',
        `/pm2/processes/${linuxUser}/${pmId}/logs?lines=${safeLines}`
      );
    }
  );

  ipcMain.handle(
    'pm2:action',
    async (_event, serverId: string, linuxUser: string, pmId: number, action: string) => {
      if (!remotePoller) throw new Error('Poller not initialized');
      return remotePoller.executePm2Action(serverId, linuxUser, pmId, action);
    }
  );

  ipcMain.handle(
    'pm2:save-alert-config',
    (
      _event,
      config: {
        serverId: string;
        cpuThreshold: number;
        memoryMbThreshold: number;
        restartSpikeThreshold: number;
        cooldownSeconds: number;
        enabled: number;
      }
    ) => {
      if (!db) throw new Error('Database not initialized');
      return db.savePm2AlertConfig(config);
    }
  );

  ipcMain.handle('servers:delete', (_event, id: string) => {
    if (!db || !remotePoller || !sshManager) throw new Error('Not initialized');
    remotePoller.unscheduleServer(id);
    sshManager.disconnect(id);
    return db.deleteRemoteServer(id);
  });

  ipcMain.handle('servers:toggle-connect', (_event, id: string, enabled: boolean) => {
    if (!db || !remotePoller || !sshManager) throw new Error('Not initialized');
    const updated = db.updateRemoteServer(id, { enabled });
    if (!updated) throw new Error('Server not found');
    if (enabled) {
      remotePoller.scheduleServer(updated, true);
    } else {
      remotePoller.unscheduleServer(id);
      sshManager.disconnect(id);
      db.updateRemoteServerRuntime(id, { connectionStatus: 'disconnected' });
    }
    return true;
  });

  ipcMain.handle('servers:poll-now', async (_event, id: string) => {
    if (!remotePoller) throw new Error('Poller not initialized');
    return remotePoller.pollServer(id);
  });

  ipcMain.handle('servers:docker-list', async (_event, serverId: string) => {
    if (!db || !sshManager) throw new Error('Not initialized');
    const srv = db.getRemoteServerById(serverId);
    if (!srv) throw new Error('Server not found');
    return sshManager.requestAgent(srv, 'GET', '/docker/containers');
  });

  ipcMain.handle(
    'servers:docker-action',
    async (_event, serverId: string, containerId: string, action: string) => {
      if (!remotePoller) throw new Error('Poller not initialized');
      return remotePoller.executeDockerAction(serverId, containerId, action);
    }
  );

  ipcMain.handle('servers:services-list', async (_event, serverId: string) => {
    if (!db || !sshManager) throw new Error('Not initialized');
    const srv = db.getRemoteServerById(serverId);
    if (!srv) throw new Error('Server not found');
    return sshManager.requestAgent(srv, 'GET', '/services');
  });

  ipcMain.handle(
    'servers:service-action',
    async (_event, serverId: string, serviceName: string, action: string) => {
      if (!remotePoller) throw new Error('Poller not initialized');
      return remotePoller.executeServiceAction(serverId, serviceName, action);
    }
  );


  // --- User Profile, Onboarding & Persisted Settings ---
  const sanitizeUsername = (raw: string): string => {
    const cleaned = String(raw ?? '')
      .replace(/[<>&"'`\x00-\x1F\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length < 2) throw new Error('Username must be at least 2 characters.');
    return cleaned.slice(0, 32).trim();
  };

  ipcMain.handle('profile:get-state', () => {
    if (!db) throw new Error('Database not initialized');
    const profile = db.getUserProfile();
    const completed = db.getAppSetting('onboarding_completed_v42') === '1';
    return {
      username: profile?.username ?? null,
      onboardingCompleted: completed,
    };
  });

  ipcMain.handle('profile:set-username', (_event, rawUsername: string) => {
    if (!db) throw new Error('Database not initialized');
    const clean = sanitizeUsername(rawUsername);
    const saved = db.saveUserProfile(clean);
    return {
      username: saved.username,
      onboardingCompleted: db.getAppSetting('onboarding_completed_v42') === '1',
    };
  });

  ipcMain.handle('profile:complete-onboarding', (_event, rawUsername?: string) => {
    if (!db) throw new Error('Database not initialized');
    if (typeof rawUsername === 'string' && rawUsername.trim()) {
      db.saveUserProfile(sanitizeUsername(rawUsername));
    }
    db.setAppSetting('onboarding_completed_v42', '1');
    const profile = db.getUserProfile();
    return {
      username: profile?.username ?? null,
      onboardingCompleted: true,
    };
  });

  ipcMain.handle('settings:get', () => {
    if (!db) return null;
    const raw = db.getAppSetting('user_settings_v2');
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  });

  ipcMain.handle('settings:save', (_event, settingsObj: Record<string, unknown>) => {
    if (!db) return false;
    db.setAppSetting('user_settings_v2', JSON.stringify(settingsObj));
    return true;
  });

  ipcMain.handle('startup:get-timings', () => startupTimings);

  // --- Theme Studio (v4.1.0+) ---
  ipcMain.handle('themes:get-state', () => {
    if (!db) return { themes: [], activeThemeId: 'preset-dark', safeMode: false };
    return {
      themes: db.getCustomThemes(),
      activeThemeId: db.getActiveThemeId(),
      safeMode: db.getAppSetting('theme_safe_mode') === '1',
    };
  });

  ipcMain.handle(
    'themes:save',
    (_event, input: { id: string; name: string; themeJson: string; isDefault?: boolean }) => {
      if (!db) throw new Error('Database not initialized');
      return db.saveCustomTheme(input);
    }
  );

  ipcMain.handle('themes:delete', (_event, id: string) => {
    return db ? db.deleteCustomTheme(id) : false;
  });

  ipcMain.handle('themes:set-active', (_event, id: string) => {
    if (!db) return false;
    db.setActiveThemeId(id);
    return true;
  });

  ipcMain.handle('themes:set-safe-mode', (_event, enabled: boolean) => {
    if (!db) return false;
    db.setAppSetting('theme_safe_mode', enabled ? '1' : '0');
    return true;
  });

  ipcMain.handle(
    'themes:export-file',
    async (_event, defaultFilename: string, content: string) => {
      const res = await dialog.showSaveDialog({
        defaultPath: defaultFilename,
        filters: [
          { name: 'Theme / CSS', extensions: ['json', 'css'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (res.canceled || !res.filePath) return null;
      fs.writeFileSync(res.filePath, content, 'utf8');
      return res.filePath;
    }
  );

  ipcMain.handle('themes:import-file', async (_event, kind: 'json' | 'css') => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:
        kind === 'css'
          ? [{ name: 'CSS Stylesheet', extensions: ['css'] }]
          : [{ name: 'Surf Theme JSON', extensions: ['json'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return fs.readFileSync(res.filePaths[0], 'utf8');
  });

  ipcMain.handle('themes:pick-bg-image', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const fp = res.filePaths[0];
    const ext = path.extname(fp).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const b64 = fs.readFileSync(fp).toString('base64');
    return `data:${mime};base64,${b64}`;
  });

  // --- Maintenance Windows ---
  ipcMain.handle('maintenance:list', () =>
    db?.getMaintenanceWindows() ?? []
  );
  ipcMain.handle(
    'maintenance:create',
    (
      _event,
      input: {
        name: string;
        monitorId?: string | null;
        groupId?: string | null;
        startsAt: string;
        endsAt: string;
      }
    ) => {
      if (!db) throw new Error('Database not initialized');
      return db.createMaintenanceWindow(input);
    }
  );
  ipcMain.handle('maintenance:delete', (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    return db.deleteMaintenanceWindow(id);
  });
  ipcMain.handle(
    'maintenance:update',
    (_event, id: string, updates: { endsAt?: string; enabled?: boolean }) => {
      if (!db) throw new Error('Database not initialized');
      return db.updateMaintenanceWindow(id, updates);
    }
  );

  // --- Backups, Retention & Import/Export ---
  ipcMain.handle('backup:list', () => db?.getBackupHistory() ?? []);
  ipcMain.handle('backup:create', async () => {
    if (!db) throw new Error('Database not initialized');
    const backupDir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const filePath = path.join(
      backupDir,
      `surf-monitor-backup-${Date.now()}.db`
    );
    await db.backupTo(filePath);
    const stat = fs.statSync(filePath);
    const rec = {
      id: `bkp-${Date.now()}`,
      filePath,
      sizeBytes: stat.size,
      createdAt: new Date().toISOString(),
      type: 'manual' as const,
    };
    db.recordBackupHistory(rec);
    return rec;
  });

  ipcMain.handle('db:cleanup', (_event, retentionDays: number) => {
    if (!db) throw new Error('Database not initialized');
    return db.cleanupOldRecords(retentionDays);
  });

  ipcMain.handle('export:monitors-json', async () => {
    if (!db) throw new Error('Database not initialized');
    const monitors = db
      .getAllMonitors()
      .map((m) => buildMonitorSummary(db!, m));
    const res = await dialog.showSaveDialog({
      title: 'Export Monitor Configurations',
      defaultPath: 'surf-monitor-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return null;
    fs.writeFileSync(res.filePath, JSON.stringify({ monitors }, null, 2));
    return res.filePath;
  });

  ipcMain.handle('export:incidents-csv', async () => {
    if (!db) throw new Error('Database not initialized');
    const incidents = db.getAllIncidents();
    const header =
      'id,monitorName,status,severity,startedAt,resolvedAt,durationSeconds,errorMessage\n';
    const rows = incidents
      .map(
        (i) =>
          `"${i.id}","${(i.monitorName ?? '').replace(/"/g, '""')}","${i.status}","${i.severity}","${i.startedAt}","${i.resolvedAt ?? ''}","${i.durationSeconds ?? ''}","${(i.errorMessage ?? '').replace(/"/g, '""')}"`
      )
      .join('\n');
    const res = await dialog.showSaveDialog({
      title: 'Export Incidents CSV',
      defaultPath: 'surf-monitor-incidents.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (res.canceled || !res.filePath) return null;
    fs.writeFileSync(res.filePath, header + rows, 'utf8');
    return res.filePath;
  });
}

function createSplashWindow(): BrowserWindow {
  const iconPath = getAppIconPath();
  const win = new BrowserWindow({
    ...(iconPath ? { icon: iconPath } : {}),
    width: 480,
    height: 330,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#09090b',
    center: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'splashPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void win.loadFile(path.join(__dirname, '../electron/splash.html'));
  return win;
}

function sendSplashProgress(percent: number, stage: string): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('startup:progress', { percent, stage });
  }
}

app.whenReady().then(async () => {
  const t0 = performance.now();
  splashWindow = createSplashWindow();
  sendSplashProgress(10, 'Starting Electron...');

  const dbPath = path.join(app.getPath('userData'), 'surf-monitor.db');
  sendSplashProgress(20, 'Loading application configuration...');
  startupTimings.configMs = Math.round(performance.now() - t0);

  sendSplashProgress(35, 'Initializing SQLite & running migrations...');
  const tDb = performance.now();
  db = new SurfDatabase(dbPath);
  startupTimings.databaseMs = Math.round(performance.now() - tDb);

  sendSplashProgress(50, 'Initializing notification services...');
  notifier = new NotificationService(db);
  createTray();

  sendSplashProgress(62, 'Loading user profile & preferences...');
  const tProf = performance.now();
  db.getUserProfile();
  startupTimings.profileLoadMs = Math.round(performance.now() - tProf);

  sendSplashProgress(74, 'Starting monitoring scheduler...');
  scheduler = new MonitoringScheduler(db, emitToRenderer, notifier);
  sshManager = new SshManager();
  remotePoller = new RemotePoller(db, sshManager, notifier, (serverId) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('remote:event', { serverId });
    }
  });

  registerIpcHandlers();
  startHeartbeatServer();

  sendSplashProgress(86, 'Loading dashboard & remote-agent manager...');
  createWindow();

  mainWindow?.once('ready-to-show', () => {
    sendSplashProgress(100, 'Opening Surf Monitor...');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow?.show();
    startupTimings.totalStartupMs = Math.round(performance.now() - t0);

    scheduler?.start();
    remotePoller?.start();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  heartbeatServer?.close();
  remotePoller?.stop();
  sshManager?.disconnectAll();
  scheduler?.stop();
  db?.close();
  scheduler = null;
  db = null;
});
