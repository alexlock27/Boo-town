// tests/r18d-art-law.mjs — RUN18D D4: no emoji-as-art in game scenes.
//
// CLAUDE.md's law, enforced where the pack names it. The check is a unicode-range scan of
// the text a child actually sees INSIDE a scene container — not of the source, because the
// source is full of perfectly legal chrome (What's New icons, button glyphs, journal
// stamps) and a source grep cannot tell the two apart.
//
// The named offenders: the guide builder's species chips, the Studio menu tiles, Teach Me's
// lesson icons and its HOOK stage's scene tags, and the Expedition picnic's plate faces
// (already drawn by RUN18C C3 — asserted here so they stay drawn).
// Expected runtime: ~30s. Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('screenshots/run18d/d4', { recursive: true });

// Pictographs, transport/map symbols, flags and the variation selector — the emoji a scene
// might smuggle in. The dingbat ARROWS (U+2794-U+27BF) are deliberately outside the range:
// "Show me ➜", "Next ➜" and the shared "‹" are button typography, which the law explicitly
// allows, and a scan that flagged them would train everyone to ignore it.
const EMOJI_SCAN = String.raw`[\u{1F000}-\u{1FAFF}\u{2600}-\u{2793}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]`;

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const SAVE = JSON.stringify({
  version: 18, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(['boo_inky', 'boo_plum', 'boo_lolly', 'boo_mint', 'boo_sunny', 'boo_pip', 'boo_teal', 'boo_dot'].map(k => [k, 1])),
  trophies: {}, boxes: 0, meter: 2, spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 900, byGame: {}, byType: { maths: 200, word: 200, puzzle: 200, creative: 200, lesson: 200 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 2 }, shop: { welcomed: true },
  seen: { trophyRetro: true, lastStarsShown: 900, welcomeTour: true, townFirst: true,
    introSeen: { teachme: 1, expedition: 1, expeditionpuzzle: 1 }, zonesUnlocked: AK },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 40000 });
  // 40s, not 20: this suite boots five separate contexts and under a sharded board the
  // first paint can genuinely take that long. A boot timeout is a flake, not a finding.
  await page.waitForSelector('.hub', { timeout: 40000 });
  return { ctx, page };
}
// Every emoji rendered inside `sel`, with the element that carries it, so a failure names
// the offender instead of just counting it.
const scan = (page, sel, pattern) => page.evaluate(([s, p]) => {
  const re = new RegExp(p, 'u');
  const out = [];
  for (const root of document.querySelectorAll(s)) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.nodeValue || '').trim();
      if (t && re.test(t)) out.push(((n.parentElement && n.parentElement.className) || '?') + ' :: ' + t.slice(0, 40));
    }
  }
  return out;
}, [sel, pattern]);
// …and the drawings that replaced them really are there.
const svgCount = (page, sel) => page.evaluate(s => document.querySelectorAll(s).length, sel);

// ================== 1. the guide builder's species chips ==================
console.log('== the species chips draw the species ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('editguide', { from: 'hub' }));
  await page.waitForSelector('.creator .chip-row', { timeout: 15000 });
  await sleep(400);
  // The chip ROWS, not the whole creator: "🎲 Surprise me" and "Save ✨" are button glyphs
  // on controls, which the law allows. What it forbids is the species themselves being
  // somebody else's drawings.
  const bad = await scan(page, '.creator .chip-row', EMOJI_SCAN);
  assert(bad.length === 0, `no emoji on the creator's option chips (${bad.slice(0, 2).join(' | ')})`);
  const heads = await svgCount(page, '.acc-chip.chip-art .chip-art-ic svg');
  assert(heads >= 5, `every species chip carries a drawn head (${heads})`);
  // the chips are a LIVE preview: change the body colour and the heads follow
  const before = await page.evaluate(() => document.querySelector('.acc-chip.chip-art .chip-art-ic').innerHTML);
  await page.evaluate(() => { const sw = [...document.querySelectorAll('.swatch')].find(s => !s.classList.contains('sel')); if (sw) sw.click(); });
  await sleep(300);
  const after = await page.evaluate(() => document.querySelector('.acc-chip.chip-art .chip-art-ic').innerHTML);
  assert(before !== after, 'and they repaint in the colours she is choosing');
  await page.screenshot({ path: 'screenshots/run18d/d4/creator-1024.png' });
  await ctx.close();
}

// ================== 2. the Studio menu ==================
console.log('== the Studio tiles are drawn ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('studio'));
  await page.waitForSelector('.studio-grid', { timeout: 15000 });
  await sleep(300);
  const bad = await scan(page, '.studio-grid', EMOJI_SCAN);
  assert(bad.length === 0, `no emoji on the Studio tiles (${bad.slice(0, 2).join(' | ')})`);
  assert(await svgCount(page, '.studio-card .sc-glyph svg') === 4, 'all four tiles carry house art');
  await page.screenshot({ path: 'screenshots/run18d/d4/studio-1024.png' });
  await ctx.close();
}

// ================== 3. Teach Me: lesson icons and the HOOK's scene tag ==================
console.log('== Teach Me: badges and hook tags are drawn ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('teachme'));
  await page.waitForSelector('.lesson-card', { timeout: 15000 });
  await sleep(300);
  const badList = await scan(page, '.teachme-list .lesson-grid', EMOJI_SCAN);
  assert(badList.length === 0, `no emoji on the lesson cards (${badList.slice(0, 2).join(' | ')})`);
  const n = await svgCount(page, '.lesson-card .lesson-ic svg');
  assert(n >= 9, `every lesson badge is a drawing (${n})`);
  await page.screenshot({ path: 'screenshots/run18d/d4/teachme-list-1024.png' });

  await page.click('.lesson-card');
  await page.waitForSelector('.tm-hook', { timeout: 15000 });
  await sleep(500);
  const badHook = await scan(page, '.tm-hook', EMOJI_SCAN);
  assert(badHook.length === 0, `no emoji in the HOOK scene (${badHook.slice(0, 2).join(' | ')})`);
  assert(await svgCount(page, '.tm-hook-scene-tag svg') === 1, 'the scene tag is a drawing');
  await page.screenshot({ path: 'screenshots/run18d/d4/teachme-hook-1024.png' });
  await ctx.close();
}

// ================== 4. the Expedition picnic's plates (RUN18C C3, held) ==================
console.log('== the Picky Grumps have drawn faces, and keep them ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('expeditionpuzzle', { node: 'picnic' }));
  await page.waitForSelector('.picnic-plates', { timeout: 15000 });
  await sleep(400);
  const bad = await scan(page, '.picnic-plates', EMOJI_SCAN);
  assert(bad.length === 0, `no emoji on the plates (${bad.slice(0, 2).join(' | ')})`);
  assert(await svgCount(page, '.pp-grump svg') >= 1, 'each Grump is a drawing');
  await page.screenshot({ path: 'screenshots/run18d/d4/picnic-1024.png' });
  await ctx.close();
}

// ================== 5. the glyph sets themselves ==================
console.log('== every key the two screens ask for has a drawing of its own ==');
{
  const art = await import('../js/art.js');
  assert(typeof art.renderLessonGlyph === 'function' && typeof art.renderStudioGlyph === 'function',
    'js/art.js exports both new render functions');
  const LESSON_KEYS = ['tower', 'spring', 'footsteps', 'cakeslice', 'dotsgrid', 'clock', 'mouth', 'twins', 'hill',
    'boat', 'confused', 'backwards', 'muddle', 'hop', 'shop', 'share', 'long'];
  const seen = new Map();
  for (const k of LESSON_KEYS) {
    const svg = art.renderLessonGlyph(k, { size: 24 });
    assert(/^<svg /.test(svg) && svg.length > 120, `renderLessonGlyph('${k}') draws something`);
    seen.set(svg, (seen.get(svg) || 0) + 1);
  }
  // `share` deliberately reuses the cake slice; nothing else may collide, or a key is
  // silently falling through to the default and two lessons would wear the same badge.
  const collisions = [...seen.values()].filter(v => v > 1);
  assert(collisions.length === 1 && collisions[0] === 2,
    `exactly one deliberate reuse (share = cakeslice); found ${JSON.stringify(collisions)}`);
  for (const k of ['paint', 'collage', 'buildaboo', 'gallery']) {
    assert(/^<svg /.test(art.renderStudioGlyph(k)), `renderStudioGlyph('${k}') draws something`);
  }
  // …and they parse as XML, the RUN18C lesson: markup the DOM forgives can be unloadable
  // as an image, silently and totally.
  const { ctx, page } = await open();
  const xmlOk = await page.evaluate(async (list) => {
    const p = new DOMParser();
    const bad = [];
    for (const [name, svg] of list) {
      const doc = p.parseFromString(svg, 'image/svg+xml');
      if (doc.querySelector('parsererror')) bad.push(name);
    }
    return bad;
  }, [...LESSON_KEYS.map(k => [k, art.renderLessonGlyph(k)]),
      ...['paint', 'collage', 'buildaboo', 'gallery'].map(k => [k, art.renderStudioGlyph(k)])]);
  assert(xmlOk.length === 0, `every new glyph parses as image/svg+xml (${xmlOk.join(',')})`);
  await ctx.close();
}

await browser.close();
assert(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
