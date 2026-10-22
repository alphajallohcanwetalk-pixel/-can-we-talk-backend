import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, reqLang, hashText, translateRows, t } from './i18n.js';

test('28 languages, English first', () => {
  assert.equal(LANGS.length, 28);
  assert.equal(LANGS[0], 'en');
  for (const c of ['fr', 'ar', 'kri', 'pcm', 'sw', 'zu']) assert.ok(LANGS.includes(c));
});

test('reqLang reads ?lang, then the x-cwt-lang header, and refuses unknown codes', () => {
  assert.equal(reqLang({ query: { lang: 'fr' }, headers: {} }), 'fr');
  assert.equal(reqLang({ query: {}, headers: { 'x-cwt-lang': 'kri' } }), 'kri');
  assert.equal(reqLang({ query: { lang: 'zz' }, headers: { 'x-cwt-lang': 'sw' } }), 'sw');
  assert.equal(reqLang({ query: { lang: ['fr', 'de'] }, headers: {} }), 'en');
  assert.equal(reqLang({ query: {}, headers: {} }), 'en');
});

test('hashText is stable and short', () => {
  assert.equal(hashText('Hello'), hashText('Hello'));
  assert.notEqual(hashText('Hello'), hashText('Hello.'));
  assert.equal(hashText('x').length, 16);
});

const essay = { id: 'e1', title: 'Reality Hates Me', excerpt: 'Short', full_text: 'Long text' };
const rows = (over = {}) => [{ kind: 'essay', item_id: 'e1', field: 'title', lang: 'fr', text: 'La réalité me déteste', source_hash: hashText('Reality Hates Me'), ...over }];

test('translateRows swaps translated fields and marks them', async () => {
  const [r] = await translateRows('essay', [essay], ['title', 'excerpt'], 'fr', { load: async () => rows() });
  assert.equal(r.title, 'La réalité me déteste');
  assert.equal(r.excerpt, 'Short');
  assert.deepEqual(r._translated, { title: true });
  assert.equal(r._lang, 'fr');
  assert.equal(essay.title, 'Reality Hates Me', 'the input row is not changed');
  assert.deepEqual(r._en, { title: 'Reality Hates Me' }, 'the English original travels along');
});

test('a translation of an older English text is still shown, marked stale', async () => {
  const [r] = await translateRows('essay', [essay], ['title'], 'fr', { load: async () => rows({ source_hash: 'old' }) });
  assert.equal(r.title, 'La réalité me déteste');
  assert.deepEqual(r._stale, { title: true });
});

test('English, empty lists and failed lookups return the rows unchanged', async () => {
  let called = false;
  const load = async () => { called = true; return rows(); };
  assert.deepEqual(await translateRows('essay', [essay], ['title'], 'en', { load }), [essay]);
  assert.equal(called, false);
  assert.deepEqual(await translateRows('essay', [], ['title'], 'fr', { load }), []);
  const [r] = await translateRows('essay', [essay], ['title'], 'fr', { load: async () => { throw new Error('table missing'); } });
  assert.equal(r.title, 'Reality Hates Me');
});

test('t() translates server text from the dictionaries and fills values', () => {
  const dicts = { fr: { 'Hello {name}': 'Bonjour {name}' } };
  assert.equal(t('fr', 'Hello {name}', { name: 'Ada' }, dicts), 'Bonjour Ada');
  assert.equal(t('de', 'Hello {name}', { name: 'Ada' }, dicts), 'Hello Ada');
  assert.equal(t('en', 'Hello {name}', { name: 'Ada' }, dicts), 'Hello Ada');
});
