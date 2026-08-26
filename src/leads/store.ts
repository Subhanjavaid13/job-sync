import type { LeadCandidate } from '../types.js';
import { config } from '../config.js';
import { openDb, markDbDirty } from '../pipeline/db.js';

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);
}

/**
 * Inserts never-seen leads (status 'new'). Dedupe: exact id, plus normalized
 * title against everything already stored (same post cross-shared elsewhere).
 * Returns the leads that were actually inserted.
 */
export function insertNewLeads(
  leads: Array<LeadCandidate & { score: number }>,
): Array<LeadCandidate & { score: number }> {
  const db = openDb();
  const existingTitles = new Set(
    (db.prepare('SELECT title FROM leads').all() as Array<{ title: string }>).map((r) => titleKey(r.title)),
  );
  const insert = db.prepare(`
    INSERT OR IGNORE INTO leads
      (id, title, summary, url, source, budget, contact, score, status, posted_at, first_seen, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const inserted: Array<LeadCandidate & { score: number }> = [];
  for (const lead of leads) {
    const key = titleKey(lead.title);
    if (existingTitles.has(key)) continue;
    const summary = lead.body.replace(/\s+/g, ' ').trim().slice(0, 280);
    const { changes } = insert.run(
      lead.id,
      lead.title,
      summary,
      lead.url,
      lead.source,
      lead.budget ?? null,
      lead.contact ?? null,
      lead.score,
      lead.postedAt,
      now,
      now,
    );
    if (Number(changes) > 0) {
      inserted.push(lead);
      existingTitles.add(key);
    }
  }
  db.close();
  if (inserted.length > 0) markDbDirty();
  return inserted;
}

/** Deletes leads still untouched ('new') after the retention window — stale noise. */
export function pruneStaleLeads(): void {
  const db = openDb();
  const cutoff = new Date(Date.now() - config.leads.staleNewDays * 86_400_000).toISOString();
  const { changes } = db
    .prepare("DELETE FROM leads WHERE status = 'new' AND first_seen < ?")
    .run(cutoff);
  db.close();
  if (Number(changes) > 0) {
    markDbDirty();
    console.log(`[job-sync] leads: pruned ${changes} stale 'new' leads (> ${config.leads.staleNewDays} days)`);
  }
}
