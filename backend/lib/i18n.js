// Languages on the API side.
// - reqLang: the language a request asks for (?lang= or the x-cwt-lang header the site sends).
// - translateRows: Alpha's content (essays, books, gallery) in that language, from content_translations
//   (migration 016). A translation of an older English text is still shown, marked _stale, until it is
//   translated again. The English originals travel along in _en (search and "Read the original").
// - t: the API's own sentences (emails, notifications) from backend/i18n/<code>.json, the same
//   dictionaries as the site (copied by scripts/i18n-extract.mjs).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const LANGS = ['en', 'fr', 'pt', 'es', 'ar', 'de', 'it', 'nl', 'ru', 'zh', 'hi', 'tr', 'id', 'sw', 'ha', 'yo', 'ig',
  'pcm', 'kri', 'tem', 'men', 'ff', 'wo', 'ak', 'am', 'so', 'zu', 'af'];
const KNOWN = new Set(LANGS);

export function isLang(code) { return typeof code === 'string' && KNOWN.has(code); }

export function reqLang(req) {
  const q = req?.query?.lang;
  if (isLang(q)) return q;
  const h = req?.headers?.['x-cwt-lang'];
  if (isLang(h)) return h;
  return 'en';
}

export function hashText(s) {
  return createHash('sha256').update(String(s ?? '')).digest('hex').slice(0, 16);
}

async function loadFromDb(kind, ids, lang) {
  const { supabaseAdmin } = await import('./supabase.js');
  const { data, error } = await supabaseAdmin.from('content_translations')
    .select('item_id,field,text,source_hash').eq('kind', kind).eq('lang', lang).in('item_id', ids);
  if (error) throw error;
  return data || [];
}

/** Copies of rows with fields replaced by their translation into lang, where one exists. */
export async function translateRows(kind, rows, fields, lang, { load = loadFromDb } = {}) {
  if (!Array.isArray(rows) || !rows.length || lang === 'en' || !isLang(lang)) return rows;
  let found;
  try { found = await load(kind, rows.map((r) => String(r.id)), lang); } catch { return rows; }
  const by = new Map(found.map((t) => [`${t.item_id}|${t.field}`, t]));
  return rows.map((row) => {
    const out = { ...row };
    for (const f of fields) {
      const tr = by.get(`${row.id}|${f}`);
      if (!tr || !tr.text || row[f] == null || row[f] === '') continue;
      (out._en ||= {})[f] = row[f];
      out[f] = tr.text;
      (out._translated ||= {})[f] = true;
      if (tr.source_hash !== hashText(row[f])) (out._stale ||= {})[f] = true;
    }
    if (out._translated) out._lang = lang;
    return out;
  });
}

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../i18n');
const cache = {};
function dictFor(lang) {
  if (!(lang in cache)) {
    try { cache[lang] = JSON.parse(readFileSync(path.join(DIR, `${lang}.json`), 'utf8')); } catch { cache[lang] = {}; }
  }
  return cache[lang];
}

/** The API's own text in lang; English when there is no translation. {name} style values are filled in. */
export function t(lang, english, values, dicts) {
  const d = lang === 'en' || !isLang(lang) ? null : (dicts ? dicts[lang] : dictFor(lang));
  const s = (d && d[english]) || english;
  return values ? s.replace(/\{([a-z]+)\}/gi, (m, k) => (values[k] != null ? String(values[k]) : m)) : s;
}

/** Tests: use these dictionaries instead of the files. */
export function useDicts(dicts) { for (const k of Object.keys(cache)) delete cache[k]; Object.assign(cache, dicts); }
