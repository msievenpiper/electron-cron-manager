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
