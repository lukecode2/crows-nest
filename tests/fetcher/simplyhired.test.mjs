import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResults, fetchJobs } from '../../scripts/sources/simplyhired.mjs';
const page = jobs => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { jobs } } })}</script></html>`;
test('simplyhired reads the embedded results, skips ads and marks remote jobs', () => {
  const jobs = parseResults(page([
    { jobKey: 'abc', title: 'Dockhand Marina', company: 'Safe Harbor Marinas', location: 'Charleston, SC', salaryInfo: '$17 an hour', dateOnIndeed: 1794249914975, snippet: 'Help members at the marina.', requirements: ['Entry level'], remoteAttributes: [] },
    { jobKey: 'ad', title: 'Sponsored', company: 'X', location: 'Remote', sponsored: true },
    { jobKey: 'r1', title: 'SDR', company: 'Co', location: 'Austin, TX', remoteAttributes: ['Remote'] }
  ]), { track: 'marine-chs' });
  assert.equal(jobs.length, 2);
  assert.deepEqual([jobs[0].url, jobs[0].pay, jobs[0].trackHint, jobs[0].remote], ['https://www.simplyhired.com/job/abc', '$17 an hour', 'marine-chs', false]);
  assert.match(jobs[0].snippet, /Entry level/);
  assert.equal(jobs[0].postedAt.slice(0, 10), '2026-11-09');
  assert.deepEqual([jobs[1].remote, jobs[1].location], [true, 'Remote — Austin, TX']);
});
test('simplyhired fails loudly when the page layout changes', async () => {
  const http = { getText: async () => '<html>blocked</html>' };
  await assert.rejects(fetchJobs({ http, searches: { simplyhired: [{ q: 'boat', l: 'Myrtle Beach, SC' }] }, simplyhiredPath: '/nonexistent.json' }), /no results data/);
});
test('simplyhired stops after a 403 and falls back to the file saved on the Mac', async () => {
  let calls = 0;
  const http = { getText: async () => { calls++; const e = new Error('HTTP 403'); e.status = 403; throw e; } };
  const { writeFile, mkdtemp } = await import('node:fs/promises');
  const dir = await mkdtemp((await import('node:os')).tmpdir() + '/sh-');
  const path = dir + '/simplyhired.json';
  await writeFile(path, JSON.stringify({ savedAt: '2026-11-16T12:00:00Z', jobs: [{ title: 'Dockhand', company: 'Co', url: 'u' }] }));
  const searches = { simplyhired: [{ q: 'a', l: 'b' }, { q: 'c', l: 'd' }, { q: 'e', l: 'f' }] };
  const jobs = await fetchJobs({ http, searches, simplyhiredPath: path, now: new Date('2026-11-17T12:00:00Z') });
  assert.equal(calls, 1);
  assert.deepEqual(jobs.map(j => [j.title, j.source]), [['Dockhand', 'simplyhired']]);
  await assert.rejects(fetchJobs({ http, searches, simplyhiredPath: path, now: new Date('2026-11-25T12:00:00Z') }), /no fresh saved file/);
});
