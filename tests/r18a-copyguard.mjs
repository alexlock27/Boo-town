// tests/r18a-copyguard.mjs — RUN18A H6: the template-leakage guard, permanently.
//
// This programme found the word "null" printed under the Expedition's campfire, an
// authored placeholder ("…at SOMETHING") shipped as literal screen text, and a stock
// sentinel rendered as a count. They are one class of defect: a value that did not
// survive its template, shown to a child as if it were copy. This suite exists so that
// class cannot reship — it runs in the fixed core from now on.
//
// Two layers, deliberately:
//   1. A WALK of every registered route (plus the expedition screens, which no route
//      reaches while the feature is contained), asserting no rendered text node is or
//      contains a leaked token.
//   2. A RUNTIME guard in js/ui.js el(): the literal string "null"/"undefined" as a text
//      child throws in dev and renders nothing in production. The walk catches what it
//      visits; the guard catches what it does not.
//
// Proven to bite, per the r17x3 precedent: a planted offender is rendered on a real
// screen and the walk's own detector is run against it, in this file, every time.
//
// Expected runtime: ~14s (measured 13.4s; it mounts every route). Not @serial.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18a/h6';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// The forbidden tokens, exactly as H6 names them.
const EXACT = ['null', 'undefined', '[object Object]', 'NaN'];
const CONTAINS = [/\[object Object\]/, /\bat SOMETHING/i, /\bundefined\b/, /\bNaN\b/];
// A text node is an offender if it IS one of the tokens, or CONTAINS one of the phrases.
// "null" is deliberately exact-match only: "annulled" is a word, and a copy deck may one
// day contain it. The container-level leaks this programme actually hit were always whole
// nodes, because that is what interpolating a bad value produces.
const isOffender = (t) => EXACT.includes(t.trim()) || CONTAINS.some(re => re.test(t));

// Every route, read out of js/main.js's REAL registry — the r17x4 pattern, so a route
// added later is walked without anyone remembering to add it here.
const main = readFileSync('js/main.js', 'utf8');
const body = main.slice(main.indexOf('const registry'), main.indexOf('};', main.indexOf('const registry')));
const ROUTES = [...body.matchAll(/^\s*'?([\w-]+)'?\s*:\s*\(\)\s*=>/gm)].map(m => m[1]);

// Params some screens need in order to render anything at all.
const PARAMS = {
  town: { area: 'meadow' },
  expedition: { trail: true },
  expeditionpuzzle: { node: 'bridges' },
  results: { game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, cat: 'tables', level: 1 },
  toddlergame: { game: 'count' },
  jokeboo: { from: 'town' }
};

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const BOOS = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly', 'boo_wisp', 'boo_beam', 'boo_dot'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(id => [id, 1])),
  stars: { total: 600, byType: { maths: 200, word: 200, puzzle: 200, creative: 100, lesson: 100 }, spent: {}, legacy: 100, byGame: {} },
  trophies: {}, boxes: 2,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  expedition: { party: BOOS.slice(0, 8), tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 600, whatsnewVersion: 'x' },
  // The Feelings Corner is grown-up-gated and off by default (RUN17 X3). It is switched ON
  // in this fixture ON PURPOSE: it is a real screen full of authored copy, and a guard that
  // silently skips the one screen a grown-up has to unlock is a guard with a hole in it.
  settings: { sound: false, music: false, voice: false, content: 'full', feelingsCorner: true }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });

const textNodes = () => page.evaluate(() => {
  const out = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    if (n.parentElement && /^(script|style)$/i.test(n.parentElement.tagName)) continue;
    const t = n.textContent;
    if (t && t.trim()) out.push(t);
  }
  return out;
});

// ---- 0. the detector itself bites (r17x3 precedent) ------------------------------------
console.log('== 0. the detector is proven against a planted offender ==');
{
  const planted = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = '__copyguard_probe';
    host.append('null', ' ', document.createTextNode('One bridge sneezes at SOMETHING…'));
    document.body.appendChild(host);
    const out = [];
    const walk = document.createTreeWalker(document.getElementById('__copyguard_probe'), NodeFilter.SHOW_TEXT);
    let n; while ((n = walk.nextNode())) if (n.textContent.trim()) out.push(n.textContent);
    host.remove();
    return out;
  });
  const caught = planted.filter(isOffender);
  assert(planted.length >= 2, `planted ${planted.length} offending text nodes on a real page`);
  assert(caught.length === planted.length, `and the detector catches every one of them: ${JSON.stringify(caught)}`);
  const innocent = ['annulled', 'Nullarbor', 'a NaNny goat is not NaN', 'nothing to see'];
  assert(innocent.filter(isOffender).length === 1, 'while ordinary copy is not flagged (only the deliberate NaN in the sample is)');
}

// ---- 1. every registered route ---------------------------------------------------------
console.log(`== 1. walking all ${ROUTES.length} registered routes ==`);
const offenders = [];
let walked = 0;
for (const route of ROUTES) {
  try {
    await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, PARAMS[route] || {}]);
    await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 8000 });
    await page.waitForTimeout(180);
    walked++;
    const bad = (await textNodes()).filter(isOffender);
    if (bad.length) offenders.push({ route, bad: [...new Set(bad)].slice(0, 4) });
  } catch (e) {
    offenders.push({ route, bad: ['DID NOT MOUNT: ' + String(e).split('\n')[0].slice(0, 80)] });
  }
}
assert(walked >= ROUTES.length - 2, `mounted ${walked} of ${ROUTES.length} routes`);
assert(offenders.length === 0, 'no rendered text node on any route is a leaked token or a placeholder'
  + (offenders.length ? ':\n     ' + offenders.map(o => `${o.route}: ${JSON.stringify(o.bad)}`).join('\n     ') : ''));

// ---- 2. the expedition screens, which no route reaches while it is contained -----------
console.log('== 2. the expedition screens, walked explicitly ==');
{
  const expOffenders = [];
  for (const [route, params] of [['expedition', {}], ['expedition', { trail: true }],
    ['expeditionpuzzle', { node: 'bridges' }], ['expeditionpuzzle', { node: 'picnic' }],
    ['expeditionpuzzle', { node: 'raft' }], ['expeditionpuzzle', { node: 'hotel' }]]) {
    await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
    await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 8000 });
    await page.waitForTimeout(200);
    let bad = (await textNodes()).filter(isOffender);
    // and after the hint, which is where "Hmm… try THAT one!" used to live
    if (route === 'expeditionpuzzle') {
      await page.evaluate(() => window.__expeditionPuzzle && window.__expeditionPuzzle.hint());
      await page.waitForTimeout(150);
      bad = bad.concat((await textNodes()).filter(isOffender));
    }
    if (bad.length) expOffenders.push({ route: route + JSON.stringify(params), bad: [...new Set(bad)] });
  }
  assert(expOffenders.length === 0, 'the party picker, the trail and all four puzzles are clean, before and after a hint'
    + (expOffenders.length ? ': ' + JSON.stringify(expOffenders) : ''));
}

// ---- 3. the runtime guard in el() -------------------------------------------------------
console.log('== 3. the el() runtime guard ==');
{
  const r = await page.evaluate(async () => {
    const { el, IS_DEV } = await import('./js/ui.js');
    const out = { dev: IS_DEV, threw: [], rendered: {} };
    for (const bad of ['null', 'undefined', '[object Object]', 'NaN']) {
      try { el('p', {}, [bad]); out.threw.push(bad); } catch { out.threw.push(bad + ':THREW'); }
    }
    // ordinary strings, and legitimately null children, still work exactly as before
    const ok = el('p', {}, ['Hello', null, undefined, 'there']);
    out.rendered.ok = ok.textContent;
    const nested = el('div', {}, [el('span', { text: 'null' })]);   // a real element whose TEXT is "null"
    out.rendered.nestedElementUntouched = nested.textContent;
    return out;
  });
  assert(r.dev === true, 'the test host counts as dev, so the guard is in its loud mode');
  assert(r.threw.every(t => t.endsWith(':THREW')), `every leaked token throws in dev: ${JSON.stringify(r.threw)}`);
  assert(r.rendered.ok === 'Hellothere', `ordinary children still render, and null/undefined children are still skipped ("${r.rendered.ok}")`);
  assert(r.rendered.nestedElementUntouched === 'null', 'and el() does not police element children — only the literal string it was handed');
}

// ---- 4. and it is silent, not fatal, in production --------------------------------------
console.log('== 4. in production it renders nothing rather than throwing ==');
{
  const src = readFileSync('js/ui.js', 'utf8');
  assert(/IS_DEV\s*\?|if \(IS_DEV\)/.test(src), 'the guard is gated on IS_DEV');
  assert(/continue;/.test(src.slice(src.indexOf('refusing to render'))), 'and the non-dev path skips the child instead of throwing');
  assert(/localhost/.test(src), 'IS_DEV is decided by hostname, so a deployed build takes the quiet path');
}

await page.screenshot({ path: SHOTS + '/walk-complete.png' });
console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 8).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
