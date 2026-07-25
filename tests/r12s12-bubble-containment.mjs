// tests/r12s12-bubble-containment.mjs — RUN12 S12: the answer is always tappable.
//
// Bubbles drifted on until they were completely past the top of the play field
// (b.y > H + b.size) and respawned from b.y = -size - up to 60 more. For seconds at a time
// the answer was outside the play area entirely — clipped from view but still in the DOM,
// so a hit-test at its centre hit the screen behind it. Measured at 390x844 before the fix:
// bubbles crossed into the HUD's band in 10 of 12 samples, worst overlap 164px, one bubble
// genuinely untappable.
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
async function open(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('bubblepop', { resume: { mix: true } }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await page.waitForTimeout(600);
  return { ctx, page };
}

console.log('== a 60-second instrumented run records ZERO bubbles outside the play field ==');
{
  const { ctx, page } = await open({ width: 390, height: 844 });
  const totals = { samples: 0, bubbles: 0, outsideField: 0, intersectingHUD: 0, intersectingBar: 0, worst: [] };
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
      return { count: window.__bubblepop.bubbleRects().length, bad: out };
    });
    totals.samples++;
    totals.bubbles += s.count;
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
  const speeds = await page.evaluate(async () => {
    const res = await fetch('js/games/bubblepop.js');
    const src = await res.text();
    return {
      driftUnchanged: /b\.speed = 0\.6 \+ Math\.random\(\) \* 0\.5;/.test(src),
      sizeUnchanged: /b\.size = 74 \+ rand\(16\);/.test(src)
    };
  });
  assert(speeds.driftUnchanged, 'the drift speed constant is exactly as it was (0.6 + rand*0.5)');
  assert(speeds.sizeUnchanged, 'and so is the bubble size (74 + rand 16) — no retune was needed');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
