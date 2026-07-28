// shoot-y5drag.mjs — where does the dragged item render vs the finger? Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const W = +(process.env.W || 1024), H = +(process.env.H || 768);
const CAT = process.env.CAT || 'oddEven';
const b = await launch();
const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: W, h: H });
await page.waitForTimeout(1400);

console.log('scroll state:', JSON.stringify(await page.evaluate(() => {
  const out = { winY: window.scrollY, docTop: document.scrollingElement.scrollTop };
  let e = document.querySelector('.food-item');
  const chain = [];
  while (e && e !== document.body) { chain.push({ c: (e.className || '') + '', st: e.scrollTop, sh: e.scrollHeight, ch: e.clientHeight, pos: getComputedStyle(e).position }); e = e.parentElement; }
  out.chain = chain; return out;
})));

const src = await page.evaluate(() => { const r = document.querySelector('.food-item').getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; });
await page.mouse.move(src.cx, src.cy);
await page.mouse.down();
const pts = [[src.cx, src.cy], [src.cx + 40, src.cy], [src.cx + 40, src.cy - 40], [src.cx + 150, src.cy - 100], [src.cx, src.cy + 60]];
for (const [x, y] of pts) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(60);
  const m = await page.evaluate(() => { const e = document.querySelector('.food-item'); const r = e.getBoundingClientRect(); return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), tf: getComputedStyle(e).transform, winY: window.scrollY }; });
  console.log(`cursor(${Math.round(x)},${Math.round(y)}) -> item centre(${m.cx},${m.cy})  offsetY=${m.cy - Math.round(y)}  ${m.tf} scrollY=${m.winY}`);
}
await page.screenshot({ path: `${SHOTS}/DRAGLOW-${W}.png` });
await page.mouse.up();
await page.waitForTimeout(1500);
console.log('errors:', errors);
await ctx.close(); await b.close();
