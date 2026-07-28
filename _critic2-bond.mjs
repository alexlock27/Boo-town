import { openApp, mkSave } from './_critic2-lib.mjs';
const save = mkSave({ expedition: { tiers: {}, progress: { bridges: 3, picnic: 3, raft: 3 } } });
const { browser, page, errors } = await openApp({ width: 1024, height: 768 }, save);
await page.evaluate(() => window.BooTown.go('expeditionpuzzle', { node: 'hotel' }));
await page.waitForSelector('.exp-puzzle .exp-puzzle-board button');
await page.evaluate(async () => { for (let i = 0; i < 8; i++) { window.__expeditionPuzzle.try(i); await new Promise(r => setTimeout(r, 100)); } });
await page.waitForTimeout(2500);
const r = await page.evaluate(async () => {
  const st = await import('/js/state.js');
  return { live: JSON.parse(JSON.stringify(st.getState().care || {})), ls: JSON.parse(localStorage.getItem('bootown.save.v1')).care };
});
console.log('live state care:', JSON.stringify(r.live));
console.log('localStorage care:', JSON.stringify(r.ls));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
