// tests/r11q7-cameo.mjs — RUN11 Q7 / RUN10 P21: the best-friend hub cameo appears ONLY at
// bond level 5 and is silently absent otherwise, leaving the hub layout unchanged.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// LEVELS = [0,10,25,45,70] → level 5 starts at 70 points.
const SAVE = (bonds) => JSON.stringify({ version: 14, name: 'Ada', ageAsked: true, guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1, boo_plum: 1 }, stars: { total: 100, byGame: {} }, town: { areas: {} }, care: { bonds, treats: 0 }, settings: { sound: false, music: false, voice: false, content: 'full' } });

const browser = await chromium.launch();
const shot = async (bonds) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(bonds));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.hub'), null, { timeout: 12000 });
  await page.waitForTimeout(400);
  const out = {
    cameo: await page.locator('.hub-bff').count(),
    gridBox: await page.evaluate(() => { const g = document.querySelector('.hub-games, .games-grid, .hub'); const r = g.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })
  };
  await ctx.close();
  return out;
};

console.log('== the cameo is gated on bond level 5 ==');
const below = await shot({ boo_inky: 45, boo_plum: 20 });   // level 4
const at = await shot({ boo_inky: 70, boo_plum: 30 });      // level 5
const above = await shot({ boo_inky: 120 });                // beyond level 5
assert(below.cameo === 0, 'no cameo below level 5 (bond 45)');
assert(at.cameo === 1, 'exactly one cameo at level 5 (bond 70)');
assert(above.cameo === 1, 'still exactly one cameo above level 5 (never duplicated)');

console.log('== the hub layout is unchanged by the cameo ==');
assert(below.gridBox.w === at.gridBox.w && below.gridBox.h === at.gridBox.h,
  `hub box identical with and without the cameo (${JSON.stringify(below.gridBox)} vs ${JSON.stringify(at.gridBox)})`);

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
