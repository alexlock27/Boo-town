// tests/r18a-buildstamp.mjs — RUN18A H5: the build stamp, visible to a grown-up.
//
// A QA gap, not a feature. When a grown-up says "it still does the old thing", the first
// question is which build they are actually running, and nothing on screen could answer
// it. The line reads the SERVICE-WORKER CACHE NAME through the existing
// currentBuildStamp() — one source of truth — so this suite's real job is to prove the
// rendered line still equals sw.js's BUILD_STAMP. A duplicated constant would pass a
// weaker test for exactly as long as it took someone to bump one and not the other.
//
// Expected runtime: ~1s (measured 1.0s — one page, one navigation). Not @serial.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18a/h5';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// the stamp as sw.js itself declares it — read from source, never from a copy
const SW = readFileSync('sw.js', 'utf8');
const STAMP = (SW.match(/const\s+BUILD_STAMP\s*=\s*'([^']+)'/) || [])[1];

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400 },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

console.log('== sw.js declares a stamp ==');
assert(!!STAMP, `sw.js BUILD_STAMP parsed from source: "${STAMP}"`);

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });

// The line reads caches.keys(), so the service worker has to have installed its cache.
// A condition-wait, never a sleep: if the SW never caches, that is a real failure of the
// mechanism this packet chose, and it should be reported as one.
const cached = await page.waitForFunction(async () => {
  if (typeof caches === 'undefined') return false;
  const keys = await caches.keys();
  return keys.some(k => k.startsWith('bootown-')) ? keys.find(k => k.startsWith('bootown-')) : false;
}, null, { timeout: 25000 }).then(h => h.jsonValue()).catch(() => null);
assert(!!cached, `the service worker's cache exists, which is what the line reads: "${cached}"`);

console.log('== the grown-ups corner shows it, on the front tab ==');
await page.evaluate(() => window.BooTown.go('grownups'));
await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'grownups', null, { timeout: 15000 });
await page.waitForSelector('.gu-build', { timeout: 8000 });
await page.waitForFunction(() => !/…$/.test(document.querySelector('.gu-build').textContent), null, { timeout: 8000 });

const line = await page.evaluate(() => {
  const p = document.querySelector('.gu-build');
  const r = p.getBoundingClientRect();
  const panel = p.closest('.gu-panel, .gu-panels > *');
  const tabs = [...document.querySelectorAll('.gu-tabs [role="tab"], .gu-tabs button')].map(b => b.textContent.trim());
  const selected = [...document.querySelectorAll('.gu-tabs [role="tab"], .gu-tabs button')].find(b => b.classList.contains('sel') || b.getAttribute('aria-selected') === 'true');
  return {
    text: p.textContent,
    visible: r.width > 0 && r.height > 0,
    onFrontTab: !!(panel && !panel.hidden && getComputedStyle(panel).display !== 'none'),
    tabs, selectedTab: selected ? selected.textContent.trim() : null
  };
});
assert(line.visible, `the line is on screen: "${line.text}"`);
assert(line.selectedTab === 'Settings' && line.onFrontTab, `and it is on the FRONT tab (the open tab is "${line.selectedTab}")`);
assert(line.text === `Build: ${STAMP}`, `THE RENDERED LINE MATCHES sw.js EXACTLY: "${line.text}" vs BUILD_STAMP "${STAMP}"`);

// and it is genuinely read from the cache name, not from a constant someone can desync
console.log('== it reads the cache, not a duplicated constant ==');
const viaApi = await page.evaluate(async () => (await import('./js/backup.js')).currentBuildStamp());
assert(viaApi === STAMP.replace(/^/, ''), `currentBuildStamp() returns the same thing the line shows ("${viaApi}")`);
const grepped = await page.evaluate(async () => {
  const src = await (await fetch('./js/grownups.js')).text();
  return { hardcoded: /run1\d[\w-]*-\d{8}/.test(src), callsApi: /currentBuildStamp\s*\(/.test(src) };
});
assert(grepped.callsApi, 'js/grownups.js gets the stamp by calling currentBuildStamp()');
assert(!grepped.hardcoded, 'and does NOT carry a copy of the stamp that could drift out of step');

await page.screenshot({ path: SHOTS + '/grownups-build-line.png' });
console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
