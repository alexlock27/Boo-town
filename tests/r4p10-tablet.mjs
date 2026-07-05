// tests/r4p10-tablet.mjs — RUN4 phase 10 (C10): the tablet guarantee, hard gate.
// Usage: `node tests/r4p10-tablet.mjs before` (capture baseline), then apply the
// phone CSS, then `node tests/r4p10-tablet.mjs after` (recapture + byte-compare).
// Deterministic captures: seeded Math.random, reduced motion, fixed hour/day.
// Any pixel difference beyond byte-identity fails the phase (it must be reverted).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'fs';
const MODE = process.argv[2] || 'before';
mkdirSync(`screenshots/r4p10/${MODE}`, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = {
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, deco_tree: 1, deco_stage: 1, acc_bow: 1 },
  boxes: 0, meter: 3, opened: 5, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: { 'spellboo:big': 3 },
  town: [{ zone: 'meadow', x: 0.3, item: 'deco_tree' }, { zone: 'meadow', x: 0.6, item: 'boo_inky' }],
  stars: { total: 60, byGame: {} }, ledger: {},
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] },
  ageAsked: true, age: 8
};

const SHOTS = [
  ['hub', async (page) => { await page.waitForSelector('.hub .speech-bubble'); }],
  ['spellboo', async (page) => { await page.evaluate(() => window.BooTown.go('spellboo')); await page.waitForSelector('.picker'); }],
  ['boopop', async (page) => { await page.evaluate(() => window.BooTown.go('boopop')); await page.waitForSelector('.start-card'); }],
  ['collection', async (page) => { await page.evaluate(() => window.BooTown.go('collection')); await page.waitForSelector('.coll-grid'); }],
  ['trophies', async (page) => { await page.click('.coll-tab:has-text("Troph")'); await page.waitForSelector('.trophy-cabinet'); }],
  ['town', async (page) => { await page.evaluate(() => window.BooTown.go('town')); await page.waitForSelector('.town2 .t-item'); }]
];

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    let seed = 42;
    Math.random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    window.__bootownHour = 13; window.__bootownDay = '2026-07-05';
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  for (const [name, go] of SHOTS) {
    await go(page);
    await sleep(650);
    const path = `screenshots/r4p10/${MODE}/${name}-${o}.png`;
    await page.screenshot({ path });
    if (MODE === 'after') {
      const beforePath = `screenshots/r4p10/before/${name}-${o}.png`;
      if (!existsSync(beforePath)) { assert(false, `missing baseline ${beforePath}`); continue; }
      const same = Buffer.compare(readFileSync(beforePath), readFileSync(path)) === 0;
      assert(same, `tablet pixels unchanged: ${name} ${o}`);
    } else {
      console.log('  captured', name, o);
    }
  }
  await ctx.close();
}
await browser.close();
if (MODE === 'after') console.log(failed ? '\nr4p10-tablet: FAIL — REVERT THE PHASE' : '\nr4p10-tablet: TABLET GUARANTEE HOLDS');
process.exit(failed ? 1 : 0);
