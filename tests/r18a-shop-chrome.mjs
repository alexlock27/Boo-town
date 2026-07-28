// tests/r18a-shop-chrome.mjs — RUN18A H4: the shop's back control and its bought card.
//
// The audit called the Shop's back button "invisible". It was never missing: the shared
// "‹" circle has always been there at (10,10,56,56). The shopkeeper's 76px drawn head
// started at x:12 and sat directly UNDER it, so a translucent white circle was painted on
// a busy giraffe face. The control had a giraffe behind it, not a bug in it — so this
// suite proves VISIBILITY by sampling real pixels, not by asserting the element exists.
//
// And the purchase confirmation: a caption floating over the middle of the screen for
// 1.8s including its fade became a card on a real surface, held 2.5s, dismissible by tap,
// sitting clear of the shelf tabs by a MEASURED clearance rather than a guessed constant
// (the tab row is 52px at desktop and 102px at phone — any single magic number is wrong
// somewhere).
//
// Expected runtime: ~28s (measured 28.4s). Not @serial — the one timing assertion is a lifetime bound
// measured with a condition-wait, not a frame sample.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18a/h4';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 },
  stars: { total: 900, byType: { maths: 300, word: 300, puzzle: 300, creative: 300, lesson: 300 }, spent: {}, legacy: 300, byGame: {} },
  trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 900, introSeen: { shop: true }, shopWelcomed: true },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];

async function openShop(W, H) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('shop'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'shop', null, { timeout: 15000 });
  await page.waitForTimeout(700);
  // clear the first-visit ceremonies the way a child does, so the chrome is what is judged
  await page.evaluate(() => {
    document.querySelectorAll('.intro-overlay').forEach(n => n.remove());
    const w = document.querySelector('.shop-welcome .btn.big');
    if (w) w.click();
  });
  await page.waitForTimeout(400);
  return { ctx, page };
}

// Contrast from REAL PIXELS: screenshot the region, decode it back inside the page on a
// canvas, and read it. Computed styles cannot answer "can she see it" when the thing
// behind is a drawing.
async function pixels(page, box) {
  const buf = await page.screenshot({ clip: box });
  const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
  return page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
    return out;
  }, dataUrl);
}
const lum = (p) => { const f = p.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const contrast = (a, b) => { const l1 = Math.max(a, b), l2 = Math.min(a, b); return (l1 + 0.05) / (l2 + 0.05); };

for (const [W, H] of [[1024, 768], [768, 1024], [390, 844]]) {
  console.log(`\n===== ${W}x${H} =====`);
  const { ctx, page } = await openShop(W, H);

  // ---- 1. the back control ------------------------------------------------------------
  console.log('== 1. the shared back control ==');
  const back = await page.evaluate(() => {
    const b = document.querySelector('.screen.shop .back-btn');
    if (!b) return { missing: true };
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    // what would be painted here if the control were not: the audit's real complaint
    b.style.visibility = 'hidden';
    const under = document.elementFromPoint(cx, cy);
    b.style.visibility = '';
    const keeper = document.querySelector('.shop-keeper');
    const kr = keeper && keeper.getBoundingClientRect();
    return {
      box: { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
      shared: b.classList.contains('screen-back'),
      hits: !!(top && b.contains(top)), topEl: top ? (top.getAttribute('class') || top.tagName) : null,
      under: under ? (under.getAttribute('class') || under.tagName) : null,
      keeperOverlaps: !!(kr && !(kr.right <= r.left || kr.left >= r.right || kr.bottom <= r.top || kr.top >= r.bottom))
    };
  });
  assert(!back.missing, 'the Shop has a back control');
  assert(back.shared, 'and it is the SHARED screen "‹" circle, not a per-screen one');
  assert(back.box.width >= 56 && back.box.height >= 56, `its hit target is ${back.box.width}x${back.box.height} (>= 56)`);
  assert(back.hits, `nothing is painted over it — a tap reaches it (topmost: ${back.topEl})`);
  assert(!back.keeperOverlaps, `the shopkeeper avatar is clear of it (what is behind it now: ${back.under})`);

  const px = await pixels(page, back.box);
  const ls = px.map(lum);
  const glyph = contrast(Math.max(...ls), Math.min(...ls));
  assert(glyph >= 3, `and it is VISIBLE: ${glyph.toFixed(2)}:1 between its lightest and darkest pixels (non-text contrast law is 3:1)`);

  // and it works
  await page.evaluate(() => document.querySelector('.screen.shop .back-btn').click());
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'hub', null, { timeout: 8000 });
  assert(true, 'and tapping it leaves the shop');
  await page.evaluate(() => window.BooTown.go('shop'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'shop', null, { timeout: 10000 });
  await page.waitForTimeout(500);

  // ---- 2. the bought card -------------------------------------------------------------
  console.log('== 2. the purchase confirmation card ==');
  const bought = await page.evaluate(() => {
    const buys = [...document.querySelectorAll('.shop-card .sc-buy')].filter(b => b.textContent === 'Buy');
    if (!buys.length) return { none: true };
    const name = buys[0].closest('.shop-card').querySelector('.sc-name').textContent;
    buys[0].click();
    return { name };
  });
  assert(!bought.none, `something affordable was bought (${bought.name})`);
  await page.waitForSelector('.shop-bought .sb-card', { timeout: 5000 });
  const shown = Date.now();
  const card = await page.evaluate(() => {
    const wrap = document.querySelector('.shop-bought');
    const c = wrap.querySelector('.sb-card');
    const r = c.getBoundingClientRect();
    const tabs = [...document.querySelectorAll('.bd-tabs, .bd-tab')];
    const hits = tabs.map(t => {
      const tr = t.getBoundingClientRect();
      return !(r.right <= tr.left || r.left >= tr.right || r.bottom <= tr.top || r.top >= tr.bottom);
    });
    const cs = getComputedStyle(c);
    return {
      box: { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
      bg: cs.backgroundColor, radius: cs.borderRadius, pointer: cs.pointerEvents,
      wrapPointer: getComputedStyle(wrap).pointerEvents,
      tabsCount: tabs.length, intersectsAnyTab: hits.some(Boolean),
      onScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      line: (c.querySelector('.sb-line') || {}).textContent
    };
  });
  assert(/rgb/.test(card.bg) && card.bg !== 'rgba(0, 0, 0, 0)', `it is a CARD on a real surface (${card.bg}, radius ${card.radius})`);
  assert(card.intersectsAnyTab === false, `its box intersects none of the ${card.tabsCount} shelf tabs`);
  assert(card.onScreen, `and it is fully on screen (${JSON.stringify(card.box)})`);
  assert(card.pointer === 'auto' && card.wrapPointer === 'none', 'the card takes taps; the backdrop does not hold the shop hostage');
  assert(/is yours! Find it in Build\./.test(card.line), `the copy is untouched — RUN18B Y2 owns the words ("${card.line}")`);
  await page.screenshot({ path: `${SHOTS}/bought-${W}.png` });

  // it must still be there well past 2s, and gone after its full life
  await page.waitForTimeout(2000);
  const at2s = await page.evaluate(() => !!document.querySelector('.shop-bought .sb-card'));
  assert(at2s, 'still readable 2s later (the old toast had already gone at 1.8s)');
  await page.waitForFunction(() => !document.querySelector('.shop-bought'), null, { timeout: 6000 });
  const life = Date.now() - shown;
  assert(life >= 2500, `it lived ${life}ms — at least the authored SHOP_BOUGHT_MS of 2500`);

  // ---- 3. and a tap dismisses it early -------------------------------------------------
  const dismissed = await page.evaluate(async () => {
    const buys = [...document.querySelectorAll('.shop-card .sc-buy')].filter(b => b.textContent === 'Buy');
    if (!buys.length) return { none: true };
    buys[0].click();
    await new Promise(r => setTimeout(r, 300));
    const c = document.querySelector('.shop-bought .sb-card');
    if (!c) return { noCard: true };
    c.click();
    await new Promise(r => setTimeout(r, 500));
    return { gone: !document.querySelector('.shop-bought'), stillShopping: document.getElementById('screen').dataset.screen };
  });
  assert(dismissed.gone === true, 'tapping the card dismisses it early');
  assert(dismissed.stillShopping === 'shop', 'and she is still in the shop afterwards');

  // ---- 4. two purchases in a row leave ONE card ----------------------------------------
  // A child with a full purse buys twice quickly. Two live cards used to stack, and since
  // the second is often a different size, the older one's rim showed around all four
  // edges. (Found by the playtest critic; ordered small-then-large it happens to hide,
  // which is why it survives a casual look.)
  const rapid = await page.evaluate(async () => {
    const pick = () => [...document.querySelectorAll('.shop-card .sc-buy')].filter(b => b.textContent === 'Buy');
    const first = pick();
    if (first.length < 2) return { tooFew: first.length };
    first[0].click();
    await new Promise(r => setTimeout(r, 350));
    const afterOne = document.querySelectorAll('.shop-bought').length;
    const again = pick();
    if (!again.length) return { tooFew: 1 };
    again[0].click();
    await new Promise(r => setTimeout(r, 350));
    const cards = [...document.querySelectorAll('.shop-bought')];
    return { afterOne, afterTwo: cards.length, visible: cards.filter(c => c.getBoundingClientRect().width > 0).length };
  });
  assert(!rapid.tooFew, `two affordable things were bought in quick succession (${JSON.stringify(rapid)})`);
  assert(rapid.afterOne === 1 && rapid.afterTwo === 1, `buying twice quickly leaves exactly ONE confirmation card (saw ${rapid.afterTwo})`);
  await page.waitForFunction(() => !document.querySelector('.shop-bought'), null, { timeout: 6000 });

  await ctx.close();
}

// ---- 4. the authored constant ----------------------------------------------------------
console.log('\n== 4. the authored constant ==');
{
  const { ctx, page } = await openShop(1024, 768);
  const ms = await page.evaluate(async () => (await import('./js/shop.js')).SHOP_BOUGHT_MS);
  assert(ms === 2500, `SHOP_BOUGHT_MS is exported and is exactly 2500 (got ${ms})`);
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
