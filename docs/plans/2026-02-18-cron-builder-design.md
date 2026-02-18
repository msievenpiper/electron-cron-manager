# Cron Builder — Design Document

**Date:** 2026-02-18
**Status:** Approved

---

## Overview

Replace the raw cron expression `<input>` in `JobEditorDrawer` with a `CronBuilder` component that supports two modes toggled by a "Simple | Advanced" tab switch.

---

## Component API

```tsx
<CronBuilder value={cronExpr} onChange={setCronExpr} />
```

Props only — no internal persistence. The drawer continues to own `cronExpr` state exactly as it does today. `cronstrue` description moves inside `CronBuilder` and shows in both modes.

---

## Modes

### Simple Mode

**Preset dropdown** at top:

| Label | Expression |
|---|---|
| Every minute | `* * * * *` |
| Every hour | `0 * * * *` |
| Every day at midnight | `0 0 * * *` |
| Every week (Sunday midnight) | `0 0 * * 0` |
| Every month (1st, midnight) | `0 0 1 * *` |
| Custom… | *(no change to expression)* |

Selecting a preset populates all five fields and fires `onChange`. Selecting "Custom…" enables fields without changing the expression.

**Five field controls** below the preset:

| Field | Control | Range |
|---|---|---|
| Minute | number input or `*` | 0–59 |
| Hour | number input or `*` | 0–23 |
| Day of month | number input or `*` | 1–31 |
| Month | number input or `*` | 1–12 |
| Weekday | select (Any/Sun–Sat) | `*` or `0`–`6` |

Each field has an "Any" checkbox that sets it to `*`. Changing a field fires `onChange` with the rebuilt expression and sets preset to "Custom…".

**Advanced → Simple transition:** parse the raw expression by splitting on spaces into 5 parts. Fields containing step (`*/5`) or range (`1-5`) values fall back to `*`. The expression itself is not altered — only the field display.

### Advanced Mode

Raw monospace `<input>` with `cronstrue` description below. Identical to current behavior.

---

## File Changes

- **Create:** `src/renderer/src/components/CronBuilder.tsx`
- **Modify:** `src/renderer/src/components/JobEditorDrawer.tsx` — replace cron `<input>` + description span with `<CronBuilder>`
