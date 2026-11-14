import React, { useEffect, useState } from 'react';
import { RemoteServerDTO } from '@/types';
import {
  CheckCircle2,
  DownloadCloud,
  KeyRound,
  PlugZap,
  Server,
  X,
} from 'lucide-react';

interface AddServerModalProps {
  isOpen: boolean;
  editingServer?: RemoteServerDTO | null;
  onClose: () => void;
  onCreated: () => void;
}

export const AddServerModal: React.FC<AddServerModalProps> = ({
  isOpen,
  editingServer = null,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [privateKey, setPrivateKey] = useState('');
  const [keyFileName, setKeyFileName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [agentPort, setAgentPort] = useState(47200);
  const [agentToken, setAgentToken] = useState('');
  const [hostFingerprint, setHostFingerprint] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('Production');
  const [cpuThreshold, setCpuThreshold] = useState(90);
  const [ramThreshold, setRamThreshold] = useState(90);
  const [diskThreshold, setDiskThreshold] = useState(90);
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState(15);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setSshOk(false);
    setAgentOk(false);
    setPrivateKey('');
    setKeyFileName('');
    setPassphrase('');
    setAgentToken('');
    if (editingServer) {
      setName(editingServer.name);
      setHost(editingServer.host);
      setPort(editingServer.port);
      setUsername(editingServer.username);
      setAgentPort(editingServer.agentPort);
      setHostFingerprint(editingServer.hostFingerprint);
      setGroupName(editingServer.groupName);
      setCpuThreshold(editingServer.cpuThreshold);
      setRamThreshold(editingServer.ramThreshold);
      setDiskThreshold(editingServer.diskThreshold);
      setPollIntervalSeconds(editingServer.pollIntervalSeconds);
    } else {
      setName('');
      setHost('');
      setPort(22);
      setUsername('root');
      setAgentPort(47200);
      setHostFingerprint(null);
      setGroupName('Production');
      setCpuThreshold(90);
      setRamThreshold(90);
      setDiskThreshold(90);
      setPollIntervalSeconds(15);
    }
  }, [isOpen, editingServer]);

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sshOk, setSshOk] = useState(false);
  const [agentOk, setAgentOk] = useState(false);

  if (!isOpen) return null;

  const handlePickKey = async () => {
    const res = await window.surfMonitorAPI?.pickSshKeyFile();
    if (res) {
      setPrivateKey(res.content);
      setKeyFileName(res.path);
    }
  };

  const handleTestSsh = async () => {
    if (!window.surfMonitorAPI || !host.trim() || !privateKey.trim()) {
      setErrorMsg('Host, username, and SSH private key are required.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg('Testing SSH connection...');
    try {
      const res = await window.surfMonitorAPI.testSshConnection({
        host: host.trim(),
        port,
        username: username.trim(),
        privateKey,
        passphrase: passphrase || undefined,
        agentPort,
        agentToken: agentToken.trim() || undefined,
      });
      if (!res.sshConnected) {
        setSshOk(false);
        setAgentOk(false);
        setErrorMsg(res.error || 'SSH connection failed');
        setStatusMsg(null);
      } else {
        setSshOk(true);
        setHostFingerprint(res.hostFingerprint);
        setAgentOk(res.agentHealthy);
        setStatusMsg(
          res.agentHealthy
            ? `SSH & Agent v${res.agentVersion} verified (${res.hostFingerprint})`
            : `SSH connected (${res.hostFingerprint}). ${res.error ?? 'Ready to install agent.'}`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleInstallAgent = async () => {
    if (!window.surfMonitorAPI || !host.trim() || !privateKey.trim()) {
      setErrorMsg('Host, username, and SSH private key are required.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg('Installing Surf Monitor Agent via SFTP + systemd...');
    try {
      const res = await window.surfMonitorAPI.installRemoteAgent({
        host: host.trim(),
        port,
        username: username.trim(),
        privateKey,
        passphrase: passphrase || undefined,
        agentPort,
      });
      if (res.ok && res.token) {
        setAgentToken(res.token);
        setHostFingerprint(res.fingerprint);
        setSshOk(true);
        setAgentOk(true);
        setStatusMsg(
          'Surf Monitor Agent installed, started on 127.0.0.1, and token generated.'
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Agent installation failed'
      );
      setStatusMsg(null);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.surfMonitorAPI) return;
    if (!editingServer && (!name.trim() || !host.trim() || !privateKey.trim() || !agentToken.trim())) {
      setErrorMsg(
        'Server name, host, SSH private key, and agent token (install or paste) are required.'
      );
      return;
    }
    if (editingServer && (!name.trim() || !host.trim())) {
      setErrorMsg('Server name and host are required.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      if (editingServer) {
        await window.surfMonitorAPI.updateRemoteServer(editingServer.id, {
          name: name.trim(),
          host: host.trim(),
          port,
          username: username.trim(),
          privateKey: privateKey.trim() || undefined,
          passphrase: passphrase || undefined,
          agentToken: agentToken.trim() || undefined,
          hostFingerprint,
          agentPort,
          groupName: groupName.trim() || 'Default',
          pollIntervalSeconds,
          cpuThreshold,
          ramThreshold,
          diskThreshold,
        });
      } else {
        await window.surfMonitorAPI.createRemoteServer({
          name: name.trim(),
          host: host.trim(),
          port,
          username: username.trim(),
          privateKey,
          passphrase: passphrase || undefined,
          agentToken: agentToken.trim(),
          hostFingerprint,
          agentPort,
          groupName: groupName.trim() || 'Default',
          pollIntervalSeconds,
          cpuThreshold,
          ramThreshold,
          diskThreshold,
        });
      }
      onCreated();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save server');
    } finally {
      setBusy(false);
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
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded border border-white/[0.12] bg-[#111216] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Add Remote Server (SSH Tunnel)
              </h2>
              <p className="font-mono text-[11px] text-zinc-500">
                Credentials encrypted via Electron safeStorage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 p-5">
          {errorMsg && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-400">
              {errorMsg}
            </div>
          )}
          {statusMsg && (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-xs text-emerald-300">
              {statusMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Server Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="prod-eu-vps-01"
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 text-xs text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Group
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Production"
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                IP Address / Hostname
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="203.0.113.10"
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                SSH Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ubuntu"
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="font-mono text-[11px] text-zinc-400">
                SSH Private Key
              </label>
              <button
                type="button"
                onClick={() => void handlePickKey()}
                className="flex items-center gap-1 rounded border border-white/[0.1] bg-[#181a20] px-2 py-1 font-mono text-[10px] text-zinc-300 hover:bg-white/[0.06]"
              >
                <KeyRound className="h-3 w-3 text-emerald-400" />
                <span>{keyFileName ? 'Key Loaded' : 'Browse Key File'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              className="w-full rounded border border-white/[0.1] bg-[#09090b] p-2.5 font-mono text-[11px] text-zinc-200 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Passphrase (opt)
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Agent Port
              </label>
              <input
                type="number"
                value={agentPort}
                onChange={(e) => setAgentPort(Number(e.target.value))}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Agent Token
              </label>
              <input
                type="password"
                value={agentToken}
                onChange={(e) => setAgentToken(e.target.value)}
                placeholder="Auto on install"
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                CPU Alert %
              </label>
              <input
                type="number"
                value={cpuThreshold}
                onChange={(e) => setCpuThreshold(Number(e.target.value))}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                RAM Alert %
              </label>
              <input
                type="number"
                value={ramThreshold}
                onChange={(e) => setRamThreshold(Number(e.target.value))}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Disk Alert %
              </label>
              <input
                type="number"
                value={diskThreshold}
                onChange={(e) => setDiskThreshold(Number(e.target.value))}
                className="w-full rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Connection & Agent Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/[0.08] bg-[#09090b] p-3">
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className={sshOk ? 'text-emerald-400' : 'text-zinc-500'}>
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                SSH {sshOk ? 'OK' : 'Pending'}
              </span>
              <span className={agentOk ? 'text-emerald-400' : 'text-zinc-500'}>
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                Agent {agentOk ? 'Healthy' : 'Not Verified'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTestSsh()}
                className="flex items-center gap-1 rounded border border-white/[0.1] bg-[#181a20] px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50"
              >
                <PlugZap className="h-3 w-3 text-emerald-400" />
                Test SSH
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleInstallAgent()}
                className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[11px] text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <DownloadCloud className="h-3 w-3" />
                Install Agent
              </button>
            </div>
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
              disabled={busy}
              className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Save Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
