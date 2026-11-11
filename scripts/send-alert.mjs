// Sends the phone ping for jobs the last feed run queued, after the site is serving that feed.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { pendingAlerts, sendAlert, waitForSite } from './lib/alert.mjs';

export async function main({ root = fileURLToPath(new URL('../', import.meta.url)), topic = process.env.NTFY_TOPIC, fetchImpl = fetch, waitOptions = {} } = {}) {
  const feed = JSON.parse(await readFile(resolve(root, 'data/feed.json'), 'utf8'));
  const jobs = pendingAlerts(feed);
  if (!jobs.length) { console.log('No new hot jobs to alert.'); return 'none'; }
  if (!topic) { console.log('NTFY_TOPIC not set; skipping phone alert.'); return 'no-topic'; }
  const live = await waitForSite(feed.generatedAt, { fetchImpl, ...waitOptions });
  // Send even if Pages is slow: a late ping beats a lost one, and the site reloads the feed when opened.
  console.log(live ? 'Site is live with this feed.' : 'Site still updating after the wait; sending anyway.');
  await sendAlert(jobs, { topic, fetchImpl });
  console.log(`Phone alert sent: ${jobs.length} new hot jobs`);
  return live ? 'sent' : 'sent-late';
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Phone alert failed: ${error.message}`); process.exitCode = 1; });
}
