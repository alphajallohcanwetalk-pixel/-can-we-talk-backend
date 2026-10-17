import express from 'express';
import { logAppError } from '../lib/errorLog.js';

const router = express.Router();

// Sign in and email settings (email confirmation, sign ups, passwords, links, the mail server,
// email wording, Google sign in), changed from the dashboard instead of the Supabase website.
// Mounted under /api/dev, so only developer accounts reach it (and their second factor, when on).
//
// It talks to the Supabase Management API with a personal access token kept only on the server
// (SUPABASE_ACCESS_TOKEN on Render). Only the fields below can be read or changed; passwords and
// secrets are write only and never sent to the browser.

const MGMT = 'https://api.supabase.com/v1';
const projectRef = () => (process.env.SUPABASE_URL || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || '';

const FIELDS = {
  disable_signup: 'bool',
  mailer_autoconfirm: 'bool',
  external_email_enabled: 'bool',
  mailer_secure_email_change_enabled: 'bool',
  mfa_totp_enroll_enabled: 'bool',
  mfa_totp_verify_enabled: 'bool',
  password_min_length: { int: [6, 72] },
  mailer_otp_exp: { int: [300, 86400] },
  site_url: 'url',
  uri_allow_list: 'text',
  rate_limit_email_sent: { int: [1, 1000] },
  smtp_admin_email: 'email',
  smtp_host: 'text',
  smtp_port: 'port',
  smtp_user: 'text',
  smtp_pass: 'secret',
  smtp_sender_name: 'text',
  smtp_max_frequency: { int: [1, 3600] },
  mailer_subjects_confirmation: 'text',
  mailer_templates_confirmation_content: 'html',
  mailer_subjects_recovery: 'text',
  mailer_templates_recovery_content: 'html',
  external_google_enabled: 'bool',
  external_google_client_id: 'text',
  external_google_secret: 'secret',
};
const SECRETS = Object.keys(FIELDS).filter((k) => FIELDS[k] === 'secret');

// Keep only known fields with the right types; anything else is refused.
export function cleanAuthPatch(body) {
  const out = {};
  const problems = [];
  for (const [key, value] of Object.entries(body || {})) {
    const kind = FIELDS[key];
    if (!kind) { problems.push(`${key} cannot be changed here`); continue; }
    if (kind === 'bool') { if (typeof value !== 'boolean') problems.push(`${key} must be on or off`); else out[key] = value; continue; }
    if (kind.int) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < kind.int[0] || n > kind.int[1]) problems.push(`${key} must be a whole number from ${kind.int[0]} to ${kind.int[1]}`);
      else out[key] = n;
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (kind === 'secret') { if (text) out[key] = text; continue; }          // empty means "leave as it is"
    if (kind === 'url') { if (!/^https:\/\/[^\s]+$/.test(text)) problems.push(`${key} must be an https address`); else out[key] = text; continue; }
    if (kind === 'email') { if (text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) problems.push(`${key} must be an email address`); else out[key] = text; continue; }
    if (kind === 'port') { if (text && !/^\d{2,5}$/.test(text)) problems.push(`${key} must be a port number`); else out[key] = text; continue; }
    if (kind === 'html') { if (text.length > 20000) problems.push(`${key} is too long`); else out[key] = text; continue; }
    if (text.length > 2000) problems.push(`${key} is too long`); else out[key] = text;
  }
  return { patch: out, problems };
}

// What the browser may see: the known fields, secrets replaced by "is it set".
function visible(config) {
  const out = {};
  for (const key of Object.keys(FIELDS)) {
    if (SECRETS.includes(key)) out[`${key}_set`] = Boolean(config?.[key]);
    else out[key] = config?.[key] ?? null;
  }
  return out;
}

async function management(method, body) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = projectRef();
  if (!token || !ref) return { status: 503, data: { error: 'not_connected' } };
  const res = await fetch(`${MGMT}/projects/${ref}/config/auth`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const NOT_CONNECTED = {
  error: 'not_connected',
  hint: 'Create a personal access token at https://supabase.com/dashboard/account/tokens, then add it on Render (can-we-talk-backend, Environment) as SUPABASE_ACCESS_TOKEN.',
};

// GET /api/dev/auth-settings
router.get('/', async (req, res) => {
  try {
    const { status, data } = await management('GET');
    if (status === 503) return res.status(503).json(NOT_CONNECTED);
    if (status === 401 || status === 403) return res.status(502).json({ error: 'The Supabase access token was refused. Make a new one and replace SUPABASE_ACCESS_TOKEN on Render.' });
    if (status >= 400) return res.status(502).json({ error: data?.message || `Supabase answered ${status}` });
    res.set('Cache-Control', 'no-store');
    res.json({ settings: visible(data), resend_available: Boolean(process.env.RESEND_API_KEY), project: projectRef() });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach Supabase: ' + err.message });
  }
});

// PATCH /api/dev/auth-settings  { field: value, ... }   (only the fields being changed)
router.patch('/', async (req, res) => {
  const { patch, problems } = cleanAuthPatch(req.body);
  if (problems.length) return res.status(400).json({ error: problems.join('. ') });
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change' });
  try {
    const { status, data } = await management('PATCH', patch);
    if (status === 503) return res.status(503).json(NOT_CONNECTED);
    if (status >= 400) return res.status(502).json({ error: data?.message || `Supabase answered ${status}` });
    // A record of who changed what (never the values of secrets).
    logAppError({ error: new Error(`Sign in settings changed: ${Object.keys(patch).join(', ')}`), req, status: 200, source: 'auth-settings', level: 'info',
      context: { changed: Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, SECRETS.includes(k) ? '(set)' : v])) } }).catch(() => {});
    res.json({ settings: visible(data) });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach Supabase: ' + err.message });
  }
});

// POST /api/dev/auth-settings/use-resend: send every sign in email through Resend (already used for
// the site's other emails), which lifts Supabase's built in limit of a few emails an hour.
router.post('/use-resend', async (req, res) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(400).json({ error: 'RESEND_API_KEY is not set on the server.' });
  const from = process.env.EMAIL_FROM || '';
  const address = (from.match(/<([^>]+)>/) || [null, from])[1].trim();
  const name = from.includes('<') ? from.split('<')[0].trim().replace(/^"|"$/g, '') : 'Can We Talk?';
  if (!/^[^\s@]+@[^\s@]+$/.test(address)) return res.status(400).json({ error: 'EMAIL_FROM on the server is not an email address.' });
  const patch = { smtp_host: 'smtp.resend.com', smtp_port: '465', smtp_user: 'resend', smtp_pass: key, smtp_admin_email: address, smtp_sender_name: name || 'Can We Talk?', rate_limit_email_sent: 100 };
  try {
    const { status, data } = await management('PATCH', patch);
    if (status === 503) return res.status(503).json(NOT_CONNECTED);
    if (status >= 400) return res.status(502).json({ error: data?.message || `Supabase answered ${status}` });
    logAppError({ error: new Error('Sign in emails now sent through Resend'), req, status: 200, source: 'auth-settings', level: 'info', context: { smtp_admin_email: address } }).catch(() => {});
    res.json({ settings: visible(data) });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach Supabase: ' + err.message });
  }
});

export default router;
