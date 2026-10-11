import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { sendNewEssayAlert } from '../lib/email.js';
import { announce } from '../lib/push.js';
import { cleanTextFields, isSafeHttpUrl } from '../lib/validate.js';

// A stored link must be a plain http(s) address; anything else is dropped.
const urlOrNull = (v) => (isSafeHttpUrl(v) ? String(v).trim() : null);
const secondsOrNull = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 86400 ? Number(v) : null);

const router = express.Router();

// GET /api/essays?search=&category=: powers the Essay Library search/filter
const ESSAY_LIST = 'id,title,category,year,excerpt,cover_image_url,published,created_at';
router.get('/', async (req, res) => {
  // audio_url arrives with migration 014. Ask for it, and fall back to the
  // plain list if the column is not there yet, so the library never empties.
  const build = (cols) => {
    let query = supabaseAdmin.from('essays').select(cols).eq('published', true);
    if (req.query.category && req.query.category !== 'all') {
      query = query.eq('category', req.query.category);
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      // Strip the characters that carry meaning in a PostgREST filter or in LIKE
      // itself, so a search term cannot widen the match or break out of the filter.
      const term = req.query.search.trim().slice(0, 100).replace(/[%_,()\\*]/g, '');
      if (term) query = query.ilike('title', `%${term}%`);
    }
    return query.order('created_at', { ascending: false });
  };
  let { data, error } = await build(ESSAY_LIST + ',audio_url,audio_seconds');
  if (error) ({ data, error } = await build(ESSAY_LIST));
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('essays').select('*').eq('id', req.params.id).eq('published', true).single();
  if (error) return res.status(404).json({ error: 'Essay not found' });
  res.json(data);
});

// POST /api/essays: Author Dashboard: publish new essay + optionally email subscribers
router.post('/', requireAuth, requireAuthor, async (req, res) => {
  const { title, category, year, excerpt, full_text, cover_image_url, audio_url, audio_seconds, notify_subscribers } = req.body;
  if (typeof title !== 'string' || !title.trim() || typeof excerpt !== 'string' || !excerpt.trim()) return res.status(400).json({ error: 'Title and excerpt are required' });
  const { data: existing } = await supabaseAdmin.from('essays').select('id').ilike('title', title.trim()).limit(1).maybeSingle();
  if (existing) return res.status(409).json({ error: 'An essay with this title already exists. Edit the existing essay instead.' });
  const { data: essay, error } = await supabaseAdmin
    .from('essays')
    .insert(cleanTextFields({
      title, category, year, excerpt, full_text,
      // The cover was uploaded but never saved, so new essays had no picture.
      cover_image_url: urlOrNull(cover_image_url),
      ...(audio_url ? { audio_url: urlOrNull(audio_url), audio_seconds: secondsOrNull(audio_seconds) } : {}),
    }, ['title', 'category', 'excerpt', 'full_text']))
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  if (notify_subscribers) {
    const { data: subscribers } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('book_club_active', true); // or a separate "newsletter_opt_in" flag
    const emails = (subscribers || []).map((s) => s.email);
    if (emails.length) await sendNewEssayAlert(emails, essay);
  }

  // Tell every device with notifications on. Runs after the save and never
  // holds up or fails the publish.
  announce({
    title: essay.audio_url ? 'New audio essay' : 'New essay',
    body: essay.title,
    url: `/#essay-${essay.id}`,
    image: essay.cover_image_url || null,
  });

  res.status(201).json(essay);
});

// PUT /api/essays/:id: Author Dashboard: edit an existing essay
router.put('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { title, category, year, excerpt, full_text, cover_image_url, audio_url, audio_seconds } = req.body;
  const patch = { title, category, year, excerpt, full_text };
  if (cover_image_url !== undefined) patch.cover_image_url = urlOrNull(cover_image_url);
  if (audio_url !== undefined) { patch.audio_url = urlOrNull(audio_url); patch.audio_seconds = patch.audio_url ? secondsOrNull(audio_seconds) : null; }
  const { data, error } = await supabaseAdmin
    .from('essays')
    .update(cleanTextFields(patch, ['title', 'category', 'excerpt', 'full_text']))
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { error } = await supabaseAdmin.from('essays').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;