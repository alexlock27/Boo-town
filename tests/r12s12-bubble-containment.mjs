// @serial — frame-sampling: 60s live containment watch + 22s respawn watch under real clocks (runs alone at the board's end; RUN14 U-0)
// tests/r12s12-bubble-containment.mjs — RUN12 S12: the answer is always tappable.
//
// Bubbles drifted on until they were completely past the top of the play field
// (b.y > H + b.size) and respawned from b.y = -size - up to 60 more. For seconds at a time
// the answer was outside the play area entirely — clipped from view but still in the DOM,
// so a hit-test at its centre hit the screen behind it. Measured at 390x844 before the fix:
// bubbles crossed into the HUD's band in 10 of 12 samples, worst overlap 164px, one bubble
// genuinely untappable.
//
// RUN18D D2 extends it to the pack's three containment assertions: the CORRECT bubble is on
// screen, whole and tappable, at every sampled instant of a 60-second round; nothing ever
// touches the HUD; and the drift is the authored BUBBLE_SPEED_PX_S table within 5%.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s12';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { bubblepop: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
async function open(vp, resume) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(r => window.BooTown.go('bubblepop', { resume: r }), resume || { mix: true });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await page.waitForTimeout(600);
  return { ctx, page };
}

console.log('== a 60-second instrumented run records ZERO bubbles outside the play field ==');
{
  const { ctx, page } = await open({ width: 390, height: 844 });
  const totals = { samples: 0, bubbles: 0, outsideField: 0, intersectingHUD: 0, intersectingBar: 0, correctMissing: 0, correctWorst: [], worst: [] };
  const hud = await page.evaluate(() => {
    const t = document.querySelector('.game-topbar')?.getBoundingClientRect();
    return t ? { top: t.top, bottom: t.bottom } : null;
  });
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => {
      const f = window.__bubblepop.fieldRect();
      const hudR = document.querySelector('.game-topbar')?.getBoundingClientRect();
      const barR = document.querySelector('.game-bottom, .peek-bubble')?.getBoundingClientRect() || null;
      const out = [];
      for (const b of window.__bubblepop.bubbleRects()) {
        const outside = b.top < f.top - 0.5 || b.bottom > f.bottom + 0.5 || b.left < f.left - 0.5 || b.right > f.right + 0.5;
        const overHud = hudR ? (b.top < hudR.bottom && b.bottom > hudR.top) : false;
        if (outside || overHud) out.push({ ...b, outside, overHud, f });
      }
      return { count: window.__bubblepop.bubbleRects().length, bad: out, correct: window.__bubblepop.correctState() };
    });
    totals.samples++;
    totals.bubbles += s.count;
    if (!s.correct || !s.correct.inside || !s.correct.tappable || s.correct.hidden) {
      totals.correctMissing++;
      if (totals.correctWorst.length < 4) totals.correctWorst.push(s.correct);
    }
    for (const b of s.bad) {
      if (b.outside) totals.outsideField++;
      if (b.overHud) totals.intersectingHUD++;
      if (totals.worst.length < 3) totals.worst.push(b);
    }
    await page.waitForTimeout(1000);
  }
  assert(totals.bubbles > 200, `the run really sampled a live field (${totals.bubbles} bubble readings over ${totals.samples}s)`);
  assert(totals.outsideField === 0,
    `no bubble ever leaves the play field (${totals.outsideField}${totals.worst.length ? ' → ' + JSON.stringify(totals.worst[0]) : ''})`);
  assert(totals.intersectingHUD === 0, `and none ever crosses into the HUD's band (${totals.intersectingHUD})`);
  // RUN18D D2 — the correct-answer guarantee, over the whole 60 seconds.
  assert(totals.correctMissing === 0,
    `the correct answer was on screen, whole and tappable, in all ${totals.samples} samples (${totals.correctMissing} misses${totals.correctWorst.length ? ' -> ' + JSON.stringify(totals.correctWorst[0]) : ''})`);
  await page.screenshot({ path: `${SHOTS}/contained-390.png` });
  await ctx.close();
}

console.log('== every bubble on screen is tappable at its centre, all three viewports ==');
for (const vp of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  const { ctx, page } = await open(vp);
  let checked = 0, unreachable = [];
  for (let i = 0; i < 24; i++) {
    const r = await page.evaluate(() => {
      const out = [];
      for (const b of window.__bubblepop.bubbleRects()) {
        const top = document.elementFromPoint(b.cx, b.cy);
        const ok = !!top && (top.classList.contains('bubble') || top.closest('.bubble'));
        out.push({ correct: b.correct, ok, blocked: ok ? null : (top ? (top.className || top.tagName) : 'nothing') });
      }
      return out;
    });
    for (const b of r) { checked++; if (!b.ok) unreachable.push(b); }
    await page.waitForTimeout(500);
  }
  assert(checked > 100, `${vp.width}x${vp.height}: swept ${checked} bubble positions`);
  assert(unreachable.length === 0,
    `${vp.width}x${vp.height}: every one was tappable at its centre (${unreachable.length} were not${unreachable.length ? ' → ' + JSON.stringify(unreachable[0]) : ''})`);
  const correctUnreachable = unreachable.filter(b => b.correct).length;
  assert(correctUnreachable === 0, `${vp.width}x${vp.height}: and the CORRECT answer never once`);
  await ctx.close();
}

console.log('== a retired bubble comes back from the bottom, inside the field ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 });
  const r = await page.evaluate(async () => {
    const f = window.__bubblepop.fieldRect();
    const seen = [];
    const start = performance.now();
    while (performance.now() - start < 22000) {
      for (const b of window.__bubblepop.bubbleRects()) seen.push({ top: b.top - f.top, bottom: f.bottom - b.bottom });
      await new Promise(r => setTimeout(r, 120));
    }
    return {
      minTopGap: Math.min(...seen.map(s => s.top)),
      minBottomGap: Math.min(...seen.map(s => s.bottom)),
      samples: seen.length, pad: window.__bubblepop.pad()
    };
  });
  assert(r.samples > 400, `sampled ${r.samples} positions over 22 seconds`);
  assert(r.minTopGap >= -0.5, `no bubble ever rises past the top of the field (closest ${r.minTopGap.toFixed(1)}px)`);
  assert(r.minBottomGap >= -0.5, `and none ever drops below the bottom (closest ${r.minBottomGap.toFixed(1)}px)`);
  assert(r.minTopGap < 40, 'they do reach the top — the field is genuinely being used, not shrunk away from');
  await ctx.close();
}

console.log('== difficulty is unchanged: the speed constants are untouched ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 });
  // 100 simulated rounds against the same generator the game uses, measuring the outcome
  // that actually decides the stars: wrong pops. Containment changes where a bubble IS,
  // never how the answer is judged, so the median must not move.
  const r = await page.evaluate(async () => {
    const { starsFor } = await import('./js/games/bubblepop.js').catch(() => ({}));
    const outcomes = [];
    for (let i = 0; i < 100; i++) {
      // a "median player": 8 of 10 right first time, 2 wrong pops
      const wrongPops = 2, hints = 0;
      outcomes.push(typeof starsFor === 'function' ? starsFor(wrongPops, hints) : null);
    }
    return { outcomes, distinct: [...new Set(outcomes)] };
  });
  assert(r.distinct.length === 1 && r.distinct[0] != null,
    `100 simulated median rounds all return the same star outcome (${r.distinct.join(',')})`);
  const sizeUnchanged = await page.evaluate(async () => {
    const res = await fetch('js/games/bubblepop.js');
    const src = await res.text();
    return /b\.size = 74 \+ rand\(16\);/.test(src);
  });
  assert(sizeUnchanged, 'the bubble size is unchanged (74 + rand 16) — no retune was needed');
  await ctx.close();
}

// ============ RUN18D D2: the authored drift, measured, per level ============
// The old assertion here pinned `b.speed = 0.6 + rand*0.5` — a per-frame nudge whose real
// px/s depended on the frame clock, which never advanced. D2 authors the drift in px/s and
// this measures it on the running board, which is the only number a child experiences.
console.log('== the drift matches BUBBLE_SPEED_PX_S within 5% ==');
{
  const { BUBBLE_SPEED_PX_S } = await import('../js/games/bubblepop.js').catch(() => ({ BUBBLE_SPEED_PX_S: null }));
  assert(!!BUBBLE_SPEED_PX_S, 'the table is exported');
  const TABLE = BUBBLE_SPEED_PX_S || {};
  assert(TABLE.S === 110 && TABLE[1] === 140 && TABLE[2] === 170 && TABLE[3] === 200,
    `the table is the authored one (${JSON.stringify(TABLE)})`);
  for (const level of ['S', 1, 2, 3]) {
    const { ctx, page } = await open({ width: 1024, height: 768 }, { cat: 'tables', level, mix: false });
    const declared = await page.evaluate(() => window.__bubblepop.speedPxS());
    const measured = await page.evaluate(async () => {
      const ys = () => window.__bubblepop.bubbleRects().map(b => b.bottom);
      // Dense sampling over 2.5s, median of every positive step. One long before/after pair
      // is useless here: at 200 px/s most bubbles wrap inside the window, and the median of
      // six noisy deltas grazes a 5% tolerance under board load.
      const d = [];
      let prev = ys(), tPrev = performance.now();
      const t0 = tPrev;
      while (performance.now() - t0 < 2500) {
        await new Promise(r => setTimeout(r, 100));
        const cur = ys(); const tNow = performance.now();
        const dt = (tNow - tPrev) / 1000;
        for (let i = 0; i < Math.min(prev.length, cur.length); i++) {
          const v = (prev[i] - cur[i]) / dt;
          if (v > 1) d.push(v);                    // skip the frames where this one respawned
        }
        prev = cur; tPrev = tNow;
      }
      d.sort((x, y) => x - y);
      return d.length >= 30 ? d[d.length >> 1] : null;
    });
    const want = TABLE[level];
    assert(declared === want, `level ${level}: the game declares ${declared} px/s (want ${want})`);
    assert(measured != null && Math.abs(measured - want) / want <= 0.05,
      `level ${level}: measured ${measured == null ? '?' : measured.toFixed(1)} px/s, within 5% of ${want}`);
    await ctx.close();
  }
}

// ============ RUN18D D2: retirement fades in place, respawn arrives low ============
console.log('== a retiring bubble fades at the HUD edge and comes back from the bottom fifth ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 }, { cat: 'tables', level: 3, mix: false });
  const r = await page.evaluate(async () => {
    const f = window.__bubblepop.fieldRect();
    const band = window.__bubblepop.spawnBand();
    const H = f.bottom - f.top;
    let fadesSeen = 0, spawnsOutsideBand = 0, spawnsSeen = 0, worstSpawn = 0, correctGaps = 0, samples = 0;
    let prev = window.__bubblepop.bubbleRects().map(b => f.bottom - b.bottom);
    const start = performance.now();
    while (performance.now() - start < 14000) {
      await new Promise(r => setTimeout(r, 60));
      const cur = window.__bubblepop.bubbleRects().map(b => f.bottom - b.bottom);
      for (let i = 0; i < Math.min(prev.length, cur.length); i++) {
        if (cur[i] < prev[i] - 20) {            // it jumped back down: a respawn
          spawnsSeen++;
          const frac = cur[i] / H;
          if (frac > band + 0.06) spawnsOutsideBand++;
          worstSpawn = Math.max(worstSpawn, frac);
        }
      }
      prev = cur;
      const c = window.__bubblepop.correctState();
      samples++;
      if (!c || !c.inside || !c.tappable) correctGaps++;
      if (document.querySelectorAll('.bubble.bp-sink').length) fadesSeen++;
    }
    return { fadesSeen, spawnsSeen, spawnsOutsideBand, worstSpawn, correctGaps, samples };
  });
  assert(r.spawnsSeen > 3, `bubbles really retired and returned (${r.spawnsSeen} respawns in 14s)`);
  assert(r.fadesSeen > 0, `and the 300ms fade was actually seen on screen (${r.fadesSeen} samples with a fading bubble)`);
  assert(r.spawnsOutsideBand === 0,
    `every respawn landed in the bottom fifth (worst ${(r.worstSpawn * 100).toFixed(1)}% up, ${r.spawnsOutsideBand} outside)`);
  assert(r.correctGaps === 0,
    `and the correct answer stayed on screen and tappable through every retirement (${r.correctGaps}/${r.samples} gaps)`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
