// tests/r11map-art.mjs — RUN11 world-map art pass (P1 feel goal).
// The map must be a PLACE, not a menu: every unlocked landmark is a house-style inline SVG
// sticker (no emoji-as-art, per the CLAUDE.md art contract), the island carries real
// buildings, and it has quiet life — all transform/opacity only.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AREA_KEYS = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = (stars) => JSON.stringify({ version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: stars, byGame: {} }, trophies: {},
  town: { areas: Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 },
  seen: { trophyRetro: true, lastStarsShown: stars, areasUnlocked: ['riverside','hilltop','beach'] },
  settings: { sound:false, music:false, voice:false, content:'full' } });

const browser = await chromium.launch();

console.log('== every unlocked landmark is a house-style SVG sticker, never an emoji ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(500));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.map-badge', { timeout: 8000 });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const dots = [...document.querySelectorAll('.map-badge:not(.locked) .mb-dot')];
    return {
      badges: document.querySelectorAll('.map-badge').length,
      withSvg: dots.filter(d => d.querySelector('svg')).length,
      total: dots.length,
      // any bare text left in an unlocked badge would be emoji-as-art
      strays: dots.filter(d => !d.querySelector('svg') && d.textContent.trim()).map(d => d.textContent.trim())
    };
  });
  assert(r.badges === 8, `all eight landmark badges render (${r.badges})`);
  assert(r.total > 0 && r.withSvg === r.total, `every unlocked badge holds an inline SVG sticker (${r.withSvg}/${r.total})`);
  assert(r.strays.length === 0, `no emoji-as-art left in a landmark badge (${JSON.stringify(r.strays)})`);
  await ctx.close();
}

console.log('== each area gets its OWN glyph (not one shape repeated) ==');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  const r = await page.evaluate(async (keys) => {
    const art = await import('./js/art.js');
    const svgs = keys.map(k => art.renderAreaGlyph(k, { size: 44 }));
    return { distinct: new Set(svgs).size, count: svgs.length, allSvg: svgs.every(s => s.startsWith('<svg')), sample: svgs[0].slice(0, 40) };
  }, AREA_KEYS);
  assert(r.allSvg, 'renderAreaGlyph returns inline SVG');
  assert(r.distinct === r.count, `all ${r.count} areas have distinct artwork (${r.distinct} unique)`);
  await ctx.close();
}

console.log('== the locked state still reads honestly (silhouette + star chip + line) ==');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(0));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.map-badge', { timeout: 8000 });
  const locked = await page.locator('.map-badge.locked').count();
  const chips = await page.locator('.map-badge.locked .mb-chip').count();
  assert(locked === 3, `the three star-gated areas are locked at 0 stars (${locked})`);
  assert(chips === locked, 'every locked badge shows its star-threshold chip');
  await page.evaluate(() => window.__worldmap.tap('beach'));
  await page.waitForTimeout(300);
  const toast = await page.evaluate(() => window.__worldmap.toastText());
  assert(/more stars/i.test(toast), `a locked tap still speaks L_MAP_LOCKED ("${toast}")`);
  await ctx.close();
}

console.log('== the island has quiet life, transform/opacity only ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(500));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.map-cloud', { timeout: 8000 });
  const xs = [];
  for (let i = 0; i < 7; i++) {
    xs.push(await page.evaluate(() => {
      const m = getComputedStyle(document.querySelector('.map-cloud.c1')).transform.match(/matrix\(([^)]+)\)/);
      return m ? +m[1].split(',')[4].trim() : null;
    }));
    await page.waitForTimeout(540);
  }
  assert(new Set(xs).size >= 6, `clouds drift across ${new Set(xs).size} distinct positions over 3.2s`);
  assert(await page.locator('.map-shimmer path').count() >= 3, 'the river carries a shimmer');
  await ctx.close();

  // reduced motion stills everything
  const rctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1024, height: 768 } });
  const rpage = await rctx.newPage();
  await rpage.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(500));
  await rpage.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await rpage.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
  await rpage.evaluate(() => window.BooTown.go('worldmap'));
  await rpage.waitForSelector('.map-cloud', { timeout: 8000 });
  const anim = await rpage.evaluate(() => getComputedStyle(document.querySelector('.map-cloud.c1')).animationName);
  assert(anim === 'none', 'reduced motion stills the clouds');
  await rctx.close();
}

console.log('== one of her own Boos ambles the island, as scenery only ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(500));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.map-badge', { timeout: 8000 });
  await page.waitForTimeout(300);
  const w = await page.evaluate(() => {
    const n = document.querySelector('.map-wanderer');
    return n ? { pointer: getComputedStyle(n).pointerEvents, anim: getComputedStyle(n).animationName, svg: !!n.querySelector('svg'), hidden: n.getAttribute('aria-hidden') } : null;
  });
  assert(w && w.svg, 'an owned Boo is drawn on the island');
  assert(w.pointer === 'none', 'the wanderer is inert — it can never swallow a badge tap');
  assert(w.hidden === 'true', 'it is hidden from assistive tech (decoration, not a control)');
  assert(w.anim === 'mapStroll', 'it strolls (transform-only)');
  // and a badge tap still works with it on screen
  await page.evaluate(() => window.__worldmap.tap('meadow'));
  await page.waitForTimeout(500);
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen) === 'town', 'badges still navigate with the wanderer present');
  await ctx.close();

  // absent before she owns a Boo, and stilled by reduced motion
  const ectx = await browser.newContext();
  const epage = await ectx.newPage();
  const noBoos = JSON.parse(SAVE(500)); noBoos.inventory = {};
  await epage.addInitScript(s => localStorage.setItem('bootown.save.v1', s), JSON.stringify(noBoos));
  await epage.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await epage.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
  await epage.evaluate(() => window.BooTown.go('worldmap'));
  await epage.waitForSelector('.map-badge', { timeout: 8000 });
  assert(await epage.locator('.map-wanderer').count() === 0, 'no wanderer before she owns a Boo');
  await ectx.close();

  const rctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1024, height: 768 } });
  const rpage = await rctx.newPage();
  await rpage.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(500));
  await rpage.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await rpage.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
  await rpage.evaluate(() => window.BooTown.go('worldmap'));
  await rpage.waitForSelector('.map-wanderer', { timeout: 8000 });
  assert(await rpage.evaluate(() => getComputedStyle(document.querySelector('.map-wanderer')).animationName) === 'none', 'reduced motion stills the wanderer');
  await rctx.close();
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
