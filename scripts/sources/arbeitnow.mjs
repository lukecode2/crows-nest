import { client, rawJob, remoteJobs, iso } from '../lib/source-utils.mjs';
export const name = 'arbeitnow';
export async function fetchJobs(ctx) {
  const data = await client(ctx).getJson('https://www.arbeitnow.com/api/job-board-api');
  return remoteJobs((data.data || []).filter(j => j.remote === true).map(j => rawJob({ title: j.title, company: j.company_name || '', url: j.url, postedAt: iso(j.created_at), snippet: j.description || '', source: name })));
}
