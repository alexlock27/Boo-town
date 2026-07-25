// tests/r12s8-echo.mjs — RUN12 S8: Echo Boos' feedback is unmissable, and its setup screen
// offers one clear choice.
//
// The reported symptom was "the lit glow is too faint to follow". The measured truth was
// worse: the lit state rendered NOTHING. js/ui.js's el() dropped the inline `--boo`
// (Object.assign on a CSSStyleDeclaration ignores custom properties), so
// `drop-shadow(0 0 18px var(--boo))` was an invalid value and the browser threw away the
// WHOLE `filter` declaration in .echo-boo.lit — leaving the dimmed unlit look in place.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s8';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const save = (over = {}) => JSON.stringify(Object.assign({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { echoboos: true }, echoBest: 6, echoBestLightning: 3 },
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over));

const browser = await chromium.launch({ args: RESOLVE });

// ---- 1. the custom property really reaches the DOM now -------------------------------
console.log('== el() carries CSS custom properties, so the lit look can exist at all ==');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  const r = await page.evaluate(async () => {
    const { el } = await import('./js/ui.js');
    const n = el('div', { style: { '--boo': '#ff0000', width: '10px' } });
    document.body.appendChild(n);
    const out = { cssText: n.style.cssText, computed: getComputedStyle(n).getPropertyValue('--boo').trim(), width: n.style.width };
    n.remove();
    return out;
  });
  assert(r.computed === '#ff0000', `el() sets --boo (got "${r.computed}")`);
  assert(r.width === '10px', 'and still sets ordinary properties');
  await ctx.close();
}

// ---- 2. the lit state, measured ------------------------------------------------------
async function litEvidence(reducedMotion) {
  const ctx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference'
  });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('echoboos', { resume: true }));
  await page.waitForTimeout(1400);
  const r = await page.evaluate(async () => {
    const boo = document.querySelector('.echo-boo');
    const read = () => { const c = getComputedStyle(boo); return { filter: c.filter, transform: c.transform, boxShadow: c.boxShadow }; };
    const unlit = read();
    boo.classList.add('lit');
    await new Promise(r => setTimeout(r, 400));           // outlast the 120ms transition
    const lit = read();
    boo.classList.remove('lit');
    return { booVar: getComputedStyle(boo).getPropertyValue('--boo').trim(), unlit, lit };
  });
  return { ctx, page, r };
}

console.log('== the lit state is a real colour flash, a pop and a white rim ==');
{
  const { ctx, page, r } = await litEvidence(false);
  assert(r.booVar.length > 0, `the podium carries its own colour (--boo = "${r.booVar}")`);
  assert(r.lit.filter !== 'none' && r.lit.filter !== r.unlit.filter,
    `the filter CHANGES when lit (was "${r.unlit.filter}" → "${r.lit.filter}")`);
  const bright = /brightness\(([\d.]+)\)/.exec(r.lit.filter);
  const sat = /saturate\(([\d.]+)\)/.exec(r.lit.filter);
  assert(bright && parseFloat(bright[1]) >= 1.4, `a bold brightness lift (${bright && bright[1]})`);
  assert(sat && parseFloat(sat[1]) >= 1.8, `to full saturation (${sat && sat[1]})`);
  assert(/drop-shadow/.test(r.lit.filter) && r.lit.filter.includes('rgb'),
    'with a coloured halo that actually resolves to a colour');
  const m = /matrix\(([\d.]+)/.exec(r.lit.transform);
  assert(m && parseFloat(m[1]) >= 1.14, `a 1.15x scale pop (${m && m[1]})`);
  assert(/rgb\(255, 255, 255\)/.test(r.lit.boxShadow), 'and a white rim');
  assert(r.unlit.boxShadow === 'none', 'which the unlit state does not have');
  await page.screenshot({ path: `${SHOTS}/lit-state.png` });
  await ctx.close();
}

console.log('== reduced motion keeps the colour and the rim, and drops the scale ==');
{
  const { ctx, page, r } = await litEvidence(true);
  assert(r.lit.filter !== r.unlit.filter, 'the colour flash still happens');
  assert(/rgb\(255, 255, 255\)/.test(r.lit.boxShadow), 'the white rim still happens');
  assert(r.lit.transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(r.lit.transform),
    `and the scale pop is dropped (${r.lit.transform})`);
  await page.screenshot({ path: `${SHOTS}/lit-state-reduced.png` });
  await ctx.close();
}

console.log('== a muted playthrough is followable on visuals alone ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('echoboos', { resume: true }));
  await page.waitForTimeout(1200);
  const muted = await page.evaluate(() => window.BooTown.State.getState().settings.sound);
  assert(muted === false, 'the fixture really is playing with the sound off');
  // Grow the tune first: round one is a single note, which no amount of sampling turns
  // into motion evidence. Four correct echoes take it well past that.
  for (let round = 0; round < 4; round++) {
    await page.evaluate(async () => {
      for (let i = 0; i < 60 && !window.__echo.state().inputPhase; i++) await new Promise(r => setTimeout(r, 150));
      window.__echo.echoAll();
    });
    await page.waitForTimeout(600);
  }
  const len = await page.evaluate(() => window.__echo.state().len);
  assert(len >= 4, `the tune grew to ${len} notes without a single sound being heard`);

  // With the sound off, the lit class is the ONLY signal there is.
  await page.evaluate(() => window.__echo.play());
  const frames = [];
  for (let i = 0; i < 32; i++) {
    frames.push(await page.evaluate(() => ({
      lit: [0,1,2,3].map(i => window.__echo.isLit(i)),
      dimmed: window.__echo.dimmedCount(),
      playback: window.__echo.inPlayback(),
      t: Math.round(performance.now())
    })));
    await page.waitForTimeout(150);
  }
  const litFrames = frames.filter(f => f.lit.some(Boolean));
  const sampleSpan = frames[frames.length - 1].t - frames[0].t;
  assert(litFrames.length >= 6, `the lit signal is caught in ${litFrames.length} of 32 frames`);
  assert(sampleSpan >= 3000, `across ${sampleSpan}ms of sampling (CLAUDE.md motion evidence: 6+ frames over 3+ seconds)`);
  assert(litFrames.every(f => f.lit.filter(Boolean).length === 1), 'exactly one Boo lights at a time');
  const playbackLit = litFrames.filter(f => f.playback);
  assert(playbackLit.length >= 4 && playbackLit.every(f => f.dimmed === 3),
    `and the other three dim while it does (${playbackLit.length} playback frames, dims ${[...new Set(playbackLit.map(f => f.dimmed))]})`);
  // each individual light must survive at least two consecutive 150ms samples
  let runLen = 0, longestRun = 0;
  for (const f of frames) { if (f.lit.some(Boolean)) { runLen++; longestRun = Math.max(longestRun, runLen); } else runLen = 0; }
  assert(longestRun >= 2, `each flash is held across ${longestRun} consecutive samples (>=300ms observed)`);
  const hold = await page.evaluate(() => window.__echo.litHoldMs());
  assert(hold >= 260, `a ${hold}ms minimum hold is enforced in code`);
  const distinct = new Set(litFrames.map(f => f.lit.findIndex(Boolean))).size;
  assert(distinct >= 2, `and the playback visibly moves between podiums (${distinct} distinct)`);

  // and the muted round can actually be completed on visuals alone
  const done = await page.evaluate(async () => {
    for (let i = 0; i < 40 && !window.__echo.state().inputPhase; i++) await new Promise(r => setTimeout(r, 200));
    return window.__echo.echoAll();
  });
  assert(done === true, 'a scripted echo of what was SEEN completes the tune with no audio');
  await ctx.close();
}

// ---- 3. the setup screen -------------------------------------------------------------
console.log('== the setup screen is one row of two clearly different cards ==');
for (const vp of [{ n: '1024x768', w: 1024, h: 768 }, { n: '768x1024', w: 768, h: 1024 }, { n: '390x844', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('echoboos', {}));
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => ({
    rows: document.querySelectorAll('.echo-modes').length,
    oldModeRow: document.querySelectorAll('.echo-mode-row').length,
    oldBestsRow: document.querySelectorAll('.echo-bests').length,
    cards: [...document.querySelectorAll('.echo-mode-card')].map(c => ({
      name: c.querySelector('.emc-name')?.textContent ?? null,
      desc: c.querySelector('.emc-desc')?.textContent ?? null,
      best: c.querySelector('.emc-best')?.textContent ?? null,
      selected: c.getAttribute('aria-pressed'),
      w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height)
    }))
  }));
  await page.screenshot({ path: `${SHOTS}/setup-${vp.n}.png` });
  assert(r.rows === 1, `${vp.n}: exactly one mode row (${r.rows})`);
  assert(r.oldModeRow === 0 && r.oldBestsRow === 0, `${vp.n}: the two near-identical rows are gone`);
  assert(r.cards.length === 2, `${vp.n}: two cards (${r.cards.length})`);
  assert(r.cards.every(c => c.name && c.desc && c.best), `${vp.n}: each card has a name, a description and a best chip`);
  assert(r.cards[0].desc !== r.cards[1].desc, `${vp.n}: the two descriptions are genuinely different`);
  assert(r.cards[0].best !== r.cards[1].best, `${vp.n}: and each shows ITS OWN best (${r.cards.map(c => c.best).join(' | ')})`);
  assert(r.cards.filter(c => c.selected === 'true').length === 1, `${vp.n}: exactly one is selected`);
  assert(r.cards.every(c => c.h >= 44 && c.w >= 44), `${vp.n}: both are tappable (${r.cards.map(c => c.w + 'x' + c.h).join(', ')})`);
  await ctx.close();
}

console.log('== Standard and Lightning bests stay separate (RUN11 F-03 regression) ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('echoboos', {}));
  await page.waitForTimeout(1300);
  const shown = await page.evaluate(() => [...document.querySelectorAll('.emc-best')].map(b => b.textContent));
  assert(shown[0] === 'Best 6' && shown[1] === 'Best 3',
    `the two bests read from separate fields (${shown.join(' | ')})`);
  const fields = await page.evaluate(() => {
    const s = window.BooTown.State.getState().seen;
    return { standard: s.echoBest, lightning: s.echoBestLightning };
  });
  assert(fields.standard === 6 && fields.lightning === 3, 'and the save still holds them apart');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
