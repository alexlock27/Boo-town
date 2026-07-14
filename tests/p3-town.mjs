// tests/p3-town.mjs — Town 2.0 (RUN2 C3) + part E check 6.
// Updated for RUN10 P1 (Town 4.0): each area is its own mount reached via {area:key};
// star-gate lock display + the unlock-open ceremony moved to the world map screen
// (see tests/r10p1-worldmap.mjs) — those two sub-tests were removed from here and
// their coverage lives there now. Everything else (migration, world width, night
// tint, reduced motion, dance stage, ceremony placement, persistence) still applies
// per-area and is retargeted below.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const browser = await chromium.launch();
function watch(p) { p.on('pageerror', e => errors.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); }); }
const BASESAVE = (o) => ({ version: 6, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_lolly: 1, boo_bubbles: 1, deco_stage: 1, deco_tree: 1 },
  boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {},
  town: { areas: { meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } } },
  stars: { total: 55, byGame: {} }, settings: { sound: false, music: false, voice: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true },   // RUN4 C4: retro trophy ceremony already seen
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true },   // RUN4 C9
  ...o });

async function open(seed, area, { hour = 13, reduced = false, place = null, from = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); watch(page);
  await page.addInitScript((h) => { window.__bootownHour = h; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), seed);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  const params = Object.assign({ area }, place ? { place, from } : {});
  await page.evaluate((p) => window.BooTown.go('town', p), params);
  await page.waitForSelector('.t-viewport');
  await page.waitForTimeout(600);
  return { ctx, page };
}

// 1) Old {plot} town migrates to Meadow (now via save.town.areas.meadow.items).
console.log('== old grid town migrates to Meadow ==');
{
  const old = { version: 1, name: 'Maya', guide: { body: 'sunshine', patch: 'indigo', acc: 'bow', name: 'Twiggy' },
    inventory: { boo_inky: 1, boo_beam: 1, deco_tree: 1 },
    town: [{ plot: 8, item: 'boo_inky' }, { plot: 2, item: 'deco_tree' }, { plot: 20, item: 'boo_beam' }] };
  const { ctx, page } = await open(old, 'meadow');
  const items = await page.evaluate(() => window.BooTown.State.getState().town.areas.meadow.items);
  assert(items.every(t => t.zone === 'meadow' && typeof t.x === 'number'), 'all migrated to Meadow with x (' + JSON.stringify(items) + ')');
  assert(items.length === 3, 'all 3 placements kept');
  assert(await page.$$eval('.t-item', e => e.length) === 3, 'migrated items render');
  await ctx.close();
}

// 2) An area's world is AREA_W_VIEWPORTS (4) viewports wide (RUN10 P1).
console.log('== an area is 4 viewports wide (RUN10 P1) ==');
{
  const { ctx, page } = await open(BASESAVE({}), 'meadow');
  const dims = await page.evaluate(() => { const vp = document.querySelector('.t-viewport'); const g = document.querySelector('.t-ground'); return { viewW: vp.clientWidth, worldW: parseFloat(g.style.width) }; });
  assert(Math.abs(dims.worldW / dims.viewW - 4) < 0.02, `the area is 4 viewports wide (${(dims.worldW / dims.viewW).toFixed(2)})`);
  // drag-scroll to the right
  const vp = await page.$('.t-viewport'); const box = await vp.boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.4, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const scrolled = await page.evaluate(() => Math.abs(parseFloat((document.querySelector('.t-ground').style.transform.match(/-?\d+\.?\d*/) || [0])[0])));
  assert(scrolled > 50, 'dragging scrolls the world (' + scrolled.toFixed(0) + 'px)');
  await ctx.close();
}
// (Star-gate lock display + the map's unlock-open ceremony now live on the world
// map screen — see tests/r10p1-worldmap.mjs for lock-state and unlock-ceremony coverage.)

// 5) Placements persist per-area, and other areas are untouched (RUN10 P1: separate mounts).
console.log('== placements persist per-area ==');
{
  const seed = BASESAVE({ town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.3, row: 1, item: 'boo_inky' }], paths: [] }, riverside: { items: [{ zone: 'riverside', x: 0.5, row: 1, item: 'boo_lolly' }], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } } } });
  const { ctx, page } = await open(seed, 'meadow');
  const meadowZones = await page.$$eval('.t-item', els => els.map(e => e.dataset.zone).sort());
  assert(JSON.stringify(meadowZones) === JSON.stringify(['meadow']), 'meadow mount shows only its own item (' + meadowZones + ')');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub'); await page.evaluate(() => window.BooTown.go('town', { area: 'riverside' })); await page.waitForSelector('.t-viewport');
  await page.waitForTimeout(300);
  const riverZones = await page.$$eval('.t-item', els => els.map(e => e.dataset.zone).sort());
  assert(JSON.stringify(riverZones) === JSON.stringify(['riverside']), 'riverside mount shows only its own item after reload (' + riverZones + ')');
  const full = await page.evaluate(() => window.BooTown.State.getState().town.areas);
  assert(full.meadow.items.length === 1 && full.riverside.items.length === 1, 'both areas persist their own item independently');
  await ctx.close();
}

// 6) Night tint at 21:00.
console.log('== night tint at 21:00, day at 13:00 ==');
{
  const night = await open(BASESAVE({}), 'meadow', { hour: 21 });
  assert(await night.page.$eval('.town2', e => e.classList.contains('night')), 'night class at 21:00');
  await night.ctx.close();
  const day = await open(BASESAVE({}), 'meadow', { hour: 13 });
  assert(!(await day.page.$eval('.town2', e => e.classList.contains('night'))), 'no night class at 13:00');
  await day.ctx.close();
}

// 7) Reduced motion stills the wanderers.
console.log('== reduced motion stills wanderers ==');
{
  const { ctx, page } = await open(BASESAVE({ town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.4, row: 1, item: 'boo_inky' }], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } } } }), 'meadow', { reduced: true });
  await page.waitForTimeout(900);
  const moved = await page.evaluate(() => { const svg = document.querySelector('.t-item.boo svg'); return svg ? (svg.style.transform || '') : 'none'; });
  assert(moved === '' || moved === 'none', 'wanderer svg has no wander transform under reduced motion (' + moved + ')');
  await ctx.close();
}

// 8) Dance stage, place-from-ceremony, move, put away.
console.log('== dance stage + place/move/put-away ==');
{
  const seed = BASESAVE({ town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.45, row: 1, item: 'deco_stage' }, { zone: 'meadow', x: 0.52, row: 1, item: 'boo_inky' }], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } } } });
  const { ctx, page } = await open(seed, 'meadow');
  assert(await page.$$eval('.t-item.boo svg.art-dance', e => e.length) >= 1, 'a Boo next to the Dance Stage bops');
  // place from ceremony (no area given — defaults to meadow, matching the ceremony's real caller)
  await page.evaluate(() => window.BooTown.go('town', { place: 'boo_lolly', from: 'ceremony' }));
  await page.waitForSelector('.t-viewport'); await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.BooTown.State.getState().town.areas.meadow.items.length);
  const vp = await page.$('.t-viewport'); const box = await vp.boundingBox();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.7);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.BooTown.State.getState().town.areas.meadow.items.length);
  assert(after === before + 1, 'place-mode tap placed the held Boo (' + before + '->' + after + ')');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
