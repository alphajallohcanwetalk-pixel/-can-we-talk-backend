# Claude Coding Handoff

## Verified state

- Repository: `https://github.com/alphajallohcanwetalk-pixel/-can-we-talk-backend`
- Branch: `main`
- Project layout is flat: `backend/`, `frontend/`, `.github/`, `README.md`.
- Frontend: `https://canwetalkvoice.com`
- Render backend: `https://can-we-talk-backend.onrender.com`
- Health endpoint returns `{"ok":true}`.
- Frontend API base URL is the Render backend URL.
- GitHub Pages workflow publishes `frontend/app.html` as `dist/index.html` and
  publishes the root `CNAME` file.
- Latest repository change added CORS support for both production domain variants
  and local preview origins. Commit: `48a2682`.

## Render settings

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

## Render environment values

Add these non-secret values exactly:

```text
FRONTEND_URL=https://canwetalkvoice.com
FRONTEND_APP_URL=https://canwetalkvoice.com
EMAIL_FROM=Can We Talk <questions@canwetalkvoice.com>
PORT=4000
ADMIN_EMAIL=alpha.jalloh@canwetalkvoice.com
```

Add these provider variables using the rotated values from their dashboards:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
```

Add the live Stripe recurring Price IDs, which must begin with `price_`:

```text
STRIPE_PRICE_BOOKCLUB_MONTHLY=price_...
STRIPE_PRICE_BOOKCLUB_ANNUAL=price_...
SENTRY_DSN=https://...  # optional, configure in Render for crash alerts
VAPID_PUBLIC_KEY=...    # app notifications (pair from npx web-push generate-vapid-keys)
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
SUPABASE_ACCESS_TOKEN=sbp_...  # optional, a Supabase personal access token: lets the dashboard Developer tab change sign in and email settings
```

## Remaining account-side work

1. Add production environment variables in Render. Never commit or paste secrets.
2. Use `FRONTEND_URL=https://canwetalkvoice.com` and
   `FRONTEND_APP_URL=https://canwetalkvoice.com`.
3. Run `backend/schema.sql` in Supabase and add the production URL to Supabase Auth
   allowed site URLs.
4. Configure Stripe webhook:
   `https://can-we-talk-backend.onrender.com/api/webhooks/stripe`
5. Use Stripe recurring Price IDs beginning with `price_`, not Product IDs beginning
   with `prod_`.
6. Rotate any Supabase service key, Stripe key/webhook secret, or Resend key that was
   exposed during setup.

## Languages (28) and the Google translation key

The site, Alpha's content and the readers' emails are in 28 languages (design:
docs/superpowers/specs/2026-10-18-languages-design.md). Everything existing was translated by B&A.
New essays, captions and descriptions stay English until the Google key exists (then they are
translated automatically; that worker is the next step, see ROADMAP).

Steps for Alpha (Alpha's own Google account and card; B&A never needs the password):
1. Open https://console.cloud.google.com, sign in, create a project named "Can We Talk".
2. Billing: add a payment card. Then Billing, Budgets and alerts: a budget of 5 US dollars a month
   with email alerts at 50%, 90% and 100%.
3. APIs and services, Library: enable "Cloud Translation API".
4. APIs and services, Credentials: Create credentials, API key. Edit it: "Restrict key" to the
   Cloud Translation API only.
5. Send the key to B&A privately (not by email to a shared inbox). B&A adds GOOGLE_TRANSLATE_KEY on Render.

The free allowance is 500,000 characters a month. B&A will cap use with TRANSLATE_MONTHLY_CHARS
(default 400,000) and translate per paragraph, so a typo fix does not retranslate a whole essay.

Translations: the site dictionaries are frontend/i18n/<code>.json (keys are the English text); after
changing English text run `node scripts/i18n-extract.mjs` (updates en.json and copies the
dictionaries to backend/i18n for emails) and `node scripts/i18n-coverage.mjs` (what each language misses).
Alpha's content translations live in the table content_translations (migration 016); load files with
`node scripts/i18n-content.mjs <content-en.json> <folder>`. Translation suggestions from readers go to
info@ (contact reason "Translation"), never to Alpha.

## Local development

```powershell
cd backend
npm install
npm run dev
```

Test locally at `http://localhost:4000/api/health`.