import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Point the pipeline at a throwaway DB BEFORE importing any module that reads
// config (config captures DB_PATH at import time). node:test runs each test
// file in its own process, so this cannot leak into other files.
const TEST_DB = join(tmpdir(), `job-sync-test-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const { selectNewJobs, markSeen, pruneSeenJobs } = await import('../src/pipeline/dedupe.js');
const { openDb } = await import('../src/pipeline/db.js');
const { config } = await import('../src/config.js');
const { LEAD_STATUSES } = await import('../src/types.js');
type Job = import('../src/types.js').Job;

const job = (over: Partial<Job>): Job => ({
  id: 'src:1',
  title: 'Shopify Developer',
  company: 'Acme',
  url: 'https://example.com/1',
  description: '',
  tags: [],
  postedAt: null,
  source: 'remotive',
  score: 7,
  ...over,
});

test.after(() => {
  rmSync(TEST_DB, { force: true });
  rmSync(join(tmpdir(), '.db-dirty'), { force: true });
});

test('a job is new once, then never again', () => {
  const j = job({ id: 'a:1' });
  assert.equal(selectNewJobs([j]).length, 1);
  markSeen([j], { emailed: true });
  assert.equal(selectNewJobs([j]).length, 0);
});

test('cross-source duplicates collapse on normalized company+title', () => {
  const remotiveJob = job({ id: 'remotive:x', company: 'Shop Co.', title: 'Senior Shopify Dev!' });
  markSeen([remotiveJob], { emailed: true });
  const remoteokCopy = job({ id: 'remoteok:y', company: 'shop co', title: 'senior shopify dev', source: 'remoteok' });
  assert.equal(selectNewJobs([remoteokCopy]).length, 0);
});

test('same-run duplicates collapse too', () => {
  const first = job({ id: 'p:1', company: 'Dup Co', title: 'Same Role' });
  const second = job({ id: 'q:2', company: 'dup co', title: 'same role', source: 'boards' });
  assert.equal(selectNewJobs([first, second]).length, 1);
});

test('markSeen stores the details the dashboard needs', () => {
  const j = job({ id: 'detail:1', salary: '$90k', location: 'Anywhere' });
  markSeen([j], { emailed: false });
  const db = openDb();
  const row = db.prepare('SELECT * FROM seen_jobs WHERE id = ?').get(j.id) as Record<string, unknown>;
  db.close();
  assert.equal(row.title, j.title);
  assert.equal(row.company, j.company);
  assert.equal(row.salary, '$90k');
  assert.equal(row.emailed, 0);
  assert.equal(row.score, 7);
});

test('pruneSeenJobs removes only rows past the retention window', () => {
  const db = openDb();
  const ancient = new Date(Date.now() - (config.seenRetentionDays + 10) * 86_400_000).toISOString();
  db.prepare(
    `INSERT INTO seen_jobs (id, company_title_key, first_seen) VALUES ('old:1', 'old key', ?)`,
  ).run(ancient);
  db.close();
  pruneSeenJobs();
  const check = openDb();
  const oldGone = check.prepare(`SELECT 1 FROM seen_jobs WHERE id = 'old:1'`).get();
  const recentKept = check.prepare(`SELECT 1 FROM seen_jobs WHERE id = 'a:1'`).get();
  check.close();
  assert.equal(oldGone, undefined);
  assert.ok(recentKept);
});

test('lead statuses stay a closed set (portal + API contract)', () => {
  assert.deepEqual(
    [...LEAD_STATUSES],
    ['new', 'shortlisted', 'contacted', 'replied', 'won', 'lost'],
  );
});
