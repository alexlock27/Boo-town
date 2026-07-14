// sw.js — Boo Town service worker (spec §11.5).
// Precache every app file with a versioned cache. Cache-first for everything.
// The app makes no other network requests. Bump BUILD_STAMP on each deploy.

const BUILD_STAMP = 'run9-phase4';          // <-- bump on each deploy
const CACHE = 'bootown-' + BUILD_STAMP;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/main.js',
  'js/state.js',
  'js/ui.js',
  'js/drawer.js',
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
  'js/smartmix.js',
  'js/trickypile.js',
  'js/speller.js',
  'js/golden.js',
  'js/quests.js',
  'js/comfort.js',
  'js/resilience.js',
  'js/intro.js',
  'js/toddler.js',
  'js/trophies.js',
  'js/growth.js',
  'js/funfair.js',
  'js/band.js',
  'js/rarityfx.js',
  'js/booquest.js',
  'js/shiny.js',
  'js/delights.js',
  'js/games/boopop.js',
  'js/games/detective.js',
  'js/games/booroll.js',
  'js/idb.js',
  'js/customs.js',
  'js/studio.js',
  'js/paint.js',
  'js/collage.js',
  'js/buildaboo.js',
  'js/gallery.js',
  'js/voices.js',
  'js/requests.js',
  'js/choreographer.js',
  'js/content.js',
  'js/games/bubblepop.js',
  'js/games/feedboos.js',
  'js/games/spellboo.js',
  'js/games/blocks.js',
  'js/games/bounce.js',
  'js/games/beat.js',
  'js/games/teachme.js',
  'js/games/dash.js',
  'js/games/clockshop.js',
  'data/catalogue.js',
  'data/lessons.js',
  'data/guideLines.js',
  'data/tablesConfig.js',
  'data/bubbleCategories.js',
  'data/spelling.js',
  'data/detective.js',
  'data/spellingBanks.js',
  'data/soundTwins.js',
  'data/sorting.js',
  'data/sortingExtra.js',
  'data/quests.js',
  'assets/fonts/Fredoka-Variable.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-192-maskable.png',
  'assets/icons/icon-512-maskable.png',
  'assets/icons/favicon-48.png'
];

self.addEventListener('install', (event) => {
  // NO skipWaiting (spec §11.5: "on update, activate on next launch").
  // skipWaiting made a mid-session deploy activate immediately, delete the old
  // cache, and serve NEW lazily-imported screens into an OLD page's module
  // graph — the dynamic import then fails on missing exports and the round's
  // results screen dies ("Something went wrong loading results"). The new
  // version now waits until every old page is closed; a session always runs
  // one consistent build. (RUN4 hotfix 1 — live crash on Boo Dash round end.)
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

// User-initiated activation only (RUN5 C0b update toast). The no-skipWaiting policy
// (hotfix 1) stands: a new build waits until every old page closes UNLESS the page
// explicitly asks it to take over — which only happens when she taps the hub toast.
self.addEventListener('message', (event) => {
  const d = event.data;
  if (d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')) self.skipWaiting();
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
    // match ONLY this build's cache — never leak files across versions
    caches.open(CACHE).then((c) => c.match(req)).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // runtime-cache any same-origin GET we didn't precache (defensive)
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => {
        // offline fallback for navigations (same-cache only, like everything)
        if (req.mode === 'navigate') {
          return caches.open(CACHE).then((c) => c.match('index.html').then((r) => r || c.match('./')));
        }
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
