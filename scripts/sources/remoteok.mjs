import { client, rawJob, remoteJobs, iso } from '../lib/source-utils.mjs';
import { WEB, SALES } from '../lib/classify.mjs';
export const name = 'remoteok';
export async function fetchJobs(ctx) {
  const data = await client(ctx).getJson('https://remoteok.com/api');
  return remoteJobs(data.slice(1).filter(j => (j.tags || []).some(tag => WEB.test(tag) || SALES.test(tag))).map(j => rawJob({ title: j.position, company: j.company || '', url: j.url, postedAt: iso(j.date || j.epoch), snippet: j.description || '', pay: j.salary_min || j.salary_max ? `$${j.salary_min || j.salary_max}${j.salary_max && j.salary_min ? '–$' + j.salary_max : ''}` : '', eligible: j.location, source: name })));
}
