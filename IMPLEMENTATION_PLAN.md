# Implementation Plan — job-sync

The whole build divided into **6 parts / 15 steps**. Each step is small, independently buildable, and has a "done when" check so you always know whether to move on. Build them in order — every part leaves the system in a working state.

Progress legend: ✅ done · 🔲 to do

---

## Part 0 — Foundation & walking skeleton ✅ (already built)

The scaffold created on 2026-08-11. Nothing to do here — listed so the plan covers 100 % of the project.

- ✅ **0.1 Project setup** — TypeScript/ESM project, `npm start` + `npm run typecheck`, docs (PRD, README, CLAUDE.md).
- ✅ **0.2 Pipeline skeleton** — fetch (parallel, failure-isolated) → filter → dedupe → email, run-and-exit.
- ✅ **0.3 First two fetchers** — Remotive + RemoteOK live; 4 stubs with instructions.
- ✅ **0.4 Rules filter v1** — include/exclude keywords, tag-stuffing guard, remote check.
- ✅ **0.5 Dedupe store** — `node:sqlite`, two-level (exact id + cross-source company+title). Verified: second run reports `0 new`.
- ✅ **0.6 Digest output** — nodemailer digest with console fallback when SMTP is unset.

---

## Part 1 — Real email delivery (🔲 1 step, ~30 min)

- 🔲 **1.1 Configure SMTP and receive the first real digest.**
  - Copy `.env.example` → `.env`; fill `EMAIL_TO`, `EMAIL_FROM`, `SMTP_*`.
  - Easiest options: Gmail app password (Google account → Security → App passwords) or Resend SMTP (free tier).
  - Delete `data/jobs.db` once so there is something "new" to send, then `npm start`.
  - **Done when:** the digest lands in your inbox instead of the console.

## Part 2 — Full source coverage (🔲 4 steps, ~½ day)

One step per stub fetcher. Each has the endpoint + response shape already documented in its TODO comment; copy the pattern from [src/fetchers/remotive.ts](src/fetchers/remotive.ts). Done-check for every step: `npm start` shows `<source>: N jobs` with N > 0 and no error.

- ✅ **2.1 We Work Remotely** — RSS via `rss-parser`, live (25 jobs on first run).
- ✅ **2.2 Jobicy** — JSON API, live (11 jobs on first run). Note: its `?tag=` search is loose — expect noise until Part 4.
- ✅ **2.3 Adzuna** — *code done*; activates automatically once `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` are in `.env` (create at developer.adzuna.com). Optional `ADZUNA_COUNTRY` (default `us`).
- ✅ **2.4 JSearch (RapidAPI)** — *code done*; activates once `RAPIDAPI_KEY` is in `.env`. Rate budget built in: only fires when UTC hour % 4 == 0 (~180 req/month vs. the ~200 free-tier cap); set `JSEARCH_FORCE=1` to bypass for a local test.

> Bonus fix while testing Part 2: delivery-safe dedupe — jobs are now marked "seen" only **after** the digest is sent, so a failed email retries next run instead of losing those jobs forever. Also, an untouched `SMTP_PASS` placeholder no longer crashes the run (falls back to console digest).

## Part 3 — Cloud deployment (🔲 3 steps, ~1 hour)

- 🔲 **3.1 Push to GitHub** — create a private repo, push. Note: `.gitignore` currently excludes `PRD.md`; `data/` must stay tracked (it is the persistence layer).
- 🔲 **3.2 Add repository secrets** — every value from `.env` (Settings → Secrets and variables → Actions), names exactly as in [.github/workflows/job-sync.yml](.github/workflows/job-sync.yml).
- 🔲 **3.3 First cloud run** — trigger via the *Run workflow* button. **Done when:** the run is green, a digest arrives, and the workflow pushed a `chore: update dedupe DB` commit. After that the 2-hour cron needs nothing from you.

## Part 4 — Filter quality: the LLM step (🔲 3 steps, ~½ day)

This is what turns "keyword matches" into "actually relevant for a 3–4 yrs remote Shopify dev".

- 🔲 **4.1 Observe first** — let the pipeline run for ~3–5 days. Note false positives (e.g. Lemon.io marketplace posts) and any misses. Tune `includeKeywords` / `excludeKeywords` in [src/config.ts](src/config.ts).
- 🔲 **4.2 LLM classification** — in `filter.ts`, after the rules pass, send each surviving job (title + first ~2000 chars of description) to Claude Haiku (`claude-haiku-4-5-20251001`) asking for JSON: `{ fullyRemote: boolean, fitsMidLevel: boolean, isShopifyDevRole: boolean }`. Keep jobs passing all three. Add `ANTHROPIC_API_KEY` to `.env`, `.env.example`, and workflow secrets. Fail open (keep the job, log a warning) if the API call errors.
- 🔲 **4.3 Verify precision** — compare one week of digests before/after. **Done when:** ≥ 90 % of digest items are genuinely relevant (PRD success metric).

## Part 5 — Hardening & polish (🔲 3 steps, optional but recommended)

- 🔲 **5.1 Failure alerts** — GitHub notifies you of failed workflow runs by default; confirm notifications are on, or add a failure step that emails you.
- 🔲 **5.2 Digest polish** — group jobs by source, add posted-date, salary highlighting; maybe a weekly "nothing new" heartbeat so you know it's alive.
- 🔲 **5.3 DB retention** — jobs table grows forever; add a cleanup deleting rows with `first_seen` older than ~6 months (safe: reposts that old are effectively new jobs).

## Part 6 — Future ideas (🔲 backlog, no commitment)

- 🔲 **6.1 Targeted company boards** — Greenhouse/Lever public JSON of agencies known to hire Shopify devs.
- 🔲 **6.2 LLM match scoring** — rank digest items by fit instead of boolean filtering.
- 🔲 **6.3 Web dashboard** — only if email ever stops being enough.

---

## Suggested schedule

| Session | Steps | Outcome |
|---|---|---|
| Session 1 (~1 h) | 1.1, 2.2 | Real emails + third source live |
| Session 2 (~half day) | 2.1, 2.3, 2.4 | All 6 sources live |
| Session 3 (~1 h) | 3.1–3.3 | Fully automated in the cloud — **core goal reached** |
| Session 4 (later, ~half day) | 4.1–4.3 | High-precision filtering |
| Anytime | Part 5 | Hardening |

After Session 3 the tool already does everything you originally asked for; Parts 4–6 raise quality, not scope.
