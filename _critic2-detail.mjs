// PROBE 7 — C6 numbers, dead air, the completion line, tier-4 shapes, reduced motion.
import { openApp, SHOTS, mkSave } from './_critic2-lib.mjs';
const { browser, page, errors } = await openApp({ width: 1024, height: 768 }, mkSave({ expedition: { tiers: { picnic: 4, hotel: 4 }, progress: {} } }));
const enter = async n => { await page.evaluate(x => window.BooTown.go('expeditionpuzzle', { node: x }), n); await page.waitForSelector('.exp-puzzle .exp-puzzle-board button'); await page.waitForTimeout(200); };

// ---- 1. the wobble: which element wobbles on a wrong guess, and for how long ----
console.log('=== wrong-guess wobble (pack C6: 360ms, on the GUESSED Boo) ===');
await enter('hotel');
await page.evaluate(() => { window.__wob = []; new MutationObserver(rs => rs.forEach(r => { if (r.attributeName === 'class') { const e = r.target; if (e.classList.contains('wobble')) window.__wob.push({ t: Math.round(performance.now()), on: e.className, add: true }); else if ((r.oldValue || '').includes('wobble')) window.__wob.push({ t: Math.round(performance.now()), on: e.className, add: false }); } })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true }); });
await page.evaluate(async () => {
  const rs = window.__expeditionPuzzle.rules();
  document.querySelector('.exp-dock .exp-puzzle-boo').click();
  await new Promise(r => setTimeout(r, 50));
  // deliberately the wrong floor
  const cat = await import('/data/catalogue.js');
  const id = document.querySelector('.exp-dock .exp-puzzle-boo').dataset.id;
  const right = rs.findIndex(r => r && r.pred(cat.BY_ID[id]));
  const wrongFloor = [0, 1, 2].find(f => f !== right);
  document.querySelector(`.hotel-floor.floor-${wrongFloor} .hotel-room`).click();
});
await page.waitForTimeout(900);
const wob = await page.evaluate(() => window.__wob);
console.log(' wobble events:', JSON.stringify(wob));
if (wob.length >= 2) console.log(' wobble held for', wob[wob.length - 1].t - wob[0].t, 'ms (CSS keyframe .wobble = 0.45s)');
console.log(' animation-duration of .wobble:', await page.evaluate(() => { const e = document.createElement('div'); e.className = 'wobble'; document.body.appendChild(e); const d = getComputedStyle(e).animationDuration; e.remove(); return d; }));
console.log(' WOBBLE_MS constant in source is 360; CROSS_MS is 900.');
await page.screenshot({ path: `${SHOTS}/hotel-t4-wrong.png` });

// ---- 2. crossing: does a ghost exist for ~900ms? ----
console.log('\n=== correct crossing (pack C6: 900ms) ===');
await enter('bridges');
const cross = await page.evaluate(async () => {
  const marks = [];
  const obs = new MutationObserver(() => {});
  const t0 = performance.now();
  window.__expeditionPuzzle.try(0);
  const samples = [];
  for (let i = 0; i < 14; i++) {
    const g = document.querySelector('.exp-cross');
    samples.push({ ms: Math.round(performance.now() - t0), present: !!g, transform: g ? getComputedStyle(g).transform.slice(0, 40) : null });
    await new Promise(r => setTimeout(r, 90));
  }
  return samples;
});
console.log(' frames:', cross.map(s => `${s.ms}ms ${s.present ? 'ghost ' + s.transform : '-'}`).join('\n         '));
const present = cross.filter(s => s.present);
console.log(' ghost visible from', present[0]?.ms, 'to', present[present.length - 1]?.ms, 'ms;', new Set(present.map(s => s.transform)).size, 'distinct transforms over', present.length, 'frames');

// ---- 3. the completion line ----
console.log('\n=== does she ever see "Everyone made it!"? ===');
await enter('bridges');
const done = await page.evaluate(async () => {
  const seen = [];
  const p = document.querySelector('.exp-live');
  new MutationObserver(() => seen.push({ ms: Math.round(performance.now()), t: p.textContent })).observe(p, { subtree: true, childList: true, characterData: true });
  for (let i = 0; i < 8; i++) { window.__expeditionPuzzle.try(i); await new Promise(r => setTimeout(r, 950)); }
  await new Promise(r => setTimeout(r, 300));
  return { seen: seen.slice(-5), final: p.textContent };
});
console.log(' last live lines:', JSON.stringify(done.seen));
console.log(' final live line:', JSON.stringify(done.final));
await page.screenshot({ path: `${SHOTS}/bridges-complete.png` });
await page.waitForTimeout(1200);

// ---- 4. tier 4 shapes ----
console.log('\n=== tier 4 shapes ===');
for (const n of ['picnic', 'hotel']) {
  await enter(n);
  const s = await page.evaluate(() => ({ rule: window.__expeditionPuzzle.ruleText(), rules: (window.__expeditionPuzzle.rules() || []).map(r => r && r.text), progress: document.querySelector('.exp-progress')?.textContent, budget: document.querySelector('.exp-budget')?.textContent, plates: document.querySelectorAll('.picnic-plate').length, floors: document.querySelectorAll('.hotel-floor').length }));
  console.log(` ${n} t4:`, JSON.stringify(s));
  await page.screenshot({ path: `${SHOTS}/t4-${n}.png` });
}

// ---- 5. dead air: nothing tappable / nothing moving ----
console.log('\n=== dead air on entry ===');
await enter('raft');
const dead = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.screen.exp-puzzle button')].filter(b => !b.disabled);
  const anim = [...document.querySelectorAll('.screen.exp-puzzle *')].filter(e => { const a = getComputedStyle(e); return a.animationName !== 'none' || a.transitionDuration !== '0s'; }).length;
  return { tappableAtMount: btns.length, animatedElements: anim };
});
console.log(' ', JSON.stringify(dead));

console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
