# Can We Talk? in many languages: design

Date: 18 October 2026. Step 1 of 2 (step 2, member chat, gets its own design after this ships).

## Why
Can We Talk? (canwetalkvoice.com, Alpha Amadu Jalloh's author site and reading app) is about to reach readers
worldwide, many of them in Africa. A reader should be able to use the whole site, and read Alpha's writing, in
their own language.

## Goals
1. Every visible word of the site can be shown in 28 languages: menus, buttons, forms, errors, toasts, empty
   states, the reader, search, account pages, the developer dashboard labels only if cheap (see non goals),
   privacy.html and account-deletion.html, and the emails the API sends.
2. Alpha's own content is translated too: essays (title, excerpt, full text), book titles, subtitles and
   descriptions, gallery captions, media coverage blurbs, site settings text shown to readers.
3. The reader chooses the language:
   - at sign up (a language field on the register form, preset to the detected language);
   - anytime from a picker in the header (signed in or not) and in the account panel;
   - the choice is saved to the member's profile and follows them to every device;
   - visitors who are not signed in get their browser language if it is on the list, else English; their
     pick is remembered in localStorage.
4. Translations that a native speaker has not checked are labelled as drafts, with a way to suggest a fix.
5. New content Alpha posts later is translated automatically once the Google translation key is in place.

## Non goals
- Translating the audiobooks or narrated audio (they stay in Alpha's voice).
- Translating the books themselves: they are sold as print, ebook and audiobook; the site holds no book text
  (books.reader_full_text is empty for both books).
- Translating the developer/owner dashboard. Alpha and B&A use it in English. (Builder may include it if the
  translation layer picks it up for free, but no extra work.)
- Translating comments in this step. Comments and chat get a "translate" button in step 2.

## Anti goals (a failure even if it works)
- Breaking anything that works today: the reader page turning, search, payments, sign in, slideshows,
  PageSpeed scores (phone and desktop must stay passing), the publish pipeline (scripts/split-app.mjs).
- A visible flash of English before the page switches language on every load.
- Showing a machine translation of Alpha's writing as if Alpha wrote it in that language: every translated
  essay shows "Translated from English" and a "Read the original" link.
- Dashes in visible copy (house rule, applies to translations too where the language allows it).
- Emailing or messaging Alpha during tests (Alpha is the client). Test emails go to the B&A inbox.

## Languages (28)
Global (13): English (en, source), French (fr), Portuguese (pt), Spanish (es), Arabic (ar, right to left),
German (de), Italian (it), Dutch (nl), Russian (ru), Chinese Simplified (zh), Hindi (hi), Turkish (tr),
Indonesian (id).

African (15): Swahili (sw), Hausa (ha), Yoruba (yo), Igbo (ig), Nigerian Pidgin (pcm), Krio (kri), Temne (tem),
Mende (men), Fula (ff), Wolof (wo), Twi (ak), Amharic (am), Somali (so), Zulu (zu), Afrikaans (af).

Quality status per language, shown to readers:
- Finished at launch: the 13 global languages plus Swahili, Hausa, Yoruba, Igbo, Zulu, Afrikaans.
- Draft at launch (label "Draft translation" plus "Suggest a better wording"): Nigerian Pidgin, Krio, Temne,
  Mende, Fula, Wolof, Twi, Amharic, Somali.
- A draft language becomes finished when a native speaker has reviewed it; the status lives in one file so
  it is a one line change.

## Decided with the owner
- Readers choose at sign up and anytime after, and can change it whenever they like.
- Everything is translated, including Alpha's writing, shown immediately with "Read the original".
- Languages machine translation handles poorly go out as labelled drafts.
- New content is translated automatically by Google Cloud Translation, on an account Alpha creates (Alpha's
  Google sign in and card; the free allowance of 500,000 characters a month far exceeds this site's volume).
  B&A writes Alpha the setup steps; the API key goes on Render as an env var (never in git).
- Until that key exists, new content shows in English with a small "Translation coming soon" note.

## Owner decisions after the builder check (18 October 2026)
- "Do the translations and put them live; when the Google account exists we will perfect them." So B&A's own
  translations ship now. "Finished" means B&A translated it with confidence; "draft" means B&A is unsure of the
  language (the nine listed above). Goal 4 reads accordingly: drafts are the languages B&A is unsure of, not
  every string without a native review.
- A floating translator button, placed nicely, for easy switching (in addition to sign up and the account
  panel). It replaces the header picker idea: one round button fixed at the bottom corner opposite any other
  floating control, showing the current language code; tapping it opens a sheet with a search box and every
  language by its own name, drafts marked.

## Builder check answers (B&A's calls)
- There is no automated test suite in the repo. The build verifies with Playwright scripts run locally
  against a local copy and the live site (scratch scripts, not committed), and a coverage script
  (scripts/i18n-coverage.mjs) that reports missing keys. Coverage does not block the Pages deploy; it is
  run before each push.
- Google costs: when the key arrives, translation works per paragraph (hash per paragraph, so a typo fix
  retranslates one paragraph, not the essay), never overwrites a translation marked reviewed or written by
  B&A unless its paragraph changed, and stops at a monthly character budget (env TRANSLATE_MONTHLY_CHARS,
  default 400000). Alpha's setup steps include a billing alert. Until the key exists, a stale paragraph
  keeps showing its last translation rather than reverting the essay to English.
- "Suggest a better wording" goes to info@ only (reason "Translation"), never to Alpha's mailbox or devices.
  No translation editor in this step; B&A applies fixes in the JSON files and the table.
- Search engines: no per language URLs in this step. Google sees English; readers switch in the app.
  (Possible later step: language in the URL with hreflang.)
- Sign up happens in the browser through Supabase; the language travels in the user metadata and the
  handle_new_user trigger copies it into profiles.language (migration 016).

## How it works (builder's calls, recorded here)
- Source stays English. The frontend is one file (frontend/app.html, about 665 KB, roughly 700 static text
  nodes plus strings built in JS). Rather than rewrite every string into t() calls, add a translation layer:
  - A dictionary per language keyed by the English string (same approach as KATYO's kln inline file),
    stored as static JSON files next to the app (frontend/i18n/<code>.json), loaded only for the chosen
    language (English loads nothing).
  - On load and on DOM changes (MutationObserver), text nodes and the attributes placeholder, title,
    aria-label and alt are swapped when an exact English key exists. JS built strings with numbers or names
    use a small t(template, values) helper at the call sites that need it.
  - To avoid a flash of English: the chosen language is read synchronously from localStorage in the head,
    the dictionary is fetched with high priority, and the main content stays hidden (visibility only, no
    layout change) until the dictionary is applied or 1.5 s pass, whichever comes first.
  - html lang and dir attributes follow the language; Arabic switches dir="rtl" and the CSS must hold up
    (logical properties where layout breaks).
  - Dates and numbers use Intl with the chosen locale.
- Extraction: a script collects every English string from app.html (text nodes, attributes, string literals
  passed to toast or set as textContent) into frontend/i18n/en.json, so missing keys can be listed per
  language (script reports coverage; CI fails if a finished language drops below 100%).
- Profiles get a language column (new migration 016). The register form sends it; the API stores it and
  returns it with the profile. Changing the picker while signed in saves it.
- Alpha's content: a table content_translations (kind, item id, field, lang, text, source_hash, status
  machine/reviewed, updated_at). The API returns the translated field when the request carries a language
  and a translation exists whose source_hash matches the current English text; otherwise English plus a
  flag. Edits to the English source make old translations stale automatically (hash mismatch) and queue a
  new one.
- Auto translation: when Alpha publishes or edits content, the API queues translation jobs; a worker in the
  API process calls Google Cloud Translation v3 for each language Google supports, stores results as
  status machine. Languages Google does not support (check at build time; likely Temne and Mende) fall back
  to English with the note. Existing content is translated in this build session by B&A (higher quality),
  stored with the same table.
- API emails (welcome, order confirmed, new essay, book club, confirm email, contact reply) render in the
  recipient's profile language from the same dictionaries (backend copy of the JSON). Supabase auth emails
  (sign up confirmation, password reset) use a template that branches on the user's language saved in
  user metadata at sign up; applied through the existing auth settings route when SUPABASE_ACCESS_TOKEN is
  set on Render, otherwise B&A pastes it in the Supabase dashboard once.
- Push notifications are sent in each subscriber's saved language.
- Search: search matches the English text and the reader's language text.
- "Suggest a better wording": opens the existing contact form with reason "Translation" and the page and
  phrase prefilled; it routes to info@ like other messages.

## Left to the builder
- Exact picker design (must be reachable in one tap from the header on a 360 px phone and list languages
  by their own names: Français, Português, Kiswahili, Hausa, Yorùbá, Krio, العربية).
- How to split the work across sessions, and how strings in the service worker offline page are handled.
- Whether privacy.html and account-deletion.html use the same layer or pre-rendered copies.

## Owner actions (B&A tells the owner; nothing here blocks the build)
1. Alpha creates a Google Cloud project, enables Cloud Translation API, adds a card, creates an API key
   restricted to that API. Send the key to B&A privately; B&A adds GOOGLE_TRANSLATE_KEY on Render.
2. Optional: SUPABASE_ACCESS_TOKEN on Render (already on the roadmap) so the auth email templates can be
   updated from the dashboard.
3. Ask native speakers (Krio, Temne, Mende, Fula and others) to review draft languages over time.

## Done means
- Switching to each of the 28 languages changes every visible word on home, essays, reader, gallery,
  books, search, sign up, sign in, account, contact, privacy and account deletion, with no English left
  except names and the original text links.
- Arabic reads right to left without broken layout at 360 px and desktop.
- Sign up stores the language; a second device signed in as the same member opens in that language.
- The essay shows translated with "Translated from English" and "Read the original".
- PageSpeed (phone and desktop) still passes; English visitors download no translation files.
- No dashes in visible copy; npm checks and existing Playwright tests pass.
