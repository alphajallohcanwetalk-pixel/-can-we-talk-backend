# Can We Talk? (The Misfit Voice) — Project Files

Two folders:

- **frontend/** — `app.html`, the whole website. Open it directly in a browser to preview,
  or open the folder in VS Code to edit it.
- **backend/** — the real API (accounts, database, payments, email). See
  `backend/README.md` for the full setup walkthrough — start there.

## Quick start in VS Code

1. Unzip this folder anywhere on your computer.
2. In VS Code: **File → Open Folder** → select `can-we-talk-project`.
3. Open `backend/README.md` and follow it step by step — it walks through
   creating your Supabase, Stripe, and Resend accounts, running the database
   schema, and starting the server.
4. The frontend is deployed at https://canwetalkvoice.com and calls the
   backend at https://can-we-talk-backend.onrender.com.

## Deployment status

- GitHub Pages publishes `frontend/app.html` through `.github/workflows/deploy-pages.yml`.
- Render runs the backend with root directory `backend`, build command `npm install`,
  and start command `npm start`.
- Backend health check: https://can-we-talk-backend.onrender.com/api/health
- Production frontend origins are allowed by the backend CORS configuration.
- Operations, emergency recovery, backups, and logs: see [OPERATIONS.md](OPERATIONS.md).
- Remaining setup is account configuration: Render environment variables, Supabase
  schema and allowed URLs, Stripe webhook and price IDs, and credential rotation.
