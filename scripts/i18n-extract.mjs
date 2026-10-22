// Collects every English string a reader can see, so it can be translated.
// Sources: frontend/app.html, privacy.html, account-deletion.html (visible text, the attributes
// placeholder, title, aria-label and alt, and prose string literals in the scripts, including HTML
// built in JS). Writes frontend/i18n/en.json ({ "English": "English" }, sorted). The translation layer
// (frontend/i18n/layer.js) swaps exact matches, so a string collected here that never shows is harmless.
//
// Usage: node scripts/i18n-extract.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', middot: '·', copy: '©', mdash: ' ', ndash: ' ' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m));
const clean = (s) => decode(s).replace(/\s+/g, ' ').trim();

/** Is this something a person reads, rather than code, a class, a URL or a number? */
export function isProse(s) {
  if (!s || s.length < 2 || !/\p{L}/u.test(s)) return false;
  if (/^(https?:|mailto:|tel:|data:|\/|#|\.|\?)/.test(s)) return false;
  if (/[{}<>=;`$\\]|=>|\(\)/.test(s)) return false;
  if (/[a-z][A-Z]/.test(s) && !/\s/.test(s)) return false; // camelCase identifier
  if (!/\s/.test(s)) {
    // One word: a capitalised word (optionally with closing punctuation) or short all caps like OK.
    return /^\p{Lu}[\p{Ll}’']+[.!?…:]?$/u.test(s) || /^(OK|FAQ|PDF|ISBN|PIN)$/.test(s);
  }
  const words = s.split(' ');
  // Class lists, event lists and CSS values: every word lowercase code-like, at least one with a hyphen or digit.
  if (words.every((w) => /^[a-z0-9.%#-]+$/.test(w)) && words.some((w) => /[-0-9.%#]/.test(w))) return false;
  return true;
}

function fromHtml(html, out) {
  html = html.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const m of html.matchAll(/\s(?:placeholder|title|aria-label|alt)\s*=\s*(["'])(.*?)\1/gis)) {
    const s = clean(m[2]); if (isProse(s)) out.add(s);
  }
  for (const part of html.replace(/<[^>]*>/g, '\u0000').split('\u0000')) {
    const s = clean(part); if (isProse(s)) out.add(s);
  }
}

/** String literals in JS source: '..', "..", and the static parts of `..${}..`. */
function literals(code) {
  const found = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  for (const m of code.matchAll(re)) {
    if (m[1] !== undefined) found.push(m[1]);
    else if (m[2] !== undefined) found.push(m[2]);
    else if (m[3] !== undefined) found.push(...m[3].split(/\$\{[^}]*\}/));
  }
  return found.map((s) => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, ' '));
}

/** The API's own reader facing text: first arguments of t(lang, '...') and notification titles. */
export function extractServerStrings(code) {
  const out = new Set();
  const lit = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`;
  const unescape = (s) => s.replace(/\\(['"\\])/g, '$1');
  for (const m of code.matchAll(new RegExp(String.raw`\bt\(\s*\w+\s*,\s*(?:` + lit + ')', 'g'))) out.add(unescape(m[1] ?? m[2]));
  for (const m of code.matchAll(/announce\(\{\s*title:\s*([^\n]*?),\s*body:/g)) {
    for (const q of m[1].matchAll(new RegExp(lit, 'g'))) out.add(unescape(q[1] ?? q[2]));
  }
  return [...out].sort();
}

export function extractStrings(html) {
  const out = new Set();
  const scripts = [];
  const page = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, code) => { scripts.push(code); return ' '; });
  fromHtml(page, out);
  for (const code of scripts) {
    // tx('Page {n} of {total}', …): patterns with values, which the prose filter would refuse.
    const TX = new RegExp(String.raw`\btx\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`, 'g');
    for (const m of code.matchAll(TX)) out.add(clean((m[1] ?? m[2]).replace(/\\(['"\\])/g, '$1')));
    for (const lit of literals(code)) {
      if (/<[a-z][^>]*>|<\/[a-z]+>/i.test(lit)) fromHtml(lit, out);
      else { const s = clean(lit); if (isProse(s)) out.add(s); }
    }
  }
  return [...out].sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const all = new Set();
  for (const f of ['frontend/app.html', 'frontend/privacy.html', 'frontend/account-deletion.html', 'frontend/i18n/layer.js'].map((f) => path.join(root, f))) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const s of extractStrings(f.endsWith('.js') ? `<script>${src}</script>` : src)) all.add(s);
  }
  // The API's emails and notifications (t(lang, '...') calls and announce titles).
  for (const dir of ['backend/lib', 'backend/routes']) {
    for (const f of readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))) {
      for (const s of extractServerStrings(readFileSync(path.join(root, dir, f), 'utf8'))) all.add(s);
    }
  }
  const sorted = [...all].sort();
  mkdirSync(path.join(root, 'frontend/i18n'), { recursive: true });
  writeFileSync(path.join(root, 'frontend/i18n/en.json'), JSON.stringify(Object.fromEntries(sorted.map((s) => [s, s])), null, 1) + '\n');
  console.log(`en.json: ${sorted.length} strings`);
  // The API reads the same dictionaries (backend/lib/i18n.js t()); Render deploys only backend/.
  mkdirSync(path.join(root, 'backend/i18n'), { recursive: true });
  const dicts = readdirSync(path.join(root, 'frontend/i18n')).filter((f) => /^[a-z]{2,3}\.json$/.test(f) && f !== 'en.json');
  for (const f of dicts) copyFileSync(path.join(root, 'frontend/i18n', f), path.join(root, 'backend/i18n', f));
  console.log(`backend/i18n: ${dicts.length} dictionaries copied`);
}
