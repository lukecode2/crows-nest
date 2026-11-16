// Run on Luke's Mac (SimplyHired blocks GitHub's servers): saves results for the robot to read.
import { readFile, writeFile } from 'node:fs/promises';
import * as http from './lib/http.mjs';
import { fetchLive, SAVED } from './sources/simplyhired.mjs';
const searches = JSON.parse(await readFile(new URL('../config/searches.json', import.meta.url), 'utf8'));
const jobs = await fetchLive({ http, searches, log: m => console.warn(m) });
await writeFile(SAVED, JSON.stringify({ about: 'SimplyHired results saved from the Mac; the robot reads this when SimplyHired blocks it.', savedAt: new Date().toISOString(), jobs }, null, 2) + '\n');
console.log(`Saved ${jobs.length} SimplyHired jobs to data/simplyhired.json`);
