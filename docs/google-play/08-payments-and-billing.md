# Payments and billing: what applies where

Written for: Alpha, deciding how money reaches the business through each channel.

Money can arrive through several different doors, and **the rules are different
at each door**. The mistake to avoid is assuming one set of rules covers them
all. Nothing here changes how the website or the installed web app works today.

---

## The short version

| Where the buyer is | Who sets the payment rules | Can you use Stripe? | Fee to the platform |
|---|---|---|---|
| **canwetalkvoice.com in a browser** | Nobody but you | Yes, for everything | None |
| **App installed from your website** ("Download the App") | Nobody but you | Yes, for everything | None |
| **App installed from the Google Play Store** | Google | Physical books only | 15 to 30% on digital goods |
| **App installed from the Apple App Store** | Apple | Physical books only | 15 to 30% on digital goods |

The first two are the same thing: your website. The last two are stores, and a
store takes a cut of digital goods sold inside the app it distributes.

---

## 1. Your website, and the app installed from it

**Everything works, with Stripe, with no platform fee.**

Printed books, eBooks, audiobook chapters and the Book Club subscription all
sell normally. This is true whether someone is reading in Chrome or has tapped
"Download the App" and is using it full screen from their home screen.

The reason is simple: an app installed from a website is the website. Google did
not distribute it, so Google's payment rules do not reach it. Apple's do not
either.

**Nothing in the app or site is restricted, and nothing should be.** This is
your main channel and it keeps 100% of every sale minus Stripe's own processing
fee.

### What to tell readers

Point people at `canwetalkvoice.com` and the "Download the App" button on the
home page. It is the best outcome for you commercially *and* the best
experience, because nothing is missing from it.

---

## 2. If you later publish on the Google Play Store

This is the only channel with a restriction, and it only applies to the build
you upload to Google.

Google requires that **digital content consumed inside the app** is bought
through Google Play Billing, not Stripe. Physical goods are explicitly excluded
and must *not* use Play Billing.

| Item | In a Play-distributed app |
|---|---|
| Paperback, Hardcover | Stripe. Correct as built. Physical goods |
| eBook | Play Billing, or hide the purchase |
| Audiobook chapters | Play Billing, or hide the purchase |
| Book Club subscription | Play Billing, or hide the purchase |

### Your three choices for that build

**A. Physical books only in the Play build.** Hide the eBook option, the chapter
purchase and the Book Club join button in that build only. Readers who already
own digital content can still read it. Cheapest and lowest risk.

**B. Add Google Play Billing.** Fully compliant, sells everything, costs you the
fee and real development work: the app needs the Digital Goods API plus backend
validation of Play purchase tokens alongside the existing Stripe entitlements.

**C. Apply for the Reader App declaration.** Google has a programme for apps
whose main purpose is consuming digital content. It can permit linking out.
Approval is not guaranteed; do not plan around it.

**Important:** under option A, do **not** put a "buy this on our website" link
next to the hidden control. Google treats steering users to an outside payment
flow as the same violation as taking the payment. Say nothing instead.

---

## 3. What I recommend

Keep the website and the web-installed app exactly as they are: everything for
sale, Stripe, no fee. Promote that as the way to get the app.

When you do go to Play, launch with **option A**. Printed books sell through the
store app, digital stays on the web. You get the discovery and credibility of a
Play listing without handing over a share of your digital sales or writing a
billing integration.

Revisit option B only if the data later shows people are trying and failing to
buy digital content inside the Play app.

---

## 4. Stripe itself

Separate from any store rule, keep this in order:

- The live secret key must start `sk_live_`, not `sk_test_`. The developer
  diagnostics panel checks this for you.
- Book Club price IDs must start `price_`, not `prod_`. Also checked.
- The webhook must point at
  `https://can-we-talk-backend.onrender.com/api/webhooks/stripe`
  and its signing secret must match `STRIPE_WEBHOOK_SECRET` in Render. If these
  drift apart, payments succeed at Stripe but orders never move past `pending`.
- Payment methods available to a buyer are whatever is enabled in the Stripe
  Dashboard for your account, currency and their country. If you want mobile
  money for Sierra Leone or Kenya, check Stripe's supported methods for those
  countries before promising it.

---

## 5. One thing to decide before a store launch

If someone buys an eBook on the website and later installs the Play app, their
purchase must still be readable there. It is, because entitlements live in your
database against their account, not against the store.

That is worth protecting. Whatever you do about billing, keep entitlement in
your own database rather than delegating it to a store, so a reader never loses
access to something they paid for by changing how they installed the app.
