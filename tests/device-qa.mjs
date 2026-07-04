// tests/device-qa.mjs — screenshot key screens at a real 10-inch tablet aspect (~16:10).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const L = { width: 1000, height: 625 };   // landscape 16:10
const P = { width: 625, height: 1000 };    // portrait
const seed = { version: 1, name: 'Maya', guide: { body: 'lilac', patch: 'pink', acc: 'crown', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_beam: 1, boo_bubbles: 1, boo_disco: 1, deco_tree: 1 }, meter: 3, boxes: 1,
  stars: { total: 12, byGame: { bubblepop: { best: 3, plays: 2 }, feedboos: { best: 2, plays: 1 }, spellboo: { best: 0, plays: 0 } } } };

const browser = await chromium.launch();
for (const [mode, vp] of [['landscape', L], ['portrait', P]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), seed);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.hub'); await page.waitForTimeout(500);
  await page.screenshot({ path: `screenshots/dev-hub-${mode}.png` });
  // check nothing overflows the viewport height on the hub
  const overflow = await page.evaluate(() => document.querySelector('.hub').scrollHeight > window.innerHeight + 2);
  console.log(`${mode}: hub overflow=${overflow}`);
  await ctx.close();
}
await browser.close();
console.log('device QA screenshots written');
