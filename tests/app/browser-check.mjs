// Optional UI pass, using an existing Playwright install (no project dependencies).
// CN_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/app/browser-check.mjs
// CN_BROWSER=webkit selects WebKit; screenshots go to /tmp/crows-nest-preview by default.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
const playwright = await import(process.env.CN_PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.env.CN_SCREENSHOTS || '/tmp/crows-nest-preview';
await mkdir(output, { recursive: true });
const browser = await playwright[process.env.CN_BROWSER || 'chromium'].launch({ headless: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const fixture = JSON.parse(await readFile(resolve(root, 'tests/app/fixtures/feed.sample.json'), 'utf8'));
try {
  for (const width of [1280, 390, 360]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Serve the actual repository files through Playwright, without opening a server socket.
    await page.route('http://crows-nest.test/**', async route => {
      const url = new URL(route.request().url());
      const path = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!path.startsWith(root)) return route.fulfill({ status: 403, body: '' });
      try { await route.fulfill({ contentType: mime[extname(path)] || 'text/plain', body: await readFile(path) }); }
      catch (_) { await route.fulfill({ status: 404, body: 'Not found' }); }
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.goto('http://crows-nest.test/?sample=1#helm');
    await page.getByText('Call 843-732-3777 about dock crew', { exact: true }).waitFor();
    assert.equal(await page.locator('.pennant').count(), 10);
    assert.equal(await page.locator('.wave-strip').evaluate(el => getComputedStyle(el).animationName), 'none');
    for (const route of ['helm', 'nest', 'voyage', 'papers', 'settings']) {
      await page.locator(`#navigation a[href="#${route}"]`).click();
      await page.waitForFunction(route => location.hash === '#' + route && document.querySelector('main h1'), route);
      assert.equal(await page.locator('h1').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: ${route} overflows the page`);
      if (['helm', 'nest', 'voyage'].includes(route)) await page.screenshot({ path: `${output}/${width}-${route}.png`, fullPage: route !== 'voyage' });
    }
    await page.locator('#navigation a[href="#nest"]').click();
    assert.equal(await page.locator('.job-card').count(), 12);
    await page.getByLabel('Search the horizon').fill('Moonwake');
    assert.equal(await page.locator('.job-card').count(), 1);
    await page.getByLabel('Search the horizon').fill('');
    await page.getByRole('button', { name: 'Home Waters' }).click();
    assert.equal(await page.locator('.job-card').count(), 2);
    await page.getByRole('button', { name: 'All waters' }).click();
    await page.getByLabel('New only').check();
    assert.equal(await page.locator('.job-card').count(), 12);
    await page.getByLabel('New only').uncheck();
    await page.locator('.job-card').first().getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await page.locator('.job-card').count(), 11);
    await page.reload();
    await page.locator('.job-card').first().waitFor();
    assert.equal(await page.locator('.job-card').count(), 11);
    await page.locator('.job-card').first().getByRole('button', { name: 'Applied', exact: true }).click();
    assert.equal(await page.locator('.job-card').count(), 10);
    await page.locator('.job-card').first().getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.getByRole('button', { name: 'Pay too low', exact: true }).click();
    await page.getByLabel('Add a note').fill('Café ⚓ — sample note');
    await page.getByRole('button', { name: 'Dismiss job', exact: true }).click();
    assert.equal(await page.locator('.job-card').count(), 9);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await page.locator('.job-card').count(), 10);
    await page.locator('.job-card').first().getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.getByRole('button', { name: 'Dismiss job', exact: true }).click();
    await page.reload();
    await page.locator('.job-card').first().waitFor();
    assert.equal(await page.locator('.job-card').count(), 9);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cn.sample.dismissed')).items.length), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('cn.tracker')), null);
    await page.locator('#navigation a[href="#helm"]').click();
    assert.equal(await page.locator('[aria-label="Weekly applications"]').getAttribute('aria-valuenow'), '1');
    await page.locator('#navigation a[href="#voyage"]').click();
    if (width === 1280) {
      const id = await page.locator('[data-stage="dockside"] .pipeline-card').first().getAttribute('data-job-id');
      await page.locator(`[data-job-id="${id}"]`).dragTo(page.locator('[data-stage="castoff"] .column-heading'));
      assert.ok(await page.locator(`[data-stage="castoff"] [data-job-id="${id}"]`).count());
    }
    await page.getByRole('button', { name: '+ Add job', exact: true }).click();
    await page.getByLabel('Company', { exact: true }).fill('Test Buoy (fictional)');
    await page.getByLabel('Role', { exact: true }).fill('Junior deckhand');
    await page.getByLabel('Notes', { exact: true }).fill('Café ⚓ 🛥️ — naïve');
    await page.getByRole('button', { name: 'Boarding', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('button', { name: 'Test Buoy (fictional): Junior deckhand. Open details', exact: true }).click();
    assert.equal(await page.getByLabel('Notes', { exact: true }).inputValue(), 'Café ⚓ 🛥️ — naïve');
    await page.getByRole('button', { name: 'Mark followed up', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Hailed', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete job', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('#navigation a[href="#papers"]').click();
    await page.getByLabel('TWIC card', { exact: true }).check();
    assert.ok(await page.getByText('2 of 9 papers in order', { exact: true }).count());
    await page.locator('#navigation a[href="#settings"]').click();
    await page.getByLabel('Applications per week', { exact: true }).fill('12');
    await page.getByRole('button', { name: 'Set goal', exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '↓ Export tracker', exact: true }).click()]);
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(exported.version, 1); assert.equal(exported.settings.weeklyGoal, 12);
    await page.getByLabel('↑ Import tracker JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":2}') });
    await page.getByText('Choose a valid Crow’s Nest version 1 tracker export.', { exact: true }).waitFor();
    await page.getByLabel('↑ Import tracker JSON').setInputFiles({ name: 'tracker.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await page.getByText('Logbooks merged. Your newest edits are aboard.', { exact: true }).waitFor();
    // An actual hostile feed value must remain literal text, with no executable link.
    await page.route('**/tests/app/fixtures/feed.sample.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...fixture, jobs: [{ ...fixture.jobs[0], title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' }] }) }));
    await page.evaluate(() => { localStorage.removeItem('cn.sample.tracker'); localStorage.removeItem('cn.sample.dismissed'); });
    await page.goto('http://crows-nest.test/?sample=1#nest');
    await page.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
    assert.equal(await page.locator('.job-card img').count(), 0);
    assert.equal(await page.locator('.job-card h2 a').count(), 0);
    assert.deepEqual(errors, [], `${width}px: browser runtime errors`);
    await context.close(); console.log(`PASS: ${width}px routes, overflow, persistence, sheets, papers, import/export, feed safety`);
  }
} finally { await browser.close(); }
