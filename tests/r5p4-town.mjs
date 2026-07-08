// tests/r5p4-town.mjs — RUN5 phase 4 (C3): town spaciousness.
// Acceptance (RUN5 part D #5): zones measure 1.7 viewports; three depth rows placeable
// with correct scaling + draw order; the spacing rule prevents piling; old placements
// migrate proportionally; scroll, wander and activities evidenced across the new width.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 3, boo_plum: 2, deco_pond: 1 }, boxes: 0, meter: 0, opened: 4, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 60, byGame: {} },
  ledger: {}, town: [], settings: { sound: false, music: false, voice: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, zonesUnlocked: ['riverside'] }, trophies: { medal_stars_100: '2026-07-01' }, ageAsked: true, age: 8,
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true }
}, over);

const browser = await chromium.launch();
async function openTown(save, reduced = false) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.t-viewport');
  await page.waitForFunction(() => window.__town);
  await sleep(400);
  return { ctx, page };
}

// ==================== 1. zones measure 1.7 viewports ====================
console.log('== 1.7-viewport zones ==');
{
  const { ctx, page } = await openTown(SAVE());
  const g = await page.evaluate(() => window.__town.geometry());
  assert(Math.abs(g.ratio - 1.7) < 0.02, `each zone is 1.7 viewports wide (${g.ratio.toFixed(3)})`);
  assert(Math.abs(g.worldW - g.viewW * 1.7 * 5) < 2, `world spans 5 zones × 1.7 viewports (${Math.round(g.worldW)}px)`);
  await ctx.close();
}

// ==================== 2. three depth rows: scaling + draw order ====================
console.log('== three depth rows ==');
{
  // three Boos in the same zone, one per row (back/mid/front)
  const town = [
    { zone: 'meadow', x: 0.25, row: 0, item: 'boo_inky' },
    { zone: 'meadow', x: 0.50, row: 1, item: 'boo_plum' },
    { zone: 'meadow', x: 0.75, row: 2, item: 'boo_inky' }
  ];
  const { ctx, page } = await openTown(SAVE({ town }), true);   // reduced: static, stable sizes
  const rows = await page.evaluate(() => window.__town.itemsByRow().filter(r => !isNaN(r.row)).sort((a, b) => a.row - b.row));
  const back = rows.find(r => r.row === 0), mid = rows.find(r => r.row === 1), front = rows.find(r => r.row === 2);
  assert(back && mid && front, 'all three depth rows render items');
  assert(back.w < mid.w && mid.w < front.w, `items scale smaller toward the back (back ${Math.round(back.w)} < mid ${Math.round(mid.w)} < front ${Math.round(front.w)})`);
  assert(back.z < mid.z && mid.z < front.z, `front rows draw ABOVE back rows (z ${back.z} < ${mid.z} < ${front.z})`);
  assert(back.top < mid.top && mid.top < front.top, 'back row sits higher up the band, front row lower');
  await ctx.close();
}

// ==================== 3. spacing rule prevents piling ====================
console.log('== spacing rule ==');
{
  const { ctx, page } = await openTown(SAVE({ town: [{ zone: 'meadow', x: 0.4, row: 1, item: 'boo_inky' }] }));
  const before = await page.evaluate(() => window.BooTown.State.getState().town.length);
  const vp = await page.$('.t-viewport'); const box = await vp.boundingBox();
  // the existing Boo's actual on-screen centre (zones are 1.7 viewports wide)
  const itemC = await page.$eval('.t-item.boo', n => { const r = n.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  // enter place mode with a drawer item, then tap empty ground JUST beside it (within
  // the min-spacing radius, but not on the Boo itself, which the ground ignores)
  await page.click('.drawer-item');
  await page.mouse.click(itemC.cx + 62, itemC.cy);
  await sleep(200);
  const wobbled = await page.evaluate(() => document.querySelector('.town-drawer').classList.contains('taken'));
  const afterBlocked = await page.evaluate(() => window.BooTown.State.getState().town.length);
  assert(afterBlocked === before, `placing on an occupied spot is refused (count ${before} → ${afterBlocked})`);
  assert(wobbled, 'the drawer wobbles "that spot\'s taken"');
  // a clear spot well further along (still holding it) DOES place
  await sleep(700);
  await page.mouse.click(box.x + box.width * 0.92, itemC.cy);
  await sleep(200);
  const afterFree = await page.evaluate(() => window.BooTown.State.getState().town.length);
  assert(afterFree === before + 1, `a free spot places fine (count ${afterFree})`);
  await ctx.close();
}

// ==================== 4. old placements migrate (row + proportional x) ====================
console.log('== migration ==');
{
  // a version-3 save whose town items have NO row
  const OLD = SAVE({ version: 3, town: [
    { zone: 'meadow', x: 0.2, item: 'boo_inky' },
    { zone: 'meadow', x: 0.5, item: 'boo_plum' },
    { zone: 'meadow', x: 0.8, item: 'boo_inky' }
  ] });
  const { ctx, page } = await openTown(OLD);
  const migrated = await page.evaluate(() => window.BooTown.State.getState().town);
  assert(migrated.length === 3, 'nothing lost in migration (3 items)');
  assert(migrated.every(t => t.row != null && t.row >= 0 && t.row <= 2), 'every migrated item gained a depth row');
  assert(migrated.map(t => t.row).join(',') === '0,1,2', 'migrated items spread across the three rows (no piling)');
  assert(migrated[0].x === 0.2 && migrated[1].x === 0.5, 'x fractions preserved (spread proportionally into the wider zones)');
  await ctx.close();
}

// ==================== 5a. frame evidence: full-width scroll ====================
console.log('== scroll evidence ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 190, byGame: {} }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, zonesUnlocked: ['riverside', 'hilltop', 'beach'] }, trophies: { medal_stars_100: '2026-07-01', trophy_zones: '2026-07-01' } }));
  const max = await page.evaluate(() => window.__town.scrollMax());
  const frames = [];
  for (let i = 0; i <= 6; i++) {
    await page.evaluate((v) => { const t = document.querySelector('.t-viewport'); window.__town && 0; }, 0);
    await page.evaluate((sx) => { const d = document.querySelector('.t-ground'); /* drive via wheel to move scroll */ }, 0);
    // scroll via wheel steps
    await page.mouse.move(300, 300);
    await page.mouse.wheel(max / 6, 0);
    await sleep(200);
    frames.push(await page.evaluate(() => window.__town.scrollX()));
  }
  const rose = frames[frames.length - 1] > frames[0] + 100;
  const reachedEnd = frames[frames.length - 1] >= max - 5;
  assert(rose, `scroll advances across the full width (${Math.round(frames[0])} → ${Math.round(frames[frames.length - 1])} of ${Math.round(max)})`);
  assert(reachedEnd, 'the far edge of the world is reachable (last zone fully visible)');
  await ctx.close();
}

// ==================== 5b. frame evidence: a Boo wandering across depth rows ====================
console.log('== wander-across-depth evidence ==');
{
  const { ctx, page } = await openTown(SAVE({ town: [{ zone: 'meadow', x: 0.5, row: 1, item: 'boo_inky' }] }));
  assert(await page.evaluate(() => window.__town.actorCount()) >= 1, 'at least one wandering Boo');
  // drive it toward the FRONT depth, sample y over 6 frames / ~3s
  await page.evaluate(() => window.__town.drift(24));
  const front = [];
  for (let i = 0; i < 6; i++) { await sleep(520); front.push(await page.evaluate(() => window.__town.depthYs()[0])); }
  // then drive it toward the BACK depth
  await page.evaluate(() => window.__town.drift(-24));
  const back = [];
  for (let i = 0; i < 6; i++) { await sleep(520); back.push(await page.evaluate(() => window.__town.depthYs()[0])); }
  const frontMax = Math.max(...front), backMin = Math.min(...back);
  assert(front.length === 6 && back.length === 6, '12 frames over ~6.2s captured');
  assert(frontMax - backMin > 20, `the Boo visibly wanders between depth rows (front y ~${frontMax.toFixed(0)} vs back y ~${backMin.toFixed(0)}, Δ ${(frontMax - backMin).toFixed(0)}px)`);
  await ctx.close();
}

// ==================== 5c. placement into back and front rows ====================
console.log('== place into back + front rows ==');
{
  const { ctx, page } = await openTown(SAVE({ town: [] }));
  const vp = await page.$('.t-viewport'); const box = await vp.boundingBox();
  // place into the BACK row (high on the band)
  await page.click('.drawer-item');
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.67);
  await sleep(300);
  // place a second into the FRONT row (low on the band)
  await page.click('.drawer-item');
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.91);
  await sleep(300);
  const rows = await page.evaluate(() => window.BooTown.State.getState().town.map(t => t.row));
  assert(rows.includes(0), 'a drop high on the band lands in the BACK row');
  assert(rows.includes(2), 'a drop low on the band lands in the FRONT row');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
