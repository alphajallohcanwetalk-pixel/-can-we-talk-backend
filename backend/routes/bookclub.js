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
  if (!priceId) {
    console.error(`Book Club price ID missing for plan: ${plan}`);
    return res.status(503).json({ error: 'Book Club signup is not configured yet' });
  }

  // Already a member: sending them to Checkout again would bill a second
  // subscription for the same account.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('book_club_active')
    .eq('id', req.user.id)
    .single();
  if (profile?.book_club_active) return res.status(409).json({ error: 'You are already a Book Club member' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Omitting payment_method_types lets Stripe use the methods enabled in Dashboard.
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

// GET /api/bookclub/status: does this user have online-reading access?
router.get('/status', requireAuth, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('book_club_active, book_club_plan')
    .eq('id', req.user.id)
    .single();
  res.json(data || { book_club_active: false });
});

// GET /api/bookclub/read/:bookId: gated: returns full book text only if subscribed
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
  const entitled = Boolean(profile?.book_club_active) || hasEbookPurchase;

  // sample_chars arrives with migration 011. Select it separately so a book
  // still opens for entitled readers if the column is not there yet.
  let book = null;
  let sampleChars = 0;
  {
    const full = await supabaseAdmin
      .from('books')
      .select('title, reader_full_text, sample_chars')
      .eq('id', req.params.bookId)
      .single();
    if (full.error) {
      const legacy = await supabaseAdmin
        .from('books')
        .select('title, reader_full_text')
        .eq('id', req.params.bookId)
        .single();
      if (legacy.error) return res.status(404).json({ error: 'Book not found' });
      book = legacy.data;
    } else {
      book = full.data;
      sampleChars = Number(full.data.sample_chars) || 0;
    }
  }

  if (entitled) {
    return res.json({ title: book.title, reader_full_text: book.reader_full_text, is_sample: false });
  }

  // Not entitled. If the author has opened a sample, send that much and say so,
  // rather than refusing outright. Trying a book is how people decide to buy it.
  if (sampleChars > 0 && book.reader_full_text) {
    const full = String(book.reader_full_text);
    let cut = full.slice(0, sampleChars);
    // End on a paragraph break where possible, so a sample does not stop mid
    // sentence.
    const lastBreak = cut.lastIndexOf('\n\n');
    if (lastBreak > sampleChars * 0.5) cut = cut.slice(0, lastBreak);
    return res.json({
      title: book.title,
      reader_full_text: cut,
      is_sample: true,
      sample_chars: sampleChars,
      total_chars: full.length
    });
  }

  return res.status(403).json({ error: 'Purchase this eBook or join the Book Club to read it' });
});

export default router;