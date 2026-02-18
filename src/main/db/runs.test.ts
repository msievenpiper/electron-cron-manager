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
