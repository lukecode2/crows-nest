// The Office & Gov Sales watch: its own job list (data/office-watch.json) and a readable report
// (docs/office-report.md), rebuilt every feed run from the catch log.
const lower = value => String(value || '').toLowerCase();
export const OFFICE_ABOUT = 'Office & Gov Sales watch: every office-track job and every job at a watched company this run, kept or not.';
const STATUS = { 'far-not-remote': 'Ask if remote (listed far away)', senior: 'Needs more experience', 'off-track': 'Not an office/sales role', 'needs-experience': 'Needs closing experience', 'pay-too-low': 'Pay too low', duplicate: 'Duplicate' };

export function officeWatch(catchLog, companies, nowIso) {
  const entries = Array.isArray(companies) ? companies : companies.companies || [];
  const watched = entries.filter(c => c.watch === 'office');
  const isWatched = job => watched.some(c => lower(job.company) === lower(c.name));
  const askRemote = job => watched.some(c => c.askRemote && lower(job.company) === lower(c.name));
  const jobs = catchLog.jobs.filter(j => j.track === 'office' || isWatched(j)).map(j => ({
    ...j, watchedCompany: isWatched(j), askRemote: !j.kept && j.dropReason === 'far-not-remote' && askRemote(j),
    status: j.kept ? 'On the site' : askRemote(j) && j.dropReason === 'far-not-remote' ? STATUS['far-not-remote'] : j.dropReason === 'far-not-remote' ? 'Far away, not remote' : STATUS[j.dropReason] || j.dropReason || 'Expired'
  }));
  return {
    generatedAt: nowIso, about: OFFICE_ABOUT,
    companies: watched.map(c => ({ name: c.name, ats: c.ats, jobsSeen: jobs.filter(j => lower(j.company) === lower(c.name)).length })),
    skipped: (companies._skipped || []).filter(c => c.watch === 'office').map(({ name, reason }) => ({ name, reason })),
    jobs
  };
}

const row = j => `| [${j.title.replace(/\|/g, '/')}](${j.url}) | ${j.company} | ${j.location || '—'} | ${j.pay || '—'} | ${j.status} |`;
export function officeMarkdown(watch) {
  // Carahsoft lists Reston on every job but hires remote, so its far-away jobs are worth asking about.
  const look = watch.jobs.filter(j => j.kept || j.askRemote);
  const counts = {};
  for (const j of watch.jobs) if (!look.includes(j)) counts[j.status] = (counts[j.status] || 0) + 1;
  return [
    '# Office & Gov Sales report', '',
    `Rebuilt automatically every feed run. Last run: ${watch.generatedAt.slice(0, 16).replace('T', ' ')} UTC.`, '',
    `## Worth a look (${look.length})`, '',
    'Jobs on the site, plus Carahsoft jobs (they list Reston, VA but also hire remote: ask).', '',
    '| Job | Company | Location | Pay | Status |', '|---|---|---|---|---|', ...look.map(row), '',
    '## Companies watched', '', '| Company | Job system | Jobs seen this run |', '|---|---|---|',
    ...watch.companies.map(c => `| ${c.name} | ${c.ats} | ${c.jobsSeen} |`), '',
    '## Checked but not watchable', '', ...watch.skipped.map(s => `- ${s.name}: ${s.reason}`), '',
    '## Filtered out this run', '', ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n}`), ''
  ].join('\n');
}
