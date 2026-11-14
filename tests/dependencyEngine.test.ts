import { describe, expect, it } from 'vitest';
import {
  calculateAllServiceHealth,
  wouldCreateCircularDependency,
} from '../electron/engine/dependencyEngine';
import {
  CheckRecord,
  MonitorRecord,
  ServiceDependencyRecord,
  ServiceRecord,
} from '../electron/db/database';

function makeMonitor(id: string, name: string): MonitorRecord {
  const now = new Date().toISOString();
  return {
    id,
    name,
    url: 'https://example.com',
    monitorType: 'http',
    method: 'GET',
    interval: 60,
    timeout: 10,
    expectedStatusCodes: '200-399',
    groupId: null,
    tags: '[]',
    configJson: '{}',
    enabled: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function makeCheck(
  monitorId: string,
  state: 'UP' | 'DEGRADED' | 'DOWN',
  checkedAt: string
): CheckRecord {
  return {
    id: 1,
    monitorId,
    checkedAt,
    responseTime: state === 'DOWN' ? null : 25,
    statusCode: state === 'UP' ? 200 : state === 'DEGRADED' ? 500 : null,
    state,
    networkConnected: state === 'DOWN' ? 0 : 1,
    httpResponseReceived: state === 'DOWN' ? 0 : 1,
    applicationHealthy: state === 'UP' ? 1 : 0,
    success: state === 'UP' ? 1 : 0,
    errorMessage: null,
    detailsJson: null,
  };
}

describe('dependencyEngine', () => {
  it('detects direct and transitive circular dependencies', () => {
    const deps: ServiceDependencyRecord[] = [
      {
        id: 'd1',
        serviceId: 'web',
        dependsOnServiceId: 'api',
        isCritical: 1,
        createdAt: '',
      },
      {
        id: 'd2',
        serviceId: 'api',
        dependsOnServiceId: 'db',
        isCritical: 1,
        createdAt: '',
      },
    ];

    expect(wouldCreateCircularDependency(deps, 'web', 'web')).toBe(true);
    expect(wouldCreateCircularDependency(deps, 'db', 'web')).toBe(true);
    expect(wouldCreateCircularDependency(deps, 'web', 'db')).toBe(false);
  });

  it('propagates critical dependency DOWN and identifies root cause without overwriting direct state', () => {
    const now = Date.now();
    const recentIso = new Date(now - 10_000).toISOString();

    const services: ServiceRecord[] = [
      {
        id: 'web',
        name: 'LunarX Website',
        description: '',
        staleThresholdSeconds: 300,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'api',
        name: 'LunarX API',
        description: '',
        staleThresholdSeconds: 300,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'db',
        name: 'PostgreSQL',
        description: '',
        staleThresholdSeconds: 300,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const monitors = [
      makeMonitor('m-web', 'Web'),
      makeMonitor('m-api', 'API'),
      makeMonitor('m-db', 'DB'),
    ];

    const latestChecks = new Map<string, CheckRecord>([
      ['m-web', makeCheck('m-web', 'UP', recentIso)],
      ['m-api', makeCheck('m-api', 'UP', recentIso)],
      ['m-db', makeCheck('m-db', 'DOWN', recentIso)],
    ]);

    const res = calculateAllServiceHealth({
      services,
      monitors,
      latestChecksByMonitor: latestChecks,
      serviceMonitorLinks: [
        { serviceId: 'web', monitorId: 'm-web', isCritical: 1 },
        { serviceId: 'api', monitorId: 'm-api', isCritical: 1 },
        { serviceId: 'db', monitorId: 'm-db', isCritical: 1 },
      ],
      dependencies: [
        {
          id: 'd1',
          serviceId: 'web',
          dependsOnServiceId: 'api',
          isCritical: 1,
          createdAt: '',
        },
        {
          id: 'd2',
          serviceId: 'api',
          dependsOnServiceId: 'db',
          isCritical: 1,
          createdAt: '',
        },
      ],
      nowMs: now,
    });

    const web = res.find((s) => s.serviceId === 'web')!;
    const db = res.find((s) => s.serviceId === 'db')!;

    expect(db.health).toBe('DOWN');
    expect(web.directState).toBe('UP');
    expect(web.health).toBe('DOWN');
    expect(web.derivedFromDependency).toBe(true);
    expect(web.rootCauseServiceIds).toContain('db');
  });

  it('marks stale check results as UNKNOWN', () => {
    const now = Date.now();
    const staleIso = new Date(now - 600_000).toISOString();
    const services: ServiceRecord[] = [
      {
        id: 'svc',
        name: 'Stale Svc',
        description: '',
        staleThresholdSeconds: 60,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const monitors = [makeMonitor('m1', 'M1')];
    const latestChecks = new Map<string, CheckRecord>([
      ['m1', makeCheck('m1', 'UP', staleIso)],
    ]);

    const res = calculateAllServiceHealth({
      services,
      monitors,
      latestChecksByMonitor: latestChecks,
      serviceMonitorLinks: [{ serviceId: 'svc', monitorId: 'm1', isCritical: 1 }],
      dependencies: [],
      nowMs: now,
    });

    expect(res[0].health).toBe('UNKNOWN');
  });
});
