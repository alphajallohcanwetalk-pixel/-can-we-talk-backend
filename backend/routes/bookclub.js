import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { requireAuth } from '../middleware/auth.js';
import { isOwnerAccount, optionalUser, ebookBookIds } from '../lib/entitlements.js';
import { bookPreview } from '../lib/preview.js';

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
  // The author owns the club, so he is always a member.
  if (await isOwnerAccount(req.user.id)) return res.json({ book_club_active: true, book_club_plan: 'owner', is_owner: true });
  res.json(data || { book_club_active: false });
});

// GET /api/bookclub/read/:bookId: gated: returns full book text only if subscribed
// Signed in or not: a visitor gets the free opening, a buyer the whole book.
router.get('/read/:bookId', async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.bookId)) return res.status(404).json({ error: 'Book not found' });
  const user = await optionalUser(req);
  let entitled = false;
  if (user) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('book_club_active')
      .eq('id', user.id)
      .single();
    entitled = Boolean(profile?.book_club_active)
      || (await ebookBookIds(user.id)).includes(req.params.bookId)
      || await isOwnerAccount(user.id);
  }

  // sample_chars arrives with migration 011. Select it separately so a book
  // still opens for entitled readers if the column is not there yet.
  let book = null;
  let sampleChars = 0;
  {
    const full = await supabaseAdmin
      .from('books')
      .select('title, reader_full_text, sample_chars, cover_image_url')
      .eq('id', req.params.bookId)
      .single();
    if (full.error) {
      const legacy = await supabaseAdmin
        .from('books')
        .select('title, reader_full_text, cover_image_url')
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
    return res.json({ title: book.title, reader_full_text: book.reader_full_text, cover_image_url: book.cover_image_url || null, is_sample: false });
  }

  // Not entitled: everyone may read the opening, meaning the front matter
  // (title page, dedication, contents, foreword) and the first page of the
  // first chapter. The author can set a different length in the dashboard.
  if (book.reader_full_text && String(book.reader_full_text).trim()) {
    const full = String(book.reader_full_text);
    const cut = bookPreview(full, sampleChars);
    return res.json({
      title: book.title,
      cover_image_url: book.cover_image_url || null,
      reader_full_text: cut,
      is_sample: true,
      sample_chars: cut.length,
      total_chars: full.length
    });
  }

  return res.status(403).json({ error: 'Purchase this eBook or join the Book Club to read it' });
});

export default router;