import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Server,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { NotificationItem, UserProfileState } from '@/types';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface HeaderUserStats {
  totalMonitors: number;
  operationalMonitors: number;
  issueMonitors: number;
  activeServers: number;
  totalServers: number;
  totalPm2Processes: number;
  appVersion: string;
}

interface HeaderProps {
  breadcrumbs: BreadcrumbItem[];
  searchQuery: string;
  onSearchSubmit: (query: string) => void;
  onOpenAddMonitor: () => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  userProfile?: UserProfileState | null;
  userStats?: HeaderUserStats;
  onOpenProfileSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs,
  searchQuery,
  onSearchSubmit,
  onOpenAddMonitor,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  userProfile,
  userStats,
  onOpenProfileSettings,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [profilePos, setProfilePos] = useState<{ top: number; right: number }>({
    top: 52,
    right: 16,
  });
  const [notifPos, setNotifPos] = useState<{ top: number; right: number }>({
    top: 52,
    right: 16,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifButtonRef = useRef<HTMLButtonElement>(null);
  const notifPopoverRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profilePopoverRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const updatePositions = useCallback(() => {
    if (profileButtonRef.current) {
      const r = profileButtonRef.current.getBoundingClientRect();
      setProfilePos({
        top: r.bottom + 8,
        right: Math.max(12, window.innerWidth - r.right),
      });
    }
    if (notifButtonRef.current) {
      const r = notifButtonRef.current.getBoundingClientRect();
      setNotifPos({
        top: r.bottom + 8,
        right: Math.max(12, window.innerWidth - r.right),
      });
    }
  }, []);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!profileOpen && !notifOpen) return;
    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);
    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
    };
  }, [profileOpen, notifOpen, updatePositions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        notifOpen &&
        notifButtonRef.current &&
        !notifButtonRef.current.contains(target) &&
        (!notifPopoverRef.current || !notifPopoverRef.current.contains(target))
      ) {
        setNotifOpen(false);
      }
      if (
        profileOpen &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(target) &&
        (!profilePopoverRef.current || !profilePopoverRef.current.contains(target))
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen, profileOpen]);

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(localQuery);
  };

  const displayName = userProfile?.username || 'User';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasIssues = (userStats?.issueMonitors ?? 0) > 0;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#09090b] px-5">
      {/* Left: Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={`${crumb.label}-${idx}`}>
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              )}
              {crumb.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="truncate text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={`truncate ${
                    isLast ? 'font-medium text-zinc-100' : 'text-zinc-400'
                  }`}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Right: Search, Personalized Greeting, Notifications, Add Monitor */}
      <div className="flex items-center gap-2">
        {searchOpen ? (
          <form
            onSubmit={handleSearchFormSubmit}
            className="flex items-center gap-1.5 rounded border border-white/[0.12] bg-[#111216] px-2 py-1"
          >
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={localQuery}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                onSearchSubmit(e.target.value);
              }}
              placeholder="Search monitors..."
              className="w-36 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setLocalQuery('');
                onSearchSubmit('');
                setSearchOpen(false);
              }}
              className="text-zinc-500 hover:text-zinc-200"
              aria-label="Close search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2.5 text-xs text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-200"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
          </button>
        )}

        {/* Personalized Greeting Trigger */}
        <button
          ref={profileButtonRef}
          type="button"
          onClick={() => {
            setNotifOpen(false);
            setProfileOpen((o) => !o);
          }}
          className="flex h-7 max-w-[190px] items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2 text-xs text-zinc-200 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
          title={`Hello, ${displayName}!`}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-[9px] font-bold text-emerald-300">
            {initials || 'U'}
          </span>
          <span className="truncate font-medium">Hello, {displayName}!</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" />
        </button>

        {/* Notification Bell Trigger */}
        <button
          ref={notifButtonRef}
          type="button"
          onClick={() => {
            setProfileOpen(false);
            setNotifOpen((o) => !o);
          }}
          className="relative flex h-7 w-7 items-center justify-center rounded border border-white/[0.08] bg-[#101114] text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-200"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[9px] font-bold text-black">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Add Monitor CTA */}
        <button
          type="button"
          data-tour="header-add-monitor"
          onClick={onOpenAddMonitor}
          className="flex h-7 items-center gap-1.5 rounded bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Monitor</span>
        </button>
      </div>

      {/* Portal: Infrastructure Overview Popover (never clipped by header/main stacking contexts) */}
      {profileOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={profilePopoverRef}
            style={{
              position: 'fixed',
              top: `${profilePos.top}px`,
              right: `${profilePos.right}px`,
              zIndex: 9999,
              backgroundColor: 'var(--surf-modal-bg, #111216)',
              borderColor: 'var(--surf-border, rgba(255,255,255,0.12))',
              color: 'var(--surf-text-primary, #f4f4f5)',
            }}
            className="w-80 overflow-hidden rounded-md border shadow-2xl"
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: 'var(--surf-divider, rgba(255,255,255,0.08))' }}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 font-mono text-xs font-bold text-emerald-300">
                  {initials || 'U'}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">
                    {displayName}
                  </div>
                  <div
                    className="font-mono text-[10px]"
                    style={{ color: 'var(--surf-text-muted, #71717a)' }}
                  >
                    Local Workspace · v{userStats?.appVersion ?? '6.0.0'}
                  </div>
                </div>
              </div>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                  hasIssues
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                }`}
              >
                {hasIssues ? `${userStats?.issueMonitors} Issues` : 'Operational'}
              </span>
            </div>

            {userStats && (
              <div
                className="border-b px-4 py-3"
                style={{ borderColor: 'var(--surf-divider, rgba(255,255,255,0.08))' }}
              >
                <div
                  className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider"
                  style={{ color: 'var(--surf-text-muted, #71717a)' }}
                >
                  <Activity className="h-3 w-3 text-emerald-400" />
                  Infrastructure Summary
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div
                    className="rounded border p-2"
                    style={{
                      backgroundColor: 'var(--surf-elevated-bg, #09090b)',
                      borderColor: 'var(--surf-border, rgba(255,255,255,0.06))',
                    }}
                  >
                    <div
                      className="text-[10px]"
                      style={{ color: 'var(--surf-text-muted, #71717a)' }}
                    >
                      Total Monitors
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">
                      {userStats.totalMonitors}
                    </div>
                  </div>
                  <div
                    className="rounded border p-2"
                    style={{
                      backgroundColor: 'var(--surf-elevated-bg, #09090b)',
                      borderColor: 'var(--surf-border, rgba(255,255,255,0.06))',
                    }}
                  >
                    <div
                      className="text-[10px]"
                      style={{ color: 'var(--surf-text-muted, #71717a)' }}
                    >
                      Operational
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-emerald-400">
                      {userStats.operationalMonitors}
                    </div>
                  </div>
                  <div
                    className="rounded border p-2"
                    style={{
                      backgroundColor: 'var(--surf-elevated-bg, #09090b)',
                      borderColor: 'var(--surf-border, rgba(255,255,255,0.06))',
                    }}
                  >
                    <div
                      className="text-[10px]"
                      style={{ color: 'var(--surf-text-muted, #71717a)' }}
                    >
                      Experiencing Issues
                    </div>
                    <div
                      className={`mt-0.5 text-sm font-semibold ${
                        userStats.issueMonitors > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {userStats.issueMonitors}
                    </div>
                  </div>
                  <div
                    className="rounded border p-2"
                    style={{
                      backgroundColor: 'var(--surf-elevated-bg, #09090b)',
                      borderColor: 'var(--surf-border, rgba(255,255,255,0.06))',
                    }}
                  >
                    <div
                      className="flex items-center gap-1 text-[10px]"
                      style={{ color: 'var(--surf-text-muted, #71717a)' }}
                    >
                      <Server className="h-2.5 w-2.5" />
                      Server Agents / PM2
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">
                      {userStats.activeServers}/{userStats.totalServers}{' '}
                      <span
                        className="text-[10px] font-normal"
                        style={{ color: 'var(--surf-text-muted, #71717a)' }}
                      >
                        ({userStats.totalPm2Processes} PM2)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {onOpenProfileSettings && (
              <div className="p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenProfileSettings();
                  }}
                  style={{
                    backgroundColor: 'var(--surf-elevated-bg, #09090b)',
                    borderColor: 'var(--surf-border, rgba(255,255,255,0.1))',
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded border py-1.5 font-mono text-xs hover:opacity-90"
                >
                  <SettingsIcon className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Profile &amp; Personalization</span>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Portal: Notifications Popover */}
      {notifOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={notifPopoverRef}
            style={{
              position: 'fixed',
              top: `${notifPos.top}px`,
              right: `${notifPos.right}px`,
              zIndex: 9999,
              backgroundColor: 'var(--surf-modal-bg, #111216)',
              borderColor: 'var(--surf-border, rgba(255,255,255,0.1))',
              color: 'var(--surf-text-primary, #f4f4f5)',
            }}
            className="w-80 overflow-hidden rounded border shadow-2xl"
          >
            <div
              className="flex items-center justify-between border-b px-3 py-2.5"
              style={{ borderColor: 'var(--surf-divider, rgba(255,255,255,0.08))' }}
            >
              <span className="text-xs font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllNotificationsRead}
                  className="flex items-center gap-1 font-mono text-[10px] text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 divide-y divide-white/[0.06] overflow-y-auto">
              {notifications.length === 0 ? (
                <div
                  className="px-4 py-8 text-center font-mono text-xs"
                  style={{ color: 'var(--surf-text-muted, #71717a)' }}
                >
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 12).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onMarkNotificationRead(n.id)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        n.type === 'alert'
                          ? 'bg-rose-500'
                          : n.type === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{n.title}</div>
                      <div
                        className="mt-0.5 text-[11px]"
                        style={{ color: 'var(--surf-text-secondary, #a1a1aa)' }}
                      >
                        {n.message}
                      </div>
                      <div
                        className="mt-1 font-mono text-[10px]"
                        style={{ color: 'var(--surf-text-muted, #71717a)' }}
                      >
                        {new Date(n.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};
