// tests/r16w1-soundsorter.mjs — RUN16 W1: Sound Sorter.
// The brief's own assertions, in its own order: every listed word has art and a spoken
// form; each level's position rule holds over 200 generated rounds; distractors never
// share the target phoneme; the explanation names the actual sound in the tapped word;
// the round is playable with sound off via the grapheme card.
// Expected runtime: ~30s. Not @serial — no frame-sampling evidence in this suite.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run16/w1';
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
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { soundsorter: true } },
  settings: Object.assign({ sound: false, music: false, voice: false, content: 'full' }, settings)
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(route, params, settings = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(settings));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  // boot() navigates to the hub itself; a go() issued before that lands is silently
  // superseded by main.js's navToken. Wait for the first screen, navigate, then wait for
  // the route to own the screen — a condition-wait, never a sleep.
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
  return { ctx, page };
}

// ---- 1. the authored content is the brief's, and every word can be drawn and said -----
console.log('== 1. authored content, art and spoken form ==');
{
  const { ctx, page } = await open('hub', {});
  const r = await page.evaluate(async () => {
    const { PHONEMES, SOUND_POOL, WORD_SOUNDS } = await import('./data/phonemes.js');
    const { hasWordArt, renderWordArt } = await import('./js/wordart.js');
    const missingArt = SOUND_POOL.filter(w => !hasWordArt(w));
    // "a spoken form" = the card carries an accessible name the speech path reads out
    const missingLabel = SOUND_POOL.filter(w => !renderWordArt(w).includes(`aria-label="${w}"`));
    return {
      phonemes: PHONEMES.map(p => p.key),
      counts: PHONEMES.map(p => p.words.length),
      lists: Object.fromEntries(PHONEMES.map(p => [p.key, p.words])),
      pool: SOUND_POOL.length, missingArt, missingLabel,
      tabled: SOUND_POOL.filter(w => !WORD_SOUNDS[w])
    };
  });
  // the twelve phonemes and their six words each, exactly as RUN16.md authors them
  const AUTHORED = {
    sh: ['ship', 'shell', 'fish', 'brush', 'shed', 'wish'],
    ch: ['chip', 'chair', 'beach', 'cheese', 'church', 'watch'],
    th: ['thumb', 'thorn', 'bath', 'moth', 'three', 'path'],
    ng: ['ring', 'song', 'king', 'wing', 'strong', 'thing'],
    ai: ['rain', 'snail', 'train', 'tail', 'paint', 'chain'],
    ee: ['sheep', 'tree', 'queen', 'bee', 'green', 'feet'],
    oa: ['boat', 'goat', 'coat', 'road', 'toast', 'soap'],
    oo: ['moon', 'spoon', 'boot', 'roof', 'food', 'zoo'],
    ar: ['star', 'car', 'farm', 'park', 'shark', 'jar'],
    or: ['fork', 'horse', 'corn', 'storm', 'torch', 'sport'],
    igh: ['light', 'night', 'high', 'right', 'sight', 'bright'],
    ow: ['cow', 'owl', 'crown', 'flower', 'town', 'clown']
  };
  assert(r.phonemes.join(',') === Object.keys(AUTHORED).join(','), 'all twelve phonemes, in the authored order');
  const wrong = Object.entries(AUTHORED).filter(([k, ws]) => (r.lists[k] || []).join('|') !== ws.join('|'));
  assert(wrong.length === 0, 'every phoneme\'s six picture words match the brief exactly' + (wrong.length ? ' — ' + wrong.map(w => w[0]).join(',') : ''));
  assert(r.pool === 72, `the pool is the 72 authored words (got ${r.pool})`);
  assert(r.missingArt.length === 0, 'every listed word has art' + (r.missingArt.length ? ': missing ' + r.missingArt.join(',') : ''));
  assert(r.missingLabel.length === 0, 'every listed word has a spoken form (accessible name on its card)');
  assert(r.tabled.length === 0, 'every pool word is in the sound table');
  await ctx.close();
}

// ---- 2 + 3. 200 generated rounds: the position rule and the distractor rule -----------
console.log('== 2. the position rule and the distractor rule, over 200 generated rounds ==');
{
  const { ctx, page } = await open('hub', {});
  const r = await page.evaluate(async () => {
    const { buildTarget, buildRound } = await import('./js/games/soundsorter.js');
    const { PHONEME_KEYS, hasSoundAt, hasSound, targetsForLevel, PHONEME_BY_KEY, avoidsAsDistractor } = await import('./data/phonemes.js');
    const bad = { position: [], distractor: [], size: [], avoid: [], nearMiss: 0 };
    let built = 0;
    for (let i = 0; i < 200; i++) {
      const level = 1 + (i % 4);
      const targets = buildRound(targetsForLevel(level), level, 8);
      for (const t of targets) {
        built++;
        if (t.cards.length !== 6) bad.size.push(t.sound + '/' + t.cards.length);
        for (const w of t.correct) {
          // level 4 mixes positions; 1-3 must hold their position exactly
          if (!hasSoundAt(w, t.sound, t.position)) bad.position.push(`${w} not ${t.sound}@${t.position}`);
          if (level !== 4) {
            const want = { 1: 'initial', 2: 'final', 3: 'medial' }[level];
            if (t.position !== want) bad.position.push(`level ${level} asked ${t.position}`);
          }
          if (!PHONEME_BY_KEY[t.sound].words.includes(w)) bad.position.push(`${w} is not an authored ${t.sound} word`);
        }
        for (const w of t.cards) {
          if (t.correct.includes(w)) continue;
          if (hasSound(w, t.sound)) bad.distractor.push(`${w} shares ${t.sound}`);
          if (avoidsAsDistractor(w, t.sound)) bad.avoid.push(`${w} is accent-fragile for ${t.sound}`);
          if (level === 4 && PHONEME_BY_KEY[t.sound].nearMiss.includes(w)) bad.nearMiss++;
        }
      }
    }
    // and every phoneme can be built at every level it claims to support
    const unbuildable = [];
    for (const k of PHONEME_KEYS) for (const l of [1, 2, 3, 4]) {
      if (targetsForLevel(l).includes(k) && !buildTarget(k, l)) unbuildable.push(k + '@' + l);
    }
    return { ...bad, built, unbuildable };
  });
  assert(r.built >= 1500, `built ${r.built} targets across 200 rounds`);
  assert(r.size.length === 0, 'every round shows exactly six cards');
  assert(r.position.length === 0, 'the level position rule holds for every correct card' + (r.position.length ? ': ' + r.position.slice(0, 3).join('; ') : ''));
  assert(r.distractor.length === 0, 'no distractor ever shares the target phoneme' + (r.distractor.length ? ': ' + r.distractor.slice(0, 3).join('; ') : ''));
  assert(r.avoid.length === 0, 'accent-fragile words (bath/path) never appear as /ar/ distractors');
  assert(r.nearMiss > 0, `level 4 really does draw near-miss distractors (${r.nearMiss} seen)`);
  assert(r.unbuildable.length === 0, 'every phoneme builds at every level it is offered at');
  await ctx.close();
}

// ---- 4. the explanation names the actual sound in the tapped word ---------------------
console.log('== 4. a wrong tap names the word AND its real sound ==');
{
  const { ctx, page } = await open('soundsorter', {});
  await page.waitForSelector('.start-card', { timeout: 8000 });
  await page.evaluate(() => document.querySelectorAll('.level-btn')[0].click());
  await page.waitForFunction(() => window.__sounds, null, { timeout: 8000 });
  const r = await page.evaluate(async () => {
    const { missLine } = await import('./js/games/soundsorter.js');
    const { SOUND_POOL, soundsIn, PHONEME_KEYS } = await import('./data/phonemes.js');
    // the authored example first, then every legal (word, target) pair in the pool
    const chip = missLine('chip', 'sh');
    const wrongNamed = [];
    for (const w of SOUND_POOL) for (const target of PHONEME_KEYS) {
      if (soundsIn(w).includes(target)) continue;
      const line = missLine(w, target);
      if (!line.includes(w)) { wrongNamed.push(w + '/' + target + ' (no word)'); continue; }
      const real = soundsIn(w).filter(s => s !== target);
      if (real.length && !real.some(s => line.includes(s))) wrongNamed.push(w + '/' + target + ' (no real sound)');
    }
    return { chip, wrongNamed };
  });
  assert(r.chip === "That's chip — ch, not sh!", `the brief's own example reads "${r.chip}"`);
  assert(r.wrongNamed.length === 0, 'every wrong-tap line names the word and the sound it really has');
  // and it actually reaches the screen
  const live = await page.evaluate(() => {
    const t = window.__sounds.target();
    window.__sounds.tapWrong();
    return { bubble: document.querySelector('.peek-bubble').textContent, target: t.sound };
  });
  await page.waitForTimeout(300);
  assert(live.bubble.includes('not ' + live.target), `the guide says it out loud: "${live.bubble}"`);
  const pile = await page.evaluate(() => window.__sounds.collected());
  assert(pile === 1, 'and the miss lands in the Tricky Pile');
  await page.screenshot({ path: SHOTS + '/wrong-tap.png' });
  await ctx.close();
}

// ---- 5. playable with sound off, start to finish, via the grapheme card ---------------
console.log('== 5. sound off: the grapheme card carries the target and a full round completes ==');
{
  const { ctx, page } = await open('soundsorter', {}, { sound: false, music: false, voice: false });
  await page.waitForSelector('.start-card', { timeout: 8000 });
  await page.evaluate(() => document.querySelectorAll('.level-btn')[0].click());
  await page.waitForFunction(() => window.__sounds, null, { timeout: 8000 });
  const shown = await page.evaluate(() => {
    const card = document.querySelector('.ss-card-letters');
    const box = card && card.getBoundingClientRect();
    return { text: card && card.textContent, visible: !!(box && box.width > 40 && box.height > 24), where: document.querySelector('.ss-card-tip').textContent };
  });
  assert(!!shown.text && shown.visible, `the grapheme card shows "${shown.text}" at a readable size with sound off`);
  assert(/start|end|middle/.test(shown.where), `and says where to listen: "${shown.where}"`);
  await page.screenshot({ path: SHOTS + '/sound-off.png' });

  // play the whole round through the picture cards alone
  // Drive the round on its own state: wait for target N's cards to be on screen, solve
  // them, wait for N+1. A fixed sleep here would be a flake waiting to happen — `solved`
  // ticks before the next set of cards is rendered.
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction(n => window.__sounds && window.__sounds.state().renders === n && window.__sounds.state().solved === n - 1, i + 1, { timeout: 15000 });
    await page.evaluate(() => window.__sounds.solveTarget());
  }
  await page.waitForSelector('.screen.results', { timeout: 20000 });
  await page.waitForTimeout(300);
  const done = await page.evaluate(() => {
    const save = window.BooTown.State.getState();
    return {
      results: !!document.querySelector('.screen.results'),
      stars: document.querySelectorAll('.screen.results .rstar').length,
      word: ((save.stars || {}).byType || {}).word || 0
    };
  });
  assert(done.results && done.stars === 3, 'a full eight-target round finishes and reaches the results screen with sound off');
  assert(done.word > 0, `and the round banks Word Stars (byType.word = ${done.word})`);
  await page.screenshot({ path: SHOTS + '/round-complete.png' });
  await ctx.close();
}

// ---- 6. it teaches itself, and it pays Word Stars -------------------------------------
console.log('== 6. intro, "?" replay, and the star type ==');
{
  const { ctx, page } = await open('hub', {});
  const r = await page.evaluate(async () => {
    const { INTRO_SCRIPTS } = await import('./js/intro.js');
    const { starTypeFor, GAME_STAR_TYPE } = await import('./data/startypes.js');
    return {
      steps: (INTRO_SCRIPTS.soundsorter || []).length,
      words: (INTRO_SCRIPTS.soundsorter || []).map(s => s.text.split(/\s+/).length),
      type: starTypeFor('soundsorter'), mapped: GAME_STAR_TYPE.soundsorter
    };
  });
  assert(r.steps === 3, `the intro is three short steps (got ${r.steps})`);
  assert(r.words.every(n => n <= 12), 'every intro step is under twelve words');
  assert(r.type === 'word' && r.mapped === 'word', 'Sound Sorter credits Word Stars, not the puzzle default');
  await ctx.close();
}
{
  const { ctx, page } = await open('soundsorter', {});
  await page.waitForSelector('.start-card', { timeout: 8000 });
  await page.evaluate(() => document.querySelectorAll('.level-btn')[0].click());
  await page.waitForFunction(() => window.__sounds, null, { timeout: 8000 });
  const help = await page.evaluate(() => !!document.querySelector('.help-btn'));
  assert(help, 'the game shell carries the "?" replay button');
  await page.evaluate(() => document.querySelector('.help-btn').click());
  await page.waitForSelector('.intro-overlay', { timeout: 5000 });
  assert(await page.$('.intro-overlay') !== null, 'and tapping it replays the intro');
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
