// shoot-y5frames.mjs — full-viewport frames through drag + flight. Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const CAT = process.env.CAT || 'oddEven';
const TAG = process.env.TAG || CAT;
const W = +(process.env.W || 1024), H = +(process.env.H || 768);
const RM = process.env.RM === '1';
const b = await launch();
const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: W, h: H, reduced: RM });
await page.waitForTimeout(1400);
const geo = await page.evaluate(() => {
  const it = document.querySelector('.food-item').getBoundingClientRect();
  const fs = [...document.querySelectorAll('.feeder')].map(e => { const r = e.getBoundingClientRect(); return { b: e.dataset.bucket, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; });
  return { src: { cx: it.x + it.width / 2, cy: it.y + it.height / 2 }, fs };
});
const st = await page.evaluate(() => ({ ib: window.__feedboos.itemBuckets(), s: window.__feedboos.state() }));
const target = geo.fs.find(f => +f.b === st.ib[st.s.idx]);
console.log('drop target feeder', target.b, 'at', Math.round(target.cx), Math.round(target.cy), '| src', Math.round(geo.src.cx), Math.round(geo.src.cy));

await page.mouse.move(geo.src.cx, geo.src.cy);
await page.mouse.down();
for (let i = 1; i <= 5; i++) { await page.mouse.move(geo.src.cx + (target.cx - geo.src.cx) * i / 5, geo.src.cy + (target.cy - geo.src.cy) * i / 5); await page.waitForTimeout(14); }
await page.waitForTimeout(120);
await page.screenshot({ path: `${SHOTS}/DRAG-${TAG}-${W}${RM ? '-rm' : ''}.png` });
const midDrag = await page.evaluate(() => { const e = document.querySelector('.food-item'); const r = e.getBoundingClientRect(); return { cls: e.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), pos: getComputedStyle(e).position, tf: getComputedStyle(e).transform }; });
console.log('mid-drag item:', JSON.stringify(midDrag), '| cursor at', Math.round(target.cx), Math.round(target.cy));
const t0 = Date.now();
await page.mouse.up();
for (let i = 0; i < 12; i++) {
  const before = Date.now() - t0;
  const s = await page.evaluate(() => {
    const f = window.__feedboos; const e = document.querySelector('.food-item');
    const r = e && e.getBoundingClientRect();
    return { m: f.mouths(), p: f.puffing(), bo: f.bouncing(), a: f.arcing(), item: e ? { c: e.className, cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), w: Math.round(r.width) } : null };
  });
  await page.screenshot({ path: `${SHOTS}/FLY-${TAG}-${W}${RM ? '-rm' : ''}-${String(i).padStart(2, '0')}.png` });
  console.log(String(before).padStart(5), JSON.stringify(s));
}
console.log('errors:', errors);
await ctx.close(); await b.close();
