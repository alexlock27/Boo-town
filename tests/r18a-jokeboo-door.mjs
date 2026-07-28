// tests/r18a-jokeboo-door.mjs — RUN18A H3: the Joke Boo is reachable, twice over.
//
// The audit reported the Joke Boo as a dead end. Two of the three causes the pack named
// did NOT reproduce, and the real one was somewhere else entirely — so this suite pins
// down all of it, including the two facts that were already correct, so nobody re-diagnoses
// them:
//   • the Meadow seed DOES fire on a restored (adoptSave) save — asserted, not assumed;
//   • the Build drawer chip DOES read its own catalogue name — asserted, not assumed;
//   • what actually made it unreachable: the Trophy Room retro ceremony is appended to
//     <body> at z-index 8000 and nothing removed it when the screen changed, so it sat
//     over the whole town. The seed had fired; the world was simply covered.
//   • and a latent bug found while proving the first point: the "seeded" flag was set
//     BEFORE the capacity check, so a full Meadow burned it and the stage never arrived
//     on any later visit, permanently.
// Plus the pack's new front door: a Joke Boos card in the hub's Play grid.
//
// Expected runtime: ~30s (measured 30.3s). Not @serial — it waits on state and
// hit-testing, never on frames.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18a/h3';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
// A save WITHOUT the stage and WITHOUT the seeded flag — the restored-save shape.
const save = (over = {}) => JSON.stringify(Object.assign({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1 },
  stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400 },
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over));

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(saveText = save()) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), saveText);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}
async function toMeadow(page) {
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'town', null, { timeout: 15000 });
  await page.waitForTimeout(1200);
}
// The town is four viewports wide: an item's rect can be far outside the window, so a tap
// has to bring it into view first or it lands on nothing and looks like a broken handler.
async function tapStage(page) {
  await page.evaluate(() => {
    const vp = document.querySelector('.t-viewport');
    const n = document.querySelector('.t-item[data-item="deco_jokestage"]');
    if (!vp || !n) return;
    const r = n.getBoundingClientRect(), vr = vp.getBoundingClientRect();
    vp.scrollLeft += (r.left - vr.left) - (vr.width / 2 - r.width / 2);
  });
  await page.waitForTimeout(450);
  const b = await page.evaluate(() => {
    const n = document.querySelector('.t-item[data-item="deco_jokestage"]');
    if (!n) return null;
    const r = n.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, w: Math.round(r.width), h: Math.round(r.height), hits: !!(top && n.contains(top)), by: top ? (top.getAttribute('class') || top.tagName) : null };
  });
  if (!b) return { noStage: true };
  // a real pointer tap: the handler is pointerdown/pointerup, not click
  await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
  await page.waitForTimeout(900);
  return { ...b, landed: await page.evaluate(() => document.getElementById('screen').dataset.screen) };
}

// ---- 1. a RESTORED save seeds the stage on the next town mount ------------------------
console.log('== 1. the seed fires for a restored save ==');
{
  const { ctx, page } = await open();
  const before = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { flag: !!(s.seen || {}).jokeStageSeeded, items: (s.town.areas.meadow.items || []).map(i => i.item) };
  });
  assert(before.flag === false && !before.items.includes('deco_jokestage'), 'the fixture starts with no stage and no seeded flag');
  await toMeadow(page);
  const after = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return {
      flag: !!(s.seen || {}).jokeStageSeeded,
      items: (s.town.areas.meadow.items || []).map(i => i.item),
      inDom: document.querySelectorAll('.t-item[data-item="deco_jokestage"]').length
    };
  });
  assert(after.items.includes('deco_jokestage'), 'the Joke Boo stage is seeded into the Meadow on the next town mount');
  assert(after.inDom === 1, 'and it is actually rendered in the world');
  assert(after.flag === true, 'and the seeded flag is recorded, so it is a gift, not a respawn');
  await ctx.close();
}

// ---- 1b. a FULL Meadow must not BURN the flag ----------------------------------------
// The stage stays in Build → Landscape when there is no room — that is the authored
// behaviour. What must not happen is the flag being spent on a placement that never
// occurred, which used to lose the stage from the world forever.
console.log('== 1b. a full Meadow defers the gift, it does not lose it ==');
{
  const full = JSON.parse(save());
  full.town.areas.meadow.items = Array.from({ length: 24 }, (_, i) => ({ zone: 'meadow', x: (i % 12) / 12 + 0.02, row: i % 3, item: 'deco_tree' }));
  const { ctx, page } = await open(JSON.stringify(full));
  await toMeadow(page);
  const capped = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { flag: !!(s.seen || {}).jokeStageSeeded, count: s.town.areas.meadow.items.length, has: s.town.areas.meadow.items.some(i => i.item === 'deco_jokestage') };
  });
  assert(capped.has === false, `a full Meadow (${capped.count} items, cap 24) does not force the stage in`);
  assert(capped.flag === false, 'AND the seeded flag is NOT burned — the gift is deferred, not lost');
  // make room, come back, and it arrives
  await page.evaluate(() => window.BooTown.State.mutate(s => { s.town.areas.meadow.items = s.town.areas.meadow.items.slice(0, 4); }));
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub', { timeout: 10000 });
  await toMeadow(page);
  const later = await page.evaluate(() => window.BooTown.State.getState().town.areas.meadow.items.some(i => i.item === 'deco_jokestage'));
  assert(later === true, 'and once there is room, the stage arrives after all');
  await ctx.close();
}

// ---- 2. the drawer chip carries its own catalogue name -------------------------------
console.log('== 2. the Build drawer names it, and does not print a stock sentinel ==');
{
  const { ctx, page } = await open();
  await toMeadow(page);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /🔨/.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const { BY_ID } = await import('./data/catalogue.js');
    const t = [...document.querySelectorAll('.bd-tabs .bd-tab')].find(x => /Landscape/.test(x.textContent));
    if (t) t.click();
    const chip = document.querySelector('.drawer-item[data-item="deco_jokestage"]');
    const badges = [...document.querySelectorAll('.drawer-item')].map(c => ({
      item: c.dataset.item, badge: (c.querySelector('.drawer-badge') || {}).textContent || null
    }));
    return {
      aria: chip && chip.getAttribute('aria-label'),
      catName: BY_ID['deco_jokestage'].name,
      easelName: BY_ID['deco_easel'].name,
      hasOwnArt: !!(chip && chip.querySelector('svg')),
      sentinels: badges.filter(b => b.badge && /9\d\d/.test(b.badge))
    };
  });
  assert(r.aria === r.catName, `the chip is named for its own catalogue entry: "${r.aria}" (catalogue "${r.catName}")`);
  assert(r.aria !== r.easelName, `and NOT the Art Easel's name — the audit's mislabel does not reproduce`);
  assert(r.hasOwnArt, 'and it draws its own art');
  assert(r.sentinels.length === 0, 'no chip prints the unlimited-stock sentinel as a count' + (r.sentinels.length ? `: ${JSON.stringify(r.sentinels.slice(0, 3))}` : ' (no "x999")'));
  await ctx.close();
}

// ---- 3. the permanent front door: a Joke Boos card in the hub's Play grid -------------
console.log('== 3. the hub Play grid has a Joke Boos card, and it routes ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub', { timeout: 10000 });
  const card = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.game-cards')];
    const labels = [...document.querySelectorAll('.group-label')].map(g => g.textContent);
    let found = null, inRow = -1;
    rows.forEach((row, i) => {
      const b = [...row.querySelectorAll('.game-card')].find(c => /Joke Boos/.test(c.textContent));
      if (b) { found = b; inRow = i; }
    });
    if (!found) return { missing: true, labels };
    const r = found.getBoundingClientRect();
    return {
      name: (found.querySelector('.gc-name') || {}).textContent,
      tag: (found.querySelector('.gc-tag') || {}).textContent,
      art: !!found.querySelector('.gc-icon svg'),
      group: labels[inRow], w: Math.round(r.width), h: Math.round(r.height), disabled: found.disabled
    };
  });
  assert(!card.missing, 'the Joke Boos card exists on the hub');
  assert(card.name === 'Joke Boos', `it is labelled "${card.name}" exactly as the pack authors it`);
  assert(card.group === 'Play', `and it lives in the PLAY grid (found under "${card.group}")`);
  assert(card.art, 'its icon is drawn art (the stage\'s own), not an emoji');
  assert(card.w >= 56 && card.h >= 56, `it is a real tap target (${card.w}x${card.h})`);
  await page.evaluate(() => [...document.querySelectorAll('.game-card')].find(c => /Joke Boos/.test(c.textContent)).click());
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'jokeboo', null, { timeout: 10000 });
  assert(true, 'and tapping it opens the jokes');
  await page.screenshot({ path: SHOTS + '/hub-play-card.png' });
  await ctx.close();
}

// ---- 4. the in-world door: tapping the placed stage in PLAY mode ----------------------
console.log('== 4. the stage in the Meadow still opens the jokes ==');
{
  const { ctx, page } = await open();
  await toMeadow(page);
  const play = await tapStage(page);
  assert(!play.noStage, 'the stage is in the world');
  assert(play.hits, `nothing is covering it — the tap reaches it (topmost element: ${play.by})`);
  assert(play.landed === 'jokeboo', `tapping it in play mode opens the jokes (landed "${play.landed}")`);

  // ...and in BUILD mode a tap must NOT teleport her out of the town mid-build
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'town', null, { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /🔨/.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  const build = await tapStage(page);
  assert(build.landed === 'town', `and in BUILD mode the same tap does not leave the town (landed "${build.landed}")`);
  await ctx.close();
}

// ---- 5. a ceremony does not outlive the screen that raised it -------------------------
// This is what actually made the Joke Boo unreachable. z-index 8000, appended to <body>,
// nothing removing it on navigation.
console.log('== 5. the retro ceremony leaves when its screen does ==');
{
  const { ctx, page } = await open(save({ seen: { lastStarsShown: 400 } }));   // trophyRetro NOT set
  await page.waitForSelector('.hub', { timeout: 10000 });
  await page.waitForTimeout(1400);   // hub.js fires retroAwardOnce after 400ms
  const raised = await page.evaluate(() => {
    const ov = document.querySelector('.overlay.trophy-ceremony');
    return { up: !!ov, z: ov && getComputedStyle(ov).zIndex, parent: ov && ov.parentElement.tagName };
  });
  assert(raised.up, `the retro ceremony really does appear on the hub (z-index ${raised.z}, attached to ${raised.parent})`);
  // she does NOT dismiss it — she taps Town
  await toMeadow(page);
  const survived = await page.evaluate(() => !!document.querySelector('.overlay.trophy-ceremony'));
  assert(!survived, 'navigating away removes it — it does not follow her onto the next screen');
  const tap = await tapStage(page);
  assert(tap.hits && tap.landed === 'jokeboo', `and the town underneath is tappable again: the stage opens the jokes (landed "${tap.landed}", topmost ${tap.by})`);
  await page.screenshot({ path: SHOTS + '/town-uncovered.png' });
  await ctx.close();
}

// ---- 6. leaving the hub BEFORE the ceremony fires ------------------------------------
// The harder half of the same defect, and the one a child actually hits: the hub schedules
// the ceremony ~400ms after its own mount, and the Play grid is right there, so she is
// often gone before it fires. The overlay was then appended over whatever screen she had
// reached — found sitting on the jokes screen with the Knock Knock card, Back and "?" all
// dead underneath it. Three departure timings, because this is a race.
console.log('== 6. leaving the hub before the ceremony fires ==');
for (const delay of [0, 150, 250]) {
  const { ctx, page } = await open(save({ seen: { lastStarsShown: 400 } }));   // trophyRetro NOT set
  await page.waitForSelector('.hub', { timeout: 10000 });
  if (delay) await page.waitForTimeout(delay);
  // Did she actually SEE it before she left? At the longest delay the 400ms timer can
  // legitimately have fired already, in which case spending the one-time award is correct.
  const sawOnHub = await page.evaluate(() => !!document.querySelector('.overlay.trophy-ceremony'));
  await page.evaluate(() => window.BooTown.go('jokeboo'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'jokeboo', null, { timeout: 10000 });
  await page.waitForTimeout(1500);   // well past the hub's 400ms timer
  const r = await page.evaluate(() => {
    const ov = document.querySelector('.overlay.trophy-ceremony');
    return { covered: !!ov, screen: document.getElementById('screen').dataset.screen, retro: !!(window.BooTown.State.getState().seen || {}).trophyRetro };
  });
  assert(!r.covered, `left the hub after ${delay}ms: no ceremony follows her onto the jokes screen`);
  assert(r.screen === 'jokeboo', `and she is still on the jokes (screen "${r.screen}")`);
  // The one-time award is spent EXACTLY when the ceremony was really shown to her, never
  // on one that fired into a screen she had already left.
  assert(r.retro === sawOnHub, sawOnHub
    ? 'it had already appeared on the hub before she left, so spending the one-time award is right'
    : 'and the retro award is NOT spent on a ceremony she never saw — it waits for her next hub visit');
  await ctx.close();
}
// ...and it still fires normally for someone who stays put
{
  const { ctx, page } = await open(save({ seen: { lastStarsShown: 400 } }));
  await page.waitForSelector('.hub', { timeout: 10000 });
  await page.waitForTimeout(1400);
  const up = await page.evaluate(() => {
    const ov = document.querySelector('.overlay.trophy-ceremony');
    return { up: !!ov, btn: ov && (ov.querySelector('.btn.big') || {}).textContent };
  });
  assert(up.up, 'a child who stays on the hub still gets her ceremony');
  assert(!/cabinet/i.test(up.btn || ''), `and its button no longer promises a cabinet it does not open ("${up.btn}")`);
  await ctx.close();
}

// ---- 7. Back returns her to the door she came in by ----------------------------------
console.log('== 7. Back goes where she came from ==');
{
  const { ctx, page } = await open();
  // in through the hub card
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub', { timeout: 10000 });
  await page.evaluate(() => [...document.querySelectorAll('.game-card')].find(c => /Joke Boos/.test(c.textContent)).click());
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'jokeboo', null, { timeout: 10000 });
  await page.evaluate(() => document.querySelector('.jb-top .back-btn, .jb-top button').click());
  await page.waitForTimeout(700);
  const fromHub = await page.evaluate(() => document.getElementById('screen').dataset.screen);
  assert(fromHub === 'hub', `in by the hub card, Back returns to the hub (landed "${fromHub}")`);

  // in through the stage in the Meadow
  await toMeadow(page);
  const viaStage = await tapStage(page);
  assert(viaStage.landed === 'jokeboo', 'in by the stage in the Meadow');
  await page.evaluate(() => document.querySelector('.jb-top .back-btn, .jb-top button').click());
  await page.waitForTimeout(900);
  const fromTown = await page.evaluate(() => document.getElementById('screen').dataset.screen);
  assert(fromTown === 'town', `and Back returns to the town, not the hub (landed "${fromTown}")`);
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
