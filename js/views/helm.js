import { BOAT_SHOW, TRACKS } from '../config.js';
import { appsInWeek, streak, totals, overdue, nextActions, newSince, countdown, localToday, weekStart, addDays, weeklySweepDue } from '../logic.js';
import { h, button, empty, dateLabel, waves, toast } from '../ui.js';
export function helm(store, viewState) {
  const { tracker } = store.state, today = localToday(), goal = tracker.settings.weeklyGoal;
  const applied = appsInWeek(tracker.jobs, today), run = streak(tracker.jobs, today, goal), total = totals(tracker.jobs);
  const copy = applied >= goal ? 'Goal hit!' : applied === 0 ? 'None yet this week' : applied >= goal / 2 ? 'Over halfway' : 'Good start';
  const pennants = Array.from({ length: 10 }, (_, i) => h('span', { class: `pennant pennant-${i % 5} ${applied >= Math.ceil((i + 1) * goal / 10) ? 'lit' : ''}`, 'aria-hidden': 'true' }, h('i', {})));
  const greeting = h('div', { class: 'helm-greeting' }, h('p', {}, 'Apply to a few jobs today. Every one counts.'), waves());
  const weekly = h('section', { class: 'panel weekly-panel' },
    h('div', { class: 'section-top' }, h('h1', { class: 'eyebrow' }, 'THIS WEEK’S APPLICATIONS'), h('span', { class: 'muted small' }, dateLabel(weekStart(today)) + ' — ' + dateLabel(addDays(weekStart(today), 6)))),
    h('div', { class: 'weekly-numbers' }, h('strong', {}, applied), h('span', {}, '/ ' + goal, h('small', {}, 'applications this week'))),
    h('div', { class: 'signal-flags', role: 'progressbar', 'aria-label': 'Weekly applications', 'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': Math.min(applied, goal), 'aria-valuetext': `${applied} of ${goal} applications` }, ...pennants),
    h('div', { class: 'section-top progress-copy' }, h('strong', {}, copy), h('span', { class: 'muted small' }, applied >= goal ? 'Nice work this week.' : `${Math.max(0, goal - applied)} more to hit your goal`)));
  const stats = h('section', { class: 'stats-grid', 'aria-label': 'Your numbers' },
    h('div', { class: 'stat streak-stat' }, h('span', { class: 'stat-icon', 'aria-hidden': 'true' }, run ? '🔥' : '⚑'), h('strong', {}, run ? `${run}-week streak` : 'Start a streak'), h('span', {}, 'Hit your weekly goal. Keep it going.')),
    ...[[total.applied, 'Total applied'], [total.interviews, 'Interviews'], [total.hired, 'Hired']].map(([count, label]) => h('div', { class: 'stat' }, h('strong', { class: 'stat-number' }, count), h('span', {}, label))));
  const waiting = overdue(tracker.jobs, today, tracker.settings.followUpDays || 7);
  const hails = h('section', { class: 'panel' }, h('div', { class: 'section-top' }, h('h2', {}, 'Follow-ups due'), h('span', { class: 'count-pill flare' }, waiting.length)),
    waiting.length ? h('div', { class: 'list' }, ...waiting.map(job => h('div', { class: 'action-row overdue-row' }, h('div', {}, h('strong', {}, job.company), h('p', {}, job.role), h('small', { class: 'flare-text' }, `${job.lastFollowUp ? 'Last follow-up' : 'Applied'} ${job.daysWaiting}d ago`)),
      button('Followed up ✓', () => { store.markFollowedUp(job.id); toast('Follow-up logged.'); }, 'button secondary small-button')))) : empty('⚓', 'No follow-ups due.', 'When a follow-up is due, it’ll surface here.'));
  const next = nextActions(tracker.jobs);
  const headings = h('section', { class: 'panel' }, h('div', { class: 'section-top' }, h('h2', {}, 'To do next'), h('span', { class: 'eyebrow' }, 'YOUR NEXT 3')),
    next.length ? h('ol', { class: 'headings-list' }, ...next.map((job, i) => h('li', { class: 'action-row' }, h('span', { class: 'heading-number' }, String(i + 1).padStart(2, '0')), h('div', {}, h('strong', {}, job.nextAction), h('p', { class: 'muted small' }, job.company)), h('span', { class: 'due-date ' + (job.nextDue < today ? 'flare-text' : '') }, dateLabel(job.nextDue))))) : empty('↗', 'Nothing planned yet.', 'Open a job in My Jobs and add a next step with a date.'));
  const counts = newSince(store.visibleFeed(), store.state.lastVisit);
  const catches = h('section', { class: 'panel catches-panel' }, h('div', { class: 'section-top' }, h('div', {}, h('h2', {}, 'New jobs'), h('p', { class: 'muted small' }, 'Added since your last visit. Tap a group to see them.')), h('a', { route: 'nest', class: 'text-link' }, 'View all ↗')),
    h('div', { class: 'catch-grid' }, ...TRACKS.map(track => button('', () => { viewState.track = track.id; location.hash = 'nest'; }, 'catch-card', { 'aria-label': `${track.label}: ${counts[track.id]} new jobs` })).map((el, i) => { const track = TRACKS[i]; el.style.setProperty('--track', track.color); el.append(h('span', { class: 'catch-icon', 'aria-hidden': 'true' }, ['⚓', '≋', '⛵', '⌘', '↗', 'ϟ'][i]), h('strong', {}, counts[track.id]), h('span', {}, track.label)); return el; })));
  const show = countdown(today, BOAT_SHOW);
  const boatShow = show.phase !== 'after' && h('aside', { class: 'boat-show' }, h('span', { class: 'show-icon', 'aria-hidden': 'true' }, '⚑'), h('div', {}, h('p', { class: 'eyebrow' }, 'FORT LAUDERDALE · OCT 28 — NOV 1, 2026'), h('h2', {}, show.phase === 'before' ? `FLIBS starts in ${show.days} days — line up crew agencies now and confirm paid day work before you go.` : 'FLIBS is on — confirm paid day work before you go'), h('p', {}, 'A good crew starts with a conversation. Have your resume ready.')), h('a', { route: 'papers', class: 'button secondary' }, 'Certificates ↗'));
  const sweep = weeklySweepDue(store.state.sweep) && h('aside', { class: 'panel sweep-reminder' },
    h('h2', {}, 'Weekly sweep due'), h('p', {}, 'Open Claude Code in ~/crows-nest and type /weekly-sweep'));
  return h('div', { class: 'helm-view view' }, h('div', { class: 'weekly-grid' }, weekly, stats), greeting, sweep, h('div', { class: 'two-column' }, hails, headings), catches, boatShow);
}
