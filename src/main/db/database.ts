import { mkdirSync } from 'fs'
import { dirname } from 'path'
import Database from 'better-sqlite3'
import { SCHEMA, DEFAULT_SETTINGS } from './schema'

export function createDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  // Migration: add source_shell_config for existing databases
  try {
    db.exec("ALTER TABLE jobs ADD COLUMN source_shell_config INTEGER DEFAULT 1")
  } catch {
    // Column already exists — safe to ignore
  }

  // Seed default settings if not present
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, value)
  }

  return db
}
