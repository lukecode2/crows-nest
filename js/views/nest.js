import { TRACKS, DISMISS_REASONS } from '../config.js';
import { safeUrl } from '../logic.js';
import { dispatchFeed } from '../github.js';
import { h, button, trackChip, pageHeading, empty, ago, toast, field } from '../ui.js';
export function nest(store, ui) {
  const all = store.visibleFeed();
  const isNew = job => !store.state.lastVisit || Date.parse(job.firstSeenAt) > Date.parse(store.state.lastVisit);
  const list = h('div', { class: 'feed-grid' });
  const count = h('span', { class: 'results-count muted small', role: 'status' });
  const chips = h('div', { class: 'filter-chips', 'aria-label': 'Filter by track' });
  function draw() {
    chips.replaceChildren(...[{ id: 'all', label: 'All waters' }, ...TRACKS].map(track => button('', () => { ui.track = track.id; draw(); }, 'filter-chip ' + (ui.track === track.id ? 'selected' : ''), { 'aria-pressed': ui.track === track.id, style: track.color ? { '--track': track.color } : {} })).map((el, i) => {
      const track = [{ id: 'all', label: 'All waters' }, ...TRACKS][i];
      el.append(h('span', {}, track.label), h('span', { class: 'chip-count' }, track.id === 'all' ? all.length : all.filter(j => j.track === track.id).length)); return el;
    }));
    const query = ui.search.toLowerCase().trim();
    const jobs = all.filter(j => (ui.track === 'all' || j.track === ui.track) && (!ui.newOnly || isNew(j)) && (!ui.fastOnly || (j.flags || []).includes('starts-fast')) &&
      (!query || [j.title, j.company, j.location, j.snippet].join(' ').toLowerCase().includes(query)))
      .sort((a, b) => ui.sort === 'newest' ? (b.postedAt || b.firstSeenAt || '').localeCompare(a.postedAt || a.firstSeenAt || '') : (b.score || 0) - (a.score || 0));
    count.textContent = `${jobs.length} ${jobs.length === 1 ? 'opportunity' : 'opportunities'} on the horizon`;
    list.replaceChildren(...jobs.map(job => jobCard(job)));
    if (!jobs.length) list.append(empty('⚑', all.length ? 'Clear waters for these filters.' : store.state.feed.jobs.length ? 'This catch is safely sorted.' : 'The lookout hasn’t reported yet',
      all.length ? 'Try another track or broaden your search.' : store.state.feed.jobs.length ? 'You’ve sorted this catch. Your saved jobs are in The Voyage.' : 'The lookout hasn’t reported yet — first run lands within a few hours, or tap Refresh now.'));
  }
  function jobCard(job) {
    const score = Math.max(0, Math.min(100, Number(job.score) || 0));
    const title = safeUrl(job.url) ? h('a', { href: job.url, target: '_blank', rel: 'noopener noreferrer' }, job.title, h('span', { class: 'external-arrow', 'aria-hidden': 'true' }, '↗')) : h('span', {}, job.title);
    const card = h('article', { class: 'job-card' }, h('div', { class: 'section-top card-top' }, trackChip(job.track), isNew(job) && h('span', { class: 'new-badge' }, 'NEW')),
      h('h2', {}, title), h('p', { class: 'job-company' }, job.company), h('p', { class: 'muted small' }, [job.location, job.remote ? 'Remote' : null].filter(Boolean).join(' · ')),
      job.pay && h('p', { class: 'job-pay' }, job.pay), job.snippet && h('p', { class: 'job-snippet' }, job.snippet),
      h('div', { class: 'job-flags' }, ...(job.flags || []).map(flag => {
        const labels = { 'needs-twic': 'TWIC', 'needs-mmc': 'MMC', 'needs-eng1': 'ENG1', 'drug-test': 'Drug test', 'entry-level': 'Entry level', 'page-changed': 'Page updated', 'far-away': 'Far away', 'live-aboard': 'Live aboard', 'high-pay': 'High pay', 'pay-unknown': 'Pay unknown', 'starts-fast': 'Starts fast' };
        const credential = ['needs-twic', 'needs-mmc', 'needs-eng1', 'drug-test'].includes(flag);
        return h(credential ? 'a' : 'span', { ...(credential ? { route: 'papers' } : {}), class: 'flag-chip' + (['high-pay', 'starts-fast'].includes(flag) ? ' flag-good' : flag === 'pay-unknown' ? ' flag-muted' : '') }, labels[flag] || flag);
      })),
      h('div', { class: 'match-row' }, h('span', { class: 'score-line', role: 'meter', 'aria-label': 'Match score', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': score }, h('i', { style: { width: score + '%' } })), h('span', { class: 'small muted' }, `${score} match`)),
      h('p', { class: 'job-source small muted' }, `${job.source || 'Direct'} · ${ago(job.postedAt || job.firstSeenAt)}`),
      h('div', { class: 'card-actions' }, button('Save', () => { store.saveFeedJob(job, 'dockside'); toast('Safely docked. Find it in The Voyage.'); }, 'button secondary'), button('Applied', () => { store.saveFeedJob(job, 'castoff'); toast('Cast off! Application added to this week’s voyage.'); }, 'button primary'), button('Dismiss', e => dismissPanel(card, job, e.currentTarget), 'button quiet')));
    return card;
  }
  function dismissPanel(card, job, trigger) {
    if (card.querySelector('.dismiss-panel')) return;
    let reason = 'not-interested';
    const note = h('textarea', { rows: 2, placeholder: 'Optional note for future you…', maxlength: 2000 });
    const reasons = h('div', { class: 'reason-chips', role: 'group', 'aria-label': 'Dismiss reason' });
    function drawReasons() {
      reasons.replaceChildren(...DISMISS_REASONS.map(r => button(r.label, () => { reason = r.id; drawReasons(); }, 'reason-chip ' + (reason === r.id ? 'selected' : ''), { 'aria-pressed': reason === r.id })));
    }
    const panel = h('div', { class: 'dismiss-panel' }, h('h3', {}, 'Let this one sail?'), h('p', { class: 'small muted' }, 'Your reason helps keep the next catch relevant.'), reasons, field('Add a note', note),
      h('div', { class: 'button-row' }, button('Dismiss job', () => {
        store.dismiss(job, reason, note.value.trim()); toast('Job dismissed.', { label: 'Undo', run: () => store.undoDismiss(job.id) });
      }, 'button danger'), button('Keep it', () => { panel.remove(); trigger.focus(); }, 'button secondary')));
    drawReasons(); card.append(panel); reasons.querySelector('button').focus();
  }
  const search = h('input', { type: 'search', placeholder: 'Search roles, companies, places…', value: ui.search, onInput: e => { ui.search = e.target.value; draw(); } });
  const sort = h('select', { onChange: e => { ui.sort = e.target.value; draw(); } }, h('option', { value: 'score', selected: ui.sort === 'score' }, 'Best match'), h('option', { value: 'newest', selected: ui.sort === 'newest' }, 'Newest'));
  const sources = store.state.feed.sources;
  const healthy = sources.filter(s => s.ok).length;
  const refresh = button('↻ Refresh now', async () => {
    if (!store.getToken()) { toast(store.state.sample ? 'Sample feed stays local. Return to the live feed to refresh.' : 'Add a GitHub token in Settings to send the lookout.'); if (!store.state.sample) location.hash = 'settings'; return; }
    refresh.disabled = true;
    try { await dispatchFeed(store.getToken()); toast('Lookout sent — new jobs in ~2 min'); }
    catch (_) { toast('Could not send the lookout. Check your token’s Actions permission in Settings.'); }
    finally { refresh.disabled = false; }
  }, 'button secondary small-button');
  const health = h('footer', { class: 'source-health panel' }, h('div', { class: 'section-top' }, h('details', {}, h('summary', {}, `${store.state.feed.generatedAt ? 'Updated ' + ago(store.state.feed.generatedAt) : 'Awaiting first report'} · ${healthy}/${sources.length} sources OK`),
    h('ul', { class: 'source-list' }, ...sources.map(source => h('li', {}, h('span', { class: source.ok ? 'foam-text' : 'flare-text' }, source.ok ? '●' : '○'), h('strong', {}, source.name), h('span', { class: 'muted' }, source.ok ? `${source.count} jobs` : source.error || 'Unavailable'))))), refresh), store.state.feedError && h('p', { class: 'flare-text small' }, store.state.feedError));
  draw();
  return h('div', { class: 'view nest-view' }, pageHeading('THE LOOKOUT', 'Crow’s Nest', 'Six waters to explore. Your next opportunity is out there.'),
    h('section', { class: 'feed-controls', 'aria-label': 'Feed filters' }, chips, h('div', { class: 'search-row' }, field('Search the horizon', search, 'search-field'), field('Sort by', sort), h('label', { class: 'check-label new-toggle' }, h('input', { type: 'checkbox', checked: ui.newOnly, onChange: e => { ui.newOnly = e.target.checked; draw(); } }), 'New only'),
      h('label', { class: 'check-label new-toggle' }, h('input', { type: 'checkbox', checked: ui.fastOnly, onChange: e => { ui.fastOnly = e.target.checked; draw(); } }), 'Starts fast'))),
    count, list, health);
}
