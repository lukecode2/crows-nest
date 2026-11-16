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
  await assert.rejects(fetchJobs({ http, searches: { simplyhired: [{ q: 'boat', l: 'Myrtle Beach, SC' }] } }), /no results data/);
});
