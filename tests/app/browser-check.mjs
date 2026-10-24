// Optional UI pass, using an existing Playwright install (no project dependencies).
// CN_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/app/browser-check.mjs
// CN_BROWSER=webkit selects WebKit; screenshots go to /tmp/crows-nest-preview by default.
import assert from 'node:assert/strict';
import { appsInWeek } from '../../js/logic.js';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
const playwright = await import(process.env.CN_PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.env.CN_SCREENSHOTS || '/tmp/crows-nest-preview';
await mkdir(output, { recursive: true });
const browser = await playwright[process.env.CN_BROWSER || 'chromium'].launch({ headless: true, ...(process.env.CN_CHROME ? { executablePath: process.env.CN_CHROME } : {}) });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const fixture = JSON.parse(await readFile(resolve(root, 'tests/app/fixtures/feed.sample.json'), 'utf8'));
const directory = JSON.parse(await readFile(resolve(root, 'data/directory.json'), 'utf8'));
try {
  for (const width of [1280, 390, 360]) {
    const height = width < 720 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', timezoneId: 'America/New_York' });
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
    await page.route('**/data/sweep.json?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ sweptAt: null, items: [] }) }));
    await page.goto('http://crows-nest.test/?sample=1#helm');
    await page.getByText('Call 843-732-3777 about dock crew', { exact: true }).waitFor();
    await page.waitForFunction(() => localStorage.getItem('cn.sample.lastVisit'));
    const initialTracker = await page.evaluate(() => JSON.parse(localStorage.getItem('cn.sample.tracker')));
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const initialApps = appsInWeek(initialTracker.jobs, today);
    const initialDismissed = await page.evaluate(() => JSON.parse(localStorage.getItem('cn.sample.dismissed')).items.length);
    assert.equal(await page.locator('.pennant').count(), 10);
    assert.equal(await page.locator('.wave-strip').evaluate(el => getComputedStyle(el).animationName), 'none');
    for (const route of ['helm', 'nest', 'voyage', 'harbor', 'papers', 'settings']) {
      await page.locator(`#navigation a[href="#${route}"]`).click();
      await page.locator('.' + route + '-view').waitFor();
      assert.equal(await page.locator('h1').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: ${route} overflows the page`);
      assert.equal(await page.locator('#navigation a').count(), 6);
      assert.ok(await page.locator('#navigation').evaluate(el => el.scrollWidth <= el.clientWidth), `${width}px: navigation scrolls horizontally`);
      if (route === 'harbor') {
        await page.locator('.harbor-card').first().waitFor();
        assert.equal(await page.locator('.harbor-card').count(), 30);
        await page.getByText('0 of 30 top picks contacted', { exact: true }).waitFor();
        for (const label of ['Grand Strand (14)', 'Charleston (10)', 'Florida (6)']) await page.getByRole('heading', { name: label, exact: true }).waitFor();
        const first = page.locator('.harbor-card').first();
        const id = await first.getAttribute('data-employer-id');
        const employer = directory.employers.find(e => e.id === id);
        await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedContact = value; } } }); });
        await first.getByRole('button', { name: `Copy phone: ${employer.phone}`, exact: true }).click();
        assert.equal(await page.evaluate(() => window.copiedContact), employer.phone);
        await first.getByRole('button', { name: 'Called', exact: true }).click();
        await page.getByText('1 of 30 top picks contacted', { exact: true }).waitFor();
        const noteLabel = `Note for ${employer.name} (optional)`;
        await page.getByLabel(noteLabel, { exact: true }).pressSequentially('Call Friday ⚓');
        await page.reload();
        await page.getByText('1 of 30 top picks contacted', { exact: true }).waitFor();
        assert.equal(await page.getByLabel(noteLabel, { exact: true }).inputValue(), 'Call Friday ⚓');
        await page.locator('.harbor-filters').getByRole('button', { name: 'Called', exact: true }).click();
        assert.equal(await page.locator('.harbor-card').count(), 1);
        await page.locator('.harbor-filters').getByRole('button', { name: 'All statuses', exact: true }).click();
        await page.getByLabel('Search the harbor', { exact: true }).fill(employer.name);
        assert.equal(await page.locator('.harbor-card').count(), 1);
        await page.locator('.harbor-card').getByRole('button', { name: 'Add to Voyage', exact: true }).click();
        await page.locator('.harbor-card').getByRole('button', { name: 'On board', exact: true }).waitFor();
        const job = await page.evaluate(id => JSON.parse(localStorage.getItem('cn.sample.tracker')).jobs.find(j => j.directoryId === id), id);
        assert.equal(job.stage, 'dockside'); assert.equal(job.company, employer.name);
        assert.equal(job.contact.phone, employer.phone); assert.equal(job.contact.email, employer.email);
        assert.equal(job.role, employer.suggestedRole || 'Ask about deckhand / dock crew');
        await page.getByLabel('Search the harbor', { exact: true }).fill('');
        await page.getByRole('button', { name: `Show all (${directory.employers.length})`, exact: true }).click();
        assert.equal(await page.locator('.harbor-card').count(), directory.employers.length);
        await page.getByRole('button', { name: 'Top picks (30)', exact: true }).click();
      }
      if (route === 'helm') {
        assert.equal(await page.locator('.helm-view > :first-child').getAttribute('class'), 'weekly-grid');
        const scoreboard = await page.locator('.weekly-grid').boundingBox();
        const fold = width < 720 ? (await page.locator('#navigation').boundingBox()).y : height;
        assert.ok(scoreboard.y >= 0 && scoreboard.y + scoreboard.height <= fold, `${width}px: full scoreboard must be above the fold`);
        await page.getByRole('heading', { name: 'Weekly sweep due', exact: true }).waitFor();
        assert.equal(await page.locator('.sweep-reminder p').textContent(), 'Open Claude Code in ~/crows-nest and type /weekly-sweep');
      }
      if (route === 'nest' && width < 720) {
        const chips = page.locator('.filter-chips');
        assert.ok(await chips.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === 'auto'));
        const rows = await page.locator('.filter-chip').evaluateAll(els => new Set(els.map(el => el.getBoundingClientRect().top)).size);
        assert.equal(rows, 1, `${width}px: filters must occupy one row`);
        await chips.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        assert.ok(await chips.evaluate(el => el.scrollLeft > 0));
        await chips.evaluate(el => { el.scrollLeft = 0; });
        const firstCard = await page.locator('.job-card h2').first().boundingBox();
        const fold = (await page.locator('#navigation').boundingBox()).y;
        assert.ok(firstCard.y + firstCard.height < fold, `${width}px: first job title must be above the fold`);
      }
      if (['helm', 'nest', 'voyage', 'harbor'].includes(route)) await page.screenshot({ path: `${output}/${width}-${route}.png`, fullPage: route !== 'voyage' });
    }
    await page.locator('#navigation a[href="#nest"]').click();
    await page.locator('.nest-view').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.job-card').length === 12);
    assert.equal(await page.locator('.job-card').count(), 12);
    await page.getByLabel('Search the horizon').fill('Moonwake');
    assert.equal(await page.locator('.job-card').count(), 1);
    await page.getByLabel('Search the horizon').fill('');
    await page.getByRole('button', { name: 'Home Waters' }).click();
    assert.equal(await page.locator('.job-card').count(), 2);
    await page.getByRole('button', { name: 'All waters' }).click();
    await page.getByLabel('New only').check();
    // Reloading Harbor has recorded this visit; the older sample catch is no longer new.
    assert.equal(await page.locator('.job-card').count(), 0);
    await page.getByLabel('New only').uncheck();
    await page.locator('.job-card').first().getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await page.locator('.job-card').count(), 11);
    await page.reload();
    await page.locator('.job-card').first().waitFor();
    assert.equal(await page.locator('.job-card').count(), 11);
    await page.locator('.job-card').first().getByRole('button', { name: 'Applied', exact: true }).click();
    assert.equal(await page.locator('.job-card').count(), 10);
    await page.locator('.job-card').first().getByRole('button', { name: 'Pitch', exact: true }).click();
    await page.getByLabel('Your pitch', { exact: true }).waitFor();
    await page.locator('.job-card').first().getByRole('button', { name: 'Dismiss', exact: true }).click();
    assert.equal(await page.locator('.pitch-panel').count(), 0);
    assert.equal(await page.locator('.job-dismiss-panel').count(), 1);
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
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cn.sample.dismissed')).items.length), initialDismissed + 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('cn.tracker')), null);
    await page.locator('#navigation a[href="#helm"]').click();
    await page.locator('.helm-view').waitFor();
    assert.equal(await page.locator('[aria-label="Weekly applications"]').getAttribute('aria-valuenow'), String(initialApps + 1));
    await page.locator('#navigation a[href="#voyage"]').click();
    await page.locator('.voyage-view').waitFor();
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
    await page.getByText('Add the date you applied before logging this stage.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.getByLabel('Date applied', { exact: true }).fill(today);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByText('Job added to your voyage.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Test Buoy (fictional): Junior deckhand. Open details', exact: true }).click();
    assert.equal(await page.getByLabel('Notes', { exact: true }).inputValue(), 'Café ⚓ 🛥️ — naïve');
    await page.getByRole('button', { name: 'Mark followed up', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Hailed', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete job', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('#navigation a[href="#papers"]').click();
    await page.getByLabel('TWIC card', { exact: true }).check();
    assert.ok(await page.getByText('3 of 12 papers in order', { exact: true }).count());
    await page.locator('#navigation a[href="#settings"]').click();
    await page.getByLabel('Applications per week', { exact: true }).fill('12');
    await page.getByRole('button', { name: 'Set goal', exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '↓ Export tracker', exact: true }).click()]);
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(exported.version, 1); assert.equal(exported.settings.weeklyGoal, 12);
    await page.getByLabel('↑ Import tracker JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":2}') });
    await page.getByText('This tracker contains invalid fields; nothing was imported.', { exact: true }).waitFor();
    await page.getByLabel('↑ Import tracker JSON').setInputFiles({ name: 'tracker.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await page.getByText('Logbooks merged. Your newest edits are aboard.', { exact: true }).waitFor();
    // An actual hostile feed value must remain literal text, with no executable link.
    await page.route('**/tests/app/fixtures/feed.sample.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...fixture, jobs: [{ ...fixture.jobs[0], title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' }] }) }));
    await page.evaluate(() => { localStorage.removeItem('cn.sample.tracker'); localStorage.removeItem('cn.sample.dismissed'); });
    await page.goto(`http://crows-nest.test/?sample=1&check=${Date.now()}#nest`);
    await page.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
    assert.equal(await page.locator('.job-card img').count(), 0);
    assert.equal(await page.locator('.job-card h2 a').count(), 0);
    // Employer names, contacts, hiring methods and notes remain literal text too.
    const hostile = { ...directory.employers[0], id: 'hostile', name: '<img src=x onerror=alert(1)>', phone: '<svg onload=alert(1)>', email: '<b>crew@example.test</b>',
      hiringMethod: '<script>alert(1)</script>', tip: '<img src=x>', url: 'javascript:alert(1)' };
    await page.route('**/data/directory.json?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ employers: [hostile] }) }));
    await page.goto(`http://crows-nest.test/?sample=1&check=${Date.now()}#harbor`);
    await page.locator('.harbor-card h3').waitFor();
    assert.equal(await page.locator('.harbor-card h3').textContent(), hostile.name);
    assert.equal(await page.locator('.harbor-card img, .harbor-card svg, .harbor-card script, .harbor-card b, .harbor-card a').count(), 0);
    assert.equal(await page.locator('.harbor-card .contact-text').first().textContent(), hostile.phone);
    await page.route('**/data/directory.json?*', route => route.fulfill({ status: 503, body: '' }));
    await page.reload();
    await page.getByRole('heading', { name: 'The harbor directory is offline.', exact: true }).waitFor();
    assert.equal(await page.locator('.harbor-card').count(), 0);
    // Missing, invalid or fresh sweep data never shows a due reminder.
    for (const data of [null, {}, { sweptAt: new Date().toISOString(), items: [] }]) {
      await page.route('**/data/sweep.json?*', route => route.fulfill({ status: data === null ? 503 : 200, contentType: 'application/json', body: JSON.stringify(data) }));
      await page.evaluate(() => localStorage.removeItem('cn.sample.lastVisit'));
      await page.goto(`http://crows-nest.test/?sample=1&check=${Date.now()}#helm`);
      await page.waitForFunction(() => localStorage.getItem('cn.sample.lastVisit'));
      assert.equal(await page.locator('.sweep-reminder').count(), 0);
    }
    assert.deepEqual(errors, [], `${width}px: browser runtime errors`);
    await context.close(); console.log(`PASS: ${width}px routes, navigation, Harbor, persistence, sheets, papers, import/export, untrusted text safety`);
  }
} finally { await browser.close(); }
