/**
 * Sends a "pipeline run failed" alert email. Invoked by the Actions workflow
 * with `if: failure()` — GitHub's own failed-run notifications also exist, but
 * an email to the digest inbox is harder to miss. No-ops (exit 0) when SMTP is
 * unconfigured so it never masks the original failure with its own.
 */
import 'dotenv/config';
import nodemailer from 'nodemailer';
import { config } from '../src/config.js';

async function main(): Promise<void> {
  const { smtpHost, smtpPort, smtpUser, smtpPass, to, from } = config.email;
  if (!smtpHost || !to || !smtpPass || smtpPass.startsWith('YOUR_')) {
    console.log('[job-sync] notify-failure: SMTP not configured — skipping alert');
    return;
  }

  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null;

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  await transport.sendMail({
    from,
    to,
    subject: '[job-sync] pipeline run FAILED',
    text:
      `A scheduled job-sync run failed.\n\n` +
      (runUrl ? `Logs: ${runUrl}\n\n` : '') +
      `New jobs from this run were NOT lost — they retry on the next run.`,
  });
  console.log(`[job-sync] notify-failure: alert emailed to ${to}`);
}

main().catch((err) => {
  // Never fail the failure-handler itself; the workflow is already red.
  console.error('[job-sync] notify-failure: could not send alert:', err);
});
