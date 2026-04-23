import { useState } from 'react'
import { useJobs } from '../hooks/useJobs'
import { Job } from '../../../shared/types'
import JobEditorDrawer from '../components/JobEditorDrawer'
import cronstrue from 'cronstrue'

function scheduleLabel(cronExpr: string): string {
  try { return cronstrue.toString(cronExpr, { verbose: false }) } catch { return cronExpr }
}

export default function JobsPage() {
  const { jobs, runningIds, refresh } = useJobs()
  const [editingJob, setEditingJob] = useState<Job | null | 'new'>(null)

  const toggleEnabled = async (job: Job) => {
    await window.cronManager.jobs.update(job.id, { enabled: !job.enabled })
    refresh()
  }

  const handleKill = async (job: Job) => {
    await window.cronManager.jobs.kill(job.id)
  }

  const handleDelete = async (job: Job) => {
    if (confirm(`Delete "${job.name}"?`)) {
      await window.cronManager.jobs.delete(job.id)
      refresh()
    }
  }

  const handleRunNow = async (job: Job) => {
    await window.cronManager.jobs.runNow(job.id)
  }

  return (
    <div className="p-4 flex-1 min-h-0 overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Jobs</h2>
        <button
          onClick={() => setEditingJob('new')}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm"
        >
          + New Job
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="text-gray-500 text-sm">No jobs yet. Create one to get started.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Schedule</th>
              <th className="py-2 pr-4">Interpreter</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => {
              const isRunning = runningIds.has(job.id)
              return (
                <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-2 pr-4 font-medium">{job.name}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{scheduleLabel(job.cron)}</td>
                  <td className="py-2 pr-4">
                    <span className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">{job.interpreter}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {isRunning ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs">
                        <span className="animate-spin inline-block">↻</span> running
                      </span>
                    ) : (
                      <span className={`text-xs ${job.enabled ? 'text-gray-400' : 'text-gray-600'}`}>
                        {job.enabled ? 'scheduled' : 'disabled'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 flex gap-2">
                    <button onClick={() => toggleEnabled(job)} className="text-xs text-gray-400 hover:text-white">
                      {job.enabled ? 'Disable' : 'Enable'}
                    </button>
                    {!isRunning && (
                      <button
                        onClick={() => handleRunNow(job)}
                        title={`Run ${job.name} now`}
                        className="text-xs text-green-500 hover:text-green-400"
                      >
                        ▶
                      </button>
                    )}
                    <button onClick={() => setEditingJob(job)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                    {isRunning && (
                      <button onClick={() => handleKill(job)} className="text-xs text-yellow-400 hover:text-yellow-300">Kill</button>
                    )}
                    <button onClick={() => handleDelete(job)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {editingJob !== null && (
        <JobEditorDrawer
          job={editingJob === 'new' ? null : editingJob}
          onClose={() => setEditingJob(null)}
          onSave={refresh}
        />
      )}
    </div>
  )
}
