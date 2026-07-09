// tests/r8p0-bounce.mjs — RUN8 phase 0: Boo Bounce integrity (C0).
// Acceptance (RUN8 part D #0): aim preview on three consecutive questions; the sparkle-hop
// re-home after incidental destruction of a labelled brick; wrong labels drop before the
// correct under brick shortage; the single-remaining-brick case carries the correct answer;
// the wall restack on a new question; the 88-case scripted depleted-wall scenario; stale
// labels never persist across questions.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r8p0', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = {
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [], stars: { total: 60, byGame: {} }, ledger: {}, delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'light' },   // light → auto-starts a round
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true },
  trophies: {}, ageAsked: true, age: 8
};

const browser = await chromium.launch();
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 680 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('bounce'));
  await page.waitForSelector('.bounce-canvas');
  await page.waitForFunction(() => window.__bounce && window.__bounce.state().stuck && window.__bounce.labelInfo().length > 0, { timeout: 5000 });
  await page.evaluate(() => window.__bounce.autoPaddle(false));
  return { ctx, page };
}
const canvasBox = (page) => page.$eval('.bounce-canvas', n => { const b = n.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });

// ==================== #0a aim preview on three consecutive questions ====================
console.log('== aim-and-launch at the start of EVERY question (3 in a row) ==');
{
  const { ctx, page } = await open();
  let allStuck = true, allPreview = true;
  for (let q = 1; q <= 3; q++) {
    // the ball has returned to the paddle, resting, ready to aim
    const st = await page.evaluate(() => window.__bounce.state());
    if (!st.stuck) allStuck = false;
    // the dotted preview renders on this serve — sweep the aim, the path updates across frames
    const paths = [];
    for (const deg of [-90, -120, -55]) {
      const pv = await page.evaluate((d) => { window.__bounce.aimDeg(d); return window.__bounce.preview(); }, deg);
      if (!(pv.pts.length > 2)) allPreview = false;
      paths.push(JSON.stringify(pv.pts.map(p => Math.round(p.x))));
      await sleep(40);
    }
    if (new Set(paths).size < 2) allPreview = false;
    // real drag → dotted preview visible → screenshot this serve
    const box = await canvasBox(page);
    await page.mouse.move(box.x + box.w / 2, box.y + box.h - 40);
    await page.mouse.down();
    await page.mouse.move(box.x + box.w * 0.68, box.y + box.h * 0.32, { steps: 4 });
    await sleep(120);
    await page.screenshot({ path: `screenshots/r8p0/aim-q${q}-900x680.png` });
    await page.mouse.up();
    // answer correctly → the round advances → the ball returns to the paddle for the next question
    if (q < 3) {
      await page.evaluate(() => window.__bounce.breakCorrect());
      await page.waitForFunction(() => window.__bounce.state().stuck, { timeout: 3000 }).catch(() => {});
    }
  }
  assert(allStuck, 'the ball rests on the paddle (aim-ready) at the start of all three questions');
  assert(allPreview, 'the dotted trajectory preview renders on every serve');
  await ctx.close();
}

// ==================== #0b sparkle-hop re-home after incidental destruction ====================
console.log('== sparkle-hop re-home when a labelled brick is destroyed incidentally ==');
{
  const { ctx, page } = await open();
  // incidentally destroy a WRONG labelled brick (not an answer-hit)
  const killed = await page.evaluate(() => { const info = window.__bounce.killWrongBrick(); return { info, hops: window.__bounce.hopCount(), sum: window.__bounce.labelSummary() }; });
  assert(!!killed.info, 'a wrong labelled brick was destroyed incidentally');
  assert(killed.hops >= 1, `the destroyed label re-homes with a visible sparkle-hop (${killed.hops} hop(s) in flight)`);
  assert(killed.sum.total === 3 && killed.sum.correct === 1, `still exactly three labels, one correct after re-home (${killed.sum.total}/${killed.sum.correct})`);
  await page.screenshot({ path: 'screenshots/r8p0/hop-wrong-900x680.png' });
  // and when the CORRECT brick is destroyed incidentally, the correct answer re-homes and stays hittable
  const killC = await page.evaluate(() => { const info = window.__bounce.killCorrectBrick(); return { info, hops: window.__bounce.hopCount(), sum: window.__bounce.labelSummary() }; });
  assert(!!killC.info && killC.hops >= 1, 'destroying the correct brick incidentally also fires a sparkle-hop');
  assert(killC.sum.correctPresent && killC.sum.correctReachable, 'the correct answer re-homed to a reachable brick (still hittable)');
  await ctx.close();
}

// ==================== #0c wrong labels drop first; single brick carries the correct ====================
console.log('== wrong labels drop before the correct; single brick carries the correct ==');
{
  const { ctx, page } = await open();
  const two = await page.evaluate(() => { window.__bounce.depleteTo(2); return { wall: window.__bounce.wallCount(), sum: window.__bounce.labelSummary() }; });
  assert(two.wall === 2, `wall depleted to two bricks (${two.wall})`);
  assert(two.sum.total === 2 && two.sum.correct === 1 && two.sum.wrong === 1, `two bricks host one correct + one wrong, not two wrongs (${two.sum.total}/${two.sum.correct}c/${two.sum.wrong}w)`);
  const one = await page.evaluate(() => { window.__bounce.depleteTo(1); return { wall: window.__bounce.wallCount(), sum: window.__bounce.labelSummary() }; });
  assert(one.wall === 1, `wall depleted to a single brick (${one.wall})`);
  assert(one.sum.total === 1 && one.sum.correct === 1 && one.sum.correctReachable, 'the single remaining brick carries the correct answer, hittable');
  await ctx.close();
}

// ==================== #0d the wall restacks on a new question ====================
console.log('== the wall tops back up to >= MIN_WALL with a restack animation on a new question ==');
{
  const { ctx, page } = await open();
  const min = await page.evaluate(() => window.__bounce.minWall());
  // deplete well below the floor, then answer correctly to trigger the new-question restack
  await page.evaluate(() => window.__bounce.depleteTo(4));
  const low = await page.evaluate(() => window.__bounce.wallCount());
  assert(low <= 4, `wall depleted below the floor before the new question (${low})`);
  await page.evaluate(() => window.__bounce.breakCorrect());
  const after = await page.evaluate(() => ({ wall: window.__bounce.wallCount(), restacking: window.__bounce.restacking() }));
  assert(after.wall >= min, `the wall tops back up to at least ${min} bricks (${after.wall})`);
  assert(after.restacking > 0, `revived bricks are mid-restack animation (${after.restacking} animating)`);
  await page.screenshot({ path: 'screenshots/r8p0/restack-900x680.png' });
  // frame evidence: the restack animation finishes (animating count returns to zero)
  await sleep(600);
  const settled = await page.evaluate(() => window.__bounce.restacking());
  assert(settled === 0, 'the restack animation completes (bricks settle)');
  await ctx.close();
}

// ==================== #0e the 88-case: a depleted wall never leaves the answer absent/unhittable ====================
console.log('== the 88-case: an active question never lacks a present, hittable correct answer ==');
{
  const { ctx, page } = await open();
  // step the wall all the way down one brick at a time; after EVERY destruction (including the
  // correct brick, and down to a single brick) the correct answer must be present and hittable.
  const result = await page.evaluate(async () => {
    const B = window.__bounce; const sleep = ms => new Promise(r => setTimeout(r, ms));
    const violations = []; let steps = 0, killedCorrectOnce = false;
    function check(tag) { const s = B.labelSummary(); if (!(s.correctPresent && s.correctReachable)) violations.push(tag + ' wall=' + B.wallCount()); }
    check('start');
    while (B.wallCount() > 1 && steps++ < 60) {
      // partway through, deliberately destroy the CORRECT brick to prove it re-homes
      if (!killedCorrectOnce && B.wallCount() <= 14) { B.killCorrectBrick(); killedCorrectOnce = true; check('after-kill-correct'); }
      else { const info = B.killWrongBrick(); if (!info) B.depleteTo(B.wallCount() - 1); check('after-kill'); }
      await sleep(8);
    }
    check('single-brick');
    const single = B.labelSummary();
    return { violations, killedCorrectOnce, wall: B.wallCount(), single };
  });
  assert(result.killedCorrectOnce, 'the scenario incidentally destroyed the correct brick mid-run');
  assert(result.wall === 1, `the wall was driven down to a single brick (${result.wall})`);
  assert(result.single.total === 1 && result.single.correct === 1 && result.single.correctReachable, 'the last brick standing carries the correct answer, hittable');
  assert(result.violations.length === 0, `at no moment was the correct answer absent or unhittable (${result.violations.length} violations: ${result.violations.slice(0, 3).join('; ')})`);
  // and the correct answer on that single brick is genuinely strikable by a serve
  const strike = await page.evaluate(async () => {
    const B = window.__bounce; const sleep = ms => new Promise(r => setTimeout(r, ms));
    const before = B.state().questionsAnswered;
    const info = B.labelInfo().find(l => l.correct); if (!info) return { ok: false };
    B.serveAtLabel(info.label);
    for (let k = 0; k < 40; k++) { if (B.state().questionsAnswered > before || !B.brickAliveAt(info.c, info.r)) return { ok: true }; await sleep(60); }
    return { ok: false };
  });
  assert(strike.ok, 'a serve up the single brick strikes it and registers the answer');
  await ctx.close();
}

// ==================== #0f stale labels never persist across questions ====================
console.log('== no stale labels survive into the next question ==');
{
  const { ctx, page } = await open();
  const bad = await page.evaluate(async () => {
    const B = window.__bounce; const sleep = ms => new Promise(r => setTimeout(r, ms));
    const problems = [];
    for (let q = 0; q < 4; q++) {
      const opts = (window.__booQuestion.options || []).slice();
      const labels = B.labelInfo().map(l => l.label);
      // every visible label belongs to the CURRENT question's options
      for (const l of labels) if (opts.indexOf(l) < 0) problems.push('stale "' + l + '" not in Q' + q + ' options');
      if (!labels.some(l => l === B.question().correctText)) problems.push('correct missing in Q' + q);
      B.breakCorrect(); await sleep(60);
    }
    return problems;
  });
  assert(bad.length === 0, `labels always match the active question, never stale (${bad.length} problems: ${bad.slice(0, 3).join('; ')})`);
  await ctx.close();
}

// ==================== screenshots: portrait + phone ====================
for (const [w, h, tag] of [[768, 1024, 'portrait'], [390, 844, 'phone']]) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.hub');
  await p.evaluate(() => window.BooTown.go('bounce'));
  await p.waitForSelector('.bounce-canvas');
  await p.waitForFunction(() => window.__bounce && window.__bounce.labelInfo().length > 0);
  // show a restack + a hop in the same frame
  await p.evaluate(() => { window.__bounce.depleteTo(5); window.__bounce.breakCorrect(); window.__bounce.killWrongBrick(); });
  await sleep(120);
  await p.screenshot({ path: `screenshots/r8p0/bounce-${tag}-${w}x${h}.png` });
  await c.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
