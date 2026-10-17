import { supabaseAdmin } from './supabase.js';

// Settings the server may take from a private Storage file (bucket "server-config", file
// "server.json", readable only with the service role) when they are not set on Render. Render's own
// environment always wins: a value is only filled in when it is missing. Only the names below are
// accepted. Used so notifications could be switched on without Render dashboard access; once the keys
// are rotated and set on Render, the file is simply ignored.
const ALLOWED = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];

export async function loadServerConfig() {
  const missing = ALLOWED.filter((name) => !process.env[name]);
  if (!missing.length) return { filled: [] };
  try {
    const download = supabaseAdmin.storage.from('server-config').download('server.json');
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ error: new Error('timed out') }), 5000));
    const { data, error } = await Promise.race([download, timeout]);
    if (error || !data) return { filled: [], error: error?.message };
    const json = JSON.parse(await data.text());
    const filled = [];
    for (const name of missing) {
      if (typeof json[name] === 'string' && json[name].trim()) { process.env[name] = json[name].trim(); filled.push(name); }
    }
    if (filled.length) console.log(JSON.stringify({ type: 'info', scope: 'server_config', filled }));
    return { filled };
  } catch (err) {
    return { filled: [], error: err.message };
  }
}
