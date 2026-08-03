// tests/r21a-reach-truth.mjs — RUN21A "Reach & Truth": the pack's own ACCEPT criteria,
// made permanent.
//
// RUN21A fixed seventeen things a child could see, and RUN21B-E all rewrite js/town.js on
// top of them — so every one of these ACCEPTs is a regression risk for the rest of the
// programme. Rather than verify them once in a throwaway probe, they live here.
//
// Items 4, 5, 15 and 16 are asserted by the suites that already owned those contracts
// (r18b-wish-arrives, r20-wishlife, r10p3-buildmode, r7p1-funfair, re-pointed by RUN21A);
// item 14 is proven by measured screenshots in the report; item 18 is a copy audit.
// What is here is everything else, one block per pack item.
//
// Expected runtime: ~75s (board law: state it when adding a suite). No @serial need — the
// only motion evidence is item 6's three frames across 4s, which is timing-tolerant.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = '_evidence/run21a';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow'].map(n => 'boo_' + n);
const AREAS = () => ({
  meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] },
  hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] },
  funfair: { items: [], paths: [] }, playground: { items: [], paths: [] },
  boohouse: { items: [], paths: [] }, boohouse_kitchen: { items: [], paths: [] },
  boohouse_bedroom: { items: [], paths: [] }, gallery: { items: [], paths: [] }
});
const SAVE = (over = {}) => Object.assign({
  version: 23, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])),
  stars: { total: 400, byType: {}, spent: {} },
  town: { areas: AREAS() },
  wishes: { unlocked: {} },
  // the day's hide-and-seek must never swallow a Boo this suite is watching
  delights: { hideDay: today, hideFound: true },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', introSeen: { shop: 1 } },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false }
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const pageErrors = [];
async function open(save, { area = 'meadow', room = null, w = 1024, h = 768, hour = 13, reduced = 'no-preference', now = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  await page.addInitScript(([hr, nw]) => {
    window.__bootownHour = hr;
    if (nw != null) window.__bootownNow = nw;
    // capture clipboard writes without needing a permission prompt (item 11)
    window.__copied = null;
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } }
      });
    } catch {}
  }, [hour, now]);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 30000 });
  if (area) {
    await page.evaluate(p => window.BooTown.go('town', p), room ? { area, room } : { area });
    await page.waitForSelector('.town2', { timeout: 15000 });
    await page.waitForFunction(() => window.__townLife, { timeout: 8000 });
    await sleep(500);
  }
  return { ctx, page };
}
// A reveal overlay (growth / fair / RUN21A-16 catch-up) legitimately opens over some
// fixtures; dismiss it so the block's own subject is reachable.
const dismissReveal = async (page) => {
  const btn = await page.$('.overlay.growth-reveal .btn');
  if (btn) { await btn.click(); await sleep(350); }
};

// ==================== Item 1 — seated Boos render everywhere ====================
console.log('== item 1: a Boo on a ride is never invisible in another area ==');
{
  const rider = BOOS[0];
  const save = SAVE({
    funfair: { built: ['carousel'], build: null, pending: [], seats: { carousel: [rider, null, null] } },
    town: { areas: Object.assign(AREAS(), { boohouse_bedroom: { items: [{ zone: 'boohouse_bedroom', x: 0.5, row: 1, item: rider }], paths: [] } }) }
  });
  const { ctx, page } = await open(save, { area: 'boohouse', room: 'bedroom' });
  await dismissReveal(page);
  const seen = await page.evaluate((id) => {
    const w = [...document.querySelectorAll('.t-item.boo')].find(n => n.dataset.item === id);
    return { present: !!w, display: w ? w.style.display : null, rect: w ? w.getBoundingClientRect().width : 0 };
  }, rider);
  assert(seen.present, 'the seated Boo has a wrap in the Bedroom');
  assert(seen.display !== 'none' && seen.rect > 0, `and it is VISIBLE, not display:none (display "${seen.display}", w ${seen.rect})`);
  await page.screenshot({ path: `${SHOTS}/item1-bedroom-visible.png` });
  await ctx.close();
}
{
  // (b) inside the funfair itself the standing sprite stays suppressed — the ride draws it
  const rider = BOOS[0];
  const save = SAVE({
    funfair: { built: ['carousel'], build: null, pending: [], seats: { carousel: [rider, null, null] } },
    town: { areas: Object.assign(AREAS(), { funfair: { items: [{ zone: 'funfair', x: 0.2, row: 1, item: rider }], paths: [] } }) }
  });
  const { ctx, page } = await open(save, { area: 'funfair' });
  await dismissReveal(page);
  const display = await page.evaluate((id) => {
    const w = [...document.querySelectorAll('.t-item.boo')].find(n => n.dataset.item === id);
    return w ? w.style.display : 'absent';
  }, rider);
  assert(display === 'none', `in the fair, the riding Boo's ground sprite stays hidden (display "${display}")`);
  await ctx.close();
}
{
  // (c) placing a seated Boo somewhere new hops it off the ride, with the authored hint
  const rider = BOOS[1];
  const save = SAVE({ funfair: { built: ['carousel'], build: null, pending: [], seats: { carousel: [rider, null, null] } } });
  const { ctx, page } = await open(save, { area: 'meadow' });
  await dismissReveal(page);
  const before = await page.evaluate((id) => window.__townLife.ffRideSeats('carousel').includes(id), rider);
  assert(before, 'the Boo starts aboard the Carousel');
  await page.evaluate((id) => { window.__townLife.forceHold(id); window.__townLife.placeAt(0.4, 0.78); }, rider);
  await sleep(400);
  const after = await page.evaluate((id) => ({
    aboard: window.__townLife.ffRideSeats('carousel').includes(id),
    hint: (document.querySelector('.town-hint-bar') || {}).textContent || '',
    visible: (() => { const w = [...document.querySelectorAll('.t-item.boo')].find(n => n.dataset.item === id); return !!w && w.style.display !== 'none'; })()
  }), rider);
  assert(!after.aboard, 'placing it elsewhere takes it OFF the ride roster');
  assert(after.visible, 'and it is visible where she put it');
  assert(/hopped off the Carousel to come here!$/.test(after.hint), `and the hint says so, verbatim: "${after.hint}"`);
  await ctx.close();
}

// ==================== Item 2 — Decorate renders without the hammer ====================
console.log('== item 2: every room shows its dressings on a fresh load, no hammer ==');
for (const room of ['lounge', 'kitchen', 'bedroom']) {
  const { ctx, page } = await open(SAVE(), { area: 'boohouse', room });
  await dismissReveal(page);
  const strip = await page.evaluate(() => {
    // scope everything to the DECORATE strip: other tabs legitimately show the generic
    // "Nothing here yet!" when the child owns nothing for them, and that is not this test's
    // business (renderDrawer, town.js).
    const cap = document.querySelector('.decorate-caption');
    const strip = cap ? cap.parentElement : null;
    return {
      caption: cap ? cap.textContent : null,
      swatches: strip ? strip.querySelectorAll('.decorate-swatch').length : 0,
      rows: strip ? [...strip.querySelectorAll('.decorate-row-label')].map(n => n.textContent) : [],
      empties: strip ? [...strip.querySelectorAll('.drawer-empty')].map(n => n.textContent) : ['strip not found']
    };
  });
  const Room = room[0].toUpperCase() + room.slice(1);
  assert(strip.caption === `Dressings for the ${Room}`, `${room}: caption names the room, verbatim ("${strip.caption}")`);
  assert(strip.swatches >= 6, `${room}: its swatches are there before any hammer tap (${strip.swatches})`);
  assert(strip.rows.includes('Walls') && strip.rows.includes('Floors'), `${room}: both rows render`);
  assert(strip.empties.length === 0, `${room}: the decorate strip shows swatches, not an empty state (${JSON.stringify(strip.empties)})`);
  if (room === 'lounge') await page.screenshot({ path: `${SHOTS}/item2-decorate-lounge.png` });
  await ctx.close();
}

// ==================== Item 3 — gold wish tiles end readable ====================
console.log('== item 3: a granted word ends the right way round ==');
{
  const { ctx, page } = await open(SAVE(), { area: 'meadow' });
  await dismissReveal(page);
  await page.evaluate(() => window.__townLife.openWishWell());
  await page.waitForFunction(() => !!window.__wishwell, { timeout: 8000 });
  await page.evaluate(() => window.__wishwell.spell('kite'));
  await sleep(900);   // the .5s flip has finished
  const tiles = await page.evaluate(() => [...document.querySelectorAll('.wish-slot.gold')].map(n => {
    const cs = getComputedStyle(n);
    return { m: cs.transform, anim: cs.animationName };
  }));
  assert(tiles.length > 0, `the tiles went gold (${tiles.length})`);
  // A settled tile must not be mirrored: matrix(a,b,c,d,..) with a >= 0 (a<0 = flipped).
  const mirrored = tiles.filter(t => {
    const m = /matrix\(([-\d.]+)/.exec(t.m || '');
    return m && parseFloat(m[1]) < 0;
  });
  assert(mirrored.length === 0, `and NONE of them ends mirrored (${mirrored.length} of ${tiles.length} flipped)`);
  assert(tiles.every(t => t.anim === 'wishSlotFlip'), 'the full-turn flip animation is what plays');
  await page.screenshot({ path: `${SHOTS}/item3-gold-readable.png` });
  await ctx.close();
}
{
  const { ctx, page } = await open(SAVE(), { area: 'meadow', reduced: 'reduce' });
  await dismissReveal(page);
  await page.evaluate(() => window.__townLife.openWishWell());
  await page.waitForFunction(() => !!window.__wishwell, { timeout: 8000 });
  await page.evaluate(() => window.__wishwell.spell('kite'));
  await sleep(500);
  const anim = await page.evaluate(() => [...document.querySelectorAll('.wish-slot.gold')].map(n => getComputedStyle(n).animationName));
  assert(anim.length > 0 && anim.every(a => a === 'none'), `reduced motion: gold, no spin (${JSON.stringify([...new Set(anim)])})`);
  await ctx.close();
}

// ==================== Item 6 — a Boo holds still under its care arc ====================
console.log('== item 6: the Boo stays put while its care arc is open ==');
{
  // x 0.12, not 0.3: an outdoor area is four viewports wide, so at the default scrollX a
  // Boo at 0.3 sits off the right edge — where stepActors skips it as offscreen and a real
  // click cannot reach it. 0.12 * 4 viewports lands it on the screen she arrives at.
  const save = SAVE({ town: { areas: Object.assign(AREAS(), { meadow: { items: [{ zone: 'meadow', x: 0.12, row: 1, item: BOOS[0] }], paths: [] } }) } });
  const { ctx, page } = await open(save, { area: 'meadow' });
  await dismissReveal(page);
  await page.evaluate(() => window.__townLife.forceWalk && window.__townLife.forceWalk(0));
  await sleep(500);
  // The arc opens on a real TAP of the Boo — its only entry point. Two things make that
  // fiddly, and both are the point of the test: the Boo is WALKING (so the target moves
  // between measuring and clicking), and synthetic PointerEvents have no active pointer, so
  // the app's setPointerCapture throws. So: a real mouse, re-aimed each try, until it lands
  // — which is exactly what a child does to a moving Boo.
  let arcOpen = false;
  for (let tries = 0; tries < 12 && !arcOpen; tries++) {
    const at = await page.evaluate((id) => {
      const w = [...document.querySelectorAll('.t-item.boo')].find(n => n.dataset.item === id);
      if (!w) return null;
      const r = w.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, BOOS[0]);
    if (!at) break;
    await page.mouse.click(at.x, at.y);
    await sleep(200);
    arcOpen = await page.evaluate(() => window.__townLife.careArcCount() > 0);
  }
  assert(arcOpen, 'the care arc is open');
  const frames = [];
  for (let i = 0; i < 4; i++) {
    frames.push(await page.evaluate((id) => {
      const w = [...document.querySelectorAll('.t-item.boo')].find(n => n.dataset.item === id);
      const svg = w && w.querySelector('svg');
      return { left: w ? w.style.left : null, xf: svg ? svg.style.transform : null };
    }, BOOS[0]));
    await sleep(850);   // 4 samples spanning ~2.6s, comfortably inside the arc's 4s life
  }
  const moved = new Set(frames.map(f => `${f.left}|${f.xf}`));
  assert(moved.size === 1, `it holds STILL for the arc's whole life (${moved.size} distinct poses across 4 frames / 2.6s)`);
  await page.screenshot({ path: `${SHOTS}/item6-care-hold.png` });
  await ctx.close();
}

// ==================== Item 7 — footprints under the finger ====================
console.log('== item 7: beach prints land where she taps ==');
{
  const { ctx, page } = await open(SAVE(), { area: 'beach' });
  await dismissReveal(page);
  const box = await page.evaluate(() => {
    const v = document.querySelector('.t-viewport') || document.querySelector('.town2');
    const r = v.getBoundingClientRect();
    return { top: r.top, left: r.left, w: r.width, h: r.height };
  });
  for (const frac of [0.66, 0.76, 0.84]) {
    const y = box.top + box.h * frac, x = box.left + box.w * 0.5;
    await page.mouse.click(x, y);
    await sleep(250);
    const tops = await page.evaluate(() => [...document.querySelectorAll('.t-footprint')].map(n => n.getBoundingClientRect().top));
    assert(tops.length > 0, `tap at ${Math.round(frac * 100)}% height leaves prints (${tops.length})`);
    if (tops.length) {
      const first = Math.min(...tops);
      const delta = Math.abs(first - y);
      assert(delta <= 20 + box.h * 0.02, `and the first print lands at the tapped height (±${Math.round(delta)}px)`);
    }
    await sleep(4300);   // let them expire before the next tap so we measure a fresh set
  }
  await ctx.close();
}

// ==================== Item 8 — one reveal at a time ====================
console.log('== item 8: reveals queue, never stack ==');
{
  const DAY = 25 * 3600 * 1000;
  const now = Date.now();
  const save = SAVE({
    stars: { total: 400, byType: {}, spent: {} },
    townGrowth: { site: { idx: 0, startedAt: now - DAY }, done: [], pending: [] },
    funfair: { built: ['carousel', 'ferris', 'teacups', 'bouncy'], build: { ride: 'helter', startedAt: now - DAY }, pending: [], seats: {} }
  });
  const { ctx, page } = await open(save, { area: 'meadow', now });
  await sleep(1400);
  const first = await page.evaluate(() => document.querySelectorAll('.overlay.growth-reveal').length);
  assert(first === 1, `exactly ONE reveal overlay is on screen (${first})`);
  await page.screenshot({ path: `${SHOTS}/item8-one-reveal.png` });
  await page.click('.overlay.growth-reveal .btn');
  await sleep(900);
  const second = await page.evaluate(() => document.querySelectorAll('.overlay.growth-reveal').length);
  assert(second <= 1, `dismissing shows the next, still one at a time (${second})`);
  await ctx.close();
}

// ==================== Item 9 — Back goes home, and the pan survives ====================
console.log('== item 9: the shop returns her where she came from, at the pan she left ==');
{
  const { ctx, page } = await open(SAVE(), { area: 'meadow' });
  await dismissReveal(page);
  await page.evaluate(() => window.__townLife.scrollToFrac ? window.__townLife.scrollToFrac(0.62) : window.__townLife.scrollTo(1200));
  await sleep(600);
  const before = await page.evaluate(() => Math.round(window.__townLife.scrollX()));
  assert(before > 50, `she has panned away from screen 1 (scrollX ${before})`);
  await page.evaluate(() => window.BooTown.go('shop', { from: 'town', fromArea: 'meadow' }));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'shop', { timeout: 10000 });
  await sleep(400);
  await page.click('.back-btn, .back-control button, button[aria-label="Back"]').catch(async () => {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /back/i.test(x.getAttribute('aria-label') || x.textContent || '')); if (b) b.click(); });
  });
  await sleep(900);
  const land = await page.evaluate(() => ({
    screen: document.getElementById('screen').dataset.screen,
    area: window.__townLife ? window.__townLife.area() : null,
    x: window.__townLife ? Math.round(window.__townLife.scrollX()) : null
  }));
  assert(land.screen === 'town' && land.area === 'meadow', `Back lands in the Meadow, not the hub (${land.screen}/${land.area})`);
  assert(land.x != null && Math.abs(land.x - before) < 40, `and at the pan she left (${land.x} vs ${before})`);
  await ctx.close();
}
{
  // a paramless entry (the Collection's shop link) still goes to the hub
  const { ctx, page } = await open(SAVE(), { area: null });
  await page.evaluate(() => window.BooTown.go('shop'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'shop', { timeout: 10000 });
  await sleep(300);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /back/i.test(x.getAttribute('aria-label') || x.textContent || '')); if (b) b.click(); });
  await sleep(700);
  const s = await page.evaluate(() => document.getElementById('screen').dataset.screen);
  assert(s === 'hub', `a paramless shop entry still returns to the hub (${s})`);
  await ctx.close();
}

// ==================== Item 11 — the Town Postcard carries only the look ====================
console.log('== item 11: the postcard is a postcard, not her whole save ==');
{
  const save = SAVE({
    name: 'Ada', nicknames: { [BOOS[0]]: 'Snacks' },
    equips: { [BOOS[0]]: { hat: 'acc_sunhat' } }, shinies: { [BOOS[0]]: 1 },
    dressings: { lounge: { walls: 'lounge_walls_starry' } },
    care: { bonds: { [BOOS[0]]: 72 }, treats: 4 },
    ledger: { spent: 12 },
    town: { areas: Object.assign(AREAS(), { meadow: { items: [{ zone: 'meadow', x: 0.3, row: 1, item: BOOS[0] }], paths: [{ cx: 2, cy: 3, style: 'stone' }] } }) }
  });
  const { ctx, page } = await open(save, { area: null });
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'worldmap', { timeout: 10000 });
  await sleep(400);
  const label = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Share a Town Postcard"]');
    return b ? { found: true, glyph: b.textContent } : { found: false };
  });
  assert(label.found, 'the map carries a "Share a Town Postcard" button');
  assert(label.glyph === '💌', `and it is the postcard glyph, not the plane (${label.glyph})`);
  await page.click('button[aria-label="Share a Town Postcard"]');
  await sleep(400);
  const res = await page.evaluate(() => {
    const code = window.__copied;
    const toast = (document.querySelector('.map-toast') || {}).textContent || '';
    let payload = null;
    try { payload = JSON.parse(decodeURIComponent(atob(code.slice('BTPC1.'.length)))); } catch (e) { payload = { parseError: String(e) }; }
    return { code: code ? code.slice(0, 6) : null, toast, payload, raw: code || '' };
  });
  assert(res.code === 'BTPC1.', `the clipboard gets a postcard code (${res.code})`);
  assert(res.toast === 'Postcard copied! A grown-up can paste it in another Boo Town to visit.', `the toast is verbatim ("${res.toast}")`);
  const keys = Object.keys(res.payload || {}).sort();
  assert(JSON.stringify(keys) === JSON.stringify(['areas', 'createdAt', 'dressings', 'format', 'roster', 'version']),
    `the payload carries ONLY the postcard keys (${keys.join(',')})`);
  for (const forbidden of ['name', 'age', 'ledger', 'settings', 'care', 'nicknames', 'stars', 'inventory']) {
    assert(!(forbidden in (res.payload || {})), `"${forbidden}" is absent from the payload`);
  }
  // and nothing personal survives anywhere in the encoded string
  assert(!/Snacks/.test(JSON.stringify(res.payload)), 'no nickname anywhere in the postcard');
  assert(!/"name"/.test(JSON.stringify(res.payload)), 'no name key anywhere in the postcard');
  assert(res.payload.roster && res.payload.roster.length === 1 && res.payload.roster[0].shiny === true && res.payload.roster[0].acc.includes('acc_sunhat'),
    `the roster carries look-only facts (${JSON.stringify(res.payload.roster)})`);
  await ctx.close();
}
{
  // the restore box rejects a postcard with the authored line
  const { ctx, page } = await open(SAVE(), { area: null });
  const msg = await page.evaluate(() => {
    const r = window.BooTown.State.readSaveText('BTPC1.abc');
    return { ok: r.ok, error: r.error };
  });
  assert(msg.ok === false, 'a postcard is refused as a backup');
  assert(msg.error === "That's a Town Postcard for visiting, not a backup. Backups start with a different code.",
    `with the authored line ("${msg.error}")`);
  const real = await page.evaluate(() => {
    const code = window.BooTown.State.exportCode ? window.BooTown.State.exportCode() : null;
    if (!code) return { skipped: true };
    const r = window.BooTown.State.readSaveText(code);
    return { ok: r.ok };
  });
  if (!real.skipped) assert(real.ok === true, 'and a REAL backup still restores');
  await ctx.close();
}

// ==================== Item 12 — no silence tax, no bare "?" ====================
console.log('== item 12: requests recharge honestly and always show something ==');
{
  const now = Date.now();
  const save = SAVE({
    settings: { sound: false, music: false, voice: false, content: 'full', requests: true },
    request: { actives: [{ id: 'maths', booId: BOOS[0], text: 'Will you play a maths game for me?', createdAt: now - 60 * 3600 * 1000 }], lastResolvedAt: 0 },
    town: { areas: Object.assign(AREAS(), { meadow: { items: [{ zone: 'meadow', x: 0.3, row: 1, item: BOOS[0] }], paths: [] } }) }
  });
  const { ctx, page } = await open(save, { area: 'meadow', now });
  await dismissReveal(page);
  const st = await page.evaluate((cutoff) => {
    const s = window.BooTown.State.getState();
    const live = s.request.actives || [];
    return {
      lastResolvedAt: s.request.lastResolvedAt,
      stale: live.filter(r => r.createdAt <= cutoff).length,
      total: live.length
    };
  }, now - 50 * 3600 * 1000);
  assert(st.stale === 0, `the 60h-old request is gone (${st.stale} stale of ${st.total} live)`);
  // The point of item 12: because expiry no longer stamps lastResolvedAt, the recharge gate
  // is already open, so the town can wonder something NEW on this very visit instead of
  // taxing her with three hours of silence. A fresh request here is the fix working.
  assert(st.lastResolvedAt === 0, `and expiry did NOT stamp lastResolvedAt — no silence tax (${st.lastResolvedAt})`);
  await ctx.close();
}
{
  // every template id renders a real glyph; '?' may never appear
  const now = Date.now();
  const ids = ['spell2', 'maths', 'threeStar', 'paint', 'dressUp', 'box', 'somethingNewLater'];
  for (const id of ids) {
    const save = SAVE({
      settings: { sound: false, music: false, voice: false, content: 'full', requests: true },
      request: { actives: [{ id, booId: BOOS[0], text: 'A template request.', createdAt: now }], lastResolvedAt: now },
      town: { areas: Object.assign(AREAS(), { meadow: { items: [{ zone: 'meadow', x: 0.3, row: 1, item: BOOS[0] }], paths: [] } }) }
    });
    const { ctx, page } = await open(save, { area: 'meadow', now });
    await dismissReveal(page);
    const glyph = await page.evaluate(() => {
      const n = document.querySelector('.request-thought .rq-ask');
      return n ? n.textContent : (document.querySelector('.request-thought') ? 'ART' : null);
    });
    assert(glyph !== '?', `template "${id}" renders a real glyph, never "?" (got ${JSON.stringify(glyph)})`);
    assert(glyph && glyph.length > 0, `template "${id}" renders something (${JSON.stringify(glyph)})`);
    await ctx.close();
  }
}

// ==================== Item 13 — canPlaceIn guards a bad index ====================
console.log('== item 13: canPlaceIn(NaN) is false, not a throw ==');
{
  const { ctx, page } = await open(SAVE(), { area: 'meadow' });
  await dismissReveal(page);
  const r = await page.evaluate(() => {
    // placeAt routes through canPlaceIn(zoneAndXAt(...)); a wildly out-of-band drop must
    // refuse quietly rather than throw on an undefined ZONES entry.
    const out = [];
    for (const [fx, fy] of [[9, 0.78], [-4, 0.78], [0.5, 9]]) {
      try { window.__townLife.forceHold('boo_inky'); window.__townLife.placeAt(fx, fy); out.push('ok'); }
      catch (e) { out.push(String(e)); }
    }
    return out;
  });
  assert(r.every(x => x === 'ok'), `out-of-range placements refuse without throwing (${r.join(' | ')})`);
  await ctx.close();
}

console.log(pageErrors.length ? '\nPAGE/CONSOLE ERRORS: ' + pageErrors.slice(0, 6).join(' | ') : '\nno page or console errors');
if (pageErrors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
