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
- [ ] Home area = Myrtle Beach / Grand Strand (Horry, Georgetown, Brunswick NC). Charleston only if high pay **or** housing/live-aboard included
- [x] "High pay" lowered to $20/hr or $41,600/yr (Luke, 2026-11-11)
- [ ] Block retail store jobs (cashier, sales associate, stocker, merchandiser) **except** brand ambassador / promo / demo roles inside stores
- [ ] Re-check the far-region rule (Florida, Wilmington, etc.) still matches "Charleston max unless housing"
- [ ] ★ Add "housing included" detection (housing provided, live-in, room and board, crew quarters) as a flag and a score boost
- [ ] Run the review prompt on `data/all-jobs.json` to catch good jobs being wrongly dropped

## 3. More tailored to Luke
- [ ] Re-weight the match score toward: marine/boat work, brand ambassador, local quick-start cash, AI training, web work
- [ ] ★ "Why this matches you" line on each card (e.g. "Uses your helm hours", "Brand ambassador like 2020 Companies")
- [ ] ★ Learn from dismissals: if Luke dismisses many of one kind, lower that kind's score
- [ ] ★ Hide jobs needing licences he doesn't hold, but show a "get this cert to unlock N jobs" note in Ship's Papers

## 4. Find jobs that aren't on the big boards
- [ ] ★ Local employer career pages (marinas, charters, SpiritLine, Barefoot Landing, resorts, event companies) watched for changes — extend `config/local-employers.json`
- [ ] ★ Brand-ambassador agency job feeds (Advantage, CROSSMARK, Mosaic, Prestige, Push, BDS, 2020 Companies) via their ATS (Workday/iCIMS/Greenhouse)
- [ ] ★ More ATS types for small local firms: BambooHR, Paylocity, Paycom, Breezy, Workable, JazzHR
- [ ] ★ City/county/state jobs: Horry County, Myrtle Beach, North Myrtle Beach, SC state jobs, SCPA, Coastal Carolina University staff jobs
- [ ] ★ Myrtle Beach Area Chamber + SC Works job boards
- [ ] ★ Craigslist RSS (Myrtle Beach + Charleston) with strict spam filter
- [ ] ★ Yacht crew agencies and Dockwalk/crew boards for live-aboard roles
- [ ] ★ Google Jobs results (via the existing RapidAPI JSearch key) with local-only queries
- [ ] ★ Weekly browser sweep for Facebook groups / Reddit r/MyrtleBeach "hiring" posts (can't be automated reliably)
- [ ] Use the outside-the-box skill for one brainstorm pass on extra sources

## 5. Brighter look, new colour palette
- [ ] Pick a new palette (bright coastal: sand, sea-glass, sunset coral, navy text) — show Luke 2–3 options first
- [ ] Add a light theme as default, keep dark as an option
- [ ] Bigger, clearer job cards on phone; less nautical jargon in labels

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
