// Who Luke is, as rules: what a job must look like to be worth his time.
// Every gate here came from a real listing that slipped through (see tests/fetcher/fit.test.mjs).
import { parsePay, inHomeRegion } from './region.mjs';
const text = value => String(value || '');

// Other careers: licences, degrees or trades Luke doesn't have, or work nowhere near his tracks.
export const OTHER_CAREER = /\b(?:physicians?|surgeons?|surgery|doctors?|dentists?|dental|hygienists?|orthodont\w*|nurses?|nursing|RN|LPN|CNA|medical assistant|therap(?:ist|y)|pharmac\w*|psychiatr\w*|psycholog\w*|technologist|radiolog\w*|sonograph\w*|phlebotom\w*|veterinar\w*|hospitalist|patient|caregiver|home health|attorney|counsel|lawyer|paralegal|accountant|accounting|accounts payable|bookkeep\w*|tax (?:expert|preparer|professional|advisor|associate)|CPA|auditor|underwriter|loan officer|mortgage|real estate (?:sales )?agent|realtor|insurance (?:agent|agency|producer)|CDL|truck driver|teacher|tutor|professor|secretary|police|corrections|armed|security officer|stylist|barber|cosmetolog\w*|esthetician|massage|chef|cook|dishwasher|housekeep\w*|room attendant|environmental services|janitor\w*|custodian|daycare|child ?care|pet ?care|groomer|personal trainer|fitness|HVAC|plumb\w*|electricians?|welders?|CNC|machinist|automotive|beauty|cosmetics|fundrais\w*|charity|cleaning|stock(?:ing|er)|warehouse|cashier|scoop)\b/i;

// Marine work beyond the classic deck/dock titles: federal small-boat, lock, line-handling and dredge (DR) jobs.
const MARINE_EXTRA = /\b(?:small craft operator|lock (?:and|&) dam|line ?handlers?|dredge\w*|rigger|marine construction|firefighter (?:recruit|trainee)|recruit firefighter)\b|\(DR\)/i;
// Front-line jobs at a local marina or boat company count even when the title alone says nothing about boats.
const MARINE_COMPANY = /\b(?:marinas?|marine|boats?|yachts?|harbou?r|ferry)\b/i;
const MARINE_FRONTLINE = /\b(?:guest services|attendant|dock|crew|concierge|team member|fuel\w*|ship store)\b/i;
const MARINE_TRADE = /\b(?:technicians?|mechanics?|painters?|coatings?|riggers?|installers?|welders?|fib(?:er|re)glass|safety administrator)\b/i;
const TRAINING = /\b(?:apprentice|trainee|helper|entry(?:[- ]level)?|no (?:prior )?experience|will train)\b/i;
export function marineFit(job, isMarineTitle) {
  const title = text(job.title);
  if (MARINE_TRADE.test(title)) {
    if (!TRAINING.test(`${title} ${job.snippet || ''}`)) return false;
  } else if (OTHER_CAREER.test(title)) return false;
  return isMarineTitle(title) || MARINE_EXTRA.test(title) || MARINE_COMPANY.test(job.company) && MARINE_FRONTLINE.test(title) && inHomeRegion(job.location);
}

// Luke has no captain's licence, MMC engineering rating or survey ticket yet (config/filters.json "profile").
export function needsLicence(job, profile = {}) {
  const title = text(job.title);
  if (/\bexperienced\b/i.test(title)) return true;
  if (MARINE_TRADE.test(title) && TRAINING.test(`${title} ${job.snippet || ''}`) || /\b(?:trainee|apprentice|cadet|in training|entry|junior|deck ?hands?|dock ?hands?|crew member)\b/i.test(title)) return false;
  if (!profile.captainLicense && /\b(?:captain|master|pilot)\b/i.test(title)) return true;
  return /\b(?:surveyor|tankerman|engineer|QMED|electronics tech\w*)\b/i.test(title);
}

// Postings that say he must ALREADY hold a Coast Guard rating or licence ("You must possess ... MMC ... AB Unlimited").
// Obtain-later and preferred credentials do not count; a grade heading is not a waiver.
const CREDENTIAL = /\b(?:merchant mariner credential|MMC|able[- ]bodied seaman|AB (?:unlimited|endorsement)|oiler endorsement|(?:OS|ordinary seaman)\b[^.;]{0,30}\bendorsement|master\b[^.;]{0,40}\b\d{2,4} ?(?:GRT|GT|tons?)|\d{2,4}[- ]?(?:GRT|ton) (?:master|captain|licen[cs]e)|OUPV|six[- ]pack licen[cs]e|captain'?s licen[cs]e|(?:motorboat )?operator'?s? licen[cs]e|(?:USCG|U\.S\. Coast Guard|United States Coast Guard)[^;]{0,80}licen[cs]e|master'?s? licen[cs]e|deck officer)\b/i;
const MUST_HOLD = /\b(?:must (?:possess|have|hold|already)|required|requires|selective placement|minimum of)\b/i;
const NOT_YET = /\b(?:obtain|within \w+ (?:months?|days)|preferred|a plus|helpful|nice to have|will train|sponsor)\b/i;
export function needsCredentialHeLacks(job, profile = {}) {
  return String(job.snippet || '').split(/(?<=[.;!?•])\s+|\s+(?=[-*•]\s)/).some(sentence => {
    if (!CREDENTIAL.test(sentence) || !MUST_HOLD.test(sentence) || NOT_YET.test(sentence) || /\b(?:no|not)\b[^.;]{0,80}\b(?:required|needed)\b/i.test(sentence)) return false;
    const captainOnly = /captain|master|OUPV|six[- ]pack|motorboat|operator|licen[cs]e/i.test(sentence) && !/MMC|merchant mariner|endorsement|able[- ]bodied/i.test(sentence);
    return !(captainOnly && profile.captainLicense) && !(!captainOnly && profile.mmc);
  });
}

// People-facing sales, promo and cash work: the tech-sales and quick-cash tracks share one list.
const SALES_OR_CASH = /\b(?:SDR|BDR|sales|business development rep\w*|account executive|brand|ambassadors?|valet|parking|events?|demo|demonstrat\w*|promot\w*|sampl\w*|detail(?:er|ing)?|car ?wash|bell(?:person|man|hop|staff)|box office|ticket\w*|ushers?|light show|day ?work\w*|merchandis\w*|install\w*|stagehand|festival|marketing (?:agent|rep\w*)|customer success|wireless|mobile (?:associate|expert))\b/i;
// Store retail is only worth it at a tech/marine retailer or brand agency (his résumé), or when it pays $15+/hr.
export const STORE_RETAIL = /\b(?:sales associates?|retail sales|retail associates?|store associate|merchandise associate|sales lead)\b/i;
export const TECH_RETAILER = /\b(?:best buy|2020 companies|actionlink|bds|advantage solutions|cds|crossmark|mosaic|premium retail|spar|acosta|t-mobile|verizon|at&t|cricket|boost|spectrum|xfinity|comcast|apple|samsung|gamestop|simplisafe|vivint|adt|west marine|bass pro|marinemax|techtronic|tti)\b/i;
// Direct store employment differs from representing a brand through a staffing agency.
export const APPAREL_STORE = /\b(?:ralph lauren|tapestry|coach|kate spade|michael kors|tommy hilfiger|calvin klein|gap|old navy|banana republic|hollister|abercrombie|american eagle|aeropostale|h&m|zara|uniqlo|nordstrom|macy'?s|dillard'?s|belk|kohl'?s|bloomingdale'?s|saks|jcpenn(?:ey|y)|burlington)\b/i;
export function salesFit(job) {
  const title = text(job.title);
  if (OTHER_CAREER.test(title) || /\b(?:restaurant|kitchen)\b/i.test(title) || !SALES_OR_CASH.test(title)) return 'off-track';
  const duties = text(job.snippet).split(/[.;!?\n]+/).filter(s => !/\b(?:benefits?|coverage|401k)\b/i.test(s)).join('; ');
  if (/\b(?:sales|agent|producer)\b/i.test(title) && /\b(?:supplemental insurance|no prior insurance experience|sell(?:ing)? insurance|insurance (?:sales|producer|agent))\b/i.test(duties)) return 'off-track';
  if (/\b(?:brand|beauty|makeup|ambassador)\b/i.test(title) && /\b(?:makeup artistry|beauty advis(?:or|er)|food[- ]service experience|food service\s*&\s*customer service experience|serv(?:e|es|ing) (?:and (?:present|presenting) )?food)\b/i.test(job.snippet || '')) return 'off-track';
  if (/\b(?:AGM|assistant (?:general |store )?manager|supervisor|team lead|store lead|key ?holder)\b/i.test(title)) return 'senior';
  // He dismissed an "entry-level" Services AE as needing experience: closing roles need a track record.
  if (/\baccount executive\b/i.test(title) && !/\b(?:associate|junior|entry)\b/i.test(title)) return 'needs-experience';
  if ((STORE_RETAIL.test(title) || /\bbrand ambassador\b/i.test(title) && APPAREL_STORE.test(job.company)) && !TECH_RETAILER.test(`${job.company} ${title}`) && !(parsePay(job.pay, job.snippet)?.hourlyMax >= 15)) return 'generic-retail';
  return null;
}

// AI gigs need no experience; web/dev work only counts when the posting says junior or entry level.
const AI_GIG = /\b(?:AI (?:trainer|tutor|rater|evaluator|writer)|data (?:annotat\w*|label\w*|rater)|annotat\w*|label(?:l)?ers?|raters?|evaluators?|search quality|prompt|RLHF|transcri\w*)\b|^freelance lead\b/i;
const WEB = /\b(?:web|wordpress|shopify|webflow|front[- ]?end|full[- ]?stack|developers?|programmers?|software|engineers?|designer|automation|no-code|chatbot)\b/i;
const JUNIOR = /\b(?:junior|jr|entry|associate|intern|apprentice|trainee|graduate|beginner|no experience)\b/i;
export function aiWebFit(job) {
  const title = text(job.title);
  return AI_GIG.test(title) || WEB.test(title) && JUNIOR.test(title);
}

// He turned down $13/hr retail and a $10.50/hr gig, so a listed top rate under $15/hr is a no.
export function payTooLow(pay, snippet = '') {
  const parsed = parsePay(pay, snippet);
  return Boolean(parsed && parsed.hourlyMax > 0 && parsed.hourlyMax < 15);
}

// Repost farms and fake-job aggregators that turned up with placeholder text ("reputed company").
export const JUNK = /\breputed company\b|\b(?:remote quest jobs|remotical|wfpro|workdock|arenaflex|brighthush|barbarosbarberia|the elite job)\b/i;
export function isJunk(job, filters = {}) {
  const haystack = `${job.title} ${job.company} ${job.url} ${text(job.snippet)}`;
  return /\bremotehive\b|https?:\/\/frontendnode(?:-[a-z0-9]+)?\.onrender\.com(?:\/|$)/i.test(haystack) || JUNK.test(haystack) || (filters.junkSources || []).some(s => haystack.toLowerCase().includes(String(s).toLowerCase()));
}

// Page-watch emits every new link on a careers page: menus, magazine articles and category pages included.
const ARTICLE_PATH = /\/(?:news|blog|crewlife|training|articles?|about|faq|contact|yachts?-for-sale|yacht-charter|events?|press|account|login|privacy|terms|guides?)(?:\/|$)/i;
const JOB_NOUN = /\b(?:deck ?hands?|dock ?hands?|crew|mate|steward(?:ess)?|stew|captain|attendant|associate|representative|specialist|operator|technician|team member|position|opening|vacanc\w*|hiring|job)\b/i;
export function notAJobLink(job) {
  if (/\b(?:future project opportunities|when an opportunity arises)\b/i.test(job.snippet || '')) return true;
  try {
    const url = new URL(job.url);
    if (/(?:^|\.)yachtservicenetwork\.com$/i.test(url.hostname) && /^\/jobs\/[^/]+\/in\/[^/]+\/?$/i.test(url.pathname)) return true;
  } catch { /* keep malformed URLs for the source gate */ }
  if (job.source !== 'pagewatch') return false;
  const title = text(job.title).trim();
  let path = '';
  try { path = new URL(job.url).pathname; } catch { /* keep empty */ }
  return ARTICLE_PATH.test(path) || /^(?:the|how|why|what|top|\d+)\b/i.test(title) || title.split(/\s+/).length > 8 || !JOB_NOUN.test(title);
}

// Listings that tell you how fast you could start, so "start within a week" is visible on the card.
export const STARTS_FAST = /\b(?:immediate(?:ly)?|start (?:asap|immediately|right away|this week|tomorrow)|as soon as possible|hiring (?:now|immediately|this week)|now hiring|urgent(?:ly)?(?: hiring)?|same[- ]day|on[- ]the[- ]spot|walk[- ]?ins?|open interviews?|hiring event|seasonal|temporary|temp|holiday (?:help|season|hiring)|day ?work\w*|gig|per diem|on[- ]call|weekend)\b/i;
