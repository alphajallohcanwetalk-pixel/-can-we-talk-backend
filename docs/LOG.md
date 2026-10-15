# LOG: Can We Talk? author site, app and API

What was done, newest first. Every session adds one dated entry at the top: what changed, why, and where it stopped.
Back to the [BRAIN](BRAIN.md) · [ROADMAP](ROADMAP.md)

## 16 October 2026
- Added BRAIN.md (project hub), LOG.md (this file) and ROADMAP.md, and linked them from CLAUDE.md and AGENTS.md.

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
