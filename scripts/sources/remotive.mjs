import { client, collect, rawJob, remoteJobs, iso } from '../lib/source-utils.mjs';
export const name = 'remotive';
export async function fetchJobs(ctx) {
  return collect(ctx.searches.remote || [], async entry => {
    const data = await client(ctx).getJson(`https://remotive.com/api/remote-jobs?${new URLSearchParams({ search: entry.q, limit: '50' })}`);
    return remoteJobs((data.jobs || []).map(j => rawJob({ title: j.title, company: j.company_name || '', pay: j.salary || '', url: j.url, snippet: j.description || '', postedAt: iso(j.publication_date), source: name })));
  }, ctx, 2);
}
