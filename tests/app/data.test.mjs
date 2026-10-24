import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRACKS, STAGES } from '../../js/config.js';
import { validateTracker } from '../../js/store.js';
const json = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);
// data/tracker.json is Luke's live tracker (the app saves to it), so only check what must always hold.
// Exact seed counts used to live here and broke the feed workflow the first time he saved a job.
test('live tracker stays valid and keeps every paper', async () => {
  const tracker = await json('../../data/tracker.json');
  assert.equal(validateTracker(tracker), true);
  for (const id of ['doctor', 'eng1', 'mmc', 'twic', 'drug', 'seaservice', 'resume-marine', 'resume-sales', 'resume-ai']) assert.ok(tracker.reqs.some(r => r.id === id), id);
});
test('sample feed has twelve clearly fictional jobs and covers all six tracks', async () => {
  const feed = await json('./fixtures/feed.sample.json');
  assert.equal(feed.jobs.length, 12);
  assert.deepEqual([...new Set(feed.jobs.map(j => j.track))].sort(), TRACKS.map(t => t.id).sort());
  assert.equal(new Set(feed.jobs.map(j => j.id)).size, 12);
  assert.ok(feed.jobs.every(j => /fictional/i.test(j.company) && j.source === 'sample'));
  assert.equal(STAGES.length, 6);
});

test('corrected Papers timestamps beat an old cached copy in either merge direction', async () => {
  const { mergeTrackers } = await import('../../js/logic.js');
  const tracker = await json('../../data/tracker.json');
  const cached = { ...tracker, updatedAt: '2026-10-23T12:00:00Z', reqs: tracker.reqs.filter(r => !['stcw-basic', 'uscg-medical', 'stcw-acceptance'].includes(r.id)).map(r => ({ ...r, label: 'Old guidance', updatedAt: '2026-10-23T12:00:00Z' })) };
  for (const result of [mergeTrackers(cached, tracker), mergeTrackers(tracker, cached)]) {
    for (const id of ['doctor', 'eng1', 'mmc', 'drug', 'seaservice', 'stcw-basic', 'uscg-medical', 'stcw-acceptance']) {
      assert.deepEqual(result.reqs.find(r => r.id === id), tracker.reqs.find(r => r.id === id));
    }
  }
  assert.equal(tracker.reqs.find(r => r.id === 'stcw-basic').done, true);
});
