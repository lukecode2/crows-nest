import { TRACKS, DISMISS_REASONS } from '../config.js';
import { safeUrl, pitchFor } from '../logic.js';
import { h, button, trackChip, pageHeading, empty, ago, toast, field } from '../ui.js';
export function nest(store, ui) {
  const all = store.visibleFeed();
  // Phone alerts link here as #nest?job=<id> (one job) or #nest?alerts=1 (several).
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const focusId = params.get('job');
  const showAlerts = params.get('alerts') === '1';
  if ((focusId || showAlerts) && ui.from !== location.hash) { Object.assign(ui, { track: 'all', search: '', newOnly: false, fastOnly: false, top10: false, from: location.hash }); }
  const alerts = store.state.feed.alerts || [];
  const alerted = new Set(alerts.map(a => a.id));
  const savedIds = new Set(store.state.tracker.jobs.map(j => j.feedId).filter(Boolean));
  const visibleIds = new Set(all.map(j => j.id));
  const feedIds = new Set(store.state.feed.jobs.map(j => j.id));
  const alertStatus = id => visibleIds.has(id) ? 'listed' : savedIds.has(id) ? 'saved' : feedIds.has(id) ? 'dismissed' : 'gone';
  const isNew = job => !store.state.lastVisit || Date.parse(job.firstSeenAt) > Date.parse(store.state.lastVisit);
  const list = h('div', { class: 'feed-grid' });
  const count = h('span', { class: 'results-count muted small', role: 'status' });
  const chips = h('div', { class: 'filter-chips', 'aria-label': 'Filter by track' });
  const topToggle = button('', () => { ui.top10 = !ui.top10; draw(); }, 'button top-toggle');
  function draw() {
    topToggle.textContent = ui.top10 ? 'Showing your top 10 · Show all jobs' : '★ Show only my top 10';
    topToggle.className = 'button top-toggle ' + (ui.top10 ? 'secondary' : 'primary');
    chips.replaceChildren(...[{ id: 'all', label: 'All' }, ...TRACKS].map(track => button('', () => { ui.track = track.id; draw(); }, 'filter-chip ' + (ui.track === track.id ? 'selected' : ''), { 'aria-pressed': ui.track === track.id, style: track.color ? { '--track': track.color } : {} })).map((el, i) => {
      const track = [{ id: 'all', label: 'All' }, ...TRACKS][i];
      el.append(h('span', {}, track.label), h('span', { class: 'chip-count' }, track.id === 'all' ? all.length : all.filter(j => j.track === track.id).length)); return el;
    }));
    const query = ui.search.toLowerCase().trim();
    let jobs = all.filter(j => (ui.track === 'all' || j.track === ui.track) && (!ui.newOnly || isNew(j)) && (!ui.fastOnly || (j.flags || []).includes('starts-fast')) &&
      (!query || [j.title, j.company, j.location, j.snippet].join(' ').toLowerCase().includes(query)))
      .sort((a, b) => (b.id === focusId) - (a.id === focusId) || (ui.sort === 'newest' ? (b.postedAt || b.firstSeenAt || '').localeCompare(a.postedAt || a.firstSeenAt || '') : (b.score || 0) - (a.score || 0)));
    const total = jobs.length;
    if (ui.top10) jobs = [...jobs].sort((a, b) => (b.id === focusId) - (a.id === focusId) || (b.score || 0) - (a.score || 0)).slice(0, 10);
    count.textContent = ui.top10 && total > jobs.length ? `Top ${jobs.length} of ${total} jobs` : `${total} ${total === 1 ? 'job' : 'jobs'}`;
    list.replaceChildren(...jobs.map(job => jobCard(job)));
    if (!jobs.length) list.append(empty('⚑', all.length ? 'No jobs match these filters.' : store.state.feed.jobs.length ? 'You’ve gone through every job.' : 'No jobs loaded yet',
      all.length ? 'Try another group or clear the search.' : store.state.feed.jobs.length ? 'Your saved jobs are in My Jobs. New ones arrive 3 times a day.' : 'The job robot runs 3 times a day, or tap Refresh now.'));
  }
  function jobCard(job) {
    const score = Math.max(0, Math.min(100, Number(job.score) || 0));
    const title = safeUrl(job.url) ? h('a', { href: job.url, target: '_blank', rel: 'noopener noreferrer' }, job.title, h('span', { class: 'external-arrow', 'aria-hidden': 'true' }, '↗')) : h('span', {}, job.title);
    const card = h('article', { class: 'job-card' + (job.id === focusId ? ' focused' : ''), 'data-id': job.id }, h('div', { class: 'section-top card-top' }, trackChip(job.track), h('span', { class: 'card-badges' }, alerted.has(job.id) && h('span', { class: 'new-badge alert-badge' }, 'ALERTED'), isNew(job) && h('span', { class: 'new-badge' }, 'NEW'))),
      h('h2', {}, title), h('p', { class: 'job-company' }, job.company), h('p', { class: 'muted small' }, [job.location, job.remote ? 'Remote' : null].filter(Boolean).join(' · ')),
      job.pay && h('p', { class: 'job-pay' }, job.pay), job.snippet && h('p', { class: 'job-snippet' }, job.snippet),
      h('div', { class: 'job-flags' }, ...(job.flags || []).map(flag => {
        const labels = { 'needs-twic': 'TWIC', 'needs-mmc': 'MMC', 'needs-eng1': 'ENG1', 'drug-test': 'Drug test', 'entry-level': 'Entry level', 'page-changed': 'Page updated', 'far-away': 'Far away', 'live-aboard': 'Live aboard', 'high-pay': 'High pay', 'pay-unknown': 'Pay unknown', 'starts-fast': 'Starts fast', 'degree-asked': 'Degree asked', housing: 'Housing included' };
        const credential = ['needs-twic', 'needs-mmc', 'needs-eng1', 'drug-test'].includes(flag);
        return h(credential ? 'a' : 'span', { ...(credential ? { route: 'papers' } : {}), class: 'flag-chip' + (['high-pay', 'starts-fast'].includes(flag) ? ' flag-good' : flag === 'pay-unknown' ? ' flag-muted' : '') }, labels[flag] || flag);
      })),
      h('div', { class: 'match-row' }, h('span', { class: 'score-line', role: 'meter', 'aria-label': 'Match score', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': score }, h('i', { style: { width: score + '%' } })), h('span', { class: 'small muted' }, `${score} match`)),
      h('p', { class: 'job-source small muted' }, `${job.source || 'Direct'} · ${ago(job.postedAt || job.firstSeenAt)}`),
      h('div', { class: 'card-actions' }, button('Save', () => { store.saveFeedJob(job, 'dockside'); toast('Saved. Find it in My Jobs.'); }, 'button secondary'), button('Applied', () => { store.saveFeedJob(job, 'castoff'); toast('Nice! Counted toward this week’s goal.'); }, 'button primary'), button('Not for me', e => dismissPanel(card, job, e.currentTarget), 'button quiet', { 'aria-expanded': 'false', 'data-panel': 'dismiss' })),
      button('Write my pitch', e => pitchPanel(card, job, e.currentTarget), 'text-button small', { 'aria-expanded': 'false', 'data-panel': 'pitch' }));
    return card;
  }
  function pitchPanel(card, job, trigger) {
    const open = card.querySelector('.pitch-panel');
    if (open) { open.remove(); trigger.setAttribute('aria-expanded', 'false'); return; }
    closePanels(card); trigger.setAttribute('aria-expanded', 'true');
    const text = h('textarea', { rows: 8, class: 'selectable', value: pitchFor(job), 'aria-label': 'Your pitch' });
    const panel = h('div', { class: 'dismiss-panel pitch-panel' }, h('h3', {}, 'Your pitch'), h('p', { class: 'small muted' }, 'Paste it into the application’s note or “Why you?” box. Tweak it first if you like.'), text,
      h('div', { class: 'button-row' }, button('Copy pitch', async () => {
        try { await navigator.clipboard.writeText(text.value); toast('Pitch copied. Paste it into the application.'); }
        catch (_) { text.focus(); text.select(); toast('Text selected — use Copy on your device.'); }
      }, 'button primary'), button('Close', () => { panel.remove(); trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }, 'button secondary')));
    card.append(panel); text.focus(); text.setSelectionRange(0, 0); text.scrollTop = 0;
  }
  function closePanels(card) {
    card.querySelectorAll('.dismiss-panel').forEach(panel => panel.remove());
    card.querySelectorAll('[data-panel]').forEach(control => control.setAttribute('aria-expanded', 'false'));
  }
  function dismissPanel(card, job, trigger) {
    if (card.querySelector('.job-dismiss-panel')) return;
    closePanels(card); trigger.setAttribute('aria-expanded', 'true');
    let reason = 'not-interested';
    const note = h('textarea', { rows: 2, placeholder: 'Optional note for future you…', maxlength: 2000 });
    const reasons = h('div', { class: 'reason-chips', role: 'group', 'aria-label': 'Dismiss reason' });
    function drawReasons() {
      reasons.replaceChildren(...DISMISS_REASONS.map(r => button(r.label, () => { reason = r.id; drawReasons(); }, 'reason-chip ' + (reason === r.id ? 'selected' : ''), { 'aria-pressed': reason === r.id })));
    }
    const panel = h('div', { class: 'dismiss-panel job-dismiss-panel' }, h('h3', {}, 'Not for you?'), h('p', { class: 'small muted' }, 'Pick a reason. It helps the robot find better jobs.'), reasons, field('Add a note', note),
      h('div', { class: 'button-row' }, button('Hide job', () => {
        store.dismiss(job, reason, note.value.trim()); toast('Job hidden.', { label: 'Undo', run: () => store.undoDismiss(job.id) });
      }, 'button danger'), button('Keep it', () => { panel.remove(); trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }, 'button secondary')));
    drawReasons(); card.append(panel); reasons.querySelector('button').focus();
  }
  const search = h('input', { type: 'search', placeholder: 'Job, company or town…', value: ui.search, onInput: e => { ui.search = e.target.value; draw(); } });
  const sort = h('select', { onChange: e => { ui.sort = e.target.value; draw(); } }, h('option', { value: 'score', selected: ui.sort === 'score' }, 'Best match'), h('option', { value: 'newest', selected: ui.sort === 'newest' }, 'Newest'));
  const sources = store.state.feed.sources;
  const healthy = sources.filter(s => s.ok).length;
  const refresh = button('↻ Refresh now', async () => {
    if (!store.getToken()) { toast(store.state.sample ? 'Sample mode can’t refresh. Go back to the live site.' : 'Add a GitHub token in Settings to refresh.'); if (!store.state.sample) location.hash = 'settings'; return; }
    refresh.disabled = true;
    try { await store.refreshFeed(); }
    catch (_) { toast('Refresh failed. Check your token in Settings.'); }
    finally { refresh.disabled = false; }
  }, 'button secondary small-button', { disabled: store.state.feedRefresh === 'waiting' });
  const reload = button('Reload feed', async () => { await store.reloadFeed(); }, 'button secondary small-button');
  const refreshMessages = { waiting: 'Looking for new jobs… (about 2 minutes)', timeout: 'Still running. Tap Reload feed in a minute.', ready: 'New jobs loaded.' };
  const health = h('footer', { class: 'source-health panel' }, h('div', { class: 'section-top' }, h('details', {}, h('summary', {}, `${store.state.feed.generatedAt ? 'Updated ' + ago(store.state.feed.generatedAt) : 'Not updated yet'} · ${healthy}/${sources.length} sources OK`),
    h('ul', { class: 'source-list' }, ...sources.map(source => h('li', {}, h('span', { class: source.ok ? 'foam-text' : 'flare-text' }, source.ok ? '●' : '○'), h('strong', {}, source.name), h('span', { class: 'muted' }, source.ok ? `${source.count} jobs` : source.error || 'Unavailable'))))), h('div', { class: 'button-row' }, refresh, reload)), store.state.feedRefresh && h('p', { class: 'small', role: 'status' }, refreshMessages[store.state.feedRefresh]), store.state.feedError && h('p', { class: 'flare-text small' }, store.state.feedError));
  function focusNote() {
    if (!focusId || visibleIds.has(focusId)) return null;
    const alert = alerts.find(a => a.id === focusId) || store.state.feed.jobs.find(j => j.id === focusId);
    const status = alertStatus(focusId);
    const message = !store.state.feed.generatedAt ? 'Loading the latest jobs…'
      : status === 'saved' ? 'You already saved this job. It’s in My Jobs.'
      : status === 'dismissed' ? 'You hid this job earlier.'
      : alert ? 'This job was in a phone alert but has left the list since, usually because it filled or closed.'
      : 'This job isn’t on the site yet. The site may still be updating, so tap Reload feed in a minute.';
    return h('p', { class: 'banner alert-note', role: 'status' }, message, alert && alert.url && safeUrl(alert.url) && h('a', { href: alert.url, target: '_blank', rel: 'noopener noreferrer' }, ' Open posting ↗'));
  }
  function alertsPanel() {
    if (!alerts.length) return null;
    const labels = { listed: 'On the list', saved: 'Saved', dismissed: 'Dismissed', gone: 'Filled or removed' };
    return h('details', { class: 'panel alerts-panel', open: showAlerts }, h('summary', {}, `Recent phone alerts (${alerts.length})`),
      h('ul', { class: 'alert-list' }, ...alerts.map(a => {
        const status = alertStatus(a.id);
        return h('li', {}, h('div', {}, status === 'listed' ? h('a', { route: 'nest?job=' + encodeURIComponent(a.id) }, a.title) : h('strong', {}, a.title),
          h('span', { class: 'muted small' }, ` · ${[a.company, a.location, a.pay].filter(Boolean).join(' · ')}`)),
          h('div', { class: 'small' }, h('span', { class: 'alert-status status-' + status }, labels[status]), h('span', { class: 'muted' }, ' · ' + ago(a.alertedAt)),
            status !== 'listed' && a.url && safeUrl(a.url) && h('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, ' · Open posting ↗')));
      })));
  }
  draw();
  return h('div', { class: 'view nest-view' }, pageHeading('JOBS', 'Jobs', 'Best matches first. Tap a title to open the posting.'),
    h('section', { class: 'feed-controls', 'aria-label': 'Feed filters' }, topToggle, chips, h('div', { class: 'search-row' }, field('Search', search, 'search-field'), field('Sort by', sort), h('label', { class: 'check-label new-toggle' }, h('input', { type: 'checkbox', checked: ui.newOnly, onChange: e => { ui.newOnly = e.target.checked; draw(); } }), 'New only'),
      h('label', { class: 'check-label new-toggle' }, h('input', { type: 'checkbox', checked: ui.fastOnly, onChange: e => { ui.fastOnly = e.target.checked; draw(); } }), 'Starts fast'))),
    focusNote(), alertsPanel(), count, list, health);
}
