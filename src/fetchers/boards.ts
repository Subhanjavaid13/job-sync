import type { Fetcher, Job } from '../types.js';
import { config } from '../config.js';

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string; // HTML-escaped HTML, present with ?content=true
}

interface LeverPosting {
  id: string;
  text: string; // title
  hostedUrl: string;
  createdAt?: number; // epoch ms
  descriptionPlain?: string;
  workplaceType?: string; // 'remote' | 'hybrid' | 'onsite' | ...
  categories?: { location?: string; commitment?: string; team?: string };
}

async function fetchGreenhouseBoard(token: string, name: string): Promise<Job[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
    { headers: { 'User-Agent': config.userAgent } },
  );
  if (!res.ok) throw new Error(`greenhouse/${token}: HTTP ${res.status}`);
  const data = (await res.json()) as { jobs?: GreenhouseJob[] };

  return (data.jobs ?? []).map((j) => {
    const location = j.location?.name || undefined;
    // Filter requires "remote" in title/tags/desc for non-remote-only sources —
    // surface the board's own location signal as a tag.
    const tags = location && /remote/i.test(location) ? ['remote'] : [];
    return {
      id: `boards:greenhouse:${token}:${j.id}`,
      title: j.title,
      company: name,
      url: j.absolute_url,
      description: j.content ?? '',
      tags,
      postedAt: j.updated_at ?? null,
      source: 'boards',
      location,
    };
  });
}

async function fetchLeverBoard(company: string, name: string): Promise<Job[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
    headers: { 'User-Agent': config.userAgent },
  });
  if (!res.ok) throw new Error(`lever/${company}: HTTP ${res.status}`);
  const data = (await res.json()) as LeverPosting[];

  return data.map((j) => {
    const tags: string[] = [];
    if (j.workplaceType && /remote/i.test(j.workplaceType)) tags.push('remote');
    if (j.categories?.commitment) tags.push(j.categories.commitment);
    return {
      id: `boards:lever:${company}:${j.id}`,
      title: j.text,
      company: name,
      url: j.hostedUrl,
      description: j.descriptionPlain ?? '',
      tags,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      source: 'boards',
      location: j.categories?.location || undefined,
    };
  });
}

/**
 * Targeted company career boards (Greenhouse + Lever public JSON, keyless) —
 * Shopify-ecosystem companies configured in config.targetBoards. A single
 * unreachable board must not sink the rest: per-board failures are warnings;
 * the fetcher throws only when EVERY configured board failed (real outage).
 */
export const boards: Fetcher = {
  name: 'boards',
  async fetchJobs(): Promise<Job[]> {
    const tasks: Array<{ label: string; promise: Promise<Job[]> }> = [
      ...config.targetBoards.greenhouse.map((b) => ({
        label: `greenhouse/${b.token}`,
        promise: fetchGreenhouseBoard(b.token, b.name),
      })),
      ...config.targetBoards.lever.map((b) => ({
        label: `lever/${b.company}`,
        promise: fetchLeverBoard(b.company, b.name),
      })),
    ];
    if (tasks.length === 0) return [];

    const settled = await Promise.allSettled(tasks.map((t) => t.promise));
    const jobs: Job[] = [];
    let failures = 0;
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        jobs.push(...result.value);
      } else {
        failures += 1;
        console.warn(`[job-sync] boards: ${tasks[i]!.label} failed — ${String(result.reason)}`);
      }
    });
    if (failures === tasks.length) {
      throw new Error(`boards: all ${tasks.length} configured boards failed`);
    }
    return jobs;
  },
};
