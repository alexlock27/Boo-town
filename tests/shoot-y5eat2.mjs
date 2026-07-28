// shoot-y5eat2.mjs — rAF-precise capture of the eat choreography + full frames. Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const CAT = process.env.CAT || 'oddEven';
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

// start in-page rAF recorder
await page.evaluate(() => {
  window.__rec = [];
  const f = window.__feedboos;
  const t0 = performance.now();
  const tick = () => {
    const nodes = [...document.querySelectorAll('.food-item, .feed-fly, [class*="fly"]')].map(e => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { c: e.className, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), op: +cs.opacity.slice(0, 4), tf: cs.transform.slice(0, 60) };
    });
    const boos = [...document.querySelectorAll('.feeder-boo')].map(e => {
      const r = e.getBoundingClientRect(); return { c: e.className, cy: Math.round(r.y * 10) / 10, tf: getComputedStyle(e).transform.slice(0, 60) };
    });
    window.__rec.push({ t: Math.round(performance.now() - t0), mouths: f.mouths(), puff: f.puffing(), bounce: f.bouncing(), arc: f.arcing(), chew: f.chewing(), react: f.lastReaction(), idx: f.state().idx, nodes, boos });
    if (window.__rec.length < 130) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

await page.mouse.move(geo.src.cx, geo.src.cy);
await page.mouse.down();
for (let i = 1; i <= 6; i++) { await page.mouse.move(geo.src.cx + (target.cx - geo.src.cx) * i / 6, geo.src.cy + (target.cy - geo.src.cy) * i / 6); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(2400);

const rec = await page.evaluate(() => window.__rec);
let prev = '';
for (const r of rec) {
  const line = `mouth=${r.mouths.join('/')} puff=${r.puff} bounce=${r.bounce} arc=${r.arc} chew=${r.chew} react=${JSON.stringify(r.react)} idx=${r.idx} boos=${r.boos.map(x => x.c.replace('feeder-boo', '').trim() + '@' + x.cy + ' ' + x.tf).join(' , ')} nodes=${r.nodes.map(n => `[${n.c.replace('food-item', 'ITEM')} c(${n.x},${n.y}) w${n.w} op${n.op}]`).join('')}`;
  if (line !== prev) { console.log(String(r.t).padStart(5) + ' ' + line); prev = line; }
}
console.log('errors:', errors);
await ctx.close(); await b.close();
