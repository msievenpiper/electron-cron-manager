import { Run } from '../../../shared/types'

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function runDuration(run: Run): string {
  if (!run.ended_at) return '…'
  return `${((run.ended_at - run.started_at) / 1000).toFixed(1)}s`
}
