# Leads Generator — Plan

How the Shopify **project-leads** pipeline fits into job-sync. The portal UI and the
database table already exist (dashboard → Leads tab, currently showing marked sample
data); this document is the build plan for the data sources and workflow behind it.

## 1. Concept — two funnels, one machine

job-sync already runs one funnel: **jobs** (employment offers → filter → dedupe →
digest). The leads generator is the same machine pointed at a different target:
**projects/clients** — merchants and agencies who need Shopify work done, i.e.
freelance/contract opportunities you pursue instead of apply to.

```
                    ┌── jobs funnel (live) ──────► email digest + dashboard
sources ─ normalize ┤
                    └── leads funnel (this plan) ─► leads table → portal board
```

Everything proven in the jobs funnel is reused: fetcher-per-source modules,
keyword filtering + scoring, SQLite dedupe, run-and-exit scheduling, the dashboard.
The one genuinely new part is the **workflow state** — a lead is not "seen once,
emailed once"; it moves through stages you manage in the portal:

`new → shortlisted → contacted → replied → won | lost`

## 2. Lead sources (legal, keyless where possible — in build order)

| # | Source | Access | What it yields | Effort |
|---|--------|--------|----------------|--------|
| S1 | **Reddit** (r/shopify, r/ecommerce, r/smallbusiness, r/forhire, r/hiring) | public JSON (`/search.json?q=…`), UA header, no key | Merchants posting "looking for a Shopify developer…" — the highest-intent free source | Small |
| S2 | **Contract-role routing** from existing job fetchers | already fetched! | Postings with commitment `Contract`/`Freelance` (Lever `categories.commitment`, Jobicy `jobType`, keywords in title) get routed to the leads table instead of the jobs digest | Small |
| S3 | **Hacker News** monthly "Seeking freelancers" threads | Algolia public API (`hn.algolia.com/api/v1/search`), no key | Agencies/founders seeking contractors; search `shopify` within those threads | Small |
| S4 | **Freelancer.com** active projects | official free API key | Real budgeted projects, searchable "shopify" | Medium |
| S5 | **New-store detection** (advanced, optional) | certificate-transparency logs (crt.sh) for new `*.myshopify.com` hosts | Brand-new merchants = outreach leads. High volume, low intent — build last, behind its own toggle | Large |

**Deliberately excluded:** Upwork (API requires partner approval; scraping violates
ToS), Fiverr, LinkedIn — same anti-scraping/ToS reasoning as the jobs funnel.

## 3. Data model (already created in `data/jobs.db`)

```sql
leads (
  id TEXT PRIMARY KEY,      -- "<source>:<externalId>"
  title, summary, url, source, budget,
  score INTEGER,            -- intent score, see §5
  status TEXT DEFAULT 'new',-- new|shortlisted|contacted|replied|won|lost
  notes,
  posted_at, first_seen, updated_at
)
```

## 4. Architecture (mirrors the jobs pipeline)

- `src/leads/sources/<name>.ts` — one file per source, `LeadFetcher` interface
  (`fetchLeads(): Promise<Lead[]>`), throw on failure, registered in
  `src/leads/sources/index.ts`, isolated with `Promise.allSettled`.
- `src/leads/filter.ts` — intent filter + scoring (see §5); criteria as data in
  `src/config.ts` (`leadKeywords`, `leadExcludeKeywords`).
- `src/leads/store.ts` — insert-if-new against the `leads` table (same two-level
  dedupe idea: exact id + normalized title).
- Entry: `npm run leads` (`src/leads/index.ts`, run-and-exit) + a `leads:` job in
  the Actions workflow — 3× daily is plenty (leads age slower than job posts).
- Portal: already built — board columns per status, status dropdown persists via
  `POST /api/leads/status`. Add a notes editor in step L6.
- Optional email: a "New leads" section appended to the existing digest when a
  run finds leads with score ≥ threshold.

## 5. Intent filter & scoring (what makes a post a *lead*)

A Reddit/HN post is a lead when it has **hiring intent** + **Shopify context**:

- **Hiring intent is a hard gate** — zero intent phrases ⇒ score 0, no matter how
  much Shopify context (a news roundup or pricing complaint is not a lead).
  Intent phrases (+3 each, capped at 3): "looking for", "need a", "hiring",
  "seeking", "who can build", "quote", "budget", …
- Shopify context, counted **once per placement** (+5 title *or* +2 body — hits
  don't stack, or "shopify" + "shopify plus" in one title crosses the threshold
  alone): "shopify", "shopify plus", "hydrogen", "liquid", "checkout extension", …
- Budget signal (+3): `$` amount, "/hr", "fixed price"
- Recency (+2 if < 48 h old)
- Excludes (drop): "[for hire]" and self-promo markers (a freelancer advertising,
  not a client), and news/meta titles ("news", "roundup", "megathread", …)

Threshold to enter the table: score ≥ 6 (tune in config, like job keywords).
AI qualification is a **later** enhancement (see §7) — the rules version ships first.

## 6. Build steps (tracked in IMPLEMENTATION_PLAN.md Part 8)

- ✅ **L0 Portal UI + schema** — board, status workflow, API (2026-08-18).
- ✅ **L1 Reddit source (S1)** — implemented 2026-08-18, with one discovery: Reddit's JSON API returns **403** to unauthenticated clients, so the source consumes the **RSS search feeds** instead (allowed and stable), sequentially with 20 s spacing + one retry pass after a 60 s cooldown (tighter spacing → 429; measured). Subs that still fail are covered by the next run. If RSS ever closes, upgrade to a free Reddit OAuth script app — never scraping.
- ✅ **L2 Contract routing (S2)** — `splitContractRoles()` in the jobs pipeline; contract/freelance matches are stored as leads (floored at `minScore` — they already passed the jobs filter).
- ✅ **L3 HN source (S3)** — exact-phrase thread discovery + comment search. Verified live; the current month simply has no Shopify mentions (3 "seeking freelancer" comments total) — expect occasional, high-quality hits.
- ✅ **L4 Leads cron + email** — workflow step in the daily cron (`continue-on-error` so leads never block jobs-state persistence); new leads send a notification email (fail-soft — the portal board is the source of truth).
- 🔲 **L5 Freelancer.com (S4)** — needs their free API key in `.env`.
- ✅ **L6 Portal polish (core)** — notes editor + activity dates. Won/lost reporting still open.
- 🔲 **L7 (optional) New-store detection (S5)** — crt.sh watcher behind `LEADS_STORE_DETECT=1`.

## 7. AI later (deferred by owner decision, planned)

When AI is re-introduced it slots in as fixed pipeline steps, not agents:
1. **Lead qualification** — classify rule-matched posts: real client? budget? scope fits a solo dev with 3–4 yrs? (kills the false positives rules can't).
2. **Outreach drafts** — generate a personalized first-contact draft per shortlisted lead, shown in the portal for you to edit/send manually.
3. **Job relevance classifier** — the previously removed experience/remote check for the jobs funnel.
