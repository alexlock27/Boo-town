// tests/portrait-qa.mjs — capture each game mid-round + ceremony + collection in PORTRAIT.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const seed = { version: 1, name: 'Maya', guide: { body: 'lilac', patch: 'pink', acc: 'bow', name: 'Twiggy' },
  inventory: { boo_inky: 2, boo_beam: 1, boo_bubbles: 1, boo_disco: 1, deco_tree: 1 }, boxes: 1 };
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), seed);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');

async function shot(name) { await page.waitForTimeout(500); await page.screenshot({ path: `screenshots/portrait-${name}.png` }); }

// bubble pop mid
await page.evaluate(() => window.BooTown.go('bubblepop'));
await page.waitForSelector('.start-card'); (await page.$$('.level-btn'))[0].click();
await page.waitForSelector('.bubble-field'); await shot('bubblepop');

// feed mid
await page.evaluate(() => window.BooTown.go('feedboos'));
await page.waitForSelector('.start-card'); (await page.$$('.level-btn'))[0].click();
await page.waitForSelector('.food-item'); await shot('feedboos');

// spell mid
await page.evaluate(() => window.BooTown.go('spellboo'));
await page.waitForSelector('.start-card'); (await page.$$('.level-btn'))[0].click();
await page.waitForSelector('.slots-wrap'); await shot('spellboo');

// ceremony box
await page.evaluate(() => window.BooTown.go('ceremony'));
await page.waitForSelector('.gift-box'); await shot('ceremony');

// collection
await page.evaluate(() => window.BooTown.go('collection'));
await page.waitForSelector('.coll-grid'); await shot('collection');

console.log('portrait screenshots written');
await browser.close();
