import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/orders/checkout
// body: { items: [{ book_id, title, format_name, price_cents, qty, signed }], shipping_address, customer_name, customer_phone }
router.post('/checkout', requireAuth, async (req, res) => {
  const { items, shipping_address, customer_name, customer_phone } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const total_cents = items.reduce((sum, i) => sum + i.price_cents * i.qty, 0);

  // Create a pending order first, so we have an ID to attach to the Stripe session
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .insert({ user_id: req.user.id, status: 'pending', total_cents, shipping_address, customer_name, customer_phone })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const orderItemRows = items.map((i) => ({
    order_id: order.id,
    book_id: i.book_id,
    format_name: i.format_name,
    signed: !!i.signed,
    qty: i.qty,
    unit_price_cents: i.price_cents
  }));
  await supabaseAdmin.from('order_items').insert(orderItemRows);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'], // add 'mobile_money' style options via Stripe's regional payment methods once available for Sierra Leone
    line_items: items.map((i) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: `${i.title} (${i.format_name}${i.signed ? ', signed' : ''})` },
        unit_amount: i.price_cents
      },
      quantity: i.qty
    })),
    metadata: { order_id: order.id },
    success_url: `${process.env.FRONTEND_APP_URL}#order-confirm?order=${order.id}`,
    cancel_url: `${process.env.FRONTEND_APP_URL}#cart`
  });

  await supabaseAdmin.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id);

  res.json({ checkout_url: session.url });
});

// GET /api/orders/mine — order history for the signed-in user
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;