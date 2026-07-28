// shoot-y5geo.mjs — resting geometry, drag lift, flight endpoint vs the mouth, at 3 widths. Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const b = await launch();
const SIZES = [[1024, 768], [768, 1024], [390, 844]];
const CATS = (process.env.CATS || 'oddEven,compare50,twoRule,shapeSides').split(',');

for (const CAT of CATS) {
  for (const [W, H] of SIZES) {
    const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: W, h: H });
    await page.waitForTimeout(1300);
    const g = await page.evaluate(() => {
      const it = document.querySelector('.food-item');
      const ir = it.getBoundingClientRect();
      const fs = [...document.querySelectorAll('.feeder')].map(e => {
        const r = e.getBoundingClientRect();
        const boo = e.querySelector('.feeder-boo').getBoundingClientRect();
        return { b: e.dataset.bucket, cx: r.x + r.width / 2, cy: r.y + r.height / 2, boocx: boo.x + boo.width / 2, boocy: boo.y + boo.height / 2, booh: boo.height };
      });
      return { restTf: getComputedStyle(it).transform, src: { cx: ir.x + ir.width / 2, cy: ir.y + ir.height / 2, w: ir.width, h: ir.height }, fs, vw: innerWidth, vh: innerHeight, buckets: window.__feedboos.buckets(), rule: window.__feedboos.rule() };
    });
    const worst = g.fs.map(f => Math.hypot(f.boocx - g.src.cx, f.boocy - g.src.cy)).sort((a, b) => b - a)[0];
    const worstDx = g.fs.map(f => Math.abs(f.boocx - g.src.cx)).sort((a, b) => b - a)[0];
    console.log(`${CAT} ${W}x${H} feeders=${g.fs.length} restTf=${g.restTf} item(${Math.round(g.src.cx)},${Math.round(g.src.cy)}) ${Math.round(g.src.w)}x${Math.round(g.src.h)}`);
    console.log(`   mouths: ${g.fs.map(f => `${f.b}@(${Math.round(f.boocx)},${Math.round(f.boocy)})`).join(' ')} | worst dx=${Math.round(worstDx)} (${(worstDx / g.vw * 100).toFixed(1)}%vw) worst dist=${Math.round(worst)} (${(worst / g.vw * 100).toFixed(1)}%vw) ${worstDx / g.vw <= 0.4 ? 'OK<=40%' : 'OVER 40%'}`);
    // drag lift at zero movement
    await page.mouse.move(g.src.cx, g.src.cy); await page.mouse.down(); await page.waitForTimeout(90);
    const lift = await page.evaluate(() => { const e = document.querySelector('.food-item'); const r = e.getBoundingClientRect(); return { cy: r.y + r.height / 2, tf: getComputedStyle(e).transform }; });
    console.log(`   drag lift at zero move: item centre ${Math.round(lift.cy)} vs finger ${Math.round(g.src.cy)} => ${Math.round(lift.cy - g.src.cy)}px  ${lift.tf}`);
    await page.mouse.move(g.src.cx, g.src.cy - 30); await page.waitForTimeout(50);
    await page.screenshot({ path: `${SHOTS}/GEO-${CAT}-${W}.png` });
    await page.mouse.up();
    await page.waitForTimeout(1600);
    if (errors.length) console.log('   ERRORS', errors);
    await ctx.close();
  }
}
await b.close();
