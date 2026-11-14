import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronRight, Plus, Search, X } from 'lucide-react';
import { NotificationItem } from '@/types';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface HeaderProps {
  breadcrumbs: BreadcrumbItem[];
  searchQuery: string;
  onSearchSubmit: (query: string) => void;
  onOpenAddMonitor: () => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs,
  searchQuery,
  onSearchSubmit,
  onOpenAddMonitor,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(localQuery);
  };

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

      {/* Right: Engine status, Search, Notifications, Add Monitor */}
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
              className="w-40 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setLocalQuery('');
                onSearchSubmit('');
                setSearchOpen(false);
              }}
              className="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
              aria-label="Close search"
            >
              <X className="h-3 w-3" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-white/[0.08] bg-[#101114] px-2.5 text-xs text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-200"
            title="Search monitors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
          </button>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifContainerRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative flex h-7 w-7 items-center justify-center rounded border border-white/[0.08] bg-[#101114] text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-200"
            aria-label="Notifications"
          >
            <Bell className="h-3.5 w-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[9px] font-semibold text-zinc-950">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-40 mt-2 w-80 rounded border border-white/[0.1] bg-[#111216] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5">
                <span className="text-xs font-medium text-zinc-200">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllNotificationsRead}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 divide-y divide-white/[0.06] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-zinc-500">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => onMarkNotificationRead(notif.id)}
                      className={`flex w-full flex-col gap-1 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${
                        notif.read ? 'opacity-60' : 'bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-200">
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        {notif.message}
                      </p>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {notif.timestamp}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Monitor */}
        <button
          type="button"
          onClick={onOpenAddMonitor}
          className="flex h-7 items-center gap-1.5 rounded bg-emerald-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Monitor</span>
        </button>
      </div>
    </header>
  );
};
