# Calendar Day → Timeline Navigation

**Date:** 2026-02-18

## Problem

Clicking a day in the calendar month view shows an inline detail panel. Users want to navigate directly to the timeline view for that day instead.

## Decision

Approach A: Direct navigation. Clicking a day in month view immediately switches to timeline view for that date. The inline detail panel is removed.

## Design

### State changes in `CalendarPage`

- Add `selectedDate: Date | null` state alongside existing `view` state.
- Add `handleDaySelect(date: Date)` which sets `selectedDate` and `view = 'timeline'`.
- Pass `selectedDate` to `CalendarTimelineView` as `initialDate?: Date`.

### `CalendarMonthView`

- Add `onDaySelect: (date: Date) => void` prop.
- Day button `onClick` calls `onDaySelect(new Date(year, month, day))`.
- Remove `selectedDay` state and the detail panel (lines 98–119).

### `CalendarTimelineView`

- Add `initialDate?: Date` prop; use it as initial value of `date` state (falls back to today).
- No other changes.

### Data flow

```
CalendarPage
  selectedDate state ──────────────────────────────┐
  handleDaySelect(date) → setSelectedDate(date)     │
                        → setView('timeline')        │
                                                     ▼
  CalendarMonthView(onDaySelect)   CalendarTimelineView(initialDate)
```

## Files Changed

- `src/renderer/src/pages/CalendarPage.tsx`
- `src/renderer/src/components/CalendarMonthView.tsx`
- `src/renderer/src/components/CalendarTimelineView.tsx`
