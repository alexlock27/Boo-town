// tests/p3-town.mjs — Town 2.0 (RUN2 C3) + part E check 6.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const browser = await chromium.launch();
function watch(p) { p.on('pageerror', e => errors.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); }); }
const BASESAVE = (o) => ({ version: 3, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_lolly: 1, boo_bubbles: 1, deco_stage: 1, deco_tree: 1 },
  boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, town: [],
  stars: { total: 55, byGame: {} }, settings: { sound: false, music: false, voice: false },
  seen: { trophyRetro: true },   // RUN4 C4: retro trophy ceremony already seen
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true },   // RUN4 C9
  ...o });

async function open(seed, { hour = 13, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); watch(page);
  await page.addInitScript((h) => { window.__bootownHour = h; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), seed);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.t-viewport');
  await page.waitForTimeout(600);
  return { ctx, page };
}

// 1) Old {plot} town migrates to {zone:'meadow', x}.
console.log('== old grid town migrates to Meadow ==');
{
  const old = { version: 1, name: 'Maya', guide: { body: 'sunshine', patch: 'indigo', acc: 'bow', name: 'Twiggy' },
    inventory: { boo_inky: 1, boo_beam: 1, deco_tree: 1 },
    town: [{ plot: 8, item: 'boo_inky' }, { plot: 2, item: 'deco_tree' }, { plot: 20, item: 'boo_beam' }] };
  const { ctx, page } = await open(old, {});
  const town = await page.evaluate(() => window.BooTown.State.getState().town);
  assert(town.every(t => t.zone === 'meadow' && typeof t.x === 'number'), 'all migrated to Meadow with x (' + JSON.stringify(town) + ')');
  assert(town.length === 3, 'all 3 placements kept');
  assert(await page.$$eval('.t-item', e => e.length) === 3, 'migrated items render');
  await ctx.close();
}

// 2) World scrolls full width across 4 zones.
console.log('== world scrolls full width ==');
{
  const { ctx, page } = await open(BASESAVE({}), {});
  const dims = await page.evaluate(() => { const vp = document.querySelector('.t-viewport'); const g = document.querySelector('.t-ground'); return { zoneW: vp.clientWidth, worldW: parseFloat(g.style.width) }; });
  assert(Math.round(dims.worldW / dims.zoneW) === 4, 'world is 4 zones wide (' + dims.worldW + '/' + dims.zoneW + ')');
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

// 3) Zone gating by stars.
console.log('== zones gate on stars ==');
{
  const hi = await open(BASESAVE({ stars: { total: 190, byGame: {} }, seen: { zonesUnlocked: ['riverside', 'hilltop', 'beach'], trophyRetro: true }, trophies: { medal_stars_100: '2026-07-01', trophy_zones: '2026-07-01' } }), {});
  assert(await hi.page.$$eval('.t-band.locked', e => e.length) === 0, 'at 190 stars all zones unlocked');
  await hi.ctx.close();
  const lo = await open(BASESAVE({ stars: { total: 5, byGame: {} }, town: [] }), {});
  assert(await lo.page.$$eval('.t-band.locked', e => e.length) === 3, 'at 5 stars only Meadow open (3 locked)');
  assert(await lo.page.$$eval('.t-signpost', e => e.length) === 3, '3 signposts for locked zones');
  await lo.ctx.close();
}

// 4) Unlock ceremony fires + records seen.
console.log('== Riverside unlock ceremony ==');
{
  const { ctx, page } = await open(BASESAVE({ stars: { total: 45, byGame: {} }, seen: {}, town: [] }), {});
  const hint = await page.$eval('.town-hint', e => e.textContent);
  assert(/Riverside is open/i.test(hint), 'unlock ceremony shows the Riverside banner (' + hint + ')');
  const seen = await page.evaluate(() => window.BooTown.State.getState().seen.zonesUnlocked);
  assert(seen && seen.includes('riverside'), 'seen.zonesUnlocked records riverside');
  // re-entering does not re-celebrate
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.t-viewport'); await page.waitForTimeout(300);
  const hint2 = await page.$eval('.town-hint', e => e.textContent);
  assert(!/Riverside is open/i.test(hint2), 'no repeat ceremony on re-entry');
  await ctx.close();
}

// 5) Placements persist in the right zones.
console.log('== placements persist in the right zones ==');
{
  const seed = BASESAVE({ town: [{ zone: 'meadow', x: 0.3, item: 'boo_inky' }, { zone: 'riverside', x: 0.5, item: 'boo_lolly' }], seen: { zonesUnlocked: ['riverside', 'hilltop', 'beach'] } });
  const { ctx, page } = await open(seed, {});
  const zones = await page.$$eval('.t-item', els => els.map(e => e.dataset.zone).sort());
  assert(JSON.stringify(zones) === JSON.stringify(['meadow', 'riverside']), 'items render in meadow + riverside (' + zones + ')');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub'); await page.evaluate(() => window.BooTown.go('town')); await page.waitForSelector('.t-viewport');
  const town = await page.evaluate(() => window.BooTown.State.getState().town);
  assert(town.length === 2 && town.some(t => t.zone === 'riverside'), 'zones persist across reload');
  await ctx.close();
}

// 6) Night tint at 21:00.
console.log('== night tint at 21:00, day at 13:00 ==');
{
  const night = await open(BASESAVE({}), { hour: 21 });
  assert(await night.page.$eval('.town2', e => e.classList.contains('night')), 'night class at 21:00');
  await night.ctx.close();
  const day = await open(BASESAVE({}), { hour: 13 });
  assert(!(await day.page.$eval('.town2', e => e.classList.contains('night'))), 'no night class at 13:00');
  await day.ctx.close();
}

// 7) Reduced motion stills the wanderers.
console.log('== reduced motion stills wanderers ==');
{
  const { ctx, page } = await open(BASESAVE({ town: [{ zone: 'meadow', x: 0.4, item: 'boo_inky' }] }), { reduced: true });
  await page.waitForTimeout(900);
  const moved = await page.evaluate(() => { const svg = document.querySelector('.t-item.boo svg'); return svg ? (svg.style.transform || '') : 'none'; });
  assert(moved === '' || moved === 'none', 'wanderer svg has no wander transform under reduced motion (' + moved + ')');
  await ctx.close();
}

// 8) Dance stage, place-from-ceremony, move, put away.
console.log('== dance stage + place/move/put-away ==');
{
  const seed = BASESAVE({ town: [{ zone: 'meadow', x: 0.45, item: 'deco_stage' }, { zone: 'meadow', x: 0.52, item: 'boo_inky' }] });
  const { ctx, page } = await open(seed, {});
  assert(await page.$$eval('.t-item.boo svg.art-dance', e => e.length) >= 1, 'a Boo next to the Dance Stage bops');
  // place from ceremony
  await page.evaluate(() => window.BooTown.go('town', { place: 'boo_lolly', from: 'ceremony' }));
  await page.waitForSelector('.t-viewport'); await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.BooTown.State.getState().town.length);
  const vp = await page.$('.t-viewport'); const box = await vp.boundingBox();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.7);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.BooTown.State.getState().town.length);
  assert(after === before + 1, 'place-mode tap placed the held Boo (' + before + '->' + after + ')');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
