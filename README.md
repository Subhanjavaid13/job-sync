# job-sync

Automated job-alert pipeline: fetches newly posted **remote Shopify developer** jobs from 6 sources on a schedule, filters them (Shopify · ~3–4 yrs experience · fully remote), removes duplicates, and emails a digest of only never-seen-before matches.

Not a server, not an agent — a deterministic script that cron runs every 2 hours and that exits when done. See [PRD.md](PRD.md) for the full product spec.

## Pipeline

```
fetchers (×6) → normalize → filter (rules) → dedupe (SQLite) → email digest
```

## Job sources

| Source | Status | Access |
|---|---|---|
| Remotive | ✅ implemented | free public API |
| RemoteOK | ✅ implemented | free public JSON feed |
| We Work Remotely | 🔲 stub | free RSS |
| Jobicy | 🔲 stub | free public API |
| Adzuna | 🔲 stub | free API — create keys at developer.adzuna.com |
| JSearch (RapidAPI) | 🔲 stub | free tier — subscribe on rapidapi.com |

## Quick start

```powershell
npm install
copy .env.example .env   # then fill in SMTP + API keys (optional to start)
npm start
```

With no `.env`, the run still works: it fetches, filters, dedupes, and **prints** the digest to the console instead of emailing it.

Useful scripts:

- `npm start` — one full pipeline run
- `npm run typecheck` — TypeScript check, no emit

## Configuration

Search criteria (keywords, exclusions) live in [src/config.ts](src/config.ts). Secrets live in `.env` (see [.env.example](.env.example)):

| Variable | Purpose |
|---|---|
| `EMAIL_TO` | where the digest goes |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` | any SMTP provider (Gmail app password, Resend SMTP, …) |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Adzuna fetcher |
| `RAPIDAPI_KEY` | JSearch fetcher |
| `DB_PATH` | dedupe DB location (default `data/jobs.db`) |

## Deployment (GitHub Actions)

[.github/workflows/job-sync.yml](.github/workflows/job-sync.yml) runs the pipeline every 2 hours and commits the updated dedupe DB back to the repo so state persists between runs. To go live:

1. Push this repo to GitHub.
2. Add the `.env` values as **repository secrets** (Settings → Secrets → Actions).
3. Trigger once manually via the *Run workflow* button to verify.

Note: `data/` is intentionally **tracked** in git — it is the persistence layer for the Actions runner.

## Project structure

```
src/
  index.ts            pipeline entry point
  config.ts           search criteria + env-backed settings
  types.ts            Job + Fetcher interfaces
  fetchers/
    index.ts          fetcher registry
    remotive.ts       reference implementation
    remoteok.ts       implemented
    weworkremotely.ts jobicy.ts  adzuna.ts  jsearch.ts   (stubs, TODO)
  pipeline/
    filter.ts         keyword rules (LLM step planned — see PRD M3)
    dedupe.ts         SQLite seen-jobs store, 2-level dedupe
    email.ts          digest via nodemailer, console fallback
```

## Roadmap

- **M2** — implement the 4 stub fetchers, go live on Actions cron.
- **M3** — LLM classification (Claude Haiku) for experience level + true-remote check.
