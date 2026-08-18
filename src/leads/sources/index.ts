import type { LeadFetcher } from '../../types.js';
import { reddit } from './reddit.js';
import { hackernews } from './hackernews.js';

export const leadSources: LeadFetcher[] = [reddit, hackernews];
