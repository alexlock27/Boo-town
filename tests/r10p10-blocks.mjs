import { chromium } from 'playwright';
import { BAG_TIERS, buildBag } from '../js/games/blocks.js';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (ok, msg) => { console.log((ok ? '✓' : 'FAIL:'), msg); if (!ok) failed = true; };
for (const tier of BAG_TIERS) {
  let awkward = 0, total = 0;
  for (let i = 0; i < 300; i++) for (const piece of buildBag(tier.at)) { total++; if (['tetS', 'tetL', 'tetT', 'corner', 'tetI'].includes(piece)) awkward++; }
  assert(Math.abs(awkward / total - tier.awkward) <= .04, `tier ${tier.at} awkward ratio is ${tier.awkward}`);
}
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await page.goto(BASE + '/index.html');
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 7, name: 'Ada', guide: {}, stars: { total: 100, byGame: {} }, town: { areas: {} }, seen: { introSeen: { blocks: 1 } }, settings: { sound: false, music: false } })));
await page.reload(); await page.waitForSelector('.hub'); await page.evaluate(() => window.BooTown.go('blocks', { resume: true })); await page.waitForSelector('.blk-board');
await page.evaluate(() => window.__blocks.setFillForTest(45));
assert(await page.locator('.blk-boost.squeeze').count() === 1, 'Boost squeezes at 70% fill');
await page.evaluate(() => window.__blocks.setFillForTest(39));
assert(await page.locator('.blk-boost.squeeze').count() === 0, 'Boost releases below 62% fill');
await page.evaluate(() => { window.__blocks.rigSpecial(0, 'lineblast'); window.__blocks.place(0, 0, 0); });
assert(await page.locator('.blk-board.blk-beam').count() === 1, 'Line Blaster has a beam frame');
await browser.close(); console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS')); process.exit(failed ? 1 : 0);
