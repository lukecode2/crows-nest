// City/state, city/county and semicolon-separated ATS locations are all used.
const HOME_SC = 'Myrtle Beach|North Myrtle Beach|Conway|Carolina Forest|Surfside|Surfside Beach|Garden City|Murrells Inlet|Pawleys Island|Georgetown|Little River|Loris|Aynor|Marion|Mullins|Longs|Bucksport|Socastee|Atlantic Beach'.split('|');
const BAND_SC = 'Charleston|North Charleston|McClellanville|Mount Pleasant|Summerville|James Island|Johns Island|Daniel Island|Isle of Palms|Folly Beach|Kiawah|Kiawah Island|Goose Creek|Moncks Corner|Hanahan|Ladson|Bonneau|St. Stephen|Ridgeville|St. George|Lincolnville|Harleyville|Reevesville|Walterboro|Edisto Beach|Adams Run|Saint Andrews|St. Andrews|Florence|Lake City|Johnsonville|Pamplico|Timmonsville|Kingstree|Hemingway'.split('|');
const HOME_NC = 'Shallotte|Calabash|Southport|Leland|Whiteville|Tabor City|Ocean Isle Beach|Sunset Beach|Holden Beach|Oak Island|Bald Head Island|Boiling Spring Lakes|Bolivia|Carolina Shores|Chadbourn|Fair Bluff|Lake Waccamaw'.split('|');
const BAND_NC = 'Wilmington|Wrightsville Beach|Carolina Beach|Kure Beach|Burgaw|Hampstead|Surf City|Topsail Beach|Rocky Point'.split('|');
export const SC_CITIES = [...HOME_SC, ...BAND_SC];
export const NC_CITIES = [...HOME_NC, ...BAND_NC];
const bound = names => new RegExp(`\\b(?:${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
const STATES = 'South Carolina|North Carolina|SC|NC|[A-Z]{2}|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming';
const stateAtEnd = new RegExp(`(?:,|\\s)\\s*(${STATES})(?:\\s+\\d{5})?\\s*$`, 'i');
function matchesRegion(location, scCities, ncCities, scCounties, ncCounties) {
  return String(location || '').replace(/\s*\(\+\d+ more\)$/, '').split(';').some(part => {
    // "Myrtle Beach, SC, US": a trailing country code is not the state.
    part = part.replace(/,\s*(?:US|USA|U\.S\.A?\.?|United States(?: of America)?)\s*$/i, '');
    const state = part.match(stateAtEnd)?.[1]?.toLowerCase();
    if (state && !['sc', 'nc', 'south carolina', 'north carolina'].includes(state)) return false;
    // Ambiguous counties without a state need a known city (Cambridge, Dorchester is Maryland).
    if (!state && /,/.test(part) && /\b(?:Marion|Florence|Berkeley|Dorchester|Brunswick) County\b/i.test(part) &&
      !bound([...SC_CITIES, ...NC_CITIES]).test(part.split(',')[0])) return false;
    // Explicit county takes priority over a same-named town in the other region.
    const county = part.match(/\b([A-Za-z]+(?: [A-Za-z]+)?) County\b/i)?.[1]?.toLowerCase();
    const matches = (cities, counties) => county ? counties.some(c => c.toLowerCase() === county) : bound(cities).test(part);
    return (!state || state === 'sc' || state === 'south carolina') && matches(scCities, scCounties) ||
      (!state || state === 'nc' || state === 'north carolina') && matches(ncCities, ncCounties);
  });
}
export function inHomeRegion(location) {
  // Foreign-only remote eligibility is rejected by remoteAbroad at the filter gate.
  return /^\s*remote\b/i.test(location || '') || matchesRegion(location, HOME_SC, HOME_NC, ['Horry', 'Georgetown', 'Marion'], ['Brunswick', 'Columbus']);
}
export function inCharlestonBand(location) {
  return matchesRegion(location, BAND_SC, BAND_NC, ['Charleston', 'Berkeley', 'Dorchester', 'Colleton', 'Florence', 'Williamsburg'], ['New Hanover', 'Pender']);
}
// Only affirmative lodging benefits qualify; relocation help or nearby hotels do not.
const NO_HOUSING = /\b(?:no|without)\s+(?:(?:staff|employee|crew|on[- ]site|free|provided)\s+)?(?:housing|accommodations?|lodging|room|quarters)\b|\b(?:housing|accommodations?|lodging|room|quarters)\s+(?:(?:is|are|will be)\s+)?(?:not|unavailable|excluded)\b|\b(?:find|arrange|provide) (?:your |their )?own (?:housing|accommodations?|lodging)\b/i;
export function hasHousing(job) {
  const text = `${job.title || ''}. ${job.description || job.snippet || ''}`;
  if (job.flags?.includes('housing') && !NO_HOUSING.test(text)) return true;
  return text.split(/[.;!\n]+/).some(sentence => {
    if (NO_HOUSING.test(sentence)) return false;
    if (/\b(?:reasonable accommodations?|disabilit\w*|nearby (?:housing|lodging)|relocation assistance)\b/i.test(sentence) && !/\b(?:staff housing|housing provided|room and board|crew quarters)\b/i.test(sentence)) return false;
    return /\b(?:(?:staff|employee|crew|provided|free|included|on[- ]site) housing|(?:housing|accommodations?|lodging) (?:is |are )?(?:provided|included|free)|room (?:and|&) board|live-in|live[- ]aboard|crew quarters|(?:onboard|on[- ]board) accommodations?)\b/i.test(sentence);
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
  return Boolean(parsed && (parsed.hourlyMax >= 20 || parsed.annualMax >= 41600));
}
export function isLiveAboard(title) {
  return /\b(?:deck ?hands?|deck crew|AB|OS|able seaman|ordinary seaman|wiper|oiler|mate|yacht crew|stew\w*|tug\w*|barge\w*|offshore|vessels?|ships?|mariner|seaman|delivery crew)\b/i.test(title || '') &&
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
