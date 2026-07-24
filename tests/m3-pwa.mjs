// tests/m3-pwa.mjs — service worker offline caching + no external network requests.
import { chromium } from 'playwright';
// The app deliberately unregisters service workers on localhost/127.0.0.1 (spec §11.6,
// to avoid stale-cache pain in dev), so the offline contract can only be exercised from a
// different host. Chromium resolves *.localhost to loopback and treats it as a secure
// context, so app.localhost hits the same dev server while looking like a real origin.
// (RUN11.)
const RAW_BASE = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW_BASE.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

// track every request host to prove no external network calls
const hosts = new Set();
page.on('request', r => { try { hosts.add(new URL(r.url()).host); } catch {} });

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 1, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } }, name: 'Maya', guide: { body: 'sunshine', patch: 'cocoa', acc: 'bow', name: 'Twiggy' }, inventory: { boo_inky: 1 } })));

console.log('== register the service worker + precache ==');
await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
});
await page.waitForTimeout(800);
const cacheOk = await page.evaluate(async () => {
  const keys = await caches.keys();
  if (!keys.length) return { ok: false };
  const c = await caches.open(keys[0]);
  const reqs = await c.keys();
  const has = (p) => reqs.some(r => r.url.endsWith(p));
  return { ok: true, count: reqs.length, index: has('index.html') || has('/'), css: has('css/styles.css'), main: has('js/main.js'), font: has('Fredoka-Variable.woff2'), icon: has('icon-512.png') };
});
assert(cacheOk.ok, 'a cache was created');
assert(cacheOk.count >= 25, 'precached the app files (' + cacheOk.count + ')');
assert(cacheOk.css && cacheOk.main && cacheOk.font && cacheOk.icon, 'css, js, font, icon all precached');

console.log('== reload so the SW controls the page ==');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
assert(controlled, 'page is controlled by the service worker');

console.log('== go OFFLINE and reload — must still work ==');
await ctx.setOffline(true);
// Playwright's offline emulation kills the top-level NAVIGATION before the worker sees it,
// so a reload proves nothing either way. Assert the guarantee the worker actually gives:
// with the network down, every app file still resolves — from its cache. (RUN11.)
const offline = await page.evaluate(async () => {
  const grab = async (u) => { try { const r = await fetch(u); return r.ok ? (await r.text()).length : 0; } catch { return 0; } };
  return { index: await grab('index.html'), main: await grab('js/main.js'), css: await grab('css/styles.css'), game: await grab('js/games/bubblepop.js') };
});
assert(offline.index > 0, `index.html is served from cache with no network (${offline.index} bytes)`);
assert(offline.main > 0 && offline.css > 0, 'the app shell (main.js + styles.css) is served offline');
assert(offline.game > 0, 'a lazily-imported game module is served offline');
await page.evaluate(() => window.BooTown.go('collection'));
const collOffline = await page.waitForSelector('.coll-grid', { timeout: 4000 }).then(() => true).catch(() => false);
assert(collOffline, 'collection (needs data files) loads offline');
await ctx.setOffline(false);

console.log('== no external network hosts ever contacted ==');
// any loopback alias is 'same origin' for this check (RUN11: the suite now serves from
// app.localhost so the worker survives — see the BASE note above)
const external = [...hosts].filter(h => h && !/^127\.0\.0\.1|^(app\.)?localhost|^\[::1\]/.test(h));
console.log('  hosts seen: ' + [...hosts].join(', '));
assert(external.length === 0, 'only same-origin requests, no external network (' + external.join(', ') + ')');

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
