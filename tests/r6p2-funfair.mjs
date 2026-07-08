// tests/r6p2-funfair.mjs — RUN6 phase 2: the Boo Funfair (C1b).
// Acceptance (RUN6 part D #3): unlocks at 280 with a silhouette beforehand; each
// ride's loop animates with multiple Boos aboard; the picker boards + removes a
// chosen Boo; an autonomous Boo boards an empty seat; milestone rides arrive via the
// Boo Builders under simulated star totals; string lights glow at 21:00; the fair
// jingle logs scheduling and obeys the mute.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r6p2', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot', 'fuzz', 'puff'].map(n => 'boo_' + n);

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])), boxes: 0, meter: 0, opened: 10, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 300, byGame: {} }, ledger: {},
  delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside', 'hilltop', 'beach', 'funfair'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openTown(save, { hour = 13 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((h) => { window.__bootownHour = h; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(400);
  return { ctx, page };
}
const distinct = arr => new Set(arr).size;
const ALL_RIDES = ['carousel', 'ferris', 'teacups', 'bouncy', 'helter'];
const SEATS = { carousel: [BOOS[0], BOOS[1], null], ferris: [BOOS[2], BOOS[3], null, null], teacups: [BOOS[4], BOOS[5], null, null], bouncy: [BOOS[6], BOOS[7], null], helter: [BOOS[8], BOOS[9], null] };

// ==================== unlock at 280 + silhouette beforehand ====================
console.log('== unlocks at 280, silhouette while locked ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 200, byGame: {} }, seen: { zonesUnlocked: ['meadow', 'riverside', 'hilltop'], introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }));
  assert(await page.evaluate(() => window.__townLife.ffUnlocked()) === false, 'funfair locked below 280 stars');
  assert(await page.$('.ff-silhouette'), 'a ferris-wheel silhouette shows on the locked funfair');
  assert((await page.$$('.ff-ride')).length === 0, 'no rides render while locked');
  await ctx.close();
}
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 300, byGame: {} } }));
  assert(await page.evaluate(() => window.__townLife.ffUnlocked()) === true, 'funfair unlocked at 300 stars');
  const view = await page.evaluate(() => window.__townLife.ffView());
  assert(view.built.includes('carousel'), 'the Carousel is ready the moment the gates open');
  await sleep(400);
  assert(await page.$('.ff-ride[data-ride="carousel"]'), 'the Carousel renders in the funfair');
  await ctx.close();
}

// ==================== each ride's loop with multiple Boos aboard ====================
console.log('== each ride animates with riders aboard ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 520, byGame: {} }, funfair: { built: ALL_RIDES.slice(), build: null, pending: [], seats: SEATS } }));
  await page.evaluate(() => window.__townLife.scrollToFunfair());
  await sleep(700);
  for (const ride of ALL_RIDES) {
    const filled = await page.evaluate(r => window.__townLife.ffRideSeats(r).filter(Boolean).length, ride);
    assert(filled >= 2, `${ride}: multiple Boos aboard (${filled})`);
    const fr = [];
    for (let k = 0; k < 6; k++) { fr.push((await page.evaluate(r => window.__townLife.ffSeatTransforms(r), ride)).join('|')); await sleep(500); }
    assert(distinct(fr) >= 3, `${ride}: composed loop animates (${distinct(fr)}/6 distinct frames)`);
  }
  await page.screenshot({ path: 'screenshots/r6p2/funfair-day-1000x640.png' });
  await ctx.close();
}

// ==================== picker boards + removes a chosen Boo ====================
console.log('== who\'s-riding picker boards + removes ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 300, byGame: {} }, funfair: { built: ['carousel'], build: null, pending: [], seats: {} } }));
  await page.evaluate(() => window.__townLife.ffOpenPicker('carousel'));
  await page.waitForSelector('.ride-picker .rp-tile');
  // board the first Boo
  await page.click('.ride-picker .rp-tile:not([disabled])');
  await sleep(150);
  const seated = await page.evaluate(() => window.__townLife.ffRideSeats('carousel').filter(Boolean).length);
  assert(seated === 1, `tapping a Boo boards it (${seated} aboard)`);
  // remove it (tap the aboard tile)
  await page.click('.ride-picker .rp-tile.aboard');
  await sleep(150);
  const after = await page.evaluate(() => window.__townLife.ffRideSeats('carousel').filter(Boolean).length);
  assert(after === 0, 'tapping the aboard Boo removes it from the seat');
  await ctx.close();
}

// ==================== autonomous boarding ====================
console.log('== an autonomous Boo boards an empty seat ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 300, byGame: {} }, funfair: { built: ['carousel'], build: null, pending: [], seats: {} }, town: [{ zone: 'funfair', x: 0.18, item: BOOS[0] }] }));
  await page.evaluate(() => window.__townLife.scrollToFunfair());
  await sleep(400);
  const started = await page.evaluate(() => window.__townLife.force(0, 'board'));
  assert(started === 'board', 'the funfair Boo heads for the ride');
  let boarded = false;
  for (let k = 0; k < 24 && !boarded; k++) { if (await page.evaluate(() => window.__townLife.ffRideSeats('carousel').filter(Boolean).length) > 0) boarded = true; await sleep(250); }
  assert(boarded, 'reaching the Carousel, the autonomous Boo takes an empty seat');
  await ctx.close();
}

// ==================== milestone rides via the Boo Builders ====================
console.log('== milestone rides arrive via the Boo Builders (24h) ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 300, byGame: {} }, funfair: { built: ['carousel'], build: null, pending: [], seats: {} } }));
  const res = await page.evaluate(async () => {
    const F = await import('./js/funfair.js');
    const S = window.BooTown.State;
    S.mutate(st => { st.stars.total = 340; st.funfair = { built: ['carousel'], build: null, pending: [], seats: {} }; });
    window.__bootownNow = 1000000;
    F.tickFunfair();
    const building = (S.getState().funfair.build || {}).ride || null;
    window.__bootownNow = 1000000 + F.FUNFAIR_BUILD_MS + 5000;   // +24h
    const t2 = F.tickFunfair();
    const ready = t2.readyToReveal;
    if (ready) F.completeRideReveal(ready);
    return { building, ready, built: F.funfairView().built };
  });
  assert(res.building === 'ferris', `crossing 340 stars starts building the Ferris Wheel (got ${res.building})`);
  assert(res.ready === 'ferris', 'after 24h the Ferris Wheel is ready to reveal');
  assert(res.built.includes('ferris'), 'the reveal adds the Ferris Wheel to the built rides');
  await ctx.close();
}

// ==================== string lights glow at 21:00 ====================
console.log('== string lights glow at night ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 520, byGame: {} }, funfair: { built: ALL_RIDES.slice(), build: null, pending: [], seats: SEATS } }), { hour: 21 });
  const night = await page.$('.ff-scenery.night');
  assert(night, 'the funfair scenery is in its night state at 21:00');
  const glowing = await page.$eval('.ff-scenery.night .ff-bulb', el => getComputedStyle(el).animationName !== 'none');
  assert(glowing, 'the string lights twinkle/glow at night');
  await page.evaluate(() => window.__townLife.scrollToFunfair());
  await sleep(800);
  await page.screenshot({ path: 'screenshots/r6p2/funfair-night-1000x640.png' });
  await ctx.close();
}

// ==================== fair jingle logs + obeys mute ====================
console.log('== fair jingle: scheduling + mute obedience ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 300, byGame: {} } }));
  const on = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setAudioLog(true); sfx.initAudio(); sfx.setMusicEnabled(true);
    window.__townLife.scrollToFunfair();
    await new Promise(r => setTimeout(r, 1100));
    const zone = window.__townLife.zoneMusic();
    const notes = sfx.getAudioLog().filter(e => e.kind === 'note' && e.bus === 'music').length;
    return { zone, notes };
  });
  assert(on.zone === 'fair', 'the fair jingle takes over while the funfair is on screen');
  assert(on.notes > 0, `the jingle schedules notes on the music bus (${on.notes})`);
  const muted = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setMusicEnabled(false); sfx.setAudioLog(true);
    await new Promise(r => setTimeout(r, 500));
    return sfx.getAudioLog().filter(e => e.kind === 'note' && e.bus === 'music').length;
  });
  assert(muted === 0, `muting music silences the jingle (${muted} new music notes)`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
