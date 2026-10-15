import { client, collect, rawJob, iso, pay } from '../lib/source-utils.mjs';
export const name = 'adzuna';
export async function fetchJobs(ctx) {
  const { ADZUNA_APP_ID, ADZUNA_APP_KEY } = ctx.env;
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) throw new Error('missing key');
  return collect((ctx.searches.adzuna || []).slice(0, 8), async entry => {
    const params = new URLSearchParams({ app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY, what: entry.what, where: entry.where || '', distance: '40', results_per_page: '50', max_days_old: '14', 'content-type': 'application/json' });
    const data = await client(ctx).getJson(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`);
    return (data.results || []).map(j => rawJob({ title: j.title, company: j.company?.display_name || '', location: j.location?.display_name || '', url: j.redirect_url, postedAt: iso(j.created), snippet: j.description || '', pay: pay(j.salary_min, j.salary_max), source: name, trackHint: entry.track }));
  }, ctx);
}
