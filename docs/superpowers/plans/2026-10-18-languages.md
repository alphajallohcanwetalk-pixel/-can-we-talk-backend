# Can We Talk? in 28 languages: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every visible word of canwetalkvoice.com, and Alpha's writing, in the reader's chosen language (28 languages), switched from a floating translator button, at sign up and in the account panel.

**Architecture:** English stays the source in frontend/app.html. A translation layer swaps exact English strings (text nodes and four attributes) from a per language JSON dictionary loaded only for non English readers; a MutationObserver keeps dynamic content translated. Alpha's content translations live in a new table and the API returns them when the request names a language.

**Tech Stack:** vanilla JS in one HTML file (published by scripts/split-app.mjs), Express API on Render, Supabase Postgres, Playwright (from Desktop/katyo/node_modules) for verification.

**Spec:** docs/superpowers/specs/2026-10-18-languages-design.md

## Global Constraints
- Language codes and names exactly as the spec: en fr pt es ar de it nl ru zh hi tr id sw ha yo ig pcm kri tem men ff wo ak am so zu af.
- Draft languages (label "Draft translation"): pcm kri tem men ff wo ak am so. All others are finished.
- English visitors download no translation file. No flash of English for others (content hidden at most 1.5 s).
- ar sets `dir="rtl"`; all others `dir="ltr"`; `html lang` always the chosen code.
- Translated essays show "Translated from English" and a "Read the original" link.
- "Suggest a better wording" goes to info@ only (contact reason "Translation"), never Alpha's mailbox or devices.
- No dashes in visible copy (English source and translations where the language allows).
- Commit as B&A Developers <bandadevelopers2026@gmail.com> (repo config is set). Never commit secrets. Tests never email Alpha.
- Must not regress: reader page turning, search, sign in and sign up, payments, slideshows, PageSpeed (phone and desktop pass).

## Review Focus
1. Strings built in JS with names or numbers ("3 comments", "Hello Ada") have no exact key: they must stay readable English, never half translated garbage or "undefined".
2. A dictionary fetch that fails or is slow (offline, 404): the page must show in English after 1.5 s, never stay hidden.
3. Translating text inside inputs, textareas, contenteditable, code, the essay original and user written content (comments, names, gallery titles typed by Alpha) must not happen: the layer skips `[data-no-i18n]`, form fields' values, and user content containers.
4. Arabic right to left at 360 px: header, floating button, reader page turn arrows and the account menu must not overflow or invert meaning (page turn direction stays left to right for English source essays).
5. Switching language while signed out, then signing in on an account with a different saved language: the saved profile language wins and the page re-translates without reload.

---

### Task 1: Extract the English source strings

**Files:**
- Create: `scripts/i18n-extract.mjs`, `scripts/i18n-coverage.mjs`, `frontend/i18n/en.json`

**Interfaces:**
- Produces: `frontend/i18n/en.json` = `{ "<English string>": "<English string>" }` sorted; `node scripts/i18n-coverage.mjs [code]` prints per language `code finished|draft  covered/total  missing: [...]` and exits 0.

- [ ] Step 1: write `i18n-extract.mjs` (parse5-free: regex over app.html, privacy.html, account-deletion.html): text between tags outside `<script>`/`<style>`, values of `placeholder|title|aria-label|alt`, and string literals in the main script passed to `toast(`, `setMsg(`, `withBusy(`, `.textContent =`, `confirm(`, `alert(` and `el('tag', {...}, 'text')` style calls; normalise whitespace (collapse, trim); drop strings with no letters, URLs, and CSS/JS fragments.
- [ ] Step 2: run it; expect 900 to 1,600 strings. Spot check 30 random keys are real visible text.
- [ ] Step 3: `i18n-coverage.mjs` compares each `frontend/i18n/<code>.json` against en.json.
- [ ] Step 4: commit.

### Task 2: Translation layer, no flash, RTL

**Files:**
- Modify: `frontend/app.html` (small inline head script before the stylesheet; `<script defer src="i18n/layer.js">` before the main script)
- Create: `frontend/i18n/layer.js` (the layer; also loaded by privacy.html and account-deletion.html, which get the same inline head script)

**Interfaces:**
- Produces (global, from layer.js): `I18N.lang` (string), `I18N.t(english: string, values?: object) -> string` (exact key lookup with `{name}` placeholders, falls back to English), `I18N.set(code: string, { save?: boolean }) -> Promise<void>` (loads dictionary, applies, stores localStorage `cwt.lang`, saves to profile when signed in and save is not false), `I18N.apply(root: Node)`, `I18N.fmtDate(date, opts) -> string` (Intl with I18N.lang), event `cwt:lang` on window after every change.
- Head script produces: `window.CWT_LANGS = [{ code, name /* own name */, english, draft, rtl }]`, `window.CWT_LANG` (initial code: localStorage, else first `navigator.languages` match by primary subtag, else en), `window.CWT_DICT` (Promise of the dictionary or null for en).

- [ ] Step 1: head script sets `document.documentElement.lang/dir`, adds class `i18n-wait` (CSS: `html.i18n-wait body{visibility:hidden}`), starts `fetch('/i18n/'+code+'.json')`, and removes the class after 1500 ms no matter what.
- [ ] Step 2: layer.js: on start await `CWT_DICT`, `I18N.apply(document.body)`, remove `i18n-wait`; MutationObserver (childList, subtree, characterData off) applies to added nodes; skip `script,style,textarea,input,code,pre,[data-no-i18n],[contenteditable]` and their descendants; keep a WeakMap of each node's English original so switching languages again (and back to en) is exact.
- [ ] Step 3: replace the `toLocaleDateString(undefined, …)` and bare `toLocaleDateString()` calls with `I18N.fmtDate`.
- [ ] Step 4: mark user content containers `data-no-i18n`: comment bodies and author names, gallery item titles and notes, essay and book text bodies (those get translated through the API instead, Task 4), search result snippets.
- [ ] Step 5: verify with a Playwright script (scratchpad) against `npx serve` of a split build: with a fake `fr.json` of 5 keys, those strings show French, `html[lang=fr]`, no element hidden after 1.6 s with a 404 dictionary, and English load requests no `/i18n/` file.
- [ ] Step 6: commit.

### Task 3: Floating translator button, sign up and account choice

**Files:**
- Modify: `frontend/app.html` (markup near `#consentBanner`, CSS, sign up form and handler near line 5236, account panel)

**Interfaces:**
- Consumes: `I18N.set`, `window.CWT_LANGS`.
- Produces: `#langFab` (button, 48 px round, shows the code in capitals, `aria-label` "Change language"), `#langSheet` (dialog with search input and a list of buttons `data-lang=<code>`; draft ones show "Draft"), sign up `<select id="signupLang">` preset to `I18N.lang`; `sb.auth.signUp` options.data gets `language`.

- [ ] Step 1: place the button bottom corner opposite existing floating controls, above the consent banner, respecting safe area; 8 px clear of any other control at 320 px; RTL mirrors it.
- [ ] Step 2: sheet: search filters by own name, English name and code; Escape and the phone back button close it; focus returns to the button.
- [ ] Step 3: when a draft language is active, a slim note "Draft translation · Suggest a better wording" appears once per session under the header; the link opens the contact panel with reason "Translation" and the current page hash plus nothing personal prefilled.
- [ ] Step 4: Playwright: tap button at 360 px, pick Français, page French, reload stays French; sign up form preselects it.
- [ ] Step 5: commit.

### Task 4: API: language on the profile, translated content, contact routing

**Files:**
- Create: `backend/migrations/016_languages.sql`, `backend/lib/i18n.js`
- Modify: `backend/routes/auth.js` (GET /me, new PATCH /me/language), `backend/routes/essays.js`, `backend/routes/books.js`, `backend/routes/gallery.js`, `backend/routes/search.js`, `backend/routes/contact.js`

**Interfaces:**
- Migration 016: `profiles.language text not null default 'en'`; `handle_new_user` inserts `coalesce(new.raw_user_meta_data->>'language','en')` (keep `security definer`, `set search_path = ''`); table `public.content_translations (kind text, item_id uuid, field text, lang text, text text not null, source_hash text not null, status text not null default 'machine' check (status in ('machine','reviewed','bna')), updated_at timestamptz default now(), primary key (kind,item_id,field,lang))`, RLS on, select for anon and authenticated, writes service role only.
- `lib/i18n.js`: `LANGS` (codes), `reqLang(req) -> string` (query `lang`, else header `x-cwt-lang`, validated against LANGS, else 'en'); `async translateRows(kind: 'essay'|'book'|'gallery'|'media', rows: object[], fields: string[], lang: string) -> rows` (adds `_translated: { [field]: true }` and `_lang`), `hashText(s) -> string` (sha256 hex, first 16).
- PATCH /api/auth/me/language `{ language }` → 200 `{ language }`, 400 on unknown code.
- Contact: reason "Translation" sends only to MAILBOX.general (info@), skips the author email and push.

- [ ] Step 1: write the migration; apply it through the session pooler with DATABASE_URL from backend/.env (pg installed in the scratchpad, not the repo); check columns and table exist.
- [ ] Step 2: wire `translateRows` into the list and detail endpoints for essays (title, excerpt, full_text), books (title, subtitle, description), gallery (title, note), search (also match translated text for the request language).
- [ ] Step 3: frontend `apiGet` and fetch helpers send `x-cwt-lang: I18N.lang`; on `cwt:lang` the visible lists reload; essay view shows "Translated from English · Read the original" when `_translated.full_text`, and "Read the original" toggles to the English text (from `?lang=en`).
- [ ] Step 4: verify with curl against a local API (`npm run dev` in backend): `/api/essays?lang=fr` returns French title once a row exists, English with no `_translated` for `lang=xx`; PATCH with `zz` gives 400.
- [ ] Step 5: commit.

### Task 5: The translations

**Files:**
- Create: `frontend/i18n/<code>.json` for the 27 non English languages (privacy.html and account-deletion.html strings are in the same dictionaries).
- Create: `scripts/i18n-content.mjs` (reads a local JSON of Alpha's content translations and upserts content_translations with status 'bna' and the current source hash).

- [ ] Step 1: translate en.json into each language (one subagent per group of languages), keeping `{placeholders}`, brand names (Can We Talk?, Alpha Amadu Jalloh, M-Pesa is not used here), book titles in their original English unless the language normally translates titles, and no dashes. Draft languages translated as well as possible.
- [ ] Step 2: coverage script shows 100% for every language.
- [ ] Step 3: translate Alpha's content (the essay "REALITY HATES ME" title, excerpt, full text; two book titles, subtitles, descriptions; gallery titles and notes; media coverage blurbs) into all 27 languages; upsert with i18n-content.mjs.
- [ ] Step 4: commit.

### Task 6: Emails and notifications in the reader's language

**Files:**
- Modify: `backend/lib/email.js`, `backend/lib/push.js`, `backend/routes/essays.js` (new essay notifications)
- Create: `backend/i18n/` copy of the dictionaries (written by a `npm run i18n:copy` style step in scripts/i18n-extract.mjs so the two stay in sync)

**Interfaces:**
- `t(lang: string, english: string, values?: object) -> string` in lib/i18n.js reading backend/i18n/<lang>.json; email functions take the recipient's language (looked up from profiles by email/id, default en).

- [ ] Step 1: every subject and body sentence in email.js passes through `t`; extraction script also collects these strings so they get translated.
- [ ] Step 2: new essay emails and pushes are sent per recipient language.
- [ ] Step 3: verify by sending the welcome email in French to the B&A inbox only.
- [ ] Step 4: commit.

### Task 7: Publish and verify live

**Files:**
- Modify: `.github/workflows/deploy-pages.yml` (copy `frontend/i18n` to `dist/i18n`), `frontend/sw.js` (cache the chosen dictionary), `docs/LOG.md`, `docs/ROADMAP.md`, `CLAUDE_HANDOFF.md` (owner steps for the Google key), `docs/BRAIN.md` (mention i18n).

- [ ] Step 1: push; wait for Pages and Render.
- [ ] Step 2: live Playwright tour at 360 and 1440 px for en, fr, ar, sw, kri: home, essay, reader, gallery, books, search, sign up, account, contact, privacy; list any English left (names and originals excepted) and fix.
- [ ] Step 3: PageSpeed workflow run passes phone and desktop.
- [ ] Step 4: write the owner steps for Alpha's Google Cloud Translation key (project, enable API, card, billing alert, key restricted to the API, send privately to B&A) in CLAUDE_HANDOFF.md and the session report.

## Later (not in this plan)
- Google auto translation worker (per paragraph hashes, monthly budget TRANSLATE_MONTHLY_CHARS) when GOOGLE_TRANSLATE_KEY exists.
- Supabase auth email templates per language (needs SUPABASE_ACCESS_TOKEN on Render).
- Step 2 of the program: member chat (its own brainstorm and design).
