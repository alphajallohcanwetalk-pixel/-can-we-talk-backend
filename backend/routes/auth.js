import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { sendWelcomeEmail } from '../lib/email.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Note: the frontend should generally call supabase.auth.signUp() directly using the
// public anon key (Supabase's JS SDK handles this well). This endpoint exists mainly
// to trigger our own welcome email as a side effect right after signup.
router.post('/welcome', async (req, res) => {
  const { email, full_name } = req.body;
  if (!/^\S+@\S+\.\S+$/.test(email || '') || typeof full_name !== 'string' || full_name.trim().length < 2 || full_name.length > 120) {
    return res.status(400).json({ error: 'Valid email and name required' });
  }
  try {
    await sendWelcomeEmail(email, full_name);
    res.json({ sent: true });
  } catch (err) {
    console.error('Welcome email failed:', err);
    res.status(500).json({ error: 'Email failed to send' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  // is_developer arrives with migration 007. Until that has been run the column
  // does not exist and selecting it fails the whole query, which would lock the
  // author out of the dashboard, so fall back to the original column set.
  let { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id,email,is_author,is_developer')
    .eq('id', req.user.id)
    .single();

  if (error) {
    ({ data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,email,is_author')
      .eq('id', req.user.id)
      .single());
    if (data) data.is_developer = false;
  }

  if (error || !data) return res.status(404).json({ error: 'Profile not found' });
  res.json(data);
});

// DELETE /api/auth/account
// Permanent account deletion, required by Google Play for any app with accounts.
//
// Orders are not deleted. A completed sale is a financial record, and in most
// places a business is required to keep it. They are detached from the person
// instead: the user link is removed and the personal fields are redacted, so
// the books still balance but the row no longer identifies anyone.
// Everything genuinely personal (profile, comments, ratings, purchases,
// subscriptions) is removed, and the login itself is deleted last.
router.delete('/account', requireAuth, async (req, res) => {
  const userId = req.user.id;

  if (req.body?.confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Send { "confirm": "DELETE" } to confirm this is intentional' });
  }

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_author')
      .eq('id', userId)
      .single();

    // Refuse to delete the last author. Doing so would lock the dashboard
    // permanently, with no way back in through the application.
    if (profile?.is_author) {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_author', true);
      if ((count ?? 0) <= 1) {
        return res.status(409).json({
          error: 'This is the only author account, so it cannot be deleted. Grant author access to another account first.'
        });
      }
    }

    // 1. Detach and redact orders. orders.user_id has no cascade rule, so this
    //    has to happen before the profile goes or the delete fails outright.
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({
        user_id: null,
        customer_name: 'Deleted account',
        customer_phone: null,
        shipping_address: null
      })
      .eq('user_id', userId);
    if (orderError) return res.status(500).json({ error: 'Could not detach order history' });

    // 2. Public content written by this person.
    await supabaseAdmin.from('comments').delete().eq('user_id', userId);

    // 3. Entitlements and subscriptions. These cascade from the profile, but
    //    are cleared explicitly so the intent is on the record.
    await supabaseAdmin.from('chapter_purchases').delete().eq('user_id', userId);
    await supabaseAdmin.from('audiobook_bundle_purchases').delete().eq('user_id', userId);
    await supabaseAdmin.from('book_club_subscriptions').delete().eq('user_id', userId);

    // 4. Unlink from any error log rows rather than deleting the diagnostics.
    await supabaseAdmin.from('app_error_logs').update({ user_id: null }).eq('user_id', userId);

    // 5. The profile, then the login. Deleting the auth user cascades to the
    //    profile anyway; doing it in this order keeps the failure modes obvious.
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) return res.status(500).json({ error: 'Could not remove the login: ' + authError.message });

    console.log(JSON.stringify({ type: 'account_deleted', user_id: userId, at: new Date().toISOString() }));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Account deletion failed:', error.message);
    res.status(500).json({ error: 'Could not delete the account' });
  }
});

export default router;
