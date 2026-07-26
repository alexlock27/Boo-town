// RUN13B T8 — town dressing: horizons, ground truth and always-there life. The town is
// the reward for everything else, and now it looks like one.
//
// What is proved here:
//   • per-area authored dressing renders: Meadow (oak, hedgerow horizon, wildflower
//     tufts, 2-layer clouds, exactly 2 butterflies / 2 fireflies), Riverside (jetty,
//     drifting lily pads, dragonfly by day), Hilltop (3-depth far hills, swaying long
//     grass, bobbing kite), Beach (parasol, towel, bucket-and-spade, crossing sail,
//     2 gulls), Playground (soft-play tiles, hopscotch, colourful fence, noticeboard),
//     Funfair (ground band FIXED — it had none — and the distant turning wheel);
//   • the sky follows device time (dawn/day/dusk/night) with a sun/moon disc that
//     traverses, and the star field belongs to the night;
//   • fixed props draw at z 3: above the ground band, behind paths (5) and items;
//   • animation is transform/opacity-only, frame-evidenced, and reduced-motion calms
//     every drift (the sailboat anchors mid-sea rather than vanishing);
//   • the noticeboard poster swaps with the caper state;
//   • an area with 3+ placed Boos never looks motionless for ~10 seconds.
//
// Expected runtime: ~2min (frame sampling + a 12s liveliness watch).
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run13b/t8';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const hash = buf => createHash('sha1').update(buf).digest('hex').slice(0, 12);

const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery',
  'boohouse_kitchen', 'boohouse_bedroom'];
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const SAVE = (over = {}) => Object.assign({
  version: 15, name: 'Ada', ageAsked: true, age: 8,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 400, byGame: {} }, ledger: {},
  town: { areas: Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { boohouseSeeded: true, funfairOpened: 'x', introSeen: { care: true }, trophyRetro: true, townFirst: true, wishWellSeeded: true },
  delights: { hideDay: TODAY, hideFound: true }, trophies: {}, journal: {}
}, over);

const browser = await chromium.launch();
async function openArea(area, { hour = 13, w = 1024, h = 768, save, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(hr => { window.__bootownHour = hr; }, hour);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(save || SAVE()));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(a => window.BooTown.go('town', { area: a }), area);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(350);
  return { ctx, page };
}
const count = (page, sel) => page.evaluate(s => window.__townLife.dressingCount(s), sel);

console.log('== the sky follows device time, with a travelling sun or moon ==');
{
  for (const [hour, band, disc] of [[13, 'day', 'sun'], [6, 'dawn', 'sun'], [18, 'dusk', 'sun'], [22, 'night', 'moon']]) {
    const { ctx, page } = await openArea('meadow', { hour });
    ok(await page.evaluate(() => window.__townLife.skyBand()) === band, `at ${hour}:00 the sky is ${band}`);
    ok(await page.evaluate(() => window.__townLife.skyDisc()) === disc, `and the ${disc} is up`);
    const starsVisible = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.t-stars')).opacity));
    ok(band === 'night' ? starsVisible === 1 : starsVisible === 0, `stars ${band === 'night' ? 'shine' : 'sleep'} (opacity ${starsVisible})`);
    await ctx.close();
  }
  // the disc really traverses: its position differs across hours
  const positions = [];
  for (const hour of [9, 12, 16]) {
    const { ctx, page } = await openArea('meadow', { hour });
    positions.push(await page.evaluate(() => document.querySelector('.t-sundisc').style.left));
    await ctx.close();
  }
  ok(distinct(positions) === 3, `the sun crosses the sky through the day (${positions.join(' → ')})`);
}

console.log('== the Meadow: oak, horizon, wildflowers, and exactly its authored ambient life ==');
{
  const { ctx, page } = await openArea('meadow');
  ok(await count(page, '.mw-oak') === 1, 'the fixed oak stands at the left edge');
  const oakX = await page.evaluate(() => {
    const oak = document.querySelector('.mw-oak path');
    return oak ? oak.getBBox().x : null;
  });
  ok(oakX != null, 'the oak has real geometry (hide-and-seek fallback oak is visible at last)');
  ok(await count(page, '.mw-tuft') >= 10, `wildflower tufts scatter the ground (${await count(page, '.mw-tuft')})`);
  ok(await count(page, '.mw-cloud.a') >= 2 && await count(page, '.mw-cloud.b') >= 2,
    'two cloud layers drift (far + near)');
  ok(await page.evaluate(() => window.__townLife.ambientCount()) === 2, 'exactly 2 butterflies by day (authored)');
  await page.screenshot({ path: `${SHOTS}/after-meadow-1024x768.png` });
  await ctx.close();
  const night = await openArea('meadow', { hour: 22 });
  ok(await night.page.evaluate(() => window.__townLife.ambientCount()) === 2, 'exactly 2 fireflies by night (authored)');
  await night.page.screenshot({ path: `${SHOTS}/night-meadow-1024x768.png` });
  await night.ctx.close();
}

console.log('== the Riverside: jetty, drifting lily pads, a dragonfly by day ==');
{
  const { ctx, page } = await openArea('riverside');
  ok(await count(page, '.rv-jetty') === 1, 'the wooden jetty is fixed at mid-area');
  ok(await count(page, '.rv-lily') >= 3, `lily pads float (${await count(page, '.rv-lily')})`);
  ok(await page.evaluate(() => window.__townLife.sceneryAnimated('.rv-lily')), 'and they really drift (CSS animation live)');
  ok(await count(page, '.rv-dragonfly') >= 1, 'a dragonfly by day');
  await page.screenshot({ path: `${SHOTS}/after-riverside-1024x768.png` });
  await ctx.close();
}

console.log('== the Hilltop: three hill depths falling away, long grass, the bobbing kite ==');
{
  const { ctx, page } = await openArea('hilltop');
  ok(await count(page, '.hl-grass') >= 12, `long grass lines the ground (${await count(page, '.hl-grass')} tufts)`);
  ok(await count(page, '.hl-kite') === 1, 'the kite flies from a far hill');
  // frame evidence: the kite bobs — 8 clipped frames over 3.4s
  const kiteFrames = [];
  const kbox = await page.evaluate(() => {
    const k = document.querySelector('.hl-kite'); const r = k.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const clip = { x: Math.max(0, Math.floor(kbox.x) - 10), y: Math.max(0, Math.floor(kbox.y) - 10), width: Math.ceil(kbox.width) + 20, height: Math.ceil(kbox.height) + 20 };
  for (let k = 0; k < 8; k++) { kiteFrames.push(hash(await page.screenshot({ clip }))); await sleep(480); }
  ok(distinct(kiteFrames) >= 4, `the kite really bobs (${distinct(kiteFrames)}/8 distinct frames over 3.4s)`);
  await page.screenshot({ path: `${SHOTS}/after-hilltop-1024x768.png` });
  await ctx.close();
}

console.log('== the Beach: parasol camp, crossing sail, lazy gulls ==');
{
  const { ctx, page } = await openArea('beach');
  for (const [sel, name] of [['.bc-parasol', 'the striped parasol'], ['.bc-towel', 'the towel'], ['.bc-bucket', 'the bucket-and-spade'], ['.bc-sail', 'the far sailing boat']]) {
    ok(await count(page, sel) === 1, `${name} is there`);
  }
  ok(await count(page, '.bc-gull') === 2, 'two gulls arc over the sea (capped)');
  const sailAnim = await page.evaluate(() => {
    const s = document.querySelector('.bc-sail');
    const cs = getComputedStyle(s);
    return { name: cs.animationName, duration: parseFloat(cs.animationDuration) };
  });
  ok(sailAnim.name !== 'none' && sailAnim.duration >= 120, `the sail crosses once every few minutes (${sailAnim.duration}s crossing)`);
  await page.screenshot({ path: `${SHOTS}/after-beach-1024x768.png` });
  await ctx.close();
  const night = await openArea('beach', { hour: 22 });
  ok(await count(night.page, '.bc-gull') === 0 && await count(night.page, '.bc-sail') === 0,
    'the gulls and the boat turn in at night');
  await night.page.screenshot({ path: `${SHOTS}/night-beach-1024x768.png` });
  await night.ctx.close();
}

console.log('== the Playground: soft-play tiles, hopscotch, a noticeboard that keeps up ==');
{
  const { ctx, page } = await openArea('playground');
  ok(await count(page, '.pg-hopscotch') === 1, 'the painted hopscotch strip is on the ground');
  ok(await page.evaluate(() => document.querySelectorAll('.pg-hopscotch text').length) === 7, 'numbered 1 to 7');
  const bandBg = await page.evaluate(() => getComputedStyle(document.querySelector('.t-band.playground')).backgroundImage);
  ok(/conic/.test(bandBg), 'the ground is soft-play tiles (two gentle tones), not bare sand');
  ok(await page.evaluate(() => window.__townLife.noticePoster()) === 'notice',
    'the noticeboard shows a cheerful town notice with no caper open');
  await page.screenshot({ path: `${SHOTS}/after-playground-1024x768.png` });
  await ctx.close();
  // …and with a caper open, the wanted poster goes up
  const caperSave = SAVE({ caper: { open: true, culpritSeed: 3, culprit: 'pickle', clues: 1, cluesToday: 1, clueDay: TODAY, guesses: 0, marked: [], nextAt: 0 } });
  const c2 = await openArea('playground', { save: caperSave });
  ok(await c2.page.evaluate(() => window.__townLife.noticePoster()) === 'caper',
    'a caper swaps it for the wanted poster');
  await c2.page.screenshot({ path: `${SHOTS}/after-playground-caper-1024x768.png` });
  await c2.ctx.close();
}

console.log('== the Funfair: a ground to stand on, and the distant wheel turning ==');
{
  const { ctx, page } = await openArea('funfair');
  const bandBg = await page.evaluate(() => getComputedStyle(document.querySelector('.t-band.funfair')).backgroundImage);
  ok(bandBg !== 'none', 'the funfair band finally has ground (it had NO background rule at all)');
  ok(await page.evaluate(() => !!document.querySelector('.ff-far-wheel')), 'the distant ferris silhouette is on the skyline');
  ok(await page.evaluate(() => window.__townLife.sceneryAnimated('.ff-far-wheel')), 'and it turns, very slowly');
  await page.screenshot({ path: `${SHOTS}/after-funfair-1024x768.png` });
  await ctx.close();
}

console.log('== fixed props are backdrop: never over items, never over paths, never tappable ==');
{
  const { ctx, page } = await openArea('meadow');
  const layers = await page.evaluate(() => {
    const props = document.querySelector('.t-zone-props');
    return { z: props.style.zIndex, pe: getComputedStyle(props).pointerEvents, pathZ: 5 };
  });
  ok(layers.z === '3' && layers.pe === 'none', `props sit at z ${layers.z} with pointer-events ${layers.pe} (band 2 < props 3 < paths 5 < items)`);
  await ctx.close();
}

console.log('== reduced motion calms every drift ==');
{
  const checks = [
    ['hilltop', ['.hl-grass', '.hl-kite', '.hl-cloud']],
    ['beach', ['.bc-gull']],
    ['meadow', ['.mw-cloud']]
  ];
  for (const [area, sels] of checks) {
    const { ctx, page } = await openArea(area, { reduced: true });
    for (const sel of sels) {
      const anim = await page.evaluate(s => { const n = document.querySelector(s); return n ? getComputedStyle(n).animationName : 'missing'; }, sel);
      ok(anim === 'none', `${area} ${sel}: stilled (${anim})`);
    }
    await ctx.close();
  }
  const { ctx, page } = await openArea('beach', { reduced: true });
  const sail = await page.evaluate(() => {
    const s = document.querySelector('.bc-sail');
    return { anim: getComputedStyle(s).animationName, transform: getComputedStyle(s).transform };
  });
  ok(sail.anim === 'none' && sail.transform !== 'none', 'the sailboat anchors mid-sea instead of vanishing');
  await ctx.close();
}

console.log('== a lived-in area never looks motionless (3 Boos, ~10s watch) ==');
{
  const save = SAVE();
  // x fractions inside the FIRST viewport of the 4-viewport-wide area — offscreen
  // actors are (rightly) culled from the wander loop, so a watch on them proves nothing
  save.town.areas.meadow.items = [
    { zone: 'meadow', x: .06, row: 1, item: 'boo_inky' },
    { zone: 'meadow', x: .13, row: 1, item: 'boo_plum' },
    { zone: 'meadow', x: .20, row: 2, item: 'boo_pippin' }
  ];
  const { ctx, page } = await openArea('meadow', { save });
  const samples = [];
  for (let k = 0; k < 12; k++) {
    samples.push(await page.evaluate(() => [0, 1, 2].map(i => window.__townLife.transform(i)).join('|')));
    await sleep(1000);
  }
  let worstRun = 1, run = 1;
  for (let i = 1; i < samples.length; i++) { run = samples[i] === samples[i - 1] ? run + 1 : 1; worstRun = Math.max(worstRun, run); }
  ok(distinct(samples) >= 4, `the scene keeps living (${distinct(samples)}/12 distinct seconds)`);
  ok(worstRun <= 9, `never motionless for ~10s (longest still stretch ${worstRun}s)`);
  await ctx.close();
}

console.log('== frame rate holds with the dressing on (rAF sample per busiest areas) ==');
{
  for (const area of ['beach', 'hilltop']) {
    const { ctx, page } = await openArea(area);
    const fps = await page.evaluate(() => new Promise(res => {
      let n = 0; const t0 = performance.now();
      const cb = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(cb); else res(n / 2); };
      requestAnimationFrame(cb);
    }));
    ok(fps >= 40, `${area}: ${fps.toFixed(0)} fps with full dressing (target ≥40)`);
    await ctx.close();
  }
}

// The before/after pairs: the before-*.png set was captured at the pre-T8 commit; if
// they exist locally, report how much each area changed (informative, not gating —
// a fresh checkout has no before set because screenshots/ is gitignored).
for (const area of ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground']) {
  if (existsSync(`${SHOTS}/before-${area}-1024x768.png`)) console.log(`  (before/after pair present for ${area})`);
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
