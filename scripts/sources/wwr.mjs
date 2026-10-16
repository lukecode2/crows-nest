import { client, collect, rawJob, remoteJobs, iso } from '../lib/source-utils.mjs';
import { cleanText } from '../lib/normalize.mjs';
export const name = 'wwr';
export async function fetchJobs(ctx) {
  return collect(['sales-and-marketing', 'full-stack-programming', 'front-end-programming', 'customer-support'], async category => {
    const xml = await client(ctx).getText(`https://weworkremotely.com/categories/remote-${category}-jobs.rss`);
    if (!/<rss\b|<feed\b/i.test(xml)) throw new Error('Expected RSS feed');
    const field = (item, tag) => cleanText(item.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '', Infinity);
    return remoteJobs([...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([, item]) => {
      const text = field(item, 'title'), split = text.indexOf(':');
      return rawJob({ title: split < 0 ? text : text.slice(split + 1).trim(), company: split < 0 ? '' : text.slice(0, split).trim(), url: field(item, 'link'), postedAt: iso(field(item, 'pubDate')), snippet: field(item, 'description'), eligible: [field(item, 'country').replace(/\p{Regional_Indicator}/gu, '').trim(), field(item, 'state')].filter(Boolean).join(', '), source: name });
    }));
  }, ctx);
}
