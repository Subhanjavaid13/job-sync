import type { Fetcher } from '../types.js';

/**
 * TODO (M2): implement via official API (free keys: https://developer.adzuna.com).
 * Endpoint: https://api.adzuna.com/v1/api/jobs/{country}/search/1
 *   ?app_id=...&app_key=...&what=shopify%20developer&where=remote
 * Reads ADZUNA_APP_ID / ADZUNA_APP_KEY from env (see .env.example).
 * Aggregator source: expect cross-posted jobs — dedupe handles them.
 */
export const adzuna: Fetcher = {
  name: 'adzuna',
  async fetchJobs() {
    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
      console.warn('[job-sync] adzuna: skipped (ADZUNA_APP_ID/KEY not set)');
      return [];
    }
    console.warn('[job-sync] adzuna: not implemented yet (M2)');
    return [];
  },
};
