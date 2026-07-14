// tests/r7p4-toddler.mjs — RUN7 phase 4: three new Toddler games (C4).
// Acceptance (RUN7 part D #5): each appears ONLY at the Toddler tier; Animal Sounds
// logs a distinct synthesized call per animal and stays completable sound-off via the
// portrait target; Animal Pairs flips, matches, grows to eight after two clean games,
// and misses flip back without penalty; Big and Small items are verifiably size-
// unambiguous and colour-uncorrelated with buckets; all three honour the Toddler star
// and meter rules; frame evidence for flips, bounces and drags.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r7p4', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const INTRO = { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1, tcount: 1, tcolour: 1, tshape: 1, tletter: 1, tanimal: 1, tpairs: 1, tbigsmall: 1 };
const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 10, byGame: {} },
  seen: { introSeen: INTRO, trophyRetro: true }, settings: { sound: false, music: false, voice: false, content: 'toddler' }, ageAsked: true, age: 3
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function fresh(save, { w = 1024, h = 768 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
const getState = page => page.evaluate(() => window.BooTown.State.getState());

// ==================== tier gating + the 7-card scrollable column ====================
console.log('== the three new games appear only at the Toddler tier ==');
for (const tier of ['light', 'medium', 'full']) {
  const { ctx, page } = await fresh(SAVE({ settings: { sound: false, music: false, voice: false, content: tier }, age: 8 }));
  assert(!(await page.$('.toddler-hub')) && !(await page.$('.toddler-card')), `${tier}: no Toddler hub or cards`);
  await ctx.close();
}
{
  const { ctx, page } = await fresh(SAVE());
  await page.waitForSelector('.toddler-hub');
  const words = await page.$$eval('.toddler-card .tc-word', ns => ns.map(n => n.textContent));
  assert(words.join(',') === 'Count,Colours,Shapes,Letters,Animals,Pairs,Sizes,Echo', `the Toddler hub is a column of all 8 giant cards (7 games + Echo Boos) (${words.join(',')})`);
  // the column scrolls if it overflows
  const scrollable = await page.$eval('.toddler-cards', n => getComputedStyle(n).overflowY === 'auto' || getComputedStyle(n).overflowY === 'scroll');
  assert(scrollable, 'the Toddler card column scrolls');
  await page.screenshot({ path: 'screenshots/r7p4/toddler-hub-1024x768.png' });
  await ctx.close();
}

// ==================== Animal Sounds ====================
console.log('== Animal Sounds ==');
{
  const { ctx, page } = await fresh(SAVE());
  // every one of the ten animals synthesizes a DISTINCT tagged call
  const tags = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setAudioLog(true); sfx.initAudio(); sfx.setSoundEnabled(true);
    for (const k of sfx.ANIMAL_KEYS) sfx.animal.call(k);
    await new Promise(r => setTimeout(r, 120));
    return sfx.getAudioLog().filter(e => e.tag && e.tag.startsWith('animal:')).map(e => e.tag);
  });
  assert(distinct(tags) === 10 && tags.length === 10, `all ten animals log a distinct synthesized call (${distinct(tags)}/10)`);
  // the round: 6 distinct animals, no repeat
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'animals' }));
  await page.waitForSelector('.td-animal-cards'); await sleep(200);
  const round = await page.evaluate(() => window.__toddler.animals);
  assert(round.length === 6 && distinct(round) === 6, `a round is 6 animals, none repeating (${round.join(',')})`);
  // completable SOUND OFF via the portrait target (sound + voice are off in this save)
  assert(await page.evaluate(() => window.__toddler.portraitShown()), 'sound off: the target shows as a portrait (find-the-match)');
  // bounce frame evidence on a correct tap (the winner bounces)
  await page.evaluate(() => window.__toddler.tap(true));
  const bfr = [];
  for (let k = 0; k < 6; k++) { bfr.push(await page.evaluate(() => { const w = document.querySelector('.td-anim-win'); return w ? getComputedStyle(w).transform : ''; })); await sleep(130); }
  assert(distinct(bfr) >= 3, `the winning animal bounces (${distinct(bfr)}/6 frames)`);
  // finish sound-off (tap the portrait match each round)
  let guard = 0;
  while (await page.evaluate(() => window.__toddler.state && window.__toddler.game === 'animals' && window.__toddler.state().done < 6) && guard++ < 40) {
    await page.evaluate(() => window.__toddler.tap(true)); await sleep(320);
  }
  await page.waitForSelector('.result-card', { timeout: 8000 }); await sleep(600);
  const s = await getState(page);
  assert(s.stars.byGame.tanimal.best === 3 && s.stars.byGame.tanimal.plays === 1, `a clean sound-off round completes (3★, best ${s.stars.byGame.tanimal.best})`);
  assert(s.meter >= 2 || s.boxes > 0, `Animal Sounds banks >=2 meter (${s.meter})`);
  await ctx.close();
}

// ==================== Animal Pairs ====================
console.log('== Animal Pairs ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'pairs' }));
  await page.waitForSelector('.td-pairs-board'); await sleep(200);
  assert(await page.evaluate(() => window.__toddler.cardCount) === 6, 'the first board is six cards (three pairs)');
  // flip frame evidence: a card flip animates (rotateY transition on .tp-inner)
  await page.evaluate(() => window.__toddler.flipAt(0));
  const ffr = [];
  for (let k = 0; k < 6; k++) { ffr.push(await page.evaluate(() => { const c = document.querySelectorAll('.td-pair-card')[0].querySelector('.tp-inner'); return getComputedStyle(c).transform; })); await sleep(90); }
  assert(distinct(ffr) >= 3, `flipping a card animates (${distinct(ffr)}/6 frames)`);
  // a MISS flips both back with no penalty (no oops miss counted as a scary event; cards face down again)
  const a0 = await page.evaluate(() => window.__toddler.animalAt(0));
  const wrongIdx = await page.evaluate(a => window.__toddler.indicesOf(window.__toddler.animalAt(0)).length ? [...Array(window.__toddler.cardCount).keys()].find(i => window.__toddler.animalAt(i) !== a) : 1, a0);
  await page.evaluate(i => window.__toddler.flipAt(i), wrongIdx);   // second card, different animal → miss
  await sleep(1100);
  const faceUpAfterMiss = await page.evaluate(() => window.__toddler.faceUp());
  assert(faceUpAfterMiss === 0, 'a mismatch flips both cards gently back (no cards left face-up)');
  // now clear the board by matching every pair
  const cleared = await page.evaluate(async () => {
    const seen = new Set();
    for (let i = 0; i < window.__toddler.cardCount; i++) { const a = window.__toddler.animalAt(i); if (seen.has(a)) continue; seen.add(a); const idx = window.__toddler.indicesOf(a); window.__toddler.flipAt(idx[0]); await new Promise(r => setTimeout(r, 140)); window.__toddler.flipAt(idx[1]); await new Promise(r => setTimeout(r, 620)); }
    return true;
  });
  await page.waitForSelector('.result-card', { timeout: 8000 }); await sleep(500);
  let s = await getState(page);
  assert(s.stars.byGame.tpairs.best >= 2, `clearing a board completes with a generous star (${s.stars.byGame.tpairs.best})`);
  assert(s.meter >= 2 || s.boxes > 0, `Animal Pairs banks >=2 meter (${s.meter})`);
  // grow to 8 after two clean games: play a 2nd board, then the 3rd is eight cards
  async function clearBoard() {
    await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'pairs' }));
    await page.waitForSelector('.td-pairs-board'); await sleep(150);
    await page.evaluate(async () => { const seen = new Set(); for (let i = 0; i < window.__toddler.cardCount; i++) { const a = window.__toddler.animalAt(i); if (seen.has(a)) continue; seen.add(a); const idx = window.__toddler.indicesOf(a); window.__toddler.flipAt(idx[0]); await new Promise(r => setTimeout(r, 120)); window.__toddler.flipAt(idx[1]); await new Promise(r => setTimeout(r, 560)); } });
    await page.waitForSelector('.result-card', { timeout: 8000 }); await sleep(400);
  }
  await clearBoard();   // second cleared board
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'pairs' }));
  await page.waitForSelector('.td-pairs-board'); await sleep(200);
  const grown = await page.evaluate(() => ({ cards: window.__toddler.cardCount, cleared: window.__toddler.pairsCleared() }));
  assert(grown.cleared >= 2 && grown.cards === 8, `after two cleared boards the board grows to eight cards (cleared ${grown.cleared}, cards ${grown.cards})`);
  await page.screenshot({ path: 'screenshots/r7p4/toddler-pairs-1024x768.png' });
  await page.evaluate(() => window.__toddler.resetPairs());
  await ctx.close();
}

// ==================== Big and Small ====================
console.log('== Big and Small ==');
{
  const { ctx, page } = await fresh(SAVE());
  // colour-uncorrelated over many fresh rounds (a colour always lives on both sides)
  const allUncorrelated = await page.evaluate(async () => {
    let ok = true;
    for (let r = 0; r < 20; r++) { window.BooTown.go('toddlergame', { game: 'bigsmall' }); await new Promise(res => setTimeout(res, 30)); if (!window.__toddler.colourCheck()) ok = false; }
    return ok;
  });
  assert(allUncorrelated, 'over 20 rounds, a colour always appears on BOTH sides — colour never predicts the bucket');
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'bigsmall' }));
  await page.waitForSelector('.td-feeders'); await sleep(250);
  const split = await page.evaluate(() => window.__toddler.sizeSplit());
  assert(split.big >= 5 && split.small >= 5 && split.big + split.small === 12, `twelve items, at least five each side (big ${split.big}, small ${split.small})`);
  // size-unambiguous: big items render clearly larger than small ones, with a CLEAR gap (no middle)
  const widths = { big: [], small: [] };
  for (let i = 0; i < 12; i++) {
    const info = await page.evaluate(() => { const it = document.querySelector('.td-size-item'); const c = window.__toddler.current(); return it && c ? { big: c.big, w: Math.round(it.getBoundingClientRect().width) } : null; });
    if (info) widths[info.big ? 'big' : 'small'].push(info.w);
    await page.evaluate(() => window.__toddler.dropOn(window.__toddler.correctIndex()));
    await sleep(70);
  }
  const maxSmall = Math.max(...widths.small), minBig = Math.min(...widths.big);
  assert(widths.big.length && widths.small.length && minBig > maxSmall + 20, `sizes are unambiguous: every big item (>=${minBig}px) is clearly larger than every small (<=${maxSmall}px)`);
  await page.waitForSelector('.result-card', { timeout: 8000 }); await sleep(400);
  let s = await getState(page);
  assert(s.stars.byGame.tbigsmall.best === 3, `a clean Big and Small round 3-stars (${s.stars.byGame.tbigsmall.best})`);
  assert(s.meter >= 2 || s.boxes > 0, `Big and Small banks >=2 meter (${s.meter})`);
  await ctx.close();
}
// drag frame evidence + a missy round → 2 stars, never fewer
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'bigsmall' }));
  await page.waitForSelector('.td-drag-item'); await sleep(250);
  const box = await page.$eval('.td-drag-item', n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down();
  const dfr = [];
  for (let k = 0; k < 6; k++) { await page.mouse.move(box.x - 20 - k * 30, box.y - 10 - k * 12); dfr.push(await page.evaluate(() => { const n = document.querySelector('.td-drag-item'); return Math.round(n.getBoundingClientRect().left); })); await sleep(80); }
  await page.mouse.up();
  assert(distinct(dfr) >= 4, `dragging an item moves it across frames (${distinct(dfr)}/6 positions)`);
  // a very missy round still lands on 2 stars (never fewer)
  const st = await page.evaluate(async () => {
    let g = 0;
    while (window.__toddler.state().done < 12 && g++ < 60) {
      const wrong = 1 - window.__toddler.correctIndex();
      window.__toddler.dropOn(wrong); await new Promise(r => setTimeout(r, 40));   // wrong bucket → a friendly miss
      window.__toddler.dropOn(window.__toddler.correctIndex()); await new Promise(r => setTimeout(r, 40));
    }
    return window.__toddler.state();
  });
  await page.waitForSelector('.result-card', { timeout: 8000 }); await sleep(400);
  const s = await getState(page);
  assert(s.stars.byGame.tbigsmall.best === 2 || st.misses <= 2, `a missy round still earns 2 stars, never fewer (misses ${st.misses}, best ${s.stars.byGame.tbigsmall.best})`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
