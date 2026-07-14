// tests/shoot-phone.mjs — capture named screens at 390x844 (portrait) and 844x390 (landscape)
// for the RUN6 C0.4 phone-comfort pass. Usage: node tests/shoot-phone.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const OUT = 'screenshots/r6p0';
mkdirSync(OUT, { recursive: true });

const SAVE = {
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, boo_bubbles: 1, deco_tree: 1, deco_stage: 1, acc_bow: 1 },
  boxes: 0, meter: 3, opened: 6, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [], stars: { total: 120, byGame: { bubblepop: { plays: 8, earned: 19, best: 3 }, spellboo: { plays: 4, earned: 9, best: 2 } } },
  ledger: {}, spellingMastery: {}, trickyPile: [],
  golden: { words: [{ w: 'because' }], choices: [] },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] },
  trophies: {}, ageAsked: true, age: 8
};

const browser = await chromium.launch();
async function shoot(name, viewport, fn) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await fn(page);
  const tag = `${viewport.width}x${viewport.height}`;
  await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: true });
  console.log('WROTE', `${name}-${tag}`);
  await ctx.close();
}

const P = { width: 390, height: 844 }, L = { width: 844, height: 390 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const vp of [P, L]) {
  await shoot('results', vp, async (p) => {
    await p.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 3, cat: 'tables', level: 2 }));
    await p.waitForSelector('.result-card'); await sleep(900);
  });
  await shoot('collection', vp, async (p) => {
    await p.evaluate(() => window.BooTown.go('collection'));
    await p.waitForSelector('.coll-grid'); await sleep(400);
  });
  await shoot('grownups-settings', vp, async (p) => {
    await p.evaluate(() => window.BooTown.go('grownups'));
    await p.waitForSelector('.gu-tabs'); await sleep(200);
  });
  await shoot('grownups-data', vp, async (p) => {
    await p.evaluate(() => window.BooTown.go('grownups'));
    await p.click('.gu-tab[data-tab="data"]'); await sleep(200);
  });
  await shoot('paint', vp, async (p) => {
    await p.evaluate(() => window.BooTown.go('paint'));
    await p.waitForSelector('.paint-canvas'); await sleep(400);
  });
  await shoot('collage', vp, async (p) => {
    await p.evaluate(() => window.BooTown.go('collage'));
    await p.waitForSelector('.collage-svg'); await sleep(400);
  });
  await shoot('blocks-round', vp, async (p) => {
    await p.evaluate(() => window.BooTown.go('blocks', { resume: { mix: true } }));   // RUN9 C2: resume just starts a round
    await p.waitForSelector('.blk-board'); await sleep(300);
    // select a free piece so the rotate badge shows
    await p.evaluate(() => window.__blocks.select(0));
    await sleep(200);
  });
}
await browser.close();
console.log('DONE');
