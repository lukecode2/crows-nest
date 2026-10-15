import { BOAT_SHOW, TRACKS } from '../config.js';
import { appsInWeek, streak, totals, overdue, nextActions, newSince, countdown, localToday, weekStart, addDays } from '../logic.js';
import { h, button, trackChip, pageHeading, empty, dateLabel, waves, toast } from '../ui.js';
export function helm(store, viewState) {
  const { tracker } = store.state, today = localToday(), goal = tracker.settings.weeklyGoal;
  const applied = appsInWeek(tracker.jobs, today), run = streak(tracker.jobs, today, goal), total = totals(tracker.jobs);
  const copy = applied >= goal ? 'Full sail — goal hit!' : applied === 0 ? 'Anchors aweigh — 0 so far' : applied >= goal / 2 ? 'Halfway to port' : 'Making way';
  const pennants = Array.from({ length: 10 }, (_, i) => h('span', { class: `pennant pennant-${i % 5} ${applied >= Math.ceil((i + 1) * goal / 10) ? 'lit' : ''}`, 'aria-hidden': 'true' }, h('i', {})));
  const hero = h('section', { class: 'helm-hero' },
    h('div', { class: 'hero-copy' }, h('p', { class: 'eyebrow' }, 'CAPTAIN’S LOG · ' + new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()),
      h('h1', {}, 'A new heading.', h('br'), h('span', {}, 'A little more horizon.')),
      h('p', { class: 'lede' }, 'Find your next opportunity. Make your move. Keep making way.'),
      h('a', { route: 'nest', class: 'button primary' }, 'Scan the horizon', h('span', { 'aria-hidden': 'true' }, '↗'))),
    h('div', { class: 'compass', 'aria-hidden': 'true' }, h('span', { class: 'compass-n' }, 'N'), h('span', { class: 'compass-e' }, 'E'), h('span', { class: 'compass-s' }, 'S'), h('span', { class: 'compass-w' }, 'W'), h('div', { class: 'compass-rose' }), h('span', { class: 'compass-center' }, '⚓')),
    waves());
  const weekly = h('section', { class: 'panel weekly-panel' },
    h('div', { class: 'section-top' }, h('p', { class: 'eyebrow' }, 'THIS WEEK’S VOYAGE'), h('span', { class: 'muted small' }, dateLabel(weekStart(today)) + ' — ' + dateLabel(addDays(weekStart(today), 6)))),
    h('div', { class: 'weekly-numbers' }, h('strong', {}, applied), h('span', {}, '/ ' + goal, h('small', {}, 'applications this week'))),
    h('div', { class: 'signal-flags', role: 'progressbar', 'aria-label': 'Weekly applications', 'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': Math.min(applied, goal), 'aria-valuetext': `${applied} of ${goal} applications` }, ...pennants),
    h('div', { class: 'section-top progress-copy' }, h('strong', {}, copy), h('span', { class: 'muted small' }, applied >= goal ? 'A week well sailed.' : `${Math.max(0, goal - applied)} more to make port`)));
  const stats = h('section', { class: 'stats-grid', 'aria-label': 'Voyage statistics' },
    h('div', { class: 'stat streak-stat' }, h('span', { class: 'stat-icon', 'aria-hidden': 'true' }, run ? '🔥' : '⚑'), h('strong', {}, run ? `${run}-week streak` : 'Start a streak'), h('span', {}, 'Hit your weekly goal. Keep it going.')),
    ...[[total.applied, 'Total applied'], [total.interviews, 'Interviews'], [total.offers, 'Offers aboard']].map(([count, label]) => h('div', { class: 'stat' }, h('strong', { class: 'stat-number' }, count), h('span', {}, label))));
  const waiting = overdue(tracker.jobs, today, tracker.settings.followUpDays || 7);
  const hails = h('section', { class: 'panel' }, h('div', { class: 'section-top' }, h('h2', {}, 'Overdue hails'), h('span', { class: 'count-pill flare' }, waiting.length)),
    waiting.length ? h('div', { class: 'list' }, ...waiting.map(job => h('div', { class: 'action-row overdue-row' }, h('div', {}, h('strong', {}, job.company), h('p', {}, job.role), h('small', { class: 'flare-text' }, `${job.lastFollowUp ? 'Last hail' : 'Applied'} ${job.daysWaiting}d ago`)),
      button('Hailed ✓', () => { store.markFollowedUp(job.id); toast('Follow-up logged. A good hail goes a long way.'); }, 'button secondary small-button')))) : empty('⚓', 'No one’s waiting on you.', 'When a follow-up is due, it’ll surface here.'));
  const next = nextActions(tracker.jobs);
  const headings = h('section', { class: 'panel' }, h('div', { class: 'section-top' }, h('h2', {}, 'Next headings'), h('span', { class: 'eyebrow' }, 'YOUR NEXT 3')),
    next.length ? h('ol', { class: 'headings-list' }, ...next.map((job, i) => h('li', { class: 'action-row' }, h('span', { class: 'heading-number' }, String(i + 1).padStart(2, '0')), h('div', {}, h('strong', {}, job.nextAction), h('p', { class: 'muted small' }, job.company)), h('span', { class: 'due-date ' + (job.nextDue < today ? 'flare-text' : '') }, dateLabel(job.nextDue))))) : empty('↗', 'Chart your next move.', 'Add an action and due date to a job in The Voyage.'));
  const counts = newSince(store.visibleFeed(), store.state.lastVisit);
  const catches = h('section', { class: 'panel catches-panel' }, h('div', { class: 'section-top' }, h('div', {}, h('h2', {}, 'New in the Crow’s Nest'), h('p', { class: 'muted small' }, 'Fresh possibilities since your last visit.')), h('a', { route: 'nest', class: 'text-link' }, 'View all ↗')),
    h('div', { class: 'catch-grid' }, ...TRACKS.map(track => button('', () => { viewState.track = track.id; location.hash = 'nest'; }, 'catch-card', { 'aria-label': `${track.label}: ${counts[track.id]} new jobs` })).map((el, i) => { const track = TRACKS[i]; el.style.setProperty('--track', track.color); el.append(h('span', { class: 'catch-icon', 'aria-hidden': 'true' }, ['⚓', '≋', '⛵', '⌘', '↗', 'ϟ'][i]), h('strong', {}, counts[track.id]), h('span', {}, track.label)); return el; })));
  const show = countdown(today, BOAT_SHOW);
  const boatShow = show.phase !== 'after' && h('aside', { class: 'boat-show' }, h('span', { class: 'show-icon', 'aria-hidden': 'true' }, '⚑'), h('div', {}, h('p', { class: 'eyebrow' }, 'FORT LAUDERDALE · OCT 28 — NOV 1, 2026'), h('h2', {}, show.phase === 'before' ? `${show.days} days to FLIBS — arrive early for day work` : 'Show is on — walk the docks'), h('p', {}, 'A good crew starts with a conversation. Have your resume ready.')), h('a', { route: 'papers', class: 'button secondary' }, 'Get shipshape ↗'));
  return h('div', { class: 'helm-view view' }, hero, h('div', { class: 'weekly-grid' }, weekly, stats), h('div', { class: 'two-column' }, hails, headings), catches, boatShow);
}
