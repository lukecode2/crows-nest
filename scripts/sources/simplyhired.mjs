import { readFile } from 'node:fs/promises';
import { client, collect, rawJob, iso } from '../lib/source-utils.mjs';
// SimplyHired carries Indeed's listings (Indeed itself blocks robots). Its search page embeds the results as JSON.
// Found 2026-11-16: the weekly browser sweep's finds were all here and missing from the feed.
// Cloudflare blocks GitHub's servers (403) but not Luke's Mac, so `npm run simplyhired:save` on the Mac writes
// data/simplyhired.json and the robot reads that file when the live site blocks it.
export const name = 'simplyhired';
export const SAVED = new URL('../../data/simplyhired.json', import.meta.url);
export function parseResults(html, entry) {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error('no results data on page');
  const jobs = JSON.parse(match[1])?.props?.pageProps?.jobs || [];
  return jobs.filter(j => j.jobKey && j.title && !j.sponsored).map(j => {
    const remote = /\bremote\b/i.test(j.location || '') || (j.remoteAttributes || []).length > 0;
    const extras = [...(j.requirements || []), ...(j.jobTypes || [])].join(', ');
    return rawJob({ title: j.title, company: j.company || '', location: remote ? (j.location && !/\bremote\b/i.test(j.location) ? `Remote — ${j.location}` : 'Remote') : j.location || '', remote, pay: j.salaryInfo || '',
      url: `https://www.simplyhired.com/job/${j.jobKey}`, postedAt: iso(j.dateOnIndeed), snippet: [j.snippet, extras].filter(Boolean).join(' · '), source: name, trackHint: entry.track });
  });
}
export async function fetchLive(ctx) {
  const entries = ctx.searches.simplyhired || [];
  let blocked = false;
  return collect(entries, async entry => {
    if (blocked) throw new Error('skipped: blocked');
    const params = new URLSearchParams({ q: entry.q, l: entry.l, t: String(entry.days || 7) });
    try { return parseResults(await client(ctx).getText(`https://www.simplyhired.com/search?${params}`, { retries: 0 }), entry); }
    catch (error) { if (error.status === 403) { blocked = true; error.message = 'HTTP 403 (bot check)'; } throw error; }
  }, ctx, 1);
}
export async function fetchJobs(ctx) {
  try { return await fetchLive(ctx); }
  catch (error) {
    const saved = await readFile(ctx.simplyhiredPath || SAVED, 'utf8').then(JSON.parse).catch(() => null);
    const age = saved && (Date.parse(ctx.now?.toISOString?.() || new Date().toISOString()) - Date.parse(saved.savedAt)) / 86400000;
    if (!Array.isArray(saved?.jobs) || !(age <= 3)) throw new Error(`${error.message.slice(0, 80)}; no fresh saved file (run npm run simplyhired:save on the Mac)`);
    ctx.log?.(`simplyhired: live blocked, using ${saved.jobs.length} jobs saved ${saved.savedAt}`);
    return saved.jobs.map(j => ({ ...j, source: name }));
  }
}
