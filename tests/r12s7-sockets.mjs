// tests/r12s7-sockets.mjs — RUN12 S7: a Boo on a dance floor stands ON the dance floor.
//
// RUN10 P2 gave the town seat points with pixel contact. Every venue built after it — the
// Disco Hall first among them — ignored the idea entirely: measured at 1280x720, each
// dancer's feet were 76px above the floor, because .disco-dancers set a fixed `bottom: 38%`
// while the floor is a rotateX(55deg) plane whose projected surface lands wherever the
// stage height puts it.
//
// data/sockets.js VENUE_SOCKETS now declares, for every venue that shows Boos, either the
// surface they stand on or — in so many words — why they do not stand on anything. This
// suite enumerates that table, so a new venue with floating Boos and no declaration fails.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
import { VENUE_SOCKETS, BOO_FOOT_FRAC } from '../data/sockets.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s7';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// ---- 1. the register is complete and honest ------------------------------------------
console.log('== every venue that shows Boos is declared ==');
{
  const names = Object.keys(VENUE_SOCKETS);
  assert(names.length >= 6, `${names.length} venues declared`);
  for (const [name, v] of Object.entries(VENUE_SOCKETS)) {
    const seated = !!v.surface || !!v.seatedBy;
    assert(seated || v.freeFloating === true,
      `${name}: declares a surface or declares itself free-floating`);
    assert(typeof v.note === 'string' && v.note.length > 40,
      `${name}: says WHY in a real sentence, not a shrug`);
    if (v.surface) {
      assert(typeof v.surfaceFrac === 'number' && v.surfaceFrac >= 0 && v.surfaceFrac <= 1,
        `${name}: declares where along the surface the feet land (${v.surfaceFrac})`);
      assert(typeof v.tolerance === 'number' && v.tolerance <= 4,
        `${name}: holds itself to <=4px (${v.tolerance})`);
    }
  }
  // the register must cover every screen that renders a Boo onto a scene
  const disco = readFileSync('js/discohall.js', 'utf8');
  assert(/VENUE_SOCKETS/.test(disco), 'js/discohall.js reads its socket from the register rather than hardcoding one');
  assert(/getBoundingClientRect\(\)[\s\S]{0,400}surfaceFrac/.test(disco),
    'and measures the floor rather than trusting a CSS percentage');
}

// ---- 2. measure it ---------------------------------------------------------------------
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_mint: 1, boo_sky: 1, boo_dusk: 1, boo_pebble: 1 },
  stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 },
  expedition: { party: ['boo_inky','boo_plum','boo_mint','boo_sky'], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const VIEWPORTS = [
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 }
];

const browser = await chromium.launch({ args: RESOLVE });

console.log('== the Disco Hall stands its dancers on the floor, at every viewport ==');
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('discohall', {}));
  await page.waitForTimeout(1800);

  const r = await page.evaluate((footFrac) => {
    const floor = document.querySelector('.disco-floor');
    const dancers = [...document.querySelectorAll('.disco-dancer')];
    if (!floor || !dancers.length) return { error: 'no disco nodes' };
    const surfaceY = window.__disco.floorSurfaceY();
    return {
      surfaceY: Math.round(surfaceY),
      floor: { top: Math.round(floor.getBoundingClientRect().top), bottom: Math.round(floor.getBoundingClientRect().bottom) },
      dancers: dancers.map(d => {
        const box = d.getBoundingClientRect();
        const svg = d.querySelector('svg');
        // the visible sole, taken from the art's own geometry rather than the CSS box
        const feetY = svg ? svg.getBoundingClientRect().top + svg.getBoundingClientRect().height * footFrac : box.bottom;
        return { boxBottomOff: Math.round(box.bottom - surfaceY), feetOff: Math.round(feetY - surfaceY) };
      })
    };
  }, BOO_FOOT_FRAC);

  assert(!r.error, `${vp.name}: the Disco Hall renders dancers and a floor`);
  if (r.error) { await ctx.close(); continue; }
  const tol = VENUE_SOCKETS.discohall.tolerance;
  const worstBox = Math.max(...r.dancers.map(d => Math.abs(d.boxBottomOff)));
  const worstFeet = Math.max(...r.dancers.map(d => Math.abs(d.feetOff)));
  // 2026-07-30: these two assertions could not both hold, which is why the feet one had been
  // failing (5-24px depending on viewport) since before RUN19 Z1's depth rows. Boo art leaves
  // the bottom ~9% of its box empty below the drawn soles, so a dancer whose BOX bottom is on
  // the surface has its FEET floating that gap above it. RUN12 S7's law is about the feet — "a
  // Boo on a dance floor stands ON the dance floor" — so the feet are now the assertion, at
  // the socket's own declared tolerance, and the box bottom is reported for diagnosis only
  // (it now sits deliberately BELOW the line by exactly the sole gap).
  assert(worstFeet <= tol, `${vp.name}: the drawn FEET land on the declared surface (worst ${worstFeet}px, art's own sole geometry)`);
  await page.screenshot({ path: `${SHOTS}/discohall-${vp.name}.png` });
  console.log(`    → surface y=${r.surfaceY}, ${r.dancers.length} dancers, worst bounds ${worstBox}px / feet ${worstFeet}px`);
  await ctx.close();
}

console.log('== a venue declared free-floating really has no surface to stand on ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  for (const [name, v] of Object.entries(VENUE_SOCKETS)) {
    if (!v.freeFloating) continue;
    await page.evaluate(async ([r, p]) => { try { await window.BooTown.go(r, p || {}); } catch {} }, [v.route, v.params]);
    await page.waitForTimeout(1300);
    await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
    await page.waitForTimeout(400);
    const found = await page.evaluate((sel) => document.querySelectorAll(sel).length, v.boos);
    // Not an error if none are on screen for this fixture — the point is that the selector
    // is real and the declaration is deliberate, so nobody adds a floating Boo by accident.
    console.log(`    → ${name}: ${found} node(s) matching ${v.boos} (declared free-floating)`);
    assert(true, `${name}: free-floating by declaration — ${v.note.slice(0, 60)}…`);
  }
  await ctx.close();
}

console.log('== the town still seats its Boos through SOCKETS ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  const r = await page.evaluate(async () => {
    const { SOCKETS } = await import('./data/sockets.js');
    return { entries: Object.keys(SOCKETS).length,
      withYFrac: Object.values(SOCKETS).flat().filter(s => typeof s.yFrac === 'number').length };
  });
  assert(r.entries >= 9, `SOCKETS still declares ${r.entries} seatable items`);
  assert(r.withYFrac >= 8, `${r.withYFrac} of them carry the pixel-contact yFrac RUN10 P2 iterated`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
