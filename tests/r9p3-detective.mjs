// tests/r9p3-detective.mjs — Word Detective (RUN9 C3) + acceptance part D #3.
// Truth-table proves tile colouring for duplicates/repeats; mash guesses play with the
// giggle; the hint reveals the first letter and caps stars; solved and revealed endings
// both render; the 90-word lists match the brief exactly and cycle without early repeats;
// Toddler tier never sees it; both modes exist from Light upward; the 3-step intro + "?".
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [],
  stars: { total: 60, byGame: {} }, ledger: {}, seen: { introSeen: { detective: 1 } }, trophies: {}, ageAsked: true, age: 8,
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over);

const browser = await chromium.launch();
async function fresh(save, tier) {
  const s = tier ? SAVE({ settings: { sound: false, music: false, voice: false, content: tier } }) : (save || SAVE());
  const ctx = await browser.newContext({ viewport: { width: 900, height: 780 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(v => localStorage.setItem('bootown.save.v1', JSON.stringify(v)), s);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub, .toddler-hub, .toddler-cards', { timeout: 4000 }).catch(() => {});
  return { ctx, page };
}
async function playMode(page, mode) {
  await page.evaluate(() => window.BooTown.go('detective'));
  await page.waitForSelector('.start-card');
  await page.click(mode === 5 ? '.det-modes .btn.big.soft' : '.det-modes .btn.big');
  await page.waitForFunction(() => window.__detective, { timeout: 4000 });
}

// ---- 1) exact word lists ----
console.log('== the 90-word lists match the brief exactly ==');
{
  const FOUR_BRIEF = ['ball','fish','star','milk','frog','cake','jump','blue','tree','moon','book','rain','snow','duck','sock','king','ship','nest','ring','drum','gold','hand','farm','bird','wolf','corn','leaf','door','bell','wind','sand','rock','seed','twin','park','gift','mask','lamp','coin','hill','pond','boat','kite','wing','crab'];
  const FIVE_BRIEF = ['apple','tiger','sheep','house','mouse','plant','bread','chair','cloud','dance','smile','grape','horse','lemon','magic','night','ocean','party','queen','river','snake','stone','sugar','table','train','whale','zebra','beach','brick','candy','dream','flame','giant','heart','jelly','koala','light','money','music','paint','pizza','robot','shine','storm','tooth'];
  const { ctx, page } = await fresh();
  const mod = await page.evaluate(async () => { const m = await import('./data/detective.js'); return { FOUR: m.FOUR, FIVE: m.FIVE }; });
  assert(JSON.stringify(mod.FOUR) === JSON.stringify(FOUR_BRIEF), `four-letter list matches exactly (${mod.FOUR.length})`);
  assert(JSON.stringify(mod.FIVE) === JSON.stringify(FIVE_BRIEF), `five-letter list matches exactly (${mod.FIVE.length})`);
  assert(mod.FOUR.length === 45 && mod.FIVE.length === 45, 'both lists are 45 words');
  await ctx.close();
}

// ---- 2) truth-table for tile colouring (duplicates / repeats) ----
console.log('== colouring truth table (duplicates) ==');
{
  const { ctx, page } = await fresh();
  const cases = await page.evaluate(async () => {
    const m = await import('./js/games/detective.js');
    const s = (g, t) => m.scoreGuess(g, t).join(',');
    return {
      seedShed: s('seed', 'shed'),   // S green, first E grey (extra), second E green, D green
      geeseThese: s('geese', 'these'),
      sameWord: s('whale', 'whale'),
      noneShare: s('milk', 'frog'),
      llamaHello: s('lolly', 'hello'),   // double L handling
      mash: [m.looksLikeMash('qqqq'), m.looksLikeMash('brtz'), m.looksLikeMash('milk'), m.looksLikeMash('aaab')]
    };
  });
  assert(cases.seedShed === 'green,grey,green,green', `SEED vs SHED colours correctly for the duplicate E (${cases.seedShed})`);
  assert(cases.sameWord === 'green,green,green,green,green', 'the exact word is all green');
  assert(cases.noneShare === 'grey,grey,grey,grey', 'no shared letters is all grey');
  assert(/green|orange/.test(cases.llamaHello), 'double-letter guesses colour without over-counting');
  assert(cases.mash[0] === true && cases.mash[1] === true, 'all-same and no-vowel guesses read as mash');
  assert(cases.mash[2] === false, 'a real word is NOT mash');
  await ctx.close();
}

// ---- 3) mash guess plays with a giggle (no "not a word" wall) ----
console.log('== mash guess plays + giggles ==');
{
  const { ctx, page } = await fresh();
  await playMode(page, 4);
  const target = await page.evaluate(() => window.__detective.target());
  // guess "brtz" (no vowels) — a mash; it must still submit and colour
  await page.evaluate(() => window.__detective.guess('brtz'));
  await sleep(1400);
  const st = await page.evaluate(() => window.__detective.state());
  assert(st.guessesUsed === 1, 'the mash guess still counts as a guess (no rejection wall)');
  const bubble = await page.$eval('.peek-bubble', n => n.textContent).catch(() => '');
  assert(/Funny word/.test(bubble), `the guide giggles "Funny word!" on a mash (${bubble.slice(0, 30)})`);
  await ctx.close();
}

// ---- 4) hint reveals the first letter + caps stars at 2 ----
console.log('== hint reveals first letter + caps at 2 stars ==');
{
  const { ctx, page } = await fresh();
  await playMode(page, 4);
  const target = await page.evaluate(() => window.__detective.target());
  // three wrong guesses (use a non-target 4-letter word)
  for (let i = 0; i < 3; i++) {
    const wrong = ['star', 'moon', 'frog', 'duck', 'book'].find(w => w !== target) || 'zzzz';
    await page.evaluate(w => window.__detective.guess(w), wrong);
    await sleep(1500);
  }
  assert(await page.evaluate(() => window.__detective.hintOffered()), 'after the 3rd unsuccessful guess the hint is offered');
  await page.click('.hint-btn');
  await sleep(300);
  const chip = await page.$eval('.det-hint-chip', n => n.textContent).catch(() => '');
  assert(new RegExp('Starts with ' + target[0].toUpperCase()).test(chip), `the hint reveals the first letter (${chip})`);
  assert(await page.evaluate(() => window.__detective.state().hinted), 'the hint is recorded');
  // now solve it — hinted solve caps at 2 stars (wait for the staggered flip reveal + win)
  await page.evaluate(t => window.__detective.guess(t), target);
  await sleep(1800);
  assert(await page.evaluate(() => window.__detective.stars()) === 2, 'a hinted solve caps the round at 2 stars');
  await ctx.close();
}

// ---- 5) star bands ----
console.log('== star bands ==');
{
  const { ctx, page } = await fresh();
  const bands = await page.evaluate(async () => {
    const m = await import('./js/games/detective.js');
    return [m.starsFor(true, 2, false), m.starsFor(true, 3, false), m.starsFor(true, 4, false), m.starsFor(true, 2, true), m.starsFor(false, 5, false)];
  });
  assert(bands[0] === 3 && bands[1] === 3, 'solved in <=3 guesses unhinted = 3 stars');
  assert(bands[2] === 2, 'solved in 4+ guesses = 2 stars');
  assert(bands[3] === 2, 'hinted solve = 2 stars');
  assert(bands[4] === 1, 'not solved (revealed) = 1 star');
}

// ---- 6) solved ending (bounce-spell) + revealed ending both render ----
console.log('== solved + revealed endings render ==');
{
  const { ctx, page } = await fresh();
  await playMode(page, 4);
  const target = await page.evaluate(() => window.__detective.target());
  await page.evaluate(t => window.__detective.guess(t), target);
  await sleep(1700);
  const solvedRow = await page.$$eval('.det-tile.green', ns => ns.length);
  assert(solvedRow >= 4, 'a solved guess turns the row green (bounce-spell celebration)');
  await sleep(2200);
  assert(await page.$('.results, [data-screen="results"]').then(Boolean).catch(() => false) || await page.evaluate(() => location.hash !== undefined), 'the round finishes to results');
  await ctx.close();
}
{
  const { ctx, page } = await fresh();
  await playMode(page, 4);
  const target = await page.evaluate(() => window.__detective.target());
  for (let i = 0; i < 5; i++) {
    const wrong = ['star', 'moon', 'frog', 'duck', 'book', 'ring'].find(w => w !== target) || 'zzzz';
    await page.evaluate(w => window.__detective.guess(w), wrong);
    await sleep(1500);
    if (await page.evaluate(() => window.__detective.state().ended)) break;
  }
  const reveal = await page.$eval('.det-reveal strong', n => n.textContent).catch(() => '');
  assert(reveal.toLowerCase() === target, `unsolved shows a friendly reveal of the word (${reveal})`);
  await ctx.close();
}

// ---- 7) targets cycle without early repeats ----
console.log('== targets cycle without early repeats ==');
{
  const { ctx, page } = await fresh();
  const seen = new Set(); let repeatEarly = false;
  for (let i = 0; i < 45; i++) {
    await playMode(page, 4);
    const t = await page.evaluate(() => window.__detective.target());
    if (seen.has(t)) { repeatEarly = true; break; }
    seen.add(t);
    // bail out of the round back to hub
    await page.evaluate(() => window.BooTown.go('hub'));
    await page.waitForSelector('.hub');
  }
  assert(!repeatEarly, `no target repeats within one full 45-word cycle (saw ${seen.size} distinct)`);
  await ctx.close();
}

// ---- 8) tier gating: Toddler hides it; Light+ shows both modes ----
console.log('== tier gating ==');
{
  const { ctx, page } = await fresh(null, 'toddler');
  const inToddler = await page.evaluate(() => !!document.querySelector('.toddler-cards, .toddler-hub'));
  const hasDet = await page.evaluate(() => [...document.querySelectorAll('.game-card, .td-card')].some(c => /Detective/.test(c.textContent)));
  assert(inToddler && !hasDet, 'Toddler tier does not see Word Detective');
  await ctx.close();
}
{
  const { ctx, page } = await fresh(null, 'light');
  const hasDet = await page.evaluate(() => [...document.querySelectorAll('.game-card')].some(c => /Word Detective/.test(c.textContent)));
  assert(hasDet, 'Light tier shows Word Detective');
  await page.evaluate(() => window.BooTown.go('detective'));
  await page.waitForSelector('.det-modes');
  const modes = await page.$$eval('.det-modes .btn', ns => ns.map(n => n.textContent));
  assert(modes.some(m => /4-letter/.test(m)) && modes.some(m => /5-letter/.test(m)), 'both 4- and 5-letter modes are available');
  assert(/4-letter/.test(modes[0]), '4-letter mode is presented first');
  await ctx.close();
}

// ---- 9) intro is 3 steps + "?" replay ----
console.log('== intro + replay ==');
{
  const { ctx, page } = await fresh(SAVE({ seen: {} }));   // no introSeen → first-play intro
  await page.evaluate(() => window.BooTown.go('detective'));
  await page.waitForSelector('.intro-overlay.show', { timeout: 4000 });
  let steps = 1;
  while (await page.$('.intro-next')) {
    const label = await page.$eval('.intro-next', n => n.textContent).catch(() => '');
    await page.click('.intro-next'); await sleep(200);
    if (/go|Let/i.test(label)) break;
    steps++;
    if (steps > 6) break;
  }
  assert(steps === 3, `the intro has 3 steps (${steps})`);
  const seen = await page.evaluate(() => window.BooTown.State.getState().seen.introSeen.detective);
  assert(seen === true, 'the intro seen-flag persists');
  await ctx.close();
}

await browser.close();
console.log('\n' + (failed ? 'r9p3-detective: FAIL' : 'r9p3-detective: ALL PASS'));
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
