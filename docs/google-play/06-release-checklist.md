# Release checklist

Work top to bottom. Anything marked BLOCKER will fail review or break the app.

## Before building

- [ ] **BLOCKER** Decide on the Play Billing approach (`00-READ-THIS-FIRST.md`)
- [ ] **BLOCKER** If Option A, hide digital purchases in the app build (`05-policy-compliance.md`)
- [ ] **BLOCKER** Have the privacy policy reviewed by a lawyer
- [ ] Add comment reporting and moderation (`05-policy-compliance.md`, item 7)
- [ ] Replace or remove the placeholder endorsements on the book pages
- [ ] Choose the final app icon (`07-app-icon.md`)
- [ ] Confirm `https://canwetalkvoice.com/privacy.html` loads
- [ ] Confirm `https://canwetalkvoice.com/account-deletion.html` loads

## Build

- [ ] Create the signing key and **back it up off the build machine**
- [ ] `bubblewrap init` then `bubblewrap build`
- [ ] Put the real SHA256 fingerprint in `frontend/.well-known/assetlinks.json`
- [ ] Push, then confirm `https://canwetalkvoice.com/.well-known/assetlinks.json` serves
- [ ] Install the APK on a real phone

## Test on the device

- [ ] No browser address bar anywhere
- [ ] System back gesture moves back a screen rather than closing the app
- [ ] Sign in, sign out, password reset
- [ ] Buy a printed book end to end
- [ ] Reader opens and pages turn
- [ ] Aeroplane mode: previously opened pages still load
- [ ] Account deletion works

## Play Console

- [ ] App created with the final application ID
- [ ] Store listing filled (`02-store-listing.md`)
- [ ] Icon, feature graphic, and at least 2 phone screenshots uploaded
- [ ] Data safety completed (`03-data-safety.md`)
- [ ] Content rating completed (`04-content-rating.md`)
- [ ] Data deletion URL set
- [ ] Privacy policy URL set
- [ ] Countries selected, and you can actually post books to them
- [ ] Internal testing track first, with real testers, before production

## After launch

- [ ] Watch the Play Console crash and ANR reports for the first week
- [ ] Site changes deploy to the app automatically, no rebuild needed
- [ ] Rebuild only for icon, name, permission or target SDK changes, and bump
      `appVersion` each time
