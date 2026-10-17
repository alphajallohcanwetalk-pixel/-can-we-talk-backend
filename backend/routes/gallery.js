import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { isSafeHttpUrl, cleanTextFields, normalizeVideoList } from '../lib/validate.js';

const router = express.Router();

// The author's gallery: photos, videos and documents (newspaper articles, letters), from events,
// his own articles and the media. Since migration 015 an item can be linked to a book or an essay
// (it then also shows on that page), a document can have several pages, the title is optional,
// and a photo can be left out of the gallery slideshow.
//
// Works before migration 015 too: reads fall back to the old columns and writes drop the new ones.

const SECTIONS = ['event', 'article', 'media'];
const KINDS = ['photo', 'video', 'document', 'link'];
const OLD_COLUMNS = 'id,section,media_type,title,caption,outlet,image_url,video_url,link_url,event_date,sort_order,created_at';
const COLUMNS = `${OLD_COLUMNS},book_id,essay_id,pages,in_slideshow`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEW_FIELDS = ['book_id', 'essay_id', 'pages', 'in_slideshow'];

// Files in our own Storage that an item uses: the photo or video picture, the pages, the video.
const STORAGE_RE = /\/storage\/v1\/object\/public\/(covers|media)\/(gallery(?:-video)?\/[^?#]+)$/;
function filesOf(item) {
  return [item?.image_url, item?.video_url, ...(Array.isArray(item?.pages) ? item.pages : [])]
    .map((u) => String(u || '').match(STORAGE_RE)).filter(Boolean)
    .map((m) => ({ bucket: m[1], path: decodeURIComponent(m[2]) }));
}
// Deletes files nothing in the gallery uses any more, so a deleted or replaced picture is gone
// everywhere, Storage included. Runs after the answer is sent; a failure only leaves a spare file.
async function removeUnused(files) {
  if (!files.length) return;
  const { data, error } = await supabaseAdmin.from('gallery_items').select('image_url,video_url,pages');
  if (error) return;
  const used = new Set((data || []).flatMap((r) => filesOf(r).map((f) => `${f.bucket}/${f.path}`)));
  const byBucket = {};
  for (const f of files) if (!used.has(`${f.bucket}/${f.path}`)) (byBucket[f.bucket] ||= new Set()).add(f.path);
  await Promise.all(Object.entries(byBucket).map(([bucket, paths]) => supabaseAdmin.storage.from(bucket).remove([...paths])));
}
const cleanUp = (files) => { removeUnused(files).catch((e) => console.warn('Gallery file clean up:', e.message)); };

const urlOrNull = (v) => (isSafeHttpUrl(v) ? String(v).trim() : null);
const isMissingColumn = (error) => /book_id|essay_id|pages|in_slideshow|column .* does not exist|schema cache/i.test(error?.message || '');
const isOldConstraint = (error) => /gallery_items_(title|media_type)_check|null value in column "title"/i.test(error?.message || '');

// A pasted YouTube or Vimeo page link becomes its embeddable form; an uploaded file URL is kept.
function videoFrom(value) {
  if (!value) return { video_url: null, kind: null };
  const [first] = normalizeVideoList([value]) || [];
  if (!first) return { video_url: null, kind: null };
  if (first.type === 'link') return { video_url: null, kind: 'link', link: first.source };
  return { video_url: first.url, kind: first.type };
}

function readItem(body) {
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 300) : '';
  const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 2000) : null;
  const outlet = typeof body.outlet === 'string' ? body.outlet.trim().slice(0, 200) : null;
  const image_url = urlOrNull(body.image_url);
  const pages = Array.isArray(body.pages) ? body.pages.map(urlOrNull).filter(Boolean).slice(0, 40) : [];
  const video = videoFrom(body.video_url);
  const link_url = urlOrNull(body.link_url) || (video.kind === 'link' ? video.link : null);
  const date = typeof body.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.event_date) ? body.event_date : null;
  if (!image_url && !video.video_url && !link_url) return { error: 'Add a photo, a video, a document or a link' };
  const wanted = KINDS.includes(body.kind) ? body.kind : null;
  const media_type = video.video_url ? 'video' : wanted === 'document' && image_url ? 'document' : image_url ? 'photo' : 'link';
  // Documents (newspapers, letters) default to "In the media"; everything else to "Event".
  const section = SECTIONS.includes(body.section) ? body.section : media_type === 'document' ? 'media' : 'event';
  return {
    item: cleanTextFields({
      section, media_type, title: title || null, caption: caption || null, outlet: outlet || null,
      image_url, video_url: video.video_url, link_url, event_date: date,
      sort_order: Number.isInteger(body.sort_order) ? body.sort_order : 0,
      book_id: UUID_RE.test(body.book_id || '') ? body.book_id : null,
      essay_id: UUID_RE.test(body.essay_id || '') ? body.essay_id : null,
      pages,
      in_slideshow: body.in_slideshow === undefined ? media_type === 'photo' : Boolean(body.in_slideshow),
    }, ['title', 'caption', 'outlet']),
  };
}

// Before migration 015: drop the new fields, keep a title (it was required) and the old kinds.
function legacy(item) {
  const old = { ...item };
  NEW_FIELDS.forEach((f) => delete old[f]);
  if (old.media_type === 'document') old.media_type = 'photo';
  if (!old.title) old.title = old.media_type === 'video' ? 'Video' : old.section === 'media' ? 'In the media' : 'Photo';
  return old;
}

async function write(query, item) {
  let r = await query(item);
  if (r.error && (isMissingColumn(r.error) || isOldConstraint(r.error))) r = await query(legacy(item));
  return r;
}

// GET /api/gallery?section=event|article|media&book_id=&essay_id=  (public)
router.get('/', async (req, res) => {
  const build = (cols) => {
    let q = supabaseAdmin.from('gallery_items').select(cols);
    if (SECTIONS.includes(req.query.section)) q = q.eq('section', req.query.section);
    if (cols === COLUMNS && UUID_RE.test(req.query.book_id || '')) q = q.eq('book_id', req.query.book_id);
    if (cols === COLUMNS && UUID_RE.test(req.query.essay_id || '')) q = q.eq('essay_id', req.query.essay_id);
    return q.order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(500);
  };
  let { data, error } = await build(COLUMNS);
  if (error && isMissingColumn(error)) ({ data, error } = await build(OLD_COLUMNS));
  // Before migration 014 the table does not exist: an empty gallery rather than an error page.
  if (error) return res.json([]);
  // Always checked with the server (a cheap 304 when nothing changed), so an edit or a deletion
  // shows at once rather than after a cached copy runs out.
  res.set('Cache-Control', 'no-cache');
  res.json(data);
});

router.post('/', requireAuth, requireAuthor, async (req, res) => {
  const { item, error: invalid } = readItem(req.body || {});
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await write((row) => supabaseAdmin.from('gallery_items').insert(row).select('*').single(), item);
  if (error) {
    const missing = /gallery_items/.test(error.message || '');
    return res.status(500).json({ error: missing ? 'Run migration 014 in Supabase first.' : error.message });
  }
  res.status(201).json(data);
});

router.put('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { item, error: invalid } = readItem(req.body || {});
  if (invalid) return res.status(400).json({ error: invalid });
  const { data: before } = await supabaseAdmin.from('gallery_items').select('*').eq('id', req.params.id).maybeSingle();
  const { data, error } = await write((row) => supabaseAdmin.from('gallery_items').update(row).eq('id', req.params.id).select('*').single(), item);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
  // A replaced photo, page, video or picture: delete the old file.
  const kept = new Set(filesOf(data).map((f) => `${f.bucket}/${f.path}`));
  cleanUp(filesOf(before).filter((f) => !kept.has(`${f.bucket}/${f.path}`)));
});

router.delete('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { data: before } = await supabaseAdmin.from('gallery_items').select('*').eq('id', req.params.id).maybeSingle();
  const { error } = await supabaseAdmin.from('gallery_items').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
  cleanUp(filesOf(before));
});

export default router;
