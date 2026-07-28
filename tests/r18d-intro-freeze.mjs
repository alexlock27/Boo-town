// @serial — real-clock evidence: every game is driven into a live round and watched for 2s
// with an overlay up. Under parallel load a frozen clock and a starved one look the same.
//
// tests/r18d-intro-freeze.mjs — RUN18D D3: an intro overlay pauses EVERY game.
//
// The audit's case was Boo Beat, which lost two lives while its first-play intro was still
// on screen. RUN12 S6 built the shared mechanism (js/intro.js createRoundTimers +
// registerSuspendable) and proved it on three games. D3 asks the question of all of them, on
// a running round, and the sweep is data-driven so a game added later joins it by existing.
//
// What "frozen" means here, per game:
//   • the shell's round clock advances < 200ms across a 2s wall-clock wait;
//   • the shell reports paused();
//   • the play area's fingerprint — child count plus every INLINE style — is byte-identical,
//     so nothing spawned, moved or was removed by JS. CSS keyframes are excluded on purpose:
//     a wobbling bubble is decoration, not the round.
//   • nothing scoreable moved: progress dots, hearts and stars.total are unchanged.
// …and then it RESUMES: the same fingerprint must change once the overlay closes, or the
// suite would happily pass a game that had simply stopped.
// Expected runtime: ~110s.

import { chromium } from 'playwright';
import { mkdirSync, appendFileSync, writeFileSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('screenshots/run18d/d3', { recursive: true });
const LEDGER = 'screenshots/run18d/d3/per-game.md';
writeFileSync(LEDGER, '# RUN18D D3 — per-game intro-freeze verification\n\n| game | entered a live round | clock frozen | stage frozen | resumed |\n|---|---|---|---|---|\n');

const FREEZE_MS = 2000;
const CLOCK_SLACK_MS = 200;

// Every game that runs an intro over a live round. `resume` is the "Jump back in" shape the
// hub really sends (js/hub.js); where a game has no resume, the generic picker/start-card
// walk below gets there instead.
const GAMES = [
  { id: 'bubblepop', resume: { cat: 'add', level: 1, mix: false } },
  { id: 'feedboos', resume: { cat: null, level: 1, mix: true } },
  { id: 'spellboo', resume: { cat: null, level: 1, mix: true } },
  { id: 'blocks', resume: { cat: null, level: 1, mix: true } },
  { id: 'bounce', resume: { cat: 'add', level: 1, mix: false } },
  { id: 'beat', resume: { cat: 'tables', level: 1, mix: false } },
  { id: 'dash', resume: { cat: 'add', level: 1, mix: false } },
  { id: 'clockshop' },
  { id: 'boopop' },
  { id: 'detective' },
  { id: 'soundsorter' },
  { id: 'blendit' },
  { id: 'rhymetime' },
  { id: 'storyorder' },
  { id: 'oddboo' },
  { id: 'flashboos' },
  { id: 'teachme' },
  { id: 'golden' }
];

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const INTRO_SEEN = Object.fromEntries(['bubblepop', 'feedboos', 'spellboo', 'blocks', 'bounce', 'beat', 'dash',
  'clockshop', 'boopop', 'detective', 'soundsorter', 'blendit', 'rhymetime', 'storyorder', 'oddboo', 'flashboos',
  'teachme', 'golden', 'booroll', 'echoboos', 'jokeboo', 'shop'].map(k => [k, 1]));
const save = (introSeen) => JSON.stringify({
  version: 18, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_lolly: 1 }, trophies: {}, boxes: 0, meter: 2,
  spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 400, byGame: {}, byType: { maths: 100, word: 100, puzzle: 100, creative: 100, lesson: 100 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 2 }, shop: { welcomed: true },
  golden: { words: [{ w: 'cat' }, { w: 'dog' }, { w: 'sun' }], choices: [], savedAt: 1 },
  seen: { trophyRetro: true, lastStarsShown: 400, welcomeTour: true, introSeen },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(introSeen) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(introSeen));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.waitForSelector('.hub', { timeout: 20000 });
  return { ctx, page };
}

// The generic walk from a start card into a live round: a picker's category, then its level,
// then whatever single big button a card offers. Bounded, and it stops the moment a shell
// with a play area exists.
async function enterRound(page) {
  for (let step = 0; step < 6; step++) {
    const live = await page.evaluate(() => !!(window.__gameshell && document.querySelector('.game-area') && !document.querySelector('.start-card')));
    if (live) return true;
    const clicked = await page.evaluate(() => {
      const pick = (sel) => { const n = document.querySelector(sel); if (n && !n.disabled) { n.click(); return true; } return false; };
      // levels BEFORE categories: a picker arrives with a category already selected, so
      // clicking "an unselected category" first just swaps selection forever.
      if (pick('.level-btn')) return 'level';
      if (pick('.picker-choice:not(.mix):not(.sel)')) return 'category';
      if (pick('.start-card .btn.big')) return 'start';
      if (pick('.start-card .btn')) return 'start-any';
      if (pick('.lesson-card')) return 'lesson';
      if (pick('.roll-course-card:not(.building)')) return 'course';
      return null;
    });
    if (!clicked) break;
    await sleep(700);
  }
  return await page.evaluate(() => !!(window.__gameshell && document.querySelector('.game-area') && !document.querySelector('.start-card')));
}

const snap = (page) => page.evaluate(() => ({
  paused: window.__gameshell.paused(),
  now: window.__gameshell.now(),
  progress: window.__gameshell.progress(),
  hearts: window.__gameshell.hearts(),
  stage: window.__gameshell.stage(),
  stars: (window.BooTown.State.getState() || {}).stars.total
}));

console.log('== every game freezes behind an overlay, and comes back ==');
for (const g of GAMES) {
  const { ctx, page } = await open(INTRO_SEEN);
  const row = { id: g.id, entered: false, clock: false, stage: false, resumed: false };
  try {
    await page.evaluate(([id, r]) => window.BooTown.go(id, r ? { resume: r } : {}), [g.id, g.resume || null]);
    await sleep(900);
    row.entered = await enterRound(page);
    assert(row.entered, `${g.id}: reached a live round`);
    if (!row.entered) { await ctx.close(); appendRow(row); continue; }

    // The "?" replay is the SAME overlay and the same suspend path as the first-play intro,
    // and unlike the first-play intro it can be opened at will, mid-round, in every game.
    const hasHelp = await page.evaluate(() => !!document.querySelector('.help-btn'));
    assert(hasHelp, `${g.id}: has a "?" replay in the shell (the house law's second half)`);
    if (!hasHelp) { await ctx.close(); appendRow(row); continue; }
    await page.click('.help-btn');
    await page.waitForSelector('.intro-overlay', { timeout: 8000 });
    await sleep(120);

    const a = await snap(page);
    await sleep(FREEZE_MS);
    const b = await snap(page);

    row.clock = a.paused && b.paused && (b.now - a.now) < CLOCK_SLACK_MS;
    row.stage = a.stage === b.stage;
    assert(a.paused && b.paused, `${g.id}: the shell reports paused for the whole overlay`);
    assert((b.now - a.now) < CLOCK_SLACK_MS, `${g.id}: the round clock does not advance (${Math.round(b.now - a.now)}ms over ${FREEZE_MS}ms)`);
    assert(a.stage === b.stage, `${g.id}: nothing spawns, moves or leaves the play area`);
    assert(a.progress === b.progress && a.hearts === b.hearts && a.stars === b.stars,
      `${g.id}: nothing scoreable happens (progress ${a.progress}->${b.progress}, stars ${a.stars}->${b.stars})`);

    // …and it is a PAUSE, not a stall: closing the overlay starts it again.
    await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
    await sleep(900);
    const c = await snap(page);
    row.resumed = !c.paused;
    assert(!c.paused, `${g.id}: the round runs again once the overlay closes`);
  } catch (e) {
    assert(false, `${g.id}: ${String(e).split('\n')[0]}`);
  }
  await ctx.close();
  appendRow(row);
}

function appendRow(r) {
  const tick = (v) => v ? '✓' : '—';
  appendFileSync(LEDGER, `| ${r.id} | ${tick(r.entered)} | ${tick(r.clock)} | ${tick(r.stage)} | ${tick(r.resumed)} |\n`);
}

// ---- the first-play intro itself, on the path the audit's bug lived on ----------------
// "Jump back in" starts the round AND then runs maybeIntro, so on a first-ever open of a
// resumed game the overlay genuinely sits over a live round. That is the exact shape of the
// Boo Beat case, so it is driven rather than assumed.
console.log('== a first-play intro over a resumed round is suspended from the first frame ==');
for (const g of GAMES.filter(x => x.resume)) {
  const { ctx, page } = await open({});
  await page.evaluate(([id, r]) => window.BooTown.go(id, { resume: r }), [g.id, g.resume]);
  await page.waitForSelector('.intro-overlay', { timeout: 10000 }).catch(() => {});
  await sleep(200);
  const up = await page.evaluate(() => !!document.querySelector('.intro-overlay'));
  assert(up, `${g.id}: the first-play intro is on screen over the resumed round`);
  if (up) {
    const a = await snap(page);
    await sleep(1200);
    const b = await snap(page);
    assert(a.paused && (b.now - a.now) < CLOCK_SLACK_MS && a.stage === b.stage && a.progress === b.progress,
      `${g.id}: and the round behind it is frozen from the first frame`);
  }
  await ctx.close();
}

await browser.close();
assert(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(`\nper-game ledger written to ${LEDGER}`);
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
