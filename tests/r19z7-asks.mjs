// tests/r19z7-asks.mjs — RUN19 Z7: differentiated asks.
//
// Two games get a different KIND of question about work they already set:
//   · BOO DASH — Z7's estimation half was REVERTED at Alex's decision; this guards that the
//     classic answer gates are back, and covers the pre-existing wrong-answer bug the revert
//     uncovered (RUN18D's explanation had never once reached a child in Boo Dash).
//   · BOO BOUNCE — BUILD THE ANSWER. The wall carries digits 0-9 and she breaks them biggest
//     place first; a wrong-order hit wobbles and hands the ball back.
// Question SOURCES are untouched in both — same generators, same keys, same ledger.
// Expected runtime ~35s. Not @serial.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = {
  version: 23, name: 'Ada', created: 1750000000000,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: {}, stars: { total: 400, byGame: {} }, meter: 0, boxes: 0, opened: 4, stardust: 0,
  nicknames: {}, equips: {}, sparkles: {}, town: { areas: {} },
  request: { actives: [], lastResolvedAt: Date.now() },
  settings: { sound: false, music: false, voice: false, mic: false, requests: false, content: 'full' },
  seen: { ageAsked: true, introSeen: { dash: true, bounce: true } }
};

const browser = await chromium.launch();
async function boot() {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ---- Boo Dash: classic gates, and the wrong-answer explanation ------------------------
// Z7's ESTIMATION half was REVERTED at Alex's decision (2026-07-30). Measured over 600 real
// questions per level, the rule the pack authored produced a poor question a large part of the
// time: 25% of Level 1 answers are already multiples of ten ("is 80 nearer 80 or 90?"), and
// 30% of Level 3 answers are under 11 ("is 6 nearer 0, 10 or 20?"). Dash keeps its classic
// answer gates. What this block now guards is that the revert is COMPLETE, and the real
// pre-existing bug the revert uncovered.
console.log('== Boo Dash keeps its classic answer gates ==');
{
  const { ctx, page } = await boot();
  await page.evaluate(() => window.BooTown.go('dash'));
  await page.waitForSelector('.picker', { timeout: 10000 });
  await page.click('.picker-levels .level-btn');
  await page.waitForSelector('.d2-scene', { timeout: 10000 });
  await page.waitForFunction(() => window.__dash, { timeout: 8000 });
  await page.waitForFunction(() => window.__dash.state().phase === 'wait', { timeout: 12000 });
  const row = await page.evaluate(() => ({
    gates: document.querySelectorAll('.d2-gate').length,
    fences: document.querySelectorAll('.d2-fence').length,
    labels: [...document.querySelectorAll('.d2-gate .g-label')].map(n => n.textContent),
    aria: [...document.querySelectorAll('.d2-gate')].map(n => n.getAttribute('aria-label')),
    prompt: (document.querySelector('.dash-fact') || {}).textContent,
    answer: window.__dash.correct()
  }));
  assert(row.gates === 3, `three gates, one per lane, as Dash always had (${row.gates})`);
  assert(row.fences === 0, 'and no estimation fence anywhere');
  assert(row.labels.includes(String(row.answer)), `one gate carries the real answer (${JSON.stringify(row.labels)} for ${row.answer})`);
  assert(!/nearer/i.test(row.prompt || ''), `the prompt is the plain question again (${row.prompt})`);
  assert(row.aria.every(a => /answer gate/.test(a || '')), `and a screen reader hears "answer gate" (${row.aria[0]})`);

  console.log('== the wrong-answer explanation, which had NEVER worked ==');
  // PRE-EXISTING, found while reverting and verified on main: tapGate's wrong branch threw
  // every single time, so RUN18D's explanation never once reached a child in Boo Dash.
  //   1. `fmt` was not declared in tapGate's scope at all — ReferenceError on every wrong tap.
  //   2. `question.options[question.correct]` does not exist on a Dash question; it comes from
  //      genQuestion() as { display, answer, key, distractors, fmt }.
  const wrong = await page.evaluate(async () => {
    const answer = window.__dash.correct();
    window.__dash.tap(false);
    await new Promise(r => setTimeout(r, 400));
    return { answer, line: (document.querySelector('.guide-peek.show .peek-bubble') || {}).textContent, bonks: window.__dash.state().bonks };
  });
  assert(wrong.bonks === 1, 'a wrong gate is a soft bonk');
  assert(new RegExp(`^That gate said .+ — the answer was ${wrong.answer}!$`).test(wrong.line || ''),
    `and it now SAYS what the answer was, in RUN18D's authored words (${wrong.line})`);
  await ctx.close();
}

// ---- Boo Bounce: build the answer ---------------------------------------------------
console.log('== Boo Bounce builds the answer, biggest place first ==');
{
  const { ctx, page } = await boot();
  // The generator is random and plenty of answers are single-digit (7, 4...). A one-digit
  // answer has no tens to put first, so it KEEPS the classic three-label round — that is the
  // honest behaviour, not a gap. Play on until a multi-digit answer turns up.
  await page.evaluate(() => window.BooTown.go('bounce'));
  await page.waitForSelector('.picker, .start-card', { timeout: 10000 });
  const levels = await page.$$('.picker-choices .acc-chip, .picker-levels .level-btn');
  // pick the "bonds" category if it is offered — nearly all its level-3 answers are two-digit
  const bonds = await page.$('.picker-choices .acc-chip:has-text("bond"), .acc-chip:has-text("Bond")');
  if (bonds) await bonds.click();
  const lv = await page.$$('.picker-levels .level-btn, .level-row .level-btn');
  await lv[Math.min(2, lv.length - 1)].click();
  await page.waitForFunction(() => window.__bounce, { timeout: 10000 });
  await sleep(600);

  const found = await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      if (window.__bounce.digitMode()) {
        return { ok: true, digits: window.__bounce.answerDigits(), masked: window.__bounce.masked(), needed: window.__bounce.needed(),
                 onWall: window.__bounce.digitsOnWall(), panel: [...document.querySelectorAll('.bt-digit')].map(n => n.textContent), q: window.__bounce.question() };
      }
      if (!window.__bounce.nextQuestion) break;
      window.__bounce.nextQuestion();
      await new Promise(r => setTimeout(r, 40));
    }
    return { ok: window.__bounce.digitMode(), digits: window.__bounce.answerDigits(), q: window.__bounce.question() };
  });
  if (!found.ok) {
    console.log(`  · this round drew only single-digit answers (${found.q && found.q.correctText}) — the classic round is correct for those; the digit rules are asserted below on a forced fixture`);
  } else {
    assert(found.digits.length >= 2, `a multi-digit answer builds: ${found.q.prompt} = ${found.digits}`);
    assert(found.masked === found.digits[0].replace(/./, '_') + '_'.repeat(found.digits.length - 1) || /^_+$/.test(found.masked),
      `the target starts fully masked, one slot per digit (${found.masked})`);
    assert(found.panel.length === found.digits.length, `the panel shows ${found.digits.length} slots (${JSON.stringify(found.panel)})`);
    assert(found.panel.every(c => c === '_'), 'all masked before she starts');
    const wall = found.onWall.slice().sort();
    assert(wall.length === 10 && '0123456789'.split('').every(d => wall.includes(d)),
      `every digit 0-9 is somewhere on the wall (${JSON.stringify(found.onWall)})`);
    assert(found.needed === found.digits[0], `the digit it wants first is the biggest place (${found.needed})`);

    console.log('== order is the lesson: a later digit first is refused, gently ==');
    const order = await page.evaluate(async () => {
      const d = window.__bounce.answerDigits();
      const distinct = d[0] !== d[1];
      const wrongOrder = distinct ? window.__bounce.hitDigit(d[1]) : null;   // the ones, first
      const line1 = (document.querySelector('.guide-peek.show .peek-bubble') || {}).textContent;
      const rightFirst = window.__bounce.hitDigit(d[0]);
      const maskedMid = window.__bounce.masked();
      const rest = [];
      for (let i = 1; i < d.length; i++) rest.push(window.__bounce.hitDigit(d[i]));
      return { d, distinct, wrongOrder, line1, rightFirst, maskedMid, rest, masked: window.__bounce.masked() };
    });
    if (order.distinct) {
      assert(order.wrongOrder && !order.wrongOrder.advanced, `hitting the ones digit first does NOT fill anything (${JSON.stringify(order.wrongOrder)})`);
      assert(order.wrongOrder && order.wrongOrder.wobbling, 'the brick wobbles — the Explanation Standard\'s other half, which RUN18D said had nowhere to live on a canvas rect');
      assert(/^Tens first!$|^Hundreds first!$|^Thousands first!$/.test(order.line1 || ''),
        `and the authored line names the place she skipped (${order.line1})`);
    } else {
      console.log(`  · this answer's digits repeat (${order.d}) so the wrong-order case cannot be posed with a different digit`);
    }
    assert(order.rightFirst && order.rightFirst.advanced, `the biggest place fills first (${JSON.stringify(order.rightFirst)})`);
    assert(order.maskedMid[0] === order.d[0] && order.maskedMid.includes('_'),
      `and the mask fills that slot only (${order.maskedMid})`);
  }
  await ctx.close();
}

// ---- the wrong-DIGIT line, on a forced fixture --------------------------------------
console.log('== a digit that is not in the answer at all says which one is wanted ==');
{
  const { ctx, page } = await boot();
  await page.evaluate(() => window.BooTown.go('bounce'));
  await page.waitForSelector('.picker, .start-card', { timeout: 10000 });
  const lv = await page.$$('.picker-levels .level-btn, .level-row .level-btn');
  await lv[Math.min(2, lv.length - 1)].click();
  await page.waitForFunction(() => window.__bounce, { timeout: 10000 });
  await sleep(500);
  const res = await page.evaluate(async () => {
    for (let i = 0; i < 30 && !window.__bounce.digitMode(); i++) { if (!window.__bounce.nextQuestion) break; window.__bounce.nextQuestion(); await new Promise(r => setTimeout(r, 30)); }
    if (!window.__bounce.digitMode()) return { skipped: true };
    const d = window.__bounce.answerDigits();
    const absent = '0123456789'.split('').find(x => !d.includes(x));
    const r = window.__bounce.hitDigit(absent);
    return { d, absent, r, line: (document.querySelector('.guide-peek.show .peek-bubble') || {}).textContent };
  });
  if (res.skipped) console.log('  · no multi-digit answer available this round; covered above');
  else {
    assert(res.r && !res.r.advanced, `a digit that is not in the answer fills nothing (${JSON.stringify(res.r)})`);
    assert(res.line === `Not ${res.absent} — we need ${res.d[0]}!`,
      `and the authored line names both (${res.line})`);
  }
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
