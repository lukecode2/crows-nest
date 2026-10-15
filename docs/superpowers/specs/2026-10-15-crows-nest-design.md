# Crow's Nest — Luke's job-hunt dashboard (design spec)

Date: 2026-10-15 · Owner: Luke Smith (GitHub `lukecode2`) · Goal: live tonight.

## 1. Purpose

Luke (23, Myrtle Beach SC, unemployed, needs income now, willing to relocate) needs one place that
**finds** open jobs across every source we can legally reach, and **tracks** the ones he acts on.
He quits things when he can't see progress, so progress must be loud and visible.

Success = by end of night: public GitHub Pages site works on laptop + phone, a cloud job fills the feed
3×/day, Luke can save/apply/dismiss from the feed, move jobs through the pipeline, and see his weekly score.

Background (from resume): 1,000+ helm hours, 8 marina seasons (Pinecrest Marina 2019–2025 charter
operator; Freedom Boat Club 2018), STCW Basic (Sea School Charleston 2025), brand ambassador
(2020 Companies, ActionLink, BDS Connected Solutions — Meta, SimpliSafe, Amazon Fire TV at Best Buy),
valet (HPS, Evolution Parking), freelance web dev (AI-assisted real-estate site). No degree; US passport.

**Hard exclusions:** no cruise-ship / cruise-line jobs. No senior or high-experience tech roles.

## 2. Architecture

```
GitHub repo lukecode2/crows-nest (public)
├─ GitHub Pages  → serves index.html + css/js + data/feed.json
├─ GitHub Action → .github/workflows/feed.yml, cron 3×/day + manual dispatch
│     runs scripts/fetch-feed.mjs (Node 20, zero deps) → commits data/feed.json
└─ Contents API  → the web app reads/writes data/tracker.json and data/dismissed.json
                   using a fine-grained token Luke pastes once per device (localStorage)
```

- No server, no paid service, no build step. Plain HTML/CSS/ES-module JS.
- API keys live only in GitHub Actions secrets: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `USAJOBS_API_KEY`,
  `USAJOBS_EMAIL`, `RAPIDAPI_KEY`. A source with a missing key is skipped and reported, never fatal.
- Without a token the app still works from localStorage (read-only feed + local tracker) and says so.
- Export/Import of the full tracker as JSON is always available.

### Browser compatibility
Must run on Safari 15.6 / current Chrome on macOS 12 and on iPhone Safari. Target ES2020. Do not use
CSS nesting, container queries, `:has()`, View Transitions, or `Array.prototype.toSorted` etc.

### Security
Feed data is untrusted third-party text: render it with `textContent` / escaped strings only — never
`innerHTML` with feed values. Only `http(s)` URLs become links. Token stays in localStorage, never committed.

## 3. Data contracts (shared by fetcher and app)

`data/feed.json` (written only by the Action):
```json
{ "generatedAt": "ISO", "sources": [{ "name": "adzuna", "ok": true, "count": 42, "error": null }],
  "jobs": [{ "id": "sha1(normalized url || company|title|location)", "track": "marine-local",
    "title": "", "company": "", "location": "", "remote": false, "pay": "", "url": "",
    "source": "adzuna", "postedAt": "ISO|null", "firstSeenAt": "ISO", "score": 0,
    "flags": ["entry-level", "needs-twic", "needs-mmc", "needs-eng1", "drug-test", "page-changed"],
    "snippet": "≤240 chars plain text" }] }
```
Jobs older than 30 days (by `firstSeenAt`) are dropped. Max 600 jobs, highest score kept.

`data/tracker.json` (written only by the app):
```json
{ "version": 1, "updatedAt": "ISO", "settings": { "weeklyGoal": 10, "followUpDays": 7 },
  "jobs": [{ "id": "", "feedId": "|null", "company": "", "role": "", "track": "", "location": "",
    "link": "", "pay": "", "stage": "dockside|castoff|hailed|boarding|hired|lost",
    "dateApplied": "YYYY-MM-DD|null", "lastFollowUp": "YYYY-MM-DD|null",
    "contact": { "name": "", "email": "", "phone": "" }, "notes": "", "reqs": ["eng1"],
    "nextAction": "", "nextDue": "YYYY-MM-DD|null", "createdAt": "ISO", "history": [{ "stage": "", "at": "ISO" }] }],
  "reqs": [{ "id": "eng1", "label": "", "done": false, "note": "", "unlocks": "text" }] }
```

`data/dismissed.json` (written by the app, read by the fetcher and by AI assistants):
```json
{ "about": "Jobs Luke dismissed. Fetcher never re-shows these; AIs read this to tune filters.",
  "items": [{ "id": "", "title": "", "company": "", "location": "", "url": "", "source": "",
    "track": "", "reason": "not-interested|too-far|pay-too-low|needs-experience|cruise|company|other",
    "note": "", "dismissedAt": "ISO" }] }
```
Fetcher rules from dismissals: never re-show a dismissed `id`/url; if reason = `company`, drop every job
from that company. Everything else is left for humans/AIs to review and turn into `config/filters.json` rules.

Config files (hand-edited): `config/searches.json` (queries per source → track + location),
`config/companies.json` (career pages: `{name, track, ats: greenhouse|lever|ashby|workday|smartrecruiters|page, slug|url}`),
`config/filters.json` (`excludeKeywords`, `excludeCompanies`, `allowCompanies`, `seniorKeywords`).

## 4. Tracks (every job gets exactly one)

| id | Label (UI) | Covers |
|---|---|---|
| `marine-local` | Home Waters | Myrtle Beach, NMB, Murrells Inlet, Georgetown, Pawleys, Little River, Conway |
| `marine-chs` | Charleston Harbor | Charleston area marine |
| `marine-national` | Blue Water | Yacht crew (Fort Lauderdale etc.), federal ships (NOAA, MSC), towing, ferries — **no cruise lines** |
| `ai-web` | AI & Web | Entry-level/junior remote web, AI training/annotation gigs, automation, freelance clients |
| `tech-sales` | Tech Sales | Remote SDR/BDR, full-time brand ambassador / retail tech |
| `quick-cash` | Quick Cash | Valet, event/demo gigs, marina day work, boat detailing, yacht day work |

Classification: the query/company that found a job sets its track; fall back to keyword + location rules.

## 5. Feed sources (scripts/sources/*.mjs, each exports `async fetch(ctx) → Job[]`)

| Source | Use | Key |
|---|---|---|
| Adzuna US API | Local + Charleston + Fort Lauderdale marine, valet, sales, quick cash | yes |
| USAJOBS API | NOAA, Military Sealift Command, Army Corps / federal vessel jobs | yes |
| JSearch (RapidAPI, Google for Jobs) | Indeed/LinkedIn/ZipRecruiter listings, legally. ≤6 calls/run-day (free tier 200/mo) — rotate queries across runs | yes |
| Remotive, RemoteOK, Jobicy, Himalayas, Arbeitnow, We Work Remotely RSS | Remote AI/web/SDR | no |
| Company ATS APIs (Greenhouse, Lever, Ashby, Workday, SmartRecruiters) | Direct career sites | no |
| Page-watch (`ats: "page"`) | Career pages / yacht boards without an API: fetch, extract job-looking links, diff with last run (`data/pagewatch.json`), emit `page-changed` items | no |

Seed `config/companies.json` with (research the real ATS endpoints; drop any that can't be found):
- Marine: Safe Harbor Marinas, Brunswick / Freedom Boat Club, MarineMax, SpiritLine Cruises (Charleston harbor
  tours — allow-listed, not a cruise line), City Experiences (harbor tours/ferries only), Crowley, Sea Tow,
  Moran Towing, Edison Chouest, Kirby, Harbor Docking & Towing; yacht boards Yotspot, Crew Network, Cotton Crews,
  Bluewater, Dockwalk (page-watch).
- Brand ambassador / retail tech agencies: 2020 Companies, ActionLink, BDS Connected Solutions, and similar
  firms that staff tech demo/retail ambassador roles (e.g. Advantage Solutions, CROSSMARK, Mosaic, Premium
  Retail Services, SPAR, Acosta) → track `tech-sales` (part-time/event roles → `quick-cash`).

Each source: 15 s timeout, 1 retry, polite User-Agent, respects robots.txt for page-watch, failure isolated.

### Filtering & scoring (pure functions in `scripts/lib/`, unit-tested)
1. Drop: dismissed ids/urls/companies; `excludeCompanies` (Carnival, Royal Caribbean, Norwegian/NCL, Celebrity,
   Princess, Disney Cruise Line, MSC Cruises, Virgin Voyages, American Cruise Lines, Viking, Windstar, Lindblad,
   American Queen, UnCruise, Holland America, Oceania, Regent); title/description matching "cruise ship" or
   "cruise line" unless the company is allow-listed. "Military Sealift Command" must NOT match MSC Cruises.
2. `ai-web` / `tech-sales`: drop senior signals (senior, sr., lead, principal, staff, manager, director,
   "5+ years", "4+ years", "bachelor's required", "degree required").
3. Dedupe by id, then by normalized company+title+city.
4. Score 0–100: track keyword fit (deckhand, dockhand, mate, boat, marina, yacht, valet, brand ambassador,
   demo, SDR, BDR, AI trainer, web, automation…) + entry-level signals + pay listed + recency − distance/
   credential gaps. Add credential flags when text mentions TWIC, MMC/merchant mariner, ENG1/STCW medical, drug test.

## 6. Web app screens (full voyage theme)

Dark navy + brass, nautical display face + clean body face, subtle wave motion (respects reduced-motion).
Mobile-first; bottom tab bar on phone, top tabs on desktop.

1. **The Helm (home)** — weekly goal gauge (applications this week / 10, Mon–Sun), streak of weeks at goal,
   total applied, interviews, **Overdue hails** (stage Cast Off, ≥7 days since applied/last follow-up),
   **Next 3 headings** (soonest `nextDue`), new-catch counts per track since last visit, Fort Lauderdale
   International Boat Show countdown (Oct 28 – Nov 1, 2026; "arrive early for day work").
2. **Crow's Nest (feed)** — track filter chips with counts, sort by score/newest, search box, "new" badge,
   source health footer (last run, per-source ok/error). Card actions: **Save** (→ Dockside), **Applied**
   (→ Cast Off, today), **Dismiss** (reason picker: quick chips, optional note → dismissed.json).
   Saved/applied/dismissed jobs disappear from the feed. "Refresh now" triggers the workflow (token needed).
3. **The Voyage (pipeline)** — columns Dockside → Cast Off → Hailed → Boarding → Hired / Lost at Sea.
   Desktop drag-and-drop; tap card → detail sheet with stage buttons (touch). Detail sheet edits all
   tracker fields, Mark followed-up, requirement checkboxes, delete. "+ Add job" for manual entries.
4. **Ship's Papers (requirements)** — global checklist showing which jobs each item unlocks, with plain
   guidance: ENG1 = yacht crew (MCA-approved doctor, Fort Lauderdale); USCG MMC + medical certificate =
   NOAA/MSC/US-flag commercial; TWIC + drug test = many local/Charleston passenger vessels. Items: Doctor
   visit, ENG1, USCG MMC + medical cert, TWIC, Drug test ready, Sea service letter (Pinecrest Marina),
   Resume (marine) ✓, Resume (tech sales), Resume (AI/web) .
5. **Settings** — GitHub token (fine-grained, this repo only: Contents RW + Actions RW), weekly goal,
   export / import JSON, sync status.

Sync: load tracker.json + dismissed.json via Contents API on open; save debounced 1.5 s with the file
`sha`; on 409 conflict re-fetch, merge by job id (newer `updatedAt` wins), retry once. Always mirror to localStorage.

## 7. Pre-loaded data (tracker.json seed, all stage Dockside)

Home Waters: Freedom Boat Club Grand Strand (NMB, 2120 Sea Mountain Hwy, 843-732-3777, dock crew); Safe Harbor
Marinas Pawleys Island (dockhand $17–18/hr); Barefoot Queen Riverboat NMB (server/deckhand); Crazy Sister
Marina Murrells Inlet (walk in); CCU Boat Operations Georgetown (ask about deckhand); Myrtle Beach Fire Dept
(firefighter/EMT, Ocean Rescue boats, firerecruiting@cityofmyrtlebeach.com); Horry County Fire Rescue Marine
Rescue & Dive; Coast Guard Auxiliary local flotilla (volunteer crew training).
Charleston Harbor: SpiritLine Harbor Cruises (deckhand); Dewees Island Ferry (mate); Schooner Pride (360 Concord
St, crew); Charleston Fire Dept Marine Team (paid recruit school); Indeed deckhand Charleston search link.
Blue Water: NOAA OS/GVA (marinerhiring.noaa.gov); Military Sealift Command entry level (sealiftcommand.com);
The Crew Network; Cotton Crews; Yotspot delivery crew. (American Cruise Lines removed — cruise.)
Tech Sales: Indeed remote no-experience SDR search; Remote Rocketship entry-level SDR.
Plus all URLs/phones from Luke's original prompt.

## 8. Testing

- `node --test` for pure logic: fetcher filter/score/dedupe/cruise rules (fixtures), app week/streak/overdue math.
- Fetcher dry run locally with `--dry` (keyless sources live; keyed sources skipped if no env).
- One Playwright pass on desktop + 390px width before handoff.

## 9. Build split (usage-conscious)

Claude: spec, plan, review, integration, browser check, GitHub setup/deploy.
Codex (`codex exec`): Task A = fetcher + workflow + configs (with web research of ATS endpoints);
Task B = web app. They share only the contracts in §3, so they run in parallel.

## Out of scope
Auto-applying, emailing employers, scraping Indeed directly, accounts/auth beyond the GitHub token.
