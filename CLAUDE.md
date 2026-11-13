# Crow's Nest

Luke's job-hunt dashboard. A robot (`scripts/fetch-feed.mjs`) pulls jobs from job boards, employer career
sites and government feeds, filters them to what fits Luke, and publishes them to a phone-friendly site.

- Live site: https://lukecode2.github.io/crows-nest/ (GitHub Pages, from `master`)
- Repo: github.com/lukecode2/crows-nest (private). **This project pushes to master** (Luke OK'd, 2026-11-13).
- Status / handoff: **STATUS.md**. Older fix-up list: CHECKLIST.md.

## How it works
- `.github/workflows/feed.yml` runs at 11:15, 17:15 and 23:15 UTC (plus "Run workflow" by hand). It runs
  `npm test`, then the feed, commits `data/*.json` + `docs/office-report.md`, then sends the phone alert (ntfy).
- Sources: `scripts/sources/*.mjs`. Employer career sites are listed in `config/companies.json`
  (`ats` = which job system: greenhouse, lever, ashby, workday, icims, phenom, carahsoft, vizi, page…).
- Filters / fit rules: `scripts/lib/filter.mjs`, `fit.mjs`, `region.mjs`, `classify.mjs`.
- Tracks: marine-local, marine-chs, marine-national, ai-web, tech-sales, office, quick-cash
  (site labels in `js/config.js`).
- Experience: sales/office jobs dropped only at 4+ years required (AI/web at 2+). Degree-required jobs stay, flagged "Degree asked" (Luke, 2026-11-13).
- Location rule: near home (Horry, Georgetown, Marion, Brunswick/Columbus NC) or remote. Charleston/Wilmington
  only with $20+/hr or housing. Farther only with housing or live-aboard.
- Office & Gov Sales watchlist: companies with `"watch": "office"`. Each run writes `data/office-watch.json`
  and `docs/office-report.md`.
- `data/all-jobs.json` = every job seen, kept or not, with the drop reason. Use it to find good jobs wrongly dropped.

## Run and test
- `npm test` (node --test, ~200 tests). Must pass before pushing.
- `npm run feed:dry` = trial run without saving. API keys (Adzuna, USAJobs, RapidAPI/JSearch, ntfy) live
  only in GitHub secrets, so those sources say "missing key" locally.
- Site preview: open `index.html?sample=1` through a local web server.

## Don't
- Don't hand-edit `data/feed.json`, `data/all-jobs.json`, `data/pagewatch.json`, `data/office-watch.json`
  or `docs/office-report.md`; the robot rewrites them.
- Sites the robot can't read go in `_skipped` in `config/companies.json` with the reason.
- Codex can't launch browsers on this Mac (crash dialogs); do browser checks with Claude in Chrome / Playwright.
- Job applications materials live in `~/Documents/Luke Job Folder/`, not here.
