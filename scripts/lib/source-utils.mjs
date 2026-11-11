import * as http from './http.mjs';
import { SALES, WEB, TEMP } from './classify.mjs';
import { cleanText } from './normalize.mjs';
export const client = ctx => ctx.http || http;
export const companyEntries = ctx => Array.isArray(ctx.companies) ? ctx.companies : ctx.companies?.companies || [];
export function rawJob(fields) {
  return { title: '', company: '', location: '', remote: false, pay: '', url: '', postedAt: null, snippet: '', source: '', ...fields };
}
export function iso(value) {
  if (!value) return null;
  const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
// Adzuna turns hourly postings into a 2,080-hour "salary" ($31.50/hr -> $65,520). An annual figure that divides
// back into an even quarter-dollar rate under $100 was an hourly rate, so show it as one.
export function adzunaPay(min, max) {
  const values = [min, max].filter(v => v != null && v !== '').map(Number);
  const hourly = values.length && values.every(v => v / 2080 <= 100 && Math.abs(v / 2080 * 4 - Math.round(v / 2080 * 4)) < 1e-6);
  return hourly ? pay(min == null ? min : Number(min) / 2080, max == null ? max : Number(max) / 2080, 'hour') : pay(min, max);
}
export function pay(min, max, interval = '') {
  if (min == null && max == null) return '';
  const number = n => Number(n).toLocaleString('en-US', Number(n) % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
  const amount = min != null && max != null && Number(min) !== Number(max) ? `$${number(min)}–$${number(max)}` : `$${number(min ?? max)}`;
  return `${amount}/${interval || (Number(max ?? min) < 200 ? 'hour' : 'year')}`;
}
// `eligible` is the board's own "who can apply" text (e.g. "USA, Canada"), kept so remoteAbroad() can read it.
// Long country lists get cut to 120 characters; put the US first so remoteAbroad() still sees it.
const usFirst = eligible => {
  const text = cleanText(eligible, Infinity);
  const us = /\b(?:USA|US|U\.S\.A?\.?|United States(?: of America)?)\b/.exec(text);
  return cleanText(us && us.index > 0 ? `${us[0]}, ${text.slice(0, us.index)}${text.slice(us.index + us[0].length)}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '') : text, 120);
};
export function remoteJobs(jobs) {
  return jobs.filter(j => SALES.test(j.title) || WEB.test(j.title)).map(({ eligible, ...j }) => ({ ...j, remote: true, location: eligible ? `Remote — ${usFirst(eligible)}` : 'Remote', trackHint: SALES.test(j.title) ? (TEMP.test(`${j.title} ${j.snippet}`) ? 'quick-cash' : 'tech-sales') : 'ai-web' }));
}
// A broken company/query must not discard other successful results. All failing is a source error.
export async function collect(entries, worker, ctx, concurrency = 3) {
  const results = new Array(entries.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (next < entries.length && !ctx.signal?.aborted) {
      const index = next++;
      try { results[index] = { jobs: await worker(entries[index], index) }; }
      catch (error) { results[index] = { error }; ctx.log?.(`${entries[index].name || entries[index].q || entries[index].query || 'request'}: ${error.message}`); }
    }
  }));
  const failures = results.filter(r => r?.error);
  if (entries.length && failures.length === entries.length) throw new Error(failures.map(r => r.error.message).join('; '));
  return results.flatMap(r => r?.jobs || []);
}
const STATE_NAMES = { SC: 'south carolina', NC: 'north carolina', FL: 'florida', GA: 'georgia' };
export function entryMatches(job, entry) {
  const title = cleanText(job.title, Infinity);
  if (entry.keywords?.length && !entry.keywords.some(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(title))) return false;
  if (entry.states?.length && !entry.states.some(s => {
    const location = job.location || '';
    return new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(location) || (STATE_NAMES[s] && location.toLowerCase().includes(STATE_NAMES[s]));
  })) return false;
  return true;
}

export function robotsAllowed(text, url) {
  let agents = [], rules = [], inRules = false;
  const groups = [];
  const flush = () => { if (agents.length) groups.push({ agents, rules }); agents = []; rules = []; inRules = false; };
  for (const line of text.replace(/\\r\\n/g, '\n').split(/\r?\n/)) {
    const match = line.replace(/#.*$/, '').trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, directive, value] = match;
    if (directive.toLowerCase() === 'user-agent') { if (inRules) flush(); agents.push(value.toLowerCase()); }
    else if (/^(allow|disallow)$/i.test(directive)) { inRules = true; if (value) rules.push({ allow: directive.toLowerCase() === 'allow', path: value }); }
  }
  flush();
  const specific = groups.filter(g => g.agents.some(a => a !== '*' && 'crowsnestjobbot'.includes(a)));
  const applicable = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  const path = new URL(url).pathname + new URL(url).search;
  const matches = applicable.flatMap(g => g.rules).filter(r => {
    const end = r.path.endsWith('$');
    const pattern = (end ? r.path.slice(0, -1) : r.path).split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + pattern + (end ? '$' : '')).test(path);
  }).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}

// Cache robots per run and serialize requests on hosts that publish a crawl delay.
// Unknown robots failures fail closed; a missing robots.txt (404) means no rules.
const guardedClients = new WeakMap();
export function publicClient(ctx) {
  if (guardedClients.has(ctx)) return guardedClients.get(ctx);
  const api = client(ctx), origins = new Map();
  async function request(method, url, options) {
    const origin = new URL(url).origin;
    if (!origins.has(origin)) origins.set(origin, (async () => {
      let robots;
      try { robots = await api.getText(`${origin}/robots.txt`); }
      catch (error) { if (error.status !== 404) throw error; robots = ''; }
      const delays = [...robots.matchAll(/^crawl-delay:\s*([\d.]+)/gim)].map(m => Number(m[1]) * 1000);
      return { robots, delay: Math.max(0, ...delays), next: 0, queue: Promise.resolve() };
    })());
    const host = await origins.get(origin);
    if (!robotsAllowed(host.robots, url)) throw new Error(`robots.txt disallows ${url}`);
    const turn = host.queue.then(async () => {
      const wait = Math.max(0, host.next - Date.now());
      if (wait) await new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(ctx.signal.reason); };
        const timer = setTimeout(() => { ctx.signal?.removeEventListener('abort', abort); resolve(); }, wait);
        ctx.signal?.addEventListener('abort', abort, { once: true });
        if (ctx.signal?.aborted) abort();
      });
      ctx.signal?.throwIfAborted();
      host.next = Date.now() + host.delay;
    });
    host.queue = turn.catch(() => {});
    await turn;
    return api[method](url, options);
  }
  const guarded = Object.fromEntries(['getJson', 'getText'].map(method => [method, (url, options) => request(method, url, options)]));
  guardedClients.set(ctx, guarded);
  return guarded;
}
