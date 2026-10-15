import { normalizeUrl } from './normalize.mjs';
const lower = value => String(value || '').trim().toLowerCase();
export function isCruise(job, filters = {}) {
  const company = lower(job.company);
  if ((filters.allowCompanies || []).some(c => company.includes(lower(c)))) return false;
  return (filters.excludeCompanies || []).some(c => company.includes(lower(c))) || /cruise\s*(ship|line)s?/i.test(`${job.title} ${job.snippet}`);
}
export function isSenior(job, filters = {}) {
  if (!['ai-web', 'tech-sales'].includes(job.track)) return false;
  return /\b(senior|sr\.?|lead|principal|staff|manager|director|head of|vp)\b/i.test(job.title || '') ||
    /\b([4-9]|1\d)\+?\s*years/i.test(job.snippet || '') || /(bachelor'?s|degree)\s+(is\s+)?required/i.test(job.snippet || '') ||
    (filters.seniorKeywords || []).some(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(`${job.title} ${job.snippet}`));
}
export function applyFilters(jobs, { filters = {}, dismissed = {}, trackedIds = new Set() } = {}) {
  const items = dismissed.items || [];
  const ids = new Set(items.map(j => j.id).filter(Boolean));
  const urls = new Set(items.map(j => normalizeUrl(j.url)).filter(Boolean));
  const companies = new Set(items.filter(j => j.reason === 'company').map(j => lower(j.company)).filter(Boolean));
  const tracked = new Set(trackedIds);
  const seenIds = new Set(), seenRoles = new Set();
  return jobs.filter(job => {
    if (isCruise(job, filters) || isSenior(job, filters) || ids.has(job.id) || (job.url && urls.has(normalizeUrl(job.url))) || companies.has(lower(job.company)) || tracked.has(job.id)) return false;
    if ((filters.excludeKeywords || []).some(k => lower(job.title).includes(lower(k)))) return false;
    const role = [job.company, job.title, String(job.location || '').split(',')[0]].map(lower).join('|');
    if ((job.id && seenIds.has(job.id)) || seenRoles.has(role)) return false;
    if (job.id) seenIds.add(job.id);
    seenRoles.add(role);
    return true;
  });
}
