---
description: Weekly browser sweep for jobs the feed robot can't reach (Indeed, yacht boards, local listings)
---

You are doing Luke's weekly job sweep for Crow's Nest. The GitHub Action already pulls Adzuna, USAJOBS,
JSearch (Google for Jobs), remote boards and company career APIs 3×/day. Your job is to find what it
misses, using Claude in Chrome in Luke's own browser at a normal human pace. Be usage-conscious:
read search-result lists, don't open every listing. Aim for ~15 searches and stop.

## Before searching
1. `git pull` in ~/crows-nest.
2. Read `data/dismissed.json` (skip anything matching; learn from the reasons), `data/tracker.json`
   (skip jobs he already tracks) and the titles/companies in `data/feed.json` (skip duplicates).
3. Read `docs/superpowers/specs/2026-10-15-crows-nest-design.md` §1 and §4 for who Luke is and the 6 tracks.
   Hard rules: no cruise ships or cruise lines; no senior or high-experience tech roles.

## Where to look (results posted in the last 7 days)
- Indeed: deckhand / dockhand / marina / boat captain trainee in Myrtle Beach SC, Murrells Inlet, North Myrtle
  Beach, Charleston SC, Fort Lauderdale FL; valet + brand ambassador in Myrtle Beach; remote entry-level SDR;
  remote AI trainer / data annotation.
- Yacht crew: Yotspot (deck, delivery crew), The Crew Network, Cotton Crews, Bluewater, Dockwalk classifieds,
  daywork posts for Fort Lauderdale (boat show is Oct 28 – Nov 1 each year: look harder in October).
- Local: Craigslist Myrtle Beach + Charleston (jobs › marine/transport, general labor, sales), marina and
  charter websites in Murrells Inlet / NMB / Charleston with "now hiring" pages.
- Freelance AI/web leads: local businesses in Myrtle Beach / Charleston with outdated or missing websites or
  no online booking (charters, marinas, detailers, realtors). Add as track `ai-web`, title
  "Freelance lead: <business> — <what to pitch>".
- If Luke is logged in to LinkedIn or Facebook, also check LinkedIn Jobs and local Facebook job groups.
  Never log in for him or enter any credentials.

## Recording results
Append each new find to `data/sweep.json` `items` (keep earlier items from the last 30 days, drop older):
`{ "title", "company", "location", "remote": bool, "pay": "", "url", "postedAt": ISO|null,
   "snippet": "≤240 chars why it fits", "source": "sweep", "trackHint": one of the 6 track ids }`.
Set `sweptAt` to now. Then run `npm test`, commit `data/sweep.json` ("sweep: weekly browser sweep"),
`git push`, and `gh workflow run feed.yml` so the finds show up in the feed in ~2 minutes.

## Report to Luke
A short summary: how many new jobs per track, the 3 best with one line each on why, and anything that
needs him (e.g. a walk-in, a phone call, a credential a good job requires).
