// tests/r18b-buy-confirm.mjs — RUN18B Y14: a big spend is asked about first.
//
// Ten stars is several rounds' work, and the Buy button sits under her thumb on a shelf she
// is scrolling. A mis-tap used to be final and silent. At or above CONFIRM_AT_STARS = 10 the
// shop now asks; below it, and for anything free, nothing changes — a small purchase she
// meant to make should not have to be made twice. Declining must spend NOTHING.
// Expected runtime: ~12s. Not @serial.

import { chromium } from 'playwright';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 1000, byGame: {}, byType: { maths: 200, word: 200, puzzle: 200, creative: 200, lesson: 200 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, shop: { welcomed: true },
  seen: { trophyRetro: true, lastStarsShown: 1000, introSeen: { shop: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function openShop() {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('shop'));
  await page.waitForFunction(() => !!window.__shop, null, { timeout: 20000 });
  await page.click('.bd-collapsed').catch(() => {});   // the shelves live in the shared drawer
  await sleep(300);
  await page.evaluate(() => window.__shop.showTab('house'));
  await sleep(300);
  return { ctx, page };
}
// the ledgers a purchase is allowed to move, as one string
const ledgers = (page) => page.evaluate(() => {
  const s = window.BooTown.State.getState();
  return JSON.stringify({ spent: s.stars.spent, inventory: s.inventory, total: s.stars.total, byType: s.stars.byType });
});

// ================== 1. the constant, and the two items either side of it ==================
console.log('== 1. CONFIRM_AT_STARS = 10, with a shelf item either side ==');
{
  const { ctx, page } = await openShop();
  const r = await page.evaluate(async () => {
    const { CONFIRM_AT_STARS } = await import('./js/shop.js');
    const { SHELVES } = await import('./data/shop.js');
    const house = SHELVES.find(s => s.id === 'house');
    return { at: CONFIRM_AT_STARS, under: house.items.find(([, c]) => c === 8), over: house.items.find(([, c]) => c === 10) };
  });
  assert(r.at === 10, `CONFIRM_AT_STARS is 10 (${r.at})`);
  assert(!!r.under && !!r.over, `the House shelf stocks one item at 8 and one at 10 to test either side (${JSON.stringify(r.under)} / ${JSON.stringify(r.over)})`);
}

// ================== 2. nine stars: no question, straight through ==================
console.log('== 2. under ten: no confirm, the purchase just happens ==');
{
  const { ctx, page } = await openShop();
  await page.click('.shop-card[data-item="deco_rug"] .sc-buy');
  await sleep(500);
  const r = await page.evaluate(() => ({
    overlay: document.querySelectorAll('.overlay').length,
    owned: (window.BooTown.State.getState().inventory.deco_rug || 0),
    spent: window.BooTown.State.getState().stars.spent.creative || 0
  }));
  assert(r.overlay === 0, `an 8-star item asks nothing (${r.overlay} dialogs)`);
  assert(r.owned >= 1 && r.spent === 8, `and is simply hers, for 8 (owned ${r.owned}, spent ${r.spent})`);
  await ctx.close();
}

// ================== 3. ten stars: the authored card, verbatim ==================
console.log('== 3. at ten: "Spend «N» «Type» Stars on «name»?" ==');
{
  const { ctx, page } = await openShop();
  const before = await ledgers(page);
  await page.click('.shop-card[data-item="deco_lamp2"] .sc-buy');
  await page.waitForSelector('.overlay .dialog', { timeout: 6000 });
  const d = await page.evaluate(() => ({
    title: (document.querySelector('.overlay .dialog h2') || {}).textContent,
    buttons: [...document.querySelectorAll('.overlay .dialog-btns .btn')].map(b => b.textContent),
    screen: document.getElementById('screen').dataset.screen
  }));
  assert(/^Spend 10 Creative Stars on .+\?$/.test(d.title), `the card asks the authored question ("${d.title}")`);
  assert(d.buttons.join(' | ') === 'Yes please! | Not yet', `with the authored buttons in the authored order (${d.buttons.join(' | ')})`);
  assert(d.screen === 'shop', 'and it is asked over the shop, not somewhere else');
  // nothing has been spent while the question is on screen
  assert(await ledgers(page) === before, 'nothing is spent while she is deciding');

  // ---- decline ----
  await page.click('.overlay .dialog-btns .btn:has-text("Not yet")');
  await sleep(500);
  const after = await page.evaluate(() => ({
    overlay: document.querySelectorAll('.overlay').length,
    screen: document.getElementById('screen').dataset.screen,
    stillBuyable: !!document.querySelector('.shop-card[data-item="deco_lamp2"] .sc-buy')
  }));
  assert(after.overlay === 0, 'declining closes the card');
  assert(await ledgers(page) === before, 'and leaves every ledger byte-identical — nothing spent, nothing owned');
  assert(after.screen === 'shop' && after.stillBuyable, 'the shop stays open, with the thing still on the shelf');

  // ---- accept ----
  await page.click('.shop-card[data-item="deco_lamp2"] .sc-buy');
  await page.waitForSelector('.overlay .dialog', { timeout: 6000 });
  await page.click('.overlay .dialog-btns .btn:has-text("Yes please!")');
  await page.waitForFunction(() => (window.BooTown.State.getState().inventory.deco_lamp2 || 0) > 0, null, { timeout: 8000 });
  const spent = await page.evaluate(() => window.BooTown.State.getState().stars.spent.creative || 0);
  assert(spent === 10, `saying yes please spends exactly the ten (${spent})`);
  await ctx.close();
}

// ================== 4. the guard cannot be walked around ==================
console.log('== 4. the confirm is on the path she uses, and the dearer things too ==');
{
  const { ctx, page } = await openShop();
  // a much dearer item asks the same question with its own number
  await page.evaluate(() => window.__shop.showTab('town'));
  await sleep(300);
  const has = await page.$('.shop-card[data-item="deco_pond"] .sc-buy');
  if (has) {
    await page.click('.shop-card[data-item="deco_pond"] .sc-buy');
    await page.waitForSelector('.overlay .dialog', { timeout: 6000 });
    const title = await page.$eval('.overlay .dialog h2', n => n.textContent);
    assert(/^Spend 40 Maths Stars on .+\?$/.test(title), `a 40-star item asks for 40 of its own currency ("${title}")`);
    await page.click('.overlay .dialog-btns .btn:has-text("Not yet")');
    await sleep(300);
  } else {
    assert(false, 'the Town shelf did not offer deco_pond to test a dearer item');
  }
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
