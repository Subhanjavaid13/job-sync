import type { Fetcher, Job } from '../types.js';
import { config } from '../config.js';

interface AdzunaJob {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  category?: { label?: string };
}

// Aggregator source (Indeed-scale coverage): expect cross-posted duplicates —
// the dedupe stage handles them. Not remote-only, so the filter's "remote"
// check applies to these jobs.
export const adzuna: Fetcher = {
  name: 'adzuna',
  async fetchJobs(): Promise<Job[]> {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      console.warn('[job-sync] adzuna: skipped (ADZUNA_APP_ID/KEY not set)');
      return [];
    }

    const country = process.env.ADZUNA_COUNTRY ?? 'us';
    const what = encodeURIComponent(`${config.searchTerms.join(' ')} developer`);
    const url =
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
      `?app_id=${appId}&app_key=${appKey}&what=${what}&results_per_page=50` +
      `&content-type=application/json`;

    const res = await fetch(url, { headers: { 'User-Agent': config.userAgent } });
    if (!res.ok) throw new Error(`adzuna: HTTP ${res.status}`);
    const data = (await res.json()) as { results?: AdzunaJob[] };

    return (data.results ?? []).map((j) => ({
      id: `adzuna:${j.id}`,
      title: j.title,
      company: j.company?.display_name ?? 'Unknown',
      url: j.redirect_url,
      description: j.description ?? '',
      tags: j.category?.label ? [j.category.label] : [],
      postedAt: j.created ?? null,
      source: 'adzuna',
      salary:
        j.salary_min && j.salary_max
          ? `$${Math.round(j.salary_min)}–$${Math.round(j.salary_max)}`
          : undefined,
      location: j.location?.display_name || undefined,
    }));
  },
};
