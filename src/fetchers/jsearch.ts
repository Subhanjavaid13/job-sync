import type { Fetcher, Job } from '../types.js';
import { config } from '../config.js';

interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name?: string;
  job_apply_link?: string;
  job_description?: string;
  job_posted_at_datetime_utc?: string;
  job_is_remote?: boolean;
  job_city?: string;
  job_country?: string;
  job_min_salary?: number;
  job_max_salary?: number;
}

// Google for Jobs results — includes postings originally from LinkedIn /
// Indeed / Glassdoor. Free tier is ~200 requests/month; the daily cron
// (~30 runs/month) fits comfortably, so no rate gating is needed.
export const jsearch: Fetcher = {
  name: 'jsearch',
  async fetchJobs(): Promise<Job[]> {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      console.warn('[job-sync] jsearch: skipped (RAPIDAPI_KEY not set)');
      return [];
    }

    const query = encodeURIComponent(`${config.searchTerms.join(' ')} developer`);
    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=${query}&remote_jobs_only=true&num_pages=1`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      },
    );
    if (!res.ok) throw new Error(`jsearch: HTTP ${res.status}`);
    const data = (await res.json()) as { data?: JSearchJob[] };

    return (data.data ?? [])
      .filter((j) => j.job_id && j.job_title)
      .map((j) => ({
        id: `jsearch:${j.job_id}`,
        title: j.job_title,
        company: j.employer_name ?? 'Unknown',
        url: j.job_apply_link ?? '',
        description: j.job_description ?? '',
        // Filter requires "remote" in title/tags/desc for non-remote-only
        // sources — surface the API's own remote flag as a tag.
        tags: j.job_is_remote ? ['remote'] : [],
        postedAt: j.job_posted_at_datetime_utc ?? null,
        source: 'jsearch',
        salary:
          j.job_min_salary && j.job_max_salary
            ? `$${Math.round(j.job_min_salary)}–$${Math.round(j.job_max_salary)}`
            : undefined,
        location: [j.job_city, j.job_country].filter(Boolean).join(', ') || undefined,
      }));
  },
};
