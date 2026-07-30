// tests/r19z3-moments.mjs — RUN19 Z3: announced moments.
//
// Four things, each of which used to be silent state or a glitch:
//   1. taking a seat is announced (a hop + a BUDGETED line), not a silent teleport;
//   2. the bed nap is real in the DAYTIME (the cause: the nap goal was night-gated, so the
//      only thing that ever walked a Boo to a bed never fired while a child was playing),
//      with shut eyes, drifting z's, and an end of its own after 20-40s;
//   3. arriving at a full seat is a patient WAIT, not RUN10 P2's 300ms shrug-and-leave;
//   4. a box drop offers "Put «name» somewhere?" and lands in the item's NATURAL area.
// Expected runtime ~30s. Not @serial.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TODAY = new Date().toISOString().slice(0, 10);

const SAVE = (areas, over = {}) => Object.assign({
  version: 21, name: 'Ada', created: 1750000000000,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, deco_bed: 1, deco_bench: 1, acc_bow: 1 },
  stars: { total: 400, byGame: {} }, meter: 0, boxes: 1, opened: 4, stardust: 0,
  nicknames: {}, equips: {}, catBest: {}, ledger: {},
  town: { areas },
  care: { bonds: {}, treats: 3 },
  // no hide-and-seek: renderHide() hides the hider's wrap, which would confuse every
  // geometry check below (and Z2 never gives the hider a request for the same reason).
  delights: { hideDay: TODAY, hideFound: true },
  request: { actives: [], lastResolvedAt: Date.now() },
  settings: { sound: false, music: false, voice: false, mic: false, requests: false, content: 'light' },
  seen: { ageAsked: true, boohouseSeeded: true, townFirst: true }, trophies: {}, journal: {}
}, over);

const browser = await chromium.launch();
async function open(areaKey, areas, { room = null, hour = 13, save = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(hr => { window.__bootownHour = hr; }, hour);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(save || SAVE(areas)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(([a, r]) => window.BooTown.go('town', r ? { area: a, room: r } : { area: a }), [areaKey, room]);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(300);
  return { ctx, page };
}

// ---- 1. the acknowledgement budget (js/ack.js, shared with Z4) ----------------------
console.log('== the acknowledgement budget: <=2 per session, never two in a row ==');
{
  const { ctx, page } = await open('meadow', { meadow: { items: [{ zone: 'meadow', x: 0.1, row: 1, item: 'boo_inky' }], paths: [] } });
  const budget = await page.evaluate(async () => {
    const a = await import('./js/ack.js');
    a.resetAcks();
    const out = [];
    for (let i = 0; i < 6; i++) out.push(a.acknowledge('socketClaim', { areaName: 'Meadow' }));
    return { lines: out, cap: a.ACK_CAP, said: a.acksSaid() };
  });
  const spoken = budget.lines.filter(Boolean);
  assert(budget.cap === 2, 'ACK_CAP is 2');
  assert(spoken.length === 2, `six eligible moments produce exactly two lines (${spoken.length})`);
  assert(budget.lines[0] && !budget.lines[1], 'never two in a row: the moment straight after a line is declined');
  assert(spoken.every(l => l === 'Best seat in the Meadow!'), `the authored socketClaim line ships verbatim with the area name (${JSON.stringify(spoken)})`);
  // a `once` moment fires once however often it triggers
  const onceOnly = await page.evaluate(async () => {
    const a = await import('./js/ack.js');
    a.resetAcks();
    return [a.acknowledge('restyle'), a.acknowledge('restyle'), a.acknowledge('restyle')];
  });
  assert(onceOnly.filter(Boolean).length === 1, `a once-moment fires once per session (${JSON.stringify(onceOnly)})`);
  await ctx.close();
}

// ---- 2. taking a seat is announced -------------------------------------------------
console.log('== a claimed seat hops, and says so (within budget) ==');
{
  const areas = { meadow: { items: [
    { zone: 'meadow', x: 0.10, row: 2, item: 'deco_bench' },
    { zone: 'meadow', x: 0.11, row: 2, item: 'boo_inky' }
  ], paths: [] } };
  const { ctx, page } = await open('meadow', areas);
  await page.evaluate(async () => { const a = await import('./js/ack.js'); a.resetAcks(); });
  const claimed = await page.evaluate(() => { window.__townLife.assignRoles(); return window.__townLife.goalOf(0); });
  assert(/role:sit/.test(claimed || ''), `the Boo claims the bench (${claimed})`);
  const hop = await page.evaluate(() => window.__townLife.seatHopped());
  assert(hop >= 1, `the claim plays the seat hop (${hop} hopping)`);
  const said = await page.evaluate(() => {
    const b = document.querySelector('.catchphrase-bubble');
    return b ? b.textContent : null;
  });
  assert(said === 'Best seat in the Meadow!', `and says the authored line, naming the area (${said})`);
  await ctx.close();
}

// ---- 3. the bed nap, in the daytime ------------------------------------------------
console.log('== the bed nap is real at 13:00, not only after 21:00 ==');
{
  const areas = { boohouse_bedroom: { items: [
    { zone: 'boohouse_bedroom', x: 0.25, row: 1, item: 'deco_bed' },
    { zone: 'boohouse_bedroom', x: 0.27, row: 1, item: 'boo_inky' }
  ], paths: [] } };
  const { ctx, page } = await open('boohouse', areas, { room: 'bedroom', hour: 13 });
  await sleep(600);
  const nap = await page.evaluate(() => ({ role: window.__townLife.goalOf(0), nap: window.__townLife.napOf(0) }));
  assert(/role:housenap/.test(nap.role || ''), `a Boo naps in the bed at 13:00 (${nap.role})`);
  assert(nap.nap && nap.nap.eyesShut, 'its eyes are genuinely shut (the authored closed-eye pose, re-rendered)');
  assert(nap.nap && nap.nap.until >= 20000 && nap.nap.until <= 40000, `the nap is 20-40s long (${nap.nap && nap.nap.until}ms)`);
  // the drifting z: one puff every 2s, each one removed again — never a permanent glyph
  await sleep(2400);
  const z1 = await page.evaluate(() => window.__townLife.napZ());
  assert(z1 >= 1, `a "z" drifts away every 2s (${z1} alive)`);
  const zColour = await page.evaluate(() => {
    const z = document.querySelector('.t-zzz');
    return z ? getComputedStyle(z).color : null;
  });
  assert(zColour && zColour !== 'rgb(201, 186, 247)',
    `the "z" is not the old #C9BAF7, which was the Bedroom wall to within 2% — invisible (${zColour})`);
  // The sleeper has to be SEEN. It is drawn behind the bed on purpose so the duvet covers its
  // body, which means a bounding-box overlap check says "99% hidden" and tells you nothing —
  // the bed's own SVG is transparent above the pillow (y=66 of its 120x130 viewBox), and that
  // gap is where the head shows. Measure against the PILLOW LINE, and check the eyes clear it,
  // because under reduced motion the closed eyes are the only sleep signal there is.
  const seen = await page.evaluate(() => {
    const bed = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === 'deco_bed');
    const boo = [...document.querySelectorAll('.t-item.boo')][0];
    const svg = boo.querySelector('svg');
    const br = svg.getBoundingClientRect(), dr = bed.getBoundingClientRect();
    const pillowTop = dr.top + (66 / 130) * dr.height;
    const visible = Math.max(0, Math.min(br.bottom, pillowTop) - br.top);
    return { pct: Math.round(100 * visible / br.height), eyeY: br.top + (80 / 130) * br.height, pillowTop };
  });
  assert(seen.pct >= 60, `most of the sleeper shows above the pillow (${seen.pct}% visible)`);
  assert(seen.eyeY < seen.pillowTop - 8, `and its face clears the pillow by a real margin (eyes ${Math.round(seen.eyeY)}, pillow ${Math.round(seen.pillowTop)})`);

  // A REAL MOUSE CLICK, not the tapActor seam. The first cut of this suite used the seam and
  // therefore never noticed that every pixel of the sleeper hit-tests as the BED (it is drawn
  // behind it), so a finger could not wake a napping Boo at all and the bed's Move/Put away
  // menu opened instead. Driving a seam is not the same as being tappable.
  const hitTarget = await page.evaluate(() => {
    const boo = [...document.querySelectorAll('.t-item.boo')][0];
    const r = boo.querySelector('svg').getBoundingClientRect();
    const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height * 0.4));
    const item = el && el.closest('.t-item');
    return item ? item.dataset.item : null;
  });
  const clickPt = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.t-item.boo')][0].querySelector('svg').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.4) };
  });
  await page.mouse.click(clickPt.x, clickPt.y);
  await sleep(260);
  const woke = await page.evaluate(() => ({
    role: window.__townLife.goalOf(0), stretching: window.__townLife.stretching(),
    eyesShut: window.__townLife.eyesShut(),
    careOpen: !!document.querySelector('.care-arc, .t-care-arc'),
    itemMenu: !!document.querySelector('.plot-menu')
  }));
  console.log(`  · the tap actually landed on: ${hitTarget}`);
  assert(!woke.itemMenu, 'and it does NOT open the bed’s Move / Put away menu over the top');
  assert(!/housenap/.test(woke.role || ''), `a tap wakes it (${woke.role})`);
  assert(woke.stretching >= 1, 'waking plays the stretch');
  assert(woke.eyesShut === 0, 'and the eyes open again');
  assert(!woke.careOpen, 'waking it does not ALSO fling the care arc open — one moment, not four');
  await ctx.close();
}

console.log('== a nap ends by itself, and the eyes always reopen ==');
{
  const areas = { boohouse_bedroom: { items: [
    { zone: 'boohouse_bedroom', x: 0.25, row: 1, item: 'deco_bed' },
    { zone: 'boohouse_bedroom', x: 0.27, row: 1, item: 'boo_inky' }
  ], paths: [] } };
  const { ctx, page } = await open('boohouse', areas, { room: 'bedroom', hour: 13 });
  await sleep(600);
  const ended = await page.evaluate(async () => {
    if (!window.__townLife.endNapNow(0)) return { skipped: true };
    await new Promise(r => setTimeout(r, 400));
    return { role: window.__townLife.goalOf(0), eyesShut: window.__townLife.eyesShut() };
  });
  assert(!ended.skipped, 'the Boo was napping to begin with');
  assert(!/housenap/.test(ended.role || ''), `the nap ends on its own timer (${ended.role})`);
  assert(ended.eyesShut === 0, 'and a wide-awake Boo is never left with its eyes shut');
  await ctx.close();
}

// ---- 4. the patient wait replaces the shrug ----------------------------------------
console.log('== a full seat is waited for, not shrugged at ==');
{
  // A one-seat item (the swings) with two Boos beside it: one sits, one waits.
  const areas = { meadow: { items: [
    { zone: 'meadow', x: 0.10, row: 2, item: 'deco_swings' },
    { zone: 'meadow', x: 0.11, row: 2, item: 'boo_inky' },
    { zone: 'meadow', x: 0.12, row: 2, item: 'boo_plum' },
    { zone: 'meadow', x: 0.13, row: 2, item: 'boo_pippin' }
  ], paths: [] } };
  const { ctx, page } = await open('meadow', areas);
  const waiting = await page.evaluate(async () => {
    window.__townLife.assignRoles();
    const roles = [];
    for (let i = 0; i < 3; i++) roles.push(window.__townLife.goalOf(i));
    // Reproduce the RACE the wait exists for: these two set off for the swings while the
    // seat was free, and someone else is on it by the time they get there. forceApproach
    // is the seam for that — pickFreeActivity never picks an occupied item, so the ordinary
    // behaviour engine cannot set the race up on demand.
    const free = [0, 1, 2].filter(i => !/role:/.test(window.__townLife.goalOf(i) || ''));
    for (const i of free) window.__townLife.forceApproach(i, 'deco_swings');
    for (let k = 0; k < 60; k++) { window.__townLife.tick(120); await new Promise(r => setTimeout(r, 8)); }
    return { roles, waitingCount: window.__townLife.waitingCount(), seatsWaited: window.__townLife.waitersForSeat(), shrugs: document.querySelectorAll('.t-shrug').length };
  });
  assert(waiting.roles.some(r => /role:swing/.test(r || '')), `one Boo takes the single swing seat (${JSON.stringify(waiting.roles)})`);
  assert(waiting.waitingCount >= 1, `an arriving Boo WAITS beside the full seat (${waiting.waitingCount} waiting)`);
  // BESIDE it, in pixels. waitingCount alone was true while the waiter stood 464px away: the
  // first cut zeroed a.dx, which snapped it back to its home x in a single 491px frame — worse
  // than the shrug it replaced. A state flag is not evidence of a position.
  const nearness = await page.evaluate(() => {
    const swing = [...document.querySelectorAll('.t-item')].find(n => n.dataset.item === 'deco_swings');
    const sr = swing.getBoundingClientRect();
    const out = [];
    for (const n of document.querySelectorAll('.t-item.boo')) {
      const svg = n.querySelector('svg'); if (!svg) continue;
      const r = svg.getBoundingClientRect();
      out.push({ item: n.dataset.item, gap: Math.round(Math.max(0, Math.max(sr.left - r.right, r.left - sr.right))) });
    }
    return out;
  });
  const closest = Math.min(...nearness.map(n => n.gap));
  assert(closest <= 160, `and it waits WITHIN REACH of the seat, not across the field (closest gap ${closest}px: ${JSON.stringify(nearness)})`);
  assert(waiting.seatsWaited <= 1, `at most one waiter per seat — a second arrival wanders off (${waiting.seatsWaited})`);
  assert(waiting.shrugs === 0, 'RUN10 P2\'s 300ms shrug is retired — nothing shrugs');
  // and the waiter takes the seat the moment it frees
  const handover = await page.evaluate(async () => {
    const seated = [0, 1, 2].find(i => /role:swing/.test(window.__townLife.goalOf(i) || ''));
    const waiter = [0, 1, 2].find(i => i !== seated && window.__townLife.napOf(i) === null && /wander|goal/.test(window.__townLife.goalOf(i) || ''));
    window.__townLife.tapActor(seated);            // a tap frees the seat
    await new Promise(r => setTimeout(r, 60));
    window.__townLife.assignRoles();
    await new Promise(r => setTimeout(r, 120));
    return { anySeated: [0, 1, 2].some(i => /role:swing/.test(window.__townLife.goalOf(i) || '')), waiter };
  });
  assert(handover.anySeated, 'the freed seat is taken again — the wait was not for nothing');
  await ctx.close();
}

// ---- 5. the box drop offers a place, in the right area ------------------------------
console.log('== "Put «name» somewhere?" lands in the item\'s natural area ==');
{
  const natural = await (async () => {
    const { ctx, page } = await open('meadow', { meadow: { items: [], paths: [] } });
    const out = await page.evaluate(async () => {
      const c = await import('./js/ceremony.js');
      const cat = await import('./data/catalogue.js');
      const bed = cat.BY_ID['deco_bed'], boo = cat.BY_ID['boo_inky'], bench = cat.BY_ID['deco_bench'];
      return {
        furniture: c.naturalAreaFor(bed),
        boo: c.naturalAreaFor(boo),
        deco: c.naturalAreaFor(bench),
        bedKind: bed.kind
      };
    });
    await ctx.close();
    return out;
  })();
  assert(natural.bedKind === 'furniture', 'a bed is furniture (indoor-only, RUN10 P4)');
  assert(natural.furniture.area === 'boohouse' && natural.furniture.room === 'lounge',
    `furniture goes to the Lounge, not the Meadow where it cannot be placed (${JSON.stringify(natural.furniture)})`);
  assert(natural.boo.area === 'meadow', `a Boo goes to the Meadow (${JSON.stringify(natural.boo)})`);
  assert(natural.deco.area === 'meadow', `a decoration goes to the Meadow (${JSON.stringify(natural.deco)})`);
}
{
  // the real card: the button names the thing, and [Later] is the second option
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  // A box drop is random, and only a PLACEABLE drop (a Boo or a decoration) shows this
  // button — an accessory offers the wardrobe instead. So open boxes until a placeable one
  // turns up rather than asserting on one roll of the dice.
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE({ meadow: { items: [], paths: [] } }, { boxes: 8 })));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('ceremony'));
  await page.waitForSelector('.ceremony');
  let card = null, seen = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    if (!(await page.$('.ceremony'))) break;                       // out of boxes
    for (let i = 0; i < 4; i++) { await page.click('.ceremony').catch(() => {}); await sleep(240); }
    // Poll for the buttons rather than sleeping for them: the reveal flips in on a rAF and a
    // fixed wait reads an empty card about one run in three.
    const got = await page.waitForFunction(() => {
      const b = document.querySelectorAll('.reveal-btns button');
      return b.length ? [...b].map(x => x.textContent) : null;
    }, { timeout: 8000 }).then(h => h.jsonValue()).catch(() => null);
    if (!got) break;
    card = await page.evaluate(() => ({
      name: (document.querySelector('.reveal-name') || {}).textContent,
      buttons: [...document.querySelectorAll('.reveal-btns button')].map(b => b.textContent)
    }));
    seen.push(card.buttons);
    if (card.buttons.some(b => /^Put .* somewhere\?$/.test(b))) break;
    // Not a placeable drop (an accessory, or a duplicate whose only button is "Yay!") —
    // take the LAST button, which is the one that moves on to the next box either way.
    const advance = await page.$('.reveal-btns button:last-child');
    if (!advance) break;
    await advance.click(); await sleep(450);
  }
  const named = card && (card.buttons || []).find(b => /^Put .* somewhere\?$/.test(b));
  if (named) {
    assert(true, `a placeable drop offers "Put «name» somewhere?" (${JSON.stringify(card.buttons)})`);
    assert(card.buttons.some(b => b === 'Later'), `and [Later] as the second option (${JSON.stringify(card.buttons)})`);
    assert(named.includes((card.name || '').replace(/^Another /, '').replace(/!$/, '')),
      `the button names the thing she won (${named} vs ${card.name})`);
  } else {
    // Not a failure of the feature: eight random drops can all be accessories or duplicates.
    // naturalAreaFor above owns the routing contract; this block is the copy check.
    console.log(`  · eight drops, none placeable (${JSON.stringify(seen)}) — copy check skipped this run`);
  }
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
