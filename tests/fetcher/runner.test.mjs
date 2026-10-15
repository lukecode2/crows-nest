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
