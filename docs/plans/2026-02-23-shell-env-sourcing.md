# Shell Environment Sourcing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-job `source_shell_config` boolean (default `true`) that captures the user's login shell environment before running each job, so PATH, custom vars, etc. from `.zshrc`/`.bash_profile` are available.

**Architecture:** Before spawning the job interpreter, optionally run `$SHELL -l -c env` in a one-shot login shell, parse the stdout into an env object, and pass it to `spawn()`. Falls back to `process.env` on error. Works uniformly for all interpreter types.

**Tech Stack:** Vitest, better-sqlite3, Node.js `child_process.spawn`

---

### Task 1: Schema — add `source_shell_config` column

**Files:**
- Modify: `src/main/db/schema.ts`
- Modify: `src/main/db/database.ts`
- Test: `src/main/db/database.test.ts`

**Step 1: Write the failing test**

Add to `src/main/db/database.test.ts`:

```typescript
it('jobs table has source_shell_config column defaulting to 1', () => {
  const info = db.prepare("PRAGMA table_info(jobs)").all() as any[]
  const col = info.find(c => c.name === 'source_shell_config')
  expect(col).toBeTruthy()
  expect(col.dflt_value).toBe('1')
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/db/database.test.ts
```

Expected: FAIL — `col` is undefined.

**Step 3: Add column to `CREATE TABLE` in `src/main/db/schema.ts`**

In the `jobs` table definition, add after the `notify` line:

```sql
    source_shell_config INTEGER DEFAULT 1,
```

Full updated table (replace the existing jobs table block):

```sql
  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    cron        TEXT NOT NULL,
    interpreter TEXT NOT NULL,
    command     TEXT NOT NULL,
    enabled     INTEGER DEFAULT 1,
    notify      TEXT DEFAULT 'failure',
    source_shell_config INTEGER DEFAULT 1,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
```

**Step 4: Add migration for existing databases in `src/main/db/database.ts`**

After the `db.exec(SCHEMA)` line, add:

```typescript
// Migration: add source_shell_config for existing databases
try {
  db.exec("ALTER TABLE jobs ADD COLUMN source_shell_config INTEGER DEFAULT 1")
} catch {
  // Column already exists — safe to ignore
}
```

**Step 5: Run test to verify it passes**

```bash
npx vitest run src/main/db/database.test.ts
```

Expected: all PASS.

**Step 6: Commit**

```bash
git add src/main/db/schema.ts src/main/db/database.ts src/main/db/database.test.ts
git commit -m "feat: add source_shell_config column to jobs table with migration"
```

---

### Task 2: Types — add `source_shell_config` to shared types

**Files:**
- Modify: `src/shared/types.ts`

No test needed — TypeScript compilation enforces correctness across the codebase.

**Step 1: Update `Job` interface**

Add `source_shell_config: boolean` as a required field after `notify`:

```typescript
export interface Job {
  id: string
  name: string
  cron: string
  interpreter: Interpreter
  command: string
  enabled: boolean
  notify: NotifySetting
  source_shell_config: boolean
  created_at: number
  updated_at: number
}
```

**Step 2: Update `CreateJobInput` interface**

Add `source_shell_config?: boolean` as optional (defaults to `true` in the repo):

```typescript
export interface CreateJobInput {
  name: string
  cron: string
  interpreter: Interpreter
  command: string
  enabled?: boolean
  notify?: NotifySetting
  source_shell_config?: boolean
}
```

**Step 3: Verify typecheck passes (expect errors — fixed in later tasks)**

```bash
npm run typecheck
```

Expected: TypeScript errors in `jobs.ts`, `scheduler.test.ts` — that's expected and will be fixed in subsequent tasks.

**Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add source_shell_config to Job and CreateJobInput types"
```

---

### Task 3: JobRepository — persist and retrieve `source_shell_config`

**Files:**
- Modify: `src/main/db/jobs.ts`
- Test: `src/main/db/jobs.test.ts`

**Step 1: Write the failing tests**

Add to `src/main/db/jobs.test.ts`:

```typescript
it('defaults source_shell_config to true when not specified', () => {
  const job = repo.create({ name: 'Test', cron: '* * * * *', interpreter: 'bash', command: 'echo hi' })
  expect(job.source_shell_config).toBe(true)
})

it('persists source_shell_config: false', () => {
  const job = repo.create({ name: 'Test', cron: '* * * * *', interpreter: 'bash', command: 'echo hi', source_shell_config: false })
  expect(job.source_shell_config).toBe(false)
})

it('updates source_shell_config', () => {
  const job = repo.create({ name: 'Test', cron: '* * * * *', interpreter: 'bash', command: 'echo hi' })
  const updated = repo.update(job.id, { source_shell_config: false })
  expect(updated?.source_shell_config).toBe(false)
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/main/db/jobs.test.ts
```

Expected: FAIL — `source_shell_config` is `undefined`.

**Step 3: Update `rowToJob` in `src/main/db/jobs.ts`**

Replace:

```typescript
function rowToJob(row: any): Job {
  return { ...row, enabled: row.enabled === 1 }
}
```

With:

```typescript
function rowToJob(row: any): Job {
  return { ...row, enabled: row.enabled === 1, source_shell_config: row.source_shell_config === 1 }
}
```

**Step 4: Update `create` method**

Replace the `INSERT` and `.run()` call:

```typescript
create(input: CreateJobInput): Job {
  const now = Date.now()
  const id = uuidv4()
  this.db.prepare(`
    INSERT INTO jobs (id, name, cron, interpreter, command, enabled, notify, source_shell_config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.name, input.cron, input.interpreter, input.command,
         input.enabled !== false ? 1 : 0, input.notify ?? 'failure',
         input.source_shell_config !== false ? 1 : 0, now, now)
  return this.findById(id)!
}
```

**Step 5: Update `update` method**

Replace the `UPDATE` and `.run()` call:

```typescript
update(id: string, input: UpdateJobInput): Job | undefined {
  const existing = this.findById(id)
  if (!existing) return undefined
  const now = Date.now()
  const merged = { ...existing, ...input, updated_at: now }
  this.db.prepare(`
    UPDATE jobs SET name=?, cron=?, interpreter=?, command=?, enabled=?, notify=?, source_shell_config=?, updated_at=? WHERE id=?
  `).run(merged.name, merged.cron, merged.interpreter, merged.command,
         merged.enabled ? 1 : 0, merged.notify, merged.source_shell_config ? 1 : 0, now, id)
  return this.findById(id)
}
```

**Step 6: Run tests to verify they pass**

```bash
npx vitest run src/main/db/jobs.test.ts
```

Expected: all PASS.

**Step 7: Commit**

```bash
git add src/main/db/jobs.ts src/main/db/jobs.test.ts
git commit -m "feat: persist and retrieve source_shell_config in JobRepository"
```

---

### Task 4: Executor — add `resolveJobEnv` and `env` param

**Files:**
- Modify: `src/main/executor.ts`
- Test: `src/main/executor.test.ts`

**Step 1: Write failing tests**

Add to `src/main/executor.test.ts`:

```typescript
import { executeJob, executeJobWithHandle, resolveJobEnv } from './executor'

describe('resolveJobEnv', () => {
  it('returns process.env when source_shell_config is false', async () => {
    const env = await resolveJobEnv(false)
    expect(env).toBe(process.env)
  })

  it('returns an env object with PATH when source_shell_config is true', async () => {
    const env = await resolveJobEnv(true)
    expect(typeof env).toBe('object')
    expect(env['PATH']).toBeTruthy()
  })
})

describe('executeJob with custom env', () => {
  it('uses provided env vars in the command', async () => {
    const env = { ...process.env, CRON_TEST_VAR: 'hello_from_env' }
    const result = await executeJob({ interpreter: 'bash', command: 'echo $CRON_TEST_VAR', env })
    expect(result.stdout.trim()).toBe('hello_from_env')
    expect(result.status).toBe('success')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/main/executor.test.ts
```

Expected: FAIL — `resolveJobEnv` not exported, `env` param not accepted.

**Step 3: Implement `resolveJobEnv` and update `executeJobWithHandle` in `src/main/executor.ts`**

Replace the entire file content:

```typescript
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

export async function resolveJobEnv(sourceShellConfig: boolean): Promise<NodeJS.ProcessEnv> {
  if (!sourceShellConfig) return process.env

  const shell = process.env.SHELL || '/bin/zsh'

  return new Promise((resolve) => {
    const proc = spawn(shell, ['-l', '-c', 'env'], { env: process.env })
    let output = ''

    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', () => {
      const env: NodeJS.ProcessEnv = {}
      for (const line of output.split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0) {
          env[line.slice(0, eq)] = line.slice(eq + 1)
        }
      }
      resolve(Object.keys(env).length > 0 ? env : process.env)
    })
    proc.on('error', () => resolve(process.env))
  })
}

export function executeJobWithHandle(opts: { interpreter: string; command: string; env?: NodeJS.ProcessEnv }): ExecuteHandle {
  let killed = false
  const proc = spawn(opts.interpreter, ['-c', opts.command], { env: opts.env ?? process.env })

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

export async function executeJob(opts: { interpreter: string; command: string; env?: NodeJS.ProcessEnv }): Promise<ExecuteResult> {
  return executeJobWithHandle(opts).promise
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/main/executor.test.ts
```

Expected: all PASS.

**Step 5: Commit**

```bash
git add src/main/executor.ts src/main/executor.test.ts
git commit -m "feat: add resolveJobEnv and env param to executeJobWithHandle"
```

---

### Task 5: Scheduler — resolve env before spawning

**Files:**
- Modify: `src/main/scheduler.ts`
- Test: `src/main/scheduler.test.ts`

**Step 1: Update existing scheduler tests**

The `Job` literals in `scheduler.test.ts` now require `source_shell_config`. Update both `runNow` calls to add `source_shell_config: true`:

```typescript
await engine.runNow({ id: 'j1', interpreter: 'bash', command: 'echo hi', cron: '* * * * *', name: 'test', enabled: true, notify: 'none', source_shell_config: true, created_at: 0, updated_at: 0 })
```

```typescript
const promise = engine.runNow({ id: 'j1', interpreter: 'bash', command: 'sleep 5', cron: '* * * * *', name: 'test', enabled: true, notify: 'none', source_shell_config: true, created_at: 0, updated_at: 0 })
```

Add a new test for `source_shell_config: false` (verifies it still executes):

```typescript
it('runs job with source_shell_config false without error', async () => {
  const onFinish = vi.fn()
  const engine = new SchedulerEngine({ onJobStart: vi.fn(), onJobFinish: onFinish })
  await engine.runNow({ id: 'j2', interpreter: 'bash', command: 'echo no-env', cron: '* * * * *', name: 'test', enabled: true, notify: 'none', source_shell_config: false, created_at: 0, updated_at: 0 })
  expect(onFinish).toHaveBeenCalledWith('j2', expect.any(String), expect.objectContaining({ status: 'success' }))
})
```

**Step 2: Run tests to verify the new test fails (and existing pass)**

```bash
npx vitest run src/main/scheduler.test.ts
```

Expected: TypeScript errors on the `Job` literals (missing `source_shell_config`). After updating the literals, the new test should FAIL because `executeJob` doesn't yet receive the env.

**Step 3: Update `executeJob` in `src/main/scheduler.ts`**

Import `resolveJobEnv`:

```typescript
import { executeJobWithHandle, ExecuteResult, resolveJobEnv } from './executor'
```

Update the `private async executeJob` method to resolve env first:

```typescript
private async executeJob(job: Job): Promise<ExecuteResult> {
  if (this.activeRuns.has(job.id)) {
    return { stdout: '', stderr: 'Already running', exit_code: -1, status: 'failure' }
  }

  const env = await resolveJobEnv(job.source_shell_config)
  const runId = `${job.id}-${Date.now()}`
  const { promise, kill } = executeJobWithHandle({ interpreter: job.interpreter, command: job.command, env })
  this.activeRuns.set(job.id, { runId, kill })
  this.callbacks.onJobStart(job.id, runId)

  const result = await promise
  this.activeRuns.delete(job.id)
  this.callbacks.onJobFinish(job.id, runId, result)
  return result
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/main/scheduler.test.ts
```

Expected: all PASS.

**Step 5: Run full test suite**

```bash
npm test
```

Expected: all PASS.

**Step 6: Commit**

```bash
git add src/main/scheduler.ts src/main/scheduler.test.ts
git commit -m "feat: resolve login shell env before spawning job interpreter"
```

---

### Task 6: UI — add checkbox to JobEditorDrawer

**Files:**
- Modify: `src/renderer/src/components/JobEditorDrawer.tsx`

No automated test — verify visually with `npm run dev`.

**Step 1: Add state**

In `JobEditorDrawer`, add after the `enabled` state line:

```typescript
const [sourceShellConfig, setSourceShellConfig] = useState(job?.source_shell_config ?? true)
```

**Step 2: Add checkbox to JSX**

Add the following block immediately after the "Enabled" checkbox label (around line 112):

```tsx
<label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
  <input
    type="checkbox"
    checked={sourceShellConfig}
    onChange={e => setSourceShellConfig(e.target.checked)}
    className="w-4 h-4"
  />
  <span>
    Source shell config
    <span className="text-gray-500 ml-1 text-xs">(~/.zshrc, ~/.bash_profile)</span>
  </span>
</label>
```

**Step 3: Include `source_shell_config` in save calls**

In `handleSave`, add `source_shell_config: sourceShellConfig` to both the `update` and `create` calls:

```typescript
if (job) {
  await window.cronManager.jobs.update(job.id, { name, cron: cronExpr, interpreter, command, notify, enabled, source_shell_config: sourceShellConfig })
} else {
  await window.cronManager.jobs.create({ name, cron: cronExpr, interpreter, command, notify, enabled, source_shell_config: sourceShellConfig })
}
```

**Step 4: Run typecheck to verify no errors**

```bash
npm run typecheck
```

Expected: no errors.

**Step 5: Verify visually**

```bash
npm run dev
```

Open a job editor. Confirm the "Source shell config" checkbox appears below "Enabled" and is checked by default.

**Step 6: Commit**

```bash
git add src/renderer/src/components/JobEditorDrawer.tsx
git commit -m "feat: add source shell config toggle to job editor UI"
```

---

### Task 7: Final verification

**Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

**Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.
