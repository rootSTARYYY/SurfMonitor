import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { UserProfileState } from '@/types';

interface OnboardingExperienceProps {
  existingUsername: string | null;
  isReplay?: boolean;
  onComplete: (next: UserProfileState) => void;
}

interface TourStep {
  id: string;
  targetSelector: string | null;
  placement: 'center' | 'right' | 'bottom' | 'left';
  badge: string;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    targetSelector: null,
    placement: 'center',
    badge: '100% Free · Local-First · v6.0.0',
    title: 'Welcome to Surf Monitor',
    description:
      'Let’s take a quick 30-second tour of your live dashboard. Surf Monitor runs locally on your machine with SQLite persistence—no accounts, no trials, and no cloud lock-in.',
  },
  {
    id: 'overview',
    targetSelector: '[data-tour="overview-kpis"]',
    placement: 'bottom',
    badge: 'Live Telemetry',
    title: 'Infrastructure Overview',
    description:
      'See total monitors, healthy endpoints, active issues, overall availability, and P95 latency at a glance.',
  },
  {
    id: 'monitors',
    targetSelector: '[data-tour="nav-monitors"]',
    placement: 'right',
    badge: 'Website & Protocol Checks',
    title: 'Monitors & Protocols',
    description:
      'Track HTTP/HTTPS, SSL certificates, DNS records, TCP ports, ICMP ping, and cron heartbeats with UP / DEGRADED / DOWN states.',
  },
  {
    id: 'servers',
    targetSelector: '[data-tour="nav-servers"]',
    placement: 'right',
    badge: 'SSH-Tunneled Agent',
    title: 'Remote Servers, Docker & PM2',
    description:
      'Connect Linux VPS hosts over SSH to monitor CPU, RAM, disk, Docker containers, systemd services, and multi-user PM2 processes.',
  },
  {
    id: 'notifications',
    targetSelector: '[data-tour="nav-notifications"]',
    placement: 'right',
    badge: 'Instant Alerts',
    title: 'Alerts & Notifications',
    description:
      'Receive outage and recovery alerts via Discord, Telegram, SMTP Email (Brevo, Gmail, Outlook, Custom), Webhooks, or Windows Desktop.',
  },
  {
    id: 'settings',
    targetSelector: '[data-tour="nav-settings"]',
    placement: 'right',
    badge: 'Theme Studio',
    title: 'Customization & Settings',
    description:
      'Open Theme Studio under Settings → Appearance to customize every color, font, layout, background, and custom CSS—dark or light.',
  },
  {
    id: 'add-monitor',
    targetSelector: '[data-tour="header-add-monitor"]',
    placement: 'bottom',
    badge: 'Quick Action',
    title: 'Add Your First Monitor',
    description:
      'Click here anytime to add a website, API, TCP port, or heartbeat monitor in seconds.',
  },
];

export const OnboardingExperience: React.FC<OnboardingExperienceProps> = ({
  existingUsername,
  isReplay = false,
  onComplete,
}) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<'tour' | 'username'>('tour');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [username, setUsername] = useState(existingUsername ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const current = TOUR_STEPS[stepIdx];

  const measureTarget = useCallback(() => {
    if (phase !== 'tour' || !current.targetSelector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(current.targetSelector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [phase, current.targetSelector]);

  useEffect(() => {
    measureTarget();
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [measureTarget]);

  const finishTour = () => {
    if (isReplay && existingUsername && existingUsername.trim().length >= 2) {
      onComplete({ username: existingUsername, onboardingCompleted: true });
      return;
    }
    setPhase('username');
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = username.replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) {
      setError('Please enter a name with at least 2 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (window.surfMonitorAPI) {
        const next = await window.surfMonitorAPI.completeOnboarding(cleaned);
        onComplete(next);
      } else {
        onComplete({ username: cleaned, onboardingCompleted: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save username.');
    } finally {
      setSaving(false);
    }
  };

  const previewGreeting = username.replace(/[<>&"'`]/g, '').trim() || 'Moss';

  if (typeof document === 'undefined') return null;

  // Compute tooltip card coordinates anchored near the spotlighted element
  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10001,
  };
  let arrowDir: 'left' | 'top' | 'none' = 'none';

  if (phase === 'tour' && rect) {
    if (current.placement === 'right') {
      cardStyle = {
        position: 'fixed',
        top: `${Math.min(window.innerHeight - 250, Math.max(16, rect.top - 16))}px`,
        left: `${Math.min(window.innerWidth - 380, rect.right + 16)}px`,
        zIndex: 10001,
      };
      arrowDir = 'left';
    } else if (current.placement === 'bottom') {
      cardStyle = {
        position: 'fixed',
        top: `${Math.min(window.innerHeight - 240, rect.bottom + 14)}px`,
        left: `${Math.min(
          window.innerWidth - 380,
          Math.max(16, rect.left + rect.width / 2 - 180)
        )}px`,
        zIndex: 10001,
      };
      arrowDir = 'top';
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      {/* Spotlight Cutout or Full Backdrop */}
      {phase === 'tour' && rect ? (
        <div
          style={{
            position: 'fixed',
            top: `${rect.top - 5}px`,
            left: `${rect.left - 5}px`,
            width: `${rect.width + 10}px`,
            height: `${rect.height + 10}px`,
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
            border: '2px solid #10b981',
            pointerEvents: 'none',
            transition: 'all 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            zIndex: 10000,
          }}
        />
      ) : (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
          }}
        />
      )}

      {phase === 'tour' ? (
        <div
          style={cardStyle}
          className="w-[360px] max-w-[calc(100vw-24px)] rounded-lg border border-emerald-500/35 bg-[#111216] p-5 text-zinc-100 shadow-2xl transition-all duration-200"
        >
          {arrowDir === 'left' && (
            <div className="absolute -left-2 top-6 h-3.5 w-3.5 rotate-45 border-b border-l border-emerald-500/35 bg-[#111216]" />
          )}
          {arrowDir === 'top' && (
            <div className="absolute -top-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-l border-t border-emerald-500/35 bg-[#111216]" />
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
              <Sparkles className="h-3 w-3" />
              {current.badge}
            </span>
            <button
              type="button"
              onClick={finishTour}
              className="flex items-center gap-1 font-mono text-[11px] text-zinc-400 hover:text-zinc-100"
            >
              Skip
              <X className="h-3 w-3" />
            </button>
          </div>

          <h2 className="mt-3 text-base font-semibold text-zinc-100">
            {current.title}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
            {current.description}
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Step ${i + 1}`}
                  onClick={() => setStepIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIdx ? 'w-5 bg-emerald-500' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
              <span className="ml-1.5 font-mono text-[10px] text-zinc-500">
                {stepIdx + 1}/{TOUR_STEPS.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {stepIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  className="flex items-center gap-1 rounded border border-white/[0.1] px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/[0.05]"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Prev
                </button>
              )}
              {stepIdx < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
                  className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Next
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finishTour}
                  className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Get Started
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleUsernameSubmit}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10001,
          }}
          className="w-full max-w-md rounded-lg border border-white/[0.12] bg-[#111216] p-6 text-zinc-100 shadow-2xl"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            Personalize Your Workspace
          </span>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">
            Before we get started, what should we call you?
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Stored locally on your machine. You can change this anytime in Settings.
          </p>

          <div className="relative mt-4">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name (e.g. Moss)"
              autoFocus
              className="w-full rounded border border-white/[0.12] bg-[#09090b] py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none"
            />
          </div>

          <div className="mt-3 flex items-center justify-between rounded border border-white/[0.08] bg-[#09090b] px-3 py-2">
            <span className="font-mono text-[11px] text-zinc-500">Preview</span>
            <span className="font-mono text-xs font-semibold text-emerald-400">
              Hello, {previewGreeting}!
            </span>
          </div>

          {error && (
            <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-400">
              {error}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPhase('tour')}
              className="flex items-center gap-1 rounded border border-white/[0.1] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.05]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Tour
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <span>{saving ? 'Saving...' : 'Continue'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>,
    document.body
  );
};
