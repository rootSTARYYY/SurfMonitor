import {
  CheckRecord,
  MonitorRecord,
  ServiceDependencyRecord,
  ServiceMonitorLink,
  ServiceRecord,
} from '../db/database';
import { CheckState } from './statusClassifier';

export type ServiceHealthState = 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export interface ServiceHealthSummary {
  serviceId: string;
  name: string;
  description: string;
  health: ServiceHealthState;
  directState: ServiceHealthState;
  derivedFromDependency: boolean;
  rootCauseServiceIds: string[];
  rootCauseMonitorIds: string[];
  componentCount: number;
  staleThresholdSeconds: number;
}

export function wouldCreateCircularDependency(
  dependencies: ServiceDependencyRecord[],
  serviceId: string,
  dependsOnServiceId: string
): boolean {
  if (serviceId === dependsOnServiceId) return true;

  // Check if dependsOnServiceId can already reach serviceId
  const adj = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = adj.get(dep.serviceId) ?? [];
    list.push(dep.dependsOnServiceId);
    adj.set(dep.serviceId, list);
  }

  const visited = new Set<string>();
  const stack = [dependsOnServiceId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === serviceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const next of adj.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}

export function computeMonitorEffectiveState(
  monitor: MonitorRecord,
  latestCheck: CheckRecord | undefined,
  staleThresholdSeconds: number,
  nowMs: number = Date.now()
): CheckState | 'UNKNOWN' {
  if (monitor.enabled !== 1) return 'UNKNOWN';
  if (!latestCheck) return 'UNKNOWN';

  const checkedAtMs = new Date(latestCheck.checkedAt).getTime();
  if (nowMs - checkedAtMs > staleThresholdSeconds * 1000) {
    return 'UNKNOWN';
  }

  return latestCheck.state;
}

export function calculateAllServiceHealth(params: {
  services: ServiceRecord[];
  monitors: MonitorRecord[];
  latestChecksByMonitor: Map<string, CheckRecord>;
  serviceMonitorLinks: ServiceMonitorLink[];
  dependencies: ServiceDependencyRecord[];
  nowMs?: number;
}): ServiceHealthSummary[] {
  const nowMs = params.nowMs ?? Date.now();
  const monitorMap = new Map(params.monitors.map((m) => [m.id, m]));
  const serviceMap = new Map(params.services.map((s) => [s.id, s]));

  const directStateMap = new Map<
    string,
    { state: ServiceHealthState; rootMonitors: string[]; componentCount: number }
  >();

  for (const svc of params.services) {
    const links = params.serviceMonitorLinks.filter(
      (l) => l.serviceId === svc.id
    );
    if (links.length === 0) {
      directStateMap.set(svc.id, {
        state: 'UNKNOWN',
        rootMonitors: [],
        componentCount: 0,
      });
      continue;
    }

    let hasCriticalDown = false;
    let hasNonCriticalDown = false;
    let hasDegraded = false;
    let hasUp = false;
    let allUnknown = true;
    const rootMonitors: string[] = [];

    for (const link of links) {
      const mon = monitorMap.get(link.monitorId);
      if (!mon) continue;
      const latest = params.latestChecksByMonitor.get(mon.id);
      const st = computeMonitorEffectiveState(
        mon,
        latest,
        svc.staleThresholdSeconds,
        nowMs
      );
      if (st !== 'UNKNOWN') allUnknown = false;

      if (st === 'DOWN') {
        rootMonitors.push(mon.id);
        if (link.isCritical === 1) hasCriticalDown = true;
        else hasNonCriticalDown = true;
      } else if (st === 'DEGRADED') {
        rootMonitors.push(mon.id);
        hasDegraded = true;
      } else if (st === 'UP') {
        hasUp = true;
      }
    }

    let state: ServiceHealthState = 'UNKNOWN';
    if (allUnknown) state = 'UNKNOWN';
    else if (hasCriticalDown) state = 'DOWN';
    else if (hasNonCriticalDown || hasDegraded) state = 'DEGRADED';
    else if (hasUp) state = 'UP';

    directStateMap.set(svc.id, {
      state,
      rootMonitors,
      componentCount: links.length,
    });
  }

  // Propagate dependencies recursively with memoization
  const resolvedMap = new Map<
    string,
    {
      health: ServiceHealthState;
      derived: boolean;
      rootServices: string[];
      rootMonitors: string[];
    }
  >();

  const resolveService = (
    svcId: string,
    visiting = new Set<string>()
  ): {
    health: ServiceHealthState;
    derived: boolean;
    rootServices: string[];
    rootMonitors: string[];
  } => {
    const cached = resolvedMap.get(svcId);
    if (cached) return cached;

    const direct = directStateMap.get(svcId) ?? {
      state: 'UNKNOWN' as ServiceHealthState,
      rootMonitors: [],
      componentCount: 0,
    };

    if (visiting.has(svcId)) {
      return {
        health: direct.state,
        derived: false,
        rootServices: [],
        rootMonitors: direct.rootMonitors,
      };
    }
    visiting.add(svcId);

    let health: ServiceHealthState = direct.state;
    let derived = false;
    const rootServices = new Set<string>();
    const rootMonitors = new Set<string>(direct.rootMonitors);

    const deps = params.dependencies.filter((d) => d.serviceId === svcId);
    for (const dep of deps) {
      if (!serviceMap.has(dep.dependsOnServiceId)) continue;
      const upstream = resolveService(dep.dependsOnServiceId, visiting);

      if (upstream.health === 'DOWN') {
        derived = true;
        if (upstream.rootServices.length === 0) {
          rootServices.add(dep.dependsOnServiceId);
        } else {
          upstream.rootServices.forEach((s) => rootServices.add(s));
        }
        upstream.rootMonitors.forEach((m) => rootMonitors.add(m));

        if (dep.isCritical === 1) {
          health = 'DOWN';
        } else if (health !== 'DOWN') {
          health = 'DEGRADED';
        }
      } else if (upstream.health === 'DEGRADED') {
        derived = true;
        if (upstream.rootServices.length === 0) {
          rootServices.add(dep.dependsOnServiceId);
        } else {
          upstream.rootServices.forEach((s) => rootServices.add(s));
        }
        upstream.rootMonitors.forEach((m) => rootMonitors.add(m));

        if (health === 'UP' || health === 'UNKNOWN') {
          health = 'DEGRADED';
        }
      }
    }

    const result = {
      health,
      derived,
      rootServices: Array.from(rootServices),
      rootMonitors: Array.from(rootMonitors),
    };
    resolvedMap.set(svcId, result);
    return result;
  };

  return params.services.map((svc) => {
    const direct = directStateMap.get(svc.id)!;
    const resolved = resolveService(svc.id);
    return {
      serviceId: svc.id,
      name: svc.name,
      description: svc.description,
      health: resolved.health,
      directState: direct.state,
      derivedFromDependency: resolved.derived && resolved.health !== direct.state,
      rootCauseServiceIds: resolved.rootServices,
      rootCauseMonitorIds: resolved.rootMonitors,
      componentCount: direct.componentCount,
      staleThresholdSeconds: svc.staleThresholdSeconds,
    };
  });
}
