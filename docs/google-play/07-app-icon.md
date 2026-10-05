# App icon

Four options are in `icon-options/`, all 512 x 512 PNG, all built from the
Sierra Leone palette already used across the site.

| File | What it is |
|---|---|
| `option-a-current.png` | White speech bubble on deep green, with three dots in green, gold and blue. **Currently live** |
| `option-b-flag-bubble.png` | The same bubble, filled with the Sierra Leone tricolour |
| `option-d-quotes.png` | A pair of quotation marks over a tricolour underline |
| `option-e-flag-ground.png` | Full flag background with a deep green bubble on top |

## How to judge them

Look at them **small**. An icon lives at about 48px on a home screen, next to
forty others. Open the folder and shrink the thumbnails right down; whichever
is still instantly recognisable is the right answer. At 512px they all look
fine, which is why 512px is the wrong size to decide at.

A few honest notes:

- **B** is the strongest of the new ones. The flag inside the bubble says
  "Sierra Leone" and "conversation" in one shape, and it holds up small.
- **E** is the boldest and most national, but the flag reads as a flag first and
  the app second. If you want someone scrolling a crowded home screen to spot it
  instantly, this wins. If you want it to look like a book app, it does not.
- **D** is the most literary, and the only one that hints at quotation and
  writing rather than chat. It is also the weakest at small sizes, because the
  two marks start to merge.
- **A** is the safest. It is already live, already in the manifest, and already
  what installed users have.

My pick would be **B**: it keeps the shape people may already have installed,
and adds the national identity that the rest of the site leans on.

## Applying your choice

Replace these three files with the chosen design, then push:

```
frontend/icons/icon-192.png              192 x 192
frontend/icons/icon-512.png              512 x 512
frontend/icons/icon-maskable-512.png     512 x 512, artwork inside the middle 80%
frontend/icons/apple-touch-icon.png      180 x 180
```

Tell me which one and I will render all four sizes, including a correct maskable
version with the right safe zone, and update the hero button and footer.

## Play Store requirements

- 512 x 512, 32-bit PNG
- **No transparency.** Play rejects alpha in the store icon
- **No rounded corners of your own.** Android applies its own mask; corners you
  draw yourself get cut twice and look wrong
- Keep anything important inside the central 80% for the maskable version, or
  a circular mask will clip it
