// tests/r19c-qa.mjs — the gates Alex's live round proved were missing (2026-07-30).
//
// 1. READABILITY IS MEASURED IN PIXELS. The explainer panels shipped cream-text-on-cream
//    (--card is #FFF8F0, not the purple literacy.css assumed) and every DOM-text assertion
//    passed while a child saw nothing. RUN18D's law — "trust the pixels" — now applies to
//    every explanation surface: each text node is screenshotted and must actually contain
//    dark (ink) pixels against its light card.
// 2. ROUNDS NEVER REPEAT while the pool allows: buildFactoryRound and buildTwinTroubleRound
//    are drawn many times and checked for duplicates (Alex: 3 of 8 repeated).
// 3. THE ORDER NEVER CONTAINS THE ANSWER: no Word Factory ticket line may include its own
//    build ("FULL OF FAME!" → famous), and B2/B4 use the quoted-root transform style.
// Expected runtime: ~45s. Not @serial.

import { chromium } from 'playwright';
import sharp from 'sharp';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const boos = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly'];
const save = (content) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(boos.map(b => [b, 1])),
  stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 },
  trophies: {}, boxes: 0, meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { blendit: true, wordfactory: true, soundtwins: true, apostrophepatrol: true } },
  settings: { sound: false, music: false, voice: false, content }
});
const browser = await chromium.launch({ args: RESOLVE });
async function open(content) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ! pageerror:', String(e).slice(0, 160)); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(content));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}

// The pixel truth of a text node: dark (ink) pixels must really exist on the light card.
// Invisible text = ~0% dark; readable ink text = well over 2%.
async function inkFraction(elementHandle, inset = 0) {
  const png = await elementHandle.screenshot();
  let img = sharp(png);
  if (inset) {
    const meta = await img.metadata();
    if (meta.width > inset * 2 + 4 && meta.height > inset * 2 + 4) {
      img = img.extract({ left: inset, top: inset, width: meta.width - inset * 2, height: meta.height - inset * 2 });
    }
  }
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let dark = 0, light = 0, total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < 110) dark++;
    else if (lum > 190) light++;
    total++;
  }
  return { dark: dark / total, light: light / total };
}
async function assertReadable(page, sel, label, { inset = 0, timeout = 8000 } = {}) {
  const h = await page.waitForSelector(sel, { timeout, state: 'visible' }).catch(() => null);
  if (!h) { assert(false, `${label}: "${sel}" never became visible`); return; }
  const { dark, light } = await inkFraction(h, inset);
  assert(dark >= 0.02, `${label}: ink pixels really present (${(dark * 100).toFixed(1)}% dark)`);
  assert(light >= 0.15, `${label}: on its light card (${(light * 100).toFixed(1)}% light)`);
}

// ================== 1. every explanation surface, in pixels ==================
console.log('== 1. the Word Factory rule card is readable (pixels, not the DOM) ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => window.BooTown.go('blendit', { resume: { level: 2 } }));
  await page.waitForFunction(() => window.__factory && window.__factory.shelf().length > 0, null, { timeout: 15000 });
  await page.evaluate(() => window.__factory.finishItem());
  await page.waitForSelector('.wf-next', { timeout: 8000 });
  await assertReadable(page, '.wf-rule-line', 'the rule line');
  await assertReadable(page, '.wf-rule-type', 'the rule-type label');
  // negative control — the gate must be able to say NO: force the exact bug that shipped
  // (cream text on the cream card) and prove the ink measurement collapses.
  await page.addStyleTag({ content: '.wf-rule-line { color: #FFF8F0 !important; }' });
  const h = await page.$('.wf-rule-line');
  const broken = await inkFraction(h);
  assert(broken.dark < 0.02, `the gate catches invisible text (forced cream-on-cream reads ${(broken.dark * 100).toFixed(1)}% dark)`);
  await ctx.close();
}
console.log('== 2. Twin Trouble\'s panel is readable ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => window.BooTown.go('soundtwins', { resume: { level: 1 } }));
  await page.waitForFunction(() => window.__twintrouble && window.__twintrouble.state().phase === 'verdict', null, { timeout: 15000 });
  await page.evaluate(() => { const c = window.__twintrouble.case(); c.guilty ? window.__twintrouble.verdictInnocent() : window.__twintrouble.verdictGuilty(); });
  await assertReadable(page, '.tt-explain-line', "Twin Trouble's explanation line");
  await ctx.close();
}
console.log('== 3. Flying Comma: the panel AND the "No comma needed" slot ==');
{
  const { ctx, page } = await open('medium');
  await page.evaluate(() => window.BooTown.go('apostrophepatrol', { resume: { cat: 'comma', level: 3 } }));
  await page.waitForFunction(() => window.__aphub && window.__aphub.comma && window.__aphub.comma.state().phase === 'flick', null, { timeout: 15000 });
  await assertReadable(page, '.ap-slot.ap-none', 'the No-comma-needed button', { inset: 8 });
  await page.evaluate(() => window.__aphub.comma.flickCorrect());
  await assertReadable(page, '.explain-panel .explain-line', "Flying Comma's explanation line");
  await ctx.close();
}
console.log('== 4. the disco guest chips name their Boos readably ==');
{
  const { ctx, page } = await open('full');
  await page.evaluate(() => window.BooTown.go('discohall', {}));
  await page.waitForFunction(() => window.__disco && window.__disco.roster().length > 0, null, { timeout: 15000 });
  await page.evaluate(() => window.__disco.openGuests());
  await page.waitForTimeout(400);
  await assertReadable(page, '.disco-roster-chip.in .drc-name', 'a guest chip name');
  await ctx.close();
}

// ================== 2. rounds never repeat while the pool allows ==================
console.log('== 5. no repeated items in a round (Factory + Twin Trouble, many draws) ==');
{
  const { ctx, page } = await open('medium');
  const r = await page.evaluate(async () => {
    const bl = await import('./js/games/blendit.js?v=qa');
    const tt = await import('./js/games/soundtwins.js?v=qa');
    const out = { factoryDupes: 0, twinDupes: 0, twinL1Runs: 0, draws: 0 };
    for (let i = 0; i < 30; i++) {
      for (const level of [1, 2, 3, 4]) {
        const round = bl.buildFactoryRound(level);
        const ids = round.map(x => x.id);
        if (new Set(ids).size !== ids.length) out.factoryDupes++;
        out.draws++;
      }
      for (const level of [2, 3]) {
        const { cases } = tt.buildTwinTroubleRound(level);
        const ss = cases.map(c => c.sentence);
        if (new Set(ss).size !== ss.length) out.twinDupes++;
        out.draws++;
      }
      const { cases } = tt.buildTwinTroubleRound(1);   // one-pair drill: repeats allowed, never adjacent
      for (let k = 1; k < cases.length; k++) if (cases[k].sentence === cases[k - 1].sentence) out.twinL1Runs++;
      out.draws++;
    }
    return out;
  });
  assert(r.factoryDupes === 0, `Word Factory: 0 of 120 rounds contain a repeat (${r.factoryDupes})`);
  assert(r.twinDupes === 0, `Twin Trouble L2/L3: 0 of 60 rounds contain a repeat (${r.twinDupes})`);
  assert(r.twinL1Runs === 0, `Twin Trouble L1 (one-pair drill): never the same sentence twice running (${r.twinL1Runs})`);
  await ctx.close();
}

// ================== 3. the ticket never contains its own answer ==================
console.log('== 6. no Word Factory order line gives its answer away ==');
{
  const { ctx, page } = await open('medium');
  const r = await page.evaluate(async () => {
    const d = await import('./data/wordfactory.js?v=qa');
    const leaks = d.ALL_FACTORY_ITEMS.filter(it => it.order.toLowerCase().includes(it.build.toLowerCase())).map(it => it.id);
    // B2/B4 use the quoted-root transform style Alex approved via B3
    const styled = [...d.B2, ...d.B4].filter(it => !new RegExp(`[‘']${it.parts[0].k}[’']`).test(it.order)).map(it => it.id);
    return { leaks, styled, total: d.ALL_FACTORY_ITEMS.length };
  });
  assert(r.leaks.length === 0, `no order contains its build, all ${r.total} items (${r.leaks.join(',') || 'clean'})`);
  assert(r.styled.length === 0, `every B2/B4 order quotes its root, transform-style (${r.styled.join(',') || 'all styled'})`);
  await ctx.close();
}

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
