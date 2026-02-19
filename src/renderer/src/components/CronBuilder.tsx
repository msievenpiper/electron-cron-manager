// src/renderer/src/components/CronBuilder.tsx
import { useState } from 'react'
import cronstrue from 'cronstrue'
import CronExpressionParser from 'cron-parser'
import { parseCronToFields, buildCronFromFields, CronFields } from '../utils/cronFields'

interface Props {
  value: string
  onChange: (expr: string) => void
}

const PRESETS = [
  { label: 'Every minute',              expr: '* * * * *' },
  { label: 'Every hour',                expr: '0 * * * *' },
  { label: 'Every day at midnight',     expr: '0 0 * * *' },
  { label: 'Every week (Sun midnight)', expr: '0 0 * * 0' },
  { label: 'Every month (1st midnight)', expr: '0 0 1 * *' },
  { label: 'Custom…',                   expr: null },
]

const WEEKDAYS = [
  { label: 'Any', value: '*' },
  { label: 'Sun', value: '0' },
  { label: 'Mon', value: '1' },
  { label: 'Tue', value: '2' },
  { label: 'Wed', value: '3' },
  { label: 'Thu', value: '4' },
  { label: 'Fri', value: '5' },
  { label: 'Sat', value: '6' },
]

type FieldMeta = { key: keyof Omit<CronFields, 'dow'>; label: string; min: number; max: number }

const FIELD_META: FieldMeta[] = [
  { key: 'minute', label: 'Min',   min: 0, max: 59 },
  { key: 'hour',   label: 'Hour',  min: 0, max: 23 },
  { key: 'dom',    label: 'Day',   min: 1, max: 31 },
  { key: 'month',  label: 'Month', min: 1, max: 12 },
]

export default function CronBuilder({ value, onChange }: Props) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')

  let cronDescription = ''
  let isCronValid = true
  try {
    CronExpressionParser.parse(value)
    try { cronDescription = cronstrue.toString(value) } catch { cronDescription = value }
  } catch {
    isCronValid = false
    cronDescription = 'Invalid cron expression'
  }

  const fields = parseCronToFields(value)
  const currentPresetExpr = PRESETS.some(p => p.expr === value) ? value : null

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value
    if (selected !== '__custom__') onChange(selected)
  }

  const handleFieldChange = (key: keyof CronFields, val: string) => {
    onChange(buildCronFromFields({ ...fields, [key]: val }))
  }

  const handleAnyToggle = (key: keyof CronFields, checked: boolean) => {
    const fallback = key === 'dom' || key === 'month' ? '1' : '0'
    handleFieldChange(key, checked ? '*' : fallback)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Schedule</span>
        <div className="flex text-xs rounded overflow-hidden border border-gray-700">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`px-2 py-1 ${mode === 'simple' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={`px-2 py-1 ${mode === 'advanced' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Advanced
          </button>
        </div>
      </div>

      {mode === 'simple' ? (
        <div className="flex flex-col gap-3">
          <select
            value={currentPresetExpr ?? '__custom__'}
            onChange={handlePresetChange}
            className="bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PRESETS.map(p => (
              <option key={p.label} value={p.expr ?? '__custom__'}>{p.label}</option>
            ))}
          </select>

          <div className="grid grid-cols-5 gap-2">
            {FIELD_META.map(({ key, label, min, max }) => {
              const isAny = fields[key] === '*'
              return (
                <div key={key} className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">{label}</span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={isAny ? '' : fields[key]}
                    disabled={isAny}
                    placeholder="*"
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === '') {
                        handleFieldChange(key, '*')
                      } else {
                        const num = parseInt(raw, 10)
                        if (!isNaN(num)) {
                          handleFieldChange(key, String(Math.min(max, Math.max(min, num))))
                        }
                      }
                    }}
                    className="bg-gray-800 rounded px-2 py-1.5 text-sm text-center outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40 w-full"
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAny}
                      onChange={e => handleAnyToggle(key, e.target.checked)}
                    />
                    Any
                  </label>
                </div>
              )
            })}

            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Weekday</span>
              <select
                value={fields.dow}
                onChange={e => handleFieldChange('dow', e.target.value)}
                className="bg-gray-800 rounded px-1 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 w-full"
              >
                {WEEKDAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`bg-gray-800 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-1 ${!isCronValid ? 'border border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'}`}
        />
      )}

      <span className={`text-xs ${isCronValid ? 'text-gray-400' : 'text-red-400'}`}>{cronDescription}</span>
    </div>
  )
}
