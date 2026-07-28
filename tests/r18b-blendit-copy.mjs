// tests/r18b-blendit-copy.mjs — RUN18B Y13: Blend It says what she can actually do.
//
// Every instruction told her to PULL or SLIDE the sounds together. The pinch that honours
// that is real, but it is a two-finger-ish drag on tiles a few dozen pixels apart, and a
// child who is TOLD to make a gesture and cannot land it reads the game as broken. All
// instruction copy is now the authored line — "Tap Blend and watch the sounds slide
// together!" — and no imperative anywhere implies dragging. The pinch stays, unadvertised.
// Expected runtime: ~9s. Not @serial.

import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const LINE = 'Tap Blend and watch the sounds slide together!';

// ================== 1. no drag imperative survives anywhere in the app ==================
console.log('== 1. no copy anywhere tells her to drag the sounds ==');
{
  const walk = (d) => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : (n.endsWith('.js') ? [p] : []); });
  // the imperative forms only — "watch the sounds slide together" is a DESCRIPTION and is
  // exactly what the authored line says, so `slide` on its own must not be banned.
  const BAD = /pull (the sounds?|them) together|slide (the )?sounds? together|pull them in/i;
  const hits = [];
  for (const f of [...walk('js'), ...walk('data')]) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (!BAD.test(line)) return;
      if (/watch the sounds slide together/i.test(line)) return;   // the authored line itself
      hits.push(`${f}:${i + 1} ${line.trim().slice(0, 80)}`);
    });
  }
  assert(hits.length === 0, `no "pull/slide the sounds together" imperative in js/ or data/ (${hits.join(' | ') || 'none'})`);
}

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (introSeen) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 },
  trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: introSeen ? { blendit: true } : {} },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});
const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(introSeen = true) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(introSeen));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}

// ================== 2. every place she is told what to do ==================
console.log('== 2. the authored line, everywhere she is told what to do ==');
{
  const { ctx, page } = await open();
  const tag = await page.$eval('.game-card:has(.gc-name:text-is("Blend It")) .gc-tag', n => n.textContent).catch(() => null);
  assert(tag && /tap blend/i.test(tag), `the hub card names the button, not a drag ("${tag}")`);

  await page.evaluate(() => window.BooTown.go('blendit'));
  await page.waitForSelector('.start-card', { timeout: 15000 });
  const intro = await page.$eval('.sc-intro', n => n.textContent);
  assert(intro === LINE, `the start card carries the authored line verbatim ("${intro}")`);

  await page.evaluate(() => window.BooTown.go('blendit', { resume: { level: 1 } }));
  await page.waitForSelector('.bl-blend-btn', { timeout: 15000 });
  const r = await page.evaluate(() => ({
    instruction: (document.querySelector('.tm-try-instruction') || {}).textContent,
    btn: (document.querySelector('.bl-blend-btn') || {}).textContent,
    aria: (document.querySelector('.bl-blend-btn') || {}).getAttribute('aria-label')
  }));
  assert(r.instruction === LINE, `the in-round instruction is the authored line ("${r.instruction}")`);
  assert(/blend/i.test(r.btn), `and the button it names is right there ("${r.btn.trim()}")`);
  assert(!/pull|slide/i.test(r.aria), `the button's screen-reader name does not ask for a drag either ("${r.aria}")`);
  await ctx.close();
}

// ================== 3. the first-play intro agrees with it ==================
console.log('== 3. the first-play intro agrees ==');
{
  const { ctx, page } = await open(false);
  await page.evaluate(() => window.BooTown.go('blendit'));
  await page.waitForSelector('.intro-overlay', { timeout: 15000 });
  const steps = await page.$$eval('.intro-overlay', ns => ns.map(n => n.innerText));
  const text = steps.join(' ');
  assert(/Tap Blend and watch the sounds slide together!/.test(text) || /shy/.test(text),
    'the intro is up on a first play');
  const src = readFileSync('js/intro.js', 'utf8');
  const bl = src.slice(src.indexOf('blendit: ['), src.indexOf(']', src.indexOf('blendit: [')));
  assert(bl.includes(LINE) && !/Pull them together/i.test(bl),
    'and its middle step is the authored line, not "Pull them together, or tap Blend"');
  await ctx.close();
}

// ================== 4. tapping Blend is the path that works ==================
console.log('== 4. tapping Blend does what the line promises ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('blendit', { resume: { level: 1 } }));
  await page.waitForSelector('.bl-blend-btn', { timeout: 15000 });
  const before = await page.$eval('.bl-word', n => n.textContent.trim());
  await page.click('.bl-blend-btn');
  await page.waitForFunction(() => (document.querySelector('.bl-word') || {}).textContent.trim().length > 0, null, { timeout: 8000 });
  const after = await page.$eval('.bl-word', n => n.textContent.trim());
  assert(before === '' && after.length > 0, `one tap slides the sounds into a word ("" → "${after}")`);
  await page.waitForSelector('.bl-picks .btn, .bl-picks button', { timeout: 8000 });
  assert(true, 'and the pictures she picks from arrive after it');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
