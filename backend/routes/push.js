import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { pushPublicKey, notifyEveryone } from '../lib/push.js';
import { isSafeHttpUrl } from '../lib/validate.js';
import { optionalUser } from '../lib/entitlements.js';

const router = express.Router();

// GET /api/push/public-key: the browser needs this to subscribe.
router.get('/public-key', (req, res) => {
  const key = pushPublicKey();
  if (!key) return res.status(503).json({ error: 'Notifications are not configured yet' });
  res.json({ key });
});

// POST /api/push/subscribe { subscription }: a device agrees to be notified.
// Signed in readers are linked to their account; anyone else is anonymous.
router.post('/subscribe', async (req, res) => {
  const sub = req.body?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!isSafeHttpUrl(endpoint) || !endpoint.startsWith('https://') || endpoint.length > 1000 ||
      typeof p256dh !== 'string' || p256dh.length > 200 || typeof auth !== 'string' || auth.length > 100) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  const user = await optionalUser(req);
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({ endpoint, p256dh, auth, user_id: user?.id || null, last_ok_at: new Date().toISOString() }, { onConflict: 'endpoint' });
  if (error) return res.status(500).json({ error: 'Could not save the subscription' });
  res.status(201).json({ subscribed: true });
});

// POST /api/push/unsubscribe { endpoint }
router.post('/unsubscribe', async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint) return res.status(400).json({ error: 'endpoint is required' });
  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
  res.json({ subscribed: false });
});

// GET /api/push/stats: Author Dashboard: how many devices will hear about a new release.
router.get('/stats', requireAuth, requireAuthor, async (req, res) => {
  const { count, error } = await supabaseAdmin.from('push_subscriptions').select('id', { count: 'exact', head: true });
  if (error) return res.json({ devices: 0, configured: Boolean(pushPublicKey()) });
  res.json({ devices: count || 0, configured: Boolean(pushPublicKey()) });
});

// POST /api/push/test: Author Dashboard: send a test notification to every device.
router.post('/test', requireAuth, requireAuthor, async (req, res) => {
  const result = await notifyEveryone({ title: 'Can We Talk?', body: 'Notifications are working.', url: '/' });
  res.json(result);
});

export default router;
