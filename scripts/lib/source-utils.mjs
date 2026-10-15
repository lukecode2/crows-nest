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
export function pay(min, max, interval = '') {
  if (min == null && max == null) return '';
  const number = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const amount = min != null && max != null && Number(min) !== Number(max) ? `$${number(min)}–$${number(max)}` : `$${number(min ?? max)}`;
  return `${amount}/${interval || (Number(max ?? min) < 200 ? 'hour' : 'year')}`;
}
export function remoteJobs(jobs) {
  return jobs.filter(j => SALES.test(j.title) || WEB.test(j.title)).map(j => ({ ...j, remote: true, location: 'Remote', trackHint: SALES.test(j.title) ? (TEMP.test(`${j.title} ${j.snippet}`) ? 'quick-cash' : 'tech-sales') : 'ai-web' }));
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
