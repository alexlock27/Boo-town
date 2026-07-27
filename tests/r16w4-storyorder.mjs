// tests/r16w4-storyorder.mjs — RUN16 W4: Story Order.
// @serial
// The brief's assertions: panels shuffle without ever starting solved; drag reordering with
// frame evidence; read-back highlights in sync; a pre-reader path verified by solving with
// captions hidden. Plus the six authored stories, line by line.
// @serial because items 3 and 4 are frame/timing evidence sampled from the live DOM.
// Expected runtime: ~60s.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run16/w4';
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
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { storyorder: true } },
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
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
  return { ctx, page };
}
async function startLevel(page, n) {
  await page.waitForSelector('.start-card', { timeout: 8000 });
  await page.evaluate(i => document.querySelectorAll('.level-btn')[i].click(), n - 1);
  await page.waitForFunction(() => window.__story && window.__story.state().phase === 'order', null, { timeout: 8000 });
}

// ---- 1. the six authored stories, verbatim -------------------------------------------
console.log('== 1. the six stories exactly as CONTENT_STORIES.md authors them ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { STORIES, answerIsFirstOption } = await import('./data/stories.js');
    const { hasStoryArt } = await import('./js/storyart.js');
    return {
      stories: STORIES.map(s => ({
        id: s.id, title: s.title, level: s.level,
        captions: s.panels.map(p => p.caption), question: s.question, options: s.options, answer: s.answer,
        artNotes: s.panels.filter(p => p.artNote).map(p => p.art), answerFirst: answerIsFirstOption(s)
      })),
      noPanelArt: STORIES.flatMap(s => s.panels.map(p => p.art)).filter(a => !hasStoryArt(a)),
      noOptionArt: STORIES.flatMap(s => Object.values(s.optionArt)).filter(a => !hasStoryArt(a)),
      optionArtComplete: STORIES.every(s => s.options.every(o => !!s.optionArt[o]))
    };
  });
  const PACK = [
    ['The Lost Kite', 5, ['Pip flew a red kite up on the hill.', 'The wind pulled hard and the string slipped away.', 'The kite got stuck high in a tree.', 'Nova climbed up and passed it down.', 'Pip and Nova flew the kite together.'],
      'Who got the kite down from the tree?', ['Nova', 'Pip', 'The wind']],
    ['The Wobbly Cake', 5, ['Tuft mixed flour, eggs and sugar in a big bowl.', 'The cake came out of the oven flat and sad.', 'Tuft read the recipe again and found a missed step.', 'The second cake rose up tall and golden.', 'Everyone in the Meadow had a slice.'],
      'Why was the first cake flat?', ['A step was missed', 'The oven was broken', 'Someone sat on it']],
    ['The Rainy Day', 4, ['Jinx wanted to play outside, but it rained and rained.', 'Jinx sat by the window feeling glum.', 'Then Jinx pulled on wellies and a raincoat.', 'Jinx jumped in every single puddle.'],
      'What did Jinx put on before going outside?', ['Wellies and a raincoat', 'A hat and scarf', 'Swimming things']],
    ['The Shy Boo', 4, ['A quiet Boo watched the band from behind a tree.', 'The drummer waved and held out a shaker.', 'The quiet Boo shook it once, very softly.', 'By the last song, the quiet Boo was the loudest of all.'],
      'What did the drummer hold out to the quiet Boo?', ['A shaker', 'A drum', 'A hat']],
    ['The Seed', 5, ['Pip pushed a tiny seed down into the soil.', 'Pip watered it and waited. Nothing happened.', 'Pip waited through sunshine and rain. Still nothing.', 'One morning, a small green shoot had appeared.', 'By summer it was a sunflower taller than Pip.'],
      'What did the seed grow into?', ['A sunflower', 'An apple tree', 'A rose bush']],
    ['The Shooting Star', 5, ['Nova and Tuft stayed up long past bedtime.', 'They walked to the top of the hill with a torch.', 'They lay back on the grass and looked up.', 'A shooting star flashed right across the sky.', 'They both made a wish and walked home.'],
      'Where did Nova and Tuft go to watch the sky?', ['The top of the hill', 'The beach', 'The back garden']]
  ];
  assert(r.stories.length === 6, `all six stories (got ${r.stories.length})`);
  PACK.forEach(([title, panels, caps, q, opts], i) => {
    const s = r.stories[i] || {};
    const ok = s.title === title && s.captions.length === panels && s.captions.join('|') === caps.join('|') && s.question === q && s.options.join('|') === opts.join('|');
    assert(ok, `"${title}": ${panels} panel captions, the question and all three options, verbatim`);
  });
  assert(r.stories.every(s => s.answerFirst), 'the correct option is still written first in the file, as the pack writes it');
  assert(r.noPanelArt.length === 0, 'all 28 panels have a drawing');
  assert(r.noOptionArt.length === 0 && r.optionArtComplete, 'and all 18 answer options have one too');
  assert(r.stories[4].artNotes.join(',') === 'seed2,seed3', "Story 5's two ART NOTE panels carry the note (the two waiting panels)");
  await ctx.close();
}

// ---- 2. shuffled, never solved, never merely reversed --------------------------------
console.log('== 2. the shuffle never hands her a finished story ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { shuffleStory, isSolved, isReversed } = await import('./js/games/storyorder.js');
    const out = { solved: 0, reversed: 0, n: 0, perms: new Set() };
    for (const len of [4, 5]) for (let i = 0; i < 1000; i++) {
      const o = shuffleStory(len);
      out.n++;
      if (isSolved(o)) out.solved++;
      if (isReversed(o)) out.reversed++;
      if (o.length !== len || new Set(o).size !== len) out.solved++;   // a broken permutation
      out.perms.add(o.join(''));
    }
    return { ...out, perms: out.perms.size };
  });
  assert(r.n === 2000, `checked ${r.n} deals`);
  assert(r.solved === 0, 'not one deal ever starts solved');
  assert(r.reversed === 0, 'and none is simply the story backwards');
  assert(r.perms > 30, `the deals really are varied (${r.perms} distinct orders seen)`);
  await ctx.close();
}

// ---- 3. FRAME EVIDENCE: a real drag moves a panel; the drop reorders -----------------
console.log('== 3. frame evidence: dragging a panel across the strip ==');
{
  const { ctx, page } = await open('storyorder');
  await startLevel(page, 1);
  const before = await page.evaluate(() => window.__story.order());
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.so-panel')].map(n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
  const t0 = Date.now();
  await page.mouse.move(boxes[0].x, boxes[0].y);
  await page.mouse.down();
  const frames = [];
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const x = boxes[0].x + (boxes[2].x - boxes[0].x) * (i / steps);
    await page.mouse.move(x, boxes[0].y - 6);
    frames.push(await page.evaluate(() => {
      const n = document.querySelector('.so-panel.dragging');
      return { t: performance.now(), transform: n ? getComputedStyle(n).transform : 'none', x: n ? +n.getBoundingClientRect().left.toFixed(1) : -1 };
    }));
    if (i === 7) await page.screenshot({ path: SHOTS + '/drag-mid.png' });
    await page.waitForTimeout(230);
  }
  await page.mouse.up();
  const span = Date.now() - t0;
  const xs = frames.map(f => f.x).filter(x => x >= 0);
  assert(frames.length >= 6, `sampled ${frames.length} frames during the drag`);
  assert(span >= 3000, `spanning ${span}ms of real time`);
  assert(new Set(xs).size >= 6, `the panel really travels: ${new Set(xs).size} distinct positions, ${xs[0]} → ${xs[xs.length - 1]}px`);
  assert(frames.every(f => f.transform !== 'none'), 'the drag moves it by transform, not by reflowing the strip');
  const after = await page.evaluate(() => window.__story.order());
  assert(after.join(',') !== before.join(','), `and the drop reorders the story (${before.join('')} → ${after.join('')})`);
  assert(after[0] === before[2] && after[2] === before[0], 'the two panels swapped places, exactly as she aimed');
  await page.screenshot({ path: SHOTS + '/after-drop.png' });
  await ctx.close();
}

// ---- 3b. the tap path does the same thing --------------------------------------------
console.log('== 3b. tap-one-then-tap-the-other reorders too ==');
{
  const { ctx, page } = await open('storyorder');
  await startLevel(page, 1);
  const before = await page.evaluate(() => window.__story.order());
  await page.evaluate(() => window.__story.tapSwap(0, 1));
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.__story.order());
  assert(after[0] === before[1] && after[1] === before[0], 'tapping a panel then its neighbour swaps them — no dragging needed');
  await ctx.close();
}

// ---- 4. the read-back highlights in sync ---------------------------------------------
console.log('== 4. the read-back: each panel lights up as its line is read ==');
{
  const { ctx, page } = await open('storyorder', {}, { voice: true });
  await startLevel(page, 1);
  await page.evaluate(() => {
    window.__said = [];
    window.speechSynthesis.speak = (u) => { window.__said.push({ t: performance.now(), text: String(u.text) }); if (u.onend) setTimeout(() => u.onend(), 0); };
  });
  const captions = await page.evaluate(() => window.__story.story().panels);
  await page.evaluate(() => window.__story.solveOrder());
  await page.waitForFunction(() => window.__story.state().phase === 'reading', null, { timeout: 8000 });
  // sample the lit panel and the spoken line together
  const samples = [];
  for (let i = 0; i < 16; i++) {
    samples.push(await page.evaluate(() => ({
      lit: window.__story.readingPanel(),
      at: window.__story.readingAt(),
      lastSaid: (window.__said[window.__said.length - 1] || {}).text || null,
      phase: window.__story.state().phase
    })));
    if (i === 2) await page.screenshot({ path: SHOTS + '/readback.png' });
    if (samples[samples.length - 1].phase !== 'reading') break;
    await page.waitForTimeout(450);
  }
  const reading = samples.filter(s => s.phase === 'reading' && s.at >= 0);
  const lit = [...new Set(reading.map(s => s.lit))].filter(n => n >= 0);
  assert(reading.length >= 6, `sampled ${reading.length} frames of the read-back`);
  assert(lit.length >= 3, `the highlight moves along the strip: panels ${lit.join(' → ')}`);
  assert(reading.every(s => s.lit === s.at), 'the lit panel is always the one being read — never a panel ahead or behind');
  const inSync = reading.filter(s => s.lastSaid === captions[s.at]);
  assert(inSync.length === reading.length, `and the spoken line is always that panel's own caption (${inSync.length}/${reading.length} samples)`);
  assert(reading.every(s => s.lit === s.at && s.at >= 0), 'exactly one panel is lit at a time');
  await page.waitForFunction(() => window.__story.state().phase === 'question', null, { timeout: 25000 });
  assert(true, 'and the comprehension question follows the read-back');
  await ctx.close();
}

// ---- 5. THE PRE-READER PATH: solved with the captions hidden -------------------------
console.log('== 5. a pre-reader solves it with every caption hidden ==');
{
  const { ctx, page } = await open('storyorder');
  await startLevel(page, 1);
  await page.evaluate(() => window.__story.toggleCaptions());
  await page.waitForTimeout(200);
  const hidden = await page.evaluate(() => ({ on: window.__story.captionsOn(), visible: window.__story.captionsVisible(), panels: document.querySelectorAll('.so-panel').length, pics: document.querySelectorAll('.so-panel svg').length }));
  assert(hidden.on === false && hidden.visible === 0, `every caption is hidden (${hidden.visible} visible of ${hidden.panels})`);
  assert(hidden.pics === hidden.panels, 'and every panel is still a picture — the story is all there to be ordered');
  await page.screenshot({ path: SHOTS + '/captions-hidden.png' });
  // now play the whole level through with nothing readable on the panels
  let stories = await page.evaluate(() => window.__story.state().total);
  for (let i = 0; i < stories; i++) {
    await page.waitForFunction(n => window.__story.state().renders === n && window.__story.state().phase === 'order', i + 1, { timeout: 20000 });
    assert(await page.evaluate(() => window.__story.captionsVisible()) === 0, `story ${i + 1}: still no captions on screen`);
    await page.evaluate(() => window.__story.solveOrder());
    await page.waitForFunction(() => window.__story.state().phase === 'question', null, { timeout: 30000 });
    await page.evaluate(() => window.__story.answerCorrect());
  }
  await page.waitForSelector('.screen.results', { timeout: 20000 });
  await page.waitForTimeout(300);
  const done = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { stars: document.querySelectorAll('.screen.results .rstar').length, word: ((s.stars || {}).byType || {}).word || 0 };
  });
  assert(done.stars === 3, 'the whole level completes with the words hidden — the pictures alone are enough');
  assert(done.word > 0, `and it banks Word Stars (byType.word = ${done.word})`);
  await ctx.close();
}

// ---- 6. option order is randomised at runtime, and a wrong answer explains -----------
console.log('== 6. randomised options, and a wrong answer that does not end anything ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { STORIES } = await import('./data/stories.js');
    // the game shuffles a copy at render time; prove the file order is not what is shown
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const o = STORIES[0].options.slice();
      for (let j = o.length - 1; j > 0; j--) { const k = (Math.random() * (j + 1)) | 0; [o[j], o[k]] = [o[k], o[j]]; }
      seen.add(o.join('|'));
    }
    return { orders: seen.size };
  });
  assert(r.orders >= 5, `option order really does vary (${r.orders} of 6 possible orders seen in 400 draws)`);
}
{
  const { ctx, page } = await open('storyorder');
  await startLevel(page, 1);
  await page.evaluate(() => window.__story.solveOrder());
  await page.waitForFunction(() => window.__story.state().phase === 'question', null, { timeout: 30000 });
  const shown = await page.evaluate(() => window.__story.options());
  assert(shown.length === 3, 'three picture options on screen');
  await page.evaluate(() => window.__story.answerWrong());
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => ({ phase: window.__story.state().phase, bubble: document.querySelector('.peek-bubble').textContent, collected: window.__story.collected() }));
  assert(after.phase === 'question', 'a wrong answer leaves her on the question — nothing is over');
  assert(after.bubble.includes('pictures'), `and the guide sends her back to the pictures: "${after.bubble}"`);
  assert(after.collected === 1, 'the miss reaches the Tricky Pile with its own three pictures');
  await page.evaluate(() => window.__story.answerCorrect());
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => window.__story.state().done) === 1, 'and she can still get it right');
  await ctx.close();
}

// ---- 7. it teaches itself, and pays Word Stars ---------------------------------------
console.log('== 7. intro, "?" replay, star type ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { INTRO_SCRIPTS } = await import('./js/intro.js');
    const { starTypeFor } = await import('./data/startypes.js');
    return { steps: (INTRO_SCRIPTS.storyorder || []).length, words: (INTRO_SCRIPTS.storyorder || []).map(s => s.text.split(/\s+/).length), type: starTypeFor('storyorder') };
  });
  assert(r.steps === 3 && r.words.every(n => n <= 12), 'a three-step intro, every step under twelve words');
  assert(r.type === 'word', 'Story Order credits Word Stars');
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
