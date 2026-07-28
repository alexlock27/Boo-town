// tests/r18b-echoagain.mjs — RUN18B Y6: Echo Boos, hear it again.
//
// A slip used to restart the tune AT her, slower, whether she wanted it or not — and a
// slower tune is a different tune to echo. Now the play stops and she is asked. Hearing it
// again replays the same notes at the same tempo, costs the third star and nothing else,
// and is offered once per round; a second slip ends the round warmly.
//
// Expected runtime: ~70s (measured — section 3 grows a tune to nine notes in real time). Not @serial — the evidence is the note log, not frames.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18b/y6';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 },
  stars: { total: 300, byType: { maths: 60, word: 60, puzzle: 60, creative: 60, lesson: 60 }, spent: {}, legacy: 0, byGame: {} },
  trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 300, introSeen: { echoboos: true }, echoBest: 3, whatsnewVersion: 'x' },
  settings: { sound: true, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open({ lightning = false, width = 1024, height = 768 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(l => window.BooTown.go('echoboos', { resume: true, lightning: l }), lightning);
  await page.waitForFunction(() => window.__echo, null, { timeout: 15000 });
  await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setAudioLog(true); sfx.initAudio();
    window.__notes = () => sfx.getAudioLog().filter(e => e.tag === 'key').map(e => e.freq);
    window.__clearNotes = () => { sfx.setAudioLog(false); sfx.setAudioLog(true); };
  });
  await page.waitForFunction(() => window.__echo.state().inputPhase, null, { timeout: 15000 });
  return { ctx, page };
}
const slip = page => page.evaluate(() => {
  const seq = window.__echo.sequence();
  window.__echo.tap((seq[0] + 1) % 4);       // a wrong pad on the very first note
});

// ---- 1. the offer ----------------------------------------------------------------------
console.log('== 1. a slip stops the play and asks ==');
{
  const { ctx, page } = await open();
  await slip(page);
  await page.waitForTimeout(200);
  const card = await page.evaluate(() => ({
    up: window.__echo.againUp(),
    line: (document.querySelector('.echo-again-line') || {}).textContent,
    btns: [...document.querySelectorAll('.echo-again-btns .btn')].map(b => b.textContent),
    input: window.__echo.state().inputPhase,
    lit: document.querySelectorAll('.echo-boo.lit').length
  }));
  assert(card.up, 'the offer appears on a slip');
  assert(card.line === 'Nearly! Want to hear it once more?', `the copy is verbatim: "${card.line}"`);
  assert(JSON.stringify(card.btns) === JSON.stringify(['🔊 Hear it again', 'Keep going']),
    `both buttons, hear-it-again first: ${JSON.stringify(card.btns)}`);
  assert(!card.input && card.lit === 0, 'the play STOPS — nothing lit, nothing counting');
  await page.screenshot({ path: `${SHOTS}/offer-1024x768.png` });
  await ctx.close();
}

// ---- 2. the replay is note-identical, at the same tempo --------------------------------
console.log('== 2. hear it again replays the same notes at the same tempo ==');
{
  const { ctx, page } = await open();
  // grow the tune so the comparison is of a real sequence, not one note
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__echo.echoAll());
    await page.waitForFunction(() => window.__echo.state().inputPhase, null, { timeout: 12000 });
  }
  const seqBefore = await page.evaluate(() => window.__echo.sequence());
  await page.evaluate(() => window.__clearNotes());
  await slip(page);
  await page.waitForTimeout(150);
  const t0 = Date.now();
  await page.evaluate(() => window.__echo.hearAgain());
  await page.waitForFunction(() => window.__echo.state().inputPhase, null, { timeout: 15000 });
  const heardMs = Date.now() - t0;
  const notes = await page.evaluate(() => window.__notes());
  const seqAfter = await page.evaluate(() => window.__echo.sequence());
  // band.key() logs the fundamental AND its octave, so every note is two entries; the
  // fundamentals are the even ones. The slip's own tap is logged first, so the TAIL is
  // what the replay played.
  const played = notes.filter((_, i) => i % 2 === 0).slice(-seqBefore.length);
  const expect = await page.evaluate(s => {
    const SEMIS = [0, 4, 7, 12];   // the four podium pitches, as echoboos plays them
    return s.map(i => Math.round(261.63 * Math.pow(2, SEMIS[i] / 12)));
  }, seqBefore);
  assert(JSON.stringify(played) === JSON.stringify(expect),
    `the replay is note-identical (${played.join('/')} vs ${expect.join('/')})`);
  assert(JSON.stringify(seqAfter) === JSON.stringify(seqBefore), 'the round continues at the same length');
  const gap = await page.evaluate(l => window.__echo.gap(l), seqBefore.length);
  const expectMs = 500 + gap * seqBefore.length + 200;
  assert(Math.abs(heardMs - expectMs) < expectMs * 0.5,
    `at the same tempo, not slowed (${heardMs}ms against ${Math.round(expectMs)}ms of playback)`);
  assert(await page.evaluate(() => window.__echo.heardAgain()), 'the round remembers that she heard it');
  await ctx.close();
}

// ---- 3. the cap, and once per round ----------------------------------------------------
console.log('== 3. hearing it again caps the round at two stars, and is offered once ==');
{
  const { ctx, page } = await open();
  for (let i = 0; i < 8; i++) {   // reach a 3-star length (8) so the cap has something to bite
    await page.evaluate(() => window.__echo.echoAll());
    await page.waitForFunction(() => window.__echo.state().inputPhase, null, { timeout: 15000 });
  }
  const uncapped = await page.evaluate(() => window.__echo.stars());
  assert(uncapped === 3, `a clean run of ${await page.evaluate(() => window.__echo.state().len)} is worth 3 stars`);
  await slip(page);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__echo.hearAgain());
  await page.waitForFunction(() => window.__echo.state().inputPhase, null, { timeout: 15000 });
  assert(await page.evaluate(() => window.__echo.stars()) === 2, 'hearing it again caps the round at 2 stars');

  // a SECOND slip ends the round, softly, with no second offer
  await slip(page);
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    up: window.__echo.againUp(), ended: window.__echo.state().ended,
    status: (document.querySelector('.echo-status') || {}).textContent
  }));
  assert(!after.up, 'the offer is not made twice');
  assert(after.ended, 'the second slip ends the round');
  assert(after.status === "What a tune! Let's see your stars.", `softened, as authored: "${after.status}"`);
  await page.screenshot({ path: `${SHOTS}/second-slip-1024x768.png` });
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'results', null, { timeout: 12000 });
  assert(true, 'the capped round hands over to results');
  await ctx.close();
}

// ---- 4. Keep going, and Lightning unchanged --------------------------------------------
console.log('== 4. "Keep going" carries on uncapped; Lightning is untouched ==');
{
  const { ctx, page } = await open();
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.__echo.echoAll());
    await page.waitForFunction(() => window.__echo.state().inputPhase, null, { timeout: 15000 });
  }
  await slip(page);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__echo.keepGoing());
  const kept = await page.evaluate(() => ({
    input: window.__echo.state().inputPhase, pos: window.__echo.state().pos,
    stars: window.__echo.stars(), heard: window.__echo.heardAgain(), up: window.__echo.againUp()
  }));
  assert(kept.input && kept.pos === 0, 'Keep going hands the tune straight back to her');
  assert(kept.stars === 3 && !kept.heard, 'and costs her nothing');
  assert(!kept.up, 'the card is gone');
  await ctx.close();

  const l = await open({ lightning: true });
  await l.page.evaluate(() => window.__echo.tap((window.__echo.sequence()[0] + 1) % 4));
  await l.page.waitForTimeout(250);
  const light = await l.page.evaluate(() => ({
    up: window.__echo.againUp(), status: (document.querySelector('.echo-status') || {}).textContent,
    lightning: window.__echo.state().lightning, mercy: window.__echo.state().mercyUsed
  }));
  assert(light.lightning, 'Lightning is the mode under test');
  assert(!light.up, 'Lightning never shows the offer');
  assert(light.mercy && light.status === 'Oops! Listen once more…', 'Lightning keeps its own one mercy, unchanged');
  await l.ctx.close();
}

assert(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));
await browser.close();
console.log(failed ? '\nFAIL' : '\nALL PASS');
process.exit(failed ? 1 : 0);
