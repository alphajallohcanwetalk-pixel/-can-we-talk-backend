import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireDeveloper } from '../middleware/auth.js';
import { logAppError } from '../lib/errorLog.js';

const router = express.Router();

// Everything below is developer only. These endpoints report configuration
// state and error stacks, so they are gated twice: a valid session, then the
// is_developer flag on the profile.
router.use(requireAuth, requireDeveloper);

// GET /api/dev/errors?level=&limit=&since=
router.get('/errors', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  let query = supabaseAdmin
    .from('app_error_logs')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (['error', 'warn', 'info'].includes(req.query.level)) query = query.eq('level', req.query.level);
  if (req.query.since) query = query.gte('occurred_at', req.query.since);

  const { data, error } = await query;
  if (error) {
    // The most likely cause is migration 007 not having been run yet. Say so
    // plainly instead of returning an opaque 500.
    return res.status(500).json({
      error: error.message,
      hint: error.message.includes('app_error_logs')
        ? 'Run backend/migrations/007_developer_role_and_error_log.sql in Supabase.'
        : undefined
    });
  }
  res.json(data);
});

// GET /api/dev/errors/summary: counts by level and by path, last 7 days.
router.get('/errors/summary', async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('app_error_logs')
    .select('level,path,status,occurred_at')
    .gte('occurred_at', since)
    .limit(5000);
  if (error) return res.status(500).json({ error: error.message });

  const byLevel = {};
  const byPath = {};
  const byDay = {};
  for (const row of data || []) {
    byLevel[row.level] = (byLevel[row.level] || 0) + 1;
    if (row.path) byPath[row.path] = (byPath[row.path] || 0) + 1;
    const day = String(row.occurred_at).slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  res.json({
    total: (data || []).length,
    by_level: byLevel,
    by_day: Object.entries(byDay).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)),
    top_paths: Object.entries(byPath).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 10)
  });
});

// DELETE /api/dev/errors: clear the log, or prune to the last N days.
router.delete('/errors', async (req, res) => {
  const days = parseInt(req.query.older_than_days, 10);
  let query = supabaseAdmin.from('app_error_logs').delete();
  if (Number.isInteger(days) && days > 0) {
    query = query.lt('occurred_at', new Date(Date.now() - days * 86400000).toISOString());
  } else {
    query = query.neq('id', '00000000-0000-0000-0000-000000000000'); // match all
  }
  const { error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ cleared: true });
});

// GET /api/dev/health: configuration and data state.
// Reports only whether a secret is PRESENT and, for non-secret identifiers,
// its shape. It never returns a key value.
router.get('/health', async (req, res) => {
  const envFlag = (name) => Boolean(process.env[name]);
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  add('SUPABASE_URL set', envFlag('SUPABASE_URL'));
  add('SUPABASE_SERVICE_ROLE_KEY set', envFlag('SUPABASE_SERVICE_ROLE_KEY'));
  add('STRIPE_SECRET_KEY set', envFlag('STRIPE_SECRET_KEY'));
  add('STRIPE_WEBHOOK_SECRET set', envFlag('STRIPE_WEBHOOK_SECRET'));
  add('RESEND_API_KEY set', envFlag('RESEND_API_KEY'));
  add('SENTRY_DSN set', envFlag('SENTRY_DSN'), 'Optional. Enables crash alerts.');

  // Live mode checks: the prefix is safe to look at, the key itself is not.
  const sk = process.env.STRIPE_SECRET_KEY || '';
  add('Stripe key is live mode', sk.startsWith('sk_live_'),
      sk.startsWith('sk_test_') ? 'Currently a TEST key: real payments will not work.' : undefined);
  for (const name of ['STRIPE_PRICE_BOOKCLUB_MONTHLY', 'STRIPE_PRICE_BOOKCLUB_ANNUAL']) {
    const v = process.env[name] || '';
    add(`${name} is a price id`, v.startsWith('price_'),
        v.startsWith('prod_') ? 'This is a PRODUCT id. Book Club checkout will fail.' : undefined);
  }
  add('FRONTEND_APP_URL set', envFlag('FRONTEND_APP_URL'), process.env.FRONTEND_APP_URL || undefined);

  // Database reachability and the state of the schema this app depends on.
  const tables = ['books', 'book_formats', 'essays', 'orders', 'order_items', 'comments',
    'profiles', 'audiobook_chapters', 'chapter_purchases', 'site_settings', 'app_error_logs'];
  const counts = {};
  for (const table of tables) {
    const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    counts[table] = error ? `error: ${error.message}` : count;
  }
  add('Database reachable', typeof counts.books === 'number');
  add('Error log table exists', typeof counts.app_error_logs === 'number',
      typeof counts.app_error_logs === 'number' ? undefined : 'Run migration 007.');

  res.json({
    ok: checks.every((c) => c.ok || c.name.includes('SENTRY')),
    checked_at: new Date().toISOString(),
    node: process.version,
    uptime_seconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    checks,
    row_counts: counts
  });
});

// POST /api/dev/errors/client: lets the browser report a failure it caught.
router.post('/errors/client', async (req, res) => {
  const { message, stack, path: clientPath, context } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  await logAppError({
    error: { message, stack: typeof stack === 'string' ? stack : null },
    req: { ...req, path: typeof clientPath === 'string' ? clientPath : req.path },
    status: 0,
    source: 'client',
    context: context && typeof context === 'object' ? context : {}
  });
  res.status(201).json({ logged: true });
});

export default router;
