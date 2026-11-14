import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { NotificationItem, PublicLicenseState } from '@/types';
import { formatDurationSeconds, formatTimestamp } from '@/utils/format';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface HeaderUserStats {
  totalMonitors: number;
  activeMonitors: number;
  downMonitors: number;
  registeredServers: number;
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
  licenseState?: PublicLicenseState | null;
  userStats?: HeaderUserStats;
  onManageLicense?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs,
  searchQuery,
  onSearchSubmit,
  onOpenAddMonitor,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  licenseState,
  userStats,
  onManageLicense,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(event.target as Node)
      ) {
        setNotifOpen(false);
      }
      if (
        profileContainerRef.current &&
        !profileContainerRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(localQuery);
  };

  const displayName = licenseState?.username || 'User';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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

      {/* Right: Search, Profile Greeting, Notifications, Add Monitor */}
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

        {/* User Profile & License Popover */}
        {licenseState && (
          <div className="relative" ref={profileContainerRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex h-7 max-w-[180px] items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2 text-xs text-zinc-200 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
              title={`Signed in as ${displayName}`}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-[9px] font-bold text-emerald-300">
                {initials || 'U'}
              </span>
              <span className="truncate font-medium">Hello, {displayName}!</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-md border border-white/[0.12] bg-[#111216] shadow-2xl">
                {/* User Info */}
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 font-mono text-xs font-bold text-emerald-300">
                      {initials || 'U'}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-zinc-100">
                        {displayName}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        {licenseState.isTrial
                          ? '7-Day Free Trial'
                          : licenseState.planName ?? 'Licensed Account'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                      licenseState.isTrial
                        ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {licenseState.isTrial ? 'Trial Active' : licenseState.status}
                  </span>
                </div>

                {/* License / Trial Details */}
                <div className="space-y-1.5 border-b border-white/[0.08] px-4 py-3 font-mono text-[11px]">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    {licenseState.isTrial ? 'Trial Entitlement' : 'License Entitlement'}
                  </div>
                  {licenseState.isTrial ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Started</span>
                        <span className="text-zinc-300">
                          {formatTimestamp(licenseState.trialStartedAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Expires</span>
                        <span className="text-zinc-300">
                          {formatTimestamp(licenseState.trialExpiresAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Remaining</span>
                        <span className="text-amber-300">
                          {licenseState.trialRemainingMs !== null
                            ? formatDurationSeconds(
                                Math.round(licenseState.trialRemainingMs / 1000)
                              )
                            : '—'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Product</span>
                        <span className="text-zinc-300">
                          {licenseState.productName ?? 'Surf Monitor'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Activated</span>
                        <span className="text-zinc-300">
                          {formatTimestamp(licenseState.activatedAt)}
                        </span>
                      </div>
                      {licenseState.expiresAt && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Expires</span>
                          <span className="text-zinc-300">
                            {formatTimestamp(licenseState.expiresAt)}
                          </span>
                        </div>
                      )}
                      {licenseState.machinesUsed !== null &&
                        licenseState.machinesLimit !== null && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Machine Slots</span>
                            <span className="text-zinc-300">
                              {licenseState.machinesUsed} / {licenseState.machinesLimit}
                            </span>
                          </div>
                        )}
                    </>
                  )}
                </div>

                {/* Live Monitoring Stats */}
                {userStats && (
                  <div className="border-b border-white/[0.08] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      <span>Workspace Telemetry</span>
                      <span>v{userStats.appVersion}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                      <div className="rounded bg-[#09090b] p-2">
                        <div className="text-[10px] text-zinc-500">Monitors</div>
                        <div className="text-zinc-100">
                          {userStats.activeMonitors}/{userStats.totalMonitors}
                        </div>
                      </div>
                      <div className="rounded bg-[#09090b] p-2">
                        <div className="text-[10px] text-zinc-500">Down</div>
                        <div
                          className={
                            userStats.downMonitors > 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        >
                          {userStats.downMonitors}
                        </div>
                      </div>
                      <div className="rounded bg-[#09090b] p-2">
                        <div className="text-[10px] text-zinc-500">Servers / PM2</div>
                        <div className="text-zinc-100">
                          {userStats.registeredServers} / {userStats.totalPm2Processes}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {onManageLicense && (
                  <div className="p-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onManageLicense();
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded border border-white/[0.1] bg-[#09090b] py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.05]"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Manage License &amp; Account</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notification Bell */}
        <div className="relative" ref={notifContainerRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
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

          {notifOpen && (
            <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded border border-white/[0.1] bg-[#111216] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5">
                <span className="text-xs font-semibold text-zinc-100">
                  Notifications
                </span>
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
                  <div className="px-4 py-8 text-center font-mono text-xs text-zinc-500">
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
                        <div className="truncate text-xs font-medium text-zinc-200">
                          {n.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                          {n.message}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-zinc-600">
                          {new Date(n.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Monitor CTA */}
        <button
          type="button"
          onClick={onOpenAddMonitor}
          className="flex h-7 items-center gap-1.5 rounded bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Monitor</span>
        </button>
      </div>
    </header>
  );
};