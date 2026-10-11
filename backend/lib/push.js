import webpush from 'web-push';
import { supabaseAdmin } from './supabase.js';

// App notifications for new publications.
//
// Needs three environment variables on the server:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (a pair made with `npx web-push generate-vapid-keys`)
//   VAPID_SUBJECT                        (mailto:alpha.jalloh@canwetalkvoice.com)
// Without them push is switched off and everything else carries on as normal.

const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alpha.jalloh@canwetalkvoice.com';

export const pushEnabled = Boolean(PUBLIC && PRIVATE);
if (pushEnabled) webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

export function pushPublicKey() {
  return pushEnabled ? PUBLIC : null;
}

// Sends one notification to every subscribed device. Never throws: a failed
// notification must not fail the publish that triggered it. Devices that have
// uninstalled or revoked permission answer 404 or 410 and are removed.
export async function notifyEveryone({ title, body, url, image }) {
  if (!pushEnabled) return { sent: 0, skipped: 'push not configured' };
  const { data: subs, error } = await supabaseAdmin.from('push_subscriptions').select('id,endpoint,p256dh,auth');
  if (error || !subs?.length) return { sent: 0 };

  const payload = JSON.stringify({ title, body, url: url || '/', image: image || null });
  let sent = 0;
  const dead = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 * 3 });
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(s.id);
      else console.error(JSON.stringify({ type: 'error', scope: 'push_send', status: err.statusCode, message: err.message }));
    }
  }));
  if (dead.length) await supabaseAdmin.from('push_subscriptions').delete().in('id', dead);
  return { sent, removed: dead.length };
}

// Fire and forget, for use inside a request handler after the response.
export function announce(message) {
  notifyEveryone(message).catch((err) =>
    console.error(JSON.stringify({ type: 'error', scope: 'push_announce', message: err.message })));
}
