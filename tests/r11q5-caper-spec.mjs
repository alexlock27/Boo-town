// tests/r11q5-caper-spec.mjs — RUN11 Q5 spec points for Snaffle's First Caper (P17).
// Signs (exact copy, only while open, reverting on the sweep); pairwise-distinct suspects
// over 200 seeds; clue cadence (+1/round, cap 3/day, max 4); both guess paths and stars.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// ---- pure data (Node) ----
const { SUSPECTS, CAPER_SIGNS, culpritFor, freshCaper } = await import('../js/caper/state.js');
const { features } = await import('../js/attrengine.js');
const { cluesFor } = await import('../js/attrengine.js');

console.log('== the five signposts carry the exact authored copy ==');
{
  assert(CAPER_SIGNS.meadow === '→ THE MOON', 'Meadow: → THE MOON');
  assert(CAPER_SIGNS.beach === 'NO SPLASHING (much)', 'Beach: NO SPLASHING (much)');
  assert(CAPER_SIGNS.funfair === '→ SNAIL RACES', 'Funfair: → SNAIL RACES');
  assert(CAPER_SIGNS.hilltop === 'BEWARE OF SOCKS', 'Hilltop: BEWARE OF SOCKS');
  assert(CAPER_SIGNS.riverside === 'PUDDLE HQ', 'Riverside: PUDDLE HQ');
  assert(Object.keys(CAPER_SIGNS).length === 5, 'exactly five signposts');
}

console.log('== five named suspects with pairwise-distinct visible features ==');
{
  const names = SUSPECTS.map(s => s.name).join(',');
  assert(names === 'Fig,Biscuit,Nutmeg,Pickle,Waffle', 'suspects are Fig, Biscuit, Nutmeg, Pickle, Waffle');
  const sigs = SUSPECTS.map(s => JSON.stringify(features(s)));
  assert(new Set(sigs).size === SUSPECTS.length, 'every suspect has a unique visible feature signature');
}

console.log('== 200 seeds: the culprit is pinned by clue 4 and every clue is truthful ==');
{
  let unique = 0, truthful = 0;
  for (let seed = 0; seed < 200; seed++) {
    const culpritId = culpritFor(seed);
    const culprit = SUSPECTS.find(s => s.id === culpritId);
    const clues = cluesFor(culprit, SUSPECTS, 4);
    if (clues.every(c => c.pred(culprit))) truthful++;
    let possible = SUSPECTS.slice();
    for (const c of clues) possible = possible.filter(c.pred);
    if (possible.length === 1 && possible[0].id === culpritId) unique++;
  }
  assert(truthful === 200, 'every clue is true of the culprit across 200 seeds');
  assert(unique === 200, 'the culprit is uniquely pinned by clue 4 across 200 seeds');
}

// ---- browser: signs, clue cadence, guess paths ----
const browser = await chromium.launch();
const SAVE = (caper) => JSON.stringify({ version: 14, name: 'Ada', ageAsked: true, guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_pip: 1 }, stars: { total: 100, byGame: { detective: { best: 0, plays: 0, earned: 0 } } }, town: { areas: { meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } } }, care: { bonds: {}, treats: 0 }, caper, settings: { sound: false, music: false, voice: false, content: 'full' } });

console.log('== town signs appear only while the caper is open, and revert when closed ==');
{
  for (const [open, expect] of [[true, 1], [false, 0]]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
    await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(open ? { ...freshCaper(3), open: true } : { ...freshCaper(3), open: false }));
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BooTown, null, { timeout: 8000 });
    await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
    await page.waitForTimeout(900);
    const n = await page.locator('.caper-town-sign').count();
    const txt = n ? await page.locator('.caper-town-sign').first().innerText() : '';
    assert(n === expect, `caper ${open ? 'open' : 'closed'} → ${expect} sign in the Meadow (saw ${n})`);
    if (open) assert(txt.includes('THE MOON'), 'the Meadow sign reads "→ THE MOON"');
    await ctx.close();
  }
}

console.log('== clue cadence: +1 per finished round, capped 3/day and 4 total ==');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE({ ...freshCaper(2), open: true, clues: 0, cluesToday: 0, clueDay: '' }));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 8000 });
  const r = await page.evaluate(async () => {
    const st = await import('./js/state.js');
    const res = await import('./js/results.js');
    const day1 = [];
    window.__bootownDay = '2026-07-01';
    for (let i = 0; i < 5; i++) { await res.mount(document.createElement('div'), { game: 'detective', gameName: 'Word Detective', stars: 1 }, window.BooTown ? { go: () => {} } : {}); day1.push(st.getState().caper.clues); }
    window.__bootownDay = '2026-07-02';
    await res.mount(document.createElement('div'), { game: 'detective', gameName: 'Word Detective', stars: 1 }, { go: () => {} });
    return { day1, afterDay2: st.getState().caper.clues, todayCount: st.getState().caper.cluesToday };
  });
  assert(r.day1[0] === 1 && r.day1[1] === 2 && r.day1[2] === 3, 'three rounds post three clues');
  assert(r.day1[3] === 3 && r.day1[4] === 3, 'a fourth and fifth round the same day post nothing (3/day cap)');
  assert(r.afterDay2 === 4, 'the next day posts the fourth clue');
  await ctx.close();
}

console.log('== guess paths: wrong first re-arms and costs nothing; right first = 3 stars ==');
{
  // wrong first, then right → 1 star
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await pageA.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE({ ...freshCaper(0), open: true, clues: 4 }));
  await pageA.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await pageA.waitForFunction(() => window.BooTown, null, { timeout: 8000 });
  await pageA.evaluate(() => window.BooTown.go('caper'));
  await pageA.waitForSelector('.caper-board', { timeout: 8000 });
  const a = await pageA.evaluate(async () => {
    const c = window.__caper, culprit = c.state().culprit;
    const wrong = c.suspects().find(s => s.id !== culprit);
    c.accuse(wrong.id);
    const afterWrong = { open: c.state().open, guesses: c.state().guesses };
    c.accuse(culprit);
    const s = window.BooTown.State.getState();
    return { afterWrong, open: s.caper.open, stars: s.caper.stars, next: s.caper.nextAt };
  });
  assert(a.afterWrong.open === true && a.afterWrong.guesses === 1, 'a wrong first guess costs nothing and re-arms');
  assert(a.open === false && a.stars === 1, 'the second, correct guess closes the caper for 1 star');
  assert(a.next > Date.now(), 'a 24h regeneration time is set');
  await ctxA.close();

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE({ ...freshCaper(1), open: true, clues: 4 }));
  await pageB.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await pageB.waitForFunction(() => window.BooTown, null, { timeout: 8000 });
  await pageB.evaluate(() => window.BooTown.go('caper'));
  await pageB.waitForSelector('.caper-board', { timeout: 8000 });
  const b = await pageB.evaluate(() => {
    const c = window.__caper, before = window.BooTown.State.getState().stars.total;
    c.accuse(c.state().culprit);
    const s = window.BooTown.State.getState();
    return { open: s.caper.open, stars: s.caper.stars, gained: s.stars.total - before, ending: document.querySelector('.caper-board').innerText };
  });
  assert(b.open === false && b.stars === 3, 'a right first guess = 3 stars');
  // RUN5 C0: results.js is the single crediting path, so the notebook itself must NOT
  // move stars.total — it hands the stars to the results screen. (RUN11 Q10.)
  assert(b.gained === 0, 'the notebook does not credit stars.total directly (results.js does)');
  assert(/Everyone fits at OUR picnic/.test(b.ending), 'the ending line plays (L_CAPER_END)');
  await ctxB.close();
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
