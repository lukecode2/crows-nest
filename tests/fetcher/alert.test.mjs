import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotJobs, alertMessage, sendAlert, alertLog, pendingAlerts, waitForSite, jobLink, SITE_URL } from '../../scripts/lib/alert.mjs';
import { main as sendMain } from '../../scripts/send-alert.mjs';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const J = (o) => ({ id: Math.random().toString(36), title: 'Job', company: 'Co', location: 'Myrtle Beach, SC', remote: false, pay: '', url: 'https://example.com/job', track: 'quick-cash', score: 50, ...o });

test('hotJobs: new local marine jobs and $18+/hr jobs near home', () => {
  const old = J({ id: 'old', track: 'marine-local' });
  const marine = J({ track: 'marine-local', title: 'Dockhand' });
  const chs = J({ track: 'marine-chs', location: 'Charleston, SC' });
  const paid = J({ pay: '$20/hr in training, $22/hr after' });
  const salary = J({ pay: '$35,000–$55,000/year' });
  const cheap = J({ pay: '$14.00–$16.82/hr' });
  const unknown = J({ pay: '' });
  const far = J({ pay: '$30/hr', location: 'Miami, FL' });
  const remote = J({ pay: '$25/hr', remote: true, location: 'Remote' });
  const national = J({ track: 'marine-national', location: 'Saint Louis, Missouri' });
  const hot = hotJobs([old, J({ id: 'x' })], [old, marine, chs, paid, salary, cheap, unknown, far, remote, national]);
  assert.deepEqual(new Set(hot), new Set([marine, chs, paid, salary]));
});

test('hotJobs stays quiet on the first run so it never pings the whole feed', () => {
  assert.deepEqual(hotJobs([], [J({ track: 'marine-local' })]), []);
});

test('hotJobs puts the best match first', () => {
  const a = J({ track: 'marine-local', score: 40 }), b = J({ track: 'marine-local', score: 90 });
  assert.deepEqual(hotJobs([J()], [a, b]), [b, a]);
});

test('alertMessage: one job opens that job on the site, with a button for the posting', () => {
  const msg = alertMessage([J({ id: 'ats:abc 1', title: 'Marina Forklift Operator', company: 'Inlet Watch Yacht Club', location: 'Wilmington, NC', pay: '$20/hr', url: 'https://example.com/a' })]);
  assert.equal(msg.title, 'New job: Marina Forklift Operator');
  assert.equal(msg.message, 'Marina Forklift Operator — Inlet Watch Yacht Club, Wilmington, NC ($20/hr)');
  assert.equal(msg.click, SITE_URL + '#nest?job=ats%3Aabc%201');
  assert.deepEqual(msg.actions, [{ action: 'view', label: 'Open posting', url: 'https://example.com/a' }]);
});

test('alertMessage: several jobs list the top five and link to the site', () => {
  const jobs = Array.from({ length: 7 }, (_, i) => J({ title: 'Job ' + i }));
  const msg = alertMessage(jobs);
  assert.equal(msg.title, '7 new jobs near home');
  assert.equal(msg.message.split('\n').length, 6);
  assert.match(msg.message, /\+2 more on the site$/);
  assert.equal(msg.click, SITE_URL + '#nest?alerts=1');
});

test('alertMessage never links to a non-http url', () => {
  const msg = alertMessage([J({ id: 'x', url: 'javascript:alert(1)' })]);
  assert.equal(msg.click, jobLink('x'));
  assert.equal(msg.actions, undefined);
});

test('sendAlert posts JSON to ntfy, and skips without a topic or jobs', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
  assert.equal(await sendAlert([J()], { topic: '', fetchImpl }), false);
  assert.equal(await sendAlert([], { topic: 't', fetchImpl }), false);
  assert.equal(calls.length, 0);
  assert.equal(await sendAlert([J({ title: 'Deckhand' })], { topic: 'crows-nest-abc', fetchImpl }), true);
  assert.equal(calls[0].url, 'https://ntfy.sh/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.topic, 'crows-nest-abc');
  assert.equal(body.title, 'New job: Deckhand');
  assert.match(body.click, /#nest\?job=/);
});

test('sendAlert throws on an ntfy error so the run log shows it', async () => {
  await assert.rejects(sendAlert([J()], { topic: 't', fetchImpl: async () => ({ ok: false, status: 429 }) }), /ntfy 429/);
});

test('alertLog keeps newest first, drops repeats, and caps the history', () => {
  const old = Array.from({ length: 45 }, (_, i) => ({ id: 'o' + i, alertedAt: 'earlier' }));
  const log = alertLog(old, [J({ id: 'o3', title: 'Again' }), J({ id: 'n1' })], 'now');
  assert.deepEqual(log.slice(0, 2).map(a => [a.id, a.alertedAt]), [['o3', 'now'], ['n1', 'now']]);
  assert.equal(log.length, 40);
  assert.equal(log.filter(a => a.id === 'o3').length, 1);
  assert.equal(alertLog(undefined, [J({ url: 'javascript:x' })], 'now')[0].url, '');
});

test('pendingAlerts only returns jobs from the latest run', () => {
  const feed = { generatedAt: 'B', alerts: [{ id: 1, alertedAt: 'B' }, { id: 2, alertedAt: 'A' }] };
  assert.deepEqual(pendingAlerts(feed).map(a => a.id), [1]);
  assert.deepEqual(pendingAlerts({ generatedAt: 'B' }), []);
});

test('waitForSite polls until the live feed matches this run', async () => {
  const served = ['A', 'A', 'B'];
  let calls = 0;
  const fetchImpl = async () => ({ ok: true, json: async () => ({ generatedAt: served[calls++] }) });
  assert.equal(await waitForSite('B', { fetchImpl, pause: async () => {} }), true);
  assert.equal(calls, 3);
  assert.equal(await waitForSite('C', { fetchImpl: async () => { throw new Error('down'); }, tries: 3, pause: async () => {} }), false);
});

test('send-alert waits for the site, then pings only this run\'s jobs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cn-alert-'));
  await mkdir(join(root, 'data'));
  const feed = { generatedAt: 'T2', jobs: [], alerts: [{ id: 'a', title: 'Deckhand', company: 'Co', alertedAt: 'T2' }, { id: 'b', title: 'Old', company: 'Co', alertedAt: 'T1' }] };
  await writeFile(join(root, 'data/feed.json'), JSON.stringify(feed));
  const posts = [];
  const fetchImpl = async (url, init) => {
    if (String(url).includes('ntfy')) { posts.push(JSON.parse(init.body)); return { ok: true, status: 200 }; }
    return { ok: true, json: async () => feed };
  };
  assert.equal(await sendMain({ root, topic: 't', fetchImpl, waitOptions: { pause: async () => {} } }), 'sent');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, 'New job: Deckhand');
  assert.equal(await sendMain({ root, topic: '', fetchImpl }), 'no-topic');
  await writeFile(join(root, 'data/feed.json'), JSON.stringify({ ...feed, generatedAt: 'T3' }));
  assert.equal(await sendMain({ root, topic: 't', fetchImpl }), 'none');
});
