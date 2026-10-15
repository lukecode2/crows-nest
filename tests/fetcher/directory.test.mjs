import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildDirectory, scoreEmployer, TOP_COUNTS } from '../../scripts/build-directory.mjs';

const employer = (patch = {}) => ({ name: 'Example Marina', region: 'grand-strand', town: 'Little River', type: 'Marina / dry stack', hiringMethod: 'Walk-in / email', url: 'https://example.test/', contact: '(843) 555-0100; crew@example.test', ...patch });
test('scores follow the specified weights, including a single hiring-route point', () => {
  const e = { ...employer(), phone: '(843) 555-0100' };
  assert.equal(scoreEmployer(e), 7);
  assert.equal(scoreEmployer({ ...e, region: 'charleston', hiringMethod: 'Online careers application / phone' }), 6);
  assert.equal(scoreEmployer({ ...e, region: 'florida', type: 'Live-aboard ferry deckhand', hiringMethod: 'Online careers application' }), 5);
  assert.equal(scoreEmployer({ ...e, phone: '', type: 'Research support', hiringMethod: 'Referral', url: '' }), 2);
  assert.equal(scoreEmployer({ ...e, region: 'florida', hiringMethod: 'Phone' }), 4);
  assert.equal(scoreEmployer({ ...e, type: 'Fishing / head boats' }), 7);
});
test('merges companies and shared careers URLs transitively, joins towns, retains supplied contacts', () => {
  const source = { employers: [
    employer(), employer({ town: 'Charleston', region: 'charleston', url: 'https://careers.test/jobs', contact: 'crew2@example.test' }),
    employer({ name: 'Second brand', town: 'Georgetown', url: 'http://www.careers.test/jobs/', contact: '(843) 555-0101' }),
    employer({ name: 'Other', url: 'https://other.test/' })
  ] };
  const data = buildDirectory(source, '2026-10-15T00:00:00Z');
  assert.equal(data.employers.length, 2);
  const merged = data.employers.find(e => e.name === 'Example Marina');
  assert.equal(merged.region, 'grand-strand');
  for (const town of ['Little River', 'Charleston', 'Georgetown']) assert.ok(merged.town.includes(town));
  assert.equal(merged.email, 'crew@example.test; crew2@example.test');
  assert.ok(merged.phone.includes('(843) 555-0101'));
  assert.deepEqual(buildDirectory(source, data.generatedAt), data);
});
test('excludes cruise lines, retail, repair, trade yards and unusable contacts, keeps harbor tours', () => {
  const excluded = [
    { name: 'Cruise line', type: 'Cruise line deckhand' }, { name: 'Retail', type: 'Boat dealer / retail' },
    { name: 'Repair', type: 'Mobile marine repair' }, { name: 'Yard', type: 'Shipyard / welders / marine trades' },
    { name: 'None', contact: '', url: '' }, { name: 'Unsafe', contact: '', url: 'javascript:alert(1)' },
    { name: 'National', region: 'national' }, { name: 'FL resort', region: 'florida', type: 'Resort marina', hiringMethod: 'Online application' },
    { name: 'General board', region: 'florida', type: 'General job board', hiringMethod: 'Yacht crew application' }
  ].map(patch => employer(patch));
  const included = [
    employer({ name: 'SpiritLine', type: 'Harbor tours, dinner cruises' }),
    employer({ name: 'Florida agency', region: 'florida', type: 'Yacht crew agency' }),
    employer({ name: 'Florida day work', region: 'florida', type: 'Yacht day-work resource' }),
    employer({ name: 'Florida boat', region: 'florida', type: 'Live-aboard deckhand employer' }),
    employer({ name: 'Phone only', url: '', contact: '(843) 555-0102' }),
    employer({ name: 'Dealer with crew roles', type: 'Boat dealer / dock crew' }),
    employer({ name: 'Email only', url: '', contact: 'crew@example.test' })
  ].map((e, i) => ({ ...e, url: e.url ? `https://included${i}.test/` : '' }));
  assert.deepEqual(buildDirectory({ employers: [...excluded, ...included] }).employers.map(e => e.name).sort(), included.map(e => e.name).sort());
});
test('generated directory has exactly 14/10/6 best picks, unique slugs, and no invented contacts', async () => {
  const source = JSON.parse(await readFile(new URL('../../config/local-employers.json', import.meta.url), 'utf8'));
  const generated = JSON.parse(await readFile(new URL('../../data/directory.json', import.meta.url), 'utf8'));
  const rebuilt = buildDirectory(source, generated.generatedAt);
  assert.deepEqual(generated, rebuilt, 'run npm run directory after generator changes');
  assert.equal(new Set(rebuilt.employers.map(e => e.id)).size, rebuilt.employers.length);
  for (const [region, count] of Object.entries(TOP_COUNTS)) {
    const entries = rebuilt.employers.filter(e => e.region === region);
    const top = entries.filter(e => e.tier === 'top'), more = entries.filter(e => e.tier === 'more');
    assert.equal(top.length, count);
    if (more.length) assert.ok(Math.min(...top.map(e => e.score)) >= Math.max(...more.map(e => e.score)));
  }
  const research = JSON.stringify(source);
  for (const e of rebuilt.employers) {
    assert.match(e.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(e.tip && e.tip.length < 130);
    assert.ok(e.phone || e.email || e.url);
    for (const contacts of [e.phone, e.email]) assert.equal(new Set(contacts.split('; ')).size, contacts.split('; ').length);
    for (const contact of [e.phone, e.email].flatMap(value => value.split('; ')).filter(Boolean)) assert.ok(research.includes(contact), `${e.name}: invented contact ${contact}`);
    if (e.url) assert.ok(source.employers.some(original => original.url === e.url), `${e.name}: invented URL`);
  }
  assert.equal(rebuilt.employers.find(e => e.name.startsWith('SCDNR')).region, 'charleston');
  assert.equal(rebuilt.employers.find(e => e.name === 'Gulf Stream Boat Club').tier, 'more');
});
