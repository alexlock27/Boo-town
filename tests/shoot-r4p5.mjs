// tests/shoot-r4p5.mjs — RUN4 phase 5 QA shots: the living town with every
// activity item placed, day + night, both orientations, plus motion frames.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p5', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TOWN = [
  { zone: 'meadow', x: 0.08, item: 'deco_slide' },
  { zone: 'meadow', x: 0.06, item: 'boo_inky' },
  { zone: 'meadow', x: 0.22, item: 'deco_swings' },
  { zone: 'meadow', x: 0.20, item: 'boo_plum' },
  { zone: 'meadow', x: 0.36, item: 'deco_seesaw' },
  { zone: 'meadow', x: 0.33, item: 'boo_pippin' },
  { zone: 'meadow', x: 0.39, item: 'boo_lolly' },
  { zone: 'meadow', x: 0.52, item: 'deco_trampoline' },
  { zone: 'meadow', x: 0.50, item: 'boo_chomp' },
  { zone: 'meadow', x: 0.66, item: 'deco_paddlepool' },
  { zone: 'meadow', x: 0.64, item: 'boo_mallow' },
  { zone: 'meadow', x: 0.80, item: 'deco_picnic' },
  { zone: 'meadow', x: 0.77, item: 'boo_curly' },
  { zone: 'meadow', x: 0.83, item: 'boo_wisp' },
  { zone: 'meadow', x: 0.93, item: 'deco_bumper' },
  { zone: 'meadow', x: 0.90, item: 'boo_beam' },
  { zone: 'riverside', x: 0.30, item: 'deco_campfire' },
  { zone: 'riverside', x: 0.26, item: 'boo_dot' },
  { zone: 'riverside', x: 0.34, item: 'boo_fuzz' },
  { zone: 'riverside', x: 0.55, item: 'deco_boohouse' },
  { zone: 'riverside', x: 0.52, item: 'boo_puff' }
];
const SAVE = () => {
  const inv = {};
  for (const t of TOWN) inv[t.item] = (inv[t.item] || 0) + 1;
  return { version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: inv, boxes: 0, meter: 0, opened: 20, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: TOWN, stars: { total: 60, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, ageAsked: true, age: 8 };
};

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  for (const [hour, label] of [[13, 'day'], [22, 'night']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript((hh) => { window.__bootownHour = hh; }, hour);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.hub');
    await page.evaluate(() => window.BooTown.go('town'));
    await page.waitForSelector('.town2 .t-item');
    await sleep(2000);
    await page.screenshot({ path: `screenshots/r4p5/town-${label}-meadow-${o}.png` });
    if (label === 'night') {
      // scroll to the riverside (drag empty sky so no item is grabbed)
      await page.mouse.move(w / 2, 160);
      await page.mouse.down();
      await page.mouse.move(w / 2 - 420, 160, { steps: 12 });
      await page.mouse.up();
      await sleep(2500);
      await page.screenshot({ path: `screenshots/r4p5/town-night-riverside-${o}.png` });
    }
    await ctx.close();
    console.log('shot', o, label);
  }
}
// motion frame strip: trampoline + slide, 6 frames
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(900);
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: `screenshots/r4p5/frames-${i}.png`, clip: { x: 0, y: 180, width: 700, height: 420 } });
    await sleep(620);
  }
  await ctx.close();
  console.log('shot frames x6');
}
await browser.close();
