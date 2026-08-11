# CLAUDE.md

## What this project is

`job-sync` — an automated job-alert pipeline (scheduled script, **not** a server and **not** an agent). Every run: fetch remote jobs from 6 sources → normalize to `Job` → keyword filter → SQLite dedupe → email digest of new matches → exit. Product spec lives in `PRD.md`; keep it updated when scope changes.

## Commands

- `npm start` — run the full pipeline once (tsx, no build step)
- `npm run typecheck` — `tsc --noEmit`

There is no test suite yet. Verify changes by running `npm start` and reading the console output (with SMTP unset, the digest prints to console instead of sending).

## Architecture rules

- **One fetcher = one file** in `src/fetchers/`, implementing the `Fetcher` interface from `src/types.ts` and registered in `src/fetchers/index.ts`. Fetchers must throw on failure — `index.ts` isolates failures per-fetcher via `Promise.allSettled`; never let one source break the run.
- `Job.id` must be stable and unique across runs: `"<source>:<externalId>"` (fall back to the normalized URL if the source has no id).
- All filtering logic stays in `src/pipeline/filter.ts`; criteria/keywords are data in `src/config.ts`, not hardcoded in logic.
- Dedupe (`src/pipeline/dedupe.ts`) has two keys: exact `id`, and normalized `company+title` for cross-source duplicates. Don't email a job twice, ever.
- Secrets only via env vars (`.env` locally, GitHub Secrets in CI). Never commit keys; never hardcode them.
- `data/jobs.db` is deliberately **tracked in git** — the Actions workflow commits it back each run as the persistence layer. Do not add it to `.gitignore`.
- Keep it a run-and-exit script: no long-running processes, no queues, no extra services.

## Conventions

- TypeScript, ESM (`"type": "module"`), Node 24+ (dedupe uses the built-in `node:sqlite` module — no native deps). Relative imports use the `.js` extension (ESM requirement).
- Log lines are prefixed `[job-sync]`.
- Windows dev machine — prefer cross-platform Node APIs over shell commands.

## Current state / roadmap

- Implemented: pipeline skeleton, Remotive + RemoteOK fetchers, rules filter, dedupe, email-or-console digest, Actions cron workflow.
- Stubs (return `[]`, marked TODO): weworkremotely, jobicy, adzuna (needs `ADZUNA_APP_ID/KEY`), jsearch (needs `RAPIDAPI_KEY`).
- Planned (PRD M3): one LLM classification step (Claude Haiku) inside `filter.ts` for experience level (3–4 yrs) and true-remote check — a fixed pipeline step, not agentic behavior.
