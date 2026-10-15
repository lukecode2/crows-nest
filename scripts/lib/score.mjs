import { TRACK_KEYWORDS } from './classify.mjs';
export function scoreJob(job) {
  const text = `${job.title || ''} ${job.snippet || ''}`;
  let score = 40;
  const flags = (job.flags || []).filter(f => ['page-changed', 'far-away', 'live-aboard', 'high-pay', 'pay-unknown'].includes(f));
  if (TRACK_KEYWORDS[job.track]?.test(job.title || '')) score += 20;
  if (/\b(?:entry|no experience|will train|trainee|junior|apprentice|seasonal)\b/i.test(text)) { score += 10; flags.push('entry-level'); }
  if (String(job.pay || '').trim()) score += 5;
  const age = (Date.now() - Date.parse(job.postedAt)) / 86400000;
  if (age >= 0 && age <= 3) score += 10;
  else if (age >= 0 && age <= 7) score += 5;
  if (/\b(100|200|500)\s*ton|master'?s license|captain'?s license required/i.test(text)) score -= 10;
  for (const [flag, pattern] of [['needs-twic', /\btwic\b/i], ['needs-mmc', /\b(?:mmc|merchant mariner)\b/i], ['needs-eng1', /\b(?:eng ?1|stcw medical)\b/i], ['drug-test', /\bdrug (?:test|screen)/i]]) {
    if (pattern.test(text)) flags.push(flag);
  }
  return { score: Math.max(0, Math.min(100, score)), flags };
}
