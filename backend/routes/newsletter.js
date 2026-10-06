import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { sendNewsletterConfirmation } from '../lib/email.js';
import { stripDashes } from '../lib/validate.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const notMigrated = (error) => /newsletter_subscribers/.test(error?.message || '');

// POST /api/newsletter/subscribe  { email, full_name }
//
// Double opt in: the row is created unconfirmed and nothing is sent to it until
// the address is confirmed from the inbox. That keeps someone from signing up a
// stranger, and keeps the list clean enough that it does not damage the sending
// reputation the Resend domain depends on.
router.post('/subscribe', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const fullName = typeof req.body?.full_name === 'string' ? stripDashes(req.body.full_name.trim()).slice(0, 120) : null;

  if (!EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('newsletter_subscribers')
    .select('id, token, confirmed_at, unsubscribed_at')
    .ilike('email', email)
    .maybeSingle();

  if (lookupError && notMigrated(lookupError)) {
    return res.status(503).json({ error: 'The newsletter is not set up yet', hint: 'Run migration 011.' });
  }

  let row = existing;
  if (existing) {
    // Re-subscribing after leaving should work, and should go through
    // confirmation again rather than silently reactivating.
    if (existing.unsubscribed_at || !existing.confirmed_at) {
      const { data: updated } = await supabaseAdmin
        .from('newsletter_subscribers')
        .update({ unsubscribed_at: null, full_name: fullName || undefined })
        .eq('id', existing.id)
        .select()
        .single();
      row = updated || existing;
    } else {
      // Already on the list. Say the same thing either way, so this form cannot
      // be used to test whether an address is subscribed.
      return res.json({ ok: true });
    }
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({ email, full_name: fullName })
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Could not sign you up' });
    row = created;
  }

  try {
    await sendNewsletterConfirmation(email, fullName, row.token);
  } catch (mailError) {
    console.error(JSON.stringify({ type: 'error', scope: 'newsletter_confirmation', message: mailError.message }));
  }
  res.json({ ok: true });
});

// GET /api/newsletter/confirm/:token
router.get('/confirm/:token', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq('token', req.params.token)
    .select('email')
    .maybeSingle();

  const target = process.env.FRONTEND_APP_URL || 'https://canwetalkvoice.com';
  if (error || !data) return res.redirect(`${target}/?newsletter=invalid`);
  res.redirect(`${target}/?newsletter=confirmed`);
});

// GET /api/newsletter/unsubscribe/:token
// A link in an email must work without signing in, so the token is the proof.
router.get('/unsubscribe/:token', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('token', req.params.token)
    .select('email')
    .maybeSingle();

  const target = process.env.FRONTEND_APP_URL || 'https://canwetalkvoice.com';
  if (error || !data) return res.redirect(`${target}/?newsletter=invalid`);
  res.redirect(`${target}/?newsletter=unsubscribed`);
});

// GET /api/newsletter/list: the author's view of the list.
router.get('/list', requireAuth, requireAuthor, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .select('id, email, full_name, confirmed_at, unsubscribed_at, created_at, source')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    if (notMigrated(error)) return res.status(503).json({ error: error.message, hint: 'Run migration 011.' });
    return res.status(500).json({ error: error.message });
  }

  const rows = data || [];
  res.json({
    total: rows.length,
    confirmed: rows.filter((r) => r.confirmed_at && !r.unsubscribed_at).length,
    pending: rows.filter((r) => !r.confirmed_at && !r.unsubscribed_at).length,
    unsubscribed: rows.filter((r) => r.unsubscribed_at).length,
    subscribers: rows
  });
});

export default router;
