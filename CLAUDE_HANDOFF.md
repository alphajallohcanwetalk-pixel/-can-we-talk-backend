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

## Local development

```powershell
cd backend
npm install
npm run dev
```

Test locally at `http://localhost:4000/api/health`.