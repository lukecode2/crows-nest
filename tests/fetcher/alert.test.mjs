import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotJobs, alertMessage, sendAlert, SITE_URL } from '../../scripts/lib/alert.mjs';

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

test('alertMessage: one job links straight to the posting', () => {
  const msg = alertMessage([J({ title: 'Marina Forklift Operator', company: 'Inlet Watch Yacht Club', location: 'Wilmington, NC', pay: '$20/hr', url: 'https://example.com/a' })]);
  assert.equal(msg.title, 'New job: Marina Forklift Operator');
  assert.equal(msg.message, 'Marina Forklift Operator — Inlet Watch Yacht Club, Wilmington, NC ($20/hr)');
  assert.equal(msg.click, 'https://example.com/a');
});

test('alertMessage: several jobs list the top five and link to the site', () => {
  const jobs = Array.from({ length: 7 }, (_, i) => J({ title: 'Job ' + i }));
  const msg = alertMessage(jobs);
  assert.equal(msg.title, '7 new jobs near home');
  assert.equal(msg.message.split('\n').length, 6);
  assert.match(msg.message, /\+2 more on the site$/);
  assert.equal(msg.click, SITE_URL);
});

test('alertMessage never links to a non-http url', () => {
  assert.equal(alertMessage([J({ url: 'javascript:alert(1)' })]).click, SITE_URL);
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
  assert.equal(body.click, 'https://example.com/job');
});

test('sendAlert throws on an ntfy error so the run log shows it', async () => {
  await assert.rejects(sendAlert([J()], { topic: 't', fetchImpl: async () => ({ ok: false, status: 429 }) }), /ntfy 429/);
});
