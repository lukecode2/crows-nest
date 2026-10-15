import * as github from './github.js';
import { DISMISSED_ABOUT, STAGES, TRACKS } from './config.js';
import { feedJobToTracker, localToday, mergeTrackers, safeUrl } from './logic.js';
import { DIRECTORY_REGIONS, DIRECTORY_STATUSES } from './directory.js';
const blankTracker = () => ({ version: 1, updatedAt: '', settings: { weeklyGoal: 10, followUpDays: 7 }, jobs: [], reqs: [], directory: {} });
const blankDismissed = () => ({ about: DISMISSED_ABOUT, items: [] });
export function validateTracker(value) {
  return value && value.version === 1 && Array.isArray(value.jobs) && Array.isArray(value.reqs) &&
    value.jobs.every(j => j && typeof j.id === 'string' && typeof j.company === 'string' && typeof j.role === 'string' &&
      STAGES.some(s => s.id === j.stage) && TRACKS.some(t => t.id === j.track) && Array.isArray(j.history) && Array.isArray(j.reqs)) &&
    value.reqs.every(r => r && typeof r.id === 'string' && typeof r.label === 'string') &&
    (value.directory === undefined || (value.directory !== null && typeof value.directory === 'object' && !Array.isArray(value.directory) &&
      Object.values(value.directory).every(entry => entry && DIRECTORY_STATUSES.some(s => s.id === entry.status) && typeof entry.note === 'string' && Number.isFinite(Date.parse(entry.updatedAt)))));
}
function mergeDismissed(local, remote) {
  const removed = { ...remote.removed, ...local.removed };
  Object.entries(remote.removed || {}).forEach(([id, at]) => { if (at > (removed[id] || '')) removed[id] = at; });
  const items = new Map((remote.items || []).map(j => [j.id, j]));
  (local.items || []).forEach(j => { if (!items.has(j.id) || j.dismissedAt >= items.get(j.id).dismissedAt) items.set(j.id, j); });
  return { about: DISMISSED_ABOUT, items: [...items.values()].filter(j => !removed[j.id] || j.dismissedAt > removed[j.id]), ...(Object.keys(removed).length ? { removed } : {}) };
}
export function createStore(options = {}) {
  let storage = options.storage;
  if (!storage) { try { storage = globalThis.localStorage; } catch (_) { /* Private browsing can block storage. */ } }
  const sample = options.sample || false;
  const prefix = sample ? 'cn.sample.' : 'cn.';
  const read = key => { try { return storage && storage.getItem(prefix + key); } catch (_) { return null; } };
  const write = (key, value) => { try { storage && storage.setItem(prefix + key, value); } catch (_) { state.storageError = true; } };
  const parse = (text, fallback) => { try { return JSON.parse(text) || fallback; } catch (_) { return fallback; } };
  const api = options.api || github;
  const fetcher = options.fetcher || ((...args) => fetch(...args));
  let token = sample ? '' : read('token') || '';
  const state = { tracker: blankTracker(), dismissed: blankDismissed(), feed: { generatedAt: null, sources: [], jobs: [] }, directory: null, sweep: null, sync: 'local', lastVisit: read('lastVisit'), sample, loaded: false, lastSaved: null, error: '', storageError: false };
  const listeners = new Set();
  const dirty = { tracker: false, dismissed: false };
  const revisions = { tracker: 0, dismissed: 0 };
  const shas = { tracker: undefined, dismissed: undefined };
  let timer, saving = false, loading = false, disposed = false;
  const emit = () => listeners.forEach(fn => fn(state));
  const persist = () => { write('tracker', JSON.stringify(state.tracker)); write('dismissed', JSON.stringify(state.dismissed)); };
  function stamp() {
    return new Date(Math.max(Date.now(), Date.parse(state.tracker.updatedAt || '') + 1 || 0)).toISOString();
  }
  function save() {
    persist();
    clearTimeout(timer);
    if (token) { state.sync = 'saving'; timer = setTimeout(flush, 1500); }
    else state.sync = 'local';
    emit();
  }
  function changed(key) { dirty[key] = true; revisions[key]++; state.error = ''; save(); }
  async function jsonFile(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(path, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Could not load ' + path.split('?')[0]);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function failed(error) {
    state.sync = !error.status || [401, 403].includes(error.status) ? 'local' : 'error';
    state.error = [401, 403].includes(error.status) ? 'Token unavailable or expired. Your changes are saved on this device.' : 'Could not sync. Your changes are saved on this device; retry in Settings.';
    persist(); emit();
  }
  async function pull() {
    for (const key of ['tracker', 'dismissed']) {
      const file = await api.getFile(`data/${key}.json`, token);
      shas[key] = file ? file.sha : null;
      if (file) {
        const merged = key === 'tracker' ? mergeTrackers(state.tracker, file.json) : mergeDismissed(state.dismissed, file.json);
        state[key] = merged;
        if (JSON.stringify(merged) !== JSON.stringify(file.json)) { dirty[key] = true; revisions[key]++; }
      } else { dirty[key] = true; revisions[key]++; }
    }
    state.sync = 'synced'; state.error = '';
    persist(); emit();
    if (dirty.tracker || dirty.dismissed) save();
  }
  async function load() {
    loading = true;
    let cached = parse(read('tracker'), null);
    if (!cached || cached.version !== 1 || !Array.isArray(cached.jobs) || !Array.isArray(cached.reqs)) cached = null;
    if (cached) state.tracker = mergeTrackers(cached, blankTracker());
    const dismissed = parse(read('dismissed'), null);
    if (dismissed && Array.isArray(dismissed.items)) state.dismissed = dismissed;
    emit();
    await Promise.all([
      jsonFile(sample ? 'tests/app/fixtures/feed.sample.json' : 'data/feed.json?t=' + Date.now())
        .then(feed => { if (!Array.isArray(feed.jobs) || !Array.isArray(feed.sources)) throw new Error('Invalid feed'); state.feed = feed; emit(); })
        .catch(() => { state.feedError = 'The lookout is offline. Your saved leads are still aboard.'; emit(); }),
      jsonFile('data/directory.json?t=' + Date.now())
        .then(directory => {
          if (!Array.isArray(directory?.employers) || !directory.employers.every(e => e &&
            ['id', 'name', 'town', 'type', 'hiringMethod', 'phone', 'email', 'url', 'tip'].every(key => typeof e[key] === 'string') &&
            DIRECTORY_REGIONS.some(r => r.id === e.region) && ['top', 'more'].includes(e.tier))) throw new Error('Invalid directory');
          state.directory = directory; state.directoryError = ''; emit();
        }).catch(() => { state.directory = null; state.directoryError = 'Your saved notes and Voyage are still aboard. Reload to try the directory again.'; emit(); }),
      jsonFile('data/sweep.json?t=' + Date.now())
        .then(sweep => {
          if (!Array.isArray(sweep?.items) || !(sweep.sweptAt === null || (typeof sweep.sweptAt === 'string' && Number.isFinite(Date.parse(sweep.sweptAt))))) throw new Error('Invalid sweep');
          state.sweep = sweep; emit();
        }).catch(() => { state.sweep = null; emit(); }),
      !cached ? jsonFile('data/tracker.json').then(seed => { if (seed.version === 1 && Array.isArray(seed.jobs)) state.tracker = mergeTrackers(state.tracker, seed); emit(); }).catch(() => {}) : Promise.resolve(),
      !token ? jsonFile('data/dismissed.json').then(publicData => { state.dismissed = mergeDismissed(state.dismissed, publicData); }).catch(() => {}) : Promise.resolve()
    ]);
    if (token) { try { await pull(); } catch (error) { failed(error); } }
    state.loaded = true; loading = false;
    write('lastVisit', new Date().toISOString());
    persist(); emit();
    if (token && (dirty.tracker || dirty.dismissed) && state.sync !== 'local' && state.sync !== 'error') save();
  }
  async function flush() {
    clearTimeout(timer);
    if (!token || disposed) { state.sync = 'local'; emit(); return; }
    if (saving || loading) { timer = setTimeout(flush, 1500); return; }
    saving = true; state.sync = 'saving'; emit();
    const activeToken = token;
    try {
      for (const key of ['tracker', 'dismissed']) {
        if (!dirty[key]) continue;
        if (shas[key] === undefined) {
          const file = await api.getFile(`data/${key}.json`, activeToken);
          shas[key] = file ? file.sha : null;
          if (file) state[key] = key === 'tracker' ? mergeTrackers(state[key], file.json) : mergeDismissed(state[key], file.json);
        }
        let revision;
        for (let attempt = 0; attempt < 2; attempt++) {
          revision = revisions[key];
          const snapshot = JSON.parse(JSON.stringify(state[key]));
          try {
            shas[key] = await api.putFile(`data/${key}.json`, snapshot, shas[key], activeToken, `tracker: save ${key}`);
            if (revisions[key] === revision) dirty[key] = false;
            break;
          } catch (error) {
            if (attempt || ![409, 422].includes(error.status)) throw error;
            const remote = await api.getFile(`data/${key}.json`, activeToken);
            shas[key] = remote ? remote.sha : null;
            if (remote) state[key] = key === 'tracker' ? mergeTrackers(state[key], remote.json) : mergeDismissed(state[key], remote.json);
            persist(); emit();
          }
        }
      }
      state.sync = token ? 'synced' : 'local'; state.lastSaved = new Date().toISOString(); state.error = '';
      persist(); emit();
    } catch (error) { failed(error); }
    finally { saving = false; }
    if (token && state.sync === 'synced' && (dirty.tracker || dirty.dismissed)) save();
  }
  function updateJob(id, patch) {
    const job = state.tracker.jobs.find(j => j.id === id);
    if (!job) return;
    const now = stamp();
    const previousStage = job.stage;
    Object.assign(job, patch, { id, updatedAt: now });
    if (job.stage !== previousStage) {
      job.history = [...(job.history || []), { stage: job.stage, at: now }];
      if (job.stage === 'castoff' && !job.dateApplied) job.dateApplied = localToday();
    }
    state.tracker.updatedAt = now; changed('tracker');
  }
  function addJob(fields = {}) {
    const base = feedJobToTracker({}, fields.stage || 'dockside', localToday());
    const now = stamp();
    const job = { ...base, ...fields, id: base.id, createdAt: now, updatedAt: now, history: [{ stage: fields.stage || 'dockside', at: now }] };
    if (job.stage === 'castoff' && !job.dateApplied) job.dateApplied = localToday();
    state.tracker.jobs.push(job); state.tracker.updatedAt = now; changed('tracker'); return job;
  }
  function visibleFeed() {
    const saved = new Set(state.tracker.jobs.map(j => j.feedId).filter(Boolean));
    const dismissed = new Set(state.dismissed.items.map(j => j.id));
    const urls = new Set(state.dismissed.items.map(j => j.url).filter(Boolean));
    const companies = new Set(state.dismissed.items.filter(j => j.reason === 'company').map(j => j.company.toLowerCase()));
    return state.feed.jobs.filter(j => !saved.has(j.id) && !dismissed.has(j.id) && !urls.has(j.url) && !companies.has((j.company || '').toLowerCase()));
  }
  function directoryJob(employer) {
    return state.tracker.jobs.find(job => job.directoryId === employer.id ||
      job.company.toLowerCase() === employer.name.toLowerCase() ||
      (safeUrl(employer.url) && job.link === employer.url));
  }
  return {
    state, load, save, flush, updateJob, addJob, visibleFeed, directoryJob,
    updateDirectory(id, patch) {
      const previous = state.tracker.directory[id] || { status: 'not-yet', note: '' };
      const status = patch.status === undefined ? previous.status : patch.status;
      const note = patch.note === undefined ? previous.note : patch.note;
      if (!DIRECTORY_STATUSES.some(s => s.id === status) || typeof note !== 'string') throw new Error('Invalid directory entry');
      const now = stamp();
      state.tracker.directory = { ...state.tracker.directory, [id]: { status, note, updatedAt: now } };
      state.tracker.updatedAt = now; changed('tracker');
    },
    addDirectoryJob(employer) {
      const existing = directoryJob(employer);
      if (existing) return existing;
      return addJob({ directoryId: employer.id, company: employer.name, role: 'Ask about deckhand / dock crew',
        track: DIRECTORY_REGIONS.find(r => r.id === employer.region).track, location: employer.town,
        link: employer.url, contact: { name: '', phone: employer.phone, email: employer.email } });
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getToken: () => token,
    async setToken(value) {
      token = sample ? '' : value.trim(); write('token', token); clearTimeout(timer);
      if (!token) { state.sync = 'local'; state.error = ''; emit(); return; }
      state.sync = 'saving'; emit();
      try { await pull(); } catch (error) { failed(error); }
    },
    async retry() { if (!token) return; try { await pull(); await flush(); } catch (error) { failed(error); } },
    markFollowedUp(id) { updateJob(id, { stage: 'hailed', lastFollowUp: localToday() }); },
    saveFeedJob(feedJob, stage) {
      if (state.tracker.jobs.some(j => j.feedId === feedJob.id)) return;
      return addJob(feedJobToTracker(feedJob, stage, localToday()));
    },
    deleteJob(id) {
      const now = stamp(); state.tracker.jobs = state.tracker.jobs.filter(j => j.id !== id);
      state.tracker.deletedJobs = { ...state.tracker.deletedJobs, [id]: now }; state.tracker.updatedAt = now; changed('tracker');
    },
    dismiss(job, reason, note = '') {
      const item = { id: job.id, title: job.title, company: job.company, location: job.location, url: job.url, source: job.source, track: job.track, reason, note, dismissedAt: new Date().toISOString() };
      state.dismissed.items = [...state.dismissed.items.filter(j => j.id !== job.id), item]; changed('dismissed');
    },
    undoDismiss(id) {
      state.dismissed.items = state.dismissed.items.filter(j => j.id !== id);
      state.dismissed.removed = { ...state.dismissed.removed, [id]: new Date().toISOString() }; changed('dismissed');
    },
    updateRequirement(id, patch) {
      const req = state.tracker.reqs.find(r => r.id === id); if (!req) return;
      const now = stamp(); Object.assign(req, patch, { id, updatedAt: now }); state.tracker.updatedAt = now; changed('tracker');
    },
    updateSettings(patch) { Object.assign(state.tracker.settings, patch); state.tracker.updatedAt = stamp(); changed('tracker'); },
    importTracker(value) {
      if (!validateTracker(value)) throw new Error('Choose a valid Crow’s Nest version 1 tracker export.');
      state.tracker = mergeTrackers(state.tracker, value); state.tracker.updatedAt = stamp(); changed('tracker');
    },
    dispose() { disposed = true; clearTimeout(timer); listeners.clear(); }
  };
}
