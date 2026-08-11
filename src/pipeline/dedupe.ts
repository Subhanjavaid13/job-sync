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

/**
 * Returns only jobs never seen before (PRD FR4) and records them as seen.
 * Two dedupe levels: exact id, and cross-source company+title.
 */
export function keepNewJobs(jobs: Job[]): Job[] {
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

  const byId = db.prepare('SELECT 1 FROM seen_jobs WHERE id = ?');
  const byKey = db.prepare('SELECT 1 FROM seen_jobs WHERE company_title_key = ?');
  const insert = db.prepare(
    'INSERT OR IGNORE INTO seen_jobs (id, company_title_key, first_seen) VALUES (?, ?, ?)',
  );

  const fresh: Job[] = [];
  for (const job of jobs) {
    const key = companyTitleKey(job);
    if (byId.get(job.id) || byKey.get(key)) continue;
    insert.run(job.id, key, new Date().toISOString());
    fresh.push(job);
  }

  db.close();
  return fresh;
}
