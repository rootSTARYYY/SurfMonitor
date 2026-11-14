import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  badgeText?: string;
  badgeTone?: 'positive' | 'negative' | 'neutral';
}

const ICON_TONE: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'border-white/[0.12] text-zinc-300',
  success: 'border-emerald-500/30 text-emerald-400',
  warning: 'border-amber-500/30 text-amber-400',
  danger: 'border-rose-500/30 text-rose-400',
};

const BADGE_STYLES: Record<NonNullable<StatCardProps['badgeTone']>, string> = {
  positive: 'bg-emerald-500/15 text-emerald-400',
  negative: 'bg-rose-500/15 text-rose-400',
  neutral: 'bg-white/[0.08] text-zinc-400',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = 'default',
  badgeText,
  badgeTone = 'neutral',
}) => {
  return (
    <div className="flex items-center justify-between bg-[#09090b] p-4 transition-colors hover:bg-[#0e0f13]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">{label}</span>
          {badgeText && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] leading-none ${BADGE_STYLES[badgeTone]}`}
            >
              {badgeText}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold tracking-tight text-zinc-100">
            {value}
          </span>
          {sublabel && (
            <span className="font-mono text-[11px] text-zinc-500">
              {sublabel}
            </span>
          )}
        </div>
      </div>

      {/* Subtle corner-bracket icon box matching observability reference */}
      <div
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center border bg-[#101114] ${ICON_TONE[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
};
