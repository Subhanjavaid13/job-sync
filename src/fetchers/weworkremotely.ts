import Parser from 'rss-parser';
import type { Fetcher, Job } from '../types.js';
import { config } from '../config.js';

const FEED_URL = 'https://weworkremotely.com/categories/remote-programming-jobs.rss';

export const weworkremotely: Fetcher = {
  name: 'weworkremotely',
  async fetchJobs(): Promise<Job[]> {
    const parser = new Parser({
      headers: { 'User-Agent': config.userAgent },
    });
    const feed = await parser.parseURL(FEED_URL);

    return (feed.items ?? [])
      .filter((item) => item.link)
      .map((item) => {
        // Item title format is "Company: Job Title"
        const rawTitle = item.title ?? '';
        const sep = rawTitle.indexOf(':');
        const company = sep > 0 ? rawTitle.slice(0, sep).trim() : 'Unknown';
        const title = sep > 0 ? rawTitle.slice(sep + 1).trim() : rawTitle;

        return {
          id: `weworkremotely:${item.guid ?? item.link}`,
          title,
          company,
          url: item.link ?? '',
          description: item.content ?? item.contentSnippet ?? '',
          tags: item.categories ?? [],
          postedAt: item.isoDate ?? null,
          source: 'weworkremotely',
        };
      });
  },
};
