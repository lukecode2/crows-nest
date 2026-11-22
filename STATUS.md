# Status — updated 2026-11-22

## Where it stands
- 2026-11-22: weekly check done. SimplyHired re-saved from the Mac (72 jobs). Hand-picked **top5.html** page (linked from
  the header): NPS Deckhand (closes 11/23), ARS NMB lead generator, RoadRunner SDR, HGV Ocean 22 valet, Zodiac boat assembly.
  Every link checked live. Ferguson MB has expired; FedEx/Ingram Learn4Good links are dead (410). Redo top5.html each week.
- Feed runs 3x a day on GitHub Actions; site live at https://lukecode2.github.io/crows-nest/.
- 2026-11-16: weekly sweep done (SimplyHired; 7 finds in `data/sweep.json`). Marine is quiet off-season.
- 2026-11-16: **new source `simplyhired`** (carries Indeed's listings; 19 searches in `config/searches.json`).
  Trial run kept 26 jobs. Every sweep find was there and missing from the feed.
- 2026-11-16: site simplified: tabs are Home / Jobs / My Jobs / Places to Call / Certificates / Settings;
  plain track and stage names (stage ids unchanged); Jobs opens on "top 10"; cards have Save / Applied / Not for me.
- Filter fixes: "Lead Generator" isn't senior; an SDR selling to car dealers isn't an "automotive" career.
- Office & Gov Sales track + watchlist (2026-11-12). Luke applied to Carahsoft Gov Account Rep + Digital Media Coordinator.

## Next
- SimplyHired blocks GitHub (403), so the robot uses `data/simplyhired.json` saved from the Mac (`npm run simplyhired:save`,
  good for 3 days). Live 2026-11-16: 25 SimplyHired jobs on the site. Open: make it a daily launchd job on the Mac
  (needs Luke's OK + watch.json entry), or keep running it at each weekly sweep.
- Top-10 ranking puts Call of the Sea first although its deadline (Nov 15) passed; pagewatch deadlines aren't read.
- CHECKLIST.md sections 3, 4 (other sources) still open; Office Assistant/admin jobs (e.g. City of Myrtle Beach) are
  "off-track". Ask Luke if he wants plain office admin jobs.

## Open questions
- Can't watch: CDW (Cloudflare bot check), ThunderCat (Word docs + email to HR).
- Carahsoft job pages list no city; the robot marks them "ask if remote".

## Tool idea to tell Luke about (added 2026-11-19, NOT installed)
- **JobSpy** (github.com/speedyapply/JobSpy, ~4.8k stars, active): one Python call scrapes Indeed, LinkedIn,
  ZipRecruiter and Glassdoor. Might replace the SimplyHired Mac-save workaround (GitHub gets a 403) and add
  LinkedIn jobs. It's Python and this repo is Node, so it would run as a small side script that writes JSON.
- Agents: mention this to Luke the next time he works here. Don't install it without his OK. First step: run it
  once from GitHub Actions and see whether Indeed blocks it there too.
