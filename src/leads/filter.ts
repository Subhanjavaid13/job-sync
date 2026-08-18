import type { LeadCandidate } from '../types.js';
import { config } from '../config.js';

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intent score (LEADS_PLAN §5): hiring intent + Shopify context + budget +
 * recency. A candidate below config.leads.minScore is not a lead.
 */
export function scoreLead(candidate: LeadCandidate): number {
  const cfg = config.leads;
  const w = cfg.scoring;
  const title = candidate.title.toLowerCase();
  const body = candidate.body.toLowerCase();

  // Freelancers advertising themselves are not clients hiring.
  if (cfg.excludeKeywords.some((k) => title.includes(k) || body.slice(0, 200).includes(k))) {
    return 0;
  }
  // News/meta posts are never hiring posts.
  if (cfg.titleExcludeKeywords.some((k) => title.includes(k))) return 0;

  // Hiring intent is a HARD GATE — Shopify context alone is just someone
  // talking about Shopify (news, pricing complaints, showcases).
  const intentHits = cfg.intentKeywords.filter((p) => body.includes(p)).length;
  if (intentHits === 0) return 0;

  let score = Math.min(intentHits, 3) * w.intentWeight;
  // Context counts ONCE per placement — "shopify" and "shopify plus" in one
  // title must not stack into a threshold-crossing score by themselves.
  if (cfg.contextKeywords.some((t) => title.includes(t))) score += w.contextTitleWeight;
  else if (cfg.contextKeywords.some((t) => body.includes(t))) score += w.contextBodyWeight;
  if (candidate.budget || /\$\s?\d|\d+\s?\/\s?hr|per hour|fixed price/i.test(candidate.body)) {
    score += w.budgetWeight;
  }
  if (candidate.postedAt) {
    const ageHours = (Date.now() - new Date(candidate.postedAt).getTime()) / 3_600_000;
    if (ageHours >= 0 && ageHours <= w.recencyHours) score += w.recencyWeight;
  }
  return score;
}

/** Keeps candidates at/above the score threshold, best first. */
export function filterLeads(candidates: LeadCandidate[]): Array<LeadCandidate & { score: number }> {
  return candidates
    .map((c) => ({ ...c, score: scoreLead(c) }))
    .filter((c) => c.score >= config.leads.minScore)
    .sort((a, b) => b.score - a.score);
}
