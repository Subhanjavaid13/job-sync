# CLAUDE.md

## What this project is

`job-sync` — an automated job-alert pipeline (scheduled script, **not** a server and **not** an agent). Every run: fetch remote jobs from 7 sources → normalize to `Job` → keyword filter + score → SQLite dedupe → email digest of new matches → exit. A second funnel (`npm run leads`) finds Shopify *project* leads (see `LEADS_PLAN.md`), and a local dashboard (`npm run ui`) visualizes everything. Product spec lives in `PRD.md`; keep it updated when scope changes. Build order lives in `IMPLEMENTATION_PLAN.md` — when completing a step, flip its 🔲 to ✅ there.

## Commands

- `npm start` — run the jobs pipeline once (tsx, no build step)
- `npm run leads` — run the leads pipeline once
- `npm run ui` — local dashboard at http://localhost:4321 (127.0.0.1 only; `UI_PORT` to change)
- `npm test` — unit tests (node:test via tsx) for filter/scoring/dedupe/lead-intent; CI runs them before the pipeline
- `npm run typecheck` — `tsc --noEmit`

Verify changes with `npm test` + `npm run typecheck`, then a real `npm start` / `npm run leads` and read the console output (with SMTP unset, digests print to console instead of sending). Tests use a temp DB via `DB_PATH` — set it before importing modules (config reads env at import time).

## Architecture rules

- **One fetcher = one file** in `src/fetchers/`, implementing the `Fetcher` interface from `src/types.ts` and registered in `src/fetchers/index.ts`. Fetchers must throw on failure — `index.ts` isolates failures per-fetcher via `Promise.allSettled`; never let one source break the run.
- `Job.id` must be stable and unique across runs: `"<source>:<externalId>"` (fall back to the normalized URL if the source has no id).
- All filtering logic stays in `src/pipeline/filter.ts`; criteria/keywords are data in `src/config.ts`, not hardcoded in logic.
- Dedupe (`src/pipeline/dedupe.ts`) has two keys: exact `id`, and normalized `company+title` for cross-source duplicates. Don't email a job twice, ever.
- Secrets only via env vars (`.env` locally, GitHub Secrets in CI). Never commit keys; never hardcode them.
- `data/jobs.db` is deliberately **tracked in git** — the Actions workflow commits it back each run as the persistence layer. Do not add it to `.gitignore`. `src/pipeline/db.ts` is the only owner of the schema (additive migrations only — the cloud runner and this machine share the same file through git).
- Keep the pipelines run-and-exit: no long-running processes, no queues, no extra services. The one exception is the dashboard (`src/ui/`), which is a local-only viewer bound to 127.0.0.1 — the pipelines must never depend on it.
- The leads funnel mirrors the jobs funnel: one source = one file in `src/leads/sources/` implementing `LeadFetcher`, criteria as data in `config.leads`, failure isolation per source. Leads have workflow status; never delete a lead the user has touched (only status `'new'` is auto-pruned).
- Dashboard code renders all external text via `textContent` (job titles/companies are untrusted). Palette changes must keep WCAG contrast (pairs were validated — see IMPLEMENTATION_PLAN Part 7).

## Conventions

- TypeScript, ESM (`"type": "module"`), Node 24+ (dedupe uses the built-in `node:sqlite` module — no native deps). Relative imports use the `.js` extension (ESM requirement).
- Log lines are prefixed `[job-sync]`.
- Windows dev machine — prefer cross-platform Node APIs over shell commands.

## Current state / roadmap

- Implemented: 7 job fetchers (boards = targeted Greenhouse/Lever companies), rules filter + scoring, contract-role routing to leads, dedupe, email-or-console digest, runs log, Actions cron, local dashboard, leads pipeline (Reddit RSS + HN threads). Dedupe is delivery-safe: `selectNewJobs()` is read-only; `markSeen()` runs only after the digest sends — keep that ordering.
- Key-gated (skip themselves until env is set): adzuna (`ADZUNA_APP_ID/KEY`), jsearch (`RAPIDAPI_KEY`). The cron is **once daily** (03:00 UTC = 08:00 PKT) — chosen by the owner (2026-08-19); with ~30 runs/month, no per-source rate gating is needed.
- Hardening in place: failure-alert email (`scripts/notify-failure.ts`, workflow `if: failure()`), seen-jobs retention pruning (180 days), HTML-escaped grouped digest, CI guard that fails runs loudly when SMTP secrets are missing.
- Gotchas learned the hard way: Reddit's JSON API 403s unauthenticated clients — use the RSS search feeds, sequentially with a delay (parallel = 429). Every posting at Shopify-ecosystem companies mentions Shopify — description-only matches require a dev-looking title (`devRoleTitleKeywords`).
- **No LLM/AI steps yet** — owner decision (2026-08-18): AI is planned for later (plan Part 9: job classifier, lead qualification, outreach drafts) but must not be added until the owner asks. Until then, precision comes from tuning `src/config.ts` keyword lists.
