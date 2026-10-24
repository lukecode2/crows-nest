import { safeUrl } from '../logic.js';
import { DIRECTORY_REGIONS, DIRECTORY_STATUSES, directoryStatus, directoryProgress, filterDirectory } from '../directory.js';
import { h, button, pageHeading, empty, field, toast } from '../ui.js';

export function harbor(store, ui) {
  const data = store.state.directory;
  const employers = data?.employers || [];
  const records = store.state.tracker.directory;
  const filters = ui.harbor || (ui.harbor = { showAll: false, search: '', status: 'all' });
  const view = h('div', { class: 'view harbor-view' }, pageHeading('EMPLOYERS & CREW RESOURCES', 'Harbor', 'A short call list. Make contact, leave a note, keep moving.'));
  view.append(h('p', { class: 'muted small' }, 'Employer research, not confirmed openings — call or check before you go.'));
  if (!data) {
    view.append(empty('⚓', store.state.directoryError ? 'The harbor directory is offline.' : 'Charting the harbor…',
      store.state.directoryError || 'Your local employer list is on its way.'));
    return view;
  }
  const progress = directoryProgress(employers, records);
  view.append(h('section', { class: 'panel harbor-progress', 'aria-label': 'Harbor progress' },
    h('p', { role: 'status' }, `${progress.contacted} of ${progress.total} top picks contacted`),
    h('progress', { max: progress.total || 1, value: progress.contacted, 'aria-label': 'Top picks contacted' })));
  const list = h('div', { class: 'harbor-regions' });
  const chips = h('div', { class: 'harbor-filters', role: 'group', 'aria-label': 'Filter employers by status' });
  const toggle = button('', () => { filters.showAll = !filters.showAll; draw(); }, 'button secondary');
  const search = h('input', { type: 'search', value: filters.search, placeholder: 'Search employers, towns, contacts…', onInput: event => { filters.search = event.target.value; draw(); } });
  function contactLine(label, value) {
    if (!value) return null;
    const copy = button('Copy', async () => {
      try { await navigator.clipboard.writeText(value); toast(`${label} copied.`); }
      catch { toast(`Select the ${label.toLowerCase()} text to copy it.`); }
    }, 'button secondary small-button', { 'aria-label': `Copy ${label.toLowerCase()}: ${value}` });
    return h('div', { class: 'harbor-contact' }, h('div', {}, h('span', { class: 'small muted' }, label), h('span', { class: 'contact-text' }, value)), copy);
  }
  function card(employer) {
    const record = records[employer.id];
    const status = directoryStatus(record);
    const aboard = store.directoryJob(employer);
    const note = h('textarea', { rows: 2, maxlength: 2000, value: record?.note || '', placeholder: 'Who you spoke to, when to call back…',
      onInput: event => store.updateDirectory(employer.id, { note: event.target.value }) });
    return h('article', { class: 'job-card harbor-card', 'data-employer-id': employer.id },
      h('h3', {}, employer.name), h('p', { class: 'muted small' }, `${employer.town} · ${employer.type}`),
      h('p', { class: 'small' }, 'Suggested contact route: ', employer.hiringMethod), h('p', { class: 'harbor-tip small' }, employer.tip),
      employer.verificationNote && h('p', { class: 'small muted' }, employer.verificationNote), employer.verifiedAt && h('p', { class: 'small muted' }, 'Link checked ' + employer.verifiedAt),
      contactLine('Phone', employer.phone), contactLine('Email', employer.email),
      safeUrl(employer.url) && h('a', { href: employer.url, target: '_blank', rel: 'noopener noreferrer', class: 'harbor-link' }, 'Website / careers ↗'),
      h('div', { class: 'harbor-statuses', role: 'group', 'aria-label': `Contact status for ${employer.name}` },
        ...DIRECTORY_STATUSES.map(item => button(item.label, () => store.updateDirectory(employer.id, { status: item.id }),
          'reason-chip ' + (status === item.id ? 'selected' : ''), { 'aria-pressed': status === item.id }))),
      field(`Note for ${employer.name} (optional)`, note),
      button(employer.volunteer ? 'Volunteer training — unpaid' : aboard ? 'On board' : 'Add to Voyage', () => { store.addDirectoryJob(employer); toast('Safely docked. Find it in The Voyage.'); },
        'button ' + (aboard ? 'secondary' : 'primary'), { disabled: Boolean(aboard || employer.volunteer) }));
  }
  function draw() {
    toggle.textContent = filters.showAll ? `Top picks (${progress.total})` : `Show all (${employers.length})`;
    toggle.setAttribute('aria-pressed', String(filters.showAll));
    chips.replaceChildren(...[{ id: 'all', label: 'All statuses' }, ...DIRECTORY_STATUSES].map(item => button(item.label,
      () => { filters.status = item.id; draw(); }, 'reason-chip ' + (filters.status === item.id ? 'selected' : ''), { 'aria-pressed': filters.status === item.id })));
    const visible = filterDirectory(employers, records, filters);
    list.replaceChildren(...DIRECTORY_REGIONS.map(region => {
      const group = visible.filter(e => e.region === region.id);
      return h('section', { class: 'harbor-region', 'aria-label': region.label }, h('h2', {}, `${region.label} (${group.length})`),
        group.length ? h('div', { class: 'feed-grid' }, ...group.map(card)) : h('p', { class: 'muted small' }, 'No employers match these filters here.'));
    }));
    if (!visible.length) list.prepend(empty('⚓', employers.length ? 'No employers match.' : 'No employers in this directory yet.', 'Try Show all or broaden your search.'));
  }
  draw();
  view.append(h('section', { class: 'harbor-controls', 'aria-label': 'Harbor filters' }, toggle, field('Search the harbor', search), chips), list);
  return view;
}
