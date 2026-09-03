import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { sendOrderConfirmationEmail, sendBookClubWelcomeEmail } from '../lib/email.js';

const router = express.Router();

// IMPORTANT: this route must receive the RAW request body (not JSON-parsed) —
// see server.js where express.raw() is applied specifically to this path.
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // ---- Book purchase ----
    if (session.metadata?.order_id) {
      const orderId = session.metadata.order_id;
      await supabaseAdmin.from('orders').update({ status: 'paid' }).eq('id', orderId);

      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*, books(title)), profiles(email)')
        .eq('id', orderId)
        .single();

      if (order?.profiles?.email) {
        const items = order.order_items.map((i) => ({ ...i, title: i.books?.title || 'Book' }));
        await sendOrderConfirmationEmail(order.profiles.email, { ...order, items });
      }
    }

    // ---- Book Club subscription ----
    if (session.metadata?.book_club_user_id) {
      const userId = session.metadata.book_club_user_id;
      const plan = session.metadata.plan;
      await supabaseAdmin
        .from('profiles')
        .update({ book_club_active: true, book_club_plan: plan })
        .eq('id', userId);
      await supabaseAdmin.from('book_club_subscriptions').insert({
        user_id: userId,
        plan,
        stripe_subscription_id: session.subscription,
        status: 'active'
      });

      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', userId).single();
      if (profile) await sendBookClubWelcomeEmail(profile.email, profile.full_name, plan);
    }
  }

  // Handle subscription cancellations to keep book_club_active accurate
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await supabaseAdmin
      .from('book_club_subscriptions')
      .update({ status: 'cancelled' })
      .eq('stripe_subscription_id', sub.id);
    // Also flip the profile flag — look up by stripe_subscription_id via the subscriptions table
    const { data: row } = await supabaseAdmin
      .from('book_club_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', sub.id)
      .single();
    if (row) await supabaseAdmin.from('profiles').update({ book_club_active: false }).eq('id', row.user_id);
  }

  res.json({ received: true });
});

export default router;
