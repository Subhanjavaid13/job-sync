import nodemailer from 'nodemailer';
import type { Job } from '../types.js';
import { config } from '../config.js';

function digestHtml(jobs: Job[]): string {
  const items = jobs
    .map(
      (j) => `
    <li style="margin-bottom:14px">
      <a href="${j.url}"><strong>${j.title}</strong></a> — ${j.company}
      <br><small>${[j.source, j.location, j.salary].filter(Boolean).join(' · ')}</small>
    </li>`,
    )
    .join('');
  return `<h2>${jobs.length} new job match${jobs.length === 1 ? '' : 'es'}</h2><ul>${items}</ul>
    <p><small>Sent by job-sync.</small></p>`;
}

/** Sends one digest per run (PRD FR5). Falls back to console when SMTP is unconfigured. */
export async function sendDigest(jobs: Job[]): Promise<void> {
  const { smtpHost, smtpPort, smtpUser, smtpPass, to, from } = config.email;

  // "YOUR_..." = untouched .env placeholder — treat as unconfigured.
  if (!smtpHost || !to || !smtpPass || smtpPass.startsWith('YOUR_')) {
    console.log('[job-sync] SMTP not configured — printing digest instead of emailing:');
    for (const j of jobs) {
      console.log(`  • ${j.title} — ${j.company} (${j.source}) ${j.url}`);
    }
    return;
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  await transport.sendMail({
    from,
    to,
    subject: `[job-sync] ${jobs.length} new remote Shopify job${jobs.length === 1 ? '' : 's'}`,
    html: digestHtml(jobs),
  });
  console.log(`[job-sync] digest emailed to ${to}`);
}
