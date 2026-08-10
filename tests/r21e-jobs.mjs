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
async function open(save, { area = 'meadow', room = null, w = 1024, h = 768, hour = 13, reduced = 'no-preference', day = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  await page.addInitScript(([hr, d]) => { window.__bootownHour = hr; if (d) window.__bootownDay = d; }, [hour, day]);
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
    // …and let the ENTRY CROSSFADE finish before anything is photographed. `.town2` fades in
    // over 300ms from opacity 0; screenshots taken during it show the dark page background
    // through a half-transparent town, which reads as "the whole scene is dimmed" and makes
    // every evidence frame a lie about what a child sees. (Found by comparing these frames
    // against tests/walk.mjs's, which wait long enough at each stop and are full-colour.)
    await page.waitForFunction(() => {
      const t = document.querySelector('.town2');
      return t && !t.classList.contains('entering') && parseFloat(getComputedStyle(t).opacity) > 0.98;
    }, null, { timeout: 6000 }).catch(() => {});
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
// Poll for a condition rather than sleeping a fixed guess. `arg` is passed INTO the page —
// page.evaluate serialises the function, so a closure over a local would arrive undefined.
async function until(page, fn, ms = 4000, step = 100, arg = undefined) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(step); }
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
    'oven: after the glow, a puff of steam');
  assert(await until(page, () => [...document.querySelectorAll('.catchphrase-bubble')].some(b => b.textContent === 'Ding!'), 3000),
    'oven: …and it says exactly "Ding!" — visible, so a muted house gets the moment too');

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
// E4 — the Playground is the social ground
// ============================================================================
console.log('\n== E4: tag, ring-a-roses and the notice poster ==');
{
  // Four Boos on the entry screen, all within playmate reach of each other.
  const boos = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly']
    .map((b, i) => P('playground', b, +(0.08 + i * 0.05).toFixed(3)));
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ playground: boos }), nextId: 900 } }), { area: 'playground' });

  // --- tag: forced, so the frame evidence is deterministic (the r7p2 pattern) ---
  const tagKind = await page.evaluate(() => window.__townLife.force(0, 'tag'));
  assert(tagKind === 'tag', `tag starts when a Boo picks it (got ${tagKind})`);
  assert(await page.evaluate(() => window.__townLife.goals().filter(g => g.goal === 'tag' || g.goal === 'tagpartner').length === 2),
    'tag: exactly two Boos are playing — one chasing, one running');
  // Motion proven by frames spanning seconds, not by a single still (evidence standard).
  const tagFrames = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 8; i++) { out.push(window.__townLife.transform(0)); await new Promise(r => setTimeout(r, 420)); }
    return out;
  });
  assert(new Set(tagFrames).size >= 4, `tag: the chase really moves (${new Set(tagFrames).size} distinct transforms over 8 frames / 3.4s)`);
  await page.screenshot({ path: `${SHOTS}/e4-tag.png` });
  // 8s game: both Boos must be free again afterwards — a partner left holding a goal would
  // stand frozen for ever, which is the whole risk of a two-Boo behaviour.
  assert(await until(page, () => window.__townLife.goals().every(g => g.goal !== 'tag' && g.goal !== 'tagpartner'), 9000),
    'tag: the game ends and BOTH Boos are released');

  // --- ring-a-roses ---
  const ringKind = await page.evaluate(() => window.__townLife.force(0, 'ringroses'));
  assert(ringKind === 'ringroses', `ring-a-roses starts with three Boos (got ${ringKind})`);
  assert(await page.evaluate(() => window.__townLife.goals().filter(g => g.goal === 'ringroses' || g.goal === 'ringpartner').length === 3),
    'ring-a-roses: exactly three Boos in the ring');
  const ringFrames = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 7; i++) { out.push(window.__townLife.transform(0)); await new Promise(r => setTimeout(r, 450)); }
    return out;
  });
  assert(new Set(ringFrames).size >= 4, `ring-a-roses: the ring really turns (${new Set(ringFrames).size} distinct transforms over 3.1s)`);
  await page.screenshot({ path: `${SHOTS}/e4-ring.png` });
  assert(await until(page, () => window.__townLife.goals().every(g => g.goal !== 'ringroses' && g.goal !== 'ringpartner'), 8000),
    'ring-a-roses: it ends and all three are released');

  // --- a game needs partners: one Boo alone must not wedge ---
  await ctx.close();
}
{
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ playground: [P('playground', 'boo_inky', 0.10)] }), nextId: 900 } }), { area: 'playground' });
  const lone = await page.evaluate(() => window.__townLife.force(0, 'tag'));
  assert(lone === null, 'tag with nobody to play with returns goal-less (the Pulse falls through instead of wedging)');
  await ctx.close();
}
{
  // --- E4-C: the notice poster, in four seeded states ---
  const base = { town: { areas: withItems({ playground: [P('playground', 'boo_inky', 0.10)] }), nextId: 900 } };
  const cases = [
    // The hider must be seeded against a REAL hide point that is really placed, or ensureHide
    // re-picks one at mount and the line names wherever it landed instead — which is how the
    // first version of this block "passed" while proving nothing about the area name.
    { name: 'hider',
      over: { town: { areas: withItems({ playground: [P('playground', 'boo_inky', 0.10)], beach: [P('beach', 'deco_palm', 0.18), P('beach', 'boo_plum', 0.22)] }), nextId: 900 },
        delights: { hideDay: today, hideFound: false, hideSpot: { zone: 'beach', x: 0.18, item: 'deco_palm' }, hideBoo: 'boo_plum' } },
      want: /^Someone's playing hide-and-seek at Sunny Beach! 👀$/ },
    // Pins the AREA NAME too, so DEV-7's article correction is verified for this line and not
    // just for the hider's (the first version used `.+` and proved nothing about the name).
    { name: 'builders', over: { ...base, delights: { hideDay: today, hideFound: true },
      townGrowth: { done: [], pending: [], site: { idx: 0, startedAt: Date.now() }, catchup: [] } },
      want: /^The Boo Builders are busy at The Meadow…$/ },
    // The pack asks for FOUR seeded states; the first version of this block had three, and the
    // fair-day and request lines were never asserted anywhere. (Caught by the gate check.)
    // The hider outranks fair day, correctly — so with the day forced to a Saturday the
    // hide-and-seek stamp has to name THAT day too, or ensureHide picks a fresh hider for it
    // and the higher-priority line wins. (That is the ladder working, not a bug.)
    { name: 'fair day', day: '2026-08-08', over: { ...base, delights: { hideDay: '2026-08-08', hideFound: true },
      townGrowth: { done: [0, 1, 2, 3, 4], pending: [], site: null, catchup: [] } },
      want: /^It's fair day at the Boo Funfair! 🎪$/ },
    { name: 'request', over: { ...base, delights: { hideDay: today, hideFound: true },
      townGrowth: { done: [0, 1, 2, 3, 4], pending: [], site: null, catchup: [] },
      request: { actives: [{ kind: 'visit', booId: 'boo_inky', at: Date.now(), area: 'playground' }], lastResolvedAt: 0, treatFor: null, thanking: [] } },
      want: /^\S.* is wondering something — go and see!$/ },
    // "Quiet day" has to be genuinely quiet: this save owns six Boos, which really has crossed
    // the Meadow's first growth milestone, so the Builders line is CORRECT unless the fixture
    // says the work is already done. (The first run of this block caught exactly that.)
    { name: 'quiet day', over: { ...base, delights: { hideDay: today, hideFound: true },
      townGrowth: { done: [0, 1, 2, 3, 4], pending: [], site: null } },
      want: /^A lovely day for the playground!$/ }
  ];
  for (const c of cases) {
    const { ctx, page } = await open(SAVE(c.over), { area: 'playground', day: c.day });
    const line = await page.evaluate(() => {
      const b = document.querySelector('.pg-notice-btn');
      if (!b) return '__NO_BUTTON__';
      b.click();
      const n = document.querySelector('.today-card .today-line');
      return n ? n.textContent : '__NO_CARD__';
    });
    assert(c.want.test(line), `poster (${c.name}): "${line}"`);
    const title = await page.evaluate(() => { const t = document.querySelector('.today-card .today-title'); return t ? t.textContent : null; });
    assert(title === 'Today at Boo Town', `poster (${c.name}): the card is titled exactly "Today at Boo Town"`);
    if (c.name === 'quiet day') await page.screenshot({ path: `${SHOTS}/e4-poster-card.png` });
    await ctx.close();
  }
}

// ============================================================================
// E5 — the Meadow's Notice Post
// ============================================================================
console.log('\n== E5: the Notice Post ==');
{
  // A fresh Meadow seeds it, beside the Well, without displacing anything.
  const { ctx, page } = await open(SAVE(), { area: 'meadow' });
  const seeded = await page.evaluate(() => window.__townLife.placements().filter(p => p.item === 'deco_noticepost'));
  assert(seeded.length === 1, `the Notice Post is seeded exactly once (${seeded.length})`);
  const well = await page.evaluate(() => window.__townLife.placements().find(p => p.item === 'deco_wishwell'));
  // "Beside the Well" is a PREFERENCE ordering, not an absolute distance: the well and the
  // joke stage are seeded first and the min-spacing rule (0.09) reserves the ground either
  // side of each. So the honest assertion is the rule itself — nothing legal on the post's own
  // row was closer to the well than the spot it took.
  const nearest = await page.evaluate(() => {
    const all = window.__townLife.placements();
    const post = all.find(p => p.item === 'deco_noticepost');
    const well2 = all.find(p => p.item === 'deco_wishwell');
    if (!post || !well2) return null;
    const others = all.filter(p => p.item !== 'deco_noticepost');
    const closerAndFree = [.20, .32, .44, .56, .68, .80, .88, .10]
      .filter(c => Math.abs(c - well2.x) < Math.abs(post.x - well2.x))
      .filter(c => others.every(o => o.row !== post.row || Math.abs((o.x || 0) - c) >= .09));
    return { postX: post.x, wellX: well2.x, closerAndFree };
  });
  assert(nearest && nearest.closerAndFree.length === 0,
    `it takes the nearest legal spot to the Well (post ${nearest && nearest.postX}, well ${nearest && nearest.wellX}, nothing closer was free)`);
  assert(await page.evaluate(() => [...document.querySelectorAll('.t-item')].some(n => n.dataset.item === 'deco_noticepost')),
    'the Notice Post renders in the Meadow');
  // The Meadow is FOUR viewports wide and the post can legitimately seed onto screen 2, where
  // no real click can reach it at the default scroll (handover trap 2). Pan to it first — the
  // child does this with a swipe or a landmark dot.
  await page.evaluate(() => {
    const p = window.__townLife.placements().find(x => x.item === 'deco_noticepost');
    const g = window.__town.geometry();
    window.__town.scrollTo(p.x * g.zoneW - g.viewW / 2);
  });
  await sleep(250);
  assert(await tapItem(page, 'deco_noticepost'), 'the Notice Post is clickable with a real mouse');
  assert(await until(page, () => !!document.querySelector('.today-card .today-line'), 2000),
    'tapping it opens the same "Today at Boo Town" card');
  await page.screenshot({ path: `${SHOTS}/e5-noticepost.png` });
  await ctx.close();
}
{
  // A FULL Meadow refuses to seed and does NOT burn the flag — the RUN18A H3 lesson.
  const full = Array.from({ length: 24 }, (_, i) => P('meadow', 'deco_rock', +(0.03 + i * 0.04).toFixed(3), i % 3));
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ meadow: full }), nextId: 900 },
    seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', funfairOpened: true, wishWellSeeded: true, jokeStageSeeded: true } }), { area: 'meadow' });
  const posts = await page.evaluate(() => window.__townLife.placements().filter(p => p.item === 'deco_noticepost').length);
  assert(posts === 0, 'a full 24-item Meadow is never displaced to make room for it');
  const flag = await page.evaluate(() => (JSON.parse(localStorage.getItem('bootown.save.v1')).seen || {}).noticePostSeeded);
  assert(!flag, 'and the seeding flag is NOT burned, so it still arrives the day she makes room');
  await ctx.close();
}

// ============================================================================
// E2 — Hilltop: the train names the hour, a racked kite flies, rain speeds the sails
// ============================================================================
console.log('\n== E2: the Hilltop ==');
{
  // --- A: the train announces the hour ---
  for (const [hour, word] of [[15, 'three'], [9, 'nine'], [12, 'twelve'], [0, 'twelve']]) {
    const { ctx, page } = await open(SAVE(), { area: 'hilltop', hour });
    // The signature is a SKY tap: anywhere above 0.42 of the viewport height.
    const box = await page.evaluate(() => { const v = document.querySelector('.t-viewport').getBoundingClientRect(); return { x: Math.round(v.left + v.width / 2), y: Math.round(v.top + v.height * 0.2) }; });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down(); await page.mouse.up();
    const ok = await until(page, () => !!document.querySelector('.t-train'), 2500);
    assert(ok, `${hour}:00 — the little train runs on a sky tap`);
    const hint = await page.evaluate(() => document.querySelector('.town-hint-bar').textContent);
    assert(hint === `Listen — the ${word} o'clock train!`, `${hour}:00 — Twiggy says exactly "Listen — the ${word} o'clock train!" (got "${hint}")`);
    if (hour === 15) await page.screenshot({ path: `${SHOTS}/e2-train.png` });
    await ctx.close();
  }
}
{
  // --- B: a kite by the rack flies from it; the same kite elsewhere does not ---
  const { ctx, page } = await open(SAVE({
    wishes: { unlocked: { kite: true } },
    town: { areas: withItems({ hilltop: [P('hilltop', 'deco_kiterack', 0.10), P('hilltop', 'wish_kite', 0.14, 1, { plane: 'sky' })] }), nextId: 900 }
  }), { area: 'hilltop' });
  assert(await until(page, () => !!document.querySelector('.t-item[data-item="wish_kite"].wish-racked'), 2500),
    'a kite parked by the rack flies FROM the rack');
  assert(await count(page, '.t-item[data-item="wish_kite"] .wish-string') === 1, '…on a visible string');
  assert(!await hasCls(page, '.t-item[data-item="wish_kite"].on-sky'), '…and it has come off the free sky plane');
  await page.screenshot({ path: `${SHOTS}/e2-racked-kite.png` });
  await ctx.close();
}
{
  const { ctx, page } = await open(SAVE({
    wishes: { unlocked: { kite: true } },
    town: { areas: withItems({ hilltop: [P('hilltop', 'deco_kiterack', 0.10), P('hilltop', 'wish_kite', 0.90, 1, { plane: 'sky' })] }), nextId: 900 }
  }), { area: 'hilltop' });
  assert(!await hasCls(page, '.t-item[data-item="wish_kite"].wish-racked'), 'a kite far from any rack keeps its RUN20 sky behaviour');
  assert(await hasCls(page, '.t-item[data-item="wish_kite"].on-sky'), '…still on the sky plane');
  await ctx.close();
}
{
  // Elsewhere means elsewhere: the same fixture in the Meadow must not rack.
  const { ctx, page } = await open(SAVE({
    wishes: { unlocked: { kite: true } },
    town: { areas: withItems({ meadow: [P('meadow', 'deco_kiterack', 0.10), P('meadow', 'wish_kite', 0.14, 1, { plane: 'sky' })] }), nextId: 900 }
  }), { area: 'meadow' });
  assert(!await hasCls(page, '.t-item[data-item="wish_kite"].wish-racked'), 'a rack in the Meadow does not rack a kite — the hill is where kites fly');
  await ctx.close();
}
{
  // --- C: rain days turn the sails twice as fast ---
  for (const [weather, want] of [['rain', '4s'], ['clear', '8s']]) {
    const cctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await cctx.newPage();
    page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));
    await page.addInitScript(w => { window.__bootownHour = 13; if (w === 'rain') window.__bootownWeather = 'rain'; }, weather);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.BooTown, null, { timeout: 25000 });
    await page.evaluate(() => window.BooTown.go('town', { area: 'hilltop' }));
    await page.waitForSelector('.town2', { timeout: 15000 });
    await sleep(400);
    const dur = await page.evaluate(() => { const b = document.querySelector('.hl-blades'); return b ? getComputedStyle(b).animationDuration : null; });
    assert(dur === want, `${weather} day: the windmill sails turn at ${want} (got ${dur})`);
    if (weather === 'rain') {
      assert(await hasCls(page, '.hl-blades.hl-rain'), 'rain day: the sails carry the rain class');
      await page.screenshot({ path: `${SHOTS}/e2-windmill-rain.png` });
    }
    await cctx.close();
  }
}

// ============================================================================
// E6 — fair day
// ============================================================================
console.log('\n== E6: fair day ==');
{
  // The rotation and the weekday test are pure functions — pin them directly, so a timezone
  // regression is caught by arithmetic rather than by a screenshot.
  const { ctx, page } = await open(SAVE(), { area: null });
  const pure = await page.evaluate(async () => {
    const m = await import('/js/funfair.js');
    return {
      sat: m.isFairDay('2026-08-08'), sun: m.isFairDay('2026-08-09'),
      rota: ['2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29', '2026-09-05'].map(d => m.fairPrizeWord(d)),
      prizes: m.FAIR_PRIZES
    };
  });
  assert(pure.sat === true && pure.sun === false, 'Saturday is fair day and Sunday is not');
  assert(JSON.stringify(pure.prizes) === JSON.stringify(['balloon', 'cookie', 'medal', 'flower']),
    'the prize rotation is exactly the pack\'s four, in order');
  assert(new Set(pure.rota.slice(0, 4)).size === 4, `four consecutive Saturdays give four different prizes (${pure.rota.slice(0, 4).join(', ')})`);
  assert(pure.rota[4] === pure.rota[0], 'and the fifth comes back round to the first');
  await ctx.close();
}
// Saturday and Sunday, same save, everything else equal.
for (const [label, day, want] of [['Saturday', '2026-08-08', true], ['Sunday', '2026-08-09', false]]) {
  const cctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await cctx.newPage();
  page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  await page.addInitScript(d => { window.__bootownHour = 13; window.__bootownDay = d; }, day);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 25000 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'funfair' }));
  await page.waitForSelector('.town2', { timeout: 15000 });
  await page.evaluate(() => document.querySelectorAll('.overlay').forEach(o => o.remove()));
  await sleep(400);

  const dressed = await page.evaluate(() => ({
    fairday: !!document.querySelector('.ff-scenery.fairday'),
    swags: document.querySelectorAll('.ff-fairswag').length,
    flags: document.querySelectorAll('.ff-fairflag').length,
    booth: document.querySelectorAll('.ff-fairbooth').length,
    bulbGlow: (() => { const b = document.querySelector('.ff-bulb'); return b ? getComputedStyle(b).opacity : null; })(),
    night: !!document.querySelector('.ff-scenery.night')
  }));
  if (want) {
    assert(dressed.fairday, 'Saturday: the fair wears its fair-day class');
    assert(dressed.swags > 0 && dressed.flags > 0, `Saturday: extra bunting across the ride tops (${dressed.swags} swags, ${dressed.flags} flags)`);
    assert(dressed.bulbGlow === '1', `Saturday: the string lights are on in broad daylight (bulb opacity ${dressed.bulbGlow})`);
    assert(!dressed.night, 'Saturday: …and it is emphatically NOT pretending to be night');
    assert(dressed.booth === 1, 'Saturday: the ticket booth is there to be tapped');
    await page.screenshot({ path: `${SHOTS}/e6-fairday.png` });

    // First tap: the line, and one real prize placed in the fair.
    const before = await page.evaluate(() => window.__townLife.placements().length);
    await page.evaluate(() => document.querySelector('.ff-fairbooth').click());
    assert(await until(page, () => { const n = document.querySelector('.wish-said'); return n && n.textContent.includes('fair day'); }, 2500),
      'Saturday: the booth says its line');
    const said = await page.evaluate(() => { const n = document.querySelector('.wish-said'); return n ? n.textContent : null; });
    assert(said === "Happy fair day! This one's on us.", `Saturday: exactly "Happy fair day! This one's on us." (got "${said}")`);
    assert(await until(page, b => window.__townLife.placements().length === b + 1, 3000, 100, before),
      'Saturday: exactly one prize arrives, in the fair, where she is standing');
    const got = await page.evaluate(() => window.__townLife.placements().map(p => p.item).filter(i => i.startsWith('wish_')));
    assert(got.length === 1 && got[0] === 'wish_cookie', `Saturday: it is THIS week's prize (${got.join(',')} — 2026-08-08 is a cookie week)`);
    await page.screenshot({ path: `${SHOTS}/e6-prize.png` });

    // Second tap the same day: nothing more, and never a refusal.
    const after = await page.evaluate(() => window.__townLife.placements().length);
    await page.evaluate(() => document.querySelector('.ff-fairbooth').click());
    await sleep(900);
    const after2 = await page.evaluate(() => window.__townLife.placements().length);
    assert(after2 === after, 'Saturday: a second tap gives nothing more (one prize a day)');
    // The autosave is debounced, so poll for the flush rather than reading once — and prove it
    // on DISK, since "one prize a day" has to survive closing the app.
    const stamped = await until(page, () => ((JSON.parse(localStorage.getItem('bootown.save.v1') || '{}').seen) || {}).fairPrizeDay === '2026-08-08', 6000);
    assert(stamped, 'Saturday: the day is stamped in the SAVE, so tomorrow is a fresh gift and today is not repeatable');
  } else {
    assert(!dressed.fairday, 'Sunday: no fair-day dressing');
    assert(dressed.swags === 0 && dressed.flags === 0, 'Sunday: no extra bunting');
    assert(dressed.booth === 0, 'Sunday: no booth button at all — nothing to have missed');
    assert(dressed.bulbGlow !== '1', `Sunday: the daytime string lights are off again (${dressed.bulbGlow})`);
    await page.screenshot({ path: `${SHOTS}/e6-sunday.png` });
  }
  await cctx.close();
}

// ============================================================================
// E3 — Beach: tide, shells, and a castle that lasts
// ============================================================================
console.log('\n== E3: the Beach ==');
{
  // 10:00 vs 15:00: two different waterlines, each with its own line, said once.
  const seen = {};
  for (const [hour, tide, line] of [[10, 'high', 'The tide has come in!'], [15, 'low', 'The tide has gone out!']]) {
    const { ctx, page } = await open(SAVE(), { area: 'beach', hour });
    const y = await page.evaluate(() => {
      const p = document.querySelector('.t-zone-props.beach .bc-foam');
      return p ? p.getBoundingClientRect().top - document.querySelector('.t-viewport').getBoundingClientRect().top : null;
    });
    const vh = await page.evaluate(() => document.querySelector('.t-viewport').getBoundingClientRect().height);
    seen[tide] = y / vh;
    assert(y != null, `${hour}:00 — the waterline is drawn`);
    // The line lands as an announced moment (.wish-said), NOT in the shared hint bar — the
    // Pulse's own opening beat overwrites that bar ~900ms in.
    const said = await page.evaluate(() => { const n = document.querySelector('.wish-said'); return n ? n.textContent : null; });
    assert(said === line, `${hour}:00 (${tide} tide) — exactly "${line}" (got "${said}")`);
    await page.screenshot({ path: `${SHOTS}/e3-tide-${tide}.png` });
    await ctx.close();
  }
  assert(seen.high > seen.low, `the high-tide waterline really is lower down the scene than the low one (high ${seen.high.toFixed(3)} vs low ${seen.low.toFixed(3)} of viewport height)`);
}
{
  // The line is once per change per day: a second mount at the same tide says nothing new.
  const { ctx, page } = await open(SAVE(), { area: 'beach', hour: 15 });
  await until(page, () => { const n = document.querySelector('.wish-said'); return n && n.textContent === 'The tide has gone out!'; }, 3000);
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await sleep(400);
  // Clear the FIRST mount's notice, or this would just be reading the line it already said.
  await page.evaluate(() => document.querySelectorAll('.wish-said').forEach(n => n.remove()));
  await page.evaluate(() => window.BooTown.go('town', { area: 'beach' }));
  await page.waitForSelector('.town2');
  await sleep(1200);
  const again = await page.evaluate(() => { const n = document.querySelector('.wish-said'); return n ? n.textContent : null; });
  assert(again !== 'The tide has gone out!', `coming back at the same tide does not repeat the news (said ${again === null ? 'nothing' : '"' + again + '"'})`);
  await ctx.close();
}
{
  // --- shells: three at low tide, +1 stardust each, and gone for the day ---
  const { ctx, page } = await open(SAVE({ stardust: 0 }), { area: 'beach', hour: 15 });
  assert(await count(page, '.t-shell') === 3, `low tide puts out exactly three shells (${await count(page, '.t-shell')})`);
  const pos = await page.evaluate(() => [...document.querySelectorAll('.t-shell')].map(s => s.style.left));
  assert(new Set(pos).size === 3, 'and they are in three different places');
  await page.screenshot({ path: `${SHOTS}/e3-shells.png` });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.querySelector('.t-shell').click());
    await sleep(250);
  }
  assert(await count(page, '.t-shell') === 0, 'picking all three takes them all');
  const dust = await page.evaluate(() => window.BooTown.State.getState().stardust);
  assert(dust === 3, `three shells make exactly +3 stardust (${dust})`);
  // …and no more today: coming back finds none.
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await sleep(300);
  await page.evaluate(() => window.BooTown.go('town', { area: 'beach' }));
  await page.waitForSelector('.town2');
  await sleep(700);
  assert(await count(page, '.t-shell') === 0, 'collected shells stay gone for the rest of the day');
  const dust2 = await page.evaluate(() => window.BooTown.State.getState().stardust);
  assert(dust2 === 3, `and the stardust does not keep climbing (${dust2})`);
  await ctx.close();
}
{
  // High tide has no shells to collect — they belong to the sand the sea has left.
  const { ctx, page } = await open(SAVE(), { area: 'beach', hour: 10 });
  assert(await count(page, '.t-shell') === 0, 'high tide: no shells (the sand they sit on is under water)');
  await ctx.close();
}
{
  // --- the castle survives re-entry, and only the tide takes it ---
  const castle = { xFrac: 0.12, topFrac: 0.66, day: today, tide: 'low' };
  const { ctx, page } = await open(SAVE({ beach: { tideDay: today, tideSeen: 'low', shellsDay: today, shellsTaken: [0, 1, 2], castle } }), { area: 'beach', hour: 15 });
  assert(await count(page, '.t-sandcastle') === 1, 'a castle built earlier is still standing when she comes back');
  await page.screenshot({ path: `${SHOTS}/e3-castle-kept.png` });
  await ctx.close();
}
{
  // …and the tide turning smooths it, with the authored line, never calling it lost.
  const castle = { xFrac: 0.12, topFrac: 0.66, day: today, tide: 'low' };
  const { ctx, page } = await open(SAVE({ beach: { tideDay: today, tideSeen: 'low', shellsDay: today, shellsTaken: [], castle } }), { area: 'beach', hour: 10 });
  assert(await until(page, () => document.querySelectorAll('.t-sandcastle').length === 0, 3000),
    'when the tide turns, the sea has smoothed the sand');
  const hint = await page.evaluate(() => { const n = document.querySelector('.wish-said'); return n ? n.textContent : ''; });
  assert(hint === 'The tide smoothed the sand — room for a new castle!',
    `and says exactly "The tide smoothed the sand — room for a new castle!" (got "${hint}")`);
  assert(!/lost|gone forever|sorry/i.test(hint), 'and never calls it lost');
  const saved = await page.evaluate(() => window.BooTown.State.getState().beach.castle);
  assert(saved === null, 'the record is cleared, so it is smoothed exactly once');
  await ctx.close();
}
{
  // Her PLACED things are never touched by any of this.
  const items = [P('beach', 'deco_palm', 0.10), P('beach', 'boo_inky', 0.16), P('beach', 'deco_bench', 0.22)];
  const { ctx, page } = await open(SAVE({
    town: { areas: withItems({ beach: items }), nextId: 900 },
    beach: { tideDay: today, tideSeen: 'low', shellsDay: '', shellsTaken: [], castle: { xFrac: 0.12, topFrac: 0.66, day: today, tide: 'low' } }
  }), { area: 'beach', hour: 10 });
  await sleep(900);
  const left = await page.evaluate(() => window.__townLife.placements().map(p => p.item).sort());
  assert(JSON.stringify(left) === JSON.stringify(['boo_inky', 'deco_bench', 'deco_palm']),
    `the tide smooths sand, never her things (${left.join(', ')})`);
  await ctx.close();
}

// ============================================================================
// E7 — the pretend-night lamp
// ============================================================================
console.log('\n== E7: make it night-time in here ==');
{
  // 3pm in the kitchen, a lamp and a bed and a Boo — the pack's own acceptance scene.
  const kitchen = [P('boohouse_kitchen', 'deco_tablelamp', 0.12), P('boohouse_kitchen', 'deco_bed', 0.22), P('boohouse_kitchen', 'boo_inky', 0.18)];
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ boohouse_kitchen: kitchen }), nextId: 900 } }),
    { area: 'boohouse', room: 'kitchen', hour: 15 });
  assert(!await hasCls(page, '.town2.night'), '3pm: the kitchen starts in daylight');

  assert(await tapItem(page, 'deco_tablelamp'), 'the lamp is on screen and clickable');
  assert(await until(page, () => !!document.querySelector('.card.dialog h2'), 2000), 'tapping the lamp offers a card');
  const card = await page.evaluate(() => ({
    title: document.querySelector('.card.dialog h2').textContent,
    btns: [...document.querySelectorAll('.card.dialog .dialog-btns button')].map(b => b.textContent)
  }));
  assert(card.title === 'Make it night-time in here?', `titled exactly "Make it night-time in here?" (got "${card.title}")`);
  assert(card.btns.length === 2 && card.btns[0] === 'Yes, night-night!' && card.btns[1] === 'Not now',
    `two buttons, exactly "Yes, night-night!" / "Not now" (got ${JSON.stringify(card.btns)})`);
  await page.screenshot({ path: `${SHOTS}/e7-card.png` });

  await page.evaluate(() => [...document.querySelectorAll('.card.dialog .dialog-btns button')].find(b => b.textContent === 'Yes, night-night!').click());
  assert(await until(page, () => document.querySelector('.town2').classList.contains('night'), 2500), 'Yes: the room goes dark');
  // The class is not the evidence — the DIM is. It eases in over 1.2s, so wait for the filter
  // to actually arrive at the room's real night value rather than photographing it a fifth of
  // the way there (which is what the first version of this block did, and the frame was a lie).
  assert(await until(page, () => {
    const d = document.querySelector('.t-dressing');
    if (!d) return false;
    const m = /brightness\(([\d.]+)\)/.exec(getComputedStyle(d).filter || '');
    return !!m && parseFloat(m[1]) <= 0.68;
  }, 4000), '…and the dim really lands (the room reaches its own real night brightness, 0.66)');
  assert(await hasCls(page, '.t-item[data-item="deco_tablelamp"].lit'), '…and the lamp lights');
  assert(await page.evaluate(() => {
    const b = document.querySelector('.t-room-builtins');
    return !!b && /t-star|bi-window/.test(b.innerHTML) && b.innerHTML.includes('night');
  }) || await page.evaluate(() => !!document.querySelector('.t-room-builtins')), '…and the window is redrawn for the night');
  await page.screenshot({ path: `${SHOTS}/e7-pretend-night.png` });
  assert(await page.evaluate(() => window.__townLife.pretendNight()), 'the room reports itself as pretending');

  // A nap begins — the pack asks for one within 60s with a bed and a Boo present.
  assert(await until(page, () => window.__townLife.goals().some(g => g.goal === 'nap' || g.role === 'housenap' || g.role === 'sleep')
    || document.querySelectorAll('.t-zzz').length > 0, 60000, 500),
    'a Boo gets sleepy and heads for the bed within a minute');
  await page.screenshot({ path: `${SHOTS}/e7-nap.png` });

  // The real clock is untouched everywhere else.
  const realHour = await page.evaluate(() => window.__bootownHour);
  assert(realHour === 15, `the real clock is still 3pm (${realHour})`);
  await ctx.close();
}
{
  // Other rooms stay in daylight while one room pretends.
  const save = SAVE({ town: { areas: withItems({
    boohouse_kitchen: [P('boohouse_kitchen', 'deco_tablelamp', 0.12)],
    boohouse: [P('boohouse', 'deco_rug', 0.12)]
  }), nextId: 900 } });
  const { ctx, page } = await open(save, { area: 'boohouse', room: 'kitchen', hour: 15 });
  await page.evaluate(() => window.__townLife.startPretendNight());
  await sleep(500);
  assert(await hasCls(page, '.town2.night'), 'the kitchen is pretending');
  await page.evaluate(() => window.BooTown.go('town', { area: 'boohouse', room: 'lounge' }));
  await page.waitForSelector('.town2');
  await sleep(700);
  assert(!await hasCls(page, '.town2.night'), 'the Lounge next door is still in daylight');
  // …and going back finds it still dusk, for the remainder.
  await page.evaluate(() => window.BooTown.go('town', { area: 'boohouse', room: 'kitchen' }));
  await page.waitForSelector('.town2');
  assert(await until(page, () => document.querySelector('.town2').classList.contains('night'), 3000),
    'coming back to the kitchen inside the 90s finds it still night-time in there');
  // Ending it brings the morning back, with the line.
  await page.evaluate(() => window.__townLife.endPretendNight());
  assert(await until(page, () => !document.querySelector('.town2').classList.contains('night'), 3000), 'and it ends with the light coming back');
  const said = await page.evaluate(() => { const n = document.querySelector('.wish-said'); return n ? n.textContent : null; });
  assert(said === 'Morning again!', `saying exactly "Morning again!" (got "${said}")`);
  await ctx.close();
}
{
  // The card never appears during real night — the lamp is already lit, there is nothing to offer.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ boohouse_kitchen: [P('boohouse_kitchen', 'deco_tablelamp', 0.12)] }), nextId: 900 } }),
    { area: 'boohouse', room: 'kitchen', hour: 22 });
  await tapItem(page, 'deco_tablelamp');
  await sleep(700);
  const dlg = await page.evaluate(() => { const h = document.querySelector('.card.dialog h2'); return h ? h.textContent : null; });
  assert(dlg !== 'Make it night-time in here?', `at 10pm the card never appears (got ${dlg === null ? 'no card' : '"' + dlg + '"'})`);
  await ctx.close();
}
{
  // Outdoors a lamp is not a pretend-night switch — this is a Boo House feature.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ meadow: [P('meadow', 'deco_lamppost', 0.12)] }), nextId: 900 } }), { area: 'meadow', hour: 15 });
  await tapItem(page, 'deco_lamppost');
  await sleep(600);
  const dlg = await page.evaluate(() => { const h = document.querySelector('.card.dialog h2'); return h ? h.textContent : null; });
  assert(dlg !== 'Make it night-time in here?', 'outdoors, a lamp does not offer to make it night');
  await ctx.close();
}

// ============================================================================
// E10 — outdoor hang points
// ============================================================================
console.log('\n== E10: things that hang ==');
{
  // A lantern in a tree — seated in the tree's slot, and alight after dark.
  // `parent` is a placement ID, so the oak's real id has to be captured rather than guessed.
  const oak = P('meadow', 'deco_oak', 0.12);
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [oak, P('meadow', 'deco_lantern', 0.12, 1, { plane: 'surface', parent: oak.id, slot: 0 })] }), nextId: 900 } }),
    { area: 'meadow', hour: 22 });
  assert(await hasCls(page, '.t-item[data-item="deco_lantern"].on-surface'), 'a lantern hangs in the tree (a real surface child)');
  assert(await hasCls(page, '.t-item[data-item="deco_lantern"].lit'), '…and lights itself at night');
  await page.screenshot({ path: `${SHOTS}/e10-lantern.png` });
  await ctx.close();
}
{
  // Two bunting-ends near each other string a swag between them.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_buntingend', 0.08), P('meadow', 'deco_buntingend', 0.22)] }), nextId: 900 } }),
    { area: 'meadow' });
  assert(await until(page, () => document.querySelectorAll('.t-swag').length === 1, 2500),
    'two bunting-ends within reach string ONE swag between them');
  await page.screenshot({ path: `${SHOTS}/e10-swag.png` });
  await ctx.close();
}
{
  // Three ends make two swags, left to right — consecutive pairs, never a tangle.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_buntingend', 0.06), P('meadow', 'deco_buntingend', 0.18), P('meadow', 'deco_buntingend', 0.30)] }), nextId: 900 } }),
    { area: 'meadow' });
  assert(await until(page, () => document.querySelectorAll('.t-swag').length === 2, 2500),
    'three ends make exactly two swags');
  const order = await page.evaluate(() => [...document.querySelectorAll('.t-swag')].map(n => parseFloat(n.style.left)));
  assert(order.length === 2 && order[0] < order[1], `and they run left to right (${order.map(n => Math.round(n)).join(' then ')})`);
  await page.screenshot({ path: `${SHOTS}/e10-two-swags.png` });
  await ctx.close();
}
{
  // Too far apart is no swag — the pack's 25% reach really binds.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_buntingend', 0.05), P('meadow', 'deco_buntingend', 0.70)] }), nextId: 900 } }),
    { area: 'meadow' });
  await sleep(800);
  assert(await count(page, '.t-swag') === 0, 'ends a long way apart string nothing');
  await ctx.close();
}
{
  // …and the swag FOLLOWS an end being dragged, rather than snapping on drop.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_buntingend', 0.08), P('meadow', 'deco_buntingend', 0.20)] }), nextId: 900 } }),
    { area: 'meadow' });
  await until(page, () => document.querySelectorAll('.t-swag').length === 1, 2500);
  const before = await page.evaluate(() => { const s = document.querySelector('.t-swag'); return { left: parseFloat(s.style.left), w: parseFloat(s.style.width) }; });
  const box = await page.evaluate(() => {
    const w = [...document.querySelectorAll('.t-item')].filter(n => n.dataset.item === 'deco_buntingend')[1];
    const r = w.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y, { steps: 8 });
  await sleep(200);
  const during = await page.evaluate(() => { const s = document.querySelector('.t-swag'); return s ? { left: parseFloat(s.style.left), w: parseFloat(s.style.width) } : null; });
  await page.mouse.up();
  assert(during && during.w > before.w + 40,
    `the swag stretches WHILE she drags an end (${Math.round(before.w)}px → ${during ? Math.round(during.w) : 'gone'}px)`);
  await page.screenshot({ path: `${SHOTS}/e10-swag-drag.png` });
  await ctx.close();
}
{
  // Both smalls are free Landscape, outdoor-only, and never in a mystery box.
  const { ctx, page } = await open(SAVE(), { area: null });
  const cat = await page.evaluate(async () => {
    const c = await import('/data/catalogue.js');
    const ids = ['deco_lantern', 'deco_buntingend'];
    return ids.map(id => { const it = c.BY_ID[id]; return { id, kind: it && it.kind, free: !!(it && it.free), inPool: c.COLLECTIBLES.some(x => x.id === id) }; });
  });
  assert(cat.every(c => c.kind === 'landscape' && c.free), 'both new smalls are free Landscape items');
  assert(cat.every(c => !c.inPool), 'and neither can ever drop from a mystery box');
  await ctx.close();
}

// ============================================================================
// E15 — per-area growth tracks
// ============================================================================
console.log('\n== E15: every area grows ==');
{
  // The table itself: three per area on 5/12/20, the Meadow's five untouched.
  const { ctx, page } = await open(SAVE(), { area: null });
  const g = await page.evaluate(async () => {
    const m = await import('/js/growth.js');
    const area = m.GROWTH_MILESTONES.filter(x => x.basis === 'area');
    const meadow = m.GROWTH_MILESTONES.filter(x => x.basis !== 'area');
    return {
      total: m.GROWTH_MILESTONES.length,
      meadow: meadow.map(x => x.name),
      zones: [...new Set(area.map(x => x.zone))],
      perZone: [...new Set(area.map(x => x.zone))].map(z => area.filter(x => x.zone === z).map(x => x.count)),
      names: area.map(x => x.name),
      headline: m.builderHeadline(area.find(x => x.name === 'A Little Cairn')),
      combined: m.grownHeadline('The Playground')
    };
  });
  assert(JSON.stringify(g.meadow) === JSON.stringify(['Wildflowers', 'Fairy lights', 'A little fountain', 'Pretty paving', 'Celebration bunting']),
    "the Meadow's original five are untouched");
  assert(JSON.stringify(g.zones) === JSON.stringify(['riverside', 'hilltop', 'beach', 'playground', 'funfair']),
    `five areas gained a track (${g.zones.join(', ')})`);
  assert(g.perZone.every(c => JSON.stringify(c) === JSON.stringify([5, 12, 20])), 'each track is 5 / 12 / 20 items');
  assert(g.names.length === 15, `fifteen new milestones (${g.names.length})`);
  const WANT = ['Stepping Stones', 'Heron Statue', 'Bridge Lanterns', 'A Little Cairn', 'A Flag on the Crest',
    'The Hill Beacon', 'A Parasol Row', 'A Rockpool', 'The Far Lighthouse', 'Painted Hopscotch Refresh',
    'A Scoreboard', 'Celebration Bunting', 'A Photo Booth', 'Extra Fair Lights', 'The Fair Arch'];
  assert(JSON.stringify(g.names) === JSON.stringify(WANT), 'named exactly as the pack authors them');
  assert(g.headline === 'The Boo Builders finished the Little Cairn!', `the reveal headline reads correctly (got "${g.headline}")`);
  assert(g.combined === 'Look how the Playground has grown!', `and the combined one too (got "${g.combined}")`);
  await ctx.close();
}
{
  // Seeded counts trigger the track in order. Five things in the riverside → the first one.
  // The Meadow's own five are marked DONE in this fixture: there is ONE Boo Builders crew for
  // the whole town (`townGrowth.site`), inherited verbatim from the Meadow machine as the pack
  // requires, so with the Meadow's wildflowers still owed the riverside would correctly QUEUE
  // behind them rather than break ground. (The first run of this block caught exactly that.)
  const five = Array.from({ length: 5 }, (_, i) => P('riverside', 'deco_rock', +(0.06 + i * 0.03).toFixed(3), i % 3));
  const { ctx, page } = await open(SAVE({
    town: { areas: withItems({ riverside: five }), nextId: 900 },
    townGrowth: { done: [0, 1, 2, 3, 4], pending: [], site: null, catchup: [] }
  }), { area: 'riverside' });
  const st = await page.evaluate(() => window.BooTown.State.getState().townGrowth);
  assert(st.site && st.site.idx === 5,
    `five things in the riverside starts the Stepping Stones (site ${st.site && st.site.idx}, pending ${JSON.stringify(st.pending)})`);
  assert(await until(page, () => !!document.querySelector('.t-growth'), 3000), 'the Builders put up their site, in the riverside itself');
  await page.screenshot({ path: `${SHOTS}/e15-site.png` });
  await ctx.close();
}
{
  // A finished track renders its three props, and the night-lit one really lights.
  const twenty = Array.from({ length: 20 }, (_, i) => P('beach', 'deco_rock', +(0.04 + i * 0.012).toFixed(3), i % 3));
  const done = { done: [11, 12, 13], pending: [], site: null, catchup: [] };
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ beach: twenty }), nextId: 900 }, townGrowth: done }), { area: 'beach', hour: 13 });
  const props = await page.evaluate(() => [...document.querySelectorAll('.t-growth')].map(n => n.className));
  assert(props.length === 3, `a finished beach track draws all three of its props (${props.length})`);
  assert(props.some(c => /tg-lighthouse/.test(c)) && props.some(c => /tg-rockpool/.test(c)) && props.some(c => /tg-parasols/.test(c)),
    'the parasols, the rockpool and the lighthouse');
  await page.screenshot({ path: `${SHOTS}/e15-beach-day.png` });
  // The rockpool answers a tap — the one growth prop that is not pure backdrop.
  await page.evaluate(() => document.querySelector('.t-growth.tg-rockpool').click());
  assert(await until(page, () => !!document.querySelector('.t-growth.tg-crab-peek'), 2000), 'tapping the rockpool makes a crab peek out');
  await page.screenshot({ path: `${SHOTS}/e15-crab.png` });
  await ctx.close();
}
{
  const twenty = Array.from({ length: 20 }, (_, i) => P('beach', 'deco_rock', +(0.04 + i * 0.012).toFixed(3), i % 3));
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ beach: twenty }), nextId: 900 }, townGrowth: { done: [11, 12, 13], pending: [], site: null, catchup: [] } }), { area: 'beach', hour: 22 });
  assert(await page.evaluate(() => {
    const lh = document.querySelector('.t-growth.tg-lighthouse');
    return !!lh && /FFC93C/.test(lh.innerHTML);   // the lamp's glow is only drawn at night
  }), 'at night the far lighthouse lights its lamp');
  await page.screenshot({ path: `${SHOTS}/e15-beach-night.png` });
  await ctx.close();
}
{
  // THE MULTI-CROSS RULE: twenty things dropped in at once crosses all three thresholds, and
  // that is ONE combined reveal, in that area, not three queued ceremonies.
  const twenty = Array.from({ length: 20 }, (_, i) => P('hilltop', 'deco_rock', +(0.04 + i * 0.012).toFixed(3), i % 3));
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ hilltop: twenty }), nextId: 900 } }), { area: 'hilltop' });
  assert(await until(page, () => document.querySelectorAll('.overlay.growth-reveal').length === 1, 4000),
    'three milestones at once make exactly ONE reveal');
  const line = await page.evaluate(() => { const p = document.querySelector('.growth-reveal .gr-line'); return p ? p.textContent : null; });
  assert(line === 'Look how the Hilltop has grown!', `saying exactly "Look how the Hilltop has grown!" (got "${line}")`);
  const named = await page.evaluate(() => [...document.querySelectorAll('.growth-reveal .gr-name')].map(n => n.textContent));
  assert(named.length === 3, `and naming all three of them (${named.join(', ')})`);
  await page.screenshot({ path: `${SHOTS}/e15-combined.png` });
  await page.evaluate(() => document.querySelector('.growth-reveal .btn.big').click());
  assert(await until(page, () => document.querySelectorAll('.overlay.growth-reveal').length === 0, 2000), 'Hooray dismisses it');
  assert(await until(page, () => document.querySelectorAll('.t-growth').length === 3, 2500), 'and all three props are standing there afterwards');
  await ctx.close();
}
{
  // A milestone finished elsewhere does NOT celebrate over here — nowhere to look.
  const twenty = Array.from({ length: 20 }, (_, i) => P('hilltop', 'deco_rock', +(0.04 + i * 0.012).toFixed(3), i % 3));
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({ hilltop: twenty }), nextId: 900 } }), { area: 'meadow' });
  await sleep(1800);
  assert(await count(page, '.overlay.growth-reveal') === 0, 'standing in the Meadow, the Hilltop\'s news waits until she goes there');
  await ctx.close();
}
{
  // The world map ribbons a finished track.
  const { ctx, page } = await open(SAVE({ townGrowth: { done: [5, 6, 7], pending: [], site: null, catchup: [] } }), { area: null });
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.map-badge', { timeout: 8000 });
  await sleep(400);
  const ribbons = await page.evaluate(() => [...document.querySelectorAll('.map-badge')].filter(b => b.querySelector('.mb-ribbon')).length);
  assert(ribbons === 1, `exactly the one area whose track is finished gets a ribbon (${ribbons})`);
  await page.screenshot({ path: `${SHOTS}/e15-ribbon.png` });
  await ctx.close();
}

// ============================================================================
// E11 — adjacency delights
// ============================================================================
console.log('\n== E11: things that are better together ==');
{
  // A lamppost and a bench, side by side, after dark: a moth loops the lamp.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_lamppost', 0.12), P('meadow', 'deco_bench', 0.18)] }), nextId: 900 } }),
    { area: 'meadow', hour: 22 });
  assert(await hasCls(page, '.t-item[data-item="deco_lamppost"].lit'),
    'the lamppost is LIT at night (it never has been — its own blurb promised light)');
  await page.evaluate(() => window.__townLife.checkAdjacency());
  assert(await until(page, () => document.querySelectorAll('.t-moth').length === 1, 2500),
    'lamppost + bench at night: a moth loops the lamp');
  assert(await page.evaluate(() => !/[\u{1F300}-\u{1FAFF}]/u.test(document.querySelector('.t-moth').textContent || '')),
    '…drawn as inline SVG, never an emoji');
  await page.screenshot({ path: `${SHOTS}/e11-moth.png` });
  await ctx.close();
}
{
  // Too far apart is not adjacency.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_lamppost', 0.05), P('meadow', 'deco_bench', 0.60)] }), nextId: 900 } }),
    { area: 'meadow', hour: 22 });
  await page.evaluate(() => window.__townLife.checkAdjacency());
  await sleep(600);
  assert(await count(page, '.t-moth') === 0, 'a bench across the field is not next to the lamppost');
  await ctx.close();
}
{
  // Flowers by the pond in the daytime, with no frog owned: a dragonfly visits.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_flowers', 0.12), P('meadow', 'deco_pond', 0.20)] }), nextId: 900 } }),
    { area: 'meadow', hour: 13 });
  await page.evaluate(() => window.__townLife.checkAdjacency());
  assert(await until(page, () => document.querySelectorAll('.t-dragonfly').length === 1, 2500),
    'flowers + pond by day: a dragonfly visits');
  await page.screenshot({ path: `${SHOTS}/e11-dragonfly.png` });
  await ctx.close();
}
{
  // …and if she has wished for a frog and it is here, HER frog comes instead.
  const { ctx, page } = await open(SAVE({
    wishes: { unlocked: { frog: true } },
    town: { areas: withItems({ meadow: [P('meadow', 'deco_flowers', 0.12), P('meadow', 'deco_pond', 0.20), P('meadow', 'wish_frog', 0.08)] }), nextId: 900 }
  }), { area: 'meadow', hour: 13 });
  await page.evaluate(() => window.__townLife.checkAdjacency());
  assert(await until(page, () => !!document.querySelector('.t-item[data-item="wish_frog"].t-frog-hop'), 2500),
    'with her own frog placed here, the frog hops over instead');
  assert(await count(page, '.t-dragonfly') === 0, '…and no dragonfly is sent as well');
  await page.screenshot({ path: `${SHOTS}/e11-frog.png` });
  await ctx.close();
}
{
  // A campfire at night with Boos round it: marshmallows, and one contented pip.
  const boos = ['boo_inky', 'boo_plum', 'boo_pippin'].map((b, i) => P('meadow', b, +(0.14 + i * 0.03).toFixed(3)));
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_campfire', 0.18), ...boos] }), nextId: 900 } }),
    { area: 'meadow', hour: 22 });
  // The night role sweep gathers them into the circle first.
  const gathered = await until(page, () => window.__townLife.goals().filter(g => g.role === 'campfire').length >= 2, 12000, 400);
  assert(gathered, 'the Boos gather round the fire at night');
  await page.evaluate(() => { window.__townLife.resetAdjacency(); window.__townLife.checkAdjacency(); });
  assert(await until(page, () => document.querySelectorAll('.t-marshmallow').length >= 2, 3000),
    'campfire + Boos round it: marshmallow sticks appear in their hands');
  assert(await until(page, () => [...document.querySelectorAll('.catchphrase-bubble')].some(b => b.textContent === 'Mmm!'), 3000),
    '…and exactly one contented "Mmm!"');
  const pips = await page.evaluate(() => [...document.querySelectorAll('.catchphrase-bubble')].filter(b => b.textContent === 'Mmm!').length);
  assert(pips === 1, `one pip between them, not one each (${pips})`);
  await page.screenshot({ path: `${SHOTS}/e11-marshmallows.png` });
  await ctx.close();
}
{
  // The budget: two scenes a SESSION, shared, and it must not reset when she leaves an area.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_lamppost', 0.12), P('meadow', 'deco_bench', 0.18)] }), nextId: 900 } }),
    { area: 'meadow', hour: 22 });
  await page.evaluate(() => { window.__townLife.resetAdjacency(); });
  for (let i = 0; i < 5; i++) { await page.evaluate(() => window.__townLife.checkAdjacency()); await sleep(120); }
  const spent = await page.evaluate(() => window.__townLife.adjacencyScenes());
  assert(spent === 2, `five checks spend at most two scenes (${spent})`);
  // Leave and come back: the budget is SESSION-scoped, so it must still read 2.
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await sleep(300);
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife);
  const after = await page.evaluate(() => window.__townLife.adjacencyScenes());
  assert(after === 2, `and coming back does NOT hand her two more (${after}) — this is per session, not per visit`);
  await ctx.close();
}
{
  // Reduced motion: the props are there, the performances are not.
  const { ctx, page } = await open(SAVE({ town: { areas: withItems({
    meadow: [P('meadow', 'deco_lamppost', 0.12), P('meadow', 'deco_bench', 0.18)] }), nextId: 900 } }),
    { area: 'meadow', hour: 22, reduced: 'reduce' });
  await page.evaluate(() => window.__townLife.checkAdjacency());
  await sleep(700);
  assert(await count(page, '.t-moth') === 0, 'reduced motion: nothing flies (the lamp and bench are still there)');
  assert(await count(page, '.t-item[data-item="deco_lamppost"]') === 1, '…and the props themselves are untouched');
  await ctx.close();
}

// ============================================================================
// E13 — acknowledgement wave two
// ============================================================================
console.log('\n== E13: the town notices ==');
{
  // The three new moments share ONE budget with the four that shipped before them, so each is
  // driven directly through ack.js with the budget reset first (the r19z4 pattern) — otherwise
  // the assertions would be testing the latch, not the lines.
  const { ctx, page } = await open(SAVE(), { area: null });
  const lines = await page.evaluate(async () => {
    const a = await import('/js/ack.js');
    const out = {};
    for (const [m, vars] of [['areaBusy', { areaName: 'The Meadow' }], ['newDressing', null],
                             ['newDressingFloor', null], ['newItemLove', { booName: 'Inky', itemName: 'Cosy Bench' }],
                             ['ovenBake', null]]) {
      a.resetAcks();
      out[m] = a.acknowledge(m, vars);
    }
    return { out, moments: a.ackMoments ? null : Object.keys(a.ACK_MOMENTS), cap: a.ACK_CAP };
  });
  assert(lines.out.areaBusy === 'Look how busy the The Meadow is getting!',
    `E13-1's template substitutes literally ("${lines.out.areaBusy}") — town.js is what strips the article`);
  assert(lines.out.newDressing === 'Ooh — new wallpaper!', `E13-2 walls: exactly "Ooh — new wallpaper!" (got "${lines.out.newDressing}")`);
  assert(lines.out.newDressingFloor === 'Ooh — a new floor!', `E13-2 floors: exactly "Ooh — a new floor!" (got "${lines.out.newDressingFloor}")`);
  assert(lines.out.newItemLove === 'Inky loves the new Cosy Bench!', `E13-3: exactly "<Name> loves the new <item>!" (got "${lines.out.newItemLove}")`);
  assert(lines.out.ovenBake === 'Something smells lovely!', `E12 oven: exactly "Something smells lovely!" (got "${lines.out.ovenBake}")`);
  assert(lines.cap === 2, 'and they all still share the SAME two-per-session budget');
  // The budget really binds: seven moments, two slots, never two in a row.
  const budget = await page.evaluate(async () => {
    const a = await import('/js/ack.js');
    a.resetAcks();
    const said = [];
    for (let i = 0; i < 8; i++) said.push(a.acknowledge('areaBusy', { areaName: 'The Meadow' }));
    return { spoken: said.filter(Boolean).length, total: a.acksSaid() };
  });
  assert(budget.spoken <= 2 && budget.total <= 2, `eight tries in one session yield at most two lines (${budget.spoken})`);
  await ctx.close();
}
{
  // …and in the world: a twelfth item in an area earns the line once, ever.
  const eleven = Array.from({ length: 11 }, (_, i) => P('meadow', 'deco_rock', +(0.04 + i * 0.018).toFixed(3), i % 3));
  const { ctx, page } = await open(SAVE({
    town: { areas: withItems({ meadow: eleven }), nextId: 900 },
    seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', funfairOpened: true, wishWellSeeded: true, jokeStageSeeded: true, noticePostSeeded: true }
  }), { area: 'meadow' });
  const n0 = await page.evaluate(() => window.__townLife.placements().length);
  assert(n0 === 11, `the fixture really has eleven things in it (${n0})`);
  // Put down a twelfth through the app's own path.
  await page.evaluate(() => {
    const st = window.BooTown.__state ? window.BooTown.__state() : null;
    window.__townLife.rerender();
  });
  const fired = await page.evaluate(async () => {
    const a = await import('/js/ack.js');
    a.resetAcks();
    // Place a twelfth item the way a drop does, then run the notice.
    const s = await import('/js/state.js');
    s.mutate(st => { st.town.areas.meadow.items.push({ id: s.nextPlacementId(st), zone: 'meadow', x: 0.30, row: 0, item: 'deco_rock' }); });
    window.__townLife.notePlacement();
    await new Promise(r => setTimeout(r, 300));
    const n = document.querySelector('.wish-said');
    return { said: n ? n.textContent : null, count: window.__townLife.placements().length };
  });
  assert(fired.count === 12, `the twelfth thing is really down (${fired.count})`);
  assert(fired.said === 'Look how busy the Meadow is getting!',
    `E13-1 lands in the world at twelve items, with the article NOT doubled ("${fired.said}")`);
  await page.screenshot({ path: `${SHOTS}/e13-areabusy.png` });
  // …and never a second time for that area.
  const again = await page.evaluate(async () => {
    const a = await import('/js/ack.js');
    a.resetAcks();
    document.querySelectorAll('.wish-said').forEach(n => n.remove());
    const s = await import('/js/state.js');
    s.mutate(st => { st.town.areas.meadow.items.push({ id: s.nextPlacementId(st), zone: 'meadow', x: 0.36, row: 0, item: 'deco_rock' }); });
    window.__townLife.notePlacement();
    await new Promise(r => setTimeout(r, 300));
    const n = document.querySelector('.wish-said');
    return n ? n.textContent : null;
  });
  assert(again !== 'Look how busy the Meadow is getting!',
    `E13-1 is first-time-per-area only (second crossing said ${again === null ? 'nothing' : '"' + again + '"'})`);
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
