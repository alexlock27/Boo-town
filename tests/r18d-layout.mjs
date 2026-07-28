// tests/r18d-layout.mjs — RUN18D D1: the layout shell (the "ocean of purple" fix).
//
// From 900px up a menu/text screen's content lives in a 720px column, centred. Stages are
// full-bleed by construction — the shell is opt-in, so a screen that never asks for
// .screen-content cannot be narrowed by it, and §3 proves the exceptions carry none.
// Also here: Teach Me's stage is vertically centred rather than stacked at the top of the
// sky, and Boo Blocks' tray hugs the board it feeds.
// Expected runtime: ~35s. Not @serial (no frame sampling).

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('screenshots/run18d/d1', { recursive: true });

export const SHELL_MAX = 720;      // the pack's number
export const SHELL_FROM = 900;     // …applied from this viewport width up

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const SAVE = {
  version: 18, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, deco_tree: 1, acc_bow: 1 }, trophies: {}, boxes: 0, meter: 3,
  spellingMastery: {}, ledger: {}, trickyPile: [],
  stars: { total: 900, byGame: {}, byType: { maths: 200, word: 200, puzzle: 200, creative: 200, lesson: 200 }, spent: {}, legacy: 0 },
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, shop: { welcomed: true },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 900, welcomeTour: true,
    introSeen: { bubblepop: 1, teachme: 1, blocks: 1, booroll: 1, beat: 1, dash: 1, boopop: 1 }, zonesUnlocked: AK },
  settings: { sound: false, music: false, voice: false, content: 'full' }
};

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.waitForSelector('.hub', { timeout: 20000 });
  return { ctx, page };
}
const goTo = async (page, route, sel, params) => {
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params || null]);
  if (sel) await page.waitForSelector(sel, { timeout: 15000 });
  await sleep(320);
};
// Every .screen-content box on the current screen, measured.
const shellBoxes = (page) => page.evaluate(() => [...document.querySelectorAll('.screen-content')]
  .filter(n => n.offsetParent !== null || n.getClientRects().length)
  .map(n => { const r = n.getBoundingClientRect(); return { cls: n.className, x: r.x, w: r.width, right: r.right }; }));

// ================== 1. the shell holds, on every named menu/text screen ==================
console.log('== 1. menu and text screens sit in a centred 720px column at >=900px ==');
{
  const { ctx, page } = await open(1024, 768);
  const SCREENS = [
    ['hub', 'hub', '.game-cards-groups'],
    ['collection', 'collection', '.coll-scroll'],
    ['shop', 'shop', '.shop-shelf'],
    ['grownups', 'grownups', '.grownups'],
    ['studio', 'studio', '.studio-grid'],
    ['results', 'results', '.result-card']
  ];
  for (const [name, route, sel] of SCREENS) {
    await goTo(page, route, sel, route === 'results' ? { game: 'bubblepop', gameName: 'Bubble Pop', stars: 3 } : null);
    const boxes = await shellBoxes(page);
    if (['hub', 'collection', 'shop'].includes(route)) {
      assert(boxes.length > 0, `${name}: has shell sections`);
      for (const b of boxes) {
        assert(b.w <= SHELL_MAX + 1, `${name}: ${b.cls.split(' ')[0]} is ${Math.round(b.w)}px wide (<= ${SHELL_MAX})`);
        assert(Math.abs((b.x + b.right) / 2 - 1024 / 2) <= 2, `${name}: ${b.cls.split(' ')[0]} is centred`);
      }
    }
    // …and whatever the screen's own content box is, it is inside the shell band.
    const band = await page.evaluate(([s, max]) => {
      const n = document.querySelector(s); if (!n) return null;
      const r = n.getBoundingClientRect();
      const half = max / 2, mid = window.innerWidth / 2;
      return { ok: r.left >= mid - half - 1 && r.right <= mid + half + 1, w: r.width };
    }, [sel, SHELL_MAX]);
    assert(band && band.ok, `${name}: ${sel} (${band ? Math.round(band.w) : '?'}px) lies inside the 720px shell`);
  }
  // Journal, the same shell, on its own tab.
  await goTo(page, 'collection', '.coll-tabs');
  await page.click('.coll-tab:has-text("Journal")');
  await sleep(260);
  const j = await page.evaluate(() => { const n = document.querySelector('.journal-view'); const r = n.getBoundingClientRect(); return { w: r.width, mid: (r.x + r.right) / 2, shown: n.style.display !== 'none' }; });
  assert(j.shown && j.w <= SHELL_MAX + 1 && Math.abs(j.mid - 512) <= 2, `Journal: ${Math.round(j.w)}px, centred`);
  await ctx.close();
}

// ================== 2. below 900px the shell is inert ==================
console.log('== 2. below 900px nothing is narrowed — a phone uses all of its glass ==');
{
  const { ctx, page } = await open(390, 844);
  const w = await page.evaluate(() => {
    const n = document.querySelector('.game-cards-groups');
    const p = n.parentElement, cs = getComputedStyle(p);
    const inner = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { box: n.getBoundingClientRect().width, inner };
  });
  assert(w.box >= w.inner - 1, `hub grid uses the full column at 390 (${Math.round(w.box)}/${Math.round(w.inner)})`);
  await ctx.close();
}

// ================== 3. the named full-bleed exceptions are untouched ==================
console.log('== 3. stages stay full-bleed: they carry no shell at all ==');
{
  const { ctx, page } = await open(1024, 768);
  const STAGES = [
    ['Bubble Pop', 'bubblepop', '.screen.bubblepop'],
    ['Boo Dash', 'dash', '.screen.dash'],
    ['Boo Roll', 'booroll', '.screen.booroll'],
    ['Boo Beat', 'beat', '.screen.beat'],
    ['town areas', 'town', '.town2'],
    ['the Disco Hall', 'discohall', '.disco-room'],
    ['the Gallery', 'gallerymuseum', '.gm-stage'],
    ['the trail map', 'expedition', '.screen.expedition']
  ];
  for (const [label, route, sel] of STAGES) {
    await goTo(page, route, sel);
    const n = await page.evaluate(() => document.querySelectorAll('#screen .screen-content').length);
    assert(n === 0, `${label}: no shell wrapper on the stage`);
  }
  await ctx.close();
}

// ================== 4. Teach Me is centred in the space it has ==================
console.log('== 4. Teach Me: the content column is centred, not stacked at the top ==');
{
  const { ctx, page } = await open(1024, 768);
  await goTo(page, 'teachme', '.lesson-card');
  await page.screenshot({ path: 'screenshots/run18d/d1/teachme-list-1024.png' });
  await page.click('.lesson-card');
  await page.waitForSelector('.tm-stage', { timeout: 15000 });
  await sleep(900);
  const m = await page.evaluate(() => {
    const stage = document.querySelector('.tm-stage');
    const area = document.querySelector('.game-area');
    const sr = stage.getBoundingClientRect(), ar = area.getBoundingClientRect();
    const kids = [...stage.children].filter(k => k.getClientRects().length).map(k => k.getBoundingClientRect());
    if (!kids.length) return null;
    const top = Math.min(...kids.map(k => k.top)), bottom = Math.max(...kids.map(k => k.bottom));
    return { fills: sr.height >= ar.height - 2, contentMid: (top + bottom) / 2, stageMid: (sr.top + sr.bottom) / 2,
             topOffset: top - sr.top, gap: getComputedStyle(stage).rowGap, h: bottom - top, stageH: sr.height };
  });
  assert(m && m.fills, 'the stage fills the game area (it is a flex child now)');
  assert(m && Math.abs(m.contentMid - m.stageMid) <= 40, `the content column is vertically centred (off by ${m ? Math.round(Math.abs(m.contentMid - m.stageMid)) : '?'}px)`);
  assert(m && (m.h >= m.stageH - 8 || m.topOffset >= 0.08 * 768 - 1), `content clears the 8vh top offset (${m ? Math.round(m.topOffset) : '?'}px)`);
  assert(m && m.gap === '24px', `stage gap is 24px (${m ? m.gap : '?'})`);
  await page.screenshot({ path: 'screenshots/run18d/d1/teachme-stage-1024.png' });
  await ctx.close();
}

// ================== 5. Boo Blocks: the tray hugs the board ==================
console.log('== 5. Boo Blocks: board and tray adjacent ==');
{
  for (const [w, h] of [[1024, 768], [1456, 831], [390, 844]]) {
    const { ctx, page } = await open(w, h);
    await goTo(page, 'blocks', '.start-card');
    await page.click('.start-card .btn.big');
    await page.waitForSelector('.blk-board', { timeout: 15000 });
    await page.waitForSelector('.blk-slot', { timeout: 15000 });
    await sleep(300);
    const g = await page.evaluate(() => {
      const b = document.querySelector('.blk-board').getBoundingClientRect();
      const t = document.querySelector('.blk-tray').getBoundingClientRect();
      return { bx: b.right, by: b.bottom, btop: b.top, tx: t.left, ttop: t.top, tbottom: t.bottom };
    });
    if (w >= 900) {
      assert(g.tx - g.bx <= 24, `${w}: tray is ${Math.round(g.tx - g.bx)}px right of the board (<= 24)`);
      assert(g.ttop < g.by && g.tbottom > g.btop, `${w}: tray sits beside the board, not under it`);
    } else {
      assert(g.ttop >= g.by - 1, `${w}: tray is below the board (${Math.round(g.ttop - g.by)}px)`);
    }
    await page.screenshot({ path: `screenshots/run18d/d1/blocks-${w}.png` });
    await ctx.close();
  }
}

// ================== 6. the evidence shots the pack asks for ==================
console.log('== 6. screenshots at 1024x768 and 1456x831 ==');
{
  for (const [w, h] of [[1024, 768], [1456, 831]]) {
    const { ctx, page } = await open(w, h);
    for (const [name, route, sel, params] of [
      ['hub', 'hub', '.game-cards-groups', null],
      ['results', 'results', '.result-card', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 3 }],
      ['collection', 'collection', '.coll-scroll', null]
    ]) {
      await goTo(page, route, sel, params);
      await sleep(500);
      await page.screenshot({ path: `screenshots/run18d/d1/${name}-${w}.png` });
    }
    // the shell holds at the wider width too
    await goTo(page, 'hub', '.game-cards-groups');
    const boxes = await shellBoxes(page);
    for (const b of boxes) assert(b.w <= SHELL_MAX + 1 && Math.abs((b.x + b.right) / 2 - w / 2) <= 2, `${w}: ${b.cls.split(' ')[0]} centred at <= 720`);
    await ctx.close();
  }
}

await browser.close();
assert(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
