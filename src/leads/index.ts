import 'dotenv/config';
import { leadSources } from './sources/index.js';
import { filterLeads } from './filter.js';
import { insertNewLeads, pruneStaleLeads } from './store.js';
import { sendLeadsDigest } from '../pipeline/email.js';
import { startRun, finishRun } from '../pipeline/runlog.js';

/**
 * Leads pipeline entry (`npm run leads`) — run-and-exit, like the jobs
 * pipeline. See LEADS_PLAN.md. Runs in the daily cron slot alongside jobs;
 * once a day is well within every source's rate limits.
 */
async function main(): Promise<void> {
  console.log(`[job-sync] leads run started ${new Date().toISOString()}`);
  const runId = startRun('leads');

  try {
    const results = await Promise.allSettled(leadSources.map((s) => s.fetchLeads()));
    const candidates = results.flatMap((result, i) => {
      const source = leadSources[i]!;
      if (result.status === 'rejected') {
        console.error(`[job-sync] leads source "${source.name}" failed:`, result.reason);
        return [];
      }
      console.log(`[job-sync] leads/${source.name}: ${result.value.length} candidates`);
      return result.value;
    });

    const scored = filterLeads(candidates);
    const inserted = insertNewLeads(scored);
    pruneStaleLeads();

    // Notification email (LEADS_PLAN L4). The portal is the source of truth —
    // a failed send is a warning, never a failed run.
    let emailedCount = 0;
    if (inserted.length > 0) {
      try {
        const delivery = await sendLeadsDigest(inserted);
        if (delivery === 'emailed') emailedCount = inserted.length;
      } catch (err) {
        console.warn('[job-sync] leads: digest email failed (leads are on the dashboard):', err);
      }
    }

    finishRun(runId, {
      status: 'ok',
      fetched: candidates.length,
      matched: scored.length,
      fresh: inserted.length,
      emailed: emailedCount,
    });
    console.log(
      `[job-sync] leads: ${candidates.length} candidates → ${scored.length} scored ≥ threshold → ${inserted.length} new`,
    );
    console.log('[job-sync] leads run finished — review them on the dashboard (npm run ui → Leads)');
  } catch (err) {
    finishRun(runId, { status: 'failed', error: String(err) });
    throw err;
  }
}

main().catch((err) => {
  console.error('[job-sync] leads fatal:', err);
  process.exit(1);
});
