export const config = {
  /** Search term sent to sources that support server-side search. */
  searchTerms: ['shopify'],

  /**
   * A job matches when TITLE or TAGS contain one of these. Generic words like
   * "liquid"/"hydrogen" stay out of description matching on purpose — they hit
   * unrelated postings (e.g. any job description mentioning liquids).
   */
  includeKeywords: ['shopify', 'liquid', 'hydrogen', 'shopify plus'],

  /** A job also matches when its DESCRIPTION contains one of these (specific terms only). */
  descriptionKeywords: ['shopify'],

  /**
   * A description-only match must ALSO have a developer-looking title. Without
   * this, every posting at a Shopify-ecosystem company matches (their
   * descriptions all mention Shopify — sales, legal, accounting included).
   */
  devRoleTitleKeywords: [
    'developer',
    'engineer',
    'software',
    'frontend',
    'front-end',
    'front end',
    'full stack',
    'full-stack',
    'fullstack',
    'programmer',
  ],

  /**
   * A job is dropped when its TITLE contains any of these.
   * Deliberately conservative: only clearly-wrong seniority/roles. "senior" is
   * NOT excluded — many "senior" postings still ask for 3–4 yrs experience.
   * The precise 3–4 yrs check is the planned LLM step (PRD M3).
   */
  excludeKeywords: ['principal', 'director', 'head of', 'intern', 'vp '],

  /** Sources that are remote-only by definition — no extra remote check needed. */
  remoteOnlySources: ['remotive', 'remoteok', 'weworkremotely', 'jobicy'],

  /**
   * Targeted company career boards (public JSON, no keys). All entries verified
   * live on 2026-08-18 — Shopify-ecosystem companies. Add more by token/company.
   */
  targetBoards: {
    greenhouse: [
      { token: 'klaviyo', name: 'Klaviyo' },
      { token: 'postscript', name: 'Postscript' },
      { token: 'yotpo', name: 'Yotpo' },
      { token: 'aftership', name: 'AfterShip' },
      { token: 'remotecom', name: 'Remote.com' },
    ],
    lever: [{ company: 'okendo', name: 'Okendo' }],
  },

  /** Keyword match scoring weights — digest and dashboard sort by total score. */
  scoring: {
    titleWeight: 5,
    tagWeight: 3,
    descriptionWeight: 1,
    salaryBonus: 1,
  },

  /** Local dashboard (`npm run ui`). Binds to 127.0.0.1 only. */
  ui: {
    port: Number(process.env.UI_PORT ?? 4321),
  },

  /** Leads generator (`npm run leads`) — see LEADS_PLAN.md. All criteria are data here. */
  leads: {
    /** Minimum intent score for a candidate to enter the leads table. */
    minScore: 6,
    /** Ignore posts older than this at fetch time. */
    maxAgeDays: 30,
    /** Auto-delete leads still in status 'new' after this many days (stale noise). */
    staleNewDays: 90,
    /** Reddit communities searched via the public JSON endpoint. */
    subreddits: ['shopify', 'ecommerce', 'smallbusiness', 'forhire', 'hiring'],
    searchTerm: 'shopify',
    /** Phrases that signal someone wants to HIRE (not be hired). */
    intentKeywords: [
      'looking for',
      'need a',
      'need someone',
      'hiring',
      'seeking',
      'who can build',
      'help me build',
      'recommend a developer',
      'recommend an agency',
      'quote',
      'budget',
    ],
    /** Shopify-context terms; title hits weigh more than body hits. */
    contextKeywords: [
      'shopify',
      'shopify plus',
      'hydrogen',
      'liquid',
      'shopify theme',
      'shopify app',
      'checkout extension',
      'migrate to shopify',
    ],
    /** Posts that are freelancers advertising themselves, not clients hiring. */
    excludeKeywords: ['[for hire]', 'for hire -', 'i am a ', "i'm a ", 'my portfolio', 'i offer', 'dm me for my'],

    /** Meta/news posts that are never hiring posts (checked against the title only). */
    titleExcludeKeywords: ['news', 'roundup', 'megathread', 'weekly thread', 'this week', 'top 10'],
    /** Job postings whose title/tags contain these are routed to leads, not the jobs digest. */
    contractMarkers: ['contract', 'freelance', 'freelancer'],
    scoring: {
      intentWeight: 3,
      contextTitleWeight: 5,
      contextBodyWeight: 2,
      budgetWeight: 3,
      recencyWeight: 2,
      recencyHours: 48,
    },
  },

  dbPath: process.env.DB_PATH ?? 'data/jobs.db',

  /** Rows older than this are pruned from seen_jobs — a repost that old is effectively a new job. */
  seenRetentionDays: 180,

  userAgent: 'job-sync/0.1 (personal job-alert tool)',

  email: {
    to: process.env.EMAIL_TO ?? '',
    from: process.env.EMAIL_FROM ?? 'job-sync <job-sync@localhost>',
    smtpHost: process.env.SMTP_HOST ?? '',
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpUser: process.env.SMTP_USER ?? '',
    smtpPass: process.env.SMTP_PASS ?? '',
  },
};
