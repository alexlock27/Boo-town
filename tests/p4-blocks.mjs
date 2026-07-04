// tests/p4-blocks.mjs — Boo Blocks (RUN2 C4) + part E check 7.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

const SEED = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, town: [], stars: { total: 30, byGame: {} }, settings: { sound: false, music: false, voice: false }, seen: {} };
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SEED);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// ---- 1) star thresholds ----
console.log('== star thresholds ==');
const starLogic = await page.evaluate(async () => {
  const m = await import('./js/games/blocks.js');
  return [m.starsForBlocks(12, 5, 0), m.starsForBlocks(10, 5, 0), m.starsForBlocks(10, 5, 1), m.starsForBlocks(8, 3, 0), m.starsForBlocks(6, 2, 0)];
});
assert(starLogic[0] === 3 && starLogic[1] === 3, '3 stars for 10+ correct & 5 lines, no hints');
assert(starLogic[2] === 2, 'a hint caps below 3 stars');
assert(starLogic[3] === 2, '2 stars for 7+ correct & 3 lines');
assert(starLogic[4] === 1, '1 star for finishing');

// ---- Words category produces valid questions (one correct spelling) ----
console.log('== question engine (tables + words) ==');
const qCheck = await page.evaluate(async () => {
  const q = await import('./js/questions.js');
  const out = { catsHaveWords: q.BLOCK_CATEGORIES.some(c => c.key === 'words'), badWords: 0, badMath: 0 };
  for (let i = 0; i < 40; i++) {
    const w = q.makeQuestion('words', 1 + (i % 3), null, 3);
    if (w.options.length !== 3 || w.correct < 0 || new Set(w.options).size !== 3 || w.options[w.correct] !== w.speak) out.badWords++;
    const m = q.makeQuestion('tables', 1 + (i % 3), null, 3);
    if (m.options.length !== 3 || m.correct < 0 || new Set(m.options).size !== 3) out.badMath++;
  }
  return out;
});
assert(qCheck.catsHaveWords, 'Words category available in the picker');
assert(qCheck.badWords === 0, 'every Words question has 3 distinct options with exactly one correct spelling');
assert(qCheck.badMath === 0, 'every tables question has 3 distinct options');

// The in-page smart packer (2-ply) used to demonstrate an achievable 3-star.
const PACKER = `
  const B = window.__blocks; const sleep = ms => new Promise(r => setTimeout(r, ms));
  const evalBoard = b => { let agg=0,holes=0,bump=0,near=0; const h=[]; for(let c=0;c<9;c++){let top=9;for(let r=0;r<9;r++){if(b[r][c]){top=r;break;}}h[c]=9-top;agg+=h[c];let seen=false;for(let r=0;r<9;r++){if(b[r][c])seen=true;else if(seen)holes++;}}for(let c=0;c<8;c++)bump+=Math.abs(h[c]-h[c+1]);for(let rr=0;rr<9;rr++){const f=b[rr].filter(v=>v).length;if(f<9)near+=f*f;}for(let cc=0;cc<9;cc++){let f=0;for(let rr=0;rr<9;rr++)if(b[rr][cc])f++;if(f<9)near+=f*f;}return {agg,holes,bump,near};};
  const fitsB=(b,cells,r,c)=>cells.every(([dr,dc])=>{const rr=r+dr,cc=c+dc;return rr>=0&&rr<9&&cc>=0&&cc<9&&!b[rr][cc];});
  const placeB=(b,cells,r,c)=>{const nb=b.map(x=>x.slice());for(const[dr,dc]of cells)nb[r+dr][c+dc]=1;return nb;};
  const clearB=b=>{const rf=[],cf=[];for(let rr=0;rr<9;rr++)if(b[rr].every(v=>v))rf.push(rr);for(let cc=0;cc<9;cc++){let f=true;for(let rr=0;rr<9;rr++)if(!b[rr][cc]){f=false;break;}if(f)cf.push(cc);}for(const rr of rf)for(let cc=0;cc<9;cc++)b[rr][cc]=0;for(const cc of cf)for(let rr=0;rr<9;rr++)b[rr][cc]=0;return rf.length+cf.length;};
  const scoreOf=(l,e)=>l*6000-e.agg*1.0-e.holes*45-e.bump*0.3+e.near*0.45;
  const best1=(board,tray)=>{let best=null;for(let s=0;s<tray.length;s++){const cells=tray[s];if(!cells)continue;for(let r=0;r<9;r++)for(let c=0;c<9;c++){if(!fitsB(board,cells,r,c))continue;const nb=placeB(board,cells,r,c);const l=clearB(nb);const sc=scoreOf(l,evalBoard(nb));if(!best||sc>best.score)best={s,r,c,score:sc};}}return best;};
  const bestPlacement=()=>{const board=B.board();const tray=B.tray();let best=null;for(let s=0;s<tray.length;s++){const cells=tray[s];if(!cells)continue;for(let r=0;r<9;r++)for(let c=0;c<9;c++){if(!fitsB(board,cells,r,c))continue;const nb=placeB(board,cells,r,c);const l=clearB(nb);const base=scoreOf(l,evalBoard(nb));const rest=tray.map((t,i)=>i===s?null:t);const nx=best1(nb,rest);const total=base+(nx?nx.score*0.85:0);if(!best||total>best.score)best={s,r,c,score:total};}}return best;};
  let guard=0;
  while(!B.ended()&&guard++<400){ if(!B.waiting()){const q=window.__booQuestion;if(q)B.answer(q.correct);await sleep(15);} const bp=bestPlacement(); if(bp){B.place(bp.s,bp.r,bp.c);await sleep(10);} await sleep(6); if(B.ended())break; }
  return B.stats();
`;

const computeStars = (st) => (st.hintsUsed === 0 && st.correct >= 10 && st.lines >= 5) ? 3 : (st.correct >= 7 && st.lines >= 3) ? 2 : 1;
async function playRound() {
  await page.evaluate(() => window.BooTown.go('blocks'));
  await page.waitForSelector('.start-card');
  await page.click('.level-row .level-btn'); // level 1
  await page.waitForSelector('.blk-board');
  await page.waitForTimeout(120);
  const stats = await page.evaluate('(async()=>{' + PACKER + '})()');
  const reachedResults = await page.waitForSelector('.result-card', { timeout: 8000 }).then(() => true).catch(() => false);
  return { stats, stars: computeStars(stats), reachedResults };
}

// ---- 2) completable + feeds meter ----
console.log('== completable + feeds meter ==');
const before = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { plays: s.stars.byGame.blocks.plays, meter: s.meter, total: s.stars.total }; });
const r1 = await playRound();
assert(r1.reachedResults && r1.stats.placed >= 1 && r1.stars >= 1, 'round completes to results with stars (placed ' + r1.stats.placed + ', ' + r1.stars + '★)');
// dismiss results back to hub
await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub');
const after = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { plays: s.stars.byGame.blocks.plays, meter: s.meter, total: s.stars.total }; });
assert(after.plays === before.plays + 1, 'blocks play recorded');
assert(after.total > before.total, 'stars added to total (feeds the meter)');

// ---- 3) 3-starrable (best of up to 14 rounds) ----
console.log('== 3-starrable headlessly ==');
let best = r1, tries = 1, maxLines = r1.stats.lines;
for (let i = 0; i < 24 && best.stars < 3; i++) {
  const r = await playRound(); tries++;
  maxLines = Math.max(maxLines, r.stats.lines);
  if (r.stars > best.stars) best = r;
}
assert(best.stars === 3, `achieved a 3-star round headlessly in ${tries} tries (best ${best.stars}★, max lines ${maxLines})`);

// ---- 4) hearts never end the round; wrong-answer re-ask then swap ----
console.log('== hearts never end + wrong-answer path ==');
await page.evaluate(() => window.BooTown.go('blocks'));
await page.waitForSelector('.start-card'); await page.click('.level-row .level-btn'); await page.waitForSelector('.blk-board'); await page.waitForTimeout(150);
const heartTest = await page.evaluate(async () => {
  const B = window.__blocks; const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q0 = window.__booQuestion; const wrong = (q0.correct + 1) % q0.options.length;
  B.answer(wrong); await sleep(40);            // 1st wrong: heart dims, re-ask (same q)
  const sameQ = window.__booQuestion.key === q0.key;
  B.answer(wrong); await sleep(60);            // 2nd wrong: swaps question
  const swapped = window.__booQuestion.key !== q0.key;
  const heartsAfter2 = B.hearts();
  // dim the 3rd heart, round must NOT end
  const q1 = window.__booQuestion; B.answer((q1.correct + 1) % q1.options.length); await sleep(60);
  return { sameQ, swapped, heartsAfter2, hearts: B.hearts(), ended: B.ended() };
});
assert(heartTest.sameQ, 'first wrong re-asks the same question');
assert(heartTest.swapped, 'second wrong swaps to a new question');
assert(heartTest.hearts === 0, 'three wrongs dimmed all hearts');
assert(heartTest.ended === false, 'round does NOT end when hearts run out (gentle)');

// ---- 5) hint highlights a legal placement ----
const hintOk = await page.evaluate(async () => {
  const B = window.__blocks; const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = window.__booQuestion; B.answer(q.correct); await sleep(80); // earn a piece
  document.querySelector('.hint-btn').click(); await sleep(50);
  return document.querySelectorAll('.blk-cell.hint').length > 0;
});
assert(hintOk, 'hint highlights a legal placement');

// ---- 6) pauses when hidden (turn-based: no timer runs; no error) ----
await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }) && document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(100);
assert(errors.length === 0, 'no errors while hidden (no runaway loop)');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
