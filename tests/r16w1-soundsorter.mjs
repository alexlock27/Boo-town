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

// ---- 2b. RUN18A H1: the containment invariant, every phoneme x every offered mode -----
// The softlock this packet closes: a target whose `correct` list holds a word that was
// never dealt onto the board can never be finished, so the counter pins and she taps
// forever. This walks EVERY selectable level/position mode, not just the default one —
// the standing lesson from this suite's own miss (RECOVERY_PLAN, "one lesson for the
// test law"): an acceptance suite for a level-structured game enumerates every level.
console.log('== 2b. every correct word is dealt onto the board (containment), all modes ==');
{
  const { ctx, page } = await open('hub', {});
  const r = await page.evaluate(async () => {
    const { buildTarget, buildRound, SOUND_GROUPS, levelsForGroup } = await import('./js/games/soundsorter.js');
    const { PHONEME_KEYS, targetsForLevel } = await import('./data/phonemes.js');
    const breach = [], empty = [], modes = [];
    // (a) every phoneme at every level it is offered at, 200 targets each
    let generated = 0;
    for (const k of PHONEME_KEYS) for (const l of [1, 2, 3, 4]) {
      if (!targetsForLevel(l).includes(k)) continue;
      modes.push(k + '@' + l);
      for (let i = 0; i < 200; i++) {
        const t = buildTarget(k, l);
        if (!t) continue;             // unbuildable is allowed; unwinnable is not
        generated++;
        const missing = t.correct.filter(w => !t.cards.includes(w));
        if (missing.length) breach.push(`${k}@${l}: ${missing.join(',')} not on the board`);
        if (t.correct.length < 1) empty.push(k + '@' + l);
      }
    }
    // (b) the same invariant through the modes a child can actually PICK, round by round
    const groupModes = [];
    for (const g of SOUND_GROUPS) for (const l of levelsForGroup(g.key)) {
      groupModes.push(`${g.key}/${l}`);
      for (let i = 0; i < 200; i++) {
        const targets = buildRound(g.sounds, l, 8);
        if (targets.length !== 8) breach.push(`${g.key}/${l}: round of ${targets.length}, not 8`);
        for (const t of targets) {
          const missing = t.correct.filter(w => !t.cards.includes(w));
          if (missing.length) breach.push(`${g.key}/${l}/${t.sound}: ${missing.join(',')} not on the board`);
          if (t.correct.length < 1) empty.push(`${g.key}/${l}/${t.sound}`);
        }
      }
    }
    return { breach: breach.slice(0, 5), breaches: breach.length, empty: empty.length, generated, modes, groupModes };
  });
  assert(r.modes.length >= 24, `walked every phoneme x level mode (${r.modes.length} combinations, ${r.generated} targets)`);
  assert(r.groupModes.length === 9, `and every group x level a child can pick (${r.groupModes.join(' ')})`);
  assert(r.breaches === 0, 'every word in `correct` is dealt onto the board — no unwinnable target' + (r.breaches ? ': ' + r.breach.join('; ') : ''));
  assert(r.empty === 0, 'and no target is generated with an empty `correct` list');
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
  // RUN18D's Explanation Standard puts the pack's sentence first — "«word» hasn't got
  // «sound» in it — listen: «word»." — and KEEPS RUN16's own "ch, not sh", because naming
  // the sound the word really has is the thing that makes the answer click.
  assert(r.chip === "chip hasn't got sh in it — listen: chip. ch, not sh!",
    `the brief's own example reads "${r.chip}"`);
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

// ---- 7. RUN18A H1: a tile she has already answered is quiet, and so is a won board ----
// Two stale-tap paths, both of which cost her a heart before this packet. `tapAny` fires
// the card's own handler even on a disabled tile, so the guards are proven at the handler,
// not merely at the DOM's disabled attribute — a suite that only clicked would pass on a
// tile that browsers refuse to click anyway.
console.log('== 7. already-answered tiles, and the celebration window, cost nothing ==');
{
  const { ctx, page } = await open('soundsorter', {});
  await page.waitForSelector('.start-card', { timeout: 8000 });
  await page.evaluate(() => document.querySelectorAll('.level-btn')[0].click());
  await page.waitForFunction(() => window.__sounds, null, { timeout: 8000 });

  // (a) tap ONE correct word (the target has 2-3, so the board stays open), then tap that
  //     same tile again: no scoring, no new feedback text.
  const found = await page.evaluate(() => {
    const t = window.__sounds.target();
    const w = t.correct[0];
    window.__sounds.tap(w);
    const after = { ...window.__sounds.state(), bubble: document.querySelector('.peek-bubble').textContent };
    window.__sounds.tapAny(w);                       // the stale re-tap
    const again = { ...window.__sounds.state(), bubble: document.querySelector('.peek-bubble').textContent };
    return { w, correct: t.correct.length, after, again, disabled: document.querySelector(`.ss-card[data-word="${w}"]`).disabled };
  });
  assert(found.correct >= 2, `the target has ${found.correct} correct cards, so one tap leaves the board open`);
  assert(found.disabled, `the found tile "${found.w}" is disabled the moment she gets it right`);
  assert(found.again.wrong === found.after.wrong && found.again.solved === found.after.solved,
    'tapping an already-found tile scores nothing (wrong and solved both unchanged)');
  assert(found.again.bubble === found.after.bubble, `and says nothing new (bubble still "${found.again.bubble}")`);

  // (b) finish the target, then tap a tile she never touched, inside the celebration.
  //     Before this fix that tap was judged against the NEXT target: a lost heart and a
  //     guide line naming a sound that was not even on screen.
  const window900 = await page.evaluate(() => {
    window.__sounds.solveTarget();
    const won = { ...window.__sounds.state(), bubble: document.querySelector('.peek-bubble').textContent };
    const t = window.__sounds.target();
    const leftover = t.cards.filter(w => !t.correct.includes(w));
    const live = leftover.filter(w => !document.querySelector(`.ss-card[data-word="${w}"]`).disabled);
    window.__sounds.tapAny(leftover[0]);             // the celebration-window tap
    const after = { ...window.__sounds.state(), bubble: document.querySelector('.peek-bubble').textContent };
    return { won, after, leftover, live, sound: t.sound };
  });
  assert(window900.won.live === false, 'the board closes the instant the target is won');
  assert(window900.live.length === 0, `and every untouched tile goes quiet too (${window900.leftover.length} of them)`);
  assert(window900.after.wrong === window900.won.wrong, 'a tap during the celebration costs no heart');
  assert(!/not /.test(window900.after.bubble), `and the guide does not correct her for a sound she was never asked: "${window900.after.bubble}"`);
  assert(window900.after.solved === window900.won.solved, 'and cannot finish the next target on the old board');

  // and the round still moves on normally afterwards
  await page.waitForFunction(() => window.__sounds.state().renders === 2 && window.__sounds.state().live, null, { timeout: 8000 });
  assert(true, 'the next target renders as normal after the ignored taps');
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;

// ---- RUN18D D8: drift worth noticing -------------------------------------------------
// RUN16 W1 shipped an 8px rise over a fixed 5.2-6.1s and said so itself in its own
// self-critique: a drift a child never sees is not a drift. The numbers are authored now,
// and this measures the board rather than grepping the source, because the amplitude is a
// CSS variable and only the rendered card knows whether it arrived.
console.log('== the cards drift 22px, on per-card periods, with the rows sliding apart ==');
{
  const { DRIFT_AMPLITUDE_PX, DRIFT_PERIOD_MS, ROW_PARALLAX_PX } = await import('../js/games/soundsorter.js');
  assert(DRIFT_AMPLITUDE_PX === 22, `DRIFT_AMPLITUDE_PX is 22 (${DRIFT_AMPLITUDE_PX})`);
  assert(DRIFT_PERIOD_MS[0] === 4000 && DRIFT_PERIOD_MS[1] === 7000, `periods are randomised 4-7s (${DRIFT_PERIOD_MS})`);
  assert(ROW_PARALLAX_PX === 6, `row parallax is 6px (${ROW_PARALLAX_PX})`);

  const { ctx, page } = await open('soundsorter');
  await page.waitForSelector('.level-btn', { timeout: 15000 });
  await page.click('.level-btn');
  await page.waitForSelector('.ss-card', { timeout: 15000 });
  await page.waitForTimeout(400);

  const vars = await page.evaluate(() => [...document.querySelectorAll('.ss-card')].map((n, i) => {
    const cs = getComputedStyle(n);
    return { i, amp: n.style.getPropertyValue('--ssamp').trim(), row: n.style.getPropertyValue('--ssrow').trim(),
             dur: parseFloat(cs.animationDuration) };
  }));
  assert(vars.length >= 6, `${vars.length} cards on the board`);
  assert(vars.every(v => v.amp === '22px'), `every card carries the authored amplitude (${vars.map(v => v.amp).join(',')})`);
  assert(vars.every(v => v.dur >= 4 && v.dur <= 7), `every period is inside 4-7s (${vars.map(v => v.dur.toFixed(2)).join(',')})`);
  assert(new Set(vars.map(v => v.dur.toFixed(2))).size >= 4,
    `and they are picked per CARD, not shared (${new Set(vars.map(v => v.dur.toFixed(2))).size} distinct)`);
  const rows = new Set(vars.map(v => v.row));
  assert(rows.has('6px') && rows.has('-6px'), `rows carry opposite parallax (${[...rows].join(',')})`);

  // 8 frames over 4s: every card must genuinely be somewhere else, and the SPREAD of where
  // it goes has to be worth the 22px it is asking for.
  const frames = [];
  for (let f = 0; f < 8; f++) {
    frames.push(await page.evaluate(() => [...document.querySelectorAll('.ss-card')]
      .map(n => { const r = n.getBoundingClientRect(); return [Math.round(r.top * 10) / 10, Math.round(r.left * 10) / 10]; })));
    await page.waitForTimeout(500);
  }
  const spans = frames[0].map((_, c) => {
    const ys = frames.map(fr => fr[c][0]), xs = frames.map(fr => fr[c][1]);
    return { y: Math.max(...ys) - Math.min(...ys), x: Math.max(...xs) - Math.min(...xs) };
  });
  const distinctFrames = new Set(frames.map(fr => JSON.stringify(fr))).size;
  assert(distinctFrames === 8, `all 8 frames over 4s are distinct (${distinctFrames})`);
  assert(spans.every(sp => sp.y >= 10), `every card really travels (worst vertical span ${Math.min(...spans.map(sp => sp.y)).toFixed(1)}px over 4s)`);
  assert(Math.max(...spans.map(sp => sp.y)) >= 16,
    `and the board reaches most of its 22px (best ${Math.max(...spans.map(sp => sp.y)).toFixed(1)}px)`);
  await page.screenshot({ path: `${SHOTS}/d8-drift.png` });
  await ctx.close();

  // reduced motion: static, and still tappable
  const rctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const rpage = await rctx.newPage();
  await rpage.addInitScript(s2 => localStorage.setItem('bootown.save.v1', s2), save());
  await rpage.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 40000 });
  await rpage.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 40000 });
  await rpage.evaluate(() => window.BooTown.go('soundsorter'));
  await rpage.waitForSelector('.level-btn', { timeout: 15000 });
  await rpage.click('.level-btn');
  await rpage.waitForSelector('.ss-card', { timeout: 15000 });
  await rpage.waitForTimeout(300);
  const a = await rpage.evaluate(() => [...document.querySelectorAll('.ss-card')].map(n => n.getBoundingClientRect().top));
  await rpage.waitForTimeout(1400);
  const b = await rpage.evaluate(() => [...document.querySelectorAll('.ss-card')].map(n => n.getBoundingClientRect().top));
  assert(a.every((v, i) => Math.abs(v - b[i]) < 0.6), 'reduced motion holds every card still');
  await rctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
