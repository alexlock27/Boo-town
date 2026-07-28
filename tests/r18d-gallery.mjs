// tests/r18d-gallery.mjs — RUN18D D9: the Gallery, presented.
//
// It was the town's night-sky gradient with figures floating on invisible discs — the same
// backdrop as a field, on the one screen whose entire subject is looking at what she has
// collected, and with nothing saying what any of them were called. It is a room now: cream
// wall, wainscot, skirting, a wooden floor, a spotlight over each plinth column, an
// engraved plate under every figure, and one Boo wandering the floor.
// Expected runtime: ~30s. Not @serial — the visitor is sampled over seconds, not frames.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('screenshots/run18d/d9', { recursive: true });

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const OWNED = ['boo_inky', 'boo_plum', 'boo_lolly', 'boo_mint', 'boo_sunny', 'boo_pip', 'boo_teal', 'boo_dot', 'deco_tree', 'deco_bench'];
const save = (items) => JSON.stringify({
  version: 19, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(items.map(k => [k, 1])), trophies: {}, boxes: 0, meter: 2,
  spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 900, byGame: {}, byType: { maths: 200, word: 200, puzzle: 200, creative: 200, lesson: 200 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 2 }, shop: { welcomed: true },
  seen: { trophyRetro: true, lastStarsShown: 900, welcomeTour: true, zonesUnlocked: AK },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function gallery(width, height, items = OWNED, reduced = false) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(items));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 40000 });
  await page.evaluate(() => window.BooTown.go('gallerymuseum'));
  await page.waitForSelector('.gm-stage', { timeout: 20000 });
  await sleep(1200);
  return { ctx, page };
}
// contrast of rendered text against the pixels actually behind it
const contrast = (page, sel) => page.evaluate(async (s) => {
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parse = (c) => (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
  const walkBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      const p = parse(bg);
      if (p.length >= 3 && (p[3] === undefined || p[3] > 0.5) && bg !== 'rgba(0, 0, 0, 0)') return p;
      n = n.parentElement;
    }
    return [231, 220, 198];   // .gm-stage's own cream
  };
  const out = [];
  for (const el of document.querySelectorAll(s)) {
    if (!el.textContent.trim()) continue;
    const fg = parse(getComputedStyle(el).color);
    const bg = walkBg(el);
    const l1 = lum(fg[0], fg[1], fg[2]), l2 = lum(bg[0], bg[1], bg[2]);
    out.push({ text: el.textContent.trim().slice(0, 22), ratio: +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)) });
  }
  return out;
}, sel);

// ================== 1. it is a room ==================
console.log('== the Gallery is a room, not a field ==');
for (const [w, h] of [[1024, 768], [390, 844]]) {
  const { ctx, page } = await gallery(w, h);
  const r = await page.evaluate(() => ({
    room: window.__gallery.roomPresent(), cones: window.__gallery.coneCount(),
    plinths: window.__gallery.plinthCount(), plates: window.__gallery.plateTexts()
  }));
  assert(r.room, `${w}: the drawn museum interior is mounted`);
  assert(r.cones >= 2, `${w}: spotlights hang over the plinths (${r.cones})`);
  assert(r.plates.length === r.plinths, `${w}: every plinth has a name plate (${r.plates.length}/${r.plinths})`);
  assert(r.plates.every(t => t && t.trim().length > 0), `${w}: and every plate says something (${r.plates.slice(0, 3).join(', ')})`);
  // …the grid is the pack's, and it fills the shell rather than leaving a column of gaps
  const grid = await page.evaluate(() => {
    const g = document.querySelector('.gm-grid');
    const cols = getComputedStyle(g).gridTemplateColumns.split(' ').map(parseFloat);
    const p = document.querySelector('.gm-plinth').getBoundingClientRect();
    const floor = document.querySelector('.gm-stage').getBoundingClientRect();
    return { cols, minCol: Math.min(...cols), plinthBottom: p.bottom, stageBottom: floor.bottom, stageTop: floor.top, stageH: floor.height };
  });
  assert(grid.minCol >= 149, `${w}: every column is at least 150px (${grid.cols.map(c => Math.round(c)).join(',')})`);
  // the figures stand on the FLOOR — in the bottom half of the room, not up the wall
  const standing = (grid.plinthBottom - grid.stageTop) / grid.stageH;
  assert(standing > 0.5 && standing < 0.95, `${w}: the figures stand on the floor (${(standing * 100).toFixed(0)}% down the room)`);
  await page.screenshot({ path: `screenshots/run18d/d9/gallery-${w}.png` });
  await ctx.close();
}

// ================== 2. the plates and the empty copy are readable ==================
console.log('== ink on brass, and an empty plinth that says what it is waiting for ==');
{
  const { ctx, page } = await gallery(1024, 768);
  const plates = await contrast(page, '.gm-plate');
  assert(plates.length >= 6, `${plates.length} plates measured`);
  const worst = plates.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
  assert(worst.ratio >= 4.5, `the worst plate measures ${worst.ratio}:1 ("${worst.text}") — the text law is 4.5:1`);
  const banners = await contrast(page, '.gm-banner');
  const wb = banners.length ? banners.reduce((a, b) => (a.ratio <= b.ratio ? a : b)) : { ratio: 99, text: '' };
  assert(wb.ratio >= 4.5, `and the wing banners read at ${wb.ratio}:1 against the new cream wall ("${wb.text}")`);
  await ctx.close();
}
{
  // the seed room: fewer than six owned
  const { ctx, page } = await gallery(1024, 768, ['boo_inky', 'boo_plum']);
  const { EMPTY_PLINTH_LINE } = await import('../js/gallerymuseum.js');
  assert(EMPTY_PLINTH_LINE === 'Waiting for a treasure…', `the empty line is the pack's ("${EMPTY_PLINTH_LINE}")`);
  const r = await page.evaluate(() => ({ seeds: window.__gallery.seedCount(), plates: window.__gallery.plateTexts() }));
  assert(r.seeds >= 3, `empty plinths are shown (${r.seeds})`);
  const waiting = r.plates.filter(t => t === 'Waiting for a treasure…').length;
  assert(waiting === r.seeds, `every empty plinth SAYS it is waiting (${waiting}/${r.seeds})`);
  const empties = await contrast(page, '.gm-plate.empty');
  const worst = empties.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
  assert(worst.ratio >= 4.5, `and it is readable ink: ${worst.ratio}:1`);
  await page.screenshot({ path: 'screenshots/run18d/d9/gallery-empty.png' });
  await ctx.close();
}

// ================== 3. one visitor, and it moves ==================
console.log('== one Boo wanders the floor ==');
{
  const { ctx, page } = await gallery(1024, 768);
  const n = await page.evaluate(() => window.__gallery.visitorCount());
  assert(n === 1, `exactly one visitor (${n})`);
  const { MAX_VISITORS, VISITOR_SPEED_PX_S } = await import('../js/gallerymuseum.js');
  assert(MAX_VISITORS === 1, `and the cap says one (${MAX_VISITORS})`);
  assert(VISITOR_SPEED_PX_S > 0 && VISITOR_SPEED_PX_S <= 60, `at a town-ish wander rate (${VISITOR_SPEED_PX_S} px/s)`);
  const xs = [];
  for (let i = 0; i < 7; i++) { xs.push(await page.evaluate(() => window.__gallery.visitorX())); await sleep(520); }
  const span = Math.max(...xs) - Math.min(...xs);
  assert(new Set(xs.map(x => Math.round(x))).size >= 5, `it is in a different place in ${new Set(xs.map(x => Math.round(x))).size} of 7 samples`);
  assert(span > 20, `and it really travels (${span.toFixed(0)}px over 3.6s)`);
  await ctx.close();
}
{
  const { ctx, page } = await gallery(1024, 768, OWNED, true);
  const a = await page.evaluate(() => window.__gallery.visitorX());
  await sleep(1400);
  const b = await page.evaluate(() => window.__gallery.visitorX());
  assert(a === b, `reduced motion stands the visitor still (${a} → ${b})`);
  assert(await page.evaluate(() => window.__gallery.roomPresent()), 'and the room is still a room');
  await ctx.close();
}

await browser.close();
assert(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
