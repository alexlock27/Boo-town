// tests/r18b-beat-readout.mjs — RUN18B Y12: the diagnosis of "the top-left figure".
//
// The pack asks for a figure in Boo Beat's top-left that ran 6.1 → 69.0 → 129.9 across ~1s.
// IT IS NOT THERE, and never was: js/games/beat.js contains no numeric textContent write in
// its entire git history. Section 1 pins that — every numeric element on a live Boo Beat
// round, at two widths, enumerated and watched. If anyone ever adds an unlabelled racing
// number to that screen, this fails.
//
// The one readout in the app that matches the audit's shape — one decimal, seconds, at the
// top of a game screen — is BOO ROLL's course clock (`.roll-clock`, `(ms/1000).toFixed(1)`).
// Section 2 measures it against a stopwatch. It is monotonic, and it runs at TWICE real
// time: the loop takes two 1/60s engine steps per animation frame, so sim time accrues
// 2000ms per real second. That is pinned here as a KNOWN DEFECT, not endorsed — the fix
// moves the meaning of an Alex-approved number (Y8's gold 14s / silver 22s / bronze 35s are
// measured in these same sim seconds and are LAW in CONTENT_COURSES.md), so it is written up
// in BLOCKED.md and put to Alex in NEEDS_ALEX.md rather than improvised here.
// Expected runtime: ~20s. Not @serial.

import { chromium } from 'playwright';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 900, byGame: {}, byType: {}, spent: {}, legacy: 0 },
  trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 900, introSeen: { beat: true, booroll: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(w = 1024, h = 768) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}
// every leaf element on screen whose text contains a digit
const numerics = (page) => page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter(e => e.children.length === 0 && /\d/.test(e.textContent || ''))
  .map(e => ({ cls: String(e.className || e.tagName), txt: (e.textContent || '').trim() })));

// ================== 1. Boo Beat has no such figure ==================
console.log('== 1. Boo Beat: no unlabelled figure, and nothing on it races ==');
for (const [w, h] of [[390, 844], [1024, 768]]) {
  const { ctx, page } = await open(w, h);
  await page.evaluate(() => window.BooTown.go('beat', { resume: { cat: 'tables', level: 2 } }));
  await page.waitForSelector('.beat-field', { timeout: 15000 });
  await sleep(700);
  const before = await numerics(page);
  await sleep(1200);
  const after = await numerics(page);
  const classes = before.map(e => e.cls).sort();
  assert(classes.join('|') === ['beat-prompt', 'pb-count', 'progress-label'].join('|'),
    `${w}px: the only numbers on the screen are the question, the "N of 10" progress label and the hidden Puzzled-Boo count (${classes.join(', ')})`);
  const label = before.find(e => e.cls === 'progress-label');
  assert(/^\d+ of \d+$/.test(label.txt), `${w}px: the progress figure is LABELLED, not bare ("${label.txt}")`);
  // nothing that is on screen changes while she reads the question
  const moved = after.filter((e, i) => before[i] && before[i].cls === e.cls && before[i].txt !== e.txt);
  assert(moved.length === 0, `${w}px: nothing on the screen counts up over 1.2s — the audit's 6.1 → 69.0 → 129.9 is not here (${moved.map(m => m.cls).join(',') || 'nothing moved'})`);
  await ctx.close();
}

// ================== 2. Boo Roll's clock: the readout that DOES match ==================
console.log('== 2. Boo Roll\'s course clock: monotonic, labelled, and running at 2x ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForFunction(() => window.__booroll && window.__booroll.onMap && window.__booroll.onMap(), null, { timeout: 15000 });
  await page.evaluate(() => window.__booroll.openCourse('lift-off'));
  await page.waitForFunction(() => window.__booroll.calibrating(), null, { timeout: 10000 });
  await page.evaluate(() => window.__booroll.go('virtual'));
  await page.waitForFunction(() => window.__booroll.playing(), null, { timeout: 10000 });
  const clock = await page.evaluate(() => {
    const c = document.querySelector('.roll-clock'); if (!c) return null;
    const r = c.getBoundingClientRect();
    return { txt: c.textContent, x: Math.round(r.left), y: Math.round(r.top) };
  });
  assert(!!clock && /^\d+\.\d+s$/.test(clock.txt), `the clock reads seconds to one decimal, with its unit on it ("${clock && clock.txt}")`);
  assert(clock.x > 300, `and it sits top-CENTRE, not top-left as the audit reported (x=${clock.x})`);

  const t0 = Date.now(); const samples = [];
  for (let i = 0; i < 7; i++) { await sleep(450); samples.push([(Date.now() - t0) / 1000, parseFloat(await page.evaluate(() => document.querySelector('.roll-clock').textContent))]); }
  const rising = samples.every((s, i) => i === 0 || s[1] >= samples[i - 1][1]);
  assert(rising, `the clock only ever goes up (${samples.map(s => s[1]).join(' → ')})`);
  // slope of shown-seconds against real seconds, taken across the whole window
  const a = samples[0], z = samples[samples.length - 1];
  const ratio = (z[1] - a[1]) / (z[0] - a[0]);
  console.log(`  · measured: ${(z[0] - a[0]).toFixed(2)}s of stopwatch showed as ${(z[1] - a[1]).toFixed(1)}s on the clock`);
  assert(Math.abs(ratio - 1) > 0.05,
    `KNOWN DEFECT, pinned not endorsed: the clock does NOT match a stopwatch (${ratio.toFixed(2)}x real time). js/games/booroll.js takes two 1/60s engine steps per animation frame, so sim time accrues 2000ms per real second. Fixing it moves the meaning of Y8's Alex-approved pars — see BLOCKED.md and NEEDS_ALEX.md. When Alex rules, invert this assertion.`);
  assert(ratio > 1.85 && ratio < 2.2, `and the error is exactly the double-step, nothing else (${ratio.toFixed(2)}x, expected ~2.00x)`);
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
