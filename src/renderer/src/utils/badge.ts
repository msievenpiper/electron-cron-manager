export type BadgeVariant = 'running' | 'success' | 'failure' | 'disabled' | 'scheduled' | 'killed'

export function jobStatusVariant(job: { enabled: boolean }, isRunning: boolean): BadgeVariant {
  if (isRunning) return 'running'
  if (!job.enabled) return 'disabled'
  return 'scheduled'
}
