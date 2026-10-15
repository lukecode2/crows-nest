import { h, button, pageHeading, field, toast, ago } from '../ui.js';
import { localToday } from '../logic.js';
export function settings(store) {
  const token = h('input', { type: 'password', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: store.getToken() ? 'Token saved on this device' : 'github_pat_…', disabled: store.state.sample });
  const tokenForm = h('form', { onSubmit: async e => {
    e.preventDefault(); if (!token.value.trim()) { toast('Paste your fine-grained token first.'); return; }
    const value = token.value; token.value = '';
    await store.setToken(value); toast(store.state.sync === 'local' || store.state.sync === 'error' ? 'Could not connect. Your local tracker is safe.' : 'Connected. Your logbook is ready to sync.');
  } }, field('GitHub fine-grained token', token), h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button primary', disabled: store.state.sample }, 'Save token'), button('Clear token', () => { store.setToken(''); toast('Token cleared. Local logbook ready.'); }, 'button secondary', { disabled: store.state.sample })));
  const syncLabels = { synced: 'Synced', saving: 'Saving…', local: 'Local only', error: 'Sync error' };
  const goal = h('input', { type: 'number', min: 1, max: 100, step: 1, value: store.state.tracker.settings.weeklyGoal, required: true, inputmode: 'numeric' });
  const goalForm = h('form', { class: 'goal-form', onSubmit: e => { e.preventDefault(); const number = Number(goal.value); if (Number.isInteger(number) && number >= 1 && number <= 100) { store.updateSettings({ weeklyGoal: number }); toast('Weekly heading updated.'); } } }, field('Applications per week', goal), h('button', { type: 'submit', class: 'button secondary' }, 'Set goal'));
  const importFile = h('input', { type: 'file', accept: 'application/json,.json', onChange: async e => {
    const file = e.target.files[0]; if (!file) return;
    try { if (file.size > 5000000) throw new Error('Choose a JSON file smaller than 5 MB.'); const value = JSON.parse(await file.text()); store.importTracker(value); toast('Logbooks merged. Your newest edits are aboard.'); }
    catch (error) { toast(error instanceof SyntaxError ? 'This file isn’t valid JSON. Choose a Crow’s Nest export.' : error.message); }
    e.target.value = '';
  } });
  return h('div', { class: 'view settings-view' }, pageHeading('KEEP A STEADY COURSE', 'Settings', 'Your logbook, your pace. Bring it with you wherever you make port.'),
    h('div', { class: 'settings-grid' }, h('section', { class: 'panel' }, h('p', { class: 'eyebrow' }, 'YOUR LOGBOOK, EVERYWHERE'), h('h2', {}, 'Connect to GitHub'),
      h('p', { class: 'muted' }, 'Your token stays in this browser. Without one, Crow’s Nest saves your tracker on this device.'),
      h('ol', { class: 'setup-steps' }, h('li', {}, h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener noreferrer', class: 'text-link' }, 'Create a fine-grained token ↗')),
        h('li', {}, 'Only select repositories: ', h('strong', {}, 'crows-nest')), h('li', {}, 'Repository permissions: ', h('strong', {}, 'Contents — Read and write'), ' and ', h('strong', {}, 'Actions — Read and write')), h('li', {}, 'Paste it below. Repeat on each device you use.')),
      tokenForm),
      h('div', { class: 'settings-stack' }, h('section', { class: 'panel' }, h('p', { class: 'eyebrow' }, 'AT YOUR OWN PACE'), h('h2', {}, 'Your weekly goal'), h('p', { class: 'muted' }, 'Weeks run Monday through Sunday. Every application is a little more momentum.'), goalForm),
        h('section', { class: 'panel' }, h('p', { class: 'eyebrow' }, 'THE SHIP’S TELEGRAPH'), h('h2', {}, syncLabels[store.state.sync]),
          h('p', { class: 'muted' }, store.state.lastSaved ? 'Last saved ' + ago(store.state.lastSaved) : 'Every change is mirrored to this device.'),
          store.state.error && h('p', { class: 'flare-text' }, store.state.error),
          store.getToken() && button('Retry sync', () => store.retry(), 'button secondary')))),
    h('section', { class: 'panel backup-panel' }, h('div', {}, h('p', { class: 'eyebrow' }, 'A COPY FOR SAFEKEEPING'), h('h2', {}, 'Export & import'), h('p', { class: 'muted' }, 'Download your complete tracker as JSON. Import merges jobs and papers, keeping the newest edits.')),
      h('div', { class: 'backup-actions' }, button('↓ Export tracker', () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(store.state.tracker, null, 2)], { type: 'application/json' }));
        const link = h('a', { download: `crows-nest-${localToday()}.json` });
        // This URL is generated locally from a Blob, never supplied by feed data.
        link.href = url; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Your voyage log is ready for safekeeping.');
      }, 'button primary'), field('↑ Import tracker JSON', importFile))));
}
