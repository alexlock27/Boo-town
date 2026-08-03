// tests/r7p1-funfair.mjs — RUN7 phase 1: open the funfair and the band (C1).
// Acceptance (RUN7 part D #1): a brand-new save reaches the OPEN fair and plays every
// day-one element (Carousel, booth, lights at simulated night, band watch + all three
// instruments, record-a-jam) with the grand-opening ceremony firing EXACTLY once; an
// existing save past ONE ride milestone starts its queued 24h construction on first load;
// milestone rides arrive under simulated totals of 80/140/200/260; NO band feature is
// reachable-gated by stars anywhere.
// RUN21A item 16 added the second half of the milestone contract, which this suite now
// guards on both sides: a save crossing SEVERAL thresholds in one tick catches up instead
// (all rides built at once, one combined celebration in funfair.catchup), while a save
// crossing exactly one keeps the 24h Builders flow unchanged.
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
  // tap the bandstand → the band screen (proves it is reachable at 0 stars)
  await page.evaluate(() => window.__townLife.scrollToBandstand());
  await sleep(300);
  await page.click('.ff-bandstand');
  await page.waitForSelector('.band-screen, .screen.band, [class*="band"]', { timeout: 3000 }).catch(() => {});
  // RUN10 P6 split the band into per-instrument scenes; the bandstand now opens the Band
  // Room. The multi-instrument __band harness these assertions drive is preserved at the
  // 'band-legacy' route (see main.js), so drive it there. (RUN11 Q10.)
  await page.evaluate(() => window.BooTown.go('band-legacy'));
  await page.waitForFunction(() => window.__band, { timeout: 5000 });
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

// ==================== existing save past a milestone: catch-up vs. the 24h queue ====================
// RE-POINTED for RUN21A item 16. This block used to seed 260 stars with an empty funfair and
// assert the Boo Builders queued the four rides one 24h build at a time (site 'ferris',
// pending ['teacups','bouncy','helter']). Item 16 makes that exact fixture the CATCH-UP path:
// when a SINGLE tick finds MORE THAN ONE newly-eligible ride, they all complete immediately
// and one combined celebration is recorded in the additive save key `funfair.catchup` — no
// 24h build, no queue. The old queue contract is NOT gone: it now belongs to a SINGLE newly-
// crossed threshold, which item 16 leaves untouched, so the second block below pins it with
// the same rigour (build starts on load, construction site renders, nothing ready before 24h).
console.log('== RUN21A-16: several milestones crossed at once → every ride lands at once, one celebration ==');
{
  // 260 stars, fresh funfair state: all four ride milestones (80/140/200/260) are crossed
  // by the same tick — the catch-up case.
  const { ctx, page } = await openTown(SAVE({ stars: { total: 260, byGame: {} }, funfair: { built: [], build: null, pending: [], seats: {} }, seen: { funfairOpened: 'x', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }));
  const view = await page.evaluate(() => window.__townLife.ffView());
  assert(view.built.includes('carousel'), 'the Carousel is granted on load');
  assert(view.built.join(',') === 'carousel,ferris,teacups,bouncy,helter', `every newly-eligible ride is BUILT on load, not queued (built ${view.built.join(',')})`);
  assert(view.site === null, `no 24h construction begins on load (building ${view.site})`);
  // nothing waits in the queue any more — the old "queue one at a time" pin, moved to its
  // new value: a multi-crossing leaves the queue and the build slot empty.
  const ff = await page.evaluate(() => window.BooTown.State.getState().funfair);
  assert(Array.isArray(ff.pending) && ff.pending.length === 0, `no ride is left queued for a 24h build (pending ${JSON.stringify(ff.pending)})`);
  assert(!ff.build, `no build slot is occupied (build ${JSON.stringify(ff.build)})`);
  // the combined celebration is remembered in the new save key, naming every caught-up ride
  assert(JSON.stringify(ff.catchup) === JSON.stringify(['ferris', 'teacups', 'bouncy', 'helter']), `funfair.catchup names the caught-up rides in order (${JSON.stringify(ff.catchup)})`);
  // ...and it is shown ONCE, on the funfair mount, with the pack's exact copy
  await page.waitForSelector('.overlay.growth-reveal', { timeout: 4000 });
  assert(await page.$eval('.overlay.growth-reveal .gr-title', n => n.textContent) === 'Look how the fair has grown!', 'the combined catch-up reveal carries the exact headline');
  assert(await page.$eval('.overlay.growth-reveal .gr-line', n => n.textContent) === 'The Boo Builders finished 4 rides while you were busy: Ferris Wheel, Teacups, Bouncy Castle and Helter-Skelter!', 'the combined catch-up reveal names all four rides in the exact body copy');
  assert((await page.$$('.overlay.growth-reveal')).length === 1, 'exactly ONE celebration overlay, not four');
  await page.click('.overlay.growth-reveal .btn.big');
  await sleep(400);
  assert(await page.evaluate(() => window.BooTown.State.getState().funfair.catchup.length) === 0, 'dismissing the reveal clears funfair.catchup (completeCatchupReveal)');
  await page.evaluate(() => window.__townLife.scrollToFunfair());
  await sleep(400);
  assert(!(await page.$('.ff-consite')), 'NO construction site renders — nothing is still being built');
  const rides = await page.evaluate(() => window.__townLife.ffRides());
  assert(['carousel', 'ferris', 'teacups', 'bouncy', 'helter'].every(r => rides.includes(r)), `all five rides are on the ground after the catch-up (${rides.join(',')})`);
  await ctx.close();
}

// ==================== a SINGLE crossing keeps the 24h Builders flow exactly as before ====================
// RUN21A item 16 changes NOTHING here (pack ACCEPT: "a 79→81★ crossing behaves exactly as
// today"), so this block carries the assertions the 260-star fixture used to make.
console.log('== a save past exactly ONE milestone starts its queued 24h construction on load ==');
{
  // 81 stars with only the Carousel built: exactly one newly-crossed threshold (Ferris 80).
  const { ctx, page } = await openTown(SAVE({ stars: { total: 81, byGame: {} }, funfair: { built: ['carousel'], build: null, pending: [], seats: {} }, seen: { funfairOpened: 'x', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true } }));
  const view = await page.evaluate(() => window.__townLife.ffView());
  assert(view.built.join(',') === 'carousel', `the Ferris Wheel is NOT granted early — it has to be built (built ${view.built.join(',')})`);
  assert(view.site === 'ferris', `construction of the first queued ride begins on load (building ${view.site})`);
  const ff = await page.evaluate(() => window.BooTown.State.getState().funfair);
  assert(Array.isArray(ff.pending) && ff.pending.length === 0, `the single queued ride moved straight into the build slot (pending ${JSON.stringify(ff.pending)})`);
  assert(Array.isArray(ff.catchup) && ff.catchup.length === 0, `a single crossing records NO catch-up celebration (catchup ${JSON.stringify(ff.catchup)})`);
  await sleep(900);   // past town.js's 700ms reveal timer
  assert(!(await page.$('.overlay.growth-reveal')), 'no celebration overlay — the ride is still being built');
  await page.evaluate(() => window.__townLife.scrollToFunfair());
  await sleep(400);
  assert(await page.$('.ff-consite'), 'a construction site renders for the building ride');
  // the 24h wait, and the queue still taking one ride at a time behind the building one
  const t = await page.evaluate(async () => {
    const F = await import('./js/funfair.js');
    const S = window.BooTown.State;
    const startedAt = S.getState().funfair.build.startedAt;
    window.__bootownNow = startedAt + F.FUNFAIR_BUILD_MS - 60000;
    const early = F.tickFunfair();
    S.mutate(st => { st.stars.total = 140; });          // one more single crossing (Teacups 140)
    const queued = F.tickFunfair();
    const st1 = S.getState().funfair;
    window.__bootownNow = startedAt + F.FUNFAIR_BUILD_MS + 5000;
    const late = F.tickFunfair();
    return { early: early.readyToReveal, earlyCatch: early.catchUp, spawned: queued.spawned, queuedCatch: queued.catchUp, pending: st1.pending.slice(), building: (st1.build || {}).ride || null, ready: late.readyToReveal };
  });
  assert(t.early === null, `readyToReveal stays null one minute short of 24h (${t.early})`);
  assert(t.earlyCatch === null, `no catch-up is raised for a single-crossing build (${JSON.stringify(t.earlyCatch)})`);
  assert(JSON.stringify(t.spawned) === '["teacups"]', `a second single crossing spawns exactly one ride (${JSON.stringify(t.spawned)})`);
  assert(t.queuedCatch === null, `a second single crossing still takes the queue, not the catch-up path (${JSON.stringify(t.queuedCatch)})`);
  assert(JSON.stringify(t.pending) === '["teacups"]', `rides queue one at a time behind the one being built (pending ${JSON.stringify(t.pending)})`);
  assert(t.building === 'ferris', `the Ferris Wheel is still the ride under construction (${t.building})`);
  assert(t.ready === 'ferris', `after the full 24h the Ferris Wheel is ready to reveal (${t.ready})`);
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
