import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverage } from './i18n-coverage.mjs';

test('counts translated keys and lists the missing ones', () => {
  const en = { Hello: 'Hello', Save: 'Save', 'Sign in': 'Sign in' };
  const fr = { Hello: 'Bonjour', Save: '', Extra: 'x' };
  assert.deepEqual(coverage(en, fr), { covered: 1, total: 3, missing: ['Save', 'Sign in'] });
});

test('a translation that drops a {placeholder} counts as missing', () => {
  const en = { 'Hello {name}': 'Hello {name}' };
  assert.deepEqual(coverage(en, { 'Hello {name}': 'Bonjour' }).missing, ['Hello {name}']);
});
