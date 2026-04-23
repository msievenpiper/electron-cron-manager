# Home Dashboard & Quick Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Home tab with job stats (running/success/failure with a selectable time window), recent runs feed, and per-job summary; also add an icon-only ▶ run button to every job row.

**Architecture:** New `runs:stats` IPC channel does SQL aggregation in the main process; the renderer `HomePage` fetches stats + runs on mount and re-fetches on `jobStarted`/`jobFinished` events. The ▶ button calls the already-wired `jobs:runNow` IPC channel.

**Tech Stack:** Electron IPC, better-sqlite3 (synchronous), React 19, Tailwind v4, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/types.ts` | Modify | Add `RunStats` interface |
| `src/shared/ipc-channels.ts` | Modify | Add `RUNS_STATS` constant |
| `src/main/db/runs.ts` | Modify | Add `getStats(windowMs)` to `RunRepository` |
| `src/main/db/runs.test.ts` | Modify | Add tests for `getStats` |
| `src/main/ipc-handlers.ts` | Modify | Register `runs:stats` handler |
| `src/preload/index.ts` | Modify | Expose `runs.stats` via contextBridge |
| `src/renderer/src/types/window.d.ts` | Modify | Add `runs.stats` to `CronManagerAPI` type |
| `src/renderer/src/components/Layout.tsx` | Modify | Add `'home'` as first/default tab |
| `src/renderer/src/pages/HomePage.tsx` | Create | Dashboard page component |
| `src/renderer/src/pages/JobsPage.tsx` | Modify | Add ▶ run button to actions column |

---

## Task 1: Shared types and IPC channel key

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc-channels.ts`

- [ ] **Step 1: Add `RunStats` to shared types**

In `src/shared/types.ts`, add after the `Run` interface:

```ts
export interface RunStats {
  success: number
  failure: number
  running: number
}
```

- [ ] **Step 2: Add `RUNS_STATS` to IPC channels**

In `src/shared/ipc-channels.ts`, add after `RUNS_LIST_BY_JOB`:

```ts
RUNS_STATS: 'runs:stats',
```

The full `IPC` object should look like:

```ts
export const IPC = {
  JOBS_LIST:        'jobs:list',
  JOBS_CREATE:      'jobs:create',
  JOBS_UPDATE:      'jobs:update',
  JOBS_DELETE:      'jobs:delete',
  JOBS_RUN_NOW:     'jobs:runNow',
  JOBS_KILL:        'jobs:kill',

  RUNS_LIST:        'runs:list',
  RUNS_LIST_BY_JOB: 'runs:listByJob',
  RUNS_STATS:       'runs:stats',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  JOB_STARTED:  'event:jobStarted',
  JOB_FINISHED: 'event:jobFinished',
} as const
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts src/shared/ipc-channels.ts
git commit -m "feat: add RunStats type and runs:stats IPC channel key"
```

---

## Task 2: `RunRepository.getStats` — TDD

**Files:**
- Modify: `src/main/db/runs.test.ts`
- Modify: `src/main/db/runs.ts`

- [ ] **Step 1: Write failing tests**

Add this `describe` block at the bottom of `src/main/db/runs.test.ts`, inside the outer `describe('RunRepository', ...)` block (after the `prune` test):

```ts
describe('getStats', () => {
  it('counts success and failure runs within window', () => {
    const now = Date.now()
    const windowMs = 24 * 60 * 60 * 1000

    db.prepare(`INSERT INTO runs (id, job_id, started_at, ended_at, exit_code, stdout, stderr, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('r1', jobId, now - 1000, now, 0, '', '', 'success')
    db.prepare(`INSERT INTO runs (id, job_id, started_at, ended_at, exit_code, stdout, stderr, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('r2', jobId, now - 2000, now, 1, '', '', 'failure')
    db.prepare(`INSERT INTO runs (id, job_id, started_at, ended_at, exit_code, stdout, stderr, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('r3', jobId, now - windowMs - 1000, now, 0, '', '', 'success') // outside window

    const stats = runs.getStats(windowMs)
    expect(stats.success).toBe(1)
    expect(stats.failure).toBe(1)
    expect(stats.running).toBe(0)
  })

  it('counts running jobs regardless of time window', () => {
    const now = Date.now()
    const windowMs = 24 * 60 * 60 * 1000

    // Started 2 days ago — outside the 24h window — but still running
    db.prepare(`INSERT INTO runs (id, job_id, started_at, ended_at, exit_code, stdout, stderr, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('r1', jobId, now - 2 * windowMs, null, null, null, null, 'running')

    const stats = runs.getStats(windowMs)
    expect(stats.running).toBe(1)
    expect(stats.success).toBe(0)
    expect(stats.failure).toBe(0)
  })

  it('returns zeros when no runs exist', () => {
    const stats = runs.getStats(24 * 60 * 60 * 1000)
    expect(stats).toEqual({ success: 0, failure: 0, running: 0 })
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npx vitest run src/main/db/runs.test.ts
```

Expected: 3 new tests fail with `TypeError: runs.getStats is not a function`

- [ ] **Step 3: Implement `getStats` in `RunRepository`**

Add this method to the `RunRepository` class in `src/main/db/runs.ts`, after `findAll`:

```ts
getStats(windowMs: number): { success: number; failure: number; running: number } {
  const since = Date.now() - windowMs
  const rows = this.db.prepare(`
    SELECT status, COUNT(*) as count
    FROM runs
    WHERE started_at > ? AND status IN ('success', 'failure')
    GROUP BY status
  `).all(since) as { status: string; count: number }[]

  const runningRow = this.db.prepare(
    `SELECT COUNT(*) as count FROM runs WHERE status = 'running'`
  ).get() as { count: number }

  const result = { success: 0, failure: 0, running: runningRow.count }
  for (const row of rows) {
    if (row.status === 'success') result.success = row.count
    if (row.status === 'failure') result.failure = row.count
  }
  return result
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx vitest run src/main/db/runs.test.ts
```

Expected: all tests pass including the 3 new `getStats` tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/runs.ts src/main/db/runs.test.ts
git commit -m "feat: add RunRepository.getStats for windowed aggregation"
```

---

## Task 3: IPC handler, preload, and window type declaration

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/types/window.d.ts`

- [ ] **Step 1: Register the `runs:stats` handler in `ipc-handlers.ts`**

Add after the `ipcMain.handle(IPC.RUNS_LIST_BY_JOB, ...)` line:

```ts
ipcMain.handle(IPC.RUNS_STATS, (_e, window: '24h' | '7d' | '30d') => {
  const ms: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d':  7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }
  return runRepo.getStats(ms[window] ?? ms['24h'])
})
```

- [ ] **Step 2: Expose `runs.stats` in the preload**

In `src/preload/index.ts`, update the `runs` object:

```ts
runs: {
  list: () => ipcRenderer.invoke(IPC.RUNS_LIST),
  listByJob: (jobId: string) => ipcRenderer.invoke(IPC.RUNS_LIST_BY_JOB, jobId),
  stats: (window: '24h' | '7d' | '30d') => ipcRenderer.invoke(IPC.RUNS_STATS, window),
},
```

- [ ] **Step 3: Update the window type declaration**

In `src/renderer/src/types/window.d.ts`, update the import and `runs` type:

```ts
import { Job, Run, CreateJobInput, UpdateJobInput, RunStats } from '../../../shared/types'

interface CronManagerAPI {
  jobs: {
    list: () => Promise<Job[]>
    create: (input: CreateJobInput) => Promise<Job>
    update: (id: string, input: UpdateJobInput) => Promise<Job>
    delete: (id: string) => Promise<void>
    runNow: (id: string) => Promise<void>
    kill: (id: string) => Promise<void>
  }
  runs: {
    list: () => Promise<Run[]>
    listByJob: (jobId: string) => Promise<Run[]>
    stats: (window: '24h' | '7d' | '30d') => Promise<RunStats>
  }
  settings: {
    get: (key: string) => Promise<string | undefined>
    set: (key: string, value: string) => Promise<void>
  }
  on: {
    jobStarted: (cb: (jobId: string) => void) => (() => void)
    jobFinished: (cb: (jobId: string) => void) => (() => void)
  }
}

declare global {
  interface Window {
    cronManager: CronManagerAPI
  }
}

export {}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/index.ts src/renderer/src/types/window.d.ts
git commit -m "feat: wire runs:stats IPC handler and expose via preload"
```

---

## Task 4: Add Home tab to Layout

**Files:**
- Modify: `src/renderer/src/components/Layout.tsx`

- [ ] **Step 1: Replace `Layout.tsx` with the updated version**

```tsx
import { useState } from 'react'
import HomePage from '../pages/HomePage'
import JobsPage from '../pages/JobsPage'
import CalendarPage from '../pages/CalendarPage'
import HistoryPage from '../pages/HistoryPage'

type Tab = 'home' | 'jobs' | 'calendar' | 'history'

export default function Layout() {
  const [tab, setTab] = useState<Tab>('home')

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <nav className="flex border-b border-gray-800 px-4">
        {(['home', 'jobs', 'calendar', 'history'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-hidden flex flex-col">
        {tab === 'home'     && <HomePage />}
        {tab === 'jobs'     && <JobsPage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'history'  && <HistoryPage />}
      </main>
    </div>
  )
}
```

Note: `HomePage` doesn't exist yet — the typecheck will fail until Task 5 is complete. Don't run typecheck until after Task 5.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/Layout.tsx
git commit -m "feat: add Home tab to navigation"
```

---

## Task 5: Create `HomePage` component

**Files:**
- Create: `src/renderer/src/pages/HomePage.tsx`

- [ ] **Step 1: Create `src/renderer/src/pages/HomePage.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Job, Run, RunStats } from '../../../shared/types'

type TimeWindow = '24h' | '7d' | '30d'

const TIME_WINDOWS: TimeWindow[] = ['24h', '7d', '30d']

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

interface JobSummaryRow {
  jobId: string
  jobName: string
  lastRun: Run
  successRate: number | null
}

function buildJobSummary(jobs: Job[], runs: Run[]): JobSummaryRow[] {
  const jobMap = new Map(jobs.map(j => [j.id, j]))
  const byJob = new Map<string, Run[]>()
  for (const run of runs) {
    if (!byJob.has(run.job_id)) byJob.set(run.job_id, [])
    byJob.get(run.job_id)!.push(run)
  }
  const rows: JobSummaryRow[] = []
  for (const [jobId, jobRuns] of byJob) {
    const job = jobMap.get(jobId)
    if (!job) continue
    const lastRun = jobRuns[0]
    const completed = jobRuns.filter(r => r.status === 'success' || r.status === 'failure')
    const successRate = completed.length > 0
      ? Math.round(jobRuns.filter(r => r.status === 'success').length / completed.length * 100)
      : null
    rows.push({ jobId, jobName: job.name, lastRun, successRate })
  }
  return rows
}

function StatusDot({ status }: { status: Run['status'] }) {
  const color =
    status === 'success' ? 'bg-green-500' :
    status === 'failure' ? 'bg-red-500' :
    status === 'running' ? 'bg-blue-500' : 'bg-yellow-500'
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${color}`} />
}

export default function HomePage() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')
  const [stats, setStats] = useState<RunStats>({ success: 0, failure: 0, running: 0 })
  const [runs, setRuns] = useState<Run[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  const fetchStats = (w: TimeWindow) =>
    window.cronManager.runs.stats(w).then(setStats)

  const fetchRunsAndJobs = () =>
    Promise.all([
      window.cronManager.runs.list(),
      window.cronManager.jobs.list(),
    ]).then(([r, j]) => { setRuns(r); setJobs(j) })

  useEffect(() => {
    fetchStats(timeWindow)
    fetchRunsAndJobs()
    const cleanupStarted = window.cronManager.on.jobStarted(() => {
      fetchStats(timeWindow)
      fetchRunsAndJobs()
    })
    const cleanupFinished = window.cronManager.on.jobFinished(() => {
      fetchStats(timeWindow)
      fetchRunsAndJobs()
    })
    return () => { cleanupStarted(); cleanupFinished() }
  }, [timeWindow])

  const recentRuns = runs.slice(0, 10)
  const jobMap = new Map(jobs.map(j => [j.id, j]))
  const jobSummary = buildJobSummary(jobs, runs)

  return (
    <div className="p-4 flex-1 min-h-0 overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Overview</h2>
        <div className="flex bg-gray-800 rounded overflow-hidden text-xs">
          {TIME_WINDOWS.map(w => (
            <button
              key={w}
              onClick={() => setTimeWindow(w)}
              className={`px-3 py-1.5 ${
                timeWindow === w ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Running Now</div>
          <div className="text-3xl font-bold text-blue-400">{stats.running}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Successful</div>
          <div className="text-3xl font-bold text-green-400">{stats.success}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Failed</div>
          <div className="text-3xl font-bold text-red-400">{stats.failure}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide mb-3">Recent Runs</h3>
          {recentRuns.length === 0 ? (
            <p className="text-gray-500 text-xs">No runs yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentRuns.map(run => (
                <div key={run.id} className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2">
                    <StatusDot status={run.status} />
                    <span className="text-gray-200">{jobMap.get(run.job_id)?.name ?? run.job_id}</span>
                  </span>
                  <span>
                    {run.status === 'running'
                      ? <span className="text-blue-400">running…</span>
                      : <span className="text-gray-500">{relativeTime(run.started_at)}</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide mb-3">Job Summary</h3>
          {jobSummary.length === 0 ? (
            <p className="text-gray-500 text-xs">No runs yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="pb-1 text-left font-normal">Job</th>
                  <th className="pb-1 text-right font-normal">Last run</th>
                  <th className="pb-1 text-right font-normal">Success</th>
                </tr>
              </thead>
              <tbody>
                {jobSummary.map(row => (
                  <tr key={row.jobId} className="border-b border-gray-800/50">
                    <td className="py-1.5 text-gray-200">{row.jobName}</td>
                    <td className="py-1.5 text-right">
                      <span className={
                        row.lastRun.status === 'success' ? 'text-green-400' :
                        row.lastRun.status === 'failure' ? 'text-red-400' :
                        row.lastRun.status === 'running' ? 'text-blue-400' : 'text-yellow-400'
                      }>
                        {row.lastRun.status === 'running'
                          ? '↻ now'
                          : relativeTime(row.lastRun.started_at)
                        }
                      </span>
                    </td>
                    <td className="py-1.5 text-right">
                      {row.successRate === null
                        ? <span className="text-gray-500">—</span>
                        : <span className={
                            row.successRate === 100 ? 'text-green-400' :
                            row.successRate >= 80  ? 'text-yellow-400' : 'text-red-400'
                          }>{row.successRate}%</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/HomePage.tsx
git commit -m "feat: add HomePage dashboard with stats, recent runs, and job summary"
```

---

## Task 6: Add ▶ run button to `JobsPage`

**Files:**
- Modify: `src/renderer/src/pages/JobsPage.tsx`

- [ ] **Step 1: Add `handleRunNow` and the ▶ button**

In `src/renderer/src/pages/JobsPage.tsx`:

Add `handleRunNow` after `handleDelete`:

```ts
const handleRunNow = async (job: Job) => {
  await window.cronManager.jobs.runNow(job.id)
}
```

In the actions `<td>`, add the ▶ button immediately before the Edit button. Show it only when the job is **not** running (the Kill button already covers the running case):

```tsx
<td className="py-2 flex gap-2">
  <button onClick={() => toggleEnabled(job)} className="text-xs text-gray-400 hover:text-white">
    {job.enabled ? 'Disable' : 'Enable'}
  </button>
  {!isRunning && (
    <button
      onClick={() => handleRunNow(job)}
      title={`Run ${job.name} now`}
      className="text-xs text-green-500 hover:text-green-400"
    >
      ▶
    </button>
  )}
  <button onClick={() => setEditingJob(job)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
  {isRunning && (
    <button onClick={() => handleKill(job)} className="text-xs text-yellow-400 hover:text-yellow-300">Kill</button>
  )}
  <button onClick={() => handleDelete(job)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
</td>
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/pages/JobsPage.tsx
git commit -m "feat: add one-click run button to job rows"
```

---

## Task 7: Smoke test in the running app

- [ ] **Step 1: Start the app**

```bash
npm run dev
```

- [ ] **Step 2: Verify Home tab**
  - App opens on the Home tab
  - Stat cards show (all zeros if no history yet)
  - Time window toggle (24h/7d/30d) switches and re-fetches
  - Recent Runs and Job Summary panels render (empty state if no runs)

- [ ] **Step 3: Verify ▶ button**
  - Switch to Jobs tab
  - Each job row shows a green ▶ button when not running
  - Clicking ▶ triggers the job (status changes to "running", Kill appears, ▶ disappears)
  - Home tab stat cards update after the job finishes

- [ ] **Step 4: Final commit if any fixups were needed**

```bash
git add -p   # stage only the fixup changes
git commit -m "fix: <describe what needed fixing>"
```
