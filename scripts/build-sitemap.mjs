/* Writes dist/sitemap.xml and dist/robots.txt at deploy time, so Google Search Console
 * (verified 1 November 2026, URL prefix https://canwetalkvoice.com) finds every page.
 * The site is one page app, so the pages are the app itself and the two standalone legal pages.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = process.env.SITE_URL || 'https://canwetalkvoice.com';
const OUT = process.env.OUT_DIR || 'dist';
const today = new Date().toISOString().slice(0, 10);
const pages = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'weekly' },
  { loc: `${SITE}/privacy.html`, priority: '0.3', changefreq: 'yearly' },
  { loc: `${SITE}/account-deletion.html`, priority: '0.2', changefreq: 'yearly' },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${p.loc}</loc><lastmod>${today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>
`;
await fs.writeFile(path.join(OUT, 'sitemap.xml'), xml, 'utf8');
await fs.writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');
console.log(`sitemap.xml (${pages.length} pages) and robots.txt written`);
