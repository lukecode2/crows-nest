import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDayClock } from '../../js/day-clock.js';
test('midnight timer and visible-tab checks rerender only on a new local day', () => {
  let date = new Date(2026, 9, 24, 23, 59), renders = 0, callback, delay, cancelled;
  const clock = createDayClock(() => renders++, { now: () => date, schedule: (fn, ms) => { callback = fn; delay = ms; return 'timer'; }, cancel: id => { cancelled = id; } });
  assert.equal(delay, 60050); clock.check(); assert.equal(renders, 0);
  date = new Date(2026, 9, 25, 0, 0); callback(); assert.equal(renders, 1);
  assert.equal(delay, 86400050); clock.check(); assert.equal(renders, 1);
  date = new Date(2026, 9, 27, 9); clock.check(); assert.equal(renders, 2);
  clock.stop(); assert.equal(cancelled, 'timer');
});
