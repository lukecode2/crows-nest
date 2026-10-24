import { TRACKS } from './config.js';
import { safeUrl, daysBetween, localToday } from './logic.js';
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (key.startsWith('aria-')) { el.setAttribute(key, String(value)); return; }
    if (value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'href') { const url = safeUrl(value); if (url) el.setAttribute('href', url); }
    else if (key === 'route') el.setAttribute('href', '#' + value);
    else if (key === 'style') Object.entries(value).forEach(([name, val]) => el.style.setProperty(name, val));
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (['value', 'checked', 'disabled', 'selected'].includes(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  });
  children.flat(Infinity).forEach(child => {
    if (child === null || child === undefined || child === false) return;
    if (child instanceof Node) el.appendChild(child);
    else { const text = document.createElement('span'); text.textContent = String(child); el.appendChild(text); }
  });
  return el;
}
export const button = (text, onClick, className = 'button', attrs = {}) => h('button', { type: 'button', class: className, onClick, ...attrs }, text);
export function trackChip(id) {
  const track = TRACKS.find(t => t.id === id) || TRACKS[0];
  return h('span', { class: 'track-chip', style: { '--track': track.color } }, h('i', { 'aria-hidden': 'true' }), track.label);
}
export function pageHeading(kicker, title, description, action) {
  return h('header', { class: 'page-heading' }, h('div', {}, h('p', { class: 'eyebrow' }, kicker), h('h1', {}, title), h('p', { class: 'lede' }, description)), action);
}
export const empty = (icon, title, copy) => h('div', { class: 'empty-state' }, h('span', { class: 'empty-icon', 'aria-hidden': 'true' }, icon), h('h3', {}, title), copy && h('p', {}, copy));
export function dateLabel(value) {
  if (!value) return 'No date';
  return new Date(value + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function ago(iso) {
  if (!iso) return 'Date unknown';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'Date unknown';
  const hours = Math.max(0, Math.floor(ms / 3600000));
  return hours < 1 ? 'just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
export const daysAgo = date => Math.max(0, daysBetween(date, localToday()));
export function sheet(contentEl) {
  const previous = document.activeElement;
  const title = contentEl.querySelector('h2');
  if (title && !title.id) title.id = 'sheet-title';
  const dialog = h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title ? title.id : null, 'aria-label': title ? null : 'Job details', tabindex: '-1' });
  const close = () => {
    overlay.remove(); document.body.classList.remove('sheet-open'); document.removeEventListener('keydown', keydown);
    if (previous && document.contains(previous)) previous.focus();
  };
  dialog.append(button('×', close, 'sheet-close', { 'aria-label': 'Close details' }), contentEl);
  const overlay = h('div', { class: 'sheet-overlay', onClick: e => { if (e.target === overlay) close(); } }, dialog);
  function keydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const items = [...dialog.querySelectorAll('a[href], button, input, textarea, select, [tabindex="0"]')].filter(el => !el.disabled && el.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last && last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first && first.focus(); }
    }
  }
  document.body.appendChild(overlay); document.body.classList.add('sheet-open'); document.addEventListener('keydown', keydown);
  dialog.focus(); return close;
}
export function toast(msg, action) {
  const area = document.getElementById('toasts');
  const el = h('div', { class: 'toast' }, h('span', {}, msg));
  if (action) el.append(button(action.label, () => { action.run(); el.remove(); }, 'button text-button'));
  area.append(el); setTimeout(() => el.remove(), action ? 5000 : 4500);
}
export function confirmInline(el, msg) {
  return new Promise(resolve => {
    const finish = value => { panel.remove(); resolve(value); };
    const panel = h('div', { class: 'inline-confirm', role: 'alert' }, h('p', {}, msg),
      button('Delete job', () => finish(true), 'button danger'), button('Keep it', () => finish(false), 'button secondary'));
    el.append(panel); panel.querySelector('button').focus();
  });
}
export function field(label, input, className = '') { return h('label', { class: 'field ' + className }, h('span', {}, label), input); }
export function waves() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1440 60'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('wave-strip');
  for (const [d, opacity] of [
    ['M0 32 Q90 8 180 32 T360 32 T540 32 T720 32 T900 32 T1080 32 T1260 32 T1440 32 V60 H0 Z', '0.17'],
    ['M0 42 Q90 18 180 42 T360 42 T540 42 T720 42 T900 42 T1080 42 T1260 42 T1440 42 V60 H0 Z', '0.15']
  ]) { const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('fill', '#7fd1c1'); path.setAttribute('opacity', opacity); svg.appendChild(path); }
  return svg;
}
