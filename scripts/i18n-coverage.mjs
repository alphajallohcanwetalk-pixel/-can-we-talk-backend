// How much of the site each language covers. Usage: node scripts/i18n-coverage.mjs [code] [--list]
// Reports every frontend/i18n/<code>.json against en.json. Never fails the publish: run it before a push.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DRAFT = new Set(['pcm', 'kri', 'tem', 'men', 'ff', 'wo', 'ak', 'am', 'so']);
const holes = (s) => (s.match(/\{[a-z]+\}/gi) || []).sort().join();

export function coverage(en, dict) {
  const missing = Object.keys(en).filter((k) => !dict[k] || holes(dict[k]) !== holes(k));
  return { covered: Object.keys(en).length - missing.length, total: Object.keys(en).length, missing };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/i18n');
  const en = JSON.parse(readFileSync(path.join(dir, 'en.json'), 'utf8'));
  const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  for (const f of readdirSync(dir).filter((f) => /^[a-z]{2,3}\.json$/.test(f) && f !== 'en.json').sort()) {
    const code = f.slice(0, -5);
    if (only && code !== only) continue;
    const c = coverage(en, JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
    console.log(`${code.padEnd(4)}${DRAFT.has(code) ? 'draft   ' : 'finished'} ${c.covered}/${c.total}` +
      (c.missing.length ? `  missing ${c.missing.length}${process.argv.includes('--list') ? ': ' + JSON.stringify(c.missing) : ''}` : ''));
  }
}
