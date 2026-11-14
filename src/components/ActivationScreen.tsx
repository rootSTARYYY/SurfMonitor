import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { PublicLicenseState } from '@/types';

interface ActivationScreenProps {
  licenseState: PublicLicenseState;
  onActivated: (next: PublicLicenseState) => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({
  licenseState,
  onActivated,
}) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    licenseState.message && licenseState.status !== 'UNACTIVATED'
      ? licenseState.message
      : null
  );

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = licenseKey.trim();
    if (!trimmed) {
      setError('Please enter your SunLicense key.');
      return;
    }
    if (!window.surfMonitorAPI) {
      setError('Electron licensing bridge is unavailable.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const next = await window.surfMonitorAPI.activateLicense(
        trimmed,
        analyticsEnabled
      );
      if (next.licensed) {
        onActivated(next);
      } else {
        setError(
          next.message || `Activation failed (${next.lastResultCode ?? next.status}).`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#09090b] p-6 text-zinc-100">
      <div className="w-full max-w-md rounded border border-white/[0.1] bg-[#101116] p-7 shadow-2xl">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-zinc-100">
              Activate Surf Monitor
            </h1>
            <p className="font-mono text-[11px] text-zinc-500">
              v2.2.0 · SunLicense Verification
            </p>
          </div>
        </div>

        {/* Status Banner if Expired/Revoked/Suspended */}
        {licenseState.status !== 'UNACTIVATED' && !licenseState.licensed && (
          <div className="mt-5 flex items-start gap-2.5 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-mono font-semibold">
                Status: {licenseState.status}
              </div>
              <div className="mt-0.5 text-[11px] text-amber-200/80">
                {licenseState.message ||
                  'Please enter a valid license key to continue.'}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleActivate} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="sunlicense-key"
              className="mb-1.5 block font-mono text-[11px] text-zinc-400"
            >
              License Key
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="sunlicense-key"
                type={showKey ? 'text' : 'password'}
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoFocus
                className="w-full rounded border border-white/[0.12] bg-[#09090b] py-2.5 pl-9 pr-10 font-mono text-xs text-zinc-100 placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-200"
                aria-label={showKey ? 'Hide license key' : 'Show license key'}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded border border-white/[0.06] bg-[#09090b] p-3 text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={(e) => setAnalyticsEnabled(e.target.checked)}
              className="mt-0.5 accent-emerald-500"
            />
            <span>
              Share anonymous runtime diagnostics (OS, architecture, app version)
              with SunLicense. No hostnames, URLs, or personal data are sent.
            </span>
          </label>

          {error && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Validating with SunLicense...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Activate Surf Monitor</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-3.5 font-mono text-[10px] text-zinc-500">
          <span>Machine ID: {licenseState.machineId.slice(0, 12)}…</span>
          <span>api.sunlicense.com</span>
        </div>
      </div>
    </div>
  );
};
