import { readFile } from 'node:fs/promises';

export const name = 'sweep';
export async function fetchJobs(ctx = {}) {
  try {
    const sweep = JSON.parse(await readFile(ctx.sweepPath || new URL('../../data/sweep.json', import.meta.url), 'utf8'));
    if (!Array.isArray(sweep?.items) || !(sweep.sweptAt === null || (typeof sweep.sweptAt === 'string' && Number.isFinite(Date.parse(sweep.sweptAt)))) ||
      !sweep.items.every(item => item && typeof item.title === 'string' && item.title.trim())) return [];
    return sweep.items.map(item => ({ ...item, source: name }));
  } catch (_) { return []; }
}
