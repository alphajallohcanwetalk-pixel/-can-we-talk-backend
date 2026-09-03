import { createClient } from '@supabase/supabase-js';

// Service-role client — full access, used only in server-side routes.
// NEVER send SUPABASE_SERVICE_ROLE_KEY to the frontend.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
