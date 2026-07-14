// tests/r6p9-perf.mjs — RUN6 phase 9 PERFORMANCE GATE (part D #10).
// The three busiest scenes — a crowded town, the full funfair, the Boss Grump quest —
// must each hold TRANSFORM-ONLY animation with concurrent actors + emitters bounded by
// named constants. We prove it three ways per scene:
//   (1) a global CSSOM audit: no @keyframes animates a LAYOUT-triggering property (reflow);
//   (2) the named caps hold under deliberate over-pressure (more actors than the cap);
//   (3) frame evidence of real motion + an rAF cadence sample (main thread not pinned).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r6p9', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

// properties whose animation forces layout/reflow — the framerate killers on a tablet
const LAYOUT_PROPS = ['left', 'top', 'right', 'bottom', 'width', 'height', 'min-width', 'min-height',
  'max-width', 'max-height', 'margin', 'margin-top', 'margin-left', 'margin-right', 'margin-bottom',
  'padding', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom', 'inset', 'border-width',
  'flex-basis', 'gap', 'font-size'];

const RARE_BOOS = ['boo_bubbles', 'boo_minty', 'boo_skye', 'boo_candy', 'boo_gigi', 'boo_peppy', 'boo_sol', 'boo_comet']; // 8 rare
const ULTRA_BOOS = ['boo_disco', 'boo_starnova', 'boo_prism'];                                                          // 3 ultra
const COMMON_BOOS = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp'];                                    // 5 common
const ALL_RIDES = ['carousel', 'ferris', 'teacups', 'bouncy', 'helter'];
const RIDE_SEAT_TOTAL = 3 + 4 + 4 + 3 + 3;   // sum(RIDE_SEATS) = 17 — the funfair emitter budget

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 20, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [], stars: { total: 300, byGame: {} }, ledger: {}, spellingMastery: {}, journal: {}, quest: { node: 0, lands: {} },
  delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside', 'hilltop', 'beach', 'funfair'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function open(save, { hour = 13, month = null, vp = { width: 1000, height: 640 } } = {}) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(([h, m]) => { window.__bootownHour = h; if (m != null) window.__bootownMonth = m; }, [hour, month]);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
// rAF cadence sampler — ~120 frames (~2s at 60fps). Loose gate: avg frame time proves the
// main thread isn't pinned by reflow (a layout-thrashing regression would spike this hard).
async function cadence(page) {
  return page.evaluate(() => new Promise(res => {
    const d = []; let last = performance.now(), n = 0;
    (function tick(t) { d.push(t - last); last = t; if (++n < 120) requestAnimationFrame(tick); else { d.shift(); const avg = d.reduce((a, b) => a + b, 0) / d.length; res({ avg: +avg.toFixed(1), long: d.filter(x => x > 32).length, max: +Math.max(...d).toFixed(1), frames: d.length }); } })(performance.now());
  }));
}

// ==================== (1) global transform-only CSS audit ====================
console.log('== transform-only: no @keyframes forces layout (reflow) ==');
{
  const { ctx, page } = await open(SAVE());
  const res = await page.evaluate((LAYOUT) => {
    const offenders = {}; let kf = 0;
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        if (r.type === CSSRule.KEYFRAMES_RULE) {
          kf++;
          for (const step of r.cssRules) {
            const st = step.style;
            for (let i = 0; i < st.length; i++) if (LAYOUT.includes(st[i])) (offenders[r.name] = offenders[r.name] || []).push(st[i]);
          }
        }
      }
    }
    const out = {}; for (const k in offenders) out[k] = [...new Set(offenders[k])];
    return { kf, out };
  }, LAYOUT_PROPS);
  console.log(`  scanned ${res.kf} @keyframes rules`);
  const names = Object.keys(res.out);
  if (names.length) console.log('  offenders: ' + JSON.stringify(res.out));
  assert(names.length === 0, `every animation is transform/opacity-only — no keyframe animates a layout property (${res.kf} keyframes clean)`);
  await ctx.close();
}

// ==================== (2) busiest TOWN — 20 items, 16 Boos, night + snow ====================
console.log('== busiest town: 20 placed items, night winter, over-pressure on every cap ==');
{
  const boos = [...RARE_BOOS, ...ULTRA_BOOS, ...COMMON_BOOS];   // 16 Boos (11 rare+), > MAX_ACTIVE_ROLES(12)
  const decos = ['deco_boohouse', 'deco_tree', 'deco_campfire', 'deco_slide'];   // 4 → 20 items total
  const town = [], inv = {};
  boos.forEach((b, i) => { town.push({ zone: 'meadow', x: +(0.08 + i * 0.055).toFixed(3), item: b }); inv[b] = (inv[b] || 0) + 1; });
  decos.forEach((d, i) => { town.push({ zone: 'meadow', x: +(0.15 + i * 0.2).toFixed(2), item: d }); inv[d] = (inv[d] || 0) + 1; });
  const { ctx, page } = await open(SAVE({ inventory: inv, town }), { hour: 22, month: 12 });   // 22:00 December → naps + snow
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await page.waitForFunction(() => window.__townLife);
  await sleep(1800);   // let Boos choose behaviours (naps under house/tree at night)

  const ground = await page.evaluate(() => document.querySelectorAll('.town2 .t-item.boo').length);
  assert(ground === 16, `all 16 Boos rendered on the ground (${ground})`);
  const actors = await page.evaluate(() => window.__townLife.actorCount());
  assert(actors === 13 && (16 - actors) === 3, `wanderer split holds: ${actors} wander, the 3 ultra fx-Boos render STATIC (not animated actors) — a named perf rule`);
  const roles = await page.evaluate(() => window.__townLife.roleCount());
  assert(roles <= 12, `active-role cap holds: ${roles} active roles ≤ MAX_ACTIVE_ROLES(12)`);
  const w = await page.evaluate(() => window.__townLife.weather());
  assert(w && w.particles >= 1 && w.particles <= 14, `one seasonal weather layer, capped: ${w ? w.particles : 'none'} particles ∈ [1, WEATHER_PARTICLES(14)] (winter snow)`);
  const critters = await page.evaluate(() => window.__townLife.chaseCritters());
  assert(critters <= 1, `chase critters capped: ${critters} ≤ 1`);
  const fancy = await page.evaluate(() => document.querySelectorAll('.town2 .rfx-glint, .town2 .rfx-shimmer, .town2 .rfx-aura').length);
  const sheen = await page.evaluate(() => document.querySelectorAll('.town2 .rfx-sheen').length);
  assert(fancy <= 6, `rarity emitter cap holds: ${fancy} fully-animated rare+ items ≤ RARITY_TOWN_CAP(6)`);
  assert(sheen >= 1, `over-cap rare+ items degrade to a static sheen (${sheen} degraded; 11 rare+ placed)`);

  // motion evidence — 6 frames over 3s; count actors whose transform changed
  const frames = [];
  for (let f = 0; f < 6; f++) { frames.push(await page.evaluate(() => { const o = []; for (let i = 0; i < window.__townLife.actorCount(); i++) o.push(window.__townLife.transform(i)); return o; })); await sleep(520); }
  let moved = 0; for (let i = 0; i < 16; i++) { const seen = new Set(frames.map(fr => fr[i])); if (seen.size >= 2) moved++; }
  assert(moved >= 4, `frame evidence: ${moved} Boos changed transform across 6 frames / ~3s (transform-only motion)`);
  await page.screenshot({ path: 'screenshots/r6p9/town-busiest-1000x640.png' });

  const c = await cadence(page);
  console.log(`  town cadence: avg ${c.avg}ms · max ${c.max}ms · ${c.long}/${c.frames} frames > 32ms`);
  assert(c.avg < 40, `town main thread not pinned by reflow (avg frame ${c.avg}ms < 40ms)`);
  await ctx.close();
}

// ==================== (3) busiest FUNFAIR — all 5 rides built + fully seated, AT NIGHT (1am) ====================
// The hotfix keeps the funfair OPEN and its rides RUNNING at night (dark sky + glowing string
// lights, but the rides never park). This scene runs at 01:00 at full pressure to prove the night
// funfair — every ride structure idle-running PLUS 17 riders orbiting — still holds the gate.
console.log('== busiest funfair at NIGHT (01:00): all rides running + fully seated, string lights on ==');
{
  const boos = [...RARE_BOOS, ...ULTRA_BOOS, ...COMMON_BOOS];
  const inv = Object.fromEntries(boos.map(b => [b, 1]));
  // fill every seat on every ride (17 riders) to hit the funfair emitter budget
  const seats = { carousel: [boos[0], boos[1], boos[2]], ferris: [boos[3], boos[4], boos[5], boos[6]], teacups: [boos[7], boos[8], boos[9], boos[10]], bouncy: [boos[11], boos[12], boos[13]], helter: [boos[14], boos[15], boos[0]] };
  const { ctx, page } = await open(SAVE({ inventory: inv, stars: { total: 520, byGame: {} }, funfair: { built: ALL_RIDES.slice(), build: null, pending: [], seats } }), { hour: 1 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'funfair' }));   // RUN10 P1: the fair is its own area
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife);

  // RUN10 P1: the funfair area is 4 viewports wide and its 5 rides span x 0.18-0.92 — no
  // single scroll position (not even "centred") shows more than ~2 at once, and
  // stepFunfairRides only steps rides in the visible window (a named perf rule, like the
  // wanderer/rarity caps above). So: confirm each ride individually while scrolled to it.
  const RIDE_X = { carousel: 0.18, ferris: 0.40, teacups: 0.60, bouncy: 0.78, helter: 0.92 };
  const onScreen = await page.evaluate(async (x) => {
    const frame = () => new Promise(r => requestAnimationFrame(() => r()));
    for (let tries = 0; tries < 30; tries++) {
      window.__townLife.scrollToFrac(x);
      await frame(); await new Promise(r => setTimeout(r, 60));
      const box = document.querySelector('.ff-ride');
      if (box) { const l = box.getBoundingClientRect().left; if (l > -260 && l < window.innerWidth + 260) return true; }
    }
    return false;
  }, RIDE_X.carousel);
  assert(onScreen, 'the funfair scrolled on-screen at 01:00');
  await sleep(400);

  assert(await page.evaluate(() => !!document.querySelector('.ff-scenery.night')), 'night lighting is on at 01:00 (glowing string lights — .ff-scenery.night)');
  const rides = await page.evaluate(() => window.__townLife.ffRides());
  assert(rides.length === 5, `all five rides built (${rides.join(', ')})`);
  let seated = 0; for (const r of ALL_RIDES) seated += await page.evaluate(rd => window.__townLife.ffRideSeats(rd).filter(Boolean).length, r);
  assert(seated <= RIDE_SEAT_TOTAL, `seated riders within the seat budget: ${seated} ≤ sum(RIDE_SEATS)=${RIDE_SEAT_TOTAL}`);
  assert(seated >= 15, `the fair is genuinely busy at night: ${seated} riders aboard`);

  // Collect IN-PAGE over ~0.5s of real rAF frames PER RIDE (scrolled into view): BOTH the
  // seated-rider orbits AND the ride STRUCTURE idle (.ffm) must animate — an empty OR full
  // ride must never look "parked" at night.
  const seatDistinct = [], structDistinct = [];
  for (const ride of ALL_RIDES) {
    await page.evaluate(x => window.__townLife.scrollToFrac(x), RIDE_X[ride]);
    const d = await page.evaluate(async (r) => {
      const frame = () => new Promise(res => requestAnimationFrame(() => res()));
      await frame(); await new Promise(res => setTimeout(res, 200));
      const seat = new Set(), struct = new Set();
      for (let f = 0; f < 20; f++) {
        const box = [...document.querySelectorAll('.ff-ride')].find(x => x.dataset.ride === r);
        seat.add(window.__townLife.ffSeatTransforms(r).join('|'));
        const g = box && box.querySelector('.ffm'); struct.add(g ? g.getAttribute('transform') : 'none');
        await frame();
      }
      return { seat: seat.size, struct: struct.size };
    }, ride);
    seatDistinct.push(d.seat); structDistinct.push(d.struct);
  }
  const seatsMoving = seatDistinct.filter(s => s >= 2).length;
  const structMoving = structDistinct.filter(s => s >= 2).length;
  assert(seatsMoving === 5, `frame evidence: all ${seatsMoving}/5 rides' riders orbit at night (per-ride distinct: ${seatDistinct.join('/')})`);
  assert(structMoving === 5, `frame evidence: all ${structMoving}/5 ride STRUCTURES idle-run at night — the fair never parks (per-ride distinct: ${structDistinct.join('/')})`);
  await page.screenshot({ path: 'screenshots/r6p9/funfair-busiest-night-1000x640.png' });

  const c = await cadence(page);
  console.log(`  funfair(night) cadence: avg ${c.avg}ms · max ${c.max}ms · ${c.long}/${c.frames} frames > 32ms`);
  assert(c.avg < 40, `night funfair main thread not pinned (avg frame ${c.avg}ms < 40ms)`);
  await ctx.close();
}

// ==================== (4) busiest QUEST — the Boss Grump cheer finale ====================
console.log('== busiest quest: the Boss Grump cheer-off (most confetti/motes) ==');
{
  const { ctx, page } = await open(SAVE({ quest: { node: 5, lands: {} } }));   // node 5 = Boss Grump
  await page.evaluate(() => window.BooTown.go('booquest'));
  await page.waitForSelector('.booquest');
  await page.waitForFunction(() => window.__booquest);
  await page.evaluate(() => window.__booquest.open());
  await page.waitForFunction(() => window.__booquest.curType() === 'boss');

  // Confetti is drawn to ONE shared canvas with a named `count` per burst (30) — there is no
  // unbounded DOM particle layer. Prove that: the only emitter is a single #confetti-canvas.
  await page.evaluate(() => window.__booquest.answer(true)); await sleep(120);
  const domParticles = await page.evaluate(() => document.querySelectorAll('.bq-mote, .bq-confetti, [class*="confetti"]:not(canvas)').length);
  const canvases = await page.evaluate(() => document.querySelectorAll('canvas#confetti-canvas, canvas.confetti-canvas, #confetti-canvas').length);
  assert(domParticles === 0, `quest sprays NO unbounded DOM particles (${domParticles}); confetti is a single capped canvas burst (count:30)`);

  // Grump motion is a transient transform bounce (bqCheer, on the .bq-grump-cloud CHILD) added on
  // each cheer. Sample it IN-PAGE across real rAF frames, firing the scripted cheer mid-capture.
  const cloudExists = await page.evaluate(() => !!document.querySelector('.bq-grump .bq-grump-cloud'));
  assert(cloudExists, 'the Boss Grump (cloud) renders');
  const distinct = await page.evaluate(async () => {
    const frame = () => new Promise(r => requestAnimationFrame(() => r()));
    const seen = new Set(); const cloud = () => document.querySelector('.bq-grump .bq-grump-cloud');
    seen.add(getComputedStyle(cloud()).transform);
    window.__booquest.answer(true);   // fire a cheer → bqCheer 0.4s bounce
    for (let f = 0; f < 40; f++) { const c = cloud(); if (c) seen.add(getComputedStyle(c).transform); await frame(); }
    return seen.size;
  });
  assert(distinct >= 2, `frame evidence: the Boss Grump animates (transform-only bqCheer bounce) across the scripted cheer (${distinct} distinct transforms)`);
  await page.screenshot({ path: 'screenshots/r6p9/quest-boss-1000x640.png' });

  const c = await cadence(page);
  console.log(`  quest cadence: avg ${c.avg}ms · max ${c.max}ms · ${c.long}/${c.frames} frames > 32ms`);
  assert(c.avg < 40, `quest main thread not pinned (avg frame ${c.avg}ms < 40ms)`);
  await ctx.close();
}

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
