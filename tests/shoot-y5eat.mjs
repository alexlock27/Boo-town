// shoot-y5eat.mjs — does a correct sort READ as the Boo eating it? Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const CAT = process.env.CAT || 'oddEven';
const W = +(process.env.W || 1024), H = +(process.env.H || 768);
const RM = process.env.RM === '1';
const b = await launch();
const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: W, h: H, reduced: RM });
await page.waitForTimeout(1400);

const probe = () => page.evaluate(() => {
  const f = window.__feedboos || {};
  const q = k => { try { return f[k] ? f[k]() : null; } catch (e) { return 'ERR'; } };
  const item = document.querySelector('.food-item');
  const boos = [...document.querySelectorAll('.feeder-boo')].map(e => {
    const r = e.getBoundingClientRect();
    return { cls: e.className, t: getComputedStyle(e).transform, y: Math.round(r.y * 10) / 10, h: Math.round(r.height * 10) / 10 };
  });
  const ir = item && item.getBoundingClientRect();
  return {
    t: performance.now(),
    mouths: q('mouths'), puffing: q('puffing'), bouncing: q('bouncing'), arcing: q('arcing'),
    chewing: q('chewing'), lastReaction: q('lastReaction'), idx: (q('state') || {}).idx,
    item: item ? { cls: item.className, t: getComputedStyle(item).transform, op: getComputedStyle(item).opacity, x: Math.round(ir.x), y: Math.round(ir.y), w: Math.round(ir.width * 10) / 10 } : null,
    boos, text: document.getElementById('screen').innerText.replace(/\n/g, ' | ').slice(0, 200)
  };
});

const st = await page.evaluate(() => { const f = window.__feedboos; return { ib: f.itemBuckets(), s: f.state(), buckets: f.buckets() }; });
const want = st.ib[st.s.idx];
console.log('CAT', CAT, W + 'x' + H, 'RM', RM, '| item bucket wanted:', want, st.buckets);

const geo = await page.evaluate(() => {
  const it = document.querySelector('.food-item').getBoundingClientRect();
  const fs = [...document.querySelectorAll('.feeder')].map(e => { const r = e.getBoundingClientRect(); return { b: e.dataset.bucket, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; });
  return { src: { cx: it.x + it.width / 2, cy: it.y + it.height / 2 }, fs, vw: innerWidth, vh: innerHeight };
});
console.log('DISTANCE CHECK vw=' + geo.vw + ':', geo.fs.map(f => {
  const dx = Math.abs(f.cx - geo.src.cx), dy = Math.abs(f.cy - geo.src.cy);
  return `feeder${f.b}: dx=${Math.round(dx)} (${(dx / geo.vw * 100).toFixed(1)}%vw) dist=${Math.round(Math.hypot(dx, dy))} (${(Math.hypot(dx, dy) / geo.vw * 100).toFixed(1)}%vw)`;
}).join(' · '));

// real drag
const target = geo.fs.find(f => +f.b === want);
const src = geo.src;
const frames = [];
frames.push({ tag: 'pre', ...(await probe()) });
await page.mouse.move(src.cx, src.cy);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(src.cx + (target.cx - src.cx) * i / 8, src.cy + (target.cy - src.cy) * i / 8);
  await page.waitForTimeout(20);
}
const tUp = Date.now();
await page.mouse.up();

// sample fast
const N = 34, GAP = 45;
for (let i = 0; i < N; i++) {
  const p = await probe();
  p.tag = 'f' + i; p.ms = Date.now() - tUp;
  frames.push(p);
  if (i < 22) await page.screenshot({ path: `${SHOTS}/eat-${CAT}-${W}${RM ? '-rm' : ''}-${String(i).padStart(2, '0')}.png`, clip: { x: 0, y: 60, width: W, height: Math.min(420, H - 60) } });
  await page.waitForTimeout(GAP);
}
for (const f of frames) {
  console.log(String(f.ms ?? 0).padStart(5), f.tag.padEnd(4),
    'mouth=' + JSON.stringify(f.mouths), 'puff=' + f.puffing, 'bounce=' + f.bouncing, 'arc=' + f.arcing, 'chew=' + f.chewing,
    'react=' + JSON.stringify(f.lastReaction), 'idx=' + f.idx,
    'item=' + (f.item ? f.item.w + 'w op' + f.item.op + ' @' + f.item.x + ',' + f.item.y + ' ' + f.item.cls.replace('food-item', '') : 'GONE'),
    'boos=' + f.boos.map(x => x.cls.replace('feeder-boo', '').trim() + '|y' + x.y).join(','));
}
console.log('errors:', errors);
await ctx.close(); await b.close();
