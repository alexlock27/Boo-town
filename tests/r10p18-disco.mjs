// Focused RUN10 P18 check: Funfair door, audio-clock bars, personality dance and saved routines.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p18', { recursive: true });
let failed = false;
const ok = (condition, message) => {
  console.log(condition ? `  ✓ ${message}` : `  ✗ FAIL: ${message}`);
  if (!condition) failed = true;
};
const BOOS = ['boo_inky', 'boo_pippin', 'boo_wisp', 'boo_plum', 'boo_beam', 'boo_peppy'];
const AREAS = Object.fromEntries(['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'].map(k => [k, { items: [], paths: [] }]));
const seed = {
  version: 8, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: Object.fromEntries(BOOS.map(id => [id, 1])),
  stars: { total: 80, byGame: {} }, boxes: 0, meter: 0, opened: 4, pity: { commons: 0 },
  town: { areas: AREAS }, nicknames: {}, equips: {}, catBest: {}, ledger: {},
  care: { bonds: {}, treats: 0 }, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { trophyRetro: true, boohouseSeeded: true }, delights: {}, trophies: {}, journal: {},
  routines: { 'meadow:0.3': ['bounce', 'spin', 'freeze'] }
};

const browser = await chromium.launch();
async function open(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(value => localStorage.setItem('bootown.save.v1', JSON.stringify(value)), seed);
  await page.reload({ waitUntil: 'load' });
  return { context, page };
}

console.log('== Funfair door and authored hall ==');
{
  const { context, page } = await open({ width: 1180, height: 760 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'funfair' }));
  await page.waitForFunction(() => window.__townLife?.hasDiscoDoor());
  const before = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bootown.save.v1')).town.areas.funfair));
  ok(await page.locator('.ff-disco-door').count() === 1, 'Funfair has one glowing DISCO entrance');
  await page.evaluate(() => window.BooTown.go('discohall'));
  await page.waitForFunction(() => window.__disco);
  ok(await page.locator('.disco-tile').count() === 24, 'dance floor is a 6 × 4 grid');
  ok(await page.locator('.disco-ball i').count() === 25, 'mirrored ball has individually lit facets');
  ok(await page.locator('.disco-dancer').count() === BOOS.length, 'every present Boo joins the dance');

  await page.waitForFunction(() => window.__disco.barLog().length > 0);
  const bar = await page.evaluate(() => window.__disco.barLog()[0]);
  ok(Math.abs(bar.error) <= 40, `first bar lands within ±40ms of the audio clock (${bar.error.toFixed(1)}ms)`);
  const moves = await page.evaluate(() => { window.__disco.forceBar(); return window.__disco.dancerMoves(); });
  const expected = { bouncy:'bounce', sleepy:'sway', cheeky:'spin', shy:'sway-small', musical:'shimmy', sporty:'star-jump' };
  ok(moves.every(({ personality, move }) => expected[personality] === move), 'each personality gets its authored dance');
  ok(new Set(await page.evaluate(() => window.__disco.tileHues())).size === 24, 'all 24 tiles receive bar-linked hues');

  const tracks = await page.evaluate(() => {
    const ids = [window.__disco.track()];
    for (let i = 0; i < 3; i++) { window.__disco.cycleTrack(); ids.push(window.__disco.track()); }
    return ids;
  });
  ok(new Set(tracks).size === 4, 'track chip cycles all four Boo Pop Hits');
  await page.evaluate(() => window.__disco.playRoutine('meadow:0.3'));
  await page.waitForFunction(() => window.__disco.routineLog().length === 3);
  const routine = await page.evaluate(() => ({ log: window.__disco.routineLog(), mode: window.__disco.mode() }));
  ok(routine.log.map(x => x.move).join('|') === 'bounce|spin|freeze', 'saved poster replays its routine event-for-event');
  await page.waitForFunction(() => window.__disco.mode() === 'free');
  ok(await page.locator('.disco-dancers.routine').count() === 0, 'dancers return to free dance after the poster routine');
  await page.screenshot({ path: 'screenshots/r10p18/hall-1180x760.png' });
  await page.evaluate(() => window.BooTown.go('town', { area: 'funfair' }));
  await page.waitForFunction(() => window.__townLife?.hasDiscoDoor());
  const after = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bootown.save.v1')).town.areas.funfair));
  ok(after === before, 'entering and leaving preserves the Funfair state exactly');
  await context.close();
}

console.log('== phone and reduced motion ==');
{
  const { context, page } = await open({ width: 390, height: 844 }, 'reduce');
  await page.evaluate(() => window.BooTown.go('discohall'));
  await page.waitForFunction(() => window.__disco);
  const reduced = await page.evaluate(() => {
    window.__disco.forceBar();
    return { flag: window.__disco.reduced(), moves: window.__disco.dancerMoves() };
  });
  ok(reduced.flag && reduced.moves.every(x => x.move === 'sway'), 'reduced motion keeps only the slow sway');
  await page.screenshot({ path: 'screenshots/r10p18/hall-390x844.png' });
  await context.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
