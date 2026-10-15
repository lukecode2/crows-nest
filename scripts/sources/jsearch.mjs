import { client, collect, rawJob, iso, pay } from '../lib/source-utils.mjs';
export const name = 'jsearch';
export async function fetchJobs(ctx) {
  if (!ctx.env.RAPIDAPI_KEY) throw new Error('missing key');
  const list = ctx.searches.jsearch || [];
  const now = ctx.now || new Date();
  const dayOfYear = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000);
  const start = (dayOfYear * 3 + (ctx.runSlot || 0)) * 2;
  const selected = Array.from({ length: Math.min(2, list.length) }, (_, k) => list[(start + k) % list.length]);
  return collect(selected, async (entry, index) => {
    if (index > 0) await new Promise(resolve => setTimeout(resolve, 1500)); // free plan rate limit
    const params = new URLSearchParams({ query: entry.query, page: '1', num_pages: '1', date_posted: 'week', country: 'us' });
    const data = await client(ctx).getJson(`https://jsearch.p.rapidapi.com/search?${params}`, { headers: { 'x-rapidapi-key': ctx.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' } });
    return (data.data || []).map(j => rawJob({ title: j.job_title, company: j.employer_name || '', location: [j.job_city, j.job_state].filter(Boolean).join(', '), remote: Boolean(j.job_is_remote), url: j.job_apply_link, postedAt: iso(j.job_posted_at_datetime_utc), snippet: j.job_description || '', pay: pay(j.job_min_salary, j.job_max_salary, j.job_salary_period?.toLowerCase()), source: name, trackHint: entry.track }));
  }, ctx, 1);
}
