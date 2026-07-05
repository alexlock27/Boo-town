// tests/hotfix-dash-results.mjs — live-bug reproducer: play a FULL Boo Dash round
// (all 12 gates) and let it transition into results. Captures every page error and
// console error, and verifies stars are awarded and banked to the meter.
// Run: node tests/hotfix-dash-results.mjs            (local)
//      BASE=https://alexlock27.github.io/Boo-town node tests/hotfix-dash-results.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = {
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 20, byGame: {} },
  ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { trophyRetro: true }, ageAsked: true, age: 8
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('requestfailed', r => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure() || {}).errorText));

console.log('== full Boo Dash round → results on', BASE, '==');
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub', { timeout: 15000 });
await sleep(1500);   // let any service worker settle

await page.evaluate(() => window.BooTown.go('dash'));
await page.waitForSelector('.picker');
await page.click('.picker-choice:has-text("Times tables")');
await page.click('.picker-levels .level-btn >> nth=0');
await page.waitForSelector('.d2-scene, .dash-scene, [data-screen="dash"] .game-topbar', { timeout: 8000 });
await sleep(600);

const played = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const D = window.__dash;
  if (!D) return { ok: false, why: 'no __dash hook' };
  let guard = 0;
  while (!D.ended() && guard++ < 300) { D.tap(true); await sleep(90); }
  return { ok: true, ended: D.ended(), gate: D.state ? D.state().gate : null };
});
console.log('  round driven:', JSON.stringify(played));

const gotResults = await page.waitForSelector('.result-card', { timeout: 8000 }).then(() => true).catch(() => false);
assert(gotResults, 'the results screen appears after the last gate');
await sleep(2600);   // stars animate + meter fills + trophy check timer

const screenNow = await page.evaluate(() => document.getElementById('screen').dataset.screen);
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
assert(screenNow === 'results', `still on results, no white page (screen="${screenNow}")`);
assert(!/Something went wrong loading/i.test(bodyText), 'no "Something went wrong loading" fallback card');

const st = await page.evaluate(() => {
  const s = window.BooTown.State.getState();
  return { total: s.stars.total, meter: s.meter, plays: s.stars.byGame.dash.plays, best: s.stars.byGame.dash.best };
});
assert(st.total > 20, `stars awarded to the total (20 → ${st.total})`);
assert(st.plays === 1 && st.best >= 1, `round recorded (plays ${st.plays}, best ${st.best})`);
assert(st.meter > 0 || st.total - 20 >= 4, `meter banked (${st.meter})`);

console.log('\n== console/page errors during the whole flow ==');
if (errors.length) errors.forEach(e => console.log('  !', e));
// ERR_ABORTED = the harness's own reload cancelling in-flight module fetches — not a runtime error
const real = errors.filter(e => !/favicon/i.test(e) && !(/^REQFAIL/.test(e) && /ERR_ABORTED/.test(e)));
assert(real.length === 0, 'zero console errors across finish → results (' + real.join(' | ') + ')');

await browser.close();
console.log(failed ? '\nhotfix-dash-results: FAIL' : '\nhotfix-dash-results: ALL PASS');
process.exit(failed ? 1 : 0);
