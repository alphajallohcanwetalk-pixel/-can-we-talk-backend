# Building the Android app

The site is already an installable PWA, so the Android app is a thin wrapper
around it: a Trusted Web Activity (TWA). There is no second codebase. Whatever
ships to `canwetalkvoice.com` is what the app shows.

You need: Node 18+, and a Java JDK 17.

---

## 1. Install Bubblewrap

```bash
npm install -g @bubblewrap/cli
```

First run downloads the Android SDK and JDK it needs. Let it.

---

## 2. Generate the project

From an empty folder (not inside this repository):

```bash
bubblewrap init --manifest https://canwetalkvoice.com/manifest.webmanifest
```

Answers to the prompts:

| Prompt | Answer |
|---|---|
| Domain | `canwetalkvoice.com` |
| Application name | `Can We Talk?` |
| Short name | `Can We Talk?` |
| Application ID | `com.canwetalkvoice.app` |
| Display mode | `standalone` |
| Status bar colour | `#0c3d22` |
| Navigation bar colour | `#0c3d22` |
| Splash colour | `#faf8f2` |
| Icon URL | `https://canwetalkvoice.com/icons/icon-512.png` |
| Maskable icon URL | `https://canwetalkvoice.com/icons/icon-maskable-512.png` |
| Include support for Play Billing | **No** (see `05-policy-compliance.md`) |

The application ID is permanent. It can never be changed once published, and it
cannot be reused if you delete the app. Decide on it now.

---

## 3. Create the signing key

```bash
keytool -genkeypair -v \
  -keystore canwetalkvoice-release.keystore \
  -alias canwetalkvoice \
  -keyalg RSA -keysize 2048 -validity 10000
```

**Back this file up, with its passwords, somewhere you will still have in five
years.** If you lose it you cannot ship an update to this listing, ever. Not a
support ticket, not a workaround: a new listing and every install lost. Put a
copy somewhere that is not the laptop you build on.

Do not commit it to this repository. `backend/.gitignore` does not cover it, and
it does not belong in Git at all.

---

## 4. Build

```bash
bubblewrap build
```

Produces `app-release-bundle.aab` (upload this to Play) and
`app-release-signed.apk` (for testing on a device).

---

## 5. Publish the Digital Asset Links file

This is what tells Android the app is genuinely allowed to open your site
without a browser address bar. Skip it and the app works but shows a URL bar
across the top, which looks broken and unprofessional.

Get the fingerprint:

```bash
keytool -list -v -keystore canwetalkvoice-release.keystore -alias canwetalkvoice
```

Copy the **SHA256** fingerprint, the long colon-separated hex string.

Then edit `frontend/.well-known/assetlinks.json` in this repository, replace the
placeholder, commit and push. GitHub Pages will serve it at
`https://canwetalkvoice.com/.well-known/assetlinks.json`.

> If you let Google **Play App Signing** re-sign your app (the default, and
> recommended), the fingerprint that matters is the one Play shows under
> *Release → Setup → App signing*, **not** the one from your local keystore.
> Use that one, or add both.

Verify after deploying:

```bash
curl https://canwetalkvoice.com/.well-known/assetlinks.json
```

Google's checker:
`https://developers.google.com/digital-asset-links/tools/generator`

---

## 6. Test before you submit

Install the APK on a real Android phone and check:

- No browser address bar anywhere. If you see one, assetlinks is wrong.
- The splash screen uses the right colours.
- Sign in, then password reset, work inside the app.
- A printed book can be bought end to end.
- Back gesture navigates the app rather than closing it.
- Turn off wifi and mobile data: already-visited pages still open, thanks to the
  service worker.

---

## Updating later

Site changes need no new app build. The TWA loads the live site, so pushing to
`main` updates the app for everyone.

You only rebuild and resubmit when the icon, name, permissions or target SDK
change. Increment `appVersion` in `twa-manifest.json` each time; Play rejects a
repeated version code.
