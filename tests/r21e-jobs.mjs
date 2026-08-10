// tests/r21e-jobs.mjs — RUN21E "Every Area a Job": the pack's own ACCEPT criteria, made
// permanent.
//
// Expected runtime: ~3m (board law: state it when adding a suite). Not @serial — nothing
// here waits out a real-clock ceremony; the longest single wait is E12's 8-second bath,
// and that is polled rather than slept through.
//
// Everything is driven through the real mouse (page.mouse), because a synthetic PointerEvent
// has no active pointer and the app's setPointerCapture then throws — the harness would blame
// the app for its own error (handover trap 1). Placements are seeded at x <= 0.25 so they sit
// on the first screenful of a four-viewport area, where stepActors still steps them and a real
// click can reach them (trap 2).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8041';
const SHOTS = '_evidence/run21e';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow'].map(n => 'boo_' + n);
const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground',
  'boohouse', 'boohouse_kitchen', 'boohouse_bedroom', 'gallery'];
const AREAS = () => Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }]));
const SETTLED_FAIR = { built: ['carousel', 'ferris', 'teacups', 'bouncy', 'helter'], build: null, pending: [], seats: {}, catchup: [] };

let nextId = 1;
const P = (zone, item, x, row = 1, extra = {}) => ({ id: nextId++, zone, x, row, item, scale: 1, ...extra });

const SAVE = (over = {}) => Object.assign({
  version: 24, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])),
  stars: { total: 400, byType: {}, spent: {} },
  town: { areas: AREAS(), nextId: 900 },
  funfair: SETTLED_FAIR,
  wishes: { unlocked: {} },
  // the day's hide-and-seek must never swallow a Boo these blocks are watching
  delights: { hideDay: today, hideFound: true },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', introSeen: { shop: 1 }, funfairOpened: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false }
}, over);
const withItems = (map) => { const a = AREAS(); for (const k of Object.keys(map)) a[k].items = map[k]; return a; };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const pageErrors = [];
async function open(save, { area = 'meadow', room = null, w = 1024, h = 768, hour = 13, reduced = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  await page.addInitScript(hr => { window.__bootownHour = hr; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  } catch {
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 30000 });
  }
  if (area) {
    await page.evaluate(p => window.BooTown.go('town', p), room ? { area, room } : { area });
    await page.waitForSelector('.town2', { timeout: 15000 });
    await page.waitForFunction(() => window.__townLife, { timeout: 8000 });
    // Multi-threshold fixtures legitimately open with a combined celebration (handover trap 4).
    await page.evaluate(() => document.querySelectorAll('.overlay.growth-reveal').forEach(o => o.remove()));
  }
  return { ctx, page };
}
// Click a placed item with the REAL mouse, at the centre of its wrap.
async function tapItem(page, itemId) {
  const box = await page.evaluate(id => {
    const w = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === id);
    if (!w) return null;
    const r = w.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) };
  }, itemId);
  if (!box) return false;
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.up();
  return true;
}
const hasCls = (page, sel) => page.evaluate(s => !!document.querySelector(s), sel);
const count = (page, sel) => page.evaluate(s => document.querySelectorAll(s).length, sel);
// Poll for a condition rather than sleeping a fixed guess.
async function until(page, fn, ms = 4000, step = 100) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(step); }
  return false;
}

// ============================================================================
// E12 — the dead-prop amnesty: five props answer a tap
// ============================================================================
console.log('\n== E12: the dead-prop amnesty ==');
{
  // The kitchen: fridge + oven + a Boo standing between them.
  const save = SAVE({
    town: {
      areas: withItems({
        boohouse_kitchen: [P('boohouse_kitchen', 'deco_fridge', 0.12), P('boohouse_kitchen', 'deco_oven', 0.30), P('boohouse_kitchen', 'boo_inky', 0.20)]
      }), nextId: 900
    }
  });
  const { ctx, page } = await open(save, { area: 'boohouse', room: 'kitchen' });

  // --- fridge ---
  assert(await tapItem(page, 'deco_fridge'), 'the fridge is on screen and clickable');
  assert(await until(page, () => !!document.querySelector('.t-item[data-item="deco_fridge"].prop-open'), 1500),
    'fridge: the door swings open');
  assert(await page.evaluate(() => {
    const g = document.querySelector('.t-item[data-item="deco_fridge"] .pd-peek');
    return !!g && /<svg/i.test(g.innerHTML);
  }), 'fridge: a food wish peeks out of the open door (inline SVG, never an emoji)');
  assert(await until(page, () => window.__townLife.goals().some(g => g.goal === 'approach'), 2500),
    'fridge: the nearest Boo trots over for the chomp');
  await page.screenshot({ path: `${SHOTS}/e12-fridge.png` });
  assert(await until(page, () => !document.querySelector('.t-item[data-item="deco_fridge"].prop-open'), 4000),
    'fridge: the door closes again by itself');

  // --- oven ---
  assert(await tapItem(page, 'deco_oven'), 'the oven is on screen and clickable');
  assert(await hasCls(page, '.t-item[data-item="deco_oven"].prop-cooking'), 'oven: it starts glowing at once');
  assert(await page.evaluate(() => {
    const l = document.querySelector('.t-item[data-item="deco_oven"] .pd-ovenlight');
    return !!l && parseFloat(getComputedStyle(l).opacity) > 0.4;
  }), 'oven: the window light is actually up (not just a class)');
  await page.screenshot({ path: `${SHOTS}/e12-oven-glow.png` });
  assert(await until(page, () => document.querySelectorAll('.t-item[data-item="deco_oven"] .wish-wisp').length > 0, 5000),
    'oven: after the glow, a puff of steam (the Ding! rides the same beat)');

  await ctx.close();
}
{
  // The bathroom half of the amnesty lives in the Lounge for the fixture's sake: the tub is
  // an indoor item and the Lounge is the room a fresh save opens in.
  const save = SAVE({
    town: {
      areas: withItems({
        boohouse: [P('boohouse', 'deco_bathtub', 0.14), P('boohouse', 'boo_plum', 0.20), P('boohouse', 'deco_mirror', 0.42, 3, { plane: 'wall', y: 0.3 })]
      }), nextId: 900
    }
  });
  const { ctx, page } = await open(save, { area: 'boohouse', room: 'lounge' });

  // --- bathtub ---
  assert(await tapItem(page, 'deco_bathtub'), 'the bath is on screen and clickable');
  assert(await until(page, () => window.__townLife.goals().some(g => g.goal === 'bath'), 2000),
    'bath: the nearby Boo heads for the tub');
  assert(await until(page, () => document.querySelectorAll('.t-item[data-item="deco_bathtub"] .pd-foam').length === 4, 8000),
    'bath: exactly four foam bubbles (the pack\'s number)');
  assert(await count(page, '.t-item[data-item="deco_bathtub"] .pd-duck') === 1, 'bath: one rubber duck bobbing');
  await page.screenshot({ path: `${SHOTS}/e12-bath.png` });
  // The soak is 8s; the foam must be gone when it ends, and the Boo must be free again.
  assert(await until(page, () => document.querySelectorAll('.t-item[data-item="deco_bathtub"] .pd-foam').length === 0, 12000),
    'bath: the foam drains away when the soak ends');
  assert(await until(page, () => !window.__townLife.goals().some(g => g.goal === 'bath'), 3000),
    'bath: the Boo hops out and is free to wander again');

  // --- mirror ---
  assert(await tapItem(page, 'deco_mirror'), 'the mirror is on screen and clickable');
  assert(await until(page, () => !!document.querySelector('.pd-mirror-look') || !!document.querySelector('.sparkle, .spark'), 2000),
    'mirror: the nearest Boo stops and admires itself');
  await ctx.close();
}
{
  // --- wardrobe --- (bedroom, where wardrobe2 belongs)
  const save = SAVE({
    town: { areas: withItems({ boohouse_bedroom: [P('boohouse_bedroom', 'deco_wardrobe2', 0.14), P('boohouse_bedroom', 'boo_pippin', 0.20)] }), nextId: 900 }
  });
  const { ctx, page } = await open(save, { area: 'boohouse', room: 'bedroom' });
  assert(await tapItem(page, 'deco_wardrobe2'), 'the wardrobe is on screen and clickable');
  assert(await until(page, () => !!document.querySelector('.t-item[data-item="deco_wardrobe2"].prop-open'), 1500),
    'wardrobe: the doors open');
  await page.screenshot({ path: `${SHOTS}/e12-wardrobe.png` });
  assert(await until(page, () => !!document.querySelector('.acc-overlay'), 3000),
    'wardrobe: dress-up opens for the nearest Boo');
  await ctx.close();
}
{
  // Reduced motion: the verbs still ANSWER, they just do not move. Nothing may throw.
  const save = SAVE({
    town: { areas: withItems({ boohouse_kitchen: [P('boohouse_kitchen', 'deco_fridge', 0.12), P('boohouse_kitchen', 'boo_inky', 0.20)] }), nextId: 900 }
  });
  const { ctx, page } = await open(save, { area: 'boohouse', room: 'kitchen', reduced: 'reduce' });
  await tapItem(page, 'deco_fridge');
  assert(await until(page, () => !!document.querySelector('.t-item[data-item="deco_fridge"].prop-open'), 1500),
    'reduced motion: the fridge still opens (a transition, not an animation)');
  assert(await page.evaluate(() => {
    const p = document.querySelector('.t-item[data-item="deco_fridge"] .pd-peek');
    return !p || getComputedStyle(p).animationName === 'none';
  }), 'reduced motion: the peek does not animate');
  await ctx.close();
}

// ============================================================================
console.log('\n== console health ==');
// ERR_NO_BUFFER_SPACE is this machine's socket exhaustion when several lanes serve at once,
// not anything the app did — the lane brief names it by name. Everything else counts.
const real = pageErrors.filter(e => !/favicon|ERR_INTERNET_DISCONNECTED|ERR_NO_BUFFER_SPACE/i.test(e));
assert(real.length === 0, `zero console/page errors across every block (${real.length}${real.length ? ': ' + real.slice(0, 4).join(' | ') : ''})`);

await browser.close();
console.log('\nRESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
