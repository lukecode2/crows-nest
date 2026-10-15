import { createStore } from './store.js';
import { h } from './ui.js';
import { helm } from './views/helm.js';
import { nest } from './views/nest.js';
import { voyage } from './views/voyage.js';
import { papers } from './views/papers.js';
import { settings } from './views/settings.js';
const routes = [
  ['helm', '◉', 'The Helm', 'Helm'], ['nest', '⚑', 'Crow’s Nest', 'Nest'],
  ['voyage', '⛵', 'The Voyage', 'Voyage'], ['papers', '▤', 'Ship’s Papers', 'Papers'], ['settings', '⚙', 'Settings', 'Settings']
];
const store = createStore({ sample: new URLSearchParams(location.search).get('sample') === '1' });
const viewState = { track: 'all', search: '', sort: 'score', newOnly: false };
const main = document.getElementById('main');
const renderers = { helm, nest, voyage, papers, settings };
let previousRoute;
function render() {
  const route = location.hash.slice(1).split('?')[0];
  const active = renderers[route] ? route : 'helm';
  const focused = document.activeElement;
  const controls = [...main.querySelectorAll('input, textarea, select')];
  const focusIndex = previousRoute === active ? controls.indexOf(focused) : -1;
  const draft = focusIndex >= 0 ? { value: focused.value, checked: focused.checked, type: focused.type, label: focused.closest('label') && focused.closest('label').textContent, start: focused.selectionStart, end: focused.selectionEnd } : null;
  const board = main.querySelector('.voyage-board');
  const boardScroll = previousRoute === active && board ? board.scrollLeft : 0;
  document.title = `${routes.find(r => r[0] === active)[2]} · Crow’s Nest`;
  document.getElementById('navigation').replaceChildren(...routes.map(([id, icon, label, short]) => h('a', { route: id, class: active === id ? 'tab active' : 'tab', 'aria-current': active === id ? 'page' : null },
    h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'tab-long' }, label), h('span', { class: 'tab-short' }, short))));
  const labels = { synced: 'Synced', saving: 'Saving…', local: 'Local only', error: 'Sync error' };
  const pill = document.getElementById('sync-pill');
  pill.className = 'sync-pill ' + store.state.sync;
  pill.replaceChildren(h('span', { class: 'status-dot' }), h('span', {}, labels[store.state.sync]));
  const banners = [];
  if (store.state.sample) banners.push(h('p', { class: 'banner sample-banner' }, '⚑ Sample waters — fictional feed companies. Changes stay in a separate local demo.', h('a', { href: location.origin + location.pathname }, 'Return to live feed ↗')));
  if (store.state.sync === 'local') banners.push(h('p', { class: 'banner' }, 'Saved on this device', h('span', {}, ' · ' + (store.state.sample ? 'Demo mode' : 'Add a GitHub token in Settings to sync across devices.'))));
  if (store.state.error) banners.push(h('p', { class: 'banner error-banner' }, store.state.error));
  if (store.state.storageError) banners.push(h('p', { class: 'banner error-banner' }, 'Browser storage is unavailable. Export your tracker before closing this page.'));
  document.getElementById('banners').replaceChildren(...banners);
  main.replaceChildren(renderers[active](store, viewState, render));
  // Background sync must not interrupt a note, search, or token being typed.
  if (draft) {
    const replacement = main.querySelectorAll('input, textarea, select')[focusIndex];
    if (replacement && replacement.type === draft.type && (replacement.closest('label') && replacement.closest('label').textContent) === draft.label) {
      replacement.value = draft.value;
      if (draft.type === 'checkbox') replacement.checked = draft.checked;
      replacement.focus({ preventScroll: true });
      if (typeof draft.start === 'number') replacement.setSelectionRange(draft.start, draft.end);
    }
  }
  const nextBoard = main.querySelector('.voyage-board');
  if (nextBoard) nextBoard.scrollLeft = boardScroll;
  previousRoute = active;
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => store.retry());
document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });
store.subscribe(render); render(); store.load();
