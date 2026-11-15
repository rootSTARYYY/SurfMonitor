# Surf Monitor v5.0.0 — Complete Infrastructure Platform Upgrade

## Major Additions & Fixes (v5.0.0)
- **Interactive `xterm.js` SSH Terminal (`src/components/XtermPane.tsx`, `src/pages/OperationsCenter.tsx`)**:
  - Real PTY sessions (`xterm-256color`, `LANG=en_US.UTF-8`) with `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-search`, and `@xterm/addon-web-links`.
  - Multi-tab sessions, custom tab names (double-click), horizontal/vertical split panes, fullscreen mode, scrollback search, right-click copy/paste, reconnect, live duration indicator, and persistent Terminal Settings (font family, font size, cursor style, scrollback, copy-on-select).
- **Character Encoding & ANSI Rendering Fix (`electron/remote/sshManager.ts`, `tests/terminalEncoding.test.ts`)**:
  - Added per-session `StringDecoder('utf8')` buffering across incoming SSH TCP/stream chunks so multibyte UTF-8 box-drawing characters (`┌─│─┐`), ANSI 256 colors, and non-English text never split or render as ``.
- **High-Performance SFTP (`electron/remote/sshManager.ts`, `src/pages/OperationsCenter.tsx`)**:
  - Pooled `SFTPWrapper` per server (no reconnect/teardown per click), 30s directory listing cache with automatic invalidation on write/mkdir/rename/delete, paginated rendering for large directories, transfer queue, multi-select bulk delete, rename, and conflict-safe remote editor (`sftpStat` mtime check + unsaved-changes warning).
- **Dynamic Upstream Version Discovery (`electron/installer/versionDiscovery.ts`, `src/pages/InstallationCenter.tsx`)**:
  - Live version discovery from official GitHub Releases/Tags APIs and Node.js distribution index (`pterodactyl/panel`, `pterodactyl/wings`, `louislam/uptime-kuma`, `moby/moby`, `postgres/postgres`, `MariaDB/server`, `redis/redis`, `nginx/nginx`, `fail2ban/fail2ban`).
  - Separates **Latest Stable** vs **Latest Beta / Pre-release**, caches results in SQLite with live/cached timestamps, handles rate limits with last-known-good fallback, and passes the user-selected version tag into Pterodactyl Panel/Wings downloads.
- **Sidebar & Workspace Customization (`src/utils/sidebarConfig.ts`, `src/components/Sidebar.tsx`, `src/pages/Settings.tsx`)**:
  - Dedicated **Settings → Sidebar & Workspace** tab to show/hide individual items or groups, pin favorites, reorder groups, create custom sections, configure default landing page and density, and restore defaults without losing data.
- **Application Manager, Deployment Templates, Backup & Recovery Center, Automation Center, Command Center & Server Groups**:
  - Full SQLite persistence via incremental `CREATE TABLE IF NOT EXISTS` migrations preserving all existing monitors, servers, themes, profiles, and credentials.
