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
