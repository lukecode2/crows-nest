import { MARINE_TITLE } from './filter.mjs';
import { STORE_RETAIL, TECH_RETAILER, APPAREL_STORE } from './fit.mjs';
// Shared title-fit lists: every alternative is bounded to avoid mate/automate matches.
const LEGACY_MARINE = /\b(?:deckhand|dockhand|deck hand|mate|boat|marina|yacht|vessel|captain|seaman|mariner|ferry|tug|harbor|crew)\b/i;
export const MARINE = new RegExp(`${MARINE_TITLE.source}|${LEGACY_MARINE.source}`, 'i');
export const SALES = /\b(?:sdr|bdr|sales development|business development rep(?:resentative)?|account executive|brand ambassador|retail sales|product demo)\b/i;
export const WEB = /\b(?:web|developer|front-end|frontend|wordpress|shopify|ai|a\.i\.|prompt|annotation|data label|automation|no-code|chatbot|llm)(?=\W|$)/i;
export const CASH = /\b(?:valet|event staff|detailing|detail|day work|dayworker|day worker)\b/i;
export const TEMP = /\b(?:part-time|part time|event|weekend|temporary|gig)\b/i;
export const TRACK_KEYWORDS = {
  'marine-local': MARINE, 'marine-chs': MARINE, 'marine-national': MARINE,
  'tech-sales': SALES, 'ai-web': WEB,
  'quick-cash': /\b(?:valet|event|detailing|day work|dayworker|day worker|brand ambassador|demo)\b/i
};
export function classifyTrack(job) {
  const title = job.title || '', role = `${title} ${job.snippet || ''}`;
  if (job.trackHint?.startsWith('marine-')) return /\bmcclellanville\b/i.test(job.location || '') ? 'marine-chs' : job.trackHint;
  const retail = STORE_RETAIL.test(title) || /\bretail\b.*\bsales\b/i.test(title) || /\bbrand ambassador\b/i.test(title) && APPAREL_STORE.test(job.company);
  if (retail && !TECH_RETAILER.test(`${job.company} ${title}`)) return 'quick-cash';
  const temporary = TEMP.test(title) || /\b(?:part[- ]time|temporary|weekends? only|on[- ]demand|per required need)\b/i.test(job.snippet || '') || /\b(?:demo(?:nstrat\w*)?|install\w*|on[- ]demand)\b/i.test(title);
  if (temporary && /\b(?:sales|brand|retail|demo(?:nstrat\w*)?|install\w*)\b/i.test(title)) return 'quick-cash';
  if (!temporary && (/\bfield sales\b/i.test(title) ||
    retail && TECH_RETAILER.test(`${job.company} ${title}`) ||
    /\b(?:chromebook|tech(?:nology)?|wireless|telecom)\b/i.test(title) && /\b(?:sales|brand)\b/i.test(title) ||
    /\bbrand ambassador\b/i.test(title) && /\bfull[- ]time\b/i.test(role))) return 'tech-sales';
  if (MARINE.test(title) && /\bmcclellanville\b/i.test(job.location || '')) return 'marine-chs';
  if (job.trackHint) return job.trackHint;
  const text = [title, job.snippet, job.location].join(' ');
  if (/\b(?:firefighter|lifeguard|ocean rescue)\b/i.test(job.title || '')) {
    if (/\b(?:myrtle|horry|georgetown|pawleys|murrells|little river|conway)\b/i.test(job.location || '')) return 'marine-local';
    if (/\b(?:charleston|mcclellanville|berkeley|dorchester|mount pleasant|summerville|isle of palms|goose creek|hanahan|ladson)\b/i.test(job.location || '')) return 'marine-chs';
  }
  if (/\b(?:myrtle|north myrtle|murrells|georgetown|pawleys|little river|conway|surfside|garden city)\b/i.test(text)) {
    if (MARINE.test(text)) return 'marine-local';
    if (CASH.test(text) || /\bevent\b/i.test(text)) return 'quick-cash';
  }
  if (MARINE.test(text)) return /\b(?:charleston|mcclellanville|mount pleasant|summerville|isle of palms|james island|north charleston)\b/i.test(text) ? 'marine-chs' : 'marine-national';
  if (SALES.test(text)) return TEMP.test(text) ? 'quick-cash' : 'tech-sales';
  if (WEB.test(text)) return 'ai-web';
  return 'quick-cash';
}
