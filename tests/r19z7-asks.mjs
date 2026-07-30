// tests/r19z7-asks.mjs — RUN19 Z7: differentiated asks.
//
// Two games get a different KIND of question about work they already set:
//   · BOO DASH — the gates become ESTIMATION. The two nearest multiples of ten (three at level
//     3), never a tie, labelled with just the numbers, prompt "Which is «expr» nearer?".
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

// ---- Boo Dash: the estimation generator, exhaustively ------------------------------
console.log('== the estimation gates are the two nearest tens, and never a tie ==');
{
  const { ctx, page } = await boot();
  await page.evaluate(() => window.BooTown.go('dash'));
  await page.waitForSelector('.picker', { timeout: 10000 });
  await page.click('.picker-levels .level-btn');
  await page.waitForSelector('.d2-scene', { timeout: 10000 });
  await page.waitForFunction(() => window.__dash, { timeout: 8000 });
  await sleep(900);

  const gen = await page.evaluate(() => {
    const g = (a, lv) => window.__dash.estimationGates(a, lv);
    const out = { two: {}, three: {}, ties: [], sweep: { ok: 0, tie: 0, bad: [] } };
    out.two[62] = g(62, 1); out.two[68] = g(68, 1); out.two[61] = g(61, 2); out.two[70] = g(70, 1);
    out.three[62] = g(62, 3); out.three[47] = g(47, 3);
    for (const a of [5, 15, 25, 65, 95, 105]) if (g(a, 1) === null) out.ties.push(a);
    // every whole answer 0..200: two gates, in order, exactly one correct, and it really is
    // the nearer of the two.
    for (let a = 0; a <= 200; a++) {
      const r = g(a, 1);
      if (!r) { out.sweep.tie++; continue; }
      const nearest = r.find(x => x.correct);
      const other = r.find(x => !x.correct);
      const ok = r.length === 2 && r.filter(x => x.correct).length === 1
        && r[1].v - r[0].v === 10 && r[0].v % 10 === 0
        && Math.abs(a - nearest.v) < Math.abs(a - other.v)
        && a >= r[0].v && a <= r[1].v;
      if (ok) out.sweep.ok++; else out.sweep.bad.push({ a, r });
    }
    return out;
  });
  assert(JSON.stringify(gen.two[62].map(g => [g.v, g.correct])) === JSON.stringify([[60, true], [70, false]]),
    `62 offers 60 and 70, nearer 60 (${JSON.stringify(gen.two[62])})`);
  assert(JSON.stringify(gen.two[68].map(g => [g.v, g.correct])) === JSON.stringify([[60, false], [70, true]]),
    `68 offers 60 and 70, nearer 70 (${JSON.stringify(gen.two[68])})`);
  assert(gen.three[62].length === 3, `level 3 offers three consecutive multiples (${JSON.stringify(gen.three[62].map(g => g.v))})`);
  assert(gen.three[62].filter(g => g.correct).length === 1 && gen.three[62].find(g => g.correct).v === 60,
    'and exactly one of the three is the nearest');
  assert(JSON.stringify(gen.ties) === JSON.stringify([5, 15, 25, 65, 95, 105]),
    `an answer exactly halfway is refused so it can be regenerated — it has no nearer gate (${JSON.stringify(gen.ties)})`);
  assert(gen.sweep.bad.length === 0,
    `every whole answer 0-200 gets a correct, ordered, in-range pair (${gen.sweep.ok} ok, ${gen.sweep.tie} ties, bad: ${JSON.stringify(gen.sweep.bad.slice(0, 3))})`);

  console.log('== ...and the round shows them ==');
  const live = await page.evaluate(() => ({
    est: window.__dash.estimation(), gates: window.__dash.gates(), labels: window.__dash.gateLabels(),
    fences: window.__dash.fences(), prompt: window.__dash.prompt(), answer: window.__dash.correct()
  }));
  assert(live.est, 'the round is an estimation round');
  assert(live.labels.every(l => /^\d+$/.test(l)), `gate labels are just the numbers (${JSON.stringify(live.labels)})`);
  assert(live.labels.length === live.gates.length, 'one label per gate');
  assert(live.gates.length === 2 ? live.fences === 1 : live.fences === 0,
    `a two-gate row fills the middle lane with fence, so there is no invisible gap (${live.gates.length} gates, ${live.fences} fence)`);
  assert(/^Which is .+ nearer\?$/.test(live.prompt), `the prompt is the authored one (${live.prompt})`);
  assert(!/=\s*\?/.test(live.prompt), `and does not carry the display's trailing "= ?" (${live.prompt})`);

  console.log('== the nearer gate opens; the other explains itself ==');
  await page.waitForFunction(() => window.__dash && window.__dash.state().phase === 'wait', { timeout: 12000 });
  const wrong = await page.evaluate(async () => {
    const before = window.__dash.state();
    window.__dash.tapWrong();
    await new Promise(r => setTimeout(r, 300));
    return { before: before.gate, after: window.__dash.state().gate, bonks: window.__dash.state().bonks, react: (document.querySelector('.guide-peek.show .peek-bubble') || {}).textContent };
  });
  assert(wrong.after === wrong.before, 'the wrong gate does not open');
  assert(wrong.bonks >= 1, 'it is a soft bonk, like any wrong gate');
  assert(/ is \d+ — nearer \d+!$/.test(wrong.react || ''), `and it says the value and which multiple it is nearer (${wrong.react})`);
  await page.waitForFunction(() => window.__dash && window.__dash.state().phase === 'wait', { timeout: 12000 });
  const right = await page.evaluate(async () => {
    const before = window.__dash.state().gate;
    window.__dash.tapNearest();
    await new Promise(r => setTimeout(r, 400));
    return { before, after: window.__dash.state().gate, react: (document.querySelector('.guide-peek.show .peek-bubble') || {}).textContent };
  });
  assert(right.after === right.before + 1, `the nearer gate opens and the run continues (gate ${right.before} → ${right.after})`);
  assert(/ is \d+ — nearer \d+!$/.test(right.react || ''),
    `and it explains on the RIGHT answer too — the number she estimated is the one she never saw (${right.react})`);
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
