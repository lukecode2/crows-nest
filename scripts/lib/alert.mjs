import { inHomeRegion, inCharlestonBand, hasHousing, isHighPay, statedPay, parsePay } from './region.mjs';

export const SITE_URL = 'https://lukecode2.github.io/crows-nest/';
const HOT_HOURLY = 18;

// Local marine jobs and well-paid work near home fill within days, so they ping Luke's phone.
function isHot(job) {
  if (job.remote || /^\s*remote\b/i.test(job.location || '')) return false;
  if (inCharlestonBand(job.location) && !inHomeRegion(job.location)) {
    return isHighPay(statedPay(job)) || hasHousing(job);
  }
  if (!inHomeRegion(job.location)) return false;
  if (job.track?.startsWith('marine-')) return true;
  return (parsePay(statedPay(job))?.hourlyMax || 0) >= HOT_HOURLY;
}
export function hotJobs(prev, jobs) {
  // With no earlier feed every job looks new; one ping per job would be noise.
  if (!prev.length) return [];
  const seen = new Set(prev.map(j => j.id));
  return jobs.filter(j => !seen.has(j.id) && isHot(j)).sort((a, b) => (b.score || 0) - (a.score || 0));
}

const httpUrl = url => /^https?:\/\//i.test(String(url || '')) ? url : null;
export const jobLink = (id, siteUrl = SITE_URL) => `${siteUrl}#nest?job=${encodeURIComponent(id)}`;
export function alertMessage(jobs, siteUrl = SITE_URL) {
  const line = j => `${j.title} — ${j.company}${j.location ? `, ${j.location}` : ''}${j.pay ? ` (${j.pay})` : ''}`;
  const lines = jobs.slice(0, 5).map(line);
  if (jobs.length > 5) lines.push(`+${jobs.length - 5} more on the site`);
  // Tapping opens the job on the site (it is published before the ping goes out); the button opens the employer's posting.
  const posting = jobs.length === 1 && httpUrl(jobs[0].url);
  return {
    title: jobs.length === 1 ? `New job: ${jobs[0].title}` : `${jobs.length} new jobs near home`,
    message: lines.join('\n'),
    click: jobs.length === 1 ? jobLink(jobs[0].id, siteUrl) : `${siteUrl}#nest?alerts=1`,
    ...(posting ? { actions: [{ action: 'view', label: 'Open posting', url: posting }] } : {})
  };
}

// Every ping is remembered in feed.json, so a job that later fills or gets filtered can still be found on the site.
const ALERT_LOG_SIZE = 40;
export function alertLog(prevAlerts, hot, alertedAt) {
  const fresh = hot.map(j => ({ id: j.id, title: j.title, company: j.company, location: j.location || '', pay: j.pay || '', url: httpUrl(j.url) || '', track: j.track, alertedAt }));
  const ids = new Set(fresh.map(a => a.id));
  return [...fresh, ...(prevAlerts || []).filter(a => !ids.has(a.id))].slice(0, ALERT_LOG_SIZE);
}
export const pendingAlerts = feed => (feed.alerts || []).filter(a => a.alertedAt && a.alertedAt === feed.generatedAt);

// GitHub Pages takes a minute or more to publish a push. Wait until the live site serves this run's feed.
export async function waitForSite(generatedAt, { fetchImpl = fetch, siteUrl = SITE_URL, tries = 30, delayMs = 20000, pause = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetchImpl(`${siteUrl}data/feed.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok && (await res.json()).generatedAt === generatedAt) return true;
    } catch (_) { /* keep waiting */ }
    if (i < tries - 1) await pause(delayMs);
  }
  return false;
}

// ntfy.sh is a free push service: Luke subscribes to the topic in the ntfy phone app.
// JSON publishing keeps em dashes and other non-ASCII text out of HTTP headers.
export async function sendAlert(jobs, { topic, fetchImpl = fetch, siteUrl = SITE_URL, timeoutMs = 15000 } = {}) {
  if (!topic || !jobs.length) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('ntfy timeout')), timeoutMs);
  try {
    const res = await fetchImpl('https://ntfy.sh/', {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, ...alertMessage(jobs, siteUrl), tags: ['anchor'], priority: 4 })
    });
    if (!res.ok) throw new Error(`ntfy ${res.status}`);
    return true;
  } finally { clearTimeout(timer); }
}
