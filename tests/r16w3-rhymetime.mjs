// tests/r16w3-rhymetime.mjs — RUN16 W3: Rhyme Time.
// The brief's assertions: every family's members rhyme by pronunciation (not spelling);
// traps never rhyme; couplets scan and their answers are unambiguous; spoken and pictured
// for every card.
// Expected runtime: ~20s. Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run16/w3';
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
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { rhymetime: true } },
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
  await page.waitForFunction(() => window.__rhyme && window.__rhyme.target(), null, { timeout: 8000 });
}

// ---- 1. the ten authored families, verbatim -------------------------------------------
console.log('== 1. the ten authored families and their members ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { RHYME_FAMILIES, COUPLETS, ALL_RHYME_WORDS, ALL_COUPLET_WORDS, artKeyFor } = await import('./data/rhymes.js');
    const { hasWordArt } = await import('./js/wordart.js');
    const needArt = [...ALL_RHYME_WORDS, ...ALL_COUPLET_WORDS.map(artKeyFor)];
    return {
      fams: RHYME_FAMILIES.map(f => ({ key: f.key, label: f.label, members: f.members, nearMiss: f.nearMiss, spellingOdd: f.spellingOdd || null })),
      couplets: COUPLETS.map(c => ({ lines: c.lines, answer: c.answer })),
      noArt: needArt.filter(w => !hasWordArt(w))
    };
  });
  // the brief's own lists, in the brief's own order
  const AUTHORED = [
    ['-at', ['cat', 'hat', 'mat', 'bat', 'rat', 'flat']],
    ['-og', ['dog', 'log', 'frog', 'jog', 'fog']],
    ['-ake', ['cake', 'lake', 'snake', 'rake', 'shake']],
    ['-ell', ['bell', 'shell', 'well', 'smell', 'spell']],
    ['-ing', ['king', 'ring', 'sing', 'wing', 'string']],
    ['-ight', ['light', 'night', 'bright', 'kite', 'right']],
    ['-ar', ['star', 'car', 'jar', 'far', 'guitar']],
    ['-oon', ['moon', 'spoon', 'balloon', 'cartoon']],
    ['-ug', ['bug', 'mug', 'rug', 'hug', 'plug']],
    ['-op', ['shop', 'stop', 'mop', 'drop', 'hop']]
  ];
  assert(r.fams.length === 10, `all ten families (got ${r.fams.length})`);
  const wrong = AUTHORED.filter(([label, ws], i) => !r.fams[i] || r.fams[i].label !== label || r.fams[i].members.join('|') !== ws.join('|'));
  assert(wrong.length === 0, 'every family and every member matches the brief exactly' + (wrong.length ? ' — ' + wrong.map(w => w[0]).join(',') : ''));
  assert(r.fams.find(f => f.key === 'ight').members.includes('kite'), 'the authored kite card is still in the -ight family');
  assert(r.fams.find(f => f.key === 'ight').spellingOdd === 'kite', 'and is marked as the family\'s spelling odd-one-out');
  assert(r.noArt.length === 0, 'every family word, near-miss and couplet option has a picture');
  await ctx.close();
}

// ---- 2. families rhyme by PRONUNCIATION; near-misses never do -------------------------
console.log('== 2. rhyme by pronunciation, and no near-miss rhymes ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { RHYME_FAMILIES, rhymersOf, rhymeKeyOf, rhymesTogether } = await import('./data/rhymes.js');
    return {
      pairs: RHYME_FAMILIES.map(f => ({ key: f.key, members: rhymersOf(f) })),
      nearMissRhymes: RHYME_FAMILIES.filter(f => rhymeKeyOf(f.nearMiss) === f.key).map(f => f.nearMiss),
      nearMissAnyFamily: RHYME_FAMILIES.filter(f => rhymeKeyOf(f.nearMiss)).map(f => f.nearMiss),
      crossFamily: RHYME_FAMILIES.flatMap(a => RHYME_FAMILIES.filter(b => b.key !== a.key)
        .flatMap(b => rhymersOf(a).flatMap(x => rhymersOf(b).filter(y => rhymesTogether(x, y)).map(y => x + '/' + y))))
    };
  });
  // The pronounced rime of each family, written out. A member rhymes if it ENDS in that
  // rime's sound — checked against the spelling that produces it, so "guitar" (ar) and
  // "kite" (the /ite/ sound spelled with a split digraph) are both handled honestly.
  const RIME_SPELLINGS = {
    at: ['at'], og: ['og'], ake: ['ake'], ell: ['ell'], ing: ['ing'],
    ight: ['ight', 'ite'], ar: ['ar'], oon: ['oon'], ug: ['ug'], op: ['op']
  };
  const badRime = [];
  for (const f of r.pairs) for (const m of f.members) {
    if (!RIME_SPELLINGS[f.key].some(sp => m.endsWith(sp))) badRime.push(f.key + '/' + m);
  }
  assert(badRime.length === 0, 'every member ends in its family\'s pronounced rime' + (badRime.length ? ': ' + badRime.join(',') : ''));
  assert(r.pairs.find(f => f.key === 'ight').members.includes('kite'), 'kite counts as a rhyme — because /kaɪt/ really does rhyme with /laɪt/');
  assert(r.nearMissRhymes.length === 0, 'no near-miss rhymes with its own family');
  assert(r.nearMissAnyFamily.length === 0, 'and no near-miss rhymes with any family at all');
  assert(r.crossFamily.length === 0, 'no two families secretly rhyme with each other');
  await ctx.close();
}

// ---- 3. couplets scan, and their answers are unambiguous ------------------------------
console.log('== 3. the six couplets: verbatim, scanning, one possible answer ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { COUPLETS, rhymesTogether, rhymeKeyOf } = await import('./data/rhymes.js');
    const lastWord = (l) => (l.trim().replace(/[^A-Za-z' ]/g, '').split(/\s+/).pop() || '').toLowerCase();
    return COUPLETS.map(c => ({
      lines: c.lines, answer: c.answer, decoys: c.decoys,
      cue: lastWord(c.lines[0]),
      answerRhymesCue: rhymesTogether(c.answer, lastWord(c.lines[0])) || rhymeKeyOf(c.answer) === null,
      decoyRhymes: c.decoys.filter(d => rhymesTogether(d, c.answer)),
      gap: /_+$/.test(c.lines[1])
    }));
  });
  const AUTHORED = [
    ['A little Boo sat on a log,', 'and made a friend who was a ___', 'frog'],
    ['The moon came up, the sky went dark,', 'the Boos all danced around the ___', 'park'],
    ['I found a shell beside the sea,', 'I put it in my pocket for ___', 'me'],
    ['The band played loud, the drums went bang,', 'and every single Boo just ___', 'sang'],
    ['A sleepy Boo went up to bed,', 'and rested down her fluffy ___', 'head'],
    ['We baked a great enormous cake,', 'then took it swimming in the ___', 'lake']
  ];
  assert(r.length === 6, 'all six couplets');
  const wrong = AUTHORED.filter((a, i) => !r[i] || r[i].lines[0] !== a[0] || r[i].lines[1] !== a[1] || r[i].answer !== a[2]);
  assert(wrong.length === 0, 'every couplet and its answer is verbatim from the pack' + (wrong.length ? ' — ' + wrong.map(w => w[2]).join(',') : ''));
  assert(r.every(c => c.gap), 'every couplet ends on the gap the child fills');
  // "scan" = the answer really does rhyme with the end of line one
  const RHYME_WITH_CUE = { frog: 'log', park: 'dark', me: 'sea', sang: 'bang', head: 'bed', lake: 'cake' };
  const scans = r.filter(c => RHYME_WITH_CUE[c.answer] === c.cue);
  assert(scans.length === 6, `every couplet's answer rhymes with the end of its first line (${r.map(c => c.answer + '/' + c.cue).join(', ')})`);
  const ambiguous = r.filter(c => c.decoyRhymes.length);
  assert(ambiguous.length === 0, 'no decoy also rhymes — every couplet has exactly one possible ending');
  await ctx.close();
}

// ---- 4. 400 generated rounds: two answers, never a third, near-miss present at level 2 -
console.log('== 4. the round rules, over 400 generated rounds ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { buildRhymeRound } = await import('./js/games/rhymetime.js');
    const { rhymesTogether, rhymeKeyOf } = await import('./data/rhymes.js');
    const bad = { size: 0, correct: 0, extraRhyme: 0, noNearMiss: 0, targetShown: 0 };
    let n = 0, withNearMiss = 0;
    for (let i = 0; i < 200; i++) for (const level of [1, 2]) {
      for (const t of buildRhymeRound(level, 8)) {
        n++;
        if (t.cards.length !== 4) bad.size++;
        if (t.correct.length !== 2) bad.correct++;
        if (t.cards.includes(t.target)) bad.targetShown++;
        for (const w of t.cards) {
          if (t.correct.includes(w)) continue;
          if (rhymesTogether(w, t.target)) bad.extraRhyme++;   // a third right answer
        }
        if (level === 2) { if (!t.cards.includes(t.nearMiss)) bad.noNearMiss++; else withNearMiss++; }
      }
    }
    return { ...bad, n, withNearMiss };
  });
  assert(r.n >= 3000, `checked ${r.n} generated targets`);
  assert(r.size === 0, 'every target shows exactly four cards');
  assert(r.correct === 0, 'and exactly two of them rhyme');
  assert(r.extraRhyme === 0, 'no card outside the answer pair ever rhymes with the target');
  assert(r.targetShown === 0, 'the target word itself is never one of the cards');
  assert(r.noNearMiss === 0 && r.withNearMiss > 0, `level 2 always shows the family's near-miss (${r.withNearMiss} times)`);
  await ctx.close();
}

// ---- 5. the near-miss explains itself; the kite card tells the truth ------------------
console.log('== 5. tapping a near-miss, and tapping kite ==');
{
  const { ctx, page } = await open('rhymetime');
  await startLevel(page, 2);
  const t = await page.evaluate(() => window.__rhyme.target());
  await page.evaluate(() => window.__rhyme.tapNearMiss());
  await page.waitForTimeout(350);
  const r = await page.evaluate(() => ({ bubble: document.querySelector('.peek-bubble').textContent, collected: window.__rhyme.collected(), idx: window.__rhyme.state().idx }));
  assert(r.bubble.includes(t.nearMiss) && r.bubble.includes(t.target), `the guide says both words: "${r.bubble}"`);
  assert(r.bubble.includes('LOOKS'), 'and names the trick — it LOOKS like it belongs');
  assert(r.idx === 0, 'the round does not move on');
  assert(r.collected === 1, 'and the miss reaches the Tricky Pile');
  await page.screenshot({ path: SHOTS + '/near-miss.png' });
  await ctx.close();
}
{
  // the authored kite card: tapping it must be RIGHT, and must be explained
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { buildRhymeTarget } = await import('./js/games/rhymetime.js');
    let sawKiteAsAnswer = false, sawKiteAsDecoy = false;
    for (let i = 0; i < 300; i++) {
      const t = buildRhymeTarget('ight', 2);
      if (t.correct.includes('kite')) sawKiteAsAnswer = true;
      if (t.cards.includes('kite') && !t.correct.includes('kite') && t.target !== 'kite') sawKiteAsDecoy = true;
    }
    return { sawKiteAsAnswer, sawKiteAsDecoy };
  });
  assert(r.sawKiteAsAnswer, 'kite is offered as a correct rhyme in the -ight family');
  assert(!r.sawKiteAsDecoy, 'and is never shown as a wrong answer — the game never tells a child kite does not rhyme with light');
  await ctx.close();
}

// ---- 6. a couplet plays end to end, spoken and pictured -------------------------------
console.log('== 6. level 3 plays, spoken and pictured ==');
{
  const { ctx, page } = await open('rhymetime', {}, { voice: true });
  await startLevel(page, 3);
  await page.evaluate(() => { window.__said = []; window.speechSynthesis.speak = (u) => { window.__said.push(String(u.text)); if (u.onend) setTimeout(() => u.onend(), 0); }; });
  const t = await page.evaluate(() => window.__rhyme.target());
  const cards = await page.evaluate(() => [...document.querySelectorAll('.rt-card')].map(n => ({ word: n.getAttribute('aria-label'), pic: !!n.querySelector('svg'), label: (n.querySelector('.rt-cardword') || {}).textContent })));
  assert(cards.length === 3, 'three options for the couplet');
  assert(cards.every(c => c.pic && c.label === c.word), 'each one is a picture with its word beneath it');
  await page.evaluate(() => document.querySelector('.ss-say').click());
  // The click's own request correctly QUEUES behind the round-start line (spoken by the
  // real engine a moment ago, before the stub above replaced it) rather than interrupting
  // it — tts.js is an intentional FIFO, and a couplet takes several real seconds. Wait for
  // the line to actually arrive rather than assuming a quarter of a second is enough; the
  // claim under test is "read aloud on demand", not "read aloud within 250ms".
  await page.waitForFunction(() => window.__said && window.__said.length > 0, null, { timeout: 8000 });
  const said = await page.evaluate(() => window.__said.slice());
  assert(said.some(s => s.includes(t.lines[0].replace(',', '').split(' ')[0])), `the couplet is read aloud on demand: "${(said[0] || '').slice(0, 60)}…"`);
  await page.evaluate(() => window.__rhyme.tapCorrect());
  await page.waitForTimeout(400);
  const gap = await page.evaluate(() => window.__rhyme.gapText());
  assert(gap === t.answer, `the chosen word lands in the gap ("${gap}")`);
  await page.screenshot({ path: SHOTS + '/couplet-filled.png' });
  await ctx.close();
}

// ---- 7. a whole level-1 round, sound off, then the star type -------------------------
console.log('== 7. a full round with sound off, and Word Stars ==');
{
  const { ctx, page } = await open('rhymetime');
  await startLevel(page, 1);
  // Drive the round on its own state, not on a stopwatch: solve, wait for the target
  // counter to tick, solve the next. A fixed sleep here is exactly the kind of timing
  // assumption that turns into a flake under load.
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction(n => window.__rhyme && window.__rhyme.state().renders === n && window.__rhyme.state().solved === n - 1, i + 1, { timeout: 15000 });
    await page.evaluate(() => window.__rhyme.solveTarget());
  }
  await page.waitForSelector('.screen.results', { timeout: 25000 });
  await page.waitForTimeout(300);
  const done = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { stars: document.querySelectorAll('.screen.results .rstar').length, word: ((s.stars || {}).byType || {}).word || 0 };
  });
  assert(done.stars === 3, 'an eight-target round completes with sound off and reaches results');
  assert(done.word > 0, `and banks Word Stars (byType.word = ${done.word})`);
  await ctx.close();
}
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { INTRO_SCRIPTS } = await import('./js/intro.js');
    const { starTypeFor } = await import('./data/startypes.js');
    return { steps: (INTRO_SCRIPTS.rhymetime || []).length, words: (INTRO_SCRIPTS.rhymetime || []).map(s => s.text.split(/\s+/).length), type: starTypeFor('rhymetime') };
  });
  assert(r.steps === 3 && r.words.every(n => n <= 12), 'a three-step intro, every step under twelve words');
  assert(r.type === 'word', 'Rhyme Time credits Word Stars');
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
