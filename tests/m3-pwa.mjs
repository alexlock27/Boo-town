// tests/m3-pwa.mjs — service worker offline caching + no external network requests.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
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
await page.reload({ waitUntil: 'load' });
const hubOffline = await page.waitForSelector('.hub', { timeout: 5000 }).then(() => true).catch(() => false);
assert(hubOffline, 'hub loads while offline (served from cache)');
// drive a game offline
await page.evaluate(() => window.BooTown.go('bubblepop'));
const startOffline = await page.waitForSelector('.start-card', { timeout: 4000 }).then(() => true).catch(() => false);
assert(startOffline, 'a game screen loads offline');
await page.evaluate(() => window.BooTown.go('collection'));
const collOffline = await page.waitForSelector('.coll-grid', { timeout: 4000 }).then(() => true).catch(() => false);
assert(collOffline, 'collection (needs data files) loads offline');
await ctx.setOffline(false);

console.log('== no external network hosts ever contacted ==');
const external = [...hosts].filter(h => h && !/^127\.0\.0\.1|^localhost/.test(h));
console.log('  hosts seen: ' + [...hosts].join(', '));
assert(external.length === 0, 'only same-origin requests, no external network (' + external.join(', ') + ')');

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
