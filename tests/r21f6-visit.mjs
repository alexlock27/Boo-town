// tests/r21f6-visit.mjs — RUN21F F6 "Visit a Town": the pack's ACCEPT, made permanent.
//
//   "export from save A, visit in save B's profile: A's placements render, B's save hash
//    unchanged after a 3-minute interaction sweep including attempted placements; Leave
//    restores B's world."
//
// It is run exactly that way: a REAL postcard is exported from save A through the world
// map's own 💌 button, pasted into save B's Grown-ups corner in a different browser context,
// and then a real mouse spends the sweep trying to change somebody else's town — tapping,
// dragging placements, long-pressing, pressing the doors, panning, walking between areas and
// into the Boo House's rooms — while every localStorage.setItem on the page is recorded.
//
// The sweep length is VISIT_SWEEP_MS (default 40s, which keeps this suite inside the board's
// 120s budget). The pack's literal three minutes is run at the gate with
// VISIT_SWEEP_MS=180000; the assertions are identical either way.
//
// Expected runtime: ~75s at the default sweep (board law: state it when adding a suite).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { createHash } from 'crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SWEEP_MS = Number(process.env.VISIT_SWEEP_MS || 40000);
const SHOTS = '_evidence/run21f6';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'boohouse_kitchen', 'boohouse_bedroom', 'gallery'];
const AREAS = () => Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }]));

// Outdoor areas are FOUR viewports wide, so anything past x≈0.25 is off-camera at the
// default scroll — and an actor that is off-camera is skipped by stepActors. Every seeded
// placement below therefore lives in the first quarter, where a real mouse can reach it.
const A_MEADOW = [
  { zone: 'meadow', x: 0.08, row: 1, item: 'boo_inky' },
  { zone: 'meadow', x: 0.16, row: 2, item: 'boo_plum' },
  { zone: 'meadow', x: 0.22, row: 0, item: 'deco_bench' },
  // a wished-for thing: minted from a word, not in the catalogue, and RUN21B gave it both a
  // tap verb and an ambient idle. It has to survive the postcard round trip too.
  { zone: 'meadow', x: 0.12, row: 0, item: 'wish_cake' }
];
const A_LOUNGE = [
  { zone: 'boohouse', x: 0.30, row: 1, item: 'deco_armchair' },
  { zone: 'boohouse', x: 0.55, row: 2, item: 'boo_lolly' }
];
const B_MEADOW = [
  { zone: 'meadow', x: 0.10, row: 1, item: 'boo_chomp' },
  { zone: 'meadow', x: 0.18, row: 2, item: 'deco_pond' }
];

const SAVE = (over = {}) => Object.assign({
  version: 23, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_chomp: 1, boo_lolly: 1, deco_bench: 1, deco_pond: 1, deco_armchair: 1 },
  stars: { total: 400, byType: {}, spent: {} },
  town: { areas: AREAS() },
  wishes: { unlocked: {} },
  funfair: { built: ['carousel'], build: null, pending: [], seats: {}, catchup: [] },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', boohouseSeeded: true, wishWellSeeded: true, jokeStageSeeded: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false }
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const pageErrors = [];
async function open(save, { w = 1024, h = 768, hour = 13 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  await page.addInitScript((hr) => {
    window.__bootownHour = hr;
    window.__copied = null;
    try {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } });
    } catch {}
    // Every write to this device's storage, recorded at the source. A visit must produce
    // none of them — this is the privacy promise measured rather than argued.
    window.__setItems = [];
    try {
      const orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k, v) => { window.__setItems.push(String(k)); return orig(k, v); };
    } catch {}
  }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 30000 });
  return { ctx, page };
}
const dismissReveal = async (page) => {
  const btn = await page.$('.overlay.growth-reveal .btn, .overlay.fair-reveal .btn');
  if (btn) { await btn.click(); await sleep(350); }
};
const saveRaw = (page) => page.evaluate(() => localStorage.getItem('bootown.save.v1'));
const gotoTown = async (page, params) => {
  await page.evaluate(p => window.BooTown.go('town', p), params);
  await page.waitForSelector('.town2', { timeout: 15000 });
  await page.waitForFunction(() => window.__town, { timeout: 8000 });
  await sleep(400);
  await dismissReveal(page);
};

// ==================== 1. the postcard, exported from save A ====================
console.log('== 1. save A shares a Town Postcard ==');
let CODE = null;
{
  const save = SAVE({
    name: 'Ada', nicknames: { boo_inky: 'Snacks' },
    equips: { boo_inky: { hat: 'acc_sunhat' } }, shinies: { boo_inky: 1 },
    dressings: { lounge: { walls: 'lounge_walls_starry' } },
    town: { areas: Object.assign(AREAS(), {
      meadow: { items: A_MEADOW, paths: [{ cx: 2, cy: 3, style: 'stone' }] },
      boohouse: { items: A_LOUNGE, paths: [] }
    }) }
  });
  const { ctx, page } = await open(save);
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'worldmap', { timeout: 10000 });
  await sleep(300);
  await page.click('button[aria-label="Share a Town Postcard"]');
  await sleep(300);
  CODE = await page.evaluate(() => window.__copied);
  assert(typeof CODE === 'string' && CODE.startsWith('BTPC1.'), `save A's map produced a postcard code (${String(CODE).slice(0, 6)})`);
  assert(!/Snacks/.test(CODE ? Buffer.from(CODE.slice(6), 'base64').toString('utf8') : ''), 'and it still carries no nickname (RUN21A item 11 holds)');
  await ctx.close();
}

// ==================== 2. save B's Grown-ups corner ====================
console.log('== 2. the Visit box takes postcards and refuses backups ==');
const { ctx: bctx, page } = await open(SAVE({
  name: 'Bea',
  town: { areas: Object.assign(AREAS(), { meadow: { items: B_MEADOW, paths: [] } }) }
}));
await page.evaluate(() => window.BooTown.go('grownups'));
await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'grownups', { timeout: 10000 });
await page.evaluate(() => { const t = [...document.querySelectorAll('.gu-tab')].find(b => b.dataset.tab === 'visit'); if (t) t.click(); });
await sleep(400);
{
  const found = await page.evaluate(() => ({
    box: !!document.querySelector('.gu-visit-code'),
    btn: !!document.querySelector('.gu-visit-go'),
    heading: [...document.querySelectorAll('.gu-visit h3')].map(h => h.textContent)[0] || null,
    tabs: [...document.querySelectorAll('.gu-tab')].map(b => b.dataset.tab)
  }));
  assert(found.box && found.btn, 'the Grown-ups corner has a Visit a Town paste box');
  assert(found.heading === 'Visit a Town', `titled exactly "Visit a Town" (${found.heading})`);
  assert(found.tabs.includes('visit'), `on its own tab (${found.tabs.join(',')})`);
  assert(found.tabs[0] === 'settings' && found.tabs[found.tabs.length - 1] === 'data' && found.tabs.length <= 6,
    'and RUN6 C0.2 still holds: Settings first, Backup & data last, a tidy set');
}
{
  // a real backup code in the visit box → the authored line, and nothing happens
  const msg = await page.evaluate(() => {
    const code = window.BooTown.State.exportCode();
    document.querySelector('.gu-visit-code').value = code;
    document.querySelector('.gu-visit-go').click();
    return { msg: document.querySelector('.gu-visit-msg').textContent, screen: document.getElementById('screen').dataset.screen, visiting: window.BooTown.State.isVisiting() };
  });
  assert(msg.msg === 'That looks like a backup code — Visit needs a Town Postcard.', `a backup code is refused with the authored line ("${msg.msg}")`);
  assert(msg.screen === 'grownups' && msg.visiting === false, 'and no visit starts');
}
await page.screenshot({ path: `${SHOTS}/2-visit-box-refuses-backup.png` });

// ==================== 3. the visit ====================
console.log('== 3. visiting save A from save B ==');
// Let any debounced save of B's own land, then photograph the save. Everything from here to
// the end of the visit must leave these bytes alone.
await sleep(2500);
const RAW_BEFORE = await saveRaw(page);
const HASH_BEFORE = sha(RAW_BEFORE);
console.log(`  · save B before the visit: sha256:${HASH_BEFORE} (${RAW_BEFORE.length} bytes)`);
await page.evaluate(() => { window.__setItems.length = 0; });

await page.evaluate((code) => {
  document.querySelector('.gu-visit-code').value = code;
  document.querySelector('.gu-visit-go').click();
}, CODE);
await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'worldmap', { timeout: 10000 });
await sleep(400);
{
  const b = await page.evaluate(() => {
    const n = document.querySelector('.visit-banner');
    const leave = n && n.querySelector('.visit-leave');
    const r = n ? n.getBoundingClientRect() : null;
    const screenTop = document.getElementById('screen').getBoundingClientRect().top;
    return {
      line: n ? n.querySelector('.visit-banner-line').textContent : null,
      leave: leave ? leave.textContent : null,
      leaveBox: leave ? { w: Math.round(leave.getBoundingClientRect().width), h: Math.round(leave.getBoundingClientRect().height) } : null,
      top: r ? Math.round(r.top) : null, left: r ? Math.round(r.left) : null, width: r ? Math.round(r.width) : null,
      screenTop: Math.round(screenTop), clears: r ? screenTop >= r.bottom - 1 : false,
      visiting: window.BooTown.State.isVisiting(),
      mapReadonly: window.__worldmap.readonly(), hasExport: window.__worldmap.hasExport()
    };
  });
  assert(b.line === "You're visiting a friend's town ✈️ Look, don't touch!", `the banner reads exactly the authored line ("${b.line}")`);
  assert(b.leave === 'Leave', `with a Leave button (${b.leave})`);
  assert(b.leaveBox && b.leaveBox.h >= 44 && b.leaveBox.w >= 44, `Leave is a real tap target (${JSON.stringify(b.leaveBox)})`);
  assert(b.top === 0 && b.left === 0 && b.width === 1024, `the banner runs across the top (${b.top},${b.left},${b.width})`);
  assert(b.clears, 'and the screen below starts under it rather than behind it');
  assert(b.visiting === true, 'a visit session is open');
  assert(b.mapReadonly === true, 'the world map mounted read-only');
  assert(!b.hasExport, 'and it does NOT offer to share a postcard of somebody else’s town');
}
await page.screenshot({ path: `${SHOTS}/3-visit-worldmap.png` });

// A's placements render; B's do not
await gotoTown(page, { area: 'meadow' });
{
  const seen = await page.evaluate(() => ({
    items: [...document.querySelectorAll('.t-item')].map(n => n.dataset.item),
    readonly: window.__townLife.readonly(),
    drawerInDom: window.__townLife.drawerInDom(),
    drawerVisible: !!document.querySelector('.boo-drawer'),
    hint: (document.querySelector('.town-hint-bar') || {}).textContent,
    banner: !!document.querySelector('.visit-banner')
  }));
  for (const id of ['boo_inky', 'boo_plum', 'deco_bench']) assert(seen.items.includes(id), `A's ${id} renders in the visited Meadow`);
  for (const id of ['boo_chomp', 'deco_pond']) assert(!seen.items.includes(id), `B's own ${id} is NOT in the visited Meadow`);
  assert(seen.readonly === true, 'the area mounted read-only');
  assert(!seen.drawerInDom && !seen.drawerVisible, 'the drawer is not in the page at all');
  assert(seen.hint === '', 'and the hint bar promises nothing she cannot do');
  assert(seen.banner, 'the banner is still across the top inside the area');
  // The postcard carries no nicknames, so A's "Snacks" must show as the catalogue's own
  // name — and getDisplayName has to DEGRADE to it rather than leak or throw.
  const names = await page.evaluate(() => ({
    nicknames: Object.keys(window.BooTown.State.getState().nicknames || {}).length,
    tags: [...document.querySelectorAll('.t-item.boo')].map(n => n.dataset.item)
  }));
  assert(names.nicknames === 0, 'the visited town knows no nicknames — official names only');
  assert(names.tags.length >= 2, `A's Boos are standing in the Meadow (${names.tags.join(',')})`);
  // A visited town must still be ALIVE — that is the difference between a read-only place
  // and a photograph. RUN21D's opening Pulse plays, RUN21B's wish idles are scheduled, and
  // the actors are walking.
  await sleep(1400);
  const alive = await page.evaluate(() => ({
    pulse: window.__townLife.pulse(),
    wishes: window.__townLife.wishIdles(),
    actors: window.__townLife.actorCount(),
    softened: window.__townLife.softened()
  }));
  assert(alive.pulse.beat && !/^skipped/.test(alive.pulse.beat), `the town's opening Pulse still breathes for a visitor (beat: ${alive.pulse.beat})`);
  assert(alive.actors >= 2, `A's Boos are live actors, not stickers (${alive.actors})`);
  assert(!alive.softened, 'and the world is not softened — there is no tray to arrange with');
  assert(alive.wishes.length === 1 && alive.wishes[0].item === 'wish_cake', `A's wished-for cake came through the postcard (${JSON.stringify(alive.wishes)})`);
}
await page.screenshot({ path: `${SHOTS}/3-visit-meadow.png` });

// ==================== 4. the interaction sweep ====================
console.log(`== 4. ${Math.round(SWEEP_MS / 1000)}s of trying to change somebody else's town ==`);
const boxOf = (page, sel, i = 0) => page.evaluate(([s, k]) => {
  const n = [...document.querySelectorAll(s)][k];
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, item: n.dataset.item || null, dx: n.dataset.x || null } : null;
}, [sel, i]);

const placementsNow = () => page.evaluate(() => [...document.querySelectorAll('.t-item')].map(n => `${n.dataset.item}@${n.dataset.x}:${n.dataset.row}`).sort().join('|'));
const beforeSweep = await placementsNow();

const sweepStart = Date.now();
let laps = 0, drags = 0, taps = 0;
const AREA_LOOP = [{ area: 'meadow' }, { area: 'boohouse', room: 'lounge' }, { area: 'playground' }, { area: 'boohouse', room: 'kitchen' }, { area: 'funfair' }];
while (Date.now() - sweepStart < SWEEP_MS) {
  const where = AREA_LOOP[laps % AREA_LOOP.length];
  if (laps) await gotoTown(page, where);
  // (a) tap every placed thing with the REAL mouse — synthetic PointerEvents make
  //     setPointerCapture throw, and the harness then blames the app.
  const n = await page.evaluate(() => document.querySelectorAll('.t-item').length);
  for (let i = 0; i < Math.min(n, 4); i++) {
    const b = await boxOf(page, '.t-item', i);
    if (!b) continue;
    await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.mouse.up(); taps++;
    await sleep(140);
  }
  // (b) attempt a PLACEMENT MOVE: press a placed thing and drag it a long way
  const drag = await boxOf(page, '.t-item', 0);
  if (drag) {
    await page.mouse.move(drag.x, drag.y);
    await page.mouse.down();
    for (const k of [1, 2, 3, 4]) { await page.mouse.move(drag.x + k * 40, drag.y + k * 8); await sleep(30); }
    await page.mouse.up(); drags++;
    await sleep(200);
  }
  // (c) a long press (the play card / sprinkle route)
  if (drag) {
    await page.mouse.move(drag.x, drag.y); await page.mouse.down(); await sleep(750); await page.mouse.up();
    await sleep(150);
  }
  // (d) a tap on empty ground — the "place it here" gesture
  await page.mouse.move(520, 620); await page.mouse.down(); await page.mouse.up(); await sleep(120);
  // (e) a pan, which must still work: looking is the whole point
  await page.mouse.move(700, 500); await page.mouse.down();
  for (const k of [1, 2, 3]) { await page.mouse.move(700 - k * 60, 500); await sleep(25); }
  await page.mouse.up(); await sleep(150);
  // (f) the doors: the shop stall, the fair's rides and rooms
  for (const sel of ['.t-shop-stall', '.ff-ride', '.ff-disco-door', '.ff-bandstand', '.t-item[data-item="deco_jokestage"]']) {
    const d = await boxOf(page, sel);
    if (!d) continue;
    await page.mouse.move(d.x, d.y); await page.mouse.down(); await page.mouse.up(); await sleep(180);
    const scr = await page.evaluate(() => document.getElementById('screen').dataset.screen);
    assert(scr === 'town', `the ${sel} door stays shut in a visited town (screen: ${scr})`);
  }
  // (g) the mutation paths a child cannot reach without the tray, driven straight through
  //     the QA seams: force-hold an item and place it, paint a path cell and commit it, ask
  //     for an undo, and open the (detached) tray. Each of these is a mutate() call at the
  //     end of it, and every one of them must come to nothing.
  if (laps === 0) {
    const forced = await page.evaluate(() => {
      const before = { paths: window.__townLife.pathCellCount(), items: document.querySelectorAll('.t-item').length };
      window.__townLife.forceHold('deco_bench');
      window.__townLife.placeAt(0.5, 0.8);
      window.__townLife.paintCellAt(3, 3);
      window.__townLife.commitPathsNow();
      window.__townLife.undo();
      window.__townLife.toggleBuild();
      return { before, after: { paths: window.__townLife.pathCellCount(), items: document.querySelectorAll('.t-item').length },
               undoDepth: window.__townLife.undoDepth(), drawerInDom: window.__townLife.drawerInDom(),
               saved: JSON.stringify((window.BooTown.State.getState().town.areas.meadow || {}).items || []) };
    });
    assert(forced.after.items === forced.before.items, `an attempted placement places nothing (${forced.before.items} → ${forced.after.items})`);
    assert(forced.undoDepth === 0, 'and records no undo step to take back');
    assert(!forced.drawerInDom, 'the tray stays out of the page even when asked to open');
    const written = await page.evaluate(() => window.__setItems.slice());
    assert(written.length === 0, `and none of it reached storage (${written.join(',') || 'none'})`);
    await gotoTown(page, where);   // clear the forced hold before the next lap
  }
  laps++;
}
console.log(`  · ${laps} laps, ${taps} taps, ${drags} attempted moves in ${Math.round((Date.now() - sweepStart) / 1000)}s`);

// nothing moved, nothing opened, nothing was written
await gotoTown(page, { area: 'meadow' });
{
  const afterSweep = await placementsNow();
  assert(afterSweep === beforeSweep, 'not one placement moved under the sweep');
  const state = await page.evaluate(() => ({
    menus: document.querySelectorAll('.plot-menu').length,
    cards: document.querySelectorAll('.play-card-ov').length,
    handles: document.querySelectorAll('.t-resize').length,
    undo: document.querySelectorAll('.t-undo-chip').length,
    drawer: document.querySelectorAll('.boo-drawer').length,
    writes: window.__setItems.slice(),
    visiting: window.BooTown.State.isVisiting()
  }));
  assert(state.menus === 0 && state.cards === 0, 'no Move/Put-away menu and no play card ever opened');
  assert(state.handles === 0 && state.undo === 0, 'no resize handle and no Undo chip appeared');
  assert(state.drawer === 0, 'the tray never mounted');
  assert(state.visiting === true, 'the visit is still the one that was opened');
  assert(state.writes.length === 0, `localStorage was NEVER written during the visit (${state.writes.length} writes: ${state.writes.join(',') || 'none'})`);
  const RAW_MID = await saveRaw(page);
  assert(sha(RAW_MID) === HASH_BEFORE, `B's save hash is unchanged after the sweep (${sha(RAW_MID)} vs ${HASH_BEFORE})`);
}
await page.screenshot({ path: `${SHOTS}/4-after-sweep.png` });

// ==================== 5. Leave ====================
console.log('== 5. Leave gives her back her own town ==');
await page.evaluate(() => window.BooTown.go('worldmap'));
await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'worldmap', { timeout: 10000 });
await sleep(300);
{
  const leave = await boxOf(page, '.visit-leave');
  assert(!!leave, 'the Leave button is reachable');
  await page.mouse.move(leave.x, leave.y); await page.mouse.down(); await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'grownups', { timeout: 10000 });
  await sleep(400);
  const after = await page.evaluate(() => ({
    visiting: window.BooTown.State.isVisiting(),
    banner: !!document.querySelector('.visit-banner'),
    bodyClass: document.body.classList.contains('visiting'),
    screenTop: Math.round(document.getElementById('screen').getBoundingClientRect().top),
    name: window.BooTown.State.getState().name
  }));
  assert(after.visiting === false, 'Leave ends the visit');
  assert(!after.banner && !after.bodyClass, 'the banner is gone');
  assert(after.screenTop === 0, 'and the screen has the whole window back');
  assert(after.name === 'Bea', "her own save is the live one again (name: 'Bea')");
  // Measured HERE, the moment the visit closes and before she plays a single second of her
  // own town again (which legitimately writes: quests tick, the day's hider is picked…).
  const RAW_AFTER = await saveRaw(page);
  const writes = await page.evaluate(() => window.__setItems.slice());
  assert(sha(RAW_AFTER) === HASH_BEFORE, `B's save hash is unchanged after Leave too (${sha(RAW_AFTER)} vs ${HASH_BEFORE})`);
  assert(RAW_AFTER === RAW_BEFORE, 'byte for byte, not merely equal in shape');
  assert(writes.length === 0, `and localStorage was never written across the whole round trip (${writes.join(',') || 'none'})`);
}
await gotoTown(page, { area: 'meadow' });
{
  const items = await page.evaluate(() => [...document.querySelectorAll('.t-item')].map(n => n.dataset.item));
  for (const id of ['boo_chomp', 'deco_pond']) assert(items.includes(id), `B's own ${id} is back in her Meadow`);
  for (const id of ['boo_inky', 'deco_bench']) assert(!items.includes(id), `and nothing of A's (${id}) came home with her`);
  const drawer = await page.evaluate(() => ({ inDom: window.__townLife.drawerInDom(), readonly: window.__townLife.readonly() }));
  assert(drawer.inDom && drawer.readonly === false, 'her own town has its tray back');
}
await page.screenshot({ path: `${SHOTS}/5-own-town-restored.png` });

// ==================== 6. a visit cannot leak into the rest of the app ====================
console.log('== 6. the visit boundary ==');
{
  await page.evaluate((code) => {
    window.BooTown.go('grownups');
    return null;
  }, CODE);
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'grownups', { timeout: 10000 });
  await page.evaluate(() => { const t = [...document.querySelectorAll('.gu-tab')].find(b => b.dataset.tab === 'visit'); if (t) t.click(); });
  await sleep(300);
  await page.evaluate((code) => {
    document.querySelector('.gu-visit-code').value = code;
    document.querySelector('.gu-visit-go').click();
  }, CODE);
  await page.waitForFunction(() => window.BooTown.State.isVisiting(), { timeout: 10000 });
  // the phone's back gesture, or any other route out, ends the visit rather than carrying it
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'hub', { timeout: 10000 });
  await sleep(300);
  const out = await page.evaluate(() => ({
    visiting: window.BooTown.State.isVisiting(),
    banner: !!document.querySelector('.visit-banner'),
    name: window.BooTown.State.getState().name
  }));
  assert(out.visiting === false, 'a route that is not town/worldmap ends the visit');
  assert(!out.banner, 'and takes the banner with it');
  assert(out.name === 'Bea', 'her own save is live on the hub');
}
{
  const damaged = await page.evaluate(() => {
    const r1 = window.BooTown.State.readSaveText('BTPC1.abc');
    return { restoreRejects: r1.ok === false, line: r1.error };
  });
  assert(damaged.restoreRejects && damaged.line === "That's a Town Postcard for visiting, not a backup. Backups start with a different code.",
    'the restore box still refuses a postcard with RUN21A item 11’s line');
}

await bctx.close();

// ==================== 7. the banner at the other two viewports ====================
// House evidence standard: 1024x768 (above), 768x1024 and 390x844. The banner is fixed
// furniture above every screen, so what matters is that it spans the width, keeps its line
// readable, and that the screen below starts UNDER it rather than behind it.
console.log('== 7. tablet and phone ==');
for (const vp of [{ name: '768x1024', w: 768, h: 1024 }, { name: '390x844', w: 390, h: 844 }]) {
  const { ctx: vctx, page: vpage } = await open(SAVE({ name: 'Bea', town: { areas: Object.assign(AREAS(), { meadow: { items: B_MEADOW, paths: [] } }) } }), { w: vp.w, h: vp.h });
  await vpage.evaluate(() => window.BooTown.go('grownups'));
  await vpage.waitForFunction(() => document.getElementById('screen').dataset.screen === 'grownups', { timeout: 10000 });
  await vpage.evaluate(() => { const t = [...document.querySelectorAll('.gu-tab')].find(b => b.dataset.tab === 'visit'); if (t) t.click(); });
  await sleep(250);
  await vpage.evaluate((code) => {
    document.querySelector('.gu-visit-code').value = code;
    document.querySelector('.gu-visit-go').click();
  }, CODE);
  await vpage.waitForFunction(() => document.getElementById('screen').dataset.screen === 'worldmap', { timeout: 10000 });
  await gotoTown(vpage, { area: 'meadow' });
  const geo = await vpage.evaluate(() => {
    const n = document.querySelector('.visit-banner'), r = n.getBoundingClientRect();
    const line = n.querySelector('.visit-banner-line'), lr = line.getBoundingClientRect();
    const leave = n.querySelector('.visit-leave').getBoundingClientRect();
    return {
      width: Math.round(r.width), top: Math.round(r.top),
      clears: document.getElementById('screen').getBoundingClientRect().top >= r.bottom - 1,
      clipped: line.scrollWidth > Math.ceil(lr.width) + 1,
      leaveW: Math.round(leave.width), leaveH: Math.round(leave.height),
      overlap: leave.left < lr.right - 1,
      items: [...document.querySelectorAll('.t-item')].map(x => x.dataset.item)
    };
  });
  assert(geo.width === vp.w && geo.top === 0, `${vp.name}: the banner spans the top (${geo.width}px)`);
  assert(geo.clears, `${vp.name}: the screen starts below it`);
  assert(!geo.clipped, `${vp.name}: the whole line is readable, not cut off`);
  assert(!geo.overlap && geo.leaveW >= 44 && geo.leaveH >= 44, `${vp.name}: Leave is clear of the line and still a real target (${geo.leaveW}x${geo.leaveH})`);
  assert(geo.items.includes('boo_inky'), `${vp.name}: and A's town is what is on screen`);
  await vpage.screenshot({ path: `${SHOTS}/7-visit-${vp.name}.png` });
  await vctx.close();
}

await browser.close();
const realErrors = pageErrors.filter(e => !/favicon|sw\.js|ServiceWorker/i.test(e));
assert(realErrors.length === 0, `no console/page errors across the whole visit (${realErrors.slice(0, 3).join(' | ') || 'none'})`);
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
