import type { Fetcher } from '../types.js';

/**
 * TODO (M2): implement via JSearch on RapidAPI (Google for Jobs results,
 * which include postings from LinkedIn / Indeed / Glassdoor).
 * Endpoint: https://jsearch.p.rapidapi.com/search
 *   ?query=shopify%20developer&remote_jobs_only=true
 *   headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY }
 * Free tier is ~200 requests/month — with a run every 2 h (~360/mo), call this
 * source only every other run, or reduce cron frequency before going live.
 */
export const jsearch: Fetcher = {
  name: 'jsearch',
  async fetchJobs() {
    if (!process.env.RAPIDAPI_KEY) {
      console.warn('[job-sync] jsearch: skipped (RAPIDAPI_KEY not set)');
      return [];
    }
    console.warn('[job-sync] jsearch: not implemented yet (M2)');
    return [];
  },
};
