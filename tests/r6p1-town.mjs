// tests/r6p1-town.mjs — RUN6 phase 1: the living town (C1).
// Acceptance (RUN6 part D #1, #2): the Boo behaviour engine shows ≥4 distinct
// autonomous behaviours with frame evidence — an activity-item use with walk-up, a
// friend visit with hearts, a night nap at 22:00, plus chase/watch; taps interrupt;
// the actor + role caps hold; reduced-motion stills it. Ambient life: each season's
// weather renders; the shooting star pays +1 at most once/night; the ambient sound
// bed logs scheduled notes and obeys the mute.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const todayKey = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = (town, inv, meter = 0) => ({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: inv, boxes: 0, meter, opened: 5, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town,
  stars: { total: 60, byGame: {} }, ledger: {},
  delights: { hideDay: todayKey, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, ageAsked: true, age: 8
});

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openTown(town, { hour = 13, reduced = false, meter = 0 } = {}) {
  const inv = {};
  for (const t of town) inv[t.item] = (inv[t.item] || 0) + 1;
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((h) => { window.__bootownHour = h; window.__bootownDay = null; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE(town, inv, meter));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await page.waitForFunction(() => window.__townLife && window.__townLife.actorCount() > 0, { timeout: 4000 });
  await sleep(400);
  return { ctx, page };
}
// sample actor i's transform N times over span ms (frame evidence)
async function frames(page, i, n = 7, span = 3000) {
  const out = [];
  for (let k = 0; k < n; k++) { out.push(await page.evaluate(idx => window.__townLife.transform(idx), i)); await sleep(span / (n - 1)); }
  return out;
}
const distinct = arr => new Set(arr).size;
const BOO2 = [{ zone: 'meadow', x: 0.4, item: 'boo_inky' }, { zone: 'meadow', x: 0.46, item: 'boo_plum' }];

// ==================== friend visit with a wave + hearts ====================
console.log('== behaviour: visit a friend (wave + hearts) ==');
{
  const { ctx, page } = await openTown([{ zone: 'meadow', x: 0.30, item: 'boo_inky' }, { zone: 'meadow', x: 0.50, item: 'boo_plum' }]);
  const started = await page.evaluate(() => window.__townLife.force(0, 'visit'));
  assert(started === 'visit', 'actor 0 starts a friend visit');
  // capture the walk-over frames AND the arrival hearts in one 3s window
  const fr = []; let sawHeart = false;
  for (let k = 0; k < 10; k++) {
    fr.push(await page.evaluate(() => window.__townLife.transform(0)));
    if (await page.evaluate(() => window.__townLife.heartsShown()) > 0) sawHeart = true;
    await sleep(300);
  }
  assert(distinct(fr) >= 4, `the visitor walks over (${distinct(fr)}/10 distinct transform frames)`);
  assert(sawHeart, 'a small heart pops between the two Boos on arrival');
  await ctx.close();
}

// ==================== activity-item use WITH walk-up ====================
console.log('== behaviour: walk up to an activity and use it ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.45, item: 'boo_inky' },
    { zone: 'meadow', x: 0.18, item: 'deco_slide' }
  ]);
  const started = await page.evaluate(() => window.__townLife.force(0, 'approach'));
  assert(started === 'approach', 'actor 0 sets off toward the slide');
  const fr = await frames(page, 0, 7, 2800);
  assert(distinct(fr) >= 4, `it strides across the ground toward the slide (${distinct(fr)}/7 distinct)`);
  // on arrival the activity claims it into a role (walk-up → use)
  let becameRole = false;
  for (let k = 0; k < 20 && !becameRole; k++) {
    await page.evaluate(() => window.__townLife.assignRoles());
    if (/^role:/.test(await page.evaluate(() => window.__townLife.goalOf(0)))) becameRole = true;
    await sleep(250);
  }
  assert(becameRole, 'reaching the slide, the Boo climbs on (walk-up → activity use)');
  await ctx.close();
}

// ==================== chase + sit-and-watch ====================
console.log('== behaviour: chase a butterfly / sit and watch ==');
{
  const { ctx, page } = await openTown([{ zone: 'meadow', x: 0.4, item: 'boo_inky' }, { zone: 'meadow', x: 0.5, item: 'boo_plum' }]);
  await page.evaluate(() => window.__townLife.force(0, 'chase'));
  await sleep(150);
  assert(await page.evaluate(() => window.__townLife.chaseCritters()) > 0, 'a butterfly appears for the Boo to chase');
  const chaseFr = await frames(page, 0, 6, 2400);
  assert(distinct(chaseFr) >= 4, `the Boo hops after the butterfly (${distinct(chaseFr)}/6 distinct)`);
  // sit and watch: a settled seated pose
  await page.evaluate(() => window.__townLife.force(1, 'watch'));
  await sleep(700);
  const watchT = await page.evaluate(() => window.__townLife.transform(1));
  assert(/scale\(1,\s*0\.9/.test(watchT) || /translateY/.test(watchT), `sit-and-watch settles into a seated pose (${watchT})`);
  await ctx.close();
}

// ==================== night nap at 22:00 ====================
console.log('== behaviour: nap under a house at 22:00 ==');
{
  const { ctx, page } = await openTown([
    { zone: 'meadow', x: 0.5, item: 'boo_inky' },
    { zone: 'meadow', x: 0.4, item: 'deco_boohouse' }
  ], { hour: 22 });
  await page.evaluate(() => window.__townLife.force(0, 'nap'));
  let napped = false;
  for (let k = 0; k < 16 && !napped; k++) { if (await page.evaluate(() => window.__townLife.zzzShown()) > 0) napped = true; await sleep(300); }
  assert(napped, 'the Boo walks over and curls up with a zzz at night');
  const napFr = await frames(page, 0, 6, 2400);
  assert(distinct(napFr) >= 2, `the sleeper breathes gently (${distinct(napFr)}/6 distinct)`);
  await ctx.close();
}

// ==================== taps always interrupt ====================
console.log('== taps interrupt any behaviour ==');
{
  // single Boo so no OTHER actor autonomously spawns its own chase critter
  const { ctx, page } = await openTown([{ zone: 'meadow', x: 0.4, item: 'boo_inky' }]);
  await page.evaluate(() => window.__townLife.force(0, 'chase'));
  await sleep(200);
  await page.click('.t-item.boo', { force: true });
  await sleep(300);
  const after = await page.evaluate(() => window.__townLife.goalOf(0));
  assert(after === 'wander', `a tap drops the behaviour back to idle (got ${after})`);
  assert(await page.evaluate(() => window.__townLife.chaseCritters()) === 0, 'the chase critter is cleared on interrupt');
  await ctx.close();
}

// ==================== actor + role caps hold ====================
console.log('== performance caps ==');
{
  const many = [{ zone: 'meadow', x: 0.4, item: 'deco_boohouse' }];
  for (let i = 0; i < 14; i++) many.push({ zone: 'meadow', x: +(0.30 + i * 0.006).toFixed(3), item: 'boo_' + ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot', 'fuzz', 'puff'][i % 12] });
  // 14 boos: allow duplicate ids by bumping inventory counts
  const { ctx, page } = await openTown(many, { hour: 22 });
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(200);
  const roles = await page.evaluate(() => window.__townLife.roleCount());
  const actorsN = await page.evaluate(() => window.__townLife.actorCount());
  assert(roles <= 12, `active-role cap holds: ${roles} ≤ 12 (MAX_ACTIVE_ROLES)`);
  assert(roles === 12, `with 14 sleepy Boos, exactly 12 are active (capped), got ${roles}`);
  assert(actorsN <= 30, `wanderer cap holds: ${actorsN} ≤ 30`);
  await ctx.close();
}

// ==================== reduced motion stills it ====================
console.log('== reduced motion stills behaviours + weather ==');
{
  const { ctx, page } = await openTown([{ zone: 'meadow', x: 0.4, item: 'boo_inky' }, { zone: 'meadow', x: 0.5, item: 'deco_slide' }], { reduced: true });
  const weather = await page.evaluate(() => window.__townLife.weather());
  assert(weather === null, 'no weather particle layer under reduced motion');
  // the wander/behaviour loop never starts under reduced motion → transforms stay put
  await page.evaluate(() => window.__townLife.force(0, 'chase'));
  const t0 = await page.evaluate(() => window.__townLife.transform(0));
  await sleep(600);
  const t1 = await page.evaluate(() => window.__townLife.transform(0));
  assert(t0 === t1, 'behaviours do not animate under reduced motion (static pose)');
  await ctx.close();
}

// ==================== D2: seasonal weather ====================
console.log('== ambient: each season renders its weather ==');
{
  const { ctx, page } = await openTown([{ zone: 'meadow', x: 0.4, item: 'boo_inky' }]);
  for (const [m, season, kind] of [[7, 'summer', 'sunrays'], [10, 'autumn', 'particles'], [1, 'winter', 'particles'], [4, 'spring', 'particles']]) {
    const w = await page.evaluate((mm) => { window.__bootownMonth = mm; window.__townLife.renderWeather(); return window.__townLife.weather(); }, m);
    assert(w && w.season === season, `month ${m} → ${season} weather layer (got ${w && w.season})`);
    if (kind === 'sunrays') assert(w.sunrays >= 1, 'summer shows gentle sun rays');
    else assert(w.particles > 0, `${season} shows drifting particles (${w.particles})`);
  }
  await ctx.close();
}

// ==================== D2: shooting star pays +1 once per night ====================
console.log('== ambient: shooting star pays +1, once per night ==');
{
  const { ctx, page } = await openTown([{ zone: 'meadow', x: 0.4, item: 'boo_inky' }], { hour: 22, meter: 0 });
  const res = await page.evaluate(() => {
    const S = window.BooTown.State;
    const before = S.getState().meter;
    const s1 = window.__townLife.spawnStar();
    const present = !!document.querySelector('.t-shooting-star');
    const paid1 = window.__townLife.tapStar(s1);
    const mid = S.getState().meter;
    const s2 = window.__townLife.spawnStar();
    const paid2 = window.__townLife.tapStar(s2);
    const after = S.getState().meter;
    return { before, mid, after, paid1, paid2, present, day: window.__townLife.starDay() };
  });
  assert(res.present, 'a shooting star appears in the night sky');
  assert(res.paid1 === true && res.mid - res.before === 1, 'the first tap pays +1 meter');
  assert(res.paid2 === false && res.after === res.mid, 'a second star the same night pays nothing (capped once per night)');
  assert(!!res.day, 'the claim is recorded for the day');
  await ctx.close();
}

// ==================== D2: ambient sound bed logs + obeys mute ====================
console.log('== ambient sound bed: scheduling + mute obedience ==');
{
  const { ctx, page } = await openTown([{ zone: 'meadow', x: 0.4, item: 'boo_inky' }]);
  const on = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setAudioLog(true);
    sfx.initAudio(); sfx.setMusicEnabled(true);
    sfx.ambient.play('day');
    await new Promise(r => setTimeout(r, 500));
    const notes = sfx.getAudioLog().filter(e => e.kind === 'note' && e.bus === 'ambient');
    return notes.length;
  });
  assert(on > 0, `the ambient bed schedules notes on the ambient bus while music is on (${on})`);
  const muted = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setMusicEnabled(false);         // mute music → ambient bed stops
    sfx.setAudioLog(true);              // fresh log
    await new Promise(r => setTimeout(r, 500));
    return sfx.getAudioLog().filter(e => e.kind === 'note' && e.bus === 'ambient').length;
  });
  assert(muted === 0, `muting music silences the ambient bed (${muted} new ambient notes)`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
