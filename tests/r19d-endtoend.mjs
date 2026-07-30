// tests/r19d-endtoend.mjs — full-round coverage for everything this session touched
// (Alex, 2026-07-30: "did you check all the features/games from this session?").
//
// The r18e/r19 suites proved the new MOMENTS (join, panels, locks); this one proves the
// ROUNDS: every reworked game plays start → results under the new Next-gated flow, the
// toddler doors play through, the Word Factory's reduced-motion join works, REDUCED flips
// live with the OS, the wordfactory intro exists, and the disco floor survives a guest
// change mid-routine and mid-spotlight. Expected runtime: ~100s. Not @serial.

import { chromium } from 'playwright';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const boos = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly'];
const save = (content, extra = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(boos.map(b => [b, 1])),
  stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 },
  trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { blendit: true, wordfactory: true, soundtwins: true, apostrophepatrol: true, storyorder: true, rhymetime: true } },
  settings: { sound: false, music: false, voice: false, content },
  ...extra
});
const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(saveStr, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), saveStr);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}
const atResults = (page) => page.evaluate(() => document.getElementById('screen').dataset.screen === 'results');

// ================== 1. Twin Trouble: a whole L2 shift, right answers, to results ==================
console.log('== 1. Twin Trouble plays a full round to results ==');
{
  const { ctx, page } = await open(save('medium'));
  await page.evaluate(() => window.BooTown.go('soundtwins', { resume: { level: 2 } }));
  await page.waitForFunction(() => window.__twintrouble && window.__twintrouble.state().phase === 'verdict', null, { timeout: 15000 });
  let guard = 0;
  while (guard++ < 12 && !(await atResults(page))) {
    const c = await page.evaluate(() => window.__twintrouble.case());
    if (c.guilty) {
      await page.evaluate(() => window.__twintrouble.verdictGuilty());
      await page.waitForFunction(() => window.__twintrouble.state().phase === 'fix', null, { timeout: 8000 });
      await page.evaluate(() => window.__twintrouble.tapCulprit());
    } else {
      await page.evaluate(() => window.__twintrouble.verdictInnocent());
    }
    await page.waitForSelector('.tt-explain .tt-next', { timeout: 8000 });
    await page.evaluate(() => window.__twintrouble.tapNext());
    await page.waitForFunction(() =>
      document.getElementById('screen').dataset.screen === 'results' || window.__twintrouble.state().phase === 'verdict',
    null, { timeout: 10000 });
  }
  assert(await atResults(page), `an 8-case shift ends on the results screen (${guard - 1} cases driven)`);
  await ctx.close();
}

// ================== 2. Apostrophe Patrol: both modes, full rounds to results ==================
console.log('== 2. Flying Comma and the Squeeze Machine both reach results ==');
{
  const { ctx, page } = await open(save('medium'));
  await page.evaluate(() => window.BooTown.go('apostrophepatrol', { resume: { cat: 'comma', level: 1 } }));
  await page.waitForFunction(() => window.__aphub && window.__aphub.comma && window.__aphub.comma.state().phase === 'flick', null, { timeout: 15000 });
  let guard = 0;
  while (guard++ < 12 && !(await atResults(page))) {
    await page.evaluate(() => window.__aphub.comma.flickCorrect());
    await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 8000 });
    await page.evaluate(() => window.__aphub.comma.tapNext());
    await page.waitForFunction(() =>
      document.getElementById('screen').dataset.screen === 'results' || window.__aphub.comma.state().phase === 'flick',
    null, { timeout: 10000 });
  }
  assert(await atResults(page), `Flying Comma L1 ends on results (${guard - 1} orders driven)`);
  await ctx.close();
}
{
  const { ctx, page } = await open(save('medium'));
  await page.evaluate(() => window.BooTown.go('apostrophepatrol', { resume: { cat: 'squeeze' } }));
  await page.waitForFunction(() => window.__aphub && window.__aphub.squeeze && window.__aphub.squeeze.state().phase === 'wait-a', null, { timeout: 15000 });
  let guard = 0;
  while (guard++ < 12 && !(await atResults(page))) {
    await page.evaluate(() => { window.__aphub.squeeze.tapA(); window.__aphub.squeeze.tapB(); });
    await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 8000 });
    await page.evaluate(() => window.__aphub.squeeze.tapNext());
    await page.waitForFunction(() =>
      document.getElementById('screen').dataset.screen === 'results' || window.__aphub.squeeze.state().phase === 'wait-a',
    null, { timeout: 10000 });
  }
  assert(await atResults(page), `the Squeeze Machine ends on results (${guard - 1} squeezes driven)`);
  await ctx.close();
}

// ================== 3. Blend It classic: a full L1 round under the Next flow ==================
console.log('== 3. Blend It (Full tier) plays a whole level to results ==');
{
  const { ctx, page } = await open(save('full'));
  await page.evaluate(() => window.BooTown.go('blendit', { resume: { level: 1 } }));
  await page.waitForFunction(() => window.__blend && window.__blend.phase() === 'tiles', null, { timeout: 15000 });
  let guard = 0;
  while (guard++ < 12 && !(await atResults(page))) {
    await page.evaluate(() => window.__blend.blend());
    await page.waitForFunction(() => window.__blend.phase() === 'pick', null, { timeout: 15000 });
    await page.evaluate(() => window.__blend.pickCorrect());
    await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 8000 });
    await page.evaluate(() => window.__blend.tapNext());
    await page.waitForFunction(() =>
      document.getElementById('screen').dataset.screen === 'results' || window.__blend.phase() === 'tiles',
    null, { timeout: 10000 });
  }
  assert(await atResults(page), `Blend It L1 ends on results (${guard - 1} words driven)`);
  await ctx.close();
}

// ================== 4. the toddler doors play all the way through ==================
console.log('== 4. Story Order + Rhyme Time toddler doors reach results ==');
{
  const { ctx, page } = await open(save('toddler'));
  await page.evaluate(() => window.BooTown.go('storyorder', { toddler: true }));
  await page.waitForFunction(() => window.__story && window.__story.state().phase === 'order', null, { timeout: 15000 });
  let guard = 0;
  while (guard++ < 4 && !(await atResults(page))) {
    await page.evaluate(() => window.__story.solveOrder());
    await page.waitForFunction(() => window.__story.state().phase === 'question', null, { timeout: 35000 });
    await page.evaluate(() => window.__story.answerCorrect());
    await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 8000 });
    await page.evaluate(() => window.__story.tapNext());
    await page.waitForFunction(() =>
      document.getElementById('screen').dataset.screen === 'results' || window.__story.state().phase === 'order',
    null, { timeout: 15000 });
  }
  assert(await atResults(page), `the Stories toddler door plays both stories to results (${guard - 1})`);
  await ctx.close();
}
{
  const { ctx, page } = await open(save('toddler'));
  await page.evaluate(() => window.BooTown.go('rhymetime', { toddler: true }));
  await page.waitForFunction(() => window.__rhyme && window.__rhyme.state().renders > 0, null, { timeout: 15000 });
  const total = await page.evaluate(() => window.__rhyme.state().total);
  assert(total === 6, `the Rhymes toddler door is a six-set round (${total})`);
  assert(!(await page.$('.start-card')), 'and no picker ever appeared for the pre-reader');
  let guard = 0;
  while (guard++ < 10 && !(await atResults(page))) {
    const before = await page.evaluate(() => window.__rhyme.state().renders);
    await page.evaluate(() => window.__rhyme.solveTarget());
    await page.waitForFunction((n) =>
      document.getElementById('screen').dataset.screen === 'results' || window.__rhyme.state().renders > n,
    before, { timeout: 25000 });
  }
  assert(await atResults(page), `the Rhymes toddler door plays six sets to results (${guard - 1})`);
  await ctx.close();
}

// ================== 5. reduced motion: the join still teaches, and REDUCED flips live ==================
console.log('== 5. the Word Factory join under reduced motion + the live OS flip ==');
{
  const { ctx, page } = await open(save('medium'), { reducedMotion: true });
  await page.evaluate(() => window.BooTown.go('blendit', { resume: { level: 2 } }));
  await page.waitForFunction(() => window.__factory && window.__factory.shelf().length > 0, null, { timeout: 15000 });
  const isReduced = await page.evaluate(async () => (await import('./js/ui.js')).REDUCED);
  assert(isReduced, 'the app is in the reduced-motion path');
  await page.evaluate(() => window.__factory.finishItem());
  await page.waitForSelector('.wf-next', { timeout: 8000 });
  const rule = await page.$eval('.wf-rule', n => getComputedStyle(n).visibility);
  assert(rule !== 'hidden', 'the rule still shows at the join with motion calmed');
  await page.evaluate(() => window.__factory.tapNext());
  await page.waitForFunction(() => window.__factory.state().idx === 1 || document.getElementById('screen').dataset.screen === 'results', null, { timeout: 8000 });
  assert(true, 'and Next still advances — nothing is deleted under reduced motion');
  await ctx.close();
}
{
  const { ctx, page } = await open(save('medium'));   // starts UNreduced
  const before = await page.evaluate(async () => (await import('./js/ui.js')).REDUCED);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
  const after = await page.evaluate(async () => (await import('./js/ui.js')).REDUCED);
  assert(before === false && after === true, `REDUCED follows the OS switch live, no reload (${before} → ${after})`);
  await ctx.close();
}

// ================== 6. the Word Factory teaches itself on first play ==================
console.log('== 6. the wordfactory first-play intro exists and shows ==');
{
  const s = JSON.parse(save('medium'));
  delete s.seen.introSeen.wordfactory;
  const { ctx, page } = await open(JSON.stringify(s));
  await page.evaluate(() => window.BooTown.go('blendit'));
  await page.waitForSelector('.intro-overlay', { timeout: 15000 });
  const r = await page.evaluate(async () => {
    const { INTRO_SCRIPTS } = await import('./js/intro.js');
    return { steps: (INTRO_SCRIPTS.wordfactory || []).length, words: (INTRO_SCRIPTS.wordfactory || []).map(x => x.text.split(/\s+/).length) };
  });
  assert(r.steps === 3, 'three intro steps');
  assert(r.words.every(n => n <= 12), 'every step under twelve words');
  await ctx.close();
}

// ================== 7. the disco floor survives a guest change mid-routine and mid-spotlight ==================
console.log('== 7. guest changes during a routine and during the spotlight ==');
{
  const { ctx, page } = await open(save('full', { routines: { 'meadow:10': ['bounce', 'clap', 'spin'] } }));
  await page.evaluate(() => window.BooTown.go('discohall', {}));
  await page.waitForFunction(() => window.__disco && window.__disco.roster().length > 0, null, { timeout: 15000 });
  // spotlight: force enough bars for a promotion, then change the roster
  await page.evaluate(() => { for (let i = 0; i < 10; i++) window.__disco.forceBar(); });
  await page.evaluate(() => window.__disco.toggleGuest(window.__disco.roster()[0]));
  await page.waitForTimeout(300);
  let r = await page.evaluate(() => ({ n: window.__disco.roster().length, floor: window.__disco.floorCount(), spotlit: window.__disco.spotlitCount() }));
  assert(r.floor === r.n && r.spotlit <= 1, `mid-spotlight roster change re-lays cleanly (${r.floor} on floor, ${r.spotlit} spotlit)`);
  // routine night: cycle in, then change the roster while it loops
  await page.evaluate(() => window.__disco.cycleMode());
  await page.waitForFunction(() => window.__disco.mode() === 'routine', null, { timeout: 8000 });
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__disco.forceBeat(); });
  await page.evaluate(() => window.__disco.toggleGuest(window.__disco.ownedBoos().find(id => !window.__disco.roster().includes(id)) || window.__disco.roster()[0]));
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__disco.forceBeat(); });
  r = await page.evaluate(() => ({ mode: window.__disco.mode(), n: window.__disco.roster().length, floor: window.__disco.floorCount(), rail: window.__disco.railCount() }));
  assert(r.mode === 'routine' && r.floor + r.rail === r.n, `mid-routine roster change keeps the routine and the counts (${r.floor}+${r.rail}=${r.n})`);
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors anywhere in the sweep');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
