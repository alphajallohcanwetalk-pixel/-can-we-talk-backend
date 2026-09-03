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
4. For `frontend/app.html`: right now it runs on temporary in-memory data
   (nothing saves after a refresh). Once the backend is running, the next
   step is connecting `app.html` to the real API — ask Claude to do that pass
   when you're ready.
