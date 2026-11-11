import { publicClient, collect, companyEntries, rawJob, iso, pay, entryMatches } from '../lib/source-utils.mjs';
import { cleanText } from '../lib/normalize.mjs';

export const name = 'direct';
export const timeoutMs = 240000;
export const types = ['bamboohr', 'icims', 'jibe', 'oracle', 'jobsyn', 'phenom', 'smartrecruiters-html', 'advantage', 'alignerr', 'mercor', 'tallships'];
const text = value => cleanText(value, Infinity);
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const location = address => [address?.addressLocality, address?.addressRegion, typeof address?.addressCountry === 'object' ? address.addressCountry.name : address?.addressCountry].filter(Boolean).join(', ');
const expired = (date, ctx) => date && Number.isFinite(Date.parse(date)) && Date.parse(date) < (ctx.now || new Date()).getTime();
function absolute(value, base) {
  const url = new URL(text(value), base);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid job URL');
  url.hash = ''; return url.href;
}
function salary(value) {
  if (!value || typeof value === 'string') return value || '';
  const amount = value.value || value;
  return pay(amount.minValue ?? amount.value, amount.maxValue, amount.unitText?.toLowerCase());
}
// Parse data only: never execute scripts, embedded application state, or job text.
export function jobPostings(html) {
  const jobs = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if (list(value['@type']).includes('JobPosting')) jobs.push(value);
    if (value['@graph']) visit(value['@graph']);
  }
  for (const [, json] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(json)); } catch { /* Other page metadata is not a posting. */ }
  }
  return jobs;
}
function structured(job, url, ctx) {
  if (expired(job.validThrough, ctx)) return null;
  const remote = /TELECOMMUTE/i.test(job.jobLocationType || '');
  const eligibility = list(job.applicantLocationRequirements).map(a => a.name).filter(Boolean);
  return { title: job.title, location: list(job.jobLocation).map(l => location(l.address)).filter(Boolean).join('; ') || (eligibility.length ? `Remote — ${eligibility.join(', ')}` : ''), remote,
    url, snippet: [job.employmentType, job.description, eligibility.join(', ')].filter(Boolean).join(' '), pay: salary(job.baseSalary), postedAt: iso(job.datePosted) };
}
function wanted(job, entry, ctx) { return entryMatches(job, entry) && (!ctx.acceptJob || ctx.acceptJob(job)); }
async function details(jobs, entry, ctx, api, read) {
  return collect(jobs.filter(j => wanted(j, entry, ctx)), async job => {
    const full = await read(job);
    return full && wanted(full, entry, ctx) ? [full] : [];
  }, ctx, 3);
}
async function bamboohr(entry, ctx, api) {
  const base = `https://${entry.slug}.bamboohr.com`;
  const data = await api.getJson(`${base}/careers/list`);
  if (!Array.isArray(data.result)) throw new Error('Invalid BambooHR listings');
  const rows = data.result.map(j => ({ title: j.jobOpeningName, location: [j.location?.city, j.location?.state].filter(Boolean).join(', '), id: j.id }));
  return details(rows, entry, ctx, api, async row => {
    const j = (await api.getJson(`${base}/careers/${encodeURIComponent(row.id)}/detail`)).result?.jobOpening;
    if (!j || j.jobOpeningStatus !== 'Open') return null;
    return { title: j.jobOpeningName, location: [j.location?.city, j.location?.state, j.location?.addressCountry].filter(Boolean).join(', '), remote: j.locationType === '2',
      url: absolute(j.jobOpeningShareUrl || `/careers/${row.id}`, base), snippet: [j.employmentStatusLabel, j.minimumExperience, j.description].filter(Boolean).join(' '), pay: j.compensation || '', postedAt: iso(j.datePosted) };
  });
}
async function jibe(entry, ctx, api) {
  const jobs = [];
  for (let page = 1; page <= (entry.maxPages || 5); page++) {
    const url = new URL('/api/jobs', entry.url);
    url.search = new URLSearchParams({ page: String(page), limit: '100', ...(entry.query || {}) });
    const data = await api.getJson(url.href);
    if (!Array.isArray(data.jobs)) throw new Error('Invalid iCIMS/Jibe listings');
    const batch = data.jobs.map(j => j.data);
    // Jibe's `external` is false even for live public openings. The ATS visibility
    // and apply/search flags, rather than that routing flag, describe publication.
    jobs.push(...batch.filter(j => j && j.meta_data?.icims?.jps_is_public !== false && j.searchable !== false && j.applyable !== false).map(j => ({ title: j.title,
      location: [j.city, j.state, j.country].filter(Boolean).join(', '), remote: j.location_type === 'REMOTE',
      url: absolute(j.meta_data?.canonical_url || `/jobs/${encodeURIComponent(j.slug)}`, entry.url),
      snippet: [j.description, j.qualifications, j.responsibilities, ...(j.tags3 || [])].filter(Boolean).join(' '),
      pay: (j.tags4 || []).join(' ') || (j.salary_min_value || j.salary_max_value ? pay(j.salary_min_value || null, j.salary_max_value || null) : ''), postedAt: iso(j.posted_date || j.create_date) })));
    if (!batch.length || jobs.length >= data.totalCount) break;
  }
  return jobs;
}
async function icims(entry, ctx, api) {
  const jobs = new Map();
  for (let page = 0; page < (entry.maxPages || 5); page++) {
    const url = new URL(entry.url);
    url.searchParams.set('in_iframe', '1'); url.searchParams.set('pr', String(page));
    const html = await api.getText(url.href);
    if (!/iCIMS_(?:Job|Message|Jobs|SubHeader)/.test(html)) throw new Error('Invalid iCIMS listings');
    const cards = [...html.matchAll(/<li\b[^>]*class=["'][^"']*iCIMS_JobCardItem[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)];
    for (const [, card] of cards) {
      const link = card.match(/<a\b[^>]*href=["']([^"']*\/jobs\/\d+\/[^"']+)["'][^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
      if (!link) continue;
      const url = new URL(absolute(link[1], entry.url)); url.search = '';
      const fields = [...card.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)].map(([, k, v]) => [text(k), text(v)]);
      const place = fields.find(([k]) => k === 'Location' || k === 'Job Locations')?.[1] || '';
      jobs.set(url.href, { title: text(link[2]), location: place.replace(/^US-([A-Z]{2})-(.+)$/, '$2, $1'), url: url.href });
    }
    // pr is zero-based. Only continue when the page actually advertises a next page.
    if (!new RegExp(`(?:[?&]|&amp;)pr=${page + 1}(?:[&"']|&amp;)`).test(html)) break;
  }
  return details([...jobs.values()], entry, ctx, api, async row => {
    const html = await api.getText(`${row.url}?in_iframe=1`);
    const posting = jobPostings(html)[0];
    if (!posting) throw new Error(`No JobPosting details: ${row.url}`);
    const job = structured(posting, row.url, ctx);
    if (job && !job.pay) {
      const description = text(posting.description);
      const minimum = description.match(/Minimum Pay\s*(?:USD\s*)?\$([\d.,]+)\s*\/Hr/i)?.[1];
      const maximum = description.match(/Maximum Pay\s*(?:USD\s*)?\$([\d.,]+)\s*\/Hr/i)?.[1];
      if (minimum || maximum) job.pay = pay(minimum?.replaceAll(',', ''), maximum?.replaceAll(',', ''), 'hour');
    }
    return job;
  });
}
async function oracle(entry, ctx, api) {
  const base = `https://${entry.host}/hcmRestApi/resources/latest`;
  const rows = [];
  for (let page = 0; page < (entry.maxPages || 5); page++) {
    const url = `${base}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=${encodeURIComponent(entry.site)},limit=100,offset=${page * 100}`;
    const data = (await api.getJson(url)).items?.[0];
    if (!Array.isArray(data?.requisitionList)) throw new Error('Invalid Oracle recruiting listings');
    rows.push(...data.requisitionList.filter(j => !expired(j.PostingEndDate, ctx)).map(j => ({ title: j.Title, location: j.PrimaryLocation, id: j.Id })));
    if (data.requisitionList.length < 100) break;
  }
  return details(rows, entry, ctx, api, async row => {
    const j = (await api.getJson(`${base}/recruitingCEJobRequisitionDetails?onlyData=true&finder=ById;Id=${encodeURIComponent(row.id)}`)).items?.[0];
    if (!j || expired(j.ExternalPostedEndDate, ctx)) return null;
    return { title: j.Title, location: j.PrimaryLocation, remote: /remote/i.test(j.WorkplaceType || ''),
      url: `https://${entry.host}/hcmUI/CandidateExperience/en/sites/${encodeURIComponent(entry.site)}/job/${encodeURIComponent(j.Id)}`,
      snippet: [j.JobSchedule, j.ExternalDescriptionStr, j.ExternalQualificationsStr, j.ExternalResponsibilitiesStr].filter(Boolean).join(' '), postedAt: iso(j.ExternalPostedStartDate) };
  });
}
async function jobsyn(entry, ctx, api) {
  const jobs = new Map();
  for (const city of entry.cities) {
    for (let page = 1; page <= (entry.maxPages || 5); page++) {
      const url = new URL('https://prod-search-api.jobsyn.org/api/v1/google-talent/search');
      url.search = new URLSearchParams({ location: city, 'job-folder': entry.slug, page: String(page) });
      const data = await api.getJson(url.href, { headers: { 'X-Origin': new URL(entry.url).hostname } });
      if (!Array.isArray(data.jobs)) throw new Error('Invalid Jobsyn employer feed');
      for (const item of [...(data.featured_jobs || []), ...data.jobs]) {
        const j = item.job;
        if (!j || expired(j.postingExpireTime, ctx)) continue;
        const attribute = key => j.customAttributes?.[key]?.stringValues?.[0] || '';
        const place = attribute('city_display_slug') || attribute('country_short_slug');
        if (!place || !attribute('title_slug') || !j.requisitionId) continue;
        const url = absolute(`/${place}/${attribute('title_slug')}/${encodeURIComponent(j.requisitionId)}/job/`, entry.url);
        jobs.set(url, { title: j.title, company: entry.name, location: (j.addresses || []).join('; '), url,
          snippet: j.description || '', postedAt: iso(j.postingPublishTime || j.postingCreateTime) });
      }
      if (!data.pagination?.has_more_pages) break;
    }
  }
  return [...jobs.values()];
}
// Phenom career sites (careers.<company>.com/us/en) server-render search results as a JSON data
// object; each job page carries a schema.org JobPosting with the full description.
async function phenom(entry, ctx, api) {
  const rows = new Map();
  for (const query of entry.queries || ['']) {
    const url = new URL('search-results', entry.url);
    url.search = new URLSearchParams({ keywords: query });
    const data = (await api.getText(url.href)).match(/phApp\.ddo\s*=\s*(\{[\s\S]*?\});\s*phApp/)?.[1];
    const jobs = data && JSON.parse(data).eagerLoadRefineSearch?.data?.jobs;
    if (!Array.isArray(jobs)) throw new Error('Invalid Phenom search page');
    for (const j of jobs) {
      if (!j.jobSeqNo) continue;
      rows.set(j.jobSeqNo, { title: j.title, location: j.location || [j.city, j.state].filter(Boolean).join(', '),
        url: absolute(`job/${encodeURIComponent(j.jobSeqNo)}`, entry.url), snippet: [j.type, j.descriptionTeaser].filter(Boolean).join(' '), postedAt: iso(j.postedDate) });
    }
  }
  return details([...rows.values()], entry, ctx, api, async row => {
    const posting = jobPostings(await api.getText(row.url))[0];
    return posting ? structured(posting, row.url, ctx) : row;
  });
}
async function smartrecruitersHtml(entry, ctx, api) {
  const html = await api.getText(entry.url), rows = [];
  if (!/opening-jobs|noOpeningsFound/.test(html)) throw new Error('Invalid SmartRecruiters public career page');
  for (const [, href, block] of html.matchAll(/<a\b[^>]*href="(https:\/\/jobs\.smartrecruiters\.com\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = block.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1];
    if (!title) continue;
    const place = block.match(/<li\b[^>]*class="job-desc"[^>]*>([\s\S]*?)<\/li>/i)?.[1];
    rows.push({ title: text(title), location: text(place), url: absolute(href, entry.url) });
  }
  // This is the employer's server-rendered public board. The separate
  // api.smartrecruiters.com host disallows this bot and is never requested.
  return details(rows, entry, ctx, api, async row => {
    const detail = await api.getText(row.url);
    const posting = jobPostings(detail)[0];
    if (posting) return structured(posting, row.url, ctx);
    const main = detail.match(/<main\b[^>]*itemtype="https?:\/\/schema.org\/JobPosting"[^>]*>([\s\S]*?)<\/main>/i)?.[1];
    if (!main) throw new Error(`No public JobPosting microdata: ${row.url}`);
    const meta = key => detail.match(new RegExp(`<meta\\b[^>]*itemprop="${key}"[^>]*content="([^"]*)"`, 'i'))?.[1];
    if (expired(meta('validThrough'), ctx)) return null;
    return { ...row, snippet: text(main), postedAt: iso(meta('datePosted')) };
  });
}
async function advantage(entry, ctx, api) {
  const rows = new Map();
  for (const city of entry.cities) {
    const url = `https://careers.youradv.com/?location=${encodeURIComponent(city)}`;
    const html = await api.getText(url);
    if (!/Results Returned/i.test(html)) throw new Error('Invalid Advantage search');
    for (const [, block] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const link = block.match(/<a\b[^>]*class="job-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!link) continue;
      const cells = [...block.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, v]) => text(v));
      const job = { title: text(link[2]), location: (cells[1] || '').replace(/^US-([A-Z]{2})-(.+)$/, '$2, $1'), url: absolute(link[1], url) };
      rows.set(job.url, job);
    }
  }
  return details([...rows.values()], entry, ctx, api, async row => {
    const posting = jobPostings(await api.getText(row.url))[0];
    if (!posting) throw new Error(`No Advantage JobPosting: ${row.url}`);
    return structured(posting, row.url, ctx);
  });
}
async function alignerr(entry, ctx, api) {
  const rows = new Map();
  for (const search of entry.searches) {
    for (let page = 0; page < (entry.maxPages || 3); page++) {
      const url = new URL('/api/jobs', entry.url);
      url.search = new URLSearchParams({ search, limit: '60', offset: String(page * 60) });
      const data = await api.getJson(url.href);
      if (!Array.isArray(data.jobs)) throw new Error('Invalid Alignerr listings');
      for (const j of data.jobs) rows.set(j.id, { title: j.title, location: j.location, url: absolute(j.applyUrl, entry.url) });
      if (!data.jobs.length || (page + 1) * 60 >= data.total) break;
    }
  }
  return details([...rows.values()], entry, ctx, api, async row => {
    const html = await api.getText(row.url);
    const payload = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
    const j = payload && JSON.parse(payload).props?.pageProps?.job;
    if (!j) throw new Error(`No Alignerr job details: ${row.url}`);
    // Search cards say only "Remote", including foreign and city-restricted jobs.
    if (!j.isActive || !/^(?:US|USA|United States)$/i.test(j.location || j.countryCode || '') || j.city) return null;
    const heading = j.longDescription?.match(/^#\s+(.+)$/m)?.[1];
    return { title: heading?.startsWith(j.name) ? heading : j.name, location: `Remote — ${j.location || 'United States'}`, remote: true, url: row.url,
      snippet: j.htmlLongDescription || j.longDescription || '', pay: pay(j.lowerBoundHourlyRate, j.upperBoundHourlyRate, 'hour'), postedAt: iso(j.firstPostDate || j.createdAt) };
  });
}
async function tallships(entry, ctx, api) {
  const html = await api.getText(entry.url), rows = [];
  if (!/tsa-table/.test(html)) throw new Error('Invalid Tall Ships vacancy table');
  for (const [, block] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const link = block.match(/<a\b[^>]*href="(\?job_id=\d+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const cells = [...block.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, v]) => text(v));
    const deadline = cells[4];
    if (deadline && expired(`${deadline}T23:59:59Z`, ctx)) continue;
    // Do not turn galley work, licensed officers or volunteer berths into entry crew leads.
    if (/Cook|Executive|Engineer/i.test(cells[1])) continue;
    rows.push({ title: text(link[2]), company: text(block.match(/<span\b[^>]*class="spanaft"[^>]*>([\s\S]*?)<\/span>/i)?.[1]), location: '', url: absolute(link[1], entry.url), postedAt: iso(cells[5]) });
  }
  return details(rows, entry, ctx, api, async row => {
    const detail = await api.getText(row.url);
    const start = detail.indexOf('Posted By:');
    const end = detail.indexOf('Apply Now', start);
    if (start < 0 || end < start) throw new Error(`Invalid Tall Ships detail: ${row.url}`);
    const snippet = text(detail.slice(start, end));
    const endDate = snippet.match(/End Date:\s*(.*?)(?:Application Deadline:|Job Description:)/i)?.[1];
    if (expired(endDate, ctx)) return null;
    const home = snippet.match(/Homeport\(s\):\s*(.*?)\s*Start Date:/i)?.[1] || snippet.match(/Location:\s*(.*?)\s*(?:View on Google Maps|Start Date:)/i)?.[1] || '';
    const compensation = snippet.match(/Compensation:\s*(.*?)\s*(?:Benefits:|Required Certifications|Where Sails:|Apply Have)/i)?.[1] || '';
    return { ...row, location: home, snippet, pay: compensation };
  });
}
async function mercor(entry, ctx, api) {
  let rows;
  // Occasionally the server returns the page without its public query data.
  // Retry that incomplete response once; explicit access challenges fail closed.
  for (let attempt = 0; attempt < 2; attempt++) {
    const html = await api.getText(entry.url);
    if (/cf-chl-|Just a moment\.\.\.|Request Rejected|Service Unavailable/i.test(html)) throw new Error('Mercor public page unavailable');
    const payload = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
    const props = payload && JSON.parse(payload).props?.pageProps;
    const query = props?.dehydratedState?.queries?.find(q => q.queryKey?.includes('public-explore-page'));
    rows = query?.state?.data?.listings;
    if (Array.isArray(rows)) break;
  }
  if (!Array.isArray(rows)) throw new Error('Invalid Mercor public listings');
  const us = value => /^(?:US|USA|United States(?: of America)?)$/i.test(value);
  return rows.filter(j => {
    if (j.status !== 'active' || j.disableApplications || j.isPrivate || j.deletedAt || j.listingType === 'evergreen' || j.remainingSlots != null && j.remainingSlots <= 0 || j.workArrangement !== 'remote') return false;
    const allowed = [j.eligibleLocation || [], j.eligibleResidenceLocation || []];
    const denied = [...(j.ineligibleLocation || []), ...(j.ineligibleResidenceLocation || [])];
    return allowed.every(group => !group.length || group.some(us)) && !denied.some(us);
  }).map(j => ({ title: j.title, location: `Remote — ${[...(j.eligibleLocation || []), ...(j.eligibleResidenceLocation || [])].join(', ') || j.location || 'Worldwide'}`, remote: true,
    url: absolute(`/jobs/${encodeURIComponent(j.listingId)}/${j.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, entry.url),
    company: j.companyBrandVisible && j.companyName ? `${j.companyName} (via Mercor)` : entry.name,
    snippet: [j.commitment, j.description].filter(Boolean).join(' '), pay: pay(j.rateMin, j.rateMax, j.payRateFrequency === 'hourly' ? 'hour' : j.payRateFrequency), postedAt: iso(j.postedAt || j.createdAt) }));
}
const adapters = { bamboohr, jibe, icims, oracle, jobsyn, phenom, 'smartrecruiters-html': smartrecruitersHtml, advantage, alignerr, mercor, tallships };
export async function fetchJobs(ctx) {
  const api = publicClient(ctx);
  return collect(companyEntries(ctx).filter(e => types.includes(e.ats)), async entry => {
    const jobs = await adapters[entry.ats](entry, ctx, api);
    const matched = jobs.filter(j => wanted(j, entry, ctx));
    ctx.log?.(`${entry.name}: ${matched.length} direct listings`);
    return matched.map(j => rawJob({ ...j, company: j.company || entry.name, source: name, trackHint: entry.track || undefined }));
  }, ctx, 3);
}
