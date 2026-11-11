// Explicit closures and unusable postings count; blocks and network failures stay unknown.
import { USER_AGENT } from './http.mjs';
import { isJunk, commissionOnly, insuranceRecruiting } from './fit.mjs';
export const DEAD_TEXT = /\b(?:this job (?:has )?(?:expired|is (?:no longer (?:available|open)|closed))|job (?:you are trying to apply for )?has been filled|the job you are trying to view has expired|(?:the )?[^<>\n]{1,200} job in [^<>\n]{1,160} has expired,? here are the closest matches|this position has been filled|(?:is|are) no longer accepting applications|this (?:job )?announcement has closed|this (?:job|position|posting) (?:is )?no longer available|this job posting (?:has )?expired|this listing has expired|couldn['’]t find this job posting|(?:this |the )?(?:job|position|vacancy|job opening|job posting) (?:has been |is )(?:filled|closed|removed)|(?:this |the )?(?:job|position|vacancy|posting) (?:is )?no longer (?:accepting applications|available|open)|no longer accepting applications|(?:job|position|vacancy|role) (?:has expired|not found|filled)|this role is no longer available|applications (?:for this (?:job|position) )?(?:are )?(?:now )?closed)\b/i;
// Script blobs carry error strings for every state; read only visible text.
export function visibleText(html) {
  return String(html).slice(0, 600000).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|#160|#x[aA]0);/g, ' ').replace(/&(?:rsquo|#8217|#39);/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}
export function checkUrl(value) {
  const url = new URL(value);
  const id = /(?:^|\.)adzuna\.com$/i.test(url.hostname) && url.pathname.match(/^\/land\/ad\/(\d+)\/?$/)?.[1];
  return id ? `https://www.adzuna.com/details/${id}${url.search}` : value;
}
// A detail URL that lands on a bare search/list page no longer identifies an opening.
export function redirectedToSearch(from, to) {
  try {
    const original = new URL(from), final = new URL(to);
    if (original.href === final.href) return false;
    const detail = /\/(?:job|jobs|yacht-crew-job|details|land\/ad|job-listing)\/[^/]+/i.test(original.pathname) || /[?&](?:jk|jl|jobid)=/i.test(original.search);
    const listing = /^(?:\/(?:[a-z]{2}(?:-[a-z]{2})?|companies\/[^/]+))?\/(?:jobs?|careers?|search|job-search|jobs?\/search|search\/results)\/?$/i.test(final.pathname) ||
      /^\/crew-placement\/yacht-crew\/jobs\/?$/i.test(final.pathname);
    const hasJobId = /[?&](?:jk|jl|jobid|gh_jid|requisitionid)=/i.test(final.search);
    return detail && listing && !hasJobId;
  } catch { return false; }
}
// JSON-LD is parsed as data only. Never scan application scripts or related-job cards as job duties.
export function jobPostings(html) {
  const found = [];
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if ([value['@type']].flat().includes('JobPosting')) found.push(value);
    if (value['@graph']) walk(value['@graph']);
  };
  for (const match of String(html).slice(0, 600000).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(match[1])); } catch { /* incomplete markup is unknown */ }
  }
  return found;
}
export function postingProblem(job, html, nowIso = new Date().toISOString()) {
  const visible = visibleText(html);
  for (const match of visible.matchAll(new RegExp(DEAD_TEXT.source, 'gi'))) {
    const before = visible.slice(Math.max(0, match.index - 100), match.index);
    // 'Applications accepted until this job is closed' describes a future condition.
    if (!/\b(?:until|when|once|if|after|before)\b[^.;!?]{0,90}$/i.test(before)) return 'expired';
  }
  const postings = jobPostings(html);
  if (postings.length > 1) return null;
  const posting = postings[0];
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(posting?.validThrough || '') ? `${posting.validThrough}T23:59:59Z` : posting?.validThrough;
  if (Date.parse(expiry) < Date.parse(nowIso)) return 'expired';
  // Some Adzuna detail pages omit JSON-LD; this section contains only the employer's description.
  const section = String(html).match(/<section\b[^>]*class=["'][^"']*\badp-body\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1];
  if (!posting && !section) return null;
  const full = { ...job, title: posting?.title || job.title, company: posting?.hiringOrganization?.name || job.company,
    snippet: visibleText(posting?.description || section || '') };
  if (isJunk(full)) return 'junk-listing';
  if (insuranceRecruiting(full)) return 'commission-insurance';
  if (commissionOnly(full)) return 'commission-only';
  return null;
}
const ACCESS_BLOCK = /(?:just a moment|verify (?:that )?you are human|access denied|authenticating\.\.\.|enable javascript and cookies to continue)/i;
export async function checkLinks(jobs, { nowIso = new Date().toISOString(), fetchImpl = globalThis.fetch, concurrency = 3, timeoutMs = 15000, maxAgeMs = 5 * 3600000, hostDelayMs = 1300 } = {}) {
  const now = Date.parse(nowIso);
  const due = jobs.filter(j => /^https?:\/\//i.test(j.url || '') && !(now - Date.parse(j.linkCheckedAt || 0) < maxAgeMs));
  const dead = new Set(), checked = new Set(), reasons = new Map(), hosts = new Map();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, async () => {
    while (next < due.length) {
      const job = due[next++];
      let url, host;
      try { url = checkUrl(job.url); host = new URL(url).hostname; } catch { continue; }
      const prior = hosts.get(host) || Promise.resolve();
      let release;
      hosts.set(host, new Promise(resolve => { release = resolve; }));
      await prior;
      try {
        const response = await fetchImpl(url, { redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(timeoutMs) });
        let reason;
        if ([404, 410].includes(response.status)) { checked.add(job.id); reason = 'expired'; }
        else if (response.ok) {
          const html = await response.text();
          const text = visibleText(html);
          const login = /\/(?:login|sign[-_]?in|auth)(?:[/?#]|$)/i.test(response.url || '');
          if (login || ACCESS_BLOCK.test(text.slice(0, 500))) continue;
          // Empty JavaScript shells are not a successful verification; retry next run.
          if (!text.trim() && !jobPostings(html).length) continue;
          checked.add(job.id);
          reason = redirectedToSearch(job.url, response.url) ? 'redirect-to-search' : postingProblem(job, html, nowIso);
        }
        if (reason) { dead.add(job.id); reasons.set(job.id, reason); }
      } catch { /* unknown: try again next run */ }
      finally {
        if (hostDelayMs) await new Promise(resolve => setTimeout(resolve, hostDelayMs));
        release();
      }
    }
  }));
  return { dead, checked, reasons, checkedAt: new Date(now).toISOString() };
}
