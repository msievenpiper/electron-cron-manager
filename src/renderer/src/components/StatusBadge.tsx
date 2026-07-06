export type BadgeVariant = 'running' | 'success' | 'failure' | 'disabled' | 'scheduled' | 'killed'

const VARIANTS: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  running: { bg: 'bg-running/14', text: 'text-running', label: '↻ Running' },
  success: { bg: 'bg-success/12', text: 'text-success', label: '✓ Success' },
  failure: { bg: 'bg-failure/12', text: 'text-failure', label: '✗ Failed' },
  disabled: { bg: 'bg-white/4', text: 'text-disabled', label: '○ Disabled' },
  scheduled: { bg: 'bg-accent/10', text: 'text-accent-light', label: '● Scheduled' },
  killed: { bg: 'bg-killed/12', text: 'text-killed', label: '⊘ Killed' }
}

interface Props {
  variant: BadgeVariant
  label?: string
  className?: string
}

export default function StatusBadge({ variant, label, className = '' }: Props) {
  const v = VARIANTS[variant]
  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-2 py-0.5 text-[11px] font-semibold ${v.bg} ${v.text} ${className}`}
    >
      {label ?? v.label}
    </span>
  )
}

export function runStatusToVariant(
  status: 'running' | 'success' | 'failure' | 'killed'
): BadgeVariant {
  return status
}

export function jobStatusVariant(job: { enabled: boolean }, isRunning: boolean): BadgeVariant {
  if (isRunning) return 'running'
  if (!job.enabled) return 'disabled'
  return 'scheduled'
}
