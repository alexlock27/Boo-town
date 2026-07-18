// tests/r10p4-interiors.mjs — RUN10 P4: Interiors (the Boo House) + the Gallery.
// Acceptance: wall/floor row placement rules enforced both ways with the two lines; lamp
// glow frames at simulated 22:00; indoor NAP on bed frames; seeded 30-Boo save renders
// correct grouping, gold pedestals sparkle (fx frames), trophy wall matches state;
// tap-through returns correctly; the <6 state renders as specified.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p4', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot'].map(n => 'boo_' + n);
const AREAS_EMPTY = () => ({ meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } });
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const FURNITURE = ['deco_bed', 'deco_rug', 'deco_table', 'deco_sofa', 'deco_tablelamp', 'deco_wardrobe', 'deco_bathtub', 'deco_bookshelf'];

const SAVE = (areaKey, items, over = {}) => Object.assign({
  version: 6, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries([...BOOS.map(b => [b, 1]), ...FURNITURE.map(f => [f, 1])]),
  boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
  town: { areas: Object.assign(AREAS_EMPTY(), { [areaKey]: { items, paths: [] }, boohouse: areaKey === 'boohouse' ? { items, paths: [] } : { items: [], paths: [] } }) },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { funfairOpened: 'x', introSeen: {}, trophyRetro: true, townFirst: true, areasUnlocked: ['riverside', 'hilltop', 'beach', 'funfair'], boohouseSeeded: true },
  delights: { hideDay: TODAY, hideFound: true },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openArea(areaKey, items, { hour = 13, over = {}, w = 1024, h = 700 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((hr) => { window.__bootownHour = hr; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE(areaKey, items, over));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate((a) => window.BooTown.go('town', { area: a }), areaKey);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(300);
  return { ctx, page };
}

// ==================== interior scene: narrower room, wall + floor bands ====================
console.log('== Boo House: interior scene mode (room, not a wide outdoor area) ==');
{
  const { ctx, page } = await openArea('boohouse', []);
  const geo = await page.evaluate(() => window.__town.geometry());
  assert(Math.abs(geo.ratio - 1.5) < 0.01, `a room is 1.5 viewports wide, not 4 (ratio ${geo.ratio.toFixed(2)})`);
  const isInterior = await page.evaluate(() => window.__townLife.isInterior());
  assert(isInterior === true, 'town.js recognises the Boo House as an interior scene');
  const bands = await page.evaluate(() => ({ wall: !!document.querySelector('.t-interior-wall'), floor: !!document.querySelector('.t-interior-floor'), noSky: !document.querySelector('.t-skygrad') }));
  assert(bands.wall && bands.floor, 'a wall band + a floor band render (no outdoor sky/grass)');
  assert(bands.noSky, 'no outdoor sky gradient indoors');
  await page.screenshot({ path: 'screenshots/r10p4/boohouse-room-1024x700.png' });
  await ctx.close();
}

// ==================== Boo House starts with rug + lamp pre-placed ====================
console.log('== Boo House: starts with rug + lamp pre-placed (first-ever visit) ==');
{
  const ctx0 = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx0.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  // No boohouseSeeded flag this time — a genuine first-ever visit.
  const fresh = SAVE('boohouse', [], {});
  delete fresh.seen.boohouseSeeded;
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), fresh);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'boohouse' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(400);
  const floorItems = await page.evaluate(() => window.__townLife.floorItems());
  assert(floorItems.includes('deco_rug') && floorItems.includes('deco_tablelamp'), `rug + lamp are pre-placed (${floorItems.join(',')})`);
  await page.screenshot({ path: 'screenshots/r10p4/boohouse-starter-1024x700.png' });
  await ctx0.close();
}

// ==================== wall/floor placement rules, both directions ====================
// `forceHold` bypasses the drawer UI (deliberate — the Landscape tab is hidden indoors by
// design, so there's no chip to click there; the guard itself is what's under test).
console.log('== placement: outdoor-only refused indoors, indoor-only refused outdoors ==');
{
  // landscape refused indoors
  const { ctx, page } = await openArea('boohouse', []);
  await page.evaluate(() => { window.__townLife.forceHold('deco_palm'); window.__townLife.placeAt(0.5, 0.75); });
  await sleep(150);
  const placed = await page.evaluate(() => document.querySelectorAll('.t-item[data-item="deco_palm"]').length);
  assert(placed === 0, 'landscape (a palm) refuses to place indoors');
  const hint = await page.$eval('.town-hint-bar', n => n.textContent);
  assert(/belongs outside/i.test(hint), `the guide explains why ("${hint}")`);
  await ctx.close();
}
{
  // a ride (activity item) refused indoors
  const { ctx, page } = await openArea('boohouse', []);
  await page.evaluate(() => { window.__townLife.forceHold('deco_swings'); window.__townLife.placeAt(0.5, 0.75); });
  await sleep(150);
  const placed = await page.evaluate(() => document.querySelectorAll('.t-item[data-item="deco_swings"]').length);
  assert(placed === 0, 'a ride (swings) refuses to place indoors');
  const hint = await page.$eval('.town-hint-bar', n => n.textContent);
  assert(/belongs outside/i.test(hint), `the guide explains why ("${hint}")`);
  await ctx.close();
}
{
  // furniture refused outdoors (meadow)
  const { ctx, page } = await openArea('meadow', []);
  await page.evaluate(() => { window.__townLife.forceHold('deco_bed'); window.__townLife.placeAt(0.5, 0.75); });
  await sleep(150);
  const placed = await page.evaluate(() => document.querySelectorAll('.t-item[data-item="deco_bed"]').length);
  assert(placed === 0, 'furniture (a bed) refuses to place outdoors');
  const hint = await page.$eval('.town-hint-bar', n => n.textContent);
  assert(/roof/i.test(hint), `the guide explains why ("${hint}")`);
  await ctx.close();
}
{
  // furniture places fine indoors, and a wall item lands in the wall row
  const { ctx, page } = await openArea('boohouse', []);
  await page.evaluate(() => { window.__townLife.forceHold('deco_bed'); window.__townLife.placeAt(0.5, 0.8); });
  await sleep(150);
  const floorItems = await page.evaluate(() => window.__townLife.floorItems());
  assert(floorItems.includes('deco_bed'), `a bed places fine indoors (${floorItems.join(',')})`);
  // now a wall item (bookshelf)
  await page.evaluate(() => { window.__townLife.forceHold('deco_bookshelf'); window.__townLife.placeAt(0.7, 0.2); });
  await sleep(150);
  const wallItems = await page.evaluate(() => window.__townLife.wallItems());
  assert(wallItems.includes('deco_bookshelf'), `a bookshelf lands in the wall row (${wallItems.join(',')})`);
  await page.screenshot({ path: 'screenshots/r10p4/furniture-placed-1024x700.png' });
  await ctx.close();
}

// ==================== furniture organisation: dedicated tray + resize controls ====================
console.log('== Boo House: furniture tray and useful resize controls ==');
{
  const items = [{ zone: 'boohouse', x: 0.5, row: 1, item: 'deco_bed', scale: 1 }];
  const { ctx, page } = await openArea('boohouse', items);
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(150);
  const tabs = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('.bd-tabs .bd-tab')].map(tab => [
      tab.textContent.replace(/\s*\(\d+\)\s*$/, '').trim(),
      getComputedStyle(tab).display !== 'none'
    ])
  ));
  assert(tabs.Furniture === true, 'Furniture has its own visible tray indoors');
  assert(tabs.Landscape === false, 'outdoor Landscape tools stay hidden indoors');

  await page.click('.t-item[data-item="deco_bed"]');
  await page.waitForSelector('.plot-menu [aria-label="Make bigger"]');
  const before = await page.$eval('.t-item[data-item="deco_bed"]', n => n.getBoundingClientRect().width);
  await page.screenshot({ path: 'screenshots/r10p4/build-furniture-controls-1024x700.png' });
  await page.click('.plot-menu [aria-label="Make bigger"]');
  await sleep(550); // state.js deliberately debounces persistence by 400ms
  const resized = await page.evaluate(() => {
    const item = JSON.parse(localStorage.getItem('bootown.save.v1')).town.areas.boohouse.items.find(t => t.item === 'deco_bed');
    const width = document.querySelector('.t-item[data-item="deco_bed"]').getBoundingClientRect().width;
    return { scale: item.scale, width };
  });
  assert(resized.scale === 1.15, `the larger size is saved (${Math.round(resized.scale * 100)}%)`);
  assert(resized.width > before * 1.1, `the furniture visibly grows (${before.toFixed(1)}px → ${resized.width.toFixed(1)}px)`);
  await ctx.close();
}

// ==================== lamp glow: frames at simulated 22:00 vs day ====================
console.log('== table lamp: glows 21:00-07:00 ==');
{
  const items = [{ zone: 'boohouse', x: 0.4, row: 1, item: 'deco_tablelamp' }];
  const { ctx: dayCtx, page: dayPage } = await openArea('boohouse', items, { hour: 13 });
  const dayLit = await dayPage.evaluate(() => window.__townLife.lampLit());
  const dayOpacity = await dayPage.evaluate(() => window.__townLife.lampGlowOpacity());
  assert(dayLit === false, 'the lamp is not lit at 13:00');
  await dayCtx.close();
  const { ctx: nightCtx, page: nightPage } = await openArea('boohouse', items, { hour: 22 });
  const nightLit = await nightPage.evaluate(() => window.__townLife.lampLit());
  const nightOpacity = await nightPage.evaluate(() => window.__townLife.lampGlowOpacity());
  assert(nightLit === true, 'the lamp is lit at 22:00');
  assert(parseFloat(nightOpacity) > parseFloat(dayOpacity), `the glow is brighter at night (${dayOpacity} → ${nightOpacity})`);
  await nightPage.screenshot({ path: 'screenshots/r10p4/lamp-night-1024x700.png' });
  await nightCtx.close();
}

// ==================== indoor NAP targets a placed bed first ====================
console.log('== indoor NAP: a placed bed is the preferred nap spot ==');
{
  const items = [
    { zone: 'boohouse', x: 0.1, row: 2, item: 'deco_boohouse' },
    { zone: 'boohouse', x: 0.5, row: 1, item: 'deco_bed' },
    { zone: 'boohouse', x: 0.3, row: 1, item: BOOS[0] }
  ];
  const { ctx, page } = await openArea('boohouse', items, { hour: 22 });
  const kind = await page.evaluate(() => window.__townLife.force(0, 'nap'));
  assert(kind === 'nap', `the nap behaviour starts (${kind})`);
  const spot = await page.evaluate(() => window.__townLife.napSpotItem(0));
  assert(spot === 'deco_bed', `the bed is picked over the Boo House itself (${spot})`);
  // a real frame run: tick toward the bed and confirm the pose changes over time
  const frames = [];
  for (let k = 0; k < 8; k++) {
    await page.evaluate(() => window.__townLife.tick(280));
    frames.push(await page.evaluate(() => window.__townLife.transform(0)));
  }
  assert(distinct(frames) >= 3, `the nap approach + curl animates (${distinct(frames)}/8 distinct frames)`);
  await page.screenshot({ path: 'screenshots/r10p4/indoor-nap-1024x700.png' });
  await ctx.close();
}

// ==================== the Gallery: empty-ish state (<6 owned) ====================
console.log('== the Gallery: <6 owned renders the seed room ==');
{
  const ctx0 = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx0.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const save = SAVE('meadow', [], { inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1 } });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('gallerymuseum'));
  await page.waitForSelector('.gallerymuseum');
  await page.waitForFunction(() => window.__gallery, { timeout: 4000 });
  await sleep(200);
  const info = await page.evaluate(() => ({ empty: window.__gallery.emptyState(), owned: window.__gallery.ownedCount(), plinths: window.__gallery.plinthCount(), seeds: window.__gallery.seedCount(), hint: window.__gallery.hintText() }));
  assert(info.empty === true, 'the <6 state is detected');
  assert(info.plinths === 6, `6 plinths shown total (owned + silhouettes) (${info.plinths})`);
  assert(info.seeds === 3, `3 are soft "?" silhouettes (${info.seeds})`);
  assert(/spot in here/i.test(info.hint), `L_GALLERY_SEED shows ("${info.hint}")`);
  await page.screenshot({ path: 'screenshots/r10p4/gallery-seed-1024x700.png' });
  await ctx0.close();
}

// ==================== the Gallery: a real 30-Boo save ====================
console.log('== the Gallery: 30-Boo save — grouping, gold pedestals, trophy wall, tap-through ==');
{
  const ctx0 = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx0.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const boo30 = await page.evaluate(async () => {
    const cat = await import('./data/catalogue.js');
    return cat.CATALOGUE.filter(it => it.kind === 'boo').slice(0, 30).map(it => it.id);
  });
  assert(boo30.length === 30, `30 real Boo ids collected from the catalogue (${boo30.length})`);
  const inv = Object.fromEntries(boo30.map(id => [id, 1]));
  inv.deco_pond = 1; inv.deco_bed = 1;   // a couple of non-boo collectibles too
  const shinies = { [boo30[0]]: 1, [boo30[1]]: 1 };
  const trophies = { medal_stars_100: '2026-01-01', trophy_zones: '2026-01-02' };
  const save = SAVE('meadow', [], { inventory: inv, shinies, trophies });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('gallerymuseum'));
  await page.waitForSelector('.gallerymuseum');
  await page.waitForFunction(() => window.__gallery, { timeout: 4000 });
  await sleep(300);

  const info = await page.evaluate(() => ({
    empty: window.__gallery.emptyState(),
    owned: window.__gallery.ownedCount(),
    plinths: window.__gallery.plinthCount(),
    wings: window.__gallery.wingCounts(),
    labels: window.__gallery.wingLabels(),
    gold: window.__gallery.goldCount(),
    trophies: window.__gallery.trophyCount()
  }));
  assert(info.empty === false, 'the real save is NOT the seed state');
  assert(info.owned === 32, `32 collectibles owned (30 Boos + pond + bed) (${info.owned})`);
  assert(info.plinths === 32, `every owned collectible gets a plinth (${info.plinths})`);
  const wingSum = info.wings.reduce((a, b) => a + b, 0);
  assert(wingSum === 32, `wings sum to every owned collectible (${wingSum} across ${info.wings.length} wings)`);
  assert(info.labels.includes('Decorations & Keepsakes'), `a decorations wing groups the pond + bed (${info.labels.join(', ')})`);
  assert(info.gold === 2, `2 shiny copies stand on gold pedestals (${info.gold})`);
  assert(info.trophies === 2, `the trophy wall matches state: 2 earned trophies (${info.trophies})`);

  // gold pedestal fx really animates (not just tagged)
  const goldAnimated = await page.evaluate((id) => window.__gallery.goldFxAnimated(id), boo30[0]);
  assert(goldAnimated, 'the gold pedestal\'s rarity fx is actually animating (frame proof)');

  // tap-through: tap a figure, land on its collection card, back returns to the Gallery
  await page.evaluate((id) => window.__gallery.tap(id), boo30[5]);
  await page.waitForSelector('.collection', { timeout: 4000 });
  await sleep(150);   // showItem() opens on a 50ms setTimeout after mount
  const dialogShown = await page.evaluate(() => !!document.querySelector('.dialog, .overlay'));
  assert(dialogShown, 'tapping a figure opens straight to its own card');
  await page.click('.dialog-btns button:has-text("Close")');   // dismiss the card first
  await page.click('.coll-header .back-btn');
  await page.waitForSelector('.gallerymuseum', { timeout: 4000 });
  assert(true, 'the back control returns to the Gallery');

  await page.screenshot({ path: 'screenshots/r10p4/gallery-full-1024x700.png' });
  await ctx0.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
