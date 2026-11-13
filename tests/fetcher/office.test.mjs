// Office & Gov Sales track, added 2026-11-12 after the two Carahsoft jobs (Government Account
// Representative, Digital Media Coordinator) never reached the site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as direct from '../../scripts/sources/direct.mjs';
import { dropReason } from '../../scripts/lib/filter.mjs';
import { classifyTrack } from '../../scripts/lib/classify.mjs';
import { saysRemote } from '../../scripts/lib/region.mjs';
import { officeWatch, officeMarkdown } from '../../scripts/lib/office-report.mjs';

const now = new Date('2026-11-12T12:00:00Z');
const judge = job => { const track = classifyTrack(job); return { track, reason: dropReason({ ...job, track }, { nowIso: now.toISOString() }) }; };

test('Carahsoft careers pages become jobs with title and pay', async () => {
  const pages = {
    'https://www.carahsoft.com/robots.txt': 'User-agent: *\nDisallow: /login',
    'https://www.carahsoft.com/careers': '<a href="https://www.carahsoft.com/careers/sales-opportunity">x</a><a href="/careers/Digital-Media">y</a><a href="https://www.carahsoft.com/careers/apply-now">Apply</a>',
    'https://www.carahsoft.com/careers/sales-opportunity': '<h2>Career Opportunities</h2><h2>Government Account Representative</h2><p>We currently have openings for entry-level government Account Representatives.</p><p>Starting compensation range: $40,000 - $50,000 per year</p>',
    'https://www.carahsoft.com/careers/Digital-Media': '<h2>Career Opportunities</h2><h2>Digital Media Coordinator</h2><p>Overall Responsibilities Create website landing pages.</p>'
  };
  const jobs = await direct.fetchJobs({ companies: [{ name: 'Carahsoft', ats: 'carahsoft', track: 'office', url: 'https://www.carahsoft.com/careers' }], now, log() {}, http: { getText: async url => pages[url] } });
  assert.deepEqual(jobs.map(j => j.title).sort(), ['Digital Media Coordinator', 'Government Account Representative']);
  const rep = jobs.find(j => j.title.startsWith('Government'));
  assert.equal(rep.pay, '$40,000–$50,000/year');
  assert.equal(rep.location, 'Reston, VA');
});

test('company blocks match whole words: "ncl" does not block "incl."', async () => {
  const { isCruise } = await import('../../scripts/lib/filter.mjs');
  const filters = { excludeCompanies: ['ncl'] };
  assert.equal(isCruise({ company: 'TD SYNNEX (incl. DLT)', title: 'Account Rep' }, filters), false);
  assert.equal(isCruise({ company: 'NCL', title: 'Deckhand' }, filters), true);
});

test('office titles land on the office track', () => {
  for (const title of ['Government Account Representative', 'Digital Media Coordinator', 'Inside Sales Representative', 'Marketing Coordinator', 'Account Coordinator'])
    assert.equal(classifyTrack({ title, location: 'Remote' }), 'office', title);
  assert.equal(classifyTrack({ title: 'Entry Level Outside Sales Representative', location: 'Myrtle Beach, SC' }) === 'office', false);
});

test('office jobs are kept remote or near home, dropped when far and on-site', () => {
  assert.equal(judge({ title: 'Government Account Representative', location: 'Remote', remote: true, snippet: 'Entry-level.' }).reason, null);
  assert.equal(judge({ title: 'Inside Account Representative', location: 'Myrtle Beach, SC', snippet: '' }).reason, null);
  assert.equal(judge({ title: 'Digital Media Coordinator', location: 'Reston, VA', snippet: 'Create landing pages.' }).reason, 'far-not-remote');
  assert.equal(judge({ title: 'Marketing Coordinator', location: 'Remote', remote: true, snippet: '3+ years of marketing experience required.' }).reason, 'senior');
});

test('description that says remote makes a far job remote; hybrid does not', () => {
  assert.equal(saysRemote({ location: 'Reston, VA', snippet: 'This is a fully remote position.' }), true);
  assert.equal(saysRemote({ location: 'Austin, TX', snippet: 'Work from home anywhere in the US.' }), true);
  assert.equal(saysRemote({ location: 'Boston, MA', snippet: 'Hybrid: 3 days in office, remote-friendly culture.' }), false);
  assert.equal(saysRemote({ location: 'Tulsa, OK', snippet: 'Remote monitoring of pipelines.' }), false);
  assert.equal(saysRemote({ location: 'US-OR-Oregon (Remote Employees)', snippet: '' }), true);
});

test('office report lists kept jobs and far jobs at watched companies', () => {
  const catchLog = { jobs: [
    { id: '1', title: 'Government Account Representative', company: 'Carahsoft', location: 'Reston, VA', pay: '$40,000–$50,000/year', url: 'https://x/1', track: 'office', kept: false, dropReason: 'far-not-remote' },
    { id: '2', title: 'Inside Sales Representative', company: 'Other Co', location: 'Remote', url: 'https://x/2', track: 'office', kept: true, dropReason: null },
    { id: '3', title: 'Software Developer', company: 'Carahsoft', location: 'Reston, VA', url: 'https://x/3', track: 'office', kept: false, dropReason: 'off-track' },
    { id: '4', title: 'Deckhand', company: 'Boat Co', location: 'Myrtle Beach, SC', url: 'https://x/4', track: 'marine-local', kept: true, dropReason: null }
  ] };
  const watch = officeWatch(catchLog, { companies: [{ name: 'Carahsoft', ats: 'carahsoft', watch: 'office', askRemote: true }], _skipped: [{ name: 'SHI', reason: 'no job system', watch: 'office' }] }, now.toISOString());
  assert.deepEqual(watch.jobs.map(j => j.id), ['1', '2', '3']);
  assert.equal(watch.companies[0].jobsSeen, 2);
  const md = officeMarkdown(watch);
  assert.match(md, /Worth a look \(2\)/);
  assert.match(md, /Ask if remote/);
  assert.match(md, /SHI: no job system/);
  assert.match(md, /Not an office\/sales role: 1/);
});
