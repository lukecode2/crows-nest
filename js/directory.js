export const DIRECTORY_REGIONS = [
  { id: 'grand-strand', label: 'Grand Strand', track: 'marine-local' },
  { id: 'charleston', label: 'Charleston', track: 'marine-chs' },
  { id: 'florida', label: 'Florida', track: 'marine-national' }
];
export const DIRECTORY_STATUSES = [
  { id: 'not-yet', label: 'Not yet' }, { id: 'called', label: 'Called' },
  { id: 'walked-in', label: 'Walked in' }, { id: 'applied', label: 'Applied' },
  { id: 'no-openings', label: 'No openings' }, { id: 'follow-up', label: 'Follow up' }
];
export const directoryStatus = entry => entry?.status || 'not-yet';
export function directoryProgress(employers, directory) {
  const top = employers.filter(e => e.tier === 'top');
  return { total: top.length, contacted: top.filter(e => directoryStatus(directory[e.id]) !== 'not-yet').length };
}
export function filterDirectory(employers, directory, { showAll = false, search = '', status = 'all' } = {}) {
  const query = search.trim().toLowerCase();
  return employers.filter(e => (showAll || e.tier === 'top') &&
    (status === 'all' || directoryStatus(directory[e.id]) === status) &&
    (!query || [e.name, e.town, e.type, e.hiringMethod, e.phone, e.email, e.tip].join(' ').toLowerCase().includes(query)));
}
