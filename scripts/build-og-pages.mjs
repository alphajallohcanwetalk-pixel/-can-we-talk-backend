/* Generates a small share page per book.
 *
 * The site is a single page app, and social crawlers do not run JavaScript.
 * A link shared to WhatsApp, Facebook or X therefore showed the same generic
 * title and icon whichever book it pointed at.
 *
 * This writes one static file per book at /book/<id>.html carrying that book's
 * own Open Graph tags, so the preview shows the real cover and description. A
 * human landing there is sent straight on to the app.
 *
 * Run at deploy time. If the API is unreachable the build still succeeds with
 * no share pages, because a missing preview must never fail a deploy.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = process.env.API_URL || 'https://can-we-talk-backend.onrender.com';
const SITE = process.env.SITE_URL || 'https://canwetalkvoice.com';
const OUT = process.env.OUT_DIR || 'dist';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const trim = (v, n) => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}...` : t;
};

function page(book) {
  const title = `${book.title}${book.subtitle ? `: ${book.subtitle}` : ''} | Alpha Amadu Jalloh`;
  const description = trim(book.description || 'A book by Alpha Amadu Jalloh, The Misfit Voice.', 300);
  const image = book.cover_image_url || `${SITE}/icons/icon-512-v2.png`;
  const target = `${SITE}/#book-${book.id}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(target)}">

<meta property="og:type" content="book">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(target)}">
<meta property="og:site_name" content="Can We Talk? (The Misfit Voice)">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">

<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Book',
  name: book.title,
  author: { '@type': 'Person', name: 'Alpha Amadu Jalloh' },
  description,
  image,
  url: target,
  ...(book.isbn ? { isbn: book.isbn } : {}),
  ...(book.publisher ? { publisher: { '@type': 'Organization', name: book.publisher } } : {}),
  ...(book.published_date ? { datePublished: book.published_date } : {}),
  ...(book.page_count ? { numberOfPages: book.page_count } : {}),
  ...(book.language ? { inLanguage: book.language } : {})
}, null, 2)}
</script>

<!-- A person who opens this goes straight to the app; a crawler stops above. -->
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
<style>
  body{margin:0;background:#faf8f2;color:#12190f;
    font:16px/1.7 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;}
  a{color:#0c3d22;}
</style>
</head>
<body>
  <div>
    <h1>${esc(book.title)}</h1>
    <p>Taking you to the book. <a href="${esc(target)}">Continue</a> if nothing happens.</p>
  </div>
</body>
</html>
`;
}

async function main() {
  let books = [];
  try {
    const res = await fetch(`${API}/api/books`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    books = await res.json();
  } catch (error) {
    // A share preview is a nice to have. Never fail the deploy over it.
    console.log(`Share pages skipped: ${error.message}`);
    return;
  }

  if (!Array.isArray(books) || !books.length) {
    console.log('Share pages skipped: no books returned');
    return;
  }

  const dir = path.join(OUT, 'book');
  await fs.mkdir(dir, { recursive: true });
  for (const book of books) {
    if (!book?.id) continue;
    await fs.writeFile(path.join(dir, `${book.id}.html`), page(book), 'utf8');
    console.log(`  /book/${book.id}.html  ${book.title}`);
  }
  console.log(`Share pages written: ${books.length}`);
}

main();
