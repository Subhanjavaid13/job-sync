export interface Job {
  /** Stable unique id across runs: "<source>:<externalId>" (or normalized URL). */
  id: string;
  title: string;
  company: string;
  url: string;
  /** Plain text or HTML body; used for keyword matching only. */
  description: string;
  tags: string[];
  /** ISO timestamp, or null when the source doesn't provide one. */
  postedAt: string | null;
  source: string;
  salary?: string;
  location?: string;
  /** Keyword match score (set by the filter; higher = better match). */
  score?: number;
}

export interface Fetcher {
  name: string;
  /** Throw on failure — the pipeline isolates failures per fetcher. */
  fetchJobs(): Promise<Job[]>;
}

/** Workflow states for the leads pipeline (see LEADS_PLAN.md). */
export const LEAD_STATUSES = ['new', 'shortlisted', 'contacted', 'replied', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  budget?: string;
  score: number;
  status: LeadStatus;
  notes?: string;
  postedAt: string | null;
  firstSeen: string;
  updatedAt: string;
}

/** What a lead source emits — before scoring/status/storage fields exist. */
export interface LeadCandidate {
  /** Stable unique id: "<source>:<externalId>". */
  id: string;
  title: string;
  /** Full text used for intent matching; a trimmed version becomes the stored summary. */
  body: string;
  url: string;
  source: string;
  budget?: string;
  postedAt: string | null;
}

export interface LeadFetcher {
  name: string;
  /** Throw on failure — the leads pipeline isolates failures per source. */
  fetchLeads(): Promise<LeadCandidate[]>;
}

export interface RunRecord {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'ok' | 'failed';
  fetched: number;
  matched: number;
  fresh: number;
  emailed: number;
  error: string | null;
}
