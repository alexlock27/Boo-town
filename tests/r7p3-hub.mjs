// tests/r7p3-hub.mjs — RUN7 phase 3: the Today rail + Jump Back In manners (C3).
// Acceptance (RUN7 part D #3 & #4): at 390x844 the hero + rail leave >=2 full game
// cards visible without scrolling; each chip renders only when it has content; the rail
// scrolls horizontally (frame evidence); tablet shows the rail replacing the old
// meta-cards in both orientations; Jump Back In obeys all three manners rules with no
// stale chip after completing the suggested round.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r7p3', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const TODAY = '2026-07-09', YESTERDAY = '2026-07-08', TOMORROW = '2026-07-10';

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_lolly: 1 }, boxes: 0, meter: 3, opened: 5, pity: { commons: 0 },
  stars: { total: 126, byGame: { bubblepop: { best: 3, plays: 4, earned: 12 } } },
  golden: { words: ['cat', 'dog'], choices: [], savedAt: 1 }, nicknames: {}, equips: {}, catBest: {}, ledger: {}, town: [],
  seen: { lastPlay: { game: 'bubblepop', gameName: 'Make 10', cat: 'make10', level: 2, mix: false }, lastPlayDay: YESTERDAY,
    introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, lastStarsShown: 126 },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false }, ageAsked: true, age: 8, quest: { node: 2, lands: {} }
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openHub(save, { w = 390, h = 844, day = TODAY } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(d => { window.__bootownDay = d; }, day);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.waitForFunction(() => window.__hub, { timeout: 4000 });
  await sleep(300);
  return { ctx, page };
}
const chips = page => page.evaluate(() => window.__hub.railChips());

// ==================== >=2 full game cards visible at 390x844 ====================
console.log('== at 390x844, hero + rail leave >=2 full game cards visible ==');
{
  const { ctx, page } = await openHub(SAVE());
  const vis = await page.evaluate(() => {
    const bar = document.querySelector('.bottom-bar').getBoundingClientRect();
    let n = 0; for (const c of document.querySelectorAll('.game-card')) { const r = c.getBoundingClientRect(); if (r.top >= 0 && r.bottom <= bar.top + 1 && r.height > 20) n++; }
    return n;
  });
  assert(vis >= 2, `at least two full game cards visible below the rail without scrolling (${vis})`);
  assert(await page.$('.today-rail'), 'the Today rail is present');
  // the rail is one row, ~90px tall
  const railH = await page.$eval('.today-rail', n => n.getBoundingClientRect().height);
  assert(railH <= 110, `the rail is one compact row (${Math.round(railH)}px)`);
  await page.screenshot({ path: 'screenshots/r7p3/hub-phone.png' });
  await ctx.close();
}

// ==================== each chip renders only when it has content ====================
console.log('== chips render only when they have content ==');
{
  // full content: all six chips
  let { ctx, page } = await openHub(SAVE());
  assert(JSON.stringify(await chips(page)) === JSON.stringify(['jumpback', 'quests', 'booquest', 'chest', 'golden', 'botd']), 'all six chips show when all have content');
  await ctx.close();
  // no golden published, no botd (no Boos), no lastPlay → those chips vanish
  ({ ctx, page } = await openHub(SAVE({ golden: null, inventory: {}, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true } })));
  const c = await chips(page);
  assert(!c.includes('golden'), 'no Golden chip when none is published');
  assert(!c.includes('botd'), 'no Boo-of-the-Day chip when she owns no Boos');
  assert(!c.includes('jumpback'), 'no Jump-back chip when nothing has ever been played');
  assert(c.includes('quests') && c.includes('booquest') && c.includes('chest'), 'the always-on chips (quests, boo quest, chest) still show');
  await ctx.close();
}

// ==================== the rail scrolls horizontally (frame evidence) ====================
console.log('== the rail scrolls horizontally (frame evidence) ==');
{
  const { ctx, page } = await openHub(SAVE(), { w: 390, h: 844 });
  const over = await page.evaluate(() => { const r = window.__hub.railScrollWidth(); return r.scroll > r.client + 20; });
  assert(over, 'the rail content overflows the screen edge (horizontally scrollable)');
  // sample the last chip's on-screen X as we scroll the rail across frames
  const xs = [];
  for (let i = 0; i < 6; i++) {
    await page.evaluate(v => { document.querySelector('.trail-inner').scrollLeft = v; }, i * 70);
    const x = await page.evaluate(() => { const cs = document.querySelectorAll('.trail-chip'); const last = cs[cs.length - 1]; return Math.round(last.getBoundingClientRect().left); });
    xs.push(x); await sleep(120);
  }
  assert(distinct(xs) >= 4, `chips slide as the rail scrolls (${distinct(xs)}/6 distinct positions)`);
  assert(xs[xs.length - 1] < xs[0], 'scrolling right moves later chips into view');
  await ctx.close();
}

// ==================== tablet: the rail replaces the old meta-cards (both orientations) ====================
console.log('== tablet: the rail replaces the old meta-cards in both orientations ==');
for (const [w, h, tag] of [[1024, 768, 'tablet-land'], [768, 1024, 'tablet-port']]) {
  const { ctx, page } = await openHub(SAVE(), { w, h });
  assert(await page.$('.today-rail'), `${tag}: the Today rail is present`);
  const oldCards = await page.evaluate(() => document.querySelectorAll('.jumpback-card, .quest-card, .golden-card, .booday, .hub-top .star-chest').length);
  assert(oldCards === 0, `${tag}: none of the old separate meta-cards remain (${oldCards})`);
  await page.screenshot({ path: `screenshots/r7p3/hub-${tag}.png` });
  await ctx.close();
}

// ==================== Jump Back In manners ====================
console.log('== Jump Back In manners ==');
{
  // (1) shows when a mode exists, not played today, not dismissed
  let { ctx, page } = await openHub(SAVE());   // lastPlayDay = yesterday
  assert(await page.evaluate(() => window.__hub.jumpbackShown()), 'shows when the last mode has not been played today');
  // (2) hidden after playing that mode today
  await ctx.close();
  ({ ctx, page } = await openHub(SAVE({ seen: { lastPlay: { game: 'bubblepop', gameName: 'Make 10', cat: 'make10', level: 2 }, lastPlayDay: TODAY, introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true } })));
  assert(await page.evaluate(() => window.__hub.jumpbackShown()) === false, 'hidden after that mode has been played today');
  await ctx.close();
  // (3) never shown without a last-played mode
  ({ ctx, page } = await openHub(SAVE({ seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true } })));
  assert(await page.evaluate(() => window.__hub.jumpbackShown()) === false, 'never shown when nothing has been played');
  await ctx.close();
  // (4) the × dismisses until a simulated next day
  ({ ctx, page } = await openHub(SAVE()));   // yesterday → shows
  await page.evaluate(() => window.__hub.dismissJumpback());
  await sleep(120);
  assert(await page.evaluate(() => window.__hub.jumpbackShown()) === false, 'the × removes the chip immediately');
  const dDay = await page.evaluate(() => window.BooTown.State.getState().seen.jumpbackDismissedDay);
  assert(dDay === TODAY, 'dismissal is recorded for today');
  await page.evaluate(() => window.BooTown.go('hub'));   // re-render, still today → still hidden
  await sleep(200);
  assert(await page.evaluate(() => window.__hub.jumpbackShown()) === false, 'stays hidden for the rest of today');
  await page.evaluate(d => { window.__bootownDay = d; window.BooTown.go('hub'); }, TOMORROW);   // next day
  await page.waitForFunction(() => window.__hub); await sleep(200);
  assert(await page.evaluate(() => window.__hub.jumpbackShown()), 'reappears the next day (dismissal was only for today)');
  await ctx.close();
}

// ==================== no stale chip after completing the suggested round ====================
console.log('== no stale chip after completing the suggested round ==');
{
  const { ctx, page } = await openHub(SAVE());
  assert(await page.evaluate(() => window.__hub.jumpbackShown()), 'the chip is there before playing');
  // drive a REAL round result for the suggested mode → results.js records lastPlayDay=today
  await page.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Make 10', cat: 'make10', level: 2, stars: 3, correct: 8, total: 8 }));
  await sleep(400);
  const day = await page.evaluate(() => window.BooTown.State.getState().seen.lastPlayDay);
  assert(day === TODAY, 'completing the round stamps lastPlayDay = today');
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForFunction(() => window.__hub); await sleep(200);
  assert(await page.evaluate(() => window.__hub.jumpbackShown()) === false, 'back on the hub, the suggested-round chip is gone (not stale)');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
