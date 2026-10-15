import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import * as http from './lib/http.mjs';
import { cleanText, makeId } from './lib/normalize.mjs';
import { classifyTrack } from './lib/classify.mjs';
import { applyFilters } from './lib/filter.mjs';
import { scoreJob } from './lib/score.mjs';
import { mergeFeed } from './lib/merge.mjs';
import { rawJob, iso } from './lib/source-utils.mjs';
import * as adzuna from './sources/adzuna.mjs';
import * as usajobs from './sources/usajobs.mjs';
import * as jsearch from './sources/jsearch.mjs';
import * as remotive from './sources/remotive.mjs';
import * as remoteok from './sources/remoteok.mjs';
import * as jobicy from './sources/jobicy.mjs';
import * as himalayas from './sources/himalayas.mjs';
import * as arbeitnow from './sources/arbeitnow.mjs';
import * as wwr from './sources/wwr.mjs';
import * as ats from './sources/ats.mjs';
import * as pagewatch from './sources/pagewatch.mjs';
export const sources = [adzuna, usajobs, jsearch, remotive, remoteok, jobicy, himalayas, arbeitnow, wwr, ats, pagewatch];

export async function runSources(list, ctx) {
  const results = await Promise.all(list.map(async source => {
    const controller = new AbortController();
    let timer;
    const api = ctx.http || http;
    const boundHttp = Object.fromEntries(['getJson', 'getText'].map(method => [method, (url, options = {}) => api[method](url, { ...options, signal: controller.signal })]));
    try {
      const jobs = await Promise.race([
        Promise.resolve().then(() => source.fetchJobs({ ...ctx, signal: controller.signal, http: boundHttp })),
        new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error(`Source timeout after ${ctx.perSourceTimeoutMs ?? 60000}ms`); controller.abort(error); reject(error); }, ctx.perSourceTimeoutMs ?? 60000); })
      ]);
      if (!Array.isArray(jobs)) throw new Error('Source did not return jobs');
      return { jobs, report: { name: source.name, ok: true, count: jobs.length, error: null } };
    } catch (error) {
      return { jobs: [], report: { name: source.name, ok: false, count: 0, error: error.message || String(error) } };
    } finally { clearTimeout(timer); }
  }));
  return { jobs: results.flatMap(r => r.jobs), report: results.map(r => r.report) };
}

export function buildFeed(prev, incoming, { filters, dismissed, trackedIds, nowIso }) {
  const options = { filters, dismissed, trackedIds };
  const normalized = incoming.map(raw => {
    const job = rawJob(raw);
    const { trackHint, ...rest } = job;
    return { ...rest, title: cleanText(job.title, Infinity), company: cleanText(job.company, Infinity), location: cleanText(job.location, Infinity), url: String(job.url || ''), pay: cleanText(job.pay, Infinity), remote: Boolean(job.remote), postedAt: iso(job.postedAt), snippet: cleanText(job.snippet, Infinity), id: makeId(job), track: classifyTrack(job) };
  });
  // Filter both old and new records so saving/dismissing a persisted job hides it on the next run.
  const scored = applyFilters(normalized, options).map(job => ({ ...job, ...scoreJob(job), snippet: cleanText(job.snippet) }));
  return applyFilters(mergeFeed(applyFilters(prev, options), scored, nowIso), options);
}

async function loadJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, path);
}
export async function main(argv = process.argv.slice(2)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const load = (path, fallback) => loadJson(resolve(root, path), fallback);
  const [filters, searches, companies, prev, dismissed, tracker, state] = await Promise.all([
    load('config/filters.json', {}), load('config/searches.json', {}), load('config/companies.json', []),
    load('data/feed.json', { jobs: [] }), load('data/dismissed.json', { items: [] }), load('data/tracker.json', { jobs: [] }), load('data/pagewatch.json', {})
  ]);
  const now = new Date();
  const { jobs: raw, report } = await runSources(sources, { env: process.env, searches, companies, http, log: message => console.warn(message), now, runSlot: Math.floor(now.getUTCHours() / 8), state });
  const jobs = buildFeed(prev.jobs || [], raw, { filters, dismissed, trackedIds: new Set((tracker.jobs || []).map(j => j.feedId).filter(Boolean)), nowIso: now.toISOString() });
  for (const r of report) console.log(`${r.name}: ${r.ok ? `${r.count} jobs` : `FAILED (${r.error})`}`);
  console.log(`${argv.includes('--dry') ? 'Dry run' : 'Feed'}: ${jobs.length} jobs after filtering and merge (${raw.length} fetched)`);
  if (!argv.includes('--dry')) {
    await writeJson(resolve(root, 'data/feed.json'), { generatedAt: now.toISOString(), sources: report, jobs });
    await writeJson(resolve(root, 'data/pagewatch.json'), state);
  }
  return { jobs, report };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Feed failed: ${error.message}`); process.exitCode = 1; });
}
