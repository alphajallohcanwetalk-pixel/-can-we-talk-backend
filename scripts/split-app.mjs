// Publishing step for the site (run by .github/workflows/deploy-pages.yml).
// frontend/app.html stays one file to edit. Here its main script (<script data-main>, about 290 KB)
// is moved into its own file named after its content, app-<hash>.js, and both it and the sign in
// library are loaded from the head with defer. Phones then paint the page before reading the
// script, and repeat visits take the script from cache. defer keeps the order: the library runs
// first, then the main script, both after the page is parsed, as before.
//
// Usage: node scripts/split-app.mjs frontend/app.html dist
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [src, outDir] = process.argv.slice(2);
let html = readFileSync(src, 'utf8');

const open = '<script data-main>';
const start = html.indexOf(open);
if (start < 0) throw new Error('No <script data-main> in ' + src);
const end = html.indexOf('</script>', start);
const code = html.slice(start + open.length, end);
const name = `app-${createHash('sha256').update(code).digest('hex').slice(0, 10)}.js`;
writeFileSync(path.join(outDir, name), code, 'utf8');
html = html.slice(0, start) + html.slice(end + '</script>'.length);

// The source uses a relative path (so app.html still previews from the folder); the site uses /vendor/.
const lib = html.match(/<script src="\/?(vendor\/supabase-js-[^"]+)"><\/script>\n?/);
if (!lib) throw new Error('Sign in library tag not found');
html = html.replace(lib[0], '');
html = html.replace('</head>', `<script defer src="/${lib[1]}"></script>\n<script defer src="/${name}"></script>\n</head>`);

writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
// GitHub Pages answers unknown paths with 404.html; the app routes by hash, so it gets the same shell.
writeFileSync(path.join(outDir, '404.html'), html, 'utf8');
console.log(`index.html ${Math.round(html.length / 1024)} KB, ${name} ${Math.round(code.length / 1024)} KB`);
