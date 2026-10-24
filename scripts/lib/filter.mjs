import { normalizeUrl } from './normalize.mjs';
import { statedPay, inHomeRegion, isHighPay, isLiveAboard, lowWageShore, remoteAbroad, foreignPlace, SC_CITIES, NC_CITIES } from './region.mjs';
import { OTHER_CAREER, marineFit, needsLicence, needsCredentialHeLacks, salesFit, aiWebFit, payTooLow, isJunk, notAJobLink } from './fit.mjs';
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
  return (filters.excludeCompanies || []).some(c => company.includes(lower(c))) || /cruise\s*(ship|line)s?/i.test(`${job.title} ${job.snippet}`) ||
    CRUISE_BRANDS.test(`${job.title} ${job.snippet}`);
}
// Crewing agencies post cruise jobs under their own name ("ISMIRA ... DECKHAND for Virgin Voyages").
const CRUISE_BRANDS = /\b(?:virgin voyages|royal caribbean|carnival cruise|norwegian cruise|celebrity cruises|princess cruises|disney cruise|msc cruises|holland america|viking (?:cruises|river|ocean)|windstar|lindblad|american queen|uncruise|oceania cruises|regent seven seas|silversea|seabourn|cunard|azamara|american cruise lines?)\b/i;
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// Largest "N years of/required/experience" in the text (ranges count from their low end), ignoring company bragging.
export function requiredYears(snippet) {
  const required = String(snippet || '').split(/[.,;!?•\n]+|\b(?:but|and)\s+(?=(?:a |an |valid |current |must |at least |minimum |\d))/i).filter(s => !/\b(?:preferred|a plus|nice to have)\b/i.test(s) && !/driver'?s? licen[cs]e|driving (?:experience|record|history)|licen[cs]e tenure/i.test(s)).join('; ');
  const found = [...required.matchAll(/(?:\b|\()(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\)?\s*(?:\(\d+\)\s*)?(?:\+|plus)?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?(?:\+\s*)?years?['’]?\s+(?!of (?:history|excellence|service|growth|innovation|tradition|serving|business|operation|success|combined))(?:of|in|experience|exp|required|working|professional|related|relevant|selling|sales|closing|b2b|saas|quota)\b/gi)]
    .map(m => NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1])).filter(n => n <= 15);
  return found.length ? Math.max(...found) : 0;
}
function requiresDegree(snippet) {
  const headed = snippet.match(/(?:qualifications?\s+required|required\s+qualifications?)\s*:?\s*([\s\S]{0,260}?bachelor[’']?s(?:\s+degree)?[^.;\n]{0,100})/i)?.[1];
  return Boolean(headed && !/preferred|or equivalent/i.test(headed)) || snippet.split(/[.;!?•\n]+/).some(s =>
    /(bachelor[’']?s|degree)\s+(is\s+)?required/i.test(s) && !/preferred|or equivalent/i.test(s));
}
export function isSenior(job, filters = {}) {
  const title = job.title || '';
  const assistant = /\bassistant\b/i.test(title);
  if (/\b(?:leader|supervisor|(?:ramp|valet|bell|shift) captain)\b/i.test(title) || /\b(?:head|chief)[- ]+(?:stew(?:ard(?:ess)?)?|deckhand|chef|engineer)\b/i.test(title)) return true;
  const snippet = String(job.snippet || '');
  if (/\b(?:sales|SDR|BDR|account executive|business development|brand (?:ambassador|specialist))\b/i.test(title) && requiredYears(snippet) >= 2) return true;
  if (requiresDegree(snippet)) return true;
  if (!assistant && /\b(?:senior|sr|vp|vice president|director|general manager|head of|chief|president|owner|partner|managers?)\b/i.test(title)) return true;
  if (!['ai-web', 'tech-sales'].includes(job.track)) return requiredYears(job.snippet) >= 4;
  if (/\b(?:II|III|IV)\b/i.test(title)) return true;
  if ((/\bengineers?\b/i.test(title) || job.track === 'ai-web' && /\b(?:architect|scientist|researcher)\b/i.test(title)) &&
    !/\b(?:junior|entry|associate|intern|apprentice|trainee|trainer)\b/i.test(title)) return true;
  const leadershipTitle = title.replace(/\blead (?:brand ambassador|generation)\b/gi, '');
  return /\b(?:senior|sr\.?|lead|principal|staff)\b/i.test(leadershipTitle) ||
    requiredYears(job.snippet) >= 2 ||
    (filters.seniorKeywords || []).some(k => new RegExp(`\\b${escaped(k)}\\b`, 'i').test(`${title} ${job.snippet}`));
}
// Kept separate from deduplication so the catch log uses exactly the same gates.
export function dropReason(job, { filters = {}, dismissed = {}, trackedIds = new Set(), trackedJobs = [], nowIso, deadIds } = {}) {
  job = { ...job, pay: statedPay(job) };
  const items = dismissed.items || [];
  if (items.some(j => j.id && j.id === job.id || j.url && normalizeUrl(j.url) === normalizeUrl(job.url) || j.reason === 'company' && lower(j.company) && lower(j.company) === lower(job.company))) return 'dismissed';
  if (new Set(trackedIds).has(job.id) || trackedJobs.some(t =>
    job.url && (t.url || t.link) && normalizeUrl(job.url) === normalizeUrl(t.url || t.link) ||
    normalized(job.company) && normalized(job.title) && roleKey(job) === roleKey({ ...t, title: t.title || t.role }))) return 'tracked';
  if (deadIds?.has(job.id)) return 'dead-link';
  if (isCruise(job, filters)) return 'cruise';
  if (isJunk(job, filters)) return 'junk-listing';
  const skipped = (filters.skipCompanies || []).find(c => lower(job.company).includes(lower(c.name)));
  if (skipped) return skipped.reason || 'skipped-company';
  // Single postings an audit read in full: the snippet hides what rules them out (config/filters.json "excludeJobs").
  const excluded = (filters.excludeJobs || []).find(e => e.id === job.id || e.url && job.url && normalizeUrl(e.url) === normalizeUrl(job.url));
  if (excluded) return excluded.reason || 'excluded-job';
  if (notAJobLink(job)) return 'not-a-job';
  if (job.closesAt && nowIso && Date.parse(job.closesAt) < Date.parse(nowIso)) return 'closed';
  if (isSenior(job, filters)) return 'senior';
  if (!inHomeRegion(job.location) && /\bmust (?:reside in the commuting area|live within \d+[- ]?(?:mile|miles)\b)/i.test(job.snippet || '')) return 'residency';
  if (needsOtherLanguage(job.title) || /\b(?:bilingual|spanish|french|portuguese|mandarin)\b[^.]{0,40}\brequired\b|\bfluen(?:t|cy) in (?:spanish|french|portuguese|mandarin|german)\b/i.test(job.snippet || '')) return 'language';
  if (['quick-cash', 'tech-sales'].includes(job.track) && /\b(?:100% commission|commission[- ]only|straight commission|no base salary or draw)\b/i.test(job.snippet || '')) return 'commission-only';
  if ((filters.excludeKeywords || []).some(k => lower(job.title).includes(lower(k)))) return 'excluded-keyword';
  const remote = job.remote || /^\s*remote\b/i.test(job.location || '');
  if (remote && remoteAbroad(job)) return 'remote-abroad';
  if (!remote && foreignPlace(job.location) && !(job.track?.startsWith('marine-') && isLiveAboard(job.title))) return 'abroad';
  if (job.track?.startsWith('marine-')) {
    if (!marineFit(job, isMarineTitle)) return 'not-marine';
    if (needsLicence(job, filters.profile) || needsCredentialHeLacks(job, filters.profile)) return 'needs-licence';
  } else if (job.track === 'ai-web') {
    if (OTHER_CAREER.test(job.title || '') || !aiWebFit(job)) return 'off-track';
  } else {
    const reason = salesFit(job);
    if (reason) return reason;
  }
  if (payTooLow(job.pay)) return 'pay-too-low';
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
  const company = normalized(job.company).replace(/^(?:tti|techtronic industries north america(?: inc)?)$/, 'techtronic industries north america');
  return `${company}|${normalized(title)}`;
}
const newest = job => Date.parse(job.postedAt || job.firstSeenAt) || 0;
export function applyFilters(jobs, options = {}) {
  const cities = [...new Set(jobs.flatMap(j => [primaryLocation(j), ...(j.otherLocations || [])].map(l => l.split(',')[0])))];
  const sorted = jobs.map(j => ({ ...j, pay: statedPay(j) })).filter(j => !dropReason(j, options)).map(j => {
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
