// shoot-y5confirm.mjs — drag vs hook vanish point, every feeder, every width. Delete when done.
import { launch, open } from './shoot-y56boot.mjs';
const b = await launch();
const rows = [];
for (const [W, H] of [[1024, 768], [768, 1024], [390, 844]]) {
  for (const CAT of ['oddEven', 'shapeSides']) {
    for (const forceB of [0, 1, 2]) {
      const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: W, h: H });
      await page.waitForTimeout(1200);
      const g = await page.evaluate(() => {
        const ir = document.querySelector('.food-item').getBoundingClientRect();
        const fs = [...document.querySelectorAll('.feeder')].map(e => { const r = e.getBoundingClientRect(); const bo = e.querySelector('.feeder-boo').getBoundingClientRect(); return { b: +e.dataset.bucket, cx: r.x + r.width / 2, cy: r.y + r.height / 2, mx: Math.round(bo.x + bo.width / 2), my: Math.round(bo.y + bo.height * 0.62) }; });
        return { src: { cx: ir.x + ir.width / 2, cy: ir.y + ir.height / 2 }, fs, ib: window.__feedboos.itemBuckets() };
      });
      if (forceB >= g.fs.length) { await ctx.close(); continue; }
      // advance until the current item belongs to forceB
      let idx = await page.evaluate(() => window.__feedboos.state().idx);
      let guard = 0;
      while (g.ib[idx] !== forceB && guard++ < 12) { await page.evaluate(() => window.__feedboos.feedCorrect()); await page.waitForTimeout(1300); idx = await page.evaluate(() => window.__feedboos.state().idx); }
      if (g.ib[idx] !== forceB) { await ctx.close(); continue; }
      const t = g.fs.find(f => f.b === forceB);
      await page.evaluate(() => { window.__end = null; const f = window.__feedboos; const tick = () => { const e = document.querySelector('.food-item'); if (e && /gulped/.test(e.className)) { const r = e.getBoundingClientRect(); window.__end = { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      await page.mouse.move(g.src.cx, g.src.cy); await page.mouse.down();
      for (let i = 1; i <= 6; i++) { await page.mouse.move(g.src.cx + (t.cx - g.src.cx) * i / 6, g.src.cy + (t.cy - g.src.cy) * i / 6); await page.waitForTimeout(16); }
      await page.mouse.up(); await page.waitForTimeout(1400);
      const end = await page.evaluate(() => window.__end);
      const d = end ? Math.round(Math.hypot(end.cx - t.mx, end.cy - t.my)) : null;
      rows.push(`${CAT} ${W}x${H} feeder${forceB}: DRAG vanish (${end ? end.cx + ',' + end.cy : '?'}) mouth (${t.mx},${t.my}) => ${d}px off`);
      // now the hook path on the next item of the same bucket, same page
      await page.evaluate(() => { window.__end = null; });
      const nidx = await page.evaluate(() => window.__feedboos.state().idx);
      const nb = g.ib[nidx];
      const nt = g.fs.find(f => f.b === nb);
      await page.evaluate(() => window.__feedboos.feedCorrect());
      await page.waitForTimeout(1400);
      const end2 = await page.evaluate(() => window.__end);
      const d2 = end2 && nt ? Math.round(Math.hypot(end2.cx - nt.mx, end2.cy - nt.my)) : null;
      rows.push(`${CAT} ${W}x${H} feeder${nb}: HOOK vanish (${end2 ? end2.cx + ',' + end2.cy : '?'}) mouth (${nt ? nt.mx + ',' + nt.my : '?'}) => ${d2}px off`);
      if (errors.length) rows.push('  ERR ' + errors.join('|'));
      await ctx.close();
    }
  }
}
console.log(rows.join('\n'));
await b.close();
