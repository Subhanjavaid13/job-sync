import { openDb } from './db.js';

/** Opens a run row; the dashboard's Runs table is built from these. */
export function startRun(kind: 'jobs' | 'leads' = 'jobs'): number {
  const db = openDb();
  // A run killed mid-way (Ctrl+C, machine off) never reaches finishRun and
  // would show as "running" forever — close such rows out as interrupted.
  const staleCutoff = new Date(Date.now() - 2 * 3_600_000).toISOString();
  db.prepare(
    `UPDATE runs SET status = 'failed', finished_at = ?, error = 'interrupted (never finished)'
     WHERE status = 'running' AND started_at < ?`,
  ).run(new Date().toISOString(), staleCutoff);
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO runs (started_at, status, kind) VALUES (?, 'running', ?)`)
    .run(new Date().toISOString(), kind);
  db.close();
  return Number(lastInsertRowid);
}

export function finishRun(
  id: number,
  result: {
    status: 'ok' | 'failed';
    fetched?: number;
    matched?: number;
    fresh?: number;
    emailed?: number;
    error?: string;
  },
): void {
  const db = openDb();
  db.prepare(
    `UPDATE runs
     SET finished_at = ?, status = ?, fetched = ?, matched = ?, fresh = ?, emailed = ?, error = ?
     WHERE id = ?`,
  ).run(
    new Date().toISOString(),
    result.status,
    result.fetched ?? 0,
    result.matched ?? 0,
    result.fresh ?? 0,
    result.emailed ?? 0,
    result.error ?? null,
    id,
  );
  db.close();
}
