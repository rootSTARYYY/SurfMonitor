import { RemoteServerRecord, SurfDatabase } from '../db/database';
import { NotificationService } from '../engine/notificationService';
import { classifySshError, SshManager } from './sshManager';

export interface AgentMetricsPayload {
  agentVersion: string;
  hostname: string;
  platform: string;
  osInfo: string;
  kernelVersion: string;
  arch: string;
  cpuCores: number;
  cpuModel: string;
  cpuPercent: number;
  ramTotalBytes: number;
  ramUsedBytes: number;
  ramPercent: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskPercent: number;
  partitions: Array<{
    filesystem: string;
    mount: string;
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usedPercent: number;
  }>;
  netRxBytesPerSec: number;
  netTxBytesPerSec: number;
  interfaces: Array<{ name: string; rxBytes: number; txBytes: number }>;
  uptimeSeconds: number;
  loadAvg: number[];
}

export interface AgentPm2Payload {
  installed: boolean;
  helperInstalled?: boolean;
  error?: string | null;
  instances: Array<{
    linuxUser: string;
    pm2Path: string | null;
    daemonAvailable: boolean;
    accessible: boolean;
    processCount: number;
    error: string | null;
  }>;
  processes: Array<{
    processKey: string;
    pmId: number;
    name: string;
    linuxUser: string;
    status: string;
    state: 'online' | 'stopped' | 'errored' | 'launching' | 'unknown';
    cpu: number;
    memoryBytes: number;
    uptimeMs: number;
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
  }>;
}

const SAFE_TARGET_REGEX = /^[a-zA-Z0-9_@.-]{1,128}$/;
const SAFE_USER_REGEX = /^[a-z_][a-z0-9_-]{0,31}$/;
const ALLOWED_DOCKER_ACTIONS = new Set([
  'start',
  'stop',
  'restart',
  'pause',
  'unpause',
  'inspect',
  'logs',
]);
const ALLOWED_SERVICE_ACTIONS = new Set([
  'start',
  'stop',
  'restart',
  'enable',
  'disable',
  'logs',
]);
const ALLOWED_PM2_ACTIONS = new Set(['start', 'stop', 'restart']);

export class RemotePoller {
  private db: SurfDatabase;
  private ssh: SshManager;
  private notifier: NotificationService;
  private onUpdate: (serverId: string) => void;
  private timers = new Map<string, NodeJS.Timeout>();
  private inFlight = new Set<string>();
  private backoffMs = new Map<string, number>();
  private pm2AlertCooldowns = new Map<string, number>();
  private stopped = false;

  constructor(
    db: SurfDatabase,
    ssh: SshManager,
    notifier: NotificationService,
    onUpdate: (serverId: string) => void
  ) {
    this.db = db;
    this.ssh = ssh;
    this.notifier = notifier;
    this.onUpdate = onUpdate;
  }

  public start(): void {
    this.stopped = false;
    const servers = this.db.getAllRemoteServers();
    for (const srv of servers) {
      if (srv.enabled === 1) {
        this.scheduleServer(srv, false);
      }
    }
  }

  public scheduleServer(server: RemoteServerRecord, immediate = true): void {
    this.unscheduleServer(server.id);
    if (this.stopped || server.enabled !== 1) return;

    const intervalMs = Math.max(5, server.pollIntervalSeconds) * 1000;
    const timer = setInterval(() => {
      void this.pollServer(server.id);
    }, intervalMs);
    this.timers.set(server.id, timer);

    if (immediate) {
      void this.pollServer(server.id);
    }
  }

  public unscheduleServer(serverId: string): void {
    const t = this.timers.get(serverId);
    if (t) {
      clearInterval(t);
      this.timers.delete(serverId);
    }
  }

  private canSendPm2Alert(cooldownKey: string, cooldownSeconds: number): boolean {
    const now = Date.now();
    const last = this.pm2AlertCooldowns.get(cooldownKey) ?? 0;
    if (now - last < cooldownSeconds * 1000) return false;
    this.pm2AlertCooldowns.set(cooldownKey, now);
    return true;
  }

  public async pollPm2ForServer(
    server: RemoteServerRecord,
    forceRefresh = false
  ): Promise<AgentPm2Payload | null> {
    try {
      const path = forceRefresh ? '/pm2/processes?refresh=1' : '/pm2/processes';
      const pm2Data = await this.ssh.requestAgent<AgentPm2Payload>(
        server,
        'GET',
        path
      );
      if (!pm2Data || !Array.isArray(pm2Data.processes)) return null;

      const prevProcesses = new Map(
        this.db.getPm2Processes(server.id).map((p) => [p.processKey, p])
      );
      const alertCfg = this.db.getPm2AlertConfig(server.id);
      const now = new Date().toISOString();

      this.db.upsertPm2Instances(server.id, pm2Data.instances ?? []);
      this.db.upsertPm2Processes(server.id, pm2Data.processes);
      this.db.recordPm2Metrics(server.id, now, pm2Data.processes);

      for (const proc of pm2Data.processes) {
        const prev = prevProcesses.get(proc.processKey);
        if (!prev) continue;

        // Detect state changes
        if (prev.state !== proc.state) {
          const isIntentional =
            proc.state === 'stopped' && prev.intentionalStop === 1;
          const eventType =
            proc.state === 'online'
              ? 'RECOVERED'
              : proc.state === 'errored'
                ? 'ERRORED'
                : isIntentional
                  ? 'INTENTIONAL_STOP'
                  : 'STOPPED';

          const msg =
            eventType === 'RECOVERED'
              ? `PM2 process ${proc.name} (${proc.linuxUser}) recovered and is online.`
              : eventType === 'INTENTIONAL_STOP'
                ? `PM2 process ${proc.name} (${proc.linuxUser}) was stopped intentionally.`
                : `PM2 process ${proc.name} (${proc.linuxUser}) transitioned ${prev.state} -> ${proc.state}.`;

          this.db.recordPm2StateEvent({
            serverId: server.id,
            processKey: proc.processKey,
            processName: proc.name,
            linuxUser: proc.linuxUser,
            previousState: prev.state,
            newState: proc.state,
            eventType,
            message: msg,
          });

          if (alertCfg.enabled === 1 && !isIntentional) {
            const cdKey = `${server.id}:${proc.processKey}:state:${eventType}`;
            if (this.canSendPm2Alert(cdKey, alertCfg.cooldownSeconds)) {
              const mappedState =
                proc.state === 'online'
                  ? 'UP'
                  : proc.state === 'errored'
                    ? 'DOWN'
                    : 'DEGRADED';
              void this.notifier.dispatchEvent({
                monitorId: `${server.id}:pm2:${proc.processKey}`,
                monitorName: `PM2 ${proc.name} (${server.name})`,
                currentState: mappedState,
                previousState: prev.state === 'online' ? 'UP' : 'DOWN',
                timestamp: now,
                responseTimeMs: null,
                errorDetails: msg,
                eventType: mappedState === 'UP' ? 'RECOVERY' : mappedState,
              });
            }
          }
        }

        // Restart spike detection
        const restartDelta = proc.restarts - prev.restarts;
        if (
          restartDelta >= alertCfg.restartSpikeThreshold &&
          alertCfg.enabled === 1
        ) {
          const msg = `PM2 process ${proc.name} restarted ${restartDelta} times in one polling interval (total: ${proc.restarts}).`;
          this.db.recordPm2StateEvent({
            serverId: server.id,
            processKey: proc.processKey,
            processName: proc.name,
            linuxUser: proc.linuxUser,
            previousState: prev.state,
            newState: proc.state,
            eventType: 'RESTART_SPIKE',
            message: msg,
          });
          const cdKey = `${server.id}:${proc.processKey}:restart_spike`;
          if (this.canSendPm2Alert(cdKey, alertCfg.cooldownSeconds)) {
            void this.notifier.dispatchEvent({
              monitorId: `${server.id}:pm2:${proc.processKey}`,
              monitorName: `PM2 ${proc.name} (${server.name})`,
              currentState: 'DEGRADED',
              previousState: 'UP',
              timestamp: now,
              responseTimeMs: null,
              errorDetails: msg,
              eventType: 'DEGRADED',
            });
          }
        }

        // CPU / Memory threshold alerts
        if (alertCfg.enabled === 1 && proc.state === 'online') {
          const memMb = proc.memoryBytes / (1024 * 1024);
          const breaches: string[] = [];
          if (proc.cpu >= alertCfg.cpuThreshold) {
            breaches.push(`CPU ${proc.cpu.toFixed(1)}% >= ${alertCfg.cpuThreshold}%`);
          }
          if (memMb >= alertCfg.memoryMbThreshold) {
            breaches.push(
              `Memory ${memMb.toFixed(0)} MB >= ${alertCfg.memoryMbThreshold} MB`
            );
          }
          if (breaches.length > 0) {
            const cdKey = `${server.id}:${proc.processKey}:resource`;
            if (this.canSendPm2Alert(cdKey, alertCfg.cooldownSeconds)) {
              const msg = `PM2 ${proc.name}: ${breaches.join(', ')}`;
              this.db.recordPm2StateEvent({
                serverId: server.id,
                processKey: proc.processKey,
                processName: proc.name,
                linuxUser: proc.linuxUser,
                previousState: proc.state,
                newState: proc.state,
                eventType: 'RESOURCE_THRESHOLD',
                message: msg,
              });
              void this.notifier.dispatchEvent({
                monitorId: `${server.id}:pm2:${proc.processKey}`,
                monitorName: `PM2 ${proc.name} (${server.name})`,
                currentState: 'DEGRADED',
                previousState: 'UP',
                timestamp: now,
                responseTimeMs: null,
                errorDetails: msg,
                eventType: 'DEGRADED',
              });
            }
          }
        }
      }

      return pm2Data;
    } catch {
      // Older agent or PM2 endpoint unavailable: do not break server metrics
      return null;
    }
  }

  public async pollServer(serverId: string): Promise<boolean> {
    if (this.stopped || this.inFlight.has(serverId)) return false;
    const server = this.db.getRemoteServerById(serverId);
    if (!server || server.enabled !== 1) return false;

    this.inFlight.add(serverId);
    try {
      const metrics = await this.ssh.requestAgent<AgentMetricsPayload>(
        server,
        'GET',
        '/metrics'
      );

      this.backoffMs.delete(serverId);
      const now = new Date().toISOString();

      this.db.updateRemoteServerRuntime(server.id, {
        connectionStatus: 'connected',
        hostname: metrics.hostname,
        osInfo: metrics.osInfo,
        kernelVersion: metrics.kernelVersion,
        cpuCores: metrics.cpuCores,
        totalMemoryBytes: metrics.ramTotalBytes,
        agentVersion: metrics.agentVersion,
        lastSeenAt: now,
        lastError: null,
      });

      this.db.recordServerMetric({
        serverId: server.id,
        collectedAt: now,
        cpuPercent: metrics.cpuPercent,
        ramPercent: metrics.ramPercent,
        ramUsedBytes: metrics.ramUsedBytes,
        ramTotalBytes: metrics.ramTotalBytes,
        diskPercent: metrics.diskPercent,
        diskUsedBytes: metrics.diskUsedBytes,
        diskTotalBytes: metrics.diskTotalBytes,
        netRxBytesPerSec: metrics.netRxBytesPerSec,
        netTxBytesPerSec: metrics.netTxBytesPerSec,
        uptimeSeconds: metrics.uptimeSeconds,
        loadAvg1: metrics.loadAvg[0] ?? 0,
        loadAvg5: metrics.loadAvg[1] ?? 0,
        loadAvg15: metrics.loadAvg[2] ?? 0,
        detailsJson: JSON.stringify({
          partitions: metrics.partitions,
          interfaces: metrics.interfaces,
          cpuModel: metrics.cpuModel,
        }),
      });

      // Threshold alerts via existing NotificationService
      const alerts: string[] = [];
      if (metrics.cpuPercent >= server.cpuThreshold) {
        alerts.push(`CPU ${metrics.cpuPercent}% >= ${server.cpuThreshold}%`);
      }
      if (metrics.ramPercent >= server.ramThreshold) {
        alerts.push(`RAM ${metrics.ramPercent}% >= ${server.ramThreshold}%`);
      }
      if (metrics.diskPercent >= server.diskThreshold) {
        alerts.push(`Disk ${metrics.diskPercent}% >= ${server.diskThreshold}%`);
      }

      if (alerts.length > 0) {
        void this.notifier.dispatchEvent({
          monitorId: server.id,
          monitorName: `Server: ${server.name}`,
          currentState: 'DEGRADED',
          previousState: 'UP',
          timestamp: now,
          responseTimeMs: null,
          errorDetails: alerts.join('; '),
          eventType: 'DEGRADED',
        });
      }

      // Poll PM2 processes gracefully
      await this.pollPm2ForServer(server, false);

      this.onUpdate(server.id);
      return true;
    } catch (err) {
      const errMsg = classifySshError(err);
      this.ssh.disconnect(serverId);
      const prevStatus = server.connectionStatus;

      this.db.updateRemoteServerRuntime(server.id, {
        connectionStatus: 'error',
        lastError: errMsg,
      });

      if (prevStatus === 'connected') {
        void this.notifier.dispatchEvent({
          monitorId: server.id,
          monitorName: `Server: ${server.name}`,
          currentState: 'DOWN',
          previousState: 'UP',
          timestamp: new Date().toISOString(),
          responseTimeMs: null,
          errorDetails: errMsg,
          eventType: 'DOWN',
        });
      }

      this.onUpdate(server.id);
      return false;
    } finally {
      this.inFlight.delete(serverId);
    }
  }

  public async executePm2Action(
    serverId: string,
    linuxUser: string,
    pmId: number,
    action: string
  ): Promise<unknown> {
    if (
      !SAFE_USER_REGEX.test(linuxUser) ||
      !Number.isInteger(pmId) ||
      pmId < 0 ||
      !ALLOWED_PM2_ACTIONS.has(action)
    ) {
      throw new Error('Disallowed PM2 user, process ID, or action');
    }
    const server = this.db.getRemoteServerById(serverId);
    if (!server) throw new Error('Server not found');

    const processKey = `${linuxUser}:${pmId}`;
    if (action === 'stop') {
      this.db.markPm2IntentionalStop(serverId, processKey, true);
    } else {
      this.db.markPm2IntentionalStop(serverId, processKey, false);
    }

    try {
      const res = await this.ssh.requestAgent(
        server,
        'POST',
        `/pm2/processes/${linuxUser}/${pmId}/${action}`
      );
      this.db.recordAuditLog({
        serverId,
        action: `pm2:${action}`,
        target: `${linuxUser}#${pmId}`,
        status: 'success',
      });
      await this.pollPm2ForServer(server, true);
      this.onUpdate(serverId);
      return res;
    } catch (err) {
      this.db.recordAuditLog({
        serverId,
        action: `pm2:${action}`,
        target: `${linuxUser}#${pmId}`,
        status: 'failed',
        details: err instanceof Error ? err.message : 'Failed',
      });
      throw err;
    }
  }

  public async executeDockerAction(
    serverId: string,
    containerId: string,
    action: string
  ): Promise<unknown> {
    if (!SAFE_TARGET_REGEX.test(containerId) || !ALLOWED_DOCKER_ACTIONS.has(action)) {
      throw new Error('Disallowed Docker container ID or action');
    }
    const server = this.db.getRemoteServerById(serverId);
    if (!server) throw new Error('Server not found');

    const method = action === 'inspect' || action === 'logs' ? 'GET' : 'POST';
    try {
      const res = await this.ssh.requestAgent(
        server,
        method,
        `/docker/containers/${containerId}/${action}`
      );
      this.db.recordAuditLog({
        serverId,
        action: `docker:${action}`,
        target: containerId,
        status: 'success',
      });
      return res;
    } catch (err) {
      this.db.recordAuditLog({
        serverId,
        action: `docker:${action}`,
        target: containerId,
        status: 'failed',
        details: err instanceof Error ? err.message : 'Failed',
      });
      throw err;
    }
  }

  public async executeServiceAction(
    serverId: string,
    serviceName: string,
    action: string
  ): Promise<unknown> {
    if (!SAFE_TARGET_REGEX.test(serviceName) || !ALLOWED_SERVICE_ACTIONS.has(action)) {
      throw new Error('Disallowed service name or action');
    }
    const server = this.db.getRemoteServerById(serverId);
    if (!server) throw new Error('Server not found');

    const method = action === 'logs' ? 'GET' : 'POST';
    try {
      const res = await this.ssh.requestAgent(
        server,
        method,
        `/services/${serviceName}/${action}`
      );
      this.db.recordAuditLog({
        serverId,
        action: `service:${action}`,
        target: serviceName,
        status: 'success',
      });
      return res;
    } catch (err) {
      this.db.recordAuditLog({
        serverId,
        action: `service:${action}`,
        target: serviceName,
        status: 'failed',
        details: err instanceof Error ? err.message : 'Failed',
      });
      throw err;
    }
  }

  public stop(): void {
    this.stopped = true;
    for (const t of this.timers.values()) {
      clearInterval(t);
    }
    this.timers.clear();
  }
}
