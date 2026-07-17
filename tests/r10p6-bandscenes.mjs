// RUN10 P6: Band Room and instrument-scene geometry/navigation.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (ok, msg) => { if (!ok) { failed = true; console.log('  ✗ FAIL:', msg); } else console.log('  ✓', msg); };
const SAVE = { version: 6, name: 'Ada', guide: { species: 'giraffe', body: 'sky', pattern: 'none', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1, boo_chomp: 1, boo_curly: 1 }, boxes: 0, meter: 0, opened: 4, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: { areas: {} }, stars: { total: 0, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: { funfairOpened: 'x', introSeen: {}, townFirst: true }, trophies: {}, ageAsked: true, age: 8 };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  console.log(`== Band Room ${viewport.width}x${viewport.height} ==`);
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage();
  await page.goto(BASE + '/index.html');
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload(); await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('bandroom')); await page.waitForSelector('.bandroom');
  assert(await page.locator('.bandroom-card').count() === 6, 'six Band Room cards render');
  const overlap = await page.locator('button:visible').evaluateAll(ns => ns.some((a, i) => ns.slice(i + 1).some(b => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top; })));
  assert(!overlap, 'visible controls do not overlap');
  if (viewport.width === 390) assert(await page.locator('.bandroom-grid').evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length === 1), 'phone uses a one-column Band Room');
  await page.click('.bandroom-card[data-scene="drums"]'); await page.waitForFunction(() => window.__band);
  assert(await page.locator('.drum-grid').count() === 1, 'second tap enters Drums');
  assert(await page.locator('.band-scene-record').evaluate(n => { const r = n.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }), 'record control is at least 44px');
  await page.evaluate(() => window.BooTown.go('band', { instrument: 'keys', songId: 'golden_boo' }));
  await page.waitForSelector('.keys-row');
  const geometry = await page.evaluate(() => { const lane = document.querySelector('.sparkle-lane').getBoundingClientRect(), keys = document.querySelector('.keys-row').getBoundingClientRect(); return { separated: lane.bottom <= keys.top, keys: document.querySelectorAll('.key').length, letters: [...document.querySelectorAll('.key')].every(k => k.textContent.trim()) }; });
  assert(geometry.separated && geometry.keys === 10 && geometry.letters, 'sparkle lane is in flow above ten labelled keys');
  await ctx.close();
}
await browser.close();
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
