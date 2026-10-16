import { TRACKS } from './config.js';
const DAY = 86400000;
export function weeklySweepDue(sweep, now = Date.now()) {
  if (!sweep) return false;
  if (sweep.sweptAt === null) return true;
  return typeof sweep.sweptAt === 'string' && now - Date.parse(sweep.sweptAt) > 7 * DAY;
}
const dateNumber = s => Date.parse(s + 'T12:00:00Z');
export const localToday = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const addDays = (dateStr, n) => new Date(dateNumber(dateStr) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((dateNumber(b) - dateNumber(a)) / DAY);
export function weekStart(dateStr) {
  return addDays(dateStr, -((new Date(dateNumber(dateStr)).getUTCDay() + 6) % 7));
}
export function appsInWeek(jobs, today) {
  const start = weekStart(today), end = addDays(start, 6);
  return jobs.filter(j => j.dateApplied && j.dateApplied >= start && j.dateApplied <= end).length;
}
export function streak(jobs, today, goal) {
  if (!(goal > 0)) return 0;
  let count = appsInWeek(jobs, today) >= goal ? 1 : 0;
  let week = addDays(weekStart(today), -7);
  while (appsInWeek(jobs, week) >= goal) { count++; week = addDays(week, -7); }
  return count;
}
export function totals(jobs) {
  return {
    applied: jobs.filter(j => j.dateApplied).length,
    interviews: jobs.filter(j => ['boarding', 'hired'].includes(j.stage) || (j.history || []).some(h => h.stage === 'boarding')).length,
    offers: jobs.filter(j => j.stage === 'hired').length
  };
}
export function overdue(jobs, today, days = 7) {
  return jobs.filter(j => ['castoff', 'hailed'].includes(j.stage)).map(j => {
    const last = [j.dateApplied, j.lastFollowUp].filter(Boolean).sort().pop();
    return { ...j, daysWaiting: last ? daysBetween(last, today) : 0 };
  }).filter(j => j.daysWaiting >= days).sort((a, b) => b.daysWaiting - a.daysWaiting);
}
export function nextActions(jobs, n = 3) {
  return jobs.filter(j => j.nextAction && j.nextDue && !['hired', 'lost'].includes(j.stage))
    .slice().sort((a, b) => a.nextDue.localeCompare(b.nextDue)).slice(0, n);
}
export function newSince(jobs, isoLastVisit) {
  const counts = Object.fromEntries(TRACKS.map(t => [t.id, 0]));
  jobs.forEach(j => { if (j.track in counts && (!isoLastVisit || Date.parse(j.firstSeenAt) > Date.parse(isoLastVisit))) counts[j.track]++; });
  return counts;
}
export function countdown(today, show) {
  if (today < show.start) return { phase: 'before', days: daysBetween(today, show.start) };
  if (today <= show.end) return { phase: 'during', days: daysBetween(today, show.end) };
  return { phase: 'after', days: daysBetween(show.end, today) };
}
export function safeUrl(u) {
  if (typeof u !== 'string') return null;
  try { return ['https:', 'http:'].includes(new URL(u).protocol) ? u : null; } catch (_) { return null; }
}
export function feedJobToTracker(job, stage = 'dockside', today = localToday()) {
  const now = new Date().toISOString();
  const reqMap = { 'needs-eng1': 'eng1', 'needs-mmc': 'mmc', 'needs-twic': 'twic', 'drug-test': 'drug' };
  return {
    id: 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9), feedId: job.id || null,
    company: job.company || '', role: job.title || '', track: job.track || 'marine-local', location: job.location || '',
    link: job.url || '', pay: job.pay || '', stage, dateApplied: stage === 'castoff' ? today : null, lastFollowUp: null,
    contact: { name: '', email: '', phone: '' }, notes: '', reqs: [...new Set((job.flags || []).map(f => reqMap[f]).filter(Boolean))],
    nextAction: '', nextDue: null, createdAt: now, updatedAt: now, history: [{ stage, at: now }]
  };
}
const instant = value => Date.parse(value || '') || 0;
const editTime = item => instant(item.updatedAt || item.createdAt);
function mergeItems(local = [], remote = []) {
  const items = new Map(remote.map(item => [item.id, item]));
  local.forEach(item => { const other = items.get(item.id); if (!other || editTime(item) >= editTime(other)) items.set(item.id, item); });
  return [...items.values()];
}
export function mergeTrackers(local = {}, remote = {}) {
  const newer = instant(local.updatedAt) >= instant(remote.updatedAt) ? local : remote;
  // Tombstones prevent a deleted lead returning after a conflict or another device's save.
  const deletedJobs = { ...remote.deletedJobs };
  Object.entries(local.deletedJobs || {}).forEach(([id, at]) => { if (!deletedJobs[id] || instant(at) > instant(deletedJobs[id])) deletedJobs[id] = at; });
  const directory = { ...remote.directory };
  Object.entries(local.directory || {}).forEach(([id, entry]) => {
    if (!directory[id] || instant(entry.updatedAt) >= instant(directory[id].updatedAt)) directory[id] = entry;
  });
  return { ...remote, ...local, version: 1, updatedAt: newer.updatedAt || '', settings: { weeklyGoal: 10, followUpDays: 7, ...newer.settings },
    jobs: mergeItems(local.jobs, remote.jobs).filter(j => !deletedJobs[j.id] || editTime(j) > instant(deletedJobs[j.id])),
    reqs: mergeItems(local.reqs, remote.reqs), directory, ...(Object.keys(deletedJobs).length ? { deletedJobs } : {}) };
}

// Short intros for Quick Apply notes and "Why you?" boxes. Every claim comes from his résumé.
const PITCHES = {
  marine: 'I have 1,000+ hours at the helm and 8 seasons of marina work: I ran charters and towed watersports for groups of up to 15 at Pinecrest Marina, and launched, fueled, cleaned and covered boats at Freedom Boat Club. I hold STCW Basic (Sea School Charleston, 2025), a driver\'s license and a US passport, and I\'m ready to build saltwater experience.',
  sales: 'I\'ve run live product demos at Best Buy for Meta, Amazon Fire TV and SimpliSafe as a brand ambassador with 2020 Companies, ActionLink and BDS Connected Solutions. I consistently met KPIs and sales goals, trained store staff on client products, and I\'m comfortable starting conversations with shoppers all day.',
  cash: 'I\'ve worked valet in high-volume hospitality settings (HPS in Charleston, Evolution Parking in Myrtle Beach) and brand-ambassador demos at Best Buy, so I\'m used to fast-paced, guest-facing work. I\'m local to Myrtle Beach and can start right away.',
  aiweb: 'I designed and built a full real-estate website for a local agent using AI-assisted development, including property search, lead capture and an admin dashboard, so I work with AI tools hands-on. I\'m detail-oriented and pick up new guidelines quickly.'
};
const PROMO = /\b(?:ambassador|demo\w*|promot\w*|sales|merchandis\w*|marketing|event|brand)\b/i;
// "Bellperson & Valet (Part-time) - Ocean 22" reads better as "Bellperson & Valet".
const shortTitle = title => String(title || '').split(/\s+[-–—|]\s+|\s*\(/)[0].trim();
export function pitchFor(job) {
  const lead = String(job.title || '').match(/^freelance lead:\s*(.+?)\s*[—–-]\s*(.+)$/i);
  if (lead) return `Hi, I'm Luke Smith, a web developer here in Myrtle Beach. I came across ${job.company || lead[1]} and had an idea: ${lead[2].replace(/[.\s]+$/, '')}. I recently built a full real-estate website for a local agent, with property search, lead capture and an admin dashboard. I'd be glad to put together a quick mockup for you, no strings attached.`;
  const kind = String(job.track || '').startsWith('marine-') ? 'marine' : job.track === 'tech-sales' ? 'sales' : job.track === 'ai-web' ? 'aiweb' : PROMO.test(job.title || '') ? 'sales' : 'cash';
  const title = shortTitle(job.title);
  return `Hi, I'm Luke Smith and I'd like to apply for ${title ? `the ${title} role` : 'this role'}${job.company ? ` at ${job.company}` : ''}. ${PITCHES[kind]} I'd welcome the chance to talk. Thank you!`;
}
