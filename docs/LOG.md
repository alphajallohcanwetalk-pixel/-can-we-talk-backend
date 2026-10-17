# LOG: Can We Talk? author site, app and API

What was done, newest first. Every session adds one dated entry at the top: what changed, why, and where it stopped.
Back to the [BRAIN](BRAIN.md) · [ROADMAP](ROADMAP.md)

## 17 October 2026
- **Contact form fixed.** It used to show "thank you" and keep nothing (a speaking request to Alpha was lost). Now POST /api/contact saves the message (table contact_messages, migration 015), emails Alpha (ADMIN_EMAIL, Reply goes to the sender) and notifies his devices. Dashboard: new Messages tab with unread badge and banner, mark read, replied or new, reply by email, delete. The Speaking page pre selects "Speaking engagement".
- **Gallery v2.** Photos, videos and documents (newspaper articles, letters with several pages). Upload by drag and drop or tap, several files at once, photos shrunk before upload; everything optional (related book or essay, title, note, section, date, outlet, link, slideshow). Public: random photo slideshow, filters, masonry tiles, a full screen viewer (swipe, zoom, keyboard, the phone back button closes it), and on every book page a "Book gallery, articles and newspapers" section with quick buttons near the top; essays show their linked items too. The server works before and after migration 015.
- **Loading.** Books, essays, gallery and settings load with retries, and the last good copy is kept on the device and shown at once, so the site never says "no essays published" while loading or after a passing failure; it retries by itself. Service worker v4 keeps every public photo once seen (shown offline), up to 250.
- B&A credit email corrected to bandadevelopers2026@gmail.com.
- **Password reset fixed.** The emailed link came back as "#password-reset#access_token=..." and the sign in library read only the part after the first "#", so it never got the token: the form showed but saving always said the link had expired. The page now keeps only Supabase's part before the library starts. Also: the privacy banner no longer covers the sign in window on phones (it hid the Save button), the window stays open after saving with "Password updated" and a Continue button, and an expired link opens Forgot password with a clear message. Tested end to end with a temporary account (deleted after).
- **Speed (PageSpeed).** Publishing now moves the 290 KB main script out of the page into a cached app-<hash>.js (scripts/split-app.mjs, run by the Pages workflow; the source is still the one app.html, keep `<script data-main>`), and the sign in library is kept on the site (frontend/vendor, pinned 2.118.0) instead of jsdelivr; both load with defer from the head. Removed a leftover jsdelivr preload (it downloaded the library twice). Author photos now really load lazily (loading was set after src). New workflow `Speed check` runs Lighthouse on Linux after every code deploy and shows the scores as notes on the run. First result: desktop Performance 100, phone 96, Accessibility and SEO 100. Lighthouse run on this Windows laptop reads lower on phone (about 75) because a fresh browser here spends about a second setting up system fonts; trust the GitHub run.
- **Sign in and email settings in the dashboard** (Developer tab, developer accounts only, second factor enforced where on): allow new accounts, require email confirmation, email and password sign in, two step sign in, secure email change, shortest password, how long email links last, site address and return addresses, the mail server (one click: send sign in emails through Resend, using RESEND_API_KEY and EMAIL_FROM on the server, 100 an hour), the confirmation and reset email wording, and Google sign in. Backend: backend/routes/authSettings.js under /api/dev/auth-settings, using the Supabase Management API with SUPABASE_ACCESS_TOKEN (a personal access token, server only). Only listed fields can change, types are checked, secrets are write only (the browser only sees whether they are set), risky switches ask first, and every change is written to app_error_logs (level info, source auth-settings) without secret values. Until the token is added the card shows the three steps. Tested with a simulated server (nothing real changed).
- **Pen loading animation** (the owner found the bar too loud): a fine ink line writes itself under the header with a small gold nib while anything loads; when slow, a little pen stitches a broken line back together ("Slow connection. Mending the line…"); offline, the pen waits; back online, "Connection mended." The same pen replaces the spinning ring on gallery placeholders, video buffering and the full screen viewer (PEN_LOADER in app.html).
- **Search covers everything:** reader comments (new public GET /api/search: visible comments with the name shown on the page, and audiobook chapter titles; no emails, no hidden comments, no paid audio), every heading and its text on every public page (the page opens at that spot, briefly highlighted), book formats and video titles, and help for comments and reviews, samples and signing out.
- **Account menu and Sign out:** the name (computer) or initials (phone) open a menu with the reader's name and email, Your account and library, Book Club, Dashboard (staff) and Sign out; the phone menu shows "Signed in as …" with Your account and Sign out. Phone header fits from 360 px on inner pages (smaller name and back arrow on narrow phones, Sign in becomes 👤 under 395 px, an empty cart icon steps aside under 350 px).
- **No bare pages:** empty cart shows the books with covers and prices plus Browse and Listen; the account page for a visitor shows Sign in, Create a free account, what an account gives, and Forgot password (it used to say Loading forever with a Sign out button); Speaking has topic descriptions, formats, three booking steps and a slideshow of event pictures; book pages hide the "No media coverage added yet" section when empty.
- **Email confirmation:** confirmation is on in Supabase (mailer_autoconfirm false). Tested end to end with a temporary account (admin link, nothing sent): signing in before confirming now opens "Check your email" with Send the email again (one a minute); signing up shows that panel instead of an alert; the link from the email signs the reader in, clears the token and says "Your email is confirmed"; an expired link explains what to do.
- Not changed, for the owner: the Privacy and Terms pages publicly say "This is a starter template, not legal advice. Have a lawyer review it". Confirmation emails go through Supabase's own mailer unless custom SMTP is set in Supabase Auth settings (its free mailer allows only a few emails an hour); setting SMTP to Resend (already used for the other emails) is recommended.
- **Sign in and Join, easy to find.** Phone header: a Sign in button (the reader's initials once signed in, opening the account); the phone menu starts with Sign in and Create account (hidden once signed in); computers: Sign in and Join free in the header. Any element with data-auth-open="signin|signup|forgot" opens that panel (one delegated handler, so it survives sign out).
- **Search everything.** One search (header 🔍 or Search pill, a bar on the home page, the phone menu, the / key or Ctrl+K) over books (with descriptions), essays (with summaries, opening the essay itself), newspapers, photos, videos and events, every page, and help (sign in, create an account, forgot password, buy a book, invite Alpha to speak, get the app, notifications). Case, accents and small typos do not matter; with no exact match the closest are offered. Grouped results with covers, highlighted words, arrow keys and Enter, recent and popular searches; full screen on phones and the back button closes it. The old search only matched book and essay titles and sent essays to the list.
- Header on mid size screens (901 to 1240 px): labels never wrap; search becomes an icon and the duplicate Shop Books button hides there.
- **Loading animation.** A thin flag coloured bar slides under the header whenever anything takes more than a quarter second (fetch is wrapped once, so every request counts); a pill says "Slow connection. Still loading…" after 6 seconds and "You are offline…" when offline; gallery placeholders show a ring and "Loading the gallery…"; pictures shimmer then fade in; a ring in the flag colours shows while a video buffers.
- **Videos.** Every gallery video has a picture (taken in the browser from the sharpest of a few moments, never a dark or blurred frame; done automatically on upload, and done for the three videos already uploaded). Tiles show the picture at once, so a fast scroll never shows an empty box; the most visible video plays muted while on screen and pauses when it leaves; nothing downloads until a video comes near the screen; no autoplay on Data Saver, 2G or 3G, or with reduced motion. Book page videos do the same. The editor can change a video's picture.
- **Slideshows everywhere.** One component (createSlideshow) for the gallery page (photos and newspapers, random order), the home news section, and the newspapers and book gallery tabs on book and essay pages, whenever there are two or more. Each change uses a different transition (newspapers: page turn, wipe, rise, fade; photos: fade, slide, zoom, wipe, iris, rise), newspapers and upright photos show whole over a blurred copy, a progress line drives the timing and pauses on touch, hover, off screen or a hidden tab. Newspapers with several pages turn them on their tile.
- **Changes show everywhere at once.** The API keeps when the gallery, books, essays and settings last changed (backend/lib/changes.js, GET /api/changes, outside the rate limit); open pages check every 25 seconds while visible and at once when they come back, and reload only what changed. Gallery answers are no longer cached by browsers (no-cache) and the page always revalidates API reads, so the author's own edits show immediately. Deleting a gallery item deletes its files in Storage too (photo, pages, video, video picture), and replacing one deletes the old file; files still used by another item are kept; only the gallery/ and gallery-video/ folders are ever touched.
- **Gallery items are fully editable after upload.** Dashboard list: a short summary per item with Edit and Delete. Edit opens every field (type, section, related book or essay, title, newspaper or sender, date, note, link, slideshow), replaces a photo, adds, reorders and removes the pages of a newspaper or letter, and changes a video link or file. A background refresh never wipes an open editor. Tested in a sandbox (saves and uploads intercepted).
- Migration 015 was run by the owner (checked: contact_messages and the new gallery columns exist). The uploaded newspaper was turned into a "Newspaper or letter" (section In the media, out of the photo slideshow). The reader showed a page twice when the cover was also in the page list; fixed.

## 16 October 2026 (night): phone speed
- Found why phones stayed busy: the Download the App button pulsed by animating its shadow, which repainted it on
  every frame from 1.2 s to 9.6 s (the whole time Google measures), and the waving flag is an SVG filter redrawn on
  every frame by the main processor. After loading, a simulated slow phone's main thread was busy 73% of the time.
- Fixes in frontend/app.html: the pulse is now an opacity ring (done by the graphics chip); the flag waves only on
  screens wider than 900 px, starts 1.5 s after load and pauses while off screen (phones show it still); the first
  screen no longer fades in from transparent (other views still animate: showView adds html.view-switched); the
  reading progress bar scales instead of changing width (no layout while scrolling); the author photo's canvas blur
  runs only when the photo is about to scroll into view.
- Measured on this laptop (4x slower CPU, same live API): main thread work in the first 8 s went from 10.4 s to
  5.6 s; idle time busy from 73% to 4%; rendering time per load from about 0.6 to 1.3 s down to about 0.25 to 0.4 s.
  No console errors; desktop flag still waves; page transitions still animate.
- Left: the main script is one block of about 450 to 550 ms on a slow phone (Google counts most of it as blocking);
  splitting the dashboard and reader code out of the page is still the next step. Google PageSpeed quota was used up
  for the day, so the official score should be re-checked tomorrow.

## 16 October 2026
- Added BRAIN.md (project hub), LOG.md (this file) and ROADMAP.md, and linked them from CLAUDE.md and AGENTS.md.
- Website stays on GitHub Pages (owner decision). Prepared the move of the domain's DNS from Serv to Cloudflare so the site stays online when the Serv plan ends in December: docs/DNS_MOVE.md and docs/dns/canwetalkvoice.com.zone (copied from the live records). The B&A owner area now checks the site daily and sends renewal reminders.

## Earlier work (rebuilt from the git history on 16 October 2026)

### 15 October 2026
- Notes: speed results and what is left (24b1d43)
- Book Club read links get real addresses (45c0dda)
- Essay, share, install and notification links get real addresses (1010cce)
- Links search engines can follow (books, essays, sign in); release card headings in order (ce9a1d4)
- Speed: fonts served from the site, author photo keeps its own shape (f3c9d32)
- Speed: no reload on first visit, resized WebP images, non blocking fonts, lighter motion (c8ed45a)

### 12 October 2026
- Notes for AI assistants: continue from the notes on any computer, push before stopping (23188df)
- Forward browser error reports to Sentry when SENTRY_DSN is set (capped per hour) (a01c8a3)

### 11 October 2026
- Progress: Play bundle built and signed, release checklist status (afc4f5a)
- Download offer on the first visit only, then a footer link; app signing fingerprint in assetlinks (06180ba)
- Share links for every essay and book, manuscript upload, free opening, watermark, desktop footer (0457c0e)
- Describe each book format instead of repeating its name; store listing copy (adbf46e)
- Play Store build mode: printed books only, digital purchases hidden in the Play app (e225e9d)
- Live events, articles and press on Events, Gallery and home; 50 MB upload check (f83f396)
- Show the whole head in round author avatars, uncropped author strip photo (2f82ad9)
- Phone tab bar, Listen page, gallery, notifications, owner access and reader fixes (8c5d85b)

### 9 October 2026
- Fix the squeezed footer and the last edge to edge layers (90b4655)
- Give the dashboard a sidebar on laptops, chips on phones (1e4164f)
- Fix dashboard tabs crushed onto one line, make grids responsive (68b26b3)

### 7 October 2026
- Repeating scroll motion, covers in the admin table, styled scrollbar (896280d)
- Save the free sample length when a book is created (899ebdc)
- Fix broken cover uploads, read essays as books, add sign off (69966dc)

### 6 October 2026
- Rebuild mobile navigation, reorganise the dashboard (4850c74)
- Vary motion per view, fix mobile overlap, split bio and photo saves (f49ed24)
- Fix settings save, rebuild scroll reveal, close remaining gaps (4133fec)
- Add reading progress, newsletter, shipping, samples, author photo (d2b7b87)
- Update progress log (52f00d1)
- Add welcome animation, consent notice, developer contact card (2ac815f)
- Add narration, format setup on new books, protection docs (5ce6820)
- Update progress log for metadata, motion and icon versioning (d3972e1)
- Add book metadata, motion layer, versioned icons, download button (65f2449)
- Remove fabricated reviews, purge all dashes, add progress log (28bd087)

### 5 October 2026
- Apply flag icon, add comment moderation, document payments (ba5bdb3)
- Add 2FA, account settings, app history, and the Play Store package (ac28c69)
- Add password reset, harden sign in, credit B&A Developers (3a3714f)
- Add developer diagnostics, audiobook uploads and video support (3f70e76)
- Remove dashes, add PWA, book reader, analytics and security fixes (8f8ff55)

### 4 September 2026
- Sync author prices with checkout (ab14e65)
- Redeploy production Stripe configuration (42e2718)
- Fix Stripe Checkout payment methods (247c3db)
- Expand payments uploads and monitoring (f784a45)
- Measure reader pages to fit A4 layout (9247551)
- Add paged readers and production operations (b9c92cf)
- Harden production checkout and ebook access (ab3e78c)
- Document production environment configuration (0abbb4e)
- Update official contact emails (d1a980f)
- Store edited book prices in formats (f094ad4)
- Document deployment handoff (1a12156)
- Allow production frontend origins (48a2682)
- Configure GitHub Pages custom domain (a7f4d9e)
- Add API root status endpoint (bb3f38b)

### 3 September 2026
- Flatten project structure again (1179c01)
- Restore original project directory layout (e3e1bf5)
- Connect frontend to deployed API (565f6f1)
- Deploy frontend to GitHub Pages (89f723f)
- Flatten project directory structure (5a9aa41)
- Initial backend (cf97bf1)
