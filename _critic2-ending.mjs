// PROBE 5 — C4, the postcard ceremony. Timings, copy, bond announcement, the return.
import { openApp, SHOTS, mkSave } from './_critic2-lib.mjs';
import { contrastAudit, tapTargets, overflow } from './_critic2-lib.mjs';

const save = mkSave({ expedition: { tiers: {}, progress: { bridges: 3, picnic: 3, raft: 3 } } });
const { browser, page, errors } = await openApp({ width: 1024, height: 768 }, save);

await page.evaluate(() => window.BooTown.go('expeditionpuzzle', { node: 'hotel' }));
await page.waitForSelector('.exp-puzzle .exp-puzzle-board button');
const bondsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')).care?.bonds || {});

await page.evaluate(() => { window.__t0 = performance.now(); window.__marks = []; });
await page.evaluate(async () => { for (let i = 0; i < 8; i++) { window.__expeditionPuzzle.try(i); await new Promise(r => setTimeout(r, 100)); } });

// watch for the overlay appearing
const appear = await page.evaluate(() => new Promise(res => {
  const t = performance.now();
  const check = () => { const o = document.querySelector('.exp-postcard-overlay'); if (o) res(performance.now() - t); else if (performance.now() - t > 6000) res(null); else requestAnimationFrame(check); };
  check();
}));
console.log('ceremony overlay appeared after last correct move:', appear === null ? 'NEVER' : Math.round(appear) + 'ms');
await page.waitForTimeout(120);
await page.screenshot({ path: `${SHOTS}/ending-01-arriving.png` });

// slide-up / sparkle timing from the live computed styles
const anim = await page.evaluate(() => {
  const card = document.querySelector('.exp-postcard-card');
  const cs = getComputedStyle(card);
  const sp = getComputedStyle(document.querySelector('.exp-postcard-sparkle'), '::after');
  return { cardTransition: cs.transitionDuration + ' / ' + cs.transitionProperty, sparkleAnim: sp.animationName + ' ' + sp.animationDuration + ' delay ' + sp.animationDelay, transform: cs.transform };
});
console.log('slide-up  :', anim.cardTransition);
console.log('sparkle   :', anim.sparkleAnim);

await page.waitForTimeout(1400);
const c = await page.evaluate(() => ({
  shown: window.__expeditionEnding.shown(),
  title: document.querySelector('.exp-postcard-title')?.textContent,
  bond: window.__expeditionEnding.bondLine(),
  guide: window.__expeditionEnding.guideLine(),
  bonds: window.__expeditionEnding.bonds(),
  buttons: [...document.querySelectorAll('.exp-postcard-btns .btn')].map(b => ({ label: b.textContent, cls: b.className, disabled: b.disabled, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })),
  bondNodes: document.querySelectorAll('.exp-postcard-bond').length,
  imgPresent: !!document.querySelector('.exp-postcard-img'),
  fallback: document.querySelector('.exp-postcard-fallback')?.textContent || null,
  imgSize: (() => { const i = document.querySelector('.exp-postcard-img'); return i ? Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height) : null; })(),
  toasts: [...document.querySelectorAll('.toast, .bond-toast, .care-toast')].map(t => t.textContent)
}));
console.log('\n--- the ceremony ---');
console.log(JSON.stringify(c, null, 1));
await page.screenshot({ path: `${SHOTS}/ending-02-full.png` });

// bonds actually banked?
const bondsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')).care?.bonds || {});
console.log('bonds before:', JSON.stringify(bondsBefore));
console.log('bonds after :', JSON.stringify(bondsAfter));

// contrast + tap targets on the ceremony
const ca = await contrastAudit(page, '.exp-postcard-card');
console.log('\ncontrast on the ceremony card:');
ca.forEach(r => console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.ratio} (need ${r.need}) fg=${r.fg} bg=rgb(${r.bg}) ${r.fontPx}px/${r.weight} "${r.text}"`));
const tt = await tapTargets(page, '.exp-postcard-overlay');
console.log('tap targets:', JSON.stringify(tt));
console.log('overflow:', JSON.stringify(await overflow(page)));

// press KEEP
await page.click('.exp-postcard-keep');
await page.waitForTimeout(400);
console.log('\nafter [Keep it in the Journal]:', JSON.stringify(await page.evaluate(() => ({ label: document.querySelector('.exp-postcard-keep').textContent, disabled: document.querySelector('.exp-postcard-keep').disabled, stillShown: window.__expeditionEnding.shown() }))));
await page.screenshot({ path: `${SHOTS}/ending-03-kept.png` });

// press DONE -> the trail
await page.click('.exp-postcard-done');
await page.waitForTimeout(1600);
const trail = await page.evaluate(() => ({
  screen: document.querySelector('.screen')?.className,
  bodyText: (document.querySelector('.screen')?.innerText || '').slice(0, 400),
  glowLine: (document.body.innerText.match(/The whole trail is glowing with stars!/) || [null])[0],
  stars: document.querySelectorAll('.trail-node .tn-star, .trail-star, [class*=star]').length,
  overlayGone: !document.querySelector('.exp-postcard-overlay')
}));
console.log('\n--- after [Done] ---');
console.log(JSON.stringify(trail, null, 1));
await page.screenshot({ path: `${SHOTS}/ending-04-trail.png`, fullPage: false });

console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
