import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, isSenior, isMarineTitle } from '../../scripts/lib/filter.mjs';
import { inHomeRegion, parsePay, isHighPay, isLiveAboard, lowWageShore } from '../../scripts/lib/region.mjs';
import { buildFeed, buildCatchLog } from '../../scripts/fetch-feed.mjs';
const job = (title, extra = {}) => ({ id: title, title, company: 'Boats', location: 'Myrtle Beach, SC', track: 'marine-local', pay: '', flags: [], ...extra });
const options = { nowIso: '2026-10-15T12:00:00Z' };

test('marine title gate rejects every unrelated example and bounds keywords', () => {
  for (const title of ['Physician Emergency Medicine - Competitive Salary', 'Banquet Captain - The Sanctuary (Part-Time)', 'Architectural Job Captain-Charleston', 'Universal Banker Part Time 20 hrs Mathis Ferry', 'Equipment Operator II - Bees Ferry Landfill', 'CATERING SENIOR CAPTAIN (ON CALL)', 'Boat Nurse', 'Yacht Surgeon', 'Marine Architect', 'Captain', 'Automate estimates', 'Membership Representative']) {
    assert.equal(isMarineTitle(title), false, title);
    for (const track of ['marine-local', 'marine-chs', 'marine-national']) assert.equal(applyFilters([job(title, { track })]).length, 0, title);
  }
  for (const title of ['Deckhand – Inland Barge Fleet Hour Shifts', 'Captain - Marine | $5k SIGN ON BONUS', 'VV - DECKHAND; OS/AB', 'Boat Captain', 'Dock Hand', 'Yacht Stewardess', 'Oiler-Deckhand (DR)', 'Deck Crew', 'Boats', 'Boating', 'Maritime', 'Mariner', 'Ferry', 'Tugboat', 'Shipyard', 'Sailing', 'Sailor', 'Charter', 'Harbour', 'AB', 'OS', 'Wiper', 'Stew', 'Day Worker', 'Ocean Rescue', 'Lifeguard']) assert.equal(isMarineTitle(title), true, title);
});
test('all-track seniority, assistant exception, technical plurals and roman levels', () => {
  for (const track of ['marine-local', 'marine-chs', 'marine-national', 'quick-cash', 'tech-sales', 'ai-web']) {
    for (const title of ['VP, Yacht Charters', 'Yacht Closing Manager', 'Marina General Manager (Aventura)', 'Head of Crew Placement', 'Yacht Safety Manager', 'Marina Admin Manager - Charleston Harbor', 'Vice President', 'Chief Steward', 'Owner', 'Partner', 'President', 'Directors Manager', 'Sales Managers']) assert.equal(isSenior(job(title, { track })), true, `${track}: ${title}`);
    assert.equal(isSenior(job('Assistant Marina Manager', { track })), false);
  }
  assert.equal(isSenior(job('Lead Deckhand')), false);
  for (const track of ['ai-web', 'tech-sales']) {
    for (const title of ['Applied AI Engineers for telecommunications company', 'Salesforce Developer III', 'Developer II', 'Developer IV']) assert.equal(isSenior(job(title, { track })), true, title);
    for (const title of ['AI Trainer', 'Web Developer (Fresh graduate welcome, WFH policy)', 'Junior Engineers', 'Entry-level Engineer', 'Associate Engineer', 'Engineer Intern', 'Apprentice Engineer', 'Trainee Engineer', 'Engineer Trainer']) assert.equal(isSenior(job(title, { track })), false, title);
  }
});
test('home region supports cities, county formats and full state names without same-name distant cities', () => {
  const cities = 'Myrtle Beach|North Myrtle Beach|Conway|Carolina Forest|Surfside|Garden City|Murrells Inlet|Pawleys Island|Georgetown|Little River|Loris|Aynor|Charleston|North Charleston|Mount Pleasant|Summerville|James Island|Johns Island|Daniel Island|Isle of Palms|Folly Beach|Kiawah|Goose Creek|Moncks Corner|Hanahan|Ladson'.split('|');
  for (const city of cities) assert.equal(inHomeRegion(`${city}, South Carolina`), true, city);
  for (const city of ['Wilmington', 'Shallotte', 'Calabash', 'Southport', 'Leland', 'Whiteville', 'Tabor City']) assert.equal(inHomeRegion(`${city}, North Carolina`), true, city);
  for (const county of ['Horry', 'Georgetown', 'Charleston', 'Berkeley', 'Dorchester', 'Colleton', 'Williamsburg', 'Marion', 'Florence']) assert.equal(inHomeRegion(`${county} County, SC`), true, county);
  for (const county of ['Brunswick', 'Columbus', 'New Hanover', 'Pender']) assert.equal(inHomeRegion(`${county} County, NC`), true, county);
  for (const location of ['Remote', 'Carolina Forest, Horry County', 'Wilmington, North Carolina', 'Charleston, South Carolina']) assert.equal(inHomeRegion(location), true);
  for (const location of ['Lighthouse Point, FL', 'Portland, Oregon', 'Wilmington, Delaware', 'Charleston, WV', 'Conway, AR', 'Florence County, Wisconsin', '', 'United States']) assert.equal(inHomeRegion(location), false, location);
});
test('pay parsing converts hourly and annual maximums and applies inclusive thresholds', () => {
  for (const [pay, hourlyMax, annualMax] of [['$28.86–$33.62/Per Hour', 33.62, 33.62 * 2080], ['$40,000–$55,000/year', 55000 / 2080, 55000], ['$18–$25/hour', 25, 52000], ['$13/hr', 13, 27040], ['$55,602–$72,285/Per Year', 72285 / 2080, 72285]]) assert.deepEqual(parsePay(pay), { hourlyMax, annualMax });
  for (const pay of ['', 'Competitive', '$150/day']) assert.equal(parsePay(pay), null);
  for (const pay of ['$24/hr', '$50,000/year', '$18–$25/hour']) assert.equal(isHighPay(pay), true);
  for (const pay of ['$23.99/hr', '$49,000/year', '', 'Competitive']) assert.equal(isHighPay(pay), false);
});
test('live aboard signals and shore exclusions, including SDR and BDR', () => {
  for (const title of ['Deck Hand', 'AB', 'OS', 'Able Seaman', 'Ordinary Seaman', 'Wiper', 'Oiler', 'Mate', 'Yacht crew', 'Stewardess', 'Tug crew', 'Barge crew', 'Offshore crew', 'Vessel crew', 'Ship crew', 'Mariner', 'Seaman', 'Delivery crew', 'Day Worker', 'Crew Member']) assert.equal(isLiveAboard(title), true, title);
  for (const title of ['Dock Hand', 'Deckhand Fueler', 'Deckhand Boatcierge', 'Boating Instructor', 'Vessel Technician', 'Vessel Mechanic', 'Yacht Sales', 'Freedom Boat Club Deckhand', 'Ship Dealership', 'Yacht Service Writer', 'Vessel Valet', 'Vessel Front Desk', 'Vessel Call Center']) assert.equal(isLiveAboard(title), false, title);
  for (const title of ['Dockhand', 'Fueler', 'Boatcierge', 'Attendant', 'Associate', 'Cashier', 'Valet', 'Cleaner', 'Porter', 'Detailer', 'Instructor', 'Host', 'Server', 'Clerk', 'Merchandiser', 'Ambassador', 'Technician', 'Sales Development Representative', 'Business Development Rep', 'SDR', 'BDR', 'Retail']) assert.equal(lowWageShore(title), true, title);
});
test('distance rule drops far shore work and preserves local work, live aboard and high pay with flags', () => {
  for (const [title, location] of [['Freedom Boat Club - Dock Hand at Lighthouse Point', 'Lighthouse Point, FL'], ['Freedom Boat Club - Part-Time Boat Fueler at Venice', 'Venice, FL'], ['Freedom Boat Club - Boating Instructor at Bald Ridge', 'Cumming, GA'], ['Freedom Boat Club - Part-Time Boatcierge at Marco', 'Marco Island, FL']]) assert.equal(applyFilters([job(title, { location })]).length, 0, title);
  for (const [title, location, pay, flag] of [['Deckhand – Inland Barge Fleet', 'Illinois', '', 'live-aboard'], ['Deckhand (Dual Rate)', 'Portland, Oregon', '$30.14–$46.16/hr', 'high-pay'], ['Yacht Deckhand', 'Fort Lauderdale, FL', '', 'live-aboard'], ['Dockhand', 'Miami, FL', '$24/hr', 'high-pay']]) {
    const [kept] = applyFilters([job(title, { location, pay })]);
    assert.ok(kept, title); assert.equal(kept.track, 'marine-national'); assert.ok(kept.flags.includes('far-away')); assert.ok(kept.flags.includes(flag));
  }
  assert.equal(applyFilters([job('Freedom Boat Club - Dock Hand')]).length, 1);
  assert.equal(applyFilters([job('Marina Receptionist', { location: 'Miami, FL', pay: '' })]).length, 0); // far shore marina job, no pay: Luke only moves for boat or high-pay work
  assert.equal(applyFilters([job('Marina Receptionist', { location: 'Miami, FL', pay: '$18/hr' })]).length, 0);
  assert.equal(applyFilters([job('Valet', { track: 'quick-cash', location: 'Miami, FL', pay: '$100/hr' })]).length, 0);
  for (const track of ['tech-sales', 'ai-web']) {
    assert.equal(applyFilters([job('Sales Development Representative', { track, location: 'Mundelein, Lake County' })]).length, 0);
    assert.equal(applyFilters([job('Web Developer', { track, location: 'Chicago, IL', pay: '$18/hr' })]).length, 0);
    assert.ok(applyFilters([job('Web Developer', { track, location: 'Chicago, IL' })])[0].flags.includes('pay-unknown'));
    assert.ok(applyFilters([job('Web Developer', { track, location: 'Chicago, IL', pay: '$55,000/year' })])[0].flags.includes('high-pay'));
    assert.equal(applyFilters([job('Sales Development Representative', { track, location: 'Remote' })]).length, 1);
    assert.equal(applyFilters([job('Sales Development Representative', { track, remote: true, location: 'Chicago, IL' })]).length, 1);
  }
});
test('duplicates collapse punctuation and location suffixes, keep best then newest, preserve up to ten locations', () => {
  const jobs = ['Myrtle Beach', 'Conway', 'Charleston', 'Wilmington', 'Loris'].map((location, i) => job('AE - Brand Ambassador (Sales Associate)' + (i === 1 ? ' - Conway' : i === 2 ? ' (Charleston)' : i === 3 ? ' at Wilmington' : ''), { id: `${i}`, company: i % 2 ? 'American Eagle!' : 'American Eagle', track: 'tech-sales', location, score: i === 2 || i === 4 ? 90 : 30, postedAt: `2026-10-${10 + i}T00:00:00Z` }));
  const [kept] = applyFilters(jobs);
  assert.equal(applyFilters(jobs).length, 1); assert.equal(kept.id, '4'); assert.equal(kept.location, 'Loris (+4 more)'); assert.equal(kept.otherLocations.length, 4);
  assert.equal(applyFilters([kept])[0].location, kept.location);
  const many = Array.from({ length: 15 }, (_, i) => job('Deckhand', { id: String(i), location: `Port ${i}`, score: i }));
  assert.equal(applyFilters(many)[0].otherLocations.length, 10);
});
test('runner re-filters persisted jobs through every gate and recomputes flags', () => {
  const prev = [job('Physician Emergency Medicine', { id: 'not-marine' }), job('Marina Manager', { id: 'senior' }), job('Dockhand', { id: 'far', location: 'Miami, FL' }), job('Valet', { id: 'cash', track: 'quick-cash', location: 'Miami, FL' }), job('SDR', { id: 'sales', track: 'tech-sales', location: 'Chicago, IL' }), job('Deckhand', { id: 'cruise', company: 'CruiseCo' }), job('Yacht Crew', { id: 'dismissed' }), job('Dock Hand', { id: 'tracked' }), job('Boat Cleaner', { id: 'keyword' }), job('Yacht Deckhand', { id: 'keep', location: 'Fort Lauderdale, FL', flags: [] })].map(j => ({ ...j, firstSeenAt: '2026-10-14T00:00:00Z', score: 10 }));
  const jobs = buildFeed(prev, [], { ...options, filters: { excludeCompanies: ['CruiseCo'], excludeKeywords: ['Cleaner'] }, dismissed: { items: [{ id: 'dismissed' }] }, trackedIds: new Set(['tracked']) });
  assert.deepEqual(jobs.map(j => j.id), ['keep']); assert.ok(jobs[0].flags.includes('live-aboard'));
});
test('catch log records every filter reason, final duplicate choice, short snippets and cap by newest', () => {
  const prev = [job('Dockhand', { id: 'far', location: 'Miami, FL', firstSeenAt: '2026-10-14T00:00:00Z' })];
  const raw = [job('Deckhand', { url: 'https://a/1', snippet: 'x'.repeat(400) }), job('Deckhand', { url: 'https://a/2', pay: '$25/hr' }), job('Marina Manager', { url: 'https://a/3' })];
  const jobs = buildFeed(prev, raw, options);
  const log = buildCatchLog(prev, raw, jobs, options);
  assert.equal(log.jobs.length, 4);
  assert.equal(log.jobs.filter(j => j.kept).length, 1);
  assert.deepEqual(log.jobs.filter(j => !j.kept).map(j => j.dropReason).sort(), ['duplicate', 'far-shore-job', 'senior']);
  assert.ok(log.jobs.every(j => j.snippet.length <= 160));
  assert.ok(log.jobs.filter(j => j.kept).every(j => j.dropReason === null));
  const big = Array.from({ length: 2505 }, (_, i) => job(`Boat ${i}`, { id: String(i), postedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() }));
  const capped = buildCatchLog(big, [], [], options);
  assert.equal(capped.jobs.length, 2500); assert.equal(capped.jobs[0].id, '2504');
});

test('expired high-scoring copies do not hide fresh duplicate roles; audit distinguishes cap from duplicates', () => {
  const prev = [job('Deckhand', { id: 'expired', score: 100, firstSeenAt: '2026-08-01T00:00:00Z', pay: '$25/hr' })];
  const fresh = [job('Deckhand', { url: 'https://fresh/job', firstSeenAt: options.nowIso })];
  assert.equal(buildFeed(prev, fresh, options).length, 1);
  const many = Array.from({ length: 602 }, (_, i) => job(`Boat role ${i}`, { url: `https://jobs/${i}` }));
  const kept = buildFeed([], many, options);
  const log = buildCatchLog([], many, kept, options);
  assert.equal(kept.length, 600); assert.equal(log.jobs.filter(j => j.kept).length, 600);
  assert.ok(log.jobs.filter(j => !j.kept).every(j => j.dropReason === null));
});
test('catch log covers all gates with the exact reason vocabulary', () => {
  const raw = [job('Deckhand', { company: 'Cruise Co', url: 'https://r/1' }), job('Yacht Manager', { url: 'https://r/2' }), job('Physician', { url: 'https://r/3' }), job('Dockhand', { location: 'Miami, FL', url: 'https://r/4' }), job('Valet', { trackHint: 'quick-cash', location: 'Miami, FL', url: 'https://r/5' }), job('SDR', { trackHint: 'tech-sales', location: 'Chicago, IL', url: 'https://r/6' }), job('Yacht Crew', { url: 'https://r/7' }), job('Boat Crew', { url: 'https://r/8' }), job('Boat Cleaner', { url: 'https://r/9' })].map(j => ({ ...j, trackHint: j.trackHint || j.track }));
  const settings = { ...options, filters: { excludeCompanies: ['Cruise Co'], excludeKeywords: ['Cleaner'] }, dismissed: { items: [{ url: 'https://r/7' }] } };
  const initial = buildCatchLog([], raw, [], settings);
  settings.trackedIds = new Set([initial.jobs.find(j => j.title === 'Boat Crew').id]);
  const log = buildCatchLog([], raw, buildFeed([], raw, settings), settings);
  assert.deepEqual(log.jobs.map(j => j.dropReason), ['cruise', 'senior', 'not-marine', 'far-shore-job', 'far-quick-cash', 'far-low-pay', 'dismissed', 'tracked', 'excluded-keyword']);
});
test('shore technicians exclude senior technicians from the low-wage assumption', () => {
  assert.equal(lowWageShore('Marine Technician'), true);
  assert.equal(lowWageShore('Senior Marine Technician'), false);
});
test('pay and live-aboard flags are shown for local qualifying jobs too', () => {
  const [kept] = applyFilters([job('Deckhand', { pay: '$25/hr' })]);
  assert.ok(kept.flags.includes('live-aboard')); assert.ok(kept.flags.includes('high-pay'));
  assert.ok(!kept.flags.includes('far-away'));
});
test('bare annual amounts from persisted feeds retain high-pay eligibility', () => {
  assert.deepEqual(parsePay('$55,000'), { hourlyMax: 55000 / 2080, annualMax: 55000 });
  for (const pay of ['$1000/day', '$2000/week', '$5000/month']) assert.equal(parsePay(pay), null);
});
test('county names shared with distant states need a local city or explicit home state', () => {
  for (const location of ['Indianapolis, Marion County', 'Cambridge, Dorchester County', 'Martinsburg, Berkeley County']) assert.equal(inHomeRegion(location), false, location);
  for (const location of ['Marion County', 'Florence, Florence County', 'Mullins, Marion County', 'Lake City, Florence County', 'Ladson, Dorchester County', 'Any town, Berkeley County, South Carolina']) assert.equal(inHomeRegion(location), true, location);
});

test('round 3: senior on all tracks, language gigs, far club listings, predicted Adzuna pay', async () => {
  const { isSenior, needsOtherLanguage } = await import('../../scripts/lib/filter.mjs');
  const { lowWageShore } = await import('../../scripts/lib/region.mjs');
  assert.equal(isSenior({ title: 'Senior Marine Electronics Tech (Fort Lauderdale)', track: 'marine-national' }), true);
  assert.equal(isSenior({ title: 'AE - Sr Brand Ambassador (Sr Sales Associate)', track: 'quick-cash' }), true);
  assert.equal(isSenior({ title: 'Lead Deckhand', track: 'marine-local' }), false);
  assert.equal(needsOtherLanguage('Artemis AI Data Rater - German'), true);
  assert.equal(needsOtherLanguage('AI Trainer'), false);
  assert.equal(lowWageShore('Freedom Boat Club Greater Boston and Cape Cod Jobs'), true);
  const adzuna = await import('../../scripts/sources/adzuna.mjs');
  const jobs = await adzuna.fetchJobs({ env: { ADZUNA_APP_ID: 'a', ADZUNA_APP_KEY: 'b' }, searches: { adzuna: [{ what: 'x', where: 'y', track: 'quick-cash' }] }, log: () => {},
    http: { getJson: async () => ({ results: [
      { title: 'Event Staff', company: { display_name: 'A' }, location: { display_name: 'Myrtle Beach' }, redirect_url: 'https://a/1', salary_min: 65370, salary_max: 65370, salary_is_predicted: '1' },
      { title: 'Valet', company: { display_name: 'B' }, location: { display_name: 'Myrtle Beach' }, redirect_url: 'https://a/2', salary_min: 15, salary_max: 18, salary_is_predicted: '0' }] }) } });
  assert.equal(jobs[0].pay, '');
  assert.notEqual(jobs[1].pay, '');
});

test('a re-fetched job replaces its stored copy (stale predicted pay cannot survive)', () => {
  const nowIso = '2026-10-15T22:00:00.000Z';
  const raw = { title: 'Host, Olive and Sea - Hilton Fort Lauderdale Marina', company: 'Hilton', location: 'Sunrise, Broward County', url: 'https://example.com/host', pay: '', source: 'adzuna', trackHint: 'marine-national', snippet: '' };
  const first = buildFeed([], [{ ...raw, pay: '$57,198.54/year' }], { nowIso, filters: {}, dismissed: { items: [] }, trackedIds: new Set() });
  assert.equal(first.length, 1);
  const second = buildFeed(first, [raw], { nowIso, filters: {}, dismissed: { items: [] }, trackedIds: new Set() });
  assert.equal(second.length, 0);
});

test('hotel restaurant steward is not a live-aboard job', () => {
  assert.equal(isLiveAboard('Steward, Olive & Sea - Hilton Fort Lauderdale Marina'), false);
  assert.equal(isLiveAboard('Yacht Stewardess'), true);
});
