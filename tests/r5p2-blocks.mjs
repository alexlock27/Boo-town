// tests/r5p2-blocks.mjs — the Boo Blocks intro + placement feel (kept through the RUN9 C2
// redesign). Frame evidence of the lifted drag with the piece above the fingertip; drop lands
// the cell under the piece centre; invalid drops glide back; near-complete lines shimmer; the
// intro's demo line completes itself; a first-ever open shows the intro and "?" replays it.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 30, byGame: {} },
  ledger: {}, spellingMastery: {}, trickyPile: [],
  seen: { trophyRetro: true }, trophies: {}, ageAsked: true, age: 8,
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over);

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
// enter a round from the start card
async function enterPlay(page) {
  await page.waitForSelector('.start-card .btn.big', { timeout: 4000 });
  await page.click('.start-card .btn.big');
  await page.waitForSelector('.blk-board');
  await page.waitForFunction(() => window.__blocks, { timeout: 4000 });
}
const cellRect = (page, r, c) => page.$eval(`.blk-cell[data-r="${r}"][data-c="${c}"]`, n => { const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; });

// ==================== intro: first-ever open + demo line + "?" replay ====================
console.log('== intro (first-play + demo + replay) ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('blocks'));
  await page.waitForSelector('.intro-overlay.show', { timeout: 4000 });
  const step1 = await page.$eval('.intro-bubble', n => n.textContent);
  assert(/Drop blocks to fill/.test(step1), 'first-ever open shows the guided intro (step 1: score chase)');
  // step 1 carries the self-completing demo line
  await page.waitForSelector('.blk-demo-row');
  assert(/it POPS/.test(step1), 'step 1 explains completing a line pops it');
  let sawOn = false, sawPop = false;
  for (let i = 0; i < 20; i++) {
    const st = await page.evaluate(() => ({ on: document.querySelectorAll('.blk-demo-cell.on').length, pop: document.querySelectorAll('.blk-demo-cell.pop').length }));
    if (st.on > 0) sawOn = true;
    if (st.pop >= 5) sawPop = true;
    if (sawOn && sawPop) break;
    await sleep(200);
  }
  assert(sawOn, 'demo line fills itself (cells light up)');
  assert(sawPop, 'demo line completes and pops itself');
  await page.click('.intro-next'); // step 2
  const step2 = await page.$eval('.intro-bubble', n => n.textContent);
  assert(/streak|WHOLE board|firework/i.test(step2), 'step 2 teaches the cascade streak + all-clear firework');
  await page.click('.intro-next'); // step 3
  const step3 = await page.$eval('.intro-bubble', n => n.textContent);
  assert(/Boo Boost/.test(step3), 'step 3 teaches the Boo Boost power-up economy');
  await page.click('.intro-next'); // Let's go
  await page.waitForSelector('.intro-overlay', { state: 'detached', timeout: 3000 });
  const seen = await page.evaluate(() => window.BooTown.State.getState().seen.introSeen);
  assert(seen && seen.blocks === true, 'intro seen-flag persists for blocks');
  // enter play, then "?" replays the intro
  await enterPlay(page);
  await page.click('.help-btn');
  await page.waitForSelector('.intro-overlay.show', { timeout: 3000 });
  assert(true, 'the "?" button replays the intro');
  await ctx.close();
}
// intro only on first open
{
  const { ctx, page } = await fresh(SAVE({ seen: { trophyRetro: true, introSeen: { blocks: true } } }));
  await page.evaluate(() => window.BooTown.go('blocks'));
  await page.waitForSelector('.start-card');
  await sleep(400);
  assert(!(await page.$('.intro-overlay')), 'a seen intro never shows again on later opens');
  await ctx.close();
}

// ==================== lifted drag + centre targeting + tolerance + glide-back ====================
console.log('== placement feel ==');
{
  const { ctx, page } = await fresh(SAVE({ seen: { trophyRetro: true, introSeen: { blocks: true } } }));
  await page.evaluate(() => window.BooTown.go('blocks'));
  await enterPlay(page);
  // pieces are free now — rig a known single-cell piece in slot 0 directly
  await page.evaluate(() => window.__blocks.rig(0, [[0, 0]]));
  const lift = await page.evaluate(() => window.__blocks.LIFT);
  assert(lift === 70, 'the piece lifts 70px above the fingertip');

  const target = await cellRect(page, 6, 4);
  const anchor = await page.evaluate(({ x, y }) => window.__blocks.anchorFor(0, x, y), target);
  assert(anchor && anchor.c === 4, `targets the column under the piece centre (c=4), got ${anchor && anchor.c}`);
  assert(anchor && anchor.r < 6, `targets ABOVE the fingertip (piece centre lifted), landed r=${anchor && anchor.r} (< 6)`);

  const off = await page.evaluate(({ x, y, w }) => window.__blocks.anchorFor(0, x + w * 0.4, y), target);
  assert(off && off.c === anchor.c && off.r === anchor.r, 'a sub-half-cell offset snaps to the same cell (generous tolerance)');

  const board = await page.$eval('.blk-board', n => n.getBoundingClientRect());
  const nullAnchor = await page.evaluate(({ x, y }) => window.__blocks.anchorFor(0, x, y), { x: board.left + board.width / 2, y: board.bottom + 300 });
  assert(nullAnchor === null, 'a drop far off the board resolves to no anchor');
  await ctx.close();
}

// real drag: ghost visible + lifted, placement lands, invalid glides back keeping the piece
console.log('== real drag: ghost lift + glide-back ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });  // motion on
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({ seen: { trophyRetro: true, introSeen: { blocks: true } } }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('blocks'));
  await enterPlay(page);
  await page.evaluate(() => window.__blocks.rig(0, [[0, 0]]));
  const slot = await page.$eval('.blk-slot:not(.empty)', n => { const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  const cell = await cellRect(page, 6, 4);
  await page.mouse.move(slot.x, slot.y);
  await page.mouse.down();
  await page.mouse.move((slot.x + cell.x) / 2, (slot.y + cell.y) / 2, { steps: 4 });
  await page.mouse.move(cell.x, cell.y, { steps: 6 });
  const ghost = await page.$eval('.blk-ghost', n => { const b = n.getBoundingClientRect(); return { cy: b.top + b.height / 2 }; });
  assert(ghost && ghost.cy < cell.y - 40, `dragged piece renders lifted above the fingertip (ghost cy ${Math.round(ghost && ghost.cy)} < pointer ${Math.round(cell.y)} - 40)`);
  await page.mouse.up();
  await sleep(150);
  const placed = await page.evaluate(() => { const b = window.__blocks.board(); let hit = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c]) hit = { r, c }; return hit; });
  assert(placed && placed.c === 4 && placed.r < 6, `drop lands the cell under the piece centre (r=${placed && placed.r} < 6, c=${placed && placed.c})`);

  // invalid drop (off the board) glides the piece back — it is NOT lost
  await page.evaluate(() => window.__blocks.rig(1, [[0, 0]]));
  const slot1 = await page.$$('.blk-slot:not(.empty)');
  const s1 = await slot1[1].boundingBox();
  await page.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2);
  await page.mouse.down();
  await page.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2 - 20, { steps: 2 });
  const boardBox = await page.$eval('.blk-board', n => n.getBoundingClientRect());
  await page.mouse.move(boardBox.left + boardBox.width / 2, boardBox.bottom + 260, { steps: 6 });
  await page.mouse.up();
  await sleep(400);
  const trayStill = await page.evaluate(() => window.__blocks.tray()[1]);
  assert(trayStill && trayStill.cells.length === 1, 'an invalid drop glides the piece back to the tray (never vanishes)');
  const noGhost = await page.$('.blk-ghost');
  assert(!noGhost, 'the drag ghost is cleaned up after glide-back');
  await ctx.close();
}

// ==================== near-complete shimmer + line-clear flourish ====================
console.log('== near-complete shimmer + flourish ==');
{
  const { ctx, page } = await fresh(SAVE({ seen: { trophyRetro: true, introSeen: { blocks: true } } }));
  await page.evaluate(() => window.BooTown.go('blocks'));
  await enterPlay(page);
  await page.evaluate(() => { window.__blocks.resetForTest(); window.__blocks.fillRowExceptLast(3); });
  await sleep(100);
  const near = await page.$$eval('.blk-cell.blk-near', ns => ns.length);
  const gap = await page.$$eval('.blk-cell.blk-gap', ns => ns.length);
  assert(near === 7, `a row one cell from complete shimmers its 7 filled cells (8x8 board), got ${near}`);
  assert(gap === 1, `the single gap cell pulses, got ${gap}`);
  // completing that row fires the "+line!" flourish
  await page.evaluate(() => { window.__blocks.rig(0, [[0, 0]]); window.__blocks.place(0, 3, 7); });
  await page.waitForSelector('.blk-flourish', { timeout: 2000 });
  const flourish = await page.$eval('.blk-flourish', n => n.textContent);
  assert(/line|CLEAR/i.test(flourish), 'a completed line pops a flourish');
  const lines = await page.evaluate(() => window.__blocks.stats().lines);
  assert(lines >= 1, 'the cleared line is counted');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
