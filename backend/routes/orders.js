import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/orders/checkout
// body: { items: [{ book_id, format_name, qty, signed }], shipping_address, customer_name, customer_phone }
router.post('/checkout', requireAuth, async (req, res) => {
  const { items, shipping_address, customer_name, customer_phone } = req.body;
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (typeof shipping_address !== 'string' || shipping_address.trim().length < 5 || shipping_address.length > 500 ||
    typeof customer_name !== 'string' || customer_name.trim().length < 2 || customer_name.length > 120 ||
    typeof customer_phone !== 'string' || customer_phone.trim().length < 7 || customer_phone.length > 40) {
    return res.status(400).json({ error: 'Valid customer and shipping details are required' });
  }

  const normalizedItems = [];
  for (const item of items) {
    const quantity = Number(item.qty);
    if (!item.book_id || typeof item.format_name !== 'string' || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ error: 'Invalid cart item' });
    }
    const [{ data: book }, { data: format }] = await Promise.all([
      supabaseAdmin.from('books').select('id,title,is_active').eq('id', item.book_id).single(),
      supabaseAdmin.from('book_formats').select('id,book_id,format_name,price_cents,stock_count').eq('book_id', item.book_id).eq('format_name', item.format_name).single()
    ]);
    if (!book?.is_active || !format || (format.stock_count !== null && format.stock_count < quantity)) {
      return res.status(400).json({ error: 'One or more items are unavailable' });
    }
    normalizedItems.push({ ...format, title: book.title, qty: quantity, signed: item.signed === true });
  }

  const total_cents = normalizedItems.reduce((sum, i) => sum + i.price_cents * i.qty, 0);

  // Create a pending order first, so we have an ID to attach to the Stripe session
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .insert({ user_id: req.user.id, status: 'pending', total_cents, shipping_address, customer_name, customer_phone })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const orderItemRows = normalizedItems.map((i) => ({
    order_id: order.id,
    book_id: i.book_id,
    format_name: i.format_name,
    signed: !!i.signed,
    qty: i.qty,
    unit_price_cents: i.price_cents
  }));
  const { error: itemError } = await supabaseAdmin.from('order_items').insert(orderItemRows);
  if (itemError) {
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    return res.status(500).json({ error: 'Could not create order' });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    automatic_payment_methods: { enabled: true },
    line_items: normalizedItems.map((i) => ({
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

router.get('/confirmation/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,status,total_cents,created_at')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Order not found' });
  res.json({ order: data, confirmed: data.status === 'paid' || data.status === 'shipped' });
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