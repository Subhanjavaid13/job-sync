import type { Fetcher, Job } from '../types.js';
import { config } from '../config.js';

interface RemoteOkJob {
  id?: string | number;
  position?: string;
  company?: string;
  url?: string;
  description?: string;
  tags?: string[];
  date?: string;
  salary_min?: number;
  salary_max?: number;
  location?: string;
  legal?: string; // first array element is a legal notice, not a job
}

export const remoteok: Fetcher = {
  name: 'remoteok',
  async fetchJobs(): Promise<Job[]> {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': config.userAgent },
    });
    if (!res.ok) throw new Error(`remoteok: HTTP ${res.status}`);
    const data = (await res.json()) as RemoteOkJob[];

    return data
      .filter((j) => j.id && j.position)
      .map((j) => ({
        id: `remoteok:${j.id}`,
        title: j.position ?? '',
        company: j.company ?? 'Unknown',
        url: j.url ?? '',
        description: j.description ?? '',
        tags: j.tags ?? [],
        postedAt: j.date ?? null,
        source: 'remoteok',
        salary:
          j.salary_min && j.salary_max ? `$${j.salary_min}–$${j.salary_max}` : undefined,
        location: j.location || undefined,
      }));
  },
};
