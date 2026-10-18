// Browser test of the translation layer (frontend/i18n/layer.js and the head script in app.html).
// Needs Playwright: PLAYWRIGHT_DIR points at a node_modules folder that has it (default: Desktop/katyo).
// Usage: node --test scripts/i18n-layer.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR || path.resolve(root, '../katyo/node_modules'), 'x.js'));
const { chromium } = require('playwright');

const app = readFileSync(path.join(root, 'frontend/app.html'), 'utf8');
const head = app.match(/<script id="i18n-head">[\s\S]*?<\/script>\s*<style id="i18n-wait">[\s\S]*?<\/style>/)?.[0];
const layer = readFileSync(path.join(root, 'frontend/i18n/layer.js'), 'utf8');
const FR = { 'Read the essays': 'Lire les essais', 'Search everything': 'Tout rechercher', Saved: 'Enregistré',
  'Can We Talk?': 'Can We Talk?', 'Hello {name}': 'Bonjour {name}', 'Open the reader': 'Ouvrir le lecteur', Ready: 'Prêt' };
const AR = { 'Read the essays': 'اقرأ المقالات' };
const page = (lang) => `<!doctype html><html lang="en"><head><title>Read the essays</title>
<script>try{${lang ? `localStorage.setItem('cwt.lang','${lang}')` : `localStorage.removeItem('cwt.lang')`}}catch(e){}</script>${head}
<script defer src="/i18n/layer.js"></script></head><body>
<h1 id="h">Read the essays</h1><input id="q" placeholder="Search everything"><a id="a" title="Open the reader">x</a>
<textarea id="ta">Saved</textarea><p id="raw" data-no-i18n>Read the essays</p><div id="dyn"></div></body></html>`;

let browser;
before(async () => { assert.ok(head, 'head script with id i18n-head and style id i18n-wait must exist in app.html'); browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open(lang, { dict = FR, dictStatus = 200 } = {}) {
  const ctx = await browser.newContext();
  const requests = [];
  await ctx.route('http://t.local/**', async (route) => {
    const u = new URL(route.request().url()); requests.push(u.pathname);
    if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: page(lang) });
    if (u.pathname === '/i18n/layer.js') return route.fulfill({ contentType: 'text/javascript', body: layer });
    if (u.pathname.startsWith('/i18n/')) return route.fulfill({ status: dictStatus, contentType: 'application/json', body: JSON.stringify(u.pathname.includes('/ar.') ? AR : dict) });
    return route.fulfill({ status: 404, body: '' });
  });
  const p = await ctx.newPage();
  await p.goto('http://t.local/');
  return { p, requests, ctx };
}
const text = (p, sel) => p.$eval(sel, (e) => e.textContent);

test('French: text, attributes and title are translated and the page shows', async () => {
  const { p, ctx } = await open('fr');
  await p.waitForFunction(() => document.getElementById('h').textContent === 'Lire les essais');
  assert.equal(await p.getAttribute('#q', 'placeholder'), 'Tout rechercher');
  assert.equal(await p.getAttribute('#a', 'title'), 'Ouvrir le lecteur');
  assert.equal(await p.title(), 'Lire les essais');
  assert.equal(await p.getAttribute('html', 'lang'), 'fr');
  assert.equal(await p.evaluate(() => document.documentElement.classList.contains('i18n-wait')), false);
  await ctx.close();
});

test('text added later is translated, textarea and data-no-i18n are left alone', async () => {
  const { p, ctx } = await open('fr');
  await p.waitForFunction(() => window.I18N && document.getElementById('h').textContent === 'Lire les essais');
  await p.evaluate(() => { document.getElementById('dyn').innerHTML = '<b>Saved</b>'; });
  await p.waitForFunction(() => document.querySelector('#dyn b').textContent === 'Enregistré');
  assert.equal(await p.inputValue('#ta'), 'Saved');
  assert.equal(await text(p, '#raw'), 'Read the essays');
  await ctx.close();
});

test('the app changing a translated node to new English gets that translated, not stale French', async () => {
  const { p, ctx } = await open('fr');
  await p.waitForFunction(() => window.I18N && document.getElementById('h').textContent === 'Lire les essais');
  await p.evaluate(() => { document.getElementById('h').firstChild.nodeValue = 'Ready'; });
  await p.waitForFunction(() => document.getElementById('h').textContent === 'Prêt');
  await p.evaluate(() => { document.getElementById('h').firstChild.nodeValue = 'No key for this'; });
  await p.waitForTimeout(100);
  assert.equal(await text(p, '#h'), 'No key for this');
  await ctx.close();
});

test('a missing dictionary still shows the page in English within 1.6 s', async () => {
  const { p, ctx } = await open('fr', { dictStatus: 404 });
  await p.waitForTimeout(1600);
  assert.equal(await p.evaluate(() => document.documentElement.classList.contains('i18n-wait')), false);
  assert.equal(await text(p, '#h'), 'Read the essays');
  await ctx.close();
});

test('English loads no dictionary', async () => {
  const { p, requests, ctx } = await open(null);
  await p.waitForFunction(() => window.I18N);
  assert.equal(requests.filter((r) => r.endsWith('.json')).length, 0);
  assert.equal(await p.getAttribute('html', 'lang'), 'en');
  await ctx.close();
});

test('switching fr → en restores English, → ar is right to left; t() fills placeholders', async () => {
  const { p, ctx } = await open('fr');
  await p.waitForFunction(() => window.I18N && document.getElementById('h').textContent === 'Lire les essais');
  assert.equal(await p.evaluate(() => I18N.t('Hello {name}', { name: 'Ada' })), 'Bonjour Ada');
  await p.evaluate(() => I18N.set('en', { save: false }));
  assert.equal(await text(p, '#h'), 'Read the essays');
  assert.equal(await p.getAttribute('#q', 'placeholder'), 'Search everything');
  assert.equal(await p.evaluate(() => I18N.t('Hello {name}', { name: 'Ada' })), 'Hello Ada');
  await p.evaluate(() => I18N.set('ar', { save: false }));
  assert.equal(await text(p, '#h'), 'اقرأ المقالات');
  assert.equal(await p.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await p.evaluate(() => localStorage.getItem('cwt.lang')), 'ar');
  await ctx.close();
});
