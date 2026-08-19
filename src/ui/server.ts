import 'dotenv/config';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../config.js';
import { openDb } from '../pipeline/db.js';
import { LEAD_STATUSES } from '../types.js';
import { pageHtml } from './page.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAX_LOG_LINES = 800;

/** In-memory state of the run triggered from the UI (cron runs are in the runs table). */
const runState = {
  running: false,
  startedAt: null as string | null,
  exitCode: null as number | null,
  log: [] as string[],
};

function pushLog(chunk: Buffer | string): void {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line.trim() === '') continue;
    runState.log.push(line);
  }
  if (runState.log.length > MAX_LOG_LINES) {
    runState.log.splice(0, runState.log.length - MAX_LOG_LINES);
  }
}

function triggerRun(): boolean {
  if (runState.running) return false;
  runState.running = true;
  runState.startedAt = new Date().toISOString();
  runState.exitCode = null;
  runState.log = ['[ui] starting pipeline…'];

  // shell:true so Windows resolves npm.cmd
  const child = spawn('npm', ['start'], { cwd: ROOT, shell: true, env: { ...process.env } });
  child.stdout.on('data', pushLog);
  child.stderr.on('data', pushLog);
  child.on('close', (code) => {
    runState.running = false;
    runState.exitCode = code ?? -1;
    pushLog(`[ui] pipeline exited with code ${code}`);
  });
  child.on('error', (err) => {
    runState.running = false;
    runState.exitCode = -1;
    pushLog(`[ui] failed to start pipeline: ${String(err)}`);
  });
  return true;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 100_000) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const SAMPLE_LEADS = [
  {
    id: 'sample:1',
    title: 'Shopify theme customization for fashion store',
    summary: 'Merchant on r/shopify looking for a developer to customize the Dawn theme: mega menu, quick-buy, and speed fixes.',
    url: 'https://www.reddit.com/r/shopify/',
    source: 'reddit',
    budget: '$1,500',
    score: 12,
    status: 'new',
    posted_at: '2026-08-16T10:00:00Z',
    first_seen: '2026-08-16T12:00:00Z',
    updated_at: '2026-08-16T12:00:00Z',
  },
  {
    id: 'sample:2',
    title: 'Migrate WooCommerce store to Shopify (250 products)',
    summary: 'Full migration project: products, customers, redirects, and a near-identical theme rebuild.',
    url: 'https://www.freelancer.com/',
    source: 'freelancer.com',
    budget: '$2,000–4,000',
    score: 10,
    status: 'shortlisted',
    posted_at: '2026-08-15T09:00:00Z',
    first_seen: '2026-08-15T11:00:00Z',
    updated_at: '2026-08-17T08:00:00Z',
  },
  {
    id: 'sample:3',
    title: 'Hydrogen storefront build for beverage brand',
    summary: 'Agency posting in an HN freelance thread seeking a contractor for a 6-week headless Hydrogen build.',
    url: 'https://news.ycombinator.com/',
    source: 'hackernews',
    budget: undefined,
    score: 9,
    status: 'contacted',
    posted_at: '2026-08-12T14:00:00Z',
    first_seen: '2026-08-12T16:00:00Z',
    updated_at: '2026-08-17T19:00:00Z',
  },
  {
    id: 'sample:4',
    title: 'Ongoing Shopify Plus support retainer',
    summary: 'Contract-type posting routed from the job sources: recurring theme + app maintenance, ~15 h/week.',
    url: 'https://jobicy.com/',
    source: 'contract-role',
    budget: '$45/hr',
    score: 8,
    status: 'replied',
    posted_at: '2026-08-10T08:00:00Z',
    first_seen: '2026-08-10T09:00:00Z',
    updated_at: '2026-08-18T07:00:00Z',
  },
  {
    id: 'sample:5',
    title: 'Checkout UI extension for subscription app',
    summary: 'Two-week fixed-scope build of a checkout UI extension; delivered and paid.',
    url: 'https://www.reddit.com/r/shopify/',
    source: 'reddit',
    budget: '$900',
    score: 7,
    status: 'won',
    posted_at: '2026-08-02T10:00:00Z',
    first_seen: '2026-08-02T12:00:00Z',
    updated_at: '2026-08-09T10:00:00Z',
  },
];

function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  if (url.pathname === '/api/overview') {
    const db = openDb();
    const one = (sql: string) => Number((db.prepare(sql).get() as { n: number }).n);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const totals = {
      seen: one('SELECT COUNT(*) AS n FROM seen_jobs'),
      emailed: one('SELECT COUNT(*) AS n FROM seen_jobs WHERE emailed = 1'),
      newThisWeek: Number(
        (db.prepare('SELECT COUNT(*) AS n FROM seen_jobs WHERE first_seen >= ?').get(weekAgo) as { n: number }).n,
      ),
      activeSources: one("SELECT COUNT(DISTINCT source) AS n FROM seen_jobs WHERE source IS NOT NULL"),
    };
    const perSource = db
      .prepare(
        `SELECT COALESCE(source, 'earlier runs') AS source, COUNT(*) AS count
         FROM seen_jobs GROUP BY COALESCE(source, 'earlier runs') ORDER BY count DESC`,
      )
      .all();
    // 14-day sparkline of newly seen jobs
    const twoWeeksAgo = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);
    const perDayRows = db
      .prepare(
        `SELECT substr(first_seen, 1, 10) AS day, COUNT(*) AS count
         FROM seen_jobs WHERE first_seen >= ? GROUP BY day ORDER BY day`,
      )
      .all(twoWeeksAgo) as Array<{ day: string; count: number }>;
    const perDay: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      perDay.push(perDayRows.find((r) => r.day === day)?.count ?? 0);
    }
    const runs = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 15').all();
    db.close();
    json(res, 200, { totals, perSource, perDay, runs });
    return;
  }

  if (url.pathname === '/api/jobs') {
    const db = openDb();
    const q = url.searchParams.get('q')?.trim() ?? '';
    const source = url.searchParams.get('source') ?? '';
    const order = url.searchParams.get('order') === 'score' ? 'score DESC' : 'first_seen DESC';
    const where: string[] = [];
    const params: string[] = [];
    if (q) {
      where.push('(title LIKE ? OR company LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (source) {
      where.push('source = ?');
      params.push(source);
    }
    const sql = `SELECT id, title, company, url, source, salary, location, posted_at, first_seen, score, emailed
      FROM seen_jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${order} LIMIT 300`;
    const jobs = db.prepare(sql).all(...params);
    const sources = db
      .prepare('SELECT DISTINCT source FROM seen_jobs WHERE source IS NOT NULL ORDER BY source')
      .all() as Array<{ source: string }>;
    db.close();
    json(res, 200, { jobs, sources: sources.map((s) => s.source) });
    return;
  }

  if (url.pathname === '/api/leads' && req.method === 'GET') {
    const db = openDb();
    const rows = db.prepare('SELECT * FROM leads ORDER BY updated_at DESC').all();
    db.close();
    if (rows.length === 0) {
      json(res, 200, { leads: SAMPLE_LEADS, sample: true, statuses: LEAD_STATUSES });
    } else {
      json(res, 200, { leads: rows, sample: false, statuses: LEAD_STATUSES });
    }
    return;
  }

  if (url.pathname === '/api/leads/status' && req.method === 'POST') {
    readBody(req)
      .then((body) => {
        const { id, status } = JSON.parse(body || '{}') as { id?: string; status?: string };
        if (!id || !status || !(LEAD_STATUSES as readonly string[]).includes(status)) {
          json(res, 400, { ok: false, error: 'invalid id/status' });
          return;
        }
        if (id.startsWith('sample:')) {
          json(res, 200, { ok: true, sample: true });
          return;
        }
        const db = openDb();
        const { changes } = db
          .prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?')
          .run(status, new Date().toISOString(), id);
        db.close();
        json(res, Number(changes) > 0 ? 200 : 404, { ok: Number(changes) > 0 });
      })
      .catch((err) => json(res, 400, { ok: false, error: String(err) }));
    return;
  }

  if (url.pathname === '/api/leads/notes' && req.method === 'POST') {
    readBody(req)
      .then((body) => {
        const { id, notes } = JSON.parse(body || '{}') as { id?: string; notes?: string };
        if (!id || typeof notes !== 'string' || notes.length > 4000) {
          json(res, 400, { ok: false, error: 'invalid id/notes' });
          return;
        }
        if (id.startsWith('sample:')) {
          json(res, 200, { ok: true, sample: true });
          return;
        }
        const db = openDb();
        const { changes } = db
          .prepare('UPDATE leads SET notes = ?, updated_at = ? WHERE id = ?')
          .run(notes, new Date().toISOString(), id);
        db.close();
        json(res, Number(changes) > 0 ? 200 : 404, { ok: Number(changes) > 0 });
      })
      .catch((err) => json(res, 400, { ok: false, error: String(err) }));
    return;
  }

  if (url.pathname === '/api/run' && req.method === 'POST') {
    const started = triggerRun();
    json(res, started ? 200 : 409, { ok: started, running: runState.running });
    return;
  }

  if (url.pathname === '/api/run/status') {
    json(res, 200, {
      running: runState.running,
      startedAt: runState.startedAt,
      exitCode: runState.exitCode,
      log: runState.log.join('\n'),
    });
    return;
  }

  json(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url);
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pageHtml);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  } catch (err) {
    console.error('[job-sync] ui error:', err);
    if (!res.headersSent) json(res, 500, { error: String(err) });
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[job-sync] port ${config.ui.port} is already in use — another dashboard instance is likely running.\n` +
        `[job-sync] Open http://localhost:${config.ui.port}, or start on a different port: UI_PORT=4322 npm run ui`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(config.ui.port, '127.0.0.1', () => {
  console.log(`[job-sync] dashboard running at http://localhost:${config.ui.port}`);
  console.log('[job-sync] local-only (bound to 127.0.0.1). Ctrl+C to stop.');
});
