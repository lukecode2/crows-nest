// Only explicit closures count; access blocks and network failures stay unknown.
import { USER_AGENT } from './http.mjs';
export const DEAD_TEXT = /\b(?:this job (?:has )?(?:expired|is (?:no longer|closed))|job (?:you are trying to apply for )?has been filled|the job you are trying to view has expired|(?:the )?[^<>\n]{1,200} job in [^<>\n]{1,160} has expired,? here are the closest matches|this position has been filled|(?:is|are) no longer accepting applications|this (?:job )?announcement has closed|this (?:job|position|posting) (?:is )?no longer available|this job posting (?:has )?expired|this listing has expired|couldn['’]t find this job posting)\b/i;
// Script blobs carry error strings for every state; read only visible text.
export function visibleText(html) {
  return String(html).slice(0, 600000).replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}
export function checkUrl(value) {
  const url = new URL(value);
  const id = /(?:^|\.)adzuna\.com$/i.test(url.hostname) && url.pathname.match(/^\/land\/ad\/(\d+)\/?$/)?.[1];
  return id ? `https://www.adzuna.com/details/${id}${url.search}` : value;
}
function vanishedBluewater(from, to) {
  try {
    const original = new URL(from), final = new URL(to);
    return /(?:^|\.)bluewateryachting\.com$/i.test(original.hostname) && /(?:^|\.)bluewateryachting\.com$/i.test(final.hostname) &&
      /^\/yacht-crew-job\/[^/]+\/?$/.test(original.pathname) && /^\/crew-placement\/yacht-crew\/jobs\/?$/.test(final.pathname);
  } catch { return false; }
}
export async function checkLinks(jobs, { nowIso = new Date().toISOString(), fetchImpl = globalThis.fetch, concurrency = 3, timeoutMs = 15000, maxAgeMs = 20 * 3600000, hostDelayMs = 1300 } = {}) {
  const now = Date.parse(nowIso);
  const due = jobs.filter(j => /^https?:\/\//i.test(j.url || '') && !(now - Date.parse(j.linkCheckedAt || 0) < maxAgeMs));
  const dead = new Set(), checked = new Set(), hosts = new Map();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, async () => {
    while (next < due.length) {
      const job = due[next++];
      let url, host;
      try { url = checkUrl(job.url); host = new URL(url).hostname; } catch { continue; }
      const prior = hosts.get(host) || Promise.resolve();
      let release;
      hosts.set(host, new Promise(resolve => { release = resolve; }));
      await prior;
      try {
        const response = await fetchImpl(url, { redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(timeoutMs) });
        checked.add(job.id);
        if ([404, 410].includes(response.status)) dead.add(job.id);
        else if (response.ok && (vanishedBluewater(job.url, response.url) || DEAD_TEXT.test(visibleText(await response.text())))) dead.add(job.id);
      } catch { /* unknown: try again next run */ }
      finally {
        if (hostDelayMs) await new Promise(resolve => setTimeout(resolve, hostDelayMs));
        release();
      }
    }
  }));
  return { dead, checked, checkedAt: new Date(now).toISOString() };
}
