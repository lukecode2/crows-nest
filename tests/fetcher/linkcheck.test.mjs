import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLinks, postingProblem, redirectedToSearch } from '../../scripts/lib/linkcheck.mjs';
import { dropReason } from '../../scripts/lib/filter.mjs';
const nowIso = '2026-11-11T19:00:00Z';
const schema = value => `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', ...value })}</script>`;

test('soft closures and search redirects are general across hosts; detail redirects remain live', async () => {
  const expired = ['No longer accepting applications', 'This position is filled', 'Position filled', 'This vacancy has been closed', 'This job posting has been removed', 'This role is no longer available', 'Applications are now closed', 'Job not found'];
  for (const text of expired) assert.equal(postingProblem({}, `<p>${text}</p>`, nowIso), 'expired', text);
  assert.equal(postingProblem({}, '<script>This position is filled</script><p>Apply now</p>', nowIso), null);
  assert.equal(postingProblem({}, '<!-- This position is filled --><p>Apply now</p>', nowIso), null);
  assert.equal(postingProblem({}, '<p>Applications will be accepted until job is closed.</p>', nowIso), null);
  assert.equal(postingProblem({}, '<p>This job is no longer remote; please apply on site.</p>', nowIso), null);
  assert.equal(postingProblem({}, '<p>Once the announcement has closed, we will contact you.</p>', nowIso), null);
  for (const target of ['https://employer.test/jobs', 'https://employer.test/careers', 'https://other.test/jobs/search?q=deckhand']) assert.ok(redirectedToSearch('https://employer.test/jobs/123', target));
  for (const target of ['https://employer.test/jobs/456', 'https://other.test/jobs?gh_jid=123', 'https://employer.test/login']) assert.equal(redirectedToSearch('https://employer.test/jobs/123', target), false);
  const result = await checkLinks([{ id: 'redirect', url: 'https://employer.test/jobs/123' }], { nowIso, hostDelayMs: 0, fetchImpl: async () => ({ ok: true, status: 200, url: 'https://employer.test/jobs', text: async () => 'Browse open roles' }) });
  assert.ok(result.dead.has('redirect'));
  assert.equal(result.reasons.get('redirect'), 'redirect-to-search');
});

test('expired JobPosting dates count, unrelated script values and multiple related roles do not', () => {
  assert.equal(postingProblem({}, schema({ validThrough: '2026-11-10T23:59:59Z' }), nowIso), 'expired');
  assert.equal(postingProblem({}, schema({ validThrough: '2026-11-11' }), nowIso), null);
  assert.equal(postingProblem({}, schema({ validThrough: '2026-11-12T23:59:59Z' }), nowIso), null);
  assert.equal(postingProblem({}, '<script>const validThrough="2020-01-01"</script>', nowIso), null);
  assert.equal(postingProblem({}, schema({ validThrough: '2020-01-01' }) + schema({ validThrough: '2030-01-01' }), nowIso), null);
});

test('full descriptions catch commission-only and insurance posts beyond the saved snippet', () => {
  const description = 'Company introduction. '.repeat(30) + '100% commission compensation plan.';
  assert.equal(postingProblem({ title: 'Sales Representative' }, schema({ description }), nowIso), 'commission-only');
  assert.equal(postingProblem({ title: 'Sales Representative' }, `<section class="adp-body mx-4">${description}</section>`, nowIso), 'commission-only');
  assert.equal(postingProblem({ title: 'Sales Representative' }, schema({ description: 'Uncapped commissions. Earn an average of $2,500 per sale.' }), nowIso), 'commission-only');
  for (const description of ['Hourly pay plus commission.', 'Performance-based pay structure: $18/hr plus commission.', 'Uncapped commissions; $2,500 per sale plus guaranteed base salary.', 'Benefits include health and supplemental insurance.']) assert.equal(postingProblem({ title: 'Sales Representative' }, schema({ description }), nowIso), null);
  assert.equal(postingProblem({ title: 'Valet' }, schema({ description: 'Supplemental insurance – Life insurance and critical illness' }), nowIso), null);
  assert.equal(postingProblem({}, schema({ title: 'Account Executive', hiringOrganization: { name: 'Example Insurance' } }), nowIso), 'commission-insurance');
});

test('access blocks and empty app shells stay unknown and are retried instead of cached for a day', async () => {
  const pages = [[403, 'Forbidden'], [429, 'Too many requests'], [200, 'Just a moment...'], [200, '<script>loadJob()</script>'], [404, 'Missing'], [200, 'Apply now']];
  const result = await checkLinks(pages.map((_, i) => ({ id: String(i), url: `https://employer.test/jobs/${i}` })), { nowIso, hostDelayMs: 0, fetchImpl: async url => { const [status, body] = pages[Number(url.split('/').pop())]; return new Response(body, { status }); } });
  assert.deepEqual([...result.checked].sort(), ['4', '5']);
  assert.deepEqual([...result.dead], ['4']);
});

test('repost templates, hidden employers and paid-review schemes are blocked across tracks', () => {
  const base = { title: 'Deckhand', track: 'marine-local', location: 'Myrtle Beach, SC', company: 'Named Employer' };
  for (const extra of [{ url: 'https://unrelated.test/work/job/deckhand-at-employer-city-AbCd0123456789AbCd0123456789AbCd0123456789==' }, { company: 'All Jobs' }, { company: 'AI Recruiting Technology Startup' }, { company: 'Mormac Marine Group Inc Defunct' }, { company: 'Review Pays' }]) assert.equal(dropReason({ ...base, ...extra }), 'junk-listing');
  assert.equal(dropReason({ ...base, url: 'https://freehost.likesyou.org/job/deckhand' }, { filters: { junkSources: ['likesyou.org'] } }), 'junk-listing');
  assert.equal(dropReason({ ...base, url: 'https://employer.test/jobs/deckhand-123' }), null);
  assert.equal(dropReason({ ...base, snippet: 'Earn $600 per week on a boat.' }), null);
});
