import { client, collect, rawJob, iso } from '../lib/source-utils.mjs';
import { cleanText } from '../lib/normalize.mjs';
import { MARINE_TITLE } from '../lib/filter.mjs';
import { inHomeRegion } from '../lib/region.mjs';
import { robotsAllowed } from './pagewatch.mjs';
import * as ats from './ats.mjs';
export const name = 'govjobs';
export const relevantTitle = title => MARINE_TITLE.test(title || '') || /\b(?:captain|boats?|harbou?r|park ranger|dock\w*|water\w*|wastewater|valet|event|firefighter|seasonal)\b/i.test(title || '');
// CivicPlus RSS sometimes double-escapes both HTML and ampersands in job URLs.
const decoded = value => {
  let text = String(value || '');
  for (let i = 0; i < 3; i++) text = cleanText(text, Infinity);
  return text;
};
function rssJobs(xml, entry) {
  if (!/<(?:rss|feed)\b/i.test(xml)) throw new Error('Not a job RSS/Atom feed');
  const tag = (block, name) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '';
  return [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].map(([, block]) => rawJob({
    title: decoded(tag(block, 'title')), company: entry.name, location: decoded(tag(block, 'location')) || entry.location || '',
    url: decoded(tag(block, 'link')) || decoded(block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1]),
    postedAt: iso(decoded(tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated'))),
    snippet: decoded(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content')), pay: decoded(tag(block, 'salary'))
  }));
}
export async function fetchJobs(ctx) {
  const api = client(ctx), cache = new Map();
  return collect(ctx.govfeeds?.feeds || [], async entry => {
    const url = entry.url || `https://${entry.host}/wday/cxs/${entry.tenant}/${entry.site}/jobs`;
    const origin = new URL(url).origin;
    if (!cache.has(origin)) cache.set(origin, (async () => {
      try { return await api.getText(`${origin}/robots.txt`); }
      catch (error) { if (error.status === 404) return ''; throw error; }
    })());
    if (!robotsAllowed(await cache.get(origin), url)) throw new Error(`robots.txt disallows ${entry.name}`);
    let jobs;
    if (entry.type === 'rss') jobs = rssJobs(await api.getText(url), entry);
    else if (entry.type === 'workday') {
      jobs = await ats.fetchJobs({ ...ctx, companies: [{ ...entry, ats: 'workday', track: undefined }], acceptJob: j => relevantTitle(j.title) });
      jobs = jobs.map(j => ({ ...j, location: inHomeRegion(j.location) ? j.location : [j.location, entry.location].filter(Boolean).join(', ') }));
    } else if (entry.type === 'json') {
      const data = await api.getJson(url);
      const rows = Array.isArray(data) ? data : data.jobs;
      if (!Array.isArray(rows)) throw new Error('Not a job JSON feed');
      jobs = rows.map(j => rawJob({ ...j, company: j.company || entry.name, location: j.location || entry.location || '' }));
    } else throw new Error(`Unsupported government feed: ${entry.type}`);
    return jobs.filter(j => relevantTitle(j.title) && (!entry.counties?.length || entry.counties.some(c => new RegExp(`\\b${c} County\\b`, 'i').test(j.location))))
      .map(j => { const { trackHint, track, ...rest } = j; return { ...rest, source: name }; });
  }, ctx, 3);
}
