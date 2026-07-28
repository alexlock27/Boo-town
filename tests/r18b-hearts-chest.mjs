// tests/r18b-hearts-chest.mjs — RUN18B Y7: hearts out, and the chest speaks.
//
// Two repairs of the same kind — a control that told a child something untrue, and a control
// that answered her tap with nothing. The hearts row counted down while the round carried on
// regardless, so it looked like a life bar and was not one; nothing replaces it. And tapping
// a Star Chest that was not ready did literally nothing.
//
// Expected runtime: ~30s (measured). Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { LINES } from '../data/guideLines.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18b/y7';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
// 38 of 50 toward the chest: the pack's own worked example, N = 12.
const save = ({ total = 338, anchor = 300, content = 'full' } = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 },
  stars: { total, byType: { maths: 100, word: 60, puzzle: 60, creative: 60, lesson: 58 }, spent: {}, legacy: 0, byGame: {} },
  trophies: {}, boxes: 0,
  chest: { anchor, opened: 0, welcome: false },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: total, introSeen: { bubblepop: true, feedboos: true, spellboo: true, beat: true, blocks: true, bounce: true, boopop: true, clockshop: true, echoboos: true, flashboos: true, dash: true }, whatsnewVersion: 'x' },
  settings: { sound: false, music: false, voice: false, content }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function boot(fixture = {}, { width = 1024, height = 768 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(fixture));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}

// ---- 1. no hearts anywhere -------------------------------------------------------------
console.log('== 1. the hearts row is gone from every game, at every tier ==');
{
  const GAMES = [
    ['bubblepop', { resume: { cat: 'bonds', level: 1 } }],
    ['feedboos', { resume: { cat: 't:oddEven', level: 1 } }],
    ['dash', { resume: { cat: 'bonds', level: 1 } }],
    ['bounce', { resume: { cat: 'bonds', level: 1 } }],
    ['beat', { resume: { cat: 'bonds', level: 1 } }],
    ['boopop', {}],
    ['flashboos', {}],
    ['clockshop', { resume: { cat: 'clock', level: 1 } }],
    ['booquest', {}]
  ];
  for (const tier of ['light', 'full']) {
    const { ctx, page } = await boot({ content: tier });
    for (const [route, params] of GAMES) {
      await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
      await page.waitForTimeout(700);
      const found = await page.evaluate(() => ({
        screen: document.getElementById('screen').dataset.screen,
        // the row itself, its retired markup, Boo Quest's own three, and anything that
        // still announces "tries left" to a screen reader
        rows: document.querySelectorAll('.hearts-row, .hearts-wrap, .bq-hearts, .bq-heart').length,
        aria: document.querySelectorAll('[aria-label*="tries"]').length,
        visibleHeart: /♥|💜|❤/.test(document.getElementById('screen').innerText)
      }));
      assert(found.rows === 0 && found.aria === 0,
        `${tier}/${route}: no hearts row, no "tries left" label (rows ${found.rows}, aria ${found.aria})`);
      if (route === 'bubblepop') assert(!found.visibleHeart, `${tier}/${route}: and no heart glyph on screen`);
    }
    if (tier === 'full') await page.screenshot({ path: `${SHOTS}/no-hearts-1024x768.png` });
    await ctx.close();
  }
}

// ---- 2. the chest answers a tap it is not ready for -------------------------------------
console.log('== 2. a chest that is not ready wobbles and says how far off it is ==');
{
  assert(Array.isArray(LINES.chestNotReady) && LINES.chestNotReady[0] === '{n} more stars until the chest opens!',
    'the line is authored verbatim in data/guideLines.js');
  const { ctx, page } = await boot();
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.trail-chip.chest, .star-chest', { timeout: 15000 });
  const before = await page.evaluate(() => {
    const b = document.querySelector('.trail-chip.chest') || document.querySelector('.star-chest');
    return { ready: b.classList.contains('ready'), screen: document.getElementById('screen').dataset.screen };
  });
  assert(!before.ready, 'the fixture is 38 of 50 — the chest is not ready');
  await page.evaluate(() => (document.querySelector('.trail-chip.chest') || document.querySelector('.star-chest')).click());
  await page.waitForTimeout(90);
  const tapped = await page.evaluate(() => ({
    wobbling: !!document.querySelector('.chest-wobble'),
    said: (document.querySelector('.speech-bubble') || {}).textContent || '',
    screen: document.getElementById('screen').dataset.screen
  }));
  assert(tapped.wobbling, 'it wobbles');
  assert(tapped.said === '12 more stars until the chest opens!', `and says it, with N live: "${tapped.said}"`);
  assert(tapped.screen === 'hub', 'and does NOT open a ceremony she has not earned');
  await page.screenshot({ path: `${SHOTS}/chest-not-ready-1024x768.png` });
  // the count is live, not a constant
  await page.evaluate(() => window.BooTown.go('hub'));
  await ctx.close();

  const b2 = await boot({ total: 345, anchor: 300 });
  await b2.page.evaluate(() => window.BooTown.go('hub'));
  await b2.page.waitForSelector('.trail-chip.chest, .star-chest', { timeout: 15000 });
  await b2.page.evaluate(() => (document.querySelector('.trail-chip.chest') || document.querySelector('.star-chest')).click());
  await b2.page.waitForTimeout(90);
  const said2 = await b2.page.evaluate(() => (document.querySelector('.speech-bubble') || {}).textContent || '');
  assert(said2 === '5 more stars until the chest opens!', `N is live, not a constant: "${said2}"`);
  await b2.ctx.close();
}

// ---- 3. ready behaviour unchanged -------------------------------------------------------
console.log('== 3. a ready chest still opens, untouched ==');
{
  const { ctx, page } = await boot({ total: 360, anchor: 300 });
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.trail-chip.chest, .star-chest', { timeout: 15000 });
  const ready = await page.evaluate(() => {
    const b = document.querySelector('.trail-chip.chest') || document.querySelector('.star-chest');
    return b.classList.contains('ready');
  });
  assert(ready, 'at 60 past the anchor the chest is ready');
  await page.evaluate(() => (document.querySelector('.trail-chip.chest') || document.querySelector('.star-chest')).click());
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'ceremony', null, { timeout: 10000 });
  const wobbled = await page.evaluate(() => !!document.querySelector('.chest-wobble'));
  assert(!wobbled, 'a ready chest opens the ceremony and never wobbles at her instead');
  await ctx.close();
}

assert(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));
await browser.close();
console.log(failed ? '\nFAIL' : '\nALL PASS');
process.exit(failed ? 1 : 0);
