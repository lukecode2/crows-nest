import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const TOP_COUNTS = { 'grand-strand': 14, charleston: 10, florida: 6 };
const regions = Object.keys(TOP_COUNTS);
const crewTypes = /charter|head[ -]?boat|fishing fleet|(?:boat|dock)[ -]crew|deckhand|dockhand|dock operations|marina|dry[ -]?stack|ferr(?:y|ies)|water[ -]taxi|towing|towboatus|sea tow|tall ship|sailing|parasail|jet[ -]ski|watersports|water sports|boat club|yacht club|boat tours|dolphin|sightseeing|harbor tour|riverboat|tiki boat|tug|barge|workboat|vessel crew/i;
const slug = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const webUrl = value => {
  try { return /^https?:$/.test(new URL(value).protocol) ? value : ''; } catch { return ''; }
};
const urlKey = value => {
  if (!webUrl(value)) return '';
  const url = new URL(value);
  return url.host.replace(/^www\./, '').toLowerCase() + url.pathname.replace(/\/+$/, '') + url.search;
};
const companyKey = name => {
  // Franchise locations share one call list entry, just like the marina/boat-club chains.
  if (/^sea tow\b/i.test(name)) return 'sea-tow';
  if (/^towboatus\b/i.test(name)) return 'towboatus';
  return slug(name);
};
const contacts = employer => {
  const supplied = [employer.phone, employer.email, employer.contact].filter(Boolean).join('; ');
  return {
    phone: [...new Set(supplied.match(/(?:1[- ])?\(?\d{3}\)?[- .]\d{3}[- .]\d{4}/g) || [])].join('; '),
    email: [...new Set(supplied.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g) || [])].join('; ')
  };
};
function eligible(e) {
  if (!regions.includes(e.region)) return false;
  const text = `${e.name} ${e.type}`;
  if (/cruise[ -](?:line|ship)|carnival|royal caribbean|norwegian cruise|american cruise lines|viking cruises/i.test(text)) return false;
  const crew = crewTypes.test(e.type);
  if (/shipyard|shipbuilding|ship repair|fabrication|marine trades|commercial div/i.test(e.type)) return false;
  if (/repair|dealer|retail|manufacturer|service shop|dive shop/i.test(e.type) && !crew) return false;
  if (e.region === 'florida' && (/general job board|professional networking/i.test(e.type) ||
    !/crew|day[ -]?work|live[ -]?aboard/i.test(`${e.type} ${e.hiringMethod}`))) return false;
  const { phone, email } = contacts(e);
  return Boolean(phone || email || webUrl(e.careersUrl) || webUrl(e.url) || webUrl(e.website));
}
export function scoreEmployer(e) {
  const crew = crewTypes.test(e.type);
  const direct = /walk[ -]?in|phone|call|email/i.test(e.hiringMethod);
  const careers = /career|online|application|apply|register|portal|resume|profile/i.test(e.hiringMethod) || /career|jobs|employment/i.test(e.url);
  return (crew ? 3 : 0) + (e.region === 'grand-strand' ? 2 : e.region === 'charleston' ? 1 : 0) +
    ((e.region !== 'florida' && direct) || careers ? 1 : 0) + (e.phone ? 1 : 0);
}
function approach(e) {
  if (e.region === 'florida') return /day[ -]?work/i.test(`${e.type} ${e.hiringMethod}`)
    ? 'Ask about paid day work and send your marine resume with STCW details.'
    : 'Register your marine resume and STCW details; ask about junior live-aboard deck roles.';
  if (/walk[ -]?in/i.test(e.hiringMethod)) return /marina|dry[ -]?stack|boat club|yacht club/i.test(e.type)
    ? 'Walk in before 9am with your resume and ask for the dock master.'
    : 'Walk in before departures with your resume and ask who hires deck crew.';
  if (/phone|call/i.test(e.hiringMethod) && e.phone) return 'Call before departures and ask about entry-level deck or dock crew openings.';
  if (/email/i.test(e.hiringMethod) && e.email) return 'Email your marine resume and ask about entry-level deck or dock crew openings.';
  if (/career|online|application|apply|portal/i.test(e.hiringMethod)) return 'Check the jobs page for deck or dock crew roles and send your marine resume.';
  return 'Use the website contact page to ask who hires entry-level deck or dock crew.';
}
export function buildDirectory(source, generatedAt = new Date().toISOString()) {
  const groups = [];
  // This research row is filed under Grand Strand but explicitly locates its center in Charleston.
  const regional = source.employers.map(e => /research center in Charleston/i.test(e.town) ? { ...e, region: 'charleston' } : e);
  for (const employer of regional.filter(eligible)) {
    const keys = [companyKey(employer.name), ...[employer.careersUrl, employer.url, employer.website].map(urlKey).filter(Boolean).map(key => 'url:' + key)];
    const matches = groups.filter(group => keys.some(key => group.keys.has(key)));
    const group = matches.shift() || { keys: new Set(), entries: [] };
    if (!groups.includes(group)) groups.push(group);
    for (const other of matches) {
      other.keys.forEach(key => group.keys.add(key)); group.entries.push(...other.entries);
      groups.splice(groups.indexOf(other), 1);
    }
    keys.forEach(key => group.keys.add(key)); group.entries.push(employer);
  }
  const usedIds = new Set();
  const employers = groups.map(group => {
    const entries = group.entries.slice().sort((a, b) => regions.indexOf(a.region) - regions.indexOf(b.region));
    const primary = entries[0];
    const join = key => [...new Set(entries.map(e => e[key]).filter(Boolean))].join(' / ');
    const details = entries.map(contacts);
    const e = {
      id: companyKey(primary.name), name: ['sea-tow', 'towboatus'].includes(companyKey(primary.name)) && entries.length > 1
        ? (companyKey(primary.name) === 'sea-tow' ? 'Sea Tow' : 'TowBoatUS') : primary.name, region: primary.region,
      town: join('town'), type: join('type'), hiringMethod: join('hiringMethod'),
      phone: [...new Set(details.flatMap(c => c.phone.split('; ')).filter(Boolean))].join('; '),
      email: [...new Set(details.flatMap(c => c.email.split('; ')).filter(Boolean))].join('; '),
      url: entries.map(e => webUrl(e.careersUrl)).find(Boolean) || entries.map(e => webUrl(e.url) || webUrl(e.website)).find(Boolean) || '',
      tier: 'more'
    };
    const baseId = e.id;
    for (let suffix = 2; usedIds.has(e.id); suffix++) e.id = `${baseId}-${suffix}`;
    usedIds.add(e.id);
    e.score = scoreEmployer(e); e.tip = approach(e);
    return e;
  });
  // Prefer an identified local town over an uncertain regional listing when scores tie.
  const uncertain = e => /verify local|regional;/i.test(e.town) ? 1 : 0;
  employers.sort((a, b) => regions.indexOf(a.region) - regions.indexOf(b.region) || b.score - a.score || uncertain(a) - uncertain(b));
  for (const region of regions) employers.filter(e => e.region === region).slice(0, TOP_COUNTS[region]).forEach(e => { e.tier = 'top'; });
  return { generatedAt, about: 'Local employers and crew resources condensed from config/local-employers.json. Research contacts and hiring methods need confirmation; inclusion does not mean an opening is available. Chains appear once in the nearest region, with towns joined. Scores: crew fit +3, Grand Strand +2 or Charleston +1, direct local hiring or careers route +1, phone +1; ties favor identified local towns, then research order.', employers };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = JSON.parse(await readFile(new URL('../config/local-employers.json', import.meta.url), 'utf8'));
  const directory = buildDirectory(source);
  await writeFile(new URL('../data/directory.json', import.meta.url), JSON.stringify(directory, null, 2) + '\n');
  console.log(`Directory: ${directory.employers.filter(e => e.tier === 'top').length} top picks, ${directory.employers.length} total employers.`);
}
