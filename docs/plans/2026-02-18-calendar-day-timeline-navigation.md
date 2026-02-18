# Calendar Day → Timeline Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clicking a day in the calendar month view navigates directly to the timeline view for that date.

**Architecture:** Lift selected-date state into `CalendarPage`, pass a callback to `CalendarMonthView` to trigger view switch, and accept an `initialDate` prop in `CalendarTimelineView`. Remove the existing inline detail panel from `CalendarMonthView` since the timeline replaces it.

**Tech Stack:** React (state/props), TypeScript, Electron renderer

---

### Task 1: Add `initialDate` prop to `CalendarTimelineView`

**Files:**
- Modify: `src/renderer/src/components/CalendarTimelineView.tsx`

This is a backward-compatible additive change — the component still works standalone with no prop.

**Step 1: Update the Props interface and use `initialDate` to seed `date` state**

In `CalendarTimelineView.tsx`, change line 13 from:
```ts
interface Props { jobs: Job[] }
```
to:
```ts
interface Props { jobs: Job[]; initialDate?: Date }
```

Change line 15 from:
```ts
export default function CalendarTimelineView({ jobs }: Props) {
```
to:
```ts
export default function CalendarTimelineView({ jobs, initialDate }: Props) {
```

Change line 17 from:
```ts
  const [date, setDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
```
to:
```ts
  const [date, setDate] = useState(
    initialDate
      ? new Date(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate())
      : new Date(today.getFullYear(), today.getMonth(), today.getDate())
  )
```

**Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors

**Step 3: Commit**

```bash
git add src/renderer/src/components/CalendarTimelineView.tsx
git commit -m "feat: add initialDate prop to CalendarTimelineView"
```

---

### Task 2: Replace `CalendarMonthView` detail panel with `onDaySelect` callback

**Files:**
- Modify: `src/renderer/src/components/CalendarMonthView.tsx`

**Step 1: Update Props interface and add `onDaySelect`**

Change line 13 from:
```ts
interface Props { jobs: Job[] }
```
to:
```ts
interface Props { jobs: Job[]; onDaySelect: (date: Date) => void }
```

Change line 15 from:
```ts
export default function CalendarMonthView({ jobs }: Props) {
```
to:
```ts
export default function CalendarMonthView({ jobs, onDaySelect }: Props) {
```

**Step 2: Remove `selectedDay` state**

Delete line 19:
```ts
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
```

**Step 3: Replace the day button `onClick` handler**

Change the button's onClick on line 77 from:
```ts
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
```
to:
```ts
              onClick={() => onDaySelect(new Date(year, month, day))}
```

**Step 4: Remove the `selectedDay` ring class**

Change the className array on lines 78–82 from:
```ts
              className={[
                'aspect-square rounded flex flex-col items-center justify-start p-1 text-xs transition-colors',
                isToday(day) ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-gray-800 text-gray-200',
                selectedDay === day ? 'ring-1 ring-blue-400' : '',
              ].join(' ')}
```
to:
```ts
              className={[
                'aspect-square rounded flex flex-col items-center justify-start p-1 text-xs transition-colors cursor-pointer',
                isToday(day) ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-gray-800 text-gray-200',
              ].join(' ')}
```

**Step 5: Remove the detail panel**

Delete lines 98–119 (the `{selectedDay !== null && (...)}` block):
```tsx
      {/* Selected day detail */}
      {selectedDay !== null && (
        <div className="mt-4 border border-gray-800 rounded p-3">
          <h4 className="text-sm font-medium mb-2 text-gray-200">
            {new Date(year, month, selectedDay).toLocaleDateString('default', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </h4>
          {(dayJobMap.get(selectedDay)?.size ?? 0) === 0 ? (
            <p className="text-xs text-gray-500">No jobs scheduled</p>
          ) : (
            <ul className="space-y-1">
              {Array.from(dayJobMap.get(selectedDay) ?? []).map(ji => (
                <li key={ji} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${JOB_COLORS[ji % JOB_COLORS.length]}`} />
                  <span className="text-gray-300">{jobs[ji].name}</span>
                  <span className="text-xs text-gray-500 font-mono ml-auto">{jobs[ji].cron}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
```

**Step 6: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors

**Step 7: Commit**

```bash
git add src/renderer/src/components/CalendarMonthView.tsx
git commit -m "feat: replace month view detail panel with onDaySelect callback"
```

---

### Task 3: Wire everything together in `CalendarPage`

**Files:**
- Modify: `src/renderer/src/pages/CalendarPage.tsx`

**Step 1: Add `selectedDate` state and `handleDaySelect` handler**

After line 9 (`const [view, setView] = useState<CalendarView>('month')`), add:
```ts
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const handleDaySelect = (date: Date) => {
    setSelectedDate(date)
    setView('timeline')
  }
```

**Step 2: Pass `onDaySelect` to `CalendarMonthView`**

Change line 37 from:
```tsx
          ? <CalendarMonthView jobs={jobs} />
```
to:
```tsx
          ? <CalendarMonthView jobs={jobs} onDaySelect={handleDaySelect} />
```

**Step 3: Pass `initialDate` to `CalendarTimelineView`**

Change line 38 from:
```tsx
          : <CalendarTimelineView jobs={jobs} />
```
to:
```tsx
          : <CalendarTimelineView jobs={jobs} initialDate={selectedDate ?? undefined} />
```

**Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors

**Step 5: Verify tests still pass**

Run: `npm test`
Expected: all tests pass

**Step 6: Manual smoke test**

Run `npm run dev` and verify:
- Clicking any day in month view switches to timeline view showing that date
- The timeline date header matches the day clicked
- The existing prev/next arrows in timeline still work after navigation
- Switching back to month view via the toggle still works

**Step 7: Commit**

```bash
git add src/renderer/src/pages/CalendarPage.tsx
git commit -m "feat: navigate to timeline view when calendar day is clicked"
```
