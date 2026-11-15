import crypto from 'node:crypto';
import { SurfDatabase } from '../db/database';
import { SshManager } from '../remote/sshManager';
import { parseAndValidateCommunityManifest } from './community';
import { mariadbInstaller, postgresqlInstaller, redisInstaller } from './installers/databases';
import { dockerInstaller } from './installers/docker';
import { pterodactylPanelInstaller, pterodactylWingsInstaller } from './installers/pterodactyl';
import { uptimeKumaInstaller } from './installers/uptimeKuma';
import { fail2banInstaller, nginxInstaller, nodejsInstaller, ufwInstaller } from './installers/webAndTools';
import {
  ApprovalPolicy,
  DeploymentPlan,
  InstallerCatalogItemDTO,
  InstallerDefinition,
  JobStatus,
  PreflightCheckItem,
  PreflightCheckResult,
} from './types';

export const OFFICIAL_INSTALLERS: InstallerDefinition[] = [
  dockerInstaller,
  uptimeKumaInstaller,
  postgresqlInstaller,
  mariadbInstaller,
  redisInstaller,
  pterodactylPanelInstaller,
  pterodactylWingsInstaller,
  nginxInstaller,
  nodejsInstaller,
  fail2banInstaller,
  ufwInstaller,
];

export class InstallerEngine {
  private activeAbortControllers = new Map<string, AbortController>();

  constructor(
    private db: SurfDatabase,
    private ssh: SshManager,
    private onJobUpdate: (payload: { jobId: string; status: JobStatus; logLine?: string }) => void
  ) {}

  public getAllInstallers(): InstallerDefinition[] {
    const list = [...OFFICIAL_INSTALLERS];
    for (const rec of this.db.listCommunityInstallers()) {
      if (rec.trustStatus === 'revoked') continue;
      const parsed = parseAndValidateCommunityManifest(String(rec.manifestJson), String(rec.sha256));
      if (!parsed.valid || !parsed.manifest) continue;
      const m = parsed.manifest;
      list.push({
        id: `community:${m.packageId}`,
        name: m.name,
        version: m.version,
        description: m.description,
        category: m.category,
        publisher: `${m.publisher.name} (Community)`,
        source: 'community',
        verificationStatus: 'community',
        supportedOs: m.supportedOs,
        supportedArch: m.supportedArch,
        minDiskMb: m.minDiskMb || 256,
        minRamMb: m.minRamMb || 128,
        requiredPorts: m.requiredPorts || [],
        dependencies: [],
        requiredPrivileges: m.requiredPrivileges,
        supportsOneClick: false,
        supportsGuided: true,
        rollbackAvailable: false,
        rollbackNote: 'Community package — review declared commands before running.',
        docsUrl: m.docsUrl,
        configSchema: m.configSchema || [],
        buildPlan: (serverId, serverName, config) => ({
          installerId: `community:${m.packageId}`,
          installerName: m.name,
          version: m.version,
          serverId,
          serverName,
          installDir: '/opt/surf-community',
          packages: m.permissions,
          servicesToCreate: [],
          portsToOpen: m.requiredPorts || [],
          filesToModify: m.permissions,
          configSummary: Object.entries(config).map(([k, v]) => ({ label: k, value: String(v) })),
          requiredPrivileges: m.requiredPrivileges,
          estimatedDiskMb: m.minDiskMb || 256,
          estimatedRamMb: m.minRamMb || 128,
          rollbackAvailable: false,
          rollbackNote: 'Community package — no automated rollback.',
          hasDestructiveOperations: true,
          destructiveWarnings: [
            `Community package (${m.publisher.name}, SHA-256: ${parsed.sha256.slice(0, 12)}...) is untrusted by default.`,
          ],
        }),
        install: async (ctx) => {
          for (const step of m.installCommands) {
            ctx.log(`Running community step: ${step.label}`);
            const res = await ctx.exec(step.command, { timeoutMs: 240_000, label: step.label });
            if (res.code !== 0) {
              throw new Error(`Step "${step.label}" failed (exit ${res.code}): ${res.stderr.slice(-300)}`);
            }
          }
        },
        verify: async (ctx) => {
          const res = await ctx.exec(m.verifyCommand);
          return {
            ok: res.code === 0,
            details: res.code === 0 ? res.stdout.trim() || 'Community verification passed.' : res.stderr.trim() || 'Verification failed.',
          };
        },
      });
    }
    return list;
  }

  public getCatalog(): InstallerCatalogItemDTO[] {
    const policies = this.db.listInstallerPolicies();
    const installed = this.db.listInstalledApps();
    const defaultPolicy = (this.db.getAppSetting('default_installer_policy') as ApprovalPolicy) || 'always_review';

    return this.getAllInstallers().map((inst) => ({
      id: inst.id,
      name: inst.name,
      version: inst.version,
      description: inst.description,
      category: inst.category,
      publisher: inst.publisher,
      source: inst.source,
      verificationStatus: inst.verificationStatus,
      supportedOs: inst.supportedOs,
      supportedArch: inst.supportedArch,
      minDiskMb: inst.minDiskMb,
      minRamMb: inst.minRamMb,
      requiredPorts: inst.requiredPorts,
      dependencies: inst.dependencies,
      requiredPrivileges: inst.requiredPrivileges,
      supportsOneClick: inst.supportsOneClick,
      supportsGuided: inst.supportsGuided,
      rollbackAvailable: inst.rollbackAvailable,
      rollbackNote: inst.rollbackNote,
      docsUrl: inst.docsUrl,
      configSchema: inst.configSchema,
      policy: (policies[inst.id] as ApprovalPolicy) || defaultPolicy,
      installedCount: installed.filter((a) => a.installerId === inst.id).length,
    }));
  }

  public async runPreflightAndPlan(
    installerId: string,
    serverId: string,
    config: Record<string, unknown>
  ): Promise<{ preflight: PreflightCheckResult; plan: DeploymentPlan; policy: ApprovalPolicy }> {
    const inst = this.getAllInstallers().find((i) => i.id === installerId);
    if (!inst) throw new Error(`Unknown installer: ${installerId}`);

    const server = this.db.getRemoteServer(serverId);
    if (!server) throw new Error(`Server not found: ${serverId}`);

    const sys = await this.ssh.inspectServerSystem(server);
    const checks: PreflightCheckItem[] = [];

    const osOk = inst.supportedOs.length === 0 || inst.supportedOs.includes(sys.osName);
    checks.push({
      id: 'os',
      label: 'Operating System',
      passed: osOk,
      actual: `${sys.osName} ${sys.osVersion}`.trim(),
      required: inst.supportedOs.join(', '),
      blocking: true,
    });

    const archOk = inst.supportedArch.length === 0 || inst.supportedArch.includes(sys.arch);
    checks.push({
      id: 'arch',
      label: 'CPU Architecture',
      passed: archOk,
      actual: sys.arch,
      required: inst.supportedArch.join(', '),
      blocking: true,
    });

    const diskOk = sys.freeDiskMb >= inst.minDiskMb;
    checks.push({
      id: 'disk',
      label: 'Free Disk Space',
      passed: diskOk,
      actual: `${sys.freeDiskMb} MB`,
      required: `${inst.minDiskMb} MB`,
      blocking: true,
    });

    const memOk = sys.freeMemMb >= inst.minRamMb;
    checks.push({
      id: 'memory',
      label: 'Available Memory',
      passed: memOk,
      actual: `${sys.freeMemMb} MB`,
      required: `${inst.minRamMb} MB`,
      blocking: false,
    });

    const privOk = inst.requiredPrivileges === 'user' || sys.isRootOrSudo;
    checks.push({
      id: 'privileges',
      label: 'Privileges (root / passwordless sudo)',
      passed: privOk,
      actual: sys.isRootOrSudo ? 'root / sudo available' : 'unprivileged user',
      required: inst.requiredPrivileges,
      blocking: true,
    });

    for (const p of inst.requiredPorts) {
      const inUse = sys.listeningPorts.includes(p);
      checks.push({
        id: `port-${p}`,
        label: `Port ${p} Availability`,
        passed: !inUse,
        actual: inUse ? 'In use' : 'Available',
        required: 'Free',
        blocking: false,
      });
    }

    const preflight: PreflightCheckResult = {
      passed: checks.filter((c) => c.blocking).every((c) => c.passed),
      osName: sys.osName,
      osVersion: sys.osVersion,
      arch: sys.arch,
      pkgManager: sys.pkgManager,
      freeDiskMb: sys.freeDiskMb,
      freeMemMb: sys.freeMemMb,
      isRootOrSudo: sys.isRootOrSudo,
      checks,
    };

    const plan = inst.buildPlan(serverId, server.name, config, preflight);
    const policy = (this.db.getInstallerPolicy(installerId) as ApprovalPolicy) || 'always_review';
    return { preflight, plan, policy };
  }

  public async startJob(params: {
    installerId: string;
    serverId: string;
    mode: 'one_click' | 'guided';
    config: Record<string, unknown>;
    approvedByUser: boolean;
  }): Promise<Record<string, unknown>> {
    const inst = this.getAllInstallers().find((i) => i.id === params.installerId);
    if (!inst) throw new Error(`Unknown installer: ${params.installerId}`);

    const { preflight, plan, policy } = await this.runPreflightAndPlan(
      params.installerId,
      params.serverId,
      params.config
    );

    if (!preflight.passed) {
      const failed = preflight.checks.filter((c) => c.blocking && !c.passed).map((c) => `${c.label}: ${c.actual} (need ${c.required})`);
      throw new Error(`Preflight failed: ${failed.join('; ')}`);
    }

    const mustApprove =
      policy === 'always_review' ||
      plan.hasDestructiveOperations ||
      inst.source === 'community';

    if (mustApprove && !params.approvedByUser) {
      throw new Error('Explicit user approval of the deployment plan is required before execution.');
    }

    const jobId = `job-${crypto.randomUUID().slice(0, 8)}`;
    const sanitizedConfig = { ...params.config };
    const secrets: string[] = [];
    for (const f of inst.configSchema) {
      if (f.secret && typeof sanitizedConfig[f.key] === 'string' && sanitizedConfig[f.key]) {
        secrets.push(String(sanitizedConfig[f.key]));
        sanitizedConfig[f.key] = '[REDACTED]';
      }
    }

    const job = this.db.createInstallationJob({
      id: jobId,
      serverId: params.serverId,
      installerId: inst.id,
      installerName: inst.name,
      version: inst.version,
      source: inst.source,
      mode: params.mode,
      status: 'queued',
      approvalPolicy: policy,
      approvedByUser: params.approvedByUser,
      configJson: JSON.stringify(sanitizedConfig),
      planJson: JSON.stringify(plan),
      preflightJson: JSON.stringify(preflight),
      logs: `[${new Date().toISOString()}] Job ${jobId} queued for ${plan.serverName}\n`,
      startedAt: new Date().toISOString(),
    });

    void this.runJobInBackground(jobId, inst, params.serverId, params.config, secrets, preflight);
    return job;
  }

  public cancelJob(jobId: string): boolean {
    const ctrl = this.activeAbortControllers.get(jobId);
    if (!ctrl) return false;
    ctrl.abort();
    return true;
  }

  private async runJobInBackground(
    jobId: string,
    inst: InstallerDefinition,
    serverId: string,
    config: Record<string, unknown>,
    secrets: string[],
    preflight: PreflightCheckResult
  ): Promise<void> {
    const server = this.db.getRemoteServer(serverId);
    if (!server) return;

    const ac = new AbortController();
    this.activeAbortControllers.set(jobId, ac);
    let logBuffer = String(this.db.getInstallationJob(jobId)?.logs ?? '');

    const appendLog = (line: string) => {
      const clean = `[${new Date().toISOString()}] ${line}\n`;
      logBuffer += clean;
      if (logBuffer.length > 200_000) logBuffer = logBuffer.slice(-150_000);
      this.db.updateInstallationJob(jobId, { logs: logBuffer });
      this.onJobUpdate({ jobId, status: (this.db.getInstallationJob(jobId)?.status as JobStatus) ?? 'installing', logLine: clean });
    };

    const setStatus = (status: JobStatus, extra?: Record<string, unknown>) => {
      this.db.updateInstallationJob(jobId, { status, ...extra });
      this.onJobUpdate({ jobId, status });
    };

    try {
      setStatus('installing');
      appendLog(`Starting ${inst.name} (${inst.version}) on ${server.name}...`);

      await inst.install({
        serverId,
        config,
        secrets,
        preflight,
        log: appendLog,
        exec: async (command, opts) => {
          return this.ssh.execOnServer(server, command, {
            timeoutMs: opts?.timeoutMs ?? 180_000,
            secrets,
            signal: ac.signal,
            onStdout: (c) => {
              for (const l of c.split(/\r?\n/)) if (l.trim()) appendLog(l);
            },
            onStderr: (c) => {
              for (const l of c.split(/\r?\n/)) if (l.trim()) appendLog(`[stderr] ${l}`);
            },
          });
        },
      });

      setStatus('verifying');
      appendLog(`Running post-install verification for ${inst.name}...`);

      const verification = await inst.verify({
        serverId,
        config,
        secrets,
        preflight,
        log: appendLog,
        exec: (command, opts) =>
          this.ssh.execOnServer(server, command, {
            timeoutMs: opts?.timeoutMs ?? 30_000,
            secrets,
            signal: ac.signal,
          }),
      });

      if (!verification.ok) {
        throw new Error(`Verification failed: ${verification.details}`);
      }

      appendLog(`Verified: ${verification.details}`);
      this.db.upsertInstalledApp({
        id: `app-${serverId}-${inst.id}`,
        serverId,
        installerId: inst.id,
        name: inst.name,
        version: verification.versionDetected || inst.version,
        source: 'surf_installer',
        installDir: verification.installDir || '',
        serviceName: verification.serviceName || null,
        containerName: verification.containerName || null,
        port: verification.port || null,
        url: verification.url || null,
        status: 'running',
        configJson: JSON.stringify({ ...config, ...(secrets.length ? { _secretsRedacted: true } : {}) }),
        lastHealthCheckAt: new Date().toISOString(),
        lastHealthStatus: 'healthy',
      });

      setStatus('completed', { completedAt: new Date().toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cancelled = ac.signal.aborted;
      appendLog(cancelled ? `Cancelled: ${msg}` : `ERROR: ${msg}`);
      setStatus(cancelled ? 'cancelled' : 'failed', {
        errorMessage: msg,
        recoveryInstructions: inst.rollbackNote,
        completedAt: new Date().toISOString(),
      });
    } finally {
      this.activeAbortControllers.delete(jobId);
    }
  }
}
