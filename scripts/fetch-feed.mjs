import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import * as http from './lib/http.mjs';
import { cleanText, makeId } from './lib/normalize.mjs';
import { classifyTrack } from './lib/classify.mjs';
import { statedPay } from './lib/region.mjs';
import { applyFilters, dropReason, roleKey } from './lib/filter.mjs';
import { scoreJob } from './lib/score.mjs';
import { mergeFeed } from './lib/merge.mjs';
import { checkLinks } from './lib/linkcheck.mjs';
import { rawJob, iso } from './lib/source-utils.mjs';
import { hotJobs, sendAlert } from './lib/alert.mjs';
import * as adzuna from './sources/adzuna.mjs';
import * as usajobs from './sources/usajobs.mjs';
import * as jsearch from './sources/jsearch.mjs';
import * as remotive from './sources/remotive.mjs';
import * as remoteok from './sources/remoteok.mjs';
import * as jobicy from './sources/jobicy.mjs';
import * as himalayas from './sources/himalayas.mjs';
import * as wwr from './sources/wwr.mjs';
import * as ats from './sources/ats.mjs';
import * as pagewatch from './sources/pagewatch.mjs';
import * as sweep from './sources/sweep.mjs';
import * as govjobs from './sources/govjobs.mjs';
export const sources = [adzuna, usajobs, jsearch, remotive, remoteok, jobicy, himalayas, wwr, ats, pagewatch, sweep, govjobs];

export async function runSources(list, ctx) {
  const results = await Promise.all(list.map(async source => {
    const controller = new AbortController();
    let timer;
    const api = ctx.http || http;
    const boundHttp = Object.fromEntries(['getJson', 'getText'].map(method => [method, (url, options = {}) => api[method](url, { ...options, signal: controller.signal })]));
    try {
      const jobs = await Promise.race([
        Promise.resolve().then(() => source.fetchJobs({ ...ctx, signal: controller.signal, http: boundHttp })),
        new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error(`Source timeout after ${ctx.perSourceTimeoutMs ?? source.timeoutMs ?? 60000}ms`); controller.abort(error); reject(error); }, ctx.perSourceTimeoutMs ?? source.timeoutMs ?? 60000); })
      ]);
      if (!Array.isArray(jobs)) throw new Error('Source did not return jobs');
      return { jobs, report: { name: source.name, ok: true, count: jobs.length, error: null } };
    } catch (error) {
      return { jobs: [], report: { name: source.name, ok: false, count: 0, error: error.message || String(error) } };
    } finally { clearTimeout(timer); }
  }));
  return { jobs: results.flatMap(r => r.jobs), report: results.map(r => r.report) };
}

function normalizeJob(raw, previous = false) {
  const job = rawJob(raw);
  const { trackHint, ...rest } = job;
  const normalized = { ...rest, title: cleanText(job.title, Infinity), company: cleanText(job.company, Infinity), location: cleanText(job.location, Infinity), url: String(job.url || ''), pay: cleanText(statedPay(job), Infinity), remote: Boolean(job.remote), postedAt: iso(job.postedAt), snippet: cleanText(job.snippet, Infinity) };
  return { ...normalized, id: previous && job.id ? job.id : makeId(normalized), track: classifyTrack({ ...normalized, trackHint: trackHint || (previous ? job.track : undefined) }) };
}
// Sources that return their whole current list every run: a stored job they no longer return was filled or pulled.
export const EXHAUSTIVE_SOURCES = ['usajobs', 'govjobs', 'sweep'];
function candidates(prev, incoming, nowIso, refreshed = new Set()) {
  const prior = new Map(prev.map(j => [j.id, j]));
  const fresh = incoming.map(j => normalizeJob(j));
  const freshIds = new Set(fresh.map(j => j.id));
  // A job fetched again this run replaces its stored copy, so corrected fields (e.g. pay) win.
  return [...prev.filter(j => !freshIds.has(j.id) && !refreshed.has(j.source)).map(j => normalizeJob(j, true)), ...fresh].map(j => ({ ...j, firstSeenAt: prior.get(j.id)?.firstSeenAt || j.firstSeenAt || nowIso, ...scoreJob(j) }));
}
export function buildFeed(prev, incoming, options) {
  const cutoff = Date.parse(options.nowIso) - 30 * 86400000;
  const filtered = applyFilters(candidates(prev, incoming, options.nowIso, options.refreshed).filter(j => Date.parse(j.firstSeenAt) >= cutoff), options);
  return mergeFeed([], filtered, options.nowIso).map(j => ({ ...j, snippet: cleanText(j.snippet) }));
}
// Runs at 11, 17 and 23 UTC; offset the six-hour slots to start at 11.
export const dailyRunSlot = now => Math.floor(((now.getUTCHours() + 13) % 24) / 6) % 3;
export async function checkFeedLinks(prev, incoming, options, linkOptions = {}) {
  const cutoff = Date.parse(options.nowIso) - 30 * 86400000;
  const eligible = candidates(prev, incoming, options.nowIso, options.refreshed).filter(j => Date.parse(j.firstSeenAt) >= cutoff && !dropReason(j, options));
  const result = await checkLinks(eligible, { ...linkOptions, nowIso: options.nowIso });
  const next = { ...options, deadIds: result.dead };
  const jobs = buildFeed(prev, incoming, next).map(j => result.checked.has(j.id) ? { ...j, linkCheckedAt: result.checkedAt } : j);
  return { ...result, jobs, options: next };
}
export const CATCH_ABOUT = 'Every job the robot saw this run, kept or not. Give this file plus docs/review-prompt.md to any AI to find good jobs the filters missed.';
export function buildCatchLog(prev, incoming, kept, options) {
  const keptIds = new Set(kept.map(j => j.id));
  const seenKept = new Set();
  const all = candidates(prev, incoming, options.nowIso, options.refreshed);
  const cities = [...new Set(all.flatMap(j => [j.location, ...(j.otherLocations || [])].map(l => String(l || '').replace(/\s*\(\+\d+ more\)$/, '').split(',')[0])))];
  const keptRoles = new Set(kept.map(j => roleKey(j, cities)));
  const jobs = all.sort((a, b) => (Date.parse(b.postedAt || b.firstSeenAt) || 0) - (Date.parse(a.postedAt || a.firstSeenAt) || 0)).map(job => {
    const reason = dropReason(job, options);
    const isKept = !reason && keptIds.has(job.id) && !seenKept.has(job.id);
    if (isKept) seenKept.add(job.id);
    const { id, title, company, location, pay, url, source, track } = job;
    // Expiry and the 600-job feed cap have no gate reason; retain null for review.
    const expired = Date.parse(job.firstSeenAt) < Date.parse(options.nowIso) - 30 * 86400000;
    return { id, title, company, location, pay, url, source, track: kept.find(j => j.id === id)?.track || track, kept: isKept, dropReason: reason || (!isKept && !expired && (keptIds.has(id) || keptRoles.has(roleKey(job, cities))) ? 'duplicate' : null), snippet: cleanText(job.snippet, 160) };
  }).slice(0, 2500);
  return { generatedAt: options.nowIso, about: CATCH_ABOUT, jobs };
}

export function printRunSummary({ jobs, catchLog, companies, govfeeds }, log = console.log) {
  for (const track of ['marine-local', 'marine-chs', 'marine-national', 'ai-web', 'tech-sales', 'quick-cash']) {
    const list = jobs.filter(j => j.track === track);
    log(`${track}: ${list.length}`);
    for (const job of list.slice(0, 8)) log(`  ${job.title} | ${job.company}`);
  }
  const counts = {};
  for (const job of catchLog.jobs) if (!job.kept) counts[job.dropReason || 'expiry-or-feed-cap'] = (counts[job.dropReason || 'expiry-or-feed-cap'] || 0) + 1;
  log('Drop reasons:');
  for (const [reason, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) log(`  ${reason}: ${count}`);
  const entries = Array.isArray(companies) ? companies : companies.companies || [];
  const added = entries.filter(c => c.researchRegion);
  log(`New companies verified: ${added.length}`);
  for (const c of added) log(`  ${c.name} [${c.researchRegion}; ${c.ats}] ${c.url || c.verification?.url}`);
  log(`Companies skipped: ${(companies._skipped || []).length}`);
  for (const c of companies._skipped || []) log(`  ${c.name}${c.region ? ` [${c.region}]` : ''}: ${c.reason}`);
  log(`Government feeds verified: ${(govfeeds.feeds || []).length}`);
  for (const feed of govfeeds.feeds || []) log(`  ${feed.name} [${feed.type}] ${feed.url || feed.verification?.url}`);
  log(`Government feeds skipped: ${(govfeeds._skipped || []).length}`);
  for (const feed of govfeeds._skipped || []) log(`  ${feed.name}: ${feed.reason}`);
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
  const [filters, searches, companies, prev, dismissed, tracker, state, govfeeds] = await Promise.all([
    load('config/filters.json', {}), load('config/searches.json', {}), load('config/companies.json', []),
    load('data/feed.json', { jobs: [] }), load('data/dismissed.json', { items: [] }), load('data/tracker.json', { jobs: [] }), load('data/pagewatch.json', {}), load('config/govfeeds.json', { feeds: [] })
  ]);
  const now = new Date();
  const { jobs: raw, report } = await runSources(sources, { env: process.env, searches, companies, govfeeds, http, log: message => console.warn(message), now, runSlot: dailyRunSlot(now), state });
  const refreshed = new Set(report.filter(r => r.ok && EXHAUSTIVE_SOURCES.includes(r.name)).map(r => r.name));
  let options = { filters, dismissed, trackedJobs: tracker.jobs || [], trackedIds: new Set((tracker.jobs || []).flatMap(j => [j.feedId, j.id]).filter(Boolean)), nowIso: now.toISOString(), refreshed };
  let jobs = buildFeed(prev.jobs || [], raw, options);
  if (!argv.includes('--no-linkcheck')) {
    // Filled and closed postings otherwise sit in the feed for 30 days.
    const result = await checkFeedLinks(prev.jobs || [], raw, options);
    jobs = result.jobs; options = result.options;
    console.log(`Link check: ${result.checked.size} pages opened, ${result.dead.size} filled or closed`);
  }
  const catchLog = buildCatchLog(prev.jobs || [], raw, jobs, options);
  for (const r of report) console.log(`${r.name}: ${r.ok ? `${r.count} jobs` : `FAILED (${r.error})`}`);
  console.log(`${argv.includes('--dry') ? 'Dry run' : 'Feed'}: ${jobs.length} jobs after filtering and merge (${raw.length} fetched)`);
  if (!argv.includes('--dry')) {
    await writeJson(resolve(root, 'data/feed.json'), { generatedAt: now.toISOString(), sources: report, jobs });
    await writeJson(resolve(root, 'data/pagewatch.json'), state);
    await writeJson(resolve(root, 'data/all-jobs.json'), catchLog);
    const hot = hotJobs(prev.jobs || [], jobs);
    try { if (await sendAlert(hot, { topic: process.env.NTFY_TOPIC })) console.log(`Phone alert: ${hot.length} new hot jobs`); }
    catch (error) { console.warn(`Phone alert failed: ${error.message}`); }
  }
  printRunSummary({ jobs, catchLog, companies, govfeeds });
  return { jobs, report, catchLog };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Feed failed: ${error.message}`); process.exitCode = 1; });
}
