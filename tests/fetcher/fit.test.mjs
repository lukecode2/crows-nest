// Every example here is a real listing from the 2026-10-16 review (kept wrongly, or rejected wrongly).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropReason, requiredYears } from '../../scripts/lib/filter.mjs';
import { remoteAbroad } from '../../scripts/lib/region.mjs';
import { needsCredentialHeLacks } from '../../scripts/lib/fit.mjs';
import { scoreJob } from '../../scripts/lib/score.mjs';
import { buildFeed } from '../../scripts/fetch-feed.mjs';
import * as remotive from '../../scripts/sources/remotive.mjs';

const job = (title, extra = {}) => ({ id: title, title, company: 'Co', location: 'Myrtle Beach, Horry County', track: 'quick-cash', pay: '', snippet: '', flags: [], ...extra });
const reason = (title, extra) => dropReason(job(title, extra), { nowIso: '2026-10-16T12:00:00Z' });

test('other careers never reach Quick Cash or Tech Sales', () => {
  for (const title of ['Physician Cardiology - Competitive Salary', 'Dental Hygienist', 'Tax Expert - Local Office', 'CDL-A Truck Driver - Earn Up to $75,000/Year', 'Computed Tomography Technologist – Travel Job',
    'Home Health Physical Therapist', 'Real Estate Agent', 'Armed Vehicle Patrol Security Officer', 'Automotive Service Technician B Level', 'Housekeeping Room Attendant', 'Patient Safety Attendant',
    'Environmental Services Attendant', 'Petcare & Daycare Attendant', 'Personal Trainer (Small Group) Instructor', 'High School Secretary I - Attendance Clerk', 'Charity Fundraising Representative',
    'Beauty Advisor - Part Time', 'Scoop and Slice Attendant', 'Retail Warehouse Associate', '$1.3 Million GI Opportunity', 'Restaurant AGM with Growing Scratch Kitchen Brand!', 'Gate Attendant']) {
    for (const track of ['quick-cash', 'tech-sales']) assert.ok(reason(title, { track }), `${track}: ${title}`);
  }
  for (const title of ['Valet Parking Attendant MUSC', 'Event Staff Team Member', 'Bellperson & Valet', 'Part Time Weekend Product Demonstrator in Costco', 'Light Show Attendant (Temporary)', 'Detailer',
    'Vacation Sales Ambassador', 'Marketing Agent', 'Field Sales and Marketing Representative', 'Chromebook Sales Specialist', 'Retail Display Installer - Technology', 'Part-time Nabisco Merchandiser']) assert.equal(reason(title), null, title);
});

test('store retail only counts at a tech retailer or at $15/hr and up', () => {
  assert.equal(reason('AE - Brand Ambassador (Sales Associate)', { company: 'American Eagle Outfitters' }), 'generic-retail');
  assert.equal(reason('Seasonal Retail Sales Associate', { company: "DICK'S Sporting Goods", track: 'tech-sales' }), 'generic-retail');
  assert.equal(reason('Retail Sales Associate', { company: 'Best Buy', track: 'tech-sales' }), null);
  assert.equal(reason('HP Retail Sales Representative', { company: '2020 Companies' }), null);
  assert.equal(reason('Retail Sales Associate', { company: 'Journeys', pay: '$30,000–$34,000/year', track: 'tech-sales' }), null);
  // Luke dismissed this one as pay-too-low; anything topping out under $15/hr is out.
  assert.equal(reason('Retail Sales Associate (Seasonal)-HWY 17-$13/hr', { company: 'New Balance', pay: '$24,752–$30,888/year', track: 'tech-sales' }), 'generic-retail');
  assert.equal(reason('Box Office Attendant Part Time/Full Time', { pay: '$24,960/year' }), 'pay-too-low');
  assert.equal(reason('Freelance Graphic Designer (Reviewer) - AI Training', { track: 'ai-web', location: 'Remote', remote: true, pay: '$10.5/hourly' }), 'off-track');
});

test('closing roles need a track record; entry SDRs do not', () => {
  for (const title of ['Enterprise Account Executive - TMT', 'Services Account Executive', 'Account Executive, Corporate', 'Inside Sales - Account Executive']) assert.equal(reason(title, { track: 'tech-sales', location: 'Remote', remote: true }), 'needs-experience', title);
  assert.equal(reason('Associate Account Executive', { track: 'tech-sales', location: 'Remote', remote: true }), null);
  assert.equal(reason('SDR (Sales Development Representative)', { track: 'tech-sales', location: 'Remote — USA', remote: true, snippet: 'Some sales experience preferred.' }), null);
  assert.equal(reason('Marketing and Communications Coordinator', { track: 'tech-sales', snippet: 'Minimum of five years of experience in social media management' }), 'senior');
});

test('requiredYears reads digits, words and ranges but ignores company history', () => {
  for (const [text, years] of [['Requires 5+ years of React', 5], ['Minimum of five years of experience', 5], ['1-3 years of prior sales experience', 1], ['three (3) years of experience', 3], ['for over 40 years of excellence', 0], ['founded 15 years ago', 0]]) assert.equal(requiredYears(text), years, text);
});

test('remote jobs open only to other countries are dropped', () => {
  const abroad = [['Account Executive - France', 'Remote', ''], ['Enterprise Account Executive (Kazakhstan)', 'Remote', ''], ['Account Executive, Small Business - Nordics (English Speaking)', 'Remote', ''],
    ['Sales Development Representative', 'Remote', 'Headquarters: Texas URL: https://kyro.ai Location: Remote, non-US based, working US Central Time'], ['Full Stack Developer', 'Remote', 'Headquarters: Germany (Remote) ; Ireland (Remote)'],
    ['AI Trainer Image QA Evaluator', 'Remote', 'Location: South Korea | Remote Engagement'], ['Web Developer (Fresh graduate welcome)', 'Remote', 'Headquarters: Hong Kong, Hong Kong SAR'], ['SDR', 'Remote — Canada', ''],
    ['Data Rater', 'Remote', 'Must be based in the Philippines'], ['Account Executive II - Riyadh (Saudi National)', 'Remote', '']];
  for (const [title, location, snippet] of abroad) assert.equal(remoteAbroad({ title, location, snippet }), true, title);
  const home = [['(US) Sales Development Representative', 'Remote', ''], ['SDR', 'Remote — USA, Canada, USA timezones', ''], ['SDR', 'Remote — Americas, Europe, Israel', ''], ['SDR', 'Remote', 'Headquarters: San Francisco, CA or Remote, US'], ['SDR', 'Remote', 'We serve customers in Germany and the UK'], ['SDR', 'Remote — New Mexico', '']];
  for (const [title, location, snippet] of home) assert.equal(remoteAbroad({ title, location, snippet }), false, `${title} ${location} ${snippet}`);
  assert.equal(reason('Sales Development Representative', { track: 'tech-sales', remote: true, location: 'Remote — Germany' }), 'remote-abroad');
  assert.equal(reason('Junior Web Developer', { track: 'ai-web', location: 'London, United Kingdom' }), 'abroad');
});

test('remote boards pass their eligibility text through as the location', async () => {
  const ctx = { env: {}, searches: { remote: [{ q: 'sales development' }] }, log: () => {}, http: { getJson: async () => ({ jobs: [{ title: 'Sales Development Representative', candidate_required_location: 'Europe, UK' }, { title: 'Sales Development Representative', candidate_required_location: '' }] }) } };
  const jobs = await remotive.fetchJobs(ctx);
  assert.deepEqual(jobs.map(j => j.location), ['Remote — Europe, UK', 'Remote']);
  assert.equal(remoteAbroad(jobs[0]), true);
});

test('cruise brands, junk aggregators and page-watch articles are dropped', () => {
  assert.equal(reason('VV - DECKHAND; OS/AB', { company: 'Ismira', track: 'marine-national', location: 'Washington, District of Columbia', snippet: 'ISMIRA Agency actively recruiting for position DECKHAND for Virgin Voyages!' }), 'cruise');
  assert.equal(reason('reputed company Customer Success Associate, reputed company', { company: 'remote quest jobs', track: 'ai-web', remote: true, location: 'Remote' }), 'junk-listing');
  assert.equal(reason('Proof and Control Associate', { company: 'WFPro', track: 'ai-web', remote: true }), 'junk-listing');
  for (const [title, url] of [['The Importance of Letting Go as a Yacht Chef', 'https://www.dockwalk.com/crewlife/power-of-letting-go-as-a-chef'], ['Deckhands', 'https://www.dockwalk.com/crewlife/deckhands'], ['The Skills to Have Starting as a Yacht Engineer Today', 'https://www.dockwalk.com/jobs/training/yacht-engineer-skills-you-should-have']])
    assert.equal(reason(title, { source: 'pagewatch', url, track: 'marine-national', location: '' }), 'not-a-job', title);
  assert.equal(reason('Deckhand / Mate - 80ft Sportfish', { source: 'pagewatch', url: 'https://crew.example/jobs/123', track: 'marine-local' }), null);
});

test('marine jobs that need a licence or rating he does not hold are dropped', () => {
  const marine = (title, extra = {}) => reason(title, { track: 'marine-chs', location: 'Charleston, SC', ...extra });
  for (const title of ['Captain - Marine | $5k SIGN ON BONUS', 'Boat Captain', 'MOTOR VESSEL CAPTAIN', 'Marine Surveyor', 'Vessel Pilot', 'Experienced AB Tugboat Deckhand', 'Barge Tankerman']) assert.equal(marine(title), 'needs-licence', title);
  assert.equal(dropReason(job('Boat Captain', { track: 'marine-chs', location: 'Charleston, SC' }), { filters: { profile: { captainLicense: true } } }), null);
  for (const title of ['Boat Captain Trainee', 'Deckhand', 'Lead Dockhand', 'First Mate - Fishing Charter']) assert.equal(marine(title), null, title);
  assert.equal(marine('Deckhand (Dual Rate)', { snippet: 'Minimum Qualifications. You must possess a current United States Coast Guard Merchant Mariner Credential (MMC), Seafarer Unlimited (AB Unlimited) Endorsement or higher AND a current TWIC.' }), 'needs-licence');
  assert.equal(marine('Deckhand – Inland Barge Fleet', { snippet: 'Must have Drivers Licenses and a Valid TWIC card. Must obtain MMC (Merchant Mariner Credential).' }), null);
  assert.equal(needsCredentialHeLacks({ snippet: 'For the XF-10 grade level: Must possess all of the following: (1) a current MMC, (2) Deck Officer-Master of Self-Propelled Vessels.' }), true);
  assert.equal(needsCredentialHeLacks({ snippet: 'Selective Placement Factors: Must possess and maintain an Ordinary Seaman (O/S), Oiler Endorsement and STCW certification.' }), true);
});

test('real boat work with plain titles is rescued; far marina desk jobs are not', () => {
  const national = (title, location, pay = '') => reason(title, { track: 'marine-national', location, pay });
  // Both USACE small craft postings seen (Oct 2026) need a Coast Guard operator licence he doesn't hold yet.
  assert.equal(national('Small Craft Operator', 'Aberdeen, Washington', '$33.36–$40.63/Per Hour'), 'needs-licence');
  assert.equal(national('LOCK AND DAM OPERATOR', 'Multiple Locations', '$23.65–$35.4/Per Hour'), null);
  assert.equal(national('Trades Helper Linehandler (Relief Pool)', 'Massena, New York', '$27.57–$32.85/Per Hour'), null);
  assert.equal(national('Maintenance Worker (DR)', 'Wilmington, North Carolina', '$26.96–$31.41/Per Hour'), null);
  assert.equal(reason('Firefighter Recruit, Georgetown County Fire and EMS', { track: 'marine-local', location: 'Georgetown County, SC' }), null);
  assert.equal(reason('Guest Services Attendant', { company: 'Suntex Marina Investors', track: 'marine-chs', location: 'Mount Pleasant, Charleston County', pay: '$35,360/year' }), null);
  assert.equal(reason('Guest Services Coordinator (Miami)', { company: 'IGY Marinas', track: 'marine-national', location: 'Miami, Miami-Dade County' }), 'not-marine');
  assert.equal(reason('Bartender', { company: 'Suntex Marina Investors', track: 'marine-chs', location: 'Mount Pleasant, Charleston County' }), 'not-marine');
});

test('jobs he could start this week are flagged and ranked up', () => {
  const fast = scoreJob({ title: 'Light Show Attendant (Temporary)', snippet: 'Must be available on nights and weekends', track: 'quick-cash' });
  const slow = scoreJob({ title: 'Light Show Attendant', snippet: 'Year-round role', track: 'quick-cash' });
  assert.ok(fast.flags.includes('starts-fast')); assert.ok(!slow.flags.includes('starts-fast')); assert.ok(fast.score > slow.score);
});

test('closed postings and jobs a full-list source stopped returning disappear', () => {
  const nowIso = '2026-10-16T12:00:00Z';
  const base = { company: 'U.S. Army Corps of Engineers', location: 'Multiple Locations', track: 'marine-national', pay: '$30/hr', firstSeenAt: '2026-10-15T00:00:00Z', score: 50, flags: [] };
  const prev = [{ ...base, id: 'closed', title: 'Lock and Dam Operator', source: 'usajobs', closesAt: '2026-10-15T00:00:00Z' }, { ...base, id: 'gone', title: 'Trades Helper Linehandler', source: 'sweep' }, { ...base, id: 'search', title: 'Deckhand', source: 'adzuna' }];
  const settings = { nowIso, filters: {}, dismissed: { items: [] }, trackedIds: new Set() };
  assert.deepEqual(buildFeed(prev, [], settings).map(j => j.id).sort(), ['gone', 'search']);
  assert.deepEqual(buildFeed(prev, [], { ...settings, refreshed: new Set(['sweep', 'usajobs']) }).map(j => j.id), ['search']);
});

test('link check drops 404/410 and "filled" pages but never bot blocks or errors', async () => {
  const { checkLinks } = await import('../../scripts/lib/linkcheck.mjs');
  const pages = { 'https://x/gone': [410, ''], 'https://x/missing': [404, ''], 'https://x/filled': [200, '<p>Sorry, the job you are trying to apply for has been filled.</p>'], 'https://x/closed': [200, 'This job announcement has closed'],
    'https://x/open': [200, '<h1>Deckhand</h1> Apply now'], 'https://x/blocked': [403, 'Access denied'] };
  const fetchImpl = async url => { if (url === 'https://x/error') throw new Error('timeout'); const [status, body] = pages[url]; return new Response(body, { status }); };
  const jobs = [...Object.keys(pages), 'https://x/error'].map(url => ({ id: url.split('/').pop(), url })).concat({ id: 'recent', url: 'https://x/gone', linkCheckedAt: '2026-10-16T06:00:00Z' });
  const { dead, checked } = await checkLinks(jobs, { nowIso: '2026-10-16T12:00:00Z', fetchImpl });
  assert.deepEqual([...dead].sort(), ['closed', 'filled', 'gone', 'missing']);
  assert.ok(!checked.has('recent') && !checked.has('error') && checked.has('blocked'));
  assert.equal(dropReason({ id: 'gone', title: 'Deckhand', track: 'marine-local', location: 'Myrtle Beach, SC' }, { deadIds: dead }), 'dead-link');
});

test('companies skipped in config give their own reason', () => {
  const filters = { skipCompanies: [{ name: 'Beauty Barrage', reason: 'needs-experience' }] };
  assert.equal(dropReason(job('Brand Market Specialist - Myrtle Beach, SC', { company: 'Beauty Barrage' }), { filters }), 'needs-experience');
});

test('description-level language, commission-only and 2+ year sales requirements', () => {
  assert.equal(reason('Counter Sales Agent', { pay: '$20–$21/hour', snippet: 'Bilingual with English and Spanish required' }), 'language');
  assert.equal(reason('Media Sales Representative', { snippet: 'Model: 100% commission, independent-contractor business' }), 'commission-only');
  assert.equal(reason('Business Development Representative', { track: 'tech-sales', remote: true, location: 'Remote', snippet: '2 - 5+ years of experience in healthcare sales' }), 'senior');
});

test('second-audit gates: ramp captains, store brand reps, consultant trainers, licences by title, excluded jobs', () => {
  assert.equal(reason('Valet Ramp Captain', { company: 'Evolution Parking & Guest Services' }), 'senior');
  assert.equal(reason('Brand Representative - King Street, Abercrombie & Fitch', { company: 'Abercrombie & Fitch', location: 'Charleston, SC' }), 'generic-retail');
  assert.equal(reason('Business Transformation Consultant - AI Trainer', { track: 'ai-web', remote: true, location: 'Remote' }), 'off-track');
  assert.equal(reason('Freedom Boat Club - Boating Instructor at Clemson Marina', { track: 'marine-national', location: 'Seneca, SC', pay: '$30/hr' }), 'needs-licence');
  const filters = { excludeJobs: [{ id: 'x1', reason: 'residency' }] };
  assert.equal(dropReason({ ...job('Resident Ambassador - Charleston, SC'), id: 'x1' }, { filters }), 'residency');
});
