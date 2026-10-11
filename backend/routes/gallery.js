import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { isSafeHttpUrl, cleanTextFields, normalizeVideoList } from '../lib/validate.js';

const router = express.Router();

// The author's public record beyond the books: events he has attended, articles
// he has written, and the media talking about him. Each item can carry a photo,
// a video (an uploaded file or a YouTube or Vimeo link), and an outbound link.

const SECTIONS = ['event', 'article', 'media'];
const COLUMNS = 'id,section,media_type,title,caption,outlet,image_url,video_url,link_url,event_date,sort_order,created_at';

const urlOrNull = (v) => (isSafeHttpUrl(v) ? String(v).trim() : null);

// A pasted YouTube or Vimeo page link becomes its embeddable form; an uploaded
// file URL is kept as is.
function videoFrom(value) {
  if (!value) return { video_url: null, kind: null };
  const [first] = normalizeVideoList([value]) || [];
  if (!first) return { video_url: null, kind: null };
  if (first.type === 'link') return { video_url: null, kind: 'link', link: first.source };
  return { video_url: first.url, kind: first.type };
}

function readItem(body) {
  const section = SECTIONS.includes(body.section) ? body.section : 'event';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 300) return { error: 'A title is required' };
  const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 2000) : null;
  const outlet = typeof body.outlet === 'string' ? body.outlet.trim().slice(0, 200) : null;
  const image_url = urlOrNull(body.image_url);
  const video = videoFrom(body.video_url);
  const link_url = urlOrNull(body.link_url) || (video.kind === 'link' ? video.link : null);
  const date = typeof body.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.event_date) ? body.event_date : null;
  if (!image_url && !video.video_url && !link_url) return { error: 'Add a photo, a video or a link' };
  const media_type = video.video_url ? 'video' : image_url ? 'photo' : 'link';
  return {
    item: cleanTextFields({
      section, media_type, title, caption: caption || null, outlet: outlet || null,
      image_url, video_url: video.video_url, link_url, event_date: date,
      sort_order: Number.isInteger(body.sort_order) ? body.sort_order : 0,
    }, ['title', 'caption', 'outlet']),
  };
}

// GET /api/gallery?section=event|article|media: public
router.get('/', async (req, res) => {
  let q = supabaseAdmin.from('gallery_items').select(COLUMNS);
  if (SECTIONS.includes(req.query.section)) q = q.eq('section', req.query.section);
  const { data, error } = await q
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(300);
  // Before migration 014 the table does not exist; show an empty gallery
  // rather than an error page.
  if (error) return res.json([]);
  res.json(data);
});

router.post('/', requireAuth, requireAuthor, async (req, res) => {
  const { item, error: invalid } = readItem(req.body || {});
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await supabaseAdmin.from('gallery_items').insert(item).select(COLUMNS).single();
  if (error) {
    const missing = /gallery_items/.test(error.message || '');
    return res.status(500).json({ error: missing ? 'Run migration 014 in Supabase first.' : error.message });
  }
  res.status(201).json(data);
});

router.put('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { item, error: invalid } = readItem(req.body || {});
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await supabaseAdmin.from('gallery_items').update(item).eq('id', req.params.id).select(COLUMNS).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { error } = await supabaseAdmin.from('gallery_items').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;
