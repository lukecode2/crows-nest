import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropReason, applyFilters } from '../../scripts/lib/filter.mjs';
import { hasHousing, inHomeRegion, inCharlestonBand } from '../../scripts/lib/region.mjs';
import { scoreJob } from '../../scripts/lib/score.mjs';
import { hotJobs } from '../../scripts/lib/alert.mjs';
const job = extra => ({ id: 'new', title: 'Valet', company: 'Employer', location: 'Myrtle Beach, SC', track: 'quick-cash', snippet: '', pay: '', ...extra });

test('all distance tiers use the same inclusive pay and housing rules on every track', () => {
  for (const [track, title] of [['marine-local', 'Dockhand'], ['quick-cash', 'Valet'], ['tech-sales', 'Sales Development Representative'], ['ai-web', 'AI Trainer']]) {
    for (const location of ['Horry County, SC', 'Georgetown County, SC', 'Marion County, SC', 'Brunswick County, NC', 'Columbus County, NC']) assert.equal(dropReason(job({ track, title, location })), null, location);
    for (const location of ['Charleston County, SC', 'Berkeley County, SC', 'Dorchester County, SC', 'Colleton County, SC', 'Florence County, SC', 'Williamsburg County, SC', 'Wilmington, NC', 'New Hanover County, NC', 'Pender County, NC']) {
      for (const pay of ['', '$19.99/hr', '$41,599/year']) assert.equal(dropReason(job({ track, title, location, pay })), 'band-low-pay', `${title}: ${location} ${pay}`);
      for (const pay of ['$20/hr', '$18–$20/hr', '$41,600/year']) assert.equal(dropReason(job({ track, title, location, pay })), null, location);
      assert.equal(dropReason(job({ track, title, location, snippet: 'Staff housing provided.' })), null);
    }
    for (const location of ['Miami, FL', 'Chicago, IL', 'Charleston, WV', 'Wilmington, DE']) {
      assert.ok(dropReason(job({ track, title, location, pay: '$100/hr' })), location);
      assert.equal(dropReason(job({ track, title, location, snippet: 'Room and board included.' })), null, location);
    }
    assert.equal(dropReason(job({ track, title, location: 'Remote — USA', remote: true })), null);
    assert.equal(dropReason(job({ track, title, location: 'Remote — Canada', remote: true })), 'remote-abroad');
  }
  assert.equal(dropReason(job({ title: 'Deckhand', track: 'marine-national', location: 'Miami, FL' })), null);
  assert.equal(dropReason(job({ title: 'Crew Member', track: 'marine-national', location: 'Miami, FL' })), 'not-marine');
  assert.equal(inHomeRegion('Conway, AR'), false);
  assert.equal(inCharlestonBand('Charleston, WV'), false);
});

test('housing is affirmative lodging, survives snippet truncation and boosts the score', () => {
  for (const snippet of ['Housing provided', 'Staff housing', 'Room and board', 'Live-in position', 'Crew quarters', 'Accommodation included', 'Live aboard', 'No experience needed, housing provided']) {
    const j = job({ snippet, location: 'Miami, FL' });
    assert.ok(hasHousing(j), snippet);
    const [kept] = applyFilters([{ ...j, ...scoreJob(j) }]);
    assert.ok(kept.flags.includes('housing'), snippet);
    assert.ok(kept.score > scoreJob(job({ location: 'Miami, FL' })).score);
    assert.ok(scoreJob({ ...kept, snippet: 'Short saved introduction' }).flags.includes('housing'));
  }
  for (const snippet of ['Housing not provided', 'No staff housing', 'Housing is not included', 'Find your own housing', 'Must live in Charleston', 'Nearby lodging available', 'Relocation assistance', 'Reasonable accommodation provided for disabilities']) assert.equal(hasHousing(job({ snippet })), false, snippet);
});

test('retail is blocked at any pay on all tracks; in-store brand and promo roles survive', () => {
  for (const title of ['Sales Associate', 'Cashier', 'Stocker', 'Merchandiser', 'Merchandising Specialist', 'Store Team Member', 'Keyholder', 'Wireless Specialist']) {
    for (const track of ['marine-local', 'tech-sales', 'quick-cash', 'ai-web']) assert.equal(dropReason(job({ title, track, pay: '$100/hr', company: 'Best Buy' })), 'generic-retail', `${title}: ${track}`);
  }
  for (const [title, company] of [['Brand Ambassador (Sales Associate)', 'Ralph Lauren'], ['Brand Representative', 'Abercrombie & Fitch'], ['Product Demonstrator in Costco', 'Advantage Solutions'], ['In-Store Sales Lead Generator', 'ARS'], ['Event Marketing Representative', 'Employer'], ['HP Retail Sales Representative', '2020 Companies']]) assert.equal(dropReason(job({ title, company, pay: '$20/hr' })), null, title);
});

test('alerts use the actual location instead of trusting the marine track label', () => {
  const old = [{ id: 'old' }];
  for (const location of ['Charleston, SC', 'Florence, SC', 'Wilmington, NC', 'Pender County, NC']) {
    assert.deepEqual(hotJobs(old, [job({ location, track: 'marine-local' })]), []);
    assert.equal(hotJobs(old, [job({ location, pay: '$20/hr' })]).length, 1);
    assert.equal(hotJobs(old, [job({ location, pay: '$18/hr' })]).length, 0);
    assert.equal(hotJobs(old, [job({ location, snippet: 'Housing provided' })]).length, 1);
    assert.equal(hotJobs(old, [job({ location, title: 'Deckhand', track: 'marine-national' })]).length, 0);
  }
  assert.equal(hotJobs(old, [job({ location: 'Mullins, Marion County', pay: '$18/hr' })]).length, 1);
  assert.equal(hotJobs(old, [job({ location: 'Miami, FL', track: 'marine-local', pay: '$100/hr' })]).length, 0);
});
