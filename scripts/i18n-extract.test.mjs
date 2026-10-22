import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractStrings } from './i18n-extract.mjs';

const page = `<!doctype html><html><head><title>Can We Talk?</title><style>.a{color:red}</style></head>
<body><h1>Read the essays</h1><p>Short   and
  clear</p><input placeholder="Search everything" aria-label="Search"><img alt="Cover of the book" src="x.png">
<a href="#x" title="Open the reader">Open</a><span>12</span><span>https://x.com</span>
<script>const a = 1;</script>
<script data-main>
  say('Slow connection. Mending the line…');
  el.textContent = "Saved";
  const sel = document.querySelector('.np-text');
  const html = '<p class="m">Nothing here yet</p>';
  const tpl = \`<b>Welcome back</b> \${name}\`;
  fetch('/api/essays'); x.classList.add('on'); const k = 'cwt.lang';
</script></body></html>`;

test('collects visible text, attributes and prose literals', () => {
  const s = extractStrings(page);
  for (const want of ['Can We Talk?', 'Read the essays', 'Short and clear', 'Search everything', 'Search',
    'Cover of the book', 'Open the reader', 'Open', 'Slow connection. Mending the line…', 'Saved',
    'Nothing here yet', 'Welcome back']) assert.ok(s.includes(want), 'missing: ' + want);
});

test('skips code, numbers, urls, selectors and css', () => {
  const s = extractStrings(page);
  for (const bad of ['12', 'https://x.com', '.np-text', '/api/essays', 'on', 'cwt.lang', 'const a = 1;', '.a{color:red}', 'm', 'x.png'])
    assert.ok(!s.includes(bad), 'should skip: ' + bad);
});

test('returns unique sorted strings', () => {
  const s = extractStrings(page + page);
  assert.deepEqual(s, [...new Set(s)].sort());
});

test('server strings: t(lang, ...) calls and notification titles', async () => {
  const { extractServerStrings } = await import('./i18n-extract.mjs');
  const code = `const a = t(lang, 'Welcome, {name}', { name });
    t(l, "Order confirmed: #{number}", x); esc(t(lang, "Your order will ship within 2 business days. We'll email tracking details once it's on its way."));
    announce({ title: essay.audio_url ? 'New audio essay' : 'New essay', body: essay.title });
    console.log('not this');`;
  const s = extractServerStrings(code);
  for (const want of ['Welcome, {name}', 'Order confirmed: #{number}', "Your order will ship within 2 business days. We'll email tracking details once it's on its way.", 'New audio essay', 'New essay'])
    assert.ok(s.includes(want), 'missing: ' + want);
  assert.ok(!s.includes('not this'));
});
