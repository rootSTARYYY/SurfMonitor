import React, { useState } from 'react';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Mail,
  Pencil,
  PlugZap,
  MessageSquarePlus,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  IncidentDTO,
  IncidentEventDTO,
  IncidentSeverity,
  MaintenanceWindowDTO,
  Monitor,
  NotificationChannelDTO,
  NotificationHistoryDTO,
  SmtpProvider,
  SmtpSecurityMode,
} from '@/types';
import { formatDurationSeconds, formatTimestamp } from '@/utils/format';

/* ---------------- ADVANCED INCIDENTS PAGE ---------------- */
interface IncidentsPageProps {
  incidents: IncidentDTO[];
  onRefresh: () => void;
  onSelectMonitor: (monitorId: string) => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({
  incidents,
  onRefresh,
  onSelectMonitor,
}) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<IncidentEventDTO[]>([]);
  const [noteText, setNoteText] = useState('');

  const loadEvents = async (incId: string) => {
    setSelectedId(incId);
    if (!window.surfMonitorAPI) return;
    setEvents(await window.surfMonitorAPI.getIncidentEvents(incId));
  };

  const handleUpdate = async (
    id: string,
    updates: Record<string, unknown>
  ) => {
    if (!window.surfMonitorAPI) return;
    await window.surfMonitorAPI.updateIncident(id, updates);
    onRefresh();
    if (selectedId === id) {
      setEvents(await window.surfMonitorAPI.getIncidentEvents(id));
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !noteText.trim() || !window.surfMonitorAPI) return;
    const next = await window.surfMonitorAPI.addIncidentNote(
      selectedId,
      noteText.trim()
    );
    setEvents(next);
    setNoteText('');
  };

  const filtered = incidents.filter(
    (inc) => filter === 'all' || inc.status === filter
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">
            Incident Management
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Lifecycle tracking, severity assignment, acknowledgement, and timelines
          </p>
        </div>

        <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-0.5">
          {(['all', 'open', 'resolved'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] capitalize ${
                filter === status
                  ? 'bg-white/[0.09] text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="rounded border border-white/[0.08] bg-[#09090b] p-8 text-center font-mono text-xs text-zinc-500">
              No incidents recorded.
            </div>
          ) : (
            filtered.map((inc) => {
              const isOpen = inc.status === 'open';
              return (
                <div
                  key={inc.id}
                  onClick={() => void loadEvents(inc.id)}
                  className={`cursor-pointer rounded border p-4 transition-colors ${
                    selectedId === inc.id
                      ? 'border-emerald-500/40 bg-[#101218]'
                      : 'border-white/[0.08] bg-[#09090b] hover:bg-[#0e1015]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ShieldAlert className="h-4 w-4 text-rose-400" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMonitor(inc.monitorId);
                        }}
                        className="text-sm font-semibold text-zinc-100 hover:text-emerald-300"
                      >
                        {inc.monitorName ?? inc.monitorId}
                      </button>
                      <span
                        className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                          isOpen
                            ? 'border-rose-500/25 bg-rose-500/10 text-rose-400'
                            : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {inc.status}
                      </span>
                      <select
                        value={inc.severity}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          void handleUpdate(inc.id, {
                            severity: e.target.value as IncidentSeverity,
                          })
                        }
                        className="rounded border border-white/[0.1] bg-[#101114] px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-300 focus:outline-none"
                      >
                        {['info', 'low', 'medium', 'high', 'critical'].map(
                          (sev) => (
                            <option key={sev} value={sev}>
                              {sev}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!inc.acknowledged && isOpen && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdate(inc.id, { acknowledged: true })
                          }
                          className="rounded border border-white/[0.1] bg-[#101114] px-2 py-1 font-mono text-[10px] text-zinc-300 hover:bg-white/[0.05]"
                        >
                          Acknowledge
                        </button>
                      )}
                      {isOpen ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdate(inc.id, { status: 'resolved' })
                          }
                          className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-400"
                        >
                          Resolve
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdate(inc.id, { status: 'open' })
                          }
                          className="rounded border border-white/[0.1] bg-[#101114] px-2 py-1 font-mono text-[10px] text-zinc-300"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-1.5 font-mono text-xs text-zinc-400">
                    {inc.errorMessage ?? 'Endpoint unreachable'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-4 font-mono text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(inc.startedAt)}
                    </span>
                    <span>
                      Duration: {formatDurationSeconds(inc.durationSeconds)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Incident Timeline Drawer */}
        <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Incident Timeline
          </h2>
          {!selectedId ? (
            <p className="py-8 text-center font-mono text-xs text-zinc-500">
              Select an incident to view its event timeline and add notes.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded border border-white/[0.06] bg-[#101114] p-2.5 font-mono text-[11px]"
                  >
                    <div className="flex justify-between text-zinc-400">
                      <span className="uppercase text-emerald-400">
                        {ev.eventType.replace(/_/g, ' ')}
                      </span>
                      <span>{formatTimestamp(ev.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-zinc-200">{ev.message}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add investigation note..."
                  className="flex-1 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-2.5 py-1.5 text-white hover:bg-emerald-500"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------------- NOTIFICATION CENTER PAGE ---------------- */
interface NotificationsPageProps {
  channels: NotificationChannelDTO[];
  history: NotificationHistoryDTO[];
  onRefresh: () => void;
}

const SMTP_PRESETS: Record<
  SmtpProvider,
  { label: string; host: string; port: number; security: SmtpSecurityMode; hint: string }
> = {
  custom: {
    label: 'Custom SMTP',
    host: '',
    port: 587,
    security: 'starttls',
    hint: 'Configure host, port, and TLS mode manually for any SMTP server or local relay.',
  },
  brevo: {
    label: 'Brevo',
    host: 'smtp-relay.brevo.com',
    port: 587,
    security: 'starttls',
    hint: 'Recommended: smtp-relay.brevo.com on port 587 (STARTTLS) with your Brevo SMTP login & key.',
  },
  gmail: {
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    security: 'starttls',
    hint: 'Recommended: smtp.gmail.com on port 587 (STARTTLS) using a Google App Password.',
  },
  outlook: {
    label: 'Outlook / Office 365',
    host: 'smtp.office365.com',
    port: 587,
    security: 'starttls',
    hint: 'Recommended: smtp.office365.com on port 587 (STARTTLS) with your Microsoft 365 account.',
  },
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  channels,
  history,
  onRefresh,
}) => {
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<NotificationChannelDTO['type']>('discord');
  const [target, setTarget] = useState('');
  const [chatId, setChatId] = useState('');

  const [smtpProvider, setSmtpProvider] = useState<SmtpProvider>('brevo');
  const [smtpHost, setSmtpHost] = useState('smtp-relay.brevo.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecurity, setSmtpSecurity] = useState<SmtpSecurityMode>('starttls');
  const [smtpAuthEnabled, setSmtpAuthEnabled] = useState(true);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [clearSavedPassword, setClearSavedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [senderName, setSenderName] = useState('Surf Monitor');
  const [senderEmail, setSenderEmail] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  const [smtpBusy, setSmtpBusy] = useState<'conn' | 'email' | 'save' | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const applyPreset = (provider: SmtpProvider) => {
    setSmtpProvider(provider);
    const p = SMTP_PRESETS[provider];
    if (provider !== 'custom') {
      setSmtpHost(p.host);
      setSmtpPort(p.port);
      setSmtpSecurity(p.security);
    }
  };

  const resetForm = () => {
    setEditingChannelId(null);
    setName('');
    setTarget('');
    setChatId('');
    setSmtpProvider('brevo');
    setSmtpHost('smtp-relay.brevo.com');
    setSmtpPort(587);
    setSmtpSecurity('starttls');
    setSmtpAuthEnabled(true);
    setSmtpUsername('');
    setSmtpPassword('');
    setHasSavedPassword(false);
    setClearSavedPassword(false);
    setShowPassword(false);
    setSenderName('Surf Monitor');
    setSenderEmail('');
    setRecipientEmail('');
  };

  const buildSmtpConfigPayload = (): Record<string, unknown> => ({
    provider: smtpProvider,
    host: smtpHost.trim(),
    port: Number(smtpPort) || 587,
    security: smtpSecurity,
    authEnabled: smtpAuthEnabled,
    username: smtpAuthEnabled ? smtpUsername.trim() : '',
    password: smtpAuthEnabled ? smtpPassword : '',
    senderName: senderName.trim(),
    senderEmail: senderEmail.trim(),
    recipientEmail: recipientEmail.trim(),
  });

  const handleEditChannel = async (ch: NotificationChannelDTO) => {
    if (ch.type !== 'email' || !window.surfMonitorAPI) return;
    const safe = await window.surfMonitorAPI.getNotificationChannelSafe(ch.id);
    if (!safe.smtp) return;
    setEditingChannelId(ch.id);
    setName(safe.name);
    setType('email');
    setSmtpProvider(safe.smtp.provider);
    setSmtpHost(safe.smtp.host);
    setSmtpPort(safe.smtp.port);
    setSmtpSecurity(safe.smtp.security);
    setSmtpAuthEnabled(safe.smtp.authEnabled);
    setSmtpUsername(safe.smtp.username);
    setSmtpPassword('');
    setHasSavedPassword(safe.smtp.hasPassword);
    setClearSavedPassword(false);
    setSenderName(safe.smtp.senderName);
    setSenderEmail(safe.smtp.senderEmail);
    setRecipientEmail(safe.smtp.recipientEmail);
    setStatusBanner(null);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !window.surfMonitorAPI) return;
    setSmtpBusy('save');
    setStatusBanner(null);
    try {
      const config: Record<string, unknown> =
        type === 'discord'
          ? { webhookUrl: target.trim() }
          : type === 'telegram'
            ? { botToken: target.trim(), chatId: chatId.trim() }
            : type === 'webhook'
              ? { url: target.trim() }
              : type === 'email'
                ? buildSmtpConfigPayload()
                : {};

      if (editingChannelId) {
        await window.surfMonitorAPI.updateNotificationChannel(editingChannelId, {
          name: name.trim(),
          config,
          clearPassword: clearSavedPassword,
        });
        setStatusBanner({ ok: true, text: `Updated channel "${name.trim()}".` });
      } else {
        await window.surfMonitorAPI.createNotificationChannel({
          name: name.trim(),
          type,
          config,
        });
        setStatusBanner({ ok: true, text: `Created channel "${name.trim()}".` });
      }
      resetForm();
      onRefresh();
    } catch (err) {
      setStatusBanner({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to save channel',
      });
    } finally {
      setSmtpBusy(null);
    }
  };

  const handleTestChannel = async (id: string) => {
    if (!window.surfMonitorAPI) return;
    const res = await window.surfMonitorAPI.testNotificationChannel(id);
    setStatusBanner({
      ok: res.ok,
      text: res.ok ? 'Test notification sent!' : `Delivery failed: ${res.error}`,
    });
    onRefresh();
  };

  const handleSmtpTestConnection = async () => {
    if (!window.surfMonitorAPI) return;
    setSmtpBusy('conn');
    setStatusBanner(null);
    try {
      const res = await window.surfMonitorAPI.testSmtpConnection({
        channelId: editingChannelId ?? undefined,
        config: buildSmtpConfigPayload(),
      });
      setStatusBanner({
        ok: res.ok,
        text: res.ok
          ? (res.message ?? 'SMTP connection verified.')
          : (res.error ?? 'SMTP connection failed'),
      });
    } finally {
      setSmtpBusy(null);
    }
  };

  const handleSmtpSendTestEmail = async () => {
    if (!window.surfMonitorAPI) return;
    setSmtpBusy('email');
    setStatusBanner(null);
    try {
      const res = await window.surfMonitorAPI.sendSmtpTestEmail({
        channelId: editingChannelId ?? undefined,
        config: buildSmtpConfigPayload(),
      });
      setStatusBanner({
        ok: res.ok,
        text: res.ok
          ? (res.message ?? 'Test email accepted by SMTP server.')
          : (res.error ?? 'Failed to send test email'),
      });
    } finally {
      setSmtpBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">
          Notification Center
        </h1>
        <p className="font-mono text-xs text-zinc-500">
          Encrypted Discord, Telegram, SMTP Email, Webhook, and Windows Desktop alert channels
        </p>
      </div>

      {statusBanner && (
        <div
          className={`rounded border px-3 py-2 font-mono text-xs ${
            statusBanner.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          {statusBanner.text}
        </div>
      )}

      <form
        onSubmit={handleCreateOrUpdate}
        className="space-y-4 rounded border border-white/[0.08] bg-[#09090b] p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Channel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'email' ? 'Ops Email Alerts' : 'Ops Discord'}
              className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Channel Type
            </label>
            <select
              value={type}
              disabled={Boolean(editingChannelId)}
              onChange={(e) =>
                setType(e.target.value as NotificationChannelDTO['type'])
              }
              className="rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none disabled:opacity-60"
            >
              <option value="discord">Discord Webhook</option>
              <option value="telegram">Telegram Bot</option>
              <option value="email">SMTP Email</option>
              <option value="webhook">Custom Webhook</option>
              <option value="desktop">Windows Desktop</option>
            </select>
          </div>

          {type !== 'desktop' && type !== 'email' && (
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                {type === 'telegram' ? 'Bot Token' : 'Webhook URL'}
              </label>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          )}

          {type === 'telegram' && (
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Chat ID
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          )}

          {type !== 'email' && (
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Channel</span>
            </button>
          )}
        </div>

        {type === 'email' && (
          <div className="space-y-4 border-t border-white/[0.08] pt-4">
            <div className="rounded border border-white/[0.07] bg-[#101114] p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                  1. Connection
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {SMTP_PRESETS[smtpProvider].hint}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    SMTP Provider
                  </label>
                  <select
                    value={smtpProvider}
                    onChange={(e) => applyPreset(e.target.value as SmtpProvider)}
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value="brevo">Brevo</option>
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook / Office 365</option>
                    <option value="custom">Custom SMTP</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp-relay.brevo.com"
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Security Mode
                  </label>
                  <select
                    value={smtpSecurity}
                    onChange={(e) => {
                      const mode = e.target.value as SmtpSecurityMode;
                      setSmtpSecurity(mode);
                      if (mode === 'tls' && smtpPort === 587) setSmtpPort(465);
                      if (mode === 'starttls' && smtpPort === 465) setSmtpPort(587);
                    }}
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value="starttls">STARTTLS (Port 587)</option>
                    <option value="tls">Implicit TLS/SSL (Port 465)</option>
                    <option value="none">None (Plain / Local Relay)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded border border-white/[0.07] bg-[#101114] p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                  2. Authentication
                </span>
                <label className="flex items-center gap-2 font-mono text-[11px] text-zinc-300">
                  <input
                    type="checkbox"
                    checked={smtpAuthEnabled}
                    onChange={(e) => setSmtpAuthEnabled(e.target.checked)}
                  />
                  Require SMTP Authentication
                </label>
              </div>
              {smtpAuthEnabled ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                      SMTP Username
                    </label>
                    <input
                      type="text"
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="user@example.com or SMTP login ID"
                      className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="font-mono text-[11px] text-zinc-400">
                        SMTP Password / App Key
                      </label>
                      {hasSavedPassword && !clearSavedPassword && (
                        <button
                          type="button"
                          onClick={() => {
                            setClearSavedPassword(true);
                            setHasSavedPassword(false);
                            setSmtpPassword('');
                          }}
                          className="font-mono text-[10px] text-rose-400 hover:underline"
                        >
                          Clear saved password
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={smtpPassword}
                        onChange={(e) => {
                          setSmtpPassword(e.target.value);
                          setClearSavedPassword(false);
                        }}
                        placeholder={
                          hasSavedPassword && !clearSavedPassword
                            ? '•••••••••••• (saved — leave blank to keep)'
                            : 'Enter SMTP password or API key'
                        }
                        className="w-full rounded border border-white/[0.1] bg-[#09090b] py-1.5 pl-2.5 pr-8 font-mono text-xs text-zinc-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1.5 text-zinc-500 hover:text-zinc-200"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-[11px] text-zinc-500">
                  Authentication disabled. Only use this for trusted internal SMTP relays that permit unauthenticated sending.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded border border-white/[0.07] bg-[#101114] p-3.5">
                <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                  3. Sender Information
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                      Sender Name
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Surf Monitor Alerts"
                      className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                      Sender Email
                    </label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="alerts@yourdomain.com"
                      className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded border border-white/[0.07] bg-[#101114] p-3.5">
                <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                  4. Recipient Information
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="oncall@yourdomain.com"
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={smtpBusy !== null}
                  onClick={() => void handleSmtpTestConnection()}
                  className="flex items-center gap-1.5 rounded border border-white/[0.12] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.05] disabled:opacity-50"
                >
                  <PlugZap className="h-3.5 w-3.5 text-sky-400" />
                  <span>{smtpBusy === 'conn' ? 'Testing...' : 'Test Connection'}</span>
                </button>
                <button
                  type="button"
                  disabled={smtpBusy !== null}
                  onClick={() => void handleSmtpSendTestEmail()}
                  className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>{smtpBusy === 'email' ? 'Sending...' : 'Send Test Email'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                {editingChannelId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded border border-white/[0.1] px-3 py-1.5 font-mono text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={smtpBusy !== null}
                  className="flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{editingChannelId ? 'Save SMTP Channel' : 'Add SMTP Channel'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Bell className="h-4 w-4 text-emerald-400" />
            Configured Channels ({channels.length})
          </h2>
          <div className="mt-3 space-y-2">
            {channels.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded border border-white/[0.07] bg-[#101114] px-3 py-2.5"
              >
                <div>
                  <div className="text-xs font-medium text-zinc-100">
                    {c.name}
                  </div>
                  <div className="font-mono text-[10px] uppercase text-zinc-500">
                    {c.type}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.type === 'email' && (
                    <button
                      type="button"
                      onClick={() => void handleEditChannel(c)}
                      className="flex items-center gap-1 rounded border border-white/[0.1] px-2 py-1 font-mono text-[10px] text-zinc-300 hover:bg-white/[0.05]"
                    >
                      <Pencil className="h-3 w-3 text-sky-400" />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleTestChannel(c.id)}
                    className="flex items-center gap-1 rounded border border-white/[0.1] px-2 py-1 font-mono text-[10px] text-zinc-300 hover:bg-white/[0.05]"
                  >
                    <Send className="h-3 w-3 text-emerald-400" />
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await window.surfMonitorAPI?.deleteNotificationChannel(
                        c.id
                      );
                      if (editingChannelId === c.id) resetForm();
                      onRefresh();
                    }}
                    className="rounded p-1 text-zinc-500 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/[0.08] bg-[#09090b] p-4">
          <h2 className="text-sm font-semibold text-zinc-100">
            Delivery History ({history.length})
          </h2>
          <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto font-mono text-[11px]">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-2 rounded bg-[#101114] px-3 py-2"
              >
                <span className="text-zinc-300">{h.eventType}</span>
                <span
                  title={h.errorMessage ?? undefined}
                  className={
                    h.status === 'sent'
                      ? 'text-emerald-400'
                      : h.status === 'suppressed'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }
                >
                  {h.status}
                </span>
                <span className="text-zinc-500">
                  {formatTimestamp(h.sentAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- MAINTENANCE WINDOWS PAGE ---------------- */
interface MaintenancePageProps {
  windows: MaintenanceWindowDTO[];
  monitors: Monitor[];
  onRefresh: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({ windows, monitors, onRefresh }) => {
  const [name, setName] = useState('');
  const [monitorId, setMonitorId] = useState('');
  const [durationMins, setDurationMins] = useState(60);
  const [startMode, setStartMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledStart, setScheduledStart] = useState(() => {
    const d = new Date(Date.now() + 3600_000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'past'>('all');

  const monitorMap = new Map(monitors.map((m) => [m.id, m.name]));
  const nowMs = Date.now();

  const categorized = windows.map((w) => {
    const startMs = new Date(w.startsAt).getTime();
    const endMs = new Date(w.endsAt).getTime();
    const status: 'active' | 'upcoming' | 'past' =
      w.enabled === 0 || endMs <= nowMs
        ? 'past'
        : startMs <= nowMs && endMs > nowMs
          ? 'active'
          : 'upcoming';
    return { ...w, status, startMs, endMs };
  });

  const activeCount = categorized.filter((w) => w.status === 'active').length;
  const upcomingCount = categorized.filter((w) => w.status === 'upcoming').length;
  const pastCount = categorized.filter((w) => w.status === 'past').length;
  const filtered =
    filterStatus === 'all'
      ? categorized
      : categorized.filter((w) => w.status === filterStatus);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !window.surfMonitorAPI) return;
    const startMs =
      startMode === 'scheduled' ? new Date(scheduledStart).getTime() : Date.now();
    if (Number.isNaN(startMs)) return;
    await window.surfMonitorAPI.createMaintenanceWindow({
      name: name.trim(),
      monitorId: monitorId || null,
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(startMs + Math.max(5, durationMins) * 60_000).toISOString(),
    });
    setName('');
    onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">
            Maintenance Windows
          </h1>
          <p className="font-mono text-xs text-zinc-500">
            Silence outage alerts &amp; incident creation during planned deployments or VPS reboots
          </p>
        </div>
        <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0e1014] p-0.5 font-mono text-[11px]">
          {(
            [
              { id: 'all', label: `All (${categorized.length})` },
              { id: 'active', label: `Active (${activeCount})` },
              { id: 'upcoming', label: `Upcoming (${upcomingCount})` },
              { id: 'past', label: `Past (${pastCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterStatus(t.id)}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterStatus === t.id
                  ? 'bg-white/[0.09] text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status KPI strip */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.08] overflow-hidden rounded border border-white/[0.08] bg-[#09090b]">
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Active Windows</div>
          <div className={`mt-1 font-mono text-xl font-semibold ${activeCount > 0 ? 'text-amber-400' : 'text-zinc-100'}`}>
            {activeCount}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Scheduled Upcoming</div>
          <div className="mt-1 font-mono text-xl font-semibold text-sky-400">
            {upcomingCount}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[11px] text-zinc-500">Completed / Past</div>
          <div className="mt-1 font-mono text-xl font-semibold text-zinc-400">
            {pastCount}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded border border-white/[0.08] bg-[#09090b] p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Schedule Maintenance Window
          </span>
          <div className="flex items-center gap-1 font-mono text-[11px]">
            {[
              { label: '30m', mins: 30 },
              { label: '1h', mins: 60 },
              { label: '4h', mins: 240 },
              { label: '24h', mins: 1440 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDurationMins(p.mins)}
                className={`rounded border px-2 py-0.5 transition-colors ${
                  durationMins === p.mins
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/[0.08] bg-[#101114] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Window Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ubuntu Kernel Upgrade / DB Migration"
              className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Scope
            </label>
            <select
              value={monitorId}
              onChange={(e) => setMonitorId(e.target.value)}
              className="rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
            >
              <option value="">All Monitors</option>
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Start
            </label>
            <select
              value={startMode}
              onChange={(e) => setStartMode(e.target.value as 'now' | 'scheduled')}
              className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
            >
              <option value="now">Immediately</option>
              <option value="scheduled">Scheduled Time</option>
            </select>
          </div>
          {startMode === 'scheduled' && (
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Start Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Duration (mins)
            </label>
            <input
              type="number"
              min={5}
              max={10080}
              value={durationMins}
              onChange={(e) => setDurationMins(Number(e.target.value))}
              className="w-24 rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span>{startMode === 'now' ? 'Start Window' : 'Schedule Window'}</span>
          </button>
        </div>
      </form>

      {filtered.length === 0 ? (
        <div className="rounded border border-dashed border-white/[0.08] bg-[#09090b] py-10 text-center font-mono text-xs text-zinc-500">
          No maintenance windows in this view.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((w) => {
            const targetName = w.monitorId
              ? (monitorMap.get(w.monitorId) ?? w.monitorId)
              : 'All Monitors';
            const remainingMins = Math.max(
              0,
              Math.ceil((w.endMs - nowMs) / 60_000)
            );
            return (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/[0.08] bg-[#09090b] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">
                      {w.name}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                        w.status === 'active'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                          : w.status === 'upcoming'
                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                            : 'border-white/[0.08] bg-[#101114] text-zinc-500'
                      }`}
                    >
                      {w.status === 'active'
                        ? `ACTIVE • ${remainingMins}m left`
                        : w.status}
                    </span>
                    <span className="rounded border border-white/[0.08] bg-[#101114] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {targetName}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-zinc-500">
                    {formatTimestamp(w.startsAt)} → {formatTimestamp(w.endsAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {w.status === 'active' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await window.surfMonitorAPI?.updateMaintenanceWindow(w.id, {
                          endsAt: new Date().toISOString(),
                          enabled: false,
                        });
                        onRefresh();
                      }}
                      className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] text-amber-300 hover:bg-amber-500/20"
                    >
                      End Early
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await window.surfMonitorAPI?.deleteMaintenanceWindow(w.id);
                      onRefresh();
                    }}
                    className="rounded p-1.5 text-zinc-500 hover:text-rose-400"
                    title="Delete maintenance window"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};