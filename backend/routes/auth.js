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
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id,email,is_author')
    .eq('id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Profile not found' });
  res.json(data);
});

export default router;
