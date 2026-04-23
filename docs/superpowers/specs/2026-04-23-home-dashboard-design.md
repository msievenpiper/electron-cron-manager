# Home Dashboard & Quick Run — Design Spec

**Date:** 2026-04-23

## Overview

Two improvements to the Cron Manager UI:

1. A new **Home tab** showing job run statistics and recent activity at a glance.
2. A **quick Run Now button** on the Jobs page so any job can be triggered without opening the editor.

---

## 1. Navigation Change

`Layout.tsx` adds `'home'` as a fourth tab. Home becomes the **default tab** (replaces `'jobs'` as the initial state). Tab order: Home | Jobs | Calendar | History.

---

## 2. New IPC Channel: `runs:stats`

**Channel name:** `runs:stats` (add to `src/shared/ipc-channels.ts`)

**Request payload:**
```ts
{ window: '24h' | '7d' | '30d' }
```

**Response payload:**
```ts
{ success: number; failure: number; running: number }
```

**Implementation:**

- New method `getStats(windowMs: number)` on `RunRepository` (`src/main/db/runs.ts`). Two queries:
  ```sql
  -- Windowed success/failure counts
  SELECT status, COUNT(*) as count
  FROM runs
  WHERE started_at > ? AND status IN ('success', 'failure')
  GROUP BY status

  -- Running count (no time filter — a job started yesterday could still be running)
  SELECT COUNT(*) as count FROM runs WHERE status = 'running'
  ```

- Registered in `src/main/ipc-handlers.ts` as `ipcMain.handle('runs:stats', ...)`.

---

## 3. Home Page Component

**File:** `src/renderer/src/pages/HomePage.tsx`

### Layout (top to bottom)

1. **Header row** — "Overview" heading on the left; `24h / 7d / 30d` pill toggle on the right.
2. **Stat cards row** — three equal-width cards: Running Now (blue), Successful (green), Failed (red). Counts come from `runs:stats`.
3. **Two-column section:**
   - **Recent Runs** (left) — last 10 runs across all jobs via existing `runs:list`. Displays: status dot, job name, relative time. Running jobs show a blue "running…" indicator.
   - **Job Summary** (right) — per-job table with columns: Job name | Last run (status + relative time) | Success rate. Computed client-side from the same `runs:list` response, grouped by `job_id`.

### Data fetching

- On mount: fetch `runs:stats` and `runs:list` (limit 100).
- On toggle change: re-fetch `runs:stats` only.
- On `jobStarted` / `jobFinished` events: re-fetch both `runs:stats` and `runs:list`.
- Cleanup: unsubscribe event listeners in `useEffect` cleanup (follow existing pattern — listeners return cleanup functions).

### Success rate calculation

For each job: `successes / (total - running)` across the last 100 runs. Display as percentage, rounded to nearest integer. Show `—` if no completed runs.

---

## 4. Jobs Page — Quick Run Button

**File:** `src/renderer/src/pages/JobsPage.tsx`

Add an icon-only `▶` button to the Actions column of each job row, to the left of the existing Edit (✏) button.

- **Appearance:** same style as existing action icon buttons; green tint to distinguish from neutral actions.
- **Tooltip:** `"Run [job name] now"` (via `title` attribute).
- **Disabled state:** hidden (or disabled) when the job is already running — the Kill button takes its place, same as today.
- **On click:** calls `window.cronManager.jobs.runNow(job.id)`.

### Preload wiring

`jobs:runNow` IPC channel exists but is not yet exposed via `contextBridge`. Add `runNow: (id: string) => ipcRenderer.invoke(CHANNELS.JOBS.RUN_NOW, id)` to the jobs namespace in `src/preload/index.ts`.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/shared/ipc-channels.ts` | Add `RUNS.STATS = 'runs:stats'` |
| `src/main/db/runs.ts` | Add `getStats(windowMs)` to `RunRepository` |
| `src/main/ipc-handlers.ts` | Register `runs:stats` handler |
| `src/preload/index.ts` | Expose `jobs.runNow` via contextBridge |
| `src/renderer/src/components/Layout.tsx` | Add Home tab, set as default |
| `src/renderer/src/pages/HomePage.tsx` | New file — dashboard page |
| `src/renderer/src/pages/JobsPage.tsx` | Add ▶ run button to actions column |

---

## Out of Scope

- Upcoming scheduled runs feed (not requested)
- Notification on manual run completion
- Persistent stat history / charting
