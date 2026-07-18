// Focused RUN10 P12 check: upward-only save, treat pocket, four complete actions,
// personality flavour, reward thresholds and the best-friend portrait.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p12', { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const BOOS = ['boo_inky', 'boo_pippin', 'boo_wisp', 'boo_plum', 'boo_beam', 'boo_peppy'];
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)(new Date());
const AREAS = () => Object.fromEntries(['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'].map(k => [k, { items: [], paths: [] }]));
function save({ boo = 'boo_inky', treats = 5, points = 0, content = 'full' } = {}) {
  const areas = AREAS();
  areas.meadow.items.push({ zone: 'meadow', x: .12, row: 1, item: boo });
  return {
    version: 7, name: 'Ada',
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
    inventory: Object.fromEntries(BOOS.map(id => [id, 1])),
    stars: { total: 100, byGame: {} }, meter: 0, boxes: 0, opened: 2, pity: { commons: 0 },
    town: { areas }, nicknames: {}, equips: {}, catBest: {}, ledger: {}, delights: { hideDay: TODAY, hideFound: true },
    care: { bonds: { [boo]: points }, treats },
    settings: { sound: false, music: false, voice: false, content },
    seen: { boohouseSeeded: true, trophyRetro: true }, trophies: {}, journal: {}, age: content === 'toddler' ? 4 : 8, ageAsked: true
  };
}
const browser = await chromium.launch();
async function openCare({ boo = 'boo_inky', action, treats = 5, points = 0, content = 'full', width = 1024, height = 700 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save({ boo, treats, points, content }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => window.__townLife);
  if (action) {
    await page.click('.t-item.boo');
    await page.click(`.town-care-action.action-${action}`);
    await page.waitForSelector('.care-overlay.open');
    await page.waitForFunction(a => window.__care.active() === a, action);
  }
  return { ctx, page };
}

console.log('== upward-only schema: a long absence changes nothing ==');
{
  const { ctx, page } = await openCare();
  const result = await page.evaluate(async () => {
    const { migrate } = await import('./js/state.js');
    const old = JSON.parse(localStorage.getItem('bootown.save.v1'));
    old.lastPlayed = Date.now() - 30 * 86400000;
    const before = JSON.stringify(old.care);
    const after = JSON.stringify(migrate(structuredClone(old)).care);
    return { before, after };
  });
  ok(result.before === result.after, '30 simulated days away leaves care state deep-equal');
  await ctx.close();
}

console.log('== treat pocket: +1 per round helper, hard cap five ==');
{
  const { ctx, page } = await openCare({ treats: 4 });
  const values = await page.evaluate(async () => {
    const care = await import('./js/care.js');
    const a = care.grantRoundTreat();
    const b = care.grantRoundTreat();
    return { a, b, now: window.__care ? window.__care.treats() : 5 };
  });
  ok(values.a.added === 1 && values.a.after === 5, 'the next completed round adds one treat');
  ok(values.b.added === 0 && values.b.after === 5, 'the pocket silently stays at five');
  await ctx.close();
}

console.log('== Town entry: a Boo opens the staggered four-action flourish ==');
{
  const { ctx, page } = await openCare({ width: 390, height: 844 });
  await page.click('.t-item.boo');
  const count = await page.evaluate(() => window.__townLife.careArcCount());
  ok(count === 1, 'tapping a placed Boo opens one care flourish');
  ok(await page.locator('.town-care-action').count() === 4, 'the flourish contains four care actions');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/r10p12/town-care-arc-390x844.png' });
  await ctx.close();
}

console.log('== Feed: consumes one treat, animation completes, cheeky flavour appears ==');
{
  const { ctx, page } = await openCare({ boo: 'boo_wisp', action: 'feed', treats: 2 });
  const flavour = await page.locator('.care-status').textContent();
  ok(/vanished mid-flight/i.test(flavour), 'cheeky Boo gets the treat-snatch flavour');
  await page.waitForFunction(() => window.__care.points() === 4);
  const state = await page.evaluate(() => ({ points: window.__care.points(), treats: window.__care.treats() }));
  ok(state.points === 4, 'Feed awards four bond points');
  ok(state.treats === 1, 'Feed consumes exactly one treat');
  await page.screenshot({ path: 'screenshots/r10p12/feed-1024x700.png' });
  await ctx.close();
}

console.log('== Brush: three real-length strokes; sleepy flavour ==');
{
  const { ctx, page } = await openCare({ boo: 'boo_pippin', action: 'brush' });
  ok(/yawn/i.test(await page.locator('.care-status').textContent()), 'sleepy Boo yawns into brushing');
  await page.evaluate(() => { window.__care.stroke(70); window.__care.stroke(70); window.__care.stroke(70); });
  await page.waitForFunction(() => window.__care.points() === 3);
  ok(await page.evaluate(() => window.__care.strokes()) === 3, 'exactly three ≥60px strokes complete Brush');
  await ctx.close();
}

console.log('== Teeth: six alternating scrubs; musical flavour ==');
{
  const { ctx, page } = await openCare({ boo: 'boo_beam', action: 'teeth' });
  ok(/rhythm/i.test(await page.locator('.care-status').textContent()), 'musical Boo gets rhythmic tooth brushing');
  await page.evaluate(() => ['left','right','left','right','left','right'].forEach(s => window.__care.scrub(s)));
  await page.waitForFunction(() => window.__care.points() === 3);
  ok(await page.evaluate(() => window.__care.scrubs()) === 6, 'six alternating scrub taps complete Teeth');
  await ctx.close();
}

console.log('== Play: peekaboo completes, sporty flavour ==');
{
  const { ctx, page } = await openCare({ boo: 'boo_peppy', action: 'play' });
  ok(/ready, set/i.test(await page.locator('.care-status').textContent()), 'sporty Boo gets the energetic peekaboo flavour');
  await page.evaluate(() => window.__care.finishPlay());
  ok(await page.evaluate(() => window.__care.points()) === 5, 'Play awards five bond points');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'screenshots/r10p12/play-1024x700.png' });
  await ctx.close();
}

console.log('== friendship rewards: thresholds once; L5 portrait in home and Gallery ==');
{
  const { ctx, page } = await openCare({ boo: 'boo_inky', points: 66 });
  const reward = await page.evaluate(async () => {
    const care = await import('./js/care.js');
    const first = care.addBond('boo_inky', 'feed');
    const second = care.addBond('boo_inky', 'feed');
    const s = JSON.parse(JSON.stringify((await import('./js/state.js')).getState()));
    return {
      first, second,
      portraits: s.town.areas.boohouse.items.filter(t => t.item === 'deco_bffportrait' && t.portraitBoo === 'boo_inky').length,
      rewardKeys: Object.keys(s.seen.careRewards || {}).filter(k => k === 'boo_inky:5').length
    };
  });
  ok(reward.first.crossed.includes(5) && !reward.second.crossed.includes(5), 'best-friend reward crosses exactly once');
  ok(reward.portraits === 1 && reward.rewardKeys === 1, 'one movable portrait is added to the Boo House');
  await page.evaluate(() => window.BooTown.go('town', { area: 'boohouse' }));
  await page.waitForSelector('.t-item[data-item="deco_bffportrait"]');
  ok(await page.locator('.care-portrait-frame').count() === 1, 'the framed Boo appears in the Boo House');
  await page.evaluate(() => window.BooTown.go('gallerymuseum'));
  await page.waitForSelector('.gm-stage');
  ok(await page.evaluate(() => window.__gallery.portraitCount()) === 1, 'the same best-friend portrait appears in the Gallery');
  await page.screenshot({ path: 'screenshots/r10p12/best-friend-gallery-1024x700.png' });
  await ctx.close();
}

console.log('== toddler guidance and care-file guard ==');
{
  const { ctx, page } = await openCare({ action: 'teeth', content: 'toddler' });
  ok(await page.evaluate(() => window.__care.lastGuidance()) === 'Sparkly teeth!', 'Toddler Teeth speaks the authored guidance line');
  await ctx.close();
  const text = readFileSync('js/care.js', 'utf8') + readFileSync('data/care.js', 'utf8');
  const forbidden = ['hun' + 'ger', 'dir' + 'ty', 'sa' + 'd', 'de' + 'cay'].filter(word => new RegExp(`\\b${word}\\w*`, 'i').test(text));
  ok(forbidden.length === 0, `care files contain no downward-state identifiers (${forbidden.join(', ') || 'none'})`);
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
