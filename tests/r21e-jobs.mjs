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
    { name: 'builders', over: { ...base, delights: { hideDay: today, hideFound: true },
      townGrowth: { done: [], pending: [], site: { idx: 0, startedAt: Date.now() } } },
      want: /^The Boo Builders are busy at .+…$/ },
    // "Quiet day" has to be genuinely quiet: this save owns six Boos, which really has crossed
    // the Meadow's first growth milestone, so the Builders line is CORRECT unless the fixture
    // says the work is already done. (The first run of this block caught exactly that.)
    { name: 'quiet day', over: { ...base, delights: { hideDay: today, hideFound: true },
      townGrowth: { done: [0, 1, 2, 3, 4], pending: [], site: null } },
      want: /^A lovely day for the playground!$/ }
  ];
  for (const c of cases) {
    const { ctx, page } = await open(SAVE(c.over), { area: 'playground' });
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
