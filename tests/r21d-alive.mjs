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

console.log(pageErrors.length ? `PAGE ERRORS: ${JSON.stringify(pageErrors.slice(0, 6))}` : 'no page errors');
if (pageErrors.length) failed = true;
await browser.close();
console.log(failed ? '\nRUN21D: FAIL' : '\nRUN21D: PASS');
process.exit(failed ? 1 : 0);
