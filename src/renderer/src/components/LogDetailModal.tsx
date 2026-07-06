import type { ReactElement } from 'react'
import { Job, Run } from '../../../shared/types'
import StatusBadge from './StatusBadge'
import { relativeTime, runDuration } from '../utils/format'

interface Props {
  run: Run
  job: Job | undefined
  onClose: () => void
}

export default function LogDetailModal({ run, job, onClose }: Props): ReactElement {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-[640px] max-w-[90%] flex-col rounded-2xl border border-white/10 bg-panel shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/7 px-[22px] py-[18px]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-heading">{job?.name ?? run.job_id}</h3>
              <StatusBadge variant={run.status} />
            </div>
            <p className="mt-1 text-xs text-muted/42">
              {relativeTime(run.started_at)} · {runDuration(run)} · exit code {run.exit_code ?? '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-white/6 text-base leading-none text-muted/55 hover:text-body"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-auto px-[22px] py-[18px]">
          <div>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/40">
              Command
            </div>
            <div className="rounded-[10px] border border-white/7 bg-black/40 px-3.5 py-[11px]">
              <pre className="whitespace-pre-wrap font-mono text-xs text-accent-lighter">
                {job?.command}
              </pre>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/40">
              stdout
            </div>
            <div className="max-h-[160px] overflow-y-auto rounded-[10px] border border-white/7 bg-black/40 px-3.5 py-[11px]">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-[1.6] text-muted/75">
                {run.stdout || '(no output)'}
              </pre>
            </div>
          </div>

          {run.stderr && (
            <div>
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-failure/55">
                stderr
              </div>
              <div className="max-h-[160px] overflow-y-auto rounded-[10px] border border-failure/18 bg-failure/6 px-3.5 py-[11px]">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-[1.6] text-failure">
                  {run.stderr}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-white/7 px-[22px] py-3">
          <button
            onClick={onClose}
            className="rounded-[9px] border border-white/9 bg-white/6 px-[18px] py-2 text-sm text-muted/70 hover:bg-white/9"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
