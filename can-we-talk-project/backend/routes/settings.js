import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settings — public, powers the footer social icons
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('site_settings').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/settings — Author Dashboard: update social links, bio, photo
router.put('/', requireAuth, requireAuthor, async (req, res) => {
  const { instagram_url, facebook_url, twitter_url, youtube_url, tiktok_url, author_bio, author_photo_url } = req.body;
  const updates = { instagram_url, facebook_url, twitter_url, youtube_url, tiktok_url };
  if (author_bio !== undefined) updates.author_bio = author_bio;
  if (author_photo_url !== undefined) updates.author_photo_url = author_photo_url;
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