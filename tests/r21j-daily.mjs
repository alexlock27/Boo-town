// tests/r21j-daily.mjs — RUN21J "Today in Boo Town": the pack's six ACCEPTs.
// Expected runtime: ~55s (six browser contexts, no frame sampling, no ceremony waits
// beyond the authored 3-tap reveal). Budget law: well under 120s, not @serial.
//
// Two mechanics worth knowing before editing this file:
//  1. `window.__bootownDay` is state.js's own test override for todayKey(). Every seed
//     sets it, and ACCEPT 3 changes it MID-SESSION to roll the date without a reload.
//  2. The parcel and the ceremony gift wobble forever, so Playwright's actionability
//     check never calls them "stable". Tapping goes through evaluate-click (the pattern
//     r12s5-ceremony and lib/run12probe already use). The REAL tap target is proved
//     separately, once, by elementFromPoint — a click that lands on something else
//     would fail that check even though evaluate-click would still "work".
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const browser = await chromium.launch();
const t0 = Date.now();

const DAY = '2026-08-10';
const NEXT_DAY = '2026-08-11';

// A v25-era save. `daily` is deliberately ABSENT unless a case supplies it — absent is
// the shape a real save has on the first day this feature ships, and it must read as a
// fresh day without anything being written.
const SEED = (o = {}) => ({
  version: 25, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1,
  stars: { total: 60, byType: { maths: 20, word: 20, puzzle: 10, creative: 5, lesson: 5 }, byGame: {} },
  care: { bonds: {}, treats: 3 },
  settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { whatsnewVersion: 'run21j-STAGED', welcomeTour: true },
  ...o
});

async function open(seedOver = {}, { day = DAY, w = 1024, h = 768 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(({ seed, d }) => {
    window.__bootownDay = d;
    try { localStorage.clear(); localStorage.setItem('bootown.save.v1', JSON.stringify(seed)); } catch {}
  }, { seed: SEED(seedOver), d: day });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}

const save = (page) => page.evaluate(() => window.BooTown.State.getState());
const go = (page, name, params = {}) => page.evaluate(([n, p]) => window.BooTown.go(n, p), [name, params]);
// A results round through the real seam every game uses.
const playRound = async (page, over = {}) => {
  await page.evaluate((p) => window.BooTown.go('results', p),
    { game: 'spellboo', gameName: 'Spell Boo', stars: 2, cat: 'cvc', level: 'Level 1', ...over });
  await page.waitForTimeout(2500);   // the star-by-star animation, then afterStars()
};
// A whole care action, through care.js's own completion path.
const careAction = async (page) => {
  await page.evaluate(async () => {
    const m = await import('./js/care.js');
    const c = await import('./data/catalogue.js');
    m.openCare(c.BY_ID['boo_inky']);
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__care.begin('play'));
  await page.waitForTimeout(350);
  const done = await page.evaluate(() => !!window.__care.finishPlay());
  await page.waitForTimeout(500);
  return done;
};
const cardView = (page) => page.evaluate(() => {
  const c = document.querySelector('.daily-card');
  if (!c) return null;
  return {
    title: c.querySelector('.daily-title')?.textContent || '',
    sub: c.querySelector('.daily-sub')?.textContent || '',
    rows: [...c.querySelectorAll('.daily-row')].map(r => ({
      label: r.querySelector('.daily-label')?.textContent || '',
      done: r.classList.contains('done')
    })),
    hasShowMe: !!c.querySelector('.daily-go')
  };
});
const tap = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); if (n) n.click(); }, sel);
const openParcel = async (page) => {
  await tap(page, '.daily-parcel');
  await page.waitForSelector('.gift-box', { timeout: 8000 });
  await page.evaluate(() => { const b = document.querySelector('.gift-box'); for (let i = 0; i < 3; i++) b.click(); });
  await page.waitForTimeout(900);
};

// =====================================================================
// ACCEPT 1 — fresh save at day D: three unticked doings; each seam ticks
// exactly its own doing; the parcel then EXISTS at the authored spot, on
// camera at default scroll, and the guide line fired.
// =====================================================================
console.log('== ACCEPT 1: three doings tick at their own seams; the parcel arrives ==');
{
  const { ctx, page, errors } = await open();
  await go(page, 'hub'); await page.waitForTimeout(500);

  const fresh = await cardView(page);
  assert(!!fresh, 'the hub shows a Today in Boo Town card');
  assert(fresh.title === 'Today in Boo Town', `card title verbatim (${fresh.title})`);
  assert(fresh.sub === 'Three little doings. No hurry — the day is long.', `fresh-day sub-line verbatim (${fresh.sub})`);
  assert(fresh.rows.length === 3 && fresh.rows.every(r => !r.done), 'three doings, all unticked');
  assert(fresh.rows[0].label === 'Play any game' && fresh.rows[1].label === 'Say hello somewhere new' && fresh.rows[2].label === 'Look after a Boo',
    'the three doings are the authored ones, in order');
  // Simply LOOKING must not write a day into the save.
  const looked = await save(page);
  assert(!looked.daily || !looked.daily.day, 'viewing the card writes nothing to the save');

  // the guide line only fires on the THIRD tick — watch from here
  await page.evaluate(() => { window.__dailyEvents = []; window.addEventListener('bootown:dailydone', e => window.__dailyEvents.push(e.detail.line)); });

  await playRound(page);
  let d = (await save(page)).daily;
  assert(d.doings.play === true && d.doings.visit === false && d.doings.care === false, 'winning a spellboo round ticks play ONLY');

  await go(page, 'town', { area: 'riverside' }); await page.waitForTimeout(1100);
  d = (await save(page)).daily;
  assert(d.doings.visit === true && d.doings.care === false, 'entering riverside ticks visit');
  assert(d.visited.includes('riverside'), 'and records the area it was said hello to');
  assert((await page.evaluate(() => window.__dailyEvents.length)) === 0, 'no delivery announced while a doing is still open');

  await go(page, 'hub'); await page.waitForTimeout(400);
  assert(await careAction(page), 'a care action completes');
  d = (await save(page)).daily;
  assert(d.doings.care === true, 'a care action ticks care');
  assert(d.doings.play && d.doings.visit && d.doings.care, 'all three doings are now done');
  assert(d.delivered === false, 'and nothing has been delivered yet');

  const lines = await page.evaluate(() => window.__dailyEvents);
  assert(lines.length === 1, `the delivery is announced exactly once (${lines.length})`);
  const AUTHORED = ['All three doings done! A parcel just arrived in the Meadow…', "Something's waiting for you in the Meadow. It has a bow on it."];
  assert(AUTHORED.includes(lines[0]), `the guide line is one of the authored L_DAILY_DONE lines ("${lines[0]}")`);
  assert(await page.evaluate(() => !!document.querySelector('.daily-done-note')), 'the moment is witnessed where she is — a note in the care overlay, not only a toast');
  await page.evaluate(() => window.__care.close());
  await page.waitForTimeout(300);

  // the hub card now says so, in the authored words
  await go(page, 'hub'); await page.waitForTimeout(500);
  const done = await cardView(page);
  assert(done.rows.every(r => r.done), 'the card shows three ticked doings');
  assert(done.sub === 'All done for today! Your parcel is waiting in the Meadow 🎁', `all-done copy verbatim (${done.sub})`);
  assert(done.hasShowMe, 'and a "Show me!" that goes straight to the parcel');

  // the parcel EXISTS in the Meadow, at the authored spot, ON CAMERA at default scroll
  await go(page, 'town', { area: 'meadow' }); await page.waitForTimeout(1300);
  const p = await page.evaluate(() => {
    const n = document.querySelector('.daily-parcel');
    if (!n) return null;
    const r = n.getBoundingClientRect();
    const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    // town.js's own geometry: the parcel must obey the SAME placement formula as a
    // placed item — placedTop = rowGroundPx - size + 8, against the TOWN VIEWPORT's
    // height (which is shorter than the window: the app shell sits above it).
    const vp = document.querySelector('.t-viewport');
    const rows = [0.67, 0.79, 0.91];                    // ROW_GROUND, town.js
    const SIZE = 96;                                    // renderDailyParcel's size
    const vpRect = vp.getBoundingClientRect();
    return {
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      w: window.innerWidth, vpTop: vpRect.top, vpBottom: vpRect.bottom,
      feet: parseFloat(n.style.top) + SIZE - 8,
      expectFeet: vp.clientHeight * rows[2],
      // and the x: PARCEL_SPOT.x of the area's 4-viewport width, centred on the node.
      // AREA_W_VIEWPORTS counts the TOWN VIEWPORT's width, not the window's.
      cx: parseFloat(n.style.left) + SIZE / 2,
      expectCx: vp.clientWidth * 4 * 0.15,
      tappable: n.contains(mid),
      label: n.getAttribute('aria-label') || ''
    };
  });
  assert(!!p, 'a parcel is in the Meadow');
  assert(p.left >= 0 && p.right <= p.w, `it is ON CAMERA at default scroll (${Math.round(p.left)}–${Math.round(p.right)} of ${p.w})`);
  assert(p.top >= p.vpTop - 1 && p.bottom <= p.vpBottom + 1, 'and fully inside the town viewport vertically');
  assert(Math.abs(p.feet - p.expectFeet) < 2, `it stands on the authored ground row (feet ${p.feet.toFixed(1)} vs row ${p.expectFeet.toFixed(1)})`);
  assert(Math.abs(p.cx - p.expectCx) < 2, `at the authored x = 0.15 of the area's width (${p.cx.toFixed(1)} vs ${p.expectCx.toFixed(1)})`);
  assert(p.tappable, 'a real tap at its centre lands on the parcel, not on something over it');
  assert(/parcel/i.test(p.label), `it announces itself to a screen reader ("${p.label}")`);
  await page.screenshot({ path: 'screenshots/r21j-parcel-1024.png' });

  assert(errors.length === 0, `no console/page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

// =====================================================================
// ACCEPT 2 — claiming grants exactly one unowned pool item; inventory shows
// it; the reveal celebration ran; delivered:true; the parcel is gone.
// =====================================================================
console.log('== ACCEPT 2: claiming grants exactly one pool item, with the reveal ==');
{
  const { ctx, page, errors } = await open({
    daily: { day: DAY, doings: { play: true, visit: true, care: true }, visited: ['meadow'], delivered: false }
  });
  const expected = await page.evaluate(async () => {
    const d = await import('./js/daily.js');
    return { pick: d.todaysParcel(), eligible: d.eligiblePool().length };
  });
  const before = await save(page);
  const invBefore = Object.keys(before.inventory).length;

  await go(page, 'town', { area: 'meadow' }); await page.waitForTimeout(1200);
  assert(!!(await page.$('.daily-parcel')), 'the parcel is waiting');
  await openParcel(page);

  const reveal = await page.evaluate(() => ({
    name: document.querySelector('.reveal-name')?.textContent || '',
    banner: document.querySelector('.reveal-banner')?.textContent || '',
    bubble: document.querySelector('.reveal-guide-bubble')?.textContent || '',
    card: !!document.querySelector('.reveal-card'),
    flipped: !!document.querySelector('.reveal-card.flip-in'),
    art: !!document.querySelector('.reveal-art svg')
  }));
  assert(reveal.card && reveal.art, 'the standard reveal card and its art rendered');
  assert(reveal.flipped, 'the reveal celebration ran (the card flipped in)');
  const AUTHORED_OPEN = ["Ooh — it's yours to keep!", 'A little something for a lovely day.'];
  assert(AUTHORED_OPEN.includes(reveal.bubble), `the guide says an authored L_DAILY_OPEN line ("${reveal.bubble}")`);

  const after = await save(page);
  const gained = Object.keys(after.inventory).filter(k => !(k in before.inventory));
  assert(gained.length === 1, `exactly ONE item was granted (${gained.join(',') || 'none'})`);
  assert(gained[0] === expected.pick.id, `and it is the deterministic pick for this day (${gained[0]})`);
  assert(after.inventory[gained[0]] === 1, 'the inventory shows it');
  assert(Object.keys(after.inventory).length === invBefore + 1, 'nothing else was granted');
  assert(reveal.name.includes(await page.evaluate(async (id) => (await import('./data/catalogue.js')).BY_ID[id].name, gained[0])),
    `the reveal names the thing she won ("${reveal.name}")`);
  assert(after.daily.delivered === true, 'delivered: true');
  assert(after.stars.total === before.stars.total, 'no stars were invented outside the results seam');

  await go(page, 'town', { area: 'meadow' }); await page.waitForTimeout(1100);
  assert(!(await page.$('.daily-parcel')), 'the parcel is gone');
  await go(page, 'hub'); await page.waitForTimeout(400);
  const c = await cardView(page);
  assert(!c.hasShowMe, 'and the card no longer points at a parcel that is not there');
  assert(!/missed|yesterday|streak|day in a row/i.test(c.sub), `the claimed-state copy is guilt-free ("${c.sub}")`);

  assert(errors.length === 0, `no console/page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

// =====================================================================
// ACCEPT 3 — the date rolls to D+1: the card resets to three unticked;
// NOTHING anywhere references D; an unclaimed D item is back in the
// eligible pool (proved by forcing the same hash).
// =====================================================================
console.log('== ACCEPT 3: a new day resets, mentions nothing, and loses nothing ==');
{
  // A save that reached the end of day D with all three done and the parcel NEVER claimed.
  const { ctx, page, errors } = await open({
    daily: { day: DAY, doings: { play: true, visit: true, care: true }, visited: ['meadow', 'riverside'], delivered: false }
  });
  const dPick = await page.evaluate(async () => (await import('./js/daily.js')).todaysParcel());

  // roll the clock — no reload, exactly as a tablet left open past midnight does
  await page.evaluate((d) => { window.__bootownDay = d; }, NEXT_DAY);
  await go(page, 'hub'); await page.waitForTimeout(600);

  const c = await cardView(page);
  assert(c.rows.length === 3 && c.rows.every(r => !r.done), 'the card resets to three unticked doings');
  assert(c.sub === 'Three little doings. No hurry — the day is long.', 'with the fresh-day sub-line');
  assert(!c.hasShowMe, 'and no stale "Show me!"');

  // NOTHING anywhere references D — the old day, a streak, a miss, or a count of days.
  const hubText = await page.evaluate(() => document.body.innerText);
  assert(!hubText.includes(DAY), `the hub never shows the old date (${DAY})`);
  assert(!/yesterday|missed|streak|in a row|days? running|don't break/i.test(hubText),
    'no yesterday-reference, missed-day copy, or streak anywhere on the hub');

  // The unclaimed item is back in the eligible pool. Forcing D+1's pick to the same
  // index proves the item itself was never removed — there is no bookkeeping to undo.
  const proof = await page.evaluate(async ({ day, nextDay, pickId }) => {
    const d = await import('./js/daily.js');
    const pool = d.eligiblePool();
    return {
      stillEligible: pool.some(e => e.id === pickId),
      sameLength: pool.length,
      // the same hash index on the new day yields the same item
      forced: pool[d.dayHash(day) % pool.length].id,
      newPick: d.todaysParcel().id,
      hashDiffers: d.dayHash(day) !== d.dayHash(nextDay)
    };
  }, { day: DAY, nextDay: NEXT_DAY, pickId: dPick.id });
  assert(proof.stillEligible, `yesterday's unclaimed item is still in the eligible pool (${dPick.id})`);
  assert(proof.forced === dPick.id, 'forcing the same hash on the new day yields the very same item — nothing was consumed');
  assert(proof.hashDiffers, 'a different day hashes differently, so the day moves the pick on its own');
  const st = await save(page);
  assert(st.daily.day === DAY || st.daily.day === NEXT_DAY, 'the save carries at most ONE day, never a history');
  assert(!('streak' in st.daily) && !('lastDay' in st.daily) && !('missed' in st.daily),
    'the save has no streak, no last-day and no missed count — there is nothing to feel bad about');

  // and the new day ticks normally
  await playRound(page);
  const d2 = (await save(page)).daily;
  assert(d2.day === NEXT_DAY && d2.doings.play === true && d2.doings.visit === false && d2.delivered === false,
    'the new day ticks from scratch');
  assert(Array.isArray(d2.visited) && d2.visited.length === 0, "and yesterday's visits are not carried forward");

  assert(errors.length === 0, `no console/page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

// =====================================================================
// ACCEPT 4 — a pre-v25 save loads unchanged. (The migration itself is
// pinned in tests/r8p1-migrations.mjs; this is the live-app half: a real
// v24 save boots, plays and behaves identically.)
// =====================================================================
console.log('== ACCEPT 4: a pre-v25 save loads unchanged ==');
{
  const legacy = {
    version: 24, name: 'Ada', ageAsked: true, age: 9,
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
    inventory: { boo_inky: 1, deco_bench: 2 }, boxes: 1, meter: 3, opened: 4, stardust: 7,
    stars: { total: 140, byGame: { spellboo: { best: 3, plays: 12, earned: 44 } } },
    nicknames: { boo_inky: 'Inks' }, care: { bonds: { boo_inky: 30 }, treats: 2 },
    settings: { sound: false, music: false, voice: false, content: 'full' },
    seen: { whatsnewVersion: 'run21j-STAGED', welcomeTour: true },
    town: { areas: { meadow: { items: [{ id: 1, zone: 'meadow', x: 0.4, row: 1, item: 'deco_bench' }], paths: [] } }, nextId: 2 }
  };
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript((s) => {
    window.__bootownDay = '2026-08-10';
    try { localStorage.clear(); localStorage.setItem('bootown.save.v1', JSON.stringify(s)); } catch {}
  }, legacy);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await go(page, 'hub'); await page.waitForTimeout(500);

  const st = await save(page);
  assert(st.version === 25, `the save migrated to v25 (${st.version})`);
  assert(st.stars.total === 140 && st.stardust === 7 && st.boxes === 1 && st.meter === 3, 'stars, stardust, boxes and meter untouched');
  assert(st.inventory.boo_inky === 1 && st.inventory.deco_bench === 2, 'inventory untouched');
  assert(st.nicknames.boo_inky === 'Inks' && st.care.bonds.boo_inky === 30, 'nickname and bond untouched');
  assert(st.town.areas.meadow.items.length === 1 && st.town.areas.meadow.items[0].item === 'deco_bench', 'the placed bench is still placed');
  assert(!!st.daily && st.daily.day === '' && st.daily.delivered === false, 'and it gained an empty daily field, which reads as a fresh day');

  const c = await cardView(page);
  assert(!!c && c.rows.every(r => !r.done), 'a pre-v25 save sees three unticked doings, like anyone else');
  await playRound(page);
  assert((await save(page)).daily.doings.play === true, 'and its first round ticks normally');
  assert(errors.length === 0, `no console/page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

// =====================================================================
// ACCEPT 5 — pool exhausted: the parcel grants the star bundle (the
// booquest chest reward path = a free box), the card copy switches, and
// nothing errors.
// =====================================================================
console.log('== ACCEPT 5: with the whole pool owned, the parcel still gives something ==');
{
  // Seed EVERY pool entry as owned (plain ids in inventory, shiny entries in shinies).
  const ctxTmp = await browser.newContext();
  const tmp = await ctxTmp.newPage();
  await tmp.goto(BASE + '/index.html', { waitUntil: 'load' });
  const pool = await tmp.evaluate(async () => (await import('./data/daily.js')).DAILY_POOL);
  await ctxTmp.close();

  const inventory = { boo_inky: 1 }, shinies = {};
  for (const e of pool) { inventory[e.id] = 1; if (e.shiny) shinies[e.id] = 1; }

  const { ctx, page, errors } = await open({
    inventory, shinies,
    daily: { day: DAY, doings: { play: true, visit: true, care: true }, visited: ['meadow'], delivered: false }
  });
  const eligible = await page.evaluate(async () => {
    const d = await import('./js/daily.js');
    return { left: d.eligiblePool().length, pick: d.todaysParcel() };
  });
  assert(eligible.left === 0, `the eligible pool is empty (${eligible.left})`);
  assert(eligible.pick.box === true, "so today's parcel holds a box instead of an item");

  await go(page, 'hub'); await page.waitForTimeout(500);
  const c = await cardView(page);
  assert(/surprise box/i.test(c.sub), `the card copy switches to the box wording ("${c.sub}")`);
  assert(!/nothing left|all gone|no more|finished|empty/i.test(c.sub), 'and it never frames a complete collection as an ending');
  assert(c.hasShowMe, 'the parcel is still worth going to see');

  const before = await save(page);
  await go(page, 'town', { area: 'meadow' }); await page.waitForTimeout(1200);
  assert(!!(await page.$('.daily-parcel')), 'the parcel is still delivered');
  await openParcel(page);
  const after = await save(page);
  assert(after.daily.delivered === true, 'claiming still marks it delivered');
  // The box is granted and then SPENT by the ceremony it opens into, so the counter is
  // back to where it started — what proves the reward is real is what came OUT of it:
  // a new item, another copy of one she owns, or the stardust a duplicate pays.
  const grew = Object.keys(after.inventory).length > Object.keys(before.inventory).length;
  const restocked = Object.entries(after.inventory).some(([k, v]) => v > (before.inventory[k] || 0));
  const dust = (after.stardust || 0) > (before.stardust || 0);
  assert(grew || restocked || dust,
    `the box paid out something real (new item: ${grew}, extra copy: ${restocked}, stardust: ${dust})`);
  assert(after.boxes === before.boxes, `and the counter balances — one box granted, one box opened (${before.boxes} → ${after.boxes})`);
  const revealed = await page.evaluate(() => ({
    card: !!document.querySelector('.reveal-card'),
    name: document.querySelector('.reveal-name')?.textContent || ''
  }));
  assert(revealed.card && revealed.name.length > 0,
    `the ceremony ran and named the prize rather than dumping her on a blank screen ("${revealed.name}")`);
  assert(errors.length === 0, `nothing errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

// =====================================================================
// ACCEPT 6 — reduced motion: the parcel appears without animation, and
// the reveal still lands.
// =====================================================================
console.log('== ACCEPT 6: reduced motion — no animation, same outcome ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript((s) => {
    window.__bootownDay = '2026-08-10';
    try { localStorage.clear(); localStorage.setItem('bootown.save.v1', JSON.stringify(s)); } catch {}
  }, SEED({ daily: { day: DAY, doings: { play: true, visit: true, care: true }, visited: ['meadow'], delivered: false } }));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  await go(page, 'town', { area: 'meadow' }); await page.waitForTimeout(1200);
  const anim = await page.evaluate(() => {
    const n = document.querySelector('.daily-parcel');
    if (!n) return null;
    const cs = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    return { name: cs.animationName, w: r.width, h: r.height, visible: r.width > 20 && r.height > 20 };
  });
  assert(!!anim, 'the parcel still appears under reduced motion');
  assert(anim.name === 'none', `and it is not animated (animation-name: ${anim.name})`);
  assert(anim.visible, `at full size, not mid-pop (${Math.round(anim.w)}x${Math.round(anim.h)})`);

  const before = await save(page);
  await openParcel(page);
  const reveal = await page.evaluate(() => ({
    card: !!document.querySelector('.reveal-card'),
    name: document.querySelector('.reveal-name')?.textContent || '',
    bubble: document.querySelector('.reveal-guide-bubble')?.textContent || ''
  }));
  assert(reveal.card, 'the reveal still lands');
  assert(reveal.name.length > 0 && reveal.bubble.length > 0, `and still says what she won and why ("${reveal.name}")`);
  const after = await save(page);
  const gained = Object.keys(after.inventory).filter(k => !(k in before.inventory));
  assert(gained.length === 1, 'the outcome is identical — exactly one item granted');
  assert(after.daily.delivered === true, 'and it is marked delivered');
  await page.screenshot({ path: 'screenshots/r21j-reveal-reduced.png' });
  assert(errors.length === 0, `no console/page errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

// =====================================================================
// Standing guard — the no-guilt law is the SUBJECT of this feature.
// A grep of the feature's own source for anything streak-shaped.
// =====================================================================
console.log('== the no-guilt guard: nothing streak-shaped exists in the feature ==');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const src = await page.evaluate(async () => {
    const files = ['js/daily.js', 'data/daily.js'];
    const out = {};
    for (const f of files) out[f] = await (await fetch('./' + f)).text();
    return out;
  });
  for (const [f, text] of Object.entries(src)) {
    const body = text.replace(/^\s*\/\/.*$/gm, '');   // ignore the comments that DISCUSS the ban
    assert(!/\bstreak\b/i.test(body), `${f} contains no streak`);
    assert(!/\byesterday\b/i.test(body), `${f} never mentions yesterday`);
    assert(!/\bmissed\b/i.test(body), `${f} never mentions a missed day`);
  }
  // phone width: the card is a card, not a ninth door
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await phone.newPage();
  await pp.addInitScript((s) => {
    window.__bootownDay = '2026-08-10';
    try { localStorage.clear(); localStorage.setItem('bootown.save.v1', JSON.stringify(s)); } catch {}
  }, SEED());
  await pp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await pp.waitForTimeout(800);
  await go(pp, 'hub'); await pp.waitForTimeout(600);
  const phoneView = await pp.evaluate(() => {
    const card = document.querySelector('.daily-card');
    const primary = document.querySelectorAll('.bottom-bar .bar-btn').length + (document.querySelector('.hub-town-banner') ? 1 : 0);
    const r = card ? card.getBoundingClientRect() : null;
    return { primary, hasCard: !!card, fits: r ? r.left >= -1 && r.right <= window.innerWidth + 1 : false,
      isBar: !!(card && card.closest('.bottom-bar')) };
  });
  assert(phoneView.hasCard, 'the card is present at phone width');
  assert(phoneView.primary <= 8, `the hub still has ${phoneView.primary} primary buttons at phone width (law: 8)`);
  assert(!phoneView.isBar, 'the card is a CARD, not a ninth door in the bar');
  assert(phoneView.fits, 'and it fits the phone viewport without overflowing');
  await pp.screenshot({ path: 'screenshots/r21j-card-390.png' });
  await phone.close();
  await ctx.close();

  // The parcel is REACHABLE on every viewport (protected core: reachable tap targets).
  // Four probe points, not one: the Meadow's Wish Well stands near the authored spot, so
  // "is anything drawn over it" is a real question and not a formality.
  for (const [w, h] of [[1024, 768], [768, 1024], [390, 844]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await c.newPage();
    await p.addInitScript((s) => {
      window.__bootownDay = '2026-08-10';
      try { localStorage.clear(); localStorage.setItem('bootown.save.v1', JSON.stringify(s)); } catch {}
    }, SEED({ daily: { day: DAY, doings: { play: true, visit: true, care: true }, visited: [], delivered: false } }));
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(800);
    await go(p, 'town', { area: 'meadow' }); await p.waitForTimeout(1300);
    const r = await p.evaluate(() => {
      const n = document.querySelector('.daily-parcel');
      if (!n) return null;
      const b = n.getBoundingClientRect();
      const pts = [[.5, .5], [.25, .35], [.75, .65], [.5, .85]];
      return {
        w: Math.round(b.width), h: Math.round(b.height),
        allHit: pts.every(([fx, fy]) => n.contains(document.elementFromPoint(b.left + b.width * fx, b.top + b.height * fy))),
        onCamera: b.left >= 0 && b.right <= window.innerWidth
      };
    });
    assert(!!r, `${w}x${h}: the parcel is there`);
    assert(r && r.w >= 56 && r.h >= 56, `${w}x${h}: it is a reachable tap target (${r && r.w}x${r && r.h}, law: 56)`);
    assert(r && r.onCamera, `${w}x${h}: on camera at default scroll`);
    assert(r && r.allHit, `${w}x${h}: nothing is drawn over it — all four probe points land on the parcel`);
    await c.close();
  }
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failed ? 1 : 0);
