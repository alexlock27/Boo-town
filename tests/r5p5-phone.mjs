// tests/r5p5-phone.mjs — RUN5 phase 5 (C4): the 390x844 phone reachability sweep.
// Acceptance (RUN5 part D #6): at 390x844 portrait AND landscape, every screen:
//   (a) renders with no horizontal overflow;
//   (b) its scroll container actually scrolls when content overflows (no full-height
//       flex traps);
//   (c) the TOP of the content is reachable (nothing interactive hidden behind fixed
//       headers) and the BOTTOM is reachable (last control fully in view, comfortable
//       clearance above the bar, a tap lands on it);
//   (d) navigation resets scroll to top.
// Prints a screen-by-screen table for PROGRESS.md. The tablet byte-gate
// (r4p10-tablet) must HOLD separately.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const INTRO_ALL = { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 };
const SAVE = {
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, deco_tree: 1, deco_stage: 1, acc_bow: 1 },
  boxes: 1, meter: 0, opened: 5, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {},
  town: [{ zone: 'meadow', x: 0.25, row: 0, item: 'deco_tree' }, { zone: 'meadow', x: 0.5, row: 1, item: 'deco_stage' }, { zone: 'meadow', x: 0.7, row: 2, item: 'boo_inky' }, { zone: 'meadow', x: 0.8, row: 1, item: 'boo_plum' }],
  stars: { total: 60, byGame: {} }, ledger: {},
  golden: { words: [{ w: 'because' }], choices: [] },
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'], introSeen: INTRO_ALL,
          lastPlay: { game: 'bubblepop', gameName: 'Times tables', cat: 'tables', level: 1, mix: false } },
  ageAsked: true, age: 8
};

// [name, go(), ready selector, last-control selector (bottom reach), skipBottom?]
const SCREENS = [
  ['hub',        (p) => p.evaluate(() => window.BooTown.go('hub')),        '.hub',          '.bottom-bar .bar-btn:last-of-type'],
  ['studio',     (p) => p.evaluate(() => window.BooTown.go('studio')),     '.studio-grid',  '.studio-card:last-of-type'],
  ['buildaboo',  (p) => p.evaluate(() => window.BooTown.go('buildaboo')),  '.build-rows',   '.build-actions .btn'],
  ['paint',      (p) => p.evaluate(() => window.BooTown.go('paint')),      '.paint-canvas', '.paint-actions .btn:last-of-type, .paint-controls .btn:last-of-type'],
  ['collage',    (p) => p.evaluate(() => window.BooTown.go('collage')),    '.collage-svg',  '.collage-actions .btn:last-of-type'],
  ['gallery',    (p) => p.evaluate(() => window.BooTown.go('gallery')),    '.studio-header', null],
  ['teachme',    (p) => p.evaluate(() => window.BooTown.go('teachme')),    '.lesson-grid',  '.lesson-card:last-of-type'],
  ['grownups',   (p) => p.evaluate(() => window.BooTown.go('grownups')),   '.grownups',     '.gu-danger .btn.danger'],
  ['editguide',  (p) => p.evaluate(() => window.BooTown.go('editguide')),  '.creator',      '.creator-btns .btn:last-of-type'],
  ['collection', (p) => p.evaluate(() => window.BooTown.go('collection')), '.coll-grid',    '.coll-grid:not(.wardrobe-grid) .coll-tile:last-of-type'],
  ['town',       (p) => p.evaluate(() => window.BooTown.go('town')),       '.town2',        '.town-drawer .drawer-item, .town-drawer'],
  ['golden',     (p) => p.evaluate(() => window.BooTown.go('golden')),     '.screen, .golden', 'button:last-of-type'],
  ['bubblepop',  (p) => p.evaluate(() => window.BooTown.go('bubblepop')),  '.picker',       '.star-rule'],
  ['feedboos',   (p) => p.evaluate(() => window.BooTown.go('feedboos')),   '.picker',       '.star-rule'],
  ['spellboo',   (p) => p.evaluate(() => window.BooTown.go('spellboo')),   '.picker',       '.star-rule'],
  ['dash',       (p) => p.evaluate(() => window.BooTown.go('dash')),       '.picker',       '.star-rule'],
  ['boopop',     (p) => p.evaluate(() => window.BooTown.go('boopop')),     '.start-card',   '.star-rule'],
  ['clockshop',  (p) => p.evaluate(() => window.BooTown.go('clockshop')),  '.start-card',   '.star-rule'],
  ['blocks',     (p) => p.evaluate(() => window.BooTown.go('blocks')),     '.start-card',   '.star-rule'],
  ['bounce',     (p) => p.evaluate(() => window.BooTown.go('bounce')),     '.start-card',   '.star-rule'],
  ['beat',       (p) => p.evaluate(() => window.BooTown.go('beat')),       '.start-card',   '.star-rule'],
  ['results',    (p) => p.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, cat: 'tables', level: 1 })), '.result-card', '.result-btns .btn.soft'],
  // mid-round shells (resume params skip the pickers)
  ['round:bubblepop', (p) => p.evaluate(() => window.BooTown.go('bubblepop', { resume: { cat: 'tables', level: 1, mix: false } })), '.bubble-field', '.game-topbar .hint-btn'],
  ['round:blocks',    (p) => p.evaluate(() => window.BooTown.go('blocks',    { resume: { cat: 'tables', level: 1, mix: false } })), '.blk-board',    '.blk-tray'],
  ['round:boopop',    (p) => p.evaluate(() => window.BooTown.go('boopop',    { resume: { cat: 'make10' } })),                        '.bp-board',     '.bp-board .bp-gem:last-of-type']
];

const browser = await chromium.launch();
const table = {};   // screen -> { '390x844': 'PASS'|'FAIL', '844x390': ... }

for (const [w, h] of [[390, 844], [844, 390]]) {
  const key = `${w}x${h}`;
  console.log(`\n== ${key} ==`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');

  for (const [name, go, ready, lastSel] of SCREENS) {
    let screenOK = true;
    const flag = (c, m) => { if (!c) screenOK = false; assert(c, `${name}: ${m}`); };
    await go(page);
    const rendered = await page.waitForSelector(ready, { timeout: 6000 }).then(() => true).catch(() => false);
    if (!rendered) { flag(false, `did not render (${ready})`); table[name] = { ...(table[name] || {}), [key]: 'FAIL' }; continue; }
    await sleep(360);
    // some screens reveal their buttons after an entrance animation (results: stars first)
    if (lastSel) await page.waitForSelector(lastSel.split(',')[0].trim(), { timeout: 4000 }).catch(() => {});

    const audit = await page.evaluate((sel) => {
      const doc = document.documentElement;
      const cont = document.getElementById('screen').firstElementChild;   // the scroll container
      const out = { hOverflow: doc.scrollWidth > doc.clientWidth + 1 || (cont && cont.scrollWidth > cont.clientWidth + 1) };
      if (!cont) return { ...out, noCont: true };
      // scroll-trap check: if content overflows, scrolling must actually work
      out.overflows = cont.scrollHeight > cont.clientHeight + 4;
      if (out.overflows) {
        cont.scrollTop = 99999;
        out.scrolls = cont.scrollTop > 0;
        out.maxScroll = cont.scrollTop;
      } else out.scrolls = true;
      // TOP reachable: back to the top, the first interactive/heading is visible and hittable
      cont.scrollTop = 0;
      const first = [...cont.querySelectorAll('h1,h2,h3,button,.btn,[role="button"]')].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (first) {
        const r = first.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.max(2, Math.min(innerWidth - 2, r.left + r.width / 2)), Math.max(2, Math.min(innerHeight - 2, r.top + r.height / 2)));
        out.topOK = r.top >= -1 && !!hit && (first === hit || first.contains(hit) || (hit && hit.contains(first)));
        out.topTag = (first.textContent || first.className || '').trim().slice(0, 20);
      } else out.topOK = true;
      // BOTTOM reachable: last control scrolls fully into view with clearance, tap lands
      if (sel) {
        let last = null;
        for (const s of sel.split(',')) { const els = [...cont.querySelectorAll(s.trim())]; if (els.length) { last = els.pop(); break; } }
        if (!last) return { ...out, lastMissing: true };
        last.scrollIntoView({ block: 'end' });
        cont.scrollTop += 40;   // push past — padding must still keep it clear
        last.scrollIntoView({ block: 'nearest' });
        const r = last.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.max(2, Math.min(innerWidth - 2, r.left + r.width / 2)), Math.max(2, Math.min(innerHeight - 2, r.top + r.height / 2)));
        out.botIn = r.top >= -1 && r.bottom <= innerHeight + 1 && r.width > 0;
        out.botLands = !!hit && (last === hit || last.contains(hit) || (hit && hit.contains(last)));
        out.botTag = (last.textContent || last.className || '').toString().trim().slice(0, 20);
        out.botBottom = Math.round(r.bottom); out.vh = innerHeight;
      }
      return out;
    }, lastSel);

    flag(!audit.hOverflow, 'no horizontal overflow');
    flag(audit.scrolls, `scroll container scrolls when content overflows (no flex trap)${audit.overflows ? ` (max ${audit.maxScroll}px)` : ' (fits)'}`);
    flag(audit.topOK, `top of content reachable ("${audit.topTag || ''}")`);
    if (lastSel) {
      flag(!audit.lastMissing, `last control exists (${lastSel})`);
      if (!audit.lastMissing) flag(audit.botIn && audit.botLands, `bottom control "${audit.botTag}" fully in view (${audit.botBottom}/${audit.vh}) and a tap lands`);
    }
    table[name] = { ...(table[name] || {}), [key]: screenOK ? 'PASS' : 'FAIL' };
  }

  // navigation resets scroll to top
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.grownups');
  await page.evaluate(() => { const c = document.getElementById('screen').firstElementChild; c.scrollTop = 99999; });
  const scrolled = await page.evaluate(() => document.getElementById('screen').firstElementChild.scrollTop);
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.grownups');
  const reset = await page.evaluate(() => document.getElementById('screen').firstElementChild.scrollTop);
  assert(scrolled > 0 && reset === 0, `navigation resets scroll to top (was ${scrolled}, now ${reset})`);

  await ctx.close();
}

// ---- the screen-by-screen table (paste into PROGRESS.md) ----
console.log('\n== screen-by-screen table ==');
console.log('| screen | 390x844 | 844x390 |');
console.log('|---|---|---|');
for (const [name] of SCREENS) {
  const r = table[name] || {};
  console.log(`| ${name} | ${r['390x844'] || '—'} | ${r['844x390'] || '—'} |`);
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
