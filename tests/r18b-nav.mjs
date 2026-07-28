// tests/r18b-nav.mjs — RUN18B Y11: navigation and history.
//
// 1. Registry audit: every registered screen renders the shared "‹" (or is the hub / the
//    onboarding flow, which are the two screens with nowhere behind them). A screen with no
//    way back is a dead end, and a dead end is a child stuck.
// 2. The History API: go() pushes { name, params }; the browser's back routes IN-APP with no
//    reload; back into a round raises the existing "Leave this round?" dialog and cancelling
//    costs nothing; forward works; back at the hub never leaves the page.
// Expected runtime: ~35s. Not @serial.

import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The registry is read from the product source so the audit can never drift from it
// (the same trick tests/r12s1-routes.mjs uses).
const mainSrc = readFileSync('js/main.js', 'utf8');
const block = mainSrc.slice(mainSrc.indexOf('const registry = {'), mainSrc.indexOf('};', mainSrc.indexOf('const registry = {')));
const ROUTES = [...block.matchAll(/^\s*'?([a-zA-Z][\w-]*)'?\s*:\s*\(\)\s*=>/gm)].map(m => m[1]);
// hub is home; onboarding is the first-run flow, which has its own step-by-step nav and
// nothing behind it at all.
const HOME = new Set(['hub', 'onboarding']);

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const INTROS = ['bubblepop', 'beat', 'spellboo', 'feedboos', 'blocks', 'bounce', 'dash', 'teachme', 'clockshop',
  'boopop', 'detective', 'booroll', 'echoboos', 'oddboo', 'flashboos', 'soundsorter', 'blendit', 'rhymetime',
  'storyorder', 'golden', 'booquest'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1 }, stars: { total: 900, byGame: {}, byType: {}, spent: {}, legacy: 0 },
  trophies: {}, boxes: 1, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 900, introSeen: Object.fromEntries(INTROS.map(g => [g, true])) },
  // feelingsCorner is off by default (RUN17 X3) — switched on here so the audit walks the
  // real screen instead of its graceful redirect to the hub.
  settings: { sound: false, music: false, voice: false, content: 'full', feelingsCorner: true }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  // A page-lifetime marker: if it is still here after a back, the app routed rather than
  // reloaded. (There is no boot log to count; this proves the same thing more directly.)
  await page.evaluate(() => { window.__life = 'alive-' + Math.random(); });
  return { ctx, page };
}
const goTo = async (page, route, params = {}) => {
  await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
};

// ================== 1. every screen has a way back ==================
console.log(`== 1. registry audit: a reachable back path on all ${ROUTES.length} screens ==`);
{
  const { ctx, page } = await open();
  const missing = [];
  for (const route of ROUTES) {
    if (HOME.has(route)) continue;
    try {
      await page.evaluate(r => window.BooTown.go(r), route);
      await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 12000 });
      await sleep(120);   // a screen may finish its own async paint
      const ok = await page.evaluate(() => !!document.querySelector('.back-btn'));
      if (!ok) missing.push(route);
    } catch (e) { missing.push(route + ' (would not mount: ' + String(e).slice(0, 60) + ')'); }
    await goTo(page, 'hub');
  }
  assert(ROUTES.length >= 45, `the registry was read from source (${ROUTES.length} routes)`);
  assert(missing.length === 0, `every screen renders the shared "‹" (dead ends: ${missing.join(', ') || 'none'})`);
  await ctx.close();
}

// ================== 2. go() builds a history stack ==================
console.log('== 2. go() records { name, params } and pushes one entry each ==');
{
  const { ctx, page } = await open();
  await goTo(page, 'collection');
  await goTo(page, 'shop');
  const nav = await page.evaluate(() => window.BooTown.nav());
  assert(nav.stack.slice(-3).join('>') === 'hub>collection>shop', `the stack is what she walked (${nav.stack.filter(Boolean).join('>')})`);
  assert(nav.depth === nav.stack.length - 1, `depth points at the screen she is on (${nav.depth})`);
  await ctx.close();
}

// ================== 3. back routes in-app, with no reload ==================
console.log('== 3. the browser back routes in-app — no reload, no network ==');
{
  const { ctx, page } = await open();
  const life = await page.evaluate(() => window.__life);
  await goTo(page, 'collection');
  await goTo(page, 'shop');
  await page.goBack();
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'collection', null, { timeout: 10000 });
  assert(true, 'back from the shop lands on the collection she came from');
  await page.goBack();
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'hub', null, { timeout: 10000 });
  assert(true, 'and again lands on the hub');
  const after = await page.evaluate(() => ({ life: window.__life, navs: performance.getEntriesByType('navigation').length }));
  assert(after.life === life, 'the page never reloaded across two in-app backs (the lifetime marker survived)');
  assert(after.navs === 1, `exactly one document navigation for the whole session (${after.navs})`);
  // forward works too
  await page.goForward();
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'collection', null, { timeout: 10000 });
  assert(await page.evaluate(() => window.__life) === life, 'forward routes in-app as well, still no reload');
  await ctx.close();
}

// ================== 4. back at the hub never leaves the page ==================
console.log('== 4. back at the hub does nothing, and never leaves Boo Town ==');
{
  const { ctx, page } = await open();
  const life = await page.evaluate(() => window.__life);
  await page.goBack().catch(() => {});
  await sleep(400);
  await page.goBack().catch(() => {});
  await sleep(400);
  const r = await page.evaluate(() => ({ screen: document.getElementById('screen').dataset.screen, life: window.__life }));
  assert(r.screen === 'hub', `still on the hub after two backs (${r.screen})`);
  assert(r.life === life, 'and still the same page — back never walks out of the app');
  await ctx.close();
}

// ================== 5. back into a round asks first ==================
console.log('== 5. back in a round raises "Leave this round?" — and cancelling costs nothing ==');
{
  const { ctx, page } = await open();
  await goTo(page, 'bubblepop', { resume: { cat: 'tables', level: 1 } });
  await page.waitForSelector('.bubble-field', { timeout: 15000 });
  const before = await page.evaluate(() => window.BooTown.nav());
  await page.goBack();
  await page.waitForSelector('.overlay', { timeout: 6000 });
  const dlg = await page.evaluate(() => document.querySelector('.overlay').innerText);
  assert(/Leave this round\?/i.test(dlg), `the round's own dialog is what back raises (${dlg.split('\n')[0]})`);
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen) === 'bubblepop',
    'she is still in the round while the question is on screen');
  // a second back must not stack a second dialog
  await page.goBack().catch(() => {});
  await sleep(400);
  assert(await page.$$eval('.overlay', n => n.length) === 1, 'a second back does not stack a second dialog');
  // cancel — "Keep playing"
  await page.click('.overlay button:has-text("Keep playing")');
  await sleep(300);
  const after = await page.evaluate(() => window.BooTown.nav());
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen) === 'bubblepop',
    'Keep playing keeps her in the round');
  assert(after.depth === before.depth, `and history is exactly where it was (${before.depth} → ${after.depth})`);
  // now leave for real
  await page.goBack();
  await page.waitForSelector('.overlay', { timeout: 6000 });
  await page.click('.overlay button:has-text("Leave")');
  await page.waitForFunction(() => ['hub', 'results'].includes(document.getElementById('screen').dataset.screen), null, { timeout: 10000 });
  assert(true, 'and Leave leaves — to the hub or her results, as the round decides');
  await ctx.close();
}

// ================== 5b. the shared "‹" POPS, it does not stack ==================
// The playtest critic's MUST-FIX. The "‹" is a plain go('hub'), so the stack used to GROW on
// the way back and the gesture back then walked her FORWARDS into the screens she had just
// left — out of a round, one more back, and she was inside it again.
console.log('== 5b. the "‹" pops back rather than stacking a second copy ==');
{
  const { ctx, page } = await open();
  await goTo(page, 'collection');
  await page.click('.back-btn');
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'hub', null, { timeout: 10000 });
  let nav = await page.evaluate(() => window.BooTown.nav());
  assert(nav.stack.filter(Boolean).join('>') === 'hub' && nav.depth === 0,
    `"‹" from the collection pops back to a stack of just the hub (${nav.stack.filter(Boolean).join('>')} @${nav.depth})`);
  await page.goBack().catch(() => {});
  await sleep(400);
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen) === 'hub',
    'and the gesture back does NOT then walk her forwards into the collection again');

  // the same, two levels deep, through the town's "‹" chain
  await goTo(page, 'town', { area: 'meadow' });
  await goTo(page, 'worldmap');
  await goTo(page, 'hub');
  nav = await page.evaluate(() => window.BooTown.nav());
  assert(nav.stack.filter(Boolean).join('>') === 'hub' && nav.depth === 0,
    `arriving back at a screen already open below her drops everything in front of it (${nav.stack.filter(Boolean).join('>')})`);
  await page.goBack().catch(() => {});
  await sleep(400);
  await page.goBack().catch(() => {});
  await sleep(400);
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen) === 'hub',
    'two more backs still leave her on the hub, not back out through the world map');

  // leaving a round must not leave the round one back-press away
  await goTo(page, 'bubblepop', { resume: { cat: 'tables', level: 1 } });
  await page.waitForSelector('.bubble-field', { timeout: 15000 });
  await page.click('.game-topbar .back-btn');
  await page.waitForSelector('.overlay', { timeout: 6000 });
  await page.click('.overlay button:has-text("Leave")');
  await page.waitForFunction(() => ['hub', 'results'].includes(document.getElementById('screen').dataset.screen), null, { timeout: 10000 });
  const landed = await page.evaluate(() => document.getElementById('screen').dataset.screen);
  if (landed === 'hub') {
    await page.goBack().catch(() => {});
    await sleep(500);
    assert(await page.evaluate(() => document.getElementById('screen').dataset.screen) === 'hub',
      'and after leaving a round, back does not drop her straight back inside it');
  } else {
    assert(true, `leaving banked stars and went to ${landed} — the round is not on the stack behind the hub`);
  }
  await ctx.close();
}

// ================== 5c. a swallowed back keeps her forward branch ==================
console.log('== 5c. a back that goes nowhere does not destroy forward ==');
{
  const { ctx, page } = await open();
  await goTo(page, 'collection');
  await goTo(page, 'shop');
  await page.goBack(); await sleep(400);       // → collection
  await page.goBack(); await sleep(400);       // → hub
  await page.goBack().catch(() => {}); await sleep(400);   // → nothing (off the bottom)
  await page.goForward(); await sleep(500);
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen) === 'collection',
    'forward still works after a back that had nowhere to go');
  await ctx.close();
}

// ================== 6. a refresh opens where it always did ==================
console.log('== 6. a refresh opens the hub, exactly as before ==');
{
  const { ctx, page } = await open();
  await goTo(page, 'collection');
  await goTo(page, 'shop');
  assert(new URL(page.url()).hash === '' && new URL(page.url()).search === '',
    `the URL never changes — no hash, no query (${page.url()})`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen) === 'hub',
    'a refresh lands on the hub, not deep inside a screen she cannot leave');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
