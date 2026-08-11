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
}

export interface Fetcher {
  name: string;
  /** Throw on failure — the pipeline isolates failures per fetcher. */
  fetchJobs(): Promise<Job[]>;
}
