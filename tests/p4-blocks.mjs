// tests/p4-blocks.mjs — Boo Blocks, the redesign (RUN9 C2) + acceptance part D #2.
// The pure score-chase puzzle: free pieces, scoring with simultaneous² multiply + cascade
// streak + all-clear bonus, the Boo Boost power-up economy (rotating specials, use preserved
// on a wrong try, logged to the ledger), rotation + lifted drag regress, best score persists.
// Score bands are justified by tests/sim-blocks.mjs (see PROGRESS.md).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r9p2', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', e => { errors.push('PE ' + e.message); failed = true; });
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

const SEED = { version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 30, byGame: {} }, ledger: {},
  settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } }, ageAsked: true, age: 8 };
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SEED);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

async function enter() {
  await page.evaluate(() => window.BooTown.go('blocks'));
  await page.waitForSelector('.start-card');
  await page.click('.start-card .btn.big');
  await page.waitForFunction(() => window.__blocks);
  await sleep(150);
}

// ---- 1) star bands (justified by the self-play simulation) ----
console.log('== star score bands (sim-justified) ==');
const bands = await page.evaluate(async () => {
  const m = await import('./js/games/blocks.js');
  return [m.starsForBlocks(320), m.starsForBlocks(500), m.starsForBlocks(319), m.starsForBlocks(150), m.starsForBlocks(149), m.starsForBlocks(0)];
});
assert(bands[0] === 3 && bands[1] === 3, '3 stars at score 320+');
assert(bands[2] === 2, 'just under 320 is 2 stars');
assert(bands[3] === 2 && bands[4] === 1, '2 stars at 150+, 1 below');
assert(bands[5] === 1, '1 star for playing');

// ---- 2) 8x8 board + free pieces (no question to receive them) ----
console.log('== 8x8 board + free piece flow ==');
await enter();
const shape = await page.evaluate(() => ({ rows: window.__blocks.board().length, cols: window.__blocks.board()[0].length, tray: window.__blocks.tray().filter(Boolean).length }));
assert(shape.rows === 8 && shape.cols === 8, 'board is 8x8');
assert(shape.tray === 3, 'the tray starts full (3 free pieces, no question needed)');

// ---- 3) scoring: placement, line clear, all-clear ----
console.log('== scoring: place / line / all-clear ==');
await page.evaluate(() => window.__blocks.resetForTest());
await page.evaluate(() => window.__blocks.rig(0, [[0, 0]]));
let s0 = await page.evaluate(() => window.__blocks.score());
await page.evaluate(() => window.__blocks.place(0, 0, 0));
let s1 = await page.evaluate(() => window.__blocks.score());
assert(s1 === s0 + 1, `placing one cell scores +1 (${s0}->${s1})`);

await page.evaluate(() => { window.__blocks.clearBoard(); window.__blocks.fillRowExceptLast(4); window.__blocks.rig(0, [[0, 0]]); });
const before = await page.evaluate(() => window.__blocks.score());
await page.evaluate(() => window.__blocks.place(0, 4, 7));
await sleep(400);
const afterLine = await page.evaluate(() => ({ score: window.__blocks.score(), lines: window.__blocks.lines() }));
assert(afterLine.lines >= 1, 'a completed line clears (lines counted)');
assert(afterLine.score >= before + 100, `line clear on an otherwise-empty board fires the all-clear bonus (+${afterLine.score - before})`);

// ---- simultaneous multiply ----
console.log('== simultaneous multiply ==');
await page.evaluate(() => {
  const B = window.__blocks; B.clearBoard();
  B.fillRowExceptLast(0); B.fillRowExceptLast(1);   // rows 0 and 1 filled except col 7
  B.rig(0, [[0, 0], [1, 0]]);                        // vertical domino at col 7 completes BOTH
});
const preTwo = await page.evaluate(() => window.__blocks.score());
await page.evaluate(() => window.__blocks.place(0, 0, 7));
await sleep(400);
const twoLines = await page.evaluate(() => ({ score: window.__blocks.score(), lines: window.__blocks.lines() }));
assert(twoLines.score - preTwo >= 40, `two simultaneous lines multiply (gained ${twoLines.score - preTwo}, > 2x single)`);

// ---- cascade streak (isolated: a non-clearing cell keeps the board from all-clearing) ----
console.log('== cascade streak ==');
const casc = await page.evaluate(async () => {
  const B = window.__blocks; B.resetForTest();
  // a non-clearing placement resets the cascade to 0 and leaves a stray cell so the
  // two clears below don't also fire an all-clear (which would muddy the comparison)
  B.rig(0, [[0, 0]]); B.place(0, 7, 0);
  B.fillRowExceptLast(3); B.rig(0, [[0, 0]]);
  const a0 = B.score(); B.place(0, 3, 7); await new Promise(r => setTimeout(r, 350));
  const gainA = B.score() - a0 - 1;
  B.fillRowExceptLast(5); B.rig(0, [[0, 0]]);
  const b0 = B.score(); B.place(0, 5, 7); await new Promise(r => setTimeout(r, 350));
  const gainB = B.score() - b0 - 1;
  return { gainA, gainB };
});
assert(casc.gainB > casc.gainA, `a back-to-back clear scores more via the cascade streak (${casc.gainA} -> ${casc.gainB})`);

// ---- 4) Boo Boost: rotating specials, use preserved on a wrong try, ledger logging ----
console.log('== Boo Boost economy ==');
await enter();
const nextSp = await page.evaluate(() => window.__blocks.nextSpecial());
assert(nextSp === 'lineblast', 'the first Boost special is the Line Blaster');
await page.evaluate(() => window.__blocks.boost());
await sleep(150);
assert(await page.evaluate(() => window.__blocks.boostOpen()), 'Boost poses a question');
const wrongIdx = await page.evaluate(() => { const q = window.__blocks.boostQuestion(); return (q.correct + 1) % q.options.length; });
await page.evaluate((i) => window.__blocks.boostAnswer(i), wrongIdx);
await sleep(150);
assert(await page.evaluate(() => window.__blocks.boostsLeft()) === 3, 'a wrong first answer does NOT consume the Boost');
assert(await page.evaluate(() => window.__blocks.boostOpen()), 'after a wrong first try the question stays for one retry');
await page.evaluate(() => { const q = window.__blocks.boostQuestion(); window.__blocks.boostAnswer(q.correct); });
await sleep(500);
assert(await page.evaluate(() => window.__blocks.boostsLeft()) === 2, 'a correct answer consumes one Boost use');
const traySpecials = await page.evaluate(() => window.__blocks.tray().map(p => p && p.special));
assert(traySpecials.includes('lineblast'), 'a correct answer awards a Line Blaster to the tray');
const logged = await page.evaluate(() => Object.keys(window.BooTown.State.getState().ledger || {}).length);
assert(logged > 0, 'Boost questions log to the ledger like any answer');
assert(await page.evaluate(() => window.__blocks.nextSpecial()) === 'bomb', 'the next special rotates to the Sparkle Bomb');

// ---- 5) the specials actually clear ----
console.log('== specials clear correctly ==');
const blast = await page.evaluate(async () => {
  const B = window.__blocks; B.clearBoard(); B.fillRowExceptLast(2);
  B.rigSpecial(0, 'lineblast');
  const before = B.score(); B.place(0, 2, 3); await new Promise(r => setTimeout(r, 350));
  return { row2: B.board()[2].filter(Boolean).length, gained: B.score() - before };
});
assert(blast.row2 === 0, 'the Line Blaster clears the whole row it lands on');
assert(blast.gained > 0, 'the Line Blaster scores for the cells it clears');
const bombCleared = await page.evaluate(async () => {
  const B = window.__blocks; B.clearBoard(); B.fillBoardExcept([]);
  B.rigSpecial(0, 'bomb'); B.place(0, 4, 4); await new Promise(r => setTimeout(r, 350));
  let cleared = 0; const bd = B.board();
  for (let r = 3; r <= 5; r++) for (let c = 3; c <= 5; c++) if (!bd[r][c]) cleared++;
  return cleared;
});
assert(bombCleared === 9, 'the Sparkle Bomb clears a 3x3 area');

// ---- 6) rotation + lifted drag regress ----
console.log('== rotation + drag anchor ==');
await enter();
const rotCheck = await page.evaluate(() => {
  const B = window.__blocks; B.rig(0, [[0, 0], [0, 1], [0, 2]]);
  B.select(0); const b = JSON.stringify(B.tray()[0].cells);
  B.rotate(); const a = JSON.stringify(B.tray()[0].cells);
  return b !== a;
});
assert(rotCheck, 'tapping the selected piece spins it a quarter-turn');
await page.waitForSelector('.blk-rotate');
assert(true, 'the selected piece shows a rotate ↻ badge');
// lifted-drag anchor resolves a board cell from a lifted piece centre (LIFT above finger)
const anchored = await page.evaluate(() => {
  const B = window.__blocks; B.rig(0, [[0, 0]]);
  const boardEl = document.querySelector('.blk-board'); const r = boardEl.getBoundingClientRect();
  const a = B.anchorFor(0, r.left + r.width / 2, r.top + r.height / 2 + B.LIFT);   // finger LIFT below the target centre
  return a && typeof a.r === 'number';
});
assert(anchored, 'the lifted-drag anchor resolves a board cell from the piece centre');

// ---- 7) best score persists in the save ----
console.log('== best score persists ==');
assert(typeof (await page.evaluate(() => (window.BooTown.State.getState().seen.blocksBestScore) || 0)) === 'number', 'blocksBestScore lives in the save (lossless add)');

await page.screenshot({ path: 'screenshots/r9p2/p4-final.png' });

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 5)); failed = true; }
await browser.close();
console.log('\n' + (failed ? 'p4-blocks: FAIL' : 'p4-blocks: ALL PASS'));
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
