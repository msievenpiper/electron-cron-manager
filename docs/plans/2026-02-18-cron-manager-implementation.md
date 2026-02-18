# Cron Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a macOS menubar Electron app that creates, schedules, and manages local cron tasks with calendar preview, per-job stdout/stderr history stored in SQLite, and an internal node-cron scheduler.

**Architecture:** Monolithic Electron — main process owns the scheduler engine, SQLite database, child process execution, and tray integration. Renderer is a pure React UI communicating over a contextBridge IPC bridge. No nodeIntegration in renderer.

**Tech Stack:** Electron + electron-vite, React + TypeScript, Tailwind CSS, better-sqlite3, node-cron, cronstrue, react-big-calendar, date-fns, Vitest

---

## Reference: Design Doc
`docs/plans/2026-02-18-cron-manager-design.md`

---

### Task 1: Scaffold project with electron-vite

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, etc. (generated)

**Step 1: Scaffold using electron-vite react-ts template**

```bash
cd /Users/michael.sievenpiper/code/projects/cron-manager-2
npm create electron-vite@latest . -- --template react-ts
```

When prompted for project name use `cron-manager`. Accept all defaults.

**Step 2: Install core dependencies**

```bash
npm install better-sqlite3 node-cron cronstrue uuid react-big-calendar date-fns
npm install -D @types/better-sqlite3 @types/node-cron @types/uuid @types/react-big-calendar vitest @vitest/coverage-v8
```

**Step 3: Install Electron rebuild tooling for native modules**

```bash
npm install -D @electron/rebuild
```

Add to `package.json` scripts:
```json
"postinstall": "electron-rebuild -f -w better-sqlite3"
```

**Step 4: Verify scaffold boots**

```bash
npm run dev
```

Expected: Electron window opens with default vite+react splash screen. No errors in terminal.

**Step 5: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold electron-vite react-ts project"
```

---

### Task 2: Configure Tailwind CSS

**Files:**
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Modify: `src/renderer/src/assets/index.css` (or equivalent global CSS entry)
- Modify: `electron.vite.config.ts`

**Step 1: Install Tailwind**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Step 2: Configure content paths in `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: { extend: {} },
  plugins: [],
}
```

**Step 3: Add Tailwind directives to renderer global CSS**

Replace contents of `src/renderer/src/assets/main.css` (or `index.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Verify Tailwind works**

Add a test class to the default App component (e.g., `className="text-red-500"`) then run:

```bash
npm run dev
```

Expected: Text renders in red. Remove the test class after confirming.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: configure tailwind css"
```

---

### Task 3: Database module — schema and connection

**Files:**
- Create: `src/main/db/database.ts`
- Create: `src/main/db/schema.ts`
- Test: `src/main/db/database.test.ts`

**Step 1: Create `src/main/db/schema.ts`**

```ts
export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    cron        TEXT NOT NULL,
    interpreter TEXT NOT NULL,
    command     TEXT NOT NULL,
    enabled     INTEGER DEFAULT 1,
    notify      TEXT DEFAULT 'failure',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS runs (
    id         TEXT PRIMARY KEY,
    job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    exit_code  INTEGER,
    stdout     TEXT,
    stderr     TEXT,
    status     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_runs_job_id ON runs(job_id);
  CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  max_runs_per_job: '100',
};
```

**Step 2: Write failing test for `database.ts`**

Create `src/main/db/database.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from './database'
import Database from 'better-sqlite3'

describe('createDatabase', () => {
  let db: ReturnType<typeof createDatabase>

  beforeEach(() => {
    db = createDatabase(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('creates jobs table', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'").get()
    expect(row).toBeTruthy()
  })

  it('creates runs table', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='runs'").get()
    expect(row).toBeTruthy()
  })

  it('seeds default settings', () => {
    const row = db.prepare("SELECT value FROM settings WHERE key='max_runs_per_job'").get() as any
    expect(row.value).toBe('100')
  })
})
```

**Step 3: Run test to verify it fails**

Add to `package.json` scripts:
```json
"test": "vitest run"
```

Add to `vitest.config.ts` (create if absent):
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
  },
})
```

```bash
npm test
```

Expected: FAIL — `createDatabase` not found.

**Step 4: Implement `src/main/db/database.ts`**

```ts
import Database from 'better-sqlite3'
import { SCHEMA, DEFAULT_SETTINGS } from './schema'

export function createDatabase(path: string): Database.Database {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  // Seed default settings if not present
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, value)
  }

  return db
}
```

**Step 5: Run test to verify it passes**

```bash
npm test
```

Expected: 3 tests pass.

**Step 6: Commit**

```bash
git add src/main/db/
git commit -m "feat: add sqlite database module with schema"
```

---

### Task 4: Job repository (CRUD)

**Files:**
- Create: `src/main/db/jobs.ts`
- Test: `src/main/db/jobs.test.ts`
- Create: `src/shared/types.ts` (shared type definitions)

**Step 1: Create `src/shared/types.ts`**

```ts
export type Interpreter = 'bash' | 'sh' | 'node' | 'python3' | 'ruby' | 'zsh'
export type NotifySetting = 'all' | 'failure' | 'none'

export interface Job {
  id: string
  name: string
  cron: string
  interpreter: Interpreter
  command: string
  enabled: boolean
  notify: NotifySetting
  created_at: number
  updated_at: number
}

export type RunStatus = 'running' | 'success' | 'failure' | 'killed'

export interface Run {
  id: string
  job_id: string
  started_at: number
  ended_at: number | null
  exit_code: number | null
  stdout: string | null
  stderr: string | null
  status: RunStatus
}

export interface CreateJobInput {
  name: string
  cron: string
  interpreter: Interpreter
  command: string
  enabled?: boolean
  notify?: NotifySetting
}

export interface UpdateJobInput extends Partial<CreateJobInput> {}
```

**Step 2: Write failing tests for job repository**

Create `src/main/db/jobs.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from './database'
import { JobRepository } from './jobs'
import Database from 'better-sqlite3'

describe('JobRepository', () => {
  let db: Database.Database
  let repo: JobRepository

  beforeEach(() => {
    db = createDatabase(':memory:')
    repo = new JobRepository(db)
  })

  afterEach(() => db.close())

  it('creates a job and returns it with id', () => {
    const job = repo.create({ name: 'Test', cron: '* * * * *', interpreter: 'bash', command: 'echo hi' })
    expect(job.id).toBeTruthy()
    expect(job.name).toBe('Test')
    expect(job.enabled).toBe(true)
  })

  it('finds all jobs', () => {
    repo.create({ name: 'A', cron: '* * * * *', interpreter: 'bash', command: 'echo a' })
    repo.create({ name: 'B', cron: '* * * * *', interpreter: 'bash', command: 'echo b' })
    expect(repo.findAll()).toHaveLength(2)
  })

  it('finds job by id', () => {
    const job = repo.create({ name: 'Test', cron: '* * * * *', interpreter: 'bash', command: 'echo hi' })
    expect(repo.findById(job.id)?.name).toBe('Test')
  })

  it('updates a job', () => {
    const job = repo.create({ name: 'Test', cron: '* * * * *', interpreter: 'bash', command: 'echo hi' })
    const updated = repo.update(job.id, { name: 'Updated' })
    expect(updated?.name).toBe('Updated')
  })

  it('deletes a job', () => {
    const job = repo.create({ name: 'Test', cron: '* * * * *', interpreter: 'bash', command: 'echo hi' })
    repo.delete(job.id)
    expect(repo.findById(job.id)).toBeUndefined()
  })
})
```

**Step 3: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `JobRepository` not found.

**Step 4: Implement `src/main/db/jobs.ts`**

```ts
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { Job, CreateJobInput, UpdateJobInput } from '../../shared/types'

function rowToJob(row: any): Job {
  return { ...row, enabled: row.enabled === 1 }
}

export class JobRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateJobInput): Job {
    const now = Date.now()
    const id = uuidv4()
    this.db.prepare(`
      INSERT INTO jobs (id, name, cron, interpreter, command, enabled, notify, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.cron, input.interpreter, input.command,
           input.enabled !== false ? 1 : 0, input.notify ?? 'failure', now, now)
    return this.findById(id)!
  }

  findAll(): Job[] {
    return (this.db.prepare('SELECT * FROM jobs ORDER BY created_at ASC').all() as any[]).map(rowToJob)
  }

  findById(id: string): Job | undefined {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any
    return row ? rowToJob(row) : undefined
  }

  update(id: string, input: UpdateJobInput): Job | undefined {
    const existing = this.findById(id)
    if (!existing) return undefined
    const now = Date.now()
    const merged = { ...existing, ...input, updated_at: now }
    this.db.prepare(`
      UPDATE jobs SET name=?, cron=?, interpreter=?, command=?, enabled=?, notify=?, updated_at=? WHERE id=?
    `).run(merged.name, merged.cron, merged.interpreter, merged.command,
           merged.enabled ? 1 : 0, merged.notify, now, id)
    return this.findById(id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
  }
}
```

**Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/main/db/jobs.ts src/main/db/jobs.test.ts src/shared/types.ts
git commit -m "feat: add job repository with CRUD operations"
```

---

### Task 5: Run history repository

**Files:**
- Create: `src/main/db/runs.ts`
- Test: `src/main/db/runs.test.ts`

**Step 1: Write failing tests**

Create `src/main/db/runs.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from './database'
import { JobRepository } from './jobs'
import { RunRepository } from './runs'
import Database from 'better-sqlite3'

describe('RunRepository', () => {
  let db: Database.Database
  let jobs: JobRepository
  let runs: RunRepository
  let jobId: string

  beforeEach(() => {
    db = createDatabase(':memory:')
    jobs = new JobRepository(db)
    runs = new RunRepository(db)
    jobId = jobs.create({ name: 'Test', cron: '* * * * *', interpreter: 'bash', command: 'echo hi' }).id
  })

  afterEach(() => db.close())

  it('starts a run with status running', () => {
    const run = runs.start(jobId)
    expect(run.status).toBe('running')
    expect(run.ended_at).toBeNull()
  })

  it('finishes a run with exit code', () => {
    const run = runs.start(jobId)
    const finished = runs.finish(run.id, { exit_code: 0, stdout: 'hello', stderr: '', status: 'success' })
    expect(finished?.status).toBe('success')
    expect(finished?.stdout).toBe('hello')
    expect(finished?.ended_at).toBeGreaterThan(0)
  })

  it('finds runs for a job ordered newest first', () => {
    runs.start(jobId)
    runs.start(jobId)
    const results = runs.findByJobId(jobId)
    expect(results).toHaveLength(2)
    expect(results[0].started_at).toBeGreaterThanOrEqual(results[1].started_at)
  })

  it('prunes old runs beyond max', () => {
    for (let i = 0; i < 5; i++) runs.start(jobId)
    runs.prune(jobId, 3)
    expect(runs.findByJobId(jobId)).toHaveLength(3)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `RunRepository` not found.

**Step 3: Implement `src/main/db/runs.ts`**

```ts
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { Run, RunStatus } from '../../shared/types'

function rowToRun(row: any): Run {
  return row as Run
}

export class RunRepository {
  constructor(private db: Database.Database) {}

  start(jobId: string): Run {
    const id = uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO runs (id, job_id, started_at, ended_at, exit_code, stdout, stderr, status)
      VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 'running')
    `).run(id, jobId, now)
    return this.findById(id)!
  }

  finish(id: string, result: { exit_code: number; stdout: string; stderr: string; status: RunStatus }): Run | undefined {
    const now = Date.now()
    this.db.prepare(`
      UPDATE runs SET ended_at=?, exit_code=?, stdout=?, stderr=?, status=? WHERE id=?
    `).run(now, result.exit_code, result.stdout, result.stderr, result.status, id)
    return this.findById(id)
  }

  findById(id: string): Run | undefined {
    const row = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as any
    return row ? rowToRun(row) : undefined
  }

  findByJobId(jobId: string, limit = 100): Run[] {
    return (this.db.prepare('SELECT * FROM runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?')
      .all(jobId, limit) as any[]).map(rowToRun)
  }

  findAll(limit = 500): Run[] {
    return (this.db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?')
      .all(limit) as any[]).map(rowToRun)
  }

  prune(jobId: string, maxRuns: number): void {
    this.db.prepare(`
      DELETE FROM runs WHERE job_id = ? AND id NOT IN (
        SELECT id FROM runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?
      )
    `).run(jobId, jobId, maxRuns)
  }

  markKilled(id: string): void {
    this.db.prepare("UPDATE runs SET ended_at=?, status='killed' WHERE id=?").run(Date.now(), id)
  }
}
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/main/db/runs.ts src/main/db/runs.test.ts
git commit -m "feat: add run history repository"
```

---

### Task 6: Child process executor

**Files:**
- Create: `src/main/executor.ts`
- Test: `src/main/executor.test.ts`

**Step 1: Write failing tests**

Create `src/main/executor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { executeJob } from './executor'

describe('executeJob', () => {
  it('captures stdout from a successful command', async () => {
    const result = await executeJob({ interpreter: 'bash', command: 'echo hello' })
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exit_code).toBe(0)
    expect(result.status).toBe('success')
  })

  it('captures stderr and marks failure on non-zero exit', async () => {
    const result = await executeJob({ interpreter: 'bash', command: 'echo err >&2; exit 1' })
    expect(result.stderr.trim()).toBe('err')
    expect(result.exit_code).toBe(1)
    expect(result.status).toBe('failure')
  })

  it('returns kill handle that terminates process', async () => {
    let killed = false
    const { promise, kill } = executeJobWithHandle({ interpreter: 'bash', command: 'sleep 10' })
    kill()
    const result = await promise
    expect(result.status).toBe('killed')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `executeJob` not found.

**Step 3: Implement `src/main/executor.ts`**

```ts
import { spawn } from 'child_process'
import { RunStatus } from '../shared/types'

export interface ExecuteResult {
  stdout: string
  stderr: string
  exit_code: number
  status: RunStatus
}

export interface ExecuteHandle {
  promise: Promise<ExecuteResult>
  kill: () => void
}

export function executeJobWithHandle(opts: { interpreter: string; command: string }): ExecuteHandle {
  let killed = false
  const proc = spawn(opts.interpreter, ['-c', opts.command], { env: process.env })

  let stdout = ''
  let stderr = ''

  proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
  proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

  const promise = new Promise<ExecuteResult>((resolve) => {
    proc.on('close', (code) => {
      if (killed) {
        resolve({ stdout, stderr, exit_code: code ?? -1, status: 'killed' })
      } else {
        resolve({ stdout, stderr, exit_code: code ?? -1, status: code === 0 ? 'success' : 'failure' })
      }
    })
  })

  return {
    promise,
    kill: () => {
      killed = true
      proc.kill('SIGTERM')
    },
  }
}

export async function executeJob(opts: { interpreter: string; command: string }): Promise<ExecuteResult> {
  return executeJobWithHandle(opts).promise
}
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All executor tests pass.

**Step 5: Commit**

```bash
git add src/main/executor.ts src/main/executor.test.ts
git commit -m "feat: add child process executor with kill support"
```

---

### Task 7: Scheduler engine

**Files:**
- Create: `src/main/scheduler.ts`
- Test: `src/main/scheduler.test.ts`

**Step 1: Write failing tests**

Create `src/main/scheduler.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SchedulerEngine } from './scheduler'

describe('SchedulerEngine', () => {
  it('starts and stops without error', () => {
    const engine = new SchedulerEngine({
      onJobStart: vi.fn(),
      onJobFinish: vi.fn(),
    })
    expect(() => engine.start([])).not.toThrow()
    expect(() => engine.stop()).not.toThrow()
  })

  it('tracks a running job', async () => {
    const onStart = vi.fn()
    const onFinish = vi.fn()
    const engine = new SchedulerEngine({ onJobStart: onStart, onJobFinish: onFinish })

    await engine.runNow({ id: 'j1', interpreter: 'bash', command: 'echo hi', cron: '* * * * *', name: 'test', enabled: true, notify: 'none', created_at: 0, updated_at: 0 })

    expect(onStart).toHaveBeenCalledWith('j1', expect.any(String))
    expect(onFinish).toHaveBeenCalled()
  })

  it('can kill a running job', async () => {
    const onFinish = vi.fn()
    const engine = new SchedulerEngine({ onJobStart: vi.fn(), onJobFinish: onFinish })

    const promise = engine.runNow({ id: 'j1', interpreter: 'bash', command: 'sleep 5', cron: '* * * * *', name: 'test', enabled: true, notify: 'none', created_at: 0, updated_at: 0 })
    await new Promise(r => setTimeout(r, 50))
    engine.killJob('j1')
    const result = await promise
    expect(result.status).toBe('killed')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `SchedulerEngine` not found.

**Step 3: Implement `src/main/scheduler.ts`**

```ts
import cron from 'node-cron'
import { Job, RunStatus } from '../shared/types'
import { executeJobWithHandle, ExecuteResult } from './executor'

interface SchedulerCallbacks {
  onJobStart: (jobId: string, runId: string) => void
  onJobFinish: (jobId: string, runId: string, result: ExecuteResult) => void
}

interface ActiveRun {
  runId: string
  kill: () => void
}

export class SchedulerEngine {
  private tasks = new Map<string, cron.ScheduledTask>()
  private activeRuns = new Map<string, ActiveRun>()
  private callbacks: SchedulerCallbacks

  constructor(callbacks: SchedulerCallbacks) {
    this.callbacks = callbacks
  }

  start(jobs: Job[]): void {
    for (const job of jobs) {
      if (job.enabled) this.scheduleJob(job)
    }
  }

  stop(): void {
    for (const task of this.tasks.values()) task.stop()
    this.tasks.clear()
  }

  addJob(job: Job): void {
    this.removeJob(job.id)
    if (job.enabled) this.scheduleJob(job)
  }

  removeJob(jobId: string): void {
    this.tasks.get(jobId)?.stop()
    this.tasks.delete(jobId)
  }

  killJob(jobId: string): void {
    this.activeRuns.get(jobId)?.kill()
  }

  isRunning(jobId: string): boolean {
    return this.activeRuns.has(jobId)
  }

  getRunningJobIds(): string[] {
    return Array.from(this.activeRuns.keys())
  }

  async runNow(job: Job): Promise<ExecuteResult> {
    return this.executeJob(job)
  }

  private scheduleJob(job: Job): void {
    if (!cron.validate(job.cron)) return
    const task = cron.schedule(job.cron, () => this.executeJob(job))
    this.tasks.set(job.id, task)
  }

  private async executeJob(job: Job): Promise<ExecuteResult> {
    if (this.activeRuns.has(job.id)) return { stdout: '', stderr: 'Already running', exit_code: -1, status: 'failure' }

    const runId = `${job.id}-${Date.now()}`
    const { promise, kill } = executeJobWithHandle({ interpreter: job.interpreter, command: job.command })
    this.activeRuns.set(job.id, { runId, kill })
    this.callbacks.onJobStart(job.id, runId)

    const result = await promise
    this.activeRuns.delete(job.id)
    this.callbacks.onJobFinish(job.id, runId, result)
    return result
  }
}
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All scheduler tests pass.

**Step 5: Commit**

```bash
git add src/main/scheduler.ts src/main/scheduler.test.ts
git commit -m "feat: add scheduler engine with run-now and kill support"
```

---

### Task 8: IPC bridge — channels, preload, and main handlers

**Files:**
- Create: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Create: `src/main/ipc-handlers.ts`

**Step 1: Define IPC channels in `src/shared/ipc-channels.ts`**

```ts
export const IPC = {
  // Jobs
  JOBS_LIST:    'jobs:list',
  JOBS_CREATE:  'jobs:create',
  JOBS_UPDATE:  'jobs:update',
  JOBS_DELETE:  'jobs:delete',
  JOBS_RUN_NOW: 'jobs:runNow',
  JOBS_KILL:    'jobs:kill',

  // Runs
  RUNS_LIST:        'runs:list',
  RUNS_LIST_BY_JOB: 'runs:listByJob',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Push events (main → renderer)
  JOB_STARTED:  'event:jobStarted',
  JOB_FINISHED: 'event:jobFinished',
} as const
```

**Step 2: Update `src/preload/index.ts` to expose the bridge**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

contextBridge.exposeInMainWorld('cronManager', {
  jobs: {
    list: () => ipcRenderer.invoke(IPC.JOBS_LIST),
    create: (input: unknown) => ipcRenderer.invoke(IPC.JOBS_CREATE, input),
    update: (id: string, input: unknown) => ipcRenderer.invoke(IPC.JOBS_UPDATE, id, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.JOBS_DELETE, id),
    runNow: (id: string) => ipcRenderer.invoke(IPC.JOBS_RUN_NOW, id),
    kill: (id: string) => ipcRenderer.invoke(IPC.JOBS_KILL, id),
  },
  runs: {
    list: () => ipcRenderer.invoke(IPC.RUNS_LIST),
    listByJob: (jobId: string) => ipcRenderer.invoke(IPC.RUNS_LIST_BY_JOB, jobId),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
  },
  on: {
    jobStarted: (cb: (jobId: string, runId: string) => void) => {
      ipcRenderer.on(IPC.JOB_STARTED, (_e, jobId, runId) => cb(jobId, runId))
    },
    jobFinished: (cb: (jobId: string, runId: string) => void) => {
      ipcRenderer.on(IPC.JOB_FINISHED, (_e, jobId, runId) => cb(jobId, runId))
    },
  },
})
```

**Step 3: Create `src/main/ipc-handlers.ts`**

```ts
import { ipcMain, BrowserWindow, Notification } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { JobRepository } from './db/jobs'
import { RunRepository } from './db/runs'
import { SchedulerEngine } from './scheduler'
import Database from 'better-sqlite3'

export function registerIpcHandlers(
  db: Database.Database,
  scheduler: SchedulerEngine,
  getWindow: () => BrowserWindow | null
): void {
  const jobRepo = new JobRepository(db)
  const runRepo = new RunRepository(db)

  const maxRunsPerJob = (): number => {
    const row = db.prepare("SELECT value FROM settings WHERE key='max_runs_per_job'").get() as any
    return parseInt(row?.value ?? '100', 10)
  }

  // Wire scheduler callbacks to push events + persist
  scheduler['callbacks'] = {
    onJobStart: (jobId, runId) => {
      runRepo.start(jobId) // Note: runId from scheduler is internal; we use runRepo's own UUID
      getWindow()?.webContents.send(IPC.JOB_STARTED, jobId)
    },
    onJobFinish: (jobId, _runId, result) => {
      const activeRun = runRepo.findByJobId(jobId, 1).find(r => r.status === 'running')
      if (activeRun) {
        runRepo.finish(activeRun.id, result)
        runRepo.prune(jobId, maxRunsPerJob())
        const job = jobRepo.findById(jobId)
        if (job && (job.notify === 'all' || (job.notify === 'failure' && result.status === 'failure'))) {
          new Notification({ title: job.name, body: `${result.status} (exit ${result.exit_code})` }).show()
        }
      }
      getWindow()?.webContents.send(IPC.JOB_FINISHED, jobId)
    },
  }

  ipcMain.handle(IPC.JOBS_LIST, () => jobRepo.findAll())
  ipcMain.handle(IPC.JOBS_CREATE, (_e, input) => {
    const job = jobRepo.create(input)
    scheduler.addJob(job)
    return job
  })
  ipcMain.handle(IPC.JOBS_UPDATE, (_e, id, input) => {
    const job = jobRepo.update(id, input)
    if (job) scheduler.addJob(job)
    return job
  })
  ipcMain.handle(IPC.JOBS_DELETE, (_e, id) => {
    scheduler.removeJob(id)
    jobRepo.delete(id)
  })
  ipcMain.handle(IPC.JOBS_RUN_NOW, (_e, id) => {
    const job = jobRepo.findById(id)
    if (job) scheduler.runNow(job)
  })
  ipcMain.handle(IPC.JOBS_KILL, (_e, id) => scheduler.killJob(id))
  ipcMain.handle(IPC.RUNS_LIST, () => runRepo.findAll())
  ipcMain.handle(IPC.RUNS_LIST_BY_JOB, (_e, jobId) => runRepo.findByJobId(jobId))
  ipcMain.handle(IPC.SETTINGS_GET, (_e, key) => {
    return (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any)?.value
  })
  ipcMain.handle(IPC.SETTINGS_SET, (_e, key, value) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  })
}
```

**Step 4: Wire everything in `src/main/index.ts`**

Open `src/main/index.ts` (the electron main entry). Add initialization:

```ts
import { app, BrowserWindow, Tray, nativeImage, Menu } from 'electron'
import path from 'path'
import { createDatabase } from './db/database'
import { JobRepository } from './db/jobs'
import { SchedulerEngine } from './scheduler'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const db = createDatabase(path.join(app.getPath('userData'), 'cron-manager.db'))
const jobRepo = new JobRepository(db)

const scheduler = new SchedulerEngine({
  onJobStart: () => {},
  onJobFinish: () => {},
})

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL!)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
  })

  registerIpcHandlers(db, scheduler, () => mainWindow)

  // Load and start all enabled jobs
  scheduler.start(jobRepo.findAll())

  app.setLoginItemSettings({ openAtLogin: true })
})

app.on('window-all-closed', () => {
  // Do not quit — stay in tray
})
```

**Step 5: Verify app boots without errors**

```bash
npm run dev
```

Expected: Electron opens, no errors in terminal console about missing modules.

**Step 6: Commit**

```bash
git add src/shared/ipc-channels.ts src/preload/index.ts src/main/ipc-handlers.ts src/main/index.ts
git commit -m "feat: add ipc bridge, preload, and main handlers"
```

---

### Task 9: Tray icon with animated running indicator

**Files:**
- Create: `resources/tray-icon.png` (16x16 or 22x22 template image — use a placeholder)
- Create: `resources/tray-icon-active.png`
- Modify: `src/main/index.ts`

**Step 1: Create placeholder tray icons**

For now use Node to generate minimal 22x22 black squares as PNG. Install `sharp` temporarily or use a simple base64 PNG.

In `src/main/index.ts`, add after window creation:

```ts
// Tray setup
const iconPath = path.join(__dirname, '../../resources/tray-icon.png')
tray = new Tray(nativeImage.createFromPath(iconPath))
tray.setToolTip('Cron Manager')
tray.on('click', () => {
  if (mainWindow?.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow?.show()
    mainWindow?.focus()
  }
})

function updateTrayMenu(): void {
  const running = scheduler.getRunningJobIds()
  const runningLabel = running.length > 0 ? `${running.length} job(s) running` : 'No jobs running'
  const menu = Menu.buildFromTemplate([
    { label: runningLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open Cron Manager', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.exit(0) } },
  ])
  tray!.setContextMenu(menu)
}

// Update tray menu whenever a job starts or finishes
// (wire to scheduler callbacks after registerIpcHandlers)
updateTrayMenu()
```

**Step 2: Add tray icon assets**

Create a minimal valid PNG. Run this once to generate placeholder icons:

```bash
# Install a simple image utility just for generating placeholder icons
node -e "
const fs = require('fs');
// 1x1 black pixel PNG (base64)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
fs.mkdirSync('resources', { recursive: true });
fs.writeFileSync('resources/tray-icon.png', png);
fs.writeFileSync('resources/tray-icon-active.png', png);
"
```

Note: Replace with proper 22x22 icons before shipping.

**Step 3: Verify tray icon appears**

```bash
npm run dev
```

Expected: An icon appears in the macOS menubar. Clicking it toggles the window.

**Step 4: Commit**

```bash
git add src/main/index.ts resources/
git commit -m "feat: add tray icon with click-to-toggle window"
```

---

### Task 10: React app shell — layout and tabs

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/components/Layout.tsx`
- Create: `src/renderer/src/pages/JobsPage.tsx` (stub)
- Create: `src/renderer/src/pages/CalendarPage.tsx` (stub)
- Create: `src/renderer/src/pages/HistoryPage.tsx` (stub)
- Create: `src/renderer/src/types/window.d.ts`

**Step 1: Declare the `window.cronManager` API type**

Create `src/renderer/src/types/window.d.ts`:

```ts
import { Job, Run, CreateJobInput, UpdateJobInput } from '../../../shared/types'

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
  }
  settings: {
    get: (key: string) => Promise<string | undefined>
    set: (key: string, value: string) => Promise<void>
  }
  on: {
    jobStarted: (cb: (jobId: string) => void) => void
    jobFinished: (cb: (jobId: string) => void) => void
  }
}

declare global {
  interface Window {
    cronManager: CronManagerAPI
  }
}
```

**Step 2: Create `src/renderer/src/components/Layout.tsx`**

```tsx
import { useState } from 'react'
import JobsPage from '../pages/JobsPage'
import CalendarPage from '../pages/CalendarPage'
import HistoryPage from '../pages/HistoryPage'

type Tab = 'jobs' | 'calendar' | 'history'

export default function Layout() {
  const [tab, setTab] = useState<Tab>('jobs')

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <nav className="flex border-b border-gray-800 px-4">
        {(['jobs', 'calendar', 'history'] as Tab[]).map(t => (
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
      <main className="flex-1 overflow-auto">
        {tab === 'jobs' && <JobsPage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'history' && <HistoryPage />}
      </main>
    </div>
  )
}
```

**Step 3: Create stub pages**

`src/renderer/src/pages/JobsPage.tsx`:
```tsx
export default function JobsPage() {
  return <div className="p-4">Jobs</div>
}
```

`src/renderer/src/pages/CalendarPage.tsx`:
```tsx
export default function CalendarPage() {
  return <div className="p-4">Calendar</div>
}
```

`src/renderer/src/pages/HistoryPage.tsx`:
```tsx
export default function HistoryPage() {
  return <div className="p-4">History</div>
}
```

**Step 4: Update `src/renderer/src/App.tsx`**

```tsx
import Layout from './components/Layout'

export default function App() {
  return <Layout />
}
```

**Step 5: Verify tabs render**

```bash
npm run dev
```

Expected: Three tabs visible, clicking switches the placeholder content.

**Step 6: Commit**

```bash
git add src/renderer/src/
git commit -m "feat: add app shell with three-tab layout"
```

---

### Task 11: Jobs tab — list with status indicators

**Files:**
- Modify: `src/renderer/src/pages/JobsPage.tsx`
- Create: `src/renderer/src/hooks/useJobs.ts`

**Step 1: Create `src/renderer/src/hooks/useJobs.ts`**

```ts
import { useState, useEffect, useCallback } from 'react'
import { Job } from '../../../../shared/types'

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    setJobs(await window.cronManager.jobs.list())
  }, [])

  useEffect(() => {
    refresh()
    window.cronManager.on.jobStarted((jobId) => {
      setRunningIds(prev => new Set([...prev, jobId]))
      refresh()
    })
    window.cronManager.on.jobFinished((jobId) => {
      setRunningIds(prev => { const s = new Set(prev); s.delete(jobId); return s })
      refresh()
    })
  }, [refresh])

  return { jobs, runningIds, refresh }
}
```

**Step 2: Implement `JobsPage.tsx`**

```tsx
import { useState } from 'react'
import { useJobs } from '../hooks/useJobs'
import { Job } from '../../../../shared/types'
import JobEditorDrawer from '../components/JobEditorDrawer'
import cronstrue from 'cronstrue'

function nextRunLabel(cronExpr: string): string {
  try { return cronstrue.toString(cronExpr, { verbose: false }) } catch { return cronExpr }
}

export default function JobsPage() {
  const { jobs, runningIds, refresh } = useJobs()
  const [editingJob, setEditingJob] = useState<Job | null | 'new'>(null)

  const toggleEnabled = async (job: Job) => {
    await window.cronManager.jobs.update(job.id, { enabled: !job.enabled })
    refresh()
  }

  const handleKill = async (job: Job) => {
    await window.cronManager.jobs.kill(job.id)
  }

  const handleDelete = async (job: Job) => {
    if (confirm(`Delete "${job.name}"?`)) {
      await window.cronManager.jobs.delete(job.id)
      refresh()
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Jobs</h2>
        <button
          onClick={() => setEditingJob('new')}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm"
        >
          + New Job
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800 text-left">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Schedule</th>
            <th className="py-2 pr-4">Interpreter</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => {
            const isRunning = runningIds.has(job.id)
            return (
              <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-2 pr-4 font-medium">{job.name}</td>
                <td className="py-2 pr-4 text-gray-400 text-xs">{nextRunLabel(job.cron)}</td>
                <td className="py-2 pr-4">
                  <span className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">{job.interpreter}</span>
                </td>
                <td className="py-2 pr-4">
                  {isRunning ? (
                    <span className="flex items-center gap-1 text-green-400 text-xs">
                      <span className="animate-spin">⟳</span> running
                    </span>
                  ) : (
                    <span className={`text-xs ${job.enabled ? 'text-gray-400' : 'text-gray-600'}`}>
                      {job.enabled ? 'scheduled' : 'disabled'}
                    </span>
                  )}
                </td>
                <td className="py-2 flex gap-2">
                  <button onClick={() => toggleEnabled(job)} className="text-xs text-gray-400 hover:text-white">
                    {job.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => setEditingJob(job)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                  {isRunning && (
                    <button onClick={() => handleKill(job)} className="text-xs text-yellow-400 hover:text-yellow-300">Kill</button>
                  )}
                  <button onClick={() => handleDelete(job)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {editingJob !== null && (
        <JobEditorDrawer
          job={editingJob === 'new' ? null : editingJob}
          onClose={() => setEditingJob(null)}
          onSave={refresh}
        />
      )}
    </div>
  )
}
```

**Step 3: Verify visually**

```bash
npm run dev
```

Expected: Jobs tab shows table with New Job button. No jobs yet — empty table is fine.

**Step 4: Commit**

```bash
git add src/renderer/src/pages/JobsPage.tsx src/renderer/src/hooks/useJobs.ts
git commit -m "feat: implement jobs tab with list and status"
```

---

### Task 12: Job editor drawer

**Files:**
- Create: `src/renderer/src/components/JobEditorDrawer.tsx`

**Step 1: Implement `JobEditorDrawer.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Job, Interpreter, NotifySetting } from '../../../../shared/types'
import cronstrue from 'cronstrue'

const INTERPRETERS: Interpreter[] = ['bash', 'sh', 'zsh', 'node', 'python3', 'ruby']

interface Props {
  job: Job | null
  onClose: () => void
  onSave: () => void
}

export default function JobEditorDrawer({ job, onClose, onSave }: Props) {
  const [name, setName] = useState(job?.name ?? '')
  const [cron, setCron] = useState(job?.cron ?? '0 * * * *')
  const [interpreter, setInterpreter] = useState<Interpreter>(job?.interpreter ?? 'bash')
  const [command, setCommand] = useState(job?.command ?? '')
  const [notify, setNotify] = useState<NotifySetting>(job?.notify ?? 'failure')
  const [enabled, setEnabled] = useState(job?.enabled ?? true)
  const [saving, setSaving] = useState(false)

  let cronDescription = ''
  try { cronDescription = cronstrue.toString(cron) } catch { cronDescription = 'Invalid cron expression' }

  const handleRunNow = async () => {
    if (job) await window.cronManager.jobs.runNow(job.id)
  }

  const handleSave = async () => {
    setSaving(true)
    if (job) {
      await window.cronManager.jobs.update(job.id, { name, cron, interpreter, command, notify, enabled })
    } else {
      await window.cronManager.jobs.create({ name, cron, interpreter, command, notify, enabled })
    }
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-10" onClick={onClose}>
      <div className="w-96 bg-gray-900 h-full overflow-auto p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">{job ? 'Edit Job' : 'New Job'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Name
          <input value={name} onChange={e => setName(e.target.value)}
            className="bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Cron Expression
          <input value={cron} onChange={e => setCron(e.target.value)}
            className="bg-gray-800 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-400">{cronDescription}</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Interpreter
          <select value={interpreter} onChange={e => setInterpreter(e.target.value as Interpreter)}
            className="bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500">
            {INTERPRETERS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Command
          <textarea value={command} onChange={e => setCommand(e.target.value)} rows={4}
            className="bg-gray-800 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Notifications
          <select value={notify} onChange={e => setNotify(e.target.value as NotifySetting)}
            className="bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500">
            <option value="all">All completions</option>
            <option value="failure">Failures only</option>
            <option value="none">None</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Enabled
        </label>

        <div className="flex gap-2 mt-auto pt-4">
          {job && (
            <button onClick={handleRunNow}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              Run Now
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify job creation and editing work**

```bash
npm run dev
```

Expected: Click "New Job", fill in form, save — job appears in table. Click "Edit" on an existing job — drawer opens prepopulated.

**Step 3: Commit**

```bash
git add src/renderer/src/components/JobEditorDrawer.tsx
git commit -m "feat: add job editor drawer with cron preview"
```

---

### Task 13: History tab

**Files:**
- Modify: `src/renderer/src/pages/HistoryPage.tsx`

**Step 1: Implement `HistoryPage.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Run } from '../../../../shared/types'

const STATUS_COLORS = {
  success: 'text-green-400',
  failure: 'text-red-400',
  killed: 'text-yellow-400',
  running: 'text-blue-400',
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = async () => {
    setRuns(await window.cronManager.runs.list())
  }

  useEffect(() => {
    refresh()
    window.cronManager.on.jobFinished(() => refresh())
  }, [])

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">History</h2>
      <div className="space-y-1">
        {runs.map(run => (
          <div key={run.id} className="border border-gray-800 rounded">
            <button
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-900/50 text-left"
              onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
            >
              <span className={`font-medium ${STATUS_COLORS[run.status]}`}>{run.status}</span>
              <span className="text-gray-400">{run.job_id}</span>
              <span className="ml-auto text-gray-500 text-xs">
                {new Date(run.started_at).toLocaleString()}
              </span>
              {run.ended_at && (
                <span className="text-gray-500 text-xs">
                  {((run.ended_at - run.started_at) / 1000).toFixed(1)}s
                </span>
              )}
            </button>
            {expandedId === run.id && (
              <div className="border-t border-gray-800 bg-gray-950 p-3">
                {run.stdout && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-500 mb-1">stdout</div>
                    <pre className="text-xs text-green-300 whitespace-pre-wrap font-mono">{run.stdout}</pre>
                  </div>
                )}
                {run.stderr && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">stderr</div>
                    <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">{run.stderr}</pre>
                  </div>
                )}
                {!run.stdout && !run.stderr && (
                  <span className="text-xs text-gray-500">No output</span>
                )}
              </div>
            )}
          </div>
        ))}
        {runs.length === 0 && <p className="text-gray-500 text-sm">No runs yet.</p>}
      </div>
    </div>
  )
}
```

**Step 2: Verify history renders**

```bash
npm run dev
```

Expected: History tab shows runs after triggering "Run Now" from a job. Click a row to expand stdout/stderr.

**Step 3: Commit**

```bash
git add src/renderer/src/pages/HistoryPage.tsx
git commit -m "feat: implement history tab with expandable stdout/stderr"
```

---

### Task 14: Calendar — month view

**Files:**
- Modify: `src/renderer/src/pages/CalendarPage.tsx`
- Create: `src/renderer/src/components/CalendarMonthView.tsx`
- Create: `src/renderer/src/utils/schedule.ts`

**Step 1: Create `src/renderer/src/utils/schedule.ts`**

This utility computes which dates a cron job fires in a given month.

```ts
import { parseExpression } from 'cron-parser'

export function getRunDatesInMonth(cronExpr: string, year: number, month: number): Date[] {
  // month is 0-indexed (JS Date convention)
  const start = new Date(year, month, 1, 0, 0, 0)
  const end = new Date(year, month + 1, 1, 0, 0, 0)
  const dates: Date[] = []

  try {
    const interval = parseExpression(cronExpr, { currentDate: start, endDate: end })
    while (true) {
      try {
        const next = interval.next().toDate()
        if (next >= end) break
        dates.push(next)
      } catch {
        break
      }
    }
  } catch {
    // invalid expression
  }

  return dates
}
```

Install `cron-parser`:

```bash
npm install cron-parser
```

**Step 2: Create `CalendarMonthView.tsx`**

```tsx
import { useState } from 'react'
import { Job } from '../../../../shared/types'
import { getRunDatesInMonth } from '../utils/schedule'

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-red-500']

interface Props { jobs: Job[] }

export default function CalendarMonthView({ jobs }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()

  // Map day → jobs that run on that day
  const dayJobMap = new Map<number, Job[]>()
  jobs.forEach((job, i) => {
    const dates = getRunDatesInMonth(job.cron, year, month)
    dates.forEach(d => {
      const day = d.getDate()
      if (!dayJobMap.has(day)) dayJobMap.set(day, [])
      if (!dayJobMap.get(day)!.includes(job)) dayJobMap.get(day)!.push(job)
    })
  })

  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          className="px-2 text-gray-400 hover:text-white">‹</button>
        <span className="font-medium">{monthName}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          className="px-2 text-gray-400 hover:text-white">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dayJobs = dayJobMap.get(day) ?? []
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          return (
            <button key={day}
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
              className={`aspect-square rounded flex flex-col items-center p-1 text-xs transition-colors
                ${isToday ? 'bg-blue-900/50 text-blue-300' : 'hover:bg-gray-800'}
                ${selectedDay === day ? 'ring-1 ring-blue-500' : ''}`}
            >
              <span>{day}</span>
              <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                {dayJobs.slice(0, 4).map((_, j) => (
                  <div key={j} className={`w-1.5 h-1.5 rounded-full ${COLORS[j % COLORS.length]}`} />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {selectedDay !== null && (
        <div className="mt-4 border border-gray-800 rounded p-3">
          <h4 className="text-sm font-medium mb-2">
            {new Date(year, month, selectedDay).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h4>
          {(dayJobMap.get(selectedDay) ?? []).length === 0 ? (
            <p className="text-xs text-gray-500">No jobs scheduled</p>
          ) : (
            <ul className="space-y-1">
              {(dayJobMap.get(selectedDay) ?? []).map(job => (
                <li key={job.id} className="text-sm text-gray-300">{job.name} <span className="text-xs text-gray-500 font-mono">{job.cron}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/renderer/src/utils/schedule.ts src/renderer/src/components/CalendarMonthView.tsx
git commit -m "feat: add calendar month view with job dots"
```

---

### Task 15: Calendar — timeline view and page wiring

**Files:**
- Create: `src/renderer/src/components/CalendarTimelineView.tsx`
- Modify: `src/renderer/src/pages/CalendarPage.tsx`

**Step 1: Create `CalendarTimelineView.tsx`**

```tsx
import { useState } from 'react'
import { Job } from '../../../../shared/types'
import { getRunDatesInMonth } from '../utils/schedule'

const COLORS = ['border-blue-500 bg-blue-500/20', 'border-green-500 bg-green-500/20',
                 'border-purple-500 bg-purple-500/20', 'border-yellow-500 bg-yellow-500/20']

interface Props { jobs: Job[] }

export default function CalendarTimelineView({ jobs }: Props) {
  const today = new Date()
  const [date, setDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

  const goDay = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d)
  }

  // Get runs for this specific day
  const dayRuns: { job: Job; times: Date[] }[] = jobs.map(job => ({
    job,
    times: getRunDatesInMonth(job.cron, date.getFullYear(), date.getMonth()).filter(d => d.getDate() === date.getDate()),
  })).filter(x => x.times.length > 0)

  const HOURS = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => goDay(-1)} className="px-2 text-gray-400 hover:text-white">‹</button>
        <span className="font-medium">
          {date.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
        <button onClick={() => goDay(1)} className="px-2 text-gray-400 hover:text-white">›</button>
      </div>

      <div className="relative overflow-auto">
        {HOURS.map(hour => (
          <div key={hour} className="flex border-t border-gray-800/50" style={{ minHeight: '48px' }}>
            <div className="w-12 text-xs text-gray-600 pt-1 flex-shrink-0">
              {String(hour).padStart(2, '0')}:00
            </div>
            <div className="flex-1 relative px-2">
              {dayRuns.map(({ job, times }, jobIdx) =>
                times
                  .filter(t => t.getHours() === hour)
                  .map((t, i) => (
                    <div key={`${job.id}-${i}`}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border mr-1 ${COLORS[jobIdx % COLORS.length]}`}
                    >
                      {job.name} <span className="ml-1 text-gray-400">{String(t.getMinutes()).padStart(2,'0')}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        ))}
        {dayRuns.length === 0 && (
          <p className="text-gray-500 text-sm mt-4 ml-12">No jobs scheduled for this day.</p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Wire both views in `CalendarPage.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Job } from '../../../../shared/types'
import CalendarMonthView from '../components/CalendarMonthView'
import CalendarTimelineView from '../components/CalendarTimelineView'

type View = 'month' | 'timeline'

export default function CalendarPage() {
  const [view, setView] = useState<View>('month')
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    window.cronManager.jobs.list().then(setJobs)
  }, [])

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Calendar</h2>
        <div className="flex gap-1 bg-gray-800 rounded p-1">
          {(['month', 'timeline'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded capitalize transition-colors ${
                view === v ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? <CalendarMonthView jobs={jobs} /> : <CalendarTimelineView jobs={jobs} />}
    </div>
  )
}
```

**Step 3: Verify calendar views**

```bash
npm run dev
```

Expected: Calendar tab shows month view with colored dots on days jobs fire. Switching to Timeline shows hourly breakdown.

**Step 4: Commit**

```bash
git add src/renderer/src/components/CalendarTimelineView.tsx src/renderer/src/pages/CalendarPage.tsx
git commit -m "feat: add calendar timeline view and wire calendar page"
```

---

### Task 16: electron-builder packaging config

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json` (add build script)

**Step 1: Create `electron-builder.yml`**

```yaml
appId: com.yourname.cronmanager
productName: Cron Manager
directories:
  output: dist-electron
mac:
  category: public.app-category.utilities
  icon: resources/icon.icns
  target:
    - dmg
    - zip
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
nativeRebuilder: false
```

**Step 2: Add build script to `package.json`**

```json
"build:mac": "electron-vite build && electron-builder --mac"
```

**Step 3: Verify build completes**

```bash
npm run build:mac
```

Expected: `dist-electron/` folder created with `.dmg` and/or `.app`. No native module errors.

**Step 4: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "chore: add electron-builder mac packaging config"
```

---

## Summary of Deliverables

| Feature | Tasks |
|---|---|
| Project scaffold + Tailwind | 1–2 |
| SQLite + CRUD repositories | 3–5 |
| Executor + Scheduler | 6–7 |
| IPC bridge + Tray | 8–9 |
| App shell + Jobs tab + Editor | 10–12 |
| History tab | 13 |
| Calendar (month + timeline) | 14–15 |
| Packaging | 16 |

All tests are in `src/main/**/*.test.ts` and run with `npm test`.
