// tests/r5p8-toddler.mjs — RUN5 phase 8 (C7): Toddler mode.
// Acceptance (RUN5 part D #9): ages 3-or-younger and 4 map to Toddler and the override
// includes it; the Toddler hub hides quests, Golden Round, Smart Mix, Sound Twins and
// Trophies; all four games playable with sound off via visual targets; Shape Sort item
// colours verifiably uncorrelated with buckets over 50 generated rounds; stars never
// fall below 2; rounds bank at least 2 meter points; nothing Toddler appears at Light+.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const T_INTROS = { tcount: 1, tcolour: 1, tshape: 1, tletter: 1 };
const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 10, byGame: {} },
  ledger: {}, golden: { words: [{ w: 'because' }], choices: [] },
  // SOUND OFF + VOICE OFF everywhere in this suite: the whole mode must play visually.
  settings: { sound: false, music: false, voice: false, content: 'toddler' },
  seen: { trophyRetro: true, introSeen: T_INTROS }, trophies: {}, ageAsked: true, age: 4
}, over);

const browser = await chromium.launch();
async function fresh(save) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub, .toddler-hub');
  return { ctx, page };
}
const getState = (page) => page.evaluate(() => window.BooTown.State.getState());

// ==================== 1. age mapping + override ====================
console.log('== age mapping + override ==');
{
  const { ctx, page } = await fresh(SAVE({ settings: { sound: false, music: false, voice: false, content: 'light' } }));
  const map = await page.evaluate(async () => {
    const m = await import('./js/content.js');
    return {
      three: m.tierForAge(3), four: m.tierForAge(4), five: m.tierForAge(5),
      seven: m.tierForAge(7), eight: m.tierForAge(8), ten: m.tierForAge(10),
      tiers: m.TIERS, ages: m.AGE_CHOICES.map(c => c.label)
    };
  });
  assert(map.three === 'toddler' && map.four === 'toddler', '3-or-younger and 4 map to Toddler');
  assert(map.five === 'light' && map.seven === 'light', '5–7 map to Light');
  assert(map.eight === 'medium' && map.ten === 'full', '8–9 Medium, 10+ Full');
  assert(map.ages.includes('3 or younger') && map.ages.includes('4'), 'the age question gains "3 or younger" and "4"');
  assert(map.tiers.includes('toddler'), 'TIERS includes toddler');
  // the grown-ups override includes Toddler + the updated hint
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-seg');
  const segs = await page.$$eval('.gu-seg-btn', ns => ns.map(n => n.textContent));
  assert(segs.includes('Toddler'), `the override offers Toddler (${segs.join(' / ')})`);
  const hint = await page.$eval('.gu-age-hint', n => n.textContent);
  assert(/4 and under → Toddler/.test(hint), 'the mapping hint is updated');
  // flipping the override to Toddler switches the hub
  await page.click('.gu-seg-btn:has-text("Toddler")');
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.toddler-hub', { timeout: 4000 });
  assert(true, 'the override flips the hub into Toddler mode');
  await ctx.close();
}

// ==================== 2. the Toddler hub hides the big-kid furniture ====================
console.log('== toddler hub ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.waitForSelector('.toddler-hub');
  const words = await page.$$eval('.toddler-card .tc-word', ns => ns.map(n => n.textContent));
  assert(words.join(',') === 'Count,Colours,Shapes,Letters', `four giant one-word cards (${words.join(',')})`);
  for (const sel of [['.quest-card', 'quests'], ['.golden-card', 'Golden Round'], ['.jumpback-card', 'jump-back'], ['.booday', 'Boo of the Day']]) {
    assert(!(await page.$(sel[0])), `${sel[1]} hidden on the Toddler hub`);
  }
  const bar = await page.$$eval('.bottom-bar .bar-btn span', ns => ns.map(n => n.textContent).filter(Boolean));
  assert(bar.includes('Town') && bar.includes('Collection') && bar.includes('Studio'), 'Town, Collection and Studio on the bar');
  assert(!!(await page.$('.cog-btn')), 'the cog is there (behind its long-press)');
  assert(!!(await page.$('.meter-wrap')) && !!(await page.$('.star-chest')), 'the shared reward meter + chest stay');
  // Trophies tab hidden in the collection
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-tabs');
  const tabs = await page.$$eval('.coll-tab', ns => ns.map(n => n.textContent));
  assert(!tabs.some(t => /Troph/.test(t)), `the Trophies tab is hidden (${tabs.join(' / ')})`);
  // one tap starts a round — no pickers anywhere
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.toddler-card');
  await page.click('.toddler-card');   // Count
  await page.waitForSelector('.toddler.td-count .bubble', { timeout: 5000 });
  assert(!(await page.$('.picker')) && !(await page.$('.start-card')), 'one tap starts a round (no picker, no start card)');
  assert(!(await page.$('.hearts-wrap')) || await page.$eval('.hearts-wrap', n => n.style.display === 'none'), 'hearts are hidden');
  await ctx.close();
}

// ==================== 3. Counting Pop: playable sound-off, count-aloud, growth ====================
console.log('== Counting Pop ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'count' }));
  await page.waitForSelector('.td-target .td-big-num', { timeout: 5000 });
  // the visual target: numeral AND dots (sound off — this is the whole interface)
  const target = await page.evaluate(() => ({ n: +document.querySelector('.td-big-num').textContent, dots: document.querySelectorAll('.td-target .td-dot').length }));
  assert(target.n >= 1 && target.n <= 10 && target.dots === target.n, `target shows numeral ${target.n} AND ${target.dots} dots`);
  // exactly one bubble carries the target
  const values = await page.evaluate(() => window.__toddler.values());
  assert(values.filter(v => v === target.n).length === 1, `exactly one bubble matches (${values.join(',')})`);
  // wrong pop: friendly wobble, round does NOT end
  await page.evaluate(() => window.__toddler.pop(false));
  await sleep(250);
  let st = await page.evaluate(() => window.__toddler.state());
  assert(st.misses === 1 && !st.ended, 'a wrong pop counts a miss and the round continues');
  // correct pop: the count-aloud moment lights the dots in turn
  await page.evaluate(() => window.__toddler.pop(true));
  await page.waitForSelector('.td-countaloud', { timeout: 3000 });
  const lit1 = await page.evaluate(() => document.querySelectorAll('.td-countaloud .td-dot.lit').length);
  await sleep(300);
  const lit2 = await page.evaluate(() => { const o = document.querySelector('.td-countaloud'); return o ? o.querySelectorAll('.td-dot.lit').length : 99; });
  assert(lit2 >= lit1, `count-aloud dots light in turn (${lit1} → ${lit2})`);
  // finish the round: 5 more correct pops → results with 2 stars (3 misses? no: 1 miss → 3★)
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(() => !document.querySelector('.td-countaloud'), { timeout: 5000 });
    const done = await page.evaluate(() => window.__toddler.state().done);
    if (done >= 6) break;
    await page.evaluate(() => window.__toddler.pop(true));
    await sleep(400);
  }
  await page.waitForSelector('.result-card', { timeout: 8000 });
  await sleep(900);
  const s = await getState(page);
  assert(s.stars.byGame.tcount.plays === 1 && s.stars.byGame.tcount.best === 3, `1 miss still earns 3 stars (best ${s.stars.byGame.tcount.best})`);
  assert(s.meter >= 2 || s.boxes > 0, `the round banked at least 2 meter points (meter ${s.meter}, boxes ${s.boxes})`);
  await ctx.close();
}

// ==================== 4. Colour Feast + Shape Sort: visual targets, drag resolution ====================
console.log('== Colour Feast ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'colour' }));
  await page.waitForSelector('.td-feeder', { timeout: 5000 });
  const nSwatches = await page.$$eval('.td-swatch', ns => ns.length);
  assert(nSwatches >= 2 && nSwatches <= 3, `2–3 Boos wear colour swatch signs (${nSwatches})`);
  const signText = await page.$$eval('.td-swatch-sign', ns => ns.map(n => n.textContent.trim()).join(''));
  assert(signText === '', 'swatch signs carry NO colour words (pure visual)');
  // resolve all 6 items via the hook (drop on the correct bucket)
  for (let i = 0; i < 6; i++) {
    const idx = await page.evaluate(() => window.__toddler.correctIndex());
    if (idx < 0) break;
    await page.evaluate((k) => window.__toddler.dropOn(k), idx);
    await sleep(200);
  }
  await page.waitForSelector('.result-card', { timeout: 8000 });
  await sleep(900);
  const s = await getState(page);
  assert(s.stars.byGame.tcolour.best === 3, 'a clean Colour Feast 3-stars');
  await ctx.close();
}
console.log('== Shape Sort ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'shape' }));
  await page.waitForSelector('.td-hole', { timeout: 5000 });
  const holes = await page.$$eval('.td-hole svg', ns => ns.length);
  assert(holes >= 2 && holes <= 3, `2–3 big shape outlines as buckets (${holes})`);
  // a wrong drop wobbles and keeps going
  const wrongIdx = await page.evaluate(() => (window.__toddler.correctIndex() + 1) % window.__toddler.round.buckets.length);
  await page.evaluate((k) => window.__toddler.dropOn(k), wrongIdx);
  await sleep(200);
  let st = await page.evaluate(() => window.__toddler.state());
  assert(st.misses === 1 && !st.ended, 'a wrong drop is a friendly miss, round continues');
  for (let i = 0; i < 6; i++) {
    const idx = await page.evaluate(() => window.__toddler.correctIndex());
    if (idx < 0) break;
    await page.evaluate((k) => window.__toddler.dropOn(k), idx);
    await sleep(200);
  }
  await page.waitForSelector('.result-card', { timeout: 8000 });
  await sleep(900);
  const s = await getState(page);
  assert(s.stars.byGame.tshape.best === 3, '1 miss still 3-stars Shape Sort');
  // ---- 50-round colour/bucket correlation check ----
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'shape' }));
  await page.waitForFunction(() => window.__toddler && window.__toddler.genShapeRound);
  const stats = await page.evaluate(() => {
    const byColour = {};   // colour -> Set of shapes it appeared as
    const counts = {};
    for (let r = 0; r < 50; r++) {
      const round = window.__toddler.genShapeRound();
      for (const it of round.items) {
        byColour[it.colour] = byColour[it.colour] || new Set();
        byColour[it.colour].add(it.shape);
        counts[it.colour] = (counts[it.colour] || 0) + 1;
      }
    }
    return Object.entries(byColour).map(([c, set]) => ({ colour: c, shapes: set.size, n: counts[c] }));
  });
  const suspicious = stats.filter(s2 => s2.n >= 8 && s2.shapes < 3);
  assert(stats.length >= 6, `many colours appear across 50 rounds (${stats.length})`);
  assert(suspicious.length === 0, 'no colour predicts its bucket (every frequent colour spans 3+ shapes)' + (suspicious.length ? ` — ${JSON.stringify(suspicious)}` : ''));
  await ctx.close();
}

// ==================== 5. Letter Pop: anchors, celebration, lowercase progression ====================
console.log('== Letter Pop ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'letter' }));
  await page.waitForSelector('.td-giant-letter', { timeout: 5000 });
  const tgt = await page.evaluate(() => ({ letter: window.__toddler.currentLetter(), tiles: [...document.querySelectorAll('.td-letter-tile')].map(t => t.textContent[0]) }));
  assert(/^[A-Z]$/.test(tgt.letter), `a giant target letter shows (${tgt.letter})`);
  assert(tgt.tiles.length === 3 && tgt.tiles.includes(tgt.letter), `three big tiles, one matching (${tgt.tiles.join(',')})`);
  // uppercase first: fresh save → no lowercase anywhere
  assert(!(await page.evaluate(() => window.__toddler.lowerShown())), 'uppercase first (no lowercase yet)');
  // wrong tap: friendly, continues
  await page.evaluate(() => window.__toddler.tap(false));
  await sleep(250);
  assert(!(await page.evaluate(() => window.__toddler.state())).ended, 'wrong tap never ends the round');
  // correct tap: the celebration shows the anchor word + picture
  await page.evaluate(() => window.__toddler.tap(true));
  await page.waitForSelector('.td-celebrate', { timeout: 3000 });
  const cel = await page.evaluate(() => ({ word: document.querySelector('.td-cel-word').textContent, emoji: document.querySelector('.td-cel-emoji').textContent }));
  assert(/for |is in /.test(cel.word) && cel.emoji.length > 0, `celebration shows the anchor with a picture ("${cel.word}" ${cel.emoji})`);
  await ctx.close();
}
{
  // lowercase appears alongside once a letter has been matched three times
  const { ctx, page } = await fresh(SAVE({ seen: { trophyRetro: true, introSeen: T_INTROS, toddlerLetters: { A: 3, B: 3, C: 3, D: 3, E: 3, F: 3, G: 3, H: 3, I: 3, J: 3, K: 3, L: 3, M: 3, N: 3, O: 3, P: 3, Q: 3, R: 3, S: 3, T: 3, U: 3, V: 3, W: 3, X: 3, Y: 3, Z: 3 } } }));
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'letter' }));
  await page.waitForSelector('.td-giant-letter');
  assert(await page.evaluate(() => window.__toddler.lowerShown()), 'lowercase joins once a letter has been matched three times');
  await ctx.close();
}

// ==================== 6. stars never below 2 + meter floor ====================
console.log('== generous stars + meter floor ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'letter' }));
  await page.waitForSelector('.td-letter-tile');
  // a very missy round: 3 wrong taps before each correct one
  for (let r = 0; r < 6; r++) {
    await page.evaluate(() => window.__toddler.tap(false));
    await sleep(120);
    await page.evaluate(() => window.__toddler.tap(false));
    await sleep(120);
    await page.evaluate(() => window.__toddler.tap(true));
    await page.waitForFunction(() => !document.querySelector('.td-celebrate'), { timeout: 6000 });
    await sleep(150);
  }
  await page.waitForSelector('.result-card', { timeout: 8000 });
  await sleep(900);
  const s = await getState(page);
  assert(s.stars.byGame.tletter.best === 2, `a missy round still earns 2 stars, never fewer (${s.stars.byGame.tletter.best})`);
  assert(s.meter >= 2, `even a 2-star round banks at least 2 meter points (${s.meter})`);
  await ctx.close();
}

// ==================== 7. nothing Toddler at Light or above ====================
console.log('== nothing toddler at Light+ ==');
for (const tier of ['light', 'medium', 'full']) {
  const { ctx, page } = await fresh(SAVE({ settings: { sound: false, music: false, voice: false, content: tier }, age: 8 }));
  await page.waitForSelector('.hub');
  assert(!(await page.$('.toddler-hub')) && !(await page.$('.toddler-card')), `${tier}: no Toddler hub or cards`);
  const cardNames = await page.$$eval('.game-card .gc-name', ns => ns.map(n => n.textContent));
  assert(!cardNames.some(n => /Count|Colours|Shapes|Letters/.test(n)), `${tier}: no Toddler games among the ${cardNames.length} cards`);
  // collection keeps its Trophies tab
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-tabs');
  const tabs = await page.$$eval('.coll-tab', ns => ns.map(n => n.textContent));
  assert(tabs.some(t => /Troph/.test(t)), `${tier}: the Trophies tab is back`);
  await ctx.close();
}

// ==================== 8. toddler paint kit ====================
console.log('== little-painter kit ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('paint'));
  await page.waitForSelector('.paint-canvas');
  const kit = await page.evaluate(() => ({
    swatches: document.querySelectorAll('.paint-swatches .paint-swatch:not(.rainbow)').length,
    rainbow: !!document.querySelector('.paint-swatch.rainbow'),
    tools: [...document.querySelectorAll('.paint-tool')].map(n => n.getAttribute('aria-label'))
  }));
  assert(kit.swatches === 8, `8 colours in the little-painter kit (${kit.swatches})`);
  assert(!kit.rainbow, 'no rainbow swatch for toddlers');
  assert(kit.tools.join(',') === 'brush,fill,stamp', `three fat brushes + fill + stamps only (${kit.tools.join(',')})`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
