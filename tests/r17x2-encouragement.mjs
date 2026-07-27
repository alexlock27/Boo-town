// tests/r17x2-encouragement.mjs — RUN17 X2: kind words woven through.
//
// The assertions X2 names: the caps hold across a simulated week of play; no line fires
// after a three-star comfortable round; the effort-not-ability rule holds; every line goes
// through the guide speech path and obeys the mutes.
//
// The effort-not-ability rule is checked by MACHINE here as well as by the review
// checklist in PROGRESS.md, because it is the one rule in this pack that a well-meaning
// future edit would break without noticing ("you're so clever!" feels kind).
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { LINES } from '../data/guideLines.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run17/x2';
mkdirSync(SHOTS, { recursive: true });

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const skip = (m) => console.log('  ~ SKIP:', m);

const EFFORT = LINES.encourageEffort || [];
const HARD = LINES.encourageHardRound || [];

// ---- 1. the pack, transcribed exactly -------------------------------------------------
console.log('== the 48 lines are CONTENT_WARMTH.md, character for character ==');
assert(EFFORT.length === 40, `X2a: 40 general encouragement lines (${EFFORT.length})`);
assert(HARD.length === 8, `X2b: 8 after-a-hard-round lines (${HARD.length})`);

const PACK = 'CONTENT_WARMTH.md';
if (!existsSync(PACK)) {
  skip(`${PACK} is not in this checkout (it is a gitignored planning doc) — the exact-transcription diff did not run`);
} else {
  const lines = readFileSync(PACK, 'utf8').split(/\r?\n/);
  const grab = (heading) => {
    const start = lines.findIndex(l => l.startsWith('## ' + heading));
    if (start < 0) return [];
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      const m = lines[i].match(/^(\d+)\.\s+(.*?)\s*$/);
      if (m) out.push(m[2]);
    }
    return out;
  };
  const a = grab('X2a'), b = grab('X2b');
  assert(a.length === 40 && b.length === 8, `the pack itself holds 40 + 8 lines (${a.length} + ${b.length})`);
  let drift = 0;
  a.forEach((t, i) => { if (t !== EFFORT[i]) { drift++; console.log(`   X2a #${i + 1}\n     pack: ${JSON.stringify(t)}\n     impl: ${JSON.stringify(EFFORT[i])}`); } });
  b.forEach((t, i) => { if (t !== HARD[i]) { drift++; console.log(`   X2b #${i + 1}\n     pack: ${JSON.stringify(t)}\n     impl: ${JSON.stringify(HARD[i])}`); } });
  assert(drift === 0, `every line matches the authored pack exactly (${drift} drifted)`);
}

// ---- 2. the effort-not-ability rule, machine-checked -----------------------------------
console.log('== every line praises effort, choice or persistence — never ability ==');
// Ability words. "Brilliant" and "Ace" are deliberately NOT here: in these lines they
// land on the ACT ("You didn't give up. Brilliant."), which is the whole point.
const ABILITY = /\b(clever|smart|brainy|genius|talented|gifted|intelligent|bright one|a natural|so good at|best at)\b/i;
const COMPARES = /\b(than (anyone|anybody|everyone|the others|her|him|them)|better than|the best|top of|beat(?:s)? (everyone|anyone))\b/i;
const COUNTS = /(\d|\bstreak\b|\bin a row\b|\bpoints?\b|\bscore[sd]?\b|\bperfect\b|\bstars?\b)/i;
// "Implies it was easy" is about the CLAIM, not the word. "Not an easy round, that" is an
// X2b line doing exactly its job, so a bare /easy/ would condemn the honesty the pack was
// written for. Match the offending shapes instead.
const EASY = /\b(?:that|it|this)(?:'s| was| is)\s+(?:so\s+|really\s+|dead\s+)?(?:easy|simple)\b|\beasy peasy\b|\bshould(?:'ve| have)?\s+been\s+easy\b|\bobviously\b|\bof course you\b/i;

const all = [...EFFORT, ...HARD];
const badAbility = all.filter(l => ABILITY.test(l));
const badCompare = all.filter(l => COMPARES.test(l));
const badCounts = all.filter(l => COUNTS.test(l));
const badEasy = all.filter(l => EASY.test(l));
if (badAbility.length) badAbility.forEach(l => console.log('   ability:', l));
if (badCompare.length) badCompare.forEach(l => console.log('   compares:', l));
if (badCounts.length) badCounts.forEach(l => console.log('   number/streak/score:', l));
if (badEasy.length) badEasy.forEach(l => console.log('   implies it was easy:', l));
assert(badAbility.length === 0, `no line praises ability (${badAbility.length})`);
assert(badCompare.length === 0, `no line compares her to anyone (${badCompare.length})`);
assert(badCounts.length === 0, `no line mentions a streak, a number or a score (${badCounts.length})`);
assert(badEasy.length === 0, `no line implies she should have found it easy (${badEasy.length})`);
assert(new Set(all).size === all.length, 'all 48 lines are distinct');
// the guard must actually bite, or it proves nothing
assert(ABILITY.test("You're so clever!") && COMPARES.test('better than anyone') && COUNTS.test('3 in a row!') && EASY.test('That was easy!'),
  'the rule guards still catch a known offender (self-check)');
// ...and must NOT condemn the honest naming of difficulty the X2b lines are built on
assert(!EASY.test('Not an easy round, that. You kept going.') && !EASY.test('Hard ones are hard. You did it anyway.'),
  'the "implies it was easy" guard leaves honest difficulty-naming alone (self-check)');

// The hard-round lines must NAME the difficulty — that is their whole job.
const NAMES_HARD = /\b(hard|tricky|tough|stretch|challenge|difficult|not an easy)\b/i;
assert(HARD.every(l => NAMES_HARD.test(l)), 'every after-a-hard-round line names the difficulty honestly');

// ---- 3. in the browser: the caps ------------------------------------------------------
const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (extra = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1 }, stars: { total: 40, byGame: {} }, trophies: {}, boxes: 0, journal: {},
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 40, introSeen: {} },
  settings: { sound: true, music: false, voice: true, content: 'medium' },
  ...extra
});

const browser = await chromium.launch({ args: RESOLVE });
async function open(saveJson = save(), viewport = { width: 1024, height: 768 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), saveJson);
  await page.addInitScript(() => {
    window.__spoken = [];
    const install = () => {
      if (!window.speechSynthesis) return false;
      window.speechSynthesis.speak = (u) => { window.__spoken.push(u && u.text); };
      return true;
    };
    if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  return { ctx, page };
}

console.log('== a simulated week of play: the caps hold every day ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => import('./js/encouragement.js'));
  await page.waitForFunction(() => window.__encouragement, null, { timeout: 10000 });
  const week = await page.evaluate(() => {
    const E = window.__encouragement;
    const days = [];
    for (let d = 0; d < 7; d++) {
      E.reset();                       // a new day is a new session
      const fired = [];
      // a busy day: she comes back, plays a dozen rounds of every shape, rescues a pile,
      // and plays long enough for the session-pause moment too.
      const moments = [
        ['returning', {}],
        ['firstTry', { stars: 1 }], ['hardRound', { stars: 1 }], ['firstTry', { stars: 2 }],
        ['rescue', {}], ['hardRound', { stars: 1 }], ['firstTry', { stars: 1 }],
        ['longSession', {}], ['rescue', {}], ['hardRound', { stars: 1 }],
        ['firstTry', { stars: 2 }], ['rescue', {}], ['returning', {}], ['longSession', {}]
      ];
      const timeline = [];
      for (const [m, o] of moments) {
        const line = E.tryFor(m, o);
        timeline.push({ moment: m, line });
        if (line) fired.push({ moment: m, line });
      }
      days.push({ fired, timeline });
    }
    return days;
  });

  let capOk = true, rowOk = true, onceOk = true, poolOk = true;
  week.forEach((d, i) => {
    if (d.fired.length > 3) { capOk = false; console.log(`   day ${i + 1}: ${d.fired.length} lines fired`); }
    // never two in a row: no two CONSECUTIVE entries in the timeline both fired
    for (let k = 1; k < d.timeline.length; k++) {
      if (d.timeline[k].line && d.timeline[k - 1].line) { rowOk = false; console.log(`   day ${i + 1}: two in a row at ${k}`); }
    }
    for (const m of ['returning', 'longSession']) {
      if (d.fired.filter(f => f.moment === m).length > 1) { onceOk = false; console.log(`   day ${i + 1}: "${m}" fired more than once`); }
    }
    for (const f of d.fired) {
      const inHard = HARD.includes(f.line), inEffort = EFFORT.includes(f.line);
      const want = f.moment === 'hardRound' ? inHard : inEffort;
      if (!want) { poolOk = false; console.log(`   day ${i + 1}: "${f.moment}" said a line from the wrong pool: ${f.line}`); }
    }
  });
  const total = week.reduce((n, d) => n + d.fired.length, 0);
  assert(capOk, `never more than three kind words in any of the seven sessions (${total} across the week)`);
  assert(rowOk, 'never two kind words in a row');
  assert(onceOk, 'the once-per-session moments fired at most once each, every day');
  assert(poolOk, 'the hard-round moment draws from X2b; every other moment draws from X2a');
  assert(total > 0, `the week was not simply silent (${total} kind words over seven days)`);
  await ctx.close();
}

console.log('== a round she aced never gets a kind word ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => import('./js/encouragement.js'));
  await page.waitForFunction(() => window.__encouragement, null, { timeout: 10000 });
  const r = await page.evaluate(() => {
    const E = window.__encouragement;
    const out = {};
    E.reset(); out.aced3 = E.tryFor('firstTry', { stars: 3 });
    E.reset(); out.acedHard = E.tryFor('hardRound', { stars: 3 });
    E.reset(); out.oneStar = E.tryFor('firstTry', { stars: 1 });
    return out;
  });
  assert(r.aced3 === '', 'a three-star round says nothing (that would read as pity)');
  assert(r.acedHard === '', 'even a three-star above-comfort round says nothing');
  assert(r.oneStar !== '', 'a one-star first try still gets a kind word');
  await ctx.close();
}

console.log('== the whole thing goes through the guide speech path and obeys the voice mute ==');
{
  // voice ON: the line is spoken
  const { ctx, page } = await open();
  const on = await page.evaluate(async () => {
    const { encouragementFor } = await import('./js/encouragement.js');
    const { speakMaybe } = await import('./js/guide.js');
    window.__spoken.length = 0;
    const line = encouragementFor('firstTry', { stars: 1 });
    speakMaybe(line);
    return { line, spoken: window.__spoken.slice() };
  });
  assert(on.line && on.spoken.includes(on.line), 'with voice on, a kind word is spoken');
  await ctx.close();

  // voice OFF: nothing is spoken
  const { ctx: c2, page: p2 } = await open(save({ settings: { sound: true, music: false, voice: false, content: 'medium' } }));
  const off = await p2.evaluate(async () => {
    const { encouragementFor } = await import('./js/encouragement.js');
    const { speakMaybe } = await import('./js/guide.js');
    window.__spoken.length = 0;
    const line = encouragementFor('firstTry', { stars: 1 });
    speakMaybe(line);
    return { line, spoken: window.__spoken.slice() };
  });
  assert(off.line !== '', 'the line is still chosen with voice off (it is shown, not lost)');
  assert(off.spoken.length === 0, 'with voice off, nothing is spoken');
  await c2.close();
}

console.log('== "returning after a break" counts whole days from the last round played ==');
{
  const { ctx, page } = await open(save({ seen: { trophyRetro: true, lastStarsShown: 40, introSeen: {}, lastPlayDay: '2026-07-20' } }));
  const r = await page.evaluate(async () => {
    await import('./js/encouragement.js');
    const E = window.__encouragement;
    return {
      same: E.daysAway('2026-07-20'), one: E.daysAway('2026-07-21'),
      two: E.daysAway('2026-07-22'), five: E.daysAway('2026-07-25'),
      backAtOne: E.returningAfterBreak('2026-07-21'),
      backAtTwo: E.returningAfterBreak('2026-07-22')
    };
  });
  assert(r.same === 0 && r.one === 1 && r.two === 2 && r.five === 5, `whole days counted correctly (${r.same}/${r.one}/${r.two}/${r.five})`);
  assert(r.backAtOne === false, 'one day away is not "a break"');
  assert(r.backAtTwo === true, 'two days away is');
  await ctx.close();
}

console.log('== a never-played save is not greeted as "coming back" ==');
{
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    await import('./js/encouragement.js');
    return window.__encouragement.returningAfterBreak('2030-01-01');
  });
  assert(r === false, 'a save that has never finished a round is not "returning after a break"');
  await ctx.close();
}

console.log('== the results screen shows a kind word on a hard round, and none on an aced one ==');
{
  // an above-comfort round scoring one star: the hard-round moment
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 1, cat: 'tables', level: 3 }));
  await page.waitForTimeout(2600);
  const hard = await page.evaluate(() => ({
    node: document.querySelector('.result-encourage') ? document.querySelector('.result-encourage').textContent : null,
    spoken: window.__spoken.slice()
  }));
  assert(hard.node && (HARD.includes(hard.node) || EFFORT.includes(hard.node)),
    `a kind word appears on the results screen ("${hard.node}")`);
  assert(hard.node && hard.spoken.includes(hard.node), 'and it is spoken');
  await page.screenshot({ path: `${SHOTS}/results-kind-1024.png` });
  await ctx.close();

  // a three-star round: nothing, ever
  const { ctx: c2, page: p2 } = await open();
  await p2.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 3, cat: 'tables', level: 1 }));
  await p2.waitForTimeout(2600);
  const aced = await p2.evaluate(() => !!document.querySelector('.result-encourage'));
  assert(aced === false, 'a three-star round shows no kind word at all');
  await c2.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
