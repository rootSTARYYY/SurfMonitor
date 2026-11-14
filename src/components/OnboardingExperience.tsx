import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Palette,
  Server,
  Sparkles,
  User,
} from 'lucide-react';
import { UserProfileState } from '@/types';

interface OnboardingExperienceProps {
  existingUsername: string | null;
  isReplay?: boolean;
  onComplete: (next: UserProfileState) => void;
}

const SLIDES = [
  {
    id: 'welcome',
    badge: '100% Free · Local-First',
    title: 'Welcome to Surf Monitor',
    description:
      'Your local-first desktop command center for websites, APIs, and remote Linux infrastructure. Completely free—no accounts, no trials, and no cloud lock-in.',
    highlights: [
      'All telemetry, logs, and credentials stay encrypted on your machine',
      'Built for speed with SQLite persistence and real-time charts',
      'Ready for Windows, macOS, and Linux workflows',
    ],
    icon: Sparkles,
    accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  },
  {
    id: 'monitoring',
    badge: 'Website & Protocol Telemetry',
    title: 'Infrastructure Monitoring',
    description:
      'Track HTTP/HTTPS endpoints, SSL certificates, DNS records, TCP ports, ICMP ping, and cron heartbeats with three-state health classification.',
    highlights: [
      'Distinguish network reachability from HTTP application health (UP / DEGRADED / DOWN)',
      'Track P50/P95 response times and multi-day availability history',
      'Organize monitors into Groups, Services, and Dependency Maps',
    ],
    icon: Activity,
    accent: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  },
  {
    id: 'agent',
    badge: 'SSH-Tunneled Linux Agent',
    title: 'Server Agent & PM2 Control',
    description:
      'Connect your Ubuntu/Debian VPS in one click over an authenticated localhost-only SSH tunnel—no public ports exposed.',
    highlights: [
      'Real-time CPU, RAM, disk, load average, and network throughput',
      'Multi-user PM2 discovery, CPU/memory graphs, and redacted log streaming',
      'Manage Docker containers and systemd services safely with audit logs',
    ],
    icon: Server,
    accent: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  },
  {
    id: 'alerts',
    badge: 'Instant Incident Alerts',
    title: 'Alerts & Notifications',
    description:
      'Get notified the moment an endpoint, server threshold, or PM2 process goes down—and again when it recovers.',
    highlights: [
      'Discord webhooks, Telegram bots, Custom Webhooks, and Windows Desktop alerts',
      'Full SMTP Email support with Brevo, Gmail, Outlook, and Custom presets',
      'Cooldown deduplication and Maintenance Windows to silence planned restarts',
    ],
    icon: Bell,
    accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  },
  {
    id: 'customization',
    badge: 'Theme Studio',
    title: 'Customization & Settings',
    description:
      'Make Surf Monitor look exactly the way you want with unlimited custom themes, live previews, and a safe Custom CSS layer.',
    highlights: [
      'Customize global colors, status badges, typography, layout density, and radii',
      'Import and export shareable surf-theme.json files anytime',
      'Switch seamlessly between dark, midnight, OLED, or custom light themes',
    ],
    icon: Palette,
    accent: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
  },
];

export const OnboardingExperience: React.FC<OnboardingExperienceProps> = ({
  existingUsername,
  isReplay = false,
  onComplete,
}) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const [step, setStep] = useState<'slides' | 'username'>('slides');
  const [username, setUsername] = useState(existingUsername ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentSlide = SLIDES[slideIdx];
  const SlideIcon = currentSlide.icon;
  const isLastSlide = slideIdx === SLIDES.length - 1;

  const finishSlides = async () => {
    // If replaying from Settings and username already exists, return immediately
    if (isReplay && existingUsername && existingUsername.trim().length >= 2) {
      onComplete({ username: existingUsername, onboardingCompleted: true });
      return;
    }
    setStep('username');
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

  const previewGreeting =
    username.replace(/[<>&"'`]/g, '').trim() || 'Moss';

  return (
    <div className="surf-app-shell flex h-screen w-screen items-center justify-center bg-[#09090b] p-6 text-zinc-100">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-white/[0.1] bg-[#101116] p-7 shadow-2xl transition-all duration-300">
        {step === 'slides' ? (
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-zinc-200">
                  Surf Monitor
                </span>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                  v4.2.0
                </span>
              </div>
              <button
                type="button"
                onClick={() => void finishSlides()}
                className="rounded border border-white/[0.1] px-2.5 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-100"
              >
                Skip Introduction
              </button>
            </div>

            {/* Slide Content */}
            <div key={currentSlide.id} className="space-y-4 py-2 transition-opacity duration-200">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${currentSlide.accent}`}
                >
                  <SlideIcon className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    {currentSlide.badge}
                  </span>
                  <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
                    {currentSlide.title}
                  </h1>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-zinc-300">
                {currentSlide.description}
              </p>

              <ul className="space-y-2 rounded border border-white/[0.08] bg-[#09090b] p-4">
                {currentSlide.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-xs text-zinc-300">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress & Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              <div className="flex items-center gap-2">
                {SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Go to slide ${idx + 1}`}
                    onClick={() => setSlideIdx(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === slideIdx
                        ? 'w-6 bg-emerald-500'
                        : 'w-2 bg-white/[0.15] hover:bg-white/[0.3]'
                    }`}
                  />
                ))}
                <span className="ml-2 font-mono text-[11px] text-zinc-500">
                  {slideIdx + 1} / {SLIDES.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {slideIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                    className="flex items-center gap-1.5 rounded border border-white/[0.1] px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/[0.05]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                )}
                {!isLastSlide ? (
                  <button
                    type="button"
                    onClick={() => setSlideIdx((i) => Math.min(SLIDES.length - 1, i + 1))}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void finishSlides()}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUsernameSubmit} className="space-y-5">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                Personalize Your Workspace
              </span>
              <h1 className="mt-1 text-xl font-semibold text-zinc-100">
                Before we get started, what should we call you?
              </h1>
              <p className="mt-1 text-xs text-zinc-400">
                This stays 100% local on your device. You can change it anytime in Settings.
              </p>
            </div>

            <div>
              <label
                htmlFor="onboarding-username"
                className="mb-1.5 block font-mono text-[11px] text-zinc-400"
              >
                Your Name or Handle
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="onboarding-username"
                  type="text"
                  maxLength={32}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name (e.g. Moss)"
                  autoFocus
                  className="w-full rounded border border-white/[0.12] bg-[#09090b] py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none"
                />
              </div>
            </div>

            {/* Live Greeting Preview */}
            <div className="flex items-center justify-between rounded border border-white/[0.08] bg-[#09090b] px-4 py-3">
              <span className="font-mono text-[11px] text-zinc-500">
                Toolbar Greeting Preview
              </span>
              <span className="inline-flex items-center gap-2 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1 text-xs font-medium text-zinc-100">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-[9px] font-bold text-emerald-300">
                  {previewGreeting[0].toUpperCase()}
                </span>
                Hello, {previewGreeting}!
              </span>
            </div>

            {error && (
              <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-400">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
              <button
                type="button"
                onClick={() => setStep('slides')}
                className="flex items-center gap-1.5 rounded border border-white/[0.1] px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/[0.05]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <span>{saving ? 'Saving...' : 'Continue'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
