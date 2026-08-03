// tests/r10p3-buildmode.mjs — RUN10 P3: Town 4.0 build mode, paths, landscape, pond fishing.
// Acceptance: toggle freeze/resume frames; grid overlay only in build; painted paths
// persist across reload and never overdraw items (z-order pixel test); toggle-erase and
// Erase tool both work; landscape excluded from 500 simulated box rolls; FISH full frame
// run with both outcomes forced via seeded rand; ripple frames; path cap message.
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
const tabDisplay = (page, label) => page.evaluate((lbl) => {
  const tab = [...document.querySelectorAll('.bd-tabs .bd-tab')].find(el => el.textContent.includes(lbl));
  return tab ? getComputedStyle(tab).display : 'missing';
}, label);

// ==================== toggle freeze/resume ====================
console.log('== build mode: living behaviours freeze, then resume ==');
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
  assert(distinct(before) >= 2, `motion happens before build mode (${distinct(before)}/5 distinct frames)`);
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(200);
  const buildingClass = await page.evaluate(() => document.querySelector('.town2').classList.contains('building'));
  assert(buildingClass, 'root gains .building on toggle');
  const hammerActive = await page.evaluate(() => document.querySelector('.town-hammer-btn').classList.contains('active'));
  assert(hammerActive, 'the hammer button shows active');
  const frozen = [];
  for (let k = 0; k < 5; k++) { frozen.push(await page.evaluate(() => [...document.querySelectorAll('.t-item.boo svg')].map(s => s.style.transform).join('|'))); await sleep(250); }
  assert(distinct(frozen) === 1, `frozen while building (${distinct(frozen)}/5 distinct frames)`);
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(200);
  const resumedNotBuilding = await page.evaluate(() => !document.querySelector('.town2').classList.contains('building'));
  assert(resumedNotBuilding, 'root loses .building on the second toggle');
  const after = [];
  for (let k = 0; k < 6; k++) { after.push(await page.evaluate(() => [...document.querySelectorAll('.t-item.boo svg')].map(s => s.style.transform).join('|'))); await sleep(250); }
  assert(distinct(after) >= 2, `motion resumes after build mode (${distinct(after)}/6 distinct frames)`);
  await page.screenshot({ path: 'screenshots/r10p3/build-toggle-1024x700.png' });
  await ctx.close();
}

// ==================== grid overlay only in build ====================
console.log('== grid overlay: hidden outside build mode, visible inside it ==');
{
  const { ctx, page } = await openArea('meadow', []);
  const opBefore = await page.evaluate(() => window.__townLife.gridOpacity());
  assert(parseFloat(opBefore) === 0, `grid hidden before build mode (opacity ${opBefore})`);
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(300);
  const opDuring = await page.evaluate(() => window.__townLife.gridOpacity());
  assert(parseFloat(opDuring) === 1, `grid visible in build mode (opacity ${opDuring})`);
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(300);
  const opAfter = await page.evaluate(() => window.__townLife.gridOpacity());
  assert(parseFloat(opAfter) === 0, `grid hidden again after exiting build mode (opacity ${opAfter})`);
  await ctx.close();
}

// ==================== painted paths persist across reload + never overdraw items ====================
console.log('== painted paths: persist across reload, z-order below items ==');
{
  const items = [{ zone: 'meadow', x: 0.05, row: 1, item: 'deco_bench' }];
  const { ctx, page } = await openArea('meadow', items);
  await page.evaluate(() => { window.__townLife.toggleBuild(); window.__townLife.setBuildTool('paths'); window.__townLife.setPathStyle('stone'); });
  await sleep(100);
  await page.evaluate(() => { window.__townLife.paintCellAt(2, 2); window.__townLife.paintCellAt(3, 2); window.__townLife.paintCellAt(4, 2); });
  const painted = await page.evaluate(() => window.__townLife.paths());
  assert(painted.length === 3, `three cells painted (${painted.length})`);
  await page.evaluate(() => window.__townLife.commitPathsNow());
  // z-order: a painted cell's z-index must sit below the bench's inline z-index
  const zOrder = await page.evaluate(() => ({ path: window.__townLife.pathCellZ(), item: window.__townLife.itemZ('.t-item[data-item="deco_bench"]') }));
  assert(zOrder.path != null && zOrder.item != null && +zOrder.path < +zOrder.item, `path cell (z${zOrder.path}) renders below the item (z${zOrder.item})`);
  await page.screenshot({ path: 'screenshots/r10p3/paths-painted-1024x700.png' });
  // reload: paths must survive (state was committed, not just held in memory)
  await page.evaluate(() => window.__townLife.toggleBuild());   // exit build mode too, for good measure (also commits)
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(300);
  const afterReload = await page.evaluate(() => window.__townLife.paths());
  assert(afterReload.length === 3 && afterReload.every(c => c.style === 'stone'), `paths survive a reload (${JSON.stringify(afterReload)})`);
  const cellCount = await page.evaluate(() => window.__townLife.pathCellCount());
  assert(cellCount === 3, `3 path cells render after reload (${cellCount})`);
  await ctx.close();
}

// ==================== toggle-erase + Erase tool ====================
console.log('== toggle-erase (same cell/style) and the Erase tool ==');
{
  const { ctx, page } = await openArea('meadow', []);
  await page.evaluate(() => { window.__townLife.toggleBuild(); window.__townLife.setBuildTool('paths'); window.__townLife.setPathStyle('sand'); });
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
  // Erase tool clears any style, no toggle-back
  await page.evaluate(() => { window.__townLife.setBuildTool('erase'); window.__townLife.paintCellAt(5, 5); });
  list = await page.evaluate(() => window.__townLife.paths());
  assert(list.length === 0, 'the Erase tool clears a cell regardless of style');
  await ctx.close();
}

// ==================== path cap (300 cells/area) ====================
console.log('== path cap: 300 cells/area, L_PATH_FULL on the 301st ==');
{
  const { ctx, page } = await openArea('meadow', []);
  await page.evaluate(() => { window.__townLife.toggleBuild(); window.__townLife.setBuildTool('paths'); window.__townLife.setPathStyle('stone'); });
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
  assert(await tabDisplay(page, 'Landscape') === 'none', 'the Landscape tab is hidden indoors with the hammer off');
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(100);
  const tabHiddenIndoors = await tabDisplay(page, 'Landscape') === 'none';
  assert(tabHiddenIndoors, 'the Landscape tab is hidden indoors, even in build mode');
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
  // RUN21A item 15 moved this pin. The Landscape tab used to be Build-only ("hides the
  // moment build mode is off"); the build-mode conjunct is gone, so outdoors the tab is
  // visible with the hammer OFF too — the toybox is no longer locked behind the hammer.
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(150);
  const notBuilding = await page.evaluate(() => !document.querySelector('.town2').classList.contains('building'));
  assert(notBuilding, 'the hammer is off again');
  assert(await tabDisplay(page, 'Landscape') !== 'none', 'the Landscape tab STAYS visible outdoors with the hammer off (RUN21A item 15)');
  await page.screenshot({ path: 'screenshots/r10p3/landscape-1024x700.png' });
  await ctx.close();
}

// ==================== RUN21A item 15: the build tool row is exactly Paths + Erase ====================
// The `place` tool was a ghost — no line of code ever read `buildTool === 'place'` — so item
// 15 deleted it and made 'paths' the default and the on-entry reset. Pinning the row's exact
// membership is the guard that stops it creeping back.
console.log('== build tools: exactly Paths + Erase, no Place tool (RUN21A item 15) ==');
{
  const { ctx, page } = await openArea('meadow', []);
  const readTools = () => page.evaluate(() => [...document.querySelectorAll('.t-tool-row .t-tool-btn')]
    .map(b => ({ label: b.querySelector('.tool-lbl').textContent, aria: b.getAttribute('aria-label'), sel: b.classList.contains('sel') })));
  assert((await page.evaluate(() => window.__townLife.buildTool())) === 'paths', 'buildTool defaults to "paths"');
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(150);
  const tools = await readTools();
  assert(tools.length === 2, `the tool row holds exactly two tools (${tools.length}: ${tools.map(t => t.label).join(', ')})`);
  assert(tools.map(t => t.label).join('|') === 'Paths|Erase', `the two tools are Paths then Erase ("${tools.map(t => t.label).join('|')}")`);
  assert(!tools.some(t => /place/i.test(t.label) || /place/i.test(t.aria || '')), 'no Place tool exists in the row');
  assert((await page.evaluate(() => window.__townLife.buildTool())) === 'paths', 'entering build mode resets the tool to "paths", not "place"');
  assert(tools[0].sel && !tools[1].sel, 'Paths is the selected tool on entry');
  // ACCEPT (item 15): the path-style strip belongs to the Paths tool only.
  const styleShownForPaths = await page.evaluate(() => getComputedStyle(document.querySelector('.t-path-style-row')).display !== 'none');
  assert(styleShownForPaths, 'the path-style row shows while Paths is picked');
  await page.evaluate(() => window.__townLife.setBuildTool('erase'));
  await sleep(100);
  const styleHiddenForErase = await page.evaluate(() => getComputedStyle(document.querySelector('.t-path-style-row')).display === 'none');
  assert(styleHiddenForErase, 'the path-style row hides while Erase is picked');
  await ctx.close();
}

// ==================== RUN21A item 15: Landscape + Wishes place by DRAG with the hammer off ====================
console.log('== play mode (hammer off): Landscape and Wishes tabs are reachable and place by drag ==');
{
  // one unlocked wish → the Wishes tab must show; wish_tree is a plain ground wish (not one
  // of the sky items, not a LIVING_WISHES flyer), so it lands as a normal .t-item.
  const { ctx, page } = await openArea('meadow', [], { over: { wishes: { unlocked: { tree: true } } } });
  assert(await page.evaluate(() => !document.querySelector('.town2').classList.contains('building')), 'the hammer starts off');
  assert(await tabDisplay(page, 'Landscape') !== 'none', 'the Landscape tab is visible outdoors with the hammer off');
  assert(await tabDisplay(page, 'Wishes') !== 'none', 'the Wishes tab is visible with the hammer off when a wish is unlocked');
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
  const stillPlay = await page.evaluate(() => !document.querySelector('.town2').classList.contains('building'));
  assert(stillPlay, 'both placements happened without the hammer ever being tapped');
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
  assert(await tabDisplay(page, 'Wishes') === 'none', 'the Wishes tab is hidden when no wish is unlocked (hammer off)');
  await page.evaluate(() => window.__townLife.toggleBuild());
  await sleep(150);
  assert(await tabDisplay(page, 'Wishes') === 'none', 'the Wishes tab stays hidden with no wish unlocked, even in build mode');
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
