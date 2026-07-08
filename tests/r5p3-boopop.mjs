// tests/r5p3-boopop.mjs — RUN5 phase 3 (C2): the Boo Pop readability redesign.
// Acceptance (RUN5 part D #4): family colour + shape mapping verified for every mode;
// a colourblind-reasonable check (shapes differ within any two families); 6x6 and 5x5
// boards; squash-together pop and bounce-back invalid swap in frame evidence; retuned
// thresholds are named constants.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} },
  ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { trophyRetro: true }, ageAsked: true, age: 8
}, over);

// mirror the in-game family maths (must stay in step with boopop.js)
const famHue = (fam) => ((fam - 1) % 10) + 1;
const famShape = (fam) => (fam - 1) % 5;
const FRACTION_FAMILIES = [['1/2', '2/4', '3/6'], ['1/4', '2/8'], ['3/4', '6/8']];
const FRACTION_CLASS = {}; FRACTION_FAMILIES.forEach((f, i) => f.forEach(x => FRACTION_CLASS[x] = i));

const browser = await chromium.launch();
async function fresh(save) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function openLevel(page, levelName) {
  await page.evaluate(() => window.BooTown.go('boopop'));
  await page.waitForSelector('.start-card');
  await page.click(`.level-btn:has-text("${levelName}")`);
  await page.waitForSelector('.bp-board .bp-gem');
  await sleep(250);
}
const flat = (gems) => gems.flat();

// ==================== board sizes 6x6 / 5x5 ====================
console.log('== board sizes ==');
{
  const { ctx, page } = await fresh(SAVE());
  await openLevel(page, 'Twin Pop');
  const nTwin = await page.evaluate(() => window.__boopop.n());
  const colsTwin = await page.$eval('.bp-board', n => getComputedStyle(n).gridTemplateColumns.split(' ').length);
  assert(nTwin === 5 && colsTwin === 5, `Twin Pop is a 5x5 board (n=${nTwin}, cols=${colsTwin})`);
  await openLevel(page, 'Make 10');
  const nStd = await page.evaluate(() => window.__boopop.n());
  const colsStd = await page.$eval('.bp-board', n => getComputedStyle(n).gridTemplateColumns.split(' ').length);
  assert(nStd === 6 && colsStd === 6, `Make 10 is a 6x6 board (n=${nStd}, cols=${colsStd})`);
  // retuned thresholds are the named constants
  const thStd = await page.evaluate(() => window.__boopop.thresholds());
  assert(thStd.three === 9 && thStd.two === 6, `6x6 thresholds retuned to named constants (3★=${thStd.three}, 2★=${thStd.two})`);
  await openLevel(page, 'Twin Pop');
  const thTwin = await page.evaluate(() => window.__boopop.thresholds());
  assert(thTwin.three === 7 && thTwin.two === 4, `5x5 Twin thresholds retuned (3★=${thTwin.three}, 2★=${thTwin.two})`);
  await ctx.close();
}

// ==================== family colour + shape mapping, every mode ====================
console.log('== family colour + shape mapping ==');
{
  const { ctx, page } = await fresh(SAVE());

  // Make 10: complement families {1,9}{2,8}{3,7}{4,6}{5}, each a hue+shape.
  await openLevel(page, 'Make 10');
  let gems = flat(await page.evaluate(() => window.__boopop.gems()));
  let famApp = {};
  let ok10 = true;
  for (const g of gems) {
    const v = +g.v, fam = Math.min(v, 10 - v);
    if (g.hue !== famHue(fam) || g.shape !== famShape(fam)) ok10 = false;
    const key = fam, sig = g.hue + '/' + g.shape;
    if (famApp[key] && famApp[key] !== sig) ok10 = false;  // same family must look identical
    famApp[key] = sig;
  }
  assert(ok10, 'Make 10: every gem carries its complement-family hue + shape (friends look alike)');
  // colourblind-reasonable: any two families differ by SHAPE (not colour alone)
  const shapes = new Set(Object.values(famApp).map(s => s.split('/')[1]));
  const hues = new Set(Object.values(famApp).map(s => s.split('/')[0]));
  assert(shapes.size === Object.keys(famApp).length, `Make 10: each family has a DISTINCT shape (${shapes.size} shapes / ${Object.keys(famApp).length} families) — colourblind-fair`);
  assert(hues.size === Object.keys(famApp).length, 'Make 10: each family also has a distinct hue');

  // Twin Pop: identical number = identical gem (trivially readable).
  await openLevel(page, 'Twin Pop');
  gems = flat(await page.evaluate(() => window.__boopop.gems()));
  let twinOk = true; const byV = {};
  for (const g of gems) { const sig = g.hue + '/' + g.shape; if (byV[g.v] && byV[g.v] !== sig) twinOk = false; byV[g.v] = sig; }
  assert(twinOk, 'Twin Pop: every gem with the same number is drawn identically');

  // Make 20: complement-to-20 families share a colour.
  await openLevel(page, 'Make 20');
  gems = flat(await page.evaluate(() => window.__boopop.gems()));
  let ok20 = true;
  for (const g of gems) { const v = +g.v, fam = Math.min(v, 20 - v); if (g.hue !== famHue(fam)) ok20 = false; }
  assert(ok20, 'Make 20: family colouring by complement to 20');

  // Fraction Friends: equivalence family → shared colour + shape.
  await openLevel(page, 'Fraction Friends');
  gems = flat(await page.evaluate(() => window.__boopop.gems()));
  let okFrac = true; const byCls = {};
  for (const g of gems) {
    const cls = FRACTION_CLASS[g.v];
    if (g.hue !== famHue(cls + 1) || g.shape !== famShape(cls + 1)) okFrac = false;
    const sig = g.hue + '/' + g.shape; if (byCls[cls] && byCls[cls] !== sig) okFrac = false; byCls[cls] = sig;
  }
  assert(okFrac, 'Fraction Friends: equivalent fractions share a colour + shape');

  // Fact Pairs: a fact gem and its answer gem are coloured alike (keyed on the answer).
  await openLevel(page, 'Fact Pairs');
  gems = flat(await page.evaluate(() => window.__boopop.gems()));
  let okFacts = true; const byAns = {};
  for (const g of gems) {
    const ans = +String(g.v).replace(/[qa]/, '');
    const fam = (ans % 10) + 1;
    if (g.hue !== famHue(fam) || g.shape !== famShape(fam)) okFacts = false;
    const sig = g.hue + '/' + g.shape; if (byAns[ans] && byAns[ans] !== sig) okFacts = false; byAns[ans] = sig;
  }
  assert(okFacts, 'Fact Pairs: a fact and its answer wear the same colour + shape');
  await ctx.close();
}

// ==================== the BIG rule chip above the board ====================
console.log('== rule chip ==');
{
  const { ctx, page } = await fresh(SAVE());
  await openLevel(page, 'Make 10');
  const chip = await page.$eval('.bp-rule', n => ({ text: n.textContent, size: parseFloat(getComputedStyle(n).fontSize), top: n.getBoundingClientRect().top }));
  const boardTop = await page.$eval('.bp-board', n => n.getBoundingClientRect().top);
  assert(/Pop the friends that make 10!/.test(chip.text), `rule chip states the rule ("${chip.text}")`);
  assert(chip.size >= 18, `rule chip is big (${chip.size}px)`);
  assert(chip.top < boardTop, 'rule chip sits above the board');
  await ctx.close();
}

// ==================== squash-together pop + bounce-back invalid swap ====================
console.log('== pop squash + invalid bounce-back ==');
{
  const { ctx, page } = await fresh(SAVE());
  await openLevel(page, 'Make 10');
  // valid swap → the matched pair squashes together and bursts (.popping)
  const mv = await page.evaluate(() => window.__boopop.findMove());
  await page.evaluate((m) => { window.__boopop.swap(m.from[0], m.from[1], m.to[0], m.to[1]); }, mv);
  let sawPop = false;
  for (let i = 0; i < 20; i++) { if (await page.$('.bp-gem.popping')) { sawPop = true; break; } await sleep(50); }
  assert(sawPop, 'a matched pair squashes together and bursts (.popping)');
  await sleep(1400);

  // invalid swap → BOTH gems bounce back, no move lost
  await openLevel(page, 'Twin Pop');
  await page.evaluate(() => { const n = window.__boopop.n(); const vals = []; for (let r = 0; r < n; r++) { vals.push([]); for (let c = 0; c < n; c++) vals[r].push(1 + ((3 * r + c) % 9)); } window.__boopop.setTwinGrid(vals); });
  const movesBefore = await page.evaluate(() => window.__boopop.state().moves);
  await page.evaluate(() => window.__boopop.swap(0, 0, 0, 1));   // guaranteed invalid on the rigged board
  let bounceCount = 0;
  for (let i = 0; i < 24; i++) { bounceCount = await page.$$eval('.bp-gem.bounce', ns => ns.length); if (bounceCount >= 2) break; await sleep(40); }
  assert(bounceCount >= 2, `an invalid swap bounces BOTH gems back (${bounceCount} bouncing)`);
  await sleep(300);
  const movesAfter = await page.evaluate(() => window.__boopop.state().moves);
  assert(movesAfter === movesBefore, `no move is lost on an invalid swap (${movesBefore} → ${movesAfter})`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
