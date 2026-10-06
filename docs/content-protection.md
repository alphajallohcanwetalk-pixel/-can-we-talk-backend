# Stopping screenshots, recording and sharing

Written for: Alpha, deciding how far to go protecting paid reading.

## The honest answer first

**A website cannot block screenshots.** There is no browser API for it, on any
platform, and there never has been. Anything claiming otherwise on the open web
is a deterrent that a determined reader bypasses in seconds.

WhatsApp can block screenshots because it is a **native Android app** and sets a
window flag called `FLAG_SECURE`. That flag is enforced by Android itself, below
the app. A page running in Chrome has no access to it.

So the capability you want is real, but it only exists in **the Android app
build**, not on `canwetalkvoice.com`.

| Where | Block screenshots | Block screen recording | Block screen sharing |
|---|---|---|---|
| Website in a browser | No, not possible | No | No |
| App installed from the website (PWA) | No, not possible | No | No |
| **Android app from a store build** | **Yes, with FLAG_SECURE** | **Yes** | **Yes** |
| iOS app | Partly. iOS cannot block a screenshot, only detect that one was taken | No | Screen recording can be detected |

One flag covers all three columns on Android: `FLAG_SECURE` makes the window
content invisible to the screenshot system, to screen recorders, and to screen
sharing or casting. That is exactly the WhatsApp behaviour.

---

## Turning it on in the Android build

This needs a one line change in the Bubblewrap project, after
`bubblewrap init` and before `bubblewrap build`.

Open `app/src/main/java/.../LauncherActivity.java` in the generated project (the
path contains your application id) and add the flag before the superclass call:

```java
import android.view.WindowManager;

@Override
protected void onCreate(Bundle savedInstanceState) {
    getWindow().setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
    );
    super.onCreate(savedInstanceState);
}
```

Rebuild with `bubblewrap build`. From then on, in that app:

- the screenshot shortcut produces a black image or fails outright
- screen recorders capture black
- casting and screen sharing show black
- the app does not appear in the recent apps thumbnail

### Think about this before you do it

It applies to the **whole app**, not only the reader. Someone cannot screenshot
a book, but they also cannot screenshot their own order confirmation to send to
a friend, or share a page they liked. That is a real cost to word of mouth, and
for an author trying to be read widely it may cost more than the copying does.

A middle path is to apply the flag only while the reader is open, by setting it
when the reader view appears and clearing it when it closes. That needs a small
bridge between the page and the native wrapper, which is more work but keeps
sharing possible everywhere else.

---

## What is already in place on the web

These are deterrents. They stop casual copying and make the intent clear. They
do not stop anyone determined, and they should not be described to readers as
if they do.

- Text selection and copy are blocked inside the reader.
- Right click is disabled on the reader page.
- Print, save, select all and copy keyboard shortcuts trigger a warning overlay.
- The page blurs when the window loses focus, which defeats the most common
  screen capture tools that need another window in front.
- Every page carries a watermark with the reader's name and email, so a leaked
  screenshot identifies the account it came from.

That last one is the most useful thing on this list. You cannot stop a
screenshot, but you can make sure any screenshot that circulates is traceable.

---

## What actually protects the work

In order of how much they matter:

1. **Watermarking.** Already in place. A leak points back to an account.
2. **Short lived audio links.** Already in place. Narration is served through a
   signed URL that expires in an hour, so a shared link is dead by the time it
   spreads.
3. **Accounts, not files.** Entitlements live in the database against a person,
   not as a downloadable file. There is no eBook file to pass around.
4. **FLAG_SECURE in the Android build**, if you decide the tradeoff is worth it.

Nothing here prevents someone photographing a screen with another phone. No
system in the world prevents that. The goal is to make casual copying awkward
and traceable, not to make it impossible, because impossible is not on offer.
