// tests/r4p9-delights.mjs — RUN4 phase 9 (C9): daily delights.
// Acceptance (RUN4 part D #12): hide-and-seek at most once per day with
// carry-over and no reminders; Boo of the Day rotates at local midnight and
// copes with zero owned accessories; the Parade marches every placed Boo with
// frame evidence, returns everyone home, and its button hides when no Boos
// are placed.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, deco_tree: 1, deco_stage: 1, acc_bow: 1 },
  boxes: 0, meter: 0, opened: 5, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {},
  town: [
    { zone: 'meadow', x: 0.3, item: 'deco_tree' },
    { zone: 'meadow', x: 0.5, item: 'deco_stage' },
    { zone: 'meadow', x: 0.55, item: 'boo_inky' },
    { zone: 'meadow', x: 0.6, item: 'boo_plum' }
  ],
  stars: { total: 60, byGame: {} }, ledger: {},
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] },
  ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function fresh(save, { day = '2026-07-05' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((d) => { window.__bootownDay = d; window.__bootownParadeMs = 4000; }, day);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ---- hide-and-seek ----
console.log('== hide-and-seek Boo ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(600);
  const ears = await page.$('.t-hide-ears');
  assert(!!ears, 'one placed Boo hides behind scenery (peeking ears visible)');
  const hiddenId = await page.evaluate(() => window.BooTown.State.getState().delights.hideBoo);
  const hiddenShown = await page.$eval(`.t-item[data-item="${hiddenId}"]`, n => n.style.display).catch(() => 'gone');
  assert(hiddenShown === 'none' || hiddenShown === 'gone', 'the hider is tucked away, not standing in the open');
  const m0 = await page.evaluate(() => window.BooTown.State.getState().meter);
  await page.click('.t-hide-ears', { force: true });
  await sleep(700);
  const st = await page.evaluate(() => ({ meter: window.BooTown.State.getState().meter, found: window.BooTown.State.getState().delights.hideFound }));
  assert(st.found, 'tapping the ears finds the Boo');
  assert(st.meter === m0 + 2, `spotting earns +2 meter (${m0} → ${st.meter})`);
  assert(!(await page.$('.t-hide-ears')), 'the ears are gone once found');
  // once per day: revisit — no new hider today
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(600);
  assert(!(await page.$('.t-hide-ears')), 'at most once per local day');
  await ctx.close();
}
console.log('== unfound carries to tomorrow (no reminder) ==');
{
  const save = SAVE();
  save.delights = { hideDay: '2026-07-04', hideFound: false, hideBoo: 'boo_inky', hideSpot: { zone: 'meadow', x: 0.3, item: 'deco_tree' } };
  const { ctx, page } = await fresh(save);   // today is the 5th
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(600);
  const d = await page.evaluate(() => window.BooTown.State.getState().delights);
  assert(d.hideBoo === 'boo_inky' && !d.hideFound, 'yesterday\'s unfound hider simply carries over');
  assert(!!(await page.$('.t-hide-ears')), 'still peeking today');
  // no reminder anywhere on the hub
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub');
  const hubText = await page.$eval('.hub', n => n.textContent);
  assert(!/hide|seek|hiding/i.test(hubText), 'no reminder, no nag (rule 2)');
  await ctx.close();
}

// ---- Boo of the Day ----
console.log('== Boo of the Day ==');
{
  const { ctx, page } = await fresh(SAVE());
  const pod = await page.$('.trail-chip.botd');
  assert(!!pod, 'the hub spotlights a Boo of the Day (Today-rail chip)');
  const title = await page.$eval('.trail-chip.botd .tc-title', n => n.textContent);
  assert(/Boo of the Day/.test(title), `the chip reads Boo of the Day ("${title}")`);
  const boo1 = await page.evaluate(() => import('./js/delights.js').then(m => m.booOfTheDay().id));
  // rotates at local midnight
  const boo2 = await page.evaluate(() => { window.__bootownDay = '2026-07-06'; return import('./js/delights.js').then(m => m.booOfTheDay().id); });
  const boo3 = await page.evaluate(() => { window.__bootownDay = '2026-07-07'; return import('./js/delights.js').then(m => m.booOfTheDay().id); });
  assert(new Set([boo1, boo2, boo3]).size >= 2, `rotates with the local day (${boo1}, ${boo2}, ${boo3})`);
  await ctx.close();
}
{
  const save = SAVE();
  delete save.inventory.acc_bow;   // zero owned accessories
  const { ctx, page } = await fresh(save);
  const ok = await page.evaluate(() => import('./js/delights.js').then(m => { const b = m.booOfTheDay(); return b && b.acc === null; }));
  assert(ok, 'zero accessories: the star gracefully wears nothing');
  assert(!!(await page.$('.trail-chip.botd')), 'the Boo-of-the-Day chip still renders');
  await ctx.close();
}

// ---- the Parade ----
console.log('== the Parade ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(500);
  await page.click('.t-item[data-item="deco_stage"]', { force: true });
  await page.waitForSelector('.plot-menu', { timeout: 4000 });
  const paradeBtn = await page.$('button:has-text("Parade")');
  assert(!!paradeBtn, 'the Dance Stage menu offers Parade beside Choreograph');
  await page.click('.plot-menu button:has-text("Parade")', { force: true });   // a real tap (menu-tap bug fixed this phase)
  await sleep(400);
  // frame evidence: every placed Boo marches with measurable movement
  const frames = [];
  for (let i = 0; i < 7; i++) {
    frames.push(await page.$$eval('.t-item.boo svg', ns => ns.map(n => n.style.transform || '').join('|')));
    await sleep(520);
  }
  assert(new Set(frames).size >= 6, `the parade marches (${new Set(frames).size}/7 distinct frames over 3.1s)`);
  const xs = frames.map(f => (f.match(/-?\d+\.?\d*/) || [0])[0]).map(Number);
  assert(Math.max(...xs) - Math.min(...xs) > 60, `the line really travels (Δx ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)}px)`);
  // then everyone returns to their spots (test override: parade lasts 4s)
  await sleep(3500);
  const after = await page.$$eval('.t-item.boo svg', ns => ns.map(n => n.style.transform || ''));
  assert(after.every(t => t === '' || /translate\(0(px)?/.test(t)), 'everyone returns to their spots');
  await ctx.close();
}
console.log('== Parade hides with no placed Boos ==');
{
  const save = SAVE();
  save.town = [{ zone: 'meadow', x: 0.5, item: 'deco_stage' }];
  const { ctx, page } = await fresh(save);
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await page.click('.t-item[data-item="deco_stage"]', { force: true });
  await sleep(500);
  assert(!(await page.$('button:has-text("Parade")')), 'no Boos placed → no Parade button');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p9-delights: FAIL' : '\nr4p9-delights: ALL PASS');
process.exit(failed ? 1 : 0);
