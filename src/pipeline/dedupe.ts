import type { Job } from '../types.js';
import { config } from '../config.js';
import { openDb, markDbDirty } from './db.js';

/** Normalized company+title key to catch the same job cross-posted on multiple boards. */
function companyTitleKey(job: Job): string {
  return `${job.company} ${job.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

/**
 * Records jobs as seen — with full details so the dashboard can show them.
 * Call only after the digest was delivered.
 */
export function markSeen(jobs: Job[], opts: { emailed: boolean }): void {
  const db = openDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO seen_jobs
      (id, company_title_key, first_seen, title, company, url, source, salary, location, posted_at, score, emailed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  for (const job of jobs) {
    insert.run(
      job.id,
      companyTitleKey(job),
      now,
      job.title,
      job.company,
      job.url,
      job.source,
      job.salary ?? null,
      job.location ?? null,
      job.postedAt,
      job.score ?? 0,
      opts.emailed ? 1 : 0,
    );
  }
  db.close();
  if (jobs.length > 0) markDbDirty();
}

/**
 * Retention: drop seen-rows older than the configured window. A reposting that
 * old is effectively a new job, and this keeps the git-tracked DB small.
 */
export function pruneSeenJobs(): void {
  const db = openDb();
  const cutoff = new Date(Date.now() - config.seenRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const { changes } = db.prepare('DELETE FROM seen_jobs WHERE first_seen < ?').run(cutoff);
  db.close();
  if (Number(changes) > 0) {
    markDbDirty();
    console.log(`[job-sync] pruned ${changes} seen-jobs older than ${config.seenRetentionDays} days`);
  }
}
