import type { Fetcher, Job } from '../types.js';
import { config } from '../config.js';

interface JobicyJob {
  id: number | string;
  url: string;
  jobTitle: string;
  companyName: string;
  jobDescription?: string;
  jobExcerpt?: string;
  jobIndustry?: string[] | string;
  jobLevel?: string;
  jobGeo?: string;
  pubDate?: string;
  annualSalaryMin?: number;
  annualSalaryMax?: number;
  salaryCurrency?: string;
}

export const jobicy: Fetcher = {
  name: 'jobicy',
  async fetchJobs(): Promise<Job[]> {
    const tag = encodeURIComponent(config.searchTerms.join(' '));
    const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?tag=${tag}`, {
      headers: { 'User-Agent': config.userAgent },
    });
    if (!res.ok) throw new Error(`jobicy: HTTP ${res.status}`);
    const data = (await res.json()) as { jobs?: JobicyJob[] };

    // With no matches Jobicy may return a friendly notice instead of a jobs array.
    if (!Array.isArray(data.jobs)) return [];

    return data.jobs.map((j) => {
      const industries = Array.isArray(j.jobIndustry)
        ? j.jobIndustry
        : j.jobIndustry
          ? [j.jobIndustry]
          : [];
      return {
        id: `jobicy:${j.id}`,
        title: j.jobTitle,
        company: j.companyName,
        url: j.url,
        description: j.jobDescription ?? j.jobExcerpt ?? '',
        tags: [...industries, ...(j.jobLevel ? [j.jobLevel] : [])],
        postedAt: j.pubDate ?? null,
        source: 'jobicy',
        salary:
          j.annualSalaryMin && j.annualSalaryMax
            ? `${j.annualSalaryMin}–${j.annualSalaryMax} ${j.salaryCurrency ?? ''}`.trim()
            : undefined,
        location: j.jobGeo || undefined,
      };
    });
  },
};
