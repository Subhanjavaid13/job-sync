import type { Fetcher, Job } from '../types.js';
import { config } from '../config.js';

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  url: string;
  description?: string;
  tags?: string[];
  publication_date?: string;
  salary?: string;
  candidate_required_location?: string;
}

/** Reference fetcher implementation — copy this shape for new sources. */
export const remotive: Fetcher = {
  name: 'remotive',
  async fetchJobs(): Promise<Job[]> {
    const search = encodeURIComponent(config.searchTerms.join(' '));
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${search}`, {
      headers: { 'User-Agent': config.userAgent },
    });
    if (!res.ok) throw new Error(`remotive: HTTP ${res.status}`);
    const data = (await res.json()) as { jobs: RemotiveJob[] };

    return data.jobs.map((j) => ({
      id: `remotive:${j.id}`,
      title: j.title,
      company: j.company_name,
      url: j.url,
      description: j.description ?? '',
      tags: j.tags ?? [],
      postedAt: j.publication_date ?? null,
      source: 'remotive',
      salary: j.salary || undefined,
      location: j.candidate_required_location || undefined,
    }));
  },
};
