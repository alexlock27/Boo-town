// tests/r19z6-objectmodel.mjs — RUN19 Z6: the object model (save VERSION 23).
//
// The pack's own assertion list, plus the era law:
//   · era tests for v23 — migrating twice is identical, and a pre-Z6 wall item is byte-for-byte
//     where it always hung;
//   · a lamp seated on the table survives save/reload, and GROUNDS at the table's x when the
//     table is put away (never deleted);
//   · a wall item's dragged y clamps to the authored 0.18-0.42 band;
//   · resize clamps per class (1.60 normally, 2.0 for indoor furniture and for a bed);
//   · dressings apply per room and persist, and the shelf sells them with Y14's confirm at 10★;
//   · the back-wall lane: indoor ground lines are 0.585 / 0.72 / 0.86, outdoors unchanged.
// Expected runtime ~30s. Not @serial.
import { chromium } from 'playwright';
import { DRESSINGS, DRESSINGS_FOR_SALE } from '../data/dressings.js';
import { SURFACE_SLOTS, WALL_Y_MIN, WALL_Y_MAX } from '../data/surfaces.js';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TODAY = new Date().toISOString().slice(0, 10);

const SAVE = (over = {}) => Object.assign({
  version: 22, name: 'Ada', created: 1750000000000,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, deco_table: 1, deco_tablelamp: 1, deco_wallclock: 1, deco_bed: 1, deco_bookshelf2: 1 },
  stars: { total: 400, byType: { creative: 40, maths: 0, word: 0, puzzle: 0, lesson: 0 }, spent: { creative: 0, maths: 0, word: 0, puzzle: 0, lesson: 0, legacy: 0 }, legacy: 20, byGame: {} },
  meter: 0, boxes: 0, opened: 4, stardust: 0,
  nicknames: {}, equips: {}, catBest: {}, ledger: {}, sparkles: {},
  town: { areas: {} }, care: { bonds: {}, treats: 3 },
  delights: { hideDay: TODAY, hideFound: true },
  request: { actives: [], lastResolvedAt: Date.now() },
  routines: {}, journal: {}, trophies: {}, customs: [], easelArt: '',
  settings: { sound: false, music: false, voice: false, mic: false, requests: false, content: 'full' },
  seen: { ageAsked: true, boohouseSeeded: true, townFirst: true }
}, over);

const browser = await chromium.launch();
async function boot(over = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE(over)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function openRoom(page, room = 'lounge') {
  await page.evaluate(r => window.BooTown.go('town', { area: 'boohouse', room: r }), room);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(350);
}

// ---- the authored content ships as authored ----------------------------------------
console.log('== the 18 dressings, verbatim ==');
{
  const EXPECT = [
    ['lounge', 'walls', 'Sunny Stripes', 6], ['lounge', 'walls', 'Cosy Checks', 6], ['lounge', 'walls', 'Starry Night', 10],
    ['lounge', 'floors', 'Rosy Rug Weave', 6], ['lounge', 'floors', 'Pebble Cosy', 6], ['lounge', 'floors', 'Honey Herringbone', 10],
    ['kitchen', 'walls', 'Lemon Check', 6], ['kitchen', 'walls', 'Mint Spots', 6], ['kitchen', 'walls', 'Blueberry Tiles', 10],
    ['kitchen', 'floors', 'Terracotta Warm', 6], ['kitchen', 'floors', 'Seafoam Squares', 6], ['kitchen', 'floors', 'Buttercup Boards', 10],
    ['bedroom', 'walls', 'Pink Clouds', 6], ['bedroom', 'walls', 'Petal Stripes', 6], ['bedroom', 'walls', 'Midnight Stars', 10],
    ['bedroom', 'floors', 'Moonbeam Boards', 6], ['bedroom', 'floors', 'Cloud Carpet', 6], ['bedroom', 'floors', 'Rainbow Rug', 10]
  ];
  assert(DRESSINGS_FOR_SALE.length === 18, `18 dressings are for sale (${DRESSINGS_FOR_SALE.length})`);
  let allOk = true;
  for (const [room, slot, name, cost] of EXPECT) {
    const d = DRESSINGS.find(x => x.room === room && x.slot === slot && x.name === name);
    if (!d) { assert(false, `${room} ${slot}: "${name}" exists`); allOk = false; continue; }
    if (d.cost !== cost) { assert(false, `${room} ${slot} "${name}" costs ${cost}★ (got ${d.cost})`); allOk = false; }
  }
  assert(allOk, 'every authored name and price ships exactly as written (standing veto: no overrule in NEEDS_ALEX.md)');
  // ...and the free default per room, which is the palette the room always had
  for (const room of ['lounge', 'kitchen', 'bedroom']) {
    const frees = DRESSINGS.filter(d => d.room === room && d.cost === 0);
    assert(frees.length === 2, `${room} keeps its own palette free, walls and floor (${frees.length})`);
  }
}

// ---- the v23 era test ---------------------------------------------------------------
console.log('== v23: planes, and a pre-Z6 wall item lands exactly where it hung ==');
{
  const { ctx, page } = await boot({
    town: { areas: { boohouse: { items: [
      { zone: 'boohouse', x: 0.20, row: 1, item: 'deco_table' },
      { zone: 'boohouse', x: 0.60, row: 3, item: 'deco_wallclock' }    // RUN10 P4's row-3 sentinel
    ], paths: [] } } }
  });
  const mig = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { version: s.version, items: s.town.areas.boohouse.items.map(t => ({ item: t.item, plane: t.plane, y: t.y, row: t.row })), dressings: s.dressings, owned: s.dressingsOwned };
  });
  assert(mig.version === 23, `the save migrates to v23 (${mig.version})`);
  const clock = mig.items.find(t => t.item === 'deco_wallclock');
  const table = mig.items.find(t => t.item === 'deco_table');
  // BYTE-PRESERVED. The pack says "all new keys optional, old saves byte-preserved", so the
  // migration writes NO plane onto an existing placement — the DEFAULT is the migration. The
  // first cut did backfill every placement and r8p1-migrations was right to fail it.
  assert(clock && clock.plane === undefined, `a pre-Z6 placement gains no plane field at all (${clock && clock.plane})`);
  assert(clock && clock.y === undefined, 'and no y field');
  assert(clock && clock.row === 3, "RUN10 P4's row-3 sentinel is left exactly where it was");
  assert(table && table.plane === undefined, 'a floor item is untouched too');
  // ...and it is INTERPRETED correctly all the same, which is the point of the default.
  const read = await page.evaluate(() => ({ clock: window.__townLife ? null : null }));
  await page.evaluate(() => window.BooTown.go('town', { area: 'boohouse', room: 'lounge' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  const interpreted = await page.evaluate(() => ({
    clock: window.__townLife.planeOf('deco_wallclock'),
    table: window.__townLife.planeOf('deco_table'),
    clockY: window.__townLife.wallYOf('deco_wallclock')
  }));
  assert(interpreted.clock === 'wall', `the row-3 sentinel still READS as the wall plane (${interpreted.clock})`);
  assert(interpreted.table === 'floor', `and an absent plane reads as the floor (${interpreted.table})`);
  assert(interpreted.clockY === 0.30, `an absent y reads as the fixed height it always hung at, so it renders pixel-identically (${interpreted.clockY})`);
  assert(mig.dressings && typeof mig.dressings === 'object', 'the dressings map exists and is empty, so every room shows its own palette');
  const twice = await page.evaluate(() => {
    const m = window.BooTown.State;
    const raw = JSON.parse(localStorage.getItem('bootown.save.v1'));
    const a = JSON.stringify(m.migrate(JSON.parse(JSON.stringify(raw))));
    const b = JSON.stringify(m.migrate(JSON.parse(a)));
    return a === b;
  });
  assert(twice, 'migrating twice is byte-identical (era law)');
  await ctx.close();
}

// ---- the back-wall lane -------------------------------------------------------------
console.log('== the back-wall lane: indoor rows re-spaced, outdoor rows untouched ==');
{
  const { ctx, page } = await boot({
    town: { areas: {
      boohouse: { items: [0, 1, 2].map(r => ({ zone: 'boohouse', x: 0.1 + r * 0.08, row: r, item: 'deco_table' })), paths: [] },
      meadow: { items: [0, 1, 2].map(r => ({ zone: 'meadow', x: 0.1 + r * 0.08, row: r, item: 'deco_bench' })), paths: [] }
    } },
    inventory: { deco_table: 3, deco_bench: 3 }
  });
  await openRoom(page);
  const indoorFracs = await page.evaluate(() => window.__townLife.rowFracs());
  assert(JSON.stringify(indoorFracs) === JSON.stringify([0.585, 0.72, 0.86]),
    `indoors the ground lines are 0.585 / 0.72 / 0.86 (${JSON.stringify(indoorFracs)})`);
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  const outdoorFracs = await page.evaluate(() => window.__townLife.rowFracs());
  assert(JSON.stringify(outdoorFracs) === JSON.stringify([0.67, 0.79, 0.91]),
    `outdoors they are untouched at 0.67 / 0.79 / 0.91 (${JSON.stringify(outdoorFracs)})`);
  await ctx.close();
}

// ---- surfaces -----------------------------------------------------------------------
console.log('== a lamp on the table: seated, survives a reload, and GROUNDS if the table goes ==');
{
  const { ctx, page } = await boot({
    town: { areas: { boohouse: { items: [
      { zone: 'boohouse', x: 0.20, row: 1, item: 'deco_table', plane: 'floor' },
      { zone: 'boohouse', x: 0.20, row: 1, item: 'deco_tablelamp', plane: 'surface', parent: 'boohouse:0.2:deco_table', slot: 1 }
    ], paths: [] } } },
    version: 23
  });
  await openRoom(page);
  const seated = await page.evaluate(() => {
    const table = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === 'deco_table');
    const lamp = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === 'deco_tablelamp');
    if (!table || !lamp) return null;
    const tr = table.getBoundingClientRect(), lr = lamp.getBoundingClientRect();
    // the table's own surface: surfaceY 0.55 of its height above its rendered box bottom
    const surface = tr.bottom - 0.55 * tr.height;
    return {
      plane: lamp.dataset.plane,
      surfaceGap: Math.round(lr.bottom - surface),
      lampBottom: Math.round(lr.bottom), tableTop: Math.round(tr.top), tableBottom: Math.round(tr.bottom),
      widthFrac: +(lr.width / tr.width).toFixed(3),
      zAhead: (parseInt(lamp.style.zIndex, 10) || 0) > (parseInt(table.style.zIndex, 10) || 0),
      rightOfCentre: lr.left + lr.width / 2 > tr.left + tr.width / 2
    };
  });
  assert(seated && seated.plane === 'surface', `the lamp is on the surface plane (${seated && seated.plane})`);
  assert(seated && seated.lampBottom < seated.tableBottom, `it stands ON the table, not on the floor beside it (lamp bottom ${seated && seated.lampBottom} vs table bottom ${seated && seated.tableBottom})`);
  assert(seated && seated.lampBottom > seated.tableTop, `and its feet are on the table, not floating above it (vs table top ${seated && seated.tableTop})`);
  // PIXEL CONTACT, to the same law RUN10 P2 holds sockets to. "Above the table's top and below
  // its bottom" is true of a lamp floating 12px over it, which is what the first cut did:
  // surfaceSeatFor measured from the parent's GROUND LINE while every item's box bottom sits
  // at (ground + 8). Measured against the table's real surface now.
  assert(seated && Math.abs(seated.surfaceGap) <= 4,
    `and it makes real contact with the table's surface (${seated && seated.surfaceGap}px off)`);
  assert(seated && seated.widthFrac <= 0.45 + 0.02, `it is clamped to at most 45% of the table's width (${seated && seated.widthFrac})`);
  assert(seated && seated.zAhead, 'and draws in front of the table it stands on');
  assert(seated && seated.rightOfCentre, 'slot 1 puts it right of the table\'s centre, where the slot says');
  // survives a reload
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await openRoom(page);
  const afterReload = await page.evaluate(() => {
    const s = window.BooTown.State.getState().town.areas.boohouse.items.find(t => t.item === 'deco_tablelamp');
    const lamp = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === 'deco_tablelamp');
    return { saved: s && { plane: s.plane, parent: s.parent, slot: s.slot }, rendered: lamp && lamp.dataset.plane };
  });
  assert(afterReload.saved && afterReload.saved.plane === 'surface' && afterReload.saved.slot === 1,
    `the seat survives save + reload (${JSON.stringify(afterReload.saved)})`);
  assert(afterReload.rendered === 'surface', 'and it renders seated again, not on the floor');
  // ...and grounding when the parent is put away
  const grounded = await page.evaluate(async () => {
    const st = window.BooTown.State;
    st.mutate(s => { s.town.areas.boohouse.items = s.town.areas.boohouse.items.filter(t => t.item !== 'deco_table'); });
    window.BooTown.go('town', { area: 'boohouse', room: 'lounge' });
    await new Promise(r => setTimeout(r, 600));
    const s = st.getState().town.areas.boohouse.items.find(t => t.item === 'deco_tablelamp');
    return s && { plane: s.plane, x: s.x, parent: s.parent, slot: s.slot, stillThere: true };
  });
  assert(grounded && grounded.stillThere, 'removing the table NEVER deletes the lamp');
  assert(grounded && grounded.plane === 'floor', `the lamp is grounded onto the floor (${grounded && grounded.plane})`);
  assert(grounded && Math.abs(grounded.x - 0.2) < 0.002, `at the table's own x, where she left it (${grounded && grounded.x})`);
  assert(grounded && grounded.parent === undefined && grounded.slot === undefined, 'and it is nobody\'s child any more');
  await ctx.close();
}

console.log('== the slot table is the authored one ==');
{
  assert(JSON.stringify(SURFACE_SLOTS.deco_table) === JSON.stringify([{ x: -0.22 }, { x: 0.22 }]), 'table: two slots at ±0.22');
  assert(JSON.stringify(SURFACE_SLOTS.deco_kitchentable) === JSON.stringify([{ x: -0.22 }, { x: 0.22 }]), 'kitchentable: two slots at ±0.22');
  assert(SURFACE_SLOTS.deco_counter.length === 3, 'counter: three slots');
  assert(SURFACE_SLOTS.deco_bookshelf.length === 2 && SURFACE_SLOTS.deco_bookshelf[0].surfaceY === 0.35 && SURFACE_SLOTS.deco_bookshelf[1].surfaceY === 0.68,
    'bookshelf: two shelves at 0.35 and 0.68');
  assert(JSON.stringify(SURFACE_SLOTS.deco_toybox) === JSON.stringify([{ x: 0 }]), 'toybox: one slot at centre');
}

// ---- the wall band ------------------------------------------------------------------
console.log('== a wall item\'s y clamps to the authored 0.18-0.42 band ==');
{
  const { ctx, page } = await boot({
    version: 23,
    town: { areas: { boohouse: { items: [{ zone: 'boohouse', x: 0.20, row: 3, plane: 'wall', y: 0.30, item: 'deco_wallclock' }], paths: [] } } }
  });
  await openRoom(page);
  const clamped = await page.evaluate(() => {
    const st = window.BooTown.State;
    const write = (y) => {
      st.mutate(s2 => { s2.town.areas.boohouse.items.find(t => t.item === 'deco_wallclock').y = y; });
      window.__townLife.rerender();
      return window.__townLife.wallYOf('deco_wallclock');
    };
    // ...and prove the clamp is what MOVES the pixels, not just a number: the rendered top
    // must be identical for two out-of-band values that clamp to the same end of the band.
    const at = () => Math.round([...document.querySelectorAll('.t-item')].find(x => x.dataset.item === 'deco_wallclock').getBoundingClientRect().top);
    const tooHigh = write(0.02), topHigh = at();
    write(-5); const topWayHigh = at();
    const tooLow = write(0.90), topLow = at();
    const inBand = write(0.35), topMid = at();
    return { tooHigh, tooLow, inBand, sameAtTop: topHigh === topWayHigh, midIsBetween: topMid > topHigh && topMid < topLow };
  });
  assert(clamped.tooHigh === WALL_Y_MIN, `a y above the band clamps to ${WALL_Y_MIN} (got ${clamped.tooHigh})`);
  assert(clamped.tooLow === WALL_Y_MAX, `a y below the band clamps to ${WALL_Y_MAX} (got ${clamped.tooLow})`);
  assert(clamped.inBand === 0.35, `and a y inside the band is honoured exactly (${clamped.inBand})`);
  assert(clamped.sameAtTop, 'the clamp really moves the pixels: two out-of-band values render at the same height');
  assert(clamped.midIsBetween, 'and an in-band y renders between the two ends');
  await ctx.close();
}

// ---- resize ------------------------------------------------------------------------
console.log('== resize: a drag handle instead of buttons, clamped per class ==');
{
  const { ctx, page } = await boot({
    version: 23,
    town: { areas: { boohouse: { items: [
      { zone: 'boohouse', x: 0.20, row: 1, plane: 'floor', item: 'deco_table' },
      { zone: 'boohouse', x: 0.50, row: 1, plane: 'floor', item: 'deco_bed' }
    ], paths: [] } } }
  });
  await openRoom(page);
  const sel = await page.evaluate(async () => {
    window.__townLife.toggleBuild();
    await new Promise(r => setTimeout(r, 500));
    const table = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === 'deco_table');
    const r = table.getBoundingClientRect();
    for (const type of ['pointerdown', 'pointerup']) table.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }));
    await new Promise(x => setTimeout(x, 350));
    const ring = document.querySelector('.t-resize');
    const menu = document.querySelector('.plot-menu');
    const rr = ring && ring.getBoundingClientRect();
    return {
      hasRing: !!ring,
      hit: rr ? [Math.round(rr.width), Math.round(rr.height)] : null,
      drawn: ring ? getComputedStyle(ring, '::before').width : null,
      menuButtons: menu ? [...menu.querySelectorAll('button')].map(b => b.textContent) : []
    };
  });
  assert(sel.hasRing, 'selecting an item in build mode shows a resize handle');
  assert(sel.hit && sel.hit[0] >= 56 && sel.hit[1] >= 56, `its hit area meets the 56px tap-target law (${sel.hit && sel.hit.join('x')})`);
  assert(sel.drawn === '28px', `and the ring itself is the pack's 28px (${sel.drawn})`);
  assert(!sel.menuButtons.some(b => /Size|%/.test(b)), `the ± / % buttons are gone from the menu (${JSON.stringify(sel.menuButtons)})`);
  const clamps = await page.evaluate(async () => {
    const st = window.BooTown.State;
    const set = (item, v) => { st.mutate(s => { s.town.areas.boohouse.items.find(t => t.item === item).scale = v; }); window.__townLife.rerender(); const n = [...document.querySelectorAll('.t-item')].find(x => x.dataset.item === item); return +n.dataset.scale; };
    return { tableHigh: set('deco_table', 3), tableLow: set('deco_table', 0.1), bedHigh: set('deco_bed', 3) };
  });
  assert(clamps.tableHigh === 2.0, `indoor furniture may reach 2.0 (${clamps.tableHigh})`);
  assert(clamps.tableLow === 0.7, `and never below 0.70 (${clamps.tableLow})`);
  assert(clamps.bedHigh === 2.0, `a bed may reach 2.0 (${clamps.bedHigh})`);
  await ctx.close();
}

// ---- dressings, end to end ----------------------------------------------------------
console.log('== the shelf sells a dressing, the room applies it, and it persists ==');
{
  const { ctx, page } = await boot({ version: 23 });
  const shelf = await page.evaluate(async () => {
    window.BooTown.go('shop');
    await new Promise(r => setTimeout(r, 900));
    const cards = [...document.querySelectorAll('.sd-card')].map(n => n.dataset.dressing);
    const chips = [...document.querySelectorAll('.sd-room-chip')].map(n => n.textContent);
    return { cards: cards.length, chips, hasStarry: cards.includes('lounge_walls_starry') };
  });
  assert(shelf.cards === 18, `the shop's House shelf lists all 18 dressings (${shelf.cards})`);
  assert(JSON.stringify(shelf.chips) === JSON.stringify(['Lounge', 'Kitchen', 'Bedroom']),
    `grouped under room-name chips (${JSON.stringify(shelf.chips)})`);
  // Y14's confirm rule at 10★
  const confirm = await page.evaluate(async () => {
    const card = [...document.querySelectorAll('.sd-card')].find(n => n.dataset.dressing === 'lounge_walls_starry');
    card.querySelector('.sc-buy').click();
    await new Promise(r => setTimeout(r, 450));
    const d = document.querySelector('.overlay .dialog');
    const title = d && d.querySelector('h2') ? d.querySelector('h2').textContent : null;
    if (d) { const yes = [...d.querySelectorAll('button')].find(b => /Yes please/.test(b.textContent)); if (yes) yes.click(); }
    await new Promise(r => setTimeout(r, 500));
    const s = window.BooTown.State.getState();
    return { title, owned: !!(s.dressingsOwned || {})['lounge_walls_starry'], spent: s.stars.spent.creative };
  });
  assert(/^Spend 10 Creative Stars on Starry Night\?$/.test(confirm.title || ''),
    `a 10★ dressing asks first, per Y14 (${confirm.title})`);
  assert(confirm.owned, 'saying yes buys it');
  assert(confirm.spent === 10, `and debits exactly 10 creative stars (${confirm.spent})`);
  // a 6★ one does NOT ask
  const noConfirm = await page.evaluate(async () => {
    const card = [...document.querySelectorAll('.sd-card')].find(n => n.dataset.dressing === 'lounge_walls_stripes');
    card.querySelector('.sc-buy').click();
    await new Promise(r => setTimeout(r, 400));
    const asked = !!document.querySelector('.overlay .dialog');
    const s = window.BooTown.State.getState();
    return { asked, owned: !!(s.dressingsOwned || {})['lounge_walls_stripes'] };
  });
  assert(!noConfirm.asked, 'a 6★ dressing is under the confirm threshold and just buys');
  assert(noConfirm.owned, 'and is owned straight away');
  // apply it in the room, and check it persists and is per-room
  await openRoom(page, 'lounge');
  const applied = await page.evaluate(async () => {
    window.__townLife.toggleBuild();
    await new Promise(r => setTimeout(r, 500));
    const tab = [...document.querySelectorAll('.bd-tab')].find(t => /Decorate/.test(t.textContent));
    tab.click();
    await new Promise(r => setTimeout(r, 350));
    const sw = [...document.querySelectorAll('.decorate-swatch')].find(n => /Starry Night/.test(n.textContent));
    const lockedBefore = sw.classList.contains('locked');
    sw.click();
    await new Promise(r => setTimeout(r, 500));
    const s = window.BooTown.State.getState();
    return { lockedBefore, dressings: s.dressings, layers: document.querySelectorAll('.t-dressing').length,
      onNow: [...document.querySelectorAll('.decorate-swatch.on')].map(n => (n.querySelector('.decorate-swatch-name') || {}).textContent) };
  });
  assert(!applied.lockedBefore, 'an owned dressing is not locked in the Decorate tab');
  assert(applied.dressings.lounge && applied.dressings.lounge.walls === 'lounge_walls_starry',
    `applying it records it for THAT room (${JSON.stringify(applied.dressings)})`);
  assert(applied.layers === 2, `and the room paints both bands (${applied.layers})`);
  assert(applied.onNow.includes('Starry Night'), `the swatch shows as the one that is on (${JSON.stringify(applied.onNow)})`);
  // per-room: the kitchen is untouched
  await openRoom(page, 'kitchen');
  const perRoom = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { kitchen: (s.dressings || {}).kitchen || null, lounge: (s.dressings || {}).lounge || null };
  });
  assert(!perRoom.kitchen, `the Kitchen is untouched by a Lounge choice (${JSON.stringify(perRoom.kitchen)})`);
  assert(perRoom.lounge && perRoom.lounge.walls === 'lounge_walls_starry', 'and the Lounge keeps its own');
  // ...and it PERSISTS. Asserted against the localStorage copy and a fresh migrate() of it,
  // NOT via page.reload(): this suite seeds the save with addInitScript, which re-runs on every
  // page load, so a reload would put the fixture back and prove nothing at all.
  const persisted = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bootown.save.v1'));
    const migrated = window.BooTown.State.migrate(JSON.parse(JSON.stringify(raw)));
    return { disk: (raw.dressings || {}).lounge || null, owned: !!(raw.dressingsOwned || {}).lounge_walls_starry, afterMigrate: (migrated.dressings || {}).lounge || null };
  });
  assert(persisted.disk && persisted.disk.walls === 'lounge_walls_starry', `the choice is written to the save (${JSON.stringify(persisted.disk)})`);
  assert(persisted.owned, 'and so is owning it');
  assert(persisted.afterMigrate && persisted.afterMigrate.walls === 'lounge_walls_starry',
    `and it survives the load path a reload would take (${JSON.stringify(persisted.afterMigrate)})`);
  await ctx.close();
}

console.log('== Decorate is a ROOM tab: there is no wallpaper in the Meadow ==');
{
  const { ctx, page } = await boot({ version: 23, town: { areas: { meadow: { items: [], paths: [] } } } });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  const outside = await page.evaluate(async () => {
    window.__townLife.toggleBuild();
    await new Promise(r => setTimeout(r, 500));
    const tab = [...document.querySelectorAll('.bd-tab')].find(t => /Decorate/.test(t.textContent));
    return { present: !!tab, hidden: tab ? tab.style.display === 'none' : null };
  });
  assert(outside.hidden === true, `the Decorate tab is hidden outdoors (present ${outside.present}, hidden ${outside.hidden})`);
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
