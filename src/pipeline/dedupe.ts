import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Job } from '../types.js';
import { config } from '../config.js';

/** Normalized company+title key to catch the same job cross-posted on multiple boards. */
function companyTitleKey(job: Job): string {
  return `${job.company} ${job.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function openDb(): DatabaseSync {
  mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS seen_jobs (
      id                TEXT PRIMARY KEY,
      company_title_key TEXT,
      first_seen        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_company_title ON seen_jobs (company_title_key);
  `);
  return db;
}

/**
 * Returns only jobs never seen before (PRD FR4). Read-only — call markSeen()
 * AFTER the digest is delivered, so a failed send retries next run instead of
 * silently losing jobs forever.
 */
export function selectNewJobs(jobs: Job[]): Job[] {
  const db = openDb();
  const byId = db.prepare('SELECT 1 FROM seen_jobs WHERE id = ?');
  const byKey = db.prepare('SELECT 1 FROM seen_jobs WHERE company_title_key = ?');

  const fresh: Job[] = [];
  const keysThisRun = new Set<string>();
  for (const job of jobs) {
    const key = companyTitleKey(job);
    if (byId.get(job.id) || byKey.get(key) || keysThisRun.has(key)) continue;
    keysThisRun.add(key); // cross-source duplicate within the same run
    fresh.push(job);
  }

  db.close();
  return fresh;
}

/** Records jobs as seen. Call only after the digest was delivered. */
export function markSeen(jobs: Job[]): void {
  const db = openDb();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO seen_jobs (id, company_title_key, first_seen) VALUES (?, ?, ?)',
  );
  const now = new Date().toISOString();
  for (const job of jobs) {
    insert.run(job.id, companyTitleKey(job), now);
  }
  db.close();
}
