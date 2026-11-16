import { client, collect, rawJob, iso } from '../lib/source-utils.mjs';
// SimplyHired carries Indeed's listings (Indeed itself blocks robots). Its search page embeds the results as JSON.
// Found 2026-11-16: the weekly browser sweep's finds were all here and missing from the feed.
export const name = 'simplyhired';
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
export async function fetchJobs(ctx) {
  return collect(ctx.searches.simplyhired || [], async entry => {
    const params = new URLSearchParams({ q: entry.q, l: entry.l, t: String(entry.days || 7) });
    return parseResults(await client(ctx).getText(`https://www.simplyhired.com/search?${params}`), entry);
  }, ctx, 2);
}
