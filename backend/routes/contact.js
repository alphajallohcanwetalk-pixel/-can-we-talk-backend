import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { sendContactToAuthor, sendContactReply } from '../lib/email.js';
import { notifyUsers } from '../lib/push.js';
import { recipientsFor } from '../lib/mailboxes.js';
import { stripDashes } from '../lib/validate.js';

const router = express.Router();

// Messages from the Contact page (speaking requests, press, orders, questions).
// Each one is kept in contact_messages (migration 015), emailed to Alpha (ADMIN_EMAIL) with
// Reply going to the sender, and announced on Alpha's devices. Before this route existed the
// form showed "thank you" and kept nothing.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REASONS = ['General inquiry', 'Speaking engagement', 'Media / press request', 'Bulk / bookstore order', 'Signed copy request', 'Feedback', 'Translation', 'Other'];
const clean = (v, max) => (typeof v === 'string' ? stripDashes(v.trim()).slice(0, max) : '');
const notMigrated = (error) => /contact_messages/.test(error?.message || '');
const COLS = 'id,name,email,reason,message,status,reply,emailed,created_at,read_at,replied_at';

async function authorIds() {
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('is_author', true);
  return (data || []).map((p) => p.id);
}

// POST /api/contact  { name, email, reason, message, website }  (public; "website" is a hidden bot trap)
router.post('/', async (req, res) => {
  const b = req.body || {};
  if (typeof b.website === 'string' && b.website.trim()) return res.status(201).json({ ok: true });
  const msg = {
    name: clean(b.name, 120),
    email: String(b.email || '').trim().toLowerCase().slice(0, 200),
    reason: REASONS.includes(b.reason) ? b.reason : (clean(b.reason, 80) || 'General inquiry'),
    message: clean(b.message, 5000),
  };
  if (!msg.name || !EMAIL_RE.test(msg.email) || msg.message.length < 2) {
    return res.status(400).json({ error: 'Please add your name, a valid email and a message.' });
  }

  let saved = null;
  const { data, error } = await supabaseAdmin.from('contact_messages').insert(msg).select('id').single();
  if (!error) saved = data;
  else if (!notMigrated(error)) console.error(JSON.stringify({ type: 'error', scope: 'contact_save', message: error.message }));

  let emailed = false;
  try {
    // To the mailbox for the reason (speaking and press: Alpha; orders: books@; the rest: info@), and
    // to Alpha too, so nothing waits in a box nobody opened. Translation suggestions: info@ only.
    const { to } = recipientsFor(msg.reason);
    const r = await sendContactToAuthor(to, msg);
    emailed = !r?.error;
    if (r?.error) console.error(JSON.stringify({ type: 'error', scope: 'contact_email', message: r.error.message }));
  } catch (err) {
    console.error(JSON.stringify({ type: 'error', scope: 'contact_email', message: err.message }));
  }
  if (saved && emailed) await supabaseAdmin.from('contact_messages').update({ emailed: true }).eq('id', saved.id);

  // Nothing kept and nothing sent: say so, so the visitor can email directly instead.
  if (!saved && !emailed) return res.status(502).json({ error: 'Your message could not be sent right now. Please email info@canwetalkvoice.com.' });

  if (recipientsFor(msg.reason).notifyAuthor) authorIds()
    .then((ids) => notifyUsers(ids, { title: `New message: ${msg.reason}`, body: `${msg.name}: ${msg.message.slice(0, 120)}`, url: '/#admin' }))
    .catch(() => {});
  res.status(201).json({ ok: true });
});

// GET /api/contact  (Alpha) every message, newest first, with the number still new
router.get('/', requireAuth, requireAuthor, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('contact_messages').select(COLS).order('created_at', { ascending: false }).limit(500);
  if (error) {
    return res.status(notMigrated(error) ? 503 : 500).json({
      error: notMigrated(error) ? 'Run migration 015 in Supabase to keep messages here. Until then they are emailed to Alpha only.' : error.message,
    });
  }
  res.json({ messages: data, unread: data.filter((m) => m.status === 'new').length });
});

// GET /api/contact/unread  (Alpha) number of new messages, for the dashboard badge
router.get('/unread', requireAuth, requireAuthor, async (req, res) => {
  const { count, error } = await supabaseAdmin.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new');
  res.json({ unread: error ? 0 : count || 0 });
});

// PATCH /api/contact/:id  { status: new | read | replied }
router.patch('/:id', requireAuth, requireAuthor, async (req, res) => {
  const status = ['new', 'read', 'replied'].includes(req.body?.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Unknown status' });
  const now = new Date().toISOString();
  const patch = { status, ...(status === 'read' ? { read_at: now } : {}), ...(status === 'replied' ? { replied_at: now } : {}) };
  const { data, error } = await supabaseAdmin.from('contact_messages').update(patch).eq('id', req.params.id).select(COLS).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/contact/:id/reply  { reply }  emails the sender and marks the message replied
router.post('/:id/reply', requireAuth, requireAuthor, async (req, res) => {
  const reply = clean(req.body?.reply, 5000);
  if (reply.length < 2) return res.status(400).json({ error: 'Write a reply first.' });
  const { data: m, error } = await supabaseAdmin.from('contact_messages').select(COLS).eq('id', req.params.id).single();
  if (error || !m) return res.status(404).json({ error: 'Message not found' });
  const r = await sendContactReply(m.email, m.name, reply, m.message, process.env.ADMIN_EMAIL).catch((err) => ({ error: err }));
  if (r?.error) return res.status(502).json({ error: 'The reply email could not be sent. Try again, or reply from your email app.' });
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from('contact_messages')
    .update({ reply, status: 'replied', replied_at: now, read_at: m.read_at || now })
    .eq('id', m.id)
    .select(COLS)
    .single();
  res.json(data);
});

// DELETE /api/contact/:id  (Alpha)
router.delete('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { error } = await supabaseAdmin.from('contact_messages').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;
