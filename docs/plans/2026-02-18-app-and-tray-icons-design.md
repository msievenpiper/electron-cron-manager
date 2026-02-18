# App and Tray Icons Design

**Date:** 2026-02-18
**Status:** Approved

## Problem

The app currently uses the default Electron atom placeholder for the app icon. The tray icons (`tray-icon.png`, `tray-icon-active.png`) are broken — 1×1 green pixel files with no visible content.

## Design

### Visual Concept

**Clock + terminal** — a clock face with a `>_` terminal prompt inside it, representing scheduled automation. Color palette: dark background (`#1a1b2e`) with electric blue accent (`#4F8EF7`).

### App Icon (1024×1024)

- Dark rounded rectangle background (`#1a1b2e`)
- Clock face: circular ring in electric blue (`#4F8EF7`) with tick marks at 12, 3, 6, 9 o'clock
- Clock hands: electric blue, set to ~10:10
- `>_` terminal prompt in electric blue, centered in the lower half of the clock face, inside the clock ring
- The clock and terminal form a single unified shape

### Tray Icons (44×44px @2x / 22×22pt)

- **Normal** (`tray-icon.png`): White monochrome clock+`>_` on transparent background. Registered as a macOS template image so it adapts to both light and dark menubar.
- **Active** (`tray-icon-active.png`): Same shape rendered in electric blue (`#4F8EF7`), shown when one or more jobs are actively running.

### Active State Logic

`updateTrayMenu()` in `src/main/index.ts` already runs after every job state change. It will also swap the tray icon: electric blue when `activeRuns.size > 0`, white template image otherwise.

## Files

| File | Purpose |
|---|---|
| `resources/icon.svg` | Source app icon (1024×1024) |
| `resources/tray-icon.svg` | Source normal tray icon (44×44) |
| `resources/tray-icon-active.svg` | Source active tray icon (44×44) |
| `scripts/generate-icons.sh` | Converts SVGs → all required PNGs + `.icns` + `.ico` |
| `resources/icon.png` | Regenerated from SVG |
| `resources/tray-icon.png` | Regenerated, white monochrome |
| `resources/tray-icon-active.png` | Regenerated, electric blue |
| `build/icon.png` | Copy of `resources/icon.png` |
| `build/icon.icns` | Generated via `iconutil` (macOS) |
| `build/icon.ico` | Generated via `sips` (macOS) |

## Conversion Pipeline

Uses only macOS built-in tools — no extra npm packages:

- `sips`: SVG → PNG at required sizes
- `iconutil`: iconset directory → `.icns`
- `sips`: PNG → `.ico`

Script lives at `scripts/generate-icons.sh` and can be re-run any time the SVG sources change.

## Out of Scope

- Linux/Windows icon formats beyond `.ico`
- Animated tray icons
- Light-mode app icon variant
