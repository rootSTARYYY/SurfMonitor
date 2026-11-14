import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  CalendarClock,
  ChevronUp,
  Cpu,
  FolderKanban,
  GitFork,
  Globe,
  HeartPulse,
  Layers,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  SearchCheck,
  Server,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { PageId } from '@/types';

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
  onToggleCollapse: () => void;
  onNavigate: (page: PageId) => void;
  onSelectDegradedItem?: (item: DegradedSystemItem) => void;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeTone?: 'neutral' | 'danger';
}

const SurfLogoMark: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
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
  onToggleCollapse,
  onNavigate,
  onSelectDegradedItem,
}) => {
  const [statusExpanded, setStatusExpanded] = useState(false);

  const sections: Array<{ title: string; items: NavItem[] }> = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        {
          id: 'monitors',
          label: 'Monitors',
          icon: Globe,
          badge: monitorCount,
          badgeTone: 'neutral',
        },
        { id: 'groups', label: 'Monitor Groups', icon: FolderKanban },
        { id: 'services', label: 'Services', icon: Layers },
        { id: 'dependency-map', label: 'Dependency Map', icon: GitFork },
        {
          id: 'incidents',
          label: 'Incidents',
          icon: AlertTriangle,
          badge: activeIncidentCount,
          badgeTone: activeIncidentCount > 0 ? 'danger' : 'neutral',
        },
      ],
    },
    {
      title: 'INFRASTRUCTURE',
      items: [
        {
          id: 'servers',
          label: 'Servers',
          icon: Server,
          badge: serverCount,
          badgeTone: 'neutral',
        },
        { id: 'containers', label: 'Docker Containers', icon: Box },
        {
          id: 'pm2',
          label: 'PM2 Processes',
          icon: Cpu,
          badge: pm2Count > 0 ? pm2Count : undefined,
          badgeTone: 'neutral',
        },
      ],
    },
    {
      title: 'MONITORING',
      items: [
        { id: 'ssl', label: 'SSL Certificates', icon: ShieldCheck },
        { id: 'dns', label: 'DNS Records', icon: Globe },
        { id: 'network', label: 'TCP / Network', icon: Network },
        { id: 'heartbeats', label: 'Heartbeats', icon: HeartPulse },
        {
          id: 'intelligence',
          label: 'Website Intelligence',
          icon: SearchCheck,
        },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'maintenance', label: 'Maintenance', icon: CalendarClock },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const issueCount = degradedItems.length;
  const allOperational = issueCount === 0;

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-white/[0.08] bg-[#09090b] transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
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
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="mb-1.5 px-2 font-mono text-[10px] font-semibold tracking-wider text-zinc-500">
                {section.title}
              </div>
            )}
            <nav className="space-y-0.5" aria-label={section.title}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activePage === item.id ||
                  (item.id === 'pm2' && activePage === 'pm2-detail');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`group flex w-full items-center justify-between rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-white/[0.07] text-zinc-100'
                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-emerald-400'
                            : 'text-zinc-500 group-hover:text-zinc-300'
                        }`}
                      />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
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
        ))}
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
                <span className="font-mono text-[10px] text-zinc-600">v4.2.0</span>
              </div>
              {allOperational ? (
                <p className="px-1 py-1.5 font-mono text-[11px] text-emerald-400">
                  All monitored endpoints and servers are healthy.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
                  {degradedItems.map((item) => (
                    <button
                      key={`${item.kind}:${item.id}`}
                      type="button"
                      onClick={() => {
                        onSelectDegradedItem?.(item);
                        setStatusExpanded(false);
                      }}
                      className="flex w-full items-center justify-between rounded border border-white/[0.06] bg-[#09090b] px-2 py-1.5 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate text-[11px] font-medium text-zinc-200">
                          {item.name}
                        </div>
                        <div className="truncate font-mono text-[10px] text-zinc-500">
                          {item.kind === 'server' ? 'Server' : 'Monitor'}
                          {item.detail ? ` • ${item.detail}` : ''}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                          item.status === 'DOWN' || item.status === 'error'
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/15 text-amber-400'
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
            onClick={() => setStatusExpanded((v) => !v)}
            className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left transition-colors ${
              allOperational
                ? 'border-white/[0.08] bg-[#101115] hover:border-emerald-500/30'
                : 'border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 font-mono text-[11px]">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  allOperational ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                }`}
              />
              <span
                className={`truncate ${
                  allOperational ? 'text-zinc-200' : 'text-amber-200'
                }`}
              >
                {allOperational
                  ? 'All Systems Operational'
                  : `${issueCount} Services Down / Degraded`}
              </span>
            </span>
            <ChevronUp
              className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${
                statusExpanded ? 'rotate-180 text-zinc-300' : ''
              }`}
            />
          </button>
        </div>
      )}
    </aside>
  );
};
