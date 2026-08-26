import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead, filterLeads, stripHtml, extractContact } from '../src/leads/filter.js';
import { config } from '../src/config.js';
import type { LeadCandidate } from '../src/types.js';

const w = config.leads.scoring;

const lead = (over: Partial<LeadCandidate>): LeadCandidate => ({
  id: 'test:1',
  title: '',
  body: '',
  url: 'https://example.com',
  source: 'r/test',
  postedAt: null,
  ...over,
});

test('hiring intent is a hard gate — context alone scores zero', () => {
  const contextOnly = lead({
    title: 'Shopify Plus pricing discussion for my Shopify store',
    body: 'shopify shopify plus hydrogen liquid everywhere, just discussing costs',
  });
  assert.equal(scoreLead(contextOnly), 0);
});

test('self-promo posts are excluded', () => {
  const promo = lead({
    title: '[For Hire] Shopify developer available',
    body: 'looking for clients who need a shopify developer',
  });
  assert.equal(scoreLead(promo), 0);
});

test('news/meta titles are excluded', () => {
  const news = lead({
    title: "This week's e-commerce news roundup",
    body: 'looking for a shopify developer was a top story',
  });
  assert.equal(scoreLead(news), 0);
});

test('context counts once per placement — hits do not stack', () => {
  const one = lead({ title: 'Need a shopify dev', body: 'looking for someone' });
  const many = lead({ title: 'Need a shopify shopify plus liquid dev', body: 'looking for someone' });
  assert.equal(scoreLead(one), scoreLead(many));
});

test('budget and recency add their bonuses', () => {
  const base = lead({ title: 'Need a shopify developer', body: 'looking for help' });
  const withBudget = lead({ title: 'Need a shopify developer', body: 'looking for help, $2000 budget' });
  // "budget" is also an intent keyword, so isolate the budget-signal bonus:
  const withDollar = lead({ title: 'Need a shopify developer', body: 'looking for help, pay is $2000' });
  assert.equal(scoreLead(withDollar), scoreLead(base) + w.budgetWeight);
  assert.ok(scoreLead(withBudget) >= scoreLead(withDollar));
  const recent = lead({
    title: 'Need a shopify developer',
    body: 'looking for help',
    postedAt: new Date().toISOString(),
  });
  assert.equal(scoreLead(recent), scoreLead(base) + w.recencyWeight);
});

test('filterLeads applies the threshold and sorts best first', () => {
  const strong = lead({ id: 's', title: 'Hiring shopify developer', body: 'looking for, need a, budget $1k' });
  const zero = lead({ id: 'z', title: 'My shopify store journey', body: 'no intent here' });
  const kept = filterLeads([zero, strong]);
  assert.deepEqual(kept.map((l) => l.id), ['s']);
  assert.ok(kept[0]!.score >= config.leads.minScore);
});

test('extractContact combines the handle with emails/phones found in the post', () => {
  const c = lead({
    contact: 'Reddit u/merchant42',
    body: 'Need a Shopify dev. Email me at owner@shop.example or WhatsApp +92 300 1234567. Budget $2k.',
  });
  const contact = extractContact(c) ?? '';
  assert.ok(contact.startsWith('Reddit u/merchant42'));
  assert.ok(contact.includes('owner@shop.example'));
  assert.ok(contact.includes('+92 300 1234567'));
  assert.equal(extractContact(lead({ body: 'no contact details here' })), undefined);
});

test('stripHtml flattens tags and entities', () => {
  assert.equal(stripHtml('<p>Need a <b>Shopify</b>&nbsp;dev</p>'), 'Need a Shopify dev');
});
