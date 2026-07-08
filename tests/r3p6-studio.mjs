// tests/r3p6-studio.mjs — RUN3 phase 6: Boo Studio (acceptance D14, D15).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }, boxes: 0, meter: 0, opened: 3, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 200, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: null, goldenLastDouble: '', quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, journal: {}, customs: [], studioSeen: false, easelArt: '', settings: { sound: false, music: false, voice: false }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true }, trophies: { medal_stars_100: '2026-07-01', trophy_zones: '2026-07-01', trophy_custom: '2026-07-01' } };
// a tiny 1x1 PNG data URL
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
async function boot() {
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
}
await boot();
// clear IndexedDB artworks for a clean start
await page.evaluate(async () => { const m = await import('./js/idb.js'); await m.idbClear('artworks').catch(() => {}); });

// ---- D14: an artwork survives reload ----
console.log('== D14: artwork persists across reload ==');
const saveRes = await page.evaluate(async (png) => { const m = await import('./js/studio.js'); return m.saveArtwork(png, 'paint'); }, PNG);
assert(saveRes.ok, 'artwork saved to IndexedDB');
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
const afterReload = await page.evaluate(async () => { const m = await import('./js/studio.js'); return (await m.listArtworks()).length; });
assert(afterReload >= 1, 'the artwork is still there after a full reload (' + afterReload + ')');

// ---- D14: gallery cap (20) prompts kindly ----
console.log('== D14: gallery cap ==');
const capRes = await page.evaluate(async (png) => {
  const m = await import('./js/studio.js');
  await (await import('./js/idb.js')).idbClear('artworks');
  for (let i = 0; i < m.GALLERY_CAP; i++) await m.saveArtwork(png, 'paint');
  const over = await m.saveArtwork(png, 'paint');   // 21st
  return { count: (await m.listArtworks()).length, over };
}, PNG);
assert(capRes.count === 20 && capRes.over.full === true, 'the 21st save is blocked with a kind "full" prompt (cap 20)');

// ---- D14: the easel displays a chosen artwork in the town ----
console.log('== D14: easel shows art in town ==');
await page.evaluate(async () => {
  const st = await import('./js/state.js');
  const m = await import('./js/studio.js');
  const arts = await m.listArtworks();
  st.mutate(s => { s.inventory['deco_easel'] = 1; s.town = [{ zone: 'meadow', x: 0.5, item: 'deco_easel' }]; s.easelArt = arts[0].id; s.studioSeen = true; });
});
await page.evaluate(() => window.BooTown.go('town'));
await page.waitForSelector('.town2');
await page.waitForTimeout(600);
const easelPhoto = await page.$$eval('.t-item[data-item="deco_easel"] image.easel-photo', n => n.length);
assert(easelPhoto >= 1, 'the placed Easel shows the chosen artwork (' + easelPhoto + ' photo layer)');

// ---- D15: custom Boo cap of 5 ----
console.log('== D15: Build-a-Boo cap of 5 ==');
const cap = await page.evaluate(async () => {
  const c = await import('./js/customs.js');
  const st = await import('./js/state.js');
  st.mutate(s => { s.customs = []; });
  for (let i = 0; i < 6; i++) c.addSealedCustom({ body: 'round', colour: '#FF7AC6' }, 'B' + i);
  return { sealed: c.sealedCustoms().length, canSeal: c.canSeal() };
});
assert(cap.sealed === 5 && cap.canSeal === false, 'at most 5 customs can be sealed (' + cap.sealed + ')');

// ---- D15: the 10% slice + special banner + leaves the pool after winning ----
console.log('== D15: custom drops, banner, leaves pool ==');
const sliceOk = await page.evaluate(async () => (await import('./js/rewards.js')).CUSTOM_SLICE === 0.10);
assert(sliceOk, 'the custom slice constant is 10%');
// reset to exactly one unwon custom, give a box, force the drop, open via the ceremony
await page.evaluate(async () => {
  const st = await import('./js/state.js');
  const c = await import('./js/customs.js');
  st.mutate(s => { s.customs = []; s.boxes = 1; s.inventory = { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }; });
  c.addSealedCustom({ body: 'blob', ears: 'tall', eyes: 'star', colour: '#35D0BA' }, 'Zap');
  window.__forceCustomDrop = true;
});
const unwonBefore = await page.evaluate(async () => (await import('./js/customs.js')).unwonCustoms().length);
assert(unwonBefore === 1, 'one sealed custom is in the pool before winning');
await page.evaluate(() => window.BooTown.go('ceremony'));
await page.waitForSelector('.gift-box, .ceremony-box, .ceremony-stage');
const box = await page.$('.gift-box') || await page.$('.ceremony-box') || await page.$('.ceremony-stage button');
for (let t = 0; t < 3; t++) { if (box) await box.click({ force: true }).catch(() => {}); await sleep(300); }
await page.waitForSelector('.reveal-card', { timeout: 4000 });
await sleep(300);
const banner = await page.$eval('.reveal-banner', n => n.textContent).catch(() => '');
assert(/YOUR BOO/i.test(banner), 'the custom win shows the special banner ("It\'s YOUR Boo!"): ' + JSON.stringify(banner));
const afterWin = await page.evaluate(async () => { const c = await import('./js/customs.js'); const s = window.BooTown.State.getState(); return { unwon: c.unwonCustoms().length, owned: Object.keys(s.inventory).filter(id => id.startsWith('custom:')).length }; });
assert(afterWin.unwon === 0, 'after winning, the custom leaves the pool');
assert(afterWin.owned === 1, 'the won custom now lives in the inventory (collection + town)');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
