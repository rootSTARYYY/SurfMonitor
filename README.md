# Surf Monitor (v1.2.0)

A local-first Windows desktop website uptime and observability application built with Electron, React, TypeScript, Vite, Tailwind CSS, Recharts, and SQLite (`better-sqlite3`).

## Architecture
- **Monitoring Engine (`electron/engine/httpChecker.ts`)**: Real HTTP `GET` and `HEAD` checks using `fetch`, `AbortController` timeouts, and `performance.now()` latency measurement. HTTP `200–399` is treated as operational; `400+` and network/DNS/TLS/timeout errors are recorded as failures.
- **Scheduler (`electron/engine/scheduler.ts`)**: Restores active monitors from SQLite on startup, schedules individual intervals (`30s`, `60s`, `2m`, `5m`), prevents overlapping checks, runs immediate initial checks, and cleans up timers on pause/delete/exit.
- **SQLite Storage (`electron/db/database.ts`)**: Persists `monitors`, `checks`, and `incidents` in `app.getPath('userData')/surf-monitor.db` with WAL mode and `ON DELETE CASCADE` foreign keys.
- **Secure IPC (`electron/main.ts`, `electron/preload.ts`)**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and typed `contextBridge` API (`window.surfMonitorAPI`).

## Windows PowerShell Commands

```powershell
npm install
npm run typecheck
npm run lint
npm test
npm run dev
```

> Note: `postinstall` runs `electron-builder install-app-deps` to compile `better-sqlite3` for Electron. If you switch Node/Electron versions, run `npm run rebuild`.

## Build Windows Installer

```powershell
npm run build:win
```

Outputs the NSIS installer into `release\`.
