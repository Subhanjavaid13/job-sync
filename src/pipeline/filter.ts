import type { Job } from '../types.js';
import { config } from '../config.js';

/**
 * Keyword match score: where a keyword hits matters (title > tags > description).
 * The digest and dashboard sort by this, best match first.
 */
export function scoreJob(job: Job): number {
  const title = job.title.toLowerCase();
  const tags = job.tags.join(' ').toLowerCase();
  const description = job.description.toLowerCase();
  const w = config.scoring;

  let score = 0;
  for (const k of config.includeKeywords) {
    if (title.includes(k)) score += w.titleWeight;
    else if (tags.includes(k)) score += w.tagWeight;
  }
  for (const k of config.descriptionKeywords) {
    if (description.includes(k)) score += w.descriptionWeight;
  }
  if (job.salary) score += w.salaryBonus;
  return score;
}

/** Rules-based filter (PRD FR2): keyword include/exclude + remote check. Result is score-sorted. */
export function filterJobs(jobs: Job[]): Job[] {
  const matched = jobs.filter((job) => {
    // Tag-stuffed spam postings carry 20+ unrelated tags ("shopify" included).
    // When the tag list is implausibly long, don't trust it for matching.
    const trustedTags = job.tags.length <= 12 ? job.tags : [];
    const titleTags = `${job.title} ${trustedTags.join(' ')}`.toLowerCase();
    const description = job.description.toLowerCase();
    const haystack = `${titleTags} ${description}`;

    const title = job.title.toLowerCase();
    const titleTagHit = config.includeKeywords.some((k) => titleTags.includes(k));
    const descriptionHit = config.descriptionKeywords.some((k) => description.includes(k));
    if (!titleTagHit && !descriptionHit) return false;

    // Description-only match: title must look like a developer role, or every
    // posting at Shopify-ecosystem companies matches (sales, legal, ...).
    if (!titleTagHit && !config.devRoleTitleKeywords.some((k) => title.includes(k))) {
      return false;
    }

    if (config.excludeKeywords.some((k) => title.includes(k))) return false;

    // Sources that aren't remote-only must state remote somewhere.
    if (!config.remoteOnlySources.includes(job.source) && !haystack.includes('remote')) {
      return false;
    }

    return true;
  });

  return matched
    .map((job) => ({ ...job, score: scoreJob(job) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Contract/freelance-type matches are project leads, not employment — route
 * them to the leads funnel (LEADS_PLAN §2 S2) instead of the jobs digest.
 */
export function splitContractRoles(jobs: Job[]): { employment: Job[]; contracts: Job[] } {
  const employment: Job[] = [];
  const contracts: Job[] = [];
  for (const job of jobs) {
    const titleTags = `${job.title} ${job.tags.join(' ')}`.toLowerCase();
    if (config.leads.contractMarkers.some((m) => titleTags.includes(m))) contracts.push(job);
    else employment.push(job);
  }
  return { employment, contracts };
}
