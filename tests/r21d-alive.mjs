// tests/r21d-alive.mjs — RUN21D "Alive on Arrival": the pack's own ACCEPT criteria, made
// permanent.
//
// RUN21D's five items are all about the FIRST fifteen seconds of an area: a guaranteed
// opening beat, a way to find whoever is wondering something, a way to know the area is
// four screens wide, signs to the fair's best rooms, and a fair chance at the hider. Every
// one of them is a regression risk for the rest of the programme (RUN21B/C/E all rewrite
// js/town.js on top of them), so the ACCEPTs live here rather than in a throwaway probe.
//
// Expected runtime: ~150s (board law: state it when adding a suite). The pulse blocks each
// have to wait out a real 9-second invitation, which is what makes it long; no @serial need,
// since nothing here samples animation frames.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = '_evidence/run21d';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow'].map(n => 'boo_' + n);
const AREAS = () => ({
  meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] },
  hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] },
  funfair: { items: [], paths: [] }, playground: { items: [], paths: [] },
  boohouse: { items: [], paths: [] }, boohouse_kitchen: { items: [], paths: [] },
  boohouse_bedroom: { items: [], paths: [] }, gallery: { items: [], paths: [] }
});
// A fair with every ride already standing, so tickFunfair() finds nothing newly eligible and
// no ceremony is owed on entry — the funfair blocks below are about the fair, not about a
// reveal winning (that has its own block).
const SETTLED_FAIR = { built: ['carousel', 'ferris', 'teacups', 'bouncy', 'helter'], build: null, pending: [], seats: {}, catchup: [] };
const SAVE = (over = {}) => Object.assign({
  version: 23, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])),
  stars: { total: 400, byType: {}, spent: {} },
  town: { areas: AREAS() },
  funfair: SETTLED_FAIR,
  wishes: { unlocked: {} },
  // the day's hide-and-seek must never swallow a Boo these blocks are watching
  delights: { hideDay: today, hideFound: true },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', introSeen: { shop: 1 }, funfairOpened: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false }
}, over);
// Boos standing in a row on the entry screen of `area`.
const boosIn = (area, n = 3, x0 = 0.10) => BOOS.slice(0, n).map((b, i) => ({ zone: area, x: +(x0 + i * 0.06).toFixed(3), row: 1, item: b, scale: 1 }));
const withItems = (area, items) => { const a = AREAS(); a[area].items = items; return a; };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const pageErrors = [];
async function open(save, { area = 'meadow', room = null, w = 1024, h = 768, hour = 13, reduced = 'no-preference', now = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  await page.addInitScript(([hr, nw]) => {
    window.__bootownHour = hr;
    if (nw != null) window.__bootownNow = nw;
  }, [hour, now]);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  // One retry on the boot wait: a cold module graph over a local server occasionally
  // outruns the wait on a loaded machine, and a reload is cheaper than a false FAIL.
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
  }
  return { ctx, page };
}
const pulse = (page) => page.evaluate(() => window.__townLife.pulse());

// ============================================================================
// Item 1 — The Pulse Director
// ============================================================================
// The visible proof of each beat kind, WATCHED rather than sampled: every beat is a short
// vignette (a 700ms glint, a 1.1s idle, a 350ms hop), so a single read at 3s photographs the
// aftermath and calls it a miss. This polls in-page from mount until `ms` and reports
// whether the beat that fired was ever really on screen inside that window.
async function watchBeat(page, ms = 3000) {
  return page.evaluate(async (ms) => {
    const has = sel => !!document.querySelector(sel);
    const goals = () => window.__townLife.goals();
    const PROOF = {
      request:   () => has('.request-thought.rq-pulse3'),
      newItem:   () => has('.wish-airborne, .wish-glint, .wish-launch, .wish-wobble, .wish-lit')
                       || goals().some(g => g.goal === 'approach'),
      zone:      () => has('.t-kite-wrap, .t-skip-stone, .t-splash, .t-sandcastle, .t-towel')
                       || goals().some(g => ['paddle', 'shallow', 'skim', 'kite', 'bridgesit', 'sandcastle', 'sunbathe'].includes(g.goal)),
      idle:      () => window.__townLife.idleClasses().length > 0 || has('.t-seat-hop'),
      signature: () => has('.t-petal, .t-skip, .t-footprint, .t-train, .t-kernel')
    };
    const t0 = performance.now();
    let beat = null, visible = false, at = null;
    while (performance.now() - t0 < ms) {
      beat = window.__townLife.pulse().beat;
      if (PROOF[beat] && PROOF[beat]()) { visible = true; at = Math.round(performance.now() - t0); break; }
      await new Promise(r => setTimeout(r, 60));
    }
    return { beat, visible, at };
  }, ms);
}

console.log('== item 1: every mount takes one opening breath ==');
{
  // TEN scripted mounts across areas: the six outdoor areas, two Boo House rooms, and the
  // two beats that need a fixture of their own (a request, and a brand-new wish).
  const MOUNTS = [
    { name: 'meadow', area: 'meadow', save: () => SAVE({ town: { areas: withItems('meadow', [...boosIn('meadow'), { zone: 'meadow', x: 0.20, row: 2, item: 'deco_flowers', scale: 1 }]) } }) },
    { name: 'riverside', area: 'riverside', save: () => SAVE({ town: { areas: withItems('riverside', boosIn('riverside')) } }) },
    { name: 'hilltop', area: 'hilltop', save: () => SAVE({ town: { areas: withItems('hilltop', boosIn('hilltop')) } }) },
    { name: 'beach', area: 'beach', save: () => SAVE({ town: { areas: withItems('beach', boosIn('beach')) } }) },
    { name: 'playground', area: 'playground', save: () => SAVE({ town: { areas: withItems('playground', boosIn('playground')) } }) },
    { name: 'funfair', area: 'funfair', save: () => SAVE({ town: { areas: withItems('funfair', boosIn('funfair')) } }) },
    { name: 'boohouse lounge', area: 'boohouse', room: 'lounge', save: () => SAVE({ town: { areas: withItems('boohouse', boosIn('boohouse', 2, 0.30)) } }) },
    { name: 'boohouse kitchen', area: 'boohouse', room: 'kitchen', save: () => SAVE({ town: { areas: withItems('boohouse_kitchen', boosIn('boohouse_kitchen', 2, 0.30)) } }) },
    {
      // a Boo standing here is wondering something → beat 1
      name: 'meadow (a request)', area: 'meadow',
      save: () => SAVE({
        town: { areas: withItems('meadow', boosIn('meadow')) },
        settings: { sound: false, music: false, voice: false, content: 'full', requests: true },
        request: { actives: [{ id: 'threeStar', booId: BOOS[0], text: 'I bet you can get 3 stars!', createdAt: Date.now() }], lastResolvedAt: Date.now() }
      })
    },
    {
      // she put a wish down five minutes ago → beat 2 plays its verb
      name: 'meadow (a new wish)', area: 'meadow',
      save: () => SAVE({ town: { areas: withItems('meadow', [...boosIn('meadow'), { zone: 'meadow', x: 0.20, row: 1, item: 'wish_star', scale: 1, at: Date.now() - 300000 }]) } })
    },
    {
      // an area she has not put anything in yet: no bubble, no new thing, nobody to move —
      // the place itself has to say hello. This is the mount the pulse exists for.
      name: 'riverside (empty)', area: 'riverside', save: () => SAVE()
    }
  ];
  const seenKinds = new Set();
  for (const m of MOUNTS) {
    const { ctx, page } = await open(m.save(), { area: m.area, room: m.room || null });
    const mounted = Date.now();
    const acksBefore = await page.evaluate(() => window.__acks.said());
    const w = await watchBeat(page, 3000);                  // the beat is due at 900ms
    // photographed the instant the beat proved itself, not after it has finished playing
    const slug = m.name.replace(/[^a-z]+/gi, '-').toLowerCase();
    if (w.visible) await page.screenshot({ path: `${SHOTS}/item1-beat-${slug}.png` });
    const p = await pulse(page);
    const acksAfter = await page.evaluate(() => window.__acks.said());
    assert(p.beats.length === 1, `${m.name}: exactly one beat fired (${JSON.stringify(p.beats)})`);
    assert(w.visible, `${m.name}: the ${p.beat} beat was visible on screen at ${w.at}ms (≤3s)`);
    assert(acksAfter === acksBefore, `${m.name}: the beat spent no acknowledgement budget (${acksBefore}→${acksAfter})`);
    seenKinds.add(p.beat);
    // …and the invitation lands at ~9s from the mount, exactly as authored. Measured from
    // the mount, not from wherever watchBeat happened to break out.
    await sleep(Math.max(0, 9800 - (Date.now() - mounted)));
    const q = await pulse(page);
    assert(q.invited === true, `${m.name}: the invitation showed at ~9s`);
    assert(q.hint === q.invitation, `${m.name}: the hint bar reads exactly "${q.invitation}"`);
    assert(q.beats.length === 1, `${m.name}: still exactly one beat after the invitation`);
    await ctx.close();
  }
  // The five beats are a priority ladder, not a single hard-coded trick: the ten mounts
  // between them must exercise more than one rung.
  assert(seenKinds.size >= 3, `the ten mounts exercised ${seenKinds.size} different beats (${[...seenKinds].join(', ')})`);
  assert([...seenKinds].every(k => ['request', 'newItem', 'zone', 'idle', 'signature'].includes(k)),
    'every beat that fired was one of the pack\'s five');
}

console.log('== item 1: the authored invitations, per area ==');
{
  const WANT = {
    meadow: 'Try tapping a flower…', riverside: 'Try tapping the river…',
    hilltop: 'Try tapping the sky…', beach: 'Try tapping the sand…',
    playground: 'Try the swings…', funfair: 'The bandstand plays if you wander right…'
  };
  for (const [area, line] of Object.entries(WANT)) {
    const { ctx, page } = await open(SAVE({ town: { areas: withItems(area, boosIn(area)) } }), { area });
    await sleep(9600);
    const p = await pulse(page);
    assert(p.hint === line, `${area}: "${p.hint}"`);
    await page.screenshot({ path: `${SHOTS}/item1-invitation-${area}.png` });
    await ctx.close();
  }
  for (const room of ['lounge', 'kitchen', 'bedroom']) {
    const key = room === 'lounge' ? 'boohouse' : 'boohouse_' + room;
    const { ctx, page } = await open(SAVE({ town: { areas: withItems(key, boosIn(key, 2, 0.30)) } }), { area: 'boohouse', room });
    await sleep(9600);
    const p = await pulse(page);
    assert(p.hint === 'Try tapping a sleepy Boo…', `boohouse/${room}: "${p.hint}"`);
    await ctx.close();
  }
}

console.log('== item 1: REDUCED shows the invitation and no movement beat ==');
{
  const { ctx, page } = await open(SAVE({ town: { areas: withItems('meadow', boosIn('meadow')) } }), { area: 'meadow', reduced: 'reduce' });
  await sleep(2600);
  const p = await pulse(page);
  assert(p.beat === 'reduced' && p.beats.length === 0, `no movement beat under reduced motion (beat=${p.beat})`);
  const moved = await page.evaluate(() => !!document.querySelector('.t-kite-wrap, .t-splash, .t-petal, .request-thought.rq-pulse3')
    || window.__townLife.idleClasses().length > 0);
  assert(!moved, 'nothing moved: no idle, no prop, no particle');
  await sleep(7200);
  const q = await pulse(page);
  assert(q.invited === true && q.hint === 'Try tapping a flower…', `the invitation still shows: "${q.hint}"`);
  await ctx.close();
}

console.log('== item 1: a reveal wins — the pulse skips that mount ==');
{
  // A funfair with a finished ride owes a reveal on entry. RUN21A-8's queue puts it on
  // screen at +700ms; the pulse is due at +900ms and must stand down.
  const save = SAVE({
    town: { areas: withItems('funfair', boosIn('funfair')) },
    funfair: { built: ['carousel'], build: null, pending: [], seats: {}, revealed: [] }
  });
  const { ctx, page } = await open(save, { area: 'funfair' });
  await sleep(2600);
  const p = await pulse(page);
  const revealUp = await page.evaluate(() => !!document.querySelector('.overlay.growth-reveal, .funfair-reveal, .overlay'));
  assert(revealUp, 'a reveal really is on screen for this fixture');
  assert(p.beats.length === 0, `no beat played over the reveal (${JSON.stringify(p.beats)})`);
  assert(p.beat === 'skipped:reveal', `the pulse recorded why it stood down (${p.beat})`);
  await sleep(7200);
  const q = await pulse(page);
  assert(q.invited === false, 'and no invitation either — the ceremony is the moment');
  await page.screenshot({ path: `${SHOTS}/item1-reveal-wins.png` });
  await ctx.close();
}

console.log('== item 1: a second visit today prefers a beat it has not shown ==');
{
  const save = SAVE({ town: { areas: withItems('riverside', boosIn('riverside')) } });
  const { ctx, page } = await open(save, { area: 'riverside' });
  await sleep(2600);
  const first = (await pulse(page)).beat;
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.worldmap', { timeout: 8000 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'riverside' }));
  await page.waitForSelector('.town2', { timeout: 8000 });
  await page.waitForFunction(() => window.__townLife, { timeout: 8000 });
  await sleep(2600);
  const second = (await pulse(page)).beat;
  assert(first !== second, `the second visit chose a different beat (${first} → ${second})`);
  await ctx.close();
}

// ============================================================================
// Item 2 — Requests you can find
// ============================================================================
const REQUESTS_ON = { sound: false, music: false, voice: false, content: 'full', requests: true };

console.log('== item 2A: the map says WHERE somebody is wondering something ==');
{
  const asker = BOOS[0];
  const save = SAVE({
    town: { areas: withItems('riverside', boosIn('riverside')) },
    settings: REQUESTS_ON,
    // seeded, and the recharge freshly spent, so nothing new is created underneath the test
    request: { actives: [{ id: 'threeStar', booId: asker, text: 'I bet you can get 3 stars!', createdAt: Date.now() }], lastResolvedAt: Date.now() }
  });
  const { ctx, page } = await open(save, { area: null });
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.worldmap', { timeout: 8000 });
  await page.waitForFunction(() => window.__worldmap, { timeout: 8000 });
  const name = await page.evaluate(id => window.__worldmap.wonderChip('riverside'), asker);
  const areas = await page.evaluate(() => window.__worldmap.wonderAreas());
  assert(!!name, 'the riverside badge has a 💭 chip');
  assert(name && name.text === '💭', `the chip is a thought bubble ("${name && name.text}")`);
  assert(name && name.title === 'Inky is wondering something…', `tooltip exactly: "${name && name.title}"`);
  assert(name && name.aria === 'Inky is wondering something…', `aria exactly: "${name && name.aria}"`);
  assert(JSON.stringify(areas) === '["riverside"]', `only the right area is chipped (${JSON.stringify(areas)})`);
  const meadowChip = await page.evaluate(() => window.__worldmap.wonderChip('meadow'));
  assert(meadowChip === null, 'an area with no requester has no chip');
  const aria = await page.evaluate(() => window.__worldmap.badgeAria('riverside'));
  assert(aria.includes('Inky is wondering something…'), `the badge announces it too: "${aria}"`);
  // The chip is decoration: tapping the badge still just opens the area.
  await page.evaluate(() => window.__worldmap.tap('riverside'));
  await page.waitForSelector('.town2', { timeout: 8000 });
  assert(await page.evaluate(() => window.__townLife.area()) === 'riverside', 'tapping the chipped badge opens that area as normal');
  await ctx.close();
}

console.log('== item 2A: a request generated on one visit is on the map by the next ==');
{
  // No request in the save; three Boos standing in the Meadow; the recharge long spent. Area
  // entry is a creation trigger (RUN19 Z2), so one visit is all it takes.
  const save = SAVE({
    town: { areas: withItems('meadow', boosIn('meadow')) },
    settings: REQUESTS_ON,
    request: { actives: [], lastResolvedAt: 0 }
  });
  const { ctx, page } = await open(save, { area: 'meadow' });
  await sleep(600);
  const made = await page.evaluate(() => (JSON.parse(localStorage.getItem('bootown.save.v1')).request.actives || []).length);
  assert(made > 0, `one visit to the Meadow generated a request (${made})`);
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.worldmap', { timeout: 8000 });
  await page.waitForFunction(() => window.__worldmap, { timeout: 8000 });
  const areas = await page.evaluate(() => window.__worldmap.wonderAreas());
  assert(areas.includes('meadow'), `and the Meadow badge is chipped on the very next visit to the map (${JSON.stringify(areas)})`);
  await page.screenshot({ path: `${SHOTS}/item2-map-wonder-chip.png` });
  await ctx.close();
}

console.log('== item 2B: "Show me" lands the target on screen ==');
{
  const asker = BOOS[0];
  // The bench is at 0.72 of a four-viewport area — nearly three screens right of where she
  // arrives, which is exactly the walk this button exists to save.
  const items = [...boosIn('meadow'), { zone: 'meadow', x: 0.72, row: 1, item: 'deco_bench', scale: 1 }];
  const save = SAVE({
    town: { areas: withItems('meadow', items) },
    settings: REQUESTS_ON,
    request: {
      actives: [{ id: 'sit', kind: 'sit', booId: asker, area: 'meadow', itemId: 'deco_bench', itemX: 0.72, targetBooId: null, accId: null, createdAt: Date.now() }],
      lastResolvedAt: Date.now()
    }
  });
  const { ctx, page } = await open(save, { area: 'meadow' });
  await sleep(1600);                                   // let item 1's opening beat finish first
  const before = await page.evaluate(id => window.__townLife.targetViewFrac(id), asker);
  assert(before < 0 || before > 1, `the bench starts off-screen (view fraction ${before && before.toFixed(2)})`);
  assert(await page.evaluate(id => window.__townLife.openRequestFor(id), asker), 'the request card opens');
  await sleep(300);
  const hasShowMe = await page.evaluate(() => [...document.querySelectorAll('.request-card .btn')].some(b => b.textContent === 'Show me'));
  assert(hasShowMe, 'the card offers "Show me" for a target in this area');
  await page.screenshot({ path: `${SHOTS}/item2-showme-card.png` });
  await page.evaluate(() => [...document.querySelectorAll('.request-card .btn')].find(b => b.textContent === 'Show me').click());
  await sleep(900);                                    // the pan is 600ms
  const after = await page.evaluate(id => window.__townLife.targetViewFrac(id), asker);
  assert(Math.abs(after - 0.5) <= 0.2, `the bench lands centred ±20% (view fraction ${after.toFixed(3)})`);
  const cardGone = await page.evaluate(() => !document.querySelector('.request-card'));
  assert(cardGone, 'and the card closed on the way');
  const ringed = await page.evaluate(() => window.__townLife.ringed());
  assert(ringed.includes('deco_bench'), `the bench wears the soft ring (${JSON.stringify(ringed)})`);
  await page.screenshot({ path: `${SHOTS}/item2-showme-landed.png` });
  await sleep(1600);
  const stillRinged = await page.evaluate(() => window.__townLife.ringed());
  assert(stillRinged.length === 0, 'and the ring lets go after ~2s');
  await ctx.close();

  // …and the hard case: she presses "Show me" INSIDE the pulse's own 900ms window. The
  // ambient beat must not yank the camera back off the thing she just asked to see.
  const early = await open(save, { area: 'meadow' });
  await sleep(250);
  await early.page.evaluate(id => window.__townLife.openRequestFor(id), asker);
  await early.page.evaluate(() => [...document.querySelectorAll('.request-card .btn')].find(b => b.textContent === 'Show me').click());
  await sleep(2200);                                   // straight through the 900ms beat
  const landed = await early.page.evaluate(id => window.__townLife.targetViewFrac(id), asker);
  assert(Math.abs(landed - 0.5) <= 0.2, `an early "Show me" still lands the bench (view fraction ${landed.toFixed(3)})`);
  await early.ctx.close();
}

console.log('== item 2B: a cross-area target keeps its existing button and gains no pan ==');
{
  const asker = BOOS[0];
  // `wear` names an accessory in the wardrobe, not a thing standing in this area.
  const save = SAVE({
    town: { areas: withItems('meadow', boosIn('meadow')) },
    inventory: Object.assign(Object.fromEntries(BOOS.map(b => [b, 1])), { acc_bow: 1 }),
    settings: REQUESTS_ON,
    request: {
      actives: [{ id: 'wear', kind: 'wear', booId: asker, area: 'meadow', itemId: null, itemX: null, targetBooId: null, accId: 'acc_bow', createdAt: Date.now() }],
      lastResolvedAt: Date.now()
    }
  });
  const { ctx, page } = await open(save, { area: 'meadow' });
  await sleep(400);
  assert(await page.evaluate(id => window.__townLife.openRequestFor(id), asker), 'the wardrobe request card opens');
  await sleep(300);
  const labels = await page.evaluate(() => [...document.querySelectorAll('.request-card .btn')].map(b => b.textContent));
  assert(!labels.includes('Show me'), `no "Show me" for a cross-screen target (${JSON.stringify(labels)})`);
  assert(labels.includes('Open the wardrobe'), 'the existing cross-screen button is untouched');
  await ctx.close();
}

console.log('== item 2C: an in-area bubble breathes every 6s ==');
{
  const asker = BOOS[0];
  const save = SAVE({
    town: { areas: withItems('meadow', boosIn('meadow')) },
    settings: REQUESTS_ON,
    request: { actives: [{ id: 'threeStar', booId: asker, text: 'I bet you can get 3 stars!', createdAt: Date.now() }], lastResolvedAt: Date.now() }
  });
  {
    const { ctx, page } = await open(save, { area: 'meadow' });
    await sleep(400);
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.request-thought')).animationName);
    assert(/rq-breathe/.test(anim), `the bubble carries the 6s breathe (${anim})`);
    // Wait out item 1's opening beat first: the Pulse breathes this very bubble three times
    // at scale 1.14 (900ms + PULSE_BUBBLE_MS), and sampling through that would measure the
    // wrong animation entirely.
    await sleep(3600);
    const pulsing = await page.evaluate(() => !!document.querySelector('.request-thought.rq-pulse3'));
    assert(!pulsing, 'the Pulse\'s 3× breathe has finished before the ambient one is measured');
    // 7 seconds of samples, so a full 6s cycle is inside the window: the peak has to appear.
    const samples = await page.evaluate(async () => {
      const n = document.querySelector('.request-thought'); const out = [];
      for (let i = 0; i < 29; i++) { out.push(getComputedStyle(n).scale); await new Promise(r => setTimeout(r, 250)); }
      return out;
    });
    const nums = samples.map(v => parseFloat(v)).filter(v => Number.isFinite(v));
    const max = Math.max(...nums);
    assert(nums.length >= 24, `${nums.length} frames sampled over 7s`);
    assert(max > 1.005 && max <= 1.06 + 0.001, `the breathe really scales, peaking at ${max} (1 → 1.06)`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(save, { area: 'meadow', reduced: 'reduce' });
    await sleep(400);
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.request-thought')).animationName);
    const sc = await page.evaluate(() => getComputedStyle(document.querySelector('.request-thought')).scale);
    assert(anim === 'none', `REDUCED: no bubble animation at all (${anim})`);
    assert(parseFloat(sc) === 1 || sc === 'none', `REDUCED: the bubble holds still at scale ${sc}`);
    await ctx.close();
  }
}

console.log(pageErrors.length ? `PAGE ERRORS: ${JSON.stringify(pageErrors.slice(0, 6))}` : 'no page errors');
if (pageErrors.length) failed = true;
await browser.close();
console.log(failed ? '\nRUN21D: FAIL' : '\nRUN21D: PASS');
process.exit(failed ? 1 : 0);
