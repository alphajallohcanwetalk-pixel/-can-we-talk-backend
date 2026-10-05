import { supabaseAdmin } from '../lib/supabase.js';

// Reads the Authenticator Assurance Level out of the access token.
// aal1 = password only. aal2 = a second factor was also presented.
// The token's signature was already verified by supabaseAdmin.auth.getUser
// before this runs, so decoding the payload here is safe.
function tokenAal(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.aal || 'aal1';
  } catch {
    return 'aal1';
  }
}

// Once an account has enrolled a second factor, every privileged request must
// carry an aal2 token. Without this the factor would be decorative: a stolen
// password alone would still reach these routes through the API, even though
// the browser asks for a code.
async function enforceSecondFactor(req, res) {
  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: req.user.id });
  if (error) return true;   // cannot tell: fail open rather than lock the author out
  const verified = (data?.factors || []).filter((f) => f.status === 'verified');
  if (!verified.length) return true;

  if (tokenAal(req.accessToken || '') !== 'aal2') {
    res.status(403).json({ error: 'Two factor authentication required', code: 'mfa_required' });
    return false;
  }
  return true;
}

// Verifies the Supabase JWT sent from the frontend (Authorization: Bearer <token>)
// and attaches req.user. Frontend gets this token from supabase.auth.getSession().
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' });

  req.user = data.user;
  req.accessToken = token;   // kept so the AAL claim can be read later
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
  if (!(await enforceSecondFactor(req, res))) return;
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
  if (!(await enforceSecondFactor(req, res))) return;
  next();
}
