import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const json = path => readFile(new URL('../../' + path, import.meta.url), 'utf8').then(JSON.parse);
test('research catalog preserves employer fields, regional tracks, supplied URLs and business contacts', async () => {
  const { employers } = await json('config/local-employers.json');
  const research = (await Promise.all(['grand-strand-employers', 'charleston-employers', 'florida-liveaboard-highpay'].map(f => readFile(new URL(`../../docs/research/${f}.md`, import.meta.url), 'utf8')))).join('\n');
  assert.ok(employers.length > 200);
  const tracks = { 'grand-strand': 'marine-local', charleston: 'marine-chs', florida: 'marine-national', national: 'marine-national' };
  for (const e of employers) {
    for (const key of ['name', 'town', 'region', 'type', 'url', 'hiringMethod', 'contact', 'track']) assert.equal(typeof e[key], 'string', `${e.name}: ${key}`);
    assert.equal(e.track, tracks[e.region]);
    assert.ok(!/American Cruise Lines|Viking Crew/i.test(e.name));
    if (e.url) assert.ok(research.includes(e.url), `${e.name}: URL not supplied by research`);
    for (const contact of e.contact.split('; ').filter(Boolean)) assert.match(contact, /^(?:[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|(?:1[- ])?\(?\d{3}\)?[- .]\d{3}[- .]\d{4})$/);
  }
});
test('every enabled government feed has live verification; every requested agency is accounted for', async () => {
  const config = await json('config/govfeeds.json');
  assert.ok(config.feeds.length > 0);
  for (const feed of config.feeds) {
    assert.equal(feed.verification.status, 200); assert.equal(feed.verifiedAt, '2026-10-15');
    assert.ok(!feed.trackHint && !feed.track); assert.ok(feed.verification.source);
  }
  const names = new Set([...config.feeds, ...config._skipped].map(e => e.name));
  for (const name of ['City of Myrtle Beach', 'City of North Myrtle Beach', 'Horry County', 'Georgetown County', 'City of Charleston', 'Charleston County', 'Charleston County Parks & Recreation', 'City of North Charleston', 'Town of Mount Pleasant', 'State of South Carolina', 'SC Ports Authority', 'SCDNR']) assert.ok(names.has(name), name);
  for (const feed of config._skipped) assert.ok(feed.reason && feed.checkedAt);
  assert.deepEqual(config._skipped.find(f => f.name === 'State of South Carolina').counties, ['Horry', 'Georgetown', 'Charleston', 'Berkeley', 'Dorchester']);
});
test('new company endpoints have reviewed live verification and workflow persists the catch log', async () => {
  const { companies } = await json('config/companies.json');
  for (const company of companies) {
    assert.equal(company.verification.status, 200, company.name);
    assert.ok(['page', 'greenhouse', 'lever', 'ashby', 'workday', 'smartrecruiters'].includes(company.ats));
    assert.ok(!/American Cruise Lines|Viking Crew/i.test(company.name));
  }
  for (const name of ['Express Watersports / Express Dive Center', 'Longshore Boats', 'Canal Barge Company', 'Crewfinders', 'City of Charleston']) assert.ok(companies.some(c => c.name === name), name);
  const workflow = await readFile(new URL('../../.github/workflows/feed.yml', import.meta.url), 'utf8');
  assert.match(workflow, /git add data\/feed\.json data\/all-jobs\.json data\/pagewatch\.json/);
});
