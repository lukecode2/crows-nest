import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSources } from '../../scripts/fetch-feed.mjs';

test('runSources isolates failing sources', async () => {
  const good = { name: 'good', fetchJobs: async () => [{ title: 'Deckhand', company: 'A', location: 'Charleston, SC', url: 'https://a.com/1', source: 'good' }] };
  const bad = { name: 'bad', fetchJobs: async () => { throw new Error('Unexpected token < in JSON'); } };
  const slow = { name: 'slow', fetchJobs: () => new Promise(() => {}) };
  const { jobs, report } = await runSources([good, bad, slow], { env: {}, perSourceTimeoutMs: 200 });
  assert.equal(jobs.length, 1);
  assert.deepEqual(report.map(r => [r.name, r.ok]), [['good', true], ['bad', false], ['slow', false]]);
  assert.match(report[1].error, /Unexpected token/);
});

test('keyed source without key reports missing key', async () => {
  const adzuna = await import('../../scripts/sources/adzuna.mjs');
  const { report } = await runSources([adzuna], { env: {}, searches: { adzuna: [] }, perSourceTimeoutMs: 200 });
  assert.equal(report[0].ok, false);
  assert.match(report[0].error, /missing key/);
});

test('run summary prints every track, at most eight titles each, rejection counts and coverage lists', async () => {
  const { printRunSummary } = await import('../../scripts/fetch-feed.mjs');
  const lines = [];
  printRunSummary({ jobs: Array.from({ length: 10 }, (_, i) => ({ track: 'marine-local', title: `Deckhand ${i}`, company: 'A' })), catchLog: { jobs: [{ kept: false, dropReason: 'senior' }, { kept: true, dropReason: null }] }, companies: { companies: [{ name: 'New Boats', researchRegion: 'grand-strand', ats: 'page', url: 'https://boats/jobs' }], _skipped: [{ name: 'Dead Boats', reason: '404' }] }, govfeeds: { feeds: [{ name: 'County', type: 'rss', url: 'https://county/rss' }], _skipped: [{ name: 'Blocked County', reason: 'robots' }] } }, line => lines.push(line));
  const output = lines.join('\n');
  for (const track of ['marine-local', 'marine-chs', 'marine-national', 'ai-web', 'tech-sales', 'quick-cash']) assert.ok(output.includes(track), track);
  assert.match(output, /marine-local: 10/); assert.match(output, /Deckhand 7/); assert.doesNotMatch(output, /Deckhand 8/);
  for (const text of ['senior: 1', 'New Boats', 'Dead Boats', 'County', 'Blocked County']) assert.ok(output.includes(text), text);
});
