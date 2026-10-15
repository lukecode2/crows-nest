import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../js/store.js';
const tracker = { version: 1, updatedAt: '2026-10-15T10:00:00Z', settings: { weeklyGoal: 10, followUpDays: 7 }, jobs: [{ id: 'mine', company: 'Fake Marina', role: 'Crew', notes: 'Café ⚓', createdAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z', history: [], stage: 'dockside' }], reqs: [] };
function setup(options = {}) {
  const values = new Map([['cn.tracker', JSON.stringify(tracker)], ['cn.token', 'token']]);
  const storage = { getItem: key => values.get(key) || null, setItem: (key, val) => values.set(key, val), removeItem: key => values.delete(key) };
  const store = createStore({ storage, fetcher: async () => ({ ok: true, json: async () => ({ jobs: [], sources: [] }) }), api: { getFile: async () => null, putFile: async () => 'saved' }, ...options });
  return { store, values };
}
test('expired token preserves local tracker and edits, including after reload', async () => {
  const { store, values } = setup({ api: { getFile: async () => { throw Object.assign(new Error('Expired token'), { status: 401 }); } } });
  await store.load();
  assert.equal(store.state.sync, 'local');
  assert.equal(store.state.tracker.jobs[0].notes, 'Café ⚓');
  store.updateJob('mine', { notes: 'Offline edit 🛥️' });
  assert.equal(JSON.parse(values.get('cn.tracker')).jobs[0].notes, 'Offline edit 🛥️');
  store.dispose();
});
test('409 retry merges newer local edits and other device jobs without losing either', async () => {
  let writes = 0;
  let written;
  const remote = { ...tracker, jobs: [{ ...tracker.jobs[0], notes: 'Old remote', updatedAt: '2026-10-14T10:00:00Z' }, { id: 'other', updatedAt: '2026-10-15T11:00:00Z' }] };
  const { store } = setup({ api: {
    getFile: async path => path.includes('tracker') ? { json: remote, sha: 'remote' } : null,
    putFile: async (path, data, sha) => { if (path.includes('tracker')) { writes++; if (writes === 1) throw Object.assign(new Error('Conflict'), { status: 409 }); written = data; assert.equal(sha, 'remote'); } return 'saved'; }
  } });
  await store.load();
  store.updateJob('mine', { notes: 'Newest local 🛥️' });
  await store.flush();
  assert.equal(writes, 2);
  assert.equal(written.jobs.find(j => j.id === 'mine').notes, 'Newest local 🛥️');
  assert.ok(written.jobs.some(j => j.id === 'other'));
  assert.equal(store.state.sync, 'synced');
  store.dispose();
});
test('blocked storage and offline fetches never crash loading or mutation', async () => {
  const store = createStore({ storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }, fetcher: async () => { throw new TypeError('offline'); } });
  await store.load();
  store.addJob({ role: 'Local lead', company: 'Fake Company' });
  assert.equal(store.state.tracker.jobs[0].role, 'Local lead');
  assert.equal(store.state.sync, 'local');
  store.dispose();
});

test('applied feed cards get one tracker entry; moves set dates and append history', async () => {
  const { store } = setup();
  await store.load();
  const feed = { id: 'f1', title: 'Deckhand', company: 'Fake Marina', track: 'marine-chs', location: 'Charleston', url: 'https://example.com/job', flags: ['needs-twic'] };
  store.state.feed.jobs = [feed];
  const job = store.saveFeedJob(feed, 'dockside');
  store.saveFeedJob(feed, 'castoff');
  assert.equal(store.state.tracker.jobs.filter(j => j.feedId === 'f1').length, 1);
  assert.equal(store.visibleFeed().length, 0);
  assert.equal(job.dateApplied, null);
  store.updateJob(job.id, { stage: 'castoff' });
  assert.match(job.dateApplied, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(job.history.length, 2);
  assert.ok(job.updatedAt > job.createdAt);
  store.markFollowedUp(job.id);
  assert.equal(job.stage, 'hailed');
  assert.equal(job.lastFollowUp, job.dateApplied);
  assert.deepEqual(job.reqs, ['twic']);
  store.dispose();
});
test('company dismissal filters matching jobs and undo restores them', async () => {
  const { store } = setup();
  await store.load();
  const job = { id: 'f1', company: 'Fake Marina', title: 'Deckhand', url: 'https://example.com/1' };
  store.state.feed.jobs = [job, { ...job, id: 'f2', url: 'https://example.com/2' }];
  store.dismiss(job, 'company', 'No thanks');
  assert.equal(store.visibleFeed().length, 0);
  store.undoDismiss(job.id);
  assert.equal(store.visibleFeed().length, 2);
  store.dispose();
});
test('deleting a lead stays deleted after merging a stale remote copy', async () => {
  const { store } = setup();
  await store.load();
  store.deleteJob('mine');
  store.importTracker({ ...tracker, jobs: [{ ...tracker.jobs[0], track: 'marine-local', reqs: [] }] });
  assert.equal(store.state.tracker.jobs.length, 0);
  store.dispose();
});
test('sample mode isolates storage and never reads or writes GitHub', async () => {
  const values = new Map([['cn.tracker', JSON.stringify(tracker)], ['cn.token', 'real-secret']]);
  const store = createStore({ sample: true, storage: { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) }, fetcher: async path => ({ ok: true, json: async () => path.includes('tracker') ? tracker : path.includes('dismissed') ? { items: [] } : { jobs: [], sources: [] } }), api: { getFile() { assert.fail('Sample must not sync'); }, putFile() { assert.fail('Sample must not sync'); } } });
  await store.load();
  store.updateJob('mine', { notes: 'Demo edit' });
  await store.flush();
  assert.equal(store.getToken(), '');
  assert.equal(JSON.parse(values.get('cn.tracker')).jobs[0].notes, 'Café ⚓');
  assert.equal(JSON.parse(values.get('cn.sample.tracker')).jobs[0].notes, 'Demo edit');
  store.dispose();
});
test('import rejects malformed trackers without changing the local logbook', async () => {
  const { store } = setup(); await store.load();
  assert.throws(() => store.importTracker({ version: 1, jobs: [{}], reqs: [] }), /valid/);
  assert.equal(store.state.tracker.jobs[0].id, 'mine');
  store.dispose();
});

test('invalid cached JSON falls back to the public seed instead of an empty tracker', async () => {
  const seed = { ...tracker, jobs: [{ ...tracker.jobs[0], track: 'marine-local', reqs: [] }] };
  const store = createStore({ storage: { getItem: key => key === 'cn.tracker' ? '{"version":1,"jobs":"broken"}' : null, setItem() {} }, fetcher: async path => ({ ok: true, json: async () => path.includes('tracker') ? seed : path.includes('dismissed') ? { items: [] } : { jobs: [], sources: [] } }) });
  await store.load();
  assert.equal(store.state.tracker.jobs.length, 1);
  store.dispose();
});
test('a 422 dismissal conflict merges both device records and retries with the new SHA', async () => {
  let writes = 0, saved;
  const other = { id: 'remote', title: 'Remote job', dismissedAt: '2026-10-14T00:00:00Z' };
  const { store } = setup({ api: {
    getFile: async path => path.includes('dismissed') ? { sha: 'remote-sha', json: { items: [other] } } : { sha: 'tracker-sha', json: tracker },
    putFile: async (path, value, sha) => { if (path.includes('dismissed')) { writes++; if (writes === 1) throw Object.assign(new Error('Conflict'), { status: 422 }); saved = value; assert.equal(sha, 'remote-sha'); } return 'new-sha'; }
  } });
  await store.load(); store.dismiss({ id: 'local', company: 'Fake Marina', title: 'Crew' }, 'other');
  await store.flush();
  assert.deepEqual(saved.items.map(j => j.id).sort(), ['local', 'remote']);
  assert.equal(writes, 2); assert.equal(store.state.sync, 'synced'); store.dispose();
});
test('edits made during a save remain dirty and get uploaded in the next save', async () => {
  let release, writes = 0;
  const saved = [];
  const { store } = setup({ api: {
    getFile: async path => path.includes('tracker') ? { json: tracker, sha: 'old' } : null,
    putFile: async (path, value) => {
      if (path.includes('tracker')) { saved.push(JSON.parse(JSON.stringify(value))); writes++; if (writes === 1) await new Promise(resolve => { release = resolve; }); }
      return 'sha-' + writes;
    }
  } });
  await store.load(); store.updateJob('mine', { notes: 'First' });
  const firstSave = store.flush();
  assert.ok(release);
  store.updateJob('mine', { notes: 'Second' }); release(); await firstSave;
  await store.flush();
  assert.equal(saved[0].jobs[0].notes, 'First'); assert.equal(saved[1].jobs[0].notes, 'Second');
  store.dispose();
});
