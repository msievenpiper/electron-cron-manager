import { useState, useEffect, useCallback } from 'react'
import { Run } from '../../../shared/types'

const STATUS_COLORS: Record<Run['status'], string> = {
  success: 'text-green-400',
  failure: 'text-red-400',
  killed: 'text-yellow-400',
  running: 'text-blue-400',
}

function duration(run: Run): string {
  if (!run.ended_at) return '…'
  return `${((run.ended_at - run.started_at) / 1000).toFixed(1)}s`
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const list = await window.cronManager.runs.list()
    setRuns(list)
  }, [])

  useEffect(() => {
    refresh()
    window.cronManager.on.jobFinished(() => refresh())
  }, [refresh])

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">History</h2>
        <button onClick={refresh} className="text-xs text-gray-400 hover:text-white">Refresh</button>
      </div>

      {runs.length === 0 ? (
        <p className="text-gray-500 text-sm">No runs yet. Trigger a job to see history.</p>
      ) : (
        <div className="space-y-1">
          {runs.map(run => (
            <div key={run.id} className="border border-gray-800 rounded overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-900/50 text-left"
                onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
              >
                <span className={`font-medium w-16 ${STATUS_COLORS[run.status]}`}>{run.status}</span>
                <span className="text-gray-300 truncate flex-1">{run.job_id}</span>
                <span className="text-gray-500 text-xs shrink-0">
                  {new Date(run.started_at).toLocaleString()}
                </span>
                <span className="text-gray-500 text-xs shrink-0 w-12 text-right">
                  {duration(run)}
                </span>
                <span className="text-gray-600 text-xs">{expandedId === run.id ? '▲' : '▼'}</span>
              </button>

              {expandedId === run.id && (
                <div className="border-t border-gray-800 bg-gray-950 p-3 space-y-2">
                  {run.stdout ? (
                    <div>
                      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">stdout</div>
                      <pre className="text-xs text-green-300 whitespace-pre-wrap font-mono max-h-48 overflow-auto">{run.stdout}</pre>
                    </div>
                  ) : null}
                  {run.stderr ? (
                    <div>
                      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">stderr</div>
                      <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono max-h-48 overflow-auto">{run.stderr}</pre>
                    </div>
                  ) : null}
                  {!run.stdout && !run.stderr && (
                    <span className="text-xs text-gray-500">No output</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
