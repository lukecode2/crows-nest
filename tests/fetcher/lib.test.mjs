import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, makeId, cleanText } from '../../scripts/lib/normalize.mjs';
import { classifyTrack } from '../../scripts/lib/classify.mjs';
import { isCruise, isSenior, applyFilters } from '../../scripts/lib/filter.mjs';
import { scoreJob } from '../../scripts/lib/score.mjs';
import { mergeFeed } from '../../scripts/lib/merge.mjs';
import { readFileSync } from 'node:fs';
const filters = JSON.parse(readFileSync(new URL('../../config/filters.json', import.meta.url)));
const J = (o) => ({ title: '', company: '', location: '', remote: false, pay: '', url: '', postedAt: null, snippet: '', source: 't', ...o });

test('normalizeUrl strips tracking and trailing slash', () => {
  assert.equal(normalizeUrl('https://Example.com/job/1/?utm_source=x&id=5#top'), 'https://example.com/job/1?id=5');
});
test('makeId is stable and url-based', () => {
  assert.equal(makeId(J({ url: 'https://a.com/x?utm_medium=y' })), makeId(J({ url: 'https://a.com/x' })));
  assert.match(makeId(J({ company: 'A', title: 'B' })), /^[0-9a-f]{40}$/);
});
test('cleanText strips tags and entities', () => {
  assert.equal(cleanText('<p>Deck&amp;hand <b>wanted</b></p>'), 'Deck&hand wanted');
  assert.equal(cleanText('x'.repeat(300)).length, 240);
});
test('classify: hint wins; location rules', () => {
  assert.equal(classifyTrack(J({ trackHint: 'ai-web', title: 'Deckhand' })), 'ai-web');
  assert.equal(classifyTrack(J({ title: 'Dockhand', location: 'North Myrtle Beach, SC' })), 'marine-local');
  assert.equal(classifyTrack(J({ title: 'Deckhand', location: 'Charleston, SC' })), 'marine-chs');
  assert.equal(classifyTrack(J({ title: 'Deckhand', location: 'Fort Lauderdale, FL' })), 'marine-national');
  assert.equal(classifyTrack(J({ title: 'Valet Attendant', location: 'Myrtle Beach, SC' })), 'quick-cash');
  assert.equal(classifyTrack(J({ title: 'Sales Development Representative', location: 'Remote' })), 'tech-sales');
  assert.equal(classifyTrack(J({ title: 'Brand Ambassador - weekend event', location: 'Charleston, SC' })), 'quick-cash');
  assert.equal(classifyTrack(J({ title: 'Junior WordPress Developer', location: 'Remote' })), 'ai-web');
});
test('cruise filter: blocks cruise lines, allows harbor tours and MSC (Sealift)', () => {
  assert.equal(isCruise(J({ company: 'Royal Caribbean Group', title: 'Deckhand' }), filters), true);
  assert.equal(isCruise(J({ company: 'Acme', title: 'Deck Crew - Cruise Ship' }), filters), true);
  assert.equal(isCruise(J({ company: 'SpiritLine Cruises', title: 'Deckhand' }), filters), false);
  assert.equal(isCruise(J({ company: 'Military Sealift Command', title: 'Ordinary Seaman' }), filters), false);
  assert.equal(isCruise(J({ company: 'MSC Cruises', title: 'Deckhand' }), filters), true);
});
test('senior filter only for ai-web/tech-sales', () => {
  assert.equal(isSenior({ ...J({ title: 'Senior Web Developer' }), track: 'ai-web' }, filters), true);
  assert.equal(isSenior({ ...J({ title: 'Web Developer', snippet: 'Requires 5+ years of React' }), track: 'ai-web' }, filters), true);
  assert.equal(isSenior({ ...J({ title: 'Lead Deckhand' }), track: 'marine-local' }, filters), false);
});
test('ai-web technical titles require entry-level wording in the title', () => {
  for (const title of ['AI Platform Engineer', 'Cloud Architect', 'Data Scientist', 'AI Researcher']) {
    assert.equal(isSenior(J({ title, track: 'ai-web', snippet: 'Junior applicants welcome' }), filters), true, title);
    assert.equal(isSenior(J({ title, track: 'tech-sales' }), filters), false, title);
    assert.equal(isSenior(J({ title, track: 'marine-national' }), filters), false, title);
  }
  for (const title of ['Junior Software Engineer', 'Entry-level Engineer', 'Associate Architect', 'Researcher Intern', 'Apprentice Engineer', 'Trainee Scientist', 'AI Engineer Trainer', 'AI Trainer']) {
    assert.equal(isSenior(J({ title, track: 'ai-web' }), filters), false, title);
  }
  assert.equal(isSenior(J({ title: 'Senior Engineer — Junior Mentor', track: 'ai-web' }), filters), true);
  assert.equal(isSenior(J({ title: 'Junior Engineer', track: 'ai-web', snippet: '5+ years required' }), filters), true);
});
test('applyFilters drops dismissed, company-dismissed, tracked, dupes', () => {
  const mk = (o) => { const j = J(o); return { ...j, id: makeId(j), track: classifyTrack(j) }; };
  const a = mk({ title: 'Deckhand', company: 'A', url: 'https://a.com/1', location: 'Charleston, SC' });
  const b = mk({ title: 'Dockhand', company: 'Bad Co', url: 'https://b.com/2', location: 'Charleston, SC' });
  const c = mk({ title: 'Mate', company: 'C', url: 'https://c.com/3', location: 'Charleston, SC' });
  const d = mk({ title: 'Mate', company: 'C', url: 'https://c.com/3?utm_source=z', location: 'Charleston, SC' });
  const e = mk({ title: 'Valet', company: 'E', url: 'https://e.com/5', location: 'Myrtle Beach, SC' });
  const dismissed = { items: [{ id: a.id, url: a.url, company: 'A', reason: 'too-far' }, { id: 'zz', company: 'bad co', reason: 'company' }] };
  const out = applyFilters([a, b, c, d, e], { filters, dismissed, trackedIds: new Set([e.id]) });
  assert.deepEqual(out.map(j => j.company), ['C']);
});
test('scoreJob rewards entry level and flags credentials', () => {
  const r = scoreJob({ ...J({ title: 'Deckhand', snippet: 'Entry level, will train. TWIC and drug screen required.', pay: '$18/hr', postedAt: new Date().toISOString() }), track: 'marine-chs' });
  assert.ok(r.score >= 80, String(r.score));
  assert.deepEqual(r.flags.sort(), ['drug-test', 'entry-level', 'needs-twic']);
});
test('mergeFeed keeps firstSeenAt, expires >30 days, sorts by score', () => {
  const now = '2026-10-15T12:00:00.000Z';
  const prev = [
    { id: '1', score: 50, firstSeenAt: '2026-10-10T00:00:00.000Z' },
    { id: '2', score: 90, firstSeenAt: '2026-09-01T00:00:00.000Z' },
    { id: '3', score: 10, firstSeenAt: '2026-10-14T00:00:00.000Z' }];
  const incoming = [{ id: '1', score: 60 }, { id: '4', score: 70 }];
  const out = mergeFeed(prev, incoming, now);
  assert.deepEqual(out.map(j => j.id), ['4', '1', '3']);
  assert.equal(out.find(j => j.id === '1').firstSeenAt, '2026-10-10T00:00:00.000Z');
  assert.equal(out.find(j => j.id === '4').firstSeenAt, now);
});

test('keywords respect boundaries and temporary sales classification', () => {
  assert.equal(classifyTrack(J({ title: 'Automate estimates', location: 'Charleston, SC' })), 'quick-cash');
  assert.equal(classifyTrack(J({ title: 'AI Trainer' })), 'ai-web');
  assert.equal(classifyTrack(J({ title: 'Part-time Retail Sales Associate' })), 'quick-cash');
  assert.equal(scoreJob({ ...J({ title: 'Automate estimates' }), track: 'marine-chs' }).score, 40);
});
test('dismissed URL variants and city duplicates cannot reappear', () => {
  const a = { ...J({ title: 'Deckhand', company: 'A', location: 'Charleston, SC', url: 'https://a.com/job' }), id: '1', track: 'marine-chs' };
  const b = { ...a, id: '2', location: 'Charleston, South Carolina', url: 'https://other.com/job' };
  assert.equal(applyFilters([a, b], { filters }).length, 1);
  assert.equal(applyFilters([a], { filters, dismissed: { items: [{ url: a.url + '/?utm_source=x#top' }] } }).length, 0);
  assert.equal(applyFilters([a], { filters: { ...filters, excludeKeywords: ['deck'] } }).length, 0);
});
test('merge caps at 600 and does not rejuvenate expired incoming jobs', () => {
  const now = '2026-10-15T12:00:00Z';
  const jobs = Array.from({ length: 610 }, (_, i) => ({ id: String(i), score: i, firstSeenAt: now }));
  const merged = mergeFeed([], jobs, now);
  assert.equal(merged.length, 600);
  assert.equal(merged[0].id, '609');
  assert.equal(mergeFeed([{ id: 'old', firstSeenAt: '2026-08-01T00:00:00Z' }], [{ id: 'old', score: 100 }], now).length, 0);
});

test('normalizing a URL does not change slashes inside query values', () => {
  assert.equal(normalizeUrl('https://Example.com/job/?next=https://other.com/'), 'https://example.com/job?next=https%3A%2F%2Fother.com%2F');
  assert.equal(normalizeUrl('https://Example.com/?id=1'), 'https://example.com?id=1');
});
