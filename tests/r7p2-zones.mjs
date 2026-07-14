// tests/r7p2-zones.mjs — RUN7 phase 2: zone identity (C2).
// Updated for RUN10 P1 (Town 4.0: each area is its own mount, reached via {area:key}
// rather than scrolling a shared multi-zone world). Scenery-presence and windmill/foam
// motion-frame assertions moved to tests/r10p1-worldmap.mjs; this suite keeps the
// zone-only BEHAVIOUR-ENGINE coverage (paddle/bridgesit/skim/kite/shallow/sandcastle/
// sunbathe) and the "scenery never blocks placement" guarantee, which r10p1 doesn't cover.
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
  version: 6, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])), boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
  // x kept small (RUN10 P1: an area is 4 viewports wide) so the actor stays within the
  // performance-culling window at the default scroll position (stepActors skips offscreen actors)
  town: { areas: {
    meadow: { items: [], paths: [] },
    riverside: { items: [{ zone: 'riverside', x: 0.1, row: 1, item: BOOS[0] }], paths: [] },
    hilltop: { items: [{ zone: 'hilltop', x: 0.1, row: 1, item: BOOS[1] }], paths: [] },
    beach: { items: [{ zone: 'beach', x: 0.1, row: 1, item: BOOS[2] }], paths: [] },
    funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] }
  } },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { funfairOpened: 'x', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, areasUnlocked: ['riverside', 'hilltop', 'beach', 'funfair'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openArea(save, area, { hour = 13, reduced = 'no-preference', place = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, reducedMotion: reduced });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((h) => { window.__bootownHour = h; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(([a, p]) => window.BooTown.go('town', p ? { area: a, place: p } : { area: a }), [area, place]);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(300);
  return { ctx, page };
}

// ==================== zone-only behaviours (frame evidence) ====================
console.log('== zone-only behaviours: paddle / bridgesit / skim / kite / shallow / sandcastle / sunbathe ==');
{
  const cases = [
    ['riverside', 0, 'paddle', '.t-splash'], ['riverside', 0, 'skim', '.t-skip-stone'], ['riverside', 0, 'bridgesit', null],
    ['hilltop', 0, 'kite', '.t-kite-wrap'],
    ['beach', 0, 'shallow', '.t-splash'], ['beach', 0, 'sandcastle', '.t-sandcastle'], ['beach', 0, 'sunbathe', '.t-towel']
  ];
  for (const [area, ai, kind, sel] of cases) {
    const { ctx, page } = await openArea(SAVE(), area);
    const started = await page.evaluate(([i, k]) => window.__townLife.force(i, k), [ai, kind]);
    assert(started === kind, `${area}: a Boo starts the ${kind} behaviour`);
    const fr = [];
    for (let k = 0; k < 7; k++) { fr.push(await page.evaluate(i => window.__townLife.transform(i), ai)); await sleep(320); }
    assert(distinct(fr) >= 4, `${kind} animates the Boo (${distinct(fr)}/7 frames)`);
    if (sel) assert(await page.$(sel), `${kind} spawns its prop (${sel})`);
    if (['kite', 'sandcastle', 'skim'].includes(kind)) await page.screenshot({ path: `screenshots/r7p2/behav-${kind}-1024x700.png` });
    await ctx.close();
  }
}

// ==================== theming never blocks placement ====================
console.log('== the scenery never blocks placement ==');
{
  const { ctx, page } = await openArea(SAVE(), 'beach', { place: 'deco_tree' });
  // every zone-scenery layer is pointer-transparent, so a tap always reaches the ground
  const pe = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.t-zone-props, .t-zone-props .t-zsvg')];
    return nodes.length > 0 && nodes.every(n => getComputedStyle(n).pointerEvents === 'none');
  });
  assert(pe, 'all zone-scenery layers are pointer-events:none (cannot intercept placement)');
  // and a real place-mode tap over the beach scenery lands the item
  const before = await page.evaluate(() => window.BooTown.State.getState().town.areas.beach.items.length);
  const box = await page.$eval('.t-viewport', v => { const r = v.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.72);   // tap the sand, over the scenery band
  await sleep(300);
  const after = await page.evaluate(() => window.BooTown.State.getState().town.areas.beach.items.length);
  assert(after === before + 1, `a tap over the scenery places an item on the ground (${before} -> ${after})`);
  await ctx.close();
}

// ==================== meadow keeps the plain baseline (no C2 props) ====================
console.log('== meadow keeps the green baseline (no distinct C2 scenery props) ==');
{
  const { ctx, page } = await openArea(SAVE(), 'meadow');
  assert((await page.evaluate(() => window.__townLife.zoneProps('meadow'))).has === false, 'meadow has no C2 zone-props layer');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
