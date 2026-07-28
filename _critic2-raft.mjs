// PROBE 4 — is the Ferry Raft solvable at all? and does the hotel actually finish?
import { openApp, SHOTS, mkSave, P } from './_critic2-lib.mjs';
const { browser, page, errors } = await openApp({ width: 1024, height: 768 }, mkSave());

console.log('=== RAFT solvability across parties ===');
const res = await page.evaluate(async () => {
  const mod = await import('/js/expedition/puzzle.js');
  const cat = await import('/data/catalogue.js');
  const boosAll = Object.values(cat.BY_ID).filter(i => i.id.startsWith('boo_'));
  const W = 4;
  const solvable = (boos, seatCount) => {
    const seats = Array(seatCount).fill(null);
    let found = false, tried = 0;
    const cols = W;
    const ok = (i, b) => {
      const nb = [i % cols ? seats[i - 1] : null, i % cols < cols - 1 ? seats[i + 1] : null, i >= cols ? seats[i - cols] : null, i + cols < seatCount ? seats[i + cols] : null];
      return nb.every(x => !x || mod.raftEdge(b, x) === 'green');
    };
    const rec = k => {
      if (found || ++tried > 800000) return;
      if (k === boos.length) { found = true; return; }
      for (let i = 0; i < seatCount; i++) { if (seats[i]) continue; if (!ok(i, boos[k])) continue; seats[i] = boos[k]; rec(k + 1); seats[i] = null; if (found) return; }
    };
    rec(0);
    return { found, tried };
  };
  const out = [];
  // the brief's party
  const brief = ['boo_inky','boo_plum','boo_pippin','boo_lolly','boo_chomp','boo_mallow','boo_curly','boo_wisp'].map(id => cat.BY_ID[id]);
  out.push({ label: 'brief party (8 riders)', ...solvable(brief, 12) });
  // 20 random parties of 8 from the whole catalogue
  let win = 0, total = 20;
  for (let t = 0; t < total; t++) {
    const pool = [...boosAll].sort(() => Math.random() - .5).slice(0, 8);
    if (solvable(pool, 12).found) win++;
  }
  out.push({ label: `${total} random 8-Boo parties solvable`, win, total });
  // how many boos exist, and a sanity note on the edge rule
  const pairs = [];
  for (let i = 0; i < brief.length; i++) for (let j = i + 1; j < brief.length; j++) pairs.push(`${brief[i].name}/${brief[j].name}:${mod.raftEdge(brief[i], brief[j])}`);
  out.push({ label: 'brief-party pairwise edges', pairs, greenPairs: pairs.filter(p => p.endsWith('green')).length, totalPairs: pairs.length });
  return out;
});
res.forEach(r => console.log(' ', JSON.stringify(r).slice(0, 700)));

console.log('\n=== HOTEL: does finish() fire and navigate? ===');
await page.evaluate(() => window.BooTown.go('expeditionpuzzle', { node: 'hotel' }));
await page.waitForSelector('.exp-puzzle .exp-puzzle-board button');
await page.evaluate(async () => { for (let i = 0; i < 8; i++) { window.__expeditionPuzzle.try(i); await new Promise(r => setTimeout(r, 120)); } });
await page.waitForTimeout(400);
console.log('  after try(0..7):', JSON.stringify(await page.evaluate(() => ({ st: window.__expeditionPuzzle.state(), live: window.__expeditionPuzzle.liveText() }))));
await page.waitForTimeout(1600);
console.log('  screen after 2s:', await page.evaluate(() => document.querySelector('.screen')?.className));
console.log('  save progress:', JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')).expedition)));
await page.screenshot({ path: `${SHOTS}/hotel-after-finish.png` });

console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
