# Calendar Month View — Sparkline Design

**Date:** 2026-02-19
**Status:** Approved

## Problem

The calendar month view shows only colored dots per day cell, making it impossible to tell *when* during the day jobs run. Users must click through to the timeline view to get any time-of-day information.

## Goal

Make each day cell glanceable by showing a mini horizontal sparkline: a row of 24 hourly buckets per job, colored where that job runs.

## Design

### Day Cell Layout

```
┌────────────┐
│ 14         │  ← day number (unchanged)
│ ▓░░░░░░▓░░ │  ← job 1 (blue): runs at hours 0 and 7
│ ░░░░▓░░░░░ │  ← job 2 (green): runs at hour 4
│ ░░░░░░░░▓▓ │  ← job 3 (purple): runs at hours 8-9
│       +2   │  ← if more than 5 jobs, show overflow count
└────────────┘
```

- Each row = one job that has at least one run that day
- Each row = 24 columns (one per hour), ~3px wide × 4px tall
- Column is lit in the job's color if ≥1 run falls in that hour; otherwise dim gray (`bg-gray-800`)
- Up to 5 job rows shown (matching the 5-color palette); excess shown as `+N` text
- `aspect-square` → `aspect-[4/5]` to give vertical room for rows

### Data Shape

Re-use `getRunDatesInMonth` (already called per job per month). Reshape `dayJobMap` from:

```ts
Map<day, Set<jobIdx>>
```

to:

```ts
Map<day, { jobIdx: number; hours: Set<number> }[]>
```

No new utility function needed.

### Colors

Reuse the existing `JOB_COLORS` arrays already defined in `CalendarMonthView.tsx`.

## Files Changed

- `src/renderer/src/components/CalendarMonthView.tsx` — replace dot rendering with sparkline rows; update `dayJobMap` shape; change cell aspect ratio
