# ROADMAP: Can We Talk? author site, app and API

What is next, what is waiting on someone, and ideas for later. Tick items off (or remove them) as they are done, and add new ones. Detail lives in the linked notes.
Back to the [BRAIN](BRAIN.md) · [LOG](LOG.md)

## Now and next (from the B&A owner area, 16 October 2026)
- [ ] Before the Serv plan ends in December: the three mailboxes (info@, books@, alpha.jalloh@) live on that plan. Move them (for example Zoho Mail free, or Cloudflare Email Routing to existing inboxes) together with the DNS move in docs/DNS_MOVE.md, or mail to the site stops arriving.
- [ ] Optional on Render: set EMAIL_FROM to "Can We Talk? <info@canwetalkvoice.com>" (the code already swaps the old questions@).
- [x] Notifications switched on (18 October 2026): the VAPID keys are read from the private Storage file server-config/server.json (service role only) because Render had none. Owner, when rotating keys: make a new pair (npx web-push generate-vapid-keys), set all three on Render (Render always wins over the file), then delete server-config/server.json. Note: new keys mean devices must turn notifications on again.
- [ ] Owner: create a Supabase personal access token (supabase.com/dashboard/account/tokens) and add it on Render as SUPABASE_ACCESS_TOKEN. Then in the dashboard, Developer tab, Sign in and email settings, press "Send them through Resend" so confirmation and reset emails are not limited to a few an hour.
- [ ] Owner, when convenient: have the Terms and the short in-site Privacy summary reviewed (the template notes are no longer shown to visitors).
- [x] Password reset works again (17 October 2026; tested end to end on the live site).
- [x] PageSpeed passes on phone and desktop (17 October 2026). Watch the `Speed check` run in GitHub Actions after each deploy; phone Performance should stay at 90 or above.
- [ ] Optional: a B&A site checker (crawler) for every client site, with reports in the owner area. Not started; waiting for the owner's go ahead.
- [x] **Run migration 015** (done by the owner, 17 October 2026) (backend/migrations/015_messages_and_gallery_v2.sql) in the Supabase SQL editor: keeps contact messages for the dashboard and turns on the new gallery fields (documents, book and essay links, optional titles, slideshow choice). Then change the uploaded newspaper to 'Newspaper or letter' in the dashboard gallery list.
- [ ] Confirm which inbox Alpha reads: contact messages go to ADMIN_EMAIL (alpha.jalloh@canwetalkvoice.com), a mailbox on the Serv plan that ends in December.
- Decided 16 Oct 2026: the website stays on GitHub Pages, so the repository stays public (GitHub Pages on a free account needs it). The Serv cPanel plan (cpanel.canwetalkvoice.com) is not used for the website.
- [ ] **Before the Serv hosting plan ends in December 2026:** move the domain's DNS to Cloudflare (free) so the website stays online without the plan. Ready to do: [DNS_MOVE.md](DNS_MOVE.md) and the import file [dns/canwetalkvoice.com.zone](dns/canwetalkvoice.com.zone). Needs the Serv client area login (to change nameservers) and a Cloudflare account. Also move the mailboxes (for example Zoho Mail) or they stop with the plan. Domain paid until 3 September 2027.
- [x] Speed (16 Oct 2026): stopped the constant repainting on phones (install pulse, flag filter, first view fade). See LOG.
- [ ] Speed, next step: split the dashboard and reader code out of the 500 KB page so the startup script stops blocking about half a second on slow phones. Re-check PageSpeed (mobile) after the deploy.
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
