import { test } from 'node:test';
import assert from 'node:assert/strict';
// push.js makes a database client on import; dummy settings are enough (nothing connects here).
process.env.SUPABASE_URL ||= 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test';
const { groupByLanguage } = await import('./push.js');

test('devices are grouped by their account language; devices without an account get English', () => {
  const subs = [{ id: 1, user_id: 'a' }, { id: 2, user_id: 'b' }, { id: 3, user_id: null }, { id: 4, user_id: 'a' }];
  const g = groupByLanguage(subs, { a: 'fr', b: 'zz' });
  assert.deepEqual([...g.keys()].sort(), ['en', 'fr']);
  assert.deepEqual(g.get('fr').map((s) => s.id), [1, 4]);
  assert.deepEqual(g.get('en').map((s) => s.id), [2, 3]);
});
