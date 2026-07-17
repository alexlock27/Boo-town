// tests/r7p1-funfair.mjs — RUN7 phase 1: open the funfair and the band (C1).
// Acceptance (RUN7 part D #1): a brand-new save reaches the OPEN fair and plays every
// day-one element (Carousel, booth, lights at simulated night, band watch + all three
// instruments, record-a-jam) with the grand-opening ceremony firing EXACTLY once; an
// existing save past a ride milestone starts its queued construction on first load;
// milestone rides arrive under simulated totals of 80/140/200/260; NO band feature is
// reachable-gated by stars anywhere.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r7p1', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow'].map(n => 'boo_' + n);

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])), boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 0, byGame: {} }, ledger: {},
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openTown(save, { hour = 13, w = 1000, h = 640, area = 'funfair' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((hr) => { window.__bootownHour = hr; }, hour);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate((a) => window.BooTown.go('town', { area: a }), area);   // RUN10 P1: the fair is its own area
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(300);
  return { ctx, page };
}

// ==================== grand opening fires exactly once, gates swing (frames) ====================
console.log('== grand-opening ceremony: gates swing open, fires exactly once ==');
{
  // RUN10 P1: the fair is its own area now, so "before the first visit" means mounting
  // in a DIFFERENT area first — entering the funfair area is itself the visit (there's no
  // more "scrolled past it within the same world" pre-state).
  const { ctx, page } = await openTown(SAVE(), { area: 'meadow' });
  assert(await page.evaluate(() => window.__townLife.ffOpened()) === false, 'a fresh save has not opened the fair yet');
  assert(await page.evaluate(() => window.__townLife.ffGrandShown()) === false, 'no grand-opening before the first visit');
  await page.evaluate(() => window.BooTown.go('town', { area: 'funfair' }));
  await page.waitForSelector('.town2'); await page.waitForFunction(() => window.__townLife, { timeout: 4000 });
  await sleep(250);
  assert(await page.evaluate(() => window.__townLife.ffGrandShown()) === true, 'first funfair visit plays the grand opening');
  // gate-swing motion evidence: sample the left gate's transform across the swing window
  const frames = [];
  for (let k = 0; k < 14; k++) { frames.push(await page.evaluate(() => { const g = document.querySelector('.funfair-grand .fg-gate.left'); return g ? getComputedStyle(g).transform : ''; })); await sleep(240); }
  assert(distinct(frames) >= 6, `the gates visibly swing open (${distinct(frames)}/14 distinct transforms over 3.4s)`);
  assert(await page.$('.funfair-grand .fg-open'), 'the "is OPEN!" banner is revealed behind the gates');
  await page.screenshot({ path: 'screenshots/r7p1/grand-opening-1000x640.png' });
  // the ceremony sets the persisted flag
  assert(await page.evaluate(() => window.__townLife.ffOpened()) === true, 'the grand opening sets the persisted opened flag');
  // dismiss + revisit → never fires again this session
  await page.click('.funfair-grand .fg-go');
  await sleep(250);
  await page.evaluate(() => { window.__townLife.scrollToFunfair(); window.__townLife.ffGrandOpen(); });
  await sleep(200);
  assert(await page.evaluate(() => window.__townLife.ffGrandShown()) === false, 'revisiting does not replay the grand opening');
  await ctx.close();
}
{
  // a save that already opened the fair (persisted flag) never plays it
  const { ctx, page } = await openTown(SAVE({ seen: { funfairOpened: '2026-01-01', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }));
  await page.evaluate(() => { window.__townLife.scrollToFunfair(); window.__townLife.ffGrandOpen(); });
  await sleep(250);
  assert(await page.evaluate(() => window.__townLife.ffGrandShown()) === false, 'a previously-opened save never replays the grand opening');
  await ctx.close();
}

// ==================== day-one elements on a 0-star save ====================
console.log('== every day-one element plays on a 0-star save ==');
{
  const { ctx, page } = await openTown(SAVE({ seen: { funfairOpened: '2026-01-01', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }));
  await page.evaluate(() => window.__townLife.scrollToFunfairGate());   // gate view shows the ticket booth + bandstand entrance
  await sleep(400);
  assert(await page.$('.ff-ride[data-ride="carousel"]'), 'Carousel present day one');
  assert(await page.$('.ff-scenery'), 'fair scenery (bunting / booth / lights / popcorn) present day one');
  assert(await page.$eval('.ff-scenery', s => s.innerHTML.includes('TICKETS')), 'the ticket booth is present');
  assert(await page.evaluate(() => window.__townLife.hasBandstand()), 'the bandstand is present day one');
  // the Carousel RUNS day one even with empty seats (its structure idle-spins — RUN6 hotfix 1)
  // scroll to the carousel itself (RUN10 P1: an area is 4 viewports wide, so the gate view
  // above doesn't necessarily overlap the carousel at x 0.18 — scroll to it directly)
  await page.evaluate(() => window.__townLife.scrollToFrac(0.18));
  await sleep(300);
  const fr = [];
  for (let k = 0; k < 6; k++) { fr.push(await page.evaluate(() => { const m = document.querySelector('.ff-ride[data-ride="carousel"] .ffm'); return m ? m.getAttribute('transform') : ''; })); await sleep(420); }
  assert(distinct(fr) >= 3, `the Carousel runs day one (${distinct(fr)}/6 structure frames)`);
  await ctx.close();
}
{
  // string lights glow at simulated night, day one
  const { ctx, page } = await openTown(SAVE({ seen: { funfairOpened: 'x', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }), { hour: 21 });
  assert(await page.$('.ff-scenery.night'), 'the fair is in its night state at 21:00 day one');
  assert(await page.$eval('.ff-scenery.night .ff-bulb', el => getComputedStyle(el).animationName !== 'none'), 'string lights glow at night day one');
  await ctx.close();
}

// ==================== the band is reachable + fully playable at 0 stars (no gate) ====================
console.log('== the band has NO star gate: all three instruments + record work at 0 stars ==');
{
  const { ctx, page } = await openTown(SAVE({ seen: { funfairOpened: 'x', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }));
  // RUN10 P6: bandstand → Band Room → Drums (two taps to first sound, no star gate).
  await page.evaluate(() => window.__townLife.scrollToBandstand());
  await sleep(300);
  await page.click('.ff-bandstand');
  await page.waitForSelector('.bandroom', { timeout: 3000 });
  assert(await page.locator('.bandroom-card[data-scene="drums"]').count() === 1, 'Band Room is reachable at 0 stars');
  await page.click('.bandroom-card[data-scene="drums"]');
  await page.waitForFunction(() => window.__band, { timeout: 3000 });
  const res = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setAudioLog(true); sfx.initAudio(); sfx.setSoundEnabled(true);
    const tags = new Set();
    // drums / keys / guitar each log a distinct synth note
    window.__band.setInstrument('drums'); window.__band.hit('drum', 'kick');
    window.__band.setInstrument('keys');  window.__band.hit('key', 0);
    window.__band.setInstrument('guitar'); window.__band.hit('guitar', 'C');
    await new Promise(r => setTimeout(r, 150));
    for (const e of sfx.getAudioLog()) if (e.tag) tags.add(String(e.tag).split(':')[0]);
    // record-a-jam captures note events (no mic)
    window.__band.record();
    window.__band.hit('drum', 'snare'); window.__band.hit('drum', 'hihat');
    window.__band.record();
    const events = window.__band.events().length;
    return { tags: [...tags], events };
  });
  assert(res.tags.includes('drum') && res.tags.includes('key') && res.tags.includes('guitar'), `all three instruments synthesize at 0 stars (${res.tags.join(',')})`);
  assert(res.events >= 2, `record-a-jam captures note events at 0 stars (${res.events})`);
  await page.screenshot({ path: 'screenshots/r7p1/band-dayone-1000x640.png' });
  await ctx.close();
}

// ==================== existing save past a milestone queues construction on first load ====================
console.log('== an existing save past a milestone starts queued construction on load ==');
{
  // 260 stars, fresh funfair state: every ride milestone (80/140/200/260) is exceeded
  const { ctx, page } = await openTown(SAVE({ stars: { total: 260, byGame: {} }, funfair: { built: [], build: null, pending: [], seats: {} }, seen: { funfairOpened: 'x', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }));
  const view = await page.evaluate(() => window.__townLife.ffView());
  assert(view.built.includes('carousel'), 'the Carousel is granted on load');
  assert(view.site === 'ferris', `construction of the first queued ride begins on load (building ${view.site})`);
  // the remaining rides are queued one at a time
  const pending = await page.evaluate(() => window.__townLife.ffView().seats && window.BooTown.State.getState().funfair.pending);
  assert(Array.isArray(pending) && pending.length === 3, `the other three rides queue one at a time (pending ${JSON.stringify(pending)})`);
  await page.evaluate(() => window.__townLife.scrollToFunfair());
  await sleep(400);
  assert(await page.$('.ff-consite'), 'a construction site renders for the building ride');
  await ctx.close();
}

// ==================== milestone rides arrive under simulated totals 80/140/200/260 ====================
console.log('== milestone rides arrive under simulated totals 80/140/200/260 ==');
{
  const { ctx, page } = await openTown(SAVE({ stars: { total: 0, byGame: {} }, funfair: { built: ['carousel'], build: null, pending: [], seats: {} }, seen: { funfairOpened: 'x', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }));
  const seq = await page.evaluate(async () => {
    const F = await import('./js/funfair.js');
    const S = window.BooTown.State;
    const out = [];
    let now = 1000000;
    const steps = [[80, 'ferris'], [140, 'teacups'], [200, 'bouncy'], [260, 'helter']];
    for (const [stars, want] of steps) {
      S.mutate(st => { st.stars.total = stars; });
      window.__bootownNow = now;
      F.tickFunfair();
      const building = (S.getState().funfair.build || {}).ride || null;
      window.__bootownNow = now + F.FUNFAIR_BUILD_MS + 5000;
      const t2 = F.tickFunfair();
      if (t2.readyToReveal) F.completeRideReveal(t2.readyToReveal);
      out.push({ stars, want, building, ready: t2.readyToReveal });
      now += F.FUNFAIR_BUILD_MS * 2;
    }
    return { out, built: F.funfairView().built };
  });
  for (const s of seq.out) assert(s.building === s.want && s.ready === s.want, `at ${s.stars} stars the ${s.want} arrives (built ${s.building}/revealed ${s.ready})`);
  assert(['carousel', 'ferris', 'teacups', 'bouncy', 'helter'].every(r => seq.built.includes(r)), `all five rides built after crossing every milestone (${seq.built.join(',')})`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
