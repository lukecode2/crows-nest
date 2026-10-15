import { client, collect, companyEntries, rawJob, entryMatches } from '../lib/source-utils.mjs';
import { cleanText } from '../lib/normalize.mjs';
export const name = 'pagewatch';
// The expanded employer list needs time for per-request timeouts and retries.
export const timeoutMs = 240000;
export function robotsAllowed(text, url) {
  let agents = [], rules = [], inRules = false;
  const groups = [];
  const flush = () => { if (agents.length) groups.push({ agents, rules }); agents = []; rules = []; inRules = false; };
  for (const line of text.replace(/\\r\\n/g, '\n').split(/\r?\n/)) {
    const match = line.replace(/#.*$/, '').trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, directive, value] = match;
    if (directive.toLowerCase() === 'user-agent') { if (inRules) flush(); agents.push(value.toLowerCase()); }
    else if (/^(allow|disallow)$/i.test(directive)) { inRules = true; if (value) rules.push({ allow: directive.toLowerCase() === 'allow', path: value }); }
  }
  flush();
  const specific = groups.filter(g => g.agents.some(a => a !== '*' && 'crowsnestjobbot'.includes(a)));
  const applicable = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  const path = new URL(url).pathname + new URL(url).search;
  const matches = applicable.flatMap(g => g.rules).filter(r => {
    const end = r.path.endsWith('$');
    const pattern = (end ? r.path.slice(0, -1) : r.path).split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + pattern + (end ? '$' : '')).test(path);
  }).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}
export async function fetchJobs(ctx) {
  const robotsCache = new Map();
  return collect(companyEntries(ctx).filter(e => e.ats === 'page'), async entry => {
    const origin = new URL(entry.url).origin;
    if (!robotsCache.has(origin)) robotsCache.set(origin, (async () => {
      try { return await client(ctx).getText(`${origin}/robots.txt`); }
      catch (error) { if (error.status === 404) return ''; throw error; }
    })());
    const robots = await robotsCache.get(origin);
    if (!robotsAllowed(robots, entry.url)) throw new Error(`robots.txt disallows ${entry.name}`);
    const html = (await client(ctx).getText(entry.url))
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    const links = new Map();
    for (const [, attributes, inner] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const text = cleanText(inner, Infinity);
      if (!href || !/deck|dock|crew|mate|marina|captain|yacht|job|career|position|ambassador|valet|sales/i.test(text)) continue;
      let url;
      try { url = new URL(cleanText(href[1] ?? href[2] ?? href[3], Infinity), entry.url); } catch { continue; }
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      const job = rawJob({ title: text, company: entry.name, location: entry.location || '', url: url.href, snippet: 'New link on careers page', source: name, trackHint: entry.track || undefined, flags: ['page-changed'] });
      // A careers link does not provide a job location; only apply state restrictions when supplied by the page.
      if (entryMatches(job, { ...entry, states: undefined })) links.set(url.href, job);
    }
    const previous = ctx.state[entry.url];
    if (ctx.signal?.aborted) return [];
    ctx.state[entry.url] = [...links.keys()];
    if (!Array.isArray(previous)) return [];
    const known = new Set(previous);
    return [...links.values()].filter(j => !known.has(j.url));
  }, ctx, 4);
}
