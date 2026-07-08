// tests/shoot-r6p8.mjs — screenshots of Boo Quest (RUN6 C6): the land map (fresh + mid-run),
// a Bridge encounter and a Grump Cheer-Off, at both tablet orientations + phone.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const OUT = 'screenshots/r6p8'; mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [], stars: { total: 120, byGame: {} }, ledger: {}, spellingMastery: {}, journal: {}, quest: { node: 0, lands: {} },
  delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside', 'hilltop', 'beach', 'funfair'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function open(save, vp) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function quest(page) { await page.evaluate(() => window.BooTown.go('booquest')); await page.waitForSelector('.booquest'); await page.waitForFunction(() => window.__booquest); await sleep(500); }

const L = { width: 1024, height: 768 }, P = { width: 768, height: 1024 }, PH = { width: 390, height: 844 };

// The land map — fresh start (node 0 current) at both orientations + phone.
for (const [tag, vp] of [['land', L], ['land', P], ['land-phone', PH]]) {
  const { ctx, page } = await open(SAVE(), vp);
  await quest(page);
  await page.screenshot({ path: `${OUT}/${tag}-${vp.width}x${vp.height}.png` });
  console.log('WROTE', tag, `${vp.width}x${vp.height}`);
  await ctx.close();
}

// Mid-run map — three nodes done so the trail shows progress + the horizon.
{
  const { ctx, page } = await open(SAVE({ quest: { node: 3, lands: {} } }), L);
  await quest(page);
  await page.screenshot({ path: `${OUT}/land-midrun-1024x768.png` });
  console.log('WROTE', 'land-midrun', '1024x768');
  await ctx.close();
}

// A Bridge encounter with a couple of planks laid.
{
  const { ctx, page } = await open(SAVE(), L);
  await quest(page);
  await page.evaluate(() => window.__booquest.open());
  await page.evaluate(() => window.__booquest.answer(true)); await sleep(450);
  await page.evaluate(() => window.__booquest.answer(true)); await sleep(450);
  await page.screenshot({ path: `${OUT}/bridge-encounter-1024x768.png` });
  console.log('WROTE', 'bridge-encounter', '1024x768');
  await ctx.close();
}

// A Grump Cheer-Off mid-lift (one cheer in → "unsure").
{
  const { ctx, page } = await open(SAVE({ quest: { node: 2, lands: {} } }), PH);
  await quest(page);
  await page.evaluate(() => window.__booquest.open());
  await page.evaluate(() => window.__booquest.answer(true)); await sleep(500);
  await page.screenshot({ path: `${OUT}/grump-phone-390x844.png` });
  console.log('WROTE', 'grump-phone', '390x844');
  await ctx.close();
}

await browser.close();
console.log('DONE');
