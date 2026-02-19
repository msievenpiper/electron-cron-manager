# Calendar Month View Sparkline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace colored dots in each calendar day cell with a horizontal 24-column sparkline per job, showing which hours of the day that job runs.

**Architecture:** Single-file change to `CalendarMonthView.tsx`. Reshape the existing `dayJobMap` to track hours per job per day (instead of just job presence), then replace the dot rendering with sparkline rows. No new utilities or components needed.

**Tech Stack:** React, TypeScript, Tailwind v4, existing `getRunDatesInMonth` utility

---

### Task 1: Reshape dayJobMap to track hours

**Files:**
- Modify: `src/renderer/src/components/CalendarMonthView.tsx`

This is a pure data-shape change with no rendering impact yet. Do it first so TypeScript catches any misuse downstream.

**Step 1: Replace the type and build logic**

In `CalendarMonthView.tsx`, replace the existing `dayJobMap` block (lines 33–41):

```tsx
// Old shape: Map<day, Set<jobIdx>>
// New shape: Map<day, { jobIdx: number; hours: Set<number> }[]>
type DayJobEntry = { jobIdx: number; hours: Set<number> }
const dayJobMap = new Map<number, DayJobEntry[]>()

jobs.forEach((job, jobIdx) => {
  const dates = getRunDatesInMonth(job.cron, year, month)
  dates.forEach(d => {
    const day = d.getDate()
    const hour = d.getHours()
    if (!dayJobMap.has(day)) dayJobMap.set(day, [])
    const entries = dayJobMap.get(day)!
    let entry = entries.find(e => e.jobIdx === jobIdx)
    if (!entry) {
      entry = { jobIdx, hours: new Set() }
      entries.push(entry)
    }
    entry.hours.add(hour)
  })
})
```

**Step 2: Fix the existing reference to dayJobMap inside the cell render**

The old code does:
```tsx
const jobIndices = Array.from(dayJobMap.get(day) ?? [])
```

Change it to:
```tsx
const jobEntries = dayJobMap.get(day) ?? []
```

**Step 3: Verify TypeScript is happy**

```bash
npm run typecheck
```

Expected: no errors. If there are errors, they will point to places where `jobIndices` (old variable) is still referenced — fix those first.

**Step 4: Commit**

```bash
git add src/renderer/src/components/CalendarMonthView.tsx
git commit -m "refactor: reshape dayJobMap to track hours per job per day"
```

---

### Task 2: Render sparkline rows, replace dots

**Files:**
- Modify: `src/renderer/src/components/CalendarMonthView.tsx`

**Step 1: Update the JOB_COLORS constant**

The existing `JOB_COLORS` array uses `bg-` classes and is fine for sparkline columns. No change needed — just verify it's still the same 5-entry array at the top of the file:

```tsx
const JOB_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-yellow-500',
  'bg-pink-500',
]
```

**Step 2: Change cell aspect ratio**

In the `<button>` className, change `aspect-square` to `aspect-[4/5]`:

```tsx
className={[
  'aspect-[4/5] rounded flex flex-col items-start justify-start p-1 text-xs transition-colors cursor-pointer',
  isToday(day) ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-gray-800 text-gray-200',
].join(' ')}
```

Note: also change `items-center` → `items-start` so the day number and sparklines are left-aligned (looks better with the bars).

**Step 3: Replace the dots block with sparkline rows**

Replace this block:
```tsx
{jobIndices.length > 0 && (
  <div className="flex flex-wrap gap-0.5 justify-center mt-1">
    {jobIndices.slice(0, 5).map(ji => (
      <div key={ji} className={`w-1.5 h-1.5 rounded-full ${JOB_COLORS[ji % JOB_COLORS.length]}`} />
    ))}
  </div>
)}
```

With:
```tsx
{jobEntries.length > 0 && (
  <div className="w-full mt-1 flex flex-col gap-px">
    {jobEntries.slice(0, 5).map(({ jobIdx, hours }) => (
      <div key={jobIdx} className="flex gap-px w-full">
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className={`flex-1 h-[3px] rounded-sm ${hours.has(h) ? JOB_COLORS[jobIdx % JOB_COLORS.length] : 'bg-gray-800'}`}
          />
        ))}
      </div>
    ))}
    {jobEntries.length > 5 && (
      <span className="text-gray-600 text-[9px] leading-none mt-0.5">+{jobEntries.length - 5}</span>
    )}
  </div>
)}
```

**Step 4: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors.

**Step 5: Visual check in dev mode**

```bash
npm run dev
```

Open the Calendar page → Month view. Verify:
- Day cells with scheduled jobs show colored horizontal bars
- Each bar row has 24 segments, lit in the job's color for active hours
- Empty hours show as dark gray segments
- Days with no jobs show nothing below the day number
- Today's cell still has the blue highlight
- Clicking a day still navigates to the timeline view

**Step 6: Commit**

```bash
git add src/renderer/src/components/CalendarMonthView.tsx
git commit -m "feat: replace calendar day dots with 24-hour sparkline rows"
```
