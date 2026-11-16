import { STAGES, TRACKS } from '../config.js';
import { feedJobToTracker, localToday, stageDays, needsApplicationDate, safeUrl, pitchFor } from '../logic.js';
import { h, button, trackChip, pageHeading, field, sheet, toast, confirmInline, dateLabel } from '../ui.js';
export function voyage(store) {
  const jobs = store.state.tracker.jobs;
  const board = h('div', { class: 'voyage-board', role: 'region', 'aria-label': 'Application pipeline. Scroll sideways for all six stages.', tabindex: '0' });
  STAGES.forEach((stage, index) => {
    const stageJobs = jobs.filter(j => j.stage === stage.id);
    const column = h('section', { class: 'voyage-column stage-' + stage.id, 'data-stage': stage.id,
      onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; column.classList.add('drag-over'); },
      onDragLeave: e => { if (!column.contains(e.relatedTarget)) column.classList.remove('drag-over'); },
      onDrop: e => {
        e.preventDefault(); column.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (jobs.some(j => j.id === id && j.stage !== stage.id)) {
          const job = jobs.find(j => j.id === id);
          if (needsApplicationDate(job, stage.id)) openJob(store, job, stage.id);
          else { store.updateJob(id, { stage: stage.id }); toast(`Moved to ${stage.label}.`); }
        }
      }
    }, h('header', { class: 'column-heading' }, h('div', {}, h('span', { class: 'column-index' }, String(index + 1).padStart(2, '0')), h('h2', {}, stage.label), h('small', {}, stage.hint)), h('span', { class: 'count-pill' }, stageJobs.length)));
    stageJobs.forEach(job => {
      const days = stageDays(job);
      column.append(button('', () => openJob(store, job), 'pipeline-card', {
        draggable: 'true', 'data-job-id': job.id, 'aria-label': `${job.company}: ${job.role}. Open details`,
        onDragStart: e => { e.dataTransfer.setData('text/plain', job.id); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); },
        onDragEnd: e => e.currentTarget.classList.remove('dragging')
      }));
      const card = column.lastElementChild;
      card.append(h('strong', { class: 'pipeline-company' }, job.company), h('span', { class: 'pipeline-role' }, job.role), trackChip(job.track),
        h('span', { class: 'small muted' }, `${days}d at ${stage.label}`), job.nextAction && h('span', { class: 'pipeline-next' }, '↗ ' + job.nextAction, job.nextDue && h('small', { class: job.nextDue < localToday() ? 'flare-text' : 'muted' }, dateLabel(job.nextDue))));
    });
    if (!stageJobs.length) column.append(h('p', { class: 'column-empty' }, stage.id === 'hired' ? 'Nothing here yet.' : 'Room for your next move.'));
    board.append(column);
  });
  return h('div', { class: 'view voyage-view' }, pageHeading('MY JOBS', 'My Jobs', 'Jobs you saved or applied to. Drag a card to move it, or tap it to add notes.', button('+ Add job', () => openJob(store), 'button primary')), h('p', { class: 'board-help small muted' }, '← Scroll sideways to see all six columns →'), board);
}
export function openJob(store, existing, initialStage) {
  let job = existing || feedJobToTracker({}, 'dockside', localToday());
  let stage = initialStage || job.stage, saved = !!existing;
  const inputs = {};
  const input = (key, type = 'text', value = job[key] || '') => { const el = h('input', { type, value, name: key }); inputs[key] = el; return el; };
  const track = h('select', { name: 'track' }, ...TRACKS.map(t => h('option', { value: t.id, selected: t.id === job.track }, t.label)));
  inputs.track = track;
  const company = input('company'); company.required = true; company.autocomplete = 'organization';
  const role = input('role'); role.required = true;
  const reqInputs = store.state.tracker.reqs.map(req => ({ id: req.id, el: h('input', { type: 'checkbox', checked: (job.reqs || []).includes(req.id) }), label: req.label, done: req.done }));
  const notes = h('textarea', { rows: 5, name: 'notes', value: job.notes || '' }); inputs.notes = notes;
  const contact = job.contact || {};
  const contacts = h('div', { class: 'form-grid' }, ...[['name', 'Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel']].map(([key, label, type]) => {
    const el = input('contact-' + key, type, contact[key] || '');
    el.classList.add('selectable');
    return field(label, h('div', { class: 'copy-field' }, el, button('Copy', async () => {
      if (!el.value) { toast('No ' + label.toLowerCase() + ' added yet.'); return; }
      try { await navigator.clipboard.writeText(el.value); toast(label + ' copied.'); }
      catch (_) { el.focus(); el.select(); toast('Text selected — use Copy on your device.'); }
    }, 'button quiet small-button', { 'aria-label': 'Copy contact ' + label.toLowerCase() })));
  }));
  const stageButtons = h('div', { class: 'stage-buttons', role: 'group', 'aria-label': 'Job stage' });
  let close;
  const form = h('form', { class: 'job-form', onSubmit: e => { e.preventDefault(); const wasSaved = saved; if (persist()) { close(); toast(wasSaved ? 'Saved.' : 'Job added to My Jobs.'); } } },
    h('p', { class: 'eyebrow' }, existing ? 'MY JOBS' : 'A NEW POSSIBILITY'), h('h2', {}, existing ? 'Job details' : 'Add a job'),
    h('div', { class: 'form-grid' }, field('Company', company), field('Role', role), field('Track', track), field('Location', input('location')), field('Job link', input('link', 'url')), field('Pay', input('pay'))),
    h('fieldset', {}, h('legend', {}, 'Where it stands'), stageButtons),
    h('div', { class: 'form-grid' }, field('Date applied', input('dateApplied', 'date')), field('Last follow-up', input('lastFollowUp', 'date'))),
    h('fieldset', {}, h('legend', {}, 'Contact person'), contacts),
    field('Notes', notes),
    h('fieldset', {}, h('legend', {}, 'Certificates needed'), h('div', { class: 'requirement-checks' }, ...reqInputs.map(r => h('label', { class: 'check-label' }, r.el, r.label + (r.done ? ' ✓' : ''))))),
    h('div', { class: 'form-grid' }, field('Next action', input('nextAction')), field('Due date', input('nextDue', 'date'))),
    h('div', { class: 'sheet-actions' }, h('button', { type: 'submit', class: 'button primary' }, 'Save changes'), button('Mark followed up', () => {
      stage = 'hailed'; inputs.lastFollowUp.value = localToday();
      if (persist()) { drawStages(); toast('Follow-up logged for today.'); }
    }, 'button secondary'), button('Copy pitch', async () => {
      const text = pitchFor({ title: role.value, company: company.value, track: track.value });
      try { await navigator.clipboard.writeText(text); toast('Pitch copied. Paste it into the application.'); }
      catch (_) { notes.value = (notes.value ? notes.value + '\n\n' : '') + text; notes.focus(); toast('Pitch added to Notes — copy it from there.'); }
    }, 'button secondary'), existing && button('Delete', async e => {
      const trigger = e.currentTarget; trigger.disabled = true;
      const confirmed = await confirmInline(form, 'Delete this job from My Jobs?');
      trigger.disabled = false;
      if (confirmed) { store.deleteJob(job.id); close(); toast('Job removed from the log.'); }
    }, 'button quiet danger-text')));
  function values() {
    const data = {};
    ['company', 'role', 'track', 'location', 'link', 'pay', 'notes', 'nextAction'].forEach(key => { data[key] = inputs[key].value.trim(); });
    ['dateApplied', 'lastFollowUp', 'nextDue'].forEach(key => { data[key] = inputs[key].value || null; });
    data.contact = Object.fromEntries(['name', 'email', 'phone'].map(key => [key, inputs['contact-' + key].value.trim()]));
    data.reqs = reqInputs.filter(r => r.el.checked).map(r => r.id); data.stage = stage;
    return data;
  }
  function persist() {
    if (!form.reportValidity()) return false;
    const data = values();
    if (needsApplicationDate(data, stage)) { toast('Add the date you applied before logging this stage.'); inputs.dateApplied.focus(); return false; }
    if (saved) store.updateJob(job.id, data);
    else { job = store.addJob(data); saved = true; }
    if (stage === 'castoff' && !inputs.dateApplied.value) inputs.dateApplied.value = localToday();
    return true;
  }
  function drawStages() {
    stageButtons.replaceChildren(...STAGES.map(s => button(s.label, () => {
      const old = stage; stage = s.id;
      if (saved && !needsApplicationDate(values(), stage) && !persist()) stage = old;
      drawStages();
    }, 'stage-button ' + (stage === s.id ? 'selected' : ''), { 'aria-pressed': stage === s.id })));
  }
  if (safeUrl(job.link)) form.append(h('a', { href: job.link, target: '_blank', rel: 'noopener noreferrer', class: 'text-link original-link' }, 'Open original listing ↗'));
  drawStages(); close = sheet(form);
}
