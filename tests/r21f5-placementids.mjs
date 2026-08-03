// tests/r21f5-placementids.mjs — RUN21F F5: save v24, placement ids, children ride with parents.
//
// The pack's ACCEPT, made permanent and made LITERAL:
//   · migration on the RICH QA save preserves every placement, seat and sparkle;
//   · a v23 save opened by v24 code migrates losslessly — placements, seats and sparkles are
//     COUNTED before and after and asserted equal (the forward-only rule means the reverse is
//     not supported and is not tested);
//   · move a table -> the lamp travels with it;
//   · put the table away -> the lamp grounds at the table's LAST spot;
//   · reload mid-everything -> intact.
//
// Everything that can be proved without a browser is proved in Node against migrate() itself;
// the three behavioural clauses are driven with the REAL mouse, because the whole failure this
// item fixes lived in a pointerup handler.
//
// Expected runtime ~35s. Not @serial.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { migrate, VERSION } from '../js/state.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = '_evidence/run21f5';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

// What "nothing is lost" MEANS, counted: how many things she placed, how many of them are
// sitting on something, and how many are sparkling.
function census(s) {
  const areas = (s && s.town && s.town.areas) || {};
  let placements = 0, seats = 0;
  for (const k of Object.keys(areas)) for (const t of ((areas[k] || {}).items || [])) { placements++; if (t.parent != null) seats++; }
  return { placements, seats, sparkles: Object.keys(s.sparkles || {}).length };
}
const allItems = (s) => Object.values((s.town && s.town.areas) || {}).flatMap(a => (a && a.items) || []);

// ============================================================================
// 1 — the migration, in Node, against migrate() itself
// ============================================================================
console.log('== v24: every placement gains an id, from a counter that only goes up ==');
{
  // The v23 era save. Two seated children on one table, a wall item, a scaled floor item, a
  // path, a sparkle on each of an AMBIGUOUS pair (same item, same x, different depth rows —
  // which share one `zone:x:item` key and are the reason a place-key was never an identity).
  const v23 = {
    version: 23, name: 'Ada', created: 1750000000000, age: 8, ageAsked: true,
    inventory: { deco_table: 1, deco_tablelamp: 1, deco_bench: 2 },
    stars: { total: 300, byGame: {} }, meter: 0, boxes: 0, stardust: 12,
    sparkles: { 'boohouse:0.2:deco_table': today, 'meadow:0.4:deco_bench': today },
    town: { areas: {
      meadow: { items: [
        { zone: 'meadow', x: 0.4, row: 1, item: 'deco_bench', scale: 1.2, plane: 'floor' },
        { zone: 'meadow', x: 0.4, row: 0, item: 'deco_bench' },
        { zone: 'meadow', x: 0.7, row: 2, item: 'deco_tree', at: 1750000009000 }
      ], paths: [{ cx: 3, cy: 4, style: 'stone' }] },
      boohouse: { items: [
        { zone: 'boohouse', x: 0.2, row: 1, item: 'deco_table', plane: 'floor' },
        { zone: 'boohouse', x: 0.2, row: 1, item: 'deco_tablelamp', plane: 'surface', parent: 'boohouse:0.2:deco_table', slot: 1, scale: 0.9 },
        { zone: 'boohouse', x: 0.2, row: 1, item: 'deco_plant', plane: 'surface', parent: 'boohouse:0.2:deco_table', slot: 0 },
        { zone: 'boohouse', x: 0.8, row: 3, item: 'deco_wallclock', plane: 'wall', y: 0.33 }
      ], paths: [] }
    } }
  };
  const before = census(v23);
  const m = migrate(structuredClone(v23));
  const after = census(m);
  assert(m.version === VERSION && VERSION === 24, `the save reaches v24 (${m.version})`);
  assert(after.placements === before.placements, `EVERY placement survives (${before.placements} -> ${after.placements})`);
  assert(after.seats === before.seats, `EVERY seat survives (${before.seats} -> ${after.seats})`);
  const ids = allItems(m).map(t => t.id);
  assert(ids.every(n => Number.isInteger(n) && n > 0), `every placement has a positive integer id (${JSON.stringify(ids)})`);
  assert(new Set(ids).size === ids.length, 'no id is handed out twice, even to the ambiguous pair');
  assert(m.town.nextId === Math.max(...ids) + 1, `town.nextId sits past the high-water mark (${m.town.nextId})`);
  // NOTHING BUT the id and the resolved parent may differ. This is the whole lossless claim.
  const strip = (t) => { const { id, parent, ...rest } = t; return rest; };
  assert(JSON.stringify(allItems(v23).map(strip)) === JSON.stringify(allItems(m).map(strip)),
    'every other field of every placement — x, row, scale, plane, y, slot, at — is byte-identical');
  const house = m.town.areas.boohouse.items;
  const table = house.find(t => t.item === 'deco_table');
  const lamp = house.find(t => t.item === 'deco_tablelamp');
  const plant = house.find(t => t.item === 'deco_plant');
  assert(lamp.parent === table.id && plant.parent === table.id,
    `both children now name the table by ID, not by its x (${lamp.parent}/${plant.parent} vs ${table.id})`);
  assert(typeof lamp.parent === 'number', 'the parent is an id, not a place-key string');
  assert(lamp.slot === 1 && plant.slot === 0 && lamp.scale === 0.9, 'which slot each sits in, and its size, are untouched');
  assert(JSON.stringify(m.town.areas.meadow.paths) === JSON.stringify(v23.town.areas.meadow.paths), 'her painted paths are untouched');
  // sparkles: id-keyed, and the ambiguous key still paints BOTH benches it used to paint
  const mead = m.town.areas.meadow.items;
  assert(m.sparkles[String(table.id)] === today, 'a sparkle stamp is now keyed by placement id');
  assert(m.sparkles[String(mead[0].id)] === today && m.sparkles[String(mead[1].id)] === today,
    `an AMBIGUOUS key painted two benches under v23 and still paints both (${JSON.stringify(m.sparkles)})`);
  assert(Object.keys(m.sparkles).length >= before.sparkles, `no sparkle is lost (${before.sparkles} -> ${Object.keys(m.sparkles).length})`);
  // era law
  assert(JSON.stringify(m) === JSON.stringify(migrate(structuredClone(m))), 'migrating twice is byte-identical (era law)');
  assert(migrate(structuredClone(m)).town.nextId === m.town.nextId, 'and a re-migrate re-numbers nothing');
}

console.log('== an orphan is GROUNDED, never deleted ==');
{
  const orphaned = {
    version: 23, inventory: {}, stars: { total: 0, byGame: {} }, meter: 0, boxes: 0,
    town: { areas: { boohouse: { items: [
      { zone: 'boohouse', x: 0.55, row: 1, item: 'deco_teapot', plane: 'surface', parent: 'boohouse:0.55:deco_shelf_that_left', slot: 0 }
    ], paths: [] } } }
  };
  const m = migrate(structuredClone(orphaned));
  const pot = m.town.areas.boohouse.items.find(t => t.item === 'deco_teapot');
  assert(!!pot, 'a child whose parent has already gone is STILL THERE');
  assert(pot.parent === undefined && pot.slot === undefined, 'it stops being anybody\'s child');
  assert(pot.plane === 'floor' && Math.abs(pot.x - 0.55) < 0.0005, `and it stands where its parent stood (${pot.x})`);
  assert(Number.isInteger(pot.id), 'with an identity of its own');
}

// The rich QA save is a gitignored BOO1. code at the repo root. When it is absent the two
// blocks that use it say so and skip; every other claim in this suite stands on its own.
let QA_CODE = null;
try { QA_CODE = readFileSync(new URL('../bootown-qa-seed-code-for-alex.txt', import.meta.url), 'utf8').trim(); } catch {}

console.log('== the RICH QA save (a real v17 BOO1. code) ==');
{
  const code = QA_CODE;
  if (!code) {
    console.log('  · SKIPPED: bootown-qa-seed-code-for-alex.txt is not present (it is gitignored)');
  } else {
    const raw = JSON.parse(decodeURIComponent(escape(atob(code.slice('BOO1.'.length)))));
    const before = census(raw);
    const m = migrate(structuredClone(raw));
    const after = census(m);
    console.log(`  · before ${JSON.stringify(before)}  after ${JSON.stringify(after)}  (raw v${raw.version})`);
    assert(m.version === VERSION, `it reaches v${VERSION} from v${raw.version}`);
    assert(after.placements === before.placements, `every placement preserved (${before.placements} -> ${after.placements})`);
    assert(after.seats === before.seats, `every seat preserved (${before.seats} -> ${after.seats})`);
    assert(after.sparkles === before.sparkles, `every sparkle preserved (${before.sparkles} -> ${after.sparkles})`);
    const ids = allItems(m).map(t => t.id);
    assert(ids.length === after.placements && new Set(ids).size === ids.length, 'each one has its own id');
    const strip = (t) => { const { id, ...rest } = t; return rest; };
    assert(JSON.stringify(allItems(raw).map(strip)) === JSON.stringify(allItems(m).map(strip)),
      'and nothing else about any of them changed');
    assert(m.stars.total === raw.stars.total && JSON.stringify(m.inventory) === JSON.stringify(raw.inventory),
      'her stars and her collection came through untouched');
  }
}

// ============================================================================
// 2 — the behaviour, in a real browser, with the real mouse
// ============================================================================
const SAVE = (over = {}) => Object.assign({
  version: 23, name: 'Ada', age: 8, ageAsked: true, created: 1750000000000,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { deco_table: 1, deco_tablelamp: 1 },
  stars: { total: 400, byType: {}, spent: {} }, meter: 0, boxes: 0, opened: 4, stardust: 20,
  nicknames: {}, equips: {}, ledger: {}, sparkles: {},
  town: { areas: {} }, care: { bonds: {}, treats: 0 },
  delights: { hideDay: today, hideFound: true },
  request: { actives: [], lastResolvedAt: Date.now() },
  wishes: { unlocked: {} }, trophies: {}, journal: {}, customs: [],
  settings: { sound: false, music: false, voice: false, mic: false, requests: false, content: 'full' },
  seen: { ageAsked: true, boohouseSeeded: true, townFirst: true, trophyRetro: true, whatsnewVersion: 'x' }
}, over);

// A lounge with a table and a lamp SEATED on it, expressed the v23 way — a place-key parent.
// The app has to migrate that on boot; every browser block below starts from it, so the
// migration is under test in the live app and not only in Node.
const seatedLounge = () => ({ areas: { boohouse: { items: [
  { zone: 'boohouse', x: 0.20, row: 1, item: 'deco_table', plane: 'floor' },
  { zone: 'boohouse', x: 0.20, row: 1, item: 'deco_tablelamp', plane: 'surface', parent: 'boohouse:0.2:deco_table', slot: 1 }
], paths: [] } } });

const browser = await chromium.launch();
async function open(save, { room = 'lounge' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await enterRoom(page, room);
  return { ctx, page };
}
async function enterRoom(page, room = 'lounge') {
  await page.evaluate(r => window.BooTown.go('town', { area: 'boohouse', room: r }), room);
  await page.waitForSelector('.town2', { timeout: 15000 });
  await page.waitForFunction(() => window.__townLife, { timeout: 8000 });
  // Trap paid for in RUN21D: a growth reveal can be waiting over the scene on mount.
  await page.evaluate(() => document.querySelectorAll('.overlay.growth-reveal, .funfair-reveal').forEach(n => n.remove()));
  await sleep(400);
}
const boxOf = (page, itemId) => page.evaluate(id => {
  const n = [...document.querySelectorAll('.t-item')].find(w => w.dataset.item === id);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}, itemId);
// The one thing that says "the lamp is ON the table": its drawn base rests on the table's
// drawn surface. Read off the ART, the way r19z6-objectmodel does, so it can never go stale
// against a constant in data/surfaces.js.
const surfaceGap = (page) => page.evaluate(() => {
  const table = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === 'deco_table');
  const lamp = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === 'deco_tablelamp');
  if (!table || !lamp) return null;
  const tr = table.getBoundingClientRect(), lr = lamp.getBoundingClientRect();
  const surface = tr.top + (56 / 130) * tr.height;          // the table top is drawn at viewBox y=56
  const svg = lamp.querySelector('svg');
  let y1 = -1e9;
  if (svg) for (const n of svg.querySelectorAll('path,rect,circle,ellipse,line,polygon,polyline')) {
    let b; try { b = n.getBBox(); } catch { continue; }
    if (!b || (!b.width && !b.height)) continue;
    y1 = Math.max(y1, b.y + b.height);
  }
  const lampArtBottom = svg && y1 > -1e8 ? lr.top + y1 * (lr.height / 130) : lr.bottom;
  return { gap: Math.round(lampArtBottom - surface), dx: Math.round((lr.left + lr.width / 2) - (tr.left + tr.width / 2)) };
});
// WHERE a finger can actually land on this thing. A table's own centre is under the lamp
// standing on it — the child's whole point — and the lamp draws one z-index in front, so a
// press at the centre grabs the LAMP. This hit-tests a grid inside the item's box and returns
// the first point at which the topmost `.t-item` really is the one we mean.
const grabPoint = (page, itemId) => page.evaluate(id => {
  const n = [...document.querySelectorAll('.t-item')].find(w => w.dataset.item === id);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  for (const fy of [0.82, 0.7, 0.5, 0.9]) for (const fx of [0.14, 0.86, 0.3, 0.7, 0.5]) {
    const x = r.left + r.width * fx, y = r.top + r.height * fy;
    const hit = document.elementFromPoint(x, y);
    const owner = hit && hit.closest ? hit.closest('.t-item') : null;
    if (owner === n) return { x, y };
  }
  return null;
}, itemId);
// A real drag of a placed item, by the mouse, exactly as her finger does it: past the 10px
// threshold that turns a press into a drag, then across, then let go.
async function dragItem(page, itemId, dx, dy = 0) {
  const g = await grabPoint(page, itemId);
  if (!g) return false;
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 16, g.y, { steps: 3 });        // cross the drag threshold
  await page.mouse.move(g.x + dx, g.y + dy, { steps: 8 });
  await page.mouse.up();
  await sleep(450);
  return true;
}
const placementsOf = (page) => page.evaluate(() => window.__townLife.placements());

console.log('== the RICH QA save through the REAL restore path: readSaveText + adoptSave ==');
if (!QA_CODE) {
  console.log('  · SKIPPED: the QA code is not present');
} else {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  const adopted = await page.evaluate(async (code) => {
    const S = window.BooTown.State;
    const read = S.readSaveText(code);
    if (!read.ok) return { error: read.error };
    const res = S.adoptSave(read.save);
    const s = S.getState();
    const items = Object.values((s.town && s.town.areas) || {}).flatMap(a => (a && a.items) || []);
    // and it is what is on disk afterwards, not only what is in memory
    const disk = JSON.parse(localStorage.getItem('bootown.save.v1'));
    const diskItems = Object.values((disk.town && disk.town.areas) || {}).flatMap(a => (a && a.items) || []);
    return {
      ok: res.ok, version: s.version, nextId: s.town.nextId,
      placements: items.length, seats: items.filter(t => t.parent != null).length,
      sparkles: Object.keys(s.sparkles || {}).length,
      ids: items.map(t => t.id), stars: s.stars.total, inventory: Object.keys(s.inventory || {}).length,
      diskVersion: disk.version, diskPlacements: diskItems.length, diskIds: diskItems.map(t => t.id)
    };
  }, QA_CODE);
  const rawQA = JSON.parse(decodeURIComponent(escape(atob(QA_CODE.slice('BOO1.'.length)))));
  const expect = census(rawQA);
  assert(adopted.ok, `readSaveText + adoptSave accept the QA code (${adopted.error || 'ok'})`);
  assert(adopted.version === 24, `and it lands at v24 (${adopted.version})`);
  assert(adopted.placements === expect.placements, `every placement is there (${expect.placements} -> ${adopted.placements})`);
  assert(adopted.seats === expect.seats, `every seat is there (${expect.seats} -> ${adopted.seats})`);
  assert(adopted.sparkles === expect.sparkles, `every sparkle is there (${expect.sparkles} -> ${adopted.sparkles})`);
  assert(adopted.stars === rawQA.stars.total, `her stars came through (${adopted.stars})`);
  assert(new Set(adopted.ids).size === adopted.ids.length && adopted.ids.every(Number.isInteger),
    `each placement has its own id (${JSON.stringify(adopted.ids)})`);
  assert(adopted.diskVersion === 24 && adopted.diskPlacements === expect.placements
    && JSON.stringify(adopted.diskIds) === JSON.stringify(adopted.ids),
    'and the v24 save with its ids is what was actually WRITTEN to localStorage');
  // it renders: walk into each area she has something in and count the wraps
  const rendered = await page.evaluate(async () => {
    const s = window.BooTown.State.getState();
    const out = {};
    for (const key of Object.keys(s.town.areas)) {
      const n = (s.town.areas[key].items || []).length;
      if (!n) continue;
      const room = key === 'boohouse_kitchen' ? 'kitchen' : key === 'boohouse_bedroom' ? 'bedroom' : 'lounge';
      const area = key.startsWith('boohouse') ? 'boohouse' : key;
      window.BooTown.go('town', area === 'boohouse' ? { area, room } : { area });
      await new Promise(r => setTimeout(r, 1200));
      document.querySelectorAll('.overlay.growth-reveal, .funfair-reveal').forEach(x => x.remove());
      out[key] = { expected: n, wraps: document.querySelectorAll('.t-item').length,
                   withId: [...document.querySelectorAll('.t-item')].filter(w => w.dataset.pid).length };
    }
    return out;
  });
  for (const [key, r] of Object.entries(rendered)) {
    assert(r.wraps >= r.expected, `${key}: all ${r.expected} of her things render (${r.wraps} wraps)`);
    assert(r.withId === r.wraps, `${key}: and every rendered thing carries its placement id (${r.withId}/${r.wraps})`);
  }
  await page.screenshot({ path: `${SHOTS}/00-rich-qa-save-adopted-1024x768.png` });
  await ctx.close();
}

console.log('== the seat survives the boot migration, in the live app ==');
let boot = null;
{
  const { ctx, page } = await open(SAVE({ town: seatedLounge() }));
  boot = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { version: s.version, nextId: s.town.nextId, items: window.__townLife.placements() };
  });
  const table = boot.items.find(t => t.item === 'deco_table');
  const lamp = boot.items.find(t => t.item === 'deco_tablelamp');
  assert(boot.version === 24, `the app migrated the save to v24 on boot (${boot.version})`);
  assert(Number.isInteger(table.id) && Number.isInteger(lamp.id) && table.id !== lamp.id, 'both placements have their own id');
  assert(lamp.parent === table.id, `the lamp's place-key parent became the table's id (${lamp.parent} vs ${table.id})`);
  assert(lamp.plane === 'surface' && lamp.slot === 1, 'and it is still seated in slot 1');
  const gap0 = await surfaceGap(page);
  assert(gap0 && Math.abs(gap0.gap) <= 2, `it makes contact with the table's surface (${gap0 && gap0.gap}px off)`);
  await page.screenshot({ path: `${SHOTS}/01-seated-after-migration-1024x768.png` });
  await ctx.close();
}

console.log('== ACCEPT: move a table -> the lamp travels with it ==');
{
  const { ctx, page } = await open(SAVE({ town: seatedLounge() }));
  const before = await placementsOf(page);
  const bTable = before.find(t => t.item === 'deco_table');
  const bLamp = before.find(t => t.item === 'deco_tablelamp');
  const lampBoxBefore = await boxOf(page, 'deco_tablelamp');
  const tableBoxBefore = await boxOf(page, 'deco_table');
  await page.screenshot({ path: `${SHOTS}/02-before-move-1024x768.png` });
  const dragged = await dragItem(page, 'deco_table', 200);
  assert(dragged, 'the table can be picked up and dragged');
  const after = await placementsOf(page);
  const aTable = after.find(t => t.item === 'deco_table');
  const aLamp = after.find(t => t.item === 'deco_tablelamp');
  const lampBoxAfter = await boxOf(page, 'deco_tablelamp');
  const tableBoxAfter = await boxOf(page, 'deco_table');
  await page.screenshot({ path: `${SHOTS}/03-after-move-1024x768.png` });
  assert(after.length === before.length, `nothing was lost by the move (${before.length} -> ${after.length})`);
  assert(aTable.x > bTable.x + 0.02, `the table really moved (${bTable.x} -> ${aTable.x})`);
  assert(aTable.id === bTable.id && aLamp.id === bLamp.id, 'both keep the identities they had');
  assert(aLamp.parent === aTable.id, `THE ITEM: the lamp still names the table as its parent (${aLamp.parent} vs ${aTable.id})`);
  assert(aLamp.plane === 'surface' && aLamp.slot === bLamp.slot, `and it is still seated in the same slot (plane ${aLamp.plane}, slot ${aLamp.slot})`);
  const gap = await surfaceGap(page);
  assert(gap && Math.abs(gap.gap) <= 2, `it is re-rendered standing ON the table at its new spot (${gap && gap.gap}px off)`);
  const tableMovedPx = Math.round(tableBoxAfter.x - tableBoxBefore.x);
  const lampMovedPx = Math.round(lampBoxAfter.x - lampBoxBefore.x);
  assert(Math.abs(tableMovedPx) > 80, `the table moved a real distance on screen (${tableMovedPx}px)`);
  assert(Math.abs(lampMovedPx - tableMovedPx) <= 4, `the lamp travelled with it, pixel for pixel (lamp ${lampMovedPx}px vs table ${tableMovedPx}px)`);
  assert(Math.abs(aLamp.x - aTable.x) < 0.0015, `and its stored x rode along too, so a later put-away knows where the table ENDED (${aLamp.x} vs ${aTable.x})`);
  await ctx.close();
}

console.log('== ACCEPT: put the table away -> the lamp grounds at the table\'s LAST spot ==');
{
  const { ctx, page } = await open(SAVE({ town: seatedLounge() }));
  await dragItem(page, 'deco_table', 200);
  const moved = await placementsOf(page);
  const movedTableX = moved.find(t => t.item === 'deco_table').x;
  const startX = 0.20;
  assert(movedTableX > startX + 0.02, `the table is no longer where it started (${startX} -> ${movedTableX})`);
  // Put it away through the real menu: tap the table, then its "Put away" button.
  const tb = await grabPoint(page, 'deco_table');
  assert(!!tb, 'the table is tappable where the lamp is not covering it');
  await page.mouse.move(tb.x, tb.y);
  await page.mouse.down(); await page.mouse.up();
  await sleep(400);
  const putAway = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.plot-menu button')].find(n => /put away/i.test(n.textContent));
    if (!b) return false;
    b.click();
    return true;
  });
  assert(putAway, 'the table\'s own menu offers Put away');
  await sleep(500);
  const after = await placementsOf(page);
  const lamp = after.find(t => t.item === 'deco_tablelamp');
  await page.screenshot({ path: `${SHOTS}/04-after-put-away-1024x768.png` });
  assert(!after.some(t => t.item === 'deco_table'), 'the table has gone back to the drawer');
  assert(!!lamp, 'the lamp is STILL THERE — nothing she placed is ever deleted');
  assert(lamp.parent === undefined && lamp.slot === undefined, 'it is nobody\'s child now');
  assert(lamp.plane === 'floor', `it is standing on the floor (${lamp.plane})`);
  assert(Math.abs(lamp.x - movedTableX) < 0.0015,
    `at the table's LAST spot, not its first (lamp ${lamp.x}, table ended at ${movedTableX}, started at ${startX})`);
  await ctx.close();
}

console.log('== ACCEPT: reload mid-everything -> intact ==');
{
  const { ctx, page } = await open(SAVE({ town: seatedLounge() }));
  // mid-everything: move the table, sprinkle it, then reload before anything settles
  await dragItem(page, 'deco_table', 160);
  await page.evaluate(() => window.__townLife.openPlayCardFor('deco_table'));
  await sleep(300);
  await page.evaluate(async () => {
    const b = [...document.querySelectorAll('.play-card button')].find(n => /Sprinkle/.test(n.textContent));
    if (b) b.click();
    await new Promise(r => setTimeout(r, 300));
    const yes = [...document.querySelectorAll('.overlay .dialog button')].find(n => /Yes please/.test(n.textContent));
    if (yes) yes.click();
  });
  await sleep(500);
  const before = await page.evaluate(() => ({
    items: window.__townLife.placements(), sparkles: window.__townLife.sparkleKeys(),
    nextId: window.__townLife.nextId(), sparkling: window.__townLife.sparkling()
  }));
  assert(before.sparkling.includes('deco_table'), `the moved table is sparkling before the reload (${JSON.stringify(before.sparkling)})`);
  assert(before.sparkles.length === 1 && /^\d+$/.test(before.sparkles[0]), `the stamp is keyed by placement id (${JSON.stringify(before.sparkles)})`);
  await page.evaluate(async () => { const s = await import('./js/state.js'); s.commit(); });   // past the 2s debounce
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await enterRoom(page, 'lounge');
  const after = await page.evaluate(() => ({
    version: window.BooTown.State.getState().version,
    items: window.__townLife.placements(), sparkles: window.__townLife.sparkleKeys(),
    nextId: window.__townLife.nextId(), sparkling: window.__townLife.sparkling()
  }));
  await page.screenshot({ path: `${SHOTS}/05-after-reload-1024x768.png` });
  assert(after.version === 24, 'the reloaded save is v24');
  assert(JSON.stringify(after.items) === JSON.stringify(before.items),
    `every placement came back exactly as it was — id, parent, slot, plane and all\n      before ${JSON.stringify(before.items)}\n      after  ${JSON.stringify(after.items)}`);
  assert(JSON.stringify(after.sparkles) === JSON.stringify(before.sparkles), 'and so did the sparkle, still keyed by the same id');
  assert(after.sparkling.includes('deco_table'), 'which means the table is still sparkling');
  assert(after.nextId === before.nextId, `the id counter came back where it was (${before.nextId} -> ${after.nextId})`);
  const gap = await surfaceGap(page);
  assert(gap && Math.abs(gap.gap) <= 2, `and the lamp is still standing on the table (${gap && gap.gap}px off)`);
  await ctx.close();
}

console.log('== a new placement is born with an id, and the counter advances ==');
{
  const { ctx, page } = await open(SAVE({ inventory: { deco_table: 1, deco_tablelamp: 2 }, town: seatedLounge() }));
  const before = await page.evaluate(() => window.__townLife.nextId());
  const added = await page.evaluate(async () => {
    const before = window.__townLife.placements().length;
    window.BooTown.go('town', { area: 'boohouse', room: 'lounge', place: 'deco_tablelamp' });
    await new Promise(r => setTimeout(r, 700));
    const vp = document.querySelector('.t-viewport').getBoundingClientRect();
    return { before, x: vp.left + vp.width * 0.75, y: vp.top + vp.height * 0.80 };
  });
  await page.mouse.click(added.x, added.y);
  await sleep(600);
  const after = await page.evaluate(() => ({ items: window.__townLife.placements(), nextId: window.__townLife.nextId() }));
  const ids = after.items.map(t => t.id);
  assert(after.items.length === added.before + 1, `the new lamp is placed (${added.before} -> ${after.items.length})`);
  assert(ids.every(Number.isInteger) && new Set(ids).size === ids.length, `every placement still has a unique id (${JSON.stringify(ids)})`);
  assert(after.nextId === before + 1, `the counter advanced exactly once (${before} -> ${after.nextId})`);
  assert(Math.max(...ids) < after.nextId, 'and it stays ahead of every id in the save');
  await ctx.close();
}

console.log('== the undo stack round-trips ids ==');
{
  const { ctx, page } = await open(SAVE({ town: seatedLounge() }));
  const before = await placementsOf(page);
  const bTable = before.find(t => t.item === 'deco_table');
  await dragItem(page, 'deco_table', 200);
  const mid = await placementsOf(page);
  assert(mid.find(t => t.item === 'deco_table').x > bTable.x + 0.02, 'the table moved');
  const undone = await page.evaluate(async () => {
    const ok = window.__townLife.undo();
    await new Promise(r => setTimeout(r, 400));
    return { ok, items: window.__townLife.placements() };
  });
  const uTable = undone.items.find(t => t.item === 'deco_table');
  const uLamp = undone.items.find(t => t.item === 'deco_tablelamp');
  assert(undone.ok, 'Undo takes the move back');
  assert(undone.items.length === before.length, `and loses nothing doing it (${before.length} -> ${undone.items.length})`);
  assert(uTable.id === bTable.id, `the restored table is the SAME table (id ${uTable.id})`);
  assert(Math.abs(uTable.x - bTable.x) < 0.0015, `back where it was (${uTable.x} vs ${bTable.x})`);
  assert(uLamp.parent === uTable.id, 'so the lamp is still standing on it, not orphaned by the undo');
  assert(Math.abs(uLamp.x - uTable.x) < 0.0015, 'and the lamp came back with it');
  const gap = await surfaceGap(page);
  assert(gap && Math.abs(gap.gap) <= 2, `rendered seated again (${gap && gap.gap}px off)`);
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors or page errors throughout');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
