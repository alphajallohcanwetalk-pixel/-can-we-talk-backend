import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { stripDashes } from '../lib/validate.js';

const router = express.Router();

const notMigrated = (error) => /shipping_rates/.test(error?.message || '');

// The rate used when a destination is not listed. Without a fallback an
// unlisted country would ship free, which is the expensive kind of bug.
export const FALLBACK_CODE = 'ZZ';

// Looks up postage for a destination and order total. Exported so checkout can
// price an order without going back through HTTP.
export async function quoteShipping(countryCode, subtotalCents) {
  const code = String(countryCode || '').trim().toUpperCase();

  const { data, error } = await supabaseAdmin
    .from('shipping_rates')
    .select('country_code, country_name, price_cents, free_over_cents')
    .eq('is_active', true)
    .in('country_code', [code, FALLBACK_CODE]);

  // Before migration 011 there are no rates at all. Charging nothing is wrong,
  // but so is blocking every sale, so the order goes through without postage
  // and the response says so.
  if (error) {
    if (notMigrated(error)) return { price_cents: 0, country_name: null, unavailable: true };
    throw error;
  }

  const rows = data || [];
  const exact = rows.find((r) => r.country_code.toUpperCase() === code);
  const fallback = rows.find((r) => r.country_code.toUpperCase() === FALLBACK_CODE);
  const rate = exact || fallback;
  if (!rate) return { price_cents: 0, country_name: null, unavailable: true };

  const free = rate.free_over_cents !== null && rate.free_over_cents !== undefined
    && Number(subtotalCents) >= Number(rate.free_over_cents);

  return {
    price_cents: free ? 0 : Number(rate.price_cents),
    country_name: rate.country_name,
    country_code: rate.country_code,
    free_applied: free,
    free_over_cents: rate.free_over_cents ?? null,
    matched: Boolean(exact)
  };
}

// GET /api/shipping: the destinations the store posts to.
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('shipping_rates')
    .select('country_code, country_name, price_cents, free_over_cents')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    if (notMigrated(error)) return res.json([]);
    return res.status(500).json({ error: error.message });
  }
  res.json(data || []);
});

// GET /api/shipping/quote?country=KE&subtotal_cents=2499
router.get('/quote', async (req, res) => {
  try {
    const quote = await quoteShipping(req.query.country, Number(req.query.subtotal_cents) || 0);
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/shipping/:code: author edits a rate.
router.put('/:code', requireAuth, requireAuthor, async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return res.status(400).json({ error: 'country_code must be two letters' });

  const price = Number(req.body?.price_cents);
  if (!Number.isInteger(price) || price < 0) {
    return res.status(400).json({ error: 'price_cents must be a whole number of cents' });
  }
  const freeOver = req.body?.free_over_cents;
  const freeOverValue = (freeOver === null || freeOver === '' || freeOver === undefined)
    ? null
    : Number(freeOver);
  if (freeOverValue !== null && (!Number.isInteger(freeOverValue) || freeOverValue < 0)) {
    return res.status(400).json({ error: 'free_over_cents must be a whole number of cents, or empty' });
  }

  const payload = {
    country_code: code,
    country_name: stripDashes(String(req.body?.country_name || code).trim()).slice(0, 80),
    price_cents: price,
    free_over_cents: freeOverValue,
    is_active: req.body?.is_active !== false,
    sort_order: Number.isInteger(Number(req.body?.sort_order)) ? Number(req.body.sort_order) : 50
  };

  const { data, error } = await supabaseAdmin
    .from('shipping_rates')
    .upsert(payload, { onConflict: 'country_code' })
    .select()
    .single();

  if (error) {
    if (notMigrated(error)) return res.status(503).json({ error: error.message, hint: 'Run migration 011.' });
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

export default router;
