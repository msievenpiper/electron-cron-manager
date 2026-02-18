# Cron Manager — Design Document

**Date:** 2026-02-18
**Status:** Approved

---

## Overview

A macOS menubar application built in Electron that allows users to create, schedule, update, and manage local cron tasks. The app runs an internal scheduler (jobs only run while the app is running), stores all data in SQLite, and provides a rich UI with calendar preview modes and full run history including stdout/stderr capture.

---

## Architecture & Tech Stack

**Approach:** Monolithic Electron (Option A) — main process owns all scheduling, data, and process management; renderer is a pure UI layer.

### Main Process
- **Scheduler:** `node-cron` — parses cron expressions, fires jobs on schedule
- **Process execution:** Node `child_process.spawn` with configurable interpreter per job
- **Database:** `better-sqlite3` — synchronous SQLite, fast and well-maintained
- **Tray:** Native macOS menubar integration via Electron `Tray` API
- **Notifications:** Electron `Notification` API (macOS native)
- **IPC:** Handles all renderer requests via `ipcMain` handlers
- **Login item:** `app.setLoginItemSettings({ openAtLogin: true })`

### Renderer Process (UI)
- **Framework:** React + Vite (via `electron-vite`)
- **Styling:** Tailwind CSS
- **Calendar:** `react-big-calendar` or custom implementation for month/timeline views
- **IPC bridge:** Communicates exclusively via `contextBridge` — no direct Node API access
- **Security:** `contextIsolation: true`, `nodeIntegration: false`

### Build & Packaging
- **Dev/build orchestration:** `electron-vite`
- **Packaging:** `electron-builder` — outputs `.dmg` / `.app`

---

## Data Model

### SQLite Schema

```sql
-- Job definitions
CREATE TABLE jobs (
  id          TEXT PRIMARY KEY,  -- UUID
  name        TEXT NOT NULL,
  cron        TEXT NOT NULL,     -- cron expression e.g. "0 * * * *"
  interpreter TEXT NOT NULL,     -- "bash", "node", "python3", etc.
  command     TEXT NOT NULL,     -- the script/command to run
  enabled     INTEGER DEFAULT 1,
  notify      TEXT DEFAULT 'failure', -- "all" | "failure" | "none"
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Run history
CREATE TABLE runs (
  id         TEXT PRIMARY KEY,  -- UUID
  job_id     TEXT NOT NULL REFERENCES jobs(id),
  started_at INTEGER NOT NULL,
  ended_at   INTEGER,           -- NULL if still running
  exit_code  INTEGER,           -- NULL if still running
  stdout     TEXT,
  stderr     TEXT,
  status     TEXT NOT NULL      -- "running" | "success" | "failure" | "killed"
);

-- App settings
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### History Retention
- Default: last 100 runs per job
- Configurable via settings table
- Old runs pruned automatically after each execution

---

## UI & Features

### Tray Icon
- Default: static icon in menubar
- While any job is running: animated spinner/badge on icon
- Tray menu: upcoming jobs list, "Open" to show main window, "Quit"

### Main Window — 3 Tabs

#### 1. Jobs Tab
- Table: name, cron expression, interpreter, last run status, next run time, enabled toggle
- Kill button per row when job is currently running
- Click row → opens job editor drawer
- "New Job" button

#### 2. Calendar Tab
Switchable between two views:
- **Month view:** grid calendar with colored dots on days that have scheduled jobs; click a day to see a list of what runs
- **Timeline view:** 24-hour day planner for a selected date showing job blocks at their scheduled run times

#### 3. History Tab
- Filterable log of all past runs (by job, status, date range)
- Click a run → expand to see full stdout/stderr output
- Color-coded: success = green, failure = red, killed = yellow

### Job Editor (Drawer/Modal)
Fields:
- Name
- Cron expression (with human-readable preview, e.g. "Every hour at :00")
- Interpreter picker (bash, sh, node, python3, ruby, etc.)
- Command textarea
- Notification setting: "all" | "failure" | "none"
- Enabled toggle
- "Run Now" button — triggers job immediately outside schedule

---

## Key Behaviors

- **Active monitoring:** Tray badge updates in real time when jobs are running
- **Kill running job:** Available from Jobs tab row and tray menu
- **Run Now:** Executes job immediately, captured in history like a scheduled run
- **Notifications:** Per-job setting, delivered via macOS native notifications
- **Persistence:** All jobs and history survive app restarts via SQLite
- **Login item:** App auto-launches at login so scheduler is always available
