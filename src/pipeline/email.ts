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
export async function sendDigest(jobs: Job[]): Promise<'emailed' | 'console'> {
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
    return 'console';
  }

  await createTransport().sendMail({
    from,
    to,
    subject: `[job-sync] ${jobs.length} new remote Shopify job${jobs.length === 1 ? '' : 's'}`,
    text: digestText(jobs),
    html: digestHtml(jobs),
  });
  console.log(`[job-sync] digest emailed to ${to}`);
  return 'emailed';
}

function createTransport() {
  const { smtpHost, smtpPort, smtpUser, smtpPass } = config.email;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });
}

export interface LeadEmailItem {
  title: string;
  url: string;
  source: string;
  score: number;
  budget?: string;
  contact?: string;
  body?: string;
}

/** Best matches first, capped so the email stays scannable. */
const MAX_LEADS_IN_EMAIL = 15;

function snippet(l: LeadEmailItem): string {
  return (l.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function leadsText(leads: LeadEmailItem[]): string {
  return leads
    .slice(0, MAX_LEADS_IN_EMAIL)
    .map((l) => {
      const lines = [`  • [match ${l.score}] ${l.title} (${l.source}${l.budget ? `, ${l.budget}` : ''})`];
      if (l.contact) lines.push(`      contact: ${l.contact}`);
      const s = snippet(l);
      if (s) lines.push(`      ${s}`);
      lines.push(`      ${l.url}`);
      return lines.join('\n');
    })
    .join('\n');
}

function leadsHtml(leads: LeadEmailItem[]): string {
  const items = leads
    .slice(0, MAX_LEADS_IN_EMAIL)
    .map(
      (l) => `
    <li style="margin:0 0 16px">
      <a href="${esc(l.url)}" style="font-size:15px"><strong>${esc(l.title)}</strong></a>
      <br><small style="color:#666">${esc(l.source)} · match ${l.score}${l.budget ? ` · <span style="color:#0a7d38;font-weight:600">${esc(l.budget)}</span>` : ''}</small>
      ${l.contact ? `<br><small><strong>Contact:</strong> ${esc(l.contact)}</small>` : ''}
      ${snippet(l) ? `<br><small style="color:#444">${esc(snippet(l))}…</small>` : ''}
    </li>`,
    )
    .join('');
  const extra = leads.length > MAX_LEADS_IN_EMAIL ? `<p><small>+${leads.length - MAX_LEADS_IN_EMAIL} more on the dashboard.</small></p>` : '';
  return `
    <h2>${leads.length} new Shopify project lead${leads.length === 1 ? '' : 's'}</h2>
    <p style="color:#666;margin:0 0 14px"><small>Best matches first. Contact = author handle / company plus any email or phone found in the post.</small></p>
    <ul style="margin:0;padding-left:18px">${items}</ul>${extra}
    <p style="margin-top:20px"><small style="color:#999">Manage them on the job-sync dashboard (Leads tab). Sent by job-sync.</small></p>`;
}

/**
 * Leads notification email (LEADS_PLAN L4). Unlike the jobs digest, this NEVER
 * throws for missing SMTP — the portal is the source of truth for leads, and
 * they are already stored; the email is a convenience notification.
 */
export async function sendLeadsDigest(leads: LeadEmailItem[]): Promise<'emailed' | 'console'> {
  const { smtpHost, smtpPass, to, from } = config.email;
  if (!smtpHost || !to || !smtpPass || smtpPass.startsWith('YOUR_')) {
    console.log('[job-sync] SMTP not configured — new leads (see dashboard):');
    console.log(leadsText(leads));
    return 'console';
  }
  await createTransport().sendMail({
    from,
    to,
    subject: `[job-sync] ${leads.length} new Shopify project lead${leads.length === 1 ? '' : 's'}`,
    text: leadsText(leads),
    html: leadsHtml(leads),
  });
  console.log(`[job-sync] leads digest emailed to ${to}`);
  return 'emailed';
}
