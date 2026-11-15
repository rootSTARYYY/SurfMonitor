import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search, Star, X } from 'lucide-react';
import { PageId } from '@/types';
import { ALL_NAV_ITEMS, WORKSPACES } from '@/utils/sidebarConfig';

interface QuickSwitcherProps {
  isOpen: boolean;
  pinnedIds: PageId[];
  onClose: () => void;
  onSelectPage: (pageId: PageId) => void;
  onTogglePin: (pageId: PageId) => void;
}

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  pinnedIds,
  onClose,
  onSelectPage,
  onTogglePin,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter((item) => {
      const wsLabel = WORKSPACES.find((w) => w.id === item.workspace)?.label.toLowerCase() ?? '';
      return (
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        wsLabel.includes(q) ||
        (item.aliases ?? []).some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(0);
    }
  }, [results.length, selectedIndex]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (results.length > 0 ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (results.length > 0 ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelectPage(results[selectedIndex].id);
      onClose();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-white/[0.12] bg-[#111216] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-3.5 py-2.5">
          <Search className="h-4 w-4 text-emerald-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to page or workspace (e.g. Terminal, Pterodactyl, PM2, DDoS, SSL)..."
            className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="py-8 text-center font-mono text-xs text-zinc-500">
              No matching pages found.
            </div>
          ) : (
            results.map((item, idx) => {
              const ws = WORKSPACES.find((w) => w.id === item.workspace);
              const isPinned = pinnedIds.includes(item.id);
              const active = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between rounded px-3 py-2 text-xs transition-colors ${
                    active ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPage(item.id);
                      onClose();
                    }}
                    className="flex flex-1 items-center gap-2.5 text-left"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {ws?.label}
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onTogglePin(item.id)}
                      className={`p-1 ${isPinned ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-300'}`}
                      title={isPinned ? 'Unpin' : 'Pin to sidebar'}
                    >
                      <Star className="h-3.5 w-3.5" fill={isPinned ? 'currentColor' : 'none'} />
                    </button>
                    {active && <CornerDownLeft className="h-3.5 w-3.5 text-zinc-500" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.08] px-3.5 py-1.5 font-mono text-[10px] text-zinc-500">
          <span>↑↓ Navigate • Enter Open • Esc Close</span>
          <span>Ctrl + K</span>
        </div>
      </div>
    </div>
  );
};
