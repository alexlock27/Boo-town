// tests/r4p10-phone.mjs — RUN4 phase 10 (C10): the phone result at 390x844,
// both orientations. Full guide with no overlap from the top strip, a fully
// visible speech bubble, no horizontal scroll anywhere (including the bottom
// bar), and 44px minimum touch targets on the things she taps.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p10/phone', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = {
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, deco_tree: 1 }, boxes: 0, meter: 3, opened: 2, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [{ zone: 'meadow', x: 0.4, item: 'deco_tree' }, { zone: 'meadow', x: 0.6, item: 'boo_inky' }],
  stars: { total: 60, byGame: {} }, ledger: {},
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, ageAsked: true, age: 8
};

const browser = await chromium.launch();
for (const [w, h, o] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
  console.log(`== phone ${w}x${h} (${o}) ==`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub .speech-bubble');
  await sleep(500);
  await page.screenshot({ path: `screenshots/r4p10/phone/hub-${o}.png` });

  // no horizontal scroll anywhere (incl. the bottom bar)
  const scroll = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    bar: (b => !b || b.scrollWidth <= b.clientWidth + 1)(document.querySelector('.bottom-bar'))
  }));
  assert(scroll.doc, 'no horizontal scroll on the page');
  assert(scroll.bar, 'the bottom bar never scrolls');

  // the guide is fully visible, never overlapped by the top strip
  const geo = await page.evaluate(() => {
    const g = document.querySelector('.hub .guide-art svg');
    const strip = document.querySelector('.hub .hub-top');
    const bubble = document.querySelector('.hub .speech-bubble');
    const gr = g && g.getBoundingClientRect();
    const sr = strip && strip.getBoundingClientRect();
    const br = bubble && bubble.getBoundingClientRect();
    return {
      guide: gr && { top: gr.top, bottom: gr.bottom, left: gr.left, right: gr.right },
      stripBottom: sr ? sr.bottom : 0,
      bubble: br && { top: br.top, left: br.left, right: br.right, bottom: br.bottom },
      vw: innerWidth, vh: innerHeight
    };
  });
  assert(geo.guide && geo.guide.top >= geo.stripBottom - 2, `the top strip never overlaps the guide (strip ${geo.stripBottom.toFixed(0)} vs guide ${geo.guide.top.toFixed(0)})`);
  assert(geo.guide.bottom <= geo.vh && geo.guide.left >= 0 && geo.guide.right <= geo.vw, 'the full guide fits in the viewport');
  assert(geo.bubble && geo.bubble.top >= 0 && geo.bubble.left >= 0 && geo.bubble.right <= geo.vw, 'the speech bubble sits fully inside the viewport');

  // 44px touch targets on the things she taps
  const targets = await page.evaluate(() => {
    const sels = ['.bar-btn', '.gift-btn', '.game-card', '.icon-btn', '.star-chest'];
    const out = [];
    for (const sel of sels) for (const n of document.querySelectorAll(sel)) {
      const r = n.getBoundingClientRect();
      if (r.width && r.height) out.push({ sel, w: r.width, h: r.height });
    }
    return out;
  });
  const small = targets.filter(t => t.w < 44 || t.h < 44);
  assert(small.length === 0, `all hub touch targets ≥44px (${small.map(s => `${s.sel} ${s.w | 0}x${s.h | 0}`).join(', ') || 'ok'})`);

  // single-column hub cards (portrait) + game shell HUD one row
  if (o === 'portrait') {
    const col = await page.$$eval('.hub .game-card', cs => { const xs = cs.slice(0, 4).map(c => c.getBoundingClientRect().left); return xs.every(x => Math.abs(x - xs[0]) < 4); });
    assert(col, 'hub cards stack in a single column');
  }
  await page.evaluate(() => window.BooTown.go('clockshop'));
  await page.waitForSelector('.start-card');
  await page.click('.level-row .level-btn');
  await page.waitForSelector('.game-topbar');
  await sleep(300);
  const hud = await page.$eval('.game-topbar', n => {
    const kids = [...n.children].map(k => k.getBoundingClientRect());
    const tops = kids.map(k => k.top + k.height / 2);
    return { oneRow: Math.max(...tops) - Math.min(...tops) < 24, fits: n.scrollWidth <= n.clientWidth + 1 };
  });
  assert(hud.oneRow && hud.fits, 'the game shell HUD compresses to one row and fits');
  await page.screenshot({ path: `screenshots/r4p10/phone/gameshell-${o}.png` });

  // the town drawer shrinks but stays tappable
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town-drawer');
  await sleep(400);
  const drawer = await page.$eval('.town-drawer', n => n.getBoundingClientRect().height);
  assert(drawer <= 96, `the town drawer is compact (${drawer.toFixed(0)}px)`);
  await page.screenshot({ path: `screenshots/r4p10/phone/town-${o}.png` });
  await ctx.close();
}
await browser.close();
console.log(failed ? '\nr4p10-phone: FAIL' : '\nr4p10-phone: ALL PASS');
process.exit(failed ? 1 : 0);
