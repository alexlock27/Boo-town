// tests/r4p12-reach.mjs — RUN4 hotfix 2, PERMANENT regression: on real phone
// viewports every screen's content and every primary control must be REACHABLE,
// not merely rendered. A screenshot proves layout; this proves reachability:
// for each screen we assert no horizontal overflow, then scroll the primary
// action into view and verify a tap would land on it (elementFromPoint), and
// for Build-a-Boo / Teach Me we fire REAL clicks and verify they took effect.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = {
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, deco_tree: 1, deco_stage: 1, acc_bow: 1 },
  boxes: 0, meter: 0, opened: 5, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {},
  town: [{ zone: 'meadow', x: 0.4, item: 'deco_tree' }, { zone: 'meadow', x: 0.6, item: 'boo_inky' }],
  stars: { total: 60, byGame: {} }, ledger: {},
  golden: { words: [{ w: 'because' }], choices: [] },
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, ageAsked: true, age: 8
};

// screen -> { ready: selector to wait for, target: the primary/last control that MUST be reachable }
const SCREENS = [
  ['studio',     '.studio-grid',  '.studio-card:last-of-type'],
  ['buildaboo',  '.build-rows',   '.build-actions .btn'],
  ['paint',      '.paint-canvas', '.paint-actions .btn:last-of-type, .paint-controls .btn:last-of-type'],
  ['collage',    '.collage-svg',  '.collage-actions .btn:last-of-type'],
  ['gallery',    '.studio-header', null],
  ['teachme',    '.lesson-grid',  '.lesson-card:last-of-type'],
  ['grownups',   '.grownups',     'button:last-of-type'],
  ['editguide',  '.creator',      '.creator-btns .btn:last-of-type'],
  ['collection', '.coll-grid',    '.coll-grid:not(.wardrobe-grid) .coll-tile:last-of-type'],
  ['town',       '.town2',        '.town-drawer'],
  ['golden',     '.screen, .golden, [data-screen="golden"]', 'button:last-of-type'],
  ['bubblepop',  '.picker',       '.picker-levels .level-btn:last-of-type'],
  ['feedboos',   '.picker',       '.picker-levels .level-btn:last-of-type'],
  ['spellboo',   '.picker',       '.picker-levels .level-btn:last-of-type'],
  ['dash',       '.picker',       '.star-rule'],
  ['boopop',     '.start-card',   '.star-rule'],
  ['clockshop',  '.start-card',   '.star-rule'],
  ['blocks',     '.start-card',   '.star-rule'],
  ['bounce',     '.start-card',   '.star-rule'],
  ['beat',       '.start-card',   '.star-rule']
];

const browser = await chromium.launch();
for (const [w, h] of [[360, 740], [412, 780], [740, 360], [780, 412]]) {
  console.log(`\n== ${w}x${h} ==`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');

  for (const [screen, ready, target] of SCREENS) {
    await page.evaluate((s) => window.BooTown.go(s), screen);
    const ok = await page.waitForSelector(ready, { timeout: 6000 }).then(() => true).catch(() => false);
    if (!ok) { assert(false, `${screen}: did not render (${ready})`); continue; }
    await sleep(350);
    // (a) no horizontal overflow anywhere
    const hOK = await page.evaluate(() => {
      const d = document.documentElement;
      const s = document.getElementById('screen').firstElementChild;
      return d.scrollWidth <= d.clientWidth + 1 && (!s || s.scrollWidth <= s.clientWidth + 1);
    });
    assert(hOK, `${screen}: no horizontal overflow`);
    // (b) the primary control is reachable: scrollIntoView + a tap would land on it
    if (target) {
      const reach = await page.evaluate((sel) => {
        const el = [...document.querySelectorAll(sel)].pop();
        if (!el) return { found: false };
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const inView = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.width > 0 && r.height > 0;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const lands = !!hit && (el === hit || el.contains(hit) || hit.contains(el));
        return { found: true, inView, lands, tag: el.textContent.trim().slice(0, 22) };
      }, target);
      assert(reach.found, `${screen}: primary control exists (${target})`);
      if (reach.found) assert(reach.inView && reach.lands, `${screen}: "${reach.tag}" scrolls into view and a tap lands on it`);
    }
  }

  // (c) Teach Me: EVERY lesson card fully on-screen horizontally, none clipped
  await page.evaluate(() => window.BooTown.go('teachme'));
  await page.waitForSelector('.lesson-grid');
  await sleep(250);
  const tm = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.lesson-card')];
    return { n: cards.length, clipped: cards.filter(c => { const r = c.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length };
  });
  assert(tm.n === 6 && tm.clipped === 0, `teachme: all ${tm.n} lesson cards fully visible (clipped: ${tm.clipped})`);
  // …and a REAL click on the last card starts its lesson
  await page.evaluate(() => document.querySelector('.lesson-card:last-of-type').scrollIntoView({ block: 'center' }));
  await page.click('.lesson-card:last-of-type');
  const lessonStarted = await page.waitForSelector('.tm-stage', { timeout: 5000 }).then(() => true).catch(() => false);
  assert(lessonStarted, 'teachme: the last lesson card genuinely opens its lesson');

  // (d) Build-a-Boo: name it, scroll to Seal, REAL click, custom really sealed
  await page.evaluate(() => window.BooTown.go('buildaboo'));
  await page.waitForSelector('.build-actions .btn');
  await page.fill('.build-name', 'Reachy').catch(() => {});
  await page.evaluate(() => document.querySelector('.build-actions .btn').scrollIntoView({ block: 'center' }));
  await sleep(200);
  await page.click('.build-actions .btn');
  await sleep(600);
  const sealed = await page.evaluate(() => (window.BooTown.State.getState().customs || []).length);
  assert(sealed >= 1, `buildaboo: the Seal button really fires on a phone (customs: ${sealed})`);

  await ctx.close();
}
await browser.close();
console.log(failed ? '\nr4p12-reach: FAIL' : '\nr4p12-reach: ALL PASS');
process.exit(failed ? 1 : 0);
