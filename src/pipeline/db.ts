import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

  // Additive migration: runs gained a kind ('jobs' | 'leads').
  const runCols = new Set(
    (db.prepare('PRAGMA table_info(runs)').all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!runCols.has('kind')) {
    db.exec(`ALTER TABLE runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'jobs'`);
  }

  // Additive migration: leads gained a contact column (author/company + extracted email/phone).
  const leadCols = new Set(
    (db.prepare('PRAGMA table_info(leads)').all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!leadCols.has('contact')) {
    db.exec('ALTER TABLE leads ADD COLUMN contact TEXT');
  }

  return db;
}

/**
 * Marks the DB as meaningfully changed (new jobs/leads, prunes). The Actions
 * workflow commits data/jobs.db only when this marker exists — without it,
 * run-log-only changes would produce a commit every 2 hours. The marker file
 * itself is gitignored and deleted by the workflow after committing.
 */
export function markDbDirty(): void {
  writeFileSync(join(dirname(config.dbPath), '.db-dirty'), new Date().toISOString());
}
