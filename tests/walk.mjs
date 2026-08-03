// tests/walk.mjs — RUN21F F10A: the QA farm. THE PRE-MERGE SMOKE.
//
// A scripted ten-minute walk of every area and every room, at all three house viewport
// sizes, with the error hooks armed. Screenshots land in _evidence/walk/<date>/ and the
// run exits non-zero on ANY console error, page error, window.onerror or unhandled
// rejection anywhere in the walk. Nothing here asserts a feature: this is the net that
// catches the errors no feature suite is looking at, in the places a child actually goes.
//
//   python _serve.py 8000 &
//   BASE=http://127.0.0.1:8000 node tests/walk.mjs
//   BASE=… WALK_MIN=3 node tests/walk.mjs        # a shorter walk while iterating
//
// NOT a board suite — it is minutes long by design and _runall.sh excludes `walk` from
// the board enumeration alongside shoot/sim-blocks/device-qa. Run it on its own.
//
// Three lessons are baked in, learned by RUN21A's throwaway probe and paid for once:
//   1. Drive the REAL mouse. Synthetic PointerEvents have no active pointer, so the app's
//      setPointerCapture throws — and the walk then blames the app for an error the
//      harness manufactured.
//   2. A growth reveal legitimately opens on a mount. Dismiss it; do not trip over it.
//   3. Seed placements ON-CAMERA. An outdoor area is FOUR viewports wide, so anything
//      above x ~0.25 is off the right edge at the default scroll, where stepActors skips
//      it as offscreen and the walk photographs an empty field.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const WALK_MIN = Number(process.env.WALK_MIN || 10);      // total, split across the viewports
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const SHOTS = `_evidence/walk/${today}`;
mkdirSync(SHOTS, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// House evidence standard (CLAUDE.md): 1024x768, 768x1024, 390x844.
const VIEWPORTS = [
  { w: 1024, h: 768, name: 'tablet-landscape' },
  { w: 768, h: 1024, name: 'tablet-portrait' },
  { w: 390, h: 844, name: 'phone' }
];
// Every area, and every room inside the ones that have rooms.
const ROUTE = [
  ['meadow', null], ['riverside', null], ['hilltop', null], ['beach', null],
  ['playground', null], ['funfair', null],
  ['boohouse', 'lounge'], ['boohouse', 'kitchen'], ['boohouse', 'bedroom'],
  ['gallery', null]
];
const stopName = ([area, room]) => room ? `${area}-${room}` : area;

const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground',
  'boohouse', 'boohouse_kitchen', 'boohouse_bedroom', 'gallery'];
const BOOS = ['inky', 'plum', 'pippin'].map(n => 'boo_' + n);
// ON-CAMERA seeds only: x <= 0.25 keeps every placement inside the first viewport of a
// four-viewport-wide area, where the actors actually step and the camera actually looks.
const OUTDOOR_SEED = [
  { item: 'boo_inky', x: 0.10, row: 2 }, { item: 'boo_plum', x: 0.18, row: 2 },
  { item: 'deco_bench', x: 0.23, row: 2 }, { item: 'deco_tree', x: 0.06, row: 1 }
];
const INDOOR_SEED = [
  { item: 'boo_pippin', x: 0.14, row: 2 }, { item: 'deco_table', x: 0.22, row: 2 }
];
const seedFor = key => (key.startsWith('boohouse') || key === 'gallery' ? INDOOR_SEED : OUTDOOR_SEED)
  .map(t => ({ ...t }));
const SAVE = {
  version: 23, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.assign(Object.fromEntries(BOOS.map(b => [b, 1])),
    { deco_bench: 1, deco_tree: 1, deco_table: 1, deco_bed: 1, deco_rug: 1, deco_tablelamp: 1 }),
  stars: { total: 400, byType: {}, spent: {} },
  town: { areas: Object.fromEntries(AREA_KEYS.map(k => [k, { items: seedFor(k), paths: [] }])) },
  wishes: { unlocked: {} },
  funfair: { built: ['carousel', 'ferris', 'teacups'], build: null, pending: [], seats: {} },
  delights: { hideDay: today, hideFound: true },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', introSeen: { shop: 1 } },
  settings: { sound: true, music: true, voice: false, content: 'full', requests: true }
};

const errors = [];        // every hook drains into here; any entry fails the walk
const steps = [];
let failed = false;
const note = (m, ok = true) => { if (!ok) failed = true; steps.push(`${ok ? '  ok ' : '  XX '}${m}`); console.log(`${ok ? '  ✓' : '  ✗ FAIL:'} ${m}`); };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

async function armedPage(viewport) {
  // A FRESH context per viewport: live autosave overwrites a seed dropped into a warm one.
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await ctx.newPage();
  const where = viewport.name;
  page.on('pageerror', e => errors.push(`[${where}] pageerror: ${String(e).split('\n')[0]}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${where}] console.error: ${m.text()}`); });
  // A request that genuinely could not be served is a real fault (a file missing from the
  // repo would break the app offline). ERR_ABORTED is not: it is what the browser reports
  // for the in-flight module fetches a reload or a context close cancels, which this walk
  // causes by design.
  page.on('requestfailed', r => {
    const why = (r.failure() && r.failure().errorText) || 'unknown';
    if (/ERR_ABORTED/.test(why)) return;
    errors.push(`[${where}] requestfailed (${why}): ${r.url()}`);
  });
  await page.addInitScript(() => {
    window.__bootownHour = 13;          // pin midday so the walk is not a day/night lottery
    window.__walkErrors = [];
    window.addEventListener('error', e => window.__walkErrors.push('onerror: ' + (e.message || '')));
    window.addEventListener('unhandledrejection', e => window.__walkErrors.push('unhandledrejection: ' + ((e.reason && e.reason.message) || String(e.reason))));
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 30000 });
  return { ctx, page };
}

async function arrive(page, area, room) {
  await page.evaluate(p => window.BooTown.go('town', p), room ? { area, room } : { area });
  await page.waitForSelector('.town2', { timeout: 15000 });
  await page.waitForFunction(() => window.__townLife, { timeout: 10000 });
  await sleep(500);
  // A growth reveal legitimately opens on a mount. Dismiss it rather than fighting it.
  const reveal = await page.$('.overlay.growth-reveal .btn');
  if (reveal) { await reveal.click(); await sleep(350); }
}

// One real-mouse visit: tap a placement (opens its little menu), close it, then a short
// real drag across the scene. This is what exercises the pointer-capture paths that
// synthetic events cannot reach.
async function handle(page, viewport) {
  const spot = await page.evaluate(() => {
    const n = document.querySelector('.t-item');
    if (!n) return null;
    const r = n.getBoundingClientRect();
    if (r.width === 0) return null;
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  if (!spot) return false;
  const inside = spot.x > 4 && spot.y > 4 && spot.x < viewport.w - 4 && spot.y < viewport.h - 4;
  if (!inside) return false;
  await page.mouse.click(spot.x, spot.y);
  await sleep(400);
  await page.keyboard.press('Escape');
  await sleep(200);
  // a short real drag (press, several moves, release) — never a synthetic PointerEvent
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) { await page.mouse.move(spot.x + i * 8, spot.y); await sleep(30); }
  await page.mouse.up();
  await sleep(350);
  return true;
}

const PER_VIEWPORT_MS = Math.max(20000, Math.round(WALK_MIN * 60 * 1000 / VIEWPORTS.length));
console.log(`walking every area and room at ${VIEWPORTS.length} viewport sizes · ${WALK_MIN} minutes total (${Math.round(PER_VIEWPORT_MS / 1000)}s each)`);
console.log(`screenshots → ${SHOTS}`);

const t0 = Date.now();
for (const vp of VIEWPORTS) {
  console.log(`\n== ${vp.name} (${vp.w}x${vp.h}) ==`);
  const { ctx, page } = await armedPage(vp);
  const until = Date.now() + PER_VIEWPORT_MS;
  let laps = 0, shot = 0, handled = 0;
  const visited = new Set();
  while (Date.now() < until) {
    for (const stop of ROUTE) {
      if (Date.now() >= until && laps > 0) break;      // always finish lap one
      const [area, room] = stop;
      await arrive(page, area, room);
      visited.add(stopName(stop));
      if (laps === 0) {
        await page.screenshot({ path: `${SHOTS}/${vp.w}x${vp.h}-${stopName(stop)}.png` });
        shot++;
      }
      // pan the four-viewport-wide world the way a swipe does, and let the place live
      await page.evaluate(() => { if (window.__town && window.__town.scrollTo) window.__town.scrollTo(window.__town.scrollMax() * 0.6); });
      await sleep(1200);
      await page.evaluate(() => { if (window.__town && window.__town.scrollTo) window.__town.scrollTo(0); });
      await sleep(900);
      if (await handle(page, vp)) handled++;
    }
    laps++;
    console.log(`  lap ${laps} · ${Math.max(0, Math.round((until - Date.now()) / 1000))}s left`);
  }
  note(`${vp.name}: ${laps} lap(s) of all ${ROUTE.length} stops, ${visited.size} distinct places, ${shot} screenshots, ${handled} real-mouse handles`,
    visited.size === ROUTE.length && shot === ROUTE.length && handled > 0);
  const inPage = await page.evaluate(() => window.__walkErrors || []);
  inPage.forEach(e => errors.push(`[${vp.name}] ${e}`));
  await ctx.close();
}
await browser.close();

const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log('\n--- walk steps ---');
steps.forEach(s => console.log(s));
console.log(`\nwall time: ${mins} min · screenshots in ${SHOTS}`);
console.log(`errors captured: ${errors.length}`);
errors.slice(0, 30).forEach(e => console.log('  ! ' + e));
if (errors.length) failed = true;
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS — every area and room walked at every size, zero errors');
process.exit(failed ? 1 : 0);
