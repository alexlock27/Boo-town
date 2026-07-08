// tests/r5p0-ledger.mjs — RUN5 phase 0 (C0): the crediting invariant + Star Ledger.
// Acceptance (RUN5 part D #1): the crediting guard exists and passes; the Star Ledger
// shows correct totals and per-game rounds against a scripted play history; the
// per-device sentence is present; the goodwill grant fires only if a broken path was
// found (none is, so it must not fire).
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [],
  stars: { total: 20, byGame: {} },
  ledger: {}, spellingMastery: {}, trickyPile: [],
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true }, trophies: {}, ageAsked: true, age: 8,
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over);

// ============ 1. static crediting guard (source scan, no browser) ============
console.log('== crediting guard: single credit path ==');
{
  function walk(dir) {
    let out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walk(p));
      else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
  }
  const jsFiles = walk(join(ROOT, 'js'));
  // The ONLY place that may increment stars.total is results.js. Any other module
  // gaining `stars.total +=` / `++` is a completion path that bypasses results.
  const creditRe = /stars\s*\.\s*total\s*(\+\+|\+=)/;
  const offenders = [];
  for (const f of jsFiles) {
    if (f.replace(/\\/g, '/').endsWith('js/results.js')) continue;
    const src = readFileSync(f, 'utf8');
    if (creditRe.test(src)) offenders.push(f.replace(ROOT, '').replace(/\\/g, '/'));
  }
  assert(offenders.length === 0, 'no module outside results.js increments stars.total' + (offenders.length ? ' (offenders: ' + offenders.join(', ') + ')' : ''));

  // results.js must contain exactly the one credit line.
  const rsrc = readFileSync(join(ROOT, 'js', 'results.js'), 'utf8');
  const credits = (rsrc.match(/stars\s*\.\s*total\s*(\+\+|\+=)/g) || []).length;
  assert(credits === 1, `results.js has exactly one credit statement (found ${credits})`);
  assert(/assertCredit\s*\(/.test(rsrc), 'results.js runs the dev credit assertion');

  // every game module (and golden) must route its finish through results.
  const gameFiles = walk(join(ROOT, 'js', 'games')).concat([join(ROOT, 'js', 'golden.js')]);
  const bypass = [];
  for (const f of gameFiles) {
    const src = readFileSync(f, 'utf8');
    if (!/go\(\s*['"]results['"]/.test(src)) bypass.push(f.replace(ROOT, '').replace(/\\/g, '/'));
  }
  assert(bypass.length === 0, 'every game module finishes via go("results")' + (bypass.length ? ' (missing: ' + bypass.join(', ') + ')' : ''));
}

const browser = await chromium.launch();
async function fresh(save) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
const getState = (page) => page.evaluate(() => window.BooTown.State.getState());

// ============ 2. runtime credit invariant: total += exactly its stars ============
console.log('== runtime credit invariant ==');
{
  const { ctx, page } = await fresh(SAVE({ stars: { total: 20, byGame: { bubblepop: { best: 2, plays: 5, earned: 12 } } } }));
  // Route a finished round straight through the single results path.
  await page.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 3, cat: 'x2', level: 1 }));
  await page.waitForSelector('.result-card');
  const credit = await page.evaluate(() => window.__lastCredit);
  assert(credit && credit.ok, 'window.__lastCredit.ok — round credited exactly its stars');
  assert(credit.before === 20 && credit.after === 23 && credit.delta === 3, `total 20 → 23 (delta 3), got ${credit && credit.after} / delta ${credit && credit.delta}`);
  const s = await getState(page);
  assert(s.stars.byGame.bubblepop.earned === 15, `bubblepop earned 12 → 15, got ${s.stars.byGame.bubblepop.earned}`);
  assert(s.stars.byGame.bubblepop.plays === 6, `bubblepop plays 5 → 6, got ${s.stars.byGame.bubblepop.plays}`);
  await ctx.close();
}

// ============ 3. Star Ledger reflects a scripted play history ============
console.log('== Star Ledger panel ==');
{
  const history = {
    bubblepop: { best: 3, plays: 8, earned: 19 },
    spellboo:  { best: 2, plays: 4, earned: 9 },
    dash:      { best: 3, plays: 6, earned: 15 },
    feedboos:  { best: 0, plays: 0, earned: 0 }
  };
  const total = 19 + 9 + 15;
  const { ctx, page } = await fresh(SAVE({ stars: { total, byGame: history } }));
  const totalBefore = (await getState(page)).stars.total;
  // long-press the cog to open the grown-ups corner, or route directly.
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.click('.gu-tab[data-tab="ledger"]');   // Star Ledger tab (RUN6 C0.2)
  await page.waitForSelector('.gu-ledger');
  // header total
  const shownTotal = await page.$eval('.gl-total-num', n => n.textContent.trim());
  assert(shownTotal === String(total), `ledger header shows total ${total}, got ${shownTotal}`);
  // per-game rows
  const rows = await page.$$eval('.gu-ledger .gl-row', trs => trs.map(tr => {
    const td = tr.querySelectorAll('td');
    return { name: td[0].textContent.trim(), plays: td[1].textContent.trim(), earned: td[2].textContent.trim() };
  }));
  const find = (name) => rows.find(r => r.name === name);
  assert(rows.length === 14, `ledger lists all 14 games (10 + 4 toddler, RUN5 C7), got ${rows.length}`);
  assert(find('Bubble Pop') && find('Bubble Pop').plays === '8' && find('Bubble Pop').earned === '19', 'Bubble Pop row: 8 rounds / 19 stars');
  assert(find('Spell Boo') && find('Spell Boo').plays === '4' && find('Spell Boo').earned === '9', 'Spell Boo row: 4 rounds / 9 stars');
  assert(find('Boo Dash') && find('Boo Dash').plays === '6' && find('Boo Dash').earned === '15', 'Boo Dash row: 6 rounds / 15 stars');
  assert(find('Feed the Boos') && find('Feed the Boos').plays === '0' && find('Feed the Boos').earned === '0', 'unplayed game shows 0 / 0');
  // per-device sentence
  const hasSentence = await page.evaluate(() => [...document.querySelectorAll('.gu-note')].some(n => /live on this device only/i.test(n.textContent)));
  assert(hasSentence, 'the per-device sentence is present beneath the ledger');
  // goodwill grant must NOT have fired — no broken path was found, so the total is untouched.
  const totalAfter = (await getState(page)).stars.total;
  assert(totalAfter === totalBefore, `no goodwill grant fired (total unchanged at ${totalBefore}), got ${totalAfter}`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
