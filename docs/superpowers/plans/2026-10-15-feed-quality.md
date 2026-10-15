# Feed quality round 2 — brief for Codex

Context: `docs/superpowers/specs/2026-10-15-crows-nest-design.md`. Luke is ENTRY-LEVEL in everything, lives in
Myrtle Beach SC. Do NOT git commit. TDD: every rule gets tests in `tests/fetcher/` using the example titles
below; keep all existing tests passing (update any old test whose expectation these rules intentionally change).

## A. Relevance and seniority (scripts/lib/filter.mjs)

1. **Marine title gate.** A job on track marine-local / marine-chs / marine-national is DROPPED unless its TITLE
   matches (word boundaries, case-insensitive): deck ?hands?, dock ?hands?, deck crew, boat(s|ing)?, marina, marine,
   maritime, yacht(s|ing)?, vessel, seaman, mariner, ferry, tug(boat)?, barge, ship(yard)?, sailing, sailor, charter,
   harbou?r, able seaman, \bAB\b, \bOS\b, wiper, oiler, stew(ard|ardess)?, day ?worker, ocean rescue, lifeguard,
   captain ONLY with boat|marine|vessel|charter|tug|ferry|yacht|fishing in the title. Always drop titles with
   banker|landfill|physician|surgeon|nurse|architect|banquet|catering.
   DROP: "Physician Emergency Medicine - Competitive Salary", "Banquet Captain - The Sanctuary (Part-Time)",
   "Architectural Job Captain-Charleston", "Universal Banker Part Time 20 hrs Mathis Ferry",
   "Equipment Operator II - Bees Ferry Landfill", "CATERING SENIOR CAPTAIN (ON CALL)".
   KEEP: "Deckhand – Inland Barge Fleet Hour Shifts", "Captain - Marine | $5k SIGN ON BONUS", "VV - DECKHAND; OS/AB",
   "Boat Captain", "Dock Hand", "Yacht Stewardess", "Oiler-Deckhand (DR)".
2. **Seniority on every track.** Title matching \b(vp|vice president|director|general manager|head of|chief|president|
   owner|partner)\b or \bmanagers?\b is senior on every track, unless the title contains "assistant".
   "Lead Deckhand" stays NOT senior on marine. Keep the existing ai-web/tech-sales rules and add for those two tracks:
   roman levels \b(II|III|IV)\b, and engineers? (plural too) unless junior|entry|associate|intern|apprentice|trainee|trainer.
   DROP: "VP, Yacht Charters", "Yacht Closing Manager", "Marina General Manager (Aventura)", "Head of Crew Placement",
   "Yacht Safety Manager", "Marina Admin Manager - Charleston Harbor", "Applied AI Engineers for telecommunications
   company", "Salesforce Developer III". KEEP: "AI Trainer", "Web Developer (Fresh graduate welcome, WFH policy)".

## B. Distance rule (new scripts/lib/region.mjs + pay parsing)

- `inHomeRegion(location)`: true for "Remote", and for locations in SC counties Horry, Georgetown, Charleston, Berkeley,
  Dorchester, Colleton, Williamsburg, Marion, Florence, or NC counties Brunswick, Columbus, New Hanover, Pender; or any
  city in those (Myrtle Beach, North Myrtle Beach, Conway, Carolina Forest, Surfside, Garden City, Murrells Inlet,
  Pawleys Island, Georgetown, Little River, Loris, Aynor, Charleston, North Charleston, Mount Pleasant, Summerville,
  James Island, Johns Island, Daniel Island, Isle of Palms, Folly Beach, Kiawah, Goose Creek, Moncks Corner, Hanahan,
  Ladson, Wilmington, Shallotte, Calabash, Southport, Leland, Whiteville, Tabor City). Adzuna locations look like
  "Carolina Forest, Horry County"; USAJOBS like "Wilmington, North Carolina"; JSearch like "Charleston, South Carolina".
- `parsePay(pay)` → `{ hourlyMax, annualMax } | null` from strings like "$28.86–$33.62/Per Hour", "$40,000–$55,000/year",
  "$18–$25/hour", "$13/hr", "$55,602–$72,285/Per Year" (annual = hourly × 2080 and vice versa).
- `isHighPay(pay)`: hourlyMax ≥ 24 or annualMax ≥ 50000.
- `isLiveAboard(title)`: deck ?hand|\bAB\b|\bOS\b|able seaman|ordinary seaman|wiper|oiler|\bmate\b|yacht crew|stew|
  tug|barge|offshore|vessel|ship|mariner|seaman|delivery crew|day ?worker|crew member — and NOT dock ?hand|fueler|
  boatcierge|instructor|technician|mechanic|sales|club|dealership|service writer|valet|front desk|call center.
- `lowWageShore(title)`: dock ?hand|fueler|boatcierge|attendant|associate|cashier|valet|cleaner|porter|detailer|
  instructor|host|server|clerk|merchandiser|ambassador|technician (when not senior).
- **Rule** (applied in applyFilters after track is set; jobs outside the home region only):
  - quick-cash: drop.
  - marine-*: keep if isLiveAboard(title) or isHighPay(pay). Otherwise, if pay is empty AND not lowWageShore(title),
    keep with flag `pay-unknown`. Otherwise drop (reason `far-shore-job`).
    Example DROP: "Freedom Boat Club - Dock Hand at Lighthouse Point" (Lighthouse Point, FL), "Freedom Boat Club -
    Part-Time Boat Fueler at Venice", "Freedom Boat Club - Boating Instructor at Bald Ridge" (Cumming, GA),
    "Freedom Boat Club - Part-Time Boatcierge at Marco". KEEP: "Deckhand – Inland Barge Fleet" (Illinois),
    "Deckhand (Dual Rate)" $30.14–$46.16/hr (Portland, Oregon), "Yacht Deckhand" (Fort Lauderdale).
    KEEP local: "Freedom Boat Club - Dock Hand" in Myrtle Beach.
  - tech-sales / ai-web: if not remote, keep only if isHighPay(pay), or pay empty and not lowWageShore → flag
    `pay-unknown`. "Sales Development Representative | Mundelein, Lake County" with no pay → keep flagged? NO: SDR is
    entry sales; treat titles matching sales development|business development rep|\bSDR\b|\bBDR\b|retail as lowWageShore
    for this rule → dropped.
  - Add flags `far-away` to every kept out-of-region job, `live-aboard` when isLiveAboard, `high-pay` when isHighPay.
  - Far-away marine jobs that pass get track `marine-national`.
- UI: in `js/` add display labels for new flags (far-away "Far away", live-aboard "Live aboard", high-pay "High pay",
  pay-unknown "Pay unknown") wherever flag chips are rendered; high-pay uses the good color, pay-unknown muted.

## C. Duplicates and persistence

- Collapse duplicates across locations: same normalized company + title (lowercase, strip punctuation, strip trailing
  " - <city>" / "(<city>)" / " at <place>"). Keep highest score (then newest); `location` = "<first> (+N more)",
  add `otherLocations` (max 10). E.g. 5× "AE - Brand Ambassador (Sales Associate)" at American Eagle → 1.
- In `scripts/fetch-feed.mjs`, previous feed jobs are re-run through every filter each run (dismissed, tracked, all
  gates) so rule changes clean old jobs out. Runner test for it.

## D. Full catch log for AI review

- Each run writes `data/all-jobs.json`: `{ generatedAt, about: "Every job the robot saw this run, kept or not.
  Give this file plus docs/review-prompt.md to any AI to find good jobs the filters missed.", jobs: [{ id, title,
  company, location, pay, url, source, track, kept: bool, dropReason: "cruise|senior|not-marine|far-shore-job|far-quick-cash|far-low-pay|dismissed|tracked|duplicate|excluded-keyword|null", snippet ≤160 chars }] }`.
  Cap 2500 newest; commit it in the workflow (`git add` it next to feed.json).
- Write `docs/review-prompt.md`: a ready-to-paste prompt for any AI that explains who Luke is (from spec §1 + the
  distance rule above + no cruise ships + entry level), says to read `data/all-jobs.json` (raw URL
  https://raw.githubusercontent.com/lukecode2/crows-nest/master/data/all-jobs.json) focusing on `kept:false` jobs,
  and to return a shortlist table: title | company | location | pay | why it's worth a look | url.

## E. More local coverage

1. **Research files** in `docs/research/` (Grand Strand, Charleston, Florida — written by Perplexity). Parse them and:
   - Create `config/local-employers.json`: every employer listed `{ name, town, region: "grand-strand"|"charleston"|
     "florida"|"national", type, url, hiringMethod, contact, track }` (contact only if it's a business phone/email).
   - For every employer with a real careers/jobs page URL, add a `config/companies.json` entry (`ats` detected
     properly — greenhouse/lever/ashby/workday/smartrecruiters/paycom/etc. where you can verify an API — else
     `"page"`). VERIFY each with one live request; respect robots.txt; skip dead ones (list in `_skipped`). Set
     `track` by region (grand-strand → marine-local, charleston → marine-chs, florida/national → marine-national).
   - Do not invent URLs. Do not add cruise lines.
2. **Government job feeds** (new source `scripts/sources/govjobs.mjs`): find and verify machine-readable feeds (NEOGOV /
   governmentjobs.com RSS or JSON, or other) for: City of Myrtle Beach, City of North Myrtle Beach, Horry County,
   Georgetown County, City of Charleston, Charleston County (incl. Parks), City of North Charleston, Town of Mount
   Pleasant, State of South Carolina (jobs.sc.gov, filter to Horry/Georgetown/Charleston/Berkeley/Dorchester counties),
   SC Ports Authority, SCDNR. Config in `config/govfeeds.json`. Keep only titles matching marine/boat/harbor/lifeguard/
   ocean rescue/park ranger/dock/water/valet/event/firefighter/seasonal keywords or any marine-gate keyword; no
   trackHint (classifier decides; firefighter/lifeguard/ocean rescue → marine-local if Grand Strand, marine-chs if
   Charleston area). Skip any you can't verify, list them in the config's `_skipped`.
3. **JSearch local priority** (scripts/sources/jsearch.mjs): of the 2 calls per run, call #1 rotates through queries
   whose track is marine-local/marine-chs/quick-cash; call #2 rotates through the rest. Add these queries to
   `config/searches.json` jsearch: "deckhand OR dockhand OR boat crew Myrtle Beach SC", "marina jobs Murrells Inlet SC",
   "boat captain jobs Myrtle Beach SC", "deckhand OR mate Charleston SC", "marina dockhand Charleston SC",
   "yacht crew live aboard Fort Lauderdale". For ai-web and tech-sales queries pass
   `job_requirements=no_experience,under_3_years_experience`. Update the rotation test.

## Finish
`npm test` all pass. Then `npm run feed` locally (keyed sources report missing key — fine; existing feed jobs get
re-filtered) and print: per-track counts, top 8 titles per track, count by dropReason, and a list of new companies /
gov feeds verified vs skipped. Short summary at the end.
