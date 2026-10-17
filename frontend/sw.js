/* Can We Talk? service worker.
 *
 * Rules that matter here:
 *  - Only GET requests are touched. Checkout, sign in and every API write go
 *    straight to the network, untouched.
 *  - Nothing from the API, Supabase or Stripe is ever cached. Prices, stock and
 *    sessions must always be live.
 *  - Navigations are network first so a new deploy is picked up immediately,
 *    with the cached shell as the offline fallback.
 */

const VERSION = 'cwt-v5';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
// Photos are kept across versions (their URLs never change), up to IMAGE_LIMIT files.
const IMAGE_CACHE = 'cwt-images';
const IMAGE_LIMIT = 250;
async function trimImages(cache) {
  const keys = await cache.keys();
  if (keys.length > IMAGE_LIMIT) await Promise.all(keys.slice(0, keys.length - IMAGE_LIMIT).map((k) => cache.delete(k)));
}

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/vendor/supabase-js-2.118.0.js',
  '/icons/icon-192-v2.png',
  '/icons/icon-512-v2.png',
  '/icons/icon-maskable-512-v2.png',
  '/icons/apple-touch-icon-v2.png'
];

// Hosts whose responses must never be cached.
const NEVER_CACHE = [
  'can-we-talk-backend.onrender.com',
  'supabase.co',
  'supabase.in',
  'stripe.com',
  'checkout.stripe.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll fails the whole install if any single file 404s, so add them
      // individually and let the rest through.
      .then((cache) => Promise.all(
        SHELL_ASSETS.map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE && k !== IMAGE_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Lets the page tell a waiting worker to take over right away.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isNeverCache(url) {
  return NEVER_CACHE.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Public photos in Supabase Storage (covers, gallery, author photo): every file has its own name and
  // never changes, so once seen it is kept on the device and shown even on a slow or no connection.
  // Only public images: never the API, never private files.
  if (url.hostname.endsWith('.supabase.co') && /^\/storage\/v1\/(object|render\/image)\/public\//.test(url.pathname) && request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => cache.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone()).catch(() => {});
          trimImages(cache);
        }
        return response;
      })))
    );
    return;
  }
  if (isNeverCache(url)) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Everything else (icons, fonts, the Supabase UMD bundle): serve from cache
  // when present, and refresh it in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          // Opaque responses have status 0; they are still usable from cache.
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy).then(() => {
              // The main script is named after its content (app-<hash>.js); keep only the newest.
              if (!/^\/app-[0-9a-f]+\.js$/.test(url.pathname)) return;
              return cache.keys().then((keys) => Promise.all(keys
                .filter((k) => { const p = new URL(k.url).pathname; return /^\/app-[0-9a-f]+\.js$/.test(p) && p !== url.pathname; })
                .map((k) => cache.delete(k))));
            })).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ---------------------------------------------------------------------------
// App notifications. The server sends one when a new book or essay is
// published; tapping it opens that publication.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'Can We Talk?';
  const options = {
    body: data.body || 'Something new has been published.',
    icon: '/icons/icon-192-v2.png',
    badge: '/icons/icon-192-v2.png',
    data: { url: data.url || '/' },
    tag: data.url || 'cwt-release',
    renotify: true
  };
  if (data.image) options.image = data.image;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Reuse an open window when there is one, rather than stacking copies.
      for (const win of wins) {
        if ('focus' in win) {
          win.navigate(target).catch(() => {});
          return win.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
