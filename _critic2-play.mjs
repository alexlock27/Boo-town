// PROBE 1 — play each puzzle by real clicking. Time first-interaction, right/wrong feedback.
import { openApp, SHOTS, mkSave } from './_critic2-lib.mjs';

const node = process.argv[2] || 'bridges';
const tier = +(process.argv[3] || 1);

const save = mkSave({ expedition: { party: undefined, tiers: { [node]: tier }, progress: {} } });
save.expedition.party = (await import('./_critic2-lib.mjs')).P;

const { browser, page, errors } = await openApp({ width: 1024, height: 768 }, save);

const t0 = Date.now();
await page.evaluate(n => window.BooTown.go('expeditionpuzzle', { node: n }), node);
await page.waitForSelector('.exp-puzzle .exp-puzzle-board button', { timeout: 8000 });
const mounted = Date.now() - t0;

const info = await page.evaluate(() => ({
  rule: window.__expeditionPuzzle.ruleText(),
  live: window.__expeditionPuzzle.liveText(),
  state: window.__expeditionPuzzle.state(),
  h2: document.querySelector('.exp-puzzle h2')?.textContent,
  progress: document.querySelector('.exp-progress')?.textContent,
  budget: document.querySelector('.exp-budget')?.textContent,
  dockCount: document.querySelectorAll('.exp-dock .exp-puzzle-boo').length
}));
console.log(`\n=== ${node} (tier ${tier}) ===`);
console.log('mount->interactive ms:', mounted);
console.log('title   :', info.h2);
console.log('RULE    :', JSON.stringify(info.rule));
console.log('LIVE    :', JSON.stringify(info.live));
console.log('meters  :', info.progress, '|', info.budget);
console.log('state   :', JSON.stringify(info.state));
await page.screenshot({ path: `${SHOTS}/${node}-t${tier}-mount.png` });

// ---- instrument: watch for ANY DOM/class/text change after a click -------------------
await page.evaluate(() => {
  window.__mut = [];
  window.__obs = new MutationObserver(recs => { if (window.__t0) window.__mut.push({ ms: performance.now() - window.__t0, n: recs.length }); });
  window.__obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
});
const timedClick = async (fn, label) => {
  await page.evaluate(() => { window.__mut = []; window.__t0 = performance.now(); });
  await fn();
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => ({ first: window.__mut[0]?.ms ?? null, count: window.__mut.length, live: window.__expeditionPuzzle.liveText(), rule: window.__expeditionPuzzle.ruleText(), state: window.__expeditionPuzzle.state() }));
  console.log(`  ${label}: first-DOM-change ${m.first === null ? 'NONE' : m.first.toFixed(0) + 'ms'} (${m.count} batches)`);
  console.log(`      live: ${JSON.stringify(m.live)}`);
  console.log(`      rule: ${JSON.stringify(m.rule)}`);
  console.log(`      state: wrong=${m.state.wrong} solved=${m.state.solved.length}`);
  return m;
};

const rules = await page.evaluate(() => (window.__expeditionPuzzle.rules() || []).map(r => r.text));
console.log('rules   :', JSON.stringify(rules));

if (node === 'bridges') {
  // find which boo belongs to which bridge
  const map = await page.evaluate(() => {
    const rs = window.__expeditionPuzzle.rules();
    const st = window.__expeditionPuzzle;
    return [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].map((b, i) => ({ i, id: b.dataset.id, name: b.querySelector('.epb-name').textContent, side: rs.findIndex(r => r.pred((window.__party || [])[i] || {})) }));
  });
  // pick Boo 0, send to the WRONG bridge first
  await timedClick(async () => { await page.click('.exp-dock .exp-puzzle-boo:nth-child(1)'); }, 'select Boo 1');
  await page.screenshot({ path: `${SHOTS}/${node}-selected.png` });
  // determine correct side for boo 0
  const side0 = await page.evaluate(() => {
    const rs = window.__expeditionPuzzle.rules();
    const st = window.__expeditionPuzzle.state();
    return null;
  });
  // just click bridge 1; whichever it is we record right or wrong
  const before = await page.evaluate(() => window.__expeditionPuzzle.state());
  const m1 = await timedClick(async () => { await page.click('.bridge-guardian.bridge-0'); }, 'tap Bridge 1');
  await page.screenshot({ path: `${SHOTS}/${node}-after-first-tap.png` });
  const disabled = await page.evaluate(() => [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].map(b => ({ name: b.querySelector('.epb-name').textContent, disabled: b.disabled, gone: b.classList.contains('gone') })));
  console.log('  dock after first tap:', JSON.stringify(disabled));
  // now try to finish by real clicking every remaining boo onto the right bridge
  for (let round = 0; round < 3; round++) {
    const remaining = await page.evaluate(() => [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].filter(b => !b.disabled).length);
    if (!remaining) break;
    await page.evaluate(async () => {
      const rs = window.__expeditionPuzzle.rules();
      for (const b of [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')]) {
        if (b.disabled) continue;
        b.click();
        // correct bridge = the one that does NOT sneeze; rules[side].pred(boo)==true means side ok
        await new Promise(r => setTimeout(r, 60));
        const guards = [...document.querySelectorAll('.bridge-guardian')];
        guards[0].click();
        await new Promise(r => setTimeout(r, 1100));
      }
    });
  }
  const final = await page.evaluate(() => ({ state: window.__expeditionPuzzle.state(), live: window.__expeditionPuzzle.liveText(), dock: [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].map(b => b.disabled) }));
  console.log('  after brute-force clicking every Boo at Bridge 1:', JSON.stringify(final.state), final.live);
  console.log('  all dock disabled?', final.dock.every(Boolean), '| solved', final.state.solved.length, 'of 8');
  await page.screenshot({ path: `${SHOTS}/${node}-stuck.png` });
}

if (node === 'picnic') {
  await timedClick(async () => { await page.click('.picnic-tray .topping:nth-child(1)'); }, 'tap topping 1');
  await timedClick(async () => { await page.click('.picnic-tray .topping:nth-child(2)'); }, 'tap topping 2');
  await timedClick(async () => { await page.click('.picnic-tray .topping:nth-child(3)'); }, 'tap topping 3');
  await page.screenshot({ path: `${SHOTS}/${node}-plate-full.png` });
  await timedClick(async () => { await page.click('.exp-serve'); }, 'Serve this plate');
  await page.screenshot({ path: `${SHOTS}/${node}-after-serve.png` });
}

if (node === 'raft') {
  await timedClick(async () => { await page.click('.exp-dock .exp-puzzle-boo:nth-child(1)'); }, 'select Boo 1');
  await timedClick(async () => { await page.click('.raft-seat:nth-child(1)'); }, 'tap seat 1');
  await page.screenshot({ path: `${SHOTS}/${node}-seated.png` });
  await timedClick(async () => { await page.click('.exp-sail'); }, 'Pull the sail (too early)');
  await page.screenshot({ path: `${SHOTS}/${node}-early-sail.png` });
}

if (node === 'hotel') {
  await timedClick(async () => { await page.click('.exp-dock .exp-puzzle-boo:nth-child(1)'); }, 'select Boo 1');
  await timedClick(async () => { await page.click('.hotel-floor.floor-0 .hotel-room:nth-child(2)'); }, 'tap a room on Floor 1');
  await page.screenshot({ path: `${SHOTS}/${node}-after-room.png` });
  await timedClick(async () => { await page.click('.exp-dock .exp-puzzle-boo:not([disabled])'); }, 'select next Boo');
  await timedClick(async () => { await page.click('.hotel-floor.floor-1 .hotel-room:nth-child(2)'); }, 'tap a room on Floor 2');
}

// hint
await timedClick(async () => { await page.click('.exp-hint-btn'); }, 'tap ? Hint');
await page.screenshot({ path: `${SHOTS}/${node}-hint.png` });

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
