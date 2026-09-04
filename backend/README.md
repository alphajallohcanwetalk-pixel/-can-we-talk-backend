# Can We Talk? — Backend Setup Guide

This is the real backend for the site: accounts, database, payments, and email.
Follow these steps in order — each one unlocks the next.

---

## 1. Create your accounts (15 minutes, all free to start)

1. **Supabase** — https://supabase.com → New Project. Note your **Project URL**,
   **anon public key**, and **service_role key** (Settings → API).
2. **Stripe** — https://stripe.com → sign up, stay in **test mode** for now.
   Note your **Secret key** (Developers → API keys).
3. **Resend** — https://resend.com → sign up, verify a sending domain
   (or use their test domain while developing). Note your **API key**.

---

## 2. Set up the database

1. In Supabase, open **SQL Editor**.
2. Paste the contents of `schema.sql` (in this folder) and run it.
3. This creates every table: profiles, books, essays, orders, comments,
   audiobook chapters, and Book Club subscriptions — plus security rules
   so users can only see their own orders/subscriptions.

---

## 3. Configure environment variables

1. Copy `.env.example` to `.env`.
2. Fill in every value from steps 1–2.
3. For `ADMIN_EMAIL`: after Alpha creates his account on the live site,
   run this once in Supabase SQL Editor to make him the author:
   ```sql
   update profiles set is_author = true where email = 'alpha@his-real-email.com';
   ```

For the production Render service, use these non-secret values:

```text
FRONTEND_URL=https://canwetalkvoice.com
FRONTEND_APP_URL=https://canwetalkvoice.com
EMAIL_FROM=Can We Talk <questions@canwetalkvoice.com>
PORT=4000
ADMIN_EMAIL=alpha.jalloh@canwetalkvoice.com
```

Use the exact recurring Stripe Price IDs from Stripe Dashboard, beginning with
`price_`; do not use Product IDs beginning with `prod_`.

---

## 4. Set up Stripe products (for the Book Club)

1. Stripe Dashboard → Products → **Add product**.
2. Create "AJ Book Club — Monthly" ($4.99/month, recurring) and
   "AJ Book Club — Annual" ($39.99/year, recurring).
3. Copy each **Price ID** (starts with `price_...`) into your `.env`.

---

## 5. Run it locally

```bash
cd backend
npm install
npm run dev
```

Test it's alive: open `http://localhost:4000/api/health` — should return `{"ok":true}`.

### Testing Stripe webhooks locally
Stripe needs to reach your webhook endpoint. Use the Stripe CLI:
```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```
This prints a `whsec_...` value — put that in `STRIPE_WEBHOOK_SECRET` in `.env`.

---

## 6. Frontend connection

The frontend is connected to the deployed API at
`https://can-we-talk-backend.onrender.com`. It uses Supabase Auth in the browser
and calls the backend for books, essays, comments, media, orders, Book Club,
settings, and email side effects.

```javascript
// Instead of the in-memory `books` array:
const res = await fetch(`${API_URL}/api/books`);
const books = await res.json();

// Instead of the mock sign-up:
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } });
// then:
await fetch(`${API_URL}/api/auth/welcome`, { method: 'POST', body: JSON.stringify({ email, full_name }) });

// Checkout:
const res = await fetch(`${API_URL}/api/orders/checkout`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ items: cart, shipping_address })
});
const { checkout_url } = await res.json();
window.location.href = checkout_url; // redirects to Stripe's hosted checkout page
```

## 7. Current deployment

- **Backend**: Render, root directory `backend`, build command `npm install`,
  start command `npm start`.
- **Frontend**: GitHub Pages at `https://canwetalkvoice.com`.
- **Production webhook URL**:
  `https://can-we-talk-backend.onrender.com/api/webhooks/stripe`
- **Health check**: `https://can-we-talk-backend.onrender.com/api/health` returns
  `{"ok":true}`.

Before accepting real payments, configure the Render environment variables,
run `schema.sql` in Supabase, add the production site URL to Supabase Auth,
configure the Stripe webhook, and use Stripe Price IDs beginning with `price_`.

---

## What's covered vs. what's still a placeholder

| Feature | Status |
|---|---|
| Accounts, sign-in/out, sessions | ✅ Real (Supabase Auth) |
| Books, essays — read/write | ✅ Real (Postgres + REST routes) |
| Comments & ratings | ✅ Real |
| Book purchases + Stripe Checkout | ✅ Real |
| Order confirmation email | ✅ Real (Resend) |
| Welcome email | ✅ Real |
| New essay alert email | ✅ Real |
| AJ Book Club subscription (Stripe recurring) | ✅ Real |
| Audiobook chapter purchase (one-off Stripe charge) | ✅ Real |
| **Audiobook narration audio itself** | ❌ Still needs a voice-cloning service (ElevenLabs/Resemble) — `audio_url` field is ready to receive the file once generated |
| **AJ Book Club real book text** | ❌ `reader_full_text` column is ready — needs the real manuscript text pasted in |
| Screenshot/copy deterrence in the reader | ✅ Same front-end measures as before — still not literally screenshot-proof (nothing web-based is) |
| Mobile money payment methods | ⚠️ Stripe supports some, depending on country — check Stripe's supported payment methods for Sierra Leone specifically before launch |

---

## Rough monthly cost at small scale
- Supabase: free tier covers this comfortably early on
- Stripe: no monthly fee, ~2.9% + $0.30 per transaction
- Resend: free tier covers ~3,000 emails/month
- Hosting (Render/Railway): ~$5–7/month for the API

Nothing here requires a big budget to start.
