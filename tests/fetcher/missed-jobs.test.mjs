// Jobs found by hand on 2026-11-11 that the robot missed: Hibu (Phenom site), White Cap
// (Workday "City_ZIP" locations, trainee "Account Manager" title) and a FedEx seasonal courier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as direct from '../../scripts/sources/direct.mjs';
import * as ats from '../../scripts/sources/ats.mjs';
import { dropReason, requiredYears } from '../../scripts/lib/filter.mjs';
import { classifyTrack } from '../../scripts/lib/classify.mjs';

const config = JSON.parse(await readFile(new URL('../../config/companies.json', import.meta.url)));
const entry = name => { const e = config.companies.find(e => e.name === name); assert.ok(e, name); return e; };
const now = new Date('2026-11-11T12:00:00Z');
const ctx = (companies, http) => ({ companies, http, now, log() {} });
const keep = job => dropReason({ ...job, track: classifyTrack(job) }, { nowIso: now.toISOString() });

test('Hibu Phenom search page and JobPosting detail produce a kept Myrtle Beach sales job', async () => {
  const calls = [];
  const jobs = await direct.fetchJobs(ctx([{ ...entry('Hibu'), queries: ['Myrtle Beach'] }], {
    getText: async url => {
      calls.push(url);
      if (url.endsWith('/robots.txt')) return 'User-agent: *\nDisallow: */apply';
      if (url.includes('search-results')) return `<script>phApp.ddo = ${JSON.stringify({ eagerLoadRefineSearch: { data: { jobs: [
        { jobSeqNo: 'HIBHIBUSP102614', title: 'Entry Level Outside Sales Representative', location: 'Myrtle Beach, South Carolina, United States', type: 'Full Time', postedDate: '2026-11-10T00:00:00.000+0000' },
        { jobSeqNo: 'HIBX1', title: 'Payroll Specialist', location: 'Myrtle Beach, South Carolina, United States' }] } } })}; phApp.experimentData = {};</script>`;
      return `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Entry Level Outside Sales Representative', datePosted: '2026-11-10',
        description: 'Base salary plus uncapped commission. 3 weeks of classroom training. Some college.', jobLocation: { address: { addressLocality: 'Myrtle Beach', addressRegion: 'SC', addressCountry: 'US' } } })}</script>`;
    }
  }));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://careers.hibu.com/us/en/job/HIBHIBUSP102614');
  assert.ok(!calls.some(u => u.includes('/job/HIBX1')), 'non-sales titles are not fetched');
  assert.equal(keep(jobs[0]), null);
});

test('Workday searchTexts run per city, dedupe, and turn "Conway_29526" into a readable place', async () => {
  const bodies = [];
  const posting = { title: 'Account Manager Accelerated Sales Program', externalPath: '/job/Conway_29526/AM-ASP_WCJR-037535-1', locationsText: 'Conway_29526' };
  const jobs = await ats.fetchJobs(ctx([{ ...entry('White Cap'), searchTexts: ['Conway', 'Myrtle Beach'] }], {
    getText: async () => '',
    getJson: async (url, options) => {
      if (options?.method === 'POST') { bodies.push(JSON.parse(options.body).searchText); return { total: 1, jobPostings: [posting] }; }
      return { jobPostingInfo: { location: 'Conway_29526', timeType: 'Full time', startDate: '2026-11-09',
        jobDescription: 'Paid 6-12 month training program. Preferred: Bachelor’s degree or one to two years of sales or related field experience.' } };
    }
  }));
  assert.deepEqual(bodies, ['Conway', 'Myrtle Beach']);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, 'Conway, 29526');
  assert.equal(keep(jobs[0]), null);
});

test('trainee-program titles are not senior, and worded ranges count from the low end', () => {
  assert.equal(requiredYears('one to two years of sales experience'), 1);
  assert.equal(requiredYears('two to three years of experience'), 2);
  const base = { company: 'X', location: 'Conway, SC', url: 'https://x.test/1', snippet: 'Full time.' };
  assert.equal(keep({ ...base, title: 'Account Manager - Accelerated Sales Program' }), null);
  assert.equal(keep({ ...base, title: 'Account Manager' }), 'senior');
});

test('a local seasonal courier job is quick cash, while CDL truck driving stays out', () => {
  const job = { title: 'Seasonal Courier / Non-DOT-15', company: 'FedEx', location: 'Myrtle Beach, SC', pay: '$21.05/hour', url: 'https://careers.fedex.com/x',
    snippet: 'Temporary position of up to 12 weeks. Deliver and pick up packages using a company vehicle.' };
  assert.equal(keep(job), null);
  assert.notEqual(keep({ ...job, title: 'CDL A Truck Driver' }), null);
});
