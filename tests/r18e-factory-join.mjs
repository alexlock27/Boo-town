// tests/r18e-factory-join.mjs — RUN19: the Word Factory's join IS the teaching moment.
//
// Alex: "i can put gentle and ly together but its not actually correct is it". 23 of the 60
// items used to build a misspelling on the plate which stamp() silently swapped for the
// correct word; the rule only appeared on a wrong tap, so a child who was right first time
// was never taught the change. Now: every item ends in a JOIN — the parts meet at a seam,
// the leaving letters are struck (.wf-join-out), the corrected word lands (.wf-join-in),
// the authored rule card shows EVERY time, and a Next button (Alex's explicit ask) gates
// the stamp. The steam gauge pauses at the join so reading never costs gold.
//
// Also settles the audit mystery "Word Factory stopped at 6 of 8": a full round is driven
// to the results screen here. And the hub card's NAME is tier-aware (handover §2 option A).
// Expected runtime: ~60s. Not @serial.

import { chromium } from 'playwright';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (content) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 },
  trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { blendit: true, wordfactory: true } },
  settings: { sound: false, music: false, voice: false, content }
});
const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(content = 'medium') {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(content));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}
const waitFor = (page, fn, ms = 8000) => page.waitForFunction(fn, null, { timeout: ms });

// ================== 1. the hub card is named for the game it opens ==================
console.log('== 1. the hub card name follows the tier ==');
{
  const { ctx, page } = await open('medium');
  const names = await page.$$eval('.gc-name', ns => ns.map(n => n.textContent));
  assert(names.includes('Word Factory'), `Medium hub card says Word Factory (${names.filter(n => /word|blend/i.test(n)).join(', ') || 'neither found'})`);
  assert(!names.includes('Blend It'), 'and no card says Blend It at Medium');
  await ctx.close();
}
{
  const { ctx, page } = await open('full');
  const names = await page.$$eval('.gc-name', ns => ns.map(n => n.textContent));
  assert(names.includes('Blend It'), 'Full hub card still says Blend It');
  assert(!names.includes('Word Factory'), 'and no card says Word Factory at Full');
  await ctx.close();
}

// ================== 2. a change item: seam → strike → corrected word, rule, Next ==================
console.log('== 2. the join shows the spelling change and the rule, gated by Next ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => window.BooTown.go('blendit', { resume: { level: 2 } }));   // -ly endings: rich in changes
  await waitFor(page, () => window.__factory && window.__factory.shelf().length > 0, 15000);

  // walk items until one that CHANGES spelling at the join comes up (level 2 has 10 of 16)
  let sawChange = false, sawNoChange = false, guard = 0;
  while ((!sawChange || !sawNoChange) && guard++ < 10) {
    const item = await page.evaluate(() => window.__factory.item());
    const join = await page.evaluate(() => window.__factory.join());
    await page.evaluate(() => window.__factory.finishItem());
    if (join.changed && !sawChange) {
      sawChange = true;
      // the struck letters appear mid-join…
      await page.waitForSelector('.wf-join-out', { timeout: 6000 });
      const out = await page.$eval('.wf-join-out', n => n.textContent);
      assert(out === join.out, `the leaving letters are struck on the plate ("${out}" for ${join.raw} → ${join.build})`);
      // …and the corrected word lands, with the arriving letters (if any) marked
      await page.waitForSelector('.wf-next', { timeout: 6000 });
      const plate = await page.$eval('.wf-plate', n => n.textContent.replace(/\s+/g, ''));
      assert(plate === join.build, `the plate lands on the CORRECT word ("${plate}")`);
      if (join.added) {
        const added = await page.$eval('.wf-join-in', n => n.textContent).catch(() => null);
        assert(added === join.added, `the arriving letters are highlighted ("${added}")`);
      }
    } else if (!join.changed && !sawNoChange) {
      sawNoChange = true;
      await page.waitForSelector('.wf-next', { timeout: 6000 });
      const plate = await page.$eval('.wf-plate', n => n.textContent.replace(/\s+/g, ''));
      assert(plate === join.build, `a no-change item still lands whole ("${plate}")`);
    } else {
      await page.waitForSelector('.wf-next', { timeout: 6000 });
    }
    // the rule card is visible on EVERY item, right-first-time included
    const rule = await page.$eval('.wf-rule', n => ({ vis: getComputedStyle(n).visibility, line: n.querySelector('.wf-rule-line').textContent }));
    assert(rule.vis !== 'hidden' && rule.line === item.rule, `the authored rule shows at the join ("${rule.line.slice(0, 40)}…")`);
    const stateBefore = await page.evaluate(() => window.__factory.state());
    await page.evaluate(() => window.__factory.tapNext());
    await page.waitForFunction((i) => {
      const scr = document.getElementById('screen').dataset.screen;
      if (scr === 'results') return true;
      const s = window.__factory.state();
      return s.idx === i + 1 && s.phase === 'build';
    }, stateBefore.idx, { timeout: 8000 });
    if (await page.evaluate(() => document.getElementById('screen').dataset.screen === 'results')) break;
  }
  assert(sawChange, 'a spelling-change item was exercised');
  assert(sawNoChange, 'a no-change item was exercised');

  // ============ 3. the whole round completes — the "stuck at 6 of 8" check ============
  console.log('== 3. a full round reaches the results screen ==');
  let rounds = 0;
  while (rounds++ < 12 && await page.evaluate(() => document.getElementById('screen').dataset.screen !== 'results')) {
    await page.evaluate(() => window.__factory.finishItem());
    await page.waitForSelector('.wf-next', { timeout: 6000 });
    await page.evaluate(() => window.__factory.tapNext());
    await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'results'
      || (window.__factory.state().phase === 'build'), null, { timeout: 8000 });
  }
  assert(await page.evaluate(() => document.getElementById('screen').dataset.screen === 'results'),
    'the round ends on the results screen (no stall at item 6 of 8)');
  await ctx.close();
}

// ================== 4. a wrong tap still explains immediately; gauge pauses at the join ==================
console.log('== 4. wrong-tap rule + the gauge pauses while she reads ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => { window.__wfTicketMs = 900; window.BooTown.go('blendit', { resume: { level: 3 } }); });
  await waitFor(page, () => window.__factory && window.__factory.shelf().length > 0, 15000);
  await page.evaluate(() => window.__factory.tapWrong());
  const rule = await page.$eval('.wf-rule', n => getComputedStyle(n).visibility);
  assert(rule !== 'hidden', 'a wrong part reveals the rule immediately (unchanged behaviour)');
  await page.evaluate(() => window.__factory.finishItem());
  await page.waitForSelector('.wf-next', { timeout: 6000 });
  const depthAtJoin = await page.evaluate(() => window.__factory.queueDepth());
  await page.waitForTimeout(2500);   // nearly 3 ticket periods
  const depthAfterRead = await page.evaluate(() => window.__factory.queueDepth());
  assert(depthAfterRead === depthAtJoin, `the ticket gauge holds still at the join (${depthAtJoin} → ${depthAfterRead})`);
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
