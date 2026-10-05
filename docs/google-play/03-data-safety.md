# Data safety form

Play Console → Policy → App content → Data safety.

These answers were taken from the code, not guessed. If the app changes what it
collects, this form has to change with it: Google treats a wrong Data safety
declaration as a policy violation in itself.

---

## Does your app collect or share any of the required user data types?

**Yes.**

## Is all of the user data collected by your app encrypted in transit?

**Yes.** Everything is HTTPS. The site, the API on Render and Supabase all
refuse plain HTTP.

## Do you provide a way for users to request that their data be deleted?

**Yes**: `https://canwetalkvoice.com/account-deletion.html`

> Google requires this of every app that lets people create an account, and
> they check that the URL works. See the note at the bottom of this file.

---

## Data types to declare

### Personal info

| Type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Name | Yes | No | Required | Account management, fulfilling orders |
| Email address | Yes | No | Required | Account management, order confirmations |
| Address | Yes | No | Optional | Posting printed books. Only asked at checkout |
| Phone number | Yes | No | Optional | Delivery contact. Only asked at checkout |

### Financial info

| Type | Collected | Shared | Purpose |
|---|---|---|---|
| Purchase history | Yes | No | Order history, fulfilment, the author's sales reporting |

**Payment card details: declare as NOT collected.** Card entry happens on
Stripe's own hosted checkout page. The card number never reaches this app or
its servers; the database stores only an order total, a Stripe session id and,
for subscribers, a Stripe customer id.

### Messages

| Type | Collected | Shared | Purpose |
|---|---|---|---|
| Other in-app messages | Yes | No | Reader comments and star ratings on books and essays, shown publicly on the site |

Mark this as **publicly visible**: comments are shown to every other reader.

### App activity

| Type | Collected | Shared | Purpose |
|---|---|---|---|
| Other user-generated content | Yes | No | Ratings |

### App info and performance

| Type | Collected | Shared | Purpose |
|---|---|---|---|
| Crash logs | Yes | No | Diagnosing failures |
| Diagnostics | Yes | No | Error messages, the path that failed, and the browser user agent |

The server stores failures in `app_error_logs`. It deliberately records **no**
request bodies, headers or tokens, so no personal data is captured there beyond
the user id of whoever hit the error.

If you add a `SENTRY_DSN`, crash reports also go to Sentry, a third party. That
makes it **shared** rather than only collected, and Sentry has to be named.
Right now `SENTRY_DSN` is unset, so declare it as not shared.

### Not collected

Declare these explicitly as not collected: location, contacts, calendar, photos
and videos, audio recordings, files and docs, health and fitness, SMS, browsing
history, installed apps, device identifiers for advertising.

The app shows no ads and runs no third-party analytics or trackers.

---

## Data handling claims

- **Data is encrypted in transit:** yes.
- **Users can request data deletion:** yes.
- **Committed to Play Families policy:** not applicable, the app is not aimed at
  children.
- **Independent security review:** no. Do not tick this unless you have actually
  commissioned one.

---

## The account deletion requirement

Google requires two things of any app with accounts:

1. A way to request deletion **from inside the app**. The Account menu has a
   "Delete my account" option.
2. A **publicly reachable web page** describing how to request deletion, which
   works without installing the app. That is `/account-deletion.html`.

They also expect you to distinguish deleting the *account* from deleting *some*
data, and to say what you keep and why. The page covers this: order records are
retained because they are commercial and tax records, and they are detached from
the person rather than kept linked to them.
