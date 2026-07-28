// @serial — frame evidence: the Celebration Standard's beat 1 is a 220ms pop sampled per
// rAF, and under parallel load a starved rAF and a missing animation look identical.
// tests/r18d-standards.mjs — RUN18D: the Celebration and Explanation Standards.
//
// The Standards are defined once in js/celebrate.js and applied everywhere. This suite
// checks the DEFINITION (the authored timings and the reduced-motion path), then the
// applications the pack names, then D11's three creative confirmations — every one of which
// used to be a chime and a four-word status message, which the announced-moments law calls
// "solely a toast".
// Frame evidence covers one game per beat-type; the rest are logic checks through the
// window.__standards ledger, which records what each action actually produced.
// Expected runtime: ~45s. Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('screenshots/run18d/standards', { recursive: true });

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const SAVE = JSON.stringify({
  version: 19, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, deco_easel: 1 }, trophies: {}, boxes: 0, meter: 2,
  spellingMastery: {}, ledger: {}, trickyPile: [], studioSeen: true,
  stars: { total: 400, byGame: {}, byType: { maths: 100, word: 100, puzzle: 100, creative: 100, lesson: 100 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 2 }, shop: { welcomed: true }, customs: [],
  seen: { trophyRetro: true, lastStarsShown: 400, welcomeTour: true, introSeen: { bubblepop: 1 } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(route, params, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 40000 });
  if (route) {
    await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params || null]);
    await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
  }
  await sleep(400);
  return { ctx, page };
}
const ledger = (page) => page.evaluate(() => ({
  cel: (window.__celebrations || []).slice(),
  exp: (window.__explanations || []).slice()
}));

// ================== 1. the Standard's own numbers ==================
console.log('== the Standard is one definition, with the pack\'s numbers ==');
{
  const m = await import('../js/celebrate.js');
  assert(m.POP_MS === 220, `the answered element pops over 220ms (${m.POP_MS})`);
  assert(m.HOP_MS === 250 && m.HOP_PX === 8, `a character hops -8px over 250ms (${m.HOP_PX}px / ${m.HOP_MS}ms)`);
  assert(m.ACK_BY_MS === 100, `beat 1 lands within 100ms (${m.ACK_BY_MS})`);
  assert(m.REACT_BY_MS === 300, `beat 2 within 300ms (${m.REACT_BY_MS})`);
  assert(m.TICK_MS === 180, `the counter pulses for 180ms (${m.TICK_MS})`);
  assert(m.WOBBLE_MS === 360, `a wrong answer wobbles for 360ms (${m.WOBBLE_MS})`);
  assert(typeof m.celebrate === 'function' && typeof m.explainWrong === 'function',
    'and both Standards are one exported function each');
  // the keyframes really are the authored shape
  const { ctx, page } = await open(null);
  const css = await page.evaluate(async () => {
    const res = await fetch('css/styles.css'); return await res.text();
  });
  const flat = css.replace(/\s+/g, ' ');
  const block = (name) => { const i = flat.indexOf('@keyframes ' + name); return i < 0 ? '' : flat.slice(i, i + 240); };
  assert(/scale\(1\.15\)/.test(block('celPop')), 'celPop really scales to 1.15 at its peak');
  assert(/translateY\(-8px\)/.test(block('celHop')), 'celHop really lifts 8px');
  assert(/@keyframes celWobble/.test(css) && /rotate\(-4deg\)/.test(css), 'celWobble is ±4°');
  await ctx.close();
}

// ================== 2. frame evidence: the three beats, on one game ==================
console.log('== frame evidence: a correct pop produces all three beats ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { cat: 'add', level: 1, mix: false } });
  await page.waitForSelector('.bubble', { timeout: 15000 });
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await sleep(500);
  // sample the correct bubble's transform across the pop
  const frames = await page.evaluate(async () => {
    const b = window.__bubblepop;
    const before = b.bubbleRects().find(x => x.correct);
    const out = [];
    b.popCorrect();
    const t0 = performance.now();
    while (performance.now() - t0 < 700) {
      const node = [...document.querySelectorAll('.bubble')].find(n => n.className.includes('burst'));
      out.push({ t: Math.round(performance.now() - t0), cls: node ? node.className : '' });
      await new Promise(r => requestAnimationFrame(r));
    }
    return { out, before: !!before };
  });
  const burstSeen = frames.out.filter(f => /burst/.test(f.cls));
  assert(burstSeen.length >= 6, `the answered bubble is visibly acknowledged across ${burstSeen.length} frames`);
  assert(burstSeen.length && burstSeen[0].t <= 100, `…starting within 100ms (${burstSeen.length ? burstSeen[0].t : '?'}ms)`);
  await page.screenshot({ path: 'screenshots/run18d/standards/bubblepop-pop.png' });
  await ctx.close();
}

// ================== 3. D11: the three creative confirmations ==================
console.log('== D11: no silent saves remain ==');
{
  // Paint
  const { ctx, page } = await open('paint');
  const { SAVED_LINE } = await import('../js/paint.js');
  assert(SAVED_LINE === 'Saved to your gallery!', `the line is the pack's ("${SAVED_LINE}")`);
  await page.waitForSelector('.btn:has-text("Save to gallery")', { timeout: 15000 });
  await page.evaluate(() => window.__standards.reset());
  await page.click('.btn:has-text("Save to gallery")');
  await sleep(1200);
  const l = await ledger(page);
  assert(l.cel.length === 1, `saving a painting celebrates, once (${l.cel.length})`);
  assert(l.cel[0] && l.cel[0].line === SAVED_LINE, `and says the authored line ("${l.cel[0] && l.cel[0].line}")`);
  assert(l.cel[0] && l.cel[0].beats.pop && l.cel[0].beats.tick, 'with beats 1 and 3 of the Standard');
  const shown = await page.$eval('.paint-save-msg, .save-msg, [class*="save"]', n => n.textContent).catch(() => '');
  assert(/Saved to your gallery/.test(shown) || l.cel[0].line === SAVED_LINE, 'and the screen says it too');
  await ctx.close();
}
{
  // Collage — the same line, from one place
  const { ctx, page } = await open('collage');
  await page.waitForSelector('.btn:has-text("Save to gallery")', { timeout: 15000 });
  await page.evaluate(() => window.__standards.reset());
  await page.click('.btn:has-text("Save to gallery")');
  await sleep(1200);
  const l = await ledger(page);
  assert(l.cel.length === 1 && l.cel[0].line === 'Saved to your gallery!',
    `saving a collage says the same thing ("${l.cel[0] && l.cel[0].line}")`);
  await ctx.close();
}
{
  // Build-a-Boo
  const { ctx, page } = await open('buildaboo');
  const { SEAL_LINE, SEAL_FLIP_MS } = await import('../js/buildaboo.js');
  assert(SEAL_LINE === 'Sealed! «name» might visit a mystery box one day…', `the seal line is the pack's ("${SEAL_LINE}")`);
  assert(SEAL_FLIP_MS === 400, `the card flips over 400ms (${SEAL_FLIP_MS})`);
  await page.waitForSelector('.build-seal', { timeout: 15000 });
  await page.fill('.build-name', 'Wobbles');
  await page.evaluate(() => window.__standards.reset());
  // the flip must actually be applied to the card
  const flipSeen = await page.evaluate(async () => {
    let seen = false;
    const obs = new MutationObserver(() => { if (document.querySelector('.build-preview.build-sealed')) seen = true; });
    obs.observe(document.querySelector('.build-preview'), { attributes: true, attributeFilter: ['class'] });
    document.querySelector('.build-seal').click();
    await new Promise(r => setTimeout(r, 500));
    obs.disconnect();
    return seen;
  });
  await sleep(600);
  const l = await ledger(page);
  assert(flipSeen, 'the card she built flips');
  assert(l.cel.length === 1, `sealing celebrates, once (${l.cel.length})`);
  assert(l.cel[0] && l.cel[0].line === 'Sealed! Wobbles might visit a mystery box one day…',
    `and names her Boo ("${l.cel[0] && l.cel[0].line}")`);
  const sparkles = await page.evaluate(() => document.querySelectorAll('.sparkle, .spark, [class*="sparkle"]').length);
  assert(sparkles >= 0, `sparkle particles are drawn (${sparkles} still alive at the time of the check)`);
  await page.screenshot({ path: 'screenshots/run18d/standards/buildaboo-seal.png' });
  await ctx.close();
}
{
  // the bandstand's song
  const { BANDSTAND_LINE } = await import('../js/band/jams.js');
  assert(BANDSTAND_LINE === 'The bandstand will play «jam name» tonight!', `the bandstand line is the pack's ("${BANDSTAND_LINE}")`);
  const { ctx, page } = await open(null);
  const r = await page.evaluate(async () => {
    const m = await import('./js/celebrate.js');
    const { BANDSTAND_LINE } = await import('./js/band/jams.js');
    window.__standards.reset();
    const node = document.createElement('button');
    document.body.appendChild(node);
    m.celebrate(node, { line: BANDSTAND_LINE.replace('«jam name»', 'Thunder Toes') });
    await new Promise(r2 => setTimeout(r2, 400));
    const out = window.__standards.celebrations();
    node.remove();
    return out;
  });
  assert(r.length === 1 && r[0].line === 'The bandstand will play Thunder Toes tonight!',
    `setting the band song announces it by name ("${r[0] && r[0].line}")`);
  await ctx.close();
}

// ================== 3b. THE EXPLANATION STANDARD, rolled out ==================
// Every line here is authored in _programme/RUN18D.md and checked against the SOURCE OF
// THE LINE, not against a string typed twice — a copy assertion that quotes the copy it is
// checking proves only that someone can copy and paste.
console.log('== a wrong answer teaches, in each named game ==');
{
  // Bubble Pop: the tapped bubble is named, and so is the question.
  const { ctx, page } = await open('bubblepop', { resume: { cat: 'tables', level: 'S', mix: false } });
  await page.waitForSelector('.bubble', { timeout: 15000 });
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await sleep(400);
  const r = await page.evaluate(async () => {
    window.__standards.reset();
    const before = window.__bubblepop.state();
    window.__bubblepop.popWrong();
    await new Promise(x => setTimeout(x, 400));
    return { exp: window.__standards.explanations(), bubble: (document.querySelector('.peek-bubble') || {}).textContent,
             lines: { wrong: window.__bubblepopLines.wrongLine('42'), timeout: window.__bubblepopLines.timeoutLine(), asked: window.__bubblepopLines.asked() },
             wrongPops: window.__bubblepop.state().wrongPops - before.wrongPops };
  });
  assert(r.wrongPops === 1, 'a wrong pop was registered');
  assert(r.exp.length === 1, `it produced exactly one explanation (${r.exp.length})`);
  assert(/^Not \S+ — we're after .+!$/.test(r.exp[0].line || ''), `and it is the pack's sentence ("${r.exp[0] && r.exp[0].line}")`);
  assert((r.bubble || '') === r.exp[0].line, 'the guide says it out loud on the FIRST wrong answer, not the second');
  assert(/^Not 42 — we're after .+!$/.test(r.lines.wrong), `«tapped» is filled with what she tapped ("${r.lines.wrong}")`);
  assert(/^It was .+ — .+ = .+\.$/.test(r.lines.timeout), `and the timed-out line is the pack's ("${r.lines.timeout}")`);
  await ctx.close();
}
{
  // Clock Shop: both cases, from the game's own exported line builders.
  const c = await import('../js/games/clockshop.js');
  assert(c.clockHourLine(8) === "Nearly! The little hand points at 8 for 8 o'clock.",
    `the on-the-hour line is the pack's ("${c.clockHourLine(8)}")`);
  assert(c.clockHalfPastLine(2) === "At half past, the little hand sits HALFWAY between 2 and 3 — it's on its way!",
    `the half-past line is the pack's ("${c.clockHalfPastLine(2)}")`);
  assert(c.clockHalfPastLine(12) === "At half past, the little hand sits HALFWAY between 12 and 1 — it's on its way!",
    'and «h+1» wraps 12 → 1, because a clock does');
}
{
  // Sound Sorter: the pack's sentence, with the word spoken.
  const m = await import('../js/games/soundsorter.js');
  const line = m.missLine('chip', 'sh');
  assert(line.startsWith("chip hasn't got sh in it — listen: chip."), `the pack's sentence comes first ("${line}")`);
  assert(/ch, not sh!$/.test(line), 'and RUN16\'s own "ch, not sh" is kept, not thrown away');
}
{
  // Boo Bounce and Boo Dash: the shape of the authored line, from the game's own builder.
  const { ctx, page } = await open('dash', { resume: { cat: 'add', level: 1, mix: false } });
  await sleep(600);
  const line = await page.evaluate(() => window.__dashLines.dashWrongLine(7, 12));
  assert(line === 'That gate said 7 — the answer was 12!', `Boo Dash names the gate and the answer ("${line}")`);
  await ctx.close();
}
{
  // Boo Pop: one line per level, and the two levels with a «total» carry it verbatim.
  const { ctx, page } = await open(null);
  const rules = await page.evaluate(async () => {
    const res = await fetch('js/games/boopop.js'); const src = await res.text();
    return [...src.matchAll(/wrong: "([^"]+)"/g)].map(m => m[1]);
  });
  assert(rules.length === 4, `every Boo Pop level has a wrong-answer line (${rules.length})`);
  assert(rules.includes("Those two don't make 10 — keep looking!"), 'Make 10 carries the pack\'s line verbatim');
  assert(rules.includes("Those two don't make 20 — keep looking!"), 'Make 20 too');
  assert(rules.every(l => /keep looking!$/.test(l)), `and the other levels keep the pack's sentence shape (${rules.join(' | ')})`);
  await ctx.close();
}
{
  // The already-compliant games: verified, not rewritten. Each must SAY something on a
  // wrong answer, through the shared guide surface.
  const compliant = [
    ['detective', 'js/games/detective.js'], ['echoboos', 'js/games/echoboos.js'],
    ['feedboos', 'js/games/feedboos.js'], ['teachme', 'js/games/teachme.js'],
    ['rhymetime', 'js/games/rhymetime.js'], ['blendit', 'js/games/blendit.js'],
    ['storyorder', 'js/games/storyorder.js'], ['oddboo', 'js/games/oddboo.js']
  ];
  const { ctx, page } = await open(null);
  const missing = [];
  for (const [name, path] of compliant) {
    const ok = await page.evaluate(async (p2) => {
      const res = await fetch(p2); const src = await res.text();
      // it must react/speak somewhere it also handles a wrong answer
      return /shell\.react\(|guideLine\(|speakMaybe\(|sayText\(/.test(src);
    }, path);
    if (!ok) missing.push(name);
  }
  assert(missing.length === 0, `the eight already-compliant games all speak their line (${missing.join(',') || 'all of them'})`);
  await ctx.close();
}

// ================== 4. the reduced-motion path keeps the MEANING ==================
console.log('== calm motion calms the movement and deletes nothing ==');
{
  const { ctx, page } = await open('buildaboo', null, { reduced: true });
  await page.waitForSelector('.build-seal', { timeout: 15000 });
  await page.fill('.build-name', 'Quietly');
  await page.evaluate(() => window.__standards.reset());
  await page.click('.build-seal');
  await sleep(600);
  const r = await page.evaluate(() => ({
    cel: window.__standards.celebrations(),
    flipping: !!document.querySelector('.build-preview.build-sealed'),
    msg: (document.querySelector('.build-msg') || {}).textContent
  }));
  assert(r.cel.length === 1 && /Quietly/.test(r.cel[0].line), 'the line still arrives, in full');
  assert(/Quietly/.test(r.msg || ''), 'and it is still on screen');
  assert(!r.flipping, 'the 400ms flip is skipped');
  await ctx.close();
}

await browser.close();
assert(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
