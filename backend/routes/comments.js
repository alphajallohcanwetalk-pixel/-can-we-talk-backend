import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Both read endpoints take these straight from the query string. An invalid
// UUID reaches Postgres as a cast error and surfaces as a 500, so check first.
function readTarget(req, res) {
  const { target_type, target_id } = req.query;
  if (!['book', 'essay'].includes(target_type) || !UUID_RE.test(target_id || '')) {
    res.status(400).json({ error: 'Valid target_type and target_id are required' });
    return null;
  }
  return { target_type, target_id };
}

// GET /api/comments/summary?target_type=book&target_id=xxx: average rating + count
router.get('/summary', async (req, res) => {
  const target = readTarget(req, res);
  if (!target) return;
  const { target_type, target_id } = target;
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('rating')
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .not('rating', 'is', null);
  if (error) return res.status(500).json({ error: error.message });
  const count = data.length;
  const average = count ? data.reduce((sum, c) => sum + c.rating, 0) / count : 0;
  res.json({ average: Math.round(average * 10) / 10, count });
});

// GET /api/comments?target_type=book&target_id=xxx
router.get('/', async (req, res) => {
  const target = readTarget(req, res);
  if (!target) return;
  const { target_type, target_id } = target;
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('*, profiles(full_name)')
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/comments: requires sign-in
router.post('/', requireAuth, async (req, res) => {
  const { target_type, target_id, rating, body } = req.body;
  if (!['book', 'essay'].includes(target_type)) return res.status(400).json({ error: 'Invalid target_type' });
  if (!/^[0-9a-f-]{36}$/i.test(target_id || '') || !Number.isInteger(rating) || rating < 1 || rating > 5 || typeof body !== 'string' || !body.trim() || body.length > 2000) {
    return res.status(400).json({ error: 'Invalid comment' });
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({ user_id: req.user.id, target_type, target_id, rating, body })
    .select('*, profiles(full_name)')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

export default router;