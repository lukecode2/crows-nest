import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getJson, getText } from '../../scripts/lib/http.mjs';
import * as ats from '../../scripts/sources/ats.mjs';
import * as pagewatch from '../../scripts/sources/pagewatch.mjs';
import * as jsearch from '../../scripts/sources/jsearch.mjs';
import * as remotive from '../../scripts/sources/remotive.mjs';
import * as sweep from '../../scripts/sources/sweep.mjs';
import { buildFeed, runSources, sources } from '../../scripts/fetch-feed.mjs';

const context = extra => ({ env: {}, companies: [], searches: { remote: [] }, state: {}, now: new Date('2026-10-15T12:00:00Z'), log: () => {}, ...extra });

test('HTTP retries non-JSON, sends user agent, times out and accepts POST', async t => {
  let attempts = 0, timeouts = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/slow')) {
      timeouts++;
      return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    }
    if (url.endsWith('/retry') && attempts++ === 0) return new Response('<html>oops</html>');
    return Response.json({ agent: options.headers.get('User-Agent'), method: options.method, body: options.body });
  });
  const base = 'https://http.example';
  assert.match((await getJson(base + '/retry')).agent, /CrowsNestJobBot/);
  assert.equal(attempts, 2);
  const posted = await getJson(base, { method: 'POST', body: '{}' });
  assert.equal(posted.method, 'POST');
  assert.equal(posted.body, '{}');
  await assert.rejects(getText(base + '/slow', { timeoutMs: 30, retries: 1 }), /timeout|abort/i);
  assert.equal(timeouts, 2);
});

test('weekly sweep reads local jobs and uses the normal feed pipeline; missing or invalid files are empty', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'crows-nest-sweep-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sweepPath = join(dir, 'sweep.json');
  const ctx = context({ sweepPath });
  assert.ok(sources.includes(sweep));
  assert.deepEqual(await sweep.fetchJobs(ctx), []);
  for (const invalid of ['not JSON', 'null', '{}', '{"items":{}}', '{"sweptAt":null,"items":[null]}', '{"sweptAt":null,"items":[{"title":42}]}', '{"sweptAt":"bad date","items":[{"title":"Deckhand"}]}']) {
    await writeFile(sweepPath, invalid);
    assert.deepEqual(await sweep.fetchJobs(ctx), []);
  }
  const items = [
    { title: 'Junior Software Engineer', company: 'A', url: 'https://a/job', source: 'browser', trackHint: 'ai-web', snippet: 'Entry level' },
    { title: 'AI Platform Engineer', company: 'B', url: 'https://b/job', trackHint: 'ai-web' },
    { title: 'Cruise Ship Crew', company: 'C', url: 'https://c/job' }
  ];
  await writeFile(sweepPath, JSON.stringify({ about: "Jobs found by Claude's weekly browser sweep", sweptAt: null, items }));
  const { jobs: raw, report } = await runSources([sweep], ctx);
  assert.equal(raw.length, 3);
  assert.ok(raw.every(j => j.source === 'sweep'));
  assert.deepEqual(report, [{ name: 'sweep', ok: true, count: 3, error: null }]);
  const options = { filters: {}, dismissed: { items: [] }, nowIso: ctx.now.toISOString() };
  const jobs = buildFeed([], raw, options);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].track, 'ai-web');
  assert.equal(jobs[0].source, 'sweep');
  assert.ok(jobs[0].score > 0);
  assert.ok(jobs[0].flags.includes('entry-level'));
  assert.equal(buildFeed(jobs, raw, options).length, 1);
  assert.deepEqual(buildFeed(jobs, raw, { ...options, dismissed: { items: [{ id: jobs[0].id }] } }), []);
});

test('all five ATS adapters map their public payload and isolate a company failure', async () => {
  const payloads = {
    greenhouse: { jobs: [{ title: 'Deckhand', location: { name: 'Charleston, SC' }, absolute_url: 'https://a/job', content: 'TWIC required' }] },
    lever: [{ text: 'Dockhand', categories: { location: 'Myrtle Beach, SC' }, hostedUrl: 'https://b/job', descriptionPlain: 'Will train' }],
    ashby: { jobs: [{ title: 'Mate', location: 'Charleston, SC', jobUrl: 'https://c/job', descriptionPlain: 'Entry level' }] },
    smartrecruiters: { content: [{ id: '4', name: 'Boat Crew', location: { city: 'Charleston', region: 'SC' }, releasedDate: '2026-10-14' }] },
    workday: { total: 1, jobPostings: [{ title: 'Deckhand', locationsText: 'Charleston, South Carolina', externalPath: '/job/SC/Deckhand_5' }] }
  };
  const companies = Object.keys(payloads).map(ats => ({ name: ats, ats, slug: ats, host: 'workday.example', tenant: 'workday', site: 'External', track: 'marine-chs', keywords: ['deck', 'dock', 'mate', 'boat'], states: ['SC'] }));
  companies.push({ name: 'bad', ats: 'lever', slug: 'bad' });
  const jobs = await ats.fetchJobs(context({ companies, http: { getJson: async (url, opts) => {
    if (url.includes('/bad')) throw new Error('HTTP 503');
    const kind = Object.keys(payloads).find(k => url.includes(k));
    if (kind === 'workday') { assert.equal(opts.method, 'POST'); assert.equal(JSON.parse(opts.body).limit, 20); }
    return payloads[kind];
  } } }));
  assert.equal(jobs.length, 5);
  assert.ok(jobs.every(j => j.trackHint === 'marine-chs'));
  assert.equal(jobs.find(j => j.company === 'workday').url, 'https://workday.example/en-US/External/job/SC/Deckhand_5');
});

test('pagewatch respects robots, baselines first run, resolves URLs and emits only new links', async () => {
  let html = '<a href="/jobs/1">Deckhand</a><a href="javascript:bad()">Crew</a>';
  const state = {};
  const entry = { name: 'Boats', ats: 'page', url: 'https://boats.example/careers', track: 'marine-national' };
  const ctx = context({ companies: [entry], state, http: { getText: async url => url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /private\n' : html } });
  assert.deepEqual(await pagewatch.fetchJobs(ctx), []);
  html += '<a href="../jobs/2?x=1&amp;y=2"><b>Yacht Crew</b></a>';
  const jobs = await pagewatch.fetchJobs(ctx);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://boats.example/jobs/2?x=1&y=2');
  assert.ok(jobs[0].flags.includes('page-changed'));
  assert.deepEqual(await pagewatch.fetchJobs(ctx), []);
  ctx.companies = [{ ...entry, url: 'https://boats.example/private/jobs' }];
  await assert.rejects(pagewatch.fetchJobs(ctx), /robots/);
});

test('JSearch caps calls at two and rotates across three slots', async () => {
  const calls = [];
  const searches = { jsearch: Array.from({ length: 12 }, (_, i) => ({ query: `query${i}`, track: 'marine-local' })) };
  for (const runSlot of [0, 1, 2]) await jsearch.fetchJobs(context({ env: { RAPIDAPI_KEY: 'test' }, searches, runSlot, http: { getJson: async url => { calls.push(new URL(url).searchParams.get('query')); return { data: [] }; } } }));
  assert.equal(calls.length, 6);
  assert.equal(new Set(calls).size, 6);
});

test('remote boards keep only matching titles', async () => {
  const jobs = await remotive.fetchJobs(context({ searches: { remote: [{ q: 'web developer', track: 'ai-web' }] }, http: { getJson: async () => ({ jobs: [{ title: 'Junior Web Developer', company_name: 'A', url: 'https://a/job' }, { title: 'Nurse', company_name: 'B' }] }) } }));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].remote, true);
  assert.equal(jobs[0].location, 'Remote');
});

test('feed filters persisted jobs too and inspects descriptions before snippet truncation', () => {
  const filters = { excludeCompanies: ['msc cruises'], allowCompanies: [], excludeKeywords: [] };
  const raw = [{ title: 'Web Developer', company: 'A', snippet: 'x '.repeat(200) + '5+ years required', url: 'https://a/1', trackHint: 'ai-web' }, { title: 'Deckhand', company: 'B', url: 'https://b/1', trackHint: 'marine-chs' }];
  const prev = [{ id: 'hidden', title: 'Deckhand', company: 'MSC Cruises', firstSeenAt: '2026-10-14T00:00:00Z', score: 70 }, { id: 'tracked', firstSeenAt: '2026-10-14T00:00:00Z', score: 80 }];
  const jobs = buildFeed(prev, raw, { filters, dismissed: { items: [] }, trackedIds: new Set(['tracked']), nowIso: '2026-10-15T12:00:00Z' });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'B');
  assert.equal(jobs[0].trackHint, undefined);
  assert.equal(jobs[0].snippet, '');
});

test('remote sales retains its sales track even when description mentions crew', async () => {
  const jobs = await remotive.fetchJobs(context({ searches: { remote: [{ q: 'sales development' }] }, http: { getJson: async () => ({ jobs: [{ title: 'Sales Development Representative', description: 'Join our crew of sales professionals' }] }) } }));
  assert.equal(jobs[0].trackHint, 'tech-sales');
});

test('pagewatch ignores anchors in script templates and HTML comments', async () => {
  const url = 'https://boats.example/careers';
  const state = { [url]: [] };
  const jobs = await pagewatch.fetchJobs(context({ state, companies: [{ name: 'A', ats: 'page', url }], http: { getText: async u => u.endsWith('robots.txt') ? '' : '<script>const template = `<a href="${job.url}">Job title</a>`;</script><!-- <a href="/old">Deckhand</a> --><a href="/new">Deckhand</a>' } }));
  assert.deepEqual(jobs.map(j => j.url), ['https://boats.example/new']);
});

test('workday type and all locations survive mapping for agency classification', async () => {
  const companies = [{ name: 'Agency', ats: 'workday', host: 'workday.example', tenant: 't', site: 's', track: null, states: ['SC'] }];
  const jobs = await ats.fetchJobs(context({ companies, http: { getJson: async url => url.endsWith('/jobs') ? { jobPostings: [{ title: 'Brand Ambassador', locationsText: '2 Locations', externalPath: '/job/1', timeType: 'Part time' }] } : { jobPostingInfo: { location: 'Charlotte, North Carolina', additionalLocations: ['Myrtle Beach, South Carolina'], jobDescription: 'Product demo', timeType: 'Part time' } } } }));
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].snippet, /Part time/);
  assert.match(jobs[0].location, /South Carolina/);
});

test('Adzuna caps queries at eight and maps hourly salaries and track hints', async () => {
  const adzuna = await import('../../scripts/sources/adzuna.mjs');
  const calls = [];
  const jobs = await adzuna.fetchJobs(context({ env: { ADZUNA_APP_ID: 'id', ADZUNA_APP_KEY: 'key' }, searches: { adzuna: Array.from({ length: 12 }, () => ({ what: 'deckhand', where: 'Charleston SC', track: 'marine-chs' })) }, http: { getJson: async url => {
    calls.push(url);
    return { results: [{ title: 'Deckhand', company: { display_name: 'A' }, location: { display_name: 'Charleston, SC' }, redirect_url: 'https://a/job', salary_min: 17, salary_max: 18, created: '2026-10-14', description: 'Will train' }] };
  } } }));
  assert.equal(calls.length, 8);
  assert.equal(new URL(calls[0]).searchParams.get('distance'), '40');
  assert.equal(jobs[0].pay, '$17–$18/hour');
  assert.equal(jobs[0].trackHint, 'marine-chs');
});

test('USAJOBS passes required authentication and maps vessel jobs', async () => {
  const usajobs = await import('../../scripts/sources/usajobs.mjs');
  let calls = 0;
  const jobs = await usajobs.fetchJobs(context({ env: { USAJOBS_API_KEY: 'key', USAJOBS_EMAIL: 'me@example.com' }, http: { getJson: async (url, options) => {
    calls++;
    assert.equal(options.headers['User-Agent'], 'me@example.com');
    assert.equal(options.headers['Authorization-Key'], 'key');
    return { SearchResult: { SearchResultItems: [{ MatchedObjectDescriptor: { PositionTitle: 'Ordinary Seaman', OrganizationName: 'Military Sealift Command', PositionLocationDisplay: 'Norfolk, VA', PositionURI: 'https://usajobs.gov/job/1', PublicationStartDate: '2026-10-14', PositionRemuneration: [{ MinimumRange: '20', MaximumRange: '25', Description: 'hour' }], QualificationSummary: 'MMC required' } }] } };
  } } }));
  assert.equal(calls, 5);
  assert.equal(jobs[0].trackHint, 'marine-national');
  assert.equal(jobs[0].company, 'Military Sealift Command');
  assert.equal(jobs[0].pay, '$20–$25/hour');
  for (const source of [usajobs, jsearch]) await assert.rejects(source.fetchJobs(context()), /missing key/);
});

test('JSearch uses search-v2 and reads data.jobs with publisher', async () => {
  let called = '';
  const jobs = await jsearch.fetchJobs(context({ env: { RAPIDAPI_KEY: 'test' }, searches: { jsearch: [{ query: 'deckhand jobs in Charleston, SC', track: 'marine-chs' }] }, runSlot: 0,
    http: { getJson: async url => { called = url; return { status: 'OK', data: { jobs: [{ job_title: 'Deckhand', employer_name: 'Harbor Co', job_city: 'Charleston', job_state: 'South Carolina', job_apply_link: 'https://www.indeed.com/viewjob?jk=1', job_publisher: 'Indeed', job_description: 'Entry level', job_posted_at_datetime_utc: '2026-10-14T22:00:00.000Z' }], cursor: 'x' } }; } } }));
  assert.match(called, /\/search-v2\?/);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].trackHint, 'marine-chs');
  assert.match(jobs[0].snippet, /^via Indeed\./);
});
