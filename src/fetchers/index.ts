import type { Fetcher } from '../types.js';
import { remotive } from './remotive.js';
import { remoteok } from './remoteok.js';
import { weworkremotely } from './weworkremotely.js';
import { jobicy } from './jobicy.js';
import { adzuna } from './adzuna.js';
import { jsearch } from './jsearch.js';

export const fetchers: Fetcher[] = [
  remotive,
  remoteok,
  weworkremotely,
  jobicy,
  adzuna,
  jsearch,
];
