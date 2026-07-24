// tests/r10p9-detective.mjs — RUN10 P9 (RUN11 Q2): Word Detective GO key + tile badges.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = JSON.stringify({ version: 13, name: 'Ada', ageAsked: true, guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, stars: { total: 40, byGame: {} }, town: { areas: {} }, care: { bonds: {}, treats: 0 }, seen: { introSeen: { detective: true } }, settings: { sound: false, music: false, voice: false, content: 'full' } });

const browser = await chromium.launch();

async function openDetective(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 8000 });
  await page.evaluate(() => window.BooTown.go('detective', { resume: { mode: 4 } }));
  await page.waitForSelector('.det-tile', { timeout: 8000 });
  await page.waitForFunction(() => window.__detective && window.__detective.target && window.__detective.target(), null, { timeout: 8000 });
  return page;
}

console.log('== GO key wakes on a full row and reverts on backspace; taught once ==');
{
  const ctx = await browser.newContext();
  const page = await openDetective(ctx);
  const r = await page.evaluate(async () => {
    const d = window.__detective, mode = d.mode(), tgt = d.target();
    for (const ch of tgt) d.type(ch);              // fill the row
    const full = { ready: d.goReady(), text: d.goText(), taught: d.goTaught() };
    d.backspace();                                  // one short
    const short = { ready: d.goReady(), text: d.goText() };
    d.type(tgt[mode - 1]);                           // refill
    const refill = { ready: d.goReady(), taught: d.goTaught() };
    return { full, short, refill };
  });
  assert(r.full.ready === true && r.full.text === 'GO!', 'full row → go-ready + "GO!"');
  assert(r.short.ready === false && r.short.text === '⏎', 'backspace reverts to not-ready + "⏎"');
  assert(r.full.taught === true, 'the GO taught line fires when first ready');
  assert(r.refill.taught === true, 'the taught flag stays set (once per round, no re-fire)');
  await ctx.close();
}

console.log('== tile badges: green ✓, orange •, grey none — matching scoreGuess ==');
{
  const ctx = await browser.newContext();
  const page = await openDetective(ctx);
  // Pick a guess whose scoreGuess yields all three colours (deterministic), guess it,
  // wait for the full staggered reveal, then assert each tile's ::after badge matches its
  // colour. scoreGuess is the game's own scorer, so this proves the badge↔clue mapping.
  const r = await page.evaluate(async () => {
    const d = window.__detective, det = await import('./js/games/detective.js');
    const tgt = d.target(), mode = d.mode();
    const foreign = [...'zqxjkvwy'].find(c => !tgt.includes(c)) || 'z';
    // candidate guesses to search for a green+orange+grey mix
    const cands = [];
    const rot = tgt.slice(1) + tgt[0];
    cands.push(rot);
    cands.push((rot.slice(0, mode - 1) + foreign));
    for (let i = 0; i < mode; i++) for (let j = i + 1; j < mode; j++) {
      if (tgt[i] === tgt[j]) continue;
      const a = tgt.split(''); const t = a[i]; a[i] = a[j]; a[j] = t; a[mode - 1] = foreign; cands.push(a.join(''));
    }
    const colors = s => new Set(s);
    let guess = cands.find(g => { const c = colors(det.scoreGuess(g, tgt)); return c.has('green') && c.has('orange') && c.has('grey'); })
             || cands.find(g => { const c = colors(det.scoreGuess(g, tgt)); return c.has('orange') && c.has('grey'); })
             || (rot.slice(0, mode - 1) + foreign);
    const score = det.scoreGuess(guess, tgt);
    d.guess(guess);
    const revealMs = mode * 260 + 400;
    await new Promise(r => setTimeout(r, revealMs));
    const rows = document.querySelectorAll('.det-row');
    const tiles = [...rows[0].querySelectorAll('.det-tile')];   // guess landed in the first row
    const badge = t => getComputedStyle(t, '::after').content.replace(/["']/g, '');
    const cells = tiles.map((t, i) => ({ score: score[i], cls: ['green', 'orange', 'grey'].find(c => t.classList.contains(c)), badge: badge(t) }));
    return { guess, score, cells };
  });
  const want = { green: '✓', orange: '•', grey: 'none' };
  const classMatches = r.cells.every(c => c.cls === c.score);
  const badgeMatches = r.cells.every(c => (c.score === 'grey' ? (c.badge === 'none' || c.badge === '') : c.badge === want[c.score]));
  assert(classMatches, 'each tile colour matches scoreGuess');
  assert(badgeMatches, 'each tile badge matches its colour (green ✓ / orange • / grey none)');
  assert(r.score.includes('green') && r.cells.some(c => c.score === 'green' && c.badge === '✓'), 'green shows ✓');
  assert(r.score.includes('orange') && r.cells.some(c => c.score === 'orange' && c.badge === '•'), 'orange shows •');
  assert(r.score.includes('grey') && r.cells.some(c => c.score === 'grey' && (c.badge === 'none' || c.badge === '')), 'grey shows no badge');
  await ctx.close();
}

console.log('== hardware keyboard still types and submits ==');
{
  const ctx = await browser.newContext();
  const page = await openDetective(ctx);
  const r = await page.evaluate(async () => {
    const d = window.__detective, tgt = d.target();
    for (const ch of tgt) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
    const filled = d.state().cur;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    return { filled, used: d.state().guessesUsed, solved: d.state().solved };
  });
  assert(r.filled.length > 0, 'physical letter keys fill the row');
  assert(r.used >= 1, 'physical Enter submits the guess');
  await ctx.close();
}

console.log('== reduced-motion: goPulse animation off, scale kept ==');
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await openDetective(ctx);
  const r = await page.evaluate(async () => {
    const d = window.__detective, tgt = d.target();
    for (const ch of tgt) d.type(ch);
    const go = document.querySelector('.det-go');
    const cs = getComputedStyle(go);
    return { anim: cs.animationName, transform: cs.transform };
  });
  assert(r.anim === 'none', 'reduced-motion computes animation-name: none on the ready GO key');
  assert(r.transform && r.transform !== 'none', 'the ready scale is still applied under reduced motion');
  await ctx.close();
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
