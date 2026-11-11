import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as direct from '../../scripts/sources/direct.mjs';
import * as ats from '../../scripts/sources/ats.mjs';
import * as govjobs from '../../scripts/sources/govjobs.mjs';
import { sources } from '../../scripts/fetch-feed.mjs';
import { publicClient } from '../../scripts/lib/source-utils.mjs';

const config = JSON.parse(await readFile(new URL('../../config/companies.json', import.meta.url)));
const entry = name => { const e = config.companies.find(e => e.name === name); assert.ok(e, name); return e; };
const now = new Date('2026-11-11T12:00:00Z');
const ctx = (companies, http) => ({ companies, http: { getText: async () => '', ...http }, now, log() {} });
const jsonld = j => `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Brand Ambassador', description: 'No degree required. Must obtain food-handler card. Paid training.', jobLocation: [{ address: { addressLocality: 'Charleston', addressRegion: 'SC', addressCountry: 'US' } }], ...j })}</script>`;

test('Curtin BambooHR fetches full qualifications, pay and current open status', async () => {
  const calls = [];
  const jobs = await direct.fetchJobs(ctx([entry('Curtin Maritime')], {
    getText: async () => '',
    getJson: async url => {
      calls.push(url);
      if (url.endsWith('/list')) return { result: [1, 2].map(id => ({ id, jobOpeningName: 'Deckhand Trainee', location: { city: 'Long Beach', state: 'California' } })) };
      return { result: { jobOpening: { jobOpeningName: 'Deckhand Trainee', jobOpeningStatus: url.includes('/1/') ? 'Open' : 'Closed', location: { city: 'Long Beach', state: 'California' }, compensation: '$24 per hour', datePosted: '2026-11-10', minimumExperience: 'Entry-level', description: 'Paid training. TWIC must be obtained.' } } };
    }
  }));
  assert.equal(jobs.length, 1); assert.equal(calls.length, 3);
  assert.equal(jobs[0].url, 'https://curtinmaritime.bamboohr.com/careers/1');
  assert.equal(jobs[0].pay, '$24 per hour'); assert.match(jobs[0].snippet, /TWIC must be obtained/);
  assert.equal(jobs[0].trackHint, 'marine-national');
});

test('Brittain iCIMS/Jibe paginates, retains salary and qualifications, and links to public job pages', async () => {
  const calls = [];
  const jobs = await direct.fetchJobs(ctx([entry('Brittain Resorts & Hotels')], {
    getText: async () => '', getJson: async url => {
      calls.push(url); const page = Number(new URL(url).searchParams.get('page'));
      return { totalCount: 2, jobs: [{ data: { slug: String(page), title: page === 1 ? 'Pool Attendant' : 'Housekeeping Room Attendant', city: 'Myrtle Beach', state: 'South Carolina', external: false, description: 'Outdoor guest service.', qualifications: 'No experience required.', tags4: ['USD $16.00 - USD $17.00 /Hr.'], apply_url: 'https://blocked.test/login' } }] };
    }
  }));
  assert.equal(calls.length, 2); assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://careers.brittainresorts.com/jobs/1');
  assert.match(jobs[0].snippet, /No experience required/); assert.match(jobs[0].pay, /17.00/);
});

for (const company of ['BDS Connected Solutions', 'BDS Connected Solutions (NC)']) {
  test(`${company} iCIMS follows pagination and reads credentials/pay from JSON-LD details`, async () => {
    const state = company.endsWith('(NC)') ? 'NC' : 'SC';
    const e = entry(company), base = new URL(e.url).origin, calls = [];
    const jobs = await direct.fetchJobs(ctx([e], {
      getText: async url => {
        calls.push(url); if (url.endsWith('/robots.txt')) return 'User-agent: *\nDisallow: /jobs/login';
        if (url.includes('/jobs/search')) {
          const page = Number(new URL(url).searchParams.get('pr'));
          return `<h2 class="iCIMS_SubHeader">Search Results</h2><li class="iCIMS_JobCardItem"><a href="${base}/jobs/${page + 1}/product-specialist/job?in_iframe=1"><span>Title</span><h3>Product Specialist</h3></a><dl><dt>Location</dt><dd>US-${state}-Charleston</dd></dl></li>${page ? '' : '<a href="?ss=1&amp;pr=1&amp;in_iframe=1">Next</a>'}`;
        }
        return jsonld({ title: 'Product Specialist', jobLocation: { address: { addressLocality: 'Charleston', addressRegion: state, addressCountry: 'US' } }, baseSalary: { value: { minValue: 20, maxValue: 22, unitText: 'HOUR' } }, validThrough: url.includes('/2/') ? '2026-10-01' : '2027-01-01' });
      }
    }));
    assert.equal(jobs.length, 1); assert.equal(jobs[0].pay, '$20–$22/hour');
    assert.match(jobs[0].snippet, /food-handler/); assert.ok(!jobs[0].url.includes('in_iframe'));
    assert.equal(calls.filter(u => u.endsWith('/robots.txt')).length, 1);
    assert.equal(calls.filter(u => u.includes('/jobs/search')).length, 2);
  });
}

test('McAllister Oracle fetches untruncated eligibility and skips expired requisitions', async () => {
  const jobs = await direct.fetchJobs(ctx([entry('McAllister Towing')], {
    getText: async () => '', getJson: async url => url.includes('recruitingCEJobRequisitions?') ? { items: [{ requisitionList: [{ Id: '250', Title: 'Ordinary Seaman', PrimaryLocation: 'Jacksonville, FL' }, { Id: '251', Title: 'Deckhand', PostingEndDate: '2026-10-01' }] }] } :
      { items: [{ Id: '250', Title: 'Ordinary Seaman', PrimaryLocation: 'Jacksonville, FL', ExternalDescriptionStr: 'Current MMC and TWIC required.', ExternalPostedStartDate: '2026-11-10', ExternalQualificationsStr: 'STCW required.' }] }
  }));
  assert.equal(jobs.length, 1); assert.match(jobs[0].url, /\/sites\/CX_1\/job\/250$/);
  assert.match(jobs[0].snippet, /Current MMC and TWIC required/); assert.match(jobs[0].snippet, /STCW required/);
});

test('Ingram reads allowed SmartRecruiters HTML and full microdata without using the blocked API', async () => {
  const e = entry('Ingram Barge Company'), calls = [];
  const jobs = await direct.fetchJobs(ctx([e], { getText: async url => {
    calls.push(url); assert.notEqual(new URL(url).hostname, 'api.smartrecruiters.com');
    if (url.endsWith('/robots.txt')) return 'User-agent: *\nAllow: /';
    if (url === e.url) return '<ul class="opening-jobs"><li><a href="https://jobs.smartrecruiters.com/IngramBargeCompany/123-fleet-deckhand"><h4>Fleet Deckhand</h4><ul><li class="job-desc">Columbus, KY</li></ul></a></li></ul>';
    return '<main itemscope itemtype="http://schema.org/JobPosting"><h1>Fleet Deckhand</h1><section>Entry level. Work away from home for 21-day hitches. Must obtain a valid TWIC card.</section></main><meta itemprop="datePosted" content="2026-11-01">';
  } }));
  assert.equal(jobs.length, 1); assert.equal(jobs[0].location, 'Columbus, KY');
  assert.equal(jobs[0].postedAt, '2026-11-01T00:00:00.000Z');
  assert.match(jobs[0].snippet, /Must obtain/); assert.match(jobs[0].snippet, /21-day hitches/);
  assert.equal(calls.filter(u => u.endsWith('/robots.txt')).length, 2);
});

test('Acosta family feed uses official public API, paginates, deduplicates and retains full descriptions', async () => {
  const e = entry('Acosta Group (ActionLink, CROSSMARK, Mosaic, Premium, Product Connections)');
  const calls = [];
  const jobs = await direct.fetchJobs(ctx([{ ...e, cities: ['Myrtle Beach, SC', 'North Myrtle Beach, SC'] }], {
    getText: async () => '', getJson: async (url, options) => {
      calls.push(url); assert.equal(options.headers['X-Origin'], 'acosta.jobs');
      const page = Number(new URL(url).searchParams.get('page'));
      return { pagination: { has_more_pages: page === 1 }, jobs: [{ job: { requisitionId: 'ABC', title: 'Brand Ambassador', addresses: ['Myrtle Beach, SC, USA'], description: '1-year continuity program. $25 per hour. Paid training.', postingExpireTime: page === 1 ? '2027-01-01' : '2026-10-01', customAttributes: { city_display_slug: { stringValues: ['myrtle-beach-sc'] }, title_slug: { stringValues: ['brand-ambassador'] } } } }] };
    }
  }));
  assert.equal(calls.length, 4); assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://acosta.jobs/myrtle-beach-sc/brand-ambassador/ABC/job/');
  assert.match(jobs[0].snippet, /continuity program/);
});

test('Advantage uses literal city queries, follows job links and preserves full sampling eligibility', async () => {
  const e = { ...entry('Advantage Solutions'), cities: ['Myrtle Beach'] }, calls = [];
  const jobs = await direct.fetchJobs(ctx([e], {
    getText: async url => {
      calls.push(url); if (url.endsWith('/robots.txt')) return '';
      if (url.includes('?location=')) return '1 Results Returned <tr><td><a class="job-link" href="/job/?req_id=PDX_1">Part Time Product Demonstrator in Costco</a></td><td>US-SC-Myrtle Beach</td></tr>';
      return jsonld({ title: 'Part Time Product Demonstrator in Costco', baseSalary: '15.00 per hour' });
    }
  }));
  assert.equal(jobs.length, 1); assert.equal(jobs[0].pay, '15.00 per hour');
  assert.ok(calls.includes('https://careers.youradv.com/?location=Myrtle%20Beach'));
});

test('Alignerr checks full active status and US/city eligibility instead of trusting Remote cards', async () => {
  const e = { ...entry('Alignerr'), searches: ['English'], maxPages: 2 }, calls = [];
  const jobs = await direct.fetchJobs(ctx([e], {
    getJson: async url => { calls.push(url); const offset = Number(new URL(url).searchParams.get('offset')); return { total: 61, jobs: (offset ? [4] : [1, 2, 3]).map(id => ({ id, title: 'English Writing Generalist', location: 'Remote', applyUrl: `/jobs/${id}` })) }; },
    getText: async url => {
      if (url.endsWith('/robots.txt')) return '';
      const id = Number(url.split('/').at(-1));
      return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { job: { name: 'English Writing Generalist', isActive: id !== 4, location: id === 2 ? 'Australia' : 'United States', city: id === 3 ? 'Chicago' : null, htmlLongDescription: 'AI training. No degree required.', lowerBoundHourlyRate: 15, upperBoundHourlyRate: 40 } } } })}</script>`;
    }
  }));
  assert.equal(calls.length, 2); assert.equal(jobs.length, 1); assert.equal(jobs[0].remote, true);
  assert.equal(jobs[0].location, 'Remote — United States'); assert.equal(jobs[0].pay, '$15–$40/hour');
});

test('Mercor reads public listings and excludes filled, private, US-ineligible and standing-pool listings', async () => {
  const e = entry('Mercor');
  const base = { listingId: 'list_1', title: 'Video Caption Auditor Expert', status: 'active', listingType: 'standard', remainingSlots: 25, workArrangement: 'remote', location: 'Remote (worldwide)', rateMin: 20, rateMax: 30, payRateFrequency: 'hourly', description: 'AI annotation. Prior experience is nice to have.' };
  const rows = [base, { ...base, listingId: 'list_2', disableApplications: true }, { ...base, listingId: 'list_3', eligibleLocation: ['CAN'] }, { ...base, listingId: 'list_4', ineligibleResidenceLocation: ['USA'] }, { ...base, listingId: 'list_5', listingType: 'evergreen' }, { ...base, listingId: 'list_6', remainingSlots: 0 }, { ...base, listingId: 'list_7', isPrivate: true }];
  const jobs = await direct.fetchJobs(ctx([e], { getText: async url => url.endsWith('/robots.txt') ? '' : `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { dehydratedState: { queries: [{ queryKey: ['listings-explore-page', 'public-explore-page'], state: { data: { listings: rows } } }] } } } })}</script>` }));
  assert.equal(jobs.length, 1); assert.equal(jobs[0].pay, '$20–$30/hour');
  assert.equal(jobs[0].url, 'https://work.mercor.com/jobs/list_1/video-caption-auditor-expert');
  assert.match(jobs[0].snippet, /nice to have/); assert.equal(jobs[0].remote, true);
});

test('Tall Ships reads real vacancies, benefits and deadlines; omits expired seasons and galley jobs', async () => {
  const e = entry('Tall Ships America Billet Bank');
  const row = (id, category, deadline = '') => `<tr><td><a href="?job_id=${id}">Deckhand Educator</a><span class="spanaft">Call of the Sea</span></td><td>${category}</td><td>Seasonal</td><td>2027-03-01</td><td>${deadline}</td><td>2026-11-06</td></tr>`;
  const fetched = [];
  const jobs = await direct.fetchJobs(ctx([e], { getText: async url => {
    if (url.endsWith('/robots.txt')) return '';
    if (!url.includes('?job_id')) return `<table class="tsa-table">${row(1, 'Deck: Unlicensed', '2026-11-15')}${row(2, 'Deck: Unlicensed', '2026-10-01')}${row(3, 'Cook')}${row(4, 'Deck: Unlicensed')}</table>`;
    fetched.push(url);
    return `Posted By: Call of the Sea Homeport(s): Sausalito Start Date: March 1, 2027 End Date: ${url.endsWith('4') ? 'October 31, 2026' : 'November 15, 2027'} Job Description: Entry-level liveaboard. No sailing experience needed. Compensation: $17.40 Hourly Benefits: Room and board included. Required Certifications Medical: CPR <script>throw new Error('untrusted')</script> Apply Now`;
  } }));
  assert.equal(fetched.length, 2); assert.equal(jobs.length, 1); assert.equal(jobs[0].company, 'Call of the Sea');
  assert.equal(jobs[0].location, 'Sausalito'); assert.equal(jobs[0].pay, '$17.40 Hourly');
  assert.match(jobs[0].snippet, /Room and board/); assert.doesNotMatch(jobs[0].snippet, /untrusted/);
});

test('North Carolina ferry Workday feed is registered and preserves actual county and full eligibility', async () => {
  const config = JSON.parse(await readFile(new URL('../../config/govfeeds.json', import.meta.url)));
  const e = config.feeds.find(e => e.name === 'North Carolina Ferry Division'); assert.ok(e);
  const jobs = await govjobs.fetchJobs({ ...ctx([], { getText: async () => '', getJson: async (url, opts) => {
    if (opts?.method === 'POST') { assert.equal(JSON.parse(opts.body).searchText, 'Ferry'); return { total: 1, jobPostings: [{ title: 'Ferry Crew Member I', locationsText: 'Brunswick County, NC', externalPath: '/job/ferry_1' }] }; }
    return { jobPostingInfo: { location: 'Brunswick County, NC', jobDescription: 'TWIC may be obtained after offer.', startDate: '2026-11-10' } };
  } }), govfeeds: { feeds: [e] } });
  assert.equal(jobs.length, 1); assert.equal(jobs[0].location, 'Brunswick County, NC');
  assert.match(jobs[0].snippet, /after offer/);
});

test('2020 Charleston Workday search excludes same-name WV jobs and reads pay from detail', async () => {
  const jobs = await ats.fetchJobs(ctx([entry('2020 Companies (Charleston)')], { getJson: async (url, opts) => {
    if (opts?.method === 'POST') { assert.equal(JSON.parse(opts.body).searchText, 'Charleston'); return { total: 2, jobPostings: ['SC', 'WV'].map(state => ({ title: 'Retail Display Installer – Technology', locationsText: `Charleston, ${state}`, externalPath: `/job/${state}` })) }; }
    return { jobPostingInfo: { location: url.endsWith('/SC') ? 'Charleston, SC' : 'Charleston, WV', jobDescription: 'Paid training. $20 per hour.', payRange: '$20 per hour' } };
  } }));
  assert.equal(jobs.length, 1); assert.equal(jobs[0].pay, '$20 per hour');
});

test('direct sources are registered once, isolated from legacy ATS, and robots failures stop requests', async () => {
  assert.ok(sources.includes(direct));
  assert.deepEqual(await ats.fetchJobs(ctx([entry('Curtin Maritime')], { getJson: async () => { throw new Error('wrong adapter'); } })), []);
  let requests = 0;
  const api = publicClient({ http: { getText: async () => 'User-agent: *\nDisallow: /api', getJson: async () => { requests++; } } });
  await assert.rejects(api.getJson('https://employer.test/api/jobs'), /robots/); assert.equal(requests, 0);
  const failed = publicClient({ http: { getText: async () => { throw Object.assign(new Error('robots unavailable'), { status: 503 }); } } });
  await assert.rejects(failed.getJson('https://employer.test/jobs'), /robots unavailable/);
  assert.equal(direct.jobPostings('<script>throw Error("do not execute")</script>'+jsonld({})).length, 1);
});
