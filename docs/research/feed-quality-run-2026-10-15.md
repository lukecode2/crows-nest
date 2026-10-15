# Feed quality final local run — 2026-10-15

`npm test`: 83 passed, 0 failed. `npm run feed`: completed successfully. No git commit created.

Generated at: 2026-10-15T21:33:16.501Z. 164 feed jobs; 405 full-catch records.

## Track counts and top eight titles

| Track | Count |
|---|---:|
| marine-local | 0 |
| marine-chs | 2 |
| marine-national | 18 |
| ai-web | 11 |
| tech-sales | 53 |
| quick-cash | 80 |

### marine-local

No qualifying jobs in this run.

### marine-chs

- Captain - Marine | $5k SIGN ON BONUS | RELO AVAILABLE — Republic Services
- Lead Dockhand — City of Charleston

### marine-national

- Experienced AB Tugboat Deckhand at Curtin Maritime Long Beach, CA — Curtin Maritime
- Deckhand – Inland Barge Fleet Hour Shifts — Ingram Barge Company
- MARINE DECKHAND - TRAVEL REQUIRED — Dredgit Corporation
- Freedom Boat Club Greater Boston and Cape Cod Jobs — Brunswick Corporation (Freedom Boat Club)
- Offshore Deckhand — Ingram Barge Company
- VV - DECKHAND; OS​/AB — Ismira
- Steward, Olive & Sea - Hilton Fort Lauderdale Marina — Hilton
- Oiler-Deckhand (DR) — U.S. Army Corps of Engineers

### ai-web

- Artemis AI Data Rater - German — Welo Global
- Freelance Graphic Designer (Reviewer) - AI Training — HumanSignal
- AI Trainer — iMerit Technology
- Full-Stack E-commerce Developer with Sage X3 Experience — Toptal
- Full Stack Developer — Typeform
- AI Trainer Image QA Evaluator — iMerit Technology
- Digital Marketing & Google Ads / AI Search Specialist — Logicstics
- Web Designer, eCRM — Humane World for Animals

### tech-sales

- Retail Sales Associate (Seasonal)-HWY 17-$13/hr — New Balance
- (US) Sales Development Representative (6 month contract) — PointClickCare
- (US) Sales Development Representative — PointClickCare
- Retail Sales - Part Time — Lowe's
- Retail Sales Associate — Journeys
- Seasonal Retail Sales Associate — DICK's Sporting Goods/Golf Galaxy
- Seasonal Retail Sales Associate — DICK'S Sporting Goods
- Sales Development Representative — Controlled Holdings

### quick-cash

- Event Coordinator - Myrtle Beach — Marriott Vacations Worldwide
- Event Staff Team Member - John T. Rhodes Myrtle Beach Sports Center — The Sports Facilities Companies
- Valet Parking Attendant MUSC ( Afternoon Shift ) — Reimagined Parking
- Aerie - Brand Ambassador (Sales Associate) — American Eagle Outfitters
- AE - Brand Ambassador (Sales Associate) — American Eagle Outfitters
- AE - Sr Brand Ambassador (Sr Sales Associate) — American Eagle Outfitters
- Event Coordinator — Dave & Buster's
- Bellperson & Valet — Hilton Grand Vacations

## Count by dropReason

| Reason | Count |
|---|---:|
| cruise | 0 |
| senior | 156 |
| not-marine | 7 |
| far-shore-job | 15 |
| far-quick-cash | 3 |
| far-low-pay | 4 |
| dismissed | 0 |
| tracked | 0 |
| duplicate | 56 |
| excluded-keyword | 0 |
| null (expiry/feed cap) | 0 |

## Source results

| Source | Result |
|---|---|
| adzuna | missing key |
| usajobs | missing key |
| jsearch | missing key |
| remotive | 60 jobs |
| remoteok | 4 jobs |
| jobicy | 45 jobs |
| himalayas | 4 jobs |
| arbeitnow | 2 jobs |
| wwr | 83 jobs |
| ats | 33 jobs |
| pagewatch | 0 jobs |
| sweep | 0 jobs |
| govjobs | 3 jobs |

## Verification lists

78 new company career-page entries verified; 136 research entries skipped; five already configured. Two government feeds verified (Georgetown County RSS and City of Charleston Workday), ten government targets skipped. All names, URLs and skip reasons are in [the verification report](verification-2026-10-15.md), with machine-readable details in `config/companies.json` and `config/govfeeds.json`. The CLI also prints the complete lists.

Page-watch logged a transient fetch failure for SC Ports during this run; the remaining employers completed. The page was reachable during curl verification. GovernmentJobs/NEOGOV, Dayforce and SmartRecruiters API robots restrictions were respected. New page-watch entries are baselined before emitting changes.

The optional Playwright browser check was attempted using the installed Chromium, but the process exited before a page could open (SIGTRAP / EPERM during cleanup). Browser validation remains unverified in this environment.

The marine title gate remains literal. Firefighter-only and water-instructor jobs can be collected by government feeds, then rejected as `not-marine`; see the verification report for the section A/E conflict.
