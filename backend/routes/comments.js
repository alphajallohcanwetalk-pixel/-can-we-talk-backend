import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';

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


// Hidden comments must not appear publicly, nor count toward a rating average.
// is_hidden arrives with migration 009; until that is run the filter would make
// the query fail, so fall back to the unfiltered form.
async function selectVisible(build) {
  let result = await build(true);
  if (result.error && /is_hidden/.test(result.error.message || '')) {
    result = await build(false);
  }
  return result;
}

// GET /api/comments/summary?target_type=book&target_id=xxx: average rating + count
router.get('/summary', async (req, res) => {
  const target = readTarget(req, res);
  if (!target) return;
  const { target_type, target_id } = target;
  const { data, error } = await selectVisible((filtered) => {
    let q = supabaseAdmin
      .from('comments')
      .select('rating')
      .eq('target_type', target_type)
      .eq('target_id', target_id)
      .not('rating', 'is', null);
    return filtered ? q.not('is_hidden', 'is', true) : q;
  });
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
  const { data, error } = await selectVisible((filtered) => {
    let q = supabaseAdmin
      .from('comments')
      .select('*, profiles(full_name)')
      .eq('target_type', target_type)
      .eq('target_id', target_id)
      .order('created_at', { ascending: false });
    return filtered ? q.not('is_hidden', 'is', true) : q;
  });
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

// POST /api/comments/:id/report: any signed-in reader can flag a comment.
router.post('/:id/report', requireAuth, async (req, res) => {
  const { reason, note } = req.body || {};
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid comment id' });
  if (!['spam', 'abuse', 'off_topic', 'other'].includes(reason)) {
    return res.status(400).json({ error: 'reason must be spam, abuse, off_topic or other' });
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
    return res.status(400).json({ error: 'note must be text of 500 characters or less' });
  }

  const { error } = await supabaseAdmin.from('comment_reports').insert({
    comment_id: req.params.id,
    user_id: req.user.id,
    reason,
    note: note || null
  });

  // A repeat report from the same person hits the unique index. That is not a
  // failure worth showing: the comment is already flagged.
  if (error && error.code !== '23505') {
    if (/comment_reports/.test(error.message || '')) {
      return res.status(503).json({ error: 'Reporting is not available yet', hint: 'Run migration 009.' });
    }
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ reported: true });
});

// GET /api/comments/moderation: the author's queue. Reported comments first.
router.get('/moderation/queue', requireAuth, requireAuthor, async (req, res) => {
  const { data: reports, error: reportError } = await supabaseAdmin
    .from('comment_reports')
    .select('comment_id, reason, note, created_at, resolved_at')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (reportError) {
    return res.status(503).json({ error: reportError.message, hint: 'Run migration 009 in Supabase.' });
  }

  const { data: comments, error: commentError } = await supabaseAdmin
    .from('comments')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (commentError) return res.status(500).json({ error: commentError.message });

  const countByComment = new Map();
  const reasonsByComment = new Map();
  for (const r of reports || []) {
    countByComment.set(r.comment_id, (countByComment.get(r.comment_id) || 0) + 1);
    const list = reasonsByComment.get(r.comment_id) || [];
    list.push(r.reason);
    reasonsByComment.set(r.comment_id, list);
  }

  const rows = (comments || []).map((c) => ({
    ...c,
    report_count: countByComment.get(c.id) || 0,
    reasons: reasonsByComment.get(c.id) || []
  }));
  // Reported first, then most recent.
  rows.sort((a, b) => b.report_count - a.report_count ||
    String(b.created_at).localeCompare(String(a.created_at)));
  res.json(rows);
});

// PATCH /api/comments/:id/visibility  { hidden: true | false }
router.patch('/:id/visibility', requireAuth, requireAuthor, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid comment id' });
  const hidden = req.body?.hidden === true;

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update({ is_hidden: hidden, hidden_at: hidden ? new Date().toISOString() : null })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) {
    if (/is_hidden/.test(error.message || '')) {
      return res.status(503).json({ error: error.message, hint: 'Run migration 009 in Supabase.' });
    }
    return res.status(500).json({ error: error.message });
  }

  // Hiding a comment settles whatever was reported about it.
  if (hidden) {
    await supabaseAdmin.from('comment_reports')
      .update({ resolved_at: new Date().toISOString() })
      .eq('comment_id', req.params.id)
      .is('resolved_at', null);
  }
  res.json(data);
});

// DELETE /api/comments/:id: permanent removal, author only.
router.delete('/:id', requireAuth, requireAuthor, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid comment id' });
  const { error } = await supabaseAdmin.from('comments').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;