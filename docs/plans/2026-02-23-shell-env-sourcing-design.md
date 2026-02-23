# Shell Environment Sourcing — Design

**Date:** 2026-02-23

## Problem

When jobs run, the Electron process environment is minimal (no login shell). PATH customizations, aliases, and env vars from `.zshrc` / `.bash_profile` are absent, causing scripts that work in a terminal to fail when run as cron jobs.

## Solution

Add a per-job boolean option `source_shell_config` (default `true`). When enabled, the executor spawns a one-shot login shell (`$SHELL -l -c env`) before running the job to capture the user's full shell environment, then passes those env vars to the spawned interpreter.

## Approach: Env Extraction

Before spawning the job interpreter, run:

```
$SHELL -l -c env
```

Parse the stdout output (split on first `=` per line to handle values containing `=`). Pass the resulting env object to `spawn()` instead of `process.env`. Falls back to `process.env` on error or empty output.

This approach works uniformly for **all** interpreter types (bash, zsh, sh, node, python3, ruby) since it only changes the `env` argument — not the interpreter args or command.

## Data Model

### `src/shared/types.ts`

Add `source_shell_config: boolean` to `Job` and `CreateJobInput`.

### DB Schema

New column on `jobs` table:

```sql
source_shell_config INTEGER DEFAULT 1
```

**Migration:** `createDatabase()` runs `ALTER TABLE jobs ADD COLUMN source_shell_config INTEGER DEFAULT 1` inside a try/catch (SQLite throws if column already exists). The `CREATE TABLE` statement also includes the column for new installs.

## Executor (`src/main/executor.ts`)

New async function:

```typescript
async function resolveJobEnv(sourceShellConfig: boolean): Promise<NodeJS.ProcessEnv>
```

- `false` → returns `process.env` immediately
- `true` → spawns `$SHELL -l -c env`, parses output, returns env object; falls back to `process.env` on error

`executeJobWithHandle` gains an optional `env?: NodeJS.ProcessEnv` param, passed to `spawn()`.

## Scheduler (`src/main/scheduler.ts`)

In `executeJob`, await `resolveJobEnv(job.source_shell_config)` before calling `executeJobWithHandle`, passing the resolved env.

## JobRepository (`src/main/db/jobs.ts`)

- `rowToJob`: map `source_shell_config` column (`1`/`0`) to boolean
- `create`: include `source_shell_config` in INSERT (default `1`)
- `update`: include `source_shell_config` in UPDATE

## UI (`src/renderer/src/components/JobEditorDrawer.tsx`)

Add `source_shell_config` state (default `true`). Add checkbox below the "Enabled" checkbox:

```
[x] Source shell config  (~/.zshrc, ~/.bash_profile)
```

Include in `jobs.create` and `jobs.update` calls.

## Files Changed

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `source_shell_config` to `Job`, `CreateJobInput` |
| `src/main/db/schema.ts` | Add column to `CREATE TABLE`; export migration SQL |
| `src/main/db/database.ts` | Run `ALTER TABLE` migration on startup |
| `src/main/db/jobs.ts` | Include field in INSERT, UPDATE, `rowToJob` |
| `src/main/executor.ts` | Add `resolveJobEnv`, add `env` param to `executeJobWithHandle` |
| `src/main/scheduler.ts` | Await `resolveJobEnv` before spawning |
| `src/renderer/src/components/JobEditorDrawer.tsx` | Add checkbox UI + state |
