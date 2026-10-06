# Progress log

Running state of the project. **Update this at the end of every working
session** so the next one can pick up without re-deriving anything.

Last updated: 6 October 2026 (second session)

---

## Live URLs

| What | Where |
|---|---|
| Website | https://canwetalkvoice.com |
| API | https://can-we-talk-backend.onrender.com |
| Repo | https://github.com/alphajallohcanwetalk-pixel/-can-we-talk-backend |
| Database | Supabase project `ppojnjgzrolzjmtblgwf` |

Frontend deploys from `main` via GitHub Pages. Backend deploys from `main` via
Render. Database migrations are **run by hand** in the Supabase SQL editor.

---

## Open items

### Needs the owner

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

### Needs building

- [ ] Decide the Play Billing approach before any Play build.
      See `docs/google-play/08-payments-and-billing.md`.
- [ ] Shipping cost by country. Checkout charges the same regardless of
      destination, which will not survive real international orders.
- [ ] Stock is tracked but never set. `stock_count` is null on every format,
      so nothing decrements and nothing can sell out.

---

## Migrations

Applied in order, by hand, in the Supabase SQL editor.

| File | Applied | What it does |
|---|---|---|
| `001` to `003` | yes | Original schema, storage, format availability |
| `004_rls_and_grants_hardening.sql` | yes | RLS on every table, revoked anon grants, pinned `search_path`, fixed storage policies, foreign key indexes |
| `005_content_cleanup.sql` | yes | Removed test content. Left only the two real books |
| `006_media_buckets_and_video.sql` | yes | Private `audiobook` bucket, public `media` bucket, `video_urls` columns |
| `007_developer_role_and_error_log.sql` | yes | `is_developer` flag, `app_error_logs` table |
| `008_rls_policy_performance.sql` | yes | Wrapped `auth.uid()` in a select inside policies |
| `009_comment_moderation.sql` | yes | `is_hidden` on comments, `comment_reports` table |
| `010_book_metadata.sql` | **NO, pending** | ISBN, publisher, publication date, pages, language, genre, edition |

---

## Current data

Two books, both live: *Monopoly of Happiness* and *Mr. President, Can We Talk?*
Zero essays, zero audiobook chapters, zero orders, one real comment.

All test content is gone, including the book called "repositor".

---

## Conventions that must not regress

**No dashes anywhere in published copy.** No em dash, en dash, figure dash,
horizontal bar, minus sign or the Unicode hyphen variants. This applies to the
site, the backend, the docs, **and the database**.

Two layers keep it that way:

1. `stripDashes()` in `backend/lib/validate.js` runs on every author write path
   (books, essays, media, settings, audiobook chapters), so text pasted from
   Word, Google Docs or an AI tool is cleaned on the way in.
2. The check below, which should be run before any commit.

```bash
# Source files
python -c "
import io,glob
t=0
for f in glob.glob('frontend/*.html')+glob.glob('backend/**/*.js',recursive=True)+glob.glob('**/*.md',recursive=True):
    if 'node_modules' in f: continue
    s=io.open(f,encoding='utf-8').read()
    n=sum(s.count(c) for c in '\u2012\u2013\u2014\u2015\u2212\u2010\u2011')
    if n: print(f,n); t+=n
print('total',t)"
```

Database text is checked by reading the tables through the REST API with the
service role key and scanning every string column for the same characters.

**Icons are versioned, never overwritten.** Replacing an image at the same URL
leaves browsers, the service worker and Android's launcher serving the old file.
Add a new filename (`icon-192-v3.png`), update the page, the manifest and the
service worker shell list, and bump `VERSION` in `sw.js`.

**All motion lives in one layer** near the top of the stylesheet, with shared
easing and duration tokens, and is disabled wholesale under
`prefers-reduced-motion`. Do not scatter transitions through the file.

**Other standing rules**

- Never hardcode a credential in the frontend. Roles are flags on `profiles`,
  checked server side.
- Never log request bodies, headers or tokens into `app_error_logs`.
- Orders are never deleted on account deletion, only detached and redacted.
- The website and the app installed from it keep **every** feature. Play Store
  billing restrictions apply only to a build uploaded to Google.

---

## How to verify the system quickly

Database security, using the real public key. Every line must say blocked:

```bash
# from backend/, with the anon key
# each table must return 401 for both select and insert
```

Application health, as the developer account:

```
GET https://can-we-talk-backend.onrender.com/api/dev/health
GET https://can-we-talk-backend.onrender.com/api/dev/errors
```

`ok: true` and an empty error list is the expected state. `SENTRY_DSN` is the
one check allowed to fail; it is optional.

---

## Notes for whoever works on this next

- Supabase's database host is **IPv6 only** and the project has no IPv4 pooler.
  If your network has no IPv6 route you cannot connect with `psql` or `pg`. Use
  the REST API with the service role key, or the SQL editor in the dashboard.
- The site is one file, `frontend/app.html`. There is no build step.
- Pagination in the reader measures against the real page element, so the
  reader view must be visible before `paginateText` runs.
- `showView` pushes browser history. Without it the Android back gesture closes
  the whole app.
