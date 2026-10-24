import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../js/store.js';
const tracker = { version: 1, updatedAt: '2026-10-15T10:00:00Z', settings: { weeklyGoal: 10, followUpDays: 7 }, jobs: [{ id: 'mine', company: 'Fake Marina', role: 'Crew', notes: 'Café ⚓', createdAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z', history: [], stage: 'dockside', track: 'marine-local', reqs: [] }], reqs: [] };
function setup(options = {}) {
  const values = new Map([['cn.tracker', JSON.stringify(tracker)], ['cn.token', 'token']]);
  const storage = { getItem: key => values.get(key) || null, setItem: (key, val) => values.set(key, val), removeItem: key => values.delete(key) };
  const store = createStore({ storage, fetcher: async () => ({ ok: true, json: async () => ({ jobs: [], sources: [] }) }), api: { getFile: async () => null, putFile: async () => 'saved' }, ...options });
  return { store, values };
}
test('sweep loads with a cache-buster and stays hidden on fetch or data failures', async () => {
  for (const sweep of [{ sweptAt: null, items: [] }, { sweptAt: '2026-10-15T12:00:00Z', items: [] }, null, {}, { sweptAt: 'invalid', items: [] }, { sweptAt: null, items: 'invalid' }, 'http-error', 'offline', 'invalid-json']) {
    let loadedSweep = false;
    const { store } = setup({ fetcher: async (path, options) => {
      if (path.startsWith('data/sweep.json')) {
        loadedSweep = true;
        assert.match(path, /^data\/sweep\.json\?t=\d+$/);
        assert.equal(options.cache, 'no-store');
        if (sweep === 'offline') throw new TypeError('offline');
        return { ok: sweep !== 'http-error', json: async () => { if (sweep === 'invalid-json') throw new SyntaxError('bad JSON'); return sweep; } };
      }
      return { ok: true, json: async () => ({ jobs: [], sources: [] }) };
    } });
    await store.load();
    assert.ok(loadedSweep);
    assert.deepEqual(store.state.sweep, sweep && Array.isArray(sweep.items) && (sweep.sweptAt === null || sweep.sweptAt === '2026-10-15T12:00:00Z') ? sweep : null);
    assert.equal(store.state.feedError, '');
    store.dispose();
  }
});
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
  const remote = { ...tracker, jobs: [{ ...tracker.jobs[0], notes: 'Old remote', updatedAt: '2026-10-14T10:00:00Z' }, { ...tracker.jobs[0], id: 'other', updatedAt: '2026-10-15T11:00:00Z' }] };
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

test('missing storage and failed write probes report memory-only changes', async () => {
  for (const storage of [null, { getItem() { return null; }, setItem() { throw new Error('full'); } }]) {
    const store = createStore({ storage, fetcher: async () => { throw new Error('offline'); } });
    assert.equal(store.state.storageError, true);
    await store.load(); store.addJob({ company: 'Memory Marina', role: 'Dockhand' });
    assert.equal(store.state.storageError, true);
    assert.equal(store.state.tracker.jobs.length, 1); store.dispose();
  }
});
test('import validates types, calendar dates, histories, settings and IDs before any persistence', async () => {
  const { store, values } = setup(); await store.load();
  const bad = [
    t => { t.jobs[0].nextDue = 42; }, t => { t.jobs[0].dateApplied = '2026-02-30'; },
    t => { t.jobs[0].lastFollowUp = 'October 24'; }, t => { t.jobs[0].history = [null]; },
    t => { t.jobs[0].history = [{ stage: 'offer', at: '2026-10-24T12:00:00Z' }]; },
    t => { t.jobs[0].updatedAt = '2026-02-30T12:00:00Z'; }, t => { t.jobs[0].notes = {}; },
    t => { t.jobs[0].contact = { phone: 8435550100 }; }, t => { t.jobs[0].reqs = [null]; },
    t => { t.settings.weeklyGoal = 1.5; }, t => { t.settings.weeklyGoal = 101; },
    t => { t.settings.followUpDays = 0; }, t => { t.settings = null; },
    t => { t.jobs.push({ ...t.jobs[0] }); }, t => { t.reqs = [{ id: 'r', label: 'Paper', done: 'yes' }]; },
    t => { t.reqs = [{ id: 'r', label: 'Paper' }, { id: 'r', label: 'Duplicate' }]; },
    t => { t.deletedJobs = { gone: 42 }; }
  ];
  const before = JSON.stringify(store.state.tracker), persisted = values.get('cn.tracker');
  for (const corrupt of bad) {
    const value = JSON.parse(JSON.stringify(tracker)); corrupt(value);
    assert.throws(() => store.importTracker(value), /invalid fields; nothing was imported/);
    assert.equal(JSON.stringify(store.state.tracker), before); assert.equal(values.get('cn.tracker'), persisted);
  }
  store.dispose();
});
test('invalid cached fields fall back to seed, and invalid remote fields never merge', async () => {
  const malformed = { ...tracker, jobs: [{ ...tracker.jobs[0], nextDue: 42 }] };
  const values = new Map([['cn.tracker', JSON.stringify(malformed)]]);
  const store = createStore({ storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    fetcher: async path => ({ ok: true, json: async () => path.includes('tracker') ? tracker : { jobs: [], sources: [], items: [] } }),
    api: { getFile: async () => ({ sha: 'bad', json: malformed }) } });
  await store.load(); assert.equal(store.state.tracker.jobs[0].nextDue, undefined);
  await store.setToken('token'); assert.equal(store.state.tracker.jobs[0].nextDue, undefined);
  assert.match(store.state.error, /Could not sync/); store.dispose();
});
test('new Papers guidance reaches cached trackers, preserving personal notes, completion and jobs', async () => {
  const old = { ...tracker, reqs: [{ id: 'doctor', label: 'Old', done: true, note: 'My appointment', updatedAt: '2026-10-20T00:00:00Z' }] };
  const seed = { ...tracker, updatedAt: '2026-10-24T12:00:00Z', jobs: [], reqs: [
    { id: 'doctor', label: 'Optional check', unlocks: 'Correct guidance', done: false, note: '', updatedAt: '2026-10-24T12:00:00Z', guidanceVersion: 1 },
    { id: 'stcw-basic', label: 'Completed Basic', done: true, note: '', updatedAt: '2026-10-24T12:00:00Z', guidanceVersion: 1 }
  ] };
  const values = new Map([['cn.tracker', JSON.stringify(old)]]);
  const store = createStore({ storage: { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) }, fetcher: async path => ({ ok: true, json: async () => path.includes('tracker') ? seed : { jobs: [], sources: [], items: [] } }) });
  await store.load();
  assert.equal(store.state.tracker.reqs.find(r => r.id === 'doctor').label, 'Optional check');
  assert.equal(store.state.tracker.reqs.find(r => r.id === 'doctor').done, true);
  assert.equal(store.state.tracker.reqs.find(r => r.id === 'doctor').note, 'My appointment');
  assert.ok(store.state.tracker.reqs.some(r => r.id === 'stcw-basic' && r.done));
  assert.deepEqual(store.state.tracker.jobs, old.jobs); store.dispose();
});
test('Refresh polls only the feed, updates cards when generatedAt advances, and stops', async () => {
  let checks = 0, dispatches = 0; const delays = [];
  const { store } = setup({ pause: async ms => delays.push(ms),
    api: { dispatchFeed: async token => { assert.equal(token, 'token'); dispatches++; } },
    fetcher: async path => {
      assert.match(path, /^data\/feed.json\?t=/); checks++;
      return { ok: true, json: async () => ({ generatedAt: checks < 3 ? '2026-10-24T10:00:00Z' : '2026-10-24T11:00:00Z', sources: [], jobs: [{ id: 'new-' + checks }] }) };
    } });
  store.state.feed.generatedAt = '2026-10-24T10:00:00Z';
  const jobs = JSON.stringify(store.state.tracker.jobs);
  await store.refreshFeed(); assert.equal(dispatches, 1); assert.equal(checks, 3);
  assert.deepEqual(delays, [30000, 30000, 30000]); assert.equal(store.state.feedRefresh, 'ready');
  assert.equal(store.visibleFeed()[0].id, 'new-3'); assert.equal(JSON.stringify(store.state.tracker.jobs), jobs); store.dispose();
});
test('Refresh stops after twelve checks; manual Reload feed can then bring the report aboard', async () => {
  let checks = 0; const delays = [];
  const { store } = setup({ pause: async ms => delays.push(ms), api: { dispatchFeed: async () => {} },
    fetcher: async () => ({ ok: true, json: async () => ({ generatedAt: ++checks > 12 ? '2026-10-24T11:00:00Z' : '2026-10-24T10:00:00Z', sources: [], jobs: [] }) }) });
  store.state.feed.generatedAt = '2026-10-24T10:00:00Z';
  await store.refreshFeed(); assert.equal(checks, 12); assert.equal(delays.length, 12); assert.equal(store.state.feedRefresh, 'timeout');
  assert.equal(await store.reloadFeed(), true); assert.equal(checks, 13); store.dispose();
});
