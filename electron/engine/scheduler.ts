import { CheckRecord, MonitorRecord, SurfDatabase } from '../db/database';
import { DnsRecordType, performDnsCheck } from './dnsChecker';
import { HttpMonitorConfig, performHttpCheck } from './httpChecker';
import {
  performDomainRdapCheck,
  performPingCheck,
  performTcpCheck,
} from './networkCheckers';
import { NotificationService } from './notificationService';
import { performSslCheck } from './sslChecker';
import { CheckState } from './statusClassifier';
import { normalizeContentForDiff } from './websiteIntelligence';

export type SchedulerEvent =
  | { type: 'check-completed'; monitorId: string; check: CheckRecord }
  | {
      type: 'status-changed';
      monitorId: string;
      monitorName: string;
      status: CheckState;
    }
  | { type: 'monitor-updated'; monitorId: string }
  | { type: 'monitor-deleted'; monitorId: string }
  | { type: 'incident-updated'; monitorId: string };

export class MonitoringScheduler {
  private db: SurfDatabase;
  private onEvent: (event: SchedulerEvent) => void;
  private notifier: NotificationService;
  private timers = new Map<string, NodeJS.Timeout>();
  private inFlight = new Set<string>();
  private activeCount = 0;
  private maxConcurrency = 8;
  private stopped = false;

  constructor(
    db: SurfDatabase,
    onEvent: (event: SchedulerEvent) => void,
    notifier?: NotificationService
  ) {
    this.db = db;
    this.onEvent = onEvent;
    this.notifier = notifier ?? new NotificationService(db);
  }

  public start(): void {
    this.stopped = false;
    const activeMonitors = this.db.getEnabledMonitors();
    for (const monitor of activeMonitors) {
      this.scheduleMonitor(monitor, false);
    }
  }

  public pauseAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  public resumeAll(): void {
    this.start();
  }

  public scheduleMonitor(monitor: MonitorRecord, runImmediately = true): void {
    this.unscheduleMonitor(monitor.id);
    if (this.stopped || monitor.enabled !== 1) {
      return;
    }

    const intervalMs = Math.max(5, monitor.interval) * 1000;
    const timer = setInterval(() => {
      void this.executeCheck(monitor.id);
    }, intervalMs);

    this.timers.set(monitor.id, timer);

    if (runImmediately) {
      void this.executeCheck(monitor.id);
    }
  }

  public unscheduleMonitor(monitorId: string): void {
    const existing = this.timers.get(monitorId);
    if (existing) {
      clearInterval(existing);
      this.timers.delete(monitorId);
    }
  }

  public async runManualCheck(monitorId: string): Promise<CheckRecord | null> {
    return this.executeCheck(monitorId, true);
  }

  public async executeCheck(
    monitorId: string,
    ignoreConcurrency = false
  ): Promise<CheckRecord | null> {
    if (this.stopped || this.inFlight.has(monitorId)) {
      return null;
    }
    if (!ignoreConcurrency && this.activeCount >= this.maxConcurrency) {
      return null;
    }

    const monitor = this.db.getMonitorById(monitorId);
    if (!monitor) {
      this.unscheduleMonitor(monitorId);
      return null;
    }

    if (this.db.isMonitorInMaintenance(monitor.id, monitor.groupId)) {
      return null;
    }

    this.inFlight.add(monitorId);
    this.activeCount++;

    try {
      const cfg = (() => {
        try {
          return JSON.parse(monitor.configJson || '{}') as HttpMonitorConfig & {
            port?: number;
            dnsRecordType?: DnsRecordType;
            dnsResolver?: string;
            expectedDnsRecords?: string[];
            sslThresholds?: number[];
            heartbeatGraceSeconds?: number;
            contentIgnorePatterns?: string[];
            contentCaseSensitive?: boolean;
          };
        } catch {
          return {};
        }
      })();

      const checkedAt = new Date().toISOString();
      let result: {
        responseTime: number | null;
        statusCode: number | null;
        state: CheckState;
        networkConnected: boolean;
        httpResponseReceived: boolean;
        applicationHealthy: boolean;
        success: boolean;
        errorMessage: string | null;
        detailsJson?: string | null;
      };

      if (monitor.monitorType === 'ssl') {
        const sslRes = await performSslCheck({
          url: monitor.url,
          timeoutSeconds: monitor.timeout,
          warningThresholds: cfg.sslThresholds,
        });
        this.db.saveSslResult({
          monitorId: monitor.id,
          checkedAt,
          subject: sslRes.ssl.subject,
          issuer: sslRes.ssl.issuer,
          validFrom: sslRes.ssl.validFrom,
          validTo: sslRes.ssl.validTo,
          daysRemaining: sslRes.ssl.daysRemaining,
          hostnameValid: sslRes.ssl.hostnameValid ? 1 : 0,
          chainValid: sslRes.ssl.chainValid ? 1 : 0,
          tlsVersion: sslRes.ssl.tlsVersion,
          errorMessage: sslRes.errorMessage,
        });
        result = {
          responseTime: sslRes.responseTime,
          statusCode: null,
          state: sslRes.state,
          networkConnected: sslRes.networkConnected,
          httpResponseReceived: sslRes.httpResponseReceived,
          applicationHealthy: sslRes.applicationHealthy,
          success: sslRes.state === 'UP',
          errorMessage: sslRes.errorMessage,
          detailsJson: JSON.stringify(sslRes.ssl),
        };
      } else if (monitor.monitorType === 'dns') {
        const dnsRes = await performDnsCheck({
          target: monitor.url,
          recordType: cfg.dnsRecordType ?? 'A',
          resolverIp: cfg.dnsResolver,
          expectedRecords: cfg.expectedDnsRecords,
        });
        const prevDns = this.db.getLatestDnsResult(
          monitor.id,
          dnsRes.recordType
        );
        const recordsStr = JSON.stringify(dnsRes.records);
        const changed =
          prevDns !== undefined && prevDns.recordsJson !== recordsStr ? 1 : 0;

        this.db.saveDnsResult({
          monitorId: monitor.id,
          checkedAt,
          recordType: dnsRes.recordType,
          resolver: dnsRes.resolver,
          lookupMs: dnsRes.lookupMs,
          recordsJson: recordsStr,
          changed,
          errorMessage: dnsRes.errorMessage,
        });
        result = {
          responseTime: dnsRes.lookupMs,
          statusCode: null,
          state: dnsRes.state,
          networkConnected: dnsRes.networkConnected,
          httpResponseReceived: dnsRes.httpResponseReceived,
          applicationHealthy: dnsRes.applicationHealthy,
          success: dnsRes.state === 'UP',
          errorMessage: dnsRes.errorMessage,
          detailsJson: JSON.stringify({
            recordType: dnsRes.recordType,
            records: dnsRes.records,
            changed: changed === 1,
          }),
        };
      } else if (monitor.monitorType === 'tcp') {
        const tcpRes = await performTcpCheck({
          target: monitor.url,
          port: cfg.port ?? 443,
          timeoutSeconds: monitor.timeout,
        });
        result = {
          ...tcpRes,
          statusCode: null,
          success: tcpRes.state === 'UP',
        };
      } else if (monitor.monitorType === 'ping') {
        const pingRes = await performPingCheck({
          target: monitor.url,
          timeoutSeconds: monitor.timeout,
        });
        result = {
          ...pingRes,
          statusCode: null,
          success: pingRes.state === 'UP',
        };
      } else if (monitor.monitorType === 'domain') {
        const rdap = await performDomainRdapCheck(monitor.url);
        this.db.saveDomainResult({
          monitorId: monitor.id,
          checkedAt,
          domain: rdap.domain,
          registrar: rdap.registrar,
          expiresAt: rdap.expiresAt,
          daysRemaining: rdap.daysRemaining,
          errorMessage: rdap.errorMessage,
        });
        const expired = rdap.daysRemaining !== null && rdap.daysRemaining <= 0;
        const expiringSoon =
          rdap.daysRemaining !== null && rdap.daysRemaining <= 30;
        const state: CheckState = rdap.errorMessage
          ? 'DEGRADED'
          : expired
            ? 'DOWN'
            : expiringSoon
              ? 'DEGRADED'
              : 'UP';
        result = {
          responseTime: null,
          statusCode: null,
          state,
          networkConnected: true,
          httpResponseReceived: true,
          applicationHealthy: state === 'UP',
          success: state === 'UP',
          errorMessage: rdap.errorMessage,
          detailsJson: JSON.stringify(rdap),
        };
      } else if (monitor.monitorType === 'heartbeat') {
        const events = this.db.getHeartbeatEvents(monitor.id, 1);
        const grace = cfg.heartbeatGraceSeconds ?? 60;
        const maxAgeMs = (monitor.interval + grace) * 1000;
        if (events.length === 0) {
          result = {
            responseTime: null,
            statusCode: null,
            state: 'DOWN',
            networkConnected: false,
            httpResponseReceived: false,
            applicationHealthy: false,
            success: false,
            errorMessage: 'No heartbeat signal received yet',
          };
        } else {
          const ageMs = Date.now() - new Date(events[0].receivedAt).getTime();
          const alive = ageMs <= maxAgeMs;
          result = {
            responseTime: Math.round(ageMs / 1000),
            statusCode: null,
            state: alive ? 'UP' : 'DOWN',
            networkConnected: alive,
            httpResponseReceived: alive,
            applicationHealthy: alive,
            success: alive,
            errorMessage: alive
              ? null
              : `Missed heartbeat (last seen ${Math.round(ageMs / 1000)}s ago)`,
          };
        }
      } else {
        const httpRes = await performHttpCheck({
          monitorId: monitor.id,
          url: monitor.url,
          method: monitor.method,
          timeoutSeconds: monitor.timeout,
          expectedStatusCodes: monitor.expectedStatusCodes,
          config: cfg,
        });

        if (monitor.monitorType === 'content' && httpRes.bodyText) {
          const snap = normalizeContentForDiff(
            httpRes.bodyText,
            cfg.contentIgnorePatterns,
            cfg.contentCaseSensitive
          );
          const prev = this.db.getLatestContentSnapshot(monitor.id);
          const changed = prev !== undefined && prev.contentHash !== snap.hash;
          this.db.saveContentSnapshot({
            monitorId: monitor.id,
            checkedAt,
            contentHash: snap.hash,
            snippet: snap.snippet,
            changed: changed ? 1 : 0,
            diffSummary: changed ? 'Page content hash changed' : null,
          });
          if (changed && httpRes.state === 'UP') {
            httpRes.state = 'DEGRADED';
            httpRes.applicationHealthy = false;
            httpRes.errorMessage = 'Page content changed since last snapshot';
          }
        }

        result = httpRes;
      }

      if (this.stopped || !this.db.getMonitorById(monitorId)) {
        return null;
      }

      const transition = this.db.recordCheckAndUpdateIncident({
        monitorId: monitor.id,
        checkedAt,
        ...result,
      });

      this.onEvent({
        type: 'check-completed',
        monitorId: monitor.id,
        check: transition.check,
      });

      if (transition.previousState !== transition.newState) {
        this.onEvent({
          type: 'status-changed',
          monitorId: monitor.id,
          monitorName: monitor.name,
          status: transition.newState,
        });

        if (
          transition.newState === 'DOWN' ||
          transition.newState === 'DEGRADED' ||
          (transition.previousState === 'DOWN' && transition.newState === 'UP')
        ) {
          void this.notifier.dispatchEvent({
            monitorId: monitor.id,
            monitorName: monitor.name,
            currentState: transition.newState,
            previousState: transition.previousState,
            timestamp: checkedAt,
            responseTimeMs: result.responseTime,
            errorDetails: result.errorMessage,
            incidentId: transition.incidentId,
            eventType:
              transition.newState === 'UP'
                ? 'RECOVERY'
                : transition.newState === 'DEGRADED'
                  ? 'DEGRADED'
                  : 'DOWN',
          });
        }
      }

      if (transition.incidentChanged) {
        this.onEvent({
          type: 'incident-updated',
          monitorId: monitor.id,
        });
      }

      return transition.check;
    } catch {
      return null;
    } finally {
      this.inFlight.delete(monitorId);
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
  }

  public stop(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }
}
