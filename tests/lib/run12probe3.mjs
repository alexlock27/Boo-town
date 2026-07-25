// tests/lib/run12probe3.mjs — RUN12 S0 triage, pass 3 (NOT a suite).
// Pins down two root causes pass 2 only hinted at:
//   a) el()'s style object silently drops CSS custom properties (Object.assign on a
//      CSSStyleDeclaration ignores --* keys), which is why .echo-boo.lit renders nothing;
//   b) the Boo Beat lane colour selectors are off by one child.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP app.localhost 127.0.0.1'] });
const out = {};
const note = (id, d) => { out[id] = d; console.log('\n### ' + id + '\n' + JSON.stringify(d, null, 2)); };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1, boo_plum: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 4 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });

// (a) does el() carry a custom property through?
note('el-custom-props', await page.evaluate(async () => {
  const { el } = await import('./js/ui.js');
  const a = el('div', { style: { '--boo': '#ff0000', width: '10px' } });
  document.body.appendChild(a);
  const viaAssign = { inlineCssText: a.style.cssText, computedVar: getComputedStyle(a).getPropertyValue('--boo').trim(), width: a.style.width };
  const b = document.createElement('div');
  b.style.setProperty('--boo', '#ff0000');
  document.body.appendChild(b);
  const viaSetProperty = { inlineCssText: b.style.cssText, computedVar: getComputedStyle(b).getPropertyValue('--boo').trim() };
  a.remove(); b.remove();
  return { viaObjectAssign: viaAssign, viaSetProperty,
    verdict: viaAssign.computedVar === '' ? 'el() DROPS custom properties' : 'el() carries custom properties',
    callSitesAffected: ['js/games/echoboos.js:112 --boo', 'js/gameshell.js:50 --accent', 'js/hub.js:203 --accent',
      'js/games/detective.js:116 --cols', 'js/trophies.js:265 --petal/--growth/--delay',
      'js/care.js:197,232 --i', 'js/discohall.js:34,41 --i', 'js/town.js:2082 --i',
      'js/games/{beat,boopop,bounce,clockshop}.js level-btn --accent'] };
}));

// (b) Echo lit state, measured AFTER the 120ms transition settles, with --boo forced on
await page.evaluate(() => window.BooTown.go('echoboos', { resume: true }));
await page.waitForTimeout(1200);
await page.evaluate(() => window.__intro && window.__intro.close());
await page.waitForTimeout(800);
note('F12-10-lit-settled', await page.evaluate(async () => {
  const boo = document.querySelector('.echo-boo');
  if (!boo) return { error: 'no podium' };
  const read = () => { const c = getComputedStyle(boo); return { filter: c.filter, transform: c.transform, boxShadow: c.boxShadow }; };
  const unlit = read();
  boo.classList.add('lit');
  await new Promise(r => setTimeout(r, 400));
  const asShipped = read();
  boo.classList.remove('lit');
  await new Promise(r => setTimeout(r, 400));
  // now prove the cause: set --boo the way the code MEANT to and re-measure
  boo.style.setProperty('--boo', '#6C63FF');
  boo.classList.add('lit');
  await new Promise(r => setTimeout(r, 400));
  const withVarSet = read();
  boo.classList.remove('lit');
  boo.style.removeProperty('--boo');
  return { unlit, litAsShipped: asShipped, litWithBooVarSet: withVarSet,
    filterChangedAsShipped: unlit.filter !== asShipped.filter,
    filterChangedOnceVarIsSet: unlit.filter !== withVarSet.filter };
}));

// (c) Boo Beat lane selectors
await page.evaluate(() => window.BooTown.go('beat', { resume: { mix: true } }));
await page.waitForTimeout(1200);
await page.evaluate(() => window.__intro && window.__intro.close());
await page.waitForTimeout(1500);
note('F12-05-lane-selectors', await page.evaluate(() => {
  const field = document.querySelector('.beat-field');
  return { fieldChildren: [...field.children].map(c => c.className),
    lanes: [...document.querySelectorAll('.beat-lane')].map((l, i) => ({
      lane: i, nthChildIndex: [...l.parentElement.children].indexOf(l) + 1,
      laneVar: getComputedStyle(l).getPropertyValue('--lane').trim() || '(unset)' })) };
}));

await browser.close();
writeFileSync('screenshots/run12/triage/evidence3.json', JSON.stringify(out, null, 2));
console.log('\n=== PASS 3 COMPLETE ===');
