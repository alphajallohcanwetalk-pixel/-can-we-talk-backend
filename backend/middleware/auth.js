import { supabaseAdmin } from '../lib/supabase.js';

// Verifies the Supabase JWT sent from the frontend (Authorization: Bearer <token>)
// and attaches req.user. Frontend gets this token from supabase.auth.getSession().
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' });

  req.user = data.user;
  next();
}

// Use after requireAuth, only lets Alpha's account through (for the Author Dashboard routes).
export async function requireAuthor(req, res, next) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_author')
    .eq('id', req.user.id)
    .single();

  if (!profile?.is_author) return res.status(403).json({ error: 'Author access only' });
  next();
}

// Use after requireAuth. Gates the /api/dev diagnostics, which expose error
// stacks and configuration state and so must never be reachable by a reader.
// The flag lives on the profile row, so access is revoked with one UPDATE and
// no credential is ever written into the application.
export async function requireDeveloper(req, res, next) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_developer')
    .eq('id', req.user.id)
    .single();

  if (!profile?.is_developer) return res.status(403).json({ error: 'Developer access only' });
  next();
}
