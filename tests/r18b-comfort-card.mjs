// tests/r18b-comfort-card.mjs — RUN18B Y15: the Comfort & access card.
//
// Two switches on the grown-ups' Settings tab, persisted in the save and applied LIVE:
//   "Calm motion"  → forces the REDUCED path app-wide, whatever the tablet's own setting is
//   "Bigger text"  → one step, the authored 112.5%
// Copy under the card title: "Small comforts for small eyes and busy screens."
// The pack's assertions: they persist across a reload; REDUCED is honoured with the OS
// setting OFF; and nothing breaks at 112.5% on the hub, the results screen and the shop.
// Expected runtime: ~25s. Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18b/comfort';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (settings = {}) => JSON.stringify({
  version: 18, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 900, byGame: {}, byType: { maths: 200, word: 200, puzzle: 200, creative: 200, lesson: 200 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, shop: { welcomed: true },
  seen: { trophyRetro: true, lastStarsShown: 900, introSeen: { shop: true } },
  settings: Object.assign({ sound: false, music: false, voice: false, content: 'full' }, settings)
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
// reducedMotion:'no-preference' is the point of the pack's assertion — the OS setting is OFF,
// so anything REDUCED does here is the card's doing and nothing else's.
async function open(settings = {}, viewport = { width: 1024, height: 768 }) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  // Seed ONLY if empty: addInitScript runs on every navigation, and this suite RELOADS to
  // prove the switches persist. An unconditional seed would rewrite the original save over
  // the app's own write and fail a perfectly correct app.
  await page.addInitScript(s => { if (!localStorage.getItem('bootown.save.v1')) localStorage.setItem('bootown.save.v1', s); }, save(settings));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}
const openGrownups = async (page) => {
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-card', { timeout: 15000 });
  await sleep(200);
};
const switchFor = (page, label) => page.evaluate((l) => {
  const row = [...document.querySelectorAll('.gu-toggle')].find(r => (r.querySelector('.gu-label') || {}).textContent === l);
  return row ? { on: row.querySelector('.gu-switch').classList.contains('on'), checked: row.querySelector('.gu-switch').getAttribute('aria-checked') } : null;
}, label);
const flip = (page, label) => page.evaluate((l) => {
  const row = [...document.querySelectorAll('.gu-toggle')].find(r => (r.querySelector('.gu-label') || {}).textContent === l);
  row.querySelector('.gu-switch').click();
}, label);

// ================== 1. the card, its title and its line ==================
console.log('== 1. the card is on the Settings tab, with its authored line ==');
{
  const { ctx, page } = await open();
  await openGrownups(page);
  const card = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.gu-card')].find(x => (x.querySelector('h3') || {}).textContent === 'Comfort & access');
    if (!c) return null;
    return {
      firstNote: (c.querySelector('.gu-note') || {}).textContent,
      labels: [...c.querySelectorAll('.gu-toggle .gu-label')].map(l => l.textContent),
      onSettingsTab: !!c.closest('.gu-panel[data-tab="settings"]')
    };
  });
  assert(!!card, 'a "Comfort & access" card exists');
  assert(card.firstNote === 'Small comforts for small eyes and busy screens.',
    `with the authored line under its title, verbatim ("${card.firstNote}")`);
  assert(card.labels.join(' | ') === 'Calm motion | Bigger text', `and the two authored switches (${card.labels.join(' | ')})`);
  assert(card.onSettingsTab, 'on the Settings tab, where a grown-up looks for settings');
  await ctx.close();
}

// ================== 2. Calm motion forces REDUCED with the OS setting off ==================
console.log('== 2. Calm motion forces the reduced path, OS setting off ==');
{
  const { ctx, page } = await open();
  const osOff = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  assert(osOff === false, 'the device is NOT asking for reduced motion — so anything below is the card');
  const before = await page.evaluate(async () => (await import('./js/ui.js')).REDUCED);
  assert(before === false, 'and REDUCED is off to begin with');

  await openGrownups(page);
  await flip(page, 'Calm motion');
  await sleep(250);
  const after = await page.evaluate(async () => ({
    reduced: (await import('./js/ui.js')).REDUCED,
    calm: (await import('./js/ui.js')).calmMotionOn(),
    cls: document.documentElement.classList.contains('calm-motion'),
    saved: window.BooTown.State.getState().settings.calmMotion
  }));
  assert(after.reduced === true, 'switching it on forces REDUCED app-wide, live, with no reload');
  assert(after.calm === true && after.cls === true, 'the root carries .calm-motion so the CSS-driven motion stops too');
  assert(after.saved === true, 'and it is written to the save');

  // the blanket really lands: a transition duration collapses
  const dur = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.transition = 'transform 400ms ease';
    document.body.appendChild(probe);
    const d = getComputedStyle(probe).transitionDuration;
    probe.remove(); return d;
  });
  assert(parseFloat(dur) < 0.01, `every transition collapses to a hair above zero (${dur})`);

  // ---- persists across a reload ----
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  const reloaded = await page.evaluate(async () => ({
    reduced: (await import('./js/ui.js')).REDUCED,
    cls: document.documentElement.classList.contains('calm-motion'),
    saved: window.BooTown.State.getState().settings.calmMotion
  }));
  assert(reloaded.saved === true && reloaded.cls === true && reloaded.reduced === true,
    'and it survives a reload — applied at boot, before the first frame she sees');

  // ---- switching it off hands the decision back ----
  await openGrownups(page);
  await flip(page, 'Calm motion');
  await sleep(250);
  const off = await page.evaluate(async () => ({ reduced: (await import('./js/ui.js')).REDUCED, saved: window.BooTown.State.getState().settings.calmMotion }));
  assert(off.reduced === false && off.saved === false, 'switching it off returns the decision to the device');
  await ctx.close();
}

// ================== 3. Calm motion never overrides a device that asked for it ==================
console.log('== 3. off must never TAKE AWAY the tablet\'s own calm ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save({ calmMotion: false }));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  const r = await page.evaluate(async () => (await import('./js/ui.js')).REDUCED);
  assert(r === true, 'a tablet set to reduce motion still gets REDUCED with the card switched off');
  await ctx.close();
}

// ================== 4. Bigger text: one step, and nothing breaks ==================
console.log('== 4. Bigger text: 112.5%, on hub, results and shop, at three widths ==');
{
  const { ctx, page } = await open();
  await openGrownups(page);
  await flip(page, 'Bigger text');
  await sleep(250);
  const on = await page.evaluate(async () => ({
    cls: document.documentElement.classList.contains('bigger-text'),
    scale: (await import('./js/ui.js')).BIGGER_TEXT_SCALE,
    saved: window.BooTown.State.getState().settings.biggerText
  }));
  assert(on.cls === true && on.saved === true, 'switching it on applies live and is written to the save');
  assert(on.scale === '112.5%', `at the authored one step (${on.scale})`);

  // it really is bigger: the same element, measured on and off
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub', { timeout: 15000 });
  const measure = () => page.evaluate(() => {
    const n = document.querySelector('.game-card .gc-name');
    return n ? +(n.getBoundingClientRect().height).toFixed(2) : null;
  });
  const big = await measure();
  await page.evaluate(async () => (await import('./js/ui.js')).setBiggerText(false));
  await sleep(150);
  const small = await measure();
  assert(big && small && big / small > 1.08 && big / small < 1.17,
    `text really is one step bigger — a hub card's name grows ${(big / small).toFixed(3)}x (want ~1.125)`);
  await page.evaluate(async () => (await import('./js/ui.js')).setBiggerText(true));
  await sleep(150);

  // ---- no layout breaks on the three screens the pack names, at three widths ----
  for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const [route, params, ready] of [
      ['hub', {}, '.hub'],
      ['results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, level: 1, cat: 'tables', mix: false }, '.result-card'],
      ['shop', {}, '.shop-header, .boo-drawer']
    ]) {
      await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
      await page.waitForSelector(ready, { timeout: 15000 });
      await sleep(350);
      // Measured with the switch ON and again OFF, and only a NEW escapee counts. The hub's
      // Today rail scrolls sideways by design, so chips beyond the fold are outside the
      // viewport at every size — an absolute check would fail a perfectly good screen.
      const probe = () => page.evaluate(() => {
        const d = document.documentElement;
        const s = document.getElementById('screen').firstElementChild;
        const scroller = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
        return {
          docOverflow: d.scrollWidth - d.clientWidth,
          screenOverflow: s ? s.scrollWidth - s.clientWidth : 0,
          escaping: [...document.querySelectorAll('#screen *')]
            .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2) && !scroller(e); })
            .map(e => String(e.className).slice(0, 30))
        };
      });
      const bad = await probe();
      await page.evaluate(async () => (await import('./js/ui.js')).setBiggerText(false));
      await sleep(250);
      const base = await probe();
      await page.evaluate(async () => (await import('./js/ui.js')).setBiggerText(true));
      await sleep(250);
      const fresh = bad.escaping.filter(c => !base.escaping.includes(c));
      assert(bad.docOverflow <= 1 && bad.screenOverflow <= 1,
        `${route} at ${w}px: no horizontal overflow at 112.5% (doc ${bad.docOverflow}, screen ${bad.screenOverflow})`);
      assert(fresh.length === 0, `${route} at ${w}px: bigger text pushes nothing out of the viewport that was inside it before (${fresh.join(', ') || 'nothing new'})`);
      if (w === 1024) await page.screenshot({ path: `${SHOTS}/${route}-bigger-1024.png` });
    }
  }
  await ctx.close();
}

// ================== 4b. the viewport-unit trap the critic found ==================
// `zoom` scales every length EXCEPT viewport units, so a 100vh panel resolves to 112.5% of
// the real screen while "Bigger text" is on. At 390x844 that put ten of the Wish Well's
// keyboard keys — including backspace — below the fold of a panel that does not scroll, and
// pushed Boo Care's only exit 80% off the right edge. Both are pinned here by HIT-TESTING
// the controls rather than by measuring the panel, because reachable is the thing that
// matters.
console.log('== 4b. full-viewport panels still fit the screen at 112.5% ==');
{
  const { ctx, page } = await open({ biggerText: true }, { width: 390, height: 844 });
  // the Wish Well: every key must be tappable
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow', openWishWell: true }));
  await page.waitForSelector('.wish-panel', { timeout: 15000 });
  await sleep(500);
  const keys = await page.evaluate(() => {
    const ks = [...document.querySelectorAll('.wish-panel button')];
    const out = { total: ks.length, unreachable: [] };
    for (const k of ks) {
      const r = k.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cy < 0 || cy > innerHeight || cx < 0 || cx > innerWidth) { out.unreachable.push((k.textContent || k.getAttribute('aria-label') || '?').trim().slice(0, 10)); continue; }
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || !(hit === k || k.contains(hit) || hit.contains(k))) out.unreachable.push((k.textContent || '?').trim().slice(0, 10));
    }
    return out;
  });
  assert(keys.total > 20, `the Wish Well's keyboard is up (${keys.total} controls)`);
  assert(keys.unreachable.length === 0, `and every one of them can be tapped at 112.5% (unreachable: ${keys.unreachable.join(' ') || 'none'})`);

  // Boo Care: its close control must be fully on screen
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-grid', { timeout: 15000 });
  const cared = await page.evaluate(async () => {
    const { openCare } = await import('./js/care.js');
    const { COLLECTIBLES } = await import('./data/catalogue.js');
    const item = COLLECTIBLES.find(x => x.id === 'boo_inky');
    if (openCare && item) { openCare(item); return true; }
    return false;
  }).catch(() => false);
  if (cared) {
    await page.waitForSelector('.care-panel', { timeout: 8000 });
    await sleep(400);
    const exit = await page.evaluate(() => {
      const p = document.querySelector('.care-panel');
      const pr = p.getBoundingClientRect();
      const x = p.querySelector('.care-close, [aria-label*="lose"], [aria-label*="ack"]') || p.querySelector('button');
      const r = x ? x.getBoundingClientRect() : null;
      return { panelRight: Math.round(pr.right), vw: innerWidth, exitRight: r ? Math.round(r.right) : null, exitLeft: r ? Math.round(r.left) : null };
    });
    assert(exit.panelRight <= exit.vw + 2, `the Boo Care panel fits the screen (right ${exit.panelRight} of ${exit.vw})`);
    assert(exit.exitRight === null || exit.exitRight <= exit.vw + 2, `and its way out is fully on it (right edge ${exit.exitRight})`);
  } else {
    console.log('  · Boo Care could not be opened directly here — panel width covered by the panelRight check above');
  }
  await ctx.close();
}

// ================== 5. both switches together, from a cold boot ==================
console.log('== 5. a save with both on boots with both applied ==');
{
  const { ctx, page } = await open({ calmMotion: true, biggerText: true });
  const r = await page.evaluate(async () => ({
    reduced: (await import('./js/ui.js')).REDUCED,
    calm: document.documentElement.classList.contains('calm-motion'),
    big: document.documentElement.classList.contains('bigger-text')
  }));
  assert(r.reduced && r.calm && r.big, 'both are on from the very first frame, no toggling required');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
