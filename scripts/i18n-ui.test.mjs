// Browser test of the language controls in the real app: the floating translator button, its sheet,
// the sign up choice and the draft note. Builds the site like the publish step (split-app) into a temp
// folder and serves it through Playwright; the API and sign in service are stubbed (nothing leaves the PC).
// Needs Playwright: PLAYWRIGHT_DIR (default Desktop/katyo/node_modules). Usage: node --test scripts/i18n-ui.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR || path.resolve(root, '../katyo/node_modules'), 'x.js'));
const { chromium } = require('playwright');
const DICTS = {
  fr: { 'Change language': 'Changer de langue', 'Choose your language': 'Choisissez votre langue', Home: 'Accueil', Language: 'Langue' },
  kri: { Home: 'Os', 'Draft translation': 'Draft translation' },
  ar: { Home: 'الرئيسية' },
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let dist, browser;
before(async () => {
  dist = mkdtempSync(path.join(os.tmpdir(), 'cwt-'));
  execFileSync(process.execPath, [path.join(root, 'scripts/split-app.mjs'), path.join(root, 'frontend/app.html'), dist]);
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); });

function fileFor(p) {
  if (p === '/' || p === '/index.html') return path.join(dist, 'index.html');
  if (/^\/app-[0-9a-f]+\.js$/.test(p)) return path.join(dist, p);
  return path.join(root, 'frontend', p);
}
async function open({ lang, width = 360 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 760 } });
  await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('cwt_terms_accepted_v1', '1'); if (l) localStorage.setItem('cwt.lang', l); else localStorage.removeItem('cwt.lang'); } } catch {} }, lang || null);
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== 't.local') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const m = u.pathname.match(/^\/i18n\/([a-z]+)\.json$/);
    if (m) return DICTS[m[1]] ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(DICTS[m[1]]) }) : route.fulfill({ status: 404, body: '' });
    const f = fileFor(decodeURIComponent(u.pathname));
    if (!existsSync(f) || !statSync(f).isFile()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: readFileSync(f) });
  });
  const p = await ctx.newPage();
  await p.goto('http://t.local/');
  await p.waitForFunction(() => window.I18N && !document.documentElement.classList.contains('i18n-wait'));
  return { p, ctx };
}

test('the floating button shows the language, opens a searchable sheet and switches the site', async () => {
  const { p, ctx } = await open();
  const fab = p.locator('#langFab');
  await fab.waitFor({ state: 'visible' });
  assert.equal((await fab.textContent()).trim(), 'EN');
  const box = await fab.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, 'tap target at least 44 px');
  assert.ok(box.x + box.width <= 360 && box.y + box.height <= 760, 'inside the screen');
  await fab.click();
  await p.locator('#langSheet').waitFor({ state: 'visible' });
  await p.fill('#langSearch', 'fran');
  const shown = await p.locator('#langList [data-lang]:visible').allTextContents();
  assert.ok(shown.some((t) => t.includes('Français')), 'search finds Français');
  assert.ok(!shown.some((t) => t.includes('Deutsch')), 'search hides others');
  await p.click('#langList [data-lang="fr"]');
  await p.waitForFunction(() => document.documentElement.lang === 'fr');
  assert.equal(await p.locator('#langSheet').isVisible(), false, 'sheet closes');
  assert.equal((await fab.textContent()).trim(), 'FR');
  assert.equal(await fab.getAttribute('aria-label'), 'Changer de langue');
  await p.reload();
  await p.waitForFunction(() => document.documentElement.lang === 'fr' && window.I18N);
  await ctx.close();
});

test('Escape closes the sheet and focus returns to the button', async () => {
  const { p, ctx } = await open();
  await p.click('#langFab');
  await p.locator('#langSheet').waitFor({ state: 'visible' });
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#langSheet').isVisible(), false);
  assert.equal(await p.evaluate(() => document.activeElement?.id), 'langFab');
  await ctx.close();
});

test('the sign up form offers the language, preset to the current one, listed by own names', async () => {
  const { p, ctx } = await open({ lang: 'fr' });
  const sel = p.locator('#signupLang');
  assert.equal(await sel.inputValue(), 'fr');
  const names = await sel.locator('option').allTextContents();
  assert.equal(names.length, 28);
  assert.ok(names.includes('Krio') && names.includes('Kiswahili') && names.includes('العربية'));
  await ctx.close();
});

test('a draft language shows the draft note with a way to suggest better wording', async () => {
  const { p, ctx } = await open({ lang: 'kri' });
  const note = p.locator('#langDraftNote');
  await note.waitFor({ state: 'visible' });
  assert.ok(await note.locator('[data-suggest]').count());
  await ctx.close();
});

test('right to left: the button moves to the left edge', async () => {
  const { p, ctx } = await open();
  await p.evaluate(() => I18N.set('ar', { save: false }));
  await p.waitForFunction(() => document.documentElement.dir === 'rtl');
  const box = await p.locator('#langFab').boundingBox();
  assert.ok(box.x < 100, 'on the left in right to left');
  await ctx.close();
});

test('first visit: the privacy banner has its own language button that opens the sheet', async () => {
  const c2 = await browser.newContext({ viewport: { width: 360, height: 760 } });
  await c2.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== 't.local') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const m = u.pathname.match(/^\/i18n\/([a-z]+)\.json$/);
    if (m) return DICTS[m[1]] ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(DICTS[m[1]]) }) : route.fulfill({ status: 404, body: '' });
    const f = fileFor(decodeURIComponent(u.pathname));
    if (!existsSync(f) || !statSync(f).isFile()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: readFileSync(f) });
  });
  const pg = await c2.newPage();
  await pg.goto('http://t.local/');
  await pg.locator('#consentBanner.show').waitFor({ state: 'visible' });
  assert.equal(await pg.locator('#langFab').isVisible(), false, 'the floating button waits behind the banner');
  await pg.click('#consentBanner [data-lang-open]');
  await pg.locator('#langSheet').waitFor({ state: 'visible' });
  await pg.click('#langList [data-lang="fr"]');
  await pg.waitForFunction(() => document.documentElement.lang === 'fr');
  assert.equal((await pg.textContent('#consentBanner .cb-lang-name')).trim(), 'Français');
  await c2.close();
});
