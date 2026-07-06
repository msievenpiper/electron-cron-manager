import { useState } from 'react'
import { Interpreter, NotifySetting } from '../../../shared/types'
import NotificationOptionCard from '../components/NotificationOptionCard'

const TOTAL_STEPS = 5

const JOB_PRESETS = [
  { id: 'hourly', label: 'Every hour', expr: '0 * * * *' },
  { id: 'daily-midnight', label: 'Daily at midnight', expr: '0 0 * * *' },
  { id: 'daily-9am', label: 'Daily at 9am', expr: '0 9 * * *' },
  { id: 'weekdays', label: 'Weekdays at 9am', expr: '0 9 * * 1-5' },
  { id: 'weekly', label: 'Weekly (Mon)', expr: '0 9 * * 1' },
  { id: 'monthly', label: '1st of month', expr: '0 0 1 * *' }
]

const INTERPRETERS: Interpreter[] = ['bash', 'sh', 'zsh', 'node', 'python3', 'ruby']

const TABS = [
  {
    key: 'home',
    title: 'Home',
    color: '#60a5fa',
    bg: 'bg-accent-light/11',
    desc: 'Live dashboard — see running jobs, success counts, and failures at a glance.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#60a5fa"
        strokeWidth={1.5}
      >
        <path d="M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    key: 'jobs',
    title: 'Jobs',
    color: '#a78bfa',
    bg: 'bg-[#a78bfa]/11',
    desc: 'Create and manage scheduled tasks. Set a command, pick a schedule, choose your interpreter.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#a78bfa"
        strokeWidth={1.5}
      >
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <rect x="3" y="10" width="18" height="4" rx="1" />
        <rect x="3" y="16" width="18" height="4" rx="1" />
      </svg>
    )
  },
  {
    key: 'calendar',
    title: 'Calendar',
    color: '#34d399',
    bg: 'bg-success/9',
    desc: 'Visualize your schedule in month or timeline view. Spot what’s running and when.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#34d399"
        strokeWidth={1.5}
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    )
  },
  {
    key: 'history',
    title: 'History',
    color: '#fbbf24',
    bg: 'bg-killed/9',
    desc: 'Full log of every run — exit codes, stdout, stderr, timing. Debug with confidence.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fbbf24"
        strokeWidth={1.5}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
]

interface Props {
  onComplete: () => void
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [jobName, setJobName] = useState('Daily Backup')
  const [presetId, setPresetId] = useState('daily-midnight')
  const [interpreter, setInterpreter] = useState<Interpreter>('bash')
  const [command, setCommand] = useState(
    'tar -czf ~/backups/docs-$(date +%Y%m%d).tar.gz ~/Documents'
  )
  const [notify, setNotify] = useState<NotifySetting>('failure')
  const [creating, setCreating] = useState(false)

  const preset = JOB_PRESETS.find((p) => p.id === presetId) ?? JOB_PRESETS[1]

  const finish = async (): Promise<void> => {
    await window.cronManager.settings.set('has_onboarded', '1')
    onComplete()
  }

  const skip = (): void => {
    finish()
  }

  const goNext = async (): Promise<void> => {
    if (step === 3) {
      setCreating(true)
      try {
        await window.cronManager.jobs.create({
          name: jobName.trim() || 'Daily Backup',
          cron: preset.expr,
          interpreter,
          command: command.trim() || 'echo hello',
          notify,
          enabled: true,
          source_shell_config: true
        })
      } finally {
        setCreating(false)
      }
      setStep(4)
      return
    }
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))
  }

  const goBack = (): void => setStep((s) => Math.max(0, s - 1))

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-app text-body">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[400px]"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% -2%, rgba(59,130,246,0.1) 0%, transparent 70%)'
        }}
      />

      <div className="z-10 flex items-center justify-between px-11 py-[22px]">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border border-accent-light/22 shadow-[0_0_16px_rgba(37,99,235,0.18)]"
            style={{ background: 'linear-gradient(145deg, #1c3b72, #101e46)' }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth={1.5}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold text-body/75">Cron Manager</span>
        </div>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-[400ms] ${
                i === step ? 'w-[22px] bg-accent' : i < step ? 'w-2 bg-accent' : 'w-2 bg-white/14'
              }`}
            />
          ))}
        </div>

        <button
          onClick={skip}
          className={`text-[13px] text-muted/38 hover:text-muted/60 ${step === 4 ? 'invisible' : ''}`}
        >
          Skip setup
        </button>
      </div>

      <div className="z-10 flex flex-1 items-center justify-center overflow-auto">
        {step === 0 && (
          <div className="flex max-w-[540px] flex-col items-center px-12 text-center">
            <div
              className="mb-8 flex h-[92px] w-[92px] items-center justify-center rounded-[28px] border border-accent-light/18 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_64px_rgba(37,99,235,0.22)]"
              style={{ background: 'linear-gradient(145deg, #193565, #0f1c3e)' }}
            >
              <svg
                width="46"
                height="46"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#60a5fa"
                strokeWidth={1.5}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="1" fill="#93c5fd" />
              </svg>
            </div>
            <h1 className="mb-4 text-[42px] font-bold leading-[1.07] tracking-[-1.3px] text-heading">
              Automate your Mac.
              <br />
              <span className="text-accent-light">No terminal required.</span>
            </h1>
            <p className="mb-9 max-w-[430px] text-[17px] leading-[1.72] text-muted/62">
              Schedule any command to run automatically — backups, scripts, reports. Then see
              exactly what happened, every time.
            </p>
            <button
              onClick={goNext}
              className="rounded-xl bg-accent-fill px-[42px] py-3.5 text-[15px] font-semibold tracking-[-0.2px] text-white shadow-[0_4px_28px_rgba(37,99,235,0.45)] transition-transform hover:-translate-y-px hover:bg-accent-fill-hover"
            >
              Get started →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="max-w-[740px] px-12">
            <h2 className="mb-2 text-center text-[34px] font-bold tracking-[-0.9px] text-heading">
              Everything in its place
            </h2>
            <p className="mb-8 text-center text-base text-muted/58">
              Four views, one powerful workflow.
            </p>
            <div className="grid grid-cols-2 gap-3.5">
              {TABS.map((tab) => (
                <div
                  key={tab.key}
                  className="rounded-[18px] border border-white/7 bg-white/[0.033] p-6"
                >
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] ${tab.bg}`}
                  >
                    {tab.icon}
                  </div>
                  <div className="mb-1.5 text-[15px] font-semibold text-[#e8f0fe]">{tab.title}</div>
                  <div className="text-[13px] leading-[1.62] text-muted/52">{tab.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-full max-w-[560px] px-12">
            <h2 className="mb-2 text-center text-[34px] font-bold tracking-[-0.9px] text-heading">
              Create your first job
            </h2>
            <p className="mb-6 text-center text-[15px] text-muted/58">
              We&rsquo;ve pre-filled an example — edit it to make it yours.
            </p>
            <div className="flex flex-col gap-5 rounded-[20px] border border-white/7 bg-white/[0.028] p-[26px]">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-muted/45">
                  Job name
                </span>
                <input
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="My job"
                  className="rounded-[10px] border border-white/10 bg-black/32 px-[14px] py-[11px] text-sm text-body outline-none focus:border-accent/50"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-muted/45">
                  Schedule
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {JOB_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPresetId(p.id)}
                      className={`rounded-lg px-[13px] py-[7px] text-xs font-medium transition-colors ${
                        presetId === p.id
                          ? 'border border-accent/50 bg-accent/18 text-accent-lighter'
                          : 'border border-white/8 bg-white/[0.045] text-muted/60'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1 rounded-lg border border-accent/12 bg-accent/[0.07] px-3 py-2 font-mono text-xs tracking-[0.3px] text-accent-light/70">
                  {preset.expr}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-muted/45">
                  Interpreter
                </span>
                <select
                  value={interpreter}
                  onChange={(e) => setInterpreter(e.target.value as Interpreter)}
                  className="rounded-[10px] border border-white/10 bg-black/32 px-[14px] py-[11px] text-sm text-body outline-none focus:border-accent/50"
                >
                  {INTERPRETERS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-muted/45">
                  Command
                </span>
                <textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  rows={3}
                  className="resize-none rounded-[10px] border border-white/10 bg-black/32 px-[14px] py-[11px] font-mono text-[13px] text-body outline-none focus:border-accent/50"
                />
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-[500px] px-12">
            <h2 className="mb-2 text-center text-[34px] font-bold tracking-[-0.9px] text-heading">
              Stay in the loop
            </h2>
            <p className="mb-6 text-center text-[15px] text-muted/58">
              When should we notify you about job runs?
            </p>
            <NotificationOptionCard value={notify} onChange={setNotify} />
          </div>
        )}

        {step === 4 && (
          <div className="flex max-w-[480px] flex-col items-center px-12 text-center">
            <div className="mb-7 flex h-[88px] w-[88px] items-center justify-center rounded-full border-[1.5px] border-success/22 bg-success/9 shadow-[0_0_48px_rgba(52,211,153,0.1)]">
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#34d399"
                strokeWidth={2}
              >
                <path d="M5 13l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mb-4 text-[38px] font-bold tracking-[-1px] text-heading">
              You&rsquo;re all set!
            </h2>
            <p className="mb-8 max-w-[380px] text-base leading-[1.7] text-muted/58">
              Your first job is configured and ready. Head to Jobs to manage it, or jump straight to
              the dashboard.
            </p>
            <div className="mb-8 w-full rounded-2xl border border-white/7 bg-white/[0.028] px-6 py-5 text-left">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted/38">
                Job summary
              </div>
              {[
                ['Name', jobName || 'Daily Backup'],
                ['Schedule', preset.label],
                [
                  'Notifications',
                  notify === 'all'
                    ? 'All completions'
                    : notify === 'failure'
                      ? 'Failures only'
                      : 'Silent'
                ]
              ].map(([label, value], i, arr) => (
                <div
                  key={label}
                  className={`flex justify-between py-2.5 ${i < arr.length - 1 ? 'border-b border-white/[0.055]' : ''}`}
                >
                  <span className="text-[13px] text-muted/48">{label}</span>
                  <span className="text-[13px] font-medium text-body">{value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={finish}
              className="rounded-xl bg-accent-fill px-[42px] py-3.5 text-[15px] font-semibold tracking-[-0.2px] text-white shadow-[0_4px_28px_rgba(37,99,235,0.45)] hover:bg-accent-fill-hover"
            >
              Open Dashboard →
            </button>
          </div>
        )}
      </div>

      {step >= 1 && step <= 3 && (
        <div className="z-10 flex items-center justify-between border-t border-white/[0.045] px-11 py-[18px]">
          <button
            onClick={goBack}
            className="rounded-lg border border-white/9 bg-white/5 px-[22px] py-2.5 text-sm font-medium text-muted/65 hover:bg-white/8"
          >
            ← Back
          </button>
          <button
            onClick={goNext}
            disabled={creating}
            className="rounded-lg bg-accent-fill px-7 py-[11px] text-sm font-semibold text-white shadow-[0_2px_18px_rgba(37,99,235,0.38)] hover:bg-accent-fill-hover disabled:opacity-60"
          >
            {step === 3 ? (creating ? 'Creating…' : 'Complete Setup →') : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}
