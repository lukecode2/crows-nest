import { createHash } from 'node:crypto';

export function normalizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(ref|src)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/(?=\?|$)/, '');
  } catch { return String(value).trim(); }
}

export function makeId(job) {
  const key = job.url ? normalizeUrl(job.url) : [job.company, job.title, job.location].map(s => s || '').join('|').toLowerCase();
  return createHash('sha1').update(key).digest('hex');
}

export function cleanText(value, max = 240) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
  const text = String(value ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/gi, (_, name) => entities[name.toLowerCase()])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (all, n) => {
      const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }).replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, Math.max(0, max - 1)) + (max ? '…' : '') : text;
}
