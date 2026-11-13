# Crow's Nest fix-up checklist (temporary, started 2026-11-11)

Delete this file once everything is ticked. ★ = my idea, not from Luke's list.

## 1. Phone alert shows a job the site doesn't have
Cause found: `scripts/fetch-feed.mjs` sends the phone alert *before* the new feed is committed,
pushed and published by GitHub Pages (1–10 min later). Tapping right away shows the old feed. If the
push fails, the job never shows up at all.
- [x] Send the alert as its own workflow step *after* the push succeeds (`.github/workflows/feed.yml`)
- [x] Wait for the Pages deploy before alerting, and link the alert to the job itself (`#job=<id>`)
- [x] Site: open and highlight the job from that link; if it's not loaded yet, say "updating, try again in a minute"
- [x] Make sure filters (track chip, search, "new only") can't hide an alerted job; reset them when opened from an alert
- [x] ★ Keep a small "Recent alerts" list on the site so every ping can be found later, even if the job was dropped

## 2. Relevance: location and job rules
- [x] Home area = Myrtle Beach / Grand Strand (Horry, Georgetown, Brunswick NC). Charleston only if high pay **or** housing/live-aboard included
- [x] "High pay" lowered to $20/hr or $41,600/yr (Luke, 2026-11-11)
- [x] Block retail store jobs (cashier, sales associate, stocker, merchandiser) **except** brand ambassador / promo / demo roles inside stores
- [x] Re-check the far-region rule (Florida, Wilmington, etc.) still matches "Charleston max unless housing"
- [x] ★ Add "housing included" detection (housing provided, live-in, room and board, crew quarters) as a flag and a score boost
- [x] Run the review prompt on `data/all-jobs.json` to catch good jobs being wrongly dropped

## 3. More tailored to Luke
- [ ] Re-weight the match score toward: marine/boat work, brand ambassador, local quick-start cash, AI training, web work
- [ ] ★ "Why this matches you" line on each card (e.g. "Uses your helm hours", "Brand ambassador like 2020 Companies")
- [ ] ★ Learn from dismissals: if Luke dismisses many of one kind, lower that kind's score
- [ ] ★ Hide jobs needing licences he doesn't hold, but show a "get this cert to unlock N jobs" note in Ship's Papers

## 4. Find jobs that aren't on the big boards
- [ ] ★ Local employer career pages (marinas, charters, SpiritLine, Barefoot Landing, resorts, event companies) watched for changes — extend `config/local-employers.json`
- [x] ★ Brand-ambassador agency job feeds (Advantage, CROSSMARK, Mosaic, Prestige, Push, BDS, 2020 Companies) via their ATS (Workday/iCIMS/Greenhouse)
- [~] ★ More ATS types for small local firms: BambooHR, Paylocity, Paycom, Breezy, Workable, JazzHR (BambooHR, iCIMS, Oracle, SmartRecruiters, Phenom done 2026-11-11; Paylocity/Paycom/Breezy/Workable/JazzHR not yet. Zipfizz posts on JazzHR at zipfizzcorporation.applytojob.com)
- [~] ★ City/county/state jobs: Horry County, Myrtle Beach, North Myrtle Beach, SC state jobs, SCPA, Coastal Carolina University staff jobs (some gov feeds added 2026-11-11; check which landed)
- [ ] ★ Myrtle Beach Area Chamber + SC Works job boards
- [ ] ★ Craigslist RSS (Myrtle Beach + Charleston) with strict spam filter
- [ ] ★ Yacht crew agencies and Dockwalk/crew boards for live-aboard roles
- [ ] ★ Google Jobs results (via the existing RapidAPI JSearch key) with local-only queries
- [ ] ★ Weekly browser sweep for Facebook groups / Reddit r/MyrtleBeach "hiring" posts (can't be automated reliably)
- [ ] Use the outside-the-box skill for one brainstorm pass on extra sources

## 5. Brighter look, new colour palette
- [x] Apply Luke's chosen Signal Flags palette: light background, white cards, navy text, royal blue actions and yellow alerts (2026-11-11)
- [x] Make the site light throughout, preserving the existing layout, fonts and behaviour
- [ ] Bigger, clearer job cards on phone; less nautical jargon in labels

Palette status (2026-11-11): all CSS colours use shared tokens; track chips, browser chrome, favicon and decorative waves match the light theme. All 163 tests pass. Text/track contrast is at least 4.5:1, with control edges above 3:1 and navy on yellow at 8.77:1. Next: visually review Nest, Helm, Voyage, Harbor and Settings at 390px and 1280px with `?sample=1`; screenshots could not be captured here because Chrome, Chromium and WebKit crash at launch, including the local HTTP server fallback. No open palette decisions. Changes left uncommitted as requested.

## 6. Simpler to use
- [ ] Rename tabs to plain words (Jobs, Saved, Applied, Directory, Settings)
- [ ] Fewer buttons per card: Save / Applied / Not for me (Pitch moves into a menu)
- [ ] One-tap "Show me the best 10 today" view at the top
- [ ] ★ Plain-English empty states and counts

## 7. Housekeeping
- [ ] ★ Add CLAUDE.md + STATUS.md (project has neither)
- [ ] ★ Fix open items from last audit: pagewatch yacht jobs without qualifications text; Adzuna hourly fix check
- [ ] ★ Weekly sweep is overdue (last 2026-10-16)
- [ ] `npm test` passes, then live check on phone after each push

## Office & Gov Sales track 2026-11-12 (after the missed Carahsoft jobs)
Why missed: Carahsoft runs its own careers site (no job system), its job pages list no city (home page says Reston HQ + some remote), and the feed had no track for account rep / marketing / digital media coordinator jobs.
- [x] New `office` track ("Office & Gov Sales" chip): gov/inside sales, account rep/coordinator, marketing, digital media, proposal/contracts coordinator. Kept only near home or remote.
- [x] Remote fix: a job whose description says remote (fully remote, work from home, telework eligible, "(Remote)" location) counts as remote; hybrid/on-site wording wins.
- [x] Searches: 5 JSearch + 4 remote-board queries for office jobs.
- [x] Watchlist (`"watch": "office"` in config/companies.json): Carahsoft (new `carahsoft` reader), TD SYNNEX/DLT, Arrow/immixGroup, GuidePoint, Trace3, OpenGov, Axon. Skipped ones listed in `_skipped`.
- [x] Own report: every run writes `data/office-watch.json` + `docs/office-report.md` (Carahsoft far jobs shown as "ask if remote").
- [x] Bug: cruise block "ncl" matched "incl." in company names; now whole words only.
- [ ] More watchlist companies: SHI, CDW-G, Connection, Iron Bow, ThunderCat have no readable job system (page-watch or skip).

## Done 2026-11-11 (session notes)
- Fake/expired audit of all 148 site jobs: 7 expired, 14 junk/commission-only. Fixed with general rules (SEO repost hosts, hidden/defunct employers, paid-review schemes, commission-only in full description, insurance recruiting) and a stronger link check.
- New location rules: near home = Horry, Georgetown, Marion, Brunswick NC, Columbus NC, remote. Charleston/Wilmington band only with $20+/hr or housing. Farther only with housing or live-aboard.
- New "direct" source reads employer career sites (Acosta, Advantage, Alignerr, Mercor, Tall Ships billet bank, McAllister, Ingram, Curtin…): +24 jobs in the trial run.
- Sources Codex job was stopped early (out of Codex quota), so it never wrote its report or its 15-job shortlist; its code was tested and merged.

## Missed-jobs check 2026-11-11 (hand search vs. robot)
Found by hand, not on the site: Hibu entry-level outside sales (Myrtle Beach), White Cap Accelerated Sales Program (Conway), FedEx seasonal courier (Myrtle Beach, $21.05/hr).
- Hibu: new `phenom` direct adapter (careers.hibu.com) + config entry. Verified live: 2 Myrtle Beach jobs kept.
- White Cap: Workday entry with per-city `searchTexts`; "City_ZIP" locations made readable; "Accelerated Sales Program" titles no longer count as senior; "one to two years" now reads as 1 year. Verified live: Conway job kept.
- FedEx: careers.fedex.com blocks bots (403). "courier" now counts as quick cash; Adzuna valet search also asks for courier; JSearch has a courier query. Not verified live (keys only in GitHub secrets).
- Bug fixed: locations ending ", US" (e.g. "Myrtle Beach, SC, US") were treated as far away.
- Dead ends: Sandpiper Productions (Workable, 0 open jobs), Beauty Barrage (needs beauty retail), Tidal Creek Brewhouse (needs 3-5 yrs beer sales), Big M Casino deckhand (listing gone).
