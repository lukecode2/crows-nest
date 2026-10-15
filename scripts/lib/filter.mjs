import { normalizeUrl } from './normalize.mjs';
import { inHomeRegion, isHighPay, isLiveAboard, lowWageShore, SC_CITIES, NC_CITIES } from './region.mjs';
const lower = value => String(value || '').trim().toLowerCase();
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const MARINE_TITLE = /\b(?:deck ?hands?|dock ?hands?|deck crew|boats?|boating|marina|marine|maritime|yachts?|yachting|vessel|seaman|mariner|ferry|tug(?:boat)?|barge|ship(?:yard)?|sailing|sailor|charter|harbou?r|able seaman|AB|OS|wiper|oiler|stew(?:ard|ardess)?|day ?worker|ocean rescue|lifeguard)\b/i;
export function isMarineTitle(title) {
  if (/banker|landfill|physician|surgeon|nurse|architect|banquet|catering/i.test(title || '')) return false;
  return MARINE_TITLE.test(title || '') || /\bcaptain\b/i.test(title || '') && /\b(?:boat|marine|vessel|charter|tug|ferry|yacht|fishing)\b/i.test(title || '');
}
export function isCruise(job, filters = {}) {
  const company = lower(job.company);
  if ((filters.allowCompanies || []).some(c => company.includes(lower(c)))) return false;
  return (filters.excludeCompanies || []).some(c => company.includes(lower(c))) || /cruise\s*(ship|line)s?/i.test(`${job.title} ${job.snippet}`);
}
export function isSenior(job, filters = {}) {
  const title = job.title || '';
  const assistant = /\bassistant\b/i.test(title);
  if (!assistant && /\b(?:senior|sr|vp|vice president|director|general manager|head of|chief|president|owner|partner|managers?)\b/i.test(title)) return true;
  if (!['ai-web', 'tech-sales'].includes(job.track)) return false;
  if (/\b(?:II|III|IV)\b/i.test(title)) return true;
  if ((/\bengineers?\b/i.test(title) || job.track === 'ai-web' && /\b(?:architect|scientist|researcher)\b/i.test(title)) &&
    !/\b(?:junior|entry|associate|intern|apprentice|trainee|trainer)\b/i.test(title)) return true;
  return /\b(?:senior|sr\.?|lead|principal|staff)\b/i.test(title) ||
    /\b([4-9]|1\d)\+?\s*years/i.test(job.snippet || '') || /(bachelor'?s|degree)\s+(is\s+)?required/i.test(job.snippet || '') ||
    (filters.seniorKeywords || []).some(k => new RegExp(`\\b${escaped(k)}\\b`, 'i').test(`${title} ${job.snippet}`));
}
// Kept separate from deduplication so the catch log uses exactly the same gates.
export function dropReason(job, { filters = {}, dismissed = {}, trackedIds = new Set() } = {}) {
  const items = dismissed.items || [];
  if (items.some(j => j.id && j.id === job.id || j.url && normalizeUrl(j.url) === normalizeUrl(job.url) || j.reason === 'company' && lower(j.company) && lower(j.company) === lower(job.company))) return 'dismissed';
  if (new Set(trackedIds).has(job.id)) return 'tracked';
  if (isCruise(job, filters)) return 'cruise';
  if (isSenior(job, filters)) return 'senior';
  if (needsOtherLanguage(job.title)) return 'language';
  if ((filters.excludeKeywords || []).some(k => lower(job.title).includes(lower(k)))) return 'excluded-keyword';
  if (job.track?.startsWith('marine-') && !isMarineTitle(job.title)) return 'not-marine';
  if (inHomeRegion(job.location) || job.remote) return null;
  if (job.track === 'quick-cash') return 'far-quick-cash';
  if (job.track?.startsWith('marine-')) {
    if (isLiveAboard(job.title) || isHighPay(job.pay) || !String(job.pay || '').trim() && !lowWageShore(job.title)) return null;
    return 'far-shore-job';
  }
  if (['tech-sales', 'ai-web'].includes(job.track) && !isHighPay(job.pay) && (String(job.pay || '').trim() || lowWageShore(job.title))) return 'far-low-pay';
  return null;
}
const normalized = value => lower(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const primaryLocation = job => String(job.location || '').replace(/\s*\(\+\d+ more\)$/, '');
export function roleKey(job, cities = []) {
  const places = [...new Set([...SC_CITIES, ...NC_CITIES, ...cities, primaryLocation(job).split(',')[0]].filter(Boolean))].map(escaped).sort((a, b) => b.length - a.length);
  let title = String(job.title || '').replace(/\s+at\s+.+$/i, '');
  if (places.length) title = title.replace(new RegExp(`\\s*(?:[-–—]\\s*(?:${places.join('|')})|\\((?:${places.join('|')})\\))\\s*$`, 'i'), '');
  return `${normalized(job.company)}|${normalized(title)}`;
}
const newest = job => Date.parse(job.postedAt || job.firstSeenAt) || 0;
export function applyFilters(jobs, options = {}) {
  const cities = [...new Set(jobs.flatMap(j => [primaryLocation(j), ...(j.otherLocations || [])].map(l => l.split(',')[0])))];
  const sorted = jobs.filter(j => !dropReason(j, options)).map(j => {
    const far = !j.remote && !inHomeRegion(j.location);
    const aboard = isLiveAboard(j.title), high = isHighPay(j.pay);
    const flags = (j.flags || []).filter(f => !['far-away', 'live-aboard', 'high-pay', 'pay-unknown'].includes(f));
    if (far) {
      flags.push('far-away');
      if (!aboard && !high && !String(j.pay || '').trim()) flags.push('pay-unknown');
    }
    if (aboard) flags.push('live-aboard');
    if (high) flags.push('high-pay');
    return { ...j, track: far && j.track?.startsWith('marine-') ? 'marine-national' : j.track, flags: [...new Set(flags)] };
  }).sort((a, b) => (b.score || 0) - (a.score || 0) || newest(b) - newest(a));
  const ids = new Map(), roles = new Map(), result = [];
  for (const job of sorted) {
    const key = roleKey(job, cities);
    const kept = job.id && ids.get(job.id) || roles.get(key);
    if (kept) {
      const all = new Set([primaryLocation(kept), ...(kept.otherLocations || []), primaryLocation(job), ...(job.otherLocations || [])].filter(Boolean));
      const first = primaryLocation(kept);
      all.delete(first);
      kept.otherLocations = [...all].slice(0, 10);
      const previousCount = Number(kept.location.match(/\(\+(\d+) more\)$/)?.[1] || 0);
      kept.location = `${first}${all.size || previousCount ? ` (+${Math.max(all.size, previousCount)} more)` : ''}`;
    } else {
      result.push(job); roles.set(key, job);
    }
    if (job.id) ids.set(job.id, kept || job);
  }
  return result;
}

// Luke speaks English only; AI-rating and support gigs often require another language.
export function needsOtherLanguage(title) {
  return /\b(?:german|french|spanish|japanese|korean|chinese|mandarin|cantonese|portuguese|italian|dutch|polish|arabic|hindi|turkish|russian|swedish|norwegian|danish|finnish|hebrew|vietnamese|thai|indonesian|bilingual)\b/i.test(title || '');
}
