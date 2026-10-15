import { client, collect, rawJob, remoteJobs, iso, pay } from '../lib/source-utils.mjs';
export const name = 'jobicy';
export async function fetchJobs(ctx) {
  return collect(ctx.searches.remote || [], async entry => {
    const data = await client(ctx).getJson(`https://jobicy.com/api/v2/remote-jobs?${new URLSearchParams({ count: '50', tag: entry.q, geo: 'usa' })}`);
    return remoteJobs((data.jobs || []).map(j => rawJob({ title: j.jobTitle, company: j.companyName || '', url: j.url, postedAt: iso(j.pubDate), snippet: j.jobDescription || j.jobExcerpt || '', pay: pay(j.annualSalaryMin, j.annualSalaryMax, 'year'), source: name })));
  }, ctx, 2);
}
