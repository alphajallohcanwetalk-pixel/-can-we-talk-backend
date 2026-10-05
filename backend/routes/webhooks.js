import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { sendOrderConfirmationEmail, sendBookClubWelcomeEmail } from '../lib/email.js';

const router = express.Router();

// IMPORTANT: this route must receive the RAW request body (not JSON-parsed), 
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
      const { data: currentOrder, error: orderLookupError } = await supabaseAdmin
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();
      if (orderLookupError || !currentOrder) return res.status(400).json({ error: 'Order not found' });
      if (currentOrder.status === 'paid') return res.json({ received: true });
      const { error: orderUpdateError } = await supabaseAdmin.from('orders').update({ status: 'paid', stripe_session_id: session.id }).eq('id', orderId);
      if (orderUpdateError) return res.status(500).json({ error: 'Could not fulfill order' });

      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*, books(title)), profiles(email)')
        .eq('id', orderId)
        .single();

      // Draw down stock for formats that track it. Formats with a null
      // stock_count are unlimited and are left alone.
      for (const item of order?.order_items || []) {
        const { data: format } = await supabaseAdmin
          .from('book_formats')
          .select('id,stock_count')
          .eq('book_id', item.book_id)
          .eq('format_name', item.format_name)
          .maybeSingle();
        if (format && format.stock_count !== null) {
          await supabaseAdmin
            .from('book_formats')
            .update({ stock_count: Math.max(0, format.stock_count - item.qty) })
            .eq('id', format.id);
        }
      }

      // The order is already paid at this point. If the email provider is down,
      // that must not turn into a 500: Stripe would retry the webhook, and the
      // retry would be a no-op anyway because the status is now 'paid'.
      if (order?.profiles?.email) {
        try {
          const items = order.order_items.map((i) => ({ ...i, title: i.books?.title || 'Book' }));
          await sendOrderConfirmationEmail(order.profiles.email, { ...order, items });
        } catch (emailError) {
          console.error(JSON.stringify({ type: 'error', scope: 'order_confirmation_email', order_id: orderId, message: emailError.message }));
        }
      }
    }

    // ---- Book Club subscription ----
    if (session.metadata?.book_club_user_id) {
      const userId = session.metadata.book_club_user_id;
      const plan = session.metadata.plan;
      const { data: existingSubscription } = await supabaseAdmin
        .from('book_club_subscriptions')
        .select('id')
        .eq('stripe_subscription_id', session.subscription)
        .maybeSingle();
      await supabaseAdmin
        .from('profiles')
        .update({ book_club_active: true, book_club_plan: plan })
        .eq('id', userId);
      await supabaseAdmin.from('book_club_subscriptions').upsert({
        user_id: userId,
        plan,
        stripe_subscription_id: session.subscription,
        status: 'active'
      }, { onConflict: 'stripe_subscription_id', ignoreDuplicates: true });

      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', userId).single();
      if (profile && !existingSubscription) {
        try {
          await sendBookClubWelcomeEmail(profile.email, profile.full_name, plan);
        } catch (emailError) {
          console.error(JSON.stringify({ type: 'error', scope: 'bookclub_welcome_email', user_id: userId, message: emailError.message }));
        }
      }
    }

    if (session.metadata?.chapter_purchase_user_id && session.metadata?.chapter_id) {
      const { error: purchaseError } = await supabaseAdmin.from('chapter_purchases').upsert({
        user_id: session.metadata.chapter_purchase_user_id,
        chapter_id: session.metadata.chapter_id
      }, { onConflict: 'user_id,chapter_id', ignoreDuplicates: true });
      if (purchaseError) return res.status(500).json({ error: 'Could not fulfill chapter purchase' });
    }
  }

  // A Checkout session expires when the customer never completes payment
  // (Stripe expires them after ~24h). Without this, every abandoned cart leaves
  // a 'pending' order behind forever, which is what made the orders table look
  // like payments were failing. Scoped to 'pending' so a paid order is never
  // touched, even if events arrive out of order.
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      const { error: cleanupError } = await supabaseAdmin
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('status', 'pending');
      if (cleanupError) console.error(JSON.stringify({ type: 'error', scope: 'expired_order_cleanup', order_id: orderId, message: cleanupError.message }));
    }
  }

  if (['customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const sub = event.data.object;
    const status = event.type === 'customer.subscription.deleted' ? 'cancelled' : sub.status === 'active' ? 'active' : 'past_due';
    await supabaseAdmin
      .from('book_club_subscriptions')
      .update({ status, current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null })
      .eq('stripe_subscription_id', sub.id);
    const { data: row } = await supabaseAdmin
      .from('book_club_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', sub.id)
      .single();
    if (row) await supabaseAdmin.from('profiles').update({ book_club_active: status === 'active' }).eq('id', row.user_id);
  }

  if (event.type === 'invoice.payment_failed' && event.data.object.subscription) {
    await supabaseAdmin
      .from('book_club_subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', event.data.object.subscription);
  }

  res.json({ received: true });
});

export default router;
