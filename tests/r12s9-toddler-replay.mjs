// tests/r12s9-toddler-replay.mjs — RUN12 S9: a three-year-old who missed it gets to hear it
// again, without losing anything.
//
// Animal Sounds played its call once, 240ms after the cards appeared, and never again. If
// she looked away she had lost the question, and the "?" control replayed the INTRO rather
// than the call. Every toddler game with a spoken prompt now carries the same big speaker
// button; Animal Sounds also gets a lead-in pause and one gentle auto-repeat.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
import { TODDLER_GAMES } from '../js/toddler.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s9';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: 40, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 40,
    introSeen: Object.fromEntries(['tcount','tcolour','tshape','tletter','tanimal','tpairs','tbigsmall'].map(k => [k, true])) },
  settings: { sound: true, music: false, voice: true, content: 'toddler' }
});

const browser = await chromium.launch({ args: RESOLVE });
async function open(game, viewport = { width: 1024, height: 768 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const audio = [];
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  // instrument the two audio paths a prompt can take
  await page.evaluate(async () => {
    const sfxMod = await import('./js/sfx.js');
    const guide = await import('./js/guide.js');
    window.__audioLog = [];
    const realCall = sfxMod.animal.call.bind(sfxMod.animal);
    sfxMod.animal.call = (k) => { window.__audioLog.push({ kind: 'animal', key: k, t: Math.round(performance.now()) }); return realCall(k); };
    if (sfxMod.logEvents) sfxMod.logEvents(true);
  });
  await page.evaluate((g) => window.BooTown.go('toddlergame', { game: g }), game);
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await page.waitForTimeout(300);
  return { ctx, page, audio };
}

// ---- 1. the control exists in every game with a spoken prompt ------------------------
console.log('== every toddler game with an audio prompt carries the same replay control ==');
for (const g of TODDLER_GAMES) {
  const { ctx, page } = await open(g.key, { width: 390, height: 844 });
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => {
    const b = document.querySelector('.td-replay');
    if (!b) return { present: false };
    const rect = b.getBoundingClientRect();
    const area = document.querySelector('.game-area').getBoundingClientRect();
    return { present: true, w: Math.round(rect.width), h: Math.round(rect.height),
      label: b.getAttribute('aria-label'),
      bottomCentred: Math.abs((rect.left + rect.width / 2) - (area.left + area.width / 2)) < 24
        && (area.bottom - rect.bottom) < 40,
      visible: getComputedStyle(b).display !== 'none' && rect.width > 0 };
  });
  assert(r.present, `${g.key} (${g.word}): the replay control is on screen`);
  if (!r.present) { await ctx.close(); continue; }
  assert(r.h >= 64, `${g.key}: at least 64px tall (${r.h}px)`);
  assert(r.w >= 64, `${g.key}: and at least 64px wide (${r.w}px)`);
  assert(r.bottomCentred, `${g.key}: bottom centre, where a small hand reaches`);
  assert(/again/i.test(r.label || ''), `${g.key}: named for a screen reader ("${r.label}")`);
  await page.screenshot({ path: `${SHOTS}/replay-${g.key}.png` });
  await ctx.close();
}

// ---- 2. Animal Sounds: the pace, the replay, the auto-repeat -------------------------
console.log('== Animal Sounds plays at a calmer pace, after a lead-in ==');
{
  const { ctx, page } = await open('animals');
  const lead = await page.evaluate(() => window.__toddler ? null : null);
  await page.waitForTimeout(2600);
  const r = await page.evaluate(() => ({
    log: window.__audioLog.slice(),
    leadIn: document.querySelector('.td-replay') ? true : false
  }));
  assert(r.log.length >= 1, `the call plays (${r.log.length} so far)`);
  const src = readFileSync('js/toddler.js', 'utf8');
  assert(/LEAD_IN_MS = 900/.test(src), 'with an authored 900ms lead-in pause before it, not 240ms');
  assert(/shell\.timeout\(\(\) => speakMaybe\(ANIMAL_WORDS\[cur\]/.test(src),
    'and the spoken word follows the call rather than landing on top of it');
  await ctx.close();
}

console.log('== the replay repeats the call and its word, unlimited and free ==');
{
  const { ctx, page } = await open('animals');
  await page.waitForTimeout(2000);
  const before = await page.evaluate(() => ({
    calls: window.__audioLog.length,
    stars: window.BooTown.State.getState().stars.total,
    state: window.__toddler.state()
  }));
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => document.querySelector('.td-replay').click());
    await page.waitForTimeout(260);
  }
  const after = await page.evaluate(() => ({
    calls: window.__audioLog.length,
    stars: window.BooTown.State.getState().stars.total,
    state: window.__toddler.state()
  }));
  assert(after.calls - before.calls === 6, `six taps played six calls (${after.calls - before.calls})`);
  assert(after.stars === before.stars, `and cost nothing (${before.stars} → ${after.stars} stars)`);
  assert(after.state.misses === before.state.misses, `and counted no miss (${after.state.misses})`);
  assert(after.state.done === before.state.done, 'and did not advance the round');
  await ctx.close();
}

console.log('== the "?" control replays the call too ==');
{
  const { ctx, page } = await open('animals');
  await page.waitForTimeout(2000);
  const before = await page.evaluate(() => window.__audioLog.length);
  await page.evaluate(() => document.querySelector('.help-btn').click());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => window.__audioLog.length);
  assert(after > before, `dismissing the "?" replays the call (${before} → ${after})`);
  await ctx.close();
}

console.log('== a silent six seconds brings ONE gentle repeat, never two ==');
{
  const { ctx, page } = await open('animals');
  await page.waitForTimeout(2200);
  const first = await page.evaluate(() => window.__audioLog.length);
  await page.waitForTimeout(5200);                 // 6s auto-repeat, measured from the call
  const mid = await page.evaluate(() => ({ calls: window.__audioLog.length, repeated: window.__toddler.autoRepeated ? window.__toddler.autoRepeated() : null }));
  await page.waitForTimeout(8000);                 // another eight seconds of silence
  const late = await page.evaluate(() => window.__audioLog.length);
  assert(mid.calls === first + 1, `exactly one repeat after the wait (${first} → ${mid.calls})`);
  assert(late === mid.calls, `and no second one, ever (${late})`);
  const bubble = await page.evaluate(() => document.querySelector('.peek-bubble')?.textContent || '');
  assert(/listen again/i.test(bubble), `with the gentle line ("${bubble}")`);
  await page.screenshot({ path: `${SHOTS}/auto-repeat.png` });
  await ctx.close();
}

console.log('== answering stops the wait, so a repeat never talks over her ==');
{
  const { ctx, page } = await open('animals');
  await page.waitForTimeout(2200);
  const before = await page.evaluate(() => window.__audioLog.length);
  await page.evaluate(() => window.__toddler.tap(true));       // correct tap
  await page.waitForTimeout(6500);
  const after = await page.evaluate(() => window.__audioLog.length);
  // a correct tap plays the call once itself, then the NEXT question plays its own call
  assert(after - before <= 3, `no stray auto-repeat piles on after an answer (${after - before} calls)`);
  await ctx.close();
}

console.log('== sound-off behaviour is untouched: the portrait target still carries it ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  const silent = SAVE.replace('"sound":true', '"sound":false').replace('"sound": true', '"sound": false');
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), silent);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'animals' }));
  await page.waitForTimeout(1800);
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => ({
    portrait: window.__toddler.animals ? true : false,
    portraitShown: document.querySelectorAll('.td-animal-portrait').length,
    replay: !!document.querySelector('.td-replay')
  }));
  assert(r.portraitShown >= 1, 'with the sound off the game still shows the portrait target');
  assert(r.replay, 'and the replay control is still there for the spoken word');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
