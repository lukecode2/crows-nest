import { inHomeRegion, parsePay } from './region.mjs';

export const SITE_URL = 'https://lukecode2.github.io/crows-nest/';
const HOT_HOURLY = 18;

// Local marine jobs and well-paid work near home fill within days, so they ping Luke's phone.
function isHot(job) {
  if (['marine-local', 'marine-chs'].includes(job.track)) return true;
  if (job.remote || !inHomeRegion(job.location)) return false;
  return (parsePay(job.pay)?.hourlyMax || 0) >= HOT_HOURLY;
}
export function hotJobs(prev, jobs) {
  // With no earlier feed every job looks new; one ping per job would be noise.
  if (!prev.length) return [];
  const seen = new Set(prev.map(j => j.id));
  return jobs.filter(j => !seen.has(j.id) && isHot(j)).sort((a, b) => (b.score || 0) - (a.score || 0));
}

const httpUrl = url => /^https?:\/\//i.test(String(url || '')) ? url : null;
export function alertMessage(jobs, siteUrl = SITE_URL) {
  const line = j => `${j.title} — ${j.company}${j.location ? `, ${j.location}` : ''}${j.pay ? ` (${j.pay})` : ''}`;
  const lines = jobs.slice(0, 5).map(line);
  if (jobs.length > 5) lines.push(`+${jobs.length - 5} more on the site`);
  return {
    title: jobs.length === 1 ? `New job: ${jobs[0].title}` : `${jobs.length} new jobs near home`,
    message: lines.join('\n'),
    click: (jobs.length === 1 && httpUrl(jobs[0].url)) || siteUrl
  };
}

// ntfy.sh is a free push service: Luke subscribes to the topic in the ntfy phone app.
// JSON publishing keeps em dashes and other non-ASCII text out of HTTP headers.
export async function sendAlert(jobs, { topic, fetchImpl = fetch, siteUrl = SITE_URL } = {}) {
  if (!topic || !jobs.length) return false;
  const res = await fetchImpl('https://ntfy.sh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, ...alertMessage(jobs, siteUrl), tags: ['anchor'], priority: 4 })
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
  return true;
}
