import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { PublicLicenseState } from '@/types';
import { formatTimestamp } from '@/utils/format';

interface ActivationScreenProps {
  licenseState: PublicLicenseState;
  onActivated: (next: PublicLicenseState) => void;
}

type OnboardingStep = 'welcome' | 'profile' | 'activate';
type ChosenFlow = 'trial' | 'license';

const SurfLogoMark: React.FC<{ className?: string }> = ({ className = 'h-9 w-9' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="64" height="64" rx="14" fill="#09090b" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
    <path
      d="M46 16H27C20.5 16 16 20 16 25.5C16 31 20.5 34.5 27 35.5L36 37C41.5 37.8 44 40 44 43C44 46.2 40.8 48 35.5 48H18"
      stroke="#b5e637"
      strokeWidth="4.2"
      strokeLinecap="round"
    />
    <path
      d="M46 22H28C23.8 22 21.5 24 21.5 26.2C21.5 28.5 23.8 30 28 30.8L36 32.2C44 33.6 48.5 37.2 48.5 43.2C48.5 49.5 43.2 53 35.5 53H18"
      stroke="#b5e637"
      strokeWidth="3.2"
      strokeLinecap="round"
      opacity="0.85"
    />
  </svg>
);

export const ActivationScreen: React.FC<ActivationScreenProps> = ({
  licenseState,
  onActivated,
}) => {
  const isTrialExpired = licenseState.status === 'TRIAL_EXPIRED';
  const isRejectedLicense =
    !isTrialExpired &&
    licenseState.status !== 'UNACTIVATED' &&
    !licenseState.licensed;

  const [step, setStep] = useState<OnboardingStep>(
    isRejectedLicense ? 'activate' : 'welcome'
  );
  const [flow, setFlow] = useState<ChosenFlow>('trial');
  const [username, setUsername] = useState(licenseState.username ?? '');
  const [licenseKey, setLicenseKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    isRejectedLicense && licenseState.message ? licenseState.message : null
  );

  const handleChooseFlow = (chosen: ChosenFlow) => {
    setFlow(chosen);
    setError(null);
    if (licenseState.username && licenseState.username.trim().length >= 2) {
      if (chosen === 'trial') {
        void handleStartTrial(licenseState.username);
      } else {
        setStep('activate');
      }
      return;
    }
    setStep('profile');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = username.replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) {
      setError('Please enter a username (at least 2 characters).');
      return;
    }
    setUsername(cleaned);
    setError(null);

    if (flow === 'trial') {
      await handleStartTrial(cleaned);
    } else {
      setStep('activate');
    }
  };

  const handleStartTrial = async (nameToUse: string) => {
    if (!window.surfMonitorAPI) {
      setError('Electron licensing bridge is unavailable.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const next = await window.surfMonitorAPI.startTrial(nameToUse);
      if (next.licensed) {
        onActivated(next);
      } else {
        setError(next.message || 'Unable to start 7-day free trial.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start trial.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = licenseKey.trim();
    if (!trimmed) {
      setError('Please enter your license key.');
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
        analyticsEnabled,
        username.trim() || undefined
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

  const handleJoinDiscord = () => {
    if (licenseState.discordInviteUrl) {
      void window.surfMonitorAPI?.openExternal(licenseState.discordInviteUrl);
    } else {
      setError(
        'No Discord invite URL has been configured for this build yet. Please contact the administrator or enter an existing license key.'
      );
    }
  };

  // Dedicated Trial Expired Experience (Section 7)
  if (isTrialExpired && step !== 'activate') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#09090b] p-6 text-zinc-100">
        <div className="w-full max-w-lg rounded-lg border border-white/[0.1] bg-[#101116] p-7 shadow-2xl">
          <div className="flex items-center gap-3">
            <SurfLogoMark />
            <div>
              <span className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] uppercase text-rose-300">
                <Clock className="h-3 w-3" />
                Trial Expired
              </span>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-zinc-100">
                Your Free Trial Has Ended
              </h1>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            Your 7-day Surf Monitor trial has expired. Activate a license to continue using Surf Monitor. All of your monitors, servers, history, and settings remain safely preserved.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 rounded border border-white/[0.08] bg-[#09090b] p-3.5 font-mono text-[11px] sm:grid-cols-3">
            <div>
              <div className="text-[10px] text-zinc-500">Trial Started</div>
              <div className="mt-0.5 text-zinc-200">
                {formatTimestamp(licenseState.trialStartedAt)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500">Trial Expired</div>
              <div className="mt-0.5 text-rose-300">
                {formatTimestamp(licenseState.trialExpiresAt)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500">Machine ID</div>
              <div className="mt-0.5 text-zinc-300">{licenseState.machineId}</div>
            </div>
          </div>

          <div className="mt-4 rounded border border-emerald-500/25 bg-emerald-500/10 p-4">
            <div className="text-sm font-semibold text-emerald-300">
              Need a license? It&apos;s free!
            </div>
            <p className="mt-1 text-xs text-emerald-100/80">
              Join our Discord community to get your free Surf Monitor license.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleJoinDiscord}
                className="flex items-center gap-1.5 rounded bg-[#5865F2] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4752c4]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Join Our Discord</span>
                <ExternalLink className="h-3 w-3 opacity-80" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('activate');
                }}
                className="flex items-center gap-1.5 rounded border border-white/[0.15] bg-[#09090b] px-3.5 py-2 text-xs font-semibold text-zinc-100 transition-colors hover:bg-white/[0.06]"
              >
                <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                <span>I Already Have a License</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-400">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#09090b] p-6 text-zinc-100">
      <div className="w-full max-w-2xl rounded-lg border border-white/[0.1] bg-[#101116] p-7 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <SurfLogoMark />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-zinc-100">
                  Surf Monitor
                </h1>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                  v4.1.0
                </span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500">
                Infrastructure, Website &amp; PM2 Observability Suite
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] text-zinc-500">
            Machine: {licenseState.machineId}
          </span>
        </div>

        {/* Step 1: Welcome Choice */}
        {step === 'welcome' && (
          <div className="mt-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Welcome to Surf Monitor
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                Start with a full-featured 7-day free trial or activate an existing license key immediately.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Option A: 7-Day Free Trial */}
              <div className="flex flex-col justify-between rounded-md border border-emerald-500/30 bg-[#09090b] p-5 transition-colors hover:border-emerald-500/50">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
                      Option A · 168 Hours
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-100">
                    Start Your 7-Day Free Trial
                  </h3>
                  <ul className="mt-3 space-y-1.5 text-xs text-zinc-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      Full access to every Surf Monitor feature.
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      No feature restrictions during the trial.
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      No payment required to start.
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      Trial automatically expires after seven days.
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleChooseFlow('trial')}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-emerald-600 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Option B: Enter License */}
              <div className="flex flex-col justify-between rounded-md border border-white/[0.1] bg-[#09090b] p-5 transition-colors hover:border-white/[0.2]">
                <div>
                  <div className="flex items-center gap-2 text-sky-400">
                    <KeyRound className="h-4 w-4" />
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
                      Option B · Licensed
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-100">
                    Already Have a License?
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                    Activate your SunLicense key right away without consuming your 7-day trial. Ideal for existing license holders and production workstations.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleChooseFlow('license')}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded border border-white/[0.14] bg-[#14161d] py-2.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  <KeyRound className="h-3.5 w-3.5 text-sky-400" />
                  <span>Enter License Key</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Profile Setup */}
        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="mt-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                What should we call you?
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                Personalize your Surf Monitor experience. You can change this later in Settings.
              </p>
            </div>

            <div>
              <label
                htmlFor="surf-username"
                className="mb-1.5 block font-mono text-[11px] text-zinc-400"
              >
                Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="surf-username"
                  type="text"
                  maxLength={32}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoFocus
                  className="w-full rounded border border-white/[0.12] bg-[#09090b] py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-400">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('welcome');
                }}
                className="flex items-center gap-1.5 rounded border border-white/[0.1] px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/[0.04]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Starting Trial...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: License Activation */}
        {step === 'activate' && (
          <form onSubmit={handleActivate} className="mt-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Activate Surf Monitor
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                Enter your SunLicense key to unlock Surf Monitor on this machine.
              </p>
            </div>

            {isRejectedLicense && (
              <div className="flex items-start gap-2.5 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
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
                  placeholder="Enter your license key"
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
                Share anonymous runtime diagnostics (OS, architecture, app version) with SunLicense. No hostnames, URLs, or personal data are sent.
              </span>
            </label>

            {error && (
              <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-400">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(isTrialExpired ? 'welcome' : 'welcome');
                }}
                className="flex items-center gap-1.5 rounded border border-white/[0.1] px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/[0.04]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validating with SunLicense...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Activate License</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
