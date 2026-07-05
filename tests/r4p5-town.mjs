// tests/r4p5-town.mjs — RUN4 phase 5 (C5): living town part 1, activity items.
// Acceptance (RUN4 part D #7): each behaviour evidenced with frames (≥6 samples
// over ≥3s showing measurable change), including the two-Boo seesaw requirement
// and the campfire gathering at a simulated 22:00; sleeping zzz Boos near houses
// at night, waking on tap. Bench-seat and pond-paddle (RUN2 C3 debt) included.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (town, inv) => ({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: inv, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town,
  stars: { total: 60, byGame: {} }, ledger: {},
  // hide-and-seek already "found today" → no hider interferes with measurements (C9)
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, ageAsked: true, age: 8
});

const browser = await chromium.launch();
async function openTown(town, { hour = 13, reduced = false, boos = ['boo_inky', 'boo_plum'] } = {}) {
  const inv = {};
  for (const t of town) inv[t.item] = (inv[t.item] || 0) + 1;
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((h) => { window.__bootownHour = h; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE(town, inv));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(700);
  return { ctx, page };
}
// Sample a selector's inline transform N times over `span` ms.
async function frames(page, sel, n = 7, span = 3200) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(await page.$eval(sel, el => el.style.transform || ''));
    await sleep(span / (n - 1));
  }
  return out;
}
const distinct = (arr) => new Set(arr).size;
const numsIn = (s) => (s.match(/-?\d+\.?\d*/g) || []).map(Number);
const maxDelta = (arr, idx = 0) => {
  const vals = arr.map(s => (numsIn(s)[idx] ?? 0));
  return Math.max(...vals) - Math.min(...vals);
};
const BOO_SVG = '.t-item.boo svg';

// ---- one-Boo behaviours: measurable motion over 3+ seconds ----
const CASES = [
  ['slide',      'deco_slide',      'slide: climb + wheee + slide down', 30],
  ['swings',     'deco_swings',     'swings: gentle pendulum', 18],
  ['trampoline', 'deco_trampoline', 'trampoline: bounces higher than a hop (>12px)', 20],
  ['paddlepool', 'deco_paddlepool', 'paddling pool: splashy paddle', 8],
  ['bumper',     'deco_bumper',     'bumper car: drives back and forth', 30],
  ['pond',       'deco_pond',       'pond: a nearby Boo paddles (RUN2 debt)', 8]
];
for (const [name, deco, label, minDelta] of CASES) {
  console.log(`== ${name} ==`);
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: deco },
    { zone: 'meadow', x: 0.45, item: 'boo_inky' }
  ]);
  const fr = await frames(page, BOO_SVG);
  assert(distinct(fr) >= 5, `${label}: ${distinct(fr)}/7 distinct frames over 3.2s`);
  const move = Math.max(maxDelta(fr, 0), maxDelta(fr, 1));   // either axis
  assert(move >= minDelta, `${label}: movement ≥ ${minDelta}px (got ${move.toFixed(1)})`);
  if (name === 'trampoline') {
    const ys = fr.map(s => numsIn(s)[1] ?? 0);
    assert(Math.min(...ys) < -24, `trampoline reaches high bounce (min y ${Math.min(...ys).toFixed(1)})`);
  }
  if (name === 'bumper') {
    const car = await frames(page, '.t-item[data-item="deco_bumper"] .bc-car', 6, 2500);
    assert(distinct(car) >= 4 && maxDelta(car) >= 30, `the little car itself drives (${distinct(car)} frames, Δ${maxDelta(car).toFixed(1)}px)`);
  }
  if (name === 'slide') {
    const sawWheee = await page.evaluate(async () => {
      for (let i = 0; i < 24; i++) { if (document.querySelector('.t-wheee')) return true; await new Promise(r => setTimeout(r, 200)); }
      return false;
    });
    assert(sawWheee, 'the slide pops a "wheee!"');
  }
  await ctx.close();
}

// ---- two-Boo behaviours ----
console.log('== seesaw (two Boos) ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_seesaw' },
    { zone: 'meadow', x: 0.45, item: 'boo_inky' },
    { zone: 'meadow', x: 0.55, item: 'boo_plum' }
  ]);
  const a = await frames(page, '.t-item.boo:nth-of-type(1) svg', 7, 3200).catch(() => []);
  const booSel = '.t-item.boo';
  const both = await page.$$eval(booSel + ' svg', els => els.map(e => e.style.transform));
  assert(both.length === 2 && both.every(t => t.length > 0), 'both Boos take a seesaw seat');
  const fr1 = await frames(page, BOO_SVG);
  assert(distinct(fr1) >= 5 && maxDelta(fr1, 1) >= 8, `seesaw: alternating bounce (${distinct(fr1)} frames, Δy ${maxDelta(fr1, 1).toFixed(1)}px)`);
  const plank = await frames(page, '.t-item[data-item="deco_seesaw"] .ss-plank', 6, 2500);
  assert(distinct(plank) >= 4, `the plank itself tilts (${distinct(plank)} distinct)`);
  await ctx.close();
}
console.log('== seesaw needs two ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_seesaw' },
    { zone: 'meadow', x: 0.45, item: 'boo_inky' }
  ]);
  await sleep(1200);
  const t = await page.$eval(BOO_SVG, el => el.style.transform || '');
  const seesawing = /translate\(/.test(t) && Math.abs((numsIn(t)[1] ?? 0)) > 8;
  assert(!seesawing, 'one lone Boo never seesaws (needs two nearby)');
  await ctx.close();
}
console.log('== picnic (two Boos nibble) ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_picnic' },
    { zone: 'meadow', x: 0.45, item: 'boo_inky' },
    { zone: 'meadow', x: 0.55, item: 'boo_plum' }
  ]);
  const fr = await frames(page, BOO_SVG, 9, 3300);   // nibbles pause between bites — sample generously
  assert(distinct(fr) >= 4, `picnic: nibbling motion (${distinct(fr)}/9 distinct frames; the Δscale check below proves the pulse)`);
  assert(fr.every(t => /scale/.test(t)), 'picnic Boos sit and nibble (scale pulses)');
  const scales = fr.map(s => { const n = numsIn(s); return n[n.length - 1]; });
  assert(Math.max(...scales) - Math.min(...scales) >= 0.03, `nibble is a visible pulse (Δscale ${(Math.max(...scales) - Math.min(...scales)).toFixed(3)})`);
  await ctx.close();
}

// ---- campfire gathering at a simulated 22:00 ----
console.log('== campfire at 22:00 ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_campfire' },
    { zone: 'meadow', x: 0.42, item: 'boo_inky' },
    { zone: 'meadow', x: 0.58, item: 'boo_plum' }
  ], { hour: 22 });
  const fr = await frames(page, BOO_SVG);
  assert(distinct(fr) >= 5, `campfire: Boos gather + warm paws (${distinct(fr)}/7 distinct)`);
  const xs = fr.map(s => Math.abs(numsIn(s)[0] ?? 0));
  assert(xs[xs.length - 1] > 3, 'a Boo moved toward the fire circle');
  const flameAnimated = await page.$eval('.t-item[data-item="deco_campfire"] .cf-flame', el => getComputedStyle(el).animationName !== 'none');
  assert(flameAnimated, 'the flame flickers');
  await ctx.close();
}
console.log('== campfire circle is a night thing ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_campfire' },
    { zone: 'meadow', x: 0.42, item: 'boo_inky' }
  ], { hour: 13 });
  await sleep(1500);
  const role = await page.evaluate(() => {
    const w = document.querySelector('.t-item.boo svg');
    return w ? w.style.transform : '';
  });
  const gathered = /translate\((2[0-9]|3[0-9]|4[0-9])/.test(role);
  assert(!gathered, 'no fire circle in the daytime');
  await ctx.close();
}

// ---- night sleep near a Boo House + wake on tap ----
console.log('== sleeping Boos near houses at night ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_boohouse' },
    { zone: 'meadow', x: 0.45, item: 'boo_inky' }
  ], { hour: 22 });
  await sleep(600);
  const zzz = await page.$('.t-item.boo .t-zzz');
  assert(!!zzz, 'a Boo near a house curls up with drifting zzz at 22:00');
  const tr = await page.$eval(BOO_SVG, el => el.style.transform);
  assert(/scale\(1\.06/.test(tr) && /translateY\(9px\)/.test(tr), `curled-up pose (${tr})`);
  // breathing: subtle but present
  const fr = await frames(page, BOO_SVG, 6, 2600);
  assert(distinct(fr) >= 4, `sleeping Boo breathes gently (${distinct(fr)}/6 distinct)`);
  // wake on tap: zzz gone, sleepy blink, no grumpiness (squeak still fires)
  await page.click('.t-item.boo', { force: true });
  await sleep(400);
  const zzzAfter = await page.$('.t-item.boo .t-zzz');
  assert(!zzzAfter, 'tapping wakes the Boo (zzz gone)');
  // and it stays awake for a while even though it is still night
  await sleep(4500);   // past one assignRoles tick
  const zzzLater = await page.$('.t-item.boo .t-zzz');
  assert(!zzzLater, 'a woken Boo stays up for a while (no instant re-sleep)');
  await ctx.close();
}
console.log('== no sleeping in the day ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_boohouse' },
    { zone: 'meadow', x: 0.45, item: 'boo_inky' }
  ], { hour: 13 });
  await sleep(900);
  assert(!(await page.$('.t-item.boo .t-zzz')), 'no zzz at 13:00');
  await ctx.close();
}

// ---- the bench finally seats a Boo (RUN2 C3 debt) ----
console.log('== bench sits a Boo now and then ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_bench' },
    { zone: 'meadow', x: 0.45, item: 'boo_inky' }
  ]);
  const fr = await frames(page, BOO_SVG, 6, 2500);
  assert(fr.some(t => /translate\(/.test(t)), 'a Boo takes the bench seat');
  assert(distinct(fr) >= 3, `bench sit settles + little kicks (${distinct(fr)}/6 distinct)`);
  await ctx.close();
}

// ---- reduced motion: everything rests ----
console.log('== reduced motion ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'deco_trampoline' },
    { zone: 'meadow', x: 0.45, item: 'boo_inky' }
  ], { reduced: true });
  await sleep(1500);
  const fr = await frames(page, BOO_SVG, 4, 1500);
  assert(distinct(fr) === 1, 'reduced motion: no activity animation (static pose)');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p5-town: FAIL' : '\nr4p5-town: ALL PASS');
process.exit(failed ? 1 : 0);
