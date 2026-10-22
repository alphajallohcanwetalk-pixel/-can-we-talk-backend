import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rowsFromContent } from './i18n-content.mjs';

const h = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const source = { essay: [{ id: 'e1', fields: { title: 'Reality Hates Me', full_text: 'Text' } }], book: [{ id: 'b1', title_for_context: 'X', fields: { description: 'About' } }], gallery: [] };

test('rows carry the English hash and status bna, only for fields present in both', () => {
  const rows = rowsFromContent('fr', { essay: { e1: { title: 'La réalité me déteste', full_text: 'Texte', extra: 'x' } }, book: { b1: { description: 'À propos' } } }, source);
  assert.deepEqual(rows, [
    { kind: 'essay', item_id: 'e1', field: 'title', lang: 'fr', text: 'La réalité me déteste', source_hash: h('Reality Hates Me'), status: 'bna' },
    { kind: 'essay', item_id: 'e1', field: 'full_text', lang: 'fr', text: 'Texte', source_hash: h('Text'), status: 'bna' },
    { kind: 'book', item_id: 'b1', field: 'description', lang: 'fr', text: 'À propos', source_hash: h('About'), status: 'bna' },
  ]);
});

test('unknown ids, empty text and bad language codes are skipped', () => {
  assert.deepEqual(rowsFromContent('fr', { essay: { nope: { title: 'x' }, e1: { title: '  ' } } }, source), []);
  assert.throws(() => rowsFromContent('xx', {}, source), /language/);
});
