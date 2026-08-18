# Implementation Plan — job-sync

The whole build divided into **9 parts**. Each step is small, independently buildable, and has a "done when" check so you always know whether to move on. Build them in order — every part leaves the system in a working state.

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

- ✅ **3.1 Push to GitHub** — pushed to `Subhanjavaid13/job-sync`. Note: `.gitignore` excludes `PRD.md` (stays local by choice); `data/` must stay tracked (it is the persistence layer).
- 🔲 **3.2 Add repository secrets** — every value from `.env` (Settings → Secrets and variables → Actions), names exactly as in [.github/workflows/job-sync.yml](.github/workflows/job-sync.yml). Until these exist, cloud runs with new matches **fail on purpose** (SMTP guard) rather than silently marking jobs seen without emailing them.
- 🔲 **3.3 First cloud run** — trigger via the *Run workflow* button. **Done when:** the run is green, a digest arrives, and the workflow pushed a `chore: update dedupe DB` commit. After that the 2-hour cron needs nothing from you.

## Part 4 — Filter quality: keyword tuning (🔲 ongoing)

> ⚠️ Scope change (2026-08-18, owner decision): the originally planned LLM classification step (old 4.2) is **dropped** — no Anthropic API key, no AI dependencies. Precision comes from keyword tuning only.

- 🔲 **4.1 Observe & tune** — as digests arrive over the first 1–2 weeks, note false positives (e.g. non-dev roles that mention Shopify in the description) and tune `includeKeywords` / `excludeKeywords` / `descriptionKeywords` in [src/config.ts](src/config.ts). Repeat until the digest feels ≥ 90 % relevant (PRD success metric). Typical tweaks: add `"customer success"`, `"designer"`, `"marketing"` to `excludeKeywords`; require `shopify` in the title only.

## Part 5 — Hardening & polish ✅ (all implemented 2026-08-18)

- ✅ **5.1 Failure alerts** — `scripts/notify-failure.ts` + an `if: failure()` workflow step emails you when a cloud run fails (in addition to GitHub's own notifications). No-ops if SMTP is unset.
- ✅ **5.2 Digest polish** — digest now groups jobs by source with counts, shows posted-date and location, highlights salary, HTML-escapes all external text, and includes a plain-text alternative part.
- ✅ **5.3 DB retention** — every run prunes `seen_jobs` rows older than 180 days (`seenRetentionDays` in config), keeping the git-tracked DB small.

## Part 6 — Former backlog ✅ (all implemented 2026-08-18)

- ✅ **6.1 Targeted company boards** — `src/fetchers/boards.ts`: Greenhouse + Lever public JSON for 6 live-verified Shopify-ecosystem companies (Klaviyo, Postscript, Yotpo, AfterShip, Remote.com, Okendo) — data-driven in `config.targetBoards`, per-board failure isolation. Also forced a filter upgrade: description-only matches now require a developer-looking title (`devRoleTitleKeywords`), or every posting at these companies matches.
- ✅ **6.2 Keyword match scoring** — `scoreJob()`: title hit 5 · tag hit 3 · description hit 1 · salary bonus 1; digest and dashboard sort best-match-first.
- ✅ **6.3 Web dashboard** — see Part 7.

## Part 7 — Local dashboard ✅ (implemented 2026-08-18)

`npm run ui` → http://localhost:4321 (127.0.0.1 only; the pipeline itself stays run-and-exit).

- ✅ **7.1 Rich persistence** — `seen_jobs` now stores title/company/url/source/salary/location/score/emailed (additive migration in `src/pipeline/db.ts`); new `runs` table records every pipeline execution (local and cloud).
- ✅ **7.2 API server** — `src/ui/server.ts`: overview stats, job search/filter/sort, leads CRUD, and a run trigger that spawns the real pipeline and streams its log.
- ✅ **7.3 Interface** — `src/ui/page.ts`: Overview (stat tiles + 14-day sparkline + per-source bar list + runs table), Jobs (search, source filter, newest/best-match sort), Leads (workflow board), Run (button + live log). Zero frameworks/CDNs; external text rendered via `textContent` only. Restyled 2026-08-18 to a **blue/white professional theme** (indigo `#4247DA` on white cards over a soft blue gradient, pill buttons, elevated cards) — every text/mark pair re-validated for WCAG contrast (15/15 pass).
- ✅ **7.4 Run-from-UI** — "Run now" executes `npm start` as a child process; concurrent runs blocked; overview refreshes when it finishes.

## Part 8 — Leads generator (portal ✅, sources 🔲 — see LEADS_PLAN.md)

Full plan with sources, scoring, and architecture: [LEADS_PLAN.md](LEADS_PLAN.md).

- ✅ **8.0 Portal + schema (L0)** — `leads` table, status workflow (new → shortlisted → contacted → replied → won/lost), dashboard board with persisted status changes; sample preview shown (clearly marked) only while the table is empty.
- ✅ **8.1 Reddit source (L1)** — via **RSS search feeds** (the JSON API returns 403 to unauthenticated clients; RSS is served fine). Fetched sequentially with **20 s spacing + one retry pass after a 60 s cooldown** — measured: parallel or tight spacing trips the per-IP limit (429); subs that still fail are picked up next run. Intent filter + scoring per LEADS_PLAN §5.
- ✅ **8.2 Contract-role routing (L2)** — matches whose title/tags contain `config.leads.contractMarkers` go to the leads board instead of the jobs digest (`splitContractRoles` in filter.ts).
- ✅ **8.3 HN freelance threads (L3)** — exact-phrase discovery of the monthly "Freelancer? Seeking freelancer?" threads via Algolia, then comment search within. Low volume by nature — 0 hits in a month is normal, not a bug.
- ✅ **8.4 Leads cron** — `npm run leads` step in the Actions workflow, `continue-on-error` so a leads failure never blocks persisting jobs state; self-limits to UTC hour % 6 == 0 (`LEADS_FORCE=1` bypasses). *Digest email section for leads: still 🔲 (portal is the primary surface for now).*
- 🔲 **8.5 Freelancer.com (L5)** — needs free API key.
- ✅ **8.6 Portal polish (L6, core)** — per-lead notes editor (persisted) + activity dates on cards. *Won/lost reporting: still 🔲.*

## Part 9 — AI integration (deferred by owner decision — planned for later)

Fixed pipeline steps, not agents; nothing here blocks Parts 1–8:

- 🔲 **9.1 Job relevance classifier** — experience-level (3–4 yrs) + true-remote check on rule-matched jobs.
- 🔲 **9.2 Lead qualification** — real client? budget? solo-dev scope? on rule-matched leads.
- 🔲 **9.3 Outreach drafts** — first-contact draft per shortlisted lead, editable in the portal.

---

## What's left (2026-08-18)

Everything buildable without credentials or AI is **done**. The open items:

| Item | Step | Blocked on |
|---|---|---|
| Real email delivery | 1.1 | Gmail **app password** for the sender account → `.env` `SMTP_PASS` |
| Cloud secrets + verified green run | 3.2, 3.3 | You adding repository secrets on GitHub, then one manual *Run workflow* |
| Keyword tuning | 4.1 | Time — observe digests for 1–2 weeks, tune `src/config.ts` |
| JSearch + Adzuna sources | (2.3/2.4 code done) | Their free API keys |
| Freelancer.com lead source | 8.5 | Their free API key |
| Leads digest-email section, won/lost stats | 8.4/8.6 remainder | Nothing — small, anytime |
| AI steps | Part 9 | Owner decision to re-open AI |
