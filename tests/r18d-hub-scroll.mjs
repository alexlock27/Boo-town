// tests/r18d-hub-scroll.mjs — RUN18D D5: the hub, one scroll.
//
// The hub had THREE scroll contexts: the page, the games grid (its own `overflow-y: auto`),
// and the Today rail sideways. Two were invisible, so a child could not tell there was more
// below — and the grid's scroller was actively harmful: scrolling a card into view inside it
// left the card under the Today rail or the bottom bar. tests/m1.mjs could not click
// "Bubble Pop" at all, and had been failing on it since before this run started.
// The page scrolls; the grids are full wrapped grids; the bar sticks. The rail keeps its
// sideways scroll, because a carousel IS one — and the next card's peek is the affordance.
// Expected runtime: ~30s. Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('screenshots/run18d/d5', { recursive: true });

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
// a full save: every game has a best, so every card wears a star chip — the state the chip
// overflow was reported in.
const SAVE = JSON.stringify({
  version: 19, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1 }, trophies: {}, boxes: 1, meter: 4, spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: {
    total: 900,
    byGame: Object.fromEntries(['teachme', 'bubblepop', 'feedboos', 'spellboo', 'detective', 'soundsorter', 'blendit',
      'rhymetime', 'storyorder', 'clockshop', 'oddboo', 'flashboos', 'expedition', 'blocks', 'bounce', 'beat', 'dash',
      'boopop', 'booroll', 'echoboos', 'jokeboo'].map(k => [k, { best: 3, plays: 9, earned: 27 }])),
    byType: { maths: 200, word: 200, puzzle: 200, creative: 200, lesson: 200 }, spent: {}, legacy: 0
  },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, shop: { welcomed: true },
  golden: { words: [{ w: 'cat' }], choices: [], savedAt: 1 },
  seen: { trophyRetro: true, lastStarsShown: 900, welcomeTour: true, townFirst: true, zonesUnlocked: AK,
    lastPlay: { game: 'bubblepop', gameName: 'Make 10', cat: 'make10', level: 2, mix: false }, lastPlayDay: '2000-01-01' },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function hub(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => window.BooTown && window.__hub, null, { timeout: 40000 });
  await page.waitForSelector('.game-card', { timeout: 20000 });
  await sleep(500);
  return { ctx, page };
}

// ================== 1. one scroll context ==================
console.log('== exactly one thing on the hub scrolls vertically ==');
for (const [w, h] of [[1024, 768], [390, 844], [768, 1024]]) {
  const { ctx, page } = await hub(w, h);
  const r = await page.evaluate(() => {
    const scrollers = [];
    const walk = (n) => {
      const cs = getComputedStyle(n);
      const oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 2) {
        scrollers.push(n.className || n.tagName);
      }
      for (const k of n.children) walk(k);
    };
    walk(document.querySelector('.hub'));
    const hubEl = document.querySelector('.hub');
    return { scrollers, hubScrolls: hubEl.scrollHeight > hubEl.clientHeight + 2, hubClass: hubEl.className };
  });
  const inner = r.scrollers.filter(c => !/(^|\s)hub($|\s)/.test(c));
  assert(inner.length === 0, `${w}: nothing INSIDE the hub scrolls vertically (${inner.join(' | ') || 'none'})`);
  // …and the page itself is the one that does, when there is more than fits
  assert(r.hubScrolls || h >= 1000, `${w}x${h}: the hub itself is the scroller`);
  await ctx.close();
}

// ================== 2. every game card is reachable, and the bar never leaves ==================
console.log('== every game card can be scrolled to, and the four ways out stay put ==');
{
  const { ctx, page } = await hub(1024, 768);
  const before = await page.evaluate(() => document.querySelector('.bottom-bar').getBoundingClientRect().bottom);
  // scroll to the very end of the hub, the way a thumb does
  await page.evaluate(() => { const hb = document.querySelector('.hub'); hb.scrollTop = hb.scrollHeight; });
  await sleep(400);
  const after = await page.evaluate(() => {
    const bar = document.querySelector('.bottom-bar').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.game-card')];
    const last = cards[cards.length - 1].getBoundingClientRect();
    return { barBottom: bar.bottom, barTop: bar.top, viewH: window.innerHeight,
             lastCardVisible: last.top < bar.top && last.bottom > 0, cards: cards.length };
  });
  assert(Math.abs(after.barBottom - before) < 2, `the bottom bar stays where it is (${Math.round(before)} → ${Math.round(after.barBottom)})`);
  assert(after.barBottom <= after.viewH + 1, 'and it is still on screen at the bottom of the scroll');
  assert(after.lastCardVisible, `the LAST game card can be scrolled to, clear of the bar (${after.cards} cards)`);
  // and Playwright can actually click one, which is the failure m1 was reporting
  await page.click('.game-card:has-text("Boo Pop")', { timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'boopop', null, { timeout: 10000 });
  assert(true, 'a game card in the Play grid is genuinely clickable');
  await ctx.close();
}

// ================== 3. star chips never escape their card ==================
console.log('== the star chip is inside its card, at every width ==');
for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
  const { ctx, page } = await hub(w, h);
  const r = await page.evaluate(() => {
    const out = [];
    for (const card of document.querySelectorAll('.game-card')) {
      const chip = card.querySelector('.gc-stars');
      if (!chip) continue;
      const c = card.getBoundingClientRect(), s = chip.getBoundingClientRect();
      out.push({
        name: (card.querySelector('.gc-name') || {}).textContent,
        inside: s.left >= c.left - 0.5 && s.right <= c.right + 0.5 && s.top >= c.top - 0.5 && s.bottom <= c.bottom + 0.5,
        topRight: Math.abs(s.right - c.right) < 20 && Math.abs(s.top - c.top) < 20,
        font: getComputedStyle(chip.querySelector('.gc-stars-pill')).fontSize,
        overflow: getComputedStyle(chip).overflow
      });
    }
    return out;
  });
  assert(r.length >= 15, `${w}: ${r.length} cards wear a star chip`);
  const escaped = r.filter(x => !x.inside);
  assert(escaped.length === 0, `${w}: no chip escapes its card (${escaped.map(x => x.name).join(',') || 'none'})`);
  assert(r.every(x => x.topRight), `${w}: every chip sits at the card's top-right`);
  assert(r.every(x => x.overflow === 'hidden'), `${w}: and clips rather than spilling`);
  const fonts = [...new Set(r.map(x => x.font))];
  assert(fonts.every(f => parseFloat(f) >= 11 && parseFloat(f) <= 14), `${w}: the chip font is inside clamp(11px, 2.6vw, 14px) (${fonts.join(',')})`);
  await page.screenshot({ path: `screenshots/run18d/d5/hub-${w}.png` });
  await ctx.close();
}

// ================== 4. the Today carousel peeks ==================
console.log('== the next Today card peeks past the edge — the peek IS the affordance ==');
{
  // A real phone is a TOUCH device (isMobile+hasTouch → hover:none/pointer:coarse), and
  // there the rail keeps its clean bar-less swipe. Desktop pointers get a slim scrollbar
  // + wheel support instead (Alex, 2026-07-30: "isn't scrolling across on PC") — asserted
  // separately below.
  const { ctx, page } = await hub(390, 844, { isMobile: true, hasTouch: true });
  const r = await page.evaluate(() => {
    const rail = document.querySelector('.today-rail').getBoundingClientRect();
    const inner = document.querySelector('.trail-inner');
    const chips = [...document.querySelectorAll('.trail-chip')].map(c => c.getBoundingClientRect());
    const first = chips[0];
    const peeking = chips.find(c => c.left < rail.right - 4 && c.right > rail.right + 4);
    return {
      chips: chips.length,
      firstW: first.width, railW: rail.width,
      peek: peeking ? Math.round(rail.right - peeking.left) : 0,
      scrolls: inner.scrollWidth > inner.clientWidth + 2,
      bar: getComputedStyle(inner).scrollbarWidth,
      coarse: matchMedia('(pointer: coarse)').matches
    };
  });
  assert(r.coarse, 'the phone context really is a touch context');
  assert(r.chips >= 3, `${r.chips} Today cards`);
  assert(r.firstW / r.railW > 0.78 && r.firstW / r.railW < 0.92,
    `a card is 85% of the rail (${Math.round(r.firstW)} of ${Math.round(r.railW)} = ${(r.firstW / r.railW * 100).toFixed(0)}%)`);
  assert(r.peek >= 14 && r.peek <= 60, `the next card peeks ${r.peek}px past the edge`);
  assert(r.scrolls, 'the rail really does scroll sideways');
  assert(r.bar === 'none', 'with no hairline scrollbar on touch');
  await ctx.close();
}
// ============ 4b. the desktop affordance (Alex, 2026-07-30: PC could not scroll) ============
console.log('== a mouse can drive the rail: slim scrollbar + wheel steps a full card ==');
{
  const { ctx, page } = await hub(1024, 768);   // default context = precision pointer
  const r = await page.evaluate(() => {
    const inner = document.querySelector('.trail-inner');
    const before = inner.scrollLeft;
    document.querySelector('.today-rail').dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
    return { bar: getComputedStyle(inner).scrollbarWidth, before, after: inner.scrollLeft, overflows: inner.scrollWidth > inner.clientWidth + 2 };
  });
  assert(r.bar === 'thin', `a precision pointer gets the slim scrollbar (${r.bar})`);
  if (r.overflows) assert(r.after > r.before, `one wheel notch advances at least a card (${Math.round(r.before)} → ${Math.round(r.after)})`);
  await ctx.close();
}
{
  const { ctx, page } = await hub(1024, 768);
  const w = await page.evaluate(() => document.querySelector('.trail-chip').getBoundingClientRect().width);
  assert(Math.abs(w - 320) < 1, `at >=600px a Today card is a fixed 320px (${Math.round(w)})`);
  await ctx.close();
}

// ================== 5. section order, and the eight-button law ==================
console.log('== Today · Learn · Play · one Town banner, and no more than eight primary buttons ==');
{
  const { ctx, page } = await hub(390, 844);
  const r = await page.evaluate(() => {
    const hb = document.querySelector('.hub');
    const order = [...hb.children].map(n => n.className.split(' ')[0]);
    const labels = [...hb.querySelectorAll('.group-label')].map(n => n.textContent);
    const railTop = document.querySelector('.today-rail').getBoundingClientRect().top;
    const learn = [...hb.querySelectorAll('.group-label')].find(n => n.textContent === 'Learn').getBoundingClientRect().top;
    const play = [...hb.querySelectorAll('.group-label')].find(n => n.textContent === 'Play').getBoundingClientRect().top;
    const banner = document.querySelector('.hub-town-banner');
    const b = banner.getBoundingClientRect();
    // primary buttons: the bar's four, plus the banner. Game cards are CARDS, and the pack
    // says so in as many words.
    const primary = document.querySelectorAll('.bottom-bar .bar-btn').length + (banner ? 1 : 0);
    return { order, labels, railTop, learn, play, bannerTop: b.top, bannerH: b.height, primary,
             townInBar: !!document.querySelector('.bottom-bar .bar-btn'),
             banners: document.querySelectorAll('.hub-town-banner').length };
  });
  assert(JSON.stringify(r.labels) === '["Learn","Play"]', `the grids are Learn then Play (${r.labels.join(',')})`);
  assert(r.railTop < r.learn && r.learn < r.play && r.play < r.bannerTop,
    `Today · Learn · Play · Town banner, in that order (${[r.railTop, r.learn, r.play, r.bannerTop].map(Math.round).join(' < ')})`);
  assert(r.banners === 1, `exactly ONE Town banner (${r.banners})`);
  assert(r.bannerH >= 56, `and it is a real tap target (${Math.round(r.bannerH)}px)`);
  assert(r.primary <= 8, `the hub has ${r.primary} primary buttons at phone width (law: 8)`);
  await ctx.close();
}

await browser.close();
assert(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
