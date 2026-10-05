import { supabaseAdmin } from './supabase.js';

// Writes a failure to app_error_logs so it can be read from the developer
// panel rather than only from the hosting provider's log tail.
//
// Two rules here:
//   1. Never store request bodies, headers, cookies or tokens. A crash report
//      that captures a customer's address or a bearer token turns a debugging
//      aid into a second breach.
//   2. Never let logging break the request. Every failure inside this function
//      is swallowed: if the log table is missing or the database is down, the
//      user's request must still complete.
const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;

const trim = (value, limit) =>
  (typeof value === 'string' && value.length > limit ? value.slice(0, limit) : value) || null;

export async function logAppError({ error, req, status = 500, source = 'api', level = 'error', context = {} }) {
  try {
    await supabaseAdmin.from('app_error_logs').insert({
      level,
      source,
      message: trim(error?.message || String(error || 'Unknown error'), MAX_MESSAGE),
      stack: trim(error?.stack || null, MAX_STACK),
      path: trim(req?.path || null, 500),
      method: req?.method || null,
      status,
      request_id: req?.requestId || null,
      user_id: req?.user?.id || null,
      user_agent: trim(req?.headers?.['user-agent'] || null, 500),
      context
    });
  } catch {
    // Logging must never take the request down with it.
  }
}
