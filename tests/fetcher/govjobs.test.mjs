import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as govjobs from '../../scripts/sources/govjobs.mjs';
import { classifyTrack } from '../../scripts/lib/classify.mjs';
import { sources } from '../../scripts/fetch-feed.mjs';
import { robotsAllowed } from '../../scripts/sources/pagewatch.mjs';
const ctx = extra => ({ env: {}, log: () => {}, govfeeds: { feeds: [] }, ...extra });
test('government RSS emits relevant titles, decoded URLs and no track hints', async () => {
  const titles = ['Deckhand', 'Lifeguard', 'Ocean Rescue', 'Park Ranger', 'Dock Attendant', 'Water Operator', 'Valet', 'Event Staff', 'Firefighter Recruit', 'Seasonal Groundskeeper', 'Universal Banker'];
  const xml = `<rss><channel>${titles.map((title, i) => `<item><title><![CDATA[${title}]]></title><link>https://county.test/jobs?id=${i}&amp;amp;view=job</link><pubDate>Thu, 15 Oct 2026 12:00:00 GMT</pubDate><description>&lt;p&gt;Will train &amp;amp; learn&lt;/p&gt;</description></item>`).join('')}</channel></rss>`;
  const jobs = await govjobs.fetchJobs(ctx({ govfeeds: { feeds: [{ name: 'Georgetown County', type: 'rss', url: 'https://county.test/rss', location: 'Georgetown County, SC' }] }, http: { getText: async url => url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /' : xml } }));
  assert.ok(sources.includes(govjobs)); assert.equal(jobs.length, 10);
  assert.ok(jobs.every(j => !j.trackHint && j.source === 'govjobs' && j.company === 'Georgetown County'));
  assert.equal(jobs[0].url, 'https://county.test/jobs?id=0&view=job');
  assert.equal(jobs[0].snippet, 'Will train & learn');
  for (const title of ['Lifeguard', 'Ocean Rescue', 'Firefighter Recruit']) {
    assert.equal(classifyTrack({ title, location: 'Horry County, SC' }), 'marine-local');
    assert.equal(classifyTrack({ title, location: 'Charleston, SC' }), 'marine-chs');
  }
});
test('government feeds isolate failures, honor robots, reject malformed RSS and filter state counties', async () => {
  const feeds = [
    { name: 'bad', type: 'rss', url: 'https://bad.test/rss' },
    { name: 'blocked', type: 'rss', url: 'https://blocked.test/rss' },
    { name: 'State', type: 'json', url: 'https://good.test/jobs', counties: ['Horry', 'Georgetown', 'Charleston', 'Berkeley', 'Dorchester'] }
  ];
  let blockedFetch = false;
  const jobs = await govjobs.fetchJobs(ctx({ govfeeds: { feeds }, http: {
    getText: async url => { if (url.endsWith('robots.txt')) return url.includes('blocked') ? 'User-agent: *\nDisallow: /' : ''; if (url.includes('blocked')) blockedFetch = true; return '<html>Not RSS</html>'; },
    getJson: async () => ({ jobs: [{ title: 'Boat Crew', location: 'Horry County, SC', url: 'https://jobs/1' }, { title: 'Boat Crew', location: 'Richland County, SC', url: 'https://jobs/2' }, { title: 'Physician', location: 'Horry County, SC', url: 'https://jobs/3' }] })
  } }));
  assert.equal(blockedFetch, false); assert.equal(jobs.length, 1); assert.equal(jobs[0].location, 'Horry County, SC');
  assert.equal(robotsAllowed('User-agent: *\\r\\nDisallow: /', 'https://site.test/jobs'), false);
});
test('government Workday paginates, filters titles before details and leaves classification to the classifier', async () => {
  const offsets = [], details = [];
  const jobs = await govjobs.fetchJobs(ctx({ govfeeds: { feeds: [{ name: 'City of Charleston', type: 'workday', host: 'charlestonsc.example', tenant: 'charlestonsc', site: 'External', location: 'Charleston, SC', maxPages: 3 }] }, http: {
    getText: async () => '',
    getJson: async (url, opts) => {
      if (opts?.method === 'POST') { const { offset } = JSON.parse(opts.body); offsets.push(offset); return { total: 21, jobPostings: offset ? [{ title: 'Firefighter Recruit', locationsText: 'Fire Department', externalPath: '/job/fire' }] : Array.from({ length: 20 }, (_, i) => ({ title: i ? 'Accountant' : 'Lifeguard', locationsText: 'Recreation', externalPath: `/job/${i}` })) }; }
      details.push(url); return { jobPostingInfo: { jobDescription: 'Will train' } };
    }
  } }));
  assert.deepEqual(offsets, [0, 20]); assert.equal(details.length, 2); assert.equal(jobs.length, 2);
  assert.ok(jobs.every(j => !j.trackHint && j.location.includes('Charleston, SC') && classifyTrack(j) === 'marine-chs'));
});
test('robots uses longest allow/disallow rule, wildcard paths and bot-specific groups', () => {
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /private/*\nAllow: /private/jobs', 'https://site.test/private/jobs/1'), true);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /private/*', 'https://site.test/private/a'), false);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /\nUser-agent: CrowsNestJobBot\nAllow: /', 'https://site.test/jobs'), true);
});
