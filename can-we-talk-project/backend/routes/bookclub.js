import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/bookclub/subscribe  { plan: 'monthly' | 'annual' }
router.post('/subscribe', requireAuth, async (req, res) => {
  const { plan } = req.body;
  const priceId = plan === 'annual'
    ? process.env.STRIPE_PRICE_BOOKCLUB_ANNUAL
    : process.env.STRIPE_PRICE_BOOKCLUB_MONTHLY;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: req.user.email,
    metadata: { book_club_user_id: req.user.id, plan },
    success_url: `${process.env.FRONTEND_APP_URL}#bookclub?joined=1`,
    cancel_url: `${process.env.FRONTEND_APP_URL}#bookclub`
  });

  res.json({ checkout_url: session.url });
});

// GET /api/bookclub/status — does this user have online-reading access?
router.get('/status', requireAuth, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('book_club_active, book_club_plan')
    .eq('id', req.user.id)
    .single();
  res.json(data || { book_club_active: false });
});

// GET /api/bookclub/read/:bookId — gated: returns full book text only if subscribed
router.get('/read/:bookId', requireAuth, async (req, res) => {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('book_club_active')
    .eq('id', req.user.id)
    .single();
  if (!profile?.book_club_active) return res.status(403).json({ error: 'Book Club membership required' });

  const { data: book, error } = await supabaseAdmin
    .from('books')
    .select('title, reader_full_text')
    .eq('id', req.params.bookId)
    .single();
  if (error) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

export default router;