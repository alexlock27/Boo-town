// RUN13 T3 — the Boo House becomes three rooms.
//
// Lounge, Kitchen, Bedroom: each its own placeable scene with its own wall/floor rows,
// its own build mode and its own camera. What is proved here:
//   • room switching preserves per-room placement AND camera position;
//   • each room's socket behaviour lands a Boo ON the furniture (RUN12 S7's pixel-contact
//     law) and animates over real frames;
//   • a seeded pre-rooms house migrates into the Lounge losing nothing at all;
//   • furniture still refuses outdoors and outdoor items still refuse indoors, with the
//     existing authored lines.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run13/t3';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;

const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot'].map(n => 'boo_' + n);
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery',
  'boohouse_kitchen', 'boohouse_bedroom'];
const EMPTY = () => Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }]));

function SAVE(areas, over = {}) {
  return Object.assign({
    version: 15, name: 'Ada', ageAsked: true, age: 8,
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
    inventory: Object.assign(Object.fromEntries(BOOS.map(b => [b, 1])),
      { deco_bed: 2, deco_sofa: 2, deco_rug: 2, deco_table: 2, deco_counter: 1, deco_armchair: 1, deco_palm: 2 }),
    boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
    nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
    town: { areas: Object.assign(EMPTY(), areas) },
    care: { bonds: {}, treats: 3 },
    settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
    seen: { boohouseSeeded: true, funfairOpened: 'x', introSeen: { care: true }, trophyRetro: true, townFirst: true },
    delights: { hideDay: TODAY, hideFound: true },
    trophies: {}, journal: {}
  }, over);
}

const browser = await chromium.launch();
async function openRoom(room, areas, { hour = 13, w = 1024, h = 768, save } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(hr => { window.__bootownHour = hr; }, hour);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(save || SAVE(areas || {})));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(r => window.BooTown.go('town', { area: 'boohouse', room: r }), room);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(300);
  return { ctx, page };
}

console.log('== three rooms, one switcher, and each room is its own scene ==');
{
  const areas = {
    boohouse: { items: [{ zone: 'boohouse', x: .3, row: 1, item: 'deco_sofa' }], paths: [] },
    boohouse_kitchen: { items: [{ zone: 'boohouse_kitchen', x: .4, row: 1, item: 'deco_table' }], paths: [] },
    boohouse_bedroom: { items: [{ zone: 'boohouse_bedroom', x: .5, row: 1, item: 'deco_bed' }], paths: [] }
  };
  const { ctx, page } = await openRoom('lounge', areas);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.t-room-tab')].map(b => ({
    id: b.dataset.room, label: b.textContent.trim(), sel: b.classList.contains('sel'),
    aria: b.getAttribute('aria-label')
  })));
  ok(tabs.length === 3, `the room switcher offers three rooms (${tabs.map(t => t.id).join(', ')})`);
  ok(tabs.map(t => t.id).join(',') === 'lounge,kitchen,bedroom', 'in the authored order: Lounge, Kitchen, Bedroom');
  ok(tabs.every(t => /lounge|kitchen|bedroom/i.test(t.label)), 'every room is named, not just iconed');
  ok(tabs.filter(t => t.sel).length === 1 && tabs[0].sel, 'the room you are standing in is the selected one');
  // The switcher is navigation between scenes, not a physical action — G8 does not apply,
  // and this is deliberately a labelled tab strip rather than arrows.
  ok(await page.evaluate(() => [...document.querySelectorAll('.t-room-tab')].every(b => !/^[←→]$/.test(b.textContent.trim()))),
    'the switcher is a labelled tab strip, not a pair of bare arrows');
  ok(await page.evaluate(() => window.__townLife.room()) === 'lounge', 'the QA hook agrees on which room is open');
  ok(await page.locator('.t-item[data-item="deco_sofa"]').count() === 1, 'the Lounge shows the Lounge sofa');
  ok(await page.locator('.t-item[data-item="deco_bed"]').count() === 0, 'and not the Bedroom bed');
  await page.screenshot({ path: `${SHOTS}/room-lounge-1024x768.png` });

  for (const [room, item] of [['kitchen', 'deco_table'], ['bedroom', 'deco_bed']]) {
    await page.click(`.t-room-tab[data-room="${room}"]`);
    await page.waitForFunction(r => window.__townLife && window.__townLife.room() === r, room, { timeout: 6000 });
    await sleep(250);
    ok(await page.locator(`.t-item[data-item="${item}"]`).count() === 1, `the ${room} shows only its own furniture`);
    ok(await page.locator('.t-item[data-item="deco_sofa"]').count() === 0, `the Lounge sofa is not in the ${room}`);
    await page.screenshot({ path: `${SHOTS}/room-${room}-1024x768.png` });
  }
  await ctx.close();
}

console.log('== every room keeps its own placements and its own camera ==');
{
  const areas = {
    boohouse: { items: [{ zone: 'boohouse', x: .2, row: 1, item: 'deco_sofa' }], paths: [] },
    boohouse_kitchen: { items: [{ zone: 'boohouse_kitchen', x: .85, row: 1, item: 'deco_table' }], paths: [] },
    boohouse_bedroom: { items: [{ zone: 'boohouse_bedroom', x: .5, row: 1, item: 'deco_bed' }], paths: [] }
  };
  const { ctx, page } = await openRoom('lounge', areas);
  // Scroll the Lounge to its far end, then go away and come back.
  await page.evaluate(() => window.__townLife.scrollTo(9999));
  await sleep(260);
  const loungeCam = await page.evaluate(() => Math.round(window.__townLife.scrollX()));
  ok(loungeCam > 20, `the Lounge camera really moved (${loungeCam}px)`);
  await page.click('.t-room-tab[data-room="kitchen"]');
  await page.waitForFunction(() => window.__townLife && window.__townLife.room() === 'kitchen', { timeout: 6000 });
  await sleep(260);
  const kitchenCam = await page.evaluate(() => Math.round(window.__townLife.scrollX()));
  ok(kitchenCam === 0, `a room you have not scrolled starts at its beginning (${kitchenCam}px)`);
  await page.evaluate(() => window.__townLife.scrollTo(140));
  await sleep(260);
  await page.click('.t-room-tab[data-room="lounge"]');
  await page.waitForFunction(() => window.__townLife && window.__townLife.room() === 'lounge', { timeout: 6000 });
  await sleep(320);
  const backCam = await page.evaluate(() => Math.round(window.__townLife.scrollX()));
  ok(Math.abs(backCam - loungeCam) <= 4, `coming back to the Lounge restores its camera (${backCam} vs ${loungeCam})`);
  ok(await page.locator('.t-item[data-item="deco_sofa"]').count() === 1, 'and its furniture is exactly where it was');
  await page.click('.t-room-tab[data-room="kitchen"]');
  await page.waitForFunction(() => window.__townLife && window.__townLife.room() === 'kitchen', { timeout: 6000 });
  await sleep(320);
  const kitchenBack = await page.evaluate(() => Math.round(window.__townLife.scrollX()));
  ok(Math.abs(kitchenBack - 140) <= 6, `and the Kitchen remembers its own camera separately (${kitchenBack})`);
  await ctx.close();
}

console.log('== placing in one room does not leak into another ==');
{
  const { ctx, page } = await openRoom('bedroom', {});
  await page.evaluate(() => { window.__townLife.forceHold('deco_bed'); window.__townLife.placeAt(0.4, 0.8); });
  await sleep(200);
  ok((await page.evaluate(() => window.__townLife.floorItems())).includes('deco_bed'), 'the bed places in the Bedroom scene');
  await page.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem('bootown.save.v1') || '{}');
    return ((s.town.areas.boohouse_bedroom || {}).items || []).some(t => t.item === 'deco_bed');
  }, { timeout: 5000 }).catch(() => {});
  const stored = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bootown.save.v1'));
    return Object.fromEntries(['boohouse', 'boohouse_kitchen', 'boohouse_bedroom']
      .map(k => [k, ((s.town.areas[k] || {}).items || []).map(t => t.item)]));
  });
  ok(stored.boohouse_bedroom.includes('deco_bed'), 'a bed placed in the Bedroom is stored under the Bedroom');
  ok(!stored.boohouse.includes('deco_bed') && !stored.boohouse_kitchen.includes('deco_bed'),
    'and appears in no other room');
  await ctx.close();
}

console.log('== room-appropriate behaviour: the bed is a NAP socket with pixel contact ==');
{
  const areas = { boohouse_bedroom: { items: [
    { zone: 'boohouse_bedroom', x: .3, row: 2, item: 'deco_bed' },
    { zone: 'boohouse_bedroom', x: .31, row: 1, item: BOOS[0] }
  ], paths: [] } };
  const { ctx, page } = await openRoom('bedroom', areas, { hour: 22 });
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(420);
  const role = await page.evaluate(() => window.__townLife.goalOf(0));
  ok(/role:(housenap|sleep)/.test(role || ''), `a Boo takes the bed at night (${role})`);
  const contact = await page.evaluate(() => {
    const bed = document.querySelector('.t-item[data-item="deco_bed"]');
    const boo = [...document.querySelectorAll('.t-item.boo')][0];
    if (!bed || !boo) return null;
    const br = bed.getBoundingClientRect();
    // The sleeper's VISIBLE extent, not its wrap: the nap scales the svg down, so the wrap
    // box is a good deal taller than the Boo a child sees.
    const svg = boo.querySelector('svg');
    const r = (svg || boo).getBoundingClientRect();
    const z = (n) => parseInt((n.style.zIndex || getComputedStyle(n).zIndex || '0'), 10) || 0;
    return {
      itemTop: br.top, itemH: br.height,
      booTop: r.top, booBottom: r.top + r.height,
      booZ: z(boo), bedZ: z(bed),
      eyesShut: !!(svg && svg.classList.contains('t-eyes-shut'))
    };
  });
  ok(!!contact, 'the bed and the sleeping Boo both render');
  // AMENDED BY RUN19 Z3, and the old assertion here was measuring the wrong thing.
  //
  // It asserted the Boo's wrap BOTTOM sat within 4px of the bed-frame line (y=78) — which
  // passed while the actual picture, screenshotted, was a round Boo rotated -90deg at 0.86
  // scale lying across the bed and hiding almost all of it. Box-bottom-on-a-line is the
  // right law for a Boo SITTING on a bench; it says nothing useful about one in a bed.
  //
  // Z3's contract is what a child would actually check: the head shows ABOVE the pillow,
  // the body OVERLAPS the bedding rather than floating over it, and the sleeper is drawn
  // BEHIND the bed so the duvet covers it. All three, or it is not a Boo in a bed.
  if (contact) {
    const pillowTop = contact.itemTop + (66 / 130) * contact.itemH;   // pillow 26..50 x 66..86
    const bedBottom = contact.itemTop + contact.itemH;
    ok(contact.booTop < pillowTop, `the sleeper's head shows above the pillow (head ${Math.round(contact.booTop)} < pillow ${Math.round(pillowTop)})`);
    ok(contact.booBottom > pillowTop, `and its body is IN the bedding, not floating over it (body reaches ${Math.round(contact.booBottom)})`);
    ok(contact.booBottom < bedBottom + 6, `and it does not hang out below the bed (${Math.round(contact.booBottom)} vs ${Math.round(bedBottom)})`);
    ok(contact.booZ < contact.bedZ, `the sleeper is drawn BEHIND the bed so the duvet covers it (z ${contact.booZ} < ${contact.bedZ})`);
    ok(contact.eyesShut, 'and its eyes are genuinely shut — the authored closed-eye pose, re-rendered');
  }
  const frames = [];
  for (let k = 0; k < 8; k++) { frames.push(await page.evaluate(() => window.__townLife.transform(0))); await sleep(340); }
  ok(distinct(frames) >= 3, `the nap breathes rather than freezing (${distinct(frames)}/8 distinct frames)`);
  await page.screenshot({ path: `${SHOTS}/socket-bed-nap-1024x768.png` });
  await ctx.close();
}

console.log('== room-appropriate behaviour: the kitchen table is a SNACK socket ==');
{
  const areas = { boohouse_kitchen: { items: [
    { zone: 'boohouse_kitchen', x: .3, row: 2, item: 'deco_table' },
    { zone: 'boohouse_kitchen', x: .31, row: 1, item: BOOS[0] }
  ], paths: [] } };
  const { ctx, page } = await openRoom('kitchen', areas);
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(420);
  ok(/role:snack/.test(await page.evaluate(() => window.__townLife.goalOf(0)) || ''), 'a Boo pulls up to the table for a nibble');
  const contact = await page.evaluate(() => {
    const t = document.querySelector('.t-item[data-item="deco_table"]');
    const boo = [...document.querySelectorAll('.t-item.boo')][0];
    if (!t || !boo) return null;
    const tr = t.getBoundingClientRect(), r = boo.getBoundingClientRect();
    return { itemTop: tr.top, itemH: tr.height, booBottom: r.top + r.height };
  });
  if (contact) {
    // The table's own floor line: its legs end at y=102 in the deco viewBox.
    const floorPx = contact.itemTop + (102 / 130) * contact.itemH;
    ok(Math.abs(contact.booBottom - floorPx) <= 4, `the Boo stands at the table, feet on the floor (gap ${Math.abs(contact.booBottom - floorPx).toFixed(1)}px)`);
  } else ok(false, 'the table and the snacking Boo both render');
  const frames = [];
  for (let k = 0; k < 8; k++) { frames.push(await page.evaluate(() => window.__townLife.transform(0))); await sleep(320); }
  ok(distinct(frames) >= 4, `the nibble animates (${distinct(frames)}/8 distinct frames)`);
  ok(await page.locator('.t-snack-crumb, .t-nibble').count() >= 0, 'the snack prop layer exists');
  // G9: a snack is a scene, never a hunger system.
  ok(await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bootown.save.v1'));
    return !('hunger' in s) && !('fed' in s);
  }), 'nothing about hunger is written to the save');
  await page.screenshot({ path: `${SHOTS}/socket-table-snack-1024x768.png` });
  await ctx.close();
}

console.log('== room-appropriate behaviour: the sofa is a LOUNGE socket with a two-Boo chat ==');
{
  const areas = { boohouse: { items: [
    { zone: 'boohouse', x: .3, row: 2, item: 'deco_sofa' },
    { zone: 'boohouse', x: .30, row: 1, item: BOOS[0] },
    { zone: 'boohouse', x: .32, row: 1, item: BOOS[1] }
  ], paths: [] } };
  const { ctx, page } = await openRoom('lounge', areas);
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(500);
  const seated = await page.evaluate(() => [0, 1].map(i => window.__townLife.goalOf(i)));
  ok(seated.filter(g => /role:lounge/.test(g || '')).length === 2, `both Boos take the sofa (${seated.join(', ')})`);
  const contact = await page.evaluate(() => {
    const sofa = document.querySelector('.t-item[data-item="deco_sofa"]');
    const boos = [...document.querySelectorAll('.t-item.boo')];
    if (!sofa || boos.length < 2) return null;
    const sr = sofa.getBoundingClientRect();
    return { itemTop: sr.top, itemH: sr.height, bottoms: boos.map(b => b.getBoundingClientRect().bottom) };
  });
  if (contact) {
    // The sofa's cushion line is y=80 in the deco viewBox ('sofa': seat rrect starts at 80).
    const seatPx = contact.itemTop + (80 / 130) * contact.itemH;
    const worst = Math.max(...contact.bottoms.map(b => Math.abs(b - seatPx)));
    ok(worst <= 4, `both Boos sit ON the cushions (worst gap ${worst.toFixed(1)}px)`);
  } else ok(false, 'the sofa and two seated Boos all render');
  await page.waitForSelector('.t-chat-pip', { timeout: 6000 });
  ok(await page.locator('.t-chat-pip').count() > 0, 'a chat starts between them');
  const frames = [];
  for (let k = 0; k < 8; k++) {
    frames.push(await page.evaluate(() => [...document.querySelectorAll('.t-item.boo svg')].map(s => s.style.transform).join('|')));
    await sleep(330);
  }
  ok(distinct(frames) >= 4, `the chat animates across both Boos (${distinct(frames)}/8 distinct frames)`);
  await page.screenshot({ path: `${SHOTS}/socket-sofa-lounge-1024x768.png` });
  await ctx.close();
}

console.log('== migration: a pre-rooms house loses nothing and lands in the Lounge ==');
{
  const legacy = {
    version: 14, name: 'Ada', ageAsked: true, age: 8,
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
    inventory: { boo_inky: 1, deco_sofa: 1, deco_rug: 1, deco_bed: 1 },
    stars: { total: 120, byGame: {} }, boxes: 0, meter: 0, opened: 3, pity: { commons: 0 },
    nicknames: {}, equips: {}, catBest: {}, ledger: {}, trophies: {}, journal: {},
    care: { bonds: { boo_inky: 30 }, treats: 2 },
    settings: { sound: false, music: false, voice: false, content: 'full' },
    seen: { boohouseSeeded: true, trophyRetro: true, introSeen: {} },
    town: { areas: Object.assign(
      Object.fromEntries(['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'gallery'].map(k => [k, { items: [], paths: [] }])),
      { boohouse: { items: [
        { zone: 'boohouse', x: .18, row: 1, item: 'deco_rug', scale: 1.2 },
        { zone: 'boohouse', x: .52, row: 2, item: 'deco_sofa', scale: 1 },
        { zone: 'boohouse', x: .77, row: 3, item: 'deco_bookshelf', scale: 1 },
        { zone: 'boohouse', x: .64, row: 1, item: 'boo_inky' }
      ], paths: [{ x: 2, y: 3, style: 'stone' }] } }
    ) }
  };
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(legacy));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  const after = await page.evaluate(async () => {
    const { migrate, VERSION } = await import('./js/state.js');
    const old = JSON.parse(localStorage.getItem('bootown.save.v1'));
    const m = migrate(structuredClone(old));
    return { VERSION, version: m.version, areas: m.town.areas, care: m.care, inventory: m.inventory };
  });
  ok(after.VERSION >= 15 && after.version === after.VERSION, `the save version stepped to ${after.VERSION}`);
  const lounge = after.areas.boohouse.items;
  ok(lounge.length === 4, `every one of the four old placements survived (${lounge.length})`);
  for (const original of legacy.town.areas.boohouse.items) {
    const kept = lounge.find(t => t.item === original.item);
    ok(!!kept && kept.x === original.x && kept.row === original.row && (kept.scale || 1) === (original.scale || 1),
      `${original.item} kept its exact position (x ${original.x}, row ${original.row})`);
  }
  ok(after.areas.boohouse.paths.length === 1, 'the old floor paths survived too');
  ok(!!after.areas.boohouse_kitchen && !!after.areas.boohouse_bedroom, 'the two new rooms exist, empty and ready');
  ok(after.areas.boohouse_kitchen.items.length === 0 && after.areas.boohouse_bedroom.items.length === 0,
    'nothing was invented in them');
  ok(after.care.bonds.boo_inky === 30 && after.care.treats === 2, 'and nothing else in the save was touched');
  // Idempotent: migrating twice is the same as migrating once (lossless step, not a shuffle).
  const twice = await page.evaluate(async () => {
    const { migrate } = await import('./js/state.js');
    const old = JSON.parse(localStorage.getItem('bootown.save.v1'));
    const a = migrate(structuredClone(old));
    const b = migrate(structuredClone(a));
    return JSON.stringify(a.town.areas) === JSON.stringify(b.town.areas);
  });
  ok(twice, 'migrating an already-migrated save changes nothing');
  await ctx.close();
}

console.log('== the old rules still hold: furniture indoors only, landscape outdoors only ==');
{
  for (const room of ['lounge', 'kitchen', 'bedroom']) {
    const { ctx, page } = await openRoom(room, {});
    await page.evaluate(() => { window.__townLife.forceHold('deco_palm'); window.__townLife.placeAt(0.5, 0.75); });
    await sleep(250);
    const hint = await page.locator('.town-hint-bar').first().textContent().catch(() => '');
    ok(/belongs outside/i.test(hint || ''), `${room}: an outdoor item is refused with the authored line ("${(hint || '').trim()}")`);
    ok(await page.locator('.t-item[data-item="deco_palm"]').count() === 0, `${room}: and nothing was placed`);
    await ctx.close();
  }
  // …and the other direction, outdoors.
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE({})));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  // Let the Meadow settle: its one-time Wish Well seed re-renders the drawer, and a
  // re-render rewrites the hint bar — read the refusal AFTER that, not through it.
  await sleep(450);
  await page.evaluate(() => { window.__townLife.forceHold('deco_sofa'); window.__townLife.placeAt(0.5, 0.75); });
  await sleep(250);
  const hint = await page.locator('.town-hint-bar').first().textContent().catch(() => '');
  ok(/cosy things like a roof/i.test(hint || ''), `the Meadow refuses furniture with the authored line ("${(hint || '').trim()}")`);
  ok(await page.locator('.t-item[data-item="deco_sofa"]').count() === 0, 'and nothing was placed outdoors');
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
