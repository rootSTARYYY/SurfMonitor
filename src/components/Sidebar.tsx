import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  Bot,
  Box,
  ChevronUp,
  Cpu,
  FolderOpen,
  Globe,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Search,
  Server,
  Settings,
  Star,
  Terminal,
  X,
} from 'lucide-react';
import { PageId } from '@/types';
import {
  ALL_NAV_ITEMS,
  DEFAULT_SIDEBAR_LAYOUT,
  SidebarLayoutConfig,
} from '@/utils/sidebarConfig';

export interface DegradedSystemItem {
  id: string;
  kind: 'monitor' | 'server';
  name: string;
  status: string;
  detail?: string | null;
}

interface SidebarProps {
  activePage: PageId;
  activeIncidentCount: number;
  monitorCount: number;
  serverCount: number;
  pm2Count?: number;
  degradedItems?: DegradedSystemItem[];
  collapsed: boolean;
  layoutConfig?: SidebarLayoutConfig;
  recentPages?: PageId[];
  onToggleCollapse: () => void;
  onNavigate: (page: PageId) => void;
  onOpenQuickSwitcher?: () => void;
  onRemoveRecent?: (page: PageId) => void;
  onSelectDegradedItem?: (item: DegradedSystemItem) => void;
}

interface PrimaryNavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeTone?: 'neutral' | 'danger';
}

const SurfLogoMark: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <rect width="64" height="64" rx="12" fill="#09090b" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
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

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  activeIncidentCount,
  monitorCount,
  serverCount,
  pm2Count = 0,
  degradedItems = [],
  collapsed,
  layoutConfig = DEFAULT_SIDEBAR_LAYOUT,
  recentPages = [],
  onToggleCollapse,
  onNavigate,
  onOpenQuickSwitcher,
  onRemoveRecent,
  onSelectDegradedItem,
}) => {
  const [statusExpanded, setStatusExpanded] = useState(false);

  const hiddenSet = new Set(layoutConfig.hiddenItemIds);

  const groups: Array<{ title: string; items: PrimaryNavItem[] }> = [
    {
      title: 'MONITORING',
      items: [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'monitors', label: 'Monitors', icon: Globe, badge: monitorCount, badgeTone: 'neutral' },
        {
          id: 'incidents',
          label: 'Incidents',
          icon: AlertTriangle,
          badge: activeIncidentCount,
          badgeTone: activeIncidentCount > 0 ? 'danger' : 'neutral',
        },
        { id: 'notifications', label: 'Notifications', icon: Bell },
      ],
    },
    {
      title: 'INFRASTRUCTURE',
      items: [
        { id: 'servers', label: 'Servers', icon: Server, badge: serverCount, badgeTone: 'neutral' },
        { id: 'agent', label: 'Fleet & Agent', icon: Bot },
        {
          id: 'pm2',
          label: 'PM2 Processes',
          icon: Cpu,
          badge: pm2Count > 0 ? pm2Count : undefined,
          badgeTone: 'neutral',
        },
        { id: 'containers', label: 'Docker Containers', icon: Box },
      ],
    },
    {
      title: 'OPERATIONS & DEPLOY',
      items: [
        { id: 'terminal', label: 'SSH Terminal', icon: Terminal },
        { id: 'sftp', label: 'SFTP Files', icon: FolderOpen },
        { id: 'installer', label: 'Installation Center', icon: Rocket },
        { id: 'backups', label: 'Backup Center', icon: Archive },
      ],
    },
  ];

  const pinnedItems = (layoutConfig.pinnedItemIds ?? [])
    .filter((id) => !hiddenSet.has(id))
    .map((id) => ALL_NAV_ITEMS.find((m) => m.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const visibleRecent = (recentPages ?? [])
    .filter((id) => id !== activePage && !hiddenSet.has(id))
    .slice(0, 3)
    .map((id) => ALL_NAV_ITEMS.find((m) => m.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const issueCount = degradedItems.length;
  const allOperational = issueCount === 0;

  return (
    <aside
      data-collapsed={collapsed ? 'true' : 'false'}
      className={`flex h-full shrink-0 flex-col border-r border-white/[0.08] bg-[#09090b] transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-12 items-center justify-between border-b border-white/[0.08] px-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <SurfLogoMark className="h-6 w-6 shrink-0" />
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-100">
              Surf Monitor
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`flex h-7 w-7 items-center justify-center rounded border border-transparent text-zinc-400 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-zinc-200 ${
            collapsed ? 'mx-auto' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Quick Switcher Trigger (Ctrl+K) */}
      <div className="px-2.5 pt-2.5">
        <button
          type="button"
          onClick={() => onOpenQuickSwitcher?.()}
          title="Quick Switcher (Ctrl + K)"
          className={`flex w-full items-center rounded border border-white/[0.08] bg-[#101114] py-1.5 font-mono text-xs text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-200 ${
            collapsed ? 'justify-center px-0' : 'justify-between px-2.5'
          }`}
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Quick Jump...</span>}
          </span>
          {!collapsed && (
            <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">
              Ctrl K
            </kbd>
          )}
        </button>
      </div>

      {/* Primary Everyday Destinations */}
      <div className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
        {groups.map((grp) => {
          const visibleItems = grp.items.filter((it) => !hiddenSet.has(it.id));
          if (visibleItems.length === 0) return null;
          return (
            <div key={grp.title}>
              {!collapsed && (
                <div className="mb-1 px-2 font-mono text-[10px] font-semibold tracking-wider text-zinc-500">
                  {grp.title}
                </div>
              )}
              <nav className="space-y-0.5" aria-label={grp.title}>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    activePage === item.id ||
                    (item.id === 'pm2' && activePage === 'pm2-detail') ||
                    (item.id === 'servers' && activePage === 'server-detail') ||
                    (item.id === 'monitors' && activePage === 'monitor-detail');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-tour={`nav-${item.id}`}
                      onClick={() => onNavigate(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`group flex w-full items-center rounded py-1.5 text-[13px] font-medium transition-colors ${
                        collapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                      } ${
                        isActive
                          ? 'bg-white/[0.07] text-zinc-100'
                          : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </span>

                      {!collapsed && typeof item.badge === 'number' && (
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                            item.badgeTone === 'danger'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-white/[0.06] text-zinc-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          );
        })}

        {/* Optional Pinned Pages */}
        {!collapsed && layoutConfig.showPinned !== false && pinnedItems.length > 0 && (
          <div className="space-y-0.5 border-t border-white/[0.06] pt-2.5">
            <div className="mb-1 px-2 font-mono text-[10px] font-semibold tracking-wider text-emerald-400/80">
              PINNED
            </div>
            {pinnedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex w-full items-center gap-2 rounded px-2.5 py-1 text-xs transition-colors ${
                  activePage === item.id
                    ? 'bg-white/[0.07] text-zinc-100'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <Star className="h-3 w-3 shrink-0 text-emerald-400" fill="currentColor" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Optional Recent Pages (max 3) */}
        {!collapsed && layoutConfig.showRecent !== false && visibleRecent.length > 0 && (
          <div className="space-y-0.5 border-t border-white/[0.06] pt-2.5">
            <div className="mb-1 px-2 font-mono text-[10px] font-semibold tracking-wider text-zinc-500">
              RECENT
            </div>
            {visibleRecent.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between rounded px-2.5 py-1 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              >
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="flex flex-1 items-center gap-2 truncate text-left"
                >
                  <Activity className="h-3 w-3 shrink-0 text-zinc-600" />
                  <span className="truncate">{item.label}</span>
                </button>
                {onRemoveRecent && (
                  <button
                    type="button"
                    onClick={() => onRemoveRecent(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200"
                    title="Remove from recent"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Settings Anchor */}
      <div className="border-t border-white/[0.06] px-2.5 py-2">
        <button
          type="button"
          data-tour="nav-settings"
          onClick={() => onNavigate('settings')}
          title={collapsed ? 'Settings' : undefined}
          className={`flex w-full items-center rounded py-1.5 text-[13px] font-medium transition-colors ${
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
          } ${
            activePage === 'settings'
              ? 'bg-white/[0.08] text-zinc-100'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
        >
          <Settings className={`h-4 w-4 shrink-0 ${activePage === 'settings' ? 'text-emerald-400' : 'text-zinc-500'}`} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>

      {/* Expandable System Status Footer */}
      {!collapsed && (
        <div className="relative border-t border-white/[0.08] p-2.5">
          <div
            className={`overflow-hidden transition-all duration-300 ease-out origin-bottom ${
              statusExpanded
                ? 'mb-2 max-h-56 opacity-100 translate-y-0'
                : 'max-h-0 opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            <div className="rounded border border-white/[0.1] bg-[#101115] p-2">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  {allOperational ? 'System Health' : 'Degraded / Down Services'}
                </span>
                <span className="font-mono text-[10px] text-zinc-600">v6.0.0</span>
              </div>
              {allOperational ? (
                <p className="px-1 py-1.5 font-mono text-[11px] text-emerald-400">
                  All monitored endpoints and servers are healthy.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
                  {degradedItems.map((item) => (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => {
                        setStatusExpanded(false);
                        onSelectDegradedItem?.(item);
                      }}
                      className="flex w-full items-center justify-between rounded border border-white/[0.06] bg-[#09090b] px-2 py-1.5 text-left transition-colors hover:border-white/[0.16]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate text-[11px] font-medium text-zinc-200">{item.name}</div>
                        {item.detail && (
                          <div className="truncate font-mono text-[10px] text-zinc-500">{item.detail}</div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                          item.status === 'DOWN' || item.status === 'error'
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStatusExpanded((e) => !e)}
            className="flex w-full items-center justify-between rounded border border-white/[0.06] bg-[#101114] px-2.5 py-1.5 text-left transition-colors hover:border-white/[0.14]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  allOperational ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                }`}
              />
              <span
                className={`truncate font-mono text-[11px] ${
                  allOperational ? 'text-zinc-300' : 'text-rose-300'
                }`}
              >
                {allOperational
                  ? 'All Systems Operational'
                  : `${issueCount} Service${issueCount === 1 ? '' : 's'} Down / Degraded`}
              </span>
            </div>
            <ChevronUp
              className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${
                statusExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      )}
    </aside>
  );
};
