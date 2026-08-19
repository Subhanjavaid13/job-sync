import test from 'node:test';
import assert from 'node:assert/strict';
import { filterJobs, scoreJob, splitContractRoles } from '../src/pipeline/filter.js';
import { config } from '../src/config.js';
import type { Job } from '../src/types.js';

const job = (over: Partial<Job>): Job => ({
  id: 'test:1',
  title: '',
  company: 'Acme',
  url: 'https://example.com',
  description: '',
  tags: [],
  postedAt: null,
  source: 'remotive', // remote-only source by default
  ...over,
});

test('keeps a shopify title match from a remote-only source', () => {
  const kept = filterJobs([job({ title: 'Shopify Developer' })]);
  assert.equal(kept.length, 1);
});

test('drops titles on the exclude list', () => {
  const kept = filterJobs([job({ title: 'Principal Shopify Engineer' })]);
  assert.equal(kept.length, 0);
});

test('non-remote-only sources must mention remote somewhere', () => {
  const noRemote = job({ title: 'Shopify Developer', source: 'boards' });
  const withRemote = job({ title: 'Shopify Developer', source: 'boards', tags: ['remote'] });
  assert.equal(filterJobs([noRemote]).length, 0);
  assert.equal(filterJobs([withRemote]).length, 1);
});

test('description-only match requires a developer-looking title', () => {
  const legal = job({ title: 'Senior Legal Counsel', description: 'We help Shopify merchants.' });
  const dev = job({ title: 'Software Engineer', description: 'We help Shopify merchants.' });
  assert.equal(filterJobs([legal]).length, 0);
  assert.equal(filterJobs([dev]).length, 1);
});

test('distrusts tag-stuffed spam (more than 12 tags)', () => {
  const tags = ['shopify', ...Array.from({ length: 13 }, (_, i) => `tag${i}`)];
  assert.equal(filterJobs([job({ title: 'Warehouse Worker', tags })]).length, 0);
});

test('scoreJob weights title > tag > description, plus salary bonus', () => {
  const w = config.scoring;
  const titleHit = scoreJob(job({ title: 'Shopify Developer' }));
  const tagHit = scoreJob(job({ title: 'Developer', tags: ['shopify'] }));
  const descHit = scoreJob(job({ title: 'Developer', description: 'shopify work' }));
  assert.ok(titleHit > tagHit && tagHit > descHit);
  const withSalary = scoreJob(job({ title: 'Shopify Developer', salary: '$100k' }));
  assert.equal(withSalary, titleHit + w.salaryBonus);
});

test('filterJobs sorts results best-match first', () => {
  const weak = job({ id: 'weak', title: 'Developer', description: 'a shopify store' });
  const strong = job({ id: 'strong', title: 'Shopify Developer' });
  const kept = filterJobs([weak, strong]);
  assert.deepEqual(kept.map((j) => j.id), ['strong', 'weak']);
});

test('splitContractRoles routes contract/freelance matches to leads', () => {
  const jobs = [
    job({ id: 'a', title: 'Shopify Developer (Contract)' }),
    job({ id: 'b', title: 'Shopify Developer' }),
    job({ id: 'c', title: 'Freelance Shopify Expert' }),
    job({ id: 'd', title: 'Shopify Engineer', tags: ['Contract'] }),
  ];
  const { employment, contracts } = splitContractRoles(jobs);
  assert.deepEqual(employment.map((j) => j.id), ['b']);
  assert.deepEqual(contracts.map((j) => j.id), ['a', 'c', 'd']);
});
