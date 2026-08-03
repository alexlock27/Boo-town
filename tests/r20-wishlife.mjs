// tests/r20-wishlife.mjs — RUN20: the whole world (W1-W4).
//
// W1 every one of the sixty wishes maps to a class and has a verb; sky items never occupy a
//    grass row; flyers/roamers respect the actor cap; capped lines fire at most their cap; the
//    rocket launches on EVERY tap once the last flight has landed (RUN21A item 5 — a child's tap
//    is never budget-gated; the only guard is in-flight); reduced motion renders static but
//    KEEPS the tap verbs.
// W2 each area mounts its ambient; signatures fire from their taps and respect their caps;
//    interiors never mount weather.
// W3 each set maps to its idle/walk; removing the set removes it; caps hold; no set changes any
//    game or reward value.
// W4 map label contrast; three-band sky screenshots differ pairwise; flourishes transform-only.
// Expected runtime ~50s (the six repeat rocket taps wait out six real 3.2s flights — RUN21A
// item 5). Not @serial (the sky proof samples stills, not motion).
import { chromium } from 'playwright';
import { WISH_LIFE, WISH_CLASSES, OUTDOOR_ONLY, CATCHABLE, SKY_BAND } from '../data/wishlife.js';
import { WISH_WORDS as _unusedWishWords } from '../data/wishlife.js';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TODAY = new Date().toISOString().slice(0, 10);

const ALL_WISHES = {};
for (const w of Object.keys(WISH_LIFE)) ALL_WISHES[w] = true;

const SAVE = (over = {}) => Object.assign({
  version: 23, name: 'Ada', created: 1750000000000,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_plum: 1 },
  stars: { total: 400, byType: { creative: 20, maths: 0, word: 0, puzzle: 0, lesson: 0 }, spent: { creative: 0, maths: 0, word: 0, puzzle: 0, lesson: 0, legacy: 0 }, legacy: 0, byGame: {} },
  meter: 0, boxes: 0, opened: 4, stardust: 0,
  nicknames: {}, equips: {}, sparkles: {}, wishes: { unlocked: ALL_WISHES },
  delights: { hideDay: TODAY, hideFound: true },
  town: { areas: {} }, care: { bonds: {}, treats: 3 },
  request: { actives: [], lastResolvedAt: Date.now() },
  routines: {}, journal: {}, trophies: {}, customs: [], easelArt: '',
  settings: { sound: false, music: false, voice: false, mic: false, requests: false, content: 'full' },
  seen: { ageAsked: true, boohouseSeeded: true, townFirst: true }
}, over);

const browser = await chromium.launch();
async function boot(over = {}, { reducedMotion = 'no-preference', hour = 13 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(hr => { window.__bootownHour = hr; }, hour);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE(over)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function openArea(page, area = 'meadow') {
  await page.evaluate(a => window.BooTown.go('town', { area: a }), area);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(400);
}

// ---- W1: the table itself ------------------------------------------------------------
console.log('== W1: all sixty wishes map to a class, and none is verb-less ==');
{
  const { ctx, page } = await boot();
  const wishWords = await page.evaluate(async () => {
    const w = await import('./data/wishes.js');
    return w.WISH_WORDS ? w.WISH_WORDS : Object.keys(w.WISH_ICONS || {});
  });
  assert(wishWords.length === 60, `the wish catalogue has 60 words (${wishWords.length})`);
  const missing = wishWords.filter(w => !WISH_LIFE[w]);
  assert(missing.length === 0, `every wish id maps to a class (missing: ${JSON.stringify(missing)})`);
  const extra = Object.keys(WISH_LIFE).filter(w => !wishWords.includes(w));
  assert(extra.length === 0, `and the table invents none (extra: ${JSON.stringify(extra)})`);
  const badClass = Object.entries(WISH_LIFE).filter(([, v]) => !WISH_CLASSES.includes(v.cls));
  assert(badClass.length === 0, `every class is one of the nine (${JSON.stringify(badClass.map(x => x[0]))})`);
  // "no wish item is verb-less": every class either IS a verb (TAP/FOOD) or carries a
  // continuous behaviour that a tap can still interrupt.
  const verbless = Object.entries(WISH_LIFE).filter(([, v]) => v.cls === 'TAP' && !v.verb);
  assert(verbless.length === 0, `no TAP wish is missing its verb (${JSON.stringify(verbless.map(x => x[0]))})`);
  assert(CATCHABLE.size > 0 && [...CATCHABLE].every(w => ['FLYER', 'ROAMER'].includes(WISH_LIFE[w].cls)),
    `the catchable set is exactly the flyers and roamers (${CATCHABLE.size})`);
  await ctx.close();
}

console.log('== W1: a SKY wish never occupies a grass row ==');
{
  const items = [
    { zone: 'meadow', x: 0.06, row: 1, plane: 'sky', item: 'wish_sun' },
    { zone: 'meadow', x: 0.12, row: 1, plane: 'sky', item: 'wish_cloud' },
    { zone: 'meadow', x: 0.18, row: 1, item: 'wish_tree' }
  ];
  const { ctx, page } = await boot({ town: { areas: { meadow: { items, paths: [] } } } });
  await openArea(page);
  const ys = await page.evaluate(() => {
    const vp = document.querySelector('.t-viewport').getBoundingClientRect();
    return [...document.querySelectorAll('.t-item')].map(n => ({
      item: n.dataset.item, sky: n.classList.contains('on-sky'),
      bottomFrac: +(((n.getBoundingClientRect().bottom) - vp.top) / vp.height).toFixed(3)
    }));
  });
  const sky = ys.filter(y => y.sky);
  assert(sky.length === 2, `both sky wishes render on the sky plane (${JSON.stringify(sky.map(s => s.item))})`);
  assert(sky.every(s => s.bottomFrac <= SKY_BAND.bottom + 0.06),
    `and inside the sky band, never on a grass row (${JSON.stringify(sky.map(s => s.bottomFrac))} vs band ${SKY_BAND.top}-${SKY_BAND.bottom})`);
  const ground = ys.find(y => y.item === 'wish_tree');
  assert(ground && ground.bottomFrac > 0.5, `a ground wish still stands on the ground (${ground && ground.bottomFrac})`);
  await ctx.close();
}

console.log('== W1: a tap is a VERB, never the Move / Put away menu ==');
{
  const items = [
    { zone: 'meadow', x: 0.08, row: 1, item: 'boo_inky' },
    { zone: 'meadow', x: 0.12, row: 1, item: 'wish_trophy' },
    { zone: 'meadow', x: 0.16, row: 1, item: 'wish_bell' },
    { zone: 'meadow', x: 0.20, row: 1, item: 'wish_crown' },
    { zone: 'meadow', x: 0.24, row: 1, item: 'wish_rocket' }
  ];
  const { ctx, page } = await boot({ town: { areas: { meadow: { items, paths: [] } } } });
  await openArea(page);
  const taps = await page.evaluate(async () => {
    const tap = async (id) => {
      const n = [...document.querySelectorAll('.t-item')].find(x => x.dataset.item === id);
      if (!n) return { missing: true };
      const r = n.getBoundingClientRect();
      for (const type of ['pointerdown', 'pointerup']) n.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }));
      await new Promise(x => setTimeout(x, 300));
      const out = { menu: !!document.querySelector('.plot-menu'), cls: [...n.classList].join(' '), bubble: (document.querySelector('.catchphrase-bubble') || {}).textContent };
      document.querySelectorAll('.plot-menu').forEach(m => m.remove());
      return out;
    };
    return { trophy: await tap('wish_trophy'), bell: await tap('wish_bell'), crown: await tap('wish_crown'), rocket: await tap('wish_rocket') };
  });
  for (const [k, v] of Object.entries(taps)) assert(v && !v.missing && !v.menu, `${k}: the tap runs its verb, not the item menu (${JSON.stringify(v)})`);
  assert(/Royal Boo /.test(taps.crown.bubble || ''), `the crown says the authored line (${taps.crown.bubble})`);
  assert(/wish-airborne/.test(taps.rocket.cls || ''), 'the rocket launches');
  const crowned = await page.evaluate(() => (window.BooTown.State.getState().delights || {}).crowns);
  assert(crowned && Object.keys(crowned).length === 1, `and the crown persists as one {booId: dayStamp} (${JSON.stringify(crowned)})`);
  // RUN21A item 5 — "a child's tap is never budget-gated" — INVERTS this pin. wishTap's launch
  // verb no longer consults maydaySay(key + ':launch', 'visit'), so the old "at most ONCE per
  // visit" contract is dead: a direct tap now ALWAYS flies the full authored launch, every time,
  // once the previous flight has landed. Same rigour, new contract — the pack ACCEPT is "tap
  // rocket 6 times → full launch every time (after each returns)", so that is what we assert,
  // waiting out each flight rather than faking a landing by stripping the class.
  // The flight is data/wishlife.js rocket.ms (1200) + rocket.backMs (2000) = the 3200ms
  // .wish-launch animation.
  const FLIGHT = WISH_LIFE.rocket.ms + WISH_LIFE.rocket.backMs;
  const flights = await page.evaluate(async (flight) => {
    const n = [...document.querySelectorAll('.t-item')].find(x => x.dataset.item === 'wish_rocket');
    const svg = n.querySelector('svg');
    const nap = ms => new Promise(x => setTimeout(x, ms));
    const tap = () => { const r = n.getBoundingClientRect(); for (const type of ['pointerdown', 'pointerup']) n.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 })); };
    const launchAnims = () => svg.getAnimations().filter(a => a.animationName === 'wish-launch');
    // let the flight started by the verb tap above land on its own before we start counting
    while (n.classList.contains('wish-airborne')) await nap(120);
    const out = [];
    for (let i = 0; i < 6; i++) {
      tap();
      await nap(150);
      const anims = launchAnims();
      out.push({
        airborne: n.classList.contains('wish-airborne'),
        launching: svg.classList.contains('wish-launch'),
        anims: anims.length,
        dur: anims.length ? Math.round(anims[0].effect.getComputedTiming().duration) : 0
      });
      await nap(flight + 250);                      // wait for it to come back down
      out[i].landed = !n.classList.contains('wish-airborne') && !svg.classList.contains('wish-launch');
    }
    return out;
  }, FLIGHT);
  assert(flights.length === 6 && flights.every(f => f.airborne && f.launching),
    `six taps over six flights, and EVERY ONE launches — a tap is never budget-gated (${JSON.stringify(flights.map(f => f.airborne && f.launching))})`);
  assert(flights.every(f => f.anims === 1 && f.dur === FLIGHT),
    `each is the full authored ${FLIGHT}ms flight, not a stub (${JSON.stringify(flights.map(f => f.dur))})`);
  assert(flights.every(f => f.landed), `and each lands before the next tap (${JSON.stringify(flights.map(f => f.landed))})`);
  // RUN21A item 5: the ONLY remaining guard is in-flight. A tap while the rocket is up must be
  // ignored — it neither restarts the flight nor double-fires it. (CSS gives .wish-airborne
  // pointer-events:none too; a dispatched event bypasses hit-testing, so this proves the JS guard.)
  const midflight = await page.evaluate(async (flight) => {
    const n = [...document.querySelectorAll('.t-item')].find(x => x.dataset.item === 'wish_rocket');
    const svg = n.querySelector('svg');
    const nap = ms => new Promise(x => setTimeout(x, ms));
    const tap = () => { const r = n.getBoundingClientRect(); for (const type of ['pointerdown', 'pointerup']) n.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 })); };
    const launchAnims = () => svg.getAnimations().filter(a => a.animationName === 'wish-launch');
    tap();
    await nap(900);
    const before = { n: launchAnims().length, t: Math.round(launchAnims()[0] ? launchAnims()[0].currentTime : -1) };
    tap();                                          // the interrupting tap, mid-flight
    await nap(200);
    const after = { n: launchAnims().length, t: Math.round(launchAnims()[0] ? launchAnims()[0].currentTime : -1) };
    await nap(flight);                              // the original schedule, not an extended one
    return { before, after, stillUp: n.classList.contains('wish-airborne') };
  }, FLIGHT);
  assert(midflight.before.n === 1 && midflight.after.n === 1,
    `a tap DURING flight does not double-fire it (${midflight.before.n} then ${midflight.after.n} launch animations)`);
  assert(midflight.after.t > midflight.before.t,
    `nor restart it — the flight clock kept running (${midflight.before.t}ms then ${midflight.after.t}ms, a restart would read ~200)`);
  assert(!midflight.stillUp, 'and the ignored tap never extends the flight — it lands on its own schedule');
  await ctx.close();
}

console.log('== W1: FOOD with no Boo in the area hops and whispers, once ==');
{
  const items = [{ zone: 'meadow', x: 0.12, row: 1, item: 'wish_cake' }];
  const { ctx, page } = await boot({ town: { areas: { meadow: { items, paths: [] } } } });
  await openArea(page);
  const res = await page.evaluate(async () => {
    const n = [...document.querySelectorAll('.t-item')].find(x => x.dataset.item === 'wish_cake');
    const r = n.getBoundingClientRect();
    for (const type of ['pointerdown', 'pointerup']) n.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }));
    await new Promise(x => setTimeout(x, 300));
    return { hint: (document.querySelector('.town-hint-bar') || {}).textContent, menu: !!document.querySelector('.plot-menu') };
  });
  assert(!res.menu, 'still not the item menu');
  assert(res.hint === 'Pop a Boo nearby first!', `and the authored whisper, verbatim (${res.hint})`);
  await ctx.close();
}

console.log('== W1: reduced motion renders static but KEEPS the tap verbs ==');
{
  const items = [
    { zone: 'meadow', x: 0.06, row: 1, plane: 'sky', item: 'wish_sun' },
    { zone: 'meadow', x: 0.14, row: 1, item: 'wish_trophy' }
  ];
  const { ctx, page } = await boot({ town: { areas: { meadow: { items, paths: [] } } } }, { reducedMotion: 'reduce' });
  await openArea(page);
  const still = await page.evaluate(async () => {
    const anims = [...document.querySelectorAll('.t-wish, .t-wish svg')].map(n => getComputedStyle(n).animationName);
    const n = [...document.querySelectorAll('.t-item')].find(x => x.dataset.item === 'wish_trophy');
    const r = n.getBoundingClientRect();
    for (const type of ['pointerdown', 'pointerup']) n.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }));
    await new Promise(x => setTimeout(x, 250));
    return { anims, menu: !!document.querySelector('.plot-menu') };
  });
  assert(still.anims.every(a => a === 'none'), `every wish animation is off (${JSON.stringify([...new Set(still.anims)])})`);
  assert(!still.menu, 'and the tap STILL runs the verb rather than falling back to the menu');
  await ctx.close();
}

console.log('== W1: only the sky wishes are outdoor-only ==');
{
  const { ctx, page } = await boot();
  const rules = await page.evaluate(async () => {
    const w = await import('./js/wishlife.js');
    return {
      sun: w.wishNeedsSky('wish_sun'), kite: w.wishNeedsSky('wish_kite'), balloon: w.wishNeedsSky('wish_balloon'),
      teapot: w.wishNeedsSky('wish_teapot'), book: w.wishNeedsSky('wish_book')
    };
  });
  assert(rules.sun && rules.kite && rules.balloon, 'the sky items and the two tethered flyers need sky');
  assert(!rules.teapot && !rules.book, 'a teapot or a book places in a room like anything else');
  assert([...OUTDOOR_ONLY].length === 7, `seven outdoor-only wishes in all (${[...OUTDOOR_ONLY].join(', ')})`);
  await ctx.close();
}

// ---- W2: area character ---------------------------------------------------------------
console.log('== W2: every area mounts its own ambient, and interiors never mount weather ==');
{
  const areas = { meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] },
    beach: { items: [], paths: [] }, playground: { items: [], paths: [] }, funfair: { items: [], paths: [] },
    boohouse: { items: [], paths: [] } };
  const { ctx, page } = await boot({ town: { areas }, stars: { total: 500, byType: { creative: 20, maths: 0, word: 0, puzzle: 0, lesson: 0 }, spent: { creative: 0, maths: 0, word: 0, puzzle: 0, lesson: 0, legacy: 0 }, legacy: 0, byGame: {} } });
  const seen = {};
  for (const a of ['meadow', 'riverside', 'hilltop', 'beach', 'playground', 'funfair']) {
    await openArea(page, a);
    seen[a] = await page.evaluate(() => {
      const amb = document.querySelector('.t-ambient');
      return amb ? { cls: amb.className, nodes: amb.querySelectorAll('i').length,
        anims: [...amb.querySelectorAll('i')].map(n => getComputedStyle(n).animationName).filter(x => x !== 'none').length } : null;
    });
  }
  for (const [a, v] of Object.entries(seen)) {
    assert(v && v.nodes > 0, `${a} mounts an ambient (${JSON.stringify(v)})`);
    assert(v && new RegExp('amb-' + a).test(v.cls), `${a}'s ambient is its OWN (${v && v.cls})`);
  }
  assert(seen.meadow.nodes >= 3, `the Meadow gets two grass patches and a seed (${seen.meadow.nodes} nodes)`);
  assert(seen.riverside.nodes >= 3, `the Riverside gets two shimmer stripes and a duck pair (${seen.riverside.nodes})`);
  // interiors: their own life, and NEVER weather
  await page.evaluate(() => window.BooTown.go('town', { area: 'boohouse', room: 'lounge' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(400);
  const inside = await page.evaluate(() => ({
    amb: !!document.querySelector('.t-ambient.amb-room'),
    weather: document.querySelectorAll('.t-weather').length,
    motes: !!document.querySelector('.amb-motes')
  }));
  assert(inside.amb && inside.motes, `the Lounge gets dust motes in its sunbeam (${JSON.stringify(inside)})`);
  assert(inside.weather === 0, 'and an interior mounts NO weather — there is no sky to rain from');
  await ctx.close();
}

console.log('== W2: a signature fires from its own tap, and only from there ==');
{
  const { ctx, page } = await boot({ town: { areas: { riverside: { items: [], paths: [] } } },
    stars: { total: 500, byType: { creative: 20, maths: 0, word: 0, puzzle: 0, lesson: 0 }, spent: { creative: 0, maths: 0, word: 0, puzzle: 0, lesson: 0, legacy: 0 }, legacy: 0, byGame: {} } });
  await openArea(page, 'riverside');
  const res = await page.evaluate(async () => {
    const vp = document.querySelector('.t-viewport');
    const r = vp.getBoundingClientRect();
    const fire = async (yFrac) => {
      document.querySelectorAll('.t-skip').forEach(n => n.remove());
      vp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 300, clientY: r.top + r.height * yFrac, pointerId: 1 }));
      await new Promise(x => setTimeout(x, 160));
      const n = document.querySelectorAll('.t-skip').length;
      vp.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + 300, clientY: r.top + r.height * yFrac, pointerId: 1 }));
      return n;
    };
    const onWater = await fire(0.45);
    const onGrass = await fire(0.88);
    return { onWater, onGrass, hint: (document.querySelector('.town-hint-bar') || {}).textContent };
  });
  assert(res.onWater === 3, `tapping the WATER skips a stone three times (${res.onWater} bounces)`);
  assert(res.onGrass === 0, `and tapping the grass does not — a miss falls through to the normal pan (${res.onGrass})`);
  await ctx.close();
}

// ---- W3: costume sets ----------------------------------------------------------------
console.log('== W3: every set maps to an idle, and removing the set removes it ==');
{
  const { ctx, page } = await boot();
  const sets = await page.evaluate(async () => {
    const cat = await import('./data/catalogue.js');
    const ids = ['acc_set_police', 'acc_set_builder', 'acc_set_chef', 'acc_set_explorer', 'acc_set_astronaut', 'acc_set_pirate'];
    return ids.map(id => ({ id, idle: (cat.BY_ID[id] || {}).idle || null, walk: (cat.BY_ID[id] || {}).walk || null }));
  });
  for (const s of sets) assert(!!s.idle, `${s.id} has an idle (${s.idle})`);
  assert(sets.find(s => s.id === 'acc_set_police').idle === 'salute', 'police salutes');
  assert(sets.find(s => s.id === 'acc_set_explorer').idle === 'scan', 'explorer scans');
  assert(sets.find(s => s.id === 'acc_set_pirate').idle === 'spyglass', 'pirate uses the spyglass (RUN20 W3 supersedes RUN13\'s wave)');
  assert(sets.find(s => s.id === 'acc_set_astronaut').walk === 'lowgravity', 'the astronaut walks the moon');
  const removed = await page.evaluate(async () => {
    const acc = await import('./js/accessories.js');
    const st = window.BooTown.State;
    st.mutate(s => { s.inventory.acc_set_pirate = 1; });
    acc.equipSet('boo_inky', 'acc_set_pirate');
    const on = acc.costumeFor('boo_inky');
    acc.unequip('boo_inky');
    const off = acc.costumeFor('boo_inky');
    return { on: on && on.id, off: off && off.id };
  });
  assert(removed.on === 'acc_set_pirate', `wearing the full set gives the costume (${removed.on})`);
  assert(!removed.off, 'and taking it off takes the behaviour with it');
  await ctx.close();
}

console.log('== W3: no set changes any game or reward value ==');
{
  const { ctx, page } = await boot();
  const src = await page.evaluate(async () => {
    const cat = await fetch('./data/catalogue.js', { cache: 'no-store' }).then(r => r.text());
    const sets = cat.split('\n').filter(l => /acc_set_/.test(l));
    return sets.map(l => ({
      set: (l.match(/id: '(acc_set_[a-z]+)'/) || [])[1],
      // a behaviour field is fine; anything that smells of scoring is not
      scoring: /stars\s*:|reward\s*:|meter\s*:|bonus\s*:|multiplier/.test(l)
    }));
  });
  assert(src.length >= 6 && src.every(x => !x.scoring),
    `no costume set carries a scoring field (${JSON.stringify(src.filter(x => x.scoring))})`);
  await ctx.close();
}

// ---- W4: the map ----------------------------------------------------------------------
console.log('== W4: map labels are cream pill chips, ink text, contrast-checked ==');
{
  const { ctx, page } = await boot();
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.map-badge');
  const labels = await page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    return [...document.querySelectorAll('.mb-label')].map(n => {
      const cs = getComputedStyle(n);
      const l1 = lum(cs.color), l2 = lum(cs.backgroundColor);
      return { text: n.textContent, ratio: +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2), radius: cs.borderRadius, bg: cs.backgroundColor };
    });
  });
  assert(labels.length >= 8, `every area has a label (${labels.length})`);
  const worst = Math.min(...labels.map(l => l.ratio));
  assert(worst >= 4.5, `the worst label passes the contrast law (${worst}:1 — ${JSON.stringify(labels.find(l => l.ratio === worst))})`);
  assert(labels.every(l => parseFloat(l.radius) >= 100 || l.radius.includes('999')), `and they are PILL chips (${labels[0].radius})`);
  const flourishes = await page.evaluate(() => {
    const badges = [...document.querySelectorAll('.map-badge:not(.locked)')];
    return badges.map(b => {
      const f = b.querySelector('.mb-flourish');
      if (!f) return { area: b.className, none: true };
      const kids = [...f.querySelectorAll('i')];
      return { nodes: kids.length, anims: kids.map(k => getComputedStyle(k).animationName), dur: kids.map(k => getComputedStyle(k).animationDuration) };
    });
  });
  assert(flourishes.every(f => !f.none), 'every unlocked badge carries a flourish');
  assert(flourishes.every(f => f.nodes <= 3), `at most three nodes per badge (${JSON.stringify(flourishes.map(f => f.nodes))})`);
  assert(flourishes.every(f => f.dur.every(d => d === '6s')), `on the shared 6s loop (${JSON.stringify([...new Set(flourishes.flatMap(f => f.dur))])})`);
  await ctx.close();
}

console.log('== W4: reduced motion stills the flourishes ==');
{
  const { ctx, page } = await boot({}, { reducedMotion: 'reduce' });
  await page.evaluate(() => window.BooTown.go('worldmap'));
  await page.waitForSelector('.map-badge');
  const anims = await page.evaluate(() => [...document.querySelectorAll('.mb-flourish i')].map(n => getComputedStyle(n).animationName));
  assert(anims.length > 0 && anims.every(a => a === 'none'), `every flourish is static (${JSON.stringify([...new Set(anims)])})`);
  await ctx.close();
}

console.log('== W4: day, dusk and night are genuinely different skies ==');
{
  // The historic "everything is night" report was a night-time test. This photographs the sky
  // region at 10:00, 17:00 and 21:00 and requires each pair to differ by a real mean channel
  // delta — so "daytime is warm and bright" is evidence, not an assertion.
  const shots = {};
  for (const hour of [10, 17, 21]) {
    const { ctx, page } = await boot({ town: { areas: { meadow: { items: [], paths: [] } } } }, { hour });
    await openArea(page);
    await sleep(500);
    const box = await page.evaluate(() => {
      const vp = document.querySelector('.t-viewport').getBoundingClientRect();
      return { x: Math.round(vp.left + 40), y: Math.round(vp.top + 8), width: 400, height: Math.round(vp.height * 0.22) };
    });
    shots[hour] = await page.screenshot({ clip: box });
    await ctx.close();
  }
  // mean channel delta between two PNGs, decoded in the browser (no image library needed)
  const { ctx, page } = await boot();
  const deltas = await page.evaluate(async (b64) => {
    const load = (d) => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + d; });
    const pix = async (d) => {
      const img = await load(d);
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    };
    const a = await pix(b64['10']), b = await pix(b64['17']), c = await pix(b64['21']);
    const mean = (p, q) => { let s = 0, n = 0; for (let i = 0; i < p.length; i += 4) { s += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]); n += 3; } return +(s / n).toFixed(2); };
    const bright = (p) => { let s = 0, n = 0; for (let i = 0; i < p.length; i += 4) { s += (p[i] + p[i + 1] + p[i + 2]) / 3; n++; } return +(s / n).toFixed(1); };
    return { dayDusk: mean(a, b), duskNight: mean(b, c), dayNight: mean(a, c), brightDay: bright(a), brightNight: bright(c) };
  }, { '10': shots[10].toString('base64'), '17': shots[17].toString('base64'), '21': shots[21].toString('base64') });
  await ctx.close();
  assert(deltas.dayDusk >= 12, `day vs dusk differ (mean channel delta ${deltas.dayDusk})`);
  assert(deltas.duskNight >= 12, `dusk vs night differ (${deltas.duskNight})`);
  assert(deltas.dayNight >= 12, `day vs night differ (${deltas.dayNight})`);
  assert(deltas.brightDay > deltas.brightNight + 30,
    `and DAYTIME IS THE BRIGHT ONE — the thing the historic report never checked (day ${deltas.brightDay} vs night ${deltas.brightNight})`);
}

console.log('== W4: the ?hour= override is QA-gated and can never be reached by a child ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE({ town: { areas: { meadow: { items: [], paths: [] } } } })));
  await page.goto(BASE + '/index.html?hour=2', { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await sleep(400);
  const band = await page.evaluate(() => window.__townLife.skyBand());
  const real = new Date().getHours();
  assert(band !== 'night' || real >= 19 || real < 7,
    `?hour=2 WITHOUT the QA flag is ignored — the sky follows the real clock (band ${band} at ${real}:00)`);
  const withFlag = await page.evaluate(async () => {
    window.__bootownQA = true;
    window.BooTown.go('town', { area: 'meadow' });
    await new Promise(r => setTimeout(r, 500));
    return window.__townLife.skyBand();
  });
  assert(withFlag !== band || real < 7 || real >= 19, `and WITH the flag it takes effect (band ${withFlag})`);
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
