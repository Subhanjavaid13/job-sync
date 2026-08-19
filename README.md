# job-sync

Automated job-alert pipeline: fetches newly posted **remote Shopify developer** jobs from 7 sources on a schedule, filters and scores them (Shopify · ~3–4 yrs experience · fully remote), removes duplicates, and emails a digest of only never-seen-before matches — plus a **leads generator** for Shopify freelance projects and a **local dashboard** to see and drive everything.

Not a server, not an agent — deterministic scripts that cron runs and that exit when done. See [PRD.md](PRD.md) for the product spec and [LEADS_PLAN.md](LEADS_PLAN.md) for the leads funnel.

## The two funnels

```
JOBS   fetchers (×7) → normalize → filter + score → dedupe (SQLite) → email digest
LEADS  sources (Reddit RSS, HN threads, contract-type job matches) → intent score → leads board
```

## Dashboard (`npm run ui`)

Local-only interface at http://localhost:4321 (binds 127.0.0.1) — no more running scripts blind:

- **Overview** — stat tiles (tracked / emailed / new this week / sources), 14-day trend sparkline, matches-per-source chart, run history for local *and* cloud runs.
- **Jobs** — searchable, filterable table of every tracked job (newest or best-match first).
- **Leads** — workflow board: `new → shortlisted → contacted → replied → won/lost`, with per-lead notes. Status changes persist to the DB.
- **Run** — a *Run pipeline now* button with live log output.

## Job sources

| Source | Status | Access |
|---|---|---|
| Remotive | ✅ live | free public API |
| RemoteOK | ✅ live | free public JSON feed |
| We Work Remotely | ✅ live | free RSS |
| Jobicy | ✅ live | free public API |
| Company boards (Klaviyo, Postscript, Yotpo, AfterShip, Remote.com, Okendo) | ✅ live | Greenhouse/Lever public JSON — list is data in `config.targetBoards` |
| Adzuna | ✅ live | free keys at developer.adzuna.com |
| JSearch (RapidAPI) | ✅ key set — needs the free **Basic** subscription on the JSearch page | free tier on rapidapi.com (~200 req/mo; daily runs use ~30) |

## Lead sources

| Source | Status | Notes |
|---|---|---|
| Reddit (r/shopify, r/ecommerce, r/smallbusiness, r/forhire, r/hiring) | ✅ live | RSS search feeds (the JSON API blocks unauthenticated clients), fetched sequentially to respect rate limits |
| HN "Freelancer? Seeking freelancer?" threads | ✅ live | Algolia public API; low volume, high quality |
| Contract-type job matches | ✅ live | routed from the jobs pipeline into the leads board automatically |
| Freelancer.com | 🔲 planned | needs their free API key |
| New-store detection | 🔲 optional backlog | see LEADS_PLAN.md |

## Quick start

```powershell
npm install
copy .env.example .env   # then fill in SMTP + API keys (optional to start)
npm start                # jobs pipeline once
npm run leads            # leads pipeline once
npm run ui               # dashboard at http://localhost:4321
```

With no `.env`, runs still work: jobs are fetched, filtered, deduped, and the digest **prints** to the console instead of emailing.

Useful scripts:

- `npm start` — one jobs-pipeline run
- `npm run leads` — one leads-pipeline run (emails new leads too, when SMTP is set)
- `npm run ui` — local dashboard
- `npm test` — unit tests (filter, scoring, lead intent, dedupe)
- `npm run typecheck` — TypeScript check, no emit

## Configuration

All criteria are data in [src/config.ts](src/config.ts): job keywords/exclusions, scoring weights, target company boards, lead subreddits, intent phrases, thresholds. Secrets live in `.env` (see [.env.example](.env.example)):

| Variable | Purpose |
|---|---|
| `EMAIL_TO` | where the digest goes |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` | any SMTP provider (Gmail app password, Resend SMTP, …) |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Adzuna fetcher |
| `RAPIDAPI_KEY` | JSearch fetcher |
| `UI_PORT` | dashboard port (default 4321) |
| `DB_PATH` | SQLite location (default `data/jobs.db`) |

## Deployment (GitHub Actions)

[.github/workflows/job-sync.yml](.github/workflows/job-sync.yml) runs both pipelines **once daily at 08:00 Pakistan time** (03:00 UTC) and commits the updated DB back to the repo so state persists between runs. Run on demand anytime via the *Run workflow* button (cloud) or the dashboard's Run tab (local). To go live:

1. Push this repo to GitHub.
2. Add the `.env` values as **repository secrets** (Settings → Secrets → Actions). Until they exist, cloud runs with new matches fail on purpose instead of silently consuming jobs.
3. Trigger once manually via the *Run workflow* button to verify.

Note: `data/` is intentionally **tracked** in git — it is the persistence layer for the Actions runner.

## Project structure

```
src/
  index.ts            jobs pipeline entry
  config.ts           ALL criteria/settings as data
  types.ts            Job, Fetcher, Lead, LeadFetcher, RunRecord
  fetchers/           one job source = one file (7 sources)
  pipeline/
    db.ts             SQLite schema owner (additive migrations)
    filter.ts         keyword rules + scoring + contract-role split
    dedupe.ts         2-level dedupe, delivery-safe markSeen
    email.ts          grouped HTML digest, console fallback, CI guard
    runlog.ts         run history for the dashboard
  leads/
    index.ts          leads pipeline entry
    filter.ts         intent scoring
    store.ts          leads table insert/dedupe/retention
    sources/          one lead source = one file (reddit, hackernews)
  ui/
    server.ts         local API + run trigger (127.0.0.1)
    page.ts           the dashboard (zero dependencies, contrast-validated palette)
scripts/
  notify-failure.ts   failure-alert email for CI
tests/                unit tests (node:test via tsx) — filter, scoring, leads intent, dedupe
```

## Roadmap

Step-by-step build order with done-checks: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Remaining: credentials (SMTP app password → real emails; optional Adzuna/JSearch/Freelancer.com keys), keyword tuning as digests arrive, and — later, deliberately — the AI steps (Part 9: relevance classifier, lead qualification, outreach drafts).
