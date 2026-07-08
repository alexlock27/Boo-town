// tests/shoot-r6p1.mjs — screenshots of the living town (RUN6 C1): day + night,
// with placed Boos + activities, weather + a shooting star, both orientations + phone.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const OUT = 'screenshots/r6p1'; mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const town = [
  { zone: 'meadow', x: 0.20, item: 'deco_slide' }, { zone: 'meadow', x: 0.34, item: 'deco_swings' },
  { zone: 'meadow', x: 0.48, item: 'deco_seesaw' }, { zone: 'meadow', x: 0.62, item: 'deco_campfire' },
  { zone: 'meadow', x: 0.42, item: 'deco_boohouse' }, { zone: 'meadow', x: 0.56, item: 'deco_tree' },
];
['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot'].forEach((n, i) => town.push({ zone: 'meadow', x: +(0.14 + i * 0.05).toFixed(2), item: 'boo_' + n }));
const inv = {}; for (const t of town) inv[t.item] = (inv[t.item] || 0) + 1;
const SAVE = {
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: inv, boxes: 0, meter: 2, opened: 6, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town,
  stars: { total: 90, byGame: {} }, ledger: {}, delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, ageAsked: true, age: 8
};

const browser = await chromium.launch();
async function shoot(name, vp, hour, month) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.addInitScript(([h, m]) => { window.__bootownHour = h; window.__bootownMonth = m; }, [hour, month]);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(1500);   // let Boos choose behaviours + weather settle
  if (hour >= 19) await page.evaluate(() => window.__townLife && window.__townLife.spawnStar());
  await sleep(300);
  await page.screenshot({ path: `${OUT}/${name}-${vp.width}x${vp.height}.png` });
  console.log('WROTE', name, `${vp.width}x${vp.height}`);
  await ctx.close();
}
const L = { width: 1024, height: 768 }, P = { width: 768, height: 1024 }, PH = { width: 390, height: 844 };
await shoot('day-summer', L, 13, 7);
await shoot('day-summer', P, 13, 7);
await shoot('night', L, 22, 10);
await shoot('night', P, 22, 10);
await shoot('day-phone', PH, 13, 4);
await shoot('night-phone', PH, 22, 12);
await browser.close();
console.log('DONE');
