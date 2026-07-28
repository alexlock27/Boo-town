// PROBE 2 — a deliberate WRONG move on every puzzle, timed, plus the bridges lockout.
import { openApp, SHOTS, mkSave, P } from './_critic2-lib.mjs';

const save = mkSave();
const { browser, page, errors } = await openApp({ width: 1024, height: 768 }, save);

const enter = async node => {
  await page.evaluate(n => window.BooTown.go('expeditionpuzzle', { node: n }), node);
  await page.waitForSelector('.exp-puzzle .exp-puzzle-board button');
  await page.evaluate(() => {
    window.__mut = [];
    new MutationObserver(() => { if (window.__t0 !== undefined) window.__mut.push(performance.now() - window.__t0); })
      .observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
};
const timed = async (fn, label) => {
  await page.evaluate(() => { window.__mut = []; window.__t0 = performance.now(); });
  await fn();
  await page.waitForTimeout(1400);
  const m = await page.evaluate(() => ({ first: window.__mut[0] ?? null, live: window.__expeditionPuzzle.liveText(), rule: window.__expeditionPuzzle.ruleText(), st: window.__expeditionPuzzle.state() }));
  console.log(`  ${label}: first change ${m.first === null ? 'NONE' : m.first.toFixed(0) + 'ms'} | wrong=${m.st.wrong} solved=${m.st.solved.length}`);
  console.log(`      live: ${JSON.stringify(m.live)}`);
  console.log(`      rule still on screen: ${JSON.stringify(m.rule)}`);
  return m;
};

// ============ BRIDGES: deliberate wrong bridge ============
console.log('\n=== BRIDGES — a deliberate WRONG bridge ===');
await enter('bridges');
const bInfo = await page.evaluate(() => {
  const rs = window.__expeditionPuzzle.rules();
  return { rules: rs.map(r => r.text) };
});
console.log('rules:', JSON.stringify(bInfo.rules));
// choose Boo 0, find its correct side by asking the engine, then click the OTHER
const wrongSide = await page.evaluate(() => {
  const rs = window.__expeditionPuzzle.rules();
  const ids = (JSON.parse(localStorage.getItem('bootown.save.v1')).expedition.party);
  // read the dock order and predicate each rendered boo through the rule engine via try? no —
  // instead: click boo 0, then click each bridge and see. We just compute from art data:
  return null;
});
await page.click('.exp-dock .exp-puzzle-boo:nth-child(1)');
// try bridge 0; if it turns out to be right, restart and use bridge 1
let m = await timed(async () => { await page.click('.bridge-guardian.bridge-0'); }, 'Boo1 -> Bridge 1');
let wrongHappened = m.st.wrong > 0;
if (!wrongHappened) {
  await page.click('.exp-dock .exp-puzzle-boo:not([disabled])');
  m = await timed(async () => { await page.click('.bridge-guardian.bridge-1'); }, 'Boo2 -> Bridge 2');
  wrongHappened = m.st.wrong > 0;
}
console.log('  a wrong guess occurred:', wrongHappened);
// wobble evidence + dock state
const dock = await page.evaluate(() => [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].map(b => ({ n: b.querySelector('.epb-name').textContent, disabled: b.disabled, gone: b.classList.contains('gone') })));
console.log('  dock:', JSON.stringify(dock));
await page.screenshot({ path: `${SHOTS}/bridges-wrong.png` });

// ---- THE LOCKOUT TEST: send every remaining Boo to BOTH bridges honestly ----
console.log('\n  -- can a child still finish after wrong guesses? clicking honestly, both bridges --');
await page.evaluate(async () => {
  for (let pass = 0; pass < 4; pass++) {
    const boos = [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].filter(b => !b.disabled);
    if (!boos.length) break;
    for (const b of boos) {
      for (const g of [...document.querySelectorAll('.bridge-guardian')]) {
        if (b.disabled) break;
        b.click(); await new Promise(r => setTimeout(r, 50));
        g.click(); await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
});
const stuck = await page.evaluate(() => ({
  st: window.__expeditionPuzzle.state(),
  live: window.__expeditionPuzzle.liveText(),
  enabled: [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].filter(b => !b.disabled).length,
  route: location.hash, screen: document.querySelector('.screen')?.className
}));
console.log('  RESULT:', JSON.stringify(stuck));
console.log('  >>> solved', stuck.st.solved.length, 'of 8; tappable Boos left:', stuck.enabled, '; still on puzzle screen:', /exp-puzzle/.test(stuck.screen || ''));
await page.screenshot({ path: `${SHOTS}/bridges-LOCKOUT.png` });

// ============ PICNIC: a deliberate wrong plate ============
console.log('\n=== PICNIC — a deliberate WRONG plate ===');
await enter('picnic');
console.log('  rule:', JSON.stringify(await page.evaluate(() => window.__expeditionPuzzle.ruleText())));
const bad = await page.evaluate(() => {
  const rs = window.__expeditionPuzzle.rules();
  return rs.map(r => r && r.text);
});
console.log('  rules:', JSON.stringify(bad));
// fill the plate with toppings the engine says are WRONG
await page.evaluate(async () => {
  const rs = window.__expeditionPuzzle.rules();
  const tops = [...document.querySelectorAll('.topping')];
  // find 3 whose id is not in the accepted set
  const okIds = new Set();
  const { TOPPINGS } = await import('/data/expedition.js');
  TOPPINGS.forEach(t => { if (rs[0] && rs[0].pred(t)) okIds.add(t.id); });
  let n = 0;
  for (const t of tops) { if (n >= 3) break; if (!okIds.has(t.dataset.id)) { t.click(); n++; await new Promise(r => setTimeout(r, 40)); } }
});
await page.waitForTimeout(200);
await timed(async () => { await page.click('.exp-serve'); }, 'Serve a wrong plate');
await page.screenshot({ path: `${SHOTS}/picnic-wrong.png` });
// and a right plate
await page.evaluate(async () => {
  const rs = window.__expeditionPuzzle.rules();
  const { TOPPINGS } = await import('/data/expedition.js');
  const ok = TOPPINGS.filter(t => rs[0] && rs[0].pred(t)).slice(0, 3).map(t => t.id);
  for (const id of ok) { document.querySelector(`.topping[data-id="${id}"]`)?.click(); await new Promise(r => setTimeout(r, 40)); }
});
await timed(async () => { await page.click('.exp-serve'); }, 'Serve a RIGHT plate');
await page.screenshot({ path: `${SHOTS}/picnic-right.png` });

// ============ HOTEL: a deliberate wrong floor ============
console.log('\n=== HOTEL — a deliberate WRONG floor ===');
await enter('hotel');
console.log('  rule:', JSON.stringify(await page.evaluate(() => window.__expeditionPuzzle.ruleText())));
await page.click('.exp-dock .exp-puzzle-boo:nth-child(1)');
const hres = await page.evaluate(() => {
  const rs = window.__expeditionPuzzle.rules();
  return rs.map(r => r && r.text);
});
console.log('  rules:', JSON.stringify(hres));
// click every floor until one is wrong
for (const f of [0, 1, 2]) {
  const before = await page.evaluate(() => window.__expeditionPuzzle.state().wrong);
  await page.evaluate(() => { if (!document.querySelector('.exp-puzzle-boo.selected')) document.querySelector('.exp-dock .exp-puzzle-boo:not([disabled])').click(); });
  const r = await timed(async () => { await page.click(`.hotel-floor.floor-${f} .hotel-room:nth-child(2)`); }, `Boo -> Floor ${f + 1}`);
  if (r.st.wrong > before) { await page.screenshot({ path: `${SHOTS}/hotel-wrong.png` }); break; }
}

// ============ RAFT: a deliberate wrong sail ============
console.log('\n=== RAFT — sail with a wobbly seating ===');
await enter('raft');
console.log('  rule:', JSON.stringify(await page.evaluate(() => window.__expeditionPuzzle.ruleText())));
await page.evaluate(async () => {
  const boos = [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')];
  const seats = [...document.querySelectorAll('.raft-seat')];
  for (let i = 0; i < boos.length; i++) {
    document.querySelectorAll('.exp-dock .exp-puzzle-boo')[0]?.click();
    await new Promise(r => setTimeout(r, 30));
    [...document.querySelectorAll('.raft-seat.empty')][0]?.click();
    await new Promise(r => setTimeout(r, 60));
  }
});
await page.waitForTimeout(300);
const seatState = await page.evaluate(() => ({ seated: document.querySelectorAll('.raft-seat:not(.empty)').length, red: document.querySelectorAll('.raft-seat.red').length, amber: document.querySelectorAll('.raft-seat.amber').length, green: document.querySelectorAll('.raft-seat.green').length, valid: window.__expeditionPuzzle.valid() }));
console.log('  seats:', JSON.stringify(seatState));
await timed(async () => { await page.click('.exp-sail'); }, 'Pull the sail');
await page.screenshot({ path: `${SHOTS}/raft-wrong.png` });

console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
