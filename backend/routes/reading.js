import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Migration 011 adds the table. Until it is run these endpoints answer politely
// rather than failing, so the reader still works without saved position.
const notMigrated = (error) => /reading_progress/.test(error?.message || '');

// Essays are read in the same reader as books, so they save position the same
// way. Declared before the /:bookId routes, or "essay" would be taken as a
// book id and fail the UUID check.
const essayNotMigrated = (error) => /essay_progress/.test(error?.message || '');

router.get('/essay/:essayId', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.essayId)) return res.status(400).json({ error: 'Invalid essay id' });

  const { data, error } = await supabaseAdmin
    .from('essay_progress')
    .select('page, char_offset, pages_total, updated_at')
    .eq('user_id', req.user.id)
    .eq('essay_id', req.params.essayId)
    .maybeSingle();

  if (error) {
    if (essayNotMigrated(error)) return res.json({ page: 0, char_offset: 0, unavailable: true });
    return res.status(500).json({ error: error.message });
  }
  res.json(data || { page: 0, char_offset: 0 });
});

router.put('/essay/:essayId', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.essayId)) return res.status(400).json({ error: 'Invalid essay id' });

  const page = Number(req.body?.page);
  const charOffset = Number(req.body?.char_offset);
  const pagesTotal = Number(req.body?.pages_total);
  if (!Number.isInteger(page) || page < 0) return res.status(400).json({ error: 'page must be a whole number' });

  const { error } = await supabaseAdmin.from('essay_progress').upsert({
    user_id: req.user.id,
    essay_id: req.params.essayId,
    page,
    char_offset: Number.isInteger(charOffset) && charOffset >= 0 ? charOffset : 0,
    pages_total: Number.isInteger(pagesTotal) && pagesTotal > 0 ? pagesTotal : null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,essay_id' });

  if (error) {
    if (essayNotMigrated(error)) return res.json({ saved: false, unavailable: true });
    return res.status(500).json({ error: error.message });
  }
  res.json({ saved: true });
});

// GET /api/reading/:bookId: where this reader had got to.
router.get('/:bookId', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.bookId)) return res.status(400).json({ error: 'Invalid book id' });

  const { data, error } = await supabaseAdmin
    .from('reading_progress')
    .select('page, char_offset, pages_total, updated_at')
    .eq('user_id', req.user.id)
    .eq('book_id', req.params.bookId)
    .maybeSingle();

  if (error) {
    if (notMigrated(error)) return res.json({ page: 0, char_offset: 0, unavailable: true });
    return res.status(500).json({ error: error.message });
  }
  res.json(data || { page: 0, char_offset: 0 });
});

// PUT /api/reading/:bookId: save the position.
// The character offset is what actually matters: page numbers shift with screen
// size and font size, so a page saved on a phone is meaningless on a laptop.
router.put('/:bookId', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.bookId)) return res.status(400).json({ error: 'Invalid book id' });

  const page = Number(req.body?.page);
  const charOffset = Number(req.body?.char_offset);
  const pagesTotal = Number(req.body?.pages_total);
  if (!Number.isInteger(page) || page < 0) return res.status(400).json({ error: 'page must be a whole number' });

  const { error } = await supabaseAdmin.from('reading_progress').upsert({
    user_id: req.user.id,
    book_id: req.params.bookId,
    page,
    char_offset: Number.isInteger(charOffset) && charOffset >= 0 ? charOffset : 0,
    pages_total: Number.isInteger(pagesTotal) && pagesTotal > 0 ? pagesTotal : null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,book_id' });

  if (error) {
    if (notMigrated(error)) return res.json({ saved: false, unavailable: true });
    return res.status(500).json({ error: error.message });
  }
  res.json({ saved: true });
});

// GET /api/reading: everything this reader has started, newest first.
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('reading_progress')
    .select('book_id, page, pages_total, updated_at, books(title, cover_image_url)')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    if (notMigrated(error)) return res.json([]);
    return res.status(500).json({ error: error.message });
  }
  res.json(data || []);
});

export default router;
