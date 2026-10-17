import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = express.Router();

// What the site search needs that the pages do not already load: every visible reader comment (with
// the name readers already see under it on the book page) and the audiobook chapter titles. Never
// hidden comments, emails or the paid audio files.
//
// GET /api/search
router.get('/', async (req, res) => {
  const comments = async (filtered) => {
    let q = supabaseAdmin
      .from('comments')
      .select('id,target_type,target_id,rating,body,created_at,profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (filtered) q = q.not('is_hidden', 'is', true);
    return q;
  };
  // is_hidden arrives with migration 009; without it, read unfiltered (as the comments route does).
  let c = await comments(true);
  if (c.error && /is_hidden/.test(c.error.message || '')) c = await comments(false);
  const ch = await supabaseAdmin
    .from('audiobook_chapters')
    .select('id,book_id,title,sort_order,duration_seconds')
    .order('sort_order');

  res.set('Cache-Control', 'no-cache');
  res.json({
    comments: (c.data || []).map((x) => ({
      id: x.id,
      target_type: x.target_type,
      target_id: x.target_id,
      rating: x.rating || null,
      body: String(x.body || '').slice(0, 600),
      name: x.profiles?.full_name || 'Reader',
      created_at: x.created_at,
    })),
    chapters: ch.data || [],
  });
});

export default router;
