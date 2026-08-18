import nodemailer from 'nodemailer';
import type { Job } from '../types.js';
import { config } from '../config.js';

/** External job data goes into HTML — always escape it. */
function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function groupBySource(jobs: Job[]): Map<string, Job[]> {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const group = groups.get(job.source);
    if (group) group.push(job);
    else groups.set(job.source, [job]);
  }
  return groups;
}

function jobHtml(j: Job): string {
  const meta = [
    fmtDate(j.postedAt) && `posted ${fmtDate(j.postedAt)}`,
    j.location && esc(j.location),
  ]
    .filter(Boolean)
    .join(' · ');
  return `
    <li style="margin:0 0 14px">
      <a href="${esc(j.url)}" style="font-size:15px"><strong>${esc(j.title)}</strong></a>
      — ${esc(j.company)}
      ${j.salary ? `<span style="color:#0a7d38;font-weight:600"> · ${esc(j.salary)}</span>` : ''}
      ${meta ? `<br><small style="color:#666">${meta}</small>` : ''}
    </li>`;
}

function digestHtml(jobs: Job[]): string {
  const sections = [...groupBySource(jobs)]
    .map(
      ([source, list]) => `
    <h3 style="margin:18px 0 8px;text-transform:capitalize">${esc(source)} (${list.length})</h3>
    <ul style="margin:0;padding-left:18px">${list.map(jobHtml).join('')}</ul>`,
    )
    .join('');
  return `
    <h2>${jobs.length} new job match${jobs.length === 1 ? '' : 'es'}</h2>
    ${sections}
    <p style="margin-top:22px"><small style="color:#999">Sent by job-sync.</small></p>`;
}

function digestText(jobs: Job[]): string {
  return [...groupBySource(jobs)]
    .map(([source, list]) =>
      [`${source} (${list.length})`, ...list.map((j) => {
        const parts = [`  • ${j.title} — ${j.company}`];
        if (j.salary) parts.push(`(${j.salary})`);
        parts.push(j.url);
        return parts.join(' ');
      })].join('\n'),
    )
    .join('\n\n');
}

/** Sends one digest per run (PRD FR5). Falls back to console when SMTP is unconfigured. */
export async function sendDigest(jobs: Job[]): Promise<void> {
  const { smtpHost, smtpPort, smtpUser, smtpPass, to, from } = config.email;

  // "YOUR_..." = untouched .env placeholder — treat as unconfigured.
  if (!smtpHost || !to || !smtpPass || smtpPass.startsWith('YOUR_')) {
    // In CI, unconfigured SMTP must FAIL the run: succeeding here would mark
    // the jobs seen without anyone receiving them — silently lost forever.
    if (process.env.GITHUB_ACTIONS === 'true') {
      throw new Error(
        'SMTP secrets not configured in GitHub Actions — refusing to mark jobs seen without delivering. Add the repository secrets (IMPLEMENTATION_PLAN step 3.2).',
      );
    }
    console.log('[job-sync] SMTP not configured — printing digest instead of emailing:');
    console.log(digestText(jobs));
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
    text: digestText(jobs),
    html: digestHtml(jobs),
  });
  console.log(`[job-sync] digest emailed to ${to}`);
}
