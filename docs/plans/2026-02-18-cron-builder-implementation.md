# Cron Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the raw cron expression input in `JobEditorDrawer` with a two-mode `CronBuilder` component — Simple (presets + field controls) and Advanced (raw input).

**Architecture:** A new `CronBuilder` component takes `value: string` and `onChange: (expr: string) => void` as props and owns only `mode` state. All cron field parsing/building lives in a pure utility module (`cronFields.ts`) that is testable in the Node/Vitest environment. The drawer holds `cronExpr` state unchanged.

**Tech Stack:** React, TypeScript, Tailwind v4, cronstrue (already installed), Vitest (node environment).

---

### Task 1: Cron field utility functions

**Files:**
- Create: `src/renderer/src/utils/cronFields.ts`
- Create: `src/renderer/src/utils/cronFields.test.ts`
- Modify: `vitest.config.ts`

**Background:** The utility converts a 5-part cron expression string to/from a structured object. Fields with step values (`*/5`), ranges (`1-5`), or lists (`1,2,3`) fall back to `*` when parsing — these can't be represented in the simple builder.

**Step 1: Update vitest.config.ts to pick up renderer utility tests**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts', 'src/renderer/src/utils/**/*.test.ts'],
  },
})
```

**Step 2: Write the failing tests**

```ts
// src/renderer/src/utils/cronFields.test.ts
import { describe, it, expect } from 'vitest'
import { parseCronToFields, buildCronFromFields } from './cronFields'

describe('parseCronToFields', () => {
  it('parses a standard 5-part expression', () => {
    expect(parseCronToFields('0 9 * * 1')).toEqual({
      minute: '0', hour: '9', dom: '*', month: '*', dow: '1',
    })
  })

  it('falls back step fields to *', () => {
    expect(parseCronToFields('*/5 * * * *').minute).toBe('*')
  })

  it('falls back range fields to *', () => {
    expect(parseCronToFields('0 9-17 * * *').hour).toBe('*')
  })

  it('falls back list fields to *', () => {
    expect(parseCronToFields('0 0 * * 1,3,5').dow).toBe('*')
  })

  it('returns all * for invalid expression', () => {
    expect(parseCronToFields('not valid')).toEqual({
      minute: '*', hour: '*', dom: '*', month: '*', dow: '*',
    })
  })
})

describe('buildCronFromFields', () => {
  it('joins 5 fields with spaces', () => {
    expect(buildCronFromFields({ minute: '0', hour: '9', dom: '*', month: '*', dow: '1' }))
      .toBe('0 9 * * 1')
  })

  it('handles all wildcards', () => {
    expect(buildCronFromFields({ minute: '*', hour: '*', dom: '*', month: '*', dow: '*' }))
      .toBe('* * * * *')
  })
})
```

**Step 3: Run tests to verify they fail**

```bash
npx vitest run src/renderer/src/utils/cronFields.test.ts
```

Expected: FAIL with "Cannot find module './cronFields'"

**Step 4: Implement the utilities**

```ts
// src/renderer/src/utils/cronFields.ts
export interface CronFields {
  minute: string  // '0'–'59' or '*'
  hour: string    // '0'–'23' or '*'
  dom: string     // '1'–'31' or '*'
  month: string   // '1'–'12' or '*'
  dow: string     // '0'–'6' or '*'
}

const FALLBACK_FIELDS: CronFields = { minute: '*', hour: '*', dom: '*', month: '*', dow: '*' }

function normalizeField(val: string): string {
  return /[\/\-,]/.test(val) ? '*' : val
}

export function parseCronToFields(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return { ...FALLBACK_FIELDS }
  const [minute, hour, dom, month, dow] = parts
  return {
    minute: normalizeField(minute),
    hour: normalizeField(hour),
    dom: normalizeField(dom),
    month: normalizeField(month),
    dow: normalizeField(dow),
  }
}

export function buildCronFromFields(fields: CronFields): string {
  return `${fields.minute} ${fields.hour} ${fields.dom} ${fields.month} ${fields.dow}`
}
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/renderer/src/utils/cronFields.test.ts
```

Expected: 7 tests passing.

**Step 6: Run full test suite to confirm nothing broken**

```bash
npm test
```

Expected: all tests pass (18 + 7 = 25 total).

**Step 7: Commit**

```bash
git add vitest.config.ts src/renderer/src/utils/cronFields.ts src/renderer/src/utils/cronFields.test.ts
git commit -m "feat: add cron field parse/build utilities with tests"
```

---

### Task 2: CronBuilder component

**Files:**
- Create: `src/renderer/src/components/CronBuilder.tsx`

**Background:** This component has a "Simple | Advanced" toggle at the top. In Simple mode it shows a preset dropdown and 5 field controls. In Advanced mode it shows the raw input. Both read from/write to the `value` prop. The `cronstrue` description shows in both modes. The preset dropdown's selected value is derived from `value` — no extra state needed.

**Step 1: Implement CronBuilder.tsx**

```tsx
// src/renderer/src/components/CronBuilder.tsx
import { useState } from 'react'
import cronstrue from 'cronstrue'
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

const FIELD_META: { key: keyof Omit<CronFields, 'dow'>; label: string; min: number; max: number }[] = [
  { key: 'minute', label: 'Min',   min: 0, max: 59 },
  { key: 'hour',   label: 'Hour',  min: 0, max: 23 },
  { key: 'dom',    label: 'Day',   min: 1, max: 31 },
  { key: 'month',  label: 'Month', min: 1, max: 12 },
]

export default function CronBuilder({ value, onChange }: Props) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')

  let cronDescription = ''
  try { cronDescription = cronstrue.toString(value) } catch { cronDescription = 'Invalid cron expression' }

  const fields = parseCronToFields(value)
  const currentPresetExpr = PRESETS.find(p => p.expr === value)?.expr ?? null

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value
    if (selected !== '__custom__') onChange(selected)
  }

  const handleFieldChange = (key: keyof CronFields, val: string) => {
    onChange(buildCronFromFields({ ...fields, [key]: val }))
  }

  const handleAnyToggle = (key: keyof CronFields, isAny: boolean) => {
    const fallback = key === 'dom' || key === 'month' ? '1' : '0'
    handleFieldChange(key, isAny ? '*' : fallback)
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
                    onChange={e => handleFieldChange(key, e.target.value)}
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
          className="bg-gray-800 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}

      <span className="text-xs text-gray-400">{cronDescription}</span>
    </div>
  )
}
```

**Step 2: Verify it type-checks**

```bash
npm run typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/renderer/src/components/CronBuilder.tsx
git commit -m "feat: add CronBuilder component with simple and advanced modes"
```

---

### Task 3: Wire CronBuilder into JobEditorDrawer

**Files:**
- Modify: `src/renderer/src/components/JobEditorDrawer.tsx`

**Background:** Replace the `<label>` block containing the cron `<input>` and `cronstrue` description span with `<CronBuilder value={cronExpr} onChange={setCronExpr} />`. The `import cronstrue` line should be removed since `CronBuilder` now owns it.

**Step 1: Modify JobEditorDrawer.tsx**

Remove the `cronstrue` import and replace the cron label block.

Current code to remove (lines 3, 22–23, 66–74):
```tsx
import cronstrue from 'cronstrue'   // remove this import

// remove these lines:
let cronDescription = ''
try { cronDescription = cronstrue.toString(cronExpr) } catch { cronDescription = 'Invalid cron expression' }

// replace this entire label block:
<label className="flex flex-col gap-1 text-sm">
  <span className="text-gray-300">Cron Expression</span>
  <input
    value={cronExpr}
    onChange={e => setCronExpr(e.target.value)}
    className="bg-gray-800 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500"
  />
  <span className="text-xs text-gray-400">{cronDescription}</span>
</label>
```

Replace with:
```tsx
import CronBuilder from './CronBuilder'

// in JSX:
<CronBuilder value={cronExpr} onChange={setCronExpr} />
```

Full updated imports section at top of file:
```tsx
import { useState } from 'react'
import { Job, Interpreter, NotifySetting } from '../../../shared/types'
import CronBuilder from './CronBuilder'
```

**Step 2: Verify type-checks**

```bash
npm run typecheck
```

Expected: no errors.

**Step 3: Run full test suite**

```bash
npm test
```

Expected: all 25 tests pass.

**Step 4: Manual smoke test**

```bash
npm run dev
```

Open the app, click "New Job" — verify:
- "Simple | Advanced" toggle appears where the cron input was
- Simple mode shows preset dropdown defaulting to "Every hour" (since default is `0 * * * *`)
- Changing a field updates the `cronstrue` description below
- Selecting a preset updates all fields
- Switching to Advanced shows the raw expression that matches what Simple built
- Typing in Advanced and switching back to Simple parses correctly

**Step 5: Commit**

```bash
git add src/renderer/src/components/JobEditorDrawer.tsx
git commit -m "feat: replace cron input with CronBuilder in JobEditorDrawer"
```
