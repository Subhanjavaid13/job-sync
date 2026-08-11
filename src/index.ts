import 'dotenv/config';
import { fetchers } from './fetchers/index.js';
import { filterJobs } from './pipeline/filter.js';
import { selectNewJobs, markSeen } from './pipeline/dedupe.js';
import { sendDigest } from './pipeline/email.js';

async function main(): Promise<void> {
  console.log(`[job-sync] run started ${new Date().toISOString()}`);

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

  const matched = filterJobs(jobs);
  const fresh = selectNewJobs(matched);
  console.log(`[job-sync] fetched ${jobs.length} → matched ${matched.length} → new ${fresh.length}`);

  if (fresh.length > 0) {
    // Mark seen only after delivery succeeded — a failed send retries next run.
    await sendDigest(fresh);
    markSeen(fresh);
  } else {
    console.log('[job-sync] no new matches — no email sent');
  }

  console.log('[job-sync] run finished');
}

main().catch((err) => {
  console.error('[job-sync] fatal:', err);
  process.exit(1);
});
