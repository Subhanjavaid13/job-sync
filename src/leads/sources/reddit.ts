import Parser from 'rss-parser';
import type { LeadCandidate, LeadFetcher } from '../../types.js';
import { config } from '../../config.js';
import { stripHtml } from '../filter.js';

/**
 * Reddit blocks unauthenticated JSON API access from many networks (HTTP 403),
 * but the RSS search feeds are served normally — so this source consumes RSS.
 * If Reddit ever closes RSS too, the upgrade path is a free OAuth script app
 * (client-credentials), not scraping — see LEADS_PLAN.md.
 */
async function searchSubreddit(parser: Parser, sub: string): Promise<LeadCandidate[]> {
  const term = encodeURIComponent(config.leads.searchTerm);
  const url = `https://www.reddit.com/r/${sub}/search.rss?q=${term}&restrict_sr=1&sort=new&t=month`;
  const feed = await parser.parseURL(url);

  const cutoff = Date.now() - config.leads.maxAgeDays * 86_400_000;
  const leads: LeadCandidate[] = [];
  for (const item of feed.items ?? []) {
    if (!item.link || !item.title) continue;
    if (item.isoDate && new Date(item.isoDate).getTime() < cutoff) continue;
    // Post id from the permalink (/comments/<id>/...), falling back to the URL.
    const idMatch = item.link.match(/\/comments\/([a-z0-9]+)\//i);
    const externalId = idMatch ? idMatch[1] : item.link;
    leads.push({
      id: `reddit:${externalId}`,
      title: item.title,
      body: `${item.title}\n${stripHtml(item.content ?? item.contentSnippet ?? '')}`,
      url: item.link,
      source: `r/${sub}`,
      postedAt: item.isoDate ?? null,
    });
  }
  return leads;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const reddit: LeadFetcher = {
  name: 'reddit',
  async fetchLeads(): Promise<LeadCandidate[]> {
    const parser = new Parser({ headers: { 'User-Agent': config.userAgent }, timeout: 20_000 });
    const leads: LeadCandidate[] = [];
    // Sequential with generous spacing — Reddit's unauthenticated per-IP limit
    // 429s bursts (measured: ~20 s spacing passes, parallel fails). One retry
    // pass after a cooldown picks up subs that still got limited.
    let queue = [...config.leads.subreddits];
    for (let attempt = 0; attempt < 2 && queue.length > 0; attempt++) {
      if (attempt > 0) {
        console.log(`[job-sync] leads/reddit: retrying ${queue.length} rate-limited subreddits after cooldown`);
        await sleep(60_000);
      }
      const failed: string[] = [];
      for (const [i, sub] of queue.entries()) {
        if (i > 0 || attempt > 0) await sleep(20_000);
        try {
          leads.push(...(await searchSubreddit(parser, sub)));
        } catch (err) {
          failed.push(sub);
          if (attempt > 0) console.warn(`[job-sync] leads/reddit: r/${sub} failed — ${String(err)}`);
        }
      }
      queue = failed;
    }
    if (queue.length === config.leads.subreddits.length) {
      throw new Error('reddit: all subreddits failed');
    }
    if (queue.length > 0) {
      console.warn(`[job-sync] leads/reddit: gave up on r/${queue.join(', r/')} this run (rate limited) — next run covers them`);
    }
    return leads;
  },
};
