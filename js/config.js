export const REPO = { owner: 'lukecode2', repo: 'crows-nest', branch: 'master', workflow: 'feed.yml' };
export const TRACKS = [
  { id: 'marine-local', label: 'Home Waters', short: 'Home', color: '#7fd1c1' },
  { id: 'marine-chs', label: 'Charleston Harbor', short: 'Charleston', color: '#80bbed' },
  { id: 'marine-national', label: 'Blue Water', short: 'Blue Water', color: '#a7a5f2' },
  { id: 'ai-web', label: 'AI & Web', short: 'AI & Web', color: '#e7a8d6' },
  { id: 'tech-sales', label: 'Tech Sales', short: 'Sales', color: '#d4a94f' },
  { id: 'quick-cash', label: 'Quick Cash', short: 'Quick Cash', color: '#f0a180' }
];
export const STAGES = [
  { id: 'dockside', label: 'Dockside', hint: 'Lead' },
  { id: 'castoff', label: 'Cast Off', hint: 'Applied' },
  { id: 'hailed', label: 'Hailed', hint: 'Followed up' },
  { id: 'boarding', label: 'Boarding', hint: 'Interview' },
  { id: 'hired', label: 'Hired', hint: 'Accepted / hired' },
  { id: 'lost', label: 'Lost at Sea', hint: 'Rejected' }
];
export const BOAT_SHOW = { name: 'Fort Lauderdale International Boat Show', start: '2026-10-28', end: '2026-11-01' };
export const DISMISS_REASONS = [
  { id: 'not-interested', label: 'Not interested' }, { id: 'too-far', label: 'Too far' },
  { id: 'pay-too-low', label: 'Pay too low' }, { id: 'needs-experience', label: 'Needs more experience' },
  { id: 'cruise', label: 'Cruise ship' }, { id: 'company', label: 'Hide this company' }, { id: 'other', label: 'Other' }
];
export const DISMISSED_ABOUT = 'Jobs Luke dismissed. Fetcher never re-shows these; AIs read this to tune filters.';
