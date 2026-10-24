import { localToday, nextLocalMidnight } from './logic.js';
export function createDayClock(render, { now = () => new Date(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  let day = localToday(now()), timer;
  function check() {
    const date = now(), today = localToday(date);
    if (today !== day) { day = today; render(); }
    cancel(timer);
    timer = schedule(check, nextLocalMidnight(date).getTime() - date.getTime() + 50);
  }
  check();
  return { check, stop() { cancel(timer); } };
}
