import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  CheckIntervalSeconds,
  HttpMethod,
  Monitor,
  MonitorFormData,
  MonitorGroupDTO,
  MonitorType,
} from '@/types';

interface AddMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MonitorFormData, existingId?: string) => Promise<void> | void;
  editingMonitor?: Monitor | null;
  groups: MonitorGroupDTO[];
  defaultIntervalSeconds: CheckIntervalSeconds;
  defaultTimeoutSeconds: number;
}

const INTERVAL_OPTIONS: { value: CheckIntervalSeconds; label: string }[] = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '60 seconds' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
];

const MONITOR_TYPES: { value: MonitorType; label: string }[] = [
  { value: 'http', label: 'HTTP / HTTPS' },
  { value: 'ssl', label: 'SSL Certificate' },
  { value: 'dns', label: 'DNS Record' },
  { value: 'tcp', label: 'TCP Port' },
  { value: 'ping', label: 'ICMP Ping' },
  { value: 'keyword', label: 'Keyword Check' },
  { value: 'heartbeat', label: 'Heartbeat Job' },
  { value: 'content', label: 'Content Diff' },
  { value: 'domain', label: 'Domain RDAP' },
];

const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
];

export const AddMonitorModal: React.FC<AddMonitorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMonitor,
  groups,
  defaultIntervalSeconds,
  defaultTimeoutSeconds,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://');
  const [monitorType, setMonitorType] = useState<MonitorType>('http');
  const [intervalSeconds, setIntervalSeconds] =
    useState<CheckIntervalSeconds>(defaultIntervalSeconds);
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(
    defaultTimeoutSeconds
  );
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [expectedStatusCodes, setExpectedStatusCodes] = useState('200-399');
  const [groupId, setGroupId] = useState<string>('');
  const [tagsText, setTagsText] = useState('');

  // Advanced config
  const [authType, setAuthType] = useState<'none' | 'basic' | 'bearer'>('none');
  const [authUsername, setAuthUsername] = useState('');
  const [authSecretPlain, setAuthSecretPlain] = useState('');
  const [maxResponseTimeMs, setMaxResponseTimeMs] = useState('');
  const [jsonPath, setJsonPath] = useState('');
  const [jsonExpectedValue, setJsonExpectedValue] = useState('');
  const [expectedText, setExpectedText] = useState('');
  const [tcpPort, setTcpPort] = useState('443');
  const [dnsRecordType, setDnsRecordType] = useState('A');
  const [dnsResolver, setDnsResolver] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingMonitor) {
      setName(editingMonitor.name);
      setUrl(editingMonitor.url);
      setMonitorType(editingMonitor.monitorType || 'http');
      setIntervalSeconds(editingMonitor.interval);
      setTimeoutSeconds(editingMonitor.timeout);
      setMethod(editingMonitor.method);
      setExpectedStatusCodes(editingMonitor.expectedStatusCodes || '200-399');
      setGroupId(editingMonitor.groupId ?? '');
      setTagsText((editingMonitor.tags ?? []).join(', '));
      const cfg = editingMonitor.config ?? {};
      setAuthType((cfg.authType as 'none' | 'basic' | 'bearer') ?? 'none');
      setAuthUsername(String(cfg.authUsername ?? ''));
      setAuthSecretPlain('');
      setMaxResponseTimeMs(
        cfg.maxResponseTimeMs ? String(cfg.maxResponseTimeMs) : ''
      );
      setJsonPath(String(cfg.jsonPath ?? ''));
      setJsonExpectedValue(String(cfg.jsonExpectedValue ?? ''));
      setExpectedText(String(cfg.expectedText ?? ''));
      setTcpPort(cfg.port ? String(cfg.port) : '443');
      setDnsRecordType(String(cfg.dnsRecordType ?? 'A'));
      setDnsResolver(String(cfg.dnsResolver ?? ''));
    } else {
      setName('');
      setUrl('https://');
      setMonitorType('http');
      setIntervalSeconds(defaultIntervalSeconds);
      setTimeoutSeconds(defaultTimeoutSeconds);
      setMethod('GET');
      setExpectedStatusCodes('200-399');
      setGroupId('');
      setTagsText('');
      setAuthType('none');
      setAuthUsername('');
      setAuthSecretPlain('');
      setMaxResponseTimeMs('');
      setJsonPath('');
      setJsonExpectedValue('');
      setExpectedText('');
      setTcpPort('443');
      setDnsRecordType('A');
      setDnsResolver('');
    }
    setError(null);
    setSubmitting(false);
  }, [isOpen, editingMonitor, defaultIntervalSeconds, defaultTimeoutSeconds]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setError('Monitor name must be at least 2 characters.');
      return;
    }
    if (!url.trim()) {
      setError('Target URL or hostname is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const config: Record<string, unknown> = {
        authType,
        authUsername: authUsername.trim(),
        ...(authSecretPlain ? { authSecretPlain } : {}),
        ...(maxResponseTimeMs
          ? { maxResponseTimeMs: Number(maxResponseTimeMs) }
          : {}),
        ...(jsonPath.trim() ? { jsonPath: jsonPath.trim() } : {}),
        ...(jsonExpectedValue.trim()
          ? { jsonExpectedValue: jsonExpectedValue.trim() }
          : {}),
        ...(expectedText.trim() ? { expectedText: expectedText.trim() } : {}),
        ...(monitorType === 'tcp' ? { port: Number(tcpPort) || 443 } : {}),
        ...(monitorType === 'dns'
          ? {
              dnsRecordType,
              ...(dnsResolver.trim() ? { dnsResolver: dnsResolver.trim() } : {}),
            }
          : {}),
      };

      await onSave(
        {
          name: name.trim(),
          url: url.trim(),
          monitorType,
          intervalSeconds,
          timeoutSeconds,
          method,
          expectedStatusCodes: expectedStatusCodes.trim() || '200-399',
          groupId: groupId || null,
          tags: tagsText
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          config,
        },
        editingMonitor?.id
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save monitor.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded border border-white/[0.12] bg-[#111216] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {editingMonitor ? 'Edit Monitor' : 'Add Monitor'}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
              Multi-protocol monitor configuration
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Monitor Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production API"
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Monitor Type
              </label>
              <select
                value={monitorType}
                onChange={(e) => setMonitorType(e.target.value as MonitorType)}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              >
                {MONITOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              {monitorType === 'tcp' || monitorType === 'ping' || monitorType === 'dns'
                ? 'Hostname / IP / Target'
                : 'Target URL (HTTP / HTTPS)'}
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Interval
              </label>
              <select
                value={intervalSeconds}
                onChange={(e) =>
                  setIntervalSeconds(
                    Number(e.target.value) as CheckIntervalSeconds
                  )
                }
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Timeout (s)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Group
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              >
                <option value="">Ungrouped</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(monitorType === 'http' ||
            monitorType === 'keyword' ||
            monitorType === 'content') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    HTTP Method
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as HttpMethod)}
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                  >
                    {HTTP_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Expected Status Codes
                  </label>
                  <input
                    type="text"
                    value={expectedStatusCodes}
                    onChange={(e) => setExpectedStatusCodes(e.target.value)}
                    placeholder="200-399"
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Auth
                  </label>
                  <select
                    value={authType}
                    onChange={(e) =>
                      setAuthType(e.target.value as 'none' | 'basic' | 'bearer')
                    }
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer</option>
                    <option value="basic">Basic</option>
                  </select>
                </div>
                {authType === 'basic' && (
                  <div>
                    <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                      Username
                    </label>
                    <input
                      type="text"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                    />
                  </div>
                )}
                {authType !== 'none' && (
                  <div className={authType === 'bearer' ? 'col-span-2' : ''}>
                    <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                      {authType === 'bearer' ? 'Bearer Token' : 'Password'}
                    </label>
                    <input
                      type="password"
                      value={authSecretPlain}
                      onChange={(e) => setAuthSecretPlain(e.target.value)}
                      placeholder={
                        editingMonitor?.hasAuthSecret
                          ? '•••••••• (unchanged)'
                          : 'Encrypted via safeStorage'
                      }
                      className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    JSON Path
                  </label>
                  <input
                    type="text"
                    value={jsonPath}
                    onChange={(e) => setJsonPath(e.target.value)}
                    placeholder="status"
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    JSON Value
                  </label>
                  <input
                    type="text"
                    value={jsonExpectedValue}
                    onChange={(e) => setJsonExpectedValue(e.target.value)}
                    placeholder="healthy"
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Max Latency (ms)
                  </label>
                  <input
                    type="number"
                    value={maxResponseTimeMs}
                    onChange={(e) => setMaxResponseTimeMs(e.target.value)}
                    placeholder="1500"
                    className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                  Expected Response Text (optional)
                </label>
                <input
                  type="text"
                  value={expectedText}
                  onChange={(e) => setExpectedText(e.target.value)}
                  placeholder="ok"
                  className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                />
              </div>
            </>
          )}

          {monitorType === 'tcp' && (
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                TCP Port
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={tcpPort}
                onChange={(e) => setTcpPort(e.target.value)}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          )}

          {monitorType === 'dns' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                  Record Type
                </label>
                <select
                  value={dnsRecordType}
                  onChange={(e) => setDnsRecordType(e.target.value)}
                  className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                >
                  {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA'].map(
                    (rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                  Custom Resolver (optional)
                </label>
                <input
                  type="text"
                  value={dnsResolver}
                  onChange={(e) => setDnsResolver(e.target.value)}
                  placeholder="1.1.1.1"
                  className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="production, api, critical"
              className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingMonitor
                  ? 'Save Changes'
                  : 'Create Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
