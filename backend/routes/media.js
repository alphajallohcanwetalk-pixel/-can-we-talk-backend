import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { isSafeHttpUrl, cleanTextFields } from '../lib/validate.js';

const router = express.Router();

// GET /api/media/:bookId: public, powers the "In the Press" section on a book page
router.get('/:bookId', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('media_coverage')
    .select('*')
    .eq('book_id', req.params.bookId)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/media: Author Dashboard: add a press mention
router.post('/', requireAuth, requireAuthor, async (req, res) => {
  const { book_id, outlet, headline, url, media_type } = req.body;
  if (typeof outlet !== 'string' || !outlet.trim() || outlet.length > 200 ||
      typeof headline !== 'string' || !headline.trim() || headline.length > 300) {
    return res.status(400).json({ error: 'Outlet and headline are required' });
  }
  if (!isSafeHttpUrl(url)) return res.status(400).json({ error: 'url must be a valid http or https URL' });
  if (media_type !== undefined && !['article', 'video'].includes(media_type)) {
    return res.status(400).json({ error: 'media_type must be article or video' });
  }
  const { data, error } = await supabaseAdmin
    .from('media_coverage')
    .insert(cleanTextFields({ book_id, outlet, headline, url, media_type: media_type || 'article' }, ['outlet', 'headline']))
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.delete('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { error } = await supabaseAdmin.from('media_coverage').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;
