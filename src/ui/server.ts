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

type RunKind = 'jobs' | 'leads';

/** Spawns the real pipeline (`npm start` or `npm run leads`) exactly as the cron does. */
function triggerRun(kind: RunKind): boolean {
  if (runState.running) return false;
  runState.running = true;
  runState.startedAt = new Date().toISOString();
  runState.exitCode = null;
  runState.log = [`[ui] starting ${kind} pipeline…`];

  const args = kind === 'leads' ? ['run', 'leads'] : ['start'];
  // shell:true so Windows resolves npm.cmd
  const child = spawn('npm', args, { cwd: ROOT, shell: true, env: { ...process.env } });
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

function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  if (url.pathname === '/api/overview') {
    const db = openDb();
    const one = (sql: string) => Number((db.prepare(sql).get() as { n: number }).n);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const totals = {
      seen: one('SELECT COUNT(*) AS n FROM seen_jobs'),
      emailed: one('SELECT COUNT(*) AS n FROM seen_jobs WHERE emailed = 1'),
      newThisWeek: Number(
        (db.prepare('SELECT COUNT(*) AS n FROM seen_jobs WHERE first_seen >= ?').get(weekAgo) as { n: number }).n,
      ),
      newToday: Number(
        (db.prepare('SELECT COUNT(*) AS n FROM seen_jobs WHERE first_seen >= ?').get(todayStart.toISOString()) as {
          n: number;
        }).n,
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
    // Daily-view filter: today (local midnight) / last 7 / last 30 days.
    const period = url.searchParams.get('period') ?? '';
    let cutoff: Date | null = null;
    if (period === 'today') {
      cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      cutoff = new Date(Date.now() - 7 * 86_400_000);
    } else if (period === '30d') {
      cutoff = new Date(Date.now() - 30 * 86_400_000);
    }
    if (cutoff) {
      where.push('first_seen >= ?');
      params.push(cutoff.toISOString());
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
    // Best matches first within each status column; newest activity breaks ties.
    const rows = db.prepare('SELECT * FROM leads ORDER BY score DESC, updated_at DESC').all();
    db.close();
    json(res, 200, { leads: rows, statuses: LEAD_STATUSES });
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
    readBody(req)
      .then((body) => {
        const { kind } = JSON.parse(body || '{}') as { kind?: string };
        const started = triggerRun(kind === 'leads' ? 'leads' : 'jobs');
        json(res, started ? 200 : 409, { ok: started, running: runState.running });
      })
      .catch((err) => json(res, 400, { ok: false, error: String(err) }));
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
