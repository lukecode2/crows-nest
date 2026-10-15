import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../js/logic.js';

const job = (o) => ({ id: Math.random().toString(36), stage: 'castoff', dateApplied: null, lastFollowUp: null, history: [], ...o });

test('weekStart is Monday; Sunday belongs to previous Monday', () => {
  assert.equal(L.weekStart('2026-10-15'), '2026-10-12'); // Thursday
  assert.equal(L.weekStart('2026-10-18'), '2026-10-12'); // Sunday
  assert.equal(L.weekStart('2026-10-19'), '2026-10-19'); // Monday
});
test('appsInWeek counts Mon..Sun', () => {
  const jobs = [job({ dateApplied: '2026-10-12' }), job({ dateApplied: '2026-10-18' }), job({ dateApplied: '2026-10-11' }), job({ stage: 'dockside' })];
  assert.equal(L.appsInWeek(jobs, '2026-10-15'), 2);
});
test('streak counts consecutive weeks at goal', () => {
  const mk = (d, n) => Array.from({ length: n }, () => job({ dateApplied: d }));
  const jobs = [...mk('2026-09-29', 2), ...mk('2026-10-06', 2), ...mk('2026-10-13', 1)];
  assert.equal(L.streak(jobs, '2026-10-15', 2), 2);        // weeks of 9/28 and 10/5; current week not yet
  assert.equal(L.streak([...jobs, job({ dateApplied: '2026-10-14' })], '2026-10-15', 2), 3);
  assert.equal(L.streak(mk('2026-09-22', 2), '2026-10-15', 2), 0); // gap breaks it
});
test('overdue: castoff/hailed waiting >= 7 days since last touch', () => {
  const a = job({ dateApplied: '2026-10-05' });
  const b = job({ dateApplied: '2026-10-01', lastFollowUp: '2026-10-12', stage: 'hailed' });
  const c = job({ dateApplied: '2026-10-01', stage: 'boarding' });
  const out = L.overdue([a, b, c], '2026-10-15');
  assert.deepEqual(out.map(j => j.id), [a.id]);
  assert.equal(out[0].daysWaiting, 10);
});
test('nextActions sorted by due date, skips closed', () => {
  const jobs = [job({ nextAction: 'b', nextDue: '2026-10-20' }), job({ nextAction: 'a', nextDue: '2026-10-16' }), job({ nextAction: 'x', nextDue: '2026-10-01', stage: 'lost' }), job({ nextAction: 'c', nextDue: '2026-10-25' }), job({ nextAction: 'd', nextDue: '2026-10-30' })];
  assert.deepEqual(L.nextActions(jobs).map(j => j.nextAction), ['a', 'b', 'c']);
});
test('countdown phases', () => {
  const show = { start: '2026-10-28', end: '2026-11-01' };
  assert.deepEqual(L.countdown('2026-10-15', show), { phase: 'before', days: 13 });
  assert.equal(L.countdown('2026-10-30', show).phase, 'during');
  assert.equal(L.countdown('2026-11-02', show).phase, 'after');
});
test('safeUrl rejects javascript: and data:', () => {
  assert.equal(L.safeUrl('javascript:alert(1)'), null);
  assert.equal(L.safeUrl('data:text/html,x'), null);
  assert.equal(L.safeUrl('https://ok.com/a'), 'https://ok.com/a');
  assert.equal(L.safeUrl('not a url'), null);
});
test('feedJobToTracker maps flags to reqs and sets applied date', () => {
  const t = L.feedJobToTracker({ id: 'f1', title: 'Deckhand', company: 'A', track: 'marine-chs', location: 'Charleston', url: 'https://a', pay: '', flags: ['needs-twic', 'drug-test'] }, 'castoff', '2026-10-15');
  assert.equal(t.feedId, 'f1'); assert.equal(t.dateApplied, '2026-10-15'); assert.deepEqual(t.reqs.sort(), ['drug', 'twic']);
});
test('mergeTrackers keeps newer job edits from both sides', () => {
  const local = { updatedAt: '2026-10-15T10:00:00Z', settings: { weeklyGoal: 10 }, reqs: [], jobs: [{ id: '1', notes: 'local new', updatedAt: '2026-10-15T10:00:00Z' }, { id: '2', notes: 'only local', updatedAt: '2026-10-15T09:00:00Z' }] };
  const remote = { updatedAt: '2026-10-15T11:00:00Z', settings: { weeklyGoal: 12 }, reqs: [], jobs: [{ id: '1', notes: 'remote old', updatedAt: '2026-10-15T08:00:00Z' }, { id: '3', notes: 'only remote', updatedAt: '2026-10-15T08:00:00Z' }] };
  const m = L.mergeTrackers(local, remote);
  assert.deepEqual(m.jobs.map(j => j.id).sort(), ['1', '2', '3']);
  assert.equal(m.jobs.find(j => j.id === '1').notes, 'local new');
  assert.equal(m.settings.weeklyGoal, 12);
});

test('date arithmetic stays correct across daylight saving changes', () => {
  assert.equal(L.daysBetween('2026-10-31', '2026-11-02'), 2);
  assert.equal(L.addDays('2026-03-07', 2), '2026-03-09');
});
test('totals include historical interviews; new counts cover all tracks', () => {
  assert.deepEqual(L.totals([job({ dateApplied: '2026-10-12', stage: 'lost', history: [{ stage: 'boarding' }] }), job({ stage: 'hired' })]), { applied: 1, interviews: 2, offers: 1 });
  const counts = L.newSince([{ track: 'ai-web', firstSeenAt: '2026-10-15T10:00:00Z' }], '2026-10-14T10:00:00Z');
  assert.equal(counts['ai-web'], 1);
  assert.equal(counts['marine-local'], 0);
});
test('merging empty or stale remote data preserves local jobs and newer requirements', () => {
  const local = { jobs: [{ id: 'x', createdAt: '2026-10-15', notes: 'Keep me' }], reqs: [{ id: 'twic', done: true, updatedAt: '2026-10-15' }], settings: { weeklyGoal: 10 }, updatedAt: '2026-10-15' };
  const remote = { jobs: [], reqs: [{ id: 'twic', done: false, updatedAt: '2026-10-14' }], settings: {}, updatedAt: '2026-10-14' };
  const merged = L.mergeTrackers(local, remote);
  assert.equal(merged.jobs[0].notes, 'Keep me');
  assert.equal(merged.reqs[0].done, true);
});
test('merge compares instants correctly when ISO timestamps omit milliseconds', () => {
  const older = { updatedAt: '2026-10-15T10:00:00Z', settings: { weeklyGoal: 8 }, jobs: [{ id: 'x', updatedAt: '2026-10-15T10:00:00Z', notes: 'older' }], reqs: [] };
  const newer = { updatedAt: '2026-10-15T10:00:00.001Z', settings: { weeklyGoal: 12 }, jobs: [{ id: 'x', updatedAt: '2026-10-15T10:00:00.001Z', notes: 'newer' }], reqs: [] };
  const merged = L.mergeTrackers(newer, older);
  assert.equal(merged.jobs[0].notes, 'newer');
  assert.equal(merged.settings.weeklyGoal, 12);
});
