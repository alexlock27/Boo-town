// tests/r6p6-bounce.mjs — RUN6 phase 6: Boo Bounce aim-and-launch (C4).
// Acceptance (RUN6 part D #7): aim-drag preview frames incl. a one-bounce path; a
// scripted aimed serve strikes a chosen labelled brick; a deliberately buried label
// re-places; flight physics unchanged (constant friendly speed by inspection).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r6p6', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = {
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [], stars: { total: 60, byGame: {} }, ledger: {}, delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'light' },   // light → auto-starts a round
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true },
  trophies: {}, ageAsked: true, age: 8
};

const browser = await chromium.launch();
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 680 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('bounce'));
  await page.waitForSelector('.bounce-canvas');
  await page.waitForFunction(() => window.__bounce && window.__bounce.state().stuck && window.__bounce.labelInfo().length > 0, { timeout: 5000 });
  await page.evaluate(() => window.__bounce.autoPaddle(false));
  return { ctx, page };
}

// ==================== aim-drag preview incl. a one-bounce path ====================
console.log('== aim drag + dotted preview (with a one-bounce path) ==');
{
  const { ctx, page } = await open();
  // sweep the aim across several angles; each yields a different preview path
  const paths = [];
  for (const deg of [-95, -120, -150, -60, -35]) {
    const p = await page.evaluate((d) => { window.__bounce.aimDeg(d); return window.__bounce.preview(); }, deg);
    paths.push(JSON.stringify(p.pts.map(pt => [Math.round(pt.x), Math.round(pt.y)])));
    await sleep(80);
  }
  assert(new Set(paths).size >= 4, `the dotted preview updates as she aims (${new Set(paths).size}/5 distinct paths)`);
  // a shallow aim toward a side wall produces a one-bounce path
  const shallow = await page.evaluate(() => { window.__bounce.aimDeg(-158); return window.__bounce.preview(); });
  assert(shallow.bounced === true && shallow.pts.length > 2, 'a shallow aim previews a one-bounce path off a wall');
  // real drag frames: pointer down + moves, preview follows
  const box = await page.$eval('.bounce-canvas', n => { const b = n.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await page.mouse.move(box.x + box.w / 2, box.y + box.h - 40);
  await page.mouse.down();
  const dragPaths = [];
  for (const fx of [0.25, 0.4, 0.6, 0.8]) {
    await page.mouse.move(box.x + box.w * fx, box.y + box.h * 0.3, { steps: 3 });
    dragPaths.push(await page.evaluate(() => JSON.stringify(window.__bounce.preview().pts.map(p => Math.round(p.x)))));
    await sleep(60);
  }
  assert(await page.evaluate(() => window.__bounce.state().aiming), 'dragging enters the aim state');
  assert(new Set(dragPaths).size >= 3, `a real aim-drag moves the preview across frames (${new Set(dragPaths).size}/4 distinct)`);
  await page.screenshot({ path: 'screenshots/r6p6/bounce-aim-900x680.png' });
  await page.mouse.up();
  await ctx.close();
}

// ==================== a scripted aimed serve strikes a chosen labelled brick ====================
console.log('== aimed serve strikes a chosen labelled brick ==');
{
  const { ctx, page } = await open();
  const target = await page.evaluate(() => {
    const info = window.__bounce.labelInfo().find(l => l.clearColumn) || window.__bounce.labelInfo()[0];
    return info ? { c: info.c, r: info.r, label: info.label } : null;
  });
  assert(!!target, 'a labelled brick with a clear column is available to aim at');
  const res = await page.evaluate((t) => window.__bounce.serveAtLabel(t.label), target);
  assert(res && res.lowest, 'the serve aims straight up the chosen brick’s clear column');
  let hit = false;
  for (let k = 0; k < 30 && !hit; k++) { if (!(await page.evaluate(t => window.__bounce.brickAliveAt(t.c, t.r), target))) hit = true; await sleep(80); }
  assert(hit, 'the aimed serve strikes the chosen labelled brick');
  await ctx.close();
}

// ==================== a deliberately buried label re-places ====================
console.log('== a buried label re-places ==');
{
  const { ctx, page } = await open();
  const buried = await page.evaluate(() => window.__bounce.buryLabel());
  assert(buried && buried.reachable === false, 'a label was buried onto an unreachable brick');
  const before = await page.evaluate(() => window.__bounce.labelInfo().filter(l => !l.reachable).length);
  assert(before >= 1, 'at least one label is unreachable before reflow');
  await page.evaluate(() => window.__bounce.reflow());
  const after = await page.evaluate(() => window.__bounce.labelInfo().filter(l => !l.reachable).length);
  assert(after === 0, 'after reflow every label is reachable again (the buried one re-placed)');
  await ctx.close();
}

// ==================== flight physics unchanged (constant friendly speed) ====================
console.log('== flight physics unchanged ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => { window.__bounce.aimDeg(-90); window.__bounce.fire(); });
  await sleep(120);
  const speeds = [];
  for (let k = 0; k < 6; k++) { speeds.push(await page.evaluate(() => window.__bounce.ballSpeed())); await sleep(90); }
  const min = Math.min(...speeds), max = Math.max(...speeds);
  assert(min > 0 && (max - min) / max < 0.05, `the ball holds a constant friendly speed in flight (${min.toFixed(1)}–${max.toFixed(1)})`);
  assert(await page.evaluate(() => !window.__bounce.state().stuck), 'the ball is in flight after firing');
  await ctx.close();
}

// ==================== screenshots: aim preview at portrait + phone ====================
for (const [w, h, tag] of [[768, 1024, 'portrait'], [390, 844, 'phone']]) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.hub');
  await p.evaluate(() => window.BooTown.go('bounce'));
  await p.waitForSelector('.bounce-canvas');
  await p.waitForFunction(() => window.__bounce && window.__bounce.labelInfo().length > 0);
  const box = await p.$eval('.bounce-canvas', n => { const b = n.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await p.mouse.move(box.x + box.w / 2, box.y + box.h - 40);
  await p.mouse.down();
  await p.mouse.move(box.x + box.w * 0.72, box.y + box.h * 0.32, { steps: 4 });
  await sleep(200);
  await p.screenshot({ path: `screenshots/r6p6/bounce-aim-${tag}-${w}x${h}.png` });
  await p.mouse.up();
  await c.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
