import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRACKS, STAGES } from '../../js/config.js';
import { validateTracker } from '../../js/store.js';
const json = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);
test('seed includes every specified lead and nine papers, with three next actions', async () => {
  const seed = await json('../../data/tracker.json');
  assert.equal(validateTracker(seed), true);
  assert.equal(seed.jobs.length, 20);
  assert.equal(seed.reqs.length, 9);
  assert.equal(seed.jobs.filter(j => j.nextAction && j.nextDue).length, 3);
  assert.ok(seed.jobs.every(j => j.stage === 'dockside' && j.createdAt === '2026-10-15T00:00:00Z'));
  assert.equal(seed.jobs.find(j => j.company === 'Freedom Boat Club Grand Strand').contact.phone, '843-732-3777');
  assert.deepEqual(seed.jobs.find(j => j.company === 'Military Sealift Command').reqs, ['mmc', 'drug']);
  assert.equal(seed.reqs.find(r => r.id === 'resume-marine').done, true);
});
test('sample feed has twelve clearly fictional jobs and covers all six tracks', async () => {
  const feed = await json('./fixtures/feed.sample.json');
  assert.equal(feed.jobs.length, 12);
  assert.deepEqual([...new Set(feed.jobs.map(j => j.track))].sort(), TRACKS.map(t => t.id).sort());
  assert.equal(new Set(feed.jobs.map(j => j.id)).size, 12);
  assert.ok(feed.jobs.every(j => /fictional/i.test(j.company) && j.source === 'sample'));
  assert.equal(STAGES.length, 6);
});
