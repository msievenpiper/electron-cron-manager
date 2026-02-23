import cron from 'node-cron'
import { Job } from '../shared/types'
import { executeJobWithHandle, ExecuteResult, resolveJobEnv } from './executor'

interface SchedulerCallbacks {
  onJobStart: (jobId: string, runId: string) => void
  onJobFinish: (jobId: string, runId: string, result: ExecuteResult) => void
}

interface ActiveRun {
  runId: string
  kill: () => void
}

export class SchedulerEngine {
  private tasks = new Map<string, ReturnType<typeof cron.schedule>>()
  private activeRuns = new Map<string, ActiveRun>()
  private callbacks: SchedulerCallbacks

  constructor(callbacks: SchedulerCallbacks) {
    this.callbacks = callbacks
  }

  setCallbacks(callbacks: SchedulerCallbacks): void {
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

  // node-cron v4 doesn't support the N/M (start/step) syntax used in Quartz/Spring cron.
  // It ignores the step and only uses the start value, so 0/10 fires only at :00 not :00,:10,...
  // Normalize N/M → N-MAX/M so node-cron handles it as intended.
  private normalizeExpression(expr: string): string {
    const fields = expr.trim().split(/\s+/)
    const isSixField = fields.length === 6
    // Maxes indexed from the first field: [second, minute, hour, dom, month, dow]
    const maxes = [59, 59, 23, 31, 12, 6]
    const offset = isSixField ? 0 : 1
    return fields
      .map((field, i) => field.replace(/^(\d+)\/(\d+)$/, (_, n, m) => `${n}-${maxes[i + offset]}/${m}`))
      .join(' ')
  }

  private scheduleJob(job: Job): void {
    if (!cron.validate(job.cron)) return
    const normalized = this.normalizeExpression(job.cron)
    const task = cron.schedule(normalized, () => this.executeJob(job))
    this.tasks.set(job.id, task)
  }

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
}
