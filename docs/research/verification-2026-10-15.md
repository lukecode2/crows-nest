# Feed quality coverage verification — 2026-10-15

Research inputs: `grand-strand-employers.md`, `charleston-employers.md`, and `florida-liveaboard-highpay.md` in this directory. HTTP checks used the Crow’s Nest bot identity, checked robots.txt, and followed only supplied URLs or links found on those pages. No messages or applications were sent.

219 research entries retained in `config/local-employers.json` (including job boards and named dock-walking venues). Uncertain contact numbers marked ⚠ in the research were omitted. American Cruise Lines and Viking Crew were excluded under the no-cruise/company rules. Blank URLs indicate the research supplied no URL.

78 new company entries have verified career pages; Canal Barge and City of Charleston have verified Workday JSON APIs. Five research entries are already covered by configured endpoints. 136 research entries were skipped for dead/blocked URLs, absent URLs, or lack of a real careers page. This does not mean an employer is not hiring. Page-watch cannot execute JavaScript and baselines new pages before announcing new links.

SmartRecruiters boards are kept as HTML pages when allowed. Its API robots.txt disallows this bot, so Ingram and SC Ports were not configured as API adapters. No Paycom API was verified; Vane Brothers uses its verified Paycom HTML careers page.

## New companies verified

| Employer | Region | Verified URL | Adapter |
|---|---|---|---|
| The Crew Network (TCN) – Fort Lauderdale | florida | https://www.crewnetwork.com/career-in-yachting/jobs-in-yachting/ | page |
| Crewfinders | florida | https://www.crewfinders.com/yacht-crew-job-positions.shtml | page |
| All Ocean Yachts | florida | https://www.buyexploreryachts.com/exploreryacht-crewjobs.shtml | page |
| Crew4Yachts | florida | https://www.meridiango.com/jobs | page |
| Northrop & Johnson | florida | https://www.northropandjohnson.com/crew-placement/crew-jobs | page |
| Luxury Yacht Group | florida | https://www.luxyachts.com/find-work | page |
| Hill Robinson | florida | https://hillrobinson.com/crew-employment | page |
| Insignia Crew | florida | https://insigniacrew.com/candidates/careers-hq/ | page |
| Magnolia Marine Transport | national | https://www.magnoliamarine.com/careers | page |
| Ingram Barge Company | national | https://careers.smartrecruiters.com/IngramBargeCompany | page |
| Canal Barge Company | national | https://canalbarge.wd5.myworkdayjobs.com/CBC | workday |
| Campbell Transportation Company | national | https://www.ctcmarine.com/careers/ | page |
| Crounse Corporation | national | https://www.crounse.com/careers/ | page |
| Parker Towing | national | https://www.parkertowing.com/careers | page |
| Vane Brothers | national | https://www.paycomonline.net/v4/ats/web.php/portal/2549D3747AFF851B44F885641C336D73/career-page | page |
| Broussard Brothers | national | https://broussardbrothers.com/careers/ | page |
| Carver Companies | national | https://www.carvercompanies.com/careers/ | page |
| Harbor Docking and Towing | national | https://harbordocking.com/careers/ | page |
| Orion Marine Construction | national | https://www.oriongroupholdingsinc.com/careers | page |
| Vulcan Materials | national | https://www.vulcanmaterials.com/careers | page |
| Foss Maritime | national | https://careers.saltchuk.com/ | page |
| SEACOR Marine | national | https://seacormarine.com/careers/ | page |
| Tidewater | national | https://www.tidewater.com/careers | page |
| Great Lakes Dredge & Dock | national | https://gldd.com/careers/ | page |
| Weeks Marine | national | https://kiewitcareers.kiewit.com/Weeks | page |
| Cashman Dredging | national | https://www.jaycashman.com/careers/ | page |
| Manson Construction | national | https://www.mansonconstruction.com/careers | page |
| Dutra Group | national | https://www.dutragroup.com/careers/ | page |
| Dredgit | national | https://dredgit.com/careers/ | page |
| Great Lakes Towing / Great Lakes Shipyard | national | https://www.greatlakesgroup.com/careers/ | page |
| NOAA Office of Marine and Aviation Operations | national | https://marinerhiring.noaa.gov/ | page |
| Scripps Institution of Oceanography | national | https://scripps.ucsd.edu/ships/jobs | page |
| Schmidt Ocean Institute | national | https://schmidtocean.org/education/careers-at-sea/ | page |
| UNOLS / U.S. Academic Research Fleet | national | https://www.unols.org/join-usarf | page |
| Washington State Ferries | national | https://wsdot.wa.gov/employment/our-people/ferries/ | page |
| NYC Ferry by Hornblower | national | https://www.ferry.nyc/careers/ | page |
| Casco Bay Lines | national | https://www.cascobaylines.com/about-us/career/ | page |
| Block Island Ferry / Interstate Navigation | national | https://www.blockislandferry.com/careers/ | page |
| Yacht StarShip | national | https://yachtstarship.com/careers/ | page |
| Fort Sumter Tours / SpiritLine Cruises (Aramark) | charleston | https://careers.aramark.com/ | page |
| Spirit of South Carolina | charleston | https://tallshipsamerica.org/billet-bank/ | page |
| Moran Towing | charleston | https://www.morantug.com/careers-at-moran/ | page |
| Colonial Group / Colonial Towing | charleston | https://jobs.dayforcehcm.com/en-US/colonialgroup/CANDIDATEPORTAL | page |
| O.E. DuRant | charleston | https://www.oedurant.com/About/Careers/ | page |
| C&M Dredging | charleston | https://cmdredging.com/careers/ | page |
| Great Lakes Dredge & Dock | charleston | https://gldd.com/careers/ | page |
| Weeks Marine | charleston | https://kiewitcareers.kiewit.com/Weeks | page |
| Cashman Dredging & Marine Contracting | charleston | https://www.jaycashman.com/careers/ | page |
| South Carolina Ports Authority | charleston | https://scspa.com/contact-us/careers/ | page |
| Newport News Shipbuilding / HII Charleston Operations | charleston | https://www.hii.com/careers | page |
| Detyens Shipyards | charleston | https://www.detyens.com/job-opportunities-at-detyens-shipyards/ | page |
| BAE Systems – Charleston Ship Repair | charleston | https://www.baesystems.com/en-us/careers | page |
| City of Charleston | charleston | https://www.charleston-sc.gov/1565/Employment-Opportunities | workday |
| Safe Harbor Marinas | charleston | https://safeharbor.com/careers/ | page |
| Suntex Marinas | charleston | https://suntex.com/careers/ | page |
| Shem Creek Marina | charleston | https://bowlinemarinas.com/careers/ | page |
| Clark Island Marina | charleston | https://www.clarkislandmarina.com/careers | page |
| Seabrook Island Club / Seabrook Island Marina | charleston | https://www.seabrookisland.com/careers/ | page |
| Kiawah Island Golf Resort / Kiawah Island Marina | charleston | https://kiawahresort.com/careers/job-listings/ | page |
| Wild Dunes Resort – waterfront/marina | charleston | https://www.wilddunesresort.com/resort/careers/ | page |
| Patriots Point Development Authority | charleston | https://www.patriotspoint.org/about/careers | page |
| Patriot’s Point Marina | charleston | https://patriotspoint.org/about/careers | page |
| Charleston Harbor Resort & Marina / Charleston Harbor Marina / Beach Club | charleston | https://www.charlestonharborresort.com/careers.htm | page |
| Longshore Boats | charleston | https://longshoreboats.com/career-opportunities | page |
| Ross Marine | charleston | https://www.rossmarine.com/careers | page |
| Charleston Outdoor Adventures | charleston | https://www.charlestonoutdooradventures.com/employment/ | page |
| Charleston Community Sailing | charleston | https://www.charlestoncommunitysailing.org/join-the-team | page |
| James Island Yacht Club | charleston | https://www.jiyc.org/Sailing/Junior_Sailing/Work_With_Us | page |
| South Carolina Aquarium | charleston | https://scaquarium.org/careers/ | page |
| Express Watersports / Express Dive Center | grand-strand | https://expresswatersports.com/work-at-express-watersports/ | page |
| Downwind Sails Watersports | grand-strand | https://www.downwindsailsmyrtlebeach.com/employment/ | page |
| Shoreline Watersports | grand-strand | https://www.shorelinewatersports.com/careers/ | page |
| Marine Service Center | grand-strand | https://www.scmarineservice.com/careers-jobs-employment-boats-dealership--xcareers | page |
| Marshall’s Marine | grand-strand | https://www.marshallsmarine.com/apply-to-join-us--xcareers | page |
| Horry County Fire Rescue – Marine/Dive | grand-strand | https://www.horrycountysc.gov/employment | page |
| Gulf Stream Boat Club | grand-strand | https://www.gulfstreamboatclub.com/careers/ | page |
| Safe Harbor Marinas | grand-strand | https://safeharbor.com/careers/ | page |
| Redline Powersports | grand-strand | https://redlinepowersports.hireology.careers/ | page |

## Already configured

| Employer | Region | Existing endpoint |
|---|---|---|
| Kirby Corporation | national | https://maritimecareers-kirbycorp.icims.com/jobs/search |
| Crowley | national | https://careers.crowley.com/jobs |
| Moran Towing | national | https://secure4.saashr.com/ta/6084283.careers?CareersSearch |
| Edison Chouest Offshore | national | https://www.chouest.com/jobs/index.html |
| Military Sealift Command | national | https://sealiftcommand.com/ |

## Research entries skipped

Reasons and individual HTTP results are also stored in `config/companies.json` → `_skipped`. HTTP 0 indicates a network/TLS/timeout failure, not a claim that the employer is closed.

| Employer | Region | Supplied URL | Reason |
|---|---|---|---|
| Yotspot | florida | https://www.yotspot.com/ | Unavailable or parked research URL (HTTP 403) |
| Crewbay | florida | https://www.crewbay.com/ | No accessible careers/jobs link found on supplied site |
| Dockwalk | florida | https://www.dockwalk.com/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| Crew Unlimited | florida | https://www.crewwunlimited.com/ | robots.txt disallows page or robots unavailable |
| Bluewater Yachting | florida | https://www.bluewateryachting.com/ | No accessible careers/jobs link found on supplied site |
| Elite Crew International | florida | https://www.elitecrew.com/ | robots.txt disallows page or robots unavailable |
| Indeed – Fort Lauderdale yacht crew | florida | https://www.indeed.com/q-Yacht-Crew-l-Fort-Lauderdale,-FL-jobs.html | General job board; no employer careers feed |
| LinkedIn | florida | https://www.linkedin.com/jobs/ | General job board; no employer careers feed |
| Facebook yacht crew groups | florida |  | No URL supplied in research |
| Marquette Transportation | national | https://www.marquettetransportation.com/careers/ | robots.txt disallows page or robots unavailable |
| American Commercial Barge Line (ACBL) | national | https://www.acbl.net/careers/ | Unavailable or parked research URL (HTTP 404) |
| AEP River Operations | national | https://www.aepriverops.com/careers/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| Stevens Towing Co. | national | https://stevenstowing.com/careers/ | robots.txt disallows page or robots unavailable |
| Hornbeck Offshore | national | https://www.hornbeckoffshore.com/careers/ | Unavailable or parked research URL (HTTP 404) |
| TowBoatUS | national | https://www.towboatus.com/careers/ | robots.txt disallows page or robots unavailable |
| Sea Tow | national | https://seatow.com/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| Viking Dredging | national | https://www.vikingdredging.com/careers/ | Unavailable or parked research URL (HTTP 404) |
| Barnstable County Dredging | national | https://www.barnstablecounty.org/careers | Unavailable or parked research URL (HTTP 404) |
| Bisso Marine | national | https://www.bissomarine.com/careers/ | robots.txt disallows page or robots unavailable |
| University of Southern Mississippi – R/V Tommy Munro | national | https://www.usm.edu/careers/ | Unavailable or parked research URL (HTTP 404) |
| Orca Maritime | national | https://www.orcamaritime.com/careers/ | Unavailable or parked research URL (HTTP 404) |
| Cardinal Point Captains | national | https://www.cardinalpointcaptains.com/careers/ | robots.txt disallows page or robots unavailable |
| Argosy Cruises | national | https://www.argosycruises.com/careers/ | Unavailable or parked research URL (HTTP 404) |
| Land & Sea / St. Johns River Ferry | national | https://www.landandsea.com/careers/ | robots.txt disallows page or robots unavailable |
| Fisher Island Community Association | national | https://www.fisherisland.com/careers/ | Unavailable or parked research URL (HTTP 404) |
| Charleston Water Taxi | charleston | https://charlestonwatertaxi.com/ | No accessible careers/jobs link found on supplied site |
| Charleston Harbor Tours – Carolina Belle | charleston | https://charlestonharbortours.com/ | No accessible careers/jobs link found on supplied site |
| Schooner Pride | charleston | https://www.schoonerpride.com/ | No accessible careers/jobs link found on supplied site |
| Savage Companies | charleston | https://savage.com/careers/ | robots.txt disallows page or robots unavailable |
| Stevens Towing Co. | charleston | https://stevenstowing.com/ | robots.txt disallows page or robots unavailable |
| Charleston Marine Containers | charleston |  | No URL supplied in research |
| Russell Marine LLC | charleston | https://www.russellmarine.com/ | No accessible careers/jobs link found on supplied site |
| Charleston Harbor Pilots | charleston | https://www.charlestonpilots.com/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| SCDNR – Marine Resources Division / Campbell Center | charleston | https://www.dnr.sc.gov/admin/dnrhr.html | Unavailable or parked research URL (HTTP 0) |
| U.S. Coast Guard Auxiliary – Sector Charleston | charleston | https://www.uscga-district-7.org/ | No accessible careers/jobs link found on supplied site |
| Charleston County Parks & Recreation | charleston | https://www.ccprc.com/jobs | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| TowBoatUS Charleston / Allwater Marine | charleston | https://www.boatus.com/towing/ | No accessible careers/jobs link found on supplied site |
| Sea Tow Charleston | charleston | https://seatow.com/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| Freedom Boat Club | charleston | https://freedomboatclub.com/careers/ | robots.txt disallows page or robots unavailable |
| Barton & Gray Mariners Club | charleston | https://bartongray.com/careers/ | robots.txt disallows page or robots unavailable |
| Charleston City Marina | charleston | https://charlestoncitymarina.com/ | robots.txt disallows page or robots unavailable |
| Ripley Light Marina | charleston | https://ripleylightmarina.com/ | No accessible careers/jobs link found on supplied site |
| Ashley Marina | charleston | https://ashleymarina.com/ | Unavailable or parked research URL (HTTP 403) |
| Bristol Marina | charleston | https://bristolmarina.com/ | robots.txt disallows page or robots unavailable |
| St. Johns Yacht Harbor | charleston | https://www.stjohnsyachtharbor.com/ | No accessible careers/jobs link found on supplied site |
| Bohicket Marina | charleston | https://www.bohicketmarina.com/ | robots.txt disallows page or robots unavailable |
| Kiawah Island Club | charleston | https://www.kiawahislandclub.com/ | robots.txt disallows page or robots unavailable |
| Isle of Palms Marina | charleston | https://iopmarina.com/ | No accessible careers/jobs link found on supplied site |
| Folly Beach Marina | charleston | https://follybeachmarina.com/ | No accessible careers/jobs link found on supplied site |
| Daniel Island Marina / waterfront operations | charleston |  | No URL supplied in research |
| Palmetto Boat Sales | charleston | https://www.palmettoboatsales.com/employment | Unavailable or parked research URL (HTTP 403) |
| Scout Boats | charleston | https://scoutboats.com/careers/ | Unavailable or parked research URL (HTTP 404) |
| Coastal Expeditions | charleston | https://coastalexpeditions.com/careers/ | Unavailable or parked research URL (HTTP 404) |
| Tidal Wave Water Sports | charleston | https://tidalwavewatersports.com/ | No accessible careers/jobs link found on supplied site |
| Barrier Island Eco Tours | charleston | https://barrierislandecotours.com/ | No accessible careers/jobs link found on supplied site |
| Charleston Riverfront Watersports | charleston | https://charlestonriverfrontwatersports.com/ | No accessible careers/jobs link found on supplied site |
| Charleston Sailing School | charleston |  | No URL supplied in research |
| Charleston Sailing Charters | charleston | https://charlestonsailingcharters.com/ | No accessible careers/jobs link found on supplied site |
| Carolina Yacht Club | charleston | https://carolinayachtclub.org/ | No accessible careers/jobs link found on supplied site |
| Charleston Dive Center | charleston |  | No URL supplied in research |
| Lowcountry Scuba | charleston |  | No URL supplied in research |
| Mainstream Commercial Divers | charleston | https://mainstreamcommercialdivers.com/ | robots.txt disallows page or robots unavailable |
| Standard Diving & Marine Contracting | charleston | https://standarddiving.com/ | No accessible careers/jobs link found on supplied site |
| Swift Marine Yacht Management | charleston | https://swiftmarinesc.com/ | robots.txt disallows page or robots unavailable |
| Dewees Island POA | charleston | https://deweesislandpoa.com/ | robots.txt disallows page or robots unavailable |
| Black River Outdoors | charleston | https://www.blackriveroutdoors.com/ | No accessible careers/jobs link found on supplied site |
| The Charleston Angler | charleston | https://thecharlestonangler.com/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| Haddrell’s Point Tackle | charleston | https://haddrellspoint.com/ | No accessible careers/jobs link found on supplied site |
| Palmetto Breeze | charleston | https://www.palmettobreeze.com/ | No accessible careers/jobs link found on supplied site |
| Hurricane Fleet Ocean Adventures | grand-strand | https://hurricanefleet.com/ | No accessible careers/jobs link found on supplied site |
| Little River Fishing Fleet | grand-strand | https://littleriverfishingfleet.com/ | No accessible careers/jobs link found on supplied site |
| Voyager Fishing Charters | grand-strand | https://www.voyagerfishingcharters.com/ | No accessible careers/jobs link found on supplied site |
| Barefoot Marina | grand-strand | https://barefootmarina.com/ | No accessible careers/jobs link found on supplied site |
| North Myrtle Beach RV Resort & Dry Dock | grand-strand | https://www.northmyrtlebeachrvresortanddrydock.com/ | No accessible careers/jobs link found on supplied site |
| Sea Tow Georgetown / Murrells Inlet | grand-strand | https://seatow.com/georgetown-murrells-inlet/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| SCDNR – Marine Resources / Carroll A. Campbell Jr. Marine Resources Center | grand-strand | https://www.dnr.sc.gov/admin/dnrhr.html | Unavailable or parked research URL (HTTP 0) |
| U.S. Coast Guard Auxiliary – Flotilla 12-4 | grand-strand | https://join.cgaux.org/ | No accessible careers/jobs link found on supplied site |
| Crazy Sister Marina | grand-strand | https://www.crazysister.com/ | No accessible careers/jobs link found on supplied site |
| Marlin Quay Marina | grand-strand | https://www.marlinquay.com/ | robots.txt disallows page or robots unavailable |
| Wacca Wachee Marina | grand-strand | https://www.waccawacheemarina.com/ | robots.txt disallows page or robots unavailable |
| Georgetown Landing Marina | grand-strand | https://www.georgetownlanding.com/ | robots.txt disallows page or robots unavailable |
| Myrtle Beach Yacht Club | grand-strand | https://www.myrtlebeachyachtclub.com/ | No accessible careers/jobs link found on supplied site |
| Coquina Harbour Marina | grand-strand | https://www.coquinaharbour.com/ | robots.txt disallows page or robots unavailable |
| Harbourgate Marina & Yacht Club | grand-strand | https://www.harbourgatemarina.com/ | No accessible careers/jobs link found on supplied site |
| Cricket Cove Marina | grand-strand | https://www.cricketcovemarina.com/ | No accessible careers/jobs link found on supplied site |
| Captain Smiley Fishing Charters | grand-strand | https://www.captainsmileyfishingcharters.com/ | robots.txt disallows page or robots unavailable |
| Sea Thunder Dolphin Cruise | grand-strand | https://www.seathundercruises.com/ | robots.txt disallows page or robots unavailable |
| Ocean Screamer | grand-strand | https://www.oceanscreamer.com/ | robots.txt disallows page or robots unavailable |
| Myrtle Beach Watersports | grand-strand | https://www.myrtlebeachwatersports.com/ | No accessible careers/jobs link found on supplied site |
| Action Water Sportz | grand-strand | https://www.actionwatersportz.com/ | robots.txt disallows page or robots unavailable |
| Freedom Boat Club | grand-strand | https://freedomboatclub.com/ | robots.txt disallows page or robots unavailable |
| Carefree Boat Club – Myrtle Beach | grand-strand | https://www.carefreeboats.com/locations/myrtle-beach/ | Unavailable or parked research URL (HTTP 404) |
| TowBoatUS Grand Strand | grand-strand | https://www.boatus.com/towing/ | No accessible careers/jobs link found on supplied site |
| Sea Tow Myrtle Beach | grand-strand | https://seatow.com/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| Coastal Scuba | grand-strand | https://www.coastalscuba.com/ | Unavailable or parked research URL (HTTP 0) |
| Black River Outdoors | grand-strand | https://www.blackriveroutdoors.com/ | No accessible careers/jobs link found on supplied site |
| Georgetown County Fire / EMS marine response | grand-strand | https://www.georgetowncountysc.org/ | robots.txt disallows page or robots unavailable |
| City of Myrtle Beach | grand-strand | https://www.governmentjobs.com/careers/myrtlebeach | robots.txt disallows page or robots unavailable |
| City of North Myrtle Beach | grand-strand | https://www.nmb.us/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| Coastal Carolina University – Marine Operations | grand-strand | https://www.coastal.edu/hr/ | robots.txt disallows page or robots unavailable |
| Hobcaw Barony / Belle W. Baruch Foundation | grand-strand | https://www.hobcawbarony.org/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| The Boat Shed | grand-strand | https://www.boatshedsc.com/ | robots.txt disallows page or robots unavailable |
| Thomas Marine | grand-strand | https://www.thomasmarine.com/ | No accessible careers/jobs link found on supplied site |
| Adams Mobile Marine Repair | grand-strand | https://www.adamsmobilmarine.com/ | robots.txt disallows page or robots unavailable |
| Tailwalker Marine | grand-strand | https://www.tailwalkermarine.com/ | Accessible links are advice, general pages, a browser-upgrade screen, or redirects to unrelated employers; no usable job page verified. |
| Blue Wave Adventures | grand-strand | https://bluewaveadventures.com/ | No accessible careers/jobs link found on supplied site |
| New Wave Watersports | grand-strand | https://newwavewatersports.com/ | No accessible careers/jobs link found on supplied site |
| Island Adventure Watersports | grand-strand | https://islandadventurewatersports.com/ | No accessible careers/jobs link found on supplied site |
| Barefoot Queen Riverboat | grand-strand | https://barefootqueen.com/ | No accessible careers/jobs link found on supplied site |
| Great American Riverboat Co | grand-strand | https://greatamericanriverboat.com/ | robots.txt disallows page or robots unavailable |
| Cruisin’ Tikis Myrtle Beach | grand-strand | https://cruisintikis.com/ | No accessible careers/jobs link found on supplied site |
| Marina Inn at Grande Dunes | grand-strand | https://marinainn.com/ | robots.txt disallows page or robots unavailable |
| Barefoot Landing Marina | grand-strand | https://barefootlanding.com/ | robots.txt disallows page or robots unavailable |
| Dock Holidays Marina | grand-strand | https://dockholidays.com/ | robots.txt disallows page or robots unavailable |
| Apache Pier | grand-strand | https://apachepier.com/ | robots.txt disallows page or robots unavailable |
| Cherry Grove Pier | grand-strand | https://cherrygrovepier.com/ | No accessible careers/jobs link found on supplied site |
| Harborwalk Marina | grand-strand | https://harborwalkmarina.com/ | No accessible careers/jobs link found on supplied site |
| Ripley’s Aquarium | grand-strand | https://www.ripleyaquariums.com/ | No accessible careers/jobs link found on supplied site |
| Nu Horizons Dive & Travel | grand-strand | https://nuhorizonsdive.com/ | robots.txt disallows page or robots unavailable |
| Bass Pro Shops | grand-strand | https://www.basspro.com/careers | robots.txt disallows page or robots unavailable |
| Captain Dick’s Marina | grand-strand | https://captdicksmarina.com/ | robots.txt disallows page or robots unavailable |
| Dockside Marina | grand-strand | https://docksidemarina.com/ | No accessible careers/jobs link found on supplied site |
| Osprey Marina | grand-strand | https://ospreymarina.com/ | No accessible careers/jobs link found on supplied site |
| Socastee Swing Bridge Marina | grand-strand | https://socasteemarina.com/ | robots.txt disallows page or robots unavailable |
| Little River Marina | grand-strand | https://littlerivermarina.com/ | No accessible careers/jobs link found on supplied site |
| Georgetown Marina | grand-strand | https://georgetownmarina.com/ | No accessible careers/jobs link found on supplied site |
| Sea Screamer | grand-strand | https://seascreamer.com/ | No accessible careers/jobs link found on supplied site |
| Bahia Mar Yachting Center | florida |  | No URL supplied in research |
| Las Olas Marina | florida |  | No URL supplied in research |
| Sunrise Harbor Marina | florida |  | No URL supplied in research |
| New River Downtown Docks / Riverwalk | florida |  | No URL supplied in research |
| Fort Lauderdale Marina | florida |  | No URL supplied in research |
| Hall of Fame Marina | florida |  | No URL supplied in research |
| Pier Sixty-Six Marina | florida |  | No URL supplied in research |
| New River / Intracoastal yacht yards | florida |  | No URL supplied in research |
| Fort Lauderdale International Boat Show | florida |  | No URL supplied in research |

## Government feeds

| Agency | Result | Endpoint / reason |
|---|---|---|
| Georgetown County | Verified | https://www.gtcountysc.gov/RSSFeed.aspx?CommunityJobs=False&ModID=66&CID=All-0 (HTTP 200; rss) |
| City of Charleston | Verified | https://charlestonsc.wd5.myworkdayjobs.com/wday/cxs/charlestonsc/External/jobs (HTTP 200; workday) |
| City of Myrtle Beach | Skipped | GovernmentJobs / NEOGOV robots.txt disallows User-agent: * at /. No crawling or guessed API requests; no accessible authorized machine-readable feed verified. |
| City of North Myrtle Beach | Skipped | GovernmentJobs / NEOGOV robots.txt disallows User-agent: * at /. No crawling or guessed API requests; no accessible authorized machine-readable feed verified. |
| Horry County | Skipped | GovernmentJobs / NEOGOV robots.txt disallows User-agent: * at /. No crawling or guessed API requests; no accessible authorized machine-readable feed verified. |
| Charleston County | Skipped | GovernmentJobs / NEOGOV robots.txt disallows User-agent: * at /. No crawling or guessed API requests; no accessible authorized machine-readable feed verified. |
| State of South Carolina | Skipped | GovernmentJobs / NEOGOV robots.txt disallows User-agent: * at /. No crawling or guessed API requests; no accessible authorized machine-readable feed verified. |
| SCDNR | Skipped | GovernmentJobs / NEOGOV robots.txt disallows User-agent: * at /. No crawling or guessed API requests; no accessible authorized machine-readable feed verified. |
| Charleston County Parks & Recreation | Skipped | Official Munis employment link redirects to Upgrade Browser; no machine-readable feed verified. |
| City of North Charleston | Skipped | Official page lists application forms and HTML vacancies; no RSS or JSON feed linked or verified. |
| Town of Mount Pleasant | Skipped | Official Jobs link uses Dayforce; its robots.txt disallows /. No authorized machine-readable feed verified. |
| SC Ports Authority | Skipped | Official SmartRecruiters careers page verified, but api.smartrecruiters.com robots.txt disallows this bot. HTML page-watch configured in companies.json; no JSON feed enabled. |

The State of South Carolina and SCDNR entries retain the Horry/Georgetown/Charleston/Berkeley/Dorchester county restriction for a future accessible feed. Georgetown’s RSS returned two recent items; its HTML jobs page listed more vacancies, so RSS is not guaranteed to be a complete backlog.

The plan’s title gate is literal: government firefighter-only and water-instructor titles can be collected and classified into marine tracks, then rejected as `not-marine` because those titles are absent from section A’s marine gate. They remain visible in `data/all-jobs.json` for AI review. No exception was added to the requested gate.

All enabled feeds check robots.txt at runtime. Availability can change between verification and a feed run; failures remain isolated and are reported.
