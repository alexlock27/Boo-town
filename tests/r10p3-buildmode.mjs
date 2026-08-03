// tests/r10p3-buildmode.mjs — RUN10 P3's paths/landscape/fishing, RE-POINTED BY RUN21C.
//
// There is no build MODE any more and no hammer to enter one (RUN21C item 1). What this
// suite pins now is the contract that replaced it:
//   · the world SOFTENS — actors freeze, .building goes on the root — whenever the drawer is
//     open or something is held on her finger, and wakes when it is not. `toggleBuild()`
//     survives as a QA alias that opens/shuts the tray, which is what it always meant.
//   · painting is the PATH POT, a permanent first chip in Landscape (item 2). Lifting it
//     shows the grid and the style row; there is no tool row and no Erase tool — scrubbing
//     (same style over the same cell) is the eraser it always really was.
//   · adjacent same-style cells render as ONE stroke, not as tiles (item 3), so the node
//     count is per STROKE while `paths()` stays per CELL and the data shape is unchanged.
// Everything else here — the z-order pixel test, the 300-cell cap, landscape being outdoor
// only and never dropping from a box, the fishing state machine — is unchanged.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p3', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot'].map(n => 'boo_' + n);
const AREAS_EMPTY = () => ({ meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } });
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
// RUN21A item 15: the ghost `place` tool is gone and the Landscape/Wishes tabs no longer
// hide behind the hammer, so this suite now needs saves with a wish unlocked and a way to
// drive a real chip-lift drag in PLAY mode. Both seams live here.
const SAVE = (areaKey, items, over = {}) => Object.assign({
  version: 6, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  // landscape items are NOT inventory-backed (RUN10 P3: always-available Build toybox,
  // town.js injects them into the drawer directly) — a real fresh save's inventory holds
  // only what she's actually won
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])), boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
  town: { areas: Object.assign(AREAS_EMPTY(), { [areaKey]: { items, paths: [] } }) },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { funfairOpened: 'x', introSeen: {}, trophyRetro: true, townFirst: true, areasUnlocked: ['riverside', 'hilltop', 'beach', 'funfair'] },
  delights: { hideDay: TODAY, hideFound: true },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openArea(areaKey, items, { hour = 13, reduced = 'no-preference', w = 1024, h = 700, over = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced });
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

// A real chip-lift drag, driven with the pointer (RUN21A item 15 ACCEPT: "both place by
// drag" with the hammer OFF). Mechanics, all from js/town.js:
//   · the drawer strip decides scroll-vs-lift by gesture DIRECTION (RUN10 P2), so the first
//     move past the 10px threshold has to be clearly vertical or it reads as a strip scroll;
//   · the lifted ghost floats LIFT=70px ABOVE the fingertip and endChipLift drops at
//     (pointerY - 70) — so aim the finger 70px BELOW where the item should land.
const LIFT = 70;
async function openDrawerTab(page, label) {
  const clicked = await page.evaluate((lbl) => {
    const tab = [...document.querySelectorAll('.bd-tabs .bd-tab')].find(el => el.textContent.includes(lbl));
    if (!tab || getComputedStyle(tab).display === 'none') return false;
    tab.click();   // createDrawer's own handler opens the drawer too when it is collapsed
    return true;
  }, label);
  await sleep(250);
  return clicked;
}
async function dragChipToGround(page, itemId, xFrac = 0.5, yFrac = 0.62) {
  const sel = `.bd-panel:not([hidden]) .drawer-item[data-item="${itemId}"]`;
  await page.waitForSelector(sel, { timeout: 4000 });
  await page.$eval(sel, n => n.scrollIntoView({ block: 'nearest', inline: 'center' }));
  await sleep(120);
  const cbox = await (await page.$(sel)).boundingBox();
  const vp = await page.$eval('.t-viewport', n => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const winH = await page.evaluate(() => window.innerHeight);
  const sx = cbox.x + cbox.width / 2, sy = cbox.y + cbox.height / 2;
  const px = vp.x + vp.w * xFrac;
  const py = Math.min(vp.y + vp.h * yFrac + LIFT, winH - 6);   // finger; ghost lands 70px higher
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, sy - 40, { steps: 3 });    // vertical → the strip reads this as a LIFT
  await page.mouse.move(px, py, { steps: 6 });
  await sleep(80);
  const lifted = await page.evaluate(() => !!document.querySelector('.drag-ghost'));
  await page.mouse.up();
  await sleep(250);
  return lifted;
}
// RUN21C-2: painting starts by picking the Path Pot up out of the Landscape tab. Every
// block below that used to say `toggleBuild(); setBuildTool('paths')` says this instead.
async function liftPathPot(page) {
  await page.evaluate(() => window.__townLife.toggleBuild());   // open the tray
  await sleep(300);
  const ok = await page.evaluate(() => { const p = document.querySelector('.drawer-item.path-pot'); if (!p) return false; p.click(); return true; });
  await sleep(350);
  return ok && await page.evaluate(() => window.__townLife.potHeld());
}
const tabDisplay = (page, label) => page.evaluate((lbl) => {
  const tab = [...document.querySelectorAll('.bd-tabs .bd-tab')].find(el => el.textContent.includes(lbl));
  return tab ? getComputedStyle(tab).display : 'missing';
}, label);

// ==================== toggle freeze/resume ====================
console.log('== the softened world: living behaviours freeze, then resume ==');
{
  const items = [
    { zone: 'meadow', x: 0.05, row: 2, item: 'deco_swings' },
    { zone: 'meadow', x: 0.06, row: 1, item: BOOS[0] },
    { zone: 'meadow', x: 0.30, row: 1, item: BOOS[1] }
  ];
  const { ctx, page } = await openArea('meadow', items);
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(400);
  const before = [];
  for (let k = 0; k < 5; k++) { before.push(await page.evaluate(() => [...document.querySelectorAll('.t-item.boo svg')].map(s => s.style.transform).join('|'))); await sleep(250); }
  assert(distinct(before) >= 2, `motion happens while she is playing (${distinct(before)}/5 distinct frames)`);
  // RUN21C-1 re-point: no hammer exists to press. Opening the DRAWER is the softening.
  assert(await page.$('.town-hammer-btn') === null, 'there is no hammer button anywhere');
  await page.evaluate(() => document.querySelector('.bd-collapsed').click());
  await sleep(400);
  const buildingClass = await page.evaluate(() => document.querySelector('.town2').classList.contains('building'));
  assert(buildingClass, 'root gains .building when the drawer opens');
  assert(await page.evaluate(() => window.__townLife.softened()) === true, 'and the world reports itself softened');
  const frozen = [];
  for (let k = 0; k < 5; k++) { frozen.push(await page.evaluate(() => [...document.querySelectorAll('.t-item.boo svg')].map(s => s.style.transform).join('|'))); await sleep(250); }
  assert(distinct(frozen) === 1, `frozen while she is arranging (${distinct(frozen)}/5 distinct frames)`);
  await page.evaluate(() => document.querySelector('.bd-collapsed').click());
  await sleep(400);
  const resumedNotBuilding = await page.evaluate(() => !document.querySelector('.town2').classList.contains('building'));
  assert(resumedNotBuilding, 'root loses .building when the drawer shuts');
  const after = [];
  for (let k = 0; k < 6; k++) { after.push(await page.evaluate(() => [...document.querySelectorAll('.t-item.boo svg')].map(s => s.style.transform).join('|'))); await sleep(250); }
  assert(distinct(after) >= 2, `motion resumes within a second (${distinct(after)}/6 distinct frames)`);
  // ...and the OTHER softener: something held on her finger, with the drawer shut.
  await page.evaluate(() => window.__townLife.forceHold('deco_bench'));
  await sleep(200);
  assert(await page.evaluate(() => window.__townLife.softened()) === true, 'holding a chip softens the world too, with the drawer shut');
  await page.evaluate(() => window.__townLife.placeAt(0.12, 0.8));
  await sleep(300);
  assert(await page.evaluate(() => window.__townLife.softened()) === false, 'and putting it down hands the world back');
  await page.screenshot({ path: 'screenshots/r10p3/build-toggle-1024x700.png' });
  await ctx.close();
}

// ==================== grid overlay only in build ====================
// RUN21C-2 re-point: the paint grid belongs to the BRUSH, not to a mode. It appears when
// the Path Pot is in her hand and goes when she puts it down — a 5% grid over the whole
// world every time the tray opened would be noise, since the tray is now how she places
// everything.
console.log('== grid overlay: hidden until the Path Pot is held, gone when it is put away ==');
{
  const { ctx, page } = await openArea('meadow', []);
  const opBefore = await page.evaluate(() => window.__townLife.gridOpacity());
  assert(parseFloat(opBefore) === 0, `grid hidden while she is playing (opacity ${opBefore})`);
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(350);
  const opTrayOnly = await page.evaluate(() => window.__townLife.gridOpacity());
  assert(parseFloat(opTrayOnly) === 0, `an open tray alone does NOT show the paint grid (opacity ${opTrayOnly})`);
  assert(await page.evaluate(() => { document.querySelector('.drawer-item.path-pot').click(); return true; }), 'the Path Pot is there to pick up');
  await sleep(350);
  const opDuring = await page.evaluate(() => window.__townLife.gridOpacity());
  assert(parseFloat(opDuring) === 1, `grid visible while the Pot is held (opacity ${opDuring})`);
  await page.evaluate(() => document.querySelector('.drawer-item.path-pot').click());
  await sleep(350);
  const opAfter = await page.evaluate(() => window.__townLife.gridOpacity());
  assert(parseFloat(opAfter) === 0, `grid hidden again once the Pot is away (opacity ${opAfter})`);
  await ctx.close();
}

// ==================== painted paths persist across reload + never overdraw items ====================
console.log('== painted paths: persist across reload, z-order below items ==');
{
  const items = [{ zone: 'meadow', x: 0.05, row: 1, item: 'deco_bench' }];
  const { ctx, page } = await openArea('meadow', items);
  assert(await liftPathPot(page), 'the Path Pot lifts out of the Landscape tab');
  await page.evaluate(() => window.__townLife.setPathStyle('stone'));
  await page.evaluate(() => { window.__townLife.paintCellAt(2, 2); window.__townLife.paintCellAt(3, 2); window.__townLife.paintCellAt(4, 2); });
  const painted = await page.evaluate(() => window.__townLife.paths());
  assert(painted.length === 3, `three cells painted (${painted.length})`);
  await page.evaluate(() => window.__townLife.commitPathsNow());
  // z-order: a painted cell's z-index must sit below the bench's inline z-index
  const zOrder = await page.evaluate(() => ({ path: window.__townLife.pathCellZ(), item: window.__townLife.itemZ('.t-item[data-item="deco_bench"]') }));
  assert(zOrder.path != null && zOrder.item != null && +zOrder.path < +zOrder.item, `path cell (z${zOrder.path}) renders below the item (z${zOrder.item})`);
  await page.screenshot({ path: 'screenshots/r10p3/paths-painted-1024x700.png' });
  // reload: paths must survive (state was committed, not just held in memory)
  await page.evaluate(() => document.querySelector('.drawer-item.path-pot').click());   // putting the Pot away commits too
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(300);
  const afterReload = await page.evaluate(() => window.__townLife.paths());
  assert(afterReload.length === 3 && afterReload.every(c => c.style === 'stone'), `paths survive a reload (${JSON.stringify(afterReload)})`);
  const cellCount = await page.evaluate(() => window.__townLife.pathCellCount());
  assert(cellCount === 3, `3 path cells survive in the save after reload (${cellCount})`);
  // RUN21C-3 re-point: three ADJACENT same-style cells are no longer three tiles. They are
  // ONE stroke — that is the whole item — so the node count is 1 while the cell count is 3.
  const runs = await page.evaluate(() => window.__townLife.pathRunBoxes());
  const rows = runs.filter(r => r.row != null);
  assert(rows.length === 1, `and they draw as ONE continuous stroke, not three tiles (${rows.length} nodes)`);
  const geom = await page.evaluate(() => window.__townLife.cellGeom());
  assert(rows[0].w > geom.cellW * 2.5, `the stroke spans all three cells (${rows[0].w}px vs ${Math.round(geom.cellW)}px per cell)`);
  assert(Math.abs(parseFloat(rows[0].radius) - geom.cellH * 0.45) < 1.5, 'with end caps rounded at 45% of cell height');
  await ctx.close();
}

// ==================== toggle-erase + Erase tool ====================
// RUN21C-1/2 re-point: the Erase TOOL is deleted. Scrubbing — painting the same style over
// a cell that already has it — is the eraser, and always was; it is the whole reason a
// separate tool could go. Its two siblings (a different style REPLACES; a fresh cell paints)
// are unchanged, and are pinned here as tightly as before.
console.log('== scrubbing is the eraser: paint / repaint / scrub, with no Erase tool ==');
{
  const { ctx, page } = await openArea('meadow', []);
  assert(await liftPathPot(page), 'the Path Pot lifts');
  await page.evaluate(() => window.__townLife.setPathStyle('sand'));
  await page.evaluate(() => window.__townLife.paintCellAt(5, 5));
  let list = await page.evaluate(() => window.__townLife.paths());
  assert(list.length === 1 && list[0].style === 'sand', 'a fresh cell is painted sand');
  // same cell, same style again → erases (toggle)
  await page.evaluate(() => window.__townLife.paintCellAt(5, 5));
  list = await page.evaluate(() => window.__townLife.paths());
  assert(list.length === 0, 'painting the same cell with the same style erases it (toggle)');
  // same cell, different style → replaces (not a toggle-erase)
  await page.evaluate(() => { window.__townLife.setPathStyle('stone'); window.__townLife.paintCellAt(5, 5); window.__townLife.setPathStyle('flower'); window.__townLife.paintCellAt(5, 5); });
  list = await page.evaluate(() => window.__townLife.paths());
  assert(list.length === 1 && list[0].style === 'flower', `a different style replaces rather than erasing (${JSON.stringify(list)})`);
  // ...and scrubbing clears it, whatever style it happens to be wearing: pick that style up
  // and paint over it. This is what the Erase tool used to do, in one fewer control.
  await page.evaluate(() => { window.__townLife.setPathStyle('flower'); window.__townLife.paintCellAt(5, 5); });
  list = await page.evaluate(() => window.__townLife.paths());
  assert(list.length === 0, 'scrubbing clears the cell — the Erase tool is not needed and no longer exists');
  assert(await page.evaluate(() => !document.querySelector('.t-tool-row') && !window.__townLife.buildTool), 'and neither the tool row nor a buildTool hook survives');
  await ctx.close();
}

// ==================== path cap (300 cells/area) ====================
console.log('== path cap: 300 cells/area, L_PATH_FULL on the 301st ==');
{
  const { ctx, page } = await openArea('meadow', []);
  assert(await liftPathPot(page), 'the Path Pot lifts');
  await page.evaluate(() => window.__townLife.setPathStyle('stone'));
  const result = await page.evaluate(() => {
    // 15 rows x 20 columns = exactly 300 distinct, never-before-painted cells
    for (let y = 0; y < 15; y++) for (let x = 0; x < 20; x++) window.__townLife.paintCellAt(x, y);
    const before = window.__townLife.paths().length;
    window.__townLife.paintCellAt(0, 15);   // a genuinely new cell, past the cap
    window.__townLife.paintCellAt(1, 15);
    const after = window.__townLife.paths().length;
    return { before, after };
  });
  assert(result.before === 300, `300 cells painted before the cap (${result.before})`);
  const hint = await page.$eval('.town-hint-bar', n => n.textContent);
  assert(/LOT of path/i.test(hint), `the cap shows L_PATH_FULL ("${hint}")`);
  assert(result.after === 300, `the 301st cell is refused, count holds at ${result.after}`);
  await ctx.close();
}

// ==================== landscape: outdoor-only placement ====================
console.log('== landscape items: outdoor areas only ==');
{
  // RUN10 P4 tightened this further: the Landscape tab itself is hidden in any interior
  // area (not just outside build mode), so there's no drawer chip to reach here at all —
  // exercise the underlying guard directly via the forceHold QA hook instead (P4 does the
  // same; see tests/r10p4-interiors.mjs), and additionally prove the tab really is hidden.
  const { ctx, page } = await openArea('boohouse', []);
  // RUN21A item 15 dropped the `buildMode &&` conjunct from the landscape gate, so the tab
  // is now purely a KIND question — which means indoors it must be hidden in BOTH modes.
  assert(await tabDisplay(page, 'Landscape') === 'none', 'the Landscape tab is hidden indoors with the tray shut');
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(200);
  const tabHiddenIndoors = await tabDisplay(page, 'Landscape') === 'none';
  assert(tabHiddenIndoors, 'the Landscape tab is hidden indoors with the tray open too');
  // RUN21C-2: and there is no Path Pot indoors either — the Pot lives with its tab.
  assert(await page.$('.drawer-item.path-pot') === null, 'and no Path Pot indoors, since paths are an outdoor thing');
  await page.evaluate(() => { window.__townLife.forceHold('deco_palm'); window.__townLife.placeAt(0.5, 0.75); });
  await sleep(150);
  const placedIndoors = await page.evaluate(() => document.querySelectorAll('.t-item[data-item^="deco_palm"], .t-item[data-item^="deco_oak"], .t-item[data-item^="deco_pine"], .t-item[data-item^="deco_bush"], .t-item[data-item^="deco_rock"], .t-item[data-item^="deco_flowerbed"]').length);
  assert(placedIndoors === 0, 'a landscape item refuses to place indoors');
  const hint = await page.$eval('.town-hint-bar', n => n.textContent);
  // RUN10 P4 generalised the line to cover both landscape and rides refusing indoors
  assert(/belongs outside/i.test(hint), `the guide explains why ("${hint}")`);
  await ctx.close();
}
{
  const { ctx, page } = await openArea('meadow', []);
  await page.evaluate(() => window.__townLife.toggleBuild());
  await page.click('.bd-collapsed');
  await page.evaluate(() => {
    [...document.querySelectorAll('.bd-tabs .bd-tab')].find(el => el.textContent.includes('Landscape'))?.click();
  });
  await page.$eval('.bd-panel:not([hidden]) .drawer-item[data-item="deco_palm"]', n => n.click());
  assert(/nearest free spot/i.test(await page.$eval('.town-hint-bar', n => n.textContent)), 'choosing the Palm puts Town into clear placement mode');
  await page.evaluate(() => window.__townLife.placeAt(.5, .75));
  await sleep(150);
  const placedOutdoors = await page.evaluate(() => document.querySelectorAll('.t-item[data-item^="deco_palm"], .t-item[data-item^="deco_oak"], .t-item[data-item^="deco_pine"], .t-item[data-item^="deco_bush"], .t-item[data-item^="deco_rock"], .t-item[data-item^="deco_flowerbed"]').length);
  assert(placedOutdoors === 1, `a landscape item places fine outdoors (${placedOutdoors})`);
  // RUN21A item 15 moved this pin off the hammer; RUN21C-1 removed the hammer entirely. The
  // Landscape tab is purely a KIND question now, and stays put whatever the tray is doing.
  // `toggleBuild()` is a TOGGLE of the tray, and selectHold already shut it when she picked
  // the Palm up — so shut it only if it is actually open, then check the world woke.
  await page.evaluate(() => { if (window.__townLife.softened()) window.__townLife.toggleBuild(); });
  await sleep(300);
  const notBuilding = await page.evaluate(() => !document.querySelector('.town2').classList.contains('building'));
  assert(notBuilding, 'the tray is shut again and the world has woken up');
  assert(await tabDisplay(page, 'Landscape') !== 'none', 'the Landscape tab STAYS visible outdoors with the tray shut');
  await page.screenshot({ path: 'screenshots/r10p3/landscape-1024x700.png' });
  await ctx.close();
}

// ==================== RUN21C items 1 + 2: the tool row is GONE, the Path Pot replaced it =====
// RUN21A item 15 pinned the row's exact membership (Paths + Erase) as the guard against the
// dead `place` tool creeping back. RUN21C item 1 deletes the row itself and item 2 puts the
// Pot in its place, so the guard moves with it: nothing that used to be chrome on the right
// edge of the world may come back, and the one control that survived — the style row — is
// tied to the Pot actually being in her hand.
console.log('== the Path Pot replaced the tool row (RUN21C items 1 + 2) ==');
{
  const { ctx, page } = await openArea('meadow', []);
  assert(await page.$('.t-tool-row') === null, 'no tool row survives anywhere in the world');
  assert(await page.$('.town-hammer-btn') === null, 'and no hammer button');
  assert(await page.evaluate(() => typeof window.__townLife.buildTool) === 'undefined', 'no buildTool state survives');
  const rowHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.t-path-style-row')).display === 'none');
  assert(rowHidden, 'the style row is out of the way until she picks the Pot up');
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(300);
  const potChip = await page.evaluate(() => {
    const strip = [...document.querySelectorAll('.town-drawer-strip')].find(x => x.querySelector('.path-pot'));
    if (!strip) return null;
    return { first: strip.firstElementChild.classList.contains('path-pot'), svg: !!strip.querySelector('.path-pot .pot-svg') };
  });
  assert(potChip && potChip.first, 'the Path Pot is the FIRST chip in Landscape');
  assert(potChip && potChip.svg, 'and it is house-style SVG art, not an emoji');
  await page.evaluate(() => document.querySelector('.drawer-item.path-pot').click());
  await sleep(350);
  assert(await page.evaluate(() => window.__townLife.potHeld()) === true, 'tapping it puts it in her hand');
  const docked = await page.evaluate(() => {
    const r = document.querySelector('.t-path-style-row').getBoundingClientRect();
    const d = document.querySelector('.boo-drawer').getBoundingClientRect();
    return { shown: getComputedStyle(document.querySelector('.t-path-style-row')).display !== 'none', above: r.bottom <= d.top + 2, n: document.querySelectorAll('.t-style-btn').length };
  });
  assert(docked.shown && docked.above, 'the style row docks above the drawer while it is held');
  assert(docked.n === 6, `and shows all six styles — three free, three from the shop (${docked.n})`);
  assert(await page.$eval('.town-hint-bar', n => n.textContent) === 'Drag along the ground to lay a path — paint over it to sweep it away.',
    'with the authored hint, exactly');
  await page.evaluate(() => document.querySelector('.drawer-item.path-pot').click());
  await sleep(300);
  assert(await page.evaluate(() => getComputedStyle(document.querySelector('.t-path-style-row')).display === 'none'), 'and it all goes away when she puts the Pot down');
  await ctx.close();
}

// ==================== RUN21A item 15: Landscape + Wishes place by DRAG with the hammer off ====================
console.log('== no mode at all: Landscape and Wishes tabs are reachable and place by drag ==');
{
  // one unlocked wish → the Wishes tab must show; wish_tree is a plain ground wish (not one
  // of the sky items, not a LIVING_WISHES flyer), so it lands as a normal .t-item.
  const { ctx, page } = await openArea('meadow', [], { over: { wishes: { unlocked: { tree: true } } } });
  assert(await page.evaluate(() => !document.querySelector('.town2').classList.contains('building')), 'the world starts awake — nothing open, nothing held');
  assert(await tabDisplay(page, 'Landscape') !== 'none', 'the Landscape tab is visible outdoors');
  assert(await tabDisplay(page, 'Wishes') !== 'none', 'the Wishes tab is visible when a wish is unlocked');
  // Landscape chip → dragged onto the ground, hammer still off
  assert(await openDrawerTab(page, 'Landscape'), 'the Landscape tab opens in play mode');
  const liftedPalm = await dragChipToGround(page, 'deco_palm', 0.42);
  assert(liftedPalm, 'dragging the Palm chip upward lifts a ghost (not a strip scroll)');
  const palms = await page.evaluate(() => document.querySelectorAll('.t-item[data-item="deco_palm"]').length);
  assert(palms === 1, `the Palm places by drag with the hammer off (${palms} placed)`);
  // Wish chip → same gesture, same result
  assert(await openDrawerTab(page, 'Wishes'), 'the Wishes tab opens in play mode');
  const liftedWish = await dragChipToGround(page, 'wish_tree', 0.72);
  assert(liftedWish, 'dragging the Tree wish chip upward lifts a ghost');
  const wishes = await page.evaluate(() => document.querySelectorAll('.t-item[data-item="wish_tree"]').length);
  assert(wishes === 1, `the Tree wish places by drag with the hammer off (${wishes} placed)`);
  // RUN21C-1 re-point: there is no hammer to have avoided. What this proves now is that both
  // placements happened with nothing but the TRAY open — no mode was entered — and that the
  // moment the tray shuts the world is awake again.
  await page.evaluate(() => document.querySelector('.bd-collapsed').click());
  await sleep(400);
  const stillPlay = await page.evaluate(() => !document.querySelector('.town2').classList.contains('building'));
  assert(stillPlay, 'both placements happened with only the tray open, and the world wakes when it shuts');
  const saved = await page.evaluate(() => window.BooTown.State.getState().town.areas.meadow.items.map(i => i.item));
  assert(saved.filter(i => i === 'deco_palm').length === 1 && saved.filter(i => i === 'wish_tree').length === 1,
    `both drops are committed to the save (${JSON.stringify(saved)})`);
  await page.screenshot({ path: 'screenshots/r10p3/playmode-drag-1024x700.png' });
  await ctx.close();
}
{
  // the other half of the wishes gate: no unlocked wish, no tab — the gate lost its
  // build-mode conjunct (item 15) but kept its "any unlocked wish" test.
  const { ctx, page } = await openArea('meadow', []);
  assert(await tabDisplay(page, 'Wishes') === 'none', 'the Wishes tab is hidden when no wish is unlocked');
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(250);
  assert(await tabDisplay(page, 'Wishes') === 'none', 'and stays hidden with the tray open too');
  await ctx.close();
}

// ==================== landscape excluded from 500 simulated box rolls ====================
console.log('== landscape items never drop from a box (500 simulated rolls) ==');
{
  const { ctx, page } = await openArea('meadow', []);
  const seen = await page.evaluate(async () => {
    const rw = await import('./js/rewards.js'); const st = await import('./js/state.js');
    const inv = Object.fromEntries(['boo_inky', 'boo_plum', 'boo_pippin'].map(b => [b, 1]));
    localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 6, name: 'A', guide: { species: 'giraffe', body: 'sunshine', pattern: 'none', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: inv, boxes: 500, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: { areas: {} }, stars: { total: 0, byGame: {} }, settings: {}, seen: { introSeen: {} } }));
    st.load();
    const seenIds = new Set();
    for (let i = 0; i < 500; i++) { const r = rw.openOneBox(); if (r) seenIds.add(r.item.id); }
    return [...seenIds];
  });
  const LANDSCAPE = ['deco_palm', 'deco_oak', 'deco_pine', 'deco_bush', 'deco_rock', 'deco_flowerbed'];
  const leaked = seen.filter(id => LANDSCAPE.includes(id));
  assert(leaked.length === 0, `no landscape item dropped in 500 rolls (leaked: ${leaked.join(',') || 'none'})`);
  await ctx.close();
}

// ==================== FISH: full frame run, both outcomes forced ====================
console.log('== pond fishing: full state-machine run, catch and comedy-boot outcomes ==');
{
  const items = [
    { zone: 'meadow', x: 0.05, row: 2, item: 'deco_pond' },
    { zone: 'meadow', x: 0.06, row: 1, item: BOOS[0] }
  ];
  const { ctx, page } = await openArea('meadow', items);
  // rod/drip fx are cleaned up the moment the role clears, so sample them DURING the run,
  // not after — holdMs is forced tiny (80ms) but the outcome animation itself still plays
  // out in full (FISH_CATCH_MS / FISH_BOOT_MS), a real run of the whole state machine.
  const catchRun = await page.evaluate(async () => {
    window.__townLife.forceFish(0, 'catch', 80);
    const rod = !!document.querySelector('.t-rod');
    const frames = [];
    for (let i = 0; i < 50; i++) { frames.push(document.querySelector('.t-item.boo svg').style.transform); await new Promise(r => setTimeout(r, 60)); }
    return { rod, frames };
  });
  assert(catchRun.rod, 'a rod+bobber sprite appears while fishing');
  assert(distinct(catchRun.frames) >= 4, `the catch run animates (${distinct(catchRun.frames)} distinct frames)`);
  // Poll for the role to clear rather than assume a fixed frame budget — real elapsed
  // animation time depends on requestAnimationFrame cadence, not wall-clock alone, and
  // this suite runs after several other test blocks that leave the tab under some load.
  const waitForClear = async () => {
    // 24s ceiling: under a 4-lane parallel board rAF cadence in a background tab can slow
    // several-fold, and the catch choreography is rAF-paced. Serial runs clear in ~2s.
    for (let i = 0; i < 120; i++) { if (await page.evaluate(() => window.__townLife.goalOf(0)) !== 'role:fish') return true; await sleep(200); }
    return false;
  };
  assert(await waitForClear(), 'the role clears once the catch finishes');
  await page.screenshot({ path: 'screenshots/r10p3/fish-catch-1024x700.png' });

  // comedy boot: force the second outcome and confirm the drip fx + trombone-shape frames play
  await page.evaluate(() => window.__townLife.assignRoles());
  const bootRun = await page.evaluate(async () => {
    window.__townLife.forceFish(0, 'boot', 80);
    const frames = []; let drips = 0;
    for (let i = 0; i < 55; i++) { frames.push(document.querySelector('.t-item.boo svg').style.transform); drips = Math.max(drips, window.__townLife.dripCount()); await new Promise(r => setTimeout(r, 60)); }
    return { frames, drips };
  });
  assert(distinct(bootRun.frames) >= 4, `the comedy-boot run animates (${distinct(bootRun.frames)} distinct frames)`);
  assert(bootRun.drips >= 1, `drips appear on the comedy boot (${bootRun.drips} seen mid-run)`);
  assert(await waitForClear(), 'the role clears once the boot finishes');
  await page.screenshot({ path: 'screenshots/r10p3/fish-boot-1024x700.png' });
  await ctx.close();
}

// ==================== tap the pond anytime: 3 ripple rings, 900ms ====================
console.log('== tap the pond: 3 ripple rings, ~900ms ==');
{
  const items = [{ zone: 'meadow', x: 0.05, row: 2, item: 'deco_pond' }];
  const { ctx, page } = await openArea('meadow', items);
  const box = await page.$eval('.t-item[data-item="deco_pond"]', n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(box.x, box.y);
  await sleep(50);
  const ringsAtStart = await page.evaluate(() => window.__townLife.rippleCount());
  assert(ringsAtStart === 3, `three ripple rings spawn on tap (${ringsAtStart})`);
  await sleep(1450);   // last ring: 900ms life + 300ms stagger (2*150ms) + 60ms buffer
  const ringsAfter = await page.evaluate(() => window.__townLife.rippleCount());
  assert(ringsAfter === 0, `all rings are gone after ~900ms+stagger (${ringsAfter} left)`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
