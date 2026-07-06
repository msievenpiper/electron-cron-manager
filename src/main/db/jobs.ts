import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { Job, CreateJobInput, UpdateJobInput } from '../../shared/types'

function rowToJob(row: any): Job {
  return { ...row, enabled: row.enabled === 1, source_shell_config: row.source_shell_config === 1 }
}

export class JobRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateJobInput): Job {
    const now = Date.now()
    const id = uuidv4()
    this.db
      .prepare(
        `
      INSERT INTO jobs (id, name, cron, interpreter, command, enabled, notify, source_shell_config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        input.name,
        input.cron,
        input.interpreter,
        input.command,
        input.enabled !== false ? 1 : 0,
        input.notify ?? 'failure',
        input.source_shell_config !== false ? 1 : 0,
        now,
        now
      )
    return this.findById(id)!
  }

  findAll(): Job[] {
    return (this.db.prepare('SELECT * FROM jobs ORDER BY created_at ASC').all() as any[]).map(
      rowToJob
    )
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
    this.db
      .prepare(
        `
      UPDATE jobs SET name=?, cron=?, interpreter=?, command=?, enabled=?, notify=?, source_shell_config=?, updated_at=? WHERE id=?
    `
      )
      .run(
        merged.name,
        merged.cron,
        merged.interpreter,
        merged.command,
        merged.enabled ? 1 : 0,
        merged.notify,
        merged.source_shell_config ? 1 : 0,
        now,
        id
      )
    return this.findById(id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
  }
}
