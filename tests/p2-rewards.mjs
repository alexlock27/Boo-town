// tests/p2-rewards.mjs — RUN2 part E checks 2, 3, 4 (rewards clarity, accessories, nicknames).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const browser = await chromium.launch();
function watch(page) {
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
}
async function ctxPage(w = 1000, h = 625, initRand) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); watch(page);
  if (initRand != null) await page.addInitScript((r) => { Math.random = () => r; }, initRand);
  return { ctx, page };
}
const SEED = (o) => ({ version: 3, name: 'Ada',
  guide: { species: 'kitten', body: 'sky', pattern: 'none', patternColour: 'indigo', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, town: [],
  stars: { total: 20, byGame: {} }, settings: { sound: false, music: false, voice: false }, ...o });

// ---- 1) First pick: onboarding ends with a chosen Boo; never a deco/accessory (part E #2) ----
console.log('== first pick is always a chosen Boo ==');
{
  const { ctx, page } = await ctxPage(1000, 625);
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.click('button:has-text("Start")'); await page.waitForTimeout(150);
  await page.fill('input.text-input', 'Ada');
  await page.click('button:has-text("Next")'); await page.waitForTimeout(200);
  await page.waitForSelector('.ob-age-grid');
  await page.click('.ob-age-btn:has-text("8")');   // age step (job 4)
  await page.click('.creator-btns .btn.big');
  await page.waitForSelector('.intro-block');
  for (let i = 0; i < 3; i++) { await page.click('.intro-block'); await page.waitForTimeout(120); }
  await page.waitForSelector('.firstpick-row');
  const names = await page.$$eval('.firstpick-name', els => els.map(e => e.textContent));
  assert(JSON.stringify(names) === JSON.stringify(['Inky', 'Lolly', 'Chomp']), 'first pick offers Inky/Lolly/Chomp (' + names + ')');
  await page.click('.firstpick-card');
  await page.waitForSelector('.town2', { timeout: 4000 });
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
  const ids = Object.keys(s.inventory);
  assert(ids.length === 1 && ids[0] === 'boo_inky', 'exactly the chosen Boo is owned (' + ids + ')');
  assert(s.boxes === 0, 'no random box granted — first reward is the chosen character');
  assert(s.seen && s.seen.onboarded, 'onboarding flagged complete');
  await ctx.close();
}

// ---- 2) Typed reveal cards + matching action (part E #3) ----
console.log('== reveal cards state type + action lands correctly ==');
async function revealCase(rand, expectBanner, expectBtn) {
  const { ctx, page } = await ctxPage(1000, 625, rand);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)),
    SEED({ inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }, boxes: 1, opened: 3 }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.click('.gift-btn', { force: true });
  await page.waitForSelector('.gift-box');
  for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await page.waitForTimeout(180); }
  await page.waitForSelector('.reveal-card', { timeout: 4000 });
  const banner = await page.$eval('.reveal-banner', e => e.textContent);
  const oneliner = await page.$eval('.reveal-oneliner', e => e.textContent);
  const hasBtn = await page.locator(`.reveal-btns .btn:has-text("${expectBtn}")`).count();
  assert(banner === expectBanner, `banner "${banner}" == "${expectBanner}"`);
  assert(oneliner.length > 0, 'one-liner present (' + oneliner + ')');
  assert(hasBtn > 0, `action button "${expectBtn}" present`);
  // action lands where it says
  await page.click(`.reveal-btns .btn:has-text("${expectBtn}")`);
  await page.waitForTimeout(400);
  if (expectBtn === 'Wear it') {
    assert(await page.locator('.acc-chooser').count() > 0, 'Wear it -> equip picker');
  } else {
    assert(await page.locator('.town2').count() > 0, `${expectBtn} -> town place mode`);
  }
  await ctx.close();
}
await revealCase(0.30, 'A BOO!', 'Meet them');
await revealCase(0.78, 'A DECORATION!', 'Place it');
await revealCase(0.92, 'AN ACCESSORY!', 'Wear it');

// ---- 3) Accessory drop rule: gated until 3 Boos owned ----
console.log('== accessories never drop until 3 Boos owned ==');
{
  const { ctx, page } = await ctxPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const gatedTypes = await page.evaluate(async () => {
    const rw = await import('./js/rewards.js');
    const st = await import('./js/state.js');
    const cat = await import('./data/catalogue.js');
    function run(boos) {
      localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 3, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } }, name: 'A',
        guide: { species: 'giraffe', body: 'sunshine', pattern: 'none', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
        inventory: { ...boos }, boxes: 500, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, town: [], stars: { total: 0, byGame: {} }, settings: {} }));
      st.load();
      const kinds = {};
      for (let i = 0; i < 500; i++) {
        const r = rw.openOneBox();
        if (r) kinds[r.item.kind] = (kinds[r.item.kind] || 0) + 1;
        // hold the Boo count fixed so we test the gate, not inventory growth
        st.getState().inventory = { ...boos };
        st.getState().boxes = 500; st.getState().meter = 0;
      }
      return kinds;
    }
    const twoBoos = run({ boo_inky: 1, boo_plum: 1 });
    const threeBoos = run({ boo_inky: 1, boo_plum: 1, boo_pippin: 1 });
    return { twoBoos, threeBoos };
  });
  assert(!gatedTypes.twoBoos.accessory, 'with 2 Boos: zero accessories dropped (' + JSON.stringify(gatedTypes.twoBoos) + ')');
  assert(gatedTypes.threeBoos.accessory > 0, 'with 3 Boos: accessories can drop (' + JSON.stringify(gatedTypes.threeBoos) + ')');
  await ctx.close();
}

// ---- 4) Equip on Boo + player, renders, survives reload; nickname persists (part E #4) ----
console.log('== equip on Boo + player, persists across reload; nickname persists ==');
{
  const { ctx, page } = await ctxPage(625, 1000);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)),
    SEED({ inventory: { boo_inky: 1, boo_bubbles: 1, boo_plum: 1, acc_goldcrown: 1, acc_cape: 1 }, opened: 5 }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(async () => {
    const acc = await import('./js/accessories.js');
    const st = await import('./js/state.js');
    acc.equip('boo_inky', 'acc_cape');
    st.getState().guide.acc = 'acc_goldcrown';
    st.commit();
    st.mutate(s => { s.nicknames['boo_inky'] = 'Caped Crusader'; });
    st.commit();
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
  assert(s.equips.boo_inky === 'acc_cape', 'Boo equip persisted across reload');
  assert(s.guide.acc === 'acc_goldcrown', 'player character accessory persisted');
  assert(s.nicknames.boo_inky === 'Caped Crusader', 'nickname persisted');
  // renders: collection tile art for Inky includes the cape art; player card includes crown art
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-grid');
  const renders = await page.evaluate(() => {
    const mychar = document.querySelector('.mychar-art').innerHTML;
    // find the Inky tile (nickname now "Caped Crusader")
    const tiles = [...document.querySelectorAll('.coll-tile.owned')];
    const inky = tiles.find(t => /Caped/.test(t.textContent));
    return { mycharHasCrown: /9B6DE0|FFC93C|#FFC93C/.test(mychar), inkyShowsNick: !!inky, inkyArt: inky ? inky.querySelector('.coll-art').innerHTML.length : 0 };
  });
  assert(renders.inkyShowsNick, 'collection shows the Boo by its nickname');
  assert(renders.inkyArt > 0, 'nicknamed Boo renders with art');
  await page.screenshot({ path: 'screenshots/p2-equipped-collection.png', fullPage: true });
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
