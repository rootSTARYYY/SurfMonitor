import crypto from 'node:crypto';
import { SurfDatabase } from '../db/database';
import { SshManager } from '../remote/sshManager';

export class AutomationEngine {
  private timer: NodeJS.Timeout | null = null;
  private retryCounts = new Map<string, number>();

  constructor(private db: SurfDatabase, private ssh: SshManager) {}

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runRuleNow(ruleId: string): Promise<{ ok: boolean; output: string }> {
    const rule = this.db.listAutomationRules().find((r) => r.id === ruleId);
    if (!rule) throw new Error('Automation rule not found');
    const server = this.db.getRemoteServer(String(rule.serverId));
    if (!server) throw new Error('Target server not found');

    const actionType = String(rule.actionType);
    const cfg = JSON.parse(String(rule.actionConfigJson || '{}')) as Record<string, unknown>;
    const execId = `autoexec-${crypto.randomUUID().slice(0, 8)}`;

    try {
      let output = '';
      if (actionType === 'restart_pm2' && cfg.processName) {
        const res = await this.ssh.execOnServer(server, `pm2 restart "${String(cfg.processName).replace(/[^a-zA-Z0-9_.-]/g, '')}"`);
        output = res.stdout || res.stderr;
        if (res.code !== 0) throw new Error(output || `Exit ${res.code}`);
      } else if (actionType === 'restart_docker' && cfg.containerName) {
        const res = await this.ssh.execOnServer(server, `docker restart "${String(cfg.containerName).replace(/[^a-zA-Z0-9_.-]/g, '')}"`);
        output = res.stdout || res.stderr;
        if (res.code !== 0) throw new Error(output || `Exit ${res.code}`);
      } else if (actionType === 'run_command' && cfg.command) {
        const res = await this.ssh.execOnServer(server, String(cfg.command), { timeoutMs: 60_000 });
        output = res.stdout || res.stderr;
        if (res.code !== 0) throw new Error(output || `Exit ${res.code}`);
      } else {
        throw new Error(`Unsupported or incomplete automation action: ${actionType}`);
      }

      this.retryCounts.set(ruleId, 0);
      this.db.recordAutomationExecution({
        id: execId,
        ruleId,
        serverId: server.id,
        status: 'success',
        output: output.slice(0, 4000),
      });
      return { ok: true, output };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.retryCounts.set(ruleId, (this.retryCounts.get(ruleId) ?? 0) + 1);
      this.db.recordAutomationExecution({
        id: execId,
        ruleId,
        serverId: server.id,
        status: 'failed',
        errorMessage: msg,
      });
      return { ok: false, output: msg };
    }
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const rules = this.db.listAutomationRules();
    for (const r of rules) {
      if (!r.enabled) continue;
      const ruleId = String(r.id);
      const maxRetries = Number(r.maxRetries ?? 3);
      if ((this.retryCounts.get(ruleId) ?? 0) >= maxRetries) continue;

      const cooldownMs = Number(r.cooldownSeconds ?? 300) * 1000;
      const lastRunMs = r.lastRunAt ? Date.parse(String(r.lastRunAt)) : 0;
      if (lastRunMs && now - lastRunMs < cooldownMs) continue;

      if (r.triggerType === 'interval') {
        const cond = JSON.parse(String(r.conditionJson || '{}')) as { intervalMinutes?: number };
        const intervalMs = Math.max(5, Number(cond.intervalMinutes ?? 60)) * 60_000;
        if (!lastRunMs || now - lastRunMs >= intervalMs) {
          void this.runRuleNow(ruleId);
        }
      }
    }
  }
}
