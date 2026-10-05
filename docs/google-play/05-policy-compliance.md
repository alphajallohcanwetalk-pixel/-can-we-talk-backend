# Policy compliance

The issues most likely to get this app rejected, and what to do about each.

---

## 1. Play Billing and digital goods (the serious one)

Covered in `00-READ-THIS-FIRST.md`. Short version: printed books may be sold
through Stripe, but eBooks, audiobook chapters and the Book Club subscription
are digital content consumed in the app, and Google normally requires those to
go through Play Billing.

### Implementing Option A (physical books only in the app)

The app and the website share one codebase, so the app build must hide the
digital purchase controls at runtime. The site keeps selling everything.

Detect the installed app. A TWA reports `android-app://` as the referrer, and a
PWA launch runs in standalone display mode:

```js
const isInstalledApp =
  document.referrer.startsWith('android-app://') ||
  window.matchMedia('(display-mode: standalone)').matches;
```

When `isInstalledApp` is true:

- Hide the **eBook** option in every format selector.
- Hide the **Buy chapter** button on audiobook chapters.
- Hide the **Join the Book Club** buttons and plan prices.
- Keep the reader itself working. Someone who already owns an eBook or a
  membership must still be able to read. Removing *purchase*, not *access*, is
  what the policy asks for.
- Do **not** add a "buy this on our website" link next to the hidden control.
  Google treats steering users to an external payment flow as the same
  violation. Say nothing rather than linking out.

Leave paperback and hardcover exactly as they are. Physical goods must *not* use
Play Billing, so Stripe is correct there.

---

## 2. Account deletion

Required for any app with sign-up. Both halves are in place:

- In-app: Account settings → Danger zone → Delete my account.
- On the web: `https://canwetalkvoice.com/account-deletion.html`

Put that URL in Play Console → App content → Data deletion.

---

## 3. Privacy policy

Required, and must be reachable without installing the app:
`https://canwetalkvoice.com/privacy.html`

It is a plain HTML page with no JavaScript, so a reviewer always gets content.
Have a lawyer review it before submitting.

---

## 4. Target API level

Play enforces a minimum target API level for new apps and updates, and raises it
roughly every year. Bubblewrap targets a recent level by default, but check the
current requirement in Play Console before building; an out-of-date target is
rejected automatically at upload.

---

## 5. Permissions

A TWA needs almost nothing. Do not add permissions the site does not use. The
app requests only internet access. If you later add camera or location on the
site, the declaration has to change with it.

---

## 6. Content rating

The app contains political commentary and social criticism written for adults.
Answer the questionnaire honestly (see `04-content-rating.md`). Do not aim for a
lower rating than the content deserves: a wrong rating is itself a violation.

---

## 7. User-generated content

Readers post comments and star ratings, so Play's UGC policy applies. You need:

- A way to report or flag objectionable comments.
- A way for you to remove them.
- Terms that say what is not allowed.

**This is not built yet.** The author can delete comments only by going into the
database directly. Before launch, add a report control on each comment and a
moderation list in the dashboard. It is a realistic rejection reason for an app
that lets strangers post public text.

---

## 8. Honest listing

Screenshots must show the real app. No invented review counts, no claims about
features that do not exist, no "#1" style superlatives. The current placeholder
endorsements on the book pages ("Reviewer Name, Publication / Title") should be
replaced with real quotes or removed before the screenshots are taken, so the
listing does not appear to show fabricated praise.
