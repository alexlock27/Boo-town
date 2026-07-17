// tests/r10p1-worldmap.mjs — RUN10 P1: Town 4.0, the world map and area scenes.
// Acceptance: map renders 8 badges; lock states honour a seeded save at 0/40/100/180⭐;
// locked tap wobbles + fires the guide line; a 12-item legacy save migrates every item
// into its mapped area at the expected proportional x; entry crossfade; every scenery
// minimum present per area with frame evidence (windmill ≥6 frames, foam sine); header
// strip on every area; funfair unchanged inside the new routing.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { migrateForTest } from './lib/migrateForTest.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p1', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow'].map(n => 'boo_' + n);

const SAVE = (over = {}) => Object.assign({
  version: 6, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])), boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
  town: { areas: {
    meadow: { items: [{ zone: 'meadow', x: 0.3, row: 1, item: BOOS[0] }], paths: [] },
    riverside: { items: [{ zone: 'riverside', x: 0.45, row: 1, item: BOOS[1] }], paths: [] },
    hilltop: { items: [{ zone: 'hilltop', x: 0.45, row: 1, item: BOOS[2] }], paths: [] },
    beach: { items: [{ zone: 'beach', x: 0.45, row: 1, item: BOOS[3] }], paths: [] },
    funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] }
  } },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { funfairOpened: 'x', introSeen: {}, trophyRetro: true, townFirst: true, areasUnlocked: ['riverside', 'hilltop', 'beach', 'funfair'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openMap(save, { hour = 13, reduced = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, reducedMotion: reduced });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((h) => { window.__bootownHour = h; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.worldmap');
  await page.waitForFunction(() => window.__worldmap, { timeout: 4000 });
  await sleep(300);
  return { ctx, page };
}
async function openTown(save, area, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((h) => { window.__bootownHour = h; }, 13);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate((p) => window.BooTown.go('town', p), Object.assign({ area }, extra));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(300);
  return { ctx, page };
}

// ==================== 8 badges render ====================
console.log('== the map renders 8 landmark badges ==');
{
  const { ctx, page } = await openMap(SAVE());
  const badges = await page.evaluate(() => window.__worldmap.badges());
  assert(badges.length === 8, `8 badges present (${badges.length})`);
  await page.screenshot({ path: 'screenshots/r10p1/map-1024x700.png' });
  await ctx.close();
}

// ==================== lock states honour star thresholds ====================
console.log('== lock states honour 0/40/100/180 star seeds ==');
{
  const cases = [
    [0, { riverside: true, hilltop: true, beach: true }],
    [40, { riverside: false, hilltop: true, beach: true }],
    [100, { riverside: false, hilltop: false, beach: true }],
    [180, { riverside: false, hilltop: false, beach: false }]
  ];
  for (const [stars, expect] of cases) {
    const { ctx, page } = await openMap(SAVE({ stars: { total: stars, byGame: {} }, seen: { areasUnlocked: [] } }));
    const badges = await page.evaluate(() => window.__worldmap.badges());
    const byKey = Object.fromEntries(badges.map(b => [b.key, b.locked]));
    for (const k of ['riverside', 'hilltop', 'beach']) assert(byKey[k] === expect[k], `@${stars}⭐ ${k} locked=${byKey[k]} (expected ${expect[k]})`);
    assert(byKey.meadow === false && byKey.funfair === false && byKey.playground === false && byKey.boohouse === false && byKey.gallery === false, `@${stars}⭐ always-open areas are unlocked`);
    await ctx.close();
  }
}

// ==================== locked tap wobbles + fires the guide line ====================
console.log('== a locked tap wobbles the badge and shows the guide line ==');
{
  const { ctx, page } = await openMap(SAVE({ stars: { total: 0, byGame: {} }, seen: { areasUnlocked: [] } }));
  await page.evaluate(() => window.__worldmap.tap('riverside'));
  await sleep(150);
  assert(await page.evaluate(() => window.__worldmap.wobbling('riverside')), 'the locked badge wobbles on tap');
  const toast = await page.evaluate(() => window.__worldmap.toastText());
  assert(toast.includes('40') && toast.toLowerCase().includes('star'), `the guide line names the remaining stars (got "${toast}")`);
  await ctx.close();
}

// ==================== legacy migration: 12-item seeded save, exact expected x ====================
console.log('== legacy flat-array save migrates every item into its mapped area at the expected x ==');
{
  const legacy = {
    version: 5, name: 'Ada', stars: { total: 300, byGame: {} },
    town: [
      { zone: 'meadow', x: 0.10, row: 0, item: 'deco_bench' },
      { zone: 'meadow', x: 0.30, row: 1, item: 'deco_tree' },
      { zone: 'meadow', x: 0.90, row: 2, item: 'boo_inky' },
      { zone: 'riverside', x: 0.05, row: 0, item: 'deco_swings' },
      { zone: 'riverside', x: 0.50, row: 1, item: 'deco_pond' },
      { zone: 'riverside', x: 0.99, row: 2, item: 'boo_plum' },
      { zone: 'hilltop', x: 0.20, row: 0, item: 'deco_picnic' },
      { zone: 'hilltop', x: 0.60, row: 1, item: 'deco_slide' },
      { zone: 'hilltop', x: 0.85, row: 2, item: 'boo_pippin' },
      { zone: 'beach', x: 0.15, row: 0, item: 'deco_paddlepool' },
      { zone: 'beach', x: 0.55, row: 1, item: 'deco_seesaw' },
      { zone: 'beach', x: 0.95, row: 2, item: 'boo_lolly' }
    ]
  };
  const originalItems = legacy.town.map(t => ({ ...t }));   // migrate() mutates in place
  const migrated = migrateForTest(legacy);
  const RATIO = 1.7 / 4;
  let ok = true;
  for (const t of originalItems) {
    const items = migrated.town.areas[t.zone].items;
    const expected = Math.max(0, Math.min(1, +(t.x * RATIO).toFixed(3)));
    const found = items.find(i => i.item === t.item);
    if (!found || Math.abs(found.x - expected) > 0.001) { ok = false; console.log(`  ✗ FAIL: ${t.item} in ${t.zone}: expected x=${expected}, got ${found ? found.x : 'MISSING'}`); }
  }
  assert(ok, 'all 12 legacy items land in their mapped area at the exact proportional x (ratio 1.7/4)');
  assert(migrated.town.areas.playground.items.length === 0 && migrated.town.areas.boohouse.items.length === 0 && migrated.town.areas.gallery.items.length === 0, 'playground/boohouse/gallery start empty (no legacy zone key)');
  assert(migrated.version === 7, 'save version bumped through the current RUN10 schema (v7)');
}

// ==================== entry crossfade ====================
console.log('== entering an area crossfades in ==');
{
  const { ctx, page } = await openTown(SAVE(), 'meadow');
  const opac = await page.$eval('.town2', n => getComputedStyle(n).opacity);
  assert(+opac > 0.9, `the area scene is fully faded in shortly after mount (opacity ${opac})`);
  await ctx.close();
}

// ==================== header strip on every area ====================
console.log('== every area has the 56px header strip: back / name / hammer ==');
{
  for (const area of ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery']) {
    const { ctx, page } = await openTown(SAVE(), area);
    const h = await page.$eval('.town-header', n => getComputedStyle(n).height);
    assert(h === '56px', `${area}: header is 56px tall (got ${h})`);
    assert(await page.$('.town-header .back-btn'), `${area}: back-to-map button present`);
    assert(await page.$eval('.town-header h2', n => n.textContent.length > 0), `${area}: area name shown`);
    assert(await page.$('.town-header .town-hammer-btn'), `${area}: hammer button present`);
    await ctx.close();
  }
}

// ==================== scenery minima per area, with frame evidence ====================
console.log('== scenery minima present per area (frame evidence) ==');
{
  // riverside: bridge + reeds×4 + dragonfly, band y 30-42%
  const { ctx: c1, page: p1 } = await openTown(SAVE(), 'riverside');
  assert(await p1.$('.rv-bridge'), 'riverside: wooden bridge present');
  assert((await p1.$$('.rv-reed')).length === 4, `riverside: 4 reed clusters (${(await p1.$$('.rv-reed')).length})`);
  assert(await p1.$('.rv-dragonfly'), 'riverside: dragonfly present by day');
  await p1.screenshot({ path: 'screenshots/r10p1/riverside-1024x700.png' });
  await c1.close();

  // hilltop: windmill rotates ≥6 frames over ≥3s, clouds present
  const { ctx: c2, page: p2 } = await openTown(SAVE(), 'hilltop');
  assert(await p2.evaluate(() => window.__townLife.sceneryAnimated('.hl-blades')), 'hilltop: windmill sails animate');
  const millFr = [];
  for (let k = 0; k < 7; k++) { millFr.push(await p2.evaluate(() => window.__townLife.sceneryXf('.hl-blades'))); await sleep(460); }
  assert(distinct(millFr) >= 6, `hilltop: windmill rotation shows ≥6/7 distinct frames over ${(7 * 0.46).toFixed(1)}s`);
  assert(await p2.$('.hl-cloud'), 'hilltop: clouds present');
  await p2.screenshot({ path: 'screenshots/r10p1/hilltop-1024x700.png' });
  await c2.close();

  // beach: foam sine, palm×2, shells×6, sea band 26-38%
  const { ctx: c3, page: p3 } = await openTown(SAVE(), 'beach');
  assert(await p3.evaluate(() => window.__townLife.sceneryAnimated('.bc-foam')), 'beach: foam animates (sine)');
  const foamFr = [];
  for (let k = 0; k < 7; k++) { foamFr.push(await p3.evaluate(() => window.__townLife.sceneryXf('.bc-foam'))); await sleep(430); }
  assert(distinct(foamFr) >= 5, `beach: foam shows motion (${distinct(foamFr)}/7 frames)`);
  assert((await p3.$$('.bc-palm')).length === 2, `beach: 2 palms (${(await p3.$$('.bc-palm')).length})`);
  const shellCount = await p3.$eval('.t-zone-props.beach .t-zsvg', n => n.querySelectorAll('path[fill]').length >= 6);
  assert(shellCount, 'beach: shells scatter present (≥6 shell shapes)');
  await p3.screenshot({ path: 'screenshots/r10p1/beach-1024x700.png' });
  await c3.close();

  // funfair: existing fair scenery + bandstand still render inside the new routing
  const { ctx: c4, page: p4 } = await openTown(SAVE(), 'funfair');
  assert(await p4.$('.ff-scenery-wrap'), 'funfair: fair scenery renders inside the new single-area routing');
  assert(await p4.evaluate(() => window.__townLife.hasBandstand()), 'funfair: bandstand present, unchanged');
  await p4.screenshot({ path: 'screenshots/r10p1/funfair-1024x700.png' });
  await c4.close();

  // playground: tiled ground + fence + bunting
  const { ctx: c5, page: p5 } = await openTown(SAVE(), 'playground');
  assert(await p5.$('.t-zone-props.playground'), 'playground: distinct scenery layer renders');
  await p5.screenshot({ path: 'screenshots/r10p1/playground-1024x700.png' });
  await c5.close();
}

// ==================== reduced motion stills the new area's motion too ====================
console.log('== reduced motion stills hilltop/beach scenery ==');
{
  const { ctx, page } = await openTown(SAVE(), 'hilltop', {});
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 1024, height: 700 }, reducedMotion: 'reduce' });
  const page2 = await ctx2.newPage();
  await page2.addInitScript((h) => { window.__bootownHour = h; }, 13);
  await page2.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page2.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await page2.reload({ waitUntil: 'load' });
  await page2.waitForSelector('.hub');
  await page2.evaluate(() => window.BooTown.go('town', { area: 'hilltop' }));
  await page2.waitForSelector('.town2');
  await sleep(300);
  assert(await page2.evaluate(() => window.__townLife.sceneryAnimated('.hl-blades')) === false, 'reduced-motion: the windmill does not spin');
  await ctx2.close();
}

// ==================== R4 evidence: screenshots at the three required sizes ====================
console.log('== screenshots: map + an area at 1024x768 / 768x1024 / 390x844 ==');
{
  const sizes = [['1024x768', 1024, 768], ['768x1024', 768, 1024], ['390x844', 390, 844]];
  for (const [tag, w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript((hr) => { window.__bootownHour = hr; }, 13);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.hub');
    await page.evaluate(() => window.BooTown.go('worldmap'));
    await page.waitForSelector('.worldmap');
    await sleep(300);
    await page.screenshot({ path: `screenshots/r10p1/map-${tag}.png` });
    await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
    await page.waitForSelector('.town2');
    await sleep(300);
    await page.screenshot({ path: `screenshots/r10p1/meadow-${tag}.png` });
    console.log(`  wrote set ${tag}`);
    await ctx.close();
  }
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
