// shoot-y5path.mjs — compare feed paths: hook feedCorrect() vs tap-feeder vs real drag. Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const W = +(process.env.W || 1024), H = +(process.env.H || 768);
const CAT = process.env.CAT || 'oddEven';
const b = await launch();

async function trace(mode) {
  const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: W, h: H });
  await page.waitForTimeout(1300);
  const g = await page.evaluate(() => {
    const ir = document.querySelector('.food-item').getBoundingClientRect();
    const fs = [...document.querySelectorAll('.feeder')].map(e => {
      const r = e.getBoundingClientRect(); const boo = e.querySelector('.feeder-boo').getBoundingClientRect();
      return { b: +e.dataset.bucket, cx: r.x + r.width / 2, cy: r.y + r.height / 2, mx: boo.x + boo.width / 2, my: boo.y + boo.height * 0.62 };
    });
    return { src: { cx: ir.x + ir.width / 2, cy: ir.y + ir.height / 2 }, fs, want: window.__feedboos.itemBuckets()[window.__feedboos.state().idx] };
  });
  const t = g.fs.find(f => f.b === g.want);
  await page.evaluate(() => {
    window.__rec = []; const f = window.__feedboos; const t0 = performance.now();
    const tick = () => {
      const e = document.querySelector('.food-item'); const r = e && e.getBoundingClientRect();
      window.__rec.push({ t: Math.round(performance.now() - t0), m: f.mouths().join('/'), p: f.puffing(), bo: f.bouncing(), a: f.arcing(), item: e ? { c: e.className, cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), w: Math.round(r.width), op: +getComputedStyle(e).opacity.slice(0, 4) } : null });
      if (window.__rec.length < 150) requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  });
  if (mode === 'hook') await page.evaluate(() => window.__feedboos.feedCorrect());
  else if (mode === 'tap') await page.mouse.click(t.cx, t.cy);
  else {
    await page.mouse.move(g.src.cx, g.src.cy); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(g.src.cx + (t.cx - g.src.cx) * i / 6, g.src.cy + (t.cy - g.src.cy) * i / 6); await page.waitForTimeout(16); }
    await page.mouse.up();
  }
  await page.waitForTimeout(2200);
  const rec = await page.evaluate(() => window.__rec);
  const gulp = rec.filter(r => r.item && /gulped/.test(r.item.c));
  const last = gulp[gulp.length - 1] || (rec.filter(r => r.item)).pop();
  console.log(`\n== ${mode} (${CAT} ${W}x${H}) target mouth (${Math.round(t.mx)},${Math.round(t.my)}) src (${Math.round(g.src.cx)},${Math.round(g.src.cy)})`);
  let prev = '';
  for (const r of rec) {
    const s = `${r.m} p${+r.p} b${+r.bo} a${+r.a} ${r.item ? r.item.c.replace('food-item', 'I') + ' (' + r.item.cx + ',' + r.item.cy + ') w' + r.item.w + ' op' + r.item.op : 'GONE'}`;
    if (s !== prev) { console.log('  ' + String(r.t).padStart(5) + ' ' + s); prev = s; }
  }
  if (last && last.item) console.log(`  >> vanish point (${last.item.cx},${last.item.cy}) vs mouth (${Math.round(t.mx)},${Math.round(t.my)}) => miss dx=${last.item.cx - Math.round(t.mx)} dy=${last.item.cy - Math.round(t.my)} dist=${Math.round(Math.hypot(last.item.cx - t.mx, last.item.cy - t.my))}px`);
  if (errors.length) console.log('  ERRORS', errors);
  await ctx.close();
}
for (const m of (process.env.MODES || 'hook,tap,drag').split(',')) await trace(m);
await b.close();
