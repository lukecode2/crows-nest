# Crow's Nest Implementation Plan

> **For agentic workers:** Executed by Codex CLI (`codex exec`) under Claude's lead. Tasks 1–2 = Codex job A
> (fetcher). Tasks 3–4 = Codex job B (web app). Jobs A and B run in parallel and touch disjoint files.
> Task 5 = Claude (integration + deploy). Steps use checkbox (`- [ ]`) syntax. **Do NOT run `git commit`** —
> Claude commits after review.

**Goal:** A public GitHub Pages job-hunt dashboard for Luke with a cloud-refreshed live job feed and a synced application tracker.

**Architecture:** Static site (HTML + CSS + ES modules, no build). A GitHub Action runs a zero-dependency Node
fetcher 3×/day that writes `data/feed.json`. The browser app reads the feed from Pages and reads/writes
`data/tracker.json` + `data/dismissed.json` through the GitHub Contents API with a user-supplied token.

**Tech Stack:** Node 20+ (built-in `fetch`, `node:test`, `node:crypto`), vanilla JS (ES2020), CSS, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-15-crows-nest-design.md` — read it first; data contracts in §3 are binding.

## Global Constraints

- Zero npm dependencies. `package.json` already exists with `"type": "module"` and `npm test` = `node --test`.
- Test files are named `*.test.mjs` under `tests/fetcher/` (job A) or `tests/app/` (job B).
- Browser code: ES2020 only; no CSS nesting, container queries, `:has()`, View Transitions, `toSorted`/`toSpliced`/`findLast`, `structuredClone`. Must work in Safari 15.6.
- Never put third-party (feed) text into `innerHTML`; build DOM with `textContent`. Only `http:`/`https:` URLs become `href`.
- Repo constants: owner `lukecode2`, repo `crows-nest`, branch `master`, workflow file `feed.yml`.
- Track ids exactly: `marine-local`, `marine-chs`, `marine-national`, `ai-web`, `tech-sales`, `quick-cash`.
- Stage ids exactly: `dockside`, `castoff`, `hailed`, `boarding`, `hired`, `lost`.
- No cruise-ship / cruise-line jobs ever reach the feed. "Military Sealift Command" is NOT a cruise line.
- Dates the user enters are local `YYYY-MM-DD` strings; weeks run Monday–Sunday in local time.
- Secrets (env): `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `USAJOBS_API_KEY`, `USAJOBS_EMAIL`, `RAPIDAPI_KEY`. Missing key ⇒ skip source, report `ok:false,error:"missing key"`.

## Review Focus

1. Notes/titles containing emoji or accents must survive the GitHub Contents API base64 round trip (UTF-8, not `btoa` on raw strings) — test in Task 3.
2. Missing/expired token (401/403) or offline ⇒ app keeps working from localStorage, shows a "local only" banner, never wipes data — test in Task 3 (merge) and handled in Task 4.
3. A feed title like `<img src=x onerror=alert(1)>` renders as literal text — test in Task 3 (`safeUrl`) + DOM rule in Task 4.
4. One source timing out / returning HTML instead of JSON must not stop the run; feed is still written with that source marked failed — test in Task 2.
5. Week boundaries: an application dated Sunday counts for that week, Monday starts a new week; streak counts consecutive weeks ≥ goal — test in Task 3.

---

## Job A — Fetcher

### Task 1: Fetcher pure library

**Files:**
- Create: `scripts/lib/normalize.mjs`, `scripts/lib/classify.mjs`, `scripts/lib/filter.mjs`, `scripts/lib/score.mjs`, `scripts/lib/merge.mjs`
- Create: `config/filters.json`
- Test: `tests/fetcher/lib.test.mjs`

**Interfaces (Produces):**
- `normalizeUrl(url: string): string` — lowercase host, strip `utm_*`, `ref`, `src`, trailing slash, hash.
- `makeId(job: RawJob): string` — sha1 hex of `normalizeUrl(job.url)` if url, else `company|title|location` lowercased.
- `cleanText(htmlOrText: string, max = 240): string` — strip tags, decode `&amp; &lt; &gt; &quot; &#39; &nbsp;`, collapse whitespace, truncate with `…`.
- `classifyTrack(job: RawJob): TrackId` — if `job.trackHint` set, return it; else location/keyword rules (see below).
- `isCruise(job, filters): boolean`, `isSenior(job, filters): boolean`
- `applyFilters(jobs: Job[], { filters, dismissed, trackedIds }): Job[]`
- `scoreJob(job: Job): { score: number, flags: string[] }`
- `mergeFeed(prev: Job[], incoming: Job[], nowIso: string): Job[]`
- `RawJob = { title, company, location, remote, pay, url, postedAt, snippet, source, trackHint? }`; `Job` = RawJob + `id, track, firstSeenAt, score, flags` (shape in spec §3; drop `trackHint` on output).

**Rules:**
- All keyword lists match on word boundaries (`\b`), so `mate` never matches `automate`/`estimate`.
- classify fallback: text = title+snippet+location lowercased. Location matches `myrtle|north myrtle|murrells|georgetown|pawleys|little river|conway|surfside|garden city` → `marine-local` if marine keyword, `quick-cash` if valet/event/detail/day work. `charleston|mount pleasant|summerville|isle of palms|james island|north charleston` + marine keyword → `marine-chs`. Marine keywords: `deckhand|dockhand|deck hand|mate|boat|marina|yacht|vessel|captain|seaman|mariner|ferry|tug|harbor|crew`. Other marine → `marine-national`. `sdr|bdr|sales development|business development rep|account executive|brand ambassador|retail sales|product demo` → `tech-sales` (if `part-time|event|weekend|temporary|gig` also present → `quick-cash`). `web|developer|front-end|frontend|wordpress|shopify|ai |a\.i\.|prompt|annotation|data label|automation|no-code|chatbot|llm` → `ai-web`. `valet|event staff|detailing|day work|dayworker|day worker` → `quick-cash`. Default `quick-cash`.
- `isCruise`: false if company matches any `filters.allowCompanies` (case-insensitive substring). True if company matches any `filters.excludeCompanies`, or title+snippet matches `/cruise\s*(ship|line)s?/i`.
- `isSenior`: only for tracks `ai-web` and `tech-sales`; true if title matches `/\b(senior|sr\.?|lead|principal|staff|manager|director|head of|vp)\b/i` or snippet matches `/\b([4-9]|1\d)\+?\s*years/i` or `/(bachelor'?s|degree)\s+(is\s+)?required/i`.
- `applyFilters` drops: `isCruise`, `isSenior`, id or normalized url in `dismissed.items`, company (case-insensitive) of any dismissed item whose `reason === "company"`, any id in `trackedIds`, and duplicates (same id, then same `company|title|city` lowercased — keep first).
- `scoreJob`: start 40. +20 if any track keyword in title. +10 if `/entry|no experience|will train|trainee|junior|apprentice|seasonal/i` (also add flag `entry-level`). +5 if pay non-empty. +10 if postedAt within 3 days, +5 within 7. −10 if `/\b(100|200|500)\s*ton|master'?s license|captain'?s license required/i`. Clamp 0–100. Flags: `needs-twic` (/twic/i), `needs-mmc` (/mmc|merchant mariner/i), `needs-eng1` (/eng ?1|stcw medical/i), `drug-test` (/drug (test|screen)/i).
- `mergeFeed`: index prev by id; incoming job keeps prev `firstSeenAt` if present else `nowIso`; prev jobs not in incoming are kept (feed persists between runs) unless `firstSeenAt` older than 30 days; result sorted score desc then firstSeenAt desc, capped at 600.

`config/filters.json`:
```json
{
  "excludeCompanies": ["carnival", "royal caribbean", "norwegian cruise", "ncl", "celebrity cruises", "princess cruises", "disney cruise", "msc cruises", "virgin voyages", "american cruise lines", "viking", "windstar", "lindblad", "american queen", "uncruise", "holland america", "oceania cruises", "regent seven seas", "silversea", "seabourn", "cunard", "azamara"],
  "allowCompanies": ["spiritline", "spirit line", "barefoot queen", "military sealift command"],
  "excludeKeywords": []
}
```
(`excludeKeywords` — any case-insensitive substring match in title ⇒ drop; empty for now, reserved for AI tuning.)

- [ ] **Step 1: Write the failing tests** — `tests/fetcher/lib.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, makeId, cleanText } from '../../scripts/lib/normalize.mjs';
import { classifyTrack } from '../../scripts/lib/classify.mjs';
import { isCruise, isSenior, applyFilters } from '../../scripts/lib/filter.mjs';
import { scoreJob } from '../../scripts/lib/score.mjs';
import { mergeFeed } from '../../scripts/lib/merge.mjs';
import { readFileSync } from 'node:fs';
const filters = JSON.parse(readFileSync(new URL('../../config/filters.json', import.meta.url)));
const J = (o) => ({ title: '', company: '', location: '', remote: false, pay: '', url: '', postedAt: null, snippet: '', source: 't', ...o });

test('normalizeUrl strips tracking and trailing slash', () => {
  assert.equal(normalizeUrl('https://Example.com/job/1/?utm_source=x&id=5#top'), 'https://example.com/job/1?id=5');
});
test('makeId is stable and url-based', () => {
  assert.equal(makeId(J({ url: 'https://a.com/x?utm_medium=y' })), makeId(J({ url: 'https://a.com/x' })));
  assert.match(makeId(J({ company: 'A', title: 'B' })), /^[0-9a-f]{40}$/);
});
test('cleanText strips tags and entities', () => {
  assert.equal(cleanText('<p>Deck&amp;hand <b>wanted</b></p>'), 'Deck&hand wanted');
  assert.equal(cleanText('x'.repeat(300)).length, 240);
});
test('classify: hint wins; location rules', () => {
  assert.equal(classifyTrack(J({ trackHint: 'ai-web', title: 'Deckhand' })), 'ai-web');
  assert.equal(classifyTrack(J({ title: 'Dockhand', location: 'North Myrtle Beach, SC' })), 'marine-local');
  assert.equal(classifyTrack(J({ title: 'Deckhand', location: 'Charleston, SC' })), 'marine-chs');
  assert.equal(classifyTrack(J({ title: 'Deckhand', location: 'Fort Lauderdale, FL' })), 'marine-national');
  assert.equal(classifyTrack(J({ title: 'Valet Attendant', location: 'Myrtle Beach, SC' })), 'quick-cash');
  assert.equal(classifyTrack(J({ title: 'Sales Development Representative', location: 'Remote' })), 'tech-sales');
  assert.equal(classifyTrack(J({ title: 'Brand Ambassador - weekend event', location: 'Charleston, SC' })), 'quick-cash');
  assert.equal(classifyTrack(J({ title: 'Junior WordPress Developer', location: 'Remote' })), 'ai-web');
});
test('cruise filter: blocks cruise lines, allows harbor tours and MSC (Sealift)', () => {
  assert.equal(isCruise(J({ company: 'Royal Caribbean Group', title: 'Deckhand' }), filters), true);
  assert.equal(isCruise(J({ company: 'Acme', title: 'Deck Crew - Cruise Ship' }), filters), true);
  assert.equal(isCruise(J({ company: 'SpiritLine Cruises', title: 'Deckhand' }), filters), false);
  assert.equal(isCruise(J({ company: 'Military Sealift Command', title: 'Ordinary Seaman' }), filters), false);
  assert.equal(isCruise(J({ company: 'MSC Cruises', title: 'Deckhand' }), filters), true);
});
test('senior filter only for ai-web/tech-sales', () => {
  assert.equal(isSenior({ ...J({ title: 'Senior Web Developer' }), track: 'ai-web' }, filters), true);
  assert.equal(isSenior({ ...J({ title: 'Web Developer', snippet: 'Requires 5+ years of React' }), track: 'ai-web' }, filters), true);
  assert.equal(isSenior({ ...J({ title: 'Lead Deckhand' }), track: 'marine-local' }, filters), false);
});
test('applyFilters drops dismissed, company-dismissed, tracked, dupes', () => {
  const mk = (o) => { const j = J(o); return { ...j, id: makeId(j), track: classifyTrack(j) }; };
  const a = mk({ title: 'Deckhand', company: 'A', url: 'https://a.com/1', location: 'Charleston, SC' });
  const b = mk({ title: 'Dockhand', company: 'Bad Co', url: 'https://b.com/2', location: 'Charleston, SC' });
  const c = mk({ title: 'Mate', company: 'C', url: 'https://c.com/3', location: 'Charleston, SC' });
  const d = mk({ title: 'Mate', company: 'C', url: 'https://c.com/3?utm_source=z', location: 'Charleston, SC' });
  const e = mk({ title: 'Valet', company: 'E', url: 'https://e.com/5', location: 'Myrtle Beach, SC' });
  const dismissed = { items: [{ id: a.id, url: a.url, company: 'A', reason: 'too-far' }, { id: 'zz', company: 'bad co', reason: 'company' }] };
  const out = applyFilters([a, b, c, d, e], { filters, dismissed, trackedIds: new Set([e.id]) });
  assert.deepEqual(out.map(j => j.company), ['C']);
});
test('scoreJob rewards entry level and flags credentials', () => {
  const r = scoreJob({ ...J({ title: 'Deckhand', snippet: 'Entry level, will train. TWIC and drug screen required.', pay: '$18/hr', postedAt: new Date().toISOString() }), track: 'marine-chs' });
  assert.ok(r.score >= 80, String(r.score));
  assert.deepEqual(r.flags.sort(), ['drug-test', 'entry-level', 'needs-twic']);
});
test('mergeFeed keeps firstSeenAt, expires >30 days, sorts by score', () => {
  const now = '2026-10-15T12:00:00.000Z';
  const prev = [
    { id: '1', score: 50, firstSeenAt: '2026-10-10T00:00:00.000Z' },
    { id: '2', score: 90, firstSeenAt: '2026-09-01T00:00:00.000Z' },
    { id: '3', score: 10, firstSeenAt: '2026-10-14T00:00:00.000Z' }];
  const incoming = [{ id: '1', score: 60 }, { id: '4', score: 70 }];
  const out = mergeFeed(prev, incoming, now);
  assert.deepEqual(out.map(j => j.id), ['4', '1', '3']);
  assert.equal(out.find(j => j.id === '1').firstSeenAt, '2026-10-10T00:00:00.000Z');
  assert.equal(out.find(j => j.id === '4').firstSeenAt, now);
});
```

- [ ] **Step 2:** `npm test` → expect FAIL (modules missing).
- [ ] **Step 3:** Implement the five modules + `config/filters.json` per the rules above.
- [ ] **Step 4:** `npm test` → expect PASS.

### Task 2: Sources, runner, configs, workflow

**Files:**
- Create: `scripts/lib/http.mjs`, `scripts/sources/{adzuna,usajobs,jsearch,remotive,remoteok,jobicy,himalayas,arbeitnow,wwr,ats,pagewatch}.mjs`, `scripts/fetch-feed.mjs`
- Create: `config/searches.json`, `config/companies.json`
- Create: `.github/workflows/feed.yml`
- Test: `tests/fetcher/runner.test.mjs`

**Interfaces:**
- Consumes: everything from Task 1.
- `http.mjs`: `getJson(url, { headers, timeoutMs = 15000, retries = 1, method = 'GET', body })`, `getText(url, opts)`. Sets `User-Agent: CrowsNestJobBot/1.0 (personal job search; github.com/lukecode2/crows-nest)` unless overridden. Throws on non-2xx or (for getJson) non-JSON.
- Each source module: `export const name = '<name>'; export async function fetchJobs(ctx): Promise<RawJob[]>` where `ctx = { env, searches, companies, http, log, now: Date, runSlot: 0|1|2, state }` (`state` = parsed `data/pagewatch.json`, mutable).
- `fetch-feed.mjs` exports `async function runSources(sources, ctx): Promise<{ jobs: RawJob[], report: {name, ok, count, error}[] }>` (each source wrapped in try/catch + 60 s overall timeout) and `async function main(argv)`; runs `main` only when executed directly.

**Source details:**
- `adzuna`: `GET https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=&app_key=&what=&where=&distance=40&results_per_page=50&max_days_old=14&content-type=application/json`. Max **8 calls per run** (free tier ≈25/min, 250/day). Map `title, company.display_name, location.display_name, redirect_url, created, description, salary_min/max` → pay `"$X–$Y"` (hourly if < 200).
- `usajobs`: `GET https://data.usajobs.gov/api/search?Keyword=…&ResultsPerPage=50` headers `Host: data.usajobs.gov`, `User-Agent: <USAJOBS_EMAIL>`, `Authorization-Key: <USAJOBS_API_KEY>`. Keywords: `deckhand`, `ordinary seaman`, `general vessel assistant`, `wage mariner`, `boat operator`. trackHint `marine-national`. Pay from `PositionRemuneration`.
- `jsearch`: `GET https://jsearch.p.rapidapi.com/search?query=…&page=1&num_pages=1&date_posted=week&country=us` headers `x-rapidapi-key`, `x-rapidapi-host: jsearch.p.rapidapi.com`. **Max 2 calls per run** (free tier 200/mo, 3 runs/day). Pick queries by rotation: index = `(dayOfYear * 3 + runSlot) * 2 + k` mod list length. Map `job_title, employer_name, job_city/job_state, job_apply_link, job_posted_at_datetime_utc, job_description, job_min_salary/max`.
- `remotive` `https://remotive.com/api/remote-jobs?search=<q>&limit=50`; `remoteok` `https://remoteok.com/api` (skip element 0; filter by tags); `jobicy` `https://jobicy.com/api/v2/remote-jobs?count=50&tag=<q>&geo=usa`; `himalayas` `https://himalayas.app/jobs/api?limit=100`; `arbeitnow` `https://www.arbeitnow.com/api/job-board-api` (keep `remote:true` only); `wwr` RSS `https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss`, `…/remote-full-stack-programming-jobs.rss`, `…/remote-front-end-programming-jobs.rss`, `…/remote-customer-support-jobs.rss` (parse `<item><title>Company: Role</title><link>…`). For keyless remote boards, only keep items whose title matches the `ai-web` or `tech-sales` keyword lists from Task 1 (set `remote: true`, `location: 'Remote'`).
- `ats`: for each `config/companies.json` entry with ats ≠ `page`: Greenhouse `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`; Lever `https://api.lever.co/v0/postings/{slug}?mode=json`; Ashby `https://api.ashbyhq.com/posting-api/job-board/{slug}`; SmartRecruiters `https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=100`; Workday `POST https://{host}/wday/cxs/{tenant}/{site}/jobs` body `{"appliedFacets":{},"limit":20,"offset":0,"searchText":"<entry.searchText||''>"}` (entry fields `host`, `tenant`, `site`; job url = `https://{host}/en-US/{site}{externalPath}`). trackHint = entry.track. Optional `entry.keywords` array: keep only titles matching one (for big companies). Optional `entry.states`: keep only locations containing one (e.g. `["SC","FL","NC","GA","Remote"]`).
- `pagewatch`: for entries with `ats: "page"`: check `robots.txt` disallow for the path (simple prefix check for `User-agent: *`); fetch HTML; extract `<a href>` whose text matches `/deck|dock|crew|mate|marina|captain|yacht|job|career|position|ambassador|valet|sales/i`; compare against `ctx.state[entry.url]` (array of hrefs); emit one RawJob per **new** link (title = link text, company = entry.name, url = absolute href, snippet `"New link on careers page"`, trackHint = entry.track) and store the current set back. First run for an entry stores the set and emits nothing (avoids flooding).

**Runner (`main`):** parse `--dry` (print summary, don't write files). Load configs, `data/feed.json` (if present), `data/dismissed.json`, `data/tracker.json` (trackedIds = `feedId` of tracker jobs), `data/pagewatch.json`. `runSlot` = `Math.floor(new Date().getUTCHours() / 8)`. Run sources → for each raw job: `cleanText` the snippet, `id = makeId`, `track = classifyTrack`, then `applyFilters` (also `excludeKeywords`), `scoreJob` → merge with previous via `mergeFeed` → write `data/feed.json` (`{ generatedAt, sources: report, jobs }`, 2-space JSON) and `data/pagewatch.json`. Exit 0 even if sources fail; exit 1 only if writing fails.

**`config/searches.json`** (shape `{ "adzuna": [{what, where, track}], "jsearch": [{query, track}], "remote": [{q, track}] }`). Seed:
- adzuna (8): deckhand/Myrtle Beach SC/marine-local; dockhand marina/Myrtle Beach SC/marine-local; deckhand/Charleston SC/marine-chs; boat crew/Charleston SC/marine-chs; deckhand yacht/Fort Lauderdale FL/marine-national; valet/Myrtle Beach SC/quick-cash; brand ambassador/Myrtle Beach SC/quick-cash; sales development representative/(where empty)/tech-sales.
- jsearch (12, rotated): "deckhand jobs in Myrtle Beach, SC"/marine-local; "dock hand marina jobs Myrtle Beach SC"/marine-local; "deckhand jobs in Charleston, SC"/marine-chs; "ferry deckhand Charleston SC"/marine-chs; "yacht deckhand Fort Lauderdale"/marine-national; "entry level deckhand"/marine-national; "brand ambassador Best Buy Myrtle Beach"/quick-cash; "valet attendant Myrtle Beach"/quick-cash; "entry level SDR remote"/tech-sales; "retail tech sales associate Myrtle Beach"/tech-sales; "AI trainer remote no experience"/ai-web; "junior web developer remote entry level"/ai-web.
- remote (q list): `ai trainer`, `data annotation`, `prompt`, `automation`, `wordpress`, `web developer`, `junior developer`, `sales development`, `business development representative`, `customer success` — tracks ai-web / tech-sales accordingly.

**`config/companies.json`** — use web search to find each company's real careers system and fill in a working entry. **Verify every API entry with one live request** before keeping it; if no API, use `ats: "page"` with the careers URL; if nothing loads, omit it and list it in a comment field `"_skipped"` at the top level. Companies: Safe Harbor Marinas, Brunswick Corporation (Freedom Boat Club; keywords: dock, boat, marina, club, captain, member), MarineMax, SpiritLine Cruises, City Experiences/Hornblower (keywords: deck, captain, mate, crew; states SC/FL), Crowley, Sea Tow, Moran Towing, Edison Chouest Offshore, Kirby Corporation, Harbor Docking & Towing (Charleston); yacht boards Yotspot, The Crew Network, Cotton Crews, Bluewater Yachting, Dockwalk (all `page`); NOAA Marine Operations hiring page `https://marinerhiring.noaa.gov` (page); Military Sealift Command `https://www.sealiftcommand.com` careers (page). Brand-ambassador / retail-tech agencies (track `tech-sales`; the classifier will move part-time/event roles to quick-cash — set no trackHint for these entries, i.e. `"track": null`): **2020 Companies**, **ActionLink**, **BDS Connected Solutions** (Luke's past employers — highest priority), plus Advantage Solutions, CROSSMARK, Mosaic, Premium Retail Services, SPAR Business Services, Acosta, and any other agency you find that staffs in-store tech demo roles at Best Buy / Walmart / Target (e.g. Samsung or Google retail programs). For these use `states: ["SC","NC","Remote"]`.

**Workflow `.github/workflows/feed.yml`:**
```yaml
name: feed
on:
  schedule:
    - cron: '15 11,17,23 * * *'   # 7:15am, 1:15pm, 7:15pm Eastern (EDT)
  workflow_dispatch: {}
permissions:
  contents: write
concurrency:
  group: feed
  cancel-in-progress: false
jobs:
  fetch:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm test
      - run: node scripts/fetch-feed.mjs
        env:
          ADZUNA_APP_ID: ${{ secrets.ADZUNA_APP_ID }}
          ADZUNA_APP_KEY: ${{ secrets.ADZUNA_APP_KEY }}
          USAJOBS_API_KEY: ${{ secrets.USAJOBS_API_KEY }}
          USAJOBS_EMAIL: ${{ secrets.USAJOBS_EMAIL }}
          RAPIDAPI_KEY: ${{ secrets.RAPIDAPI_KEY }}
      - name: Commit feed
        run: |
          git config user.name "crows-nest-bot"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/feed.json data/pagewatch.json
          git diff --cached --quiet && exit 0
          git commit -m "feed: refresh $(date -u +%Y-%m-%dT%H:%MZ)"
          for i in 1 2 3; do git pull --rebase && git push && exit 0; sleep 5; done
          exit 1
```

- [ ] **Step 1: Write the failing test** — `tests/fetcher/runner.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSources } from '../../scripts/fetch-feed.mjs';

test('runSources isolates failing sources', async () => {
  const good = { name: 'good', fetchJobs: async () => [{ title: 'Deckhand', company: 'A', location: 'Charleston, SC', url: 'https://a.com/1', source: 'good' }] };
  const bad = { name: 'bad', fetchJobs: async () => { throw new Error('Unexpected token < in JSON'); } };
  const slow = { name: 'slow', fetchJobs: () => new Promise(() => {}) };
  const { jobs, report } = await runSources([good, bad, slow], { env: {}, perSourceTimeoutMs: 200 });
  assert.equal(jobs.length, 1);
  assert.deepEqual(report.map(r => [r.name, r.ok]), [['good', true], ['bad', false], ['slow', false]]);
  assert.match(report[1].error, /Unexpected token/);
});

test('keyed source without key reports missing key', async () => {
  const adzuna = await import('../../scripts/sources/adzuna.mjs');
  const { report } = await runSources([adzuna], { env: {}, searches: { adzuna: [] }, perSourceTimeoutMs: 200 });
  assert.equal(report[0].ok, false);
  assert.match(report[0].error, /missing key/);
});
```
(`runSources` honours `ctx.perSourceTimeoutMs`, default 60000. Keyed sources throw `new Error('missing key')` when their env vars are absent.)

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement http, sources, runner, configs (with web research + live verification), workflow.
- [ ] **Step 4:** `npm test` → PASS. Then `npm run feed:dry` → prints per-source counts; keyless sources should return > 0 jobs total; keyed sources report `missing key`.
- [ ] **Step 5:** `npm run feed` once to produce a real `data/feed.json` + `data/pagewatch.json` from keyless sources (so the UI has data). Report the per-source summary in your final message.

---

## Job B — Web app

### Task 3: App logic, GitHub sync helpers

**Files:**
- Create: `js/config.js`, `js/logic.js`, `js/github.js`, `js/store.js`
- Test: `tests/app/logic.test.mjs`, `tests/app/github.test.mjs`

**Interfaces (Produces):**
- `js/config.js`: `export const REPO = { owner: 'lukecode2', repo: 'crows-nest', branch: 'master', workflow: 'feed.yml' }`, `TRACKS` (array `{id, label, short, color}` in spec §4 order with labels Home Waters, Charleston Harbor, Blue Water, AI & Web, Tech Sales, Quick Cash), `STAGES` (array `{id, label, hint}`: dockside "Dockside" "Lead", castoff "Cast Off" "Applied", hailed "Hailed" "Followed up", boarding "Boarding" "Interview", hired "Hired" "Offer", lost "Lost at Sea" "Rejected"), `BOAT_SHOW = { name: 'Fort Lauderdale International Boat Show', start: '2026-10-28', end: '2026-11-01' }`, `DISMISS_REASONS` (`[{id:'not-interested',label:'Not interested'},{id:'too-far',label:'Too far'},{id:'pay-too-low',label:'Pay too low'},{id:'needs-experience',label:'Needs more experience'},{id:'cruise',label:'Cruise ship'},{id:'company',label:'Hide this company'},{id:'other',label:'Other'}]`).
- `js/logic.js` (pure, no DOM; `today` param is a `YYYY-MM-DD` string):
  - `weekStart(dateStr): string` — Monday of that week.
  - `addDays(dateStr, n): string`, `daysBetween(a, b): number` (b − a, whole days).
  - `appsInWeek(jobs, today): number` — jobs with `dateApplied` in [weekStart(today), weekStart+6].
  - `streak(jobs, today, goal): number` — count consecutive weeks ≥ goal going backwards from last week; add 1 if current week already ≥ goal.
  - `totals(jobs): { applied, interviews, offers }` — applied = jobs with dateApplied; interviews = jobs whose stage is boarding/hired or history contains boarding; offers = stage hired.
  - `overdue(jobs, today, days = 7): Job[]` — stage castoff or hailed and `daysBetween(max(dateApplied,lastFollowUp), today) >= days`; sorted most overdue first; each result gets `daysWaiting`.
  - `nextActions(jobs, n = 3): Job[]` — jobs with `nextAction` and `nextDue`, stage not hired/lost, sorted by nextDue asc.
  - `newSince(feedJobs, isoLastVisit): Record<TrackId, number>`.
  - `countdown(today, show): { phase: 'before'|'during'|'after', days: number }`.
  - `safeUrl(u): string|null` — returns u only if protocol http/https.
  - `feedJobToTracker(feedJob, stage, today): TrackerJob` — new tracker job (id `'t_' + Date.now().toString(36) + random`, feedId, company, role=title, track, location, link=url, pay, stage, dateApplied = today if stage==='castoff' else null, history `[{stage, at}]`, reqs from flags: needs-eng1→eng1, needs-mmc→mmc, needs-twic→twic, drug-test→drug).
  - `mergeTrackers(local, remote): Tracker` — union jobs by id, the one with later `updatedAt` (per job; fallback createdAt) wins; reqs by id, later `updatedAt` wins; settings from the newer tracker.
- `js/github.js`: `b64EncodeUtf8(str)`, `b64DecodeUtf8(b64)` (handles newlines in GitHub's base64), `getFile(path, token) → { json, sha } | null (404)`, `putFile(path, json, sha, token, message) → newSha` (throws `Error` with `.status`), `dispatchFeed(token)`. All use `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, headers `Accept: application/vnd.github+json`, `Authorization: Bearer <token>`.
- `js/store.js`: owns state `{ tracker, dismissed, feed, sync: 'synced'|'saving'|'local'|'error', lastVisit }`; `load()` (localStorage first → render fast; then feed via `fetch('data/feed.json?t=' + Date.now())`; then GitHub files if token, else public `data/tracker.json` only if localStorage empty); `save()` debounced 1500 ms → putFile both changed files; on 409/422 re-get, `mergeTrackers`, retry once; on 401/403/network set sync `'local'`/`'error'` and keep localStorage. `subscribe(fn)`. Every mutation sets `updatedAt` on the job and tracker. All localStorage access wrapped in try/catch. Keys: `cn.tracker`, `cn.dismissed`, `cn.token`, `cn.lastVisit`.

- [ ] **Step 1: Write failing tests** — `tests/app/logic.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../js/logic.js';

const job = (o) => ({ id: Math.random().toString(36), stage: 'castoff', dateApplied: null, lastFollowUp: null, history: [], ...o });

test('weekStart is Monday; Sunday belongs to previous Monday', () => {
  assert.equal(L.weekStart('2026-10-15'), '2026-10-12'); // Thursday
  assert.equal(L.weekStart('2026-10-18'), '2026-10-12'); // Sunday
  assert.equal(L.weekStart('2026-10-19'), '2026-10-19'); // Monday
});
test('appsInWeek counts Mon..Sun', () => {
  const jobs = [job({ dateApplied: '2026-10-12' }), job({ dateApplied: '2026-10-18' }), job({ dateApplied: '2026-10-11' }), job({ stage: 'dockside' })];
  assert.equal(L.appsInWeek(jobs, '2026-10-15'), 2);
});
test('streak counts consecutive weeks at goal', () => {
  const mk = (d, n) => Array.from({ length: n }, () => job({ dateApplied: d }));
  const jobs = [...mk('2026-09-29', 2), ...mk('2026-10-06', 2), ...mk('2026-10-13', 1)];
  assert.equal(L.streak(jobs, '2026-10-15', 2), 2);        // weeks of 9/28 and 10/5; current week not yet
  assert.equal(L.streak([...jobs, job({ dateApplied: '2026-10-14' })], '2026-10-15', 2), 3);
  assert.equal(L.streak(mk('2026-09-22', 2), '2026-10-15', 2), 0); // gap breaks it
});
test('overdue: castoff/hailed waiting >= 7 days since last touch', () => {
  const a = job({ dateApplied: '2026-10-05' });
  const b = job({ dateApplied: '2026-10-01', lastFollowUp: '2026-10-12', stage: 'hailed' });
  const c = job({ dateApplied: '2026-10-01', stage: 'boarding' });
  const out = L.overdue([a, b, c], '2026-10-15');
  assert.deepEqual(out.map(j => j.id), [a.id]);
  assert.equal(out[0].daysWaiting, 10);
});
test('nextActions sorted by due date, skips closed', () => {
  const jobs = [job({ nextAction: 'b', nextDue: '2026-10-20' }), job({ nextAction: 'a', nextDue: '2026-10-16' }), job({ nextAction: 'x', nextDue: '2026-10-01', stage: 'lost' }), job({ nextAction: 'c', nextDue: '2026-10-25' }), job({ nextAction: 'd', nextDue: '2026-10-30' })];
  assert.deepEqual(L.nextActions(jobs).map(j => j.nextAction), ['a', 'b', 'c']);
});
test('countdown phases', () => {
  const show = { start: '2026-10-28', end: '2026-11-01' };
  assert.deepEqual(L.countdown('2026-10-15', show), { phase: 'before', days: 13 });
  assert.equal(L.countdown('2026-10-30', show).phase, 'during');
  assert.equal(L.countdown('2026-11-02', show).phase, 'after');
});
test('safeUrl rejects javascript: and data:', () => {
  assert.equal(L.safeUrl('javascript:alert(1)'), null);
  assert.equal(L.safeUrl('data:text/html,x'), null);
  assert.equal(L.safeUrl('https://ok.com/a'), 'https://ok.com/a');
  assert.equal(L.safeUrl('not a url'), null);
});
test('feedJobToTracker maps flags to reqs and sets applied date', () => {
  const t = L.feedJobToTracker({ id: 'f1', title: 'Deckhand', company: 'A', track: 'marine-chs', location: 'Charleston', url: 'https://a', pay: '', flags: ['needs-twic', 'drug-test'] }, 'castoff', '2026-10-15');
  assert.equal(t.feedId, 'f1'); assert.equal(t.dateApplied, '2026-10-15'); assert.deepEqual(t.reqs.sort(), ['drug', 'twic']);
});
test('mergeTrackers keeps newer job edits from both sides', () => {
  const local = { updatedAt: '2026-10-15T10:00:00Z', settings: { weeklyGoal: 10 }, reqs: [], jobs: [{ id: '1', notes: 'local new', updatedAt: '2026-10-15T10:00:00Z' }, { id: '2', notes: 'only local', updatedAt: '2026-10-15T09:00:00Z' }] };
  const remote = { updatedAt: '2026-10-15T11:00:00Z', settings: { weeklyGoal: 12 }, reqs: [], jobs: [{ id: '1', notes: 'remote old', updatedAt: '2026-10-15T08:00:00Z' }, { id: '3', notes: 'only remote', updatedAt: '2026-10-15T08:00:00Z' }] };
  const m = L.mergeTrackers(local, remote);
  assert.deepEqual(m.jobs.map(j => j.id).sort(), ['1', '2', '3']);
  assert.equal(m.jobs.find(j => j.id === '1').notes, 'local new');
  assert.equal(m.settings.weeklyGoal, 12);
});
```

`tests/app/github.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { b64EncodeUtf8, b64DecodeUtf8 } from '../../js/github.js';
test('utf8 base64 round trip with emoji and accents', () => {
  const s = JSON.stringify({ notes: 'Café ⚓ 🛥️ — naïve' });
  assert.equal(b64DecodeUtf8(b64EncodeUtf8(s)), s);
  assert.equal(b64DecodeUtf8(b64EncodeUtf8(s).replace(/(.{10})/g, '$1\n')), s); // GitHub wraps lines
});
```
(`js/github.js` must import nothing browser-only at module top level so Node can import it; use global `btoa/atob/TextEncoder/TextDecoder`, which exist in Node 20.)

- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS.

### Task 4: UI, theme, seed data

**Files:**
- Create: `index.html`, `css/app.css`, `js/ui.js`, `js/app.js`, `js/views/helm.js`, `js/views/nest.js`, `js/views/voyage.js`, `js/views/papers.js`, `js/views/settings.js`
- Create: `data/tracker.json` (seed), `data/dismissed.json` (`{"about": "<spec text>", "items": []}`)
- Create (only if absent — job A writes the real one): `data/feed.json` = `{"generatedAt": null, "sources": [], "jobs": []}`

**Interfaces:** Consumes `js/config.js`, `js/logic.js`, `js/store.js`. `js/ui.js` exports `h(tag, attrs, ...children)` (sets text via `textContent`; `href` only through `safeUrl`; never `innerHTML` for data), `sheet(contentEl)` bottom-sheet/modal with close, `toast(msg)`, `confirmInline(el, msg) → Promise<boolean>` (no `window.confirm`).

**Theme (dark only, `color-scheme: dark`):** tokens `--sea: #0a1a2b` (bg), `--hull: #10263c` (panels), `--rope: #1d3a55` (borders), `--brass: #d4a94f` (accent), `--foam: #7fd1c1` (good/progress), `--flare: #ef6a4c` (overdue/critical), `--chart-ink: #e8eef4` (text), `--mist: #9db2c6` (muted). Fonts (Google Fonts link): display `"Big Shoulders Stencil Display", Impact, sans-serif` for headings/numbers; body `"Barlow", system-ui, sans-serif`; numbers use `font-variant-numeric: tabular-nums`. A slow CSS wave strip along the bottom of The Helm header (SVG path, `@media (prefers-reduced-motion: reduce)` disables animation). Track colors distinct and readable on `--hull`.

**Layout:** header with ⚓ "Crow's Nest" + sync pill (Synced / Saving… / Local only / Sync error → tap opens Settings). Tabs (hash routes `#helm`, `#nest`, `#voyage`, `#papers`, `#settings`): top bar ≥ 720px, fixed bottom bar < 720px (with `env(safe-area-inset-bottom)` padding). Side gutter `max(16px, env(safe-area-inset-left))`. No horizontal page scroll at 360px.

**The Helm:** (1) Weekly goal: 10 nautical signal-flag pennants in a row (CSS triangles/rects); flag i lit (brass/foam) if appsInWeek ≥ i; big number "3 / 10 this week" and copy that changes with progress ("Anchors aweigh — 0 so far", "Making way", "Halfway to port", "Full sail — goal hit!"). Beside it: streak ("🔥 2-week streak" / "Start a streak"), total applied, interviews, offers. (2) **Overdue hails** list (flare stripe, "applied 9d ago", button "Hailed ✓" → stage hailed + lastFollowUp today). Empty state: "No one's waiting on you." (3) **Next headings**: top 3 next actions with due date (red if past). (4) **New in the Crow's Nest**: per-track counts since last visit, tap → `#nest` filtered. (5) **Boat Show countdown** card: "13 days to FLIBS — arrive early for day work"; during: "Show is on — walk the docks"; after: hide.
**Crow's Nest:** track chips with counts (All + 6), sort (Best match / Newest), search input, toggle "New only". Card: title, company · location, pay, track chip, score bar, flag chips (TWIC, MMC, ENG1, Drug test → link to #papers), posted "3d ago", source; buttons **Save**, **Applied**, **Dismiss**, and title links to the job (`target=_blank rel=noopener`). Dismiss opens inline reason chips (DISMISS_REASONS) + optional note → appends to `dismissed.items` (fields per spec §3) and hides the card with an Undo toast (5 s). Feed jobs whose id is a tracker `feedId` or in dismissed are hidden. Footer: "Updated 2h ago · 9/11 sources OK" expandable list; button "Refresh now" (needs token → `dispatchFeed`, toast "Lookout sent — new jobs in ~2 min"). Empty state if feed empty: "The lookout hasn't reported yet — first run lands within a few hours, or tap Refresh now."
**The Voyage:** 6 columns (horizontal scroll inside its own `overflow-x:auto` container on phone; columns ≥ 260px). Cards: company, role, track chip, days in stage, next action. Desktop HTML5 drag-and-drop between columns. Tap card → sheet with all fields editable (company, role, track select, location, link, pay, date applied, last follow-up, contact name/email/phone shown as selectable text + copy buttons, notes, requirement checkboxes from tracker.reqs, next action + due date), stage buttons row, "Mark followed up", Delete (inline confirm). Moving to castoff sets dateApplied=today if empty; every move appends history. "+ Add job" button opens the same sheet blank (default stage dockside).
**Ship's Papers:** list of reqs with big checkbox, label, guidance text (`unlocks` field), note input, and "Unlocks N jobs" (count tracker jobs whose `reqs` include the id; tap expands their names). Progress bar "4 of 9 papers in order".
**Settings:** token field (password input, Save/Clear), instructions: "Create a fine-grained token at github.com/settings/personal-access-tokens/new → Only select repositories: crows-nest → Permissions: Contents Read and write, Actions Read and write." (link opens in new tab); weekly goal number; Export (download JSON via Blob + `<a download>` — this is a normal web page, downloads work) and Import (file input, validates `version===1`, then mergeTrackers); sync status + last saved time.

**Seed `data/tracker.json`:** `version 1`, settings `{weeklyGoal:10, followUpDays:7}`, reqs:
| id | label | done | unlocks |
|---|---|---|---|
| doctor | Doctor visit / health check | false | First step — clears you for the ENG1 and USCG medical. |
| eng1 | ENG1 yacht crew medical | false | Required for yacht crew jobs (Fort Lauderdale, delivery crew). Done by MCA-approved doctors — several in Fort Lauderdale; often same day. |
| mmc | USCG Merchant Mariner Credential + medical certificate | false | Needed for NOAA, Military Sealift Command and most US-flag commercial vessels. Apply via USCG NMC; medical is form CG-719K. |
| twic | TWIC card | false | Needed to work at many ports and on credentialed vessels; often asked for by Charleston harbor and ferry operators. |
| drug | Drug test ready (clean) | false | Pre-employment DOT drug test is standard for every passenger and commercial vessel job. |
| seaservice | Sea service letter — Pinecrest Marina | false | Documents your 1,000+ helm hours; needed for MMC ratings and future captain's license. |
| resume-marine | Resume (marine) | true | Done. |
| resume-sales | Resume (tech sales) | false | For SDR/BDR and brand ambassador roles. |
| resume-ai | Resume (AI / web) | false | For AI and web gigs and freelance pitches. |

Seed jobs (stage `dockside`, `createdAt`/`updatedAt` = `2026-10-15T00:00:00Z`, ids `seed-1`…): every lead from spec §7 with its details in the right field (phone/email in contact, address/pay/notes in notes or pay), track set, reqs: yacht entries → `["eng1"]`; NOAA, MSC → `["mmc","drug"]`; Charleston SpiritLine/Dewees ferry → `["twic","drug"]`; fire departments → `["doctor"]`; Indeed/Remote Rocketship search links → role "Saved search", notes "Check weekly". Next actions on 3 of them so The Helm isn't empty: Crazy Sister Marina "Walk in with resume" due 2026-10-17; Freedom Boat Club Grand Strand "Call 843-732-3777 about dock crew" due 2026-10-16; Cotton Crews "Register crew profile before FLIBS" due 2026-10-20.

- [ ] **Step 1:** Build files. **Step 2:** `npm test` still passes. **Step 3:** Serve locally: `python3 -m http.server 8080` and open `http://localhost:8080` — no console errors; all 5 tabs render with seed data; drag a card; dismiss a job (with sample feed) persists to localStorage across reload.

---

## Task 5: Integration & deploy (Claude)

- [ ] Review both jobs' diffs against spec + this plan; run `npm test`.
- [ ] Playwright: desktop 1280px + phone 390px screenshots of Helm, Nest, Voyage; check console errors.
- [ ] Commit, push; enable Pages (`gh api -X POST repos/lukecode2/crows-nest/pages -f source[branch]=master -f source[path]=/`).
- [ ] Confirm Luke added 5 secrets (`gh secret list`); `gh workflow run feed.yml`; watch run; confirm `data/feed.json` has keyed-source jobs.
- [ ] Walk Luke through creating the fine-grained token and pasting it on laptop + phone.
