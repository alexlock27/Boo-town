// tests/r10p5-personalities.mjs — RUN10 P5: personalities + hide-and-seek 2.0.
// Acceptance: 200 seeded days always attach to a real placed item's point, never bare
// coordinates; peek sprite bbox intersects item bbox (pixel test); giggle/wiggle cadence
// within bounds; act distribution across 500 choices per temperament shifts in the
// specified directions (chi-square vs uniform, reported below); catchphrase rate 20%±5
// over 400 taps; the 👀 map chip shows only on the hiding area.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p5', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot'].map(n => 'boo_' + n);
const AREAS_EMPTY = () => ({ meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } });
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const FURNITURE = ['deco_bed', 'deco_rug', 'deco_table', 'deco_sofa', 'deco_tablelamp', 'deco_wardrobe', 'deco_bathtub', 'deco_bookshelf'];

const SAVE = (areaKey, items, over = {}) => Object.assign({
  version: 6, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries([...BOOS.map(b => [b, 1]), ...FURNITURE.map(f => [f, 1])]),
  boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
  town: { areas: Object.assign(AREAS_EMPTY(), { [areaKey]: { items, paths: [] } }) },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { funfairOpened: 'x', introSeen: {}, trophyRetro: true, townFirst: true, areasUnlocked: ['riverside', 'hilltop', 'beach', 'funfair'], boohouseSeeded: true },
  delights: { hideDay: TODAY, hideFound: true },   // no daily hider by default — most scenes don't want one underfoot
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

// ==================== personality assignment is stable ====================
console.log('== personalities: stable per Boo id, spans real catalogue ids ==');
{
  const ctx0 = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx0.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const info = await page.evaluate(async () => {
    const p = await import('./data/personalities.js');
    const cat = await import('./data/catalogue.js');
    const boos = cat.CATALOGUE.filter(it => it.kind === 'boo').map(it => it.id);
    const stable = boos.every(id => p.personalityOf(id) === p.personalityOf(id));
    const byTemperament = {};
    for (const id of boos) { const t = p.personalityOf(id); (byTemperament[t] = byTemperament[t] || []).push(id); }
    return { stable, temperaments: Object.keys(byTemperament), counts: Object.fromEntries(Object.entries(byTemperament).map(([k, v]) => [k, v.length])), byTemperament };
  });
  assert(info.stable, 'personalityOf() is stable (same id, same result, called twice)');
  assert(info.temperaments.length === 6, `all 6 temperaments appear across the real catalogue (${info.temperaments.join(', ')})`);
  await ctx0.close();

  // stash for later sections
  var idByTemperament = info.byTemperament;
}
function pick(temperament) { return idByTemperament[temperament][0]; }

// ==================== act distribution: chi-square vs uniform per temperament ====================
console.log('== act distribution: 500 choices/temperament, chi-square vs uniform ==');
async function chiSquareCase(areaItems, actorIdx, label, hour = 13) {
  const { ctx, page } = await openArea('meadow', areaItems, { hour });
  const result = await page.evaluate(({ i, n }) => window.__townLife.behaviourSample(i, n), { i: actorIdx, n: 500 });
  await ctx.close();
  if (!result) { assert(false, `${label}: no actor at index ${actorIdx}`); return null; }
  const kinds = Object.keys(result);
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  const K = kinds.length;
  const expected = total / K;
  const chi2 = kinds.reduce((sum, k) => sum + Math.pow(result[k] - expected, 2) / expected, 0);
  console.log(`    ${label}: counts=${JSON.stringify(result)} K=${K} chi2=${chi2.toFixed(1)} (df=${K - 1})`);
  assert(total === 500, `${label}: 500 samples drawn (${total})`);
  assert(K >= 2, `${label}: at least 2 candidate kinds were on offer (${K})`);
  assert(chi2 > 15, `${label}: distribution differs from uniform (chi2=${chi2.toFixed(1)} > 15)`);
  return result;
}
{
  // bouncy {trampoline:2.0, chase:1.5, nap:0.5} — a nearby free trampoline, no friend, daytime
  const r = await chiSquareCase([
    { zone: 'meadow', x: 0.10, row: 2, item: 'deco_trampoline' },
    { zone: 'meadow', x: 0.11, row: 1, item: pick('bouncy') }
  ], 0, 'bouncy (trampoline boosted)');
  if (r) assert((r.approach || 0) > 500 / Object.keys(r).length, `bouncy leans toward the trampoline ('approach' share ${((r.approach || 0) / 5).toFixed(0)}%)`);
}
{
  // sleepy {nap:2.5, bench:1.5, chase:0.4} — a bench + a boohouse (nap target) nearby, at night
  const r = await chiSquareCase([
    { zone: 'meadow', x: 0.10, row: 2, item: 'deco_bench' },
    { zone: 'meadow', x: 0.30, row: 2, item: 'deco_boohouse' },
    { zone: 'meadow', x: 0.11, row: 1, item: pick('sleepy') }
  ], 0, 'sleepy (nap boosted, night)', 22);
  if (r) assert((r.nap || 0) > 500 / Object.keys(r).length, `sleepy leans toward napping (share ${((r.nap || 0) / 5).toFixed(0)}%)`);
}
{
  // cheeky {chase:1.6, visit:1.4, watch:0.7} — a nearby friend to visit
  const r = await chiSquareCase([
    { zone: 'meadow', x: 0.10, row: 1, item: pick('cheeky') },
    { zone: 'meadow', x: 0.16, row: 1, item: BOOS[9] }
  ], 0, 'cheeky (visit+chase boosted, watch damped)');
  if (r) assert((r.visit || 0) > 500 / Object.keys(r).length, `cheeky leans toward visiting (share ${((r.visit || 0) / 5).toFixed(0)}%)`);
}
{
  // shy {watch:1.8, visit:0.6} — same friend scene, opposite lean
  const r = await chiSquareCase([
    { zone: 'meadow', x: 0.10, row: 1, item: pick('shy') },
    { zone: 'meadow', x: 0.16, row: 1, item: BOOS[9] }
  ], 0, 'shy (watch boosted, visit damped)');
  if (r) assert((r.watch || 0) > 500 / Object.keys(r).length, `shy leans toward watching, not visiting (share ${((r.watch || 0) / 5).toFixed(0)}%)`);
}
{
  // musical {danceStage:2.2, fairBand:1.6} — a placed Dance Stage
  const r = await chiSquareCase([
    { zone: 'meadow', x: 0.10, row: 2, item: 'deco_stage' },
    { zone: 'meadow', x: 0.11, row: 1, item: pick('musical') }
  ], 0, 'musical (danceStage boosted)');
  if (r) assert((r.musicwatch || 0) > 500 / Object.keys(r).length, `musical leans toward the stage (share ${((r.musicwatch || 0) / 5).toFixed(0)}%)`);
}
{
  // sporty {slide:1.8, swings:1.6, seesaw:1.5} — a nearby free slide
  const r = await chiSquareCase([
    { zone: 'meadow', x: 0.10, row: 2, item: 'deco_slide' },
    { zone: 'meadow', x: 0.11, row: 1, item: pick('sporty') }
  ], 0, 'sporty (slide boosted)');
  if (r) assert((r.approach || 0) > 500 / Object.keys(r).length, `sporty leans toward the slide ('approach' share ${((r.approach || 0) / 5).toFixed(0)}%)`);
}

// ==================== shy greetDist: stands further back on a visit ====================
console.log('== shy: stands further back on a friend visit (greetDist, +20px) ==');
// Measures how far the STOPPING POINT sits from the friend (not from the actor's own
// start) — |targetDx| alone is the wrong proxy, since standing further from the friend
// can mean walking a SHORTER distance from home if the friend is on the near side.
async function visitStandoffPx(temperament) {
  const ACTOR_X = 0.10, FRIEND_X = 0.16;
  const { ctx, page } = await openArea('meadow', [
    { zone: 'meadow', x: ACTOR_X, row: 1, item: pick(temperament) },
    { zone: 'meadow', x: FRIEND_X, row: 1, item: BOOS[9] }
  ]);
  const info = await page.evaluate(({ actorX, friendX }) => {
    const kind = window.__townLife.force(0, 'visit');
    const targetDx = window.__townLife.goalTargetDx(0);
    const zoneW = window.__town.geometry().zoneW;
    const gapToFriendPx = (friendX - actorX) * zoneW - targetDx;
    return { kind, gapToFriendPx };
  }, { actorX: ACTOR_X, friendX: FRIEND_X });
  await ctx.close();
  return info;
}
{
  const shy = await visitStandoffPx('shy');
  const control = await visitStandoffPx('bouncy');   // no visit-related multiplier, no greetDist
  assert(shy.kind === 'visit' && control.kind === 'visit', `both scenes start a visit (shy=${shy.kind}, control=${control.kind})`);
  assert(shy.gapToFriendPx > control.gapToFriendPx, `shy stands further from the friend than a non-shy Boo (shy ${shy.gapToFriendPx.toFixed(1)}px vs control ${control.gapToFriendPx.toFixed(1)}px)`);
  assert(Math.abs((shy.gapToFriendPx - control.gapToFriendPx) - 20) < 3, `the extra standoff is ~20px, matching SHY_GREET_DIST_PX (measured ${(shy.gapToFriendPx - control.gapToFriendPx).toFixed(1)}px)`);
}

// ==================== catchphrase rate: 20%±5 over 400 taps ====================
console.log('== catchphrase: ~20% of taps, exact authored line ==');
{
  const booId = pick('bouncy');
  const { ctx, page } = await openArea('meadow', [{ zone: 'meadow', x: 0.2, row: 1, item: booId }]);
  const texts = await page.evaluate((n) => {
    const out = [];
    for (let i = 0; i < n; i++) { const t = window.__townLife.tapAndSample(0); if (t) out.push(t); }
    return out;
  }, 400);
  const rate = texts.length / 400;
  console.log(`    ${texts.length}/400 taps showed the catchphrase (${(rate * 100).toFixed(1)}%)`);
  assert(rate >= 0.15 && rate <= 0.25, `catchphrase rate is 20%±5 (${(rate * 100).toFixed(1)}%)`);
  assert(texts.length > 0 && texts.every(t => t === 'Boing boing BOING!'), `every shown bubble is bouncy's exact authored line ("${texts[0]}")`);
  await ctx.close();
}

// ==================== hide-and-seek 2.0: 200 seeded days always attach to a real point ====================
console.log('== hide-and-seek: 200 seeded days always attach to a hidePoint or the fallback ==');
{
  const ctx0 = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx0.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const result = await page.evaluate(async () => {
    const sockets = await import('./data/sockets.js');
    const delights = await import('./js/delights.js');
    const st = await import('./js/state.js');
    const hidePointKeys = Object.keys(sockets.HIDE_POINTS);
    let bad = 0, sawFallback = 0, sawReal = 0;
    for (let day = 0; day < 200; day++) {
      // vary the scene: some days nothing hide-capable is placed (fallback path), most days
      // a random mix of 1-3 hide-capable items across areas, plus at least one Boo.
      const hasSpots = day % 5 !== 0;   // 4/5 of days have real spots; 1/5 tests the fallback
      const areas = { meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } };
      areas.meadow.items.push({ zone: 'meadow', x: 0.2, row: 1, item: 'boo_inky' });
      if (hasSpots) {
        const n = 1 + (day % 3);
        const zoneKeys = ['meadow', 'riverside', 'beach', 'boohouse'];
        for (let k = 0; k < n; k++) {
          const key = hidePointKeys[(day * 7 + k) % hidePointKeys.length];
          const zone = zoneKeys[(day + k) % zoneKeys.length];
          areas[zone].items.push({ zone, x: 0.1 + k * 0.1, row: 1, item: key });
        }
      }
      localStorage.setItem('bootown.save.v1', JSON.stringify({
        version: 6, name: 'A', guide: { species: 'giraffe', body: 'sunshine', pattern: 'none', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
        inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 },
        nicknames: {}, equips: {}, catBest: {}, stars: { total: 0, byGame: {} }, ledger: {},
        town: { areas }, settings: {}, seen: { introSeen: {} }, delights: {}, trophies: {}, ageAsked: true, age: 8
      }));
      st.load();
      const h = delights.ensureHide();
      if (!h || !h.spot) { bad++; continue; }
      const isFallback = h.spot.item === 'deco_oak' && h.spot.zone === 'meadow' && h.spot.x === 0.15;
      const isReal = hidePointKeys.includes(h.spot.item);
      if (isFallback) sawFallback++; else if (isReal) sawReal++; else bad++;
    }
    return { bad, sawFallback, sawReal };
  });
  assert(result.bad === 0, `all 200 seeded days attach to a real hidePoint or the named fallback (${result.bad} bad)`);
  assert(result.sawReal > 0 && result.sawFallback > 0, `both the real-spot path and the fallback path were exercised (real=${result.sawReal}, fallback=${result.sawFallback})`);
  await ctx0.close();
}

// ==================== peek sprite bbox intersects item bbox ====================
console.log('== hide-and-seek: peek sprite bbox intersects its host item bbox ==');
{
  const items = [
    { zone: 'meadow', x: 0.05, row: 1, item: 'deco_oak' },
    { zone: 'meadow', x: 0.12, row: 1, item: 'boo_inky' }
  ];
  const over = { delights: { hideDay: TODAY, hideFound: false, hideBoo: 'boo_inky', hideSpot: { zone: 'meadow', x: 0.05, item: 'deco_oak' } } };
  const { ctx, page } = await openArea('meadow', items, { over });
  const boxes = await page.evaluate(() => ({ peek: window.__townLife.hidePeekBBox(), item: window.__townLife.hideItemBBox() }));
  assert(!!boxes.peek, 'the peek sprite renders');
  assert(!!boxes.item, "the host item's own bbox is readable");
  if (boxes.peek && boxes.item) {
    const intersects = boxes.peek.left < boxes.item.right && boxes.peek.right > boxes.item.left && boxes.peek.top < boxes.item.bottom && boxes.peek.bottom > boxes.item.top;
    assert(intersects, `peek bbox ${JSON.stringify(boxes.peek)} intersects item bbox ${JSON.stringify(boxes.item)}`);
  }
  const hiderHidden = await page.evaluate(() => { const w = [...document.querySelectorAll('.t-item.boo')].find(x => x.dataset.item === 'boo_inky'); return w ? w.style.display === 'none' : null; });
  assert(hiderHidden === true, 'the hiding Boo itself is tucked away (display:none) while peeking');
  await page.screenshot({ path: 'screenshots/r10p5/hide-peek-1024x700.png' });
  await ctx.close();
}

// The no-scenery fallback is the Meadow's permanent oak, not a bare coordinate.
console.log('== hide-and-seek: fallback peek is visibly occluded by the permanent Meadow oak ==');
{
  const over = { delights: { hideDay: TODAY, hideFound: false, hideBoo: 'boo_inky', hideSpot: { zone: 'meadow', x: 0.15, item: 'deco_oak' } } };
  const { ctx, page } = await openArea('meadow', [{ zone: 'meadow', x: 0.12, row: 1, item: 'boo_inky' }], { over });
  const boxes = await page.evaluate(() => ({ peek: window.__townLife.hidePeekBBox(), item: window.__townLife.hideItemBBox(), oak: !!document.querySelector('.t-hide-fallback-oak') }));
  assert(boxes.oak, 'the permanent Meadow oak renders when no placed hide spot exists');
  assert(!!boxes.peek && !!boxes.item, 'the fallback peek and its oak host are both measurable');
  if (boxes.peek && boxes.item) {
    const intersects = boxes.peek.left < boxes.item.right && boxes.peek.right > boxes.item.left && boxes.peek.top < boxes.item.bottom && boxes.peek.bottom > boxes.item.top;
    assert(intersects, 'the fallback peek intersects the permanent oak instead of floating in space');
  }
  await ctx.close();
}

// ==================== found → existing celebration ====================
console.log('== hide-and-seek: tapping the peek finds the hider (existing celebration) ==');
{
  const items = [
    { zone: 'meadow', x: 0.05, row: 1, item: 'deco_oak' },
    { zone: 'meadow', x: 0.12, row: 1, item: 'boo_inky' }
  ];
  const over = { delights: { hideDay: TODAY, hideFound: false, hideBoo: 'boo_inky', hideSpot: { zone: 'meadow', x: 0.05, item: 'deco_oak' } } };
  const { ctx, page } = await openArea('meadow', items, { over });
  const box = await page.evaluate(() => window.__townLife.hidePeekBBox());
  await page.mouse.click(box.left + box.width / 2, box.top + box.height / 2);
  await sleep(200);
  const after = await page.evaluate(() => ({ peekGone: !window.__townLife.hidePeekEl(), hiderShown: (() => { const w = [...document.querySelectorAll('.t-item.boo')].find(x => x.dataset.item === 'boo_inky'); return w ? w.style.display !== 'none' : null; })() }));
  assert(after.peekGone, 'the peek sprite is gone once found');
  assert(after.hiderShown === true, 'the hider is revealed on the ground');
  await ctx.close();
}

// ==================== giggle/wiggle cadence within bounds ====================
console.log('== hide-and-seek: giggle+wiggle cadence stays within 8-14s bounds ==');
{
  const items = [
    { zone: 'meadow', x: 0.05, row: 1, item: 'deco_oak' },
    { zone: 'meadow', x: 0.12, row: 1, item: 'boo_inky' }
  ];
  const over = { delights: { hideDay: TODAY, hideFound: false, hideBoo: 'boo_inky', hideSpot: { zone: 'meadow', x: 0.05, item: 'deco_oak' } } };
  const { ctx, page } = await openArea('meadow', items, { over });
  // The natural mount already scheduled one real setTimeout (renderHide → scheduleHideWiggle)
  // — confirm it hasn't fired early, then wait past the 8s floor and confirm it really does,
  // proving the setTimeout wiring itself (not just the delay-generation math).
  const notYet = await page.evaluate(() => window.__townLife.hideWiggling());
  assert(notYet === false, 'no wiggle before the 8s floor');
  await sleep(14400);   // past HIDE_WIGGLE_MAX_MS (14000) — the random delay could land anywhere in [8000,14000]
  const firedOnItsOwn = await page.evaluate(() => window.__townLife.hideWiggling());
  assert(firedOnItsOwn === true, 'the real setTimeout fires its own wiggle within the 8-14s window');
  // fast-forward the rest: force the cycle 50 more times back-to-back (≈550s of simulated
  // hider lifetime at the ~11s average — well past the spec's "simulated 3 minutes") and
  // collect every chosen delay, rather than literally waiting real minutes in CI.
  const delays = await page.evaluate(() => { const out = []; for (let i = 0; i < 50; i++) { const d = window.__townLife.forceHideWiggle(); if (d != null) out.push(d); } return out; });
  assert(delays.length === 50, `50 wiggle cycles sampled (${delays.length})`);
  assert(delays.every(d => d >= 8000 && d <= 14000), `every delay stays within [8000,14000]ms (min ${Math.min(...delays)}, max ${Math.max(...delays)})`);
  await ctx.close();
}

// ==================== the 👀 map chip shows only on the hiding area ====================
console.log('== world map: 👀 chip shows only on the area actually hiding someone ==');
{
  const ctx0 = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx0.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const save = SAVE('meadow', [{ zone: 'meadow', x: 0.05, row: 1, item: 'deco_oak' }, { zone: 'meadow', x: 0.12, row: 1, item: 'boo_inky' }], {
    delights: { hideDay: TODAY, hideFound: false, hideBoo: 'boo_inky', hideSpot: { zone: 'meadow', x: 0.05, item: 'deco_oak' } }
  });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.worldmap');
  await page.waitForFunction(() => window.__worldmap, { timeout: 4000 });
  await sleep(200);
  const info = await page.evaluate(() => ({
    hidingArea: window.__worldmap.hidingArea(),
    meadow: window.__worldmap.hideChipShown('meadow'),
    riverside: window.__worldmap.hideChipShown('riverside'),
    funfair: window.__worldmap.hideChipShown('funfair')
  }));
  assert(info.hidingArea === 'meadow', `the hider is tracked as hiding in the meadow (${info.hidingArea})`);
  assert(info.meadow === true, 'the meadow badge shows the 👀 chip');
  assert(info.riverside === false && info.funfair === false, 'no other badge shows the chip');
  await page.screenshot({ path: 'screenshots/r10p5/worldmap-hidechip-1024x700.png' });
  await ctx0.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
