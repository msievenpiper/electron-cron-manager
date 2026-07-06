export const SCHEMA = `
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
`

export const DEFAULT_SETTINGS: Record<string, string> = {
  max_runs_per_job: '100'
}
