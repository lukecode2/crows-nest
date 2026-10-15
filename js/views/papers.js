import { h, pageHeading, field } from '../ui.js';
export function papers(store) {
  const { reqs, jobs } = store.state.tracker;
  const done = reqs.filter(r => r.done).length;
  return h('div', { class: 'view papers-view' }, pageHeading('READY FOR WHAT’S AHEAD', 'Ship’s Papers', 'A little paperwork opens a lot of water. Get your credentials in order.'),
    h('section', { class: 'panel papers-progress' }, h('div', { class: 'section-top' }, h('h2', {}, `${done} of ${reqs.length} papers in order`), h('span', { class: 'foam-text' }, reqs.length ? Math.round(done / reqs.length * 100) + '%' : '0%')),
      h('progress', { max: Math.max(1, reqs.length), value: done, 'aria-label': 'Requirements completed' })),
    h('div', { class: 'papers-list' }, ...reqs.map(req => {
      const unlocked = jobs.filter(j => (j.reqs || []).includes(req.id));
      const id = 'req-' + req.id;
      return h('article', { class: 'panel paper-card ' + (req.done ? 'paper-done' : '') },
        h('input', { id, class: 'paper-checkbox', type: 'checkbox', checked: req.done, onChange: e => store.updateRequirement(req.id, { done: e.target.checked }) }),
        h('div', { class: 'paper-content' }, h('h2', {}, h('label', { for: id }, req.label)), h('p', { class: 'muted' }, req.unlocks),
          field('Your note', h('input', { type: 'text', value: req.note || '', placeholder: 'Appointment, cost, next step…', onChange: e => store.updateRequirement(req.id, { note: e.target.value }) })),
          h('details', { class: 'unlocks' }, h('summary', {}, `Unlocks ${unlocked.length} ${unlocked.length === 1 ? 'job' : 'jobs'}`), unlocked.length ? h('ul', {}, ...unlocked.map(job => h('li', {}, job.company + ' · ' + job.role))) : h('p', { class: 'small muted' }, 'No linked jobs yet. Assign papers in a job’s details.'))));
    })));
}
