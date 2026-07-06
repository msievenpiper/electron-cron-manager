import type { ReactNode } from 'react'
import type { NotifySetting } from '../../../shared/types'

interface Option {
  value: NotifySetting
  title: string
  description: string
  recommended?: boolean
  iconBg: string
  icon: ReactNode
}

const BellIcon = ({ stroke }: { stroke: string }): ReactNode => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.5}>
    <path
      d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WarningIcon = ({ stroke }: { stroke: string }): ReactNode => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.5}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" strokeLinecap="round" />
    <circle cx="12" cy="16" r="0.5" fill={stroke} />
  </svg>
)

const SilentBellIcon = ({ stroke }: { stroke: string }): ReactNode => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.5}>
    <path
      d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 3l18 18" strokeLinecap="round" />
  </svg>
)

const OPTIONS: Option[] = [
  {
    value: 'all',
    title: 'All completions',
    description: 'Notify me every time a job finishes, success or failure.',
    iconBg: 'bg-accent-light/10',
    icon: <BellIcon stroke="#60a5fa" />
  },
  {
    value: 'failure',
    title: 'Failures only',
    description: 'Only alert me when something goes wrong.',
    recommended: true,
    iconBg: 'bg-failure/10',
    icon: <WarningIcon stroke="#f87171" />
  },
  {
    value: 'none',
    title: 'Silent',
    description: 'Run quietly in the background with no notifications.',
    iconBg: 'bg-white/5',
    icon: <SilentBellIcon stroke="rgba(178,196,228,0.32)" />
  }
]

interface Props {
  value: NotifySetting
  onChange: (value: NotifySetting) => void
}

export default function NotificationOptionCard({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-[11px]">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-4 rounded-2xl border-[1.5px] px-5 py-4 text-left transition-colors ${
              selected ? 'border-accent/38 bg-accent/7' : 'border-white/7 bg-white/[0.022]'
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${opt.iconBg}`}
            >
              {opt.icon}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-body">{opt.title}</span>
                {opt.recommended && (
                  <span className="rounded-[5px] bg-accent/15 px-2 py-0.5 text-[11px] text-accent-lighter">
                    Recommended
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[13px] text-muted/48">{opt.description}</span>
            </span>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                selected ? 'border-accent bg-accent-fill' : 'border-white/22 bg-transparent'
              }`}
            >
              {selected && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={3}
                >
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
