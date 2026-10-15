import { MARINE_TITLE } from './filter.mjs';
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
  if (job.trackHint) return job.trackHint;
  const text = [job.title, job.snippet, job.location].join(' ');
  if (/\b(?:firefighter|lifeguard|ocean rescue)\b/i.test(job.title || '')) {
    if (/\b(?:myrtle|horry|georgetown|pawleys|murrells|little river|conway)\b/i.test(job.location || '')) return 'marine-local';
    if (/\b(?:charleston|berkeley|dorchester|mount pleasant|summerville|isle of palms|goose creek|hanahan|ladson)\b/i.test(job.location || '')) return 'marine-chs';
  }
  if (/\b(?:myrtle|north myrtle|murrells|georgetown|pawleys|little river|conway|surfside|garden city)\b/i.test(text)) {
    if (MARINE.test(text)) return 'marine-local';
    if (CASH.test(text) || /\bevent\b/i.test(text)) return 'quick-cash';
  }
  if (MARINE.test(text)) return /\b(?:charleston|mount pleasant|summerville|isle of palms|james island|north charleston)\b/i.test(text) ? 'marine-chs' : 'marine-national';
  if (SALES.test(text)) return TEMP.test(text) ? 'quick-cash' : 'tech-sales';
  if (WEB.test(text)) return 'ai-web';
  return 'quick-cash';
}
