import type { Fetcher } from '../types.js';

/**
 * TODO (M2): implement via public API.
 * Endpoint: https://jobicy.com/api/v2/remote-jobs?tag=shopify
 * Response: { jobs: [{ id, jobTitle, companyName, url, jobDescription,
 * jobType, pubDate, annualSalaryMin/Max, jobGeo }] }
 */
export const jobicy: Fetcher = {
  name: 'jobicy',
  async fetchJobs() {
    console.warn('[job-sync] jobicy: not implemented yet (M2)');
    return [];
  },
};
