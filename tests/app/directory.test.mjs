import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTORY_STATUSES, filterDirectory, directoryProgress } from '../../js/directory.js';
import { mergeTrackers } from '../../js/logic.js';
import { createStore, validateTracker } from '../../js/store.js';

test('directory merge selects each newer entry, preserves both devices, and accepts old trackers', () => {
  const entry = (status, updatedAt, note = '') => ({ status, note, updatedAt });
  const local = { updatedAt: '2026-10-15T12:00:00Z', directory: { a: entry('called', '2026-10-15T11:00:00.001Z', 'local'), b: entry('not-yet', '2026-10-15T10:00:00Z'), d: entry('applied', '2026-10-15T11:00:00Z') } };
  const remote = { updatedAt: '2026-10-15T13:00:00Z', directory: { a: entry('walked-in', '2026-10-15T11:00:00Z'), b: entry('follow-up', '2026-10-15T12:00:00Z', 'remote'), c: entry('no-openings', '2026-10-15T09:00:00Z') } };
  const expected = { a: local.directory.a, b: remote.directory.b, c: remote.directory.c, d: local.directory.d };
  assert.deepEqual(mergeTrackers(local, remote).directory, expected);
  assert.deepEqual(mergeTrackers(remote, local).directory, expected);
  assert.deepEqual(mergeTrackers().directory, {});
  assert.deepEqual(mergeTrackers({}, local).directory, local.directory);
  assert.deepEqual(mergeTrackers(local, {}).directory, local.directory);
});
test('top-only defaults, search and status filters combine; progress ignores notes, filters and more picks', () => {
  const employers = [
    { id: 'a', name: 'Harbor Marina', town: 'Little River', tier: 'top' },
    { id: 'b', name: 'Tall Ship', town: 'Charleston', tier: 'top' },
    { id: 'c', name: 'Harbor Tours', town: 'Little River', tier: 'more' }
  ];
  const records = { a: { status: 'called' }, b: { status: 'not-yet', note: 'Remember resume' }, c: { status: 'applied' } };
  assert.deepEqual(filterDirectory(employers, records).map(e => e.id), ['a', 'b']);
  assert.deepEqual(filterDirectory(employers, records, { showAll: true, search: ' HARBOR ', status: 'applied' }).map(e => e.id), ['c']);
  assert.deepEqual(filterDirectory(employers, records, { status: 'not-yet' }).map(e => e.id), ['b']);
  assert.deepEqual(directoryProgress(employers, records), { contacted: 1, total: 2 });
  for (const status of DIRECTORY_STATUSES.filter(s => s.id !== 'not-yet')) assert.equal(directoryProgress(employers, { a: { status: status.id } }).contacted, 1);
});
const employers = ['grand-strand', 'charleston', 'florida'].map((region, i) => ({ id: 'employer-' + i, name: 'Employer ' + i, region, town: 'Example Town', type: 'Marina', hiringMethod: 'Call', phone: '(843) 555-0100', email: 'crew@example.test', url: `https://example${i}.test/`, tip: 'Call the dock master.', tier: 'top', score: 7 }));
function setup(extra = {}) {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const fetcher = async path => ({ ok: true, json: async () => path.includes('directory') ? { employers } : path.includes('tracker') ? { version: 1, jobs: [], reqs: [] } : path.includes('dismissed') ? { items: [] } : { jobs: [], sources: [] } });
  return { values, storage, fetcher, store: createStore({ storage, fetcher, ...extra }) };
}
test('status and notes persist, reload, import/export, and adding to Voyage maps every region once', async () => {
  const { store, values, storage, fetcher } = setup();
  await store.load();
  store.updateDirectory('employer-0', { note: 'Café ⚓ — ask for mate' });
  store.updateDirectory('employer-0', { status: 'called' });
  const firstEdit = store.state.tracker.directory['employer-0'].updatedAt;
  store.updateDirectory('employer-0', { note: 'Call tomorrow' });
  assert.ok(store.state.tracker.directory['employer-0'].updatedAt > firstEdit);
  assert.equal(store.state.tracker.directory['employer-0'].status, 'called');
  for (const [i, track] of ['marine-local', 'marine-chs', 'marine-national'].entries()) {
    const job = store.addDirectoryJob(employers[i]);
    assert.equal(store.addDirectoryJob(employers[i]), job);
    assert.equal(job.company, employers[i].name); assert.equal(job.track, track);
    assert.equal(job.role, 'Ask about deckhand / dock crew'); assert.equal(job.stage, 'dockside');
    assert.equal(job.link, employers[i].url); assert.equal(job.location, employers[i].town);
    assert.deepEqual(job.contact, { name: '', email: employers[i].email, phone: employers[i].phone });
    assert.equal(job.dateApplied, null);
  }
  assert.equal(store.state.tracker.jobs.length, 3);
  assert.equal(directoryProgress(employers, store.state.tracker.directory).contacted, 1, 'saving a lead does not count as contacting it');
  const exported = JSON.parse(values.get('cn.tracker'));
  assert.equal(validateTracker(exported), true);
  const reload = createStore({ storage, fetcher }); await reload.load();
  assert.deepEqual(reload.state.tracker.directory, exported.directory);
  assert.equal(reload.directoryJob(employers[0]).directoryId, employers[0].id);
  const imported = setup(); await imported.store.load(); imported.store.importTracker(exported);
  assert.deepEqual(imported.store.state.tracker.directory, exported.directory);
  assert.throws(() => store.updateDirectory('employer-0', { status: 'invalid' }), /Invalid/);
  assert.equal(validateTracker({ ...exported, directory: [] }), false);
  assert.equal(validateTracker({ ...exported, directory: { bad: { status: 'called', note: 12, updatedAt: 'bad' } } }), false);
  store.deleteJob(store.directoryJob(employers[0]).id);
  assert.equal(store.directoryJob(employers[0]), undefined);
  store.dispose(); reload.dispose(); imported.store.dispose();
});
test('directory loads with cache-buster and fails gracefully for missing, offline and invalid data', async () => {
  for (const result of [{ employers }, null, {}, { employers: [{}] }, 'http-error', 'offline', 'invalid-json']) {
    const original = setup(); let requested = false;
    const { store } = setup({ fetcher: async (path, options) => {
      if (!path.includes('directory')) return original.fetcher(path);
      requested = true; assert.match(path, /^data\/directory\.json\?t=\d+$/); assert.equal(options.cache, 'no-store');
      if (result === 'offline') throw new TypeError('offline');
      return { ok: result !== 'http-error', json: async () => { if (result === 'invalid-json') throw new SyntaxError('invalid JSON'); return result; } };
    } });
    await store.load(); assert.ok(requested);
    assert.deepEqual(store.state.directory, result?.employers === employers ? result : null);
    assert.equal(Boolean(store.state.directoryError), result?.employers !== employers);
    assert.deepEqual(store.state.tracker.directory, {});
    store.dispose(); original.store.dispose();
  }
});
test('directory conflicts merge per employer and retry through the existing tracker sync', async () => {
  let writes = 0, saved;
  const remote = { version: 1, jobs: [], reqs: [], directory: { other: { status: 'walked-in', note: 'Other device', updatedAt: '2026-10-15T10:00:00Z' } } };
  const { store } = setup({ api: {
    getFile: async path => path.includes('tracker') ? { sha: 'remote', json: remote } : null,
    putFile: async (path, data, sha) => {
      if (path.includes('tracker')) { writes++; if (writes === 1) throw Object.assign(new Error('Conflict'), { status: 409 }); saved = data; assert.equal(sha, 'remote'); }
      return 'saved';
    }
  } });
  await store.load(); await store.setToken('test-token');
  store.updateDirectory('employer-0', { status: 'follow-up', note: 'Call Friday' }); await store.flush();
  assert.equal(writes, 2); assert.equal(saved.directory['employer-0'].note, 'Call Friday');
  assert.deepEqual(saved.directory.other, remote.directory.other); assert.equal(store.state.sync, 'synced');
  store.dispose();
});

test('special employer roles carry through to Voyage without promising deck jobs', async () => {
  const { store } = setup(); await store.load();
  const pier = { ...employers[0], id: 'pier', name: 'Paid Pier', suggestedRole: 'Ask about paid pier-attendant openings' };
  const rescue = { ...employers[1], id: 'rescue', name: 'County Rescue', suggestedRole: 'Check paid fire/rescue recruit eligibility' };
  assert.equal(store.addDirectoryJob(pier).role, pier.suggestedRole);
  assert.equal(store.addDirectoryJob(rescue).role, rescue.suggestedRole); store.dispose();
});

test('directory corrections keep expired and unverified research out of top picks', async () => {
  const { readFile } = await import('node:fs/promises');
  const { buildDirectory, scoreEmployer } = await import('../../scripts/build-directory.mjs');
  const source = JSON.parse(await readFile(new URL('../../config/local-employers.json', import.meta.url), 'utf8'));
  const { employers } = buildDirectory(source);
  for (const name of ['Little River Marina', 'Georgetown Marina', 'Charleston Riverfront Watersports', 'Dockside Marina', 'Folly Beach Marina', 'Russell Marine LLC']) assert.ok(!employers.some(e => e.name === name), name);
  for (const pattern of [/Express Watersports/, /Downwind Sails/, /James Island Yacht Club/, /Auxiliary/, /Gulf Stream/]) {
    const rows = employers.filter(e => pattern.test(e.name)); assert.ok(rows.length);
    assert.ok(rows.every(e => e.tier === 'more'));
  }
  assert.equal(employers.find(e => e.name === 'Gulf Stream Boat Club').region, 'florida');
  assert.equal(employers.find(e => e.name === 'Carolina Yacht Club').phone, '(843) 722-0209');
  assert.equal(employers.filter(e => /Myrtle Beach Dolphin Cruises/.test(e.name)).length, 1);
  assert.ok(employers.filter(e => e.volunteer).every(e => /unpaid/.test(e.type)));
  assert.ok(employers.filter(e => /Pier \/ fishing/.test(e.type)).every(e => /pier-attendant/.test(e.tip + e.suggestedRole)));
  const base = { type: 'Marina', region: 'grand-strand', hiringMethod: 'Phone', url: '', phone: '555-555-0100' };
  assert.ok(scoreEmployer({ ...base, phone: '', currentEntryLevel: true }) > scoreEmployer(base));
  assert.ok(employers.find(e => e.name === 'Georgetown Landing Marina').phone);
  assert.equal(employers.find(e => e.name === 'Georgetown Landing Marina').url, '');
});
