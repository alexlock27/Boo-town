// tests/r4p7-boopop.mjs — RUN4 phase 7 (C7): Boo Pop, the match-and-pop puzzle.
// Acceptance (RUN4 part D #9): swap, pop, fall and cascade frame evidence; every
// generated board has a valid pair; the auto-shuffle triggers when none remain;
// idle glow at 6 seconds; Starter and Make 10 playable and 3-starrable; Make 20
// and Fraction Friends hidden below their content tiers; Twin Pop registers as
// cosy after the third lifetime round.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p7', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} },
  ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { trophyRetro: true }, ageAsked: true, age: 8
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
async function openLevel(page, levelName) {
  await page.evaluate(() => window.BooTown.go('boopop'));
  await page.waitForSelector('.start-card');
  await page.click(`.level-btn:has-text("${levelName}")`);
  await page.waitForSelector('.bp-board .bp-gem');
  await sleep(300);
}
const waitIdle = async (page) => {
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => window.__boopop.state());
    if (!s.busy) return s;
    await sleep(150);
  }
  return page.evaluate(() => window.__boopop.state());
};
// play valid moves until `target` pops (or moves run out); returns final state
async function playFor(page, target) {
  for (let i = 0; i < 30; i++) {
    let st = await waitIdle(page);
    if (st.ended || st.pops >= target || st.moves <= 0) return st;
    const mv = await page.evaluate(() => window.__boopop.findMove());
    if (!mv) { await sleep(400); continue; }   // shuffle in flight
    await page.evaluate((m) => window.__boopop.swap(m.from[0], m.from[1], m.to[0], m.to[1]), mv);
    await sleep(REDUCEDWAIT);
  }
  return waitIdle(page);
}
const REDUCEDWAIT = 1100;

// ---- the hub card exists + tier gating on levels ----
console.log('== hub card + tier gating ==');
{
  const { ctx, page } = await fresh(SAVE({ settings: { sound: false, music: false, voice: false, content: 'light' } }));
  const cardNames = await page.$$eval('.game-card .gc-name', els => els.map(e => e.textContent));
  assert(cardNames.includes('Boo Pop'), 'Boo Pop has a hub card (' + cardNames.length + ' cards)');
  await page.evaluate(() => window.BooTown.go('boopop'));
  await page.waitForSelector('.start-card');
  let lv = await page.$$eval('.level-btn', els => els.map(e => e.textContent));
  assert(lv.includes('Twin Pop') && lv.includes('Make 10') && !lv.includes('Make 20') && !lv.includes('Fraction Friends'), `Light tier: Twin Pop + Make 10 only (${lv.join(', ')})`);
  assert(!!(await page.$('.start-card .pickforme')), 'Pick for me offers Boo Pop');
  await page.evaluate(() => window.BooTown.State.mutate(s => { s.settings.content = 'medium'; }));
  await page.evaluate(() => window.BooTown.go('boopop'));
  await page.waitForSelector('.start-card');
  lv = await page.$$eval('.level-btn', els => els.map(e => e.textContent));
  assert(lv.includes('Make 20') && !lv.includes('Fraction Friends'), 'Medium adds Make 20, not the Full-only modes');
  await page.evaluate(() => window.BooTown.State.mutate(s => { s.settings.content = 'full'; }));
  await page.evaluate(() => window.BooTown.go('boopop'));
  await page.waitForSelector('.start-card');
  lv = await page.$$eval('.level-btn', els => els.map(e => e.textContent));
  assert(lv.includes('Fraction Friends') && lv.includes('Fact Pairs'), 'Full shows Fraction Friends + Fact Pairs');
  await ctx.close();
}

// ---- every generated board: no instant pairs, at least one valid move ----
console.log('== board generation guarantees ==');
{
  const { ctx, page } = await fresh(SAVE());
  for (let i = 0; i < 5; i++) {
    await openLevel(page, i % 2 ? 'Make 10' : 'Twin Pop');
    const g = await page.evaluate(() => ({ grid: window.__boopop.grid(), mv: window.__boopop.findMove(), lvl: window.__boopop.state().level }));
    let instant = false;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const v = +g.grid[r][c];
      if (c + 1 < 7) { const w = +g.grid[r][c + 1]; if (g.lvl === 'twin' ? v === w : v + w === 10) instant = true; }
      if (r + 1 < 7) { const w = +g.grid[r + 1][c]; if (g.lvl === 'twin' ? v === w : v + w === 10) instant = true; }
    }
    assert(!instant, `board ${i + 1} (${g.lvl}): no pair pops on arrival`);
    assert(!!g.mv, `board ${i + 1} (${g.lvl}): at least one valid pair is reachable`);
  }
  await ctx.close();
}

// ---- swap / pop / fall / cascade frame evidence ----
console.log('== swap, pop, fall, cascade evidence ==');
{
  const { ctx, page } = await fresh(SAVE());
  await openLevel(page, 'Make 10');
  const mv = await page.evaluate(() => window.__boopop.findMove());
  assert(!!mv, 'a valid move exists');
  // fire the swap and sample fast: mid-swap transforms, then popping, then drop-in
  await page.evaluate((m) => window.__boopop.swap(m.from[0], m.from[1], m.to[0], m.to[1]), mv);
  const trace = { swap: false, pop: false, fall: false };
  for (let i = 0; i < 24; i++) {
    const t = await page.evaluate(() => ({
      swapping: [...document.querySelectorAll('.bp-gem.swapping')].some(n => /translate/.test(n.style.transform || '')),
      popping: !!document.querySelector('.bp-gem.popping'),
      dropping: !!document.querySelector('.bp-gem.drop-in')
    }));
    trace.swap = trace.swap || t.swapping;
    trace.pop = trace.pop || t.popping;
    trace.fall = trace.fall || t.dropping;
    await sleep(60);
  }
  assert(trace.swap, 'swap: gems visibly slide (mid-swap transforms captured)');
  assert(trace.pop, 'pop: matched gems shrink out with a sparkle (.popping seen)');
  assert(trace.fall, 'fall: gems drop into the gaps (.drop-in seen)');
  // frames for the record: 6 shots over 3.3s of active play
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: `screenshots/r4p7/play-frame-${i}.png`, clip: { x: 200, y: 100, width: 620, height: 620 } });
    const m2 = await page.evaluate(() => window.__boopop.findMove());
    if (m2) await page.evaluate((m) => window.__boopop.swap(m.from[0], m.from[1], m.to[0], m.to[1]), m2);
    await sleep(660);
  }
  // cascade: over a full round of valid swaps, at least one swap pops 2+ pairs
  let sawCascade = false, prevPops = 0;
  for (let i = 0; i < 14 && !sawCascade; i++) {
    const st = await waitIdle(page);
    if (st.ended || st.moves <= 0) break;
    prevPops = st.pops;
    const m3 = await page.evaluate(() => window.__boopop.findMove());
    if (!m3) { await sleep(400); continue; }
    await page.evaluate((m) => window.__boopop.swap(m.from[0], m.from[1], m.to[0], m.to[1]), m3);
    await sleep(1200);
    const st2 = await waitIdle(page);
    if (st2.pops - prevPops >= 2) sawCascade = true;
  }
  assert(sawCascade, 'cascade: refills chained at least one multi-pop swap');
  await ctx.close();
}

// ---- auto sparkle-shuffle when no pair remains ----
console.log('== sparkle-shuffle safety net ==');
{
  const { ctx, page } = await fresh(SAVE());
  await openLevel(page, 'Twin Pop');
  // v(r,c) = 1 + (3r + c) % 9 has provably NO twin move (all swap deltas 2,4,6 mod 9)
  const rigged = await page.evaluate(() => {
    const vals = [];
    for (let r = 0; r < 7; r++) { vals.push([]); for (let c = 0; c < 7; c++) vals[r].push(1 + ((3 * r + c) % 9)); }
    return window.__boopop.setTwinGrid(vals);
  });
  assert(rigged, 'rigged board really has no valid move');
  const res = await page.evaluate(() => window.__boopop.checkMovable());
  assert(!res.had && res.movableNow, `the sparkle-shuffle rearranges a stuck board for free (movable now: ${res.movableNow})`);
  const bubble = await page.$eval('.peek-bubble', n => n.textContent).catch(() => '');
  assert(/Sparkle-shuffle/i.test(bubble), `announced cheerfully ("${bubble}")`);
  await ctx.close();
}

// ---- idle glow at 6 seconds, free ----
console.log('== idle glow ==');
{
  const { ctx, page } = await fresh(SAVE());
  await openLevel(page, 'Make 10');
  assert(!(await page.evaluate(() => window.__boopop.glowShown())), 'no glow right away');
  await sleep(6600);
  assert(await page.evaluate(() => window.__boopop.glowShown()), 'a soft glow hints a valid pair after 6 idle seconds');
  const st = await page.evaluate(() => window.__boopop.state());
  assert(st.hintsUsed === 0, 'the idle glow is free (no hint charged)');
  await ctx.close();
}

// ---- 3-starrable: Twin Pop and Make 10 ----
console.log('== 3-star runs ==');
for (const level of ['Twin Pop', 'Make 10']) {
  const { ctx, page } = await fresh(SAVE());
  await openLevel(page, level);
  const st = await playFor(page, 12);
  assert(st.pops >= 12, `${level}: reached ${st.pops} pops (needs 12+) with ${st.moves} moves left`);
  await page.evaluate(() => window.__boopop.finish());
  await page.waitForSelector('.result-card');
  await sleep(800);
  const best = await page.evaluate(() => window.BooTown.State.getState().stars.byGame.boopop.best);
  assert(best === 3, `${level}: 3-starred (best ${best})`);
  await ctx.close();
}

// ---- Twin Pop turns cosy after the 3rd lifetime round ----
console.log('== Twin Pop cosy rule ==');
{
  const { ctx, page } = await fresh(SAVE({ seen: { trophyRetro: true, twinPopRounds: 3 } }));
  await openLevel(page, 'Twin Pop');
  const st = await playFor(page, 12);
  const t0 = await page.evaluate(() => window.BooTown.State.getState().stars.total);
  await page.evaluate(() => window.__boopop.finish());
  await page.waitForSelector('.result-card');
  await sleep(800);
  const after = await page.evaluate(() => ({ meter: window.BooTown.State.getState().meter, total: window.BooTown.State.getState().stars.total, twin: window.BooTown.State.getState().seen.twinPopRounds }));
  assert(after.twin === 4, `lifetime Twin Pop rounds counted (${after.twin})`);
  assert(after.meter === 2, `the 4th Twin Pop round is cosy: 2 meter points max (got ${after.meter})`);
  assert(after.total - t0 === (st.pops >= 12 ? 3 : st.pops >= 8 ? 2 : 1), 'total stars still credit in full');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p7-boopop: FAIL' : '\nr4p7-boopop: ALL PASS');
process.exit(failed ? 1 : 0);
