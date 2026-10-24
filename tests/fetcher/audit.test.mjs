import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dropReason, isSenior, roleKey, applyFilters, requiredYears } from '../../scripts/lib/filter.mjs';
import { classifyTrack } from '../../scripts/lib/classify.mjs';
import { checkLinks, checkUrl, DEAD_TEXT } from '../../scripts/lib/linkcheck.mjs';
import { needsCredentialHeLacks } from '../../scripts/lib/fit.mjs';
import { parsePay, inHomeRegion } from '../../scripts/lib/region.mjs';
import { buildFeed, checkFeedLinks, dailyRunSlot, sources } from '../../scripts/fetch-feed.mjs';
import { sendAlert } from '../../scripts/lib/alert.mjs';
const nowIso = '2026-10-24T12:00:00Z';
const job = (title, extra = {}) => ({ id: title, title, company: 'Co', location: 'Myrtle Beach, SC', track: 'quick-cash', snippet: '', pay: '', ...extra });
const reason = (title, extra) => dropReason(job(title, extra), { nowIso });

test('Adzuna land checks use details with the complete query, on the Adzuna host only', async () => {
  const url = 'https://www.adzuna.com/land/ad/123?se=abc&utm_source=test&v=xyz';
  const details = 'https://www.adzuna.com/details/123?se=abc&utm_source=test&v=xyz';
  assert.equal(checkUrl(url), details);
  assert.equal(checkUrl('https://notadzuna.com/land/ad/123'), 'https://notadzuna.com/land/ad/123');
  for (const status of [404, 410]) {
    const { dead } = await checkLinks([job('gone', { url })], { nowIso, hostDelayMs: 0, fetchImpl: async actual => {
      assert.equal(actual, details); return new Response('', { status });
    } });
    assert.ok(dead.has('gone'));
  }
});

test('explicit expiry text and vanished Bluewater vacancies are dead; blocks and timeouts are unknown', async () => {
  const expired = ['The job you are trying to view has expired', 'The Deckhand job in Miami has expired, here are the closest matches:', "Couldn't find this Job Posting"];
  for (const text of expired) assert.ok(DEAD_TEXT.test(text), text);
  const bluewater = 'https://www.bluewateryachting.com';
  const pages = [
    ...expired.map(text => ({ ok: true, status: 200, text: async () => `<p>${text}</p>` })),
    { ok: true, status: 200, url: `${bluewater}/crew-placement/yacht-crew/jobs`, text: async () => 'Browse jobs' },
    ...[401, 403, 429].map(status => ({ ok: false, status, text: async () => expired[0] })),
    { ok: true, status: 200, url: `${bluewater}/yacht-crew-job/deckhand-123`, text: async () => 'Apply' },
    { ok: true, status: 200, text: async () => `<script>${expired[0]}</script>Apply now` },
    { ok: true, status: 200, text: async () => 'Once the announcement has closed, applicants will be notified.' }
  ];
  const jobs = pages.map((_, i) => job(String(i), { url: `${bluewater}/yacht-crew-job/deckhand-${i}` }));
  jobs.push(job('timeout', { url: 'https://other.test/job' }));
  const result = await checkLinks(jobs, { nowIso, hostDelayMs: 0, fetchImpl: async url => {
    if (url.includes('other.test')) throw new Error('timeout');
    return pages[Number(url.split('-').pop())];
  } });
  assert.deepEqual([...result.dead].sort(), ['0', '1', '2', '3']);
  assert.ok(!result.checked.has('timeout'));
});

test('link checking covers eligible jobs from every source, including sweep and stored jobs', async () => {
  const incoming = sources.map(s => job(`Brand Ambassador Representative ${s.name}`, { company: s.name, url: `https://${s.name}.test/job`, source: s.name, trackHint: 'quick-cash' }));
  const prev = [job('Valet', { id: 'stored', url: 'https://stored.test/job', firstSeenAt: nowIso })];
  const calls = [];
  const result = await checkFeedLinks(prev, incoming, { nowIso }, { hostDelayMs: 0, fetchImpl: async url => { calls.push(url); return new Response('', { status: 410 }); } });
  assert.equal(calls.length, sources.length + 1);
  assert.ok(calls.includes('https://sweep.test/job'));
  assert.equal(result.jobs.length, 0);
});

test('duplicate roles are link-checked before one copy is selected', async () => {
  const incoming = ['dead', 'live'].map(id => job('Brand Ambassador', { company: 'Staffing Co', url: `https://duplicate.test/${id}` }));
  const calls = [];
  const { jobs } = await checkFeedLinks([], incoming, { nowIso }, { hostDelayMs: 0, fetchImpl: async url => {
    calls.push(url); return new Response('Apply', { status: url.endsWith('dead') ? 410 : 200 });
  } });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://duplicate.test/live');
});

test('category links and talent pools are not vacancies across sources', () => {
  for (const source of ['pagewatch', 'jsearch', 'sweep']) {
    assert.equal(reason('Yacht Deckhand', { source, track: 'marine-national', url: 'https://yachtservicenetwork.com/jobs/mate/in/miami' }), 'not-a-job');
    for (const snippet of ['Get certified for future project opportunities', 'We will contact you when an opportunity arises']) assert.equal(reason('AI Trainer', { source, track: 'ai-web', remote: true, snippet }), 'not-a-job');
  }
  assert.equal(reason('Yacht Deckhand', { source: 'pagewatch', track: 'marine-local', url: 'https://yachtservicenetwork.com/jobs/123' }), null);
});

test('head, chief, leader and supervisor titles are senior on every track; lead exceptions survive', () => {
  for (const track of ['marine-local', 'marine-chs', 'marine-national', 'quick-cash', 'tech-sales', 'ai-web']) {
    for (const title of ['Head Stew', 'Head Stewardess', 'Chief Deckhand', 'Head Chef', 'Head Engineer', 'Deckhand Leader', 'Shift Supervisor']) assert.ok(isSenior(job(title, { track })), `${track} ${title}`);
    for (const title of ['Lead Brand Ambassador', 'Lead Generation Representative', 'Retail Lead Generation Sales Representative']) assert.equal(isSenior(job(title, { track })), false, `${track} ${title}`);
  }
});

test('marine skilled trades need an explicit training route, in either title or snippet', () => {
  for (const title of ['Marine Service Technician', 'Marine Mechanic', 'Marine Painter', 'Yacht Coatings Specialist', 'Boat Rigger', 'Marine Installer', 'Marine Welder', 'Fiberglass Boat Builder', 'Yacht Safety Administrator']) {
    assert.equal(reason(title, { track: 'marine-local' }), 'not-marine', title);
    for (const marker of ['Apprentice', 'Trainee', 'Helper', 'Entry-level', 'No experience', 'Will train']) {
      assert.equal(reason(title, { track: 'marine-local', snippet: marker }), null, `${title} ${marker}`);
      assert.equal(reason(`${marker} ${title}`, { track: 'marine-local' }), null, `${marker} ${title}`);
    }
  }
  assert.equal(reason('Marine Painters', { track: 'marine-local' }), 'not-marine');
  assert.equal(reason('Event Installer'), null);
  assert.equal(classifyTrack(job('Console OR Interior Installer/Rigger', { trackHint: 'marine-chs' })), 'marine-chs');
});

test('explicit hourly snippet pay fills only blank structured pay and tips cannot raise the base', () => {
  for (const snippet of ['$12–$13/hr plus tips', '$8-$11 per hour', 'Pay Rate: $12.00 - $13.00 per hour plus cash tips', 'Pay Rate: 12-13 per hour']) {
    assert.equal(reason('Valet', { snippet }), 'pay-too-low', snippet);
  }
  assert.equal(reason('Valet', { snippet: '$13/hr plus $25 tips' }), 'pay-too-low');
  assert.equal(reason('Valet', { snippet: 'Earn $30/hr including tips. Pay Rate: $8-$11 per hour plus tips' }), 'pay-too-low');
  assert.equal(reason('Valet', { snippet: 'Tips: $25/hr. Base pay $13 an hour.' }), 'pay-too-low');
  assert.equal(reason('Sales Associate', { snippet: 'Tips: $30/hr' }), 'generic-retail');
  assert.equal(reason('Valet', { snippet: '$15–$22/hr plus cash tips' }), null);
  assert.equal(reason('Valet', { pay: '$20/hr', snippet: '$12–$13/hr in old listing' }), null);
  assert.equal(parsePay('', '$12–$13/hr').hourlyMax, 13);
  const [kept] = buildFeed([], [job('Valet', { url: 'https://pay.test/job', snippet: '$18/hr plus tips' })], { nowIso });
  assert.equal(kept.pay, '$18/hr');
});

test('plural sales associates and direct apparel/store ambassadors use the retail pay exception', () => {
  for (const [title, company] of [['Sales Associates', 'Smoke House'], ['Brand Ambassador', 'Ralph Lauren'], ['Seasonal Brand Ambassador', "Macy's"]]) {
    assert.equal(reason(title, { company }), 'generic-retail');
    assert.equal(reason(title, { company, pay: '$15/hr' }), null);
    assert.equal(reason(title, { company, snippet: '$16 per hour' }), null);
  }
  assert.equal(reason('Brand Ambassador', { company: '2020 Companies' }), null);
  assert.equal(reason('Retail Sales Associate', { company: 'Best Buy' }), null);
});

test('licensed real estate, insurance sales, makeup and food service are other careers', () => {
  for (const title of ['Licensed Real Estate Sales Agent', 'Insurance Producer', 'Insurance Agent', 'Beauty Advisor']) assert.equal(reason(title), 'off-track');
  for (const snippet of ['Sell supplemental insurance', 'No prior insurance experience needed', 'You will be selling insurance']) assert.equal(reason('Sales Representative', { snippet }), 'off-track');
  assert.equal(reason('Brand Expert', { snippet: 'Exceptional makeup artistry' }), 'off-track');
  for (const snippet of ['Food service experience required', 'Food Service & Customer Service experience required', 'Serving food to customers']) assert.equal(reason('Customer Ambassador', { snippet }), 'off-track');
  for (const title of ['Sales Development Representative, Hospital Solutions', 'Business Development Representative - Healthcare']) assert.equal(reason(title, { track: 'tech-sales', snippet: 'Benefits include health and supplemental insurance' }), null);
});

test('RemoteHive reposts and onrender farms are junk, including long placeholder descriptions', () => {
  assert.equal(reason('Sales Development Representative', { company: 'RemoteHive' }), 'junk-listing');
  assert.equal(reason('Sales Development Representative', { url: 'https://frontendnode-25b1.onrender.com/job/123' }), 'junk-listing');
  assert.equal(reason('Sales Development Representative', { snippet: `${'Intro '.repeat(80)}reputed company` }), 'junk-listing');
  assert.equal(reason('Sales Development Representative', { url: 'https://employer.onrender.com/jobs/123' }), null);
});

test('grade headings do not waive must-hold marine licences, but obtain-later and preferred survive', () => {
  for (const snippet of ['For the XF-10 grade level: Must possess a current MMC and Master licence.', 'Must possess a current operators license issued by the U.S. Coast Guard.', 'A USCG master license is required.', 'Must hold a motorboat operator licence.']) {
    assert.ok(needsCredentialHeLacks({ snippet }), snippet);
    assert.equal(reason('Small Craft Operator', { track: 'marine-national', pay: '$35/hr', location: 'Florida', snippet }), 'needs-licence');
  }
  for (const snippet of ['Must obtain an MMC within 6 months.', 'USCG master licence preferred.', 'Will train; must obtain motorboat operator license.', 'For XF-10: MMC preferred.', 'No USCG licence required.', 'A USCG master licence is not required.']) assert.equal(needsCredentialHeLacks({ snippet }), false, snippet);
  assert.equal(reason('Deckhand', { track: 'marine-national', location: 'Washington', pay: '$28.79/hr', snippet: 'Must obtain a motorboat operator licence within 6 months.' }), null);
});

test('commuting-area residency gates apply outside the home region regardless of pay', () => {
  for (const snippet of ['To be considered, applicant must reside in the commuting area (100-mile radius) of Eglin AFB.', 'Applicants must live within 50 miles of the base.']) {
    assert.equal(reason('Deckhand', { track: 'marine-national', location: 'Eglin AFB, FL', pay: '$40/hr', snippet }), 'residency');
    assert.equal(reason('Deckhand', { track: 'marine-local', snippet }), null);
  }
  assert.equal(reason('Deckhand', { track: 'marine-national', location: 'Florida', snippet: 'Relocation available; living nearby is preferred.' }), null);
});

test('sales experience and required degrees gate every sales track without preferred or licence tenure', () => {
  for (const track of ['quick-cash', 'tech-sales']) {
    for (const snippet of ['Minimum of 2+ years of proven successful sales experience', 'At least 3 years of sales background is requested', 'Minimum of three (3) years of proven sales experience', 'Minimum of (3) years of sales experience', 'Minimum of 2 years of sales experience, valid driver’s license preferred', "Qualifications Required: Bachelor's degree", 'Qualifications Required: Bachelor’s degree', 'Qualifications Required:\n• Strong communication skills\n• Bachelor’s degree']) assert.equal(reason('Sales Representative', { track, snippet }), 'senior', snippet);
    for (const snippet of ['3 years of sales experience preferred', "Must have 2 years of driver's licence tenure", 'Two years driving experience preferred', '3 years of driving experience required', 'Qualifications Required: Bachelor’s degree or equivalent experience', 'Qualifications Preferred: Bachelor’s degree', 'One year of customer-facing experience required.']) assert.equal(reason('Sales Representative', { track, snippet }), null, snippet);
  }
  assert.equal(requiredYears('Minimum of (3) years of sales experience'), 3);
});

test('tracker matches normalized URLs and company/role even when repost ids differ', () => {
  const trackedJobs = [{ id: 'tracked', role: 'Lead Brand Ambassador - In-Store Sampling (Part-Time, Weekends)', company: 'Everyday Dose Inc.', link: 'https://apply.workable.com/everyday/j/123/' }];
  const repost = job(trackedJobs[0].role, { company: trackedJobs[0].company, url: 'https://adzuna.com/details/456' });
  assert.equal(dropReason(repost, { trackedJobs }), 'tracked');
  assert.equal(dropReason(job('New title', { url: `${trackedJobs[0].link}?utm_source=abc#top` }), { trackedJobs }), 'tracked');
  assert.equal(dropReason(job('Brand Ambassador', { company: 'Another Company' }), { trackedJobs }), null);
  const a = job('Field Sales Representative', { company: 'TTI' }), b = job('Field Sales Representative', { company: 'Techtronic Industries North America, Inc.', id: 'b' });
  assert.equal(roleKey(a), roleKey(b));
  assert.equal(applyFilters([a, b]).length, 1);
  assert.equal(dropReason(a, { trackedJobs: [{ company: b.company, role: b.title }] }), 'tracked');
  assert.equal(applyFilters([job('Field Sales Representative - Myrtle Beach, SC', { company: 'TTI' }), job('Field Sales Representative - North Myrtle Beach, SC', { company: b.company })]).length, 2);
});

test('McClellanville is in the home region and the Charleston marine track', () => {
  assert.ok(inHomeRegion('McClellanville, SC'));
  assert.equal(inHomeRegion('McClellanville, FL'), false);
  assert.equal(classifyTrack(job('Marine Construction Crew Member', { location: 'McClellanville, SC', trackHint: 'marine-national' })), 'marine-chs');
});

test('retail, field sales, telecom, tech brands and full-time ambassadors override stale hints', () => {
  for (const [title, company] of [['Retail Sales Associate', "DICK'S Sporting Goods"], ['Retail Sales Associate', 'Journeys'], ['Retail Paint Sales Associate', 'Sherwin Williams'], ['Retail Customer Account & Sales Representative', 'Rent A Center'], ['Seasonal Brand Ambassador', 'Ralph Lauren']]) assert.equal(classifyTrack(job(title, { company, trackHint: 'tech-sales' })), 'quick-cash');
  for (const [title, company, snippet] of [['Field Sales and Marketing Representative', 'TTI', ''], ['Xfinity Retail Sales Consultant', 'Comcast', ''], ['Chromebook Sales Specialist', '2020 Companies', 'Full time'], ['Brand Ambassador', 'Service Pros', 'Full-Time'], ['Brand Ambassador', 'Staffing Co', 'Full-time. Host event marketing programmes on weekends.']]) assert.equal(classifyTrack(job(title, { company, snippet, trackHint: 'quick-cash' })), 'tech-sales');
  for (const [title, snippet] of [['HP Retail Sales Representative', 'Part time'], ['Product Demonstrator', 'Full time'], ['Retail Display Installer - Technology', 'Part time'], ['Field Sales / Brand Ambassador', 'Part-time'], ['Brand Ambassador - Weekend Demo', '']]) assert.equal(classifyTrack(job(title, { company: '2020 Companies', snippet, trackHint: 'tech-sales' })), 'quick-cash');
});

test('stored and incoming jobs are classified before experience and distance gates', () => {
  const raw = job('Chromebook Sales Specialist', { trackHint: 'quick-cash', company: '2020 Companies', snippet: 'Full time. Minimum of 2 years of sales experience.', url: 'https://tech.test/job' });
  assert.deepEqual(buildFeed([], [raw], { nowIso }), []);
  assert.deepEqual(buildFeed([{ ...raw, id: 'old', trackHint: undefined, track: 'quick-cash', firstSeenAt: nowIso }], [], { nowIso }), []);
  const [retail] = buildFeed([job('Retail Sales Associate', { company: 'Journeys', track: 'tech-sales', pay: '$18/hr', firstSeenAt: nowIso })], [], { nowIso });
  assert.equal(retail.track, 'quick-cash');
});

test('the three scheduled UTC runs have different JSearch rotation slots', () => {
  assert.deepEqual([11, 17, 23].map(hour => dailyRunSlot(new Date(`2026-10-24T${hour}:15:00Z`))), [0, 1, 2]);
});

test('ntfy aborts on timeout and the caller can keep a successful feed result', async () => {
  const result = { jobs: [job('Valet')] };
  const fetchImpl = async (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  let error;
  try { await sendAlert(result.jobs, { topic: 'test', fetchImpl, timeoutMs: 5 }); } catch (e) { error = e; }
  assert.match(error.message, /ntfy timeout/);
  assert.equal(result.jobs.length, 1);
});

test('workflow uses Node 24 and the package supports Node 22 or newer', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/feed.yml', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.match(workflow, /node-version: '24'/);
  assert.equal(pkg.engines.node, '>=22');
});
