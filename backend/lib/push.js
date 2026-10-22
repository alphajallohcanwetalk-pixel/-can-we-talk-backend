import webpush from 'web-push';
import { supabaseAdmin } from './supabase.js';
import { isLang, t } from './i18n.js';

// App notifications for new publications.
//
// Needs three environment variables on the server:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (a pair made with `npx web-push generate-vapid-keys`)
//   VAPID_SUBJECT                        (mailto:alpha.jalloh@canwetalkvoice.com)
// Without them push is switched off and everything else carries on as normal.

// Read when needed (not once at start), so keys filled in at startup from lib/serverConfig.js count too.
let applied = '';
function pushReady() {
  const pub = process.env.VAPID_PUBLIC_KEY || '';
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  if (!pub || !priv) return false;
  const subject = process.env.VAPID_SUBJECT || 'mailto:alpha.jalloh@canwetalkvoice.com';
  if (applied !== pub + subject) {
    try { webpush.setVapidDetails(subject, pub, priv); applied = pub + subject; } catch (err) {
      console.error(JSON.stringify({ type: 'error', scope: 'push_keys', message: err.message }));
      return false;
    }
  }
  return true;
}

export function pushPublicKey() {
  return pushReady() ? process.env.VAPID_PUBLIC_KEY : null;
}

/** Devices grouped by the language of their account (English for devices with no account). */
export function groupByLanguage(subs, langOf) {
  const groups = new Map();
  for (const s of subs) {
    const l = isLang(langOf[s.user_id]) ? langOf[s.user_id] : 'en';
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(s);
  }
  return groups;
}

// Sends one notification to every subscribed device, in each device's account language (title
// through t(); values fill {placeholders}). Never throws: a failed notification must not fail the
// publish that triggered it. Devices that have uninstalled or revoked permission answer 404 or 410
// and are removed.
export async function notifyEveryone({ title, body, url, image, values }) {
  if (!pushReady()) return { sent: 0, skipped: 'push not configured' };
  let { data: subs, error } = await supabaseAdmin.from('push_subscriptions').select('id,endpoint,p256dh,auth,user_id');
  if (error) ({ data: subs, error } = await supabaseAdmin.from('push_subscriptions').select('id,endpoint,p256dh,auth'));
  if (error || !subs?.length) return { sent: 0 };

  const ids = [...new Set(subs.map((s) => s.user_id).filter(Boolean))];
  const langOf = {};
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id,language').in('id', ids);
    for (const p of profiles || []) langOf[p.id] = p.language;
  }
  let sent = 0;
  const dead = [];
  for (const [lang, group] of groupByLanguage(subs, langOf)) {
    const payload = JSON.stringify({ title: t(lang, title, values), body, url: url || '/', image: image || null });
    await Promise.all(group.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 * 3 });
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(s.id);
        else console.error(JSON.stringify({ type: 'error', scope: 'push_send', status: err.statusCode, message: err.message }));
      }
    }));
  }
  if (dead.length) await supabaseAdmin.from('push_subscriptions').delete().in('id', dead);
  return { sent, removed: dead.length };
}

// Fire and forget, for use inside a request handler after the response.
export function announce(message) {
  notifyEveryone(message).catch((err) =>
    console.error(JSON.stringify({ type: 'error', scope: 'push_announce', message: err.message })));
}

// A notification for chosen people only (for example Alpha when a message arrives). Never throws.
export async function notifyUsers(userIds, { title, body, url }) {
  if (!pushReady() || !userIds?.length) return { sent: 0 };
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('id,endpoint,p256dh,auth').in('user_id', userIds);
  let sent = 0;
  const payload = JSON.stringify({ title, body, url: url || '/', image: null });
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
    }
  }));
  return { sent };
}
