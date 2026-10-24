// Locations arrive as city/state, city/county, or semicolon-separated ATS locations.
export const SC_CITIES = 'Myrtle Beach|North Myrtle Beach|Conway|Carolina Forest|Surfside|Surfside Beach|Garden City|Murrells Inlet|Pawleys Island|Georgetown|Little River|Loris|Aynor|Charleston|North Charleston|McClellanville|Mount Pleasant|Summerville|James Island|Johns Island|Daniel Island|Isle of Palms|Folly Beach|Kiawah|Kiawah Island|Goose Creek|Moncks Corner|Hanahan|Ladson'.split('|');
export const NC_CITIES = 'Wilmington|Shallotte|Calabash|Southport|Leland|Whiteville|Tabor City'.split('|');
const SC_COUNTIES = 'Horry|Georgetown|Charleston|Berkeley|Dorchester|Colleton|Williamsburg|Marion|Florence'.split('|');
const NC_COUNTIES = 'Brunswick|Columbus|New Hanover|Pender'.split('|');
const bound = names => new RegExp(`\\b(?:${names.join('|')})\\b`, 'i');
const sc = bound([...SC_CITIES, ...SC_COUNTIES.map(c => `${c} County`)]);
const nc = bound([...NC_CITIES, ...NC_COUNTIES.map(c => `${c} County`)]);
export function inHomeRegion(location) {
  const text = String(location || '').replace(/\s*\(\+\d+ more\)$/, '');
  if (/\bremote\b/i.test(text)) return true;
  return text.split(';').some(part => {
    const state = part.match(/(?:,|\s)\s*(South Carolina|North Carolina|SC|NC|[A-Z]{2}|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)(?:\s+\d{5})?\s*$/i)?.[1]?.toLowerCase();
    if (!state && /,/.test(part) && /\b(?:Marion|Florence|Berkeley|Dorchester|Brunswick) County\b/i.test(part) &&
      !bound([...SC_CITIES, ...NC_CITIES, 'Marion', 'Florence', 'Mullins', 'Lake City', 'Johnsonville', 'Pamplico', 'Timmonsville', 'Bonneau', 'St. Stephen', 'Ridgeville', 'St. George']).test(part.split(',')[0])) return false;
    if (state && !['sc', 'nc', 'south carolina', 'north carolina'].includes(state)) return false;
    return (!state || state === 'sc' || state === 'south carolina') && sc.test(part) ||
      (!state || state === 'nc' || state === 'north carolina') && nc.test(part);
  });
}
// Only explicit base hourly rates can fill a missing structured pay field.
export function statedPay(job) {
  if (String(job.pay || '').trim()) return job.pay;
  const snippet = String(job.snippet || '');
  const rates = [...snippet.matchAll(/(?:\$\s*\d+(?:\.\d+)?(?:\s*[-–—]\s*\$?\s*\d+(?:\.\d+)?)?|pay rate:\s*\$?\s*\d+(?:\.\d+)?(?:\s*[-–—]\s*\$?\s*\d+(?:\.\d+)?)?)\s*(?:\/\s*(?:hr|hour)|(?:per|an)\s+hour|hourly)\b/gi)].filter(m => {
    const before = snippet.slice(Math.max(0, m.index - 30), m.index), after = snippet.slice(m.index + m[0].length, m.index + m[0].length + 40);
    return !/\b(?:tips?|gratuities)\s*:?\s*$/i.test(before) && !/^\s*(?:(?:including|with|in|after)\s+)?(?:tips?|gratuities)\b/i.test(after);
  });
  return (rates.find(m => /^pay rate:/i.test(m[0])) || rates[0])?.[0].replace(/^pay rate:\s*/i, '') || '';
}
export function parsePay(pay, snippet = '') {
  const text = String(statedPay({ pay, snippet }));
  const hourly = /\b(?:hr|hrs|hour|hourly)\b/i.test(text);
  const annual = /\b(?:yr|year|yearly|annual|annually)\b/i.test(text);
  if (!hourly && !annual && /\b(?:day|daily|week|weekly|month|monthly)\b/i.test(text)) return null;
  const amounts = [...text.replace(/,/g, '').matchAll(/\$?\s*(\d+(?:\.\d+)?)(\s*k\b)?/gi)].map(m => Number(m[1]) * (m[2] ? 1000 : 1));
  if (!amounts.length) return null;
  const max = Math.max(...amounts);
  // Older Adzuna feed records stored annual salaries without a period.
  if (!hourly && !annual && max < 1000) return null;
  return hourly ? { hourlyMax: max, annualMax: max * 2080 } : { hourlyMax: max / 2080, annualMax: max };
}
export function isHighPay(pay) {
  const parsed = parsePay(pay);
  return Boolean(parsed && (parsed.hourlyMax >= 24 || parsed.annualMax >= 50000));
}
export function isLiveAboard(title) {
  return /\b(?:deck ?hands?|AB|OS|able seaman|ordinary seaman|wiper|oiler|mate|yacht crew|stew\w*|tug\w*|barge\w*|offshore|vessels?|ships?|shipyard|mariner|seaman|delivery crew|day ?workers?|crew member)\b/i.test(title || '') &&
    !/\b(?:dock ?hands?|fueler|boatcierge|instructor|technician|mechanic|sales|club|dealership|service writer|valet|front desk|call center|hilton|marriott|hyatt|hotel|resort|restaurant|kitchen|bar)\b/i.test(title || '');
}
export function lowWageShore(title) {
  return /\b(?:dock ?hands?|fueler|boatcierge|attendant|associate|cashier|valet|cleaner|porter|detailer|instructor|host|server|clerk|merchandiser|ambassador|sales development|business development rep(?:resentative)?|SDR|BDR|retail|club|jobs|careers|rental|marina)\b/i.test(title || '') || /\btechnician\b/i.test(title || '') && !/\b(?:senior|sr|lead|principal|staff|chief|head|manager)\b/i.test(title || '');
}

// Remote listings are often remote only inside another country ("Remote - Germany", "Nordics", "Thailand only").
// Georgia and Jersey are left out on purpose: they are also US places.
const FOREIGN_NAMES = 'Europe|European Union|EU|EMEA|APAC|Asia|Asia Pacific|LATAM|Latin America|South America|Central America|Africa|Middle East|DACH|Nordics?|Scandinavia|Benelux|CEE|Central Eastern Europe|Eastern Europe|Western Europe|UK|U\\.K\\.|United Kingdom|Great Britain|England|Scotland|Wales|Ireland|Germany|France|Spain|Portugal|Italy|Netherlands|Belgium|Switzerland|Austria|Poland|Czechia|Czech Republic|Slovakia|Hungary|Romania|Bulgaria|Greece|Croatia|Serbia|Bosnia|Slovenia|North Macedonia|Macedonia|Albania|Kosovo|Moldova|Ukraine|Belarus|Russia|Lithuania|Latvia|Estonia|Finland|Sweden|Norway|Denmark|Iceland|Turkey|Türkiye|Israel|UAE|United Arab Emirates|Saudi|Saudi Arabia|Qatar|Egypt|Nigeria|Kenya|South Africa|Ghana|Morocco|India|Pakistan|Bangladesh|Sri Lanka|Nepal|China|Hong Kong|Taiwan|Japan|Korea|South Korea|Philippines|Vietnam|Thailand|Malaysia|Singapore|Indonesia|Australia|New Zealand|Canada|Brazil|Argentina|Chile|Colombia|Peru|Uruguay|Costa Rica|Kazakhstan|Uzbekistan|Armenia|Azerbaijan|Cyprus|Malta|Luxembourg|London|Berlin|Munich|Paris|Madrid|Barcelona|Lisbon|Amsterdam|Dublin|Warsaw|Krakow|Prague|Vienna|Zurich|Stockholm|Copenhagen|Oslo|Helsinki|Tokyo|Nagoya|Osaka|Seoul|Beijing|Shanghai|Shenzhen|Bangalore|Bengaluru|Mumbai|Delhi|Hyderabad|Manila|Cebu|Jakarta|Bangkok|Riyadh|Dubai|Tel Aviv|Istanbul|Toronto|Vancouver|Montreal|Sydney|Melbourne|São Paulo|Sao Paulo|Buenos Aires|Bogota|Mexico City';
const FOREIGN = new RegExp(`(?<![\\w-])(?:${FOREIGN_NAMES}|(?<!New )Mexico|(?<!Panama City, )Panama)(?![\\w-])`, 'i');
const US_MARKER = /(?<![\w-])(?:USA?|U\.S\.A?\.?|United States(?: of America)?|America|Americas|North(?:ern)? America|Anywhere|Worldwide|Global|US timezones?|EST|EDT|Eastern Time|South Carolina)(?![\w-])/i;
const ABROAD_PHRASE = new RegExp(`\\bnon-?U\\.?S\\.?(?:[- ]based)?\\b|\\boutside (?:of )?(?:the )?(?:US|U\\.S\\.|United States)\\b|\\b(?:based|located|resid(?:e|ing|ent)|living) in (?:the )?(?:${FOREIGN_NAMES})\\b|\\blocation:\\s*(?:${FOREIGN_NAMES})\\b|\\b(?:${FOREIGN_NAMES})[- ](?:based|only)\\b|\\b(?:${FOREIGN_NAMES}) (?:national|citizens?)\\b`, 'i');
export function foreignPlace(value) { return FOREIGN.test(String(value || '')); }
export function remoteAbroad(job) {
  const title = String(job.title || ''), snippet = String(job.snippet || '');
  if (foreignPlace(title.replace(/^\(US\)\s*/i, ''))) return true;
  // "Remote — USA, Canada" style eligibility written by the remote-board sources.
  const eligibility = String(job.location || '').replace(/^\s*remote\b\s*[—–:,-]?\s*/i, '').replace(/\s*\(\+\d+ more\)$/, '');
  if (US_MARKER.test(eligibility)) return false;
  if (foreignPlace(eligibility)) return true;
  // We Work Remotely descriptions open with "Headquarters: Remote - Germany".
  const hq = snippet.match(/headquarters:\s*([^\n]{0,160}?)(?:\s+URL:|\s{2,}|$)/i)?.[1] || '';
  if (foreignPlace(hq) && !US_MARKER.test(hq)) return true;
  return ABROAD_PHRASE.test(snippet.slice(0, 1500));
}
