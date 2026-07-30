// tests/r16w2-blendit.mjs — RUN16 W2: Blend It.
// @serial
// The brief's assertions: every word blends with per-grapheme audio then the whole; the
// three pictures are always distinguishable and only one is correct; drag and tap-Blend
// both work; frame evidence of the slide-together.
// @serial because item 4 is frame evidence — the slide is sampled from the live DOM over
// 3+ seconds, and parallel lane load starves exactly that kind of sampling.
// Expected runtime: ~40s.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run16/w2';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (settings = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { blendit: true } },
  settings: Object.assign({ sound: false, music: false, voice: false, content: 'full' }, settings)
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(route, params = {}, settings = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(settings));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  // boot() navigates to the hub itself; navigate only once that has landed, then wait for
  // the route to own the screen. Condition-waits, never sleeps.
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
  return { ctx, page };
}
async function startLevel(page, n) {
  await page.waitForSelector('.start-card', { timeout: 8000 });
  await page.evaluate(i => document.querySelectorAll('.level-btn')[i].click(), n - 1);
  await page.waitForFunction(() => window.__blend && window.__blend.word(), null, { timeout: 8000 });
}

// ---- 1. the authored word lists, verbatim, and the grapheme splits --------------------
console.log('== 1. the four authored levels, exactly as the brief lists them ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { BLEND_LEVELS, splitSpellsWord } = await import('./data/blending.js');
    const { hasWordArt } = await import('./js/wordart.js');
    return {
      levels: BLEND_LEVELS.map(l => ({ level: l.level, words: l.words.map(w => w.w), maxTiles: Math.max(...l.words.map(w => w.g.length)), minTiles: Math.min(...l.words.map(w => w.g.length)) })),
      badSplit: BLEND_LEVELS.flatMap(l => l.words).filter(e => !splitSpellsWord(e)).map(e => e.w),
      noArt: BLEND_LEVELS.flatMap(l => l.words).filter(e => !hasWordArt(e.w)).map(e => e.w)
    };
  });
  const AUTHORED = {
    1: ['cat', 'dog', 'pin', 'sun', 'bed', 'top', 'hat', 'cup', 'fox', 'jam', 'leg', 'mug', 'net', 'rug', 'tin', 'van'],
    2: ['ship', 'chin', 'moth', 'bath', 'ring', 'fish', 'shop', 'chop', 'sock', 'duck', 'back', 'lick'],
    3: ['rain', 'boat', 'moon', 'star', 'tree', 'corn', 'night', 'cow', 'spoon', 'chair', 'beach', 'green'],
    4: ['rabbit', 'basket', 'magnet', 'picnic', 'sunset', 'helmet', 'pocket', 'carpet', 'dentist', 'tunnel']
  };
  for (const [lvl, words] of Object.entries(AUTHORED)) {
    const got = (r.levels.find(l => String(l.level) === lvl) || {}).words || [];
    assert(got.join('|') === words.join('|'), `level ${lvl}: all ${words.length} words in the authored order`);
  }
  assert(r.badSplit.length === 0, 'every grapheme split spells its own word back' + (r.badSplit.length ? ': ' + r.badSplit.join(',') : ''));
  assert(r.noArt.length === 0, 'every blend word has a picture');
  assert(r.levels.every(l => l.minTiles >= 2), 'no word is a single tile');
  assert(r.levels[0].maxTiles === 3 && r.levels[3].maxTiles === 6, 'tile count really does scale with level (3 → 6)');
  await ctx.close();
}

// ---- 2. three distinguishable pictures, exactly one correct --------------------------
console.log('== 2. three pictures, all different, exactly one correct — over 400 items ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { buildBlendRound, pickPictures } = await import('./js/games/blendit.js');
    const { renderWordArt } = await import('./js/wordart.js');
    const bad = { count: 0, dupe: 0, noAnswer: 0, twoAnswers: 0, sameArt: 0 };
    let items = 0;
    for (let i = 0; i < 100; i++) {
      for (const level of [1, 2, 3, 4]) {
        for (const item of buildBlendRound(level, 8)) {
          items++;
          const o = item.options;
          if (o.length !== 3) bad.count++;
          if (new Set(o).size !== 3) bad.dupe++;
          const answers = o.filter(w => w === item.w).length;
          if (answers === 0) bad.noAnswer++;
          if (answers > 1) bad.twoAnswers++;
          // "distinguishable" means the drawings really differ, not just the labels
          const arts = new Set(o.map(w => renderWordArt(w).replace(/aria-label="[^"]*"/, '').replace(/class="[^"]*"/, '')));
          if (arts.size !== 3) bad.sameArt++;
        }
      }
    }
    // and the picker itself can never return a duplicate
    let pickerDupes = 0;
    for (let i = 0; i < 400; i++) { const o = pickPictures('cat', 1); if (new Set(o).size !== 3) pickerDupes++; }
    return { ...bad, items, pickerDupes };
  });
  assert(r.items >= 3000, `checked ${r.items} generated items`);
  assert(r.count === 0, 'every item offers exactly three pictures');
  assert(r.dupe === 0 && r.pickerDupes === 0, 'the three are never the same word twice');
  assert(r.sameArt === 0, 'and never the same drawing twice — they are always distinguishable');
  assert(r.noAnswer === 0, 'the correct word is always among them');
  assert(r.twoAnswers === 0, 'and only one option is ever correct');
  await ctx.close();
}

// ---- 3. per-grapheme audio then the whole word ---------------------------------------
console.log('== 3. the blend sounds each part in order, then the whole word ==');
{
  const { ctx, page } = await open('blendit', {}, { voice: true });
  await startLevel(page, 2);
  // Instrument the real speech path at its exit — window.speechSynthesis.speak — so this
  // proves what the child would actually HEAR, not what a stubbed module was asked to say.
  // (A module export cannot be reassigned from outside; the browser API can.)
  await page.evaluate(() => {
    window.__said = [];
    const ss = window.speechSynthesis;
    ss.speak = (u) => { window.__said.push(String(u.text)); if (u.onend) setTimeout(() => u.onend(), 0); };
  });
  const word = await page.evaluate(() => window.__blend.word());
  const tiles = await page.evaluate(() => window.__blend.tiles());
  await page.evaluate(() => { window.__said = []; window.__blend.blend(); });
  await page.waitForFunction(() => window.__blend.phase() === 'pick', null, { timeout: 12000 });
  const said = await page.evaluate(() => window.__said.slice());
  assert(said.length >= tiles.length + 1, `the blend spoke ${said.length} things for a ${tiles.length}-part word`);
  const seq = said.slice(0, tiles.length);
  assert(seq.join('|') === tiles.join('|'), `each grapheme is sounded in order: ${seq.join(' · ')}`);
  assert(said[tiles.length] === word, `and then the whole word: "${said[tiles.length]}"`);
  const shown = await page.evaluate(() => document.querySelector('.bl-word').textContent);
  assert(shown === word, 'the finished word lands on screen as one piece');
  await page.screenshot({ path: SHOTS + '/blended.png' });
  await ctx.close();
}

// ---- 4. FRAME EVIDENCE of the slide-together -----------------------------------------
console.log('== 4. frame evidence: the tiles really slide together ==');
{
  const { ctx, page } = await open('blendit');
  await startLevel(page, 4);      // the longest words: the most movement to prove
  const t0 = Date.now();
  await page.evaluate(() => window.__blend.blend());
  const frames = [];
  for (let i = 0; i < 12; i++) {
    frames.push(await page.evaluate(() => {
      const ts = [...document.querySelectorAll('.bl-tile')];
      const r0 = ts[0].getBoundingClientRect(), rN = ts[ts.length - 1].getBoundingClientRect();
      return { t: performance.now(), spread: +(rN.right - r0.left).toFixed(1), transform: getComputedStyle(ts[0]).transform };
    }));
    if (i === 3) await page.screenshot({ path: SHOTS + '/slide-mid.png' });
    await page.waitForTimeout(340);
  }
  const span = Date.now() - t0;
  const spreads = frames.map(f => f.spread);
  const distinct = new Set(spreads).size;
  assert(frames.length >= 6, `sampled ${frames.length} frames`);
  assert(span >= 3000, `spanning ${span}ms of real time`);
  assert(distinct >= 3, `the row narrows through ${distinct} distinct widths: ${spreads[0]} → ${spreads[spreads.length - 1]}px`);
  assert(spreads[spreads.length - 1] < spreads[0], 'and it ends narrower than it started — the tiles slid together');
  assert(frames.some(f => f.transform && f.transform !== 'none'), 'the movement is a transform, not a layout reflow');
  await page.screenshot({ path: SHOTS + '/slide-end.png' });
  await ctx.close();
}

// ---- 5. drag AND tap-Blend both work -------------------------------------------------
console.log('== 5. both ways in: a real pointer drag, and the Blend button ==');
{
  const { ctx, page } = await open('blendit');
  await startLevel(page, 1);
  const before = await page.evaluate(() => window.__blend.gap());
  const box = await page.evaluate(() => { const t = document.querySelectorAll('.bl-tile')[0]; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + i * 8, box.y);
  await page.mouse.up();
  await page.waitForFunction(() => window.__blend.gap() < 1 || window.__blend.phase() !== 'tiles', null, { timeout: 6000 });
  const after = await page.evaluate(() => ({ gap: window.__blend.gap(), phase: window.__blend.phase() }));
  assert(before > 0 && after.gap < before, `dragging pulls the tiles together (${before} → ${after.gap}px)`);
  await page.waitForFunction(() => window.__blend.phase() === 'pick', null, { timeout: 12000 });
  assert(await page.evaluate(() => window.__blend.blended()) !== false, 'and the drag alone completes the blend');
  await ctx.close();
}
{
  const { ctx, page } = await open('blendit');
  await startLevel(page, 1);
  await page.evaluate(() => document.querySelector('.bl-blend-btn').click());
  await page.waitForFunction(() => window.__blend.phase() === 'pick', null, { timeout: 12000 });
  assert(true, 'and the Blend button gets there too, without any dragging at all');
  // finish an item to prove the picture step lands
  const w = await page.evaluate(() => window.__blend.word());
  await page.evaluate(() => window.__blend.pickCorrect());
  await page.waitForFunction(() => window.__blend.state().right === 1, null, { timeout: 8000 });
  assert(true, `tapping the right picture for "${w}" scores it`);
  await ctx.close();
}

// ---- 6. a wrong picture explains, collects, and never ends the round ------------------
// RUN19 explanation pass (Alex, 2026-07-30): the sound walk now lands in a persistent
// .explain-panel locked behind "Got it ›" instead of a vanishing toast — she reads it,
// taps Got it, and the pictures come back. The round still never moves on without her.
console.log('== 6. a wrong picture is a soft wobble with an explanation ==');
{
  const { ctx, page } = await open('blendit');
  await startLevel(page, 1);
  await page.evaluate(() => document.querySelector('.bl-blend-btn').click());
  await page.waitForFunction(() => window.__blend.phase() === 'pick', null, { timeout: 12000 });
  const word = await page.evaluate(() => window.__blend.word());
  await page.evaluate(() => window.__blend.pickWrong());
  await page.waitForSelector('.explain-panel .explain-next', { timeout: 6000 });
  const r = await page.evaluate(() => ({
    line: (document.querySelector('.explain-panel .explain-line') || {}).textContent || '',
    phase: window.__blend.phase(), collected: window.__blend.collected(),
    stillThere: !!document.querySelector('.bl-picks')
  }));
  assert(r.line.includes(word), `the guide sounds it out again, in a panel she can read: "${r.line}"`);
  assert(r.phase === 'explain' && r.stillThere, 'the round waits behind Got it — it never moves on without her');
  assert(r.collected === 1, 'and the miss goes to the Tricky Pile as a picture item');
  await page.screenshot({ path: SHOTS + '/wrong-picture.png' });
  await page.evaluate(() => window.__blend.tapNext());
  await page.waitForFunction(() => window.__blend.phase() === 'pick', null, { timeout: 6000 });
  assert(true, 'Got it › hands the pictures back so she can still find it');
  await ctx.close();
}

// ---- 7. it teaches itself and pays Word Stars ----------------------------------------
console.log('== 7. intro, "?" replay, star type ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { INTRO_SCRIPTS } = await import('./js/intro.js');
    const { starTypeFor } = await import('./data/startypes.js');
    return { steps: (INTRO_SCRIPTS.blendit || []).length, words: (INTRO_SCRIPTS.blendit || []).map(s => s.text.split(/\s+/).length), type: starTypeFor('blendit') };
  });
  assert(r.steps === 3, 'the intro is three short steps');
  assert(r.words.every(n => n <= 12), 'every step is under twelve words');
  assert(r.type === 'word', 'Blend It credits Word Stars');
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
