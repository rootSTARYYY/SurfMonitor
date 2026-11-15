import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = '',
  style,
}) => (
  <div
    aria-hidden="true"
    className={`surf-skeleton ${className}`}
    style={style}
  />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 2,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, idx) => (
      <Skeleton
        key={idx}
        className={`h-3 ${idx === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <Skeleton className={size === 'sm' ? 'h-4 w-4 rounded-full' : 'h-8 w-8 rounded-full'} />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded border border-white/[0.08] bg-[#09090b] p-4 space-y-3 ${className}`}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-3.5 w-12" />
    </div>
    <Skeleton className="h-6 w-20" />
    <SkeletonText lines={2} />
  </div>
);

export const SkeletonChart: React.FC<{ heightClass?: string }> = ({
  heightClass = 'h-48',
}) => (
  <div className="rounded border border-white/[0.08] bg-[#09090b] p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2.5 w-56" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
    <Skeleton className={`w-full ${heightClass}`} />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="overflow-hidden rounded border border-white/[0.08] bg-[#09090b]">
    <div className="border-b border-white/[0.08] bg-[#101114] px-4 py-2.5 flex gap-4">
      {Array.from({ length: cols }).map((_, c) => (
        <Skeleton key={c} className="h-3 flex-1" />
      ))}
    </div>
    <div className="divide-y divide-white/[0.05]">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-3 flex-1 ${c === 0 ? 'max-w-[160px]' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonNavigation: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => (
  <aside
    data-collapsed={collapsed ? 'true' : 'false'}
    className={`flex h-full shrink-0 flex-col border-r border-white/[0.08] bg-[#09090b] ${
      collapsed ? 'w-16' : 'w-60'
    }`}
  >
    <div className="flex h-12 items-center justify-between border-b border-white/[0.08] px-3">
      {!collapsed && (
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}
      <Skeleton className="h-6 w-6" />
    </div>
    <div className="flex-1 space-y-5 p-3">
      {[6, 4, 3, 5].map((count, grpIdx) => (
        <div key={grpIdx} className="space-y-2">
          {!collapsed && <Skeleton className="h-2.5 w-20" />}
          <div className="space-y-1.5">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-1 py-1">
                <Skeleton className="h-4 w-4 shrink-0" />
                {!collapsed && <Skeleton className="h-3 flex-1" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="border-t border-white/[0.08] p-3">
      <Skeleton className="h-8 w-full" />
    </div>
  </aside>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <Skeleton className="h-7 w-44" />
    </div>

    {/* 5-Column KPI Strip Skeleton */}
    <div className="grid grid-cols-2 divide-y divide-white/[0.08] overflow-hidden rounded border border-white/[0.08] bg-[#09090b] sm:grid-cols-3 md:grid-cols-5 md:divide-x md:divide-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-3 space-y-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>

    {/* Chart + Infrastructure Summary */}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SkeletonChart heightClass="h-52" />
      </div>
      <SkeletonCard />
    </div>

    {/* Monitor Status Table */}
    <SkeletonTable rows={4} cols={5} />
  </div>
);

export const PageSkeleton: React.FC<{ cards?: number; rows?: number }> = ({
  cards = 3,
  rows = 5,
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-8 w-28" />
    </div>
    {cards > 0 && (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )}
    <SkeletonTable rows={rows} cols={4} />
  </div>
);

export const FileBrowserSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <SkeletonTable rows={rows} cols={4} />
);

export const TerminalLoadingState: React.FC<{ label?: string }> = ({
  label = 'Establishing interactive SSH PTY session...',
}) => (
  <div className="flex h-full min-h-[360px] flex-col justify-between rounded-md border border-white/[0.08] bg-[#060709] p-4 font-mono text-xs text-zinc-400">
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span>{label}</span>
      </div>
      <Skeleton className="h-3 w-64" />
      <Skeleton className="h-3 w-48" />
    </div>
    <Skeleton className="h-3 w-40" />
  </div>
);

export const DataStateBanner: React.FC<{
  mode: 'offline' | 'error' | 'empty';
  title: string;
  description: string;
  onRetry?: () => void;
}> = ({ mode, title, description, onRetry }) => (
  <div
    className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 ${
      mode === 'error'
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
        : mode === 'offline'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : 'border-white/[0.08] bg-[#09090b] text-zinc-300'
    }`}
  >
    <div className="flex items-start gap-2.5">
      {mode === 'offline' ? (
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      )}
      <div>
        <div className="text-xs font-semibold">{title}</div>
        <div className="mt-0.5 font-mono text-[11px] opacity-80">{description}</div>
      </div>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded border border-white/[0.12] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.06]"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    )}
  </div>
);
