// tests/r18d-detective-abc.mjs — RUN18D D6: Word Detective's "ABC keys".
//
// A nine-year-old who has never used a keyboard has no reason to know where QWERTY hides
// its letters. RUN12 S13.1 already put an A-Z board behind an age default and a grown-ups
// switch; D6 puts the switch where the child is — on the game's own options row — and gives
// the ABC board the pack's layout: A-I / J-R / S-Z, then backspace and GO alone on a fourth
// row. Default stays QWERTY for a Full-tier save. Colour feedback is the same state
// repainted, so the two layouts cannot drift.
// Expected runtime: ~25s. Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('screenshots/run18d/d6', { recursive: true });

const ABC_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'];
const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (settings = {}) => JSON.stringify({
  version: 19, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, trophies: {}, boxes: 0, meter: 2, spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 400, byGame: {}, byType: { maths: 100, word: 100, puzzle: 100, creative: 100, lesson: 100 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 2 }, shop: { welcomed: true },
  seen: { trophyRetro: true, lastStarsShown: 400, welcomeTour: true, introSeen: { detective: 1 } },
  settings: Object.assign({ sound: false, music: false, voice: false, content: 'full' }, settings)
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function playDetective(width = 1024, height = 768, settings = {}, seedOnce = false) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  const s = save(settings);
  if (seedOnce) await page.addInitScript(v => { if (!localStorage.getItem('bootown.save.v1')) localStorage.setItem('bootown.save.v1', v); }, s);
  else await page.addInitScript(v => localStorage.setItem('bootown.save.v1', v), s);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 40000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 40000 });
  await page.evaluate(() => window.BooTown.go('detective'));
  await page.waitForSelector('.det-modes .btn', { timeout: 15000 });
  await page.click('.det-modes .btn');
  await page.waitForSelector('.det-key', { timeout: 15000 });
  await sleep(250);
  return { ctx, page };
}
const rowsOf = (page) => page.evaluate(() => window.__detective.letterRows());

// ================== 1. default stays QWERTY ==================
console.log('== the default is unchanged: a nine-year-old still gets QWERTY ==');
{
  const { ctx, page } = await playDetective();
  assert(await page.evaluate(() => window.__detective.abc()) === false, 'ABC keys is off by default at the Full tier');
  const rows = await rowsOf(page);
  assert(rows[0].startsWith('QWERTY'), `the top row is QWERTY (${rows[0]})`);
  assert(!!(await page.$('.det-options .det-opt-toggle')), 'the switch is on the game\'s own options row');
  const label = await page.$eval('.det-opt-toggle', n => n.textContent.trim());
  assert(label === 'ABC keys', `and it is labelled "ABC keys" (${label})`);
  await page.screenshot({ path: 'screenshots/run18d/d6/qwerty-1024.png' });
  await ctx.close();
}

// ================== 2. the ABC layout is the authored one ==================
console.log('== A-I / J-R / S-Z, then backspace and GO alone on a fourth row ==');
{
  const { ctx, page } = await playDetective(1024, 768, { detectiveAbc: true });
  const rows = await rowsOf(page);
  assert(rows.length === 4, `four rows (${rows.length})`);
  assert(rows[0] === ABC_ROWS[0] && rows[1] === ABC_ROWS[1] && rows[2] === ABC_ROWS[2],
    `the letters are A-I / J-R / S-Z (${rows.slice(0, 3).join(' / ')})`);
  const actions = await page.evaluate(() => [...document.querySelectorAll('.det-kb-actions .det-key')].map(k => k.getAttribute('aria-label')));
  assert(actions.length === 2 && actions.includes('Backspace') && actions.includes('Enter'),
    `the fourth row is backspace and GO, alone (${actions.join(',')})`);
  const letters = rows.slice(0, 3).join('');
  assert(letters.length === 26 && new Set(letters).size === 26, `all 26 letters, once each (${letters.length})`);
  await page.screenshot({ path: 'screenshots/run18d/d6/abc-1024.png' });
  await ctx.close();
}

// ================== 3. every key is a real tap target ==================
console.log('== key sizes, at 1024 and at 390 ==');
for (const [w, h] of [[1024, 768], [390, 844]]) {
  const { ctx, page } = await playDetective(w, h, { detectiveAbc: true });
  const keys = await page.evaluate(() => window.__detective.keyRects());
  assert(keys.length === 28, `${w}: 26 letters plus backspace and GO (${keys.length})`);
  const shortest = Math.min(...keys.map(k => k.h));
  assert(shortest >= 55.5, `${w}: every key is at least 56px tall (shortest ${shortest.toFixed(1)})`);
  const narrowest = Math.min(...keys.map(k => k.w));
  if (w >= 600) {
    assert(narrowest >= 55.5, `${w}: and at least 56px wide (narrowest ${narrowest.toFixed(1)})`);
  } else {
    // Documented in BLOCKED.md: nine keys plus gaps need 544px and a 390px screen has 374.
    // Height is the authored 56; width is as wide as the glass allows, and asserted so a
    // regression that made it WORSE would still be caught.
    assert(narrowest >= 34, `${w}: as wide as nine-across allows (narrowest ${narrowest.toFixed(1)}px; 56 needs a 544px board)`);
  }
  await page.screenshot({ path: `screenshots/run18d/d6/abc-${w}.png` });
  await ctx.close();
}

// ================== 4. it persists, and it carries the colours over ==================
console.log('== the switch persists, and the badges carry over mid-round ==');
{
  const { ctx, page } = await playDetective(1024, 768, {}, true);
  assert(await page.evaluate(() => window.__detective.abc()) === false, 'starts on QWERTY');
  // play a guess so there are colours to carry
  await page.evaluate(() => { const t = window.__detective.target(); window.__detective.guess(t.slice(0, 1) + 'zzz'.slice(0, t.length - 1)); });
  await sleep(900);
  const before = await page.evaluate(() => window.__detective.keyState());
  assert(Object.keys(before).length > 0, `the QWERTY board has coloured keys (${JSON.stringify(before)})`);

  await page.click('.det-opt-toggle');
  await sleep(300);
  const rows = await rowsOf(page);
  assert(rows[0] === ABC_ROWS[0], 'the board swaps to ABC in place, mid-round');
  const painted = await page.evaluate(() => {
    const out = {};
    for (const k of document.querySelectorAll('.det-kb .det-key[data-key]')) {
      const st = [...k.classList].find(c => ['green', 'orange', 'grey'].includes(c));
      if (st) out[k.dataset.key] = st;
    }
    return out;
  });
  assert(JSON.stringify(painted) === JSON.stringify(before),
    `every badge carried over to the new layout (${JSON.stringify(painted)} vs ${JSON.stringify(before)})`);
  const stateKept = await page.evaluate(() => window.__detective.state());
  assert(stateKept.guessesUsed === 1 && !stateKept.ended, 'and the round itself is untouched');

  // …and it survives a reload, which is the whole point of a setting
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 40000 });
  await page.evaluate(() => window.BooTown.go('detective'));
  await page.waitForSelector('.det-modes .btn', { timeout: 15000 });
  await page.click('.det-modes .btn');
  await page.waitForSelector('.det-key', { timeout: 15000 });
  await sleep(250);
  const after = await rowsOf(page);
  assert(after[0] === ABC_ROWS[0], `the choice survives a reload (${after[0]})`);
  await ctx.close();
}

// ================== 5. a pre-v19 save keeps exactly the keyboard it had ==================
console.log('== migration: a save from before the switch behaves identically ==');
{
  const { ctx, page } = await playDetective();
  const r = await page.evaluate(async () => {
    const m = await import('./js/state.js');
    const light = m.migrate({ version: 18, settings: { content: 'light' } });
    const full = m.migrate({ version: 18, settings: { content: 'full' } });
    const twice = m.migrate(JSON.parse(JSON.stringify(light)));
    return { lightVal: light.settings.detectiveAbc, fullVal: full.settings.detectiveAbc,
             version: light.version, currentVersion: m.VERSION, idempotent: twice.settings.detectiveAbc === light.settings.detectiveAbc };
  });
  // migrate() always brings a save up to the CURRENT VERSION, not to 19 specifically — that
  // was true only the day D6 shipped. Compare against the live constant so a future version
  // bump can never make this suite stale again the way it made this suite stale once already.
  assert(r.version === r.currentVersion, `migrating brings a v18 save to the current VERSION (${r.version} vs ${r.currentVersion})`);
  assert(r.lightVal === null && r.fullVal === null, 'the new setting migrates in as NULL — "no answer yet", not "off"');
  assert(r.idempotent, 'migrating twice is identical');
  // null means: follow the age-based global exactly as before D6
  const follows = await page.evaluate(async () => {
    const a11y = await import('./js/a11y.js');
    const S = window.BooTown.State;
    S.mutate(st => { st.settings.detectiveAbc = null; st.settings.content = 'light'; });
    const asLight = a11y.detectiveAbcOn();
    S.mutate(st => { st.settings.content = 'full'; });
    const asFull = a11y.detectiveAbcOn();
    S.mutate(st => { st.settings.detectiveAbc = true; });
    const overridden = a11y.detectiveAbcOn();
    return { asLight, asFull, overridden };
  });
  assert(follows.asLight === true, 'a Light-tier save still gets the A-Z board it had before');
  assert(follows.asFull === false, 'a Full-tier save still gets QWERTY');
  assert(follows.overridden === true, 'and her own answer overrides the age default');
  await ctx.close();
}

await browser.close();
assert(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
