import 'dotenv/config';
import { config } from './config.js';
import { fetchers } from './fetchers/index.js';
import { filterJobs, splitContractRoles } from './pipeline/filter.js';
import { selectNewJobs, markSeen, pruneSeenJobs } from './pipeline/dedupe.js';
import { sendDigest } from './pipeline/email.js';
import { startRun, finishRun } from './pipeline/runlog.js';
import { scoreLead, stripHtml } from './leads/filter.js';
import { insertNewLeads } from './leads/store.js';

async function main(): Promise<void> {
  console.log(`[job-sync] run started ${new Date().toISOString()}`);
  const runId = startRun();

  try {
    const results = await Promise.allSettled(fetchers.map((f) => f.fetchJobs()));
    const jobs = results.flatMap((result, i) => {
      const fetcher = fetchers[i]!;
      if (result.status === 'rejected') {
        console.error(`[job-sync] fetcher "${fetcher.name}" failed:`, result.reason);
        return [];
      }
      console.log(`[job-sync] ${fetcher.name}: ${result.value.length} jobs`);
      return result.value;
    });

    pruneSeenJobs();

    const allMatched = filterJobs(jobs);
    const { employment: matched, contracts } = splitContractRoles(allMatched);

    // Contract-type matches are project leads, not employment (LEADS_PLAN S2).
    if (contracts.length > 0) {
      const candidates = contracts.map((job) => ({
        id: job.id,
        title: job.title,
        body: stripHtml(`${job.title} ${job.description}`),
        url: job.url,
        source: 'contract-role',
        budget: job.salary,
        postedAt: job.postedAt,
      }));
      const stored = insertNewLeads(
        // Already passed the jobs filter ⇒ relevant; floor at minScore so they always store.
        candidates.map((c) => ({ ...c, score: Math.max(scoreLead(c), config.leads.minScore) })),
      );
      if (stored > 0) console.log(`[job-sync] routed ${stored} contract-type matches to leads`);
    }

    const fresh = selectNewJobs(matched);
    console.log(
      `[job-sync] fetched ${jobs.length} → matched ${allMatched.length}` +
        ` (${contracts.length} → leads) → new ${fresh.length}`,
    );

    let emailedCount = 0;
    if (fresh.length > 0) {
      // Mark seen only after delivery succeeded — a failed send retries next run.
      const delivery = await sendDigest(fresh);
      markSeen(fresh, { emailed: delivery === 'emailed' });
      if (delivery === 'emailed') emailedCount = fresh.length;
    } else {
      console.log('[job-sync] no new matches — no email sent');
    }

    finishRun(runId, {
      status: 'ok',
      fetched: jobs.length,
      matched: allMatched.length,
      fresh: fresh.length,
      emailed: emailedCount,
    });
    console.log('[job-sync] run finished');
  } catch (err) {
    finishRun(runId, { status: 'failed', error: String(err) });
    throw err;
  }
}

main().catch((err) => {
  console.error('[job-sync] fatal:', err);
  process.exit(1);
});
