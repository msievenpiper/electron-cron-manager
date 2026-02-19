import { useState } from 'react'
import CronExpressionParser from 'cron-parser'
import { Job, Interpreter, NotifySetting } from '../../../shared/types'
import CronBuilder from './CronBuilder'

const INTERPRETERS: Interpreter[] = ['bash', 'sh', 'zsh', 'node', 'python3', 'ruby']

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
  const [saving, setSaving] = useState(false)

  let cronValid = true
  try { CronExpressionParser.parse(cronExpr) } catch { cronValid = false }

  const handleRunNow = async () => {
    if (job) await window.cronManager.jobs.runNow(job.id)
  }

  const handleSave = async () => {
    if (!name.trim() || !command.trim()) return
    setSaving(true)
    try {
      if (job) {
        await window.cronManager.jobs.update(job.id, { name, cron: cronExpr, interpreter, command, notify, enabled })
      } else {
        await window.cronManager.jobs.create({ name, cron: cronExpr, interpreter, command, notify, enabled })
      }
      onSave()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-10" onClick={onClose}>
      <div
        className="w-96 bg-gray-900 h-full overflow-auto p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">{job ? 'Edit Job' : 'New Job'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-300">Name</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My job"
            className="bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <CronBuilder value={cronExpr} onChange={setCronExpr} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-300">Interpreter</span>
          <select
            value={interpreter}
            onChange={e => setInterpreter(e.target.value as Interpreter)}
            className="bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          >
            {INTERPRETERS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-300">Command</span>
          <textarea
            value={command}
            onChange={e => setCommand(e.target.value)}
            rows={4}
            placeholder="echo 'hello world'"
            className="bg-gray-800 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-300">Notifications</span>
          <select
            value={notify}
            onChange={e => setNotify(e.target.value as NotifySetting)}
            className="bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All completions</option>
            <option value="failure">Failures only</option>
            <option value="none">None</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          Enabled
        </label>

        <div className="flex gap-2 mt-auto pt-4 border-t border-gray-800">
          {job && (
            <button
              onClick={handleRunNow}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Run Now
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !command.trim() || !cronValid}
            className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
