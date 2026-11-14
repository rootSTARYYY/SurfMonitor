import nodemailer from 'nodemailer';
import { NotificationChannelRecord, SurfDatabase } from '../db/database';
import { decryptSecret } from '../security/secrets';

export type SmtpProvider = 'custom' | 'brevo' | 'gmail' | 'outlook';
export type SmtpSecurityMode = 'none' | 'starttls' | 'tls';

export interface SmtpConfig {
  provider?: SmtpProvider;
  host: string;
  port: number;
  security: SmtpSecurityMode;
  authEnabled: boolean;
  username?: string;
  password?: string;
  senderName?: string;
  senderEmail?: string;
  recipientEmail: string;
}

export interface NotificationPayload {
  monitorId?: string;
  monitorName: string;
  groupName?: string;
  currentState: string;
  previousState: string;
  timestamp: string;
  responseTimeMs: number | null;
  errorDetails: string | null;
  incidentId?: string;
  eventType:
    | 'DOWN'
    | 'DEGRADED'
    | 'RECOVERY'
    | 'SSL_EXPIRY'
    | 'DNS_CHANGE'
    | 'CONTENT_CHANGE'
    | 'TEST';
}

export function normalizeSmtpConfig(raw: Record<string, unknown>): SmtpConfig {
  const host = String(raw.host ?? '').trim();
  const port = Number(raw.port ?? 587);
  let security: SmtpSecurityMode = 'starttls';
  if (raw.security === 'none' || raw.security === 'starttls' || raw.security === 'tls') {
    security = raw.security;
  } else if (typeof raw.secure === 'boolean') {
    security = raw.secure ? 'tls' : 'starttls';
  }

  const username = String(raw.username ?? raw.user ?? '').trim();
  const password = String(raw.password ?? raw.pass ?? '');
  const authEnabled =
    typeof raw.authEnabled === 'boolean'
      ? raw.authEnabled
      : Boolean(username || password);

  const senderEmail = String(raw.senderEmail ?? raw.from ?? username ?? '').trim();
  const senderName = String(raw.senderName ?? '').trim();
  const recipientEmail = String(raw.recipientEmail ?? raw.to ?? '').trim();

  return {
    provider: (raw.provider as SmtpProvider) ?? 'custom',
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    security,
    authEnabled,
    username,
    password,
    senderName,
    senderEmail,
    recipientEmail,
  };
}

export function classifySmtpError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown SMTP error');
  const lower = raw.toLowerCase();

  if (
    lower.includes('authentication required') ||
    lower.includes('502 5.7.0') ||
    lower.includes('please authenticate first') ||
    lower.includes('530 ')
  ) {
    return `Authentication required: ${raw}`;
  }
  if (
    lower.includes('535') ||
    lower.includes('invalid login') ||
    lower.includes('username and password not accepted') ||
    lower.includes('authentication unsuccessful') ||
    lower.includes('authentication failed')
  ) {
    return `Invalid username or password: ${raw}`;
  }
  if (
    lower.includes('tls') ||
    lower.includes('ssl') ||
    lower.includes('wrong version number') ||
    lower.includes('self-signed') ||
    lower.includes('cert') ||
    lower.includes('eproto')
  ) {
    return `TLS negotiation failed: ${raw}`;
  }
  if (
    lower.includes('etimedout') ||
    lower.includes('timeout') ||
    lower.includes('greeting never received')
  ) {
    return `Connection timeout: ${raw}`;
  }
  if (
    lower.includes('mail from') ||
    lower.includes('sender rejected') ||
    lower.includes('553 ')
  ) {
    return `Sender rejected: ${raw}`;
  }
  if (
    lower.includes('rcpt to') ||
    lower.includes('recipient') ||
    lower.includes('no recipients') ||
    lower.includes('550 ') ||
    lower.includes('554 ')
  ) {
    return `Recipient rejected: ${raw}`;
  }
  if (
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('ehostunreach') ||
    lower.includes('enetunreach')
  ) {
    return `SMTP server unavailable: ${raw}`;
  }
  return raw;
}

export function buildNodemailerTransportOptions(rawConfig: Record<string, unknown>) {
  const cfg = normalizeSmtpConfig(rawConfig);
  if (!cfg.host) {
    throw new Error('SMTP server unavailable: SMTP host is required');
  }
  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) {
    throw new Error('SMTP server unavailable: SMTP port must be between 1 and 65535');
  }
  if (cfg.authEnabled && (!cfg.username || !cfg.password)) {
    throw new Error(
      'Authentication required: SMTP username and password must be provided when authentication is enabled'
    );
  }

  return {
    cfg,
    options: {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.security === 'tls',
      requireTLS: cfg.security === 'starttls',
      ignoreTLS: cfg.security === 'none',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: cfg.authEnabled
        ? {
            user: cfg.username ?? '',
            pass: cfg.password ?? '',
          }
        : undefined,
    },
  };
}

export async function testSmtpConnection(
  rawConfig: Record<string, unknown>
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const { cfg, options } = buildNodemailerTransportOptions(rawConfig);
    const transporter = nodemailer.createTransport(options);
    await transporter.verify();
    return {
      ok: true,
      message: `Connected to ${cfg.host}:${cfg.port} (${cfg.security.toUpperCase()})${
        cfg.authEnabled ? ' and authenticated successfully.' : ' (unauthenticated relay).'
      }`,
    };
  } catch (err) {
    return { ok: false, error: classifySmtpError(err) };
  }
}

export async function sendSmtpTestEmail(
  rawConfig: Record<string, unknown>
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const { cfg, options } = buildNodemailerTransportOptions(rawConfig);
    if (!cfg.recipientEmail || !cfg.recipientEmail.includes('@')) {
      throw new Error('Recipient rejected: a valid recipient email address is required');
    }
    const senderAddr = cfg.senderEmail || cfg.username || 'surf-monitor@localhost';
    const fromHeader = cfg.senderName
      ? `"${cfg.senderName.replace(/"/g, '')}" <${senderAddr}>`
      : senderAddr;

    const transporter = nodemailer.createTransport(options);
    await transporter.verify();
    const info = await transporter.sendMail({
      from: fromHeader,
      to: cfg.recipientEmail,
      subject: '[Surf Monitor] SMTP Test Notification',
      text: `This is a test email from Surf Monitor v3.2.0.\nSMTP Host: ${cfg.host}:${cfg.port}\nSecurity: ${cfg.security.toUpperCase()}\nTime: ${new Date().toISOString()}`,
    });

    if (Array.isArray(info.rejected) && info.rejected.length > 0) {
      throw new Error(`Recipient rejected: ${info.rejected.join(', ')}`);
    }

    return {
      ok: true,
      message: `Test email accepted by ${cfg.host} for ${cfg.recipientEmail}.`,
    };
  } catch (err) {
    return { ok: false, error: classifySmtpError(err) };
  }
}

export class NotificationService {
  private db: SurfDatabase;
  private defaultCooldownSeconds = 300;

  constructor(db: SurfDatabase) {
    this.db = db;
  }

  private formatMessage(p: NotificationPayload): string {
    const lines = [
      `[Surf Monitor] ${p.monitorName} → ${p.currentState}`,
      p.groupName ? `Group: ${p.groupName}` : null,
      `Previous: ${p.previousState} | Time: ${p.timestamp}`,
      p.responseTimeMs !== null ? `Latency: ${p.responseTimeMs}ms` : null,
      p.errorDetails ? `Details: ${p.errorDetails}` : null,
      p.incidentId ? `Incident: ${p.incidentId}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  }

  public isCoolingDown(
    channelId: string,
    monitorId: string | undefined,
    eventType: string,
    cooldownSeconds = this.defaultCooldownSeconds
  ): boolean {
    if (!monitorId || eventType === 'TEST') return false;
    const lastSent = this.db.getLastSentNotificationTime(
      channelId,
      monitorId,
      eventType
    );
    if (!lastSent) return false;
    const elapsedSec = (Date.now() - new Date(lastSent).getTime()) / 1000;
    return elapsedSec < cooldownSeconds;
  }

  public async sendToChannel(
    channel: NotificationChannelRecord,
    payload: NotificationPayload
  ): Promise<{ ok: boolean; error?: string }> {
    const config = JSON.parse(decryptSecret(channel.configEncrypted)) as Record<
      string,
      unknown
    >;
    const text = this.formatMessage(payload);

    try {
      if (channel.type === 'discord') {
        const webhookUrl = String(config.webhookUrl ?? '');
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: text,
          }),
        });
        if (!res.ok) {
          throw new Error(`Discord webhook returned HTTP ${res.status}`);
        }
      } else if (channel.type === 'telegram') {
        const botToken = String(config.botToken ?? '');
        const chatId = String(config.chatId ?? '');
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
          }
        );
        if (!res.ok) {
          throw new Error(`Telegram API returned HTTP ${res.status}`);
        }
      } else if (channel.type === 'webhook') {
        const url = String(config.url ?? '');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(`Webhook returned HTTP ${res.status}`);
        }
      } else if (channel.type === 'email') {
        const { cfg, options } = buildNodemailerTransportOptions(config);
        if (!cfg.recipientEmail || !cfg.recipientEmail.includes('@')) {
          throw new Error('Recipient rejected: missing valid recipient email');
        }
        const senderAddr =
          cfg.senderEmail || cfg.username || 'surf-monitor@localhost';
        const fromHeader = cfg.senderName
          ? `"${cfg.senderName.replace(/"/g, '')}" <${senderAddr}>`
          : senderAddr;
        const transporter = nodemailer.createTransport(options);
        await transporter.verify();
        const info = await transporter.sendMail({
          from: fromHeader,
          to: cfg.recipientEmail,
          subject: `[Surf Monitor] ${payload.monitorName} is ${payload.currentState}`,
          text,
        });
        if (Array.isArray(info.rejected) && info.rejected.length > 0) {
          throw new Error(`Recipient rejected: ${info.rejected.join(', ')}`);
        }
      } else if (channel.type === 'desktop') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { Notification } = require('electron') as {
            Notification?: new (opts: {
              title: string;
              body: string;
            }) => { show: () => void };
          };
          if (Notification) {
            new Notification({
              title: `${payload.monitorName} → ${payload.currentState}`,
              body: payload.errorDetails ?? `Previous: ${payload.previousState}`,
            }).show();
          }
        } catch {
          // Outside Electron
        }
      }

      this.db.recordNotificationHistory({
        channelId: channel.id,
        monitorId: payload.monitorId,
        incidentId: payload.incidentId,
        eventType: payload.eventType,
        status: 'sent',
      });
      return { ok: true };
    } catch (err) {
      const msg =
        channel.type === 'email'
          ? classifySmtpError(err)
          : err instanceof Error
            ? err.message
            : 'Delivery failed';
      this.db.recordNotificationHistory({
        channelId: channel.id,
        monitorId: payload.monitorId,
        incidentId: payload.incidentId,
        eventType: payload.eventType,
        status: 'failed',
        errorMessage: msg,
      });
      return { ok: false, error: msg };
    }
  }

  public async dispatchEvent(payload: NotificationPayload): Promise<void> {
    const channels = this.db
      .getNotificationChannels()
      .filter((c) => c.enabled === 1);

    for (const ch of channels) {
      if (
        this.isCoolingDown(
          ch.id,
          payload.monitorId,
          payload.eventType,
          this.defaultCooldownSeconds
        )
      ) {
        this.db.recordNotificationHistory({
          channelId: ch.id,
          monitorId: payload.monitorId,
          incidentId: payload.incidentId,
          eventType: payload.eventType,
          status: 'suppressed',
          errorMessage: 'Suppressed by cooldown policy',
        });
        continue;
      }

      await this.sendToChannel(ch, payload);
    }
  }
}
