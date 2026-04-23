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
})
