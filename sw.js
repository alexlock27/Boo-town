// sw.js — Boo Town service worker (spec §11.5).
// Precache every app file with a versioned cache. Cache-first for everything.
// The app makes no other network requests. Bump BUILD_STAMP on each deploy.

const BUILD_STAMP = 'run2-phase7';            // <-- bump on each deploy
const CACHE = 'bootown-' + BUILD_STAMP;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/main.js',
  'js/state.js',
  'js/ui.js',
  'js/art.js',
  'js/guide.js',
  'js/sfx.js',
  'js/tts.js',
  'js/onboarding.js',
  'js/creator.js',
  'js/rewards.js',
  'js/results.js',
  'js/gameshell.js',
  'js/hub.js',
  'js/collection.js',
  'js/accessories.js',
  'js/editguide.js',
  'js/town.js',
  'js/grownups.js',
  'js/ceremony.js',
  'js/questions.js',
  'js/picker.js',
  'js/games/bubblepop.js',
  'js/games/feedboos.js',
  'js/games/spellboo.js',
  'js/games/blocks.js',
  'js/games/bounce.js',
  'js/games/beat.js',
  'data/catalogue.js',
  'data/guideLines.js',
  'data/tablesConfig.js',
  'data/bubbleCategories.js',
  'data/spelling.js',
  'data/spellingBanks.js',
  'data/sorting.js',
  'data/sortingExtra.js',
  'assets/fonts/Fredoka-Variable.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-192-maskable.png',
  'assets/icons/icon-512-maskable.png',
  'assets/icons/favicon-48.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (there are none)

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // runtime-cache any same-origin GET we didn't precache (defensive)
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => {
        // offline fallback for navigations
        if (req.mode === 'navigate') return caches.match('index.html') || caches.match('./');
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
