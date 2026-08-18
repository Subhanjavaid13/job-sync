import type { Job } from '../types.js';
import { config } from '../config.js';

/** Rules-based filter (PRD FR2): keyword include/exclude + remote check. */
export function filterJobs(jobs: Job[]): Job[] {
  return jobs.filter((job) => {
    // Tag-stuffed spam postings carry 20+ unrelated tags ("shopify" included).
    // When the tag list is implausibly long, don't trust it for matching.
    const trustedTags = job.tags.length <= 12 ? job.tags : [];
    const titleTags = `${job.title} ${trustedTags.join(' ')}`.toLowerCase();
    const description = job.description.toLowerCase();
    const haystack = `${titleTags} ${description}`;

    const included =
      config.includeKeywords.some((k) => titleTags.includes(k)) ||
      config.descriptionKeywords.some((k) => description.includes(k));
    if (!included) return false;

    const title = job.title.toLowerCase();
    if (config.excludeKeywords.some((k) => title.includes(k))) return false;

    // Sources that aren't remote-only must state remote somewhere.
    if (!config.remoteOnlySources.includes(job.source) && !haystack.includes('remote')) {
      return false;
    }

    return true;
  });
}
