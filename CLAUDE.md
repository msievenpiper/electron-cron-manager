# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Notes

- `tsconfig.node.json` includes `src/main/**/*`, which means **test files are typechecked during `npm run build`**. Unused imports in test files will fail the build (`noUnusedLocals` is on).

## Commands

```bash
# Development
npm run dev          # Start Electron app with hot-reload (renderer + main)

# Type checking
npm run typecheck    # Check both main (node) and renderer (web) tsconfigs

# Testing
npm test             # Rebuilds better-sqlite3 for Node, runs Vitest, then rebuilds for Electron
                     # Must run this full command — skipping the rebuilds will cause ABI mismatch errors

# Run a single test file
npx vitest run src/main/executor.test.ts

# Linting / formatting
npm run lint
npm run format

# Production build
npm run build:mac    # Outputs DMG + ZIP to dist/ (unsigned, identity: null)
```

## Architecture

This is a monolithic Electron app. The main process owns all business logic; the renderer is a pure React UI.

### Process Boundary

```
Renderer (React)
  └─ window.cronManager (contextBridge API)
       └─ Preload (src/preload/index.ts)
            └─ IPC channels (src/shared/ipc-channels.ts)
                 └─ Main process (ipcMain handlers)
```

All renderer→main communication is `ipcRenderer.invoke`. Main→renderer push events use `webContents.send` for `JOB_STARTED` / `JOB_FINISHED`. The preload exposes `window.cronManager.on.jobStarted(cb)` / `on.jobFinished(cb)` which **return cleanup functions** — always call them in `useEffect` cleanup to prevent listener accumulation.

### Main Process Layers

- **`src/main/index.ts`** — Entry point. Creates DB, JobRepository, SchedulerEngine, BrowserWindow, Tray, registers IPC handlers, starts scheduler.
- **`src/main/scheduler.ts`** — `SchedulerEngine`: wraps `node-cron`, maintains `tasks` map (cron schedules) and `activeRuns` map (running processes). Call `setCallbacks()` to wire DB/IPC side effects after construction.
- **`src/main/executor.ts`** — `executeJobWithHandle`: spawns interpreter with `-c <command>`, returns `{ promise, kill }`. All interpreters run via `spawn(interpreter, ['-c', command])`.
- **`src/main/ipc-handlers.ts`** — Registers all `ipcMain.handle` calls. Maintains `activeRunIds: Map<jobId, dbRunId>` to map the scheduler's ephemeral run IDs to SQLite UUIDs. Validates interpreter against `ALLOWED_INTERPRETERS` allowlist before any spawn.
- **`src/main/db/`** — `database.ts` (createDatabase, WAL mode), `jobs.ts` (JobRepository), `runs.ts` (RunRepository). `better-sqlite3` is synchronous.

### Shared Types

`src/shared/types.ts` and `src/shared/ipc-channels.ts` are imported by both main and renderer. The renderer tsconfig (`tsconfig.web.json`) includes `src/shared/**/*` explicitly to resolve these.

### Renderer

- Three pages: `JobsPage`, `CalendarPage`, `HistoryPage` — rendered inside `Layout.tsx` tab nav.
- `src/renderer/src/utils/schedule.ts` — uses `cron-parser` v5 to enumerate scheduled run times. Import is `import CronExpressionParser from 'cron-parser'` (default export); call `CronExpressionParser.parse()` (not `parseExpression`).
- `cronstrue` is used in `JobEditorDrawer` to render human-readable cron descriptions.

### Tailwind

Using **Tailwind v4** (not v3). No `tailwind.config.js`. Config is via the `@tailwindcss/vite` Vite plugin. CSS uses `@import "tailwindcss"` directive.

### Native Module (better-sqlite3)

`better-sqlite3` is a native addon that must be compiled for the correct Node ABI. `postinstall` rebuilds it for Electron. The `npm test` command rebuilds it for Node (for Vitest) then back to Electron when done. If tests fail with an ABI/module version error, run the full `npm test` command rather than `npx vitest run` directly.

### Packaging

`electron-builder.yml` targets macOS DMG + ZIP for arm64 and x64. `identity: null` skips code signing. `npmRebuild: false` — native modules are pre-built by the postinstall hook.

### SQLite Data

DB file lives at `app.getPath('userData')/cron-manager.db`. History is pruned to `max_runs_per_job` (default 100) after each run, configured via the `settings` table.
