# ROADMAP: Can We Talk? author site, app and API

What is next, what is waiting on someone, and ideas for later. Tick items off (or remove them) as they are done, and add new ones. Detail lives in the linked notes.
Back to the [BRAIN](BRAIN.md) · [LOG](LOG.md)

## Now and next (from the B&A owner area, 16 October 2026)
- [ ] Speed, next step: split the dashboard and reader code out of the 500 KB page so phones stop blocking on load.
- [ ] Tidy the first visit privacy notice (very tall on phones, its I agree button looks like plain text).

## Open items
_From [PROGRESS.md](../PROGRESS.md)_

##### Needs the owner

- [ ] **Rotate every credential.** The database password, Supabase anon and
      service role keys, and the developer account password were all pasted
      into a chat transcript and must be considered exposed.
- [ ] **Verify the Resend domain.** All four DNS records are live and
      verification has been triggered; status was still `pending` at last check.
      See `docs/email-setup.md`. Until it reports `verified`, no site email
      sends at all.
- [ ] Lawyer review of `frontend/privacy.html` before any store submission.
- [ ] Confirm the Resend test email arrived in the `@canwetalkvoice.com`
      mailbox. The domain is verified and a send returned 200.

- [ ] **Run `010_book_metadata.sql`.** The code is deployed and falls back
      safely without it, so the site works either way, but the new author
      fields will not save until the columns exist.

- [ ] **Add the notification keys to Render** (backend, Environment):
      `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` from
      `Desktop/vapid-keys-for-render.json` (not in the repo), and
      `VAPID_SUBJECT=mailto:alpha.jalloh@canwetalkvoice.com`. Then delete that file.
- [ ] Optional: `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` for narration in
      Alpha's own voice. Steps in `docs/voice-narration.md`.
- [ ] Paste each book's full text into the dashboard (Books, Edit, reader
      text). Both books have none yet, so Book Club "Read Online" says the book
      is not in the reader yet.
- [ ] Optional: `GITHUB_DEPLOY_TOKEN` in Render (fine grained token, this repo,
      Actions read and write) so a new essay's WhatsApp preview is ready within
      minutes. Without it the share pages refresh every two hours.
- [ ] **Google Play:** follow `Desktop/can-we-talk-android/PLAY-STORE-SUBMISSION.md`.
      The signed bundle, store graphics and screenshots are in that folder.
      **Back up `Desktop/can-we-talk-android/signing/` today.** After the first
      upload, add Play's app signing SHA-256 to `frontend/.well-known/assetlinks.json`.

##### Needs building

- [ ] Decide the Play Billing approach before any Play build.
      See `docs/google-play/08-payments-and-billing.md`.
- [ ] Shipping cost by country. Checkout charges the same regardless of
      destination, which will not survive real international orders.
- [ ] Stock is tracked but never set. `stock_count` is null on every format,
      so nothing decrements and nothing can sell out.
- [x] Narration in Alpha's own voice: built (11 Oct), waits on the ElevenLabs
      keys. Device voices now prefer a male West African English voice.
- [ ] Blocking screenshots needs `FLAG_SECURE` in an Android build. A website
      cannot do it. See `docs/content-protection.md`, including the tradeoff.

---

## Remaining account-side work
_From [CLAUDE_HANDOFF.md](../CLAUDE_HANDOFF.md)_

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
