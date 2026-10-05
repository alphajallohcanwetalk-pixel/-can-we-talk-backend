# Google Play: read this before you build anything

Written for: Alpha and the B&A Developers team, preparing the first Play Store submission.

> **This folder is only about publishing through the Google Play Store.**
>
> The app people install from the website itself, by tapping "Download the App",
> is not affected by any of it. That one is the website running full screen, it
> is not distributed by Google, and it keeps every feature including eBook,
> audiobook and Book Club purchases through Stripe. It is ready to use now.
>
> Read on only when you decide to put a listing on the Play Store.

There is one policy problem that has to be settled **before** a Play build is
made, because the answer changes what that build is allowed to contain.
Everything else in this folder is mechanical.

---

## The blocker: Play Billing and your digital goods

Google Play's Payments policy says that if an Android app sells **digital
content that is consumed inside the app**, the purchase must go through Google
Play Billing. Google takes a service fee (15% on the first $1M per year, 30%
above that). Using Stripe instead, for that kind of purchase, is grounds for
rejection and, after launch, removal.

The site currently sells four things:

| What | Sold through | Digital? | Play Billing needed? |
|---|---|---|---|
| Paperback / Hardcover | Stripe | No, a physical book is posted to you | **No.** Physical goods must NOT use Play Billing |
| eBook | Stripe | Yes, read in the app's reader | **Yes**, unless exempted |
| Audiobook chapters | Stripe | Yes, streamed in the app | **Yes**, unless exempted |
| AJ Book Club subscription | Stripe | Yes, unlocks in-app reading | **Yes**, unless exempted |

So the printed books are fine exactly as they are. The other three are the
problem.

### Your three options

**Option A: ship a physical-books-only app (recommended for launch)**

Publish an Android app that sells printed books through Stripe and shows free
content: essays, the author pages, events, the gallery, press. Hide the eBook
format, the audiobook purchase and the Book Club join button when running inside
the installed app. Readers who already own digital content can still read it;
they just cannot *buy* it in the app.

Cheapest, fastest and lowest risk. Nothing about the website changes. The web
version keeps selling everything exactly as now.

**Option B: integrate Google Play Billing for the digital items**

Fully compliant and lets you sell everything in the app. It is real work: a TWA
cannot do this on its own, so the app needs the Digital Goods API plus a backend
that validates Play purchase tokens and reconciles them with the existing
Stripe-based entitlements. Budget serious development time, and accept the fee
on digital sales.

**Option C: apply for the Reader App declaration**

Google has a programme for apps whose main purpose is consuming digital content
(books, music, video). It can allow linking out to your own site for purchases.
Eligibility is assessed by Google and the rules change; treat approval as
uncertain, not as a plan.

### What I recommend

Launch with **Option A**. Get the app approved, listed and in people's hands,
with the printed books selling through it. Then, if digital sales in the app
turn out to matter commercially, do Option B deliberately rather than under the
pressure of a rejected submission.

`05-policy-compliance.md` has the detail, including how to make the app hide the
digital purchase controls.

---

## The other thing to fix first: your privacy policy

Play requires a privacy policy at a stable, publicly reachable URL, and it must
honestly describe what you collect.

The current one is a placeholder that says so in its own first line: *"This is a
starter template, not legal advice."* That will not pass review, and it is not
honest about what the site actually collects (names, emails, postal addresses,
phone numbers, order history, ratings and comments).

I have written a complete, accurate replacement at `frontend/privacy.html`,
served at `https://canwetalkvoice.com/privacy.html`. It is a plain page with no
JavaScript, so a reviewer always reaches it.

**It still needs a lawyer's eye before you submit.** I can describe what the
code does; I cannot tell you what Sierra Leonean, Kenyan, EU or UK law requires
of you.

---

## Order of work

1. Decide between Option A, B and C above. (Recommend A.)
2. Read `05-policy-compliance.md` and apply the app-only hiding if you chose A.
3. Have the privacy policy reviewed.
4. Follow `01-build-the-app.md` to produce the signed app bundle.
5. Publish `.well-known/assetlinks.json` with your real signing fingerprint
   (`01-build-the-app.md` explains where to get it). Without it the app shows a
   browser address bar and looks unfinished.
6. Fill the store listing from `02-store-listing.md`.
7. Answer the Data safety form from `03-data-safety.md`.
8. Answer the content rating questionnaire from `04-content-rating.md`.
9. Work through `06-release-checklist.md` and submit.
