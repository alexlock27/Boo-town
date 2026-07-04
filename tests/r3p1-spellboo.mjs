// tests/r3p1-spellboo.mjs — RUN3 phase 1: Spell Boo integrity + Sound Twins + Tricky Sounds.
// Covers RUN3 part D checks 5 (auto-look/peek-as-hint/2-star cap/voice-off completable),
// 6 (Sound Twins wrong-pick->explain->spell; sets present; sentences exact), 7 (Tricky Sounds 24 words).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, spellingMastery: {}, settings: { sound: false, music: false, voice: false }, seen: {} };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// ---- D7: Tricky Sounds bank present with all 24 words ----
console.log('== D7: Tricky Sounds th bank ==');
const th = await page.evaluate(async () => {
  const { BANKS } = await import('./data/spellingBanks.js');
  const b = BANKS.find(x => x.id === 'trickyTh');
  return b ? { name: b.name, words: b.words.map(w => w.w), tiers: [...new Set(b.words.map(w => w.t))] } : null;
});
const TH_EXPECT = ['with', 'this', 'that', 'then', 'them', 'than', 'they', 'both', 'bath', 'path', 'teeth', 'three', 'think', 'thank', 'thing', 'month', 'mother', 'father', 'brother', 'other', 'another', 'together', 'birthday', 'Thursday'];
assert(th && th.words.length === 24, 'Tricky Sounds bank has 24 words (' + (th ? th.words.length : 'missing') + ')');
assert(th && JSON.stringify(th.words) === JSON.stringify(TH_EXPECT), 'Tricky Sounds words match the spec list exactly');
assert(th && th.tiers.length === 1 && th.tiers[0] === 1, 'Tricky Sounds is tier 1');

// ---- D6: Sound Twins content — all sets present, sentences EXACT vs EXPANSION_1 ----
console.log('== D6: Sound Twins content ==');
const twin = await page.evaluate(async () => {
  const m = await import('./data/soundTwins.js');
  const flat = {}; m.TWIN_SETS.forEach(s => flat[s.id] = { level: s.level, options: s.options, items: s.items });
  return { ids: m.TWIN_SETS.map(s => s.id), flat, explainKeys: Object.keys(m.TWIN_EXPLAIN) };
});
const EXPECT_SETS = ['theirThereTheyre', 'toTooTwo', 'hearHere', 'whoseWhos', 'whetherWeather', 'peacePiece', 'plainPlane', 'brakeBreak', 'greatGrate', 'meetMeat', 'mailMale', 'acceptExcept', 'affectEffect'];
assert(EXPECT_SETS.every(id => twin.ids.includes(id)), 'all listed Sound Twins sets present (' + twin.ids.length + ')');
assert(twin.flat.acceptExcept.level === 3 && twin.flat.affectEffect.level === 3, 'accept/except and affect/effect are level 3');
// spot-check exact sentences from EXPANSION_1 §26/§27/§3.1
const S = twin.flat;
assert(S.theirThereTheyre.items.some(i => i.s === '___ dog is called Max' && i.a === 'their'), '§26 "___ dog is called Max" (their) exact');
assert(S.theirThereTheyre.items.some(i => i.s === '___ late for school!' && i.a === "they're"), "§26 \"___ late for school!\" (they're) exact");
assert(S.toTooTwo.items.some(i => i.s === '___ plus one is three' && i.a === 'two'), '§27 "___ plus one is three" (two) exact');
assert(S.peacePiece.items.some(i => i.s === 'I ate the last ___ of cake' && i.a === 'piece'), '§3.1 "I ate the last ___ of cake" (piece) exact');
assert(S.affectEffect.items.some(i => i.s === 'The medicine had a good ___' && i.a === 'effect'), '§3.1 "The medicine had a good ___" (effect) exact');
assert(twin.flat.theirThereTheyre.items.length === 9 && twin.flat.toTooTwo.items.length === 9, 'triples carry all 9 sentences each');

// ---- D5: auto-look, peek-as-hint, 2-star cap, voice-off completable ----
console.log('== D5: auto-look + peek-as-hint + voice-off ==');
async function enterNormal(setName, level = 1) {
  await page.evaluate(() => window.BooTown.go('spellboo'));
  await page.waitForSelector('.picker');
  await page.click(`.picker-choice:has-text("${setName}")`);
  await page.click(`.picker-levels .level-btn >> nth=${level - 1}`);
  await page.waitForSelector('.spell-area');
  await page.waitForTimeout(60);
}
await enterNormal('Th Words', 1);   // RUN4 C2 friendly name (id trickyTh unchanged)
// auto-look: the word is visible immediately (once), then hidden after ~2s
const lookNow = await page.evaluate(() => window.__spell.peekVisible());
await page.waitForTimeout(2200);
const lookGone = await page.evaluate(() => window.__spell.peekVisible());
assert(lookNow === true && lookGone === false, 'auto-look shows the word once, then hides it (free look)');

// peek-as-hint bumps the hint counter and caps stars at 2 even on a clean spell
await page.evaluate(() => window.__spell.peekHint());
const afterPeek = await page.evaluate(() => window.__spell.state().hintsUsed);
assert(afterPeek === 1, 'pressing Peek after auto-look registers as a hint (hintsUsed=1)');

// complete the whole round correctly (voice off), spelling every word from the tray
let guard = 0;
while (guard++ < 20) {
  const done = await page.$('.result-card');
  if (done) break;
  await page.evaluate(() => window.__spell.typeCorrect());
  await page.waitForTimeout(1650);
}
await page.waitForSelector('.result-card', { timeout: 4000 });
await page.waitForTimeout(2400); // let stars animate in one by one
const stars = await page.$$eval('.rstar.pop', e => e.length);
assert(stars <= 2 && stars >= 1, 'a round with a peek-hint caps at 2 stars (' + stars + ')');
assert(true, 'voice-off round completed end to end to results');
await page.waitForSelector('.result-btns .btn.soft');
await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub');

// ---- D6 behaviour: wrong twin pick -> explanation -> must spell the correct twin ----
console.log('== D6: Sound Twins wrong-pick flow ==');
await page.evaluate(() => window.BooTown.go('spellboo'));
await page.waitForSelector('.picker');
await page.click('.picker-choice:has-text("Sound Twins")');
await page.click('.picker-levels .level-btn >> nth=0'); // level 1
await page.waitForSelector('.twin-options');
const item0 = await page.evaluate(() => ({ answer: window.__spell.item().answer, options: window.__spell.options() }));
const wrongOpt = item0.options.find(o => o !== item0.answer);
await page.evaluate((w) => window.__spell.pick(w), wrongOpt);
await page.waitForTimeout(200);
const explained = await page.evaluate(() => ({ phaseSoon: window.__spell.phase(), explain: document.querySelector('.twin-explain').textContent, explVisible: getComputedStyle(document.querySelector('.twin-explain')).display !== 'none', wrong: window.__spell.state().wrong }));
assert(explained.explVisible && explained.explain.length > 5, 'a wrong twin pick shows the one-line explanation of the right twin');
assert(explained.wrong >= 1, 'the wrong pick is recorded (affects stars)');
await page.waitForTimeout(1600);
await page.waitForSelector('.spell-area .tile', { timeout: 3000 });
const spellingPhase = await page.evaluate(() => window.__spell.phase());
assert(spellingPhase === 'spell', 'after the explanation she must spell the correct twin from memory (buttons hidden)');
// spell it and confirm it advances to a fresh twin item (buttons back)
await page.evaluate(() => window.__spell.typeCorrect());
await page.waitForFunction(() => window.__spell.state().idx >= 1 && window.__spell.phase() === 'pick' && document.querySelectorAll('.twin-opt').length === 3, { timeout: 5000 });
const advanced = await page.evaluate(() => window.__spell.state().idx);
assert(advanced >= 1, 'spelling the correct twin advances to the next item');

// right first pick -> straight to spelling (no explanation)
await page.evaluate(() => window.__spell.pick(window.__spell.item().answer));
await page.waitForTimeout(250);
const rightFlow = await page.evaluate(() => ({ phase: window.__spell.phase(), explVisible: getComputedStyle(document.querySelector('.twin-explain')).display !== 'none' }));
assert(rightFlow.phase === 'spell' && !rightFlow.explVisible, 'a correct first pick goes straight to tiles, no explanation');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
