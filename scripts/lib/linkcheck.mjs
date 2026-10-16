// Opens each kept job's page about once a day and reports the ones that are gone.
// Only a 404/410 or an explicit "filled/closed" message counts: bot blocks (401/403), timeouts and
// network errors leave the job alone.
import { USER_AGENT } from './http.mjs';
export const DEAD_TEXT = /\b(?:this job (?:has )?(?:expired|is (?:no longer|closed))|job (?:you are trying to apply for )?has been filled|this position has been filled|(?:is|are) no longer accepting applications|this (?:job )?announcement has closed|this (?:job|position|posting) (?:is )?no longer available|this job posting (?:has )?expired|this listing has expired)\b/i;
// Script/JSON blobs carry error strings for every state ("This job is no longer accepting applications"), so read only what a visitor sees.
export function visibleText(html) {
  return String(html).slice(0, 600000).replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}
export async function checkLinks(jobs, { nowIso, fetchImpl = globalThis.fetch, concurrency = 6, timeoutMs = 10000, maxAgeMs = 20 * 3600000 } = {}) {
  const now = Date.parse(nowIso);
  const due = jobs.filter(j => /^https?:\/\//i.test(j.url || '') && !(now - Date.parse(j.linkCheckedAt || 0) < maxAgeMs));
  const dead = new Set(), checked = new Set();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, async () => {
    while (next < due.length) {
      const job = due[next++];
      try {
        const response = await fetchImpl(job.url, { redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(timeoutMs) });
        checked.add(job.id);
        if ([404, 410].includes(response.status)) { dead.add(job.id); continue; }
        if (response.ok && DEAD_TEXT.test(visibleText(await response.text()))) dead.add(job.id);
      } catch { /* unknown: keep the job and try again next run */ }
    }
  }));
  return { dead, checked, checkedAt: new Date(now).toISOString() };
}