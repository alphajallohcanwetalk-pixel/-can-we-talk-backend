import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/bookclub/subscribe  { plan: 'monthly' | 'annual' }
router.post('/subscribe', requireAuth, async (req, res) => {
  const { plan } = req.body;
  if (!['monthly', 'annual'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
  const priceId = plan === 'annual'
    ? process.env.STRIPE_PRICE_BOOKCLUB_ANNUAL
    : process.env.STRIPE_PRICE_BOOKCLUB_MONTHLY;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: req.user.email,
      metadata: { book_club_user_id: req.user.id, plan },
      success_url: `${process.env.FRONTEND_APP_URL}#bookclub?joined=1`,
      cancel_url: `${process.env.FRONTEND_APP_URL}#bookclub`
    });

    res.json({ checkout_url: session.url });
  } catch (error) {
    console.error('Book Club checkout failed:', error.message);
    res.status(502).json({ error: 'Payment service unavailable' });
  }
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
  let hasEbookPurchase = false;
  if (!profile?.book_club_active) {
    const { data: paidOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', req.user.id)
      .in('status', ['paid', 'shipped']);
    const orderIds = (paidOrders || []).map((order) => order.id);
    if (orderIds.length) {
      const { data: ebook } = await supabaseAdmin
        .from('order_items')
        .select('id')
        .in('order_id', orderIds)
        .eq('book_id', req.params.bookId)
        .ilike('format_name', 'ebook')
        .limit(1)
        .maybeSingle();
      hasEbookPurchase = Boolean(ebook);
    }
  }
  if (!profile?.book_club_active && !hasEbookPurchase) return res.status(403).json({ error: 'Purchase this eBook or join the Book Club to read it' });

  const { data: book, error } = await supabaseAdmin
    .from('books')
    .select('title, reader_full_text')
    .eq('id', req.params.bookId)
    .single();
  if (error) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

export default router;