import type { Fetcher } from '../types.js';

/**
 * TODO (M2): implement via RSS.
 * Feed: https://weworkremotely.com/categories/remote-programming-jobs.rss
 * Use the already-installed `rss-parser` package. Item title format is
 * "Company: Job Title"; use the item link as the id ("weworkremotely:<link>").
 */
export const weworkremotely: Fetcher = {
  name: 'weworkremotely',
  async fetchJobs() {
    console.warn('[job-sync] weworkremotely: not implemented yet (M2)');
    return [];
  },
};
