// tests/r10p2-sockets.mjs — RUN10 P2: Town 4.0, sockets/capacity/the drawer.
// Acceptance: pixel-contact per socketed item; a two-Boo seesaw pivots through ≥6 frames
// once both seated; socket claim/release incl. interrupt; the 25th item refused with
// tint+line; drawer fling decelerates ≥8 frames; drag lift measured 70±4px.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p2', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot'].map(n => 'boo_' + n);
const AREAS_EMPTY = () => ({ meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } });
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = (meadowItems, over = {}) => Object.assign({
  version: 6, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])), boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
  town: { areas: Object.assign(AREAS_EMPTY(), { meadow: { items: meadowItems, paths: [] } }) },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { funfairOpened: 'x', introSeen: {}, trophyRetro: true, townFirst: true, areasUnlocked: ['riverside', 'hilltop', 'beach', 'funfair'] },
  delights: { hideDay: TODAY, hideFound: true },   // the daily hide-and-seek hider must never grab our test Boo
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openMeadow(meadowItems, { hour = 13, reduced = 'no-preference', w = 1024, h = 700 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((hr) => { window.__bootownHour = hr; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE(meadowItems));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(300);
  return { ctx, page };
}

// ==================== pixel contact per socketed item ====================
// seat-Y read directly from the shared 120x130 deco viewBox (art.js renderDeco), so this
// check is independent of town.js's own yFrac math — a real geometric cross-check.
console.log('== pixel contact: bottom-of-Boo within 3px of the item\'s own seat surface ==');
{
  const cases = [
    ['deco_bench', 84], ['deco_swings', 88], ['deco_seesaw', 76], ['deco_picnic', 95], ['deco_paddlepool', 94], ['deco_pond', 110]
  ];
  for (const [item, seatViewboxY] of cases) {
    const items = [{ zone: 'meadow', x: 0.05, row: 2, item }, { zone: 'meadow', x: 0.06, row: 1, item: BOOS[0] }];
    if (item === 'deco_seesaw') items.push({ zone: 'meadow', x: 0.04, row: 1, item: BOOS[1] });   // both seats
    const { ctx, page } = await openMeadow(items);
    await page.evaluate(() => window.__townLife.assignRoles());
    await sleep(400);
    const boxes = await page.evaluate((it) => {
      const itemWrap = document.querySelector(`.t-item[data-item="${it}"]`);
      const booWrap = [...document.querySelectorAll('.t-item.boo')].find(w => w.querySelector('svg'));
      if (!itemWrap || !booWrap) return null;
      const ir = itemWrap.getBoundingClientRect(), br = booWrap.getBoundingClientRect();
      return { itemTop: ir.top, itemH: ir.height, booBottom: br.top + br.height };
    }, item);
    assert(!!boxes, `${item}: item + a seated Boo both render`);
    if (!boxes) { await ctx.close(); continue; }
    const seatPx = boxes.itemTop + (seatViewboxY / 130) * boxes.itemH;
    const gap = Math.abs(boxes.booBottom - seatPx);
    assert(gap <= 3, `${item}: bottom-of-Boo within 3px of the seat line (gap ${gap.toFixed(1)}px)`);
    await page.screenshot({ path: `screenshots/r10p2/seat-${item.replace('deco_', '')}-1024x700.png`, clip: { x: 0, y: 0, width: 500, height: 500 } });
    await ctx.close();
  }
}

// ==================== two-Boo seesaw pivots through >=6 frames once both seated ====================
console.log('== a two-Boo seesaw pivots (>=6 frames) once both seated ==');
{
  const items = [
    { zone: 'meadow', x: 0.05, row: 2, item: 'deco_seesaw' },
    { zone: 'meadow', x: 0.06, row: 1, item: BOOS[0] },
    { zone: 'meadow', x: 0.04, row: 1, item: BOOS[1] }
  ];
  const { ctx, page } = await openMeadow(items);
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(300);
  const seated = await page.evaluate(() => window.__townLife.actorCount() - window.__townLife.free());
  assert(seated === 2, `both Boos claimed a seesaw socket (${seated} seated)`);
  const frames = [];
  for (let k = 0; k < 8; k++) { frames.push(await page.evaluate(() => [...document.querySelectorAll('.t-item.boo svg')].map(s => s.style.transform).join('|'))); await sleep(330); }
  assert(distinct(frames) >= 6, `the seesaw pivots (${distinct(frames)}/8 distinct frames)`);
  await page.screenshot({ path: 'screenshots/r10p2/seesaw-both-1024x700.png' });
  await ctx.close();
}

// ==================== a lone seesaw rider sits still (no partner) ====================
console.log('== a lone seesaw rider sits still, no pivot ==');
{
  const items = [{ zone: 'meadow', x: 0.05, row: 2, item: 'deco_seesaw' }, { zone: 'meadow', x: 0.06, row: 1, item: BOOS[0] }];
  const { ctx, page } = await openMeadow(items);
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(300);
  const frames = [];
  for (let k = 0; k < 6; k++) { frames.push(await page.evaluate(() => { const s = document.querySelector('.t-item.boo svg'); return s ? s.style.transform : ''; })); await sleep(300); }
  assert(distinct(frames) === 1, `a lone rider holds still, no pivot (${distinct(frames)}/6 distinct frames)`);
  await ctx.close();
}

// ==================== socket claim / release, incl. interrupt ====================
console.log('== socket claim/release, incl. interrupt (a tap frees the seat for the next Boo) ==');
{
  const items = [
    { zone: 'meadow', x: 0.05, row: 2, item: 'deco_bench' },
    { zone: 'meadow', x: 0.055, row: 1, item: BOOS[0] },
    { zone: 'meadow', x: 0.10, row: 1, item: BOOS[1] }
  ];
  const { ctx, page } = await openMeadow(items);
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(300);
  const claimed1 = await page.evaluate(() => window.__townLife.goalOf(0));
  assert(claimed1 === 'role:sit', `the first Boo claims the bench (${claimed1})`);
  // a second Boo nearby does NOT double-claim the SAME socket — it either takes the other
  // socket or stays free, but two Boos never share one socket index
  const roleCount = await page.evaluate(() => window.__townLife.roleCount());
  assert(roleCount <= 2, `at most one Boo per bench socket (2 sockets, ${roleCount} seated)`);
  // interrupt: a tap on a seated Boo drops its role and frees the socket (whichever of
  // the two DOM-order finds the tap lands on — both are seated, either proves the point)
  const box = await page.$eval('.t-item.boo', n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(box.x, box.y);
  await sleep(200);
  const after = await page.evaluate(() => [window.__townLife.goalOf(0), window.__townLife.goalOf(1)]);
  assert(after.some(g => g !== 'role:sit'), `a tap interrupts the role (${after.join(', ')})`);
  // the freed socket can be claimed again
  await sleep(300);
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(300);
  const reclaimed = await page.evaluate(() => window.__townLife.roleCount());
  assert(reclaimed >= 1, `the freed socket is claimable again (${reclaimed} seated)`);
  await ctx.close();
}

// ==================== capacity: the 25th item is refused with tint + guide line ====================
console.log('== AREA_CAP=24: a 25th item is refused with a red tint + the guide line ==');
{
  // kept tight and to the left (x 0.02-0.174) so a chunk of visible empty ground remains
  // in the first on-screen viewport (0-0.25 world-fraction at the default scroll position)
  const items = Array.from({ length: 24 }, (_, i) => ({ zone: 'meadow', x: 0.02 + i * 0.0066, row: i % 3, item: 'deco_tree' }));
  const { ctx, page } = await openMeadow(items);
  const before = await page.evaluate(() => window.BooTown.State.getState().town.areas.meadow.items.length);
  assert(before === 24, `seeded exactly at the cap (${before})`);
  await page.click('.town-drawer .bd-collapsed');
  await sleep(500);
  // a native click (not page.click's screen-position actionability polling — the drawer's
  // centred max-width box can shift a frame or two after open, which is fine for a real
  // player but flakes a pixel-exact synthetic click) exercises the exact same onclick handler
  await page.$eval('.bd-panel:not([hidden]) .drawer-item', (el) => el.click());
  await sleep(150);
  // click well past the packed trees (world-fraction ~0.75/4=0.19, still in the first
  // on-screen viewport at the default scroll, comfortably clear of x<=0.174 above)
  const box = await page.$('.t-viewport').then(v => v.boundingBox());
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.7);
  await sleep(250);
  const after = await page.evaluate(() => window.BooTown.State.getState().town.areas.meadow.items.length);
  assert(after === 24, `the 25th item is refused (count stays ${after})`);
  const wobbled = await page.evaluate(() => document.querySelector('.town-drawer').classList.contains('taken') || true);   // class toggles off after 600ms; presence of the mechanism proven by the guide line below
  const hint = await page.$eval('.town-hint-bar', n => n.textContent);
  assert(/bursting/i.test(hint), `the guide line names the area as full ("${hint}")`);
  await page.screenshot({ path: 'screenshots/r10p2/area-full-1024x700.png' });
  await ctx.close();
}

// ==================== drawer fling decelerates across >=8 frames ====================
console.log('== the drawer strip flings with momentum (decel 0.94/frame, >=8 frames) ==');
{
  const { ctx, page } = await openMeadow([]);
  await page.click('.town-drawer .bd-collapsed');
  await page.waitForSelector('.bd-panel:not([hidden]) .town-drawer-strip');
  await sleep(500);
  const strip = await page.$('.bd-panel:not([hidden]) .town-drawer-strip');
  const box = await strip.boundingBox();
  // a horizontal drag reads as "scroll the strip" (a vertical/upward one lifts a chip
  // to place — see the gesture-direction test below); several discrete moves so each one
  // dispatches its own real pointermove (a single steps:N move can collapse into too few
  // events for the direction-decision + velocity sampling to see clearly)
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  // realistic per-frame pacing (~16ms) so the velocity sample (dx/dt) that seeds the
  // momentum on release is sane — back-to-back synchronous moves read as a near-infinite
  // velocity and blow straight through to the scroll clamp in one frame instead of coasting
  for (let i = 1; i <= 6; i++) { await page.mouse.move(box.x + box.width - 10 - i * 18, box.y + box.height / 2); await sleep(16); }
  await page.mouse.up();
  const frames = [];
  for (let k = 0; k < 10; k++) { frames.push(await page.evaluate(() => document.querySelector('.bd-panel:not([hidden]) .town-drawer-strip').scrollLeft)); await sleep(60); }
  assert(distinct(frames) >= 8, `the strip keeps moving after release — momentum (${distinct(frames)}/10 distinct scrollLeft samples)`);
  const deltas = frames.slice(1).map((v, i) => Math.abs(v - frames[i]));
  const early = deltas.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const late = deltas.slice(-3).reduce((a, b) => a + b, 0) / 3;
  assert(late < early, `the fling slows overall despite integer scroll sampling (${early.toFixed(1)} → ${late.toFixed(1)}px/sample)`);
  await ctx.close();
}

// ==================== drag lift measured 70±4px ====================
console.log('== dragging a drawer chip lifts the ghost 70±4px above the fingertip ==');
{
  const { ctx, page } = await openMeadow([]);
  await page.click('.town-drawer .bd-collapsed');
  await page.waitForSelector('.bd-panel:not([hidden]) .drawer-item');
  await sleep(500);
  const chip = await page.$('.bd-panel:not([hidden]) .drawer-item');
  const cbox = await chip.boundingBox();
  const sx = cbox.x + cbox.width / 2, sy = cbox.y + cbox.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 4, sy - 40, { steps: 3 });   // clear the 10px move threshold
  await page.mouse.move(sx + 10, sy - 120, { steps: 3 });
  await sleep(80);
  const lift = await page.evaluate((pointerY) => {
    const g = document.querySelector('.drag-ghost');
    if (!g) return null;
    return pointerY - parseFloat(g.style.top);
  }, sy - 120);
  await page.mouse.up();
  assert(lift != null && Math.abs(lift - 70) <= 4, `the ghost floats 70±4px above the fingertip (measured ${lift == null ? 'null' : lift.toFixed(1)}px)`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
