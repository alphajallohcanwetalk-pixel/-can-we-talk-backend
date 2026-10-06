// Shared input checks for the author-facing routes.
//
// These values are written straight into anchor hrefs and image sources on the
// public site, so anything other than a plain http(s) URL is rejected here
// rather than relying on the browser to be forgiving. A `javascript:` href
// stored in site_settings would run for every visitor.

const MAX_URL_LENGTH = 2000;

// House style: no em dashes, en dashes or the lookalikes that creep in when
// text is pasted from Word, Google Docs or an AI assistant. They were stripped
// from the site once; this keeps them from coming back through the dashboard.
//
// A dash joining two clauses becomes a comma, which never produces broken
// grammar. A dash used as a range ("1999 - 2004") becomes "to".
// Note: no `g` flag on the detector. RegExp.test() with a global flag keeps a
// lastIndex between calls, so a shared global regex returns false on every
// other call and half the strings would slip through unchanged.
const HAS_DASH = /[\u2012\u2013\u2014\u2015\u2212\u2010\u2011]/;

export function stripDashes(value) {
  if (typeof value !== 'string' || !HAS_DASH.test(value)) return value;
  return value
    // A range between two numbers reads better as "to".
    .replace(/(\d)\s*[\u2012\u2013\u2014\u2015\u2212\u2010\u2011]\s*(\d)/g, '$1 to $2')
    // U+2010 and U+2011 are true hyphens: they join one word to another
    // ("non-breaking"), so a comma would be wrong. Use a space.
    .replace(/(\w)[\u2010\u2011](\w)/g, '$1 $2')
    // Everything else is a dash separating clauses, where a comma is right.
    .replace(/\s*[\u2012\u2013\u2014\u2015\u2212\u2010\u2011]\s*/g, ', ')
    // Tidy up the punctuation that substitution can leave behind.
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/,\s*([.!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Applies stripDashes to the named fields of an object, in place.
export function cleanTextFields(obj, fields) {
  if (!obj) return obj;
  for (const f of fields) {
    if (typeof obj[f] === 'string') obj[f] = stripDashes(obj[f]);
  }
  return obj;
}

export function isSafeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_URL_LENGTH) return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

// Turns whatever the author pasted into a normalised video list.
//
// Accepts a YouTube or Vimeo page link and stores the embeddable form, so the
// dashboard can take the URL straight from the browser address bar rather than
// asking for an embed code. A direct file URL is kept as a playable source.
// Anything that is not http(s) is dropped rather than rejected, so one bad line
// does not fail the whole save.
export function normalizeVideoList(value) {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value)
    ? value
    : String(value || '').split(/[\r\n]+/);

  const out = [];
  for (const entry of raw.slice(0, 24)) {
    const url = (typeof entry === 'string' ? entry : entry?.url || '').trim();
    const title = (typeof entry === 'object' && entry?.title) ? String(entry.title).slice(0, 200) : '';
    if (!isSafeHttpUrl(url)) continue;

    let parsed;
    try { parsed = new URL(url); } catch { continue; }
    const host = parsed.hostname.replace(/^www\./, '');
    let type = 'file';
    let embed = url;

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
      if (id) { type = 'embed'; embed = `https://www.youtube.com/embed/${id}`; }
    } else if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      if (id) { type = 'embed'; embed = `https://www.youtube.com/embed/${id}`; }
    } else if (host === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      if (/^\d+$/.test(id || '')) { type = 'embed'; embed = `https://player.vimeo.com/video/${id}`; }
    } else if (/\.(mp4|webm|ogg|mov)$/i.test(parsed.pathname)) {
      type = 'file';
    } else {
      // An unrecognised page link is kept as a plain outbound link rather than
      // being forced into an iframe that will refuse to load.
      type = 'link';
    }

    out.push({ type, url: embed, source: url, title });
  }
  return out;
}

// Returns { ok: true, value } or { ok: false, field }. Empty and null clear the
// field, which is how the author removes a social link.
export function normalizeOptionalUrl(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || (typeof value === 'string' && !value.trim())) return { ok: true, value: null };
  if (!isSafeHttpUrl(value)) return { ok: false };
  return { ok: true, value: value.trim() };
}
