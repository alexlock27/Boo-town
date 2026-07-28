// tests/r18d-funfair-scenery.mjs — RUN18D D10: the Funfair actually renders its fair.
//
// THE DIAGNOSIS. The audit saw "an umbrella and bunting" where js/funfair.js declares a
// carousel, a ticket booth, a popcorn cart and string lights, and it was reporting exactly
// what is on screen. Nothing was unwired and nothing was buried under a layer: the fixed
// scenery was laid out as fractions of the WHOLE AREA, and a town area is four viewports
// wide. Measured before the fix at 1024x768: the ticket booth sat at 0.28 x 4032px = 1129px
// and the popcorn cart at 0.50 = 2016px — one and two screens to the RIGHT of where a child
// arrives — while the 18 bulbs and 16 flags were spread across all 4032px, so the entry
// screen received four of each and read as a washing line. The "umbrella" was the carousel's
// canopy, the only fixed thing that happened to land near the entrance.
//
// The fix is per-SCREEN layout: bunting, string lights and the far wheel repeat once per
// viewport, the booth stands on every other screen and the cart on every one. So the fair is
// a fair wherever she is standing, including the moment she arrives with nothing placed.
// Expected runtime: ~25s. Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('screenshots/run18d/d10', { recursive: true });

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
// ZERO placements anywhere. If the fair only looks like a fair once she has decorated it,
// it is not the fair's scenery — it is hers.
const SAVE = JSON.stringify({
  version: 19, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, trophies: {}, boxes: 0, meter: 2, spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 900, byGame: {}, byType: { maths: 200, word: 200, puzzle: 200, creative: 200, lesson: 200 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 2 }, shop: { welcomed: true },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 900, welcomeTour: true, zonesUnlocked: AK, funfairOpen: true },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function fair(width, height, hour = 13) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(h => { window.__bootownHour = h; }, hour);
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 40000 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'funfair' }));
  await page.waitForSelector('.town2', { timeout: 20000 });
  await sleep(1400);
  // the one-time "The Boo Funfair is OPEN!" card covers the middle of the scene
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Let.s go/.test(x.textContent)); if (b) b.click(); });
  await sleep(900);
  return { ctx, page };
}
// what is actually inside the viewport right now
const onScreen = (page, sel) => page.evaluate(s => {
  const vp = document.querySelector('.t-viewport') || document.querySelector('.town2');
  const v = vp.getBoundingClientRect();
  return [...document.querySelectorAll(s)]
    .map(n => n.getBoundingClientRect())
    .filter(r => r.width > 2 && r.height > 2 && r.right > v.left + 4 && r.left < v.right - 4 && r.bottom > v.top && r.top < v.bottom)
    .length;
}, sel);

console.log('== the fair is a fair on arrival, with nothing placed ==');
for (const [w, h] of [[1024, 768], [1456, 831], [390, 844]]) {
  const { ctx, page } = await fair(w, h);
  const scenery = await page.evaluate(() => !!document.querySelector('.ff-scenery'));
  assert(scenery, `${w}: the scenery layer is mounted`);
  const booth = await onScreen(page, '.ff-booth');
  const cart = await onScreen(page, '.ff-cart');
  const flags = await onScreen(page, '.ff-scenery path[fill^="#"]');
  const bulbs = await onScreen(page, '.ff-bulb');
  assert(booth >= 1, `${w}: the ticket booth is ON SCREEN (${booth})`);
  assert(cart >= 1, `${w}: the popcorn cart is ON SCREEN (${cart})`);
  assert(bulbs >= 6, `${w}: the string lights are a string, not four bulbs (${bulbs} on screen)`);
  assert(flags >= 8, `${w}: and the bunting is a swag (${flags} flags on screen)`);
  await page.screenshot({ path: `screenshots/run18d/d10/entry-${w}.png` });
  await ctx.close();
}

console.log('== and it stays a fair as she walks it ==');
{
  const { ctx, page } = await fair(1024, 768);
  // The town scrolls by transform, not by scrollLeft, so this drives its own scroller —
  // the same one the child's swipe moves — and steps a screen at a time across the AREA.
  const geo = await page.evaluate(() => ({ viewW: window.__town.geometry().viewW, max: window.__town.scrollMax() }));
  const steps = Math.max(1, Math.ceil(geo.max / geo.viewW) + 1);
  const walk = [];
  for (let step = 0; step < steps; step++) {
    await page.evaluate(x => window.__town.scrollTo(x), Math.min(step * geo.viewW, geo.max));
    await sleep(700);
    walk.push({
      step,
      booth: await onScreen(page, '.ff-booth'),
      cart: await onScreen(page, '.ff-cart'),
      bulbs: await onScreen(page, '.ff-bulb')
    });
    await page.screenshot({ path: `screenshots/run18d/d10/walk-${step}.png` });
  }
  const bare = walk.filter(s => s.booth + s.cart === 0);
  assert(bare.length === 0, `no screen of the fair is bare (${JSON.stringify(walk)})`);
  assert(walk.every(s => s.bulbs >= 6), 'the lights run the whole length of it');
  await ctx.close();
}

console.log('== night lights up the fair rather than hiding it ==');
{
  const { ctx, page } = await fair(1024, 768, 22);
  const night = await page.evaluate(() => !!document.querySelector('.ff-scenery.night'));
  assert(night, 'the scenery knows it is night');
  assert(await onScreen(page, '.ff-booth') >= 1, 'the booth is still there after dark');
  await page.screenshot({ path: 'screenshots/run18d/d10/entry-night.png' });
  await ctx.close();
}

await browser.close();
assert(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
