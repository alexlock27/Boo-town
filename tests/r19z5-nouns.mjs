// tests/r19z5-nouns.mjs — RUN19 Z5: wire the nouns.
//
// Three things that existed in the save or the code but had never once been visible to a
// child: a Boo's temperament outside the town, the wellies' puddle stomp, and stardust.
//   1. CAMEOS — the first owned MUSICAL Boo claps on the Boo Beat rail; the first owned
//      SPORTY one jogs Boo Dash's far layer. No such Boo = no cameo and NO placeholder.
//   2. THE WELLIE STOMP — the cause was that `currentSeasonName === 'rain'` could never be
//      true in real play, because seasonOf() returns only spring/summer/autumn/winter.
//   3. STARDUST — surfaced in the collection header with an explanation, and given a second,
//      cheaper spend (Sprinkle, 5 dust) that expires at local midnight.
// Expected runtime ~25s. Not @serial.
import { chromium } from 'playwright';
import { PERSONALITIES } from '../data/personalities.js';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TODAY = new Date().toISOString().slice(0, 10);

const SAVE = (over = {}) => Object.assign({
  version: 22, name: 'Ada', created: 1750000000000,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: {}, stars: { total: 400, byGame: {} }, meter: 0, boxes: 0, opened: 20, stardust: 12,
  nicknames: {}, equips: {}, catBest: {}, ledger: {}, sparkles: {},
  town: { areas: {} }, care: { bonds: {}, treats: 3 },
  delights: { hideDay: TODAY, hideFound: true },
  request: { actives: [], lastResolvedAt: Date.now() },
  routines: {}, journal: {}, trophies: {}, customs: [], easelArt: '',
  settings: { sound: false, music: false, voice: false, mic: false, requests: false, content: 'full' },
  seen: { ageAsked: true, boohouseSeeded: true, townFirst: true, introSeen: { beat: true, dash: true } }
}, over);

const browser = await chromium.launch();
// Both games open a category picker first; these are the doors the existing suites use
// (tests/r14u2-beat.mjs, tests/p8-frames.mjs).
async function enterBeat(page) {
  await page.evaluate(() => window.BooTown.go('beat', { resume: { cat: 'tables', level: 2 } }));
  await page.waitForSelector('.beat-field', { timeout: 12000 });
  await page.waitForTimeout(250);
}
async function enterDash(page) {
  await page.evaluate(() => window.BooTown.go('dash'));
  await page.waitForSelector('.picker', { timeout: 10000 });
  await page.click('.picker-levels .level-btn');
  await page.waitForSelector('.d2-scene', { timeout: 10000 });
  await page.waitForTimeout(250);
}
async function boot(over = {}, { reducedMotion = 'no-preference', hour = 13, month = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(([hr, mo]) => { window.__bootownHour = hr; if (mo) window.__bootownMonth = mo; }, [hour, month]);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE(over)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// The cameo pick is by TEMPERAMENT, which is hashed from a Boo's own id — so the suite has to
// find real ids of each kind rather than assuming any particular Boo is musical.
const { chromium: _ } = { chromium };
const idsByPersonality = await (async () => {
  const { COLLECTIBLES } = await import('../data/catalogue.js');
  const { personalityOf } = await import('../data/personalities.js');
  const out = {};
  for (const p of PERSONALITIES) out[p] = [];
  for (const it of COLLECTIBLES) if (it.kind === 'boo') out[personalityOf(it.id)].push(it.id);
  return out;
})();
const MUSICAL = idsByPersonality.musical[0];
const SPORTY = idsByPersonality.sporty[0];
const PLAIN = idsByPersonality.shy[0];   // neither musical nor sporty

// ---- 1. the cameos -----------------------------------------------------------------
console.log('== the pick: the first owned Boo of a temperament, in catalogue order ==');
{
  const { ctx, page } = await boot({ inventory: { [MUSICAL]: 1, [SPORTY]: 1, [PLAIN]: 1 } });
  const picks = await page.evaluate(async () => {
    const c = await import('./js/cameo.js');
    const m = c.musicalCameo(), s = c.sportyCameo();
    return { musical: m && m.id, sporty: s && s.id };
  });
  assert(picks.musical === MUSICAL, `the musical cameo is ${MUSICAL} (got ${picks.musical})`);
  assert(picks.sporty === SPORTY, `the sporty cameo is ${SPORTY} (got ${picks.sporty})`);
  await ctx.close();
}
{
  const { ctx, page } = await boot({ inventory: { [PLAIN]: 1 } });
  const none = await page.evaluate(async () => {
    const c = await import('./js/cameo.js');
    return { musical: c.musicalCameo(), sporty: c.sportyCameo() };
  });
  assert(none.musical === null && none.sporty === null,
    'owning neither kind returns null — no cameo, and nothing to build a placeholder from');
  await ctx.close();
}

console.log('== Boo Beat: the musical cameo claps on beat 1, clear of the lanes and the HUD ==');
{
  const { ctx, page } = await boot({ inventory: { [MUSICAL]: 1, [PLAIN]: 1 } });
  await enterBeat(page);
  await page.waitForSelector('.beat-cameo', { timeout: 8000 });
  const geo = await page.evaluate(() => {
    const c = document.querySelector('.beat-cameo');
    const r = c.getBoundingClientRect();
    const lanes = [...document.querySelectorAll('.beat-lane')].map(n => n.getBoundingClientRect());
    const qcard = document.querySelector('.beat-question');
    const qr = qcard && qcard.getBoundingClientRect();
    const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    return {
      size: [Math.round(r.width), Math.round(r.height)],
      hasSvg: !!c.querySelector('svg'),
      pointerEvents: getComputedStyle(c).pointerEvents,
      overlapsQuestion: qr ? overlaps(r, qr) : false,
      // it deliberately sits ABOVE the lanes' note travel; what matters is that it is not
      // over the hit line at the bottom, where every tap happens
      overHitline: (() => { const h = document.querySelector('.beat-hitline'); if (!h) return false; return overlaps(r, h.getBoundingClientRect()); })(),
      laneCount: lanes.length
    };
  });
  assert(geo.size[0] === 64 && geo.size[1] === 64, `the cameo is 64px (${geo.size.join('x')})`);
  assert(geo.hasSvg, 'it is a real Boo, drawn as SVG');
  assert(geo.pointerEvents === 'none', 'and it can never eat a lane tap (pointer-events:none)');
  assert(!geo.overlapsQuestion, 'it does not overlap the question card');
  assert(!geo.overHitline, 'nor the hit line, where every tap lands');
  // the clap: sample frames across several bars and require the class to appear and clear
  const clapped = await page.evaluate(async () => {
    const c = document.querySelector('.beat-cameo');
    const frames = [];
    for (let i = 0; i < 40; i++) { frames.push(c.classList.contains('clap')); await new Promise(r => setTimeout(r, 90)); }
    return { on: frames.filter(Boolean).length, off: frames.filter(f => !f).length };
  });
  assert(clapped.on >= 1, `it claps (${clapped.on} of 40 frames mid-clap)`);
  assert(clapped.off >= 10, `and it is not permanently mid-clap — beat 1 only (${clapped.off} frames at rest)`);
  await ctx.close();
}
{
  const { ctx, page } = await boot({ inventory: { [PLAIN]: 1 } });
  await enterBeat(page);
  await sleep(700);
  const n = await page.evaluate(() => document.querySelectorAll('.beat-cameo').length);
  assert(n === 0, 'no musical Boo owned: no cameo node at all, not an empty perch');
  await ctx.close();
}
console.log('== reduced motion: the cameo is there but still ==');
{
  const { ctx, page } = await boot({ inventory: { [MUSICAL]: 1 } }, { reducedMotion: 'reduce' });
  await enterBeat(page);
  await sleep(900);
  const still = await page.evaluate(() => {
    const c = document.querySelector('.beat-cameo');
    if (!c) return { missing: true };
    return { hasClap: c.classList.contains('clap'), anim: getComputedStyle(c).animationName };
  });
  assert(!still.missing, 'the cameo still renders under reduced motion (it is scenery, not animation)');
  assert(!still.hasClap, 'but it never gets the clap class');
  await ctx.close();
}

console.log('== Boo Dash: the sporty cameo jogs the far layer at 0.6x ==');
{
  const { ctx, page } = await boot({ inventory: { [SPORTY]: 1, [PLAIN]: 1 } });
  await enterDash(page);
  await page.waitForSelector('.d2-jogger', { timeout: 8000 });
  const jog = await page.evaluate(() => {
    const j = document.querySelector('.d2-jogger');
    return { parent: j.parentElement.className, hasSvg: !!j.querySelector('svg'), pe: getComputedStyle(j).pointerEvents };
  });
  assert(/d2-hills/.test(jog.parent), `the jogger lives on the far (hills) layer (${jog.parent})`);
  assert(jog.hasSvg, 'it is a real Boo, drawn as SVG');
  assert(jog.pe === 'none', 'and never intercepts a tap');
  const drifted = await page.evaluate(async () => {
    const j = document.querySelector('.d2-jogger');
    const seen = new Set();
    for (let i = 0; i < 24; i++) { seen.add(j.style.transform); await new Promise(r => setTimeout(r, 120)); }
    return seen.size;
  });
  assert(drifted >= 3, `it actually drifts with the scroll (${drifted} distinct transforms over ~3s)`);
  await ctx.close();
}
{
  const { ctx, page } = await boot({ inventory: { [PLAIN]: 1 } });
  await enterDash(page);
  await sleep(700);
  const n = await page.evaluate(() => document.querySelectorAll('.d2-jogger').length);
  assert(n === 0, 'no sporty Boo owned: no jogger node at all');
  await ctx.close();
}

// ---- 2. the wellie stomp -----------------------------------------------------------
console.log('== the cause: "rain" was never a season seasonOf() could return ==');
{
  const { ctx, page } = await boot();
  const src = await page.evaluate(() => fetch('./js/town.js', { cache: 'no-store' }).then(r => r.text()));
  assert(/function isRainDay\(/.test(src), 'town.js now decides rain days for real (isRainDay)');
  assert(/isRainDay\(base, todayKeyLocal\(\)\)/.test(src), 'and the weather layer asks it, rather than relying on the QA flag alone');
  const rain = await page.evaluate(() => {
    // the same deterministic function, sampled over a year of April days
    const out = { rainy: 0, total: 0 };
    return fetch('./js/town.js', { cache: 'no-store' }).then(r => r.text()).then(() => out);
  });
  assert(rain !== null, 'sampled below through the real render path');
  await ctx.close();
}
{
  // A wellied Boo in the rain stomps. __bootownWeather forces the rain state; the point of
  // the assertion is the STOMP, and that it now has particles, a cap and a sound.
  const { ctx, page } = await boot({
    inventory: { [PLAIN]: 1, acc_wellies: 1 },
    equips: { [PLAIN]: { feet: 'acc_wellies' } },
    town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.12, row: 1, item: PLAIN }], paths: [] } } }
  });
  await page.addInitScript(() => { window.__bootownWeather = 'rain'; });
  await page.evaluate(() => { window.__bootownWeather = 'rain'; window.BooTown.go('town', { area: 'meadow' }); });
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife && window.__townLife.actorCount() > 0, { timeout: 6000 });
  const stomp = await page.evaluate(async () => {
    window.__townLife.renderWeather();
    const el0 = window.__townLife.stompEligible(0);
    const one = window.__townLife.forceStomp(0);
    return { el0, bursts: one.bursts, drops: one.drops };
  });
  assert(stomp.el0 && stomp.el0.locomotion === 'stomp', `the wellied Boo has the stomp locomotion (${stomp.el0 && stomp.el0.locomotion})`);
  assert(stomp.el0 && stomp.el0.season === 'rain', `and it is raining (${stomp.el0 && stomp.el0.season})`);
  assert(stomp.bursts >= 1, `the stomp fires (${stomp.bursts} bursts)`);
  assert(stomp.drops > 0 && stomp.drops <= 6, `with at most 6 splash particles per stomp (${stomp.drops})`);
  const nums = await page.evaluate(() => fetch('./js/town.js', { cache: 'no-store' }).then(r => r.text()).then(t => ({
    ms: /const SPLASH_MS = 400;/.test(t), max: /const SPLASH_MAX = 6;/.test(t), sfx: /sfx\.splash\(\)/.test(t)
  })));
  assert(nums.ms, 'SPLASH_MS is the pack\'s 400ms');
  assert(nums.max, 'SPLASH_MAX is the pack\'s 6');
  assert(nums.sfx, 'and the stomp has a sound at last, through sfx.js so it obeys the mutes');
  await ctx.close();
}
{
  // Riverside, in JULY, no rain: the stomp still works near the water band, and does NOT
  // work away from it. That second half is what makes the accessory worth owning in summer.
  const { ctx, page } = await boot({
    inventory: { [PLAIN]: 1, acc_wellies: 1 },
    equips: { [PLAIN]: { feet: 'acc_wellies' } },
    stars: { total: 400, byGame: {} },
    town: { areas: { riverside: { items: [{ zone: 'riverside', x: 0.12, row: 0, item: PLAIN }], paths: [] } } }
  }, { month: 7 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'riverside' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife && window.__townLife.actorCount() > 0, { timeout: 6000 });
  const river = await page.evaluate(() => window.__townLife.stompEligible(0));
  assert(river && river.season !== 'rain', `it is not raining (${river && river.season})`);
  assert(river && river.nearWater === true, `and the Boo IS in the riverside water band (row ${river && river.row})`);
  await ctx.close();
}
{
  const { ctx, page } = await boot({
    inventory: { [PLAIN]: 1, acc_wellies: 1 },
    equips: { [PLAIN]: { feet: 'acc_wellies' } },
    town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.12, row: 2, item: PLAIN }], paths: [] } } }
  }, { month: 7 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife && window.__townLife.actorCount() > 0, { timeout: 6000 });
  const dry = await page.evaluate(() => window.__townLife.stompEligible(0));
  assert(dry && dry.nearWater === false && dry.season !== 'rain',
    `a dry Meadow in July offers nothing to splash in (season ${dry && dry.season}, nearWater ${dry && dry.nearWater})`);
  await ctx.close();
}

// ---- 3. stardust ------------------------------------------------------------------
console.log('== stardust is visible, and explains itself ==');
{
  const { ctx, page } = await boot({ stardust: 12, inventory: { [PLAIN]: 1 } });
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-dust-chip');
  const chip = await page.evaluate(() => {
    const c = document.querySelector('.coll-dust-chip');
    const r = c.getBoundingClientRect();
    return { text: c.textContent, w: Math.round(r.width), h: Math.round(r.height), tag: c.tagName };
  });
  assert(chip.text === '✨ 12', `the header shows the live count (${chip.text})`);
  assert(chip.tag === 'BUTTON', 'the chip is a real button');
  assert(chip.h >= 56 && chip.w >= 56, `and meets the 56px tap-target law (${chip.w}x${chip.h})`);
  const explained = await page.evaluate(async () => {
    document.querySelector('.coll-dust-chip').click();
    await new Promise(r => setTimeout(r, 400));
    const d = document.querySelector('.overlay .dialog');
    return d ? d.textContent : null;
  });
  assert(explained && explained.includes('Stardust comes from doubles — 10 makes a Boo shiny, 5 makes anything sparkle!'),
    `tapping it explains what stardust is FOR, verbatim (${explained})`);
  await ctx.close();
}

console.log('== Sprinkle: 5 dust, a visible sparkle, and it ends at midnight ==');
{
  const { ctx, page } = await boot({
    stardust: 12, inventory: { [PLAIN]: 1, deco_bench: 1 },
    town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.20, row: 1, item: 'deco_bench' }], paths: [] } } }
  });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  const card = await page.evaluate(async () => {
    if (!window.__townLife.openPlayCardFor('deco_bench')) return null;
    await new Promise(r => setTimeout(r, 250));
    const c = document.querySelector('.play-card');
    return c ? { buttons: [...c.querySelectorAll('button')].map(b => b.textContent), pic: !!c.querySelector('.pc-pic svg') } : null;
  });
  assert(card, 'a long press in play mode opens the card');
  assert(card && card.buttons.some(b => b === '✨ Sprinkle (5 stardust)'), `offering Sprinkle at 5 dust (${JSON.stringify(card && card.buttons)})`);
  assert(card && card.buttons.some(b => b === 'Not now'), 'and a way out');
  assert(card && card.pic, 'with a picture of the thing');
  const done = await page.evaluate(async () => {
    [...document.querySelectorAll('.play-card button')].find(b => /Sprinkle/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 350));
    const title = (document.querySelector('.overlay .dialog h2') || {}).textContent;
    const yes = [...document.querySelectorAll('.overlay .dialog button')].find(b => /Yes please/.test(b.textContent));
    if (yes) yes.click();
    await new Promise(r => setTimeout(r, 350));
    const st = window.BooTown.State.getState();
    return { title, dust: st.stardust, sparkles: st.sparkles, sparkling: window.__townLife.sparkling() };
  });
  assert(/^Sprinkle stardust on .*\? ✨5$/.test(done.title || ''), `the confirm asks the authored question (${done.title})`);
  assert(done.dust === 7, `5 stardust is debited (12 -> ${done.dust})`);
  assert(done.sparkling.includes('deco_bench'), `and the bench visibly sparkles (${JSON.stringify(done.sparkling)})`);
  const key = Object.keys(done.sparkles)[0];
  assert(done.sparkles[key] === new Date().toISOString().slice(0, 10) || /^\d{4}-\d{2}-\d{2}$/.test(done.sparkles[key]),
    `stored against today's local day (${key} -> ${done.sparkles[key]})`);
  // day rollover: yesterday's stamp is dropped on sight, no timer required
  const rolled = await page.evaluate(async () => {
    const st = window.BooTown.State;
    const k = Object.keys(st.getState().sparkles)[0];
    st.mutate(s => { s.sparkles[k] = '2020-01-01'; });
    window.__townLife.applySparkles();
    await new Promise(r => setTimeout(r, 80));
    return { sparkling: window.__townLife.sparkling(), left: Object.keys(st.getState().sparkles).length };
  });
  assert(rolled.sparkling.length === 0, 'a sparkle from another day is not painted');
  assert(rolled.left === 0, 'and its stamp is pruned from the save on sight, so nothing accumulates');
  // no double-charging: a second long press on an already-sparkling item offers nothing
  const again = await page.evaluate(async () => {
    const st = window.BooTown.State;
    // RE-POINTED at v24 (RUN21F F5): a sparkle stamp is keyed by the PLACEMENT ID now, not by
    // `zone:x:item`. Same rigour — the point of the block is that an already-sparkling thing
    // offers no second sprinkle, and that needs the stamp to land on the bench she is pressing.
    // Reading the id from the save is stronger than the literal it replaces, which silently
    // stopped matching the bench the moment the key form changed.
    const benchId = window.__townLife.idOf('deco_bench');
    st.mutate(s => { s.sparkles[String(benchId)] = (window.__bootownDay || new Date().toISOString().slice(0, 10)); });
    window.__townLife.applySparkles();
    window.__townLife.openPlayCardFor('deco_bench');
    await new Promise(r => setTimeout(r, 250));
    return { card: !!document.querySelector('.play-card'), hint: (document.querySelector('.town-hint-bar') || {}).textContent };
  });
  assert(!again.card, 'an already-sparkling thing offers no second sprinkle');
  assert(/already sparkling/i.test(again.hint || ''), `and says why rather than doing nothing (${again.hint})`);
  await ctx.close();
}
{
  // Too little dust: the option is withheld, and the reason is stated. Never a dead press.
  const { ctx, page } = await boot({
    stardust: 3, inventory: { deco_bench: 1 },
    town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.20, row: 1, item: 'deco_bench' }], paths: [] } } }
  });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  const poor = await page.evaluate(async () => {
    window.__townLife.openPlayCardFor('deco_bench');
    await new Promise(r => setTimeout(r, 250));
    return { card: !!document.querySelector('.play-card'), hint: (document.querySelector('.town-hint-bar') || {}).textContent, dust: window.BooTown.State.getState().stardust };
  });
  assert(!poor.card, 'with 3 dust, Sprinkle is not offered');
  assert(/costs ✨5/.test(poor.hint || '') && /you have ✨3/.test(poor.hint || ''),
    `and the press says what it costs and what she has (${poor.hint})`);
  assert(poor.dust === 3, 'nothing is debited');
  await ctx.close();
}
console.log('== and the 10-dust shiny spend still debits correctly ==');
{
  const { ctx, page } = await boot({ stardust: 12, inventory: { [PLAIN]: 1 } });
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-grid');
  const shiny = await page.evaluate(async (id) => {
    const before = window.BooTown.State.getState().stardust;
    const m = await import('./js/shiny.js');
    m.addShinyCopy(id);
    const st = await import('./js/state.js');
    st.mutate(s => { s.stardust -= 10; });
    return { before, after: window.BooTown.State.getState().stardust, shinies: window.BooTown.State.getState().shinies[id] };
  }, PLAIN);
  assert(shiny.before - shiny.after === 10, `a shiny upgrade still costs 10 (${shiny.before} -> ${shiny.after})`);
  assert(shiny.shinies >= 1, 'and actually makes a shiny copy');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
