import { useState } from 'react'
import CronExpressionParser from 'cron-parser'
import { Job, Interpreter, NotifySetting } from '../../../shared/types'
import CronBuilder from './CronBuilder'
import NotificationOptionCard from './NotificationOptionCard'

const INTERPRETERS: { value: Interpreter; label: string }[] = [
  { value: 'bash', label: 'bash — Bourne Again Shell' },
  { value: 'sh', label: 'sh — POSIX Shell' },
  { value: 'zsh', label: 'zsh — Z Shell' },
  { value: 'node', label: 'node — Node.js' },
  { value: 'python3', label: 'python3 — Python 3' },
  { value: 'ruby', label: 'ruby — Ruby' }
]

const fieldLabel = 'text-[10.5px] font-semibold uppercase tracking-[0.7px] text-muted/42'
const fieldInput =
  'rounded-[10px] border border-white/10 bg-black/35 px-[13px] py-[10px] text-sm text-body outline-none placeholder:text-muted/30 focus:border-accent/50'

interface Props {
  job: Job | null
  onClose: () => void
  onSave: () => void
}

export default function JobEditorDrawer({ job, onClose, onSave }: Props) {
  const [name, setName] = useState(job?.name ?? '')
  const [cronExpr, setCronExpr] = useState(job?.cron ?? '0 * * * *')
  const [interpreter, setInterpreter] = useState<Interpreter>(job?.interpreter ?? 'bash')
  const [command, setCommand] = useState(job?.command ?? '')
  const [notify, setNotify] = useState<NotifySetting>(job?.notify ?? 'failure')
  const [enabled, setEnabled] = useState(job?.enabled ?? true)
  const [sourceShellConfig, setSourceShellConfig] = useState(job?.source_shell_config ?? true)
  const [saving, setSaving] = useState(false)

  let cronValid = true
  try {
    CronExpressionParser.parse(cronExpr)
  } catch {
    cronValid = false
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim() || !command.trim()) return
    setSaving(true)
    try {
      if (job) {
        await window.cronManager.jobs.update(job.id, {
          name,
          cron: cronExpr,
          interpreter,
          command,
          notify,
          enabled,
          source_shell_config: sourceShellConfig
        })
      } else {
        await window.cronManager.jobs.create({
          name,
          cron: cronExpr,
          interpreter,
          command,
          notify,
          enabled,
          source_shell_config: sourceShellConfig
        })
      }
      onSave()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex" onClick={onClose}>
      <div className="flex-1 bg-black/55" />
      <div
        className="flex h-full w-[420px] flex-col border-l border-white/9 bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/7 px-[22px] pb-[15px] pt-[18px]">
          <h3 className="text-base font-bold tracking-[-0.3px] text-heading">
            {job ? 'Edit Job' : 'New Job'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-white/6 text-base leading-none text-muted/55 hover:text-body"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-[18px] overflow-auto px-[22px] py-[18px]">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Job Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My job"
              className={fieldInput}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Schedule</span>
            <CronBuilder value={cronExpr} onChange={setCronExpr} />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Interpreter</span>
            <select
              value={interpreter}
              onChange={(e) => setInterpreter(e.target.value as Interpreter)}
              className={fieldInput}
            >
              {INTERPRETERS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Command</span>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              rows={4}
              placeholder="echo 'hello world'"
              className={`${fieldInput} resize-none font-mono text-[12.5px] leading-[1.65]`}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Notifications</span>
            <NotificationOptionCard value={notify} onChange={setNotify} />
          </div>

          <div className="flex flex-col gap-3">
            <span className={fieldLabel}>Options</span>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 h-[15px] w-[15px] accent-accent"
              />
              <span>
                <span className="block text-[13px] font-medium text-body">Enabled</span>
                <span className="block text-[11px] text-muted/38">
                  Job runs on its schedule when enabled
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={sourceShellConfig}
                onChange={(e) => setSourceShellConfig(e.target.checked)}
                className="mt-0.5 h-[15px] w-[15px] accent-accent"
              />
              <span>
                <span className="block text-[13px] font-medium text-body">Source shell config</span>
                <span className="block text-[11px] text-muted/38">
                  Loads ~/.zshrc or ~/.bash_profile first
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-[9px] border-t border-white/7 px-[22px] py-[14px]">
          <button
            onClick={onClose}
            className="rounded-[9px] border border-white/9 bg-white/[0.055] px-4 py-2 text-sm text-muted/65 hover:bg-white/9"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !command.trim() || !cronValid}
            className="rounded-[9px] bg-accent-fill px-5 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.35)] hover:bg-accent-fill-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Job'}
          </button>
        </div>
      </div>
    </div>
  )
}
