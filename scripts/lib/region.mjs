// Locations arrive as city/state, city/county, or semicolon-separated ATS locations.
export const SC_CITIES = 'Myrtle Beach|North Myrtle Beach|Conway|Carolina Forest|Surfside|Surfside Beach|Garden City|Murrells Inlet|Pawleys Island|Georgetown|Little River|Loris|Aynor|Charleston|North Charleston|Mount Pleasant|Summerville|James Island|Johns Island|Daniel Island|Isle of Palms|Folly Beach|Kiawah|Kiawah Island|Goose Creek|Moncks Corner|Hanahan|Ladson'.split('|');
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
export function parsePay(pay) {
  const text = String(pay || '');
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
    !/\b(?:dock ?hands?|fueler|boatcierge|instructor|technician|mechanic|sales|club|dealership|service writer|valet|front desk|call center)\b/i.test(title || '');
}
export function lowWageShore(title) {
  return /\b(?:dock ?hands?|fueler|boatcierge|attendant|associate|cashier|valet|cleaner|porter|detailer|instructor|host|server|clerk|merchandiser|ambassador|sales development|business development rep(?:resentative)?|SDR|BDR|retail|club|jobs|careers|rental|marina)\b/i.test(title || '') || /\btechnician\b/i.test(title || '') && !/\b(?:senior|sr|lead|principal|staff|chief|head|manager)\b/i.test(title || '');
}
