import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { sendNewEssayAlert } from '../lib/email.js';

const router = express.Router();

// GET /api/essays?search=&category= — powers the Essay Library search/filter
router.get('/', async (req, res) => {
  let query = supabaseAdmin.from('essays').select('*').eq('published', true);
  if (req.query.category && req.query.category !== 'all') {
    query = query.eq('category', req.query.category);
  }
  if (req.query.search) {
    query = query.ilike('title', `%${req.query.search}%`);
  }
  const { data, error } = await query.order('year', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/essays — Author Dashboard: publish new essay + optionally email subscribers
router.post('/', requireAuth, requireAuthor, async (req, res) => {
  const { title, category, year, excerpt, full_text, notify_subscribers } = req.body;
  const { data: essay, error } = await supabaseAdmin
    .from('essays')
    .insert({ title, category, year, excerpt, full_text })
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

  res.status(201).json(essay);
});

// PUT /api/essays/:id — Author Dashboard: edit an existing essay
router.put('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { title, category, year, excerpt, full_text, cover_image_url } = req.body;
  const { data, error } = await supabaseAdmin
    .from('essays')
    .update({ title, category, year, excerpt, full_text, cover_image_url })
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