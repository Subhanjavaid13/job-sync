import { openDb } from './db.js';

/** Opens a run row; the dashboard's Runs table is built from these. */
export function startRun(): number {
  const db = openDb();
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO runs (started_at, status) VALUES (?, 'running')`)
    .run(new Date().toISOString());
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
