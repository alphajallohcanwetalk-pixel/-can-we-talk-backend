import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';

const router = express.Router();

// GET /api/audiobook/:bookId/chapters — public: list chapters + whether current user owns each
router.get('/:bookId/chapters', async (req, res) => {
  const { data: chaptersData, error } = await supabaseAdmin
    .from('audiobook_chapters')
    .select('*')
    .eq('book_id', req.params.bookId)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });

  // If an Authorization header is present, mark which chapters are owned
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  let ownedIds = [];
  if (token) {
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    if (userData?.user) {
      const { data: purchases } = await supabaseAdmin
        .from('chapter_purchases')
        .select('chapter_id')
        .eq('user_id', userData.user.id);
      ownedIds = (purchases || []).map((p) => p.chapter_id);
    }
  }
  res.json(chaptersData.map((c) => ({ ...c, owned: ownedIds.includes(c.id) })));
});

// POST /api/audiobook/chapters/:chapterId/buy — one-off Stripe Checkout for a single chapter
router.post('/chapters/:chapterId/buy', requireAuth, async (req, res) => {
  const { data: chapter } = await supabaseAdmin
    .from('audiobook_chapters')
    .select('*')
    .eq('id', req.params.chapterId)
    .single();
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: { currency: 'usd', product_data: { name: chapter.title }, unit_amount: chapter.price_cents },
      quantity: 1
    }],
    metadata: { chapter_purchase_user_id: req.user.id, chapter_id: chapter.id },
    success_url: `${process.env.FRONTEND_APP_URL}#book-mrp?chapter_unlocked=1`,
    cancel_url: `${process.env.FRONTEND_APP_URL}#book-mrp`
  });
  res.json({ checkout_url: session.url });
});

// GET /api/audiobook/chapters/:chapterId/stream — signed URL, only if owned
router.get('/chapters/:chapterId/stream', requireAuth, async (req, res) => {
  const { data: owns } = await supabaseAdmin
    .from('chapter_purchases')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('chapter_id', req.params.chapterId)
    .maybeSingle();
  if (!owns) return res.status(403).json({ error: 'Chapter not purchased' });

  const { data: chapter } = await supabaseAdmin
    .from('audiobook_chapters')
    .select('audio_url')
    .eq('id', req.params.chapterId)
    .single();
  // In production: generate a short-lived signed URL from Supabase Storage instead of a public one.
  res.json({ audio_url: chapter.audio_url });
});

// POST /api/audiobook/:bookId/chapters — Author Dashboard: add a narrated chapter
router.post('/:bookId/chapters', requireAuth, requireAuthor, async (req, res) => {
  const { title, duration_seconds, price_cents, audio_url } = req.body;
  const { data, error } = await supabaseAdmin
    .from('audiobook_chapters')
    .insert({ book_id: req.params.bookId, title, duration_seconds, price_cents, audio_url })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

export default router;