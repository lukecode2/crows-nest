import { test } from 'node:test';
import assert from 'node:assert/strict';
import { b64EncodeUtf8, b64DecodeUtf8 } from '../../js/github.js';
test('utf8 base64 round trip with emoji and accents', () => {
  const s = JSON.stringify({ notes: 'Café ⚓ 🛥️ — naïve' });
  assert.equal(b64DecodeUtf8(b64EncodeUtf8(s)), s);
  assert.equal(b64DecodeUtf8(b64EncodeUtf8(s).replace(/(.{10})/g, '$1\n')), s); // GitHub wraps lines
});

import { getFile, putFile, dispatchFeed } from '../../js/github.js';
test('Contents API reads UTF8, writes with SHA, handles 404 and exposes auth failures', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => options.method === 'PUT' ? { content: { sha: 'next' } } : { content: b64EncodeUtf8('{"notes":"⚓ café"}'), sha: 'old' } };
  });
  assert.deepEqual(await getFile('data/tracker.json', 'secret'), { json: { notes: '⚓ café' }, sha: 'old' });
  assert.equal(await putFile('data/tracker.json', { notes: '⚓ café' }, 'old', 'secret', 'Save'), 'next');
  assert.match(calls[0].url, /contents\/data\/tracker.json\?ref=master$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret');
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.sha, 'old');
  assert.equal(JSON.parse(b64DecodeUtf8(body.content)).notes, '⚓ café');
  await dispatchFeed('secret');
  assert.match(calls[2].url, /actions\/workflows\/feed.yml\/dispatches$/);
  assert.deepEqual(JSON.parse(calls[2].options.body), { ref: 'master' });
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  assert.equal(await getFile('missing', 'secret'), null);
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'Bad credentials' }) });
  await assert.rejects(putFile('x', {}, null, 'secret', 'save'), error => error.status === 401);
});
