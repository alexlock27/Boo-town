// PROBE 6 — contrast law, 56px tap targets, four viewports, tier-4 shapes, completion line.
import { openApp, SHOTS, mkSave, contrastAudit, tapTargets, overflow } from './_critic2-lib.mjs';

const VPS = [
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '844x390', width: 844, height: 390 }
];
const NODES = ['bridges', 'picnic', 'raft', 'hotel'];
const TIER = { picnic: 4, hotel: 4 };
const tierMode = process.argv[2] === 'tier4';

const save = mkSave({ expedition: { tiers: tierMode ? TIER : {}, progress: {} } });
let allErrors = [];

for (const vp of VPS) {
  const { browser, page, errors } = await openApp(vp, save);
  for (const node of NODES) {
    if (tierMode && !TIER[node]) continue;
    await page.evaluate(n => window.BooTown.go('expeditionpuzzle', { node: n }), node);
    await page.waitForSelector('.exp-puzzle .exp-puzzle-board button');
    await page.waitForTimeout(250);
    const tag = `${node}${tierMode ? '-t4' : ''}-${vp.name}`;
    await page.screenshot({ path: `${SHOTS}/vp-${tag}.png` });

    const ca = await contrastAudit(page, '.screen.exp-puzzle');
    const bad = ca.filter(r => !r.pass);
    const tt = await tapTargets(page, '.screen.exp-puzzle');
    const small = tt.filter(t => t.h < 56 || t.w < 56);
    const of = await overflow(page);
    const clip = await page.evaluate(() => {
      const out = [];
      const wr = document.querySelector('.exp-puzzle-wrap');
      const bd = document.querySelector('.exp-puzzle-board');
      if (bd) { const b = bd.getBoundingClientRect(); out.push({ what: 'board', visibleH: Math.round(b.height), scrollH: bd.scrollHeight, clipped: bd.scrollHeight > b.height + 2 }); }
      // anything with real content pushed below the viewport bottom and NOT inside a scroller
      const foot = document.querySelector('.exp-puzzle-foot');
      if (foot) { const b = foot.getBoundingClientRect(); out.push({ what: 'hint foot', bottom: Math.round(b.bottom), innerH: innerHeight, offscreen: b.bottom > innerHeight + 1 }); }
      const back = document.querySelector('.back-control, .back-btn, [class*=back]');
      if (back) { const b = back.getBoundingClientRect(); out.push({ what: 'back ' + back.className, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }); }
      const h2 = document.querySelector('.exp-puzzle h2');
      if (h2) { const b = h2.getBoundingClientRect(); out.push({ what: 'h2', y: Math.round(b.y), h: Math.round(b.height) }); }
      return out;
    });
    console.log(`\n[${tag}]`);
    if (bad.length) bad.forEach(r => console.log(`  CONTRAST FAIL ${r.ratio} (need ${r.need}) fg=${r.fg} bg=rgb(${r.bg}) ${r.fontPx}px/${r.weight} "${r.text}"  @ ${r.path}`));
    else console.log(`  contrast: ${ca.length} text runs, all pass (min ${Math.min(...ca.map(r => r.ratio))})`);
    if (small.length) small.forEach(t => console.log(`  TAP FAIL ${t.w}x${t.h} <${t.tag} class="${t.cls}"> "${t.label}"`));
    else console.log(`  tap targets: ${tt.length} controls, all >=56px`);
    console.log('  overflow:', JSON.stringify(of));
    console.log('  layout :', JSON.stringify(clip));
  }
  allErrors = allErrors.concat(errors);
  await browser.close();
}
console.log('\nCONSOLE ERRORS ACROSS ALL VIEWPORTS:', allErrors.length ? allErrors : 'none');
