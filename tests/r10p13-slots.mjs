// Focused RUN10 P13 check: slot migration/exclusivity, costume sets and town life.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p13', { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const BOO = 'boo_inky';
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)(new Date());
const AREAS = () => Object.fromEntries(['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'].map(k => [k, { items: [], paths: [] }]));
function save(equips = {}, inventory = {}) {
  const areas = AREAS();
  areas.meadow.items.push({ zone: 'meadow', x: .2, row: 1, item: BOO });
  return {
    version: 8, name: 'Ada',
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
    inventory: { [BOO]: 1, ...inventory }, stars: { total: 50, byGame: {} }, boxes: 0, meter: 0, opened: 2,
    pity: { commons: 0 }, town: { areas }, nicknames: {}, equips, catBest: {}, ledger: {}, care: { bonds: {}, treats: 0 },
    settings: { sound: false, music: false, voice: false, content: 'full' },
    seen: { trophyRetro: true, boohouseSeeded: true }, delights: { hideDay: TODAY, hideFound: true },
    trophies: {}, journal: {}, age: 8, ageAsked: true
  };
}
const browser = await chromium.launch();
async function fresh(seed = save(), viewport = { width: 1024, height: 700 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), seed);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

console.log('== schema migration and slot exclusivity ==');
{
  const { ctx, page } = await fresh();
  const result = await page.evaluate(async () => {
    const state = await import('./js/state.js');
    const acc = await import('./js/accessories.js');
    const old = state.migrate({ version: 7, equips: { boo_inky: 'acc_heartglasses', boo_plum: 'acc_cape' } });
    acc.equip('boo_inky', 'acc_starcheek');
    acc.equip('boo_inky', 'acc_wizardhat');
    acc.equip('boo_inky', 'acc_wellies');
    acc.equip('boo_inky', 'acc_heartcheek');
    return { migrated: old.equips, worn: acc.equippedIds('boo_inky'), art: acc.equippedArt('boo_inky') };
  });
  ok(result.migrated.boo_inky.face === 'acc_heartglasses' && result.migrated.boo_plum.hat === 'acc_cape', 'legacy single equips migrate into their authored slots');
  ok(result.worn.hat === 'acc_wizardhat' && result.worn.face === 'acc_heartcheek' && result.worn.feet === 'acc_wellies', 'one item per slot; same-slot equip swaps without touching other slots');
  ok(Object.keys(result.art).sort().join(',') === 'face,feet,hat', 'rendering receives all three slot art keys');
  await ctx.close();
}

console.log('== authored catalogue, dress-up drawer and atomic set ==');
{
  const inventory = Object.fromEntries([
    'acc_bow','acc_starcheek','acc_rollerskates','acc_set_builder','acc_set_chef'
  ].map(id => [id, 1]));
  const { ctx, page } = await fresh(save({}, inventory), { width: 390, height: 844 });
  const catalogue = await page.evaluate(async () => {
    const { BY_ID, BY_TYPE_RARITY } = await import('./data/catalogue.js');
    const ids = ['acc_starcheek','acc_rainbowstripe','acc_whiskers','acc_heartcheek','acc_rollerskates','acc_wellies','acc_set_police','acc_set_builder','acc_set_chef','acc_set_explorer'];
    return {
      valid: ids.every(id => BY_ID[id] && ['rare','ultra'].includes(BY_ID[id].rarity)),
      ultraPool: (BY_TYPE_RARITY.accessory.ultra || []).map(x => x.id)
    };
  });
  ok(catalogue.valid, 'all four face items, both feet items and four sets have the authored rarities');
  ok(['acc_rollerskates','acc_set_police','acc_set_builder','acc_set_chef','acc_set_explorer'].every(id => catalogue.ultraPool.includes(id)), 'ultra feet/set cards join the accessory drop pool');
  await page.evaluate(async () => {
    const { openDressUp } = await import('./js/accessories.js');
    const { BY_ID } = await import('./data/catalogue.js');
    openDressUp(BY_ID.boo_inky);
  });
  await page.waitForSelector('.acc-dress-card');
  ok((await page.locator('.bd-tab').allTextContents()).join('|') === 'Hats|Face|Feet|Sets', 'dress-up uses the four-tab shared drawer');
  ok(await page.locator('.acc-fit-preview svg').count() === 1, 'current-fit preview is large and live');
  await page.evaluate(() => window.__dressup.equip('acc_set_builder'));
  ok(await page.locator('.costume-transform').count() === 1, 'first set equip plays its 600ms transformation ceremony');
  const atomic = await page.evaluate(() => window.__dressup.worn());
  ok(/^set:acc_set_builder:/.test(atomic.hat) && /^set:acc_set_builder:/.test(atomic.face), 'Builder set equips helmet and hammer atomically');
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__dressup.unequip('face'); window.__dressup.equip('acc_set_builder'); });
  ok(await page.locator('.costume-transform').count() === 0, 'the one-time set ceremony does not replay');
  await page.evaluate(() => window.__dressup.unequip('face'));
  const split = await page.evaluate(() => window.__dressup.worn());
  ok(!!split.hat && !split.face, 'set pieces can be unequipped one slot at a time');
  await page.evaluate(() => { window.__dressup.tab('set'); window.__dressup.open(); });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'screenshots/r10p13/dressup-390x844.png' });
  await ctx.close();
}

console.log('== face anchors render across species ==');
{
  const { ctx, page } = await fresh();
  const boxes = await page.evaluate(async () => {
    const { renderItem } = await import('./js/art.js');
    const { BY_ID } = await import('./data/catalogue.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0';
    document.body.appendChild(host);
    const species = ['boo_inky','boo_pippin','boo_peppy'];
    const faces = ['starcheek','rainbowstripe','whiskers','heartcheek'];
    return species.flatMap(id => faces.map(face => {
      host.innerHTML = renderItem(BY_ID[id], { size: 160, equipArt: { face } });
      const svg = host.querySelector('svg');
      const box = svg.getBBox();
      return { id, face, x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height };
    }));
  });
  ok(boxes.every(b => b.x >= -2 && b.right <= 122 && b.y >= -18 && b.bottom <= 132), 'all four cheek patterns remain on-canvas across three species');
  await ctx.close();
}

console.log('== glide, rain stomp and costume idle ==');
{
  const skateSave = save({ [BOO]: { feet: 'acc_rollerskates' } }, { acc_rollerskates: 1 });
  const { ctx, page } = await fresh(skateSave);
  await page.evaluate(day => { window.__bootownDay = day; window.BooTown.go('town', { area: 'meadow' }); }, TODAY);
  await page.waitForFunction(() => window.__townLife);
  const skateState = await page.evaluate(() => window.__townLife.outfitDebug(0));
  ok(skateState && skateState.locomotion === 'glide', `roller skates select glide locomotion (${JSON.stringify(skateState)})`);
  await page.evaluate(() => { window.__townLife.forceWalk(0); window.__townLife.stepActors(200); });
  ok(/rotate\(7deg\)/.test(await page.evaluate(() => window.__townLife.transform(0))), 'glide movement visibly leans instead of waddling');
  await ctx.close();

  const wellieSave = save({ [BOO]: { feet: 'acc_wellies' } }, { acc_wellies: 1 });
  const rain = await fresh(wellieSave);
  await rain.page.evaluate(day => { window.__bootownDay = day; window.__bootownWeather = 'rain'; window.BooTown.go('town', { area: 'meadow' }); }, TODAY);
  await rain.page.waitForFunction(() => window.__townLife);
  await rain.page.evaluate(() => { window.__townLife.renderWeather(); window.__townLife.forceWalk(0); });
  await rain.page.waitForTimeout(280);
  ok(await rain.page.evaluate(() => window.__townLife.weather().season) === 'rain', 'simulated rain weather renders');
  const rainState = await rain.page.evaluate(() => ({ drops: window.__townLife.wellieDrops(), bursts: window.__townLife.wellieBursts(0), outfit: window.__townLife.outfitDebug(0) }));
  ok(rainState.bursts > 0 && rainState.drops === rainState.bursts * 3, `each wellie stomp lands exactly three droplets (${JSON.stringify(rainState)})`);
  await rain.ctx.close();

  const builder = save({ [BOO]: { hat: 'set:acc_set_builder:builderhelmet', face: 'set:acc_set_builder:builderhammer' } }, { acc_set_builder: 1 });
  const idle = await fresh(builder);
  await idle.page.evaluate(day => { window.__bootownDay = day; window.BooTown.go('town', { area: 'meadow' }); }, TODAY);
  await idle.page.waitForFunction(() => window.__townLife);
  const delays = await idle.page.evaluate(async () => {
    const { costumeIdleDelay } = await import('./js/accessories.js');
    return [costumeIdleDelay(() => 0), costumeIdleDelay(() => .5), costumeIdleDelay(() => 1)];
  });
  ok(delays[0] === 20000 && delays[1] === 30000 && delays[2] === 40000, 'builder/chef idle cadence is bounded to 20–40 seconds');
  const idleState = await idle.page.evaluate(() => ({ kind: window.__townLife.costumeIdle(0), outfit: window.__townLife.outfitDebug(0) }));
  ok(idleState.kind === 'hammer', `Builder performs the two-tap hammer idle (${JSON.stringify(idleState)})`);
  ok(await idle.page.locator('.boo-svg.costume-hammer-taps').count() === 1, 'hammer idle has a visible animation frame');
  await idle.ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
