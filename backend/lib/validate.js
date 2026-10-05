// Shared input checks for the author-facing routes.
//
// These values are written straight into anchor hrefs and image sources on the
// public site, so anything other than a plain http(s) URL is rejected here
// rather than relying on the browser to be forgiving. A `javascript:` href
// stored in site_settings would run for every visitor.

const MAX_URL_LENGTH = 2000;

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

// Returns { ok: true, value } or { ok: false, field }. Empty and null clear the
// field, which is how the author removes a social link.
export function normalizeOptionalUrl(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || (typeof value === 'string' && !value.trim())) return { ok: true, value: null };
  if (!isSafeHttpUrl(value)) return { ok: false };
  return { ok: true, value: value.trim() };
}
