import { openApp, SHOTS, mkSave } from './_critic2-lib.mjs';
for (const vp of [{width:1024,height:768,name:'1024x768'},{width:390,height:844,name:'390x844'}]) {
  const save = mkSave({ expedition: { tiers: {}, progress: { bridges: 3, picnic: 3, raft: 3 } } });
  const { browser, page, errors } = await openApp(vp, save);
  await page.evaluate(() => window.BooTown.go('expeditionpuzzle', { node: 'hotel' }));
  await page.waitForSelector('.exp-puzzle .exp-puzzle-board button');
  await page.evaluate(async () => { for (let i = 0; i < 8; i++) { window.__expeditionPuzzle.try(i); await new Promise(r => setTimeout(r, 100)); } });
  await page.waitForTimeout(1800);
  await page.click('.exp-postcard-done');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.screen *')].filter(e => (e.textContent||'').trim() === 'The whole trail is glowing with stars!' && e.children.length === 0);
    return all.map(e => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { cls: e.className, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), innerH: innerHeight, inView: b.top < innerHeight && b.bottom > 0, color: cs.color, fontSize: cs.fontSize, docScrollTop: document.scrollingElement.scrollTop, docScrollH: document.scrollingElement.scrollHeight }; });
  });
  console.log(vp.name, JSON.stringify(r));
  await page.screenshot({ path: `${SHOTS}/trail-glowline-${vp.name}.png`, fullPage: false });
  console.log(' errors:', errors.length ? errors : 'none');
  await browser.close();
}
