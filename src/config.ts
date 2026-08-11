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
   * A job is dropped when its TITLE contains any of these.
   * Deliberately conservative: only clearly-wrong seniority/roles. "senior" is
   * NOT excluded — many "senior" postings still ask for 3–4 yrs experience.
   * The precise 3–4 yrs check is the planned LLM step (PRD M3).
   */
  excludeKeywords: ['principal', 'director', 'head of', 'intern', 'vp '],

  /** Sources that are remote-only by definition — no extra remote check needed. */
  remoteOnlySources: ['remotive', 'remoteok', 'weworkremotely', 'jobicy'],

  dbPath: process.env.DB_PATH ?? 'data/jobs.db',

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
