import { client, rawJob, remoteJobs, iso, pay } from '../lib/source-utils.mjs';
export const name = 'himalayas';
export async function fetchJobs(ctx) {
  const data = await client(ctx).getJson('https://himalayas.app/jobs/api?limit=100');
  return remoteJobs((data.jobs || []).map(j => rawJob({ title: j.title, company: j.companyName || '', url: j.applicationLink, postedAt: iso(j.pubDate), snippet: j.description || j.excerpt || '', pay: pay(j.minSalary, j.maxSalary, j.salaryPeriod), source: name })));
}
