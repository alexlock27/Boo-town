// tests/r7p2-zones.mjs — RUN7 phase 2: zone identity (C2).
// Acceptance (RUN7 part D #2): frame evidence per zone of its signature elements
// animating (river drift + bridge, windmill turn + kite, wave foam + sandcastle) plus
// at least one zone-only behaviour each; theming never blocks placement; the unlock pan
// crosses visibly distinct scenery.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r7p2', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow'].map(n => 'boo_' + n);

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])), boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
  town: [{ zone: 'riverside', x: 0.45, item: BOOS[0] }, { zone: 'hilltop', x: 0.45, item: BOOS[1] }, { zone: 'beach', x: 0.45, item: BOOS[2] }],
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { funfairOpened: 'x', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['riverside', 'hilltop', 'beach', 'funfair'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openTown(save, { hour = 13, reduced = 'no-preference', place = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, reducedMotion: reduced });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((h) => { window.__bootownHour = h; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(p => window.BooTown.go('town', p ? { place: p } : {}), place);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(300);
  return { ctx, page };
}
const goto = (page, key) => page.evaluate(k => window.__townLife.scrollToZone(k), key);

// ==================== each zone has distinct scenery; meadow/funfair do not ====================
console.log('== each zone draws its own distinct scenery ==');
{
  const { ctx, page } = await openTown(SAVE());
  for (const z of ['riverside', 'hilltop', 'beach']) {
    await goto(page, z); await sleep(300);
    const p = await page.evaluate(k => window.__townLife.zoneProps(k), z);
    assert(p.has && p.kids > 10, `${z} draws distinct scenery (${p.kids} elements)`);
  }
  assert((await page.evaluate(() => window.__townLife.zoneProps('meadow'))).has === false, 'meadow keeps the green baseline (no props)');
  assert((await page.evaluate(() => window.__townLife.zoneProps('funfair'))).has === false, 'funfair keeps its own theming (no C2 props)');
  await ctx.close();
}

// ==================== signature scenery animates: river drift / windmill turn / wave foam ====================
console.log('== signature scenery animates (frame evidence) ==');
{
  const { ctx, page } = await openTown(SAVE());
  // Riverside: drifting river + a bridge
  await goto(page, 'riverside'); await sleep(300);
  assert(await page.evaluate(() => window.__townLife.sceneryAnimated('.rv-drift')), 'the river drifts (animated)');
  const riverFr = [];
  for (let k = 0; k < 7; k++) { riverFr.push(await page.evaluate(() => window.__townLife.sceneryXf('.rv-drift'))); await sleep(460); }
  assert(distinct(riverFr) >= 6, `river drift shows motion over 3s (${distinct(riverFr)}/7 frames)`);
  assert(await page.$('.rv-bridge'), 'a wooden bridge spans the river');
  assert(await page.$('.rv-reed'), 'reeds grow at the bank');
  await page.screenshot({ path: 'screenshots/r7p2/riverside-1024x700.png' });
  // Hilltop: turning windmill + faster clouds
  await goto(page, 'hilltop'); await sleep(300);
  assert(await page.evaluate(() => window.__townLife.sceneryAnimated('.hl-blades')), 'the windmill sails turn (animated)');
  const millFr = [];
  for (let k = 0; k < 7; k++) { millFr.push(await page.evaluate(() => window.__townLife.sceneryXf('.hl-blades'))); await sleep(430); }
  assert(distinct(millFr) >= 6, `windmill turn shows motion over 3s (${distinct(millFr)}/7 frames)`);
  assert(await page.$('.hl-cloud'), 'closer clouds drift across the hilltop sky');
  await page.screenshot({ path: 'screenshots/r7p2/hilltop-1024x700.png' });
  // Beach: rolling foam + palm + hut
  await goto(page, 'beach'); await sleep(300);
  assert(await page.evaluate(() => window.__townLife.sceneryAnimated('.bc-foam')), 'the sea foam rolls (animated)');
  const foamFr = [];
  for (let k = 0; k < 7; k++) { foamFr.push(await page.evaluate(() => window.__townLife.sceneryXf('.bc-foam'))); await sleep(430); }
  assert(distinct(foamFr) >= 5, `wave foam shows motion over 3s (${distinct(foamFr)}/7 frames)`);
  assert(await page.$('.bc-palm') && await page.$eval('.t-zone-props.beach', n => n.innerHTML.includes('rect')), 'a palm tree and a beach hut sit on the beach');
  await page.screenshot({ path: 'screenshots/r7p2/beach-1024x700.png' });
  await ctx.close();
}

// ==================== at least one zone-only behaviour each (frame evidence) ====================
console.log('== zone-only behaviours: paddle / bridgesit / skim / kite / shallow / sandcastle / sunbathe ==');
{
  const { ctx, page } = await openTown(SAVE());
  const cases = [
    ['riverside', 0, 'paddle', '.t-splash'], ['riverside', 0, 'skim', '.t-skip-stone'], ['riverside', 0, 'bridgesit', null],
    ['hilltop', 1, 'kite', '.t-kite-wrap'],
    ['beach', 2, 'shallow', '.t-splash'], ['beach', 2, 'sandcastle', '.t-sandcastle'], ['beach', 2, 'sunbathe', '.t-towel']
  ];
  for (const [zone, ai, kind, sel] of cases) {
    await goto(page, zone); await sleep(250);
    const started = await page.evaluate(([i, k]) => window.__townLife.force(i, k), [ai, kind]);
    assert(started === kind, `${zone}: a Boo starts the ${kind} behaviour`);
    const fr = [];
    for (let k = 0; k < 7; k++) { fr.push(await page.evaluate(i => window.__townLife.transform(i), ai)); await sleep(320); }
    assert(distinct(fr) >= 4, `${kind} animates the Boo (${distinct(fr)}/7 frames)`);
    if (sel) assert(await page.$(sel), `${kind} spawns its prop (${sel})`);
    if (['kite', 'sandcastle', 'skim'].includes(kind)) await page.screenshot({ path: `screenshots/r7p2/behav-${kind}-1024x700.png` });
  }
  await ctx.close();
}

// ==================== theming never blocks placement ====================
console.log('== the scenery never blocks placement ==');
{
  const { ctx, page } = await openTown(SAVE(), { place: 'deco_tree' });
  // every zone-scenery layer is pointer-transparent, so a tap always reaches the ground
  const pe = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.t-zone-props, .t-zone-props .t-zsvg')];
    return nodes.length > 0 && nodes.every(n => getComputedStyle(n).pointerEvents === 'none');
  });
  assert(pe, 'all zone-scenery layers are pointer-events:none (cannot intercept placement)');
  // and a real place-mode tap over the beach scenery lands the item
  await goto(page, 'beach'); await sleep(300);
  const before = await page.evaluate(() => window.BooTown.State.getState().town.length);
  const box = await page.$eval('.t-viewport', v => { const r = v.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.72);   // tap the sand, over the scenery band
  await sleep(300);
  const after = await page.evaluate(() => window.BooTown.State.getState().town.length);
  assert(after === before + 1, `a tap over the scenery places an item on the ground (${before} -> ${after})`);
  await ctx.close();
}

// ==================== the unlock pan crosses the new zone's scenery ====================
console.log('== the unlock pan crosses the distinct scenery ==');
{
  const { ctx, page } = await openTown(SAVE());
  await page.evaluate(() => window.__townLife.panAcross('beach'));
  const xs = [];
  for (let k = 0; k < 8; k++) { xs.push(await page.evaluate(() => window.__townLife.scrollX ? window.__townLife.scrollX() : (window.__town.scrollX()))); await sleep(300); }
  assert(distinct(xs) >= 5, `the pan sweeps across the zone (${distinct(xs)}/8 distinct scroll positions)`);
  assert(xs[xs.length - 1] > xs[0], 'the pan travels left → right across the new place');
  await ctx.close();
}

// ==================== reduced motion stills the scenery ====================
console.log('== reduced motion stills the scenery ==');
{
  const { ctx, page } = await openTown(SAVE(), { reduced: 'reduce' });
  await goto(page, 'hilltop'); await sleep(300);
  assert(await page.evaluate(() => window.__townLife.sceneryAnimated('.hl-blades')) === false, 'reduced-motion: the windmill does not spin');
  await goto(page, 'riverside'); await sleep(200);
  assert(await page.evaluate(() => window.__townLife.sceneryAnimated('.rv-drift')) === false, 'reduced-motion: the river does not drift');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
