// tests/r12s1-routes.mjs — RUN12 S1: the permanent route-parameter smoke suite.
//
// The Wish Well crash shipped because NO suite ever drove `town` with
// `params.openWishWell`: js/town.js called `openWishWellOverlay()`, which had never
// existed under that name, and the only entry point was a Today-rail card. This suite
// guards the CLASS, not the instance:
//   1. every key in js/main.js's lazy registry is mounted, with no params;
//   2. every `go('route', { ... })` param shape that appears anywhere in js/ is mounted
//      with a real fixture for that shape;
//   3. a (route, param) pair found in source with no fixture here is a FAILURE, so the
//      next in-app link that invents a param cannot ship untested;
//   4. any console error, page error or unhandled rejection during a mount fails.
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// ---- 1. the registry, read from the product source so it can never drift -------------
const mainSrc = readFileSync('js/main.js', 'utf8');
const registryBlock = mainSrc.slice(mainSrc.indexOf('const registry = {'), mainSrc.indexOf('};', mainSrc.indexOf('const registry = {')));
const ROUTES = [...registryBlock.matchAll(/^\s*'?([a-zA-Z][\w-]*)'?\s*:\s*\(\)\s*=>/gm)].map(m => m[1]);

// ---- 2. every params shape used anywhere in js/ --------------------------------------
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}
// route -> Set(param key names seen in source)
const seenParams = new Map();
for (const file of walk('js')) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/go\(\s*'([a-zA-Z][\w-]*)'\s*,\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
    const route = m[1];
    // top-level keys only: strip nested object bodies before splitting
    const body = m[2].replace(/\{[^{}]*\}/g, 'X');
    const keys = [...body.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?::|,|$)/g)].map(k => k[1]);
    if (!seenParams.has(route)) seenParams.set(route, new Set());
    for (const k of keys) if (k) seenParams.get(route).add(k);
  }
}

// ---- 3. authored fixtures -------------------------------------------------------------
// Each entry is a JS SOURCE expression evaluated inside the page, so params may carry the
// functions (`replay`) and live objects the real callers pass. Keep one fixture per
// distinct shape a real caller uses; the coverage check below enforces that.
const FIXTURES = {
  town: [
    ["area only (world-map badge)", "({ area: 'meadow' })"],
    ["funfair area (hub bar)", "({ area: 'funfair' })"],
    ["Today-rail Wish Well card", "({ area: 'meadow', openWishWell: true })"],
    ["entrance pan after an unlock", "({ area: 'riverside', enterPan: true })"],
    ["place from ceremony", "({ place: 'deco_palm', from: 'ceremony' })"],
    ["place from first pick", "({ place: 'deco_palm', from: 'firstpick' })"],
    // RUN13 T3: the Boo House's three rooms all arrive through this one route.
    ["Boo House Lounge", "({ area: 'boohouse', room: 'lounge' })"],
    ["Boo House Kitchen", "({ area: 'boohouse', room: 'kitchen' })"],
    ["Boo House Bedroom", "({ area: 'boohouse', room: 'bedroom' })"],
    ["Boo House with no room named (defaults to the Lounge)", "({ area: 'boohouse' })"],
    // RUN18B Y2: the shop's handoff lands her in build mode with the item selected
    ["shop handoff, outdoors", "({ area: 'meadow', build: true, place: 'deco_bench' })"],
    ["shop handoff, indoors", "({ area: 'boohouse', room: 'lounge', build: true, place: 'deco_armchair' })"]
  ],
  ceremony: [["Star Chest", "({ chest: true })"]],
  collection: [
    ["open an item from the museum", "({ openItem: 'boo_inky', from: 'gallerymuseum' })"],
    // RUN18B Y2: "Who's wearing it?" — in from the shop with a wearable just bought
    ["dress a Boo in the thing she just bought", "({ from: 'shop', dressWith: 'acc_sunhat' })"]
  ],
  editguide: [["from hub", "({ from: 'hub' })"], ["from collection", "({ from: 'collection' })"]],
  hub: [["species-change greeting", "({ greeting: 'speciesChange' })"]],
  paint: [["continue a draft", "({ draft: true })"]],
  // the seven real keys from TODDLER_GAMES, plus the shape that used to take the screen down
  toddlergame: [
    ["count", "({ game: 'count' })"], ["colour", "({ game: 'colour' })"],
    ["shape", "({ game: 'shape' })"], ["letter", "({ game: 'letter' })"],
    ["animals", "({ game: 'animals' })"], ["pairs", "({ game: 'pairs' })"],
    ["bigsmall", "({ game: 'bigsmall' })"],
    ["a stale/unknown game key falls back instead of throwing", "({ game: 'popping' })"]
  ],
  // RUN18C C2: a finished puzzle sends `from` so the trail knows which segment the party
  // has earned the right to walk. A stale/unknown key must leave them standing, not throw.
  expedition: [
    ["open the trail", "({ trail: true })"],
    ["back from a finished node, walking on", "({ trail: true, from: 'bridges' })"],
    ["back from the last node", "({ trail: true, from: 'hotel' })"],
    ["a stale node key falls back instead of throwing", "({ trail: true, from: 'bridge' })"]
  ],
  // RUN18B Y2: the shop's handoff. It remembers the area she came in from, and sends her
  // back to it in build mode with the bought item already selected in its own drawer tab.
  shop: [
    ["entered from an area", "({ fromArea: 'hilltop' })"],
    // RUN19 Z6: a locked wallpaper swatch in a room's Decorate tab deep-links here, naming the
    // shelf to open and the dressing to ring.
    ["deep-linked from a room's Decorate tab", "({ shelf: 'house', highlight: 'lounge_walls_starry' })"],
    // RUN21A-9: the town doors carry the way home — Back returns to the sending area, or
    // to the exact Boo House room a locked swatch came from.
    ["the stall door (Back returns to the sending area)", "({ from: 'town', fromArea: 'meadow' })"],
    ["a locked swatch in a room (Back returns to that room)", "({ shelf: 'house', highlight: 'lounge_walls_starry', from: 'town', fromArea: 'boohouse', fromRoom: 'lounge' })"]
  ],
  // RUN18A H3: the Joke Boo has two doors, and Back must return her to the one she used.
  // The in-world stage says so; the hub card and What's New send nothing and get the hub.
  jokeboo: [
    ["in from the stage in the Meadow", "({ from: 'town' })"],
    ["in from the hub card (no params)", "({})"]
  ],
  expeditionpuzzle: [
    ["bridges", "({ node: 'bridges' })"], ["picnic", "({ node: 'picnic' })"],
    ["raft", "({ node: 'raft' })"], ["hotel", "({ node: 'hotel' })"],
    ["a stale/unknown node key falls back instead of throwing", "({ node: 'bridge' })"]
  ],
  'band-drums': [["record mode", "({ record: true })"]],
  'band-keys': [["a song", "({ song: 'twinkle' })"]],
  booroll: [["resume a course", "({ resume: { course: 'c1' } })"]],
  // RUN18E L1: the Toddler hub's restricted doors into Sound Sorter / Story Order.
  soundsorter: [["the Toddler door (initial sounds only)", "({ toddler: true })"]],
  storyorder: [["the Toddler door (two shortest stories)", "({ toddler: true })"]],
  rhymetime: [["the Toddler door (level 1, six sets)", "({ toddler: true })"]],
  blendit: [["the Toddler door (level 1, six words, light blend not the Factory)", "({ toddler: true })"]],
  echoboos: [
    ["resume standard", "({ resume: true, lightning: false })"],
    ["resume lightning", "({ resume: true, lightning: true })"]
  ],
  // "Jump back in" chip (js/hub.js:182) sends { resume: {cat, level, mix} } to any arcade game
  bubblepop: [["jump back in", "({ resume: { cat: 'add', level: 1, mix: false } })"], ["jump back in (mix)", "({ resume: { mix: true } })"]],
  dash:      [["jump back in", "({ resume: { cat: 'add', level: 1, mix: false } })"]],
  beat:      [["jump back in", "({ resume: { cat: 'tables', level: 1, mix: false } })"]],
  bounce:    [["jump back in", "({ resume: { cat: 'add', level: 1, mix: false } })"]],
  spellboo:  [["jump back in", "({ resume: { cat: null, level: 1, mix: true } })"]],
  feedboos:  [["jump back in", "({ resume: { cat: null, level: 1, mix: true } })"]],
  blocks:    [["jump back in", "({ resume: { cat: null, level: 1, mix: true } })"]],
  results: [
    ["arcade round with tricky items", "({ game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, level: 1, cat: 'add', mix: false, tricky: [{ id: 'x:1', game: 'bubblepop', prompt: '2 + 2', options: ['4','5','6'], answer: '4' }], replay: () => {} })"],
    ["mix round, no tricky", "({ game: 'dash', gameName: 'Smart Mix', stars: 3, level: null, cat: null, mix: true, tricky: [], replay: () => {} })"],
    ["golden round with a meter override", "({ game: 'golden', gameName: 'Golden Round', stars: 3, meterOverride: 4, golden: true, replay: () => {} })"],
    ["score game", "({ game: 'blocks', gameName: 'Boo Blocks', stars: 2, level: null, cat: null, mix: true, score: 1200, replay: () => {} })"],
    ["cosy bonus", "({ game: 'boopop', gameName: 'Boo Pop', stars: 2, level: 1, cat: 'pop', extraCosy: 1, replay: () => {} })"],
    ["toddler round", "({ game: 'tanimal', gameName: 'Animals', stars: 3, meterOverride: 2, replay: () => {} })"],
    // RUN12 S11: a round LEFT EARLY, banking what she had earned
    ["a round left early (banked)", "({ game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, level: 1, cat: 'add', mix: false, tricky: [], partial: { correct: 7, of: 10, stars: 2 }, replay: () => {} })"],
    // RUN16 W5: js/games/teachme.js has always passed `starType` and `recap`, but the key
    // scanner above cannot see a key that follows a trailing comment, so neither was ever
    // driven here. They are now — a lesson round, and a lesson replayed after mastery.
    ["a lesson round (pays Lesson Stars)", "({ game: 'teachme', gameName: 'Sounds in words', stars: 3, starType: 'lesson', replay: () => {} })"],
    ["a lesson recap after mastery (cosy award)", "({ game: 'teachme', gameName: 'Telling the time', stars: 3, starType: 'lesson', extraCosy: true, recap: true, replay: () => {} })"]
  ]
};
// Param names a fixture is not required to exercise separately (they only ever ride along
// with a shape already covered above).
const PARAM_ALIASES = { results: ['gameName', 'stars', 'level', 'cat', 'mix', 'tricky', 'replay', 'meterOverride', 'golden', 'score', 'extraCosy', 'game'] };

console.log('== the registry is readable from source ==');
assert(ROUTES.length >= 40, `parsed ${ROUTES.length} routes out of js/main.js's registry`);
assert(ROUTES.includes('town') && ROUTES.includes('hub') && ROUTES.includes('worldmap'), 'the parse found the known anchor routes');

console.log('== every params shape found in js/ has a fixture here ==');
for (const [route, keys] of [...seenParams].sort()) {
  if (!ROUTES.includes(route)) continue;          // go('hub') fallbacks etc.
  const fixtureSrc = (FIXTURES[route] || []).map(f => f[1]).join(' ');
  for (const key of keys) {
    if ((PARAM_ALIASES[route] || []).includes(key)) continue;
    assert(new RegExp('\\b' + key + '\\s*:').test(fixtureSrc),
      `${route}: source passes '${key}' and this suite drives it`);
  }
}

// ---- 4. drive everything --------------------------------------------------------------
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 2, boo_plum: 1, boo_mint: 1, boo_sky: 1, deco_palm: 2, deco_bench: 1, acc_bow: 1 },
  stars: { total: 400, byGame: { bubblepop: 30, dash: 20 } }, trophies: {}, boxes: 2,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 4 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const ctx = await browser.newContext();
const page = await ctx.newPage();
let bucket = [];
page.on('console', m => { if (m.type() === 'error') bucket.push('console: ' + m.text()); });
page.on('pageerror', e => bucket.push('pageerror: ' + e.message));
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
await page.addInitScript(() => {
  window.__unhandled = [];
  window.addEventListener('unhandledrejection', e => window.__unhandled.push(String(e.reason && e.reason.message || e.reason)));
});
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });

async function drive(route, label, expr) {
  bucket = [];
  await page.evaluate(() => { window.__unhandled = []; });
  // A mount that THROWS must be reported as a route failure, not abort the sweep — that is
  // exactly the failure mode this suite exists to catch.
  const threw = await page.evaluate(async ([r, e]) => {
    try {
      const params = e ? new Function('return (' + e + ')')() : {};
      await window.BooTown.go(r, params);
      return null;
    } catch (err) { return String(err && err.message || err); }
  }, [route, expr]);
  if (threw) bucket.push('threw: ' + threw);
  await page.waitForTimeout(650);
  // dismiss anything modal so the next mount starts clean
  await page.evaluate(() => {
    if (window.__intro) window.__intro.close();
    if (window.__wishwell) window.__wishwell.close();
    document.querySelectorAll('.overlay, .intro-overlay, .trophy-ceremony').forEach(o => o.remove());
  });
  const unhandled = await page.evaluate(() => window.__unhandled.slice());
  const problems = [...bucket, ...unhandled.map(u => 'unhandledrejection: ' + u)];
  assert(problems.length === 0, `${route} — ${label}${problems.length ? ' → ' + problems.slice(0, 2).join(' | ') : ''}`);
  // and it actually mounted something
  const mounted = await page.evaluate(() => !!document.querySelector('#screen')?.firstElementChild);
  assert(mounted, `${route} — ${label}: a screen is mounted`);
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForTimeout(250);
}

console.log('== every registry route mounts clean with no params ==');
for (const route of ROUTES) {
  if (route === 'onboarding') continue;   // needs the no-save path; covered by m2-onboard
  await drive(route, 'no params', null);
}

console.log('== every params shape a real caller uses mounts clean ==');
for (const [route, cases] of Object.entries(FIXTURES)) {
  for (const [label, expr] of cases) await drive(route, label, expr);
}

// ---- 5. the Wish Well instance, end to end -------------------------------------------
console.log('== the Wish Well card opens the well and closes back to the town ==');
{
  bucket = [];
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow', openWishWell: true }));
  await page.waitForTimeout(1400);
  const opened = await page.evaluate(() => ({
    overlay: !!document.querySelector('.wish-overlay'),
    hook: !!window.__wishwell,
    errors: (window.__unhandled || []).slice()
  }));
  assert(opened.overlay, 'the Today-rail card opens the Wish Well overlay from a cold load');
  assert(opened.hook, 'the well is live (window.__wishwell present)');
  assert(bucket.length === 0, 'zero console errors on the card route' + (bucket.length ? ' → ' + bucket[0] : ''));

  const spawned = await page.evaluate(() => window.__wishwell.spellInstant('star'));
  await page.waitForTimeout(500);
  assert(spawned !== false, 'the well accepts a spelled wish');
  // RUN18B Y3: a granted wish is a REAL PLACEMENT now, not a decorative `.wish-town-spawn`
  // that drifted beside the well for 20s and deleted itself. What this route check has
  // always cared about is that spelling a wish from the Today-rail card puts the thing in
  // her town — so it asks the save, which is where a kept thing lives.
  await page.waitForTimeout(500);
  const inTown = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    const items = ((s.town.areas.meadow || {}).items || []).map(i => i.item);
    return { placed: items.filter(i => i === 'wish_star').length, rendered: document.querySelectorAll('.t-item[data-item="wish_star"]').length };
  });
  assert(inTown.placed === 1 && inTown.rendered >= 1,
    `the wish ARRIVES in the town as a real placement she can keep (${inTown.placed} saved, ${inTown.rendered} rendered)`);

  await page.evaluate(() => window.__wishwell.close());
  await page.waitForTimeout(500);
  const closed = await page.evaluate(() => ({
    overlay: !!document.querySelector('.wish-overlay'),
    town: !!document.querySelector('.town2, .screen.town, .town-header'),
    hook: !!window.__wishwell
  }));
  assert(!closed.overlay && !closed.hook, 'the overlay closes cleanly');
  assert(closed.town, 'closing returns to the town scene');
  assert(bucket.length === 0, 'zero console errors across open → wish → close');
}

console.log('== tapping the well in the scene uses the same entry point ==');
{
  bucket = [];
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForTimeout(1200);
  const viaHook = await page.evaluate(() => window.__townLife.openWishWell());
  await page.waitForTimeout(700);
  assert(viaHook === true, 'the in-scene well reports itself present');
  assert(await page.evaluate(() => !!document.querySelector('.wish-overlay')), 'tapping the well opens the same overlay');
  await page.evaluate(() => window.__wishwell && window.__wishwell.close());
  await page.waitForTimeout(400);
  assert(bucket.length === 0, 'zero console errors on the in-scene route');
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
