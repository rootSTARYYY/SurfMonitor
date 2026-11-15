import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export interface TerminalAppearanceConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelect: boolean;
  background: string;
  foreground: string;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalAppearanceConfig = {
  fontFamily: "'Cascadia Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: 13,
  lineHeight: 1.25,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  copyOnSelect: false,
  background: '#060709',
  foreground: '#e4e4e7',
};

interface XtermPaneProps {
  sessionId: string;
  config: TerminalAppearanceConfig;
  searchQuery?: string;
  clearSignal?: number;
  onDataSend: (data: string) => void;
  onResizeSend: (cols: number, rows: number) => void;
  registerOutputWriter: (sessionId: string, writeFn: (chunk: string) => void) => () => void;
}

export const XtermPane: React.FC<XtermPaneProps> = ({
  sessionId,
  config,
  searchQuery,
  clearSignal,
  onDataSend,
  onResizeSend,
  registerOutputWriter,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      lineHeight: config.lineHeight,
      cursorStyle: config.cursorStyle,
      cursorBlink: config.cursorBlink,
      scrollback: config.scrollback,
      allowProposedApi: true,
      convertEol: false,
      theme: {
        background: config.background,
        foreground: config.foreground,
        cursor: '#10b981',
        selectionBackground: 'rgba(16, 185, 129, 0.28)',
      },
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    const webLinks = new WebLinksAddon((_event, uri) => {
      void window.surfMonitorAPI?.openExternal(uri);
    });

    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(webLinks);
    term.open(el);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    const dataSub = term.onData((d) => onDataSend(d));
    const selSub = term.onSelectionChange(() => {
      if (config.copyOnSelect && term.hasSelection()) {
        void navigator.clipboard?.writeText(term.getSelection());
      }
    });

    const unregisterWriter = registerOutputWriter(sessionId, (chunk) => {
      term.write(chunk);
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        onResizeSend(term.cols, term.rows);
      } catch {
        // ignore resize before mount settles
      }
    });
    ro.observe(el);

    onResizeSend(term.cols, term.rows);
    term.focus();

    return () => {
      ro.disconnect();
      unregisterWriter();
      dataSub.dispose();
      selSub.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontFamily = config.fontFamily;
    term.options.fontSize = config.fontSize;
    term.options.lineHeight = config.lineHeight;
    term.options.cursorStyle = config.cursorStyle;
    term.options.cursorBlink = config.cursorBlink;
    term.options.scrollback = config.scrollback;
    term.options.theme = {
      background: config.background,
      foreground: config.foreground,
      cursor: '#10b981',
      selectionBackground: 'rgba(16, 185, 129, 0.28)',
    };
    try {
      fitRef.current?.fit();
    } catch {}
  }, [config]);

  useEffect(() => {
    if (searchQuery && searchRef.current) {
      searchRef.current.findNext(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (clearSignal && termRef.current) {
      termRef.current.clear();
    }
  }, [clearSignal]);

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    const term = termRef.current;
    if (!term) return;
    if (term.hasSelection()) {
      await navigator.clipboard?.writeText(term.getSelection());
      term.clearSelection();
    } else {
      const text = await navigator.clipboard?.readText();
      if (text) onDataSend(text);
    }
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => void handleContextMenu(e)}
      onClick={() => termRef.current?.focus()}
      className="h-full w-full overflow-hidden rounded border border-white/[0.08] p-1.5"
      style={{ backgroundColor: config.background }}
    />
  );
};
