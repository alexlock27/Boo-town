// PROBE 3 — the selection ring after a Boo is used; raft solvability; hotel full play.
import { openApp, SHOTS, mkSave } from './_critic2-lib.mjs';
const { browser, page, errors } = await openApp({ width: 1024, height: 768 }, mkSave());
const enter = async node => { await page.evaluate(n => window.BooTown.go('expeditionpuzzle', { node: n }), node); await page.waitForSelector('.exp-puzzle .exp-puzzle-board button'); };

// ---- A. does the zing selection ring stay on a Boo that has already gone? ----
for (const node of ['bridges', 'raft', 'hotel']) {
  await enter(node);
  await page.click('.exp-dock .exp-puzzle-boo:nth-child(1)');
  if (node === 'bridges') await page.click('.bridge-guardian.bridge-0');
  if (node === 'raft') await page.click('.raft-seat:nth-child(1)');
  if (node === 'hotel') {
    // place on the floor that accepts it
    await page.evaluate(() => { const rs = window.__expeditionPuzzle.rules(); window.__f = 0; });
    for (const f of [0, 1, 2]) {
      const b = await page.evaluate(() => window.__expeditionPuzzle.state().solved.length);
      await page.click(`.hotel-floor.floor-${f} .hotel-room:nth-child(2)`);
      await page.waitForTimeout(150);
      const a = await page.evaluate(() => window.__expeditionPuzzle.state().solved.length);
      if (a > b) break;
      await page.evaluate(() => document.querySelector('.exp-dock .exp-puzzle-boo:not([disabled])')?.click());
    }
  }
  await page.waitForTimeout(1100);
  const r = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.exp-puzzle-boo.selected')];
    return { selectedCount: sel.length, selectedAreDisabled: sel.map(s => ({ name: s.querySelector('.epb-name')?.textContent, disabled: s.disabled, gone: s.classList.contains('gone') })) };
  });
  console.log(`${node}: tiles still wearing the .selected zing ring after the Boo was used:`, JSON.stringify(r));
  await page.screenshot({ path: `${SHOTS}/${node}-ghost-selection.png` });
}

// ---- B. raft: seat all 8 honestly, is a valid arrangement reachable? ----
console.log('\n=== RAFT: real play ===');
await enter('raft');
const seatAll = await page.evaluate(async () => {
  const pick = () => [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].find(b => !b.disabled);
  let n = 0;
  while (pick() && n < 12) {
    pick().click(); await new Promise(r => setTimeout(r, 40));
    const s = [...document.querySelectorAll('.raft-seat.empty')][0];
    if (!s) break;
    s.click(); await new Promise(r => setTimeout(r, 60)); n++;
  }
  return { seated: document.querySelectorAll('.raft-seat:not(.empty)').length, valid: window.__expeditionPuzzle.valid(), red: document.querySelectorAll('.raft-seat.red').length, amber: document.querySelectorAll('.raft-seat.amber').length };
});
console.log('  naive fill:', JSON.stringify(seatAll));
await page.screenshot({ path: `${SHOTS}/raft-filled.png` });
// brute-force search for ANY valid arrangement of the 8 in 12 seats
const solvable = await page.evaluate(async () => {
  const mod = await import('/js/expedition/puzzle.js');
  const st = JSON.parse(localStorage.getItem('bootown.save.v1'));
  const cat = await import('/data/catalogue.js');
  const boos = st.expedition.party.map(id => cat.BY_ID[id]);
  const seats = Array(12).fill(null);
  const W = 4;
  let found = null, tried = 0;
  const ok = (i, b) => {
    const nb = [i % W ? seats[i - 1] : null, i % W < W - 1 ? seats[i + 1] : null, i >= W ? seats[i - W] : null, i + W < 12 ? seats[i + W] : null];
    return nb.every(x => !x || mod.raftEdge(b, x) === 'green');
  };
  const rec = (k) => {
    if (found || ++tried > 400000) return;
    if (k === boos.length) { found = seats.map(s => s && s.name); return; }
    for (let i = 0; i < 12; i++) { if (seats[i]) continue; if (!ok(i, boos[k])) continue; seats[i] = boos[k]; rec(k + 1); seats[i] = null; if (found) return; }
  };
  rec(0);
  return { found, tried };
});
console.log('  a valid seating exists?', solvable.found ? 'YES' : 'NO', '(searched ' + solvable.tried + ' placements)');
if (solvable.found) console.log('  e.g.', JSON.stringify(solvable.found));

// ---- C. hotel full real play to completion ----
console.log('\n=== HOTEL: real play to completion ===');
await enter('hotel');
const hotelPlay = await page.evaluate(async () => {
  const rs = window.__expeditionPuzzle.rules();
  const log = [];
  for (let pass = 0; pass < 20; pass++) {
    const tiles = [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].filter(b => !b.disabled);
    if (!tiles.length) break;
    const t = tiles[0];
    t.click(); await new Promise(r => setTimeout(r, 40));
    let placed = false;
    for (let f = 0; f < 3 && !placed; f++) {
      const before = window.__expeditionPuzzle.state().solved.length;
      const room = document.querySelector(`.hotel-floor.floor-${f} .hotel-room:not(.warm)`);
      if (!room) continue;
      room.click(); await new Promise(r => setTimeout(r, 120));
      if (window.__expeditionPuzzle.state().solved.length > before) placed = true;
      else { const again = [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].find(b => !b.disabled); again?.click(); await new Promise(r => setTimeout(r, 40)); }
    }
    log.push({ pass, solved: window.__expeditionPuzzle.state().solved.length, wrong: window.__expeditionPuzzle.state().wrong });
  }
  return { log: log.slice(-3), st: window.__expeditionPuzzle.state(), live: window.__expeditionPuzzle.liveText() };
});
console.log('  ', JSON.stringify(hotelPlay));
await page.waitForTimeout(1500);
console.log('  screen now:', await page.evaluate(() => document.querySelector('.screen')?.className));
await page.screenshot({ path: `${SHOTS}/hotel-finished.png` });

console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
