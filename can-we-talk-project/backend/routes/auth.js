import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { sendWelcomeEmail } from '../lib/email.js';

const router = express.Router();

// Note: the frontend should generally call supabase.auth.signUp() directly using the
// public anon key (Supabase's JS SDK handles this well). This endpoint exists mainly
// to trigger our own welcome email as a side effect right after signup.
router.post('/welcome', async (req, res) => {
  const { email, full_name } = req.body;
  if (!email || !full_name) return res.status(400).json({ error: 'email and full_name required' });
  try {
    await sendWelcomeEmail(email, full_name);
    res.json({ sent: true });
  } catch (err) {
    console.error('Welcome email failed:', err);
    res.status(500).json({ error: 'Email failed to send' });
  }
});

export default router;
