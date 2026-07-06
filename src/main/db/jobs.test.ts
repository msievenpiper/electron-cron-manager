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
    const job = repo.create({
      name: 'Test',
      cron: '* * * * *',
      interpreter: 'bash',
      command: 'echo hi'
    })
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
    const job = repo.create({
      name: 'Test',
      cron: '* * * * *',
      interpreter: 'bash',
      command: 'echo hi'
    })
    expect(repo.findById(job.id)?.name).toBe('Test')
  })

  it('updates a job', () => {
    const job = repo.create({
      name: 'Test',
      cron: '* * * * *',
      interpreter: 'bash',
      command: 'echo hi'
    })
    const updated = repo.update(job.id, { name: 'Updated' })
    expect(updated?.name).toBe('Updated')
  })

  it('deletes a job', () => {
    const job = repo.create({
      name: 'Test',
      cron: '* * * * *',
      interpreter: 'bash',
      command: 'echo hi'
    })
    repo.delete(job.id)
    expect(repo.findById(job.id)).toBeUndefined()
  })

  it('defaults source_shell_config to true when not specified', () => {
    const job = repo.create({
      name: 'Test',
      cron: '* * * * *',
      interpreter: 'bash',
      command: 'echo hi'
    })
    expect(job.source_shell_config).toBe(true)
  })

  it('persists source_shell_config: false', () => {
    const job = repo.create({
      name: 'Test',
      cron: '* * * * *',
      interpreter: 'bash',
      command: 'echo hi',
      source_shell_config: false
    })
    expect(job.source_shell_config).toBe(false)
  })

  it('updates source_shell_config', () => {
    const job = repo.create({
      name: 'Test',
      cron: '* * * * *',
      interpreter: 'bash',
      command: 'echo hi'
    })
    const updated = repo.update(job.id, { source_shell_config: false })
    expect(updated?.source_shell_config).toBe(false)
  })
})
