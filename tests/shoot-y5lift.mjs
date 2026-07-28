// shoot-y5lift.mjs — drag lift + drag-path vanish point at 3 widths, both feeders. Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const b = await launch();
for (const [W, H] of [[1024, 768], [768, 1024], [390, 844]]) {
  for (const CAT of ['oddEven', 'shapeSides']) {
    const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: W, h: H });
    await page.waitForTimeout(1300);
    const g = await page.evaluate(() => {
      const ir = document.querySelector('.food-item').getBoundingClientRect();
      const fs = [...document.querySelectorAll('.feeder')].map(e => { const r = e.getBoundingClientRect(); const bo = e.querySelector('.feeder-boo').getBoundingClientRect(); return { b: +e.dataset.bucket, cx: r.x + r.width / 2, cy: r.y + r.height / 2, mx: Math.round(bo.x + bo.width / 2), my: Math.round(bo.y + bo.height * 0.62) }; });
      return { src: { cx: ir.x + ir.width / 2, cy: ir.y + ir.height / 2 }, fs, want: window.__feedboos.itemBuckets()[window.__feedboos.state().idx] };
    });
    const t = g.fs.find(f => f.b === g.want);
    await page.mouse.move(g.src.cx, g.src.cy); await page.mouse.down();
    await page.mouse.move(g.src.cx + 1, g.src.cy); await page.waitForTimeout(60);
    const lift = await page.evaluate(() => { const r = document.querySelector('.food-item').getBoundingClientRect(); return Math.round(r.y + r.height / 2); });
    // now drag to the correct mouth and see where the card sits
    await page.mouse.move(t.cx, t.cy); await page.waitForTimeout(80);
    const atTarget = await page.evaluate(() => { const r = document.querySelector('.food-item').getBoundingClientRect(); return { cy: Math.round(r.y + r.height / 2), top: Math.round(r.y), bot: Math.round(r.y + r.height) }; });
    await page.screenshot({ path: `${SHOTS}/LIFT-${CAT}-${W}.png` });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const end = await page.evaluate(() => { const e = document.querySelector('.food-item'); if (!e) return null; const r = e.getBoundingClientRect(); return { c: e.className, cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; });
    console.log(`${CAT} ${W}x${H}: finger ${Math.round(g.src.cy)} -> card centre ${lift} (lift ${lift - Math.round(g.src.cy)}px) | at mouth(${t.mx},${t.my}) card top=${atTarget.top} bot=${atTarget.bot} ${atTarget.bot < 0 ? 'FULLY OFF-SCREEN' : atTarget.top < 76 ? 'partly behind topbar/off-screen' : 'visible'} | end ${end ? end.cx + ',' + end.cy : 'gone'}`);
    if (errors.length) console.log('  ERR', errors);
    await ctx.close();
  }
}
await b.close();
