// Loads translations of Alpha's content (essays, books, gallery) into content_translations (migration 016).
// Input: the English export (content-en.json: { essay|book|gallery: [{ id, fields: { field: English } }] })
// and one file per language (content.<code>.json: { essay|book|gallery: { id: { field: text } } }).
// Each row stores a hash of the English it was translated from, so a later edit shows as stale.
// Uses the API's service key from backend/.env. Usage:
//   node scripts/i18n-content.mjs <content-en.json> <folder with content.<code>.json files>
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LANGS = new Set(['fr', 'pt', 'es', 'ar', 'de', 'it', 'nl', 'ru', 'zh', 'hi', 'tr', 'id', 'sw', 'ha', 'yo', 'ig',
  'pcm', 'kri', 'tem', 'men', 'ff', 'wo', 'ak', 'am', 'so', 'zu', 'af']);
const hash = (s) => createHash('sha256').update(String(s ?? '')).digest('hex').slice(0, 16);

export function rowsFromContent(lang, content, source) {
  if (!LANGS.has(lang)) throw new Error('Unknown language: ' + lang);
  const rows = [];
  for (const kind of ['essay', 'book', 'gallery']) {
    for (const item of source[kind] || []) {
      const tr = content[kind]?.[item.id];
      if (!tr) continue;
      for (const [field, english] of Object.entries(item.fields)) {
        const text = tr[field];
        if (typeof text !== 'string' || !text.trim()) continue;
        rows.push({ kind, item_id: String(item.id), field, lang, text, source_hash: hash(english), status: 'bna' });
      }
    }
  }
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [srcFile, dir] = process.argv.slice(2);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const req = createRequire(path.join(root, 'backend', 'package.json'));
  req('dotenv').config({ path: path.join(root, 'backend', '.env') });
  const { createClient } = req('@supabase/supabase-js');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const source = JSON.parse(readFileSync(srcFile, 'utf8'));
  let total = 0;
  for (const f of readdirSync(dir).filter((f) => /^content\.[a-z]{2,3}\.json$/.test(f)).sort()) {
    const lang = f.split('.')[1];
    const rows = rowsFromContent(lang, JSON.parse(readFileSync(path.join(dir, f), 'utf8')), source);
    const { error } = await db.from('content_translations').upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })));
    if (error) { console.error(lang, error.message); process.exitCode = 1; continue; }
    total += rows.length;
    console.log(`${lang}: ${rows.length} fields`);
  }
  console.log(`content_translations: ${total} rows written`);
}
