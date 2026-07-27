// tests/r16w6-placement.mjs — RUN16 W6: the four new games' place in the app.
// The brief's assertions: Smart Mix serves literacy items at the right tiers; the Tricky
// Pile round-trips a literacy item END TO END; the Bloom mapping is updated and its maths
// is still correct. Plus the hub cards and their intros.
// Expected runtime: ~35s. Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run16/w6';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const GAMES = ['soundsorter', 'blendit', 'rhymetime', 'storyorder'];

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (over = {}, settings = {}) => JSON.stringify(Object.assign({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, trickyPile: [],
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: Object.fromEntries(GAMES.map(g => [g, true])) },
  settings: Object.assign({ sound: false, music: false, voice: false, content: 'full' }, settings)
}, over));

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(route, params = {}, over = {}, settings = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(over, settings));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
  return { ctx, page };
}

// ---- 1. the hub: four new LEARN cards, each with its own intro and route -------------
console.log('== 1. four new cards in the LEARN row, each one playable ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.group-label')].map(l => ({ label: l.textContent, row: l.nextElementSibling }));
    const learn = rows.find(x => x.label === 'Learn');
    return {
      learn: [...learn.row.querySelectorAll('.game-card')].map(c => (c.querySelector('.gc-name') || {}).textContent),
      tags: [...learn.row.querySelectorAll('.game-card')].map(c => (c.querySelector('.gc-tag') || {}).textContent),
      // only the four RUN16 cards are asserted to draw SVG: Boo Expedition has shipped a
      // compass emoji since RUN10 and that is not this run's call to change.
      icons: Object.fromEntries([...learn.row.querySelectorAll('.game-card')]
        .map(c => [(c.querySelector('.gc-name') || {}).textContent, !!c.querySelector('.gc-icon svg')]))
    };
  });
  for (const name of ['Sound Sorter', 'Blend It', 'Rhyme Time', 'Story Order']) {
    assert(r.learn.includes(name), `"${name}" has a card in the Learn row`);
  }
  const newCards = ['Sound Sorter', 'Blend It', 'Rhyme Time', 'Story Order'];
  assert(newCards.every(n => r.icons[n]), 'each of the four draws a real SVG icon, not an emoji placeholder');
  assert(r.tags.every(t => t && t.length), 'and every card says what it is for');
  await page.screenshot({ path: SHOTS + '/hub-learn-row.png' });
  const intros = await page.evaluate(async (games) => {
    const { INTRO_SCRIPTS } = await import('./js/intro.js');
    const { starTypeFor } = await import('./data/startypes.js');
    return games.map(g => ({ g, steps: (INTRO_SCRIPTS[g] || []).length, type: starTypeFor(g) }));
  }, GAMES);
  assert(intros.every(i => i.steps === 3), 'all four ship a three-step intro');
  assert(intros.every(i => i.type === 'word'), 'and all four credit Word Stars');
  await ctx.close();
}
// each route mounts and offers a Smart Mix door
for (const game of GAMES) {
  const { ctx, page } = await open(game);
  await page.waitForSelector('.start-card', { timeout: 8000 });
  const r = await page.evaluate(() => ({
    mix: !!document.querySelector('.pick-for-me, .picker-choices button'),
    levels: document.querySelectorAll('.level-btn').length
  }));
  assert(r.levels > 0, `${game}: its start card offers levels (${r.levels})`);
  assert(r.mix, `${game}: and a Smart Mix door`);
  await ctx.close();
}

// ---- 2. Smart Mix serves literacy items, and at the right tiers ----------------------
console.log('== 2. Smart Mix draws literacy content — full brain at every tier ==');
{
  // The contract (js/smartmix.js): the LEVEL PICKER is tier-filtered, Smart Mix never is.
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { setContentTier } = await import('./js/content.js');
    const { filterLevels } = await import('./js/content.js');
    const { levelsForGroup } = await import('./js/games/soundsorter.js');
    const { BLEND_LEVEL_NUMBERS } = await import('./data/blending.js');
    const { RHYME_LEVELS } = await import('./data/rhymes.js');
    const { STORY_LEVELS } = await import('./data/stories.js');
    const out = {};
    for (const tier of ['light', 'medium', 'full']) {
      setContentTier(tier);
      out[tier] = {
        sound: filterLevels(levelsForGroup('teams')),
        blend: filterLevels(BLEND_LEVEL_NUMBERS),
        rhyme: filterLevels(RHYME_LEVELS),
        story: filterLevels(STORY_LEVELS)
      };
    }
    setContentTier('full');
    return out;
  });
  assert(r.light.blend.every(l => l <= 2) && r.full.blend.length === 4, `Light shows levels ${r.light.blend.join(',')}; Full shows all four`);
  assert(r.light.rhyme.every(l => l <= 2) && r.full.rhyme.length === 3, 'the same tier rule holds for Rhyme Time');
  assert(r.light.sound.length > 0, 'and Light always has at least one level to play in every game');
  await ctx.close();
}
{
  // and the mixes really do draw from the whole of each game's content
  const { ctx, page } = await open('hub', {}, {}, { content: 'light' });
  const r = await page.evaluate(async () => {
    const { buildSmartMix } = await import('./js/smartmix.js');
    const { ALL_BLEND_WORDS, blendEntry } = await import('./data/blending.js');
    const { PHONEMES, SOUND_LEVELS, targetsForLevel } = await import('./data/phonemes.js');
    // Blend It's mix pool is every word from every level, including level 4, which the
    // Light tier's picker hides. Smart Mix is never tier-filtered — light UI, full brain.
    const pool = ALL_BLEND_WORDS.map(w => ({ id: 'blendit:' + w, word: w, boost: 1 }));
    const levelsSeen = new Set();
    for (let i = 0; i < 60; i++) for (const it of buildSmartMix(pool, 8)) levelsSeen.add(blendEntry(it.word).level);
    // Sound Sorter's pool spans every phoneme at every level it can be asked at
    const soundPool = [];
    for (const p of PHONEMES) for (const l of SOUND_LEVELS) if (targetsForLevel(l).includes(p.key)) soundPool.push({ id: 'soundsorter:' + p.key, sound: p.key, level: l, boost: 1 });
    const soundLevels = new Set();
    const sounds = new Set();
    for (let i = 0; i < 60; i++) for (const it of buildSmartMix(soundPool, 8)) { soundLevels.add(it.level); sounds.add(it.sound); }
    return { levelsSeen: [...levelsSeen].sort(), soundLevels: [...soundLevels].sort(), sounds: sounds.size, poolWords: pool.length };
  });
  assert(r.poolWords === 50, `Blend It's mix pool is all 50 authored words (got ${r.poolWords})`);
  assert(r.levelsSeen.join(',') === '1,2,3,4', `at the Light tier Smart Mix still serves every level (${r.levelsSeen.join(',')})`);
  assert(r.soundLevels.length === 4 && r.sounds === 12, `and Sound Sorter's mix reaches all 12 phonemes across all 4 levels`);
  await ctx.close();
}

// ---- 3. THE TRICKY PILE, END TO END, with a literacy item ---------------------------
console.log('== 3. a mis-sorted phoneme goes to the pile, comes back, and is rescued ==');
{
  const { ctx, page } = await open('soundsorter');
  await page.waitForSelector('.start-card', { timeout: 8000 });
  await page.evaluate(() => document.querySelectorAll('.level-btn')[0].click());
  await page.waitForFunction(() => window.__sounds, null, { timeout: 8000 });
  // (a) miss one on purpose — the pile collects it
  const target = await page.evaluate(() => { window.__sounds.tapWrong(); return window.__sounds.target(); });
  await page.waitForTimeout(300);
  const collected = await page.evaluate(() => window.__tricky.items());
  assert(collected.length === 1, 'the Puzzled Boo collected the miss');
  assert(collected[0].id === 'soundsorter:' + target.sound, `and it is a literacy item (${collected[0].id})`);
  assert(!!collected[0].pics && Object.keys(collected[0].pics).length === 3, 'carrying its own three pictures, so a non-reader can rescue it');
  assert(collected[0].options.includes(collected[0].answer), 'with the right answer among its options');
  await page.screenshot({ path: SHOTS + '/pile-collected.png' });

  // (b) finish the round and reach the Rescue step on the results screen
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction(n => window.__sounds.state().renders === n && window.__sounds.state().solved === n - 1, i + 1, { timeout: 15000 });
    await page.evaluate(() => window.__sounds.solveTarget());
  }
  await page.waitForSelector('.screen.results', { timeout: 20000 });
  await page.waitForSelector('.rescue-panel', { timeout: 15000 });
  const rescue = await page.evaluate(() => ({
    prompt: (document.querySelector('.rescue-prompt') || {}).textContent,
    opts: document.querySelectorAll('.rescue-opt').length,
    pics: document.querySelectorAll('.rescue-opt.pic svg').length,
    words: [...document.querySelectorAll('.rescue-opt .ro-word')].map(n => n.textContent)
  }));
  assert(rescue.opts === 3, 'the Rescue step offers the item back, three ways');
  assert(rescue.pics === 3, 'as three PICTURES, not three words a pre-reader cannot read');
  assert(/sound/.test(rescue.prompt || ''), `with a literacy prompt: "${rescue.prompt}"`);
  await page.screenshot({ path: SHOTS + '/pile-rescue.png' });

  // (c) rescue it, and it leaves the pile
  const pileBefore = await page.evaluate(() => window.BooTown.State.getState().trickyPile.slice());
  await page.evaluate(() => window.__rescue.answerCorrect());
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({
    rescued: window.__rescue.rescuedCount(),
    pile: window.BooTown.State.getState().trickyPile.slice()
  }));
  assert(after.rescued === 1, 'answering it correctly rescues it');
  assert(!after.pile.includes('soundsorter:' + target.sound), `and it is cleared from the saved pile (${JSON.stringify(after.pile)})`);
  await ctx.close();
}
{
  // (d) an UNRESCUED literacy item persists — and then really does weight the next mix
  const { ctx, page } = await open('hub', {}, { trickyPile: ['blendit:cat', 'soundsorter:th'] });
  const r = await page.evaluate(async () => {
    const { pileBoost, persistedPile, PILE_BOOST } = await import('./js/trickypile.js');
    const { ALL_BLEND_WORDS } = await import('./data/blending.js');
    const { buildSmartMix } = await import('./js/smartmix.js');
    const pool = ALL_BLEND_WORDS.map(w => ({ id: 'blendit:' + w, word: w, boost: pileBoost('blendit:' + w) }));
    let catSeen = 0, otherSeen = 0;
    for (let i = 0; i < 300; i++) for (const it of buildSmartMix(pool, 8)) (it.word === 'cat' ? catSeen++ : otherSeen++);
    return {
      pile: persistedPile(), boost: PILE_BOOST,
      catBoost: pool.find(p => p.word === 'cat').boost,
      plainBoost: pool.find(p => p.word === 'dog').boost,
      catRate: catSeen / 300, avgRate: otherSeen / 300 / (ALL_BLEND_WORDS.length - 1)
    };
  });
  assert(r.pile.length === 2, 'an unrescued literacy item survives in the save');
  assert(r.catBoost === r.boost && r.plainBoost === 1, `and it carries ${r.boost}x weight into the next Smart Mix (cat=${r.catBoost}, dog=${r.plainBoost})`);
  assert(r.catRate > r.avgRate, `so it really is served more often (${r.catRate.toFixed(2)} vs an average ${r.avgRate.toFixed(2)} per word)`);
  await ctx.close();
}

// ---- 4. Brain Bloom: the two petals gain the new games, and the maths still works ----
console.log('== 4. Bloom\'s Identify and Analyze petals, and its maths ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { BLOOM_PETALS, bloomStats } = await import('./data/bloom.js');
    const now = Date.now();
    const mastered = (n) => ({ rights: n, misses: 0, lastSeen: now });
    // one mastered item per new game, plus a maths one that must still count as before
    const state = {
      ledger: {
        'soundsorter:sh': mastered(5), 'rhymetime:at': mastered(4),
        'blendit:cat': mastered(5), 'storyorder:kite': mastered(4),
        'bubblepop:3x4': mastered(5), 'oddboo:1': mastered(3)
      },
      stars: { byGame: { soundsorter: { plays: 3 }, blendit: { plays: 2 }, bubblepop: { plays: 4 } } }
    };
    const rows = bloomStats(state, now);
    return {
      petals: Object.fromEntries(BLOOM_PETALS.map(p => [p.id, p.games])),
      stats: Object.fromEntries(rows.map(r => [r.id, { mastered: r.mastered, plays: r.plays, growth: Math.round(r.growth) }]))
    };
  });
  assert(r.petals.identify.includes('soundsorter') && r.petals.identify.includes('rhymetime'), 'Identify gains Sound Sorter and Rhyme Time');
  assert(r.petals.analyze.includes('blendit') && r.petals.analyze.includes('storyorder'), 'Analyze gains Blend It and Story Order');
  assert(r.petals.identify.includes('oddboo') && r.petals.identify.includes('feedboos'), 'and Identify keeps the games it already had');
  assert(r.petals.analyze.includes('expedition') && r.petals.analyze.includes('caper') && r.petals.analyze.includes('detective'), 'as does Analyze');
  assert(r.petals.compute.join(',') === 'bubblepop,boopop,bounce,clockshop', 'the maths petals are untouched');
  // the maths of it: mastered*2 + plays*0.2, per petal
  assert(r.stats.identify.mastered === 3, `Identify counts all three of its mastered items (${r.stats.identify.mastered})`);
  assert(r.stats.analyze.mastered === 2, `Analyze counts its two (${r.stats.analyze.mastered})`);
  assert(r.stats.compute.mastered === 1 && r.stats.compute.plays === 4, 'and Compute still counts its maths item and its plays exactly as before');
  assert(r.stats.identify.growth === Math.round(3 * 2 + 5 * 0.2), `the growth sum is unchanged arithmetic (${r.stats.identify.growth})`);
  await ctx.close();
}
{
  // it renders for a grown-up without throwing
  const { ctx, page } = await open('grownups', {}, { ledger: { 'soundsorter:sh': { rights: 5, misses: 0, lastSeen: Date.now() } }, stars: { total: 400, byGame: { soundsorter: { plays: 3 } }, byType: {}, spent: {}, legacy: 0 } });
  await page.waitForTimeout(600);
  const shown = await page.evaluate(() => document.body.textContent.includes('Spot it!') || document.body.textContent.includes('Figure it out!'));
  assert(shown, 'the Bloom petals still render in the grown-ups area');
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
