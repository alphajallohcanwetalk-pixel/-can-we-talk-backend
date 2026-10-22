// The author's editors must always load and save Alpha's English, never a translation the reader
// layer or the API's ?lang= produced. The editors sit behind the author sign in, so this checks the
// source of frontend/app.html for the safe pattern (see the ledger ruling in the languages plan).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/app.html'), 'utf8');
const block = (start, len = 2500) => { const i = app.indexOf(start); assert.ok(i > 0, 'not found: ' + start); return app.slice(i, i + len); };

test('the essay editor fills title, category and excerpt from the English essay', () => {
  const b = block('const e = essays.find(x => x.id === el.dataset.editEssay);');
  assert.match(b, /fetch\(`\$\{API_URL\}\/api\/essays\/\$\{e\.id\}`\)/, 'fetches the essay without ?lang');
  assert.match(b, /newEssayTitle'\)\.value = fullEssay\.title/);
  assert.match(b, /newEssayCategory'\)\.value = fullEssay\.category/);
  assert.match(b, /newEssayExcerpt'\)\.value = fullEssay\.excerpt/);
});

test('the book editor fills subtitle, description and genre from the English originals', () => {
  const b = block('const b = books.find(x => x.id === el.dataset.editBook);', 7000);
  for (const f of ['Subtitle', 'Description', 'Genre']) {
    assert.ok(b.includes(`newBook${f}').value = english('${f.toLowerCase()}')`), f);
  }
});

test('the account menu opens from the left edge of its button in right to left', () => {
  const b = block('function toggleAccountMenu(anchor){', 1200);
  assert.ok(b.includes("document.documentElement.dir === 'rtl'"), 'checks the direction');
  assert.ok(b.includes("m.style.left = Math.max(12, Math.round(r.left)) + 'px'"), 'anchors to the left in rtl');
});
