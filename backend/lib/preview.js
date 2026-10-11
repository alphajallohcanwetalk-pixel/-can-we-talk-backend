// The free preview of a book: everything before the story starts (title page,
// dedication, contents, acknowledgements, foreword and the like), plus the
// first page of the first chapter. Nothing after that until the reader buys
// the eBook or joins the Book Club.

// Roughly one printed page of body text.
export const FIRST_PAGE_CHARS = 1800;
// Front matter longer than this is not front matter; stop guessing.
const FRONT_MATTER_LIMIT = 30000;

const CHAPTER_ONE = /^[ \t]*(?:chapter|CHAPTER|Chapter)[ \t]+(?:1|one|One|ONE|i|I)\b[^\n]*$/gm;
const ANY_CHAPTER = /^[ \t]*(?:chapter|CHAPTER|Chapter)[ \t]+\S+[^\n]*$/gm;
const OPENING = /^[ \t]*(?:prologue|PROLOGUE|Prologue|part one|PART ONE|Part One|part 1|PART 1|Part 1)\b[^\n]*$/gm;

// Where the body of the book begins. A table of contents also lists
// "Chapter One", so the last such heading is taken: the contents come first,
// the real chapter after.
export function mainTextStart(text) {
  const pick = (re) => {
    const hits = [...text.matchAll(re)].filter((m) => m.index <= FRONT_MATTER_LIMIT + 2000);
    if (!hits.length) return -1;
    // Prefer a heading followed by real prose rather than the next heading.
    for (let i = hits.length - 1; i >= 0; i--) {
      const after = text.slice(hits[i].index + hits[i][0].length, hits[i].index + hits[i][0].length + 400);
      if (after.replace(/\s+/g, ' ').trim().length > 200 && !/^\s*(?:chapter|contents)\b/i.test(after)) return hits[i].index;
    }
    return hits[hits.length - 1].index;
  };
  for (const re of [CHAPTER_ONE, OPENING, ANY_CHAPTER]) {
    const at = pick(re);
    if (at >= 0) return Math.min(at, FRONT_MATTER_LIMIT);
  }
  return 0;
}

// Cuts at the last full sentence before `end`, never before `min`.
function cutAtSentence(text, end, min) {
  if (end >= text.length) return text;
  const slice = text.slice(0, end);
  const ends = [...slice.matchAll(/[.!?]["'”’)\]]*(?=\s)/g)];
  for (let i = ends.length - 1; i >= 0; i--) {
    const at = ends[i].index + ends[i][0].length;
    if (at >= min) return slice.slice(0, at);
  }
  const para = slice.lastIndexOf('\n\n');
  return para > min ? slice.slice(0, para) : slice;
}

// overrideChars: a length the author chose in the dashboard. 0 means automatic.
export function bookPreview(fullText, overrideChars = 0) {
  const full = String(fullText || '');
  if (!full.trim()) return '';
  if (overrideChars > 0) return cutAtSentence(full, overrideChars, Math.floor(overrideChars * 0.5));
  const start = mainTextStart(full);
  return cutAtSentence(full, start + FIRST_PAGE_CHARS, start + 300);
}
