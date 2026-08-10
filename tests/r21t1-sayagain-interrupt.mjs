// tests/r21t1-sayagain-interrupt.mjs — the SAY-AGAIN interrupt (approved 2026-08-10;
// NEEDS_ALEX `SAY-AGAIN: APPROVED`, rationale in TONIGHT-2026-08-10/DECISIONS.md §3).
//
// WHY THIS SUITE EXISTS. A child pressing "🔊 say it again" means NOW, so every re-speak
// control passes `interrupt: true` through speakMaybe's existing option (the Interrupting
// Boo's proven path). The games' own suites are deliberately written to pass with OR
// without that flag — they must not depend on it — which means NONE of them would notice if
// the eight one-liners were reverted. This suite is the one that would: it is the only
// regression guard the behaviour has.
//
// HOW IT PROVES IT. `window.speechSynthesis.speak` is stubbed to record the utterance and
// then NEVER fire `onend`, so the first line stays wedged as `playing` for ever. Against a
// wedged line the two behaviours are unmistakable through js/tts.js's queueState():
//   interrupting → the playing id ADVANCES and the queue does not grow
//   queueing     → the playing id is UNCHANGED and the queue grows by one
// So this cannot pass by accident, and it fails loudly if a call site loses its flag.
//
// Expected runtime: ~20s (measured 2026-08-10, serial). Not @serial — it waits on queue
// state, never on a clock.

import { chromium } from 'playwright';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (settings = {}, seen = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, ledger: {}, spellingMastery: {}, trickyPile: [],
  seen: Object.assign({ trophyRetro: true, lastStarsShown: 400, introSeen: { rhymetime: 1, spellboo: 1, storyorder: 1, soundsorter: 1, blendit: 1 } }, seen),
  settings: Object.assign({ sound: false, music: false, voice: true, content: 'full' }, settings)
});

const browser = await chromium.launch({ args: RESOLVE });

// A stub that records every utterance and NEVER completes one, so `playing` stays wedged.
const WEDGE = () => {
  window.__said = [];
  const install = () => {
    const ss = window.speechSynthesis;
    if (!ss) return false;
    ss.speak = (u) => { window.__said.push(String(u.text)); };
    return true;
  };
  if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
};

async function open(route, params = {}, settings = {}, seen = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', String(e).split('\n')[0]); });
  await page.addInitScript(WEDGE);
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(settings, seen));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
  return { ctx, page };
}
const queue = page => page.evaluate(async () => (await import('./js/tts.js')).queueState());

// Wedge a line of our own so there is ALWAYS something playing to cut, whatever the screen
// happened to say on mount. Returns the queue state with that line playing.
async function wedge(page) {
  await page.evaluate(async () => {
    const g = await import('./js/guide.js');
    g.speakMaybe('A wedged line that never finishes.');
  });
  await page.waitForFunction(async () => {
    const q = (await import('./js/tts.js')).queueState();
    return !!q.playing;
  }, null, { timeout: 8000 });
  return queue(page);
}

// The heart of the suite: press `click` and require the wedged line to have been CUT.
async function expectInterrupt(page, label, click) {
  const before = await wedge(page);
  const saidBefore = await page.evaluate(() => window.__said.length);
  await click();
  await page.waitForTimeout(300);
  const after = await queue(page);
  const saidAfter = await page.evaluate(() => window.__said.length);
  const cut = after.playing !== before.playing;
  const grew = after.length > before.length;
  assert(saidAfter > saidBefore && cut && !grew,
    `${label}: cuts the line that is speaking (playing ${before.playing} → ${after.playing}, queue ${before.length} → ${after.length}, ${saidAfter - saidBefore} new utterance)`);
}

// ---- 1. every re-speak control interrupts -------------------------------------------
console.log('== every "say it again" control cuts a line that is still speaking ==');
{
  const { ctx, page } = await open('rhymetime', { toddler: true });
  await page.waitForSelector('.ss-say', { timeout: 15000 });
  await expectInterrupt(page, 'Rhyme Time "Say it again"', () => page.evaluate(() => document.querySelector('.ss-say').click()));
  await ctx.close();
}
{
  const { ctx, page } = await open('spellboo', { resume: { cat: null, level: 1, mix: true } });
  await page.waitForSelector('.hear-btn', { timeout: 15000 });
  await expectInterrupt(page, 'Spell Boo "Hear it again"', () => page.evaluate(() => document.querySelector('.hear-btn').click()));
  await expectInterrupt(page, 'Spell Boo speaker icon', () => page.evaluate(() => document.querySelector('.speak-btn').click()));
  await ctx.close();
}
{
  const { ctx, page } = await open('soundsorter');
  await page.waitForSelector('.start-card', { timeout: 15000 });
  await page.evaluate(() => document.querySelectorAll('.level-btn')[0].click());
  await page.waitForSelector('.ss-say', { timeout: 15000 });
  await expectInterrupt(page, 'Sound Sorter "Say them again"', () => page.evaluate(() => document.querySelector('.ss-say').click()));
  await ctx.close();
}
{
  // the toddler shell's big "Again" speaker, over one of its spoken-prompt games
  const TOD_INTROS = Object.fromEntries(['tcount', 'tcolour', 'tshape', 'tletter', 'tanimal', 'tpairs', 'tbigsmall'].map(k => [k, true]));
  const { ctx, page } = await open('toddlergame', { game: 'count' }, { content: 'toddler' }, { introSeen: TOD_INTROS });
  await page.waitForSelector('.td-replay', { timeout: 15000 });
  await expectInterrupt(page, 'Toddler "Again" speaker', () => page.evaluate(() => window.__toddlerReplay.fire()));
  await ctx.close();
}
{
  // a11y's readAloudButton — one change that serves beat, bubblepop and dash
  const { ctx, page } = await open('hub', {}, { readAloud: true });
  const built = await page.evaluate(async () => {
    const a11y = await import('./js/a11y.js');
    const btn = a11y.readAloudButton(() => 'What is four add three?');
    document.body.appendChild(btn);
    return !!btn;
  });
  assert(built, 'a11y readAloudButton builds (it serves Boo Beat, Bubble Pop and Boo Dash)');
  await expectInterrupt(page, 'a11y read-aloud button', () => page.evaluate(() => document.querySelector('.read-aloud-btn').click()));
  await ctx.close();
}

// ---- 2. first-time speech does NOT interrupt ------------------------------------------
// The other half of the promise, and the one a regression would break silently: only a
// repeat SHE asked for pre-empts. An ordinary line must still queue politely behind.
console.log('== ordinary speech still queues — only a repeat she asked for cuts ==');
{
  const { ctx, page } = await open('rhymetime', { toddler: true });
  await page.waitForSelector('.ss-say', { timeout: 15000 });
  const before = await wedge(page);
  await page.evaluate(async () => {
    const g = await import('./js/guide.js');
    g.speakMaybe('An ordinary line with no interrupt.');
  });
  await page.waitForTimeout(300);
  const after = await queue(page);
  assert(after.playing === before.playing && after.length > before.length,
    `an ordinary speakMaybe waits its turn (playing unchanged at ${after.playing}, queue ${before.length} → ${after.length})`);
  await ctx.close();
}

// ---- 3. the option really is the shared one, not a per-game reimplementation ----------
console.log('== it rides speakMaybe\'s existing option, reused not duplicated ==');
{
  const { ctx, page } = await open('hub');
  // NB: speakMaybe.length is 1, not 3 — parameters with defaults do not count toward
  // Function.length. Read the signature from the source instead.
  const r = await page.evaluate(async () => {
    const g = await import('./js/guide.js');
    const src = g.speakMaybe.toString();
    return { sig: /speakMaybe\s*\(\s*text\s*,\s*voice[^,]*,\s*opts/.test(src), fwd: /interrupt:\s*!!\s*opts\.interrupt/.test(src) };
  });
  assert(r.sig, 'speakMaybe still takes (text, voice, opts) — the shared option, not a per-game flag');
  assert(r.fwd, 'and forwards opts.interrupt straight through to tts.speak');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
