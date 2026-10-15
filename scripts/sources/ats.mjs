import { client, collect, companyEntries, rawJob, iso, pay, entryMatches } from '../lib/source-utils.mjs';
export const name = 'ats';
export async function fetchJobs(ctx) {
  return collect(companyEntries(ctx).filter(e => e.ats !== 'page'), async entry => {
    const api = client(ctx), slug = encodeURIComponent(entry.slug || '');
    let jobs;
    switch (entry.ats) {
      case 'greenhouse': {
        const data = await api.getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
        jobs = (data.jobs || []).map(j => ({ title: j.title, location: j.location?.name || '', url: j.absolute_url, snippet: j.content || '', postedAt: iso(j.updated_at) }));
        break;
      }
      case 'lever': {
        const data = await api.getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
        jobs = data.map(j => ({ title: j.text, location: j.categories?.location || '', url: j.hostedUrl, snippet: [j.descriptionPlain || j.description, ...(j.lists || []).map(l => l.content)].filter(Boolean).join(' '), postedAt: iso(j.createdAt), pay: j.salaryRange ? pay(j.salaryRange.min, j.salaryRange.max, j.salaryRange.interval) : '' }));
        break;
      }
      case 'ashby': {
        const data = await api.getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
        jobs = (data.jobs || []).map(j => ({ title: j.title, location: j.location || '', remote: Boolean(j.isRemote), url: j.jobUrl || j.applyUrl, snippet: j.descriptionPlain || j.descriptionHtml || '', postedAt: iso(j.publishedAt) }));
        break;
      }
      case 'smartrecruiters': {
        const data = await api.getJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
        jobs = (data.content || []).map(j => ({ title: j.name, location: [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(', '), remote: Boolean(j.location?.remote), url: j.applyUrl || `https://jobs.smartrecruiters.com/${slug}/${j.id}`, postedAt: iso(j.releasedDate), snippet: j.jobAd?.sections?.jobDescription?.text || '' }));
        break;
      }
      case 'workday': {
        const base = `https://${entry.host}/wday/cxs/${encodeURIComponent(entry.tenant)}/${encodeURIComponent(entry.site)}`;
        const postings = [];
        for (let page = 0; page < (entry.maxPages || 1); page++) {
          const data = await api.getJson(`${base}/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: page * 20, searchText: entry.searchText || '' }) });
          const batch = data.jobPostings || [];
          postings.push(...batch);
          if (batch.length < 20 || postings.length >= data.total) break;
        }
        jobs = postings.map(j => ({ title: j.title, location: j.locationsText || '', url: `https://${entry.host}/en-US/${entry.site}${j.externalPath}`, snippet: [j.timeType, ...(j.bulletFields || [])].filter(Boolean).join(' '), postedAt: null, _path: j.externalPath }));
        // Search results omit descriptions and sometimes locations. Details carry eligibility and pay.
        jobs = jobs.filter(j => entryMatches(j, { ...entry, states: undefined }) && (!ctx.acceptJob || ctx.acceptJob(j)));
        jobs = await collect(jobs, async job => {
          let detail;
          try { detail = (await api.getJson(`${base}${job._path}`)).jobPostingInfo; }
          catch (error) { ctx.log?.(`${entry.name} details: ${error.message}`); }
          const { _path, ...mapped } = job;
          return [{ ...mapped, location: [detail?.location || mapped.location, ...(detail?.additionalLocations || [])].filter(Boolean).join('; '), snippet: [detail?.timeType, detail?.jobDescription || mapped.snippet].filter(Boolean).join(' '), postedAt: iso(detail?.startDate), pay: detail?.payRange || '' }];
        }, ctx, 3);
        break;
      }
      default: throw new Error(`Unsupported ATS: ${entry.ats}`);
    }
    return jobs.filter(j => entryMatches(j, entry) && (!ctx.acceptJob || ctx.acceptJob(j))).map(j => rawJob({ ...j, company: entry.name, source: name, trackHint: entry.track || undefined }));
  }, ctx, 3);
}
