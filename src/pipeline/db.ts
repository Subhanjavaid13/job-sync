import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';

/**
 * Single place that owns the SQLite schema. Every table uses
 * CREATE IF NOT EXISTS plus additive column migrations, so existing DBs
 * (including the git-tracked one the Actions runner commits back) upgrade
 * themselves transparently on any machine.
 */
export function openDb(): DatabaseSync {
  mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS seen_jobs (
      id                TEXT PRIMARY KEY,
      company_title_key TEXT,
      first_seen        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_company_title ON seen_jobs (company_title_key);

    CREATE TABLE IF NOT EXISTS runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at  TEXT NOT NULL,
      finished_at TEXT,
      status      TEXT NOT NULL DEFAULT 'running',
      fetched     INTEGER NOT NULL DEFAULT 0,
      matched     INTEGER NOT NULL DEFAULT 0,
      fresh       INTEGER NOT NULL DEFAULT 0,
      emailed     INTEGER NOT NULL DEFAULT 0,
      error       TEXT
    );

    CREATE TABLE IF NOT EXISTS leads (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      summary    TEXT,
      url        TEXT,
      source     TEXT,
      budget     TEXT,
      score      INTEGER NOT NULL DEFAULT 0,
      status     TEXT NOT NULL DEFAULT 'new',
      notes      TEXT,
      posted_at  TEXT,
      first_seen TEXT NOT NULL,
      updated_at TEXT
    );
  `);

  // Additive migration: seen_jobs gained full job details for the dashboard.
  const existing = new Set(
    (db.prepare('PRAGMA table_info(seen_jobs)').all() as Array<{ name: string }>).map((c) => c.name),
  );
  const wanted: Array<[string, string]> = [
    ['title', 'TEXT'],
    ['company', 'TEXT'],
    ['url', 'TEXT'],
    ['source', 'TEXT'],
    ['salary', 'TEXT'],
    ['location', 'TEXT'],
    ['posted_at', 'TEXT'],
    ['score', 'INTEGER'],
    ['emailed', 'INTEGER'],
  ];
  for (const [name, type] of wanted) {
    if (!existing.has(name)) db.exec(`ALTER TABLE seen_jobs ADD COLUMN ${name} ${type}`);
  }

  return db;
}
