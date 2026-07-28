// tests/r18b-welcome-tour.mjs — RUN18B Y16: "How Boo Town works".
//
// Three cards in the hub's own flow, once, skippable, committed the moment she answers, with
// the replay living in the grown-ups screen. The pack's assertions: shows once, survives a
// reload, replay works, and it NEVER renders over a game or over her results.
// Expected runtime: ~20s. Not @serial.

import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The authored copy, from the pack. Verbatim or it is not the pack's tour.
const STEPS = [
  ['Welcome to Boo Town! Play games, earn stars, and build a town full of Boos.', 'Next'],
  ['Stars come in five colours — Maths, Word, Puzzle, Creative and Lesson. Each shop shelf likes its own colour best!', 'Next'],
  ['Stars fill your meter. A full meter earns a mystery box — and boxes bring new Boos home!', 'Show me the games!']
];

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (seen = {}) => JSON.stringify({
  version: 18, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 900, byGame: {}, byType: { maths: 200, word: 200, puzzle: 200, creative: 200, lesson: 200 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, shop: { welcomed: true },
  seen: Object.assign({ trophyRetro: true, lastStarsShown: 900, introSeen: { bubblepop: true, spellboo: true } }, seen),
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(seen = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  // Seed only when empty — this suite reloads to prove the flag persists.
  await page.addInitScript(s => { if (!localStorage.getItem('bootown.save.v1')) localStorage.setItem('bootown.save.v1', s); }, save(seen));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.waitForSelector('.hub', { timeout: 20000 });
  return { ctx, page };
}
const tour = (page) => page.evaluate(() => {
  const c = document.querySelector('.tour-card');
  if (!c) return null;
  return {
    text: (c.querySelector('.tour-text') || {}).textContent,
    button: (c.querySelector('.tour-next') || {}).textContent,
    dots: c.querySelectorAll('.tour-dot').length,
    lit: [...c.querySelectorAll('.tour-dot')].findIndex(d => d.classList.contains('on')),
    hasSkip: !!c.querySelector('.tour-skip'),
    inSpecials: !!c.closest('.hub-specials'),
    inLayer: !!c.closest('.overlay, .intro-overlay, [role="dialog"]')
  };
});

// ================== 1. the three cards, verbatim, in the hub's own flow ==================
console.log('== 1. three cards, the authored copy, page content not a layer ==');
{
  const { ctx, page } = await open();
  for (let i = 0; i < STEPS.length; i++) {
    const t = await tour(page);
    assert(!!t, `step ${i + 1} is on screen`);
    assert(t.text === STEPS[i][0], `step ${i + 1} copy is verbatim ("${(t.text || '').slice(0, 46)}…")`);
    assert(t.button === STEPS[i][1], `step ${i + 1} button is "${STEPS[i][1]}" (got "${t.button}")`);
    assert(t.dots === 3 && t.lit === i, `and it says where she is: dot ${t.lit + 1} of ${t.dots}`);
    assert(t.inSpecials && !t.inLayer, `step ${i + 1} is IN the hub's flow, not a layer over it`);
    assert(t.hasSkip, `step ${i + 1} can be skipped`);
    if (i < STEPS.length - 1) { await page.click('.tour-next'); await sleep(250); }
  }
  // the last button finishes and takes her to the games
  await page.click('.tour-next');
  await sleep(600);
  const done = await page.evaluate(() => ({
    gone: !document.querySelector('.tour-card'),
    flag: window.BooTown.State.getState().seen.welcomeTour,
    onHub: document.getElementById('screen').dataset.screen,
    learn: !![...document.querySelectorAll('.group-label')].find(l => l.textContent === 'Learn')
  }));
  assert(done.gone, '"Show me the games!" ends the tour');
  assert(done.flag === true, 'and marks it seen');
  assert(done.onHub === 'hub' && done.learn, 'leaving her on the hub, with the Learn row there to scroll to');
  await ctx.close();
}

// ================== 1b. the critic's three ==================
console.log('== 1b. dots readable, skip a real target, the hub guide not squeezed ==');
{
  const { ctx, page } = await open();
  for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(250);
    const r = await page.evaluate(() => {
      const skip = document.querySelector('.tour-skip').getBoundingClientRect();
      const lit = document.querySelector('.tour-dot.on');
      const off = document.querySelector('.tour-dot:not(.on)');
      const cs = getComputedStyle(lit);
      return {
        skipW: Math.round(skip.width), skipH: Math.round(skip.height),
        ring: cs.boxShadow !== 'none',
        offBg: getComputedStyle(off).backgroundColor,
        gap: Math.round(parseFloat(getComputedStyle(document.querySelector('.tour-btns')).gap)),
        guide: !!document.querySelector('.hub-guide')
      };
    });
    assert(r.skipW >= 56 && r.skipH >= 56, `${w}px: skip is a real tap target (${r.skipW}x${r.skipH})`);
    assert(r.ring, `${w}px: the lit dot is marked by shape as well as colour`);
    assert(/0\.5[0-9]|0\.6/.test(r.offBg), `${w}px: the unlit dots are dark enough to see (${r.offBg})`);
    assert(r.gap >= 24, `${w}px: skip is not a fat finger from Next (${r.gap}px)`);
    assert(r.guide === false, `${w}px: the hub's guide bubble stands down while the tour is up — it cannot be squeezed to a sliver`);
  }
  // and it comes back the moment the tour is done
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.click('.tour-skip');
  await sleep(200);
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub', { timeout: 15000 });
  await sleep(250);
  assert(await page.evaluate(() => !!document.querySelector('.hub-guide')), 'and the guide is back on the very next hub');
  await ctx.close();
}

// ================== 2. once, and it survives a reload ==================
console.log('== 2. once — and the answer is committed, not debounced ==');
{
  const { ctx, page } = await open();
  await page.click('.tour-next'); await sleep(200);
  await page.click('.tour-skip');            // skip half way through
  await sleep(200);
  const flag = await page.evaluate(() => window.BooTown.State.getState().seen.welcomeTour);
  assert(flag === true, 'skipping counts as told');
  // reloaded immediately — well inside the save's two-second debounce
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub', { timeout: 20000 });
  await sleep(300);
  const after = await tour(page);
  assert(after === null, 'and it does not come back after a reload — the flag was committed at once');
  await ctx.close();
}
{
  // a save that has already seen it never gets it at all
  const { ctx, page } = await open({ welcomeTour: true });
  await sleep(300);
  assert(await tour(page) === null, 'a save that has been told is not told again');
  await ctx.close();
}

// ================== 3. it never lands over a game or her results ==================
console.log('== 3. never over a game, never over her results ==');
{
  const { ctx, page } = await open();
  for (const [route, params, ready] of [
    ['bubblepop', { resume: { cat: 'tables', level: 1 } }, '.bubble-field'],
    ['spellboo', { resume: { cat: 'trickyTh', level: 1 } }, '.spell-stage'],
    ['results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, level: 1, cat: 'tables', mix: false }, '.result-card']
  ]) {
    await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
    await page.waitForSelector(ready, { timeout: 15000 });
    await sleep(350);
    const there = await page.evaluate(() => !!document.querySelector('.tour-card'));
    assert(!there, `no tour card on ${route}, with the tour still unseen`);
  }
  // and it is still waiting for her when she gets back
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub', { timeout: 15000 });
  await sleep(250);
  assert(!!(await tour(page)), 'and it is still waiting on the hub — not lost, just not in the way');
  // structural, not incidental: only the hub builds it
  const hits = ['js/hub.js', 'js/results.js', 'js/gameshell.js', 'js/main.js']
    .filter(f => /createWelcomeTour/.test(readFileSync(f, 'utf8')));
  assert(hits.join() === 'js/hub.js', `only the hub ever builds it (${hits.join(', ') || 'nobody'})`);
  await ctx.close();
}

// ================== 4. the replay, where the pack put it ==================
console.log('== 4. "Show the welcome tour again", in the grown-ups screen ==');
{
  const { ctx, page } = await open({ welcomeTour: true });
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-card', { timeout: 15000 });
  const btn = await page.$('.gu-tour-replay');
  assert(!!btn, 'the replay control is on the grown-ups screen');
  const label = await page.$eval('.gu-tour-replay', n => n.textContent);
  assert(label === 'Show the welcome tour again', `labelled as the pack says ("${label}")`);
  await page.click('.gu-tour-replay');
  await sleep(250);
  assert(await page.$eval('.gu-tour-replay', n => n.disabled) === true, 'it says it has taken effect, once');
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub', { timeout: 15000 });
  await sleep(300);
  const back = await tour(page);
  assert(!!back && back.text === STEPS[0][0], 'and the tour is waiting on the next hub, back at step one');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
