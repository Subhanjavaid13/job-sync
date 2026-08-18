import type { LeadCandidate, LeadFetcher } from '../../types.js';
import { config } from '../../config.js';
import { stripHtml } from '../filter.js';

interface AlgoliaHit {
  objectID: string;
  title?: string;
  comment_text?: string;
  story_id?: number;
  created_at?: string;
}

const API = 'https://hn.algolia.com/api/v1';

async function getJson(url: string): Promise<{ hits?: AlgoliaHit[] }> {
  const res = await fetch(url, { headers: { 'User-Agent': config.userAgent } });
  if (!res.ok) throw new Error(`hackernews: HTTP ${res.status}`);
  return (await res.json()) as { hits?: AlgoliaHit[] };
}

/**
 * HN's monthly "Freelancer? Seeking freelancer?" threads (Algolia public API,
 * no key): find the latest thread(s), then pull comments mentioning the search
 * term. "Seeking freelancer" comments there are clients describing projects.
 */
export const hackernews: LeadFetcher = {
  name: 'hackernews',
  async fetchLeads(): Promise<LeadCandidate[]> {
    // Exact phrase + newest-first finds the current monthly thread reliably.
    const threads = await getJson(
      `${API}/search_by_date?query=${encodeURIComponent('"Freelancer? Seeking freelancer?"')}&tags=story&hitsPerPage=4`,
    );
    const threadIds = (threads.hits ?? [])
      .filter((h) => /freelancer\? seeking freelancer\?/i.test(h.title ?? ''))
      .slice(0, 2) // current + previous month
      .map((h) => h.objectID);
    if (threadIds.length === 0) return [];

    const term = encodeURIComponent(config.leads.searchTerm);
    const cutoff = Date.now() - config.leads.maxAgeDays * 86_400_000;
    const leads: LeadCandidate[] = [];
    for (const storyId of threadIds) {
      const comments = await getJson(
        `${API}/search_by_date?query=${term}&tags=comment,story_${storyId}&hitsPerPage=30`,
      );
      for (const hit of comments.hits ?? []) {
        if (!hit.comment_text) continue;
        if (hit.created_at && new Date(hit.created_at).getTime() < cutoff) continue;
        const text = stripHtml(hit.comment_text);
        leads.push({
          id: `hackernews:${hit.objectID}`,
          title: text.length > 90 ? `${text.slice(0, 90)}…` : text,
          body: text,
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source: 'hackernews',
          postedAt: hit.created_at ?? null,
        });
      }
    }
    return leads;
  },
};
