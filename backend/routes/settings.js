import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { normalizeOptionalUrl } from '../lib/validate.js';

const router = express.Router();

const URL_FIELDS = ['instagram_url', 'facebook_url', 'twitter_url', 'youtube_url', 'tiktok_url', 'author_photo_url'];

// GET /api/settings: public, powers the footer social icons
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('site_settings').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/settings: Author Dashboard: update social links, bio, photo
router.put('/', requireAuth, requireAuthor, async (req, res) => {
  const updates = {};
  for (const field of URL_FIELDS) {
    const result = normalizeOptionalUrl(req.body[field]);
    if (!result.ok) return res.status(400).json({ error: `${field} must be a valid http or https URL` });
    if (result.value !== undefined) updates[field] = result.value;
  }

  const { author_bio } = req.body;
  if (author_bio !== undefined) {
    if (author_bio !== null && (typeof author_bio !== 'string' || author_bio.length > 5000)) {
      return res.status(400).json({ error: 'author_bio must be text of 5000 characters or less' });
    }
    updates.author_bio = author_bio;
  }

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No settings to update' });
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;