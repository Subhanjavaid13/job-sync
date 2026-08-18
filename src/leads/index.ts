import 'dotenv/config';
import { leadSources } from './sources/index.js';
import { filterLeads } from './filter.js';
import { insertNewLeads, pruneStaleLeads } from './store.js';

/**
 * Leads pipeline entry (`npm run leads`) — run-and-exit, like the jobs
 * pipeline. See LEADS_PLAN.md. In CI it self-limits to every 3rd 2-hour cron
 * slot (UTC hour % 6 == 0 → ~4 runs/day); locally it always runs.
 */
async function main(): Promise<void> {
  if (
    process.env.GITHUB_ACTIONS === 'true' &&
    new Date().getUTCHours() % 6 !== 0 &&
    process.env.LEADS_FORCE !== '1'
  ) {
    console.log('[job-sync] leads: skipped this cron slot (runs when UTC hour % 6 == 0)');
    return;
  }

  console.log(`[job-sync] leads run started ${new Date().toISOString()}`);

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

  console.log(
    `[job-sync] leads: ${candidates.length} candidates → ${scored.length} scored ≥ threshold → ${inserted} new`,
  );
  console.log('[job-sync] leads run finished — review them on the dashboard (npm run ui → Leads)');
}

main().catch((err) => {
  console.error('[job-sync] leads fatal:', err);
  process.exit(1);
});
