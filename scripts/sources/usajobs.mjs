import { client, collect, rawJob, iso, pay } from '../lib/source-utils.mjs';
export const name = 'usajobs';
export async function fetchJobs(ctx) {
  if (!ctx.env.USAJOBS_API_KEY || !ctx.env.USAJOBS_EMAIL) throw new Error('missing key');
  return collect(['deckhand', 'ordinary seaman', 'general vessel assistant', 'wage mariner', 'boat operator'], async keyword => {
    const params = new URLSearchParams({ Keyword: keyword, ResultsPerPage: '50' });
    const data = await client(ctx).getJson(`https://data.usajobs.gov/api/search?${params}`, { headers: { Host: 'data.usajobs.gov', 'User-Agent': ctx.env.USAJOBS_EMAIL, 'Authorization-Key': ctx.env.USAJOBS_API_KEY } });
    return (data.SearchResult?.SearchResultItems || []).map(item => {
      const j = item.MatchedObjectDescriptor, salary = j.PositionRemuneration?.[0];
      return rawJob({ title: j.PositionTitle, company: j.OrganizationName || j.DepartmentName || '', location: j.PositionLocationDisplay || '', url: j.PositionURI || j.ApplyURI?.[0], postedAt: iso(j.PublicationStartDate), snippet: [j.UserArea?.Details?.JobSummary, j.QualificationSummary, j.UserArea?.Details?.Requirements].filter(Boolean).join(' '), pay: salary ? pay(salary.MinimumRange, salary.MaximumRange, salary.Description || salary.RateIntervalCode) : '', closesAt: iso(j.ApplicationCloseDate), source: name, trackHint: 'marine-national' });
    });
  }, ctx);
}
