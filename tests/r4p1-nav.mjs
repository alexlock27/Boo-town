// tests/r4p1-nav.mjs — RUN4 phase 1 (C1): hardware/gesture back via a history
// guard, the near-unlock nudge, and the four-slot bottom bar that never scrolls.
// Acceptance (RUN4 part D #2, #3): a scripted back press navigates sub-screen →
// parent → hub and never leaves the app; at the hub it does nothing; survives
// reload; the in-round leave confirm is kept; the nudge fires at most once per
// session and only within 10 stars of a locked zone.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = (over = {}) => Object.assign({
  version: 4, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} },
  ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } }, ageAsked: true, age: 8
}, over);

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
const screenName = (page) => page.evaluate(() => document.getElementById('screen').dataset.screen);
const hwBack = async (page) => { await page.evaluate(() => history.back()); await sleep(400); };

// ================= hardware/gesture back =================
console.log('== hardware back: hub does nothing, never leaves ==');
{
  const { ctx, page } = await fresh(SAVE());
  const url0 = page.url();
  await hwBack(page);
  assert((await screenName(page)) === 'hub', 'back at the hub stays on the hub');
  assert(page.url() === url0, 'back at the hub never leaves the page');
  await hwBack(page); await hwBack(page);
  assert((await screenName(page)) === 'hub', 'repeated back at the hub still does nothing');

  console.log('== hardware back: one level, sub-sub → sub → hub ==');
  await page.evaluate(() => window.BooTown.go('studio'));
  await page.waitForSelector('[data-screen="studio"]'); await sleep(250);
  await page.evaluate(() => window.BooTown.go('paint'));
  await sleep(400);
  assert((await screenName(page)) === 'paint', 'reached paint (studio sub-screen)');
  await hwBack(page);
  assert((await screenName(page)) === 'studio', 'hardware back: paint → studio (one level)');
  await hwBack(page);
  assert((await screenName(page)) === 'hub', 'hardware back: studio → hub');
  await hwBack(page);
  assert((await screenName(page)) === 'hub', 'a further back at the hub does nothing');

  console.log('== hardware back: game start card → hub ==');
  await page.evaluate(() => window.BooTown.go('dash'));
  await page.waitForSelector('.picker'); await sleep(200);
  await hwBack(page);
  assert((await screenName(page)) === 'hub', 'hardware back on a start card returns to the hub');

  console.log('== hardware back in-round: leave confirm kept ==');
  await page.evaluate(() => window.BooTown.go('clockshop'));
  await page.waitForSelector('.start-card');
  await page.click('.level-row .level-btn');
  await page.waitForSelector('.clock-face');
  await hwBack(page);
  const dlg = await page.$('.dialog');
  assert(!!dlg, 'hardware back mid-round opens the leave-round confirm');
  const txt = dlg ? await dlg.textContent() : '';
  assert(/Leave this round/.test(txt), 'confirm wording kept');
  // back while the dialog is open must not stack a second dialog
  await hwBack(page);
  const nDlg = await page.$$eval('.dialog', els => els.length);
  assert(nDlg === 1, 'back while a dialog is open does not stack dialogs');
  await page.click('.dialog button:has-text("Keep playing")'); await sleep(300);
  assert((await screenName(page)) === 'clockshop', 'Keep playing stays in the round');
  await hwBack(page);
  await page.waitForSelector('.dialog');
  await page.click('.dialog button:has-text("Leave")');
  await page.waitForSelector('.hub', { timeout: 3000 });
  assert((await screenName(page)) === 'hub', 'Leave returns to the hub');

  console.log('== survives reload ==');
  await page.evaluate(() => window.BooTown.go('town'));
  await sleep(400);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await hwBack(page);
  assert((await screenName(page)) === 'hub', 'after a reload, back still stays in the app');
  assert(/index\.html/.test(page.url()), 'after a reload, back never leaves the page');
  await page.evaluate(() => window.BooTown.go('collection'));
  await sleep(400);
  await hwBack(page);
  assert((await screenName(page)) === 'hub', 'after a reload, back still navigates one level');
  await ctx.close();
}

// ================= bottom bar: 4 slots, no horizontal scroll =================
console.log('== bottom bar cap ==');
for (const vp of [{ width: 1024, height: 768 }, { width: 625, height: 1000 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.bottom-bar');
  const r = await page.$eval('.bottom-bar', n => ({
    slots: n.children.length, scrollW: n.scrollWidth, clientW: n.clientWidth,
    bodyScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth
  }));
  assert(r.slots === 4, `bottom bar holds exactly 4 slots at ${vp.width}x${vp.height}`);
  assert(r.scrollW <= r.clientW + 1, `bottom bar never scrolls horizontally at ${vp.width}x${vp.height}`);
  assert(r.bodyScroll, `page has no horizontal scroll at ${vp.width}x${vp.height}`);
  await ctx.close();
}

// ================= near-unlock nudge =================
console.log('== near-unlock nudge ==');
{
  // 95 stars → Hilltop (100) is 5 away → nudge, once per session
  const { ctx, page } = await fresh(SAVE({ stars: { total: 95, byGame: {} } }));
  const bubble = await page.$eval('.hub .speech-bubble', n => n.textContent);
  assert(/Hilltop/.test(bubble) && /5/.test(bubble), `nudge names the zone and stars-to-go (got: "${bubble}")`);
  await page.evaluate(() => window.BooTown.go('collection')); await sleep(350);
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub .speech-bubble');
  const bubble2 = await page.$eval('.hub .speech-bubble', n => n.textContent);
  assert(!/Hilltop/.test(bubble2), 'nudge fires at most once per session');
  await ctx.close();
}
{
  // 60 stars → nearest locked zone Hilltop is 40 away → no nudge
  const { ctx, page } = await fresh(SAVE({ stars: { total: 60, byGame: {} } }));
  const bubble = await page.$eval('.hub .speech-bubble', n => n.textContent);
  assert(!/Hilltop|Riverside|Beach/.test(bubble), 'no nudge when no zone is within 10 stars');
  await ctx.close();
}
{
  // box waiting beats the nudge (celebration first, no nag stacking)
  const { ctx, page } = await fresh(SAVE({ stars: { total: 95, byGame: {} }, boxes: 1 }));
  const bubble = await page.$eval('.hub .speech-bubble', n => n.textContent);
  assert(!/Hilltop/.test(bubble), 'a ready box suppresses the nudge (boxReady wins)');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p1-nav: FAIL' : '\nr4p1-nav: ALL PASS');
process.exit(failed ? 1 : 0);
