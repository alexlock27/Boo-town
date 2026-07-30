// tests/r19-explain.mjs — RUN19: the explanation pass (Alex, 2026-07-30).
//
// Alex: "I want Apostrophe game, Blend it, Twin troubles to have an explanation even if
// you got it right" + "press to continue or just a Next button is needed". Every site that
// used to be a vanishing shell.react() toast is now a persistent panel: RIGHT answers get
// the why behind a Next ›; wrong answers on retry paths lock the options behind Got it ›
// so the explanation is read, not brute-forced past. Story Order (both modes) included.
//
// Also settles the audit mystery "Story Order Medium never reached results": a full
// reporter round is driven to the results screen here.
// Expected runtime: ~70s. Not @serial.

import { chromium } from 'playwright';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (content) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 },
  trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { blendit: true, soundtwins: true, apostrophepatrol: true, storyorder: true, 'storyorder-reader': true } },
  settings: { sound: false, music: false, voice: false, content }
});
const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(content) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(content));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}

// ================== 1. Twin Trouble: right answers explain too ==================
console.log('== 1. Twin Trouble — explanation on RIGHT answers, both verdict kinds ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => window.BooTown.go('soundtwins', { resume: { level: 1 } }));
  await page.waitForFunction(() => window.__twintrouble && window.__twintrouble.state().phase === 'verdict', null, { timeout: 15000 });
  let sawInnocentRight = false, sawGuiltyRight = false, sawWrong = false, guard = 0;
  while ((!sawInnocentRight || !sawGuiltyRight || !sawWrong) && guard++ < 12) {
    const st = await page.evaluate(() => window.__twintrouble.state());
    if (st.phase !== 'verdict') break;
    const c = await page.evaluate(() => window.__twintrouble.case());
    if (!sawWrong) {
      // deliberately call it the wrong way round once
      await page.evaluate((g) => g ? window.__twintrouble.verdictInnocent() : window.__twintrouble.verdictGuilty(), c.guilty);
      await page.waitForSelector('.tt-explain .tt-next', { timeout: 6000 });
      sawWrong = true;
      assert(true, 'a wrong verdict shows the persistent panel + Next (the shipped pattern, still there)');
    } else if (c.guilty) {
      await page.evaluate(() => window.__twintrouble.verdictGuilty());
      await page.waitForFunction(() => window.__twintrouble.state().phase === 'fix', null, { timeout: 6000 });
      await page.evaluate(() => window.__twintrouble.tapCulprit());
      await page.waitForSelector('.tt-explain.correct .tt-next', { timeout: 6000 });
      const line = await page.$eval('.tt-explain-line', n => n.textContent);
      assert(/Well done/.test(line) && line.length > 30, `a caught culprit explains BOTH twins ("${line.slice(0, 60)}…")`);
      sawGuiltyRight = true;
    } else {
      await page.evaluate(() => window.__twintrouble.verdictInnocent());
      await page.waitForSelector('.tt-explain.correct .tt-next', { timeout: 6000 });
      const line = await page.$eval('.tt-explain-line', n => n.textContent);
      assert(/Well done/.test(line) && line.length > 30, `a right Innocent call explains the twins ("${line.slice(0, 60)}…")`);
      sawInnocentRight = true;
    }
    const idxBefore = (await page.evaluate(() => window.__twintrouble.state())).idx;
    await page.evaluate(() => window.__twintrouble.tapNext());
    await page.waitForFunction((i) => {
      if (document.getElementById('screen').dataset.screen === 'results') return true;
      const s = window.__twintrouble.state();
      return s.idx === i + 1 && s.phase === 'verdict';
    }, idxBefore, { timeout: 8000 });
    if (await page.evaluate(() => document.getElementById('screen').dataset.screen === 'results')) break;
  }
  assert(sawInnocentRight, 'right-Innocent path exercised');
  assert(sawGuiltyRight, 'right-Guilty (culprit fix) path exercised');
  await ctx.close();
}

// ================== 2. Flying Comma: right explains + Next; wrong locks behind Got it ==================
console.log('== 2. Apostrophe Patrol / Flying Comma ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => window.BooTown.go('apostrophepatrol', { resume: { cat: 'comma', level: 1 } }));
  await page.waitForFunction(() => window.__aphub && window.__aphub.comma && window.__aphub.comma.state().phase === 'flick', null, { timeout: 15000 });
  // wrong first: options lock, Got it unlocks
  await page.evaluate(() => window.__aphub.comma.flickWrong());
  await page.waitForSelector('.explain-panel .explain-next', { timeout: 6000 });
  let locked = await page.$$eval('.ap-slot', ns => ns.every(n => n.disabled));
  assert(locked, 'a wrong flick locks the slots while the why-line is up');
  await page.evaluate(() => window.__aphub.comma.tapNext());
  await page.waitForFunction(() => [...document.querySelectorAll('.ap-slot')].every(n => !n.disabled), null, { timeout: 6000 });
  assert(true, 'Got it › unlocks the slots for another try');
  // now right: panel + Next, and the SIGN shows the mended sentence
  const item = await page.evaluate(() => window.__aphub.comma.item());
  await page.evaluate(() => window.__aphub.comma.flickCorrect());
  await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 6000 });
  const line = await page.$eval('.explain-panel.correct .explain-line', n => n.textContent);
  assert(/Well done/.test(line), `a right flick explains itself ("${line.slice(0, 60)}…")`);
  const sign = await page.$eval('.ap-sign', n => n.textContent);
  assert(sign.includes("'"), `the sign itself now wears the apostrophe ("${sign.slice(0, 40)}")`);
  const idxBefore = (await page.evaluate(() => window.__aphub.comma.state())).idx;
  await page.evaluate(() => window.__aphub.comma.tapNext());
  await page.waitForFunction((i) => window.__aphub.comma.state().idx === i + 1, idxBefore, { timeout: 6000 });
  assert(true, 'Next › advances to the following order');
  await ctx.close();
}

// ================== 3. The Squeeze Machine: success panel + Next ==================
console.log('== 3. Apostrophe Patrol / Squeeze Machine ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => window.BooTown.go('apostrophepatrol', { resume: { cat: 'squeeze' } }));
  await page.waitForFunction(() => window.__aphub && window.__aphub.squeeze && window.__aphub.squeeze.state().phase === 'wait-a', null, { timeout: 15000 });
  await page.evaluate(() => { window.__aphub.squeeze.tapA(); window.__aphub.squeeze.tapB(); });
  await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 6000 });
  const line = await page.$eval('.explain-panel.correct .explain-line', n => n.textContent);
  assert(/apostrophe/i.test(line), `the squeeze explains where the apostrophe stands ("${line.slice(0, 60)}…")`);
  const idxBefore = (await page.evaluate(() => window.__aphub.squeeze.state())).idx;
  await page.evaluate(() => window.__aphub.squeeze.tapNext());
  await page.waitForFunction((i) => window.__aphub.squeeze.state().idx === i + 1, idxBefore, { timeout: 6000 });
  assert(true, 'Next › advances the queue');
  await ctx.close();
}

// ================== 4. Blend It picture mode: right + wrong both explain ==================
console.log('== 4. Blend It (Full tier picture mode) ==');
{
  const { ctx, page } = await open('full');
  await page.evaluate(() => window.BooTown.go('blendit', { resume: { level: 1 } }));
  await page.waitForFunction(() => window.__blend && window.__blend.phase() === 'tiles', null, { timeout: 15000 });
  await page.evaluate(() => window.__blend.blend());
  await page.waitForFunction(() => window.__blend.phase() === 'pick', null, { timeout: 15000 });
  await page.evaluate(() => window.__blend.pickWrong());
  await page.waitForSelector('.explain-panel .explain-next', { timeout: 6000 });
  let locked = await page.$$eval('.bl-pick', ns => ns.every(n => n.disabled));
  assert(locked, 'a wrong picture locks the picks while the sound walk is up');
  await page.evaluate(() => window.__blend.tapNext());
  await page.waitForFunction(() => [...document.querySelectorAll('.bl-pick')].some(n => !n.disabled), null, { timeout: 6000 });
  await page.evaluate(() => window.__blend.pickCorrect());
  await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 6000 });
  const line = await page.$eval('.explain-panel.correct .explain-line', n => n.textContent);
  assert(/Well done/.test(line), `a right pick gets the sound walk too ("${line.slice(0, 60)}…")`);
  const idxBefore = (await page.evaluate(() => window.__blend.state())).idx;
  await page.evaluate(() => window.__blend.tapNext());
  await page.waitForFunction((i) => window.__blend.state().idx === i + 1, idxBefore, { timeout: 6000 });
  assert(true, 'Next › moves to the next word');
  await ctx.close();
}

// ================== 5. Story Order Medium: full reporter round to results ==================
console.log('== 5. Story Order (Medium reporter mode) — full round to results ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => window.BooTown.go('storyorder'));
  await page.waitForSelector('.start-card .btn.big', { timeout: 15000 });
  await page.click('.start-card .btn.big');
  await page.waitForFunction(() => window.__storyreader && window.__storyreader.state().phase === 'insert', null, { timeout: 15000 });
  // seat the first sentence (with no cards placed there is only one gap, so no wrong
  // placement exists yet), THEN try a wrong insert: gaps lock behind Got it
  await page.evaluate(() => window.__storyreader.placeCorrect());
  await page.waitForFunction(() => window.__storyreader.state().placed.length === 1, null, { timeout: 6000 });
  await page.evaluate(() => window.__storyreader.placeWrong());
  await page.waitForSelector('.explain-panel .explain-next', { timeout: 6000 });
  const gapsLocked = await page.$$eval('.so-gap', ns => ns.every(n => n.disabled));
  assert(gapsLocked, 'a wrong insertion locks the gaps while the connective explains');
  await page.evaluate(() => window.__storyreader.tapNext());
  await page.waitForFunction(() => window.__storyreader.state().phase === 'insert' && [...document.querySelectorAll('.so-gap')].every(n => !n.disabled), null, { timeout: 6000 });
  // then drive both stories to the results screen
  let guard = 0;
  while (guard++ < 40 && await page.evaluate(() => document.getElementById('screen').dataset.screen !== 'results')) {
    const st = await page.evaluate(() => window.__storyreader.state());
    if (st.phase === 'insert') {
      await page.evaluate(() => window.__storyreader.placeCorrect());
      await page.waitForTimeout(120);
    } else if (st.phase === 'question') {
      await page.evaluate(() => window.__storyreader.answerCorrect());
      await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 8000 });
      await page.evaluate(() => window.__storyreader.tapNext());
      await page.waitForTimeout(200);
    } else {
      await page.waitForTimeout(300);   // stamp / front page beats
    }
  }
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen === 'results'),
    'the reporter round reaches the results screen (the audit stall is not real under driving)');
  await ctx.close();
}

// ================== 6. Story Order classic: right answer panel + Next ==================
console.log('== 6. Story Order (Full tier classic mode) ==');
{
  const { ctx, page } = await open('full');
  await page.evaluate(() => window.BooTown.go('storyorder', { resume: { level: 1 } }));
  await page.waitForFunction(() => window.__story && window.__story.state().phase === 'order', null, { timeout: 15000 });
  await page.evaluate(() => window.__story.solveOrder());
  await page.waitForFunction(() => window.__story.state().phase === 'question', null, { timeout: 30000 });
  // wrong: options lock behind Got it
  const c = await page.evaluate(() => window.__story.story());
  await page.evaluate((ans) => { const n = [...document.querySelectorAll('.so-option')].find(x => x.dataset.opt !== ans); n.click(); }, c.answer);
  await page.waitForSelector('.explain-panel .explain-next', { timeout: 6000 });
  const locked = await page.$$eval('.so-option', ns => ns.every(n => n.disabled));
  assert(locked, 'a wrong answer locks the options while the nudge is read');
  await page.evaluate(() => window.__story.tapNext());
  await page.waitForFunction(() => [...document.querySelectorAll('.so-option')].every(n => !n.disabled), null, { timeout: 6000 });
  // right: panel + Next advances
  await page.evaluate((ans) => { const n = [...document.querySelectorAll('.so-option')].find(x => x.dataset.opt === ans); n.click(); }, c.answer);
  await page.waitForSelector('.explain-panel.correct .explain-next', { timeout: 6000 });
  const line = await page.$eval('.explain-panel.correct .explain-line', n => n.textContent);
  assert(/understood the whole story/.test(line), `the win confirms itself in a panel ("${line.slice(0, 60)}…")`);
  const idxBefore = (await page.evaluate(() => window.__story.state())).idx;
  await page.evaluate(() => window.__story.tapNext());
  await page.waitForFunction((i) => {
    if (document.getElementById('screen').dataset.screen === 'results') return true;
    const s = window.__story.state();
    return s.idx === i + 1;
  }, idxBefore, { timeout: 8000 });
  assert(true, 'Next › moves to the next story');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
