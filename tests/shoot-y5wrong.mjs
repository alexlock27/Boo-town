// shoot-y5wrong.mjs — wrong feed by real drag; head-turn, item return, feedback timing. Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const W = +(process.env.W || 1024), H = +(process.env.H || 768);
const CAT = process.env.CAT || 'oddEven';
const RM = process.env.RM === '1';
const b = await launch();
const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: W, h: H, reduced: RM });
await page.waitForTimeout(1300);
const g = await page.evaluate(() => {
  const ir = document.querySelector('.food-item').getBoundingClientRect();
  const fs = [...document.querySelectorAll('.feeder')].map(e => { const r = e.getBoundingClientRect(); return { b: +e.dataset.bucket, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; });
  return { src: { cx: ir.x + ir.width / 2, cy: ir.y + ir.height / 2 }, fs, want: window.__feedboos.itemBuckets()[window.__feedboos.state().idx], val: document.querySelector('.food-item').innerText.trim() };
});
const bad = g.fs.find(f => f.b !== g.want);
console.log(`item "${g.val}" belongs in bucket ${g.want}; dropping on bucket ${bad.b}`);
await page.evaluate(() => {
  window.__rec = []; const f = window.__feedboos; const t0 = performance.now();
  const tick = () => {
    const e = document.querySelector('.food-item'); const r = e && e.getBoundingClientRect();
    const boos = [...document.querySelectorAll('.feeder-boo')].map(x => x.className.replace('feeder-boo', '').trim() + ':' + getComputedStyle(x).transform.slice(0, 40));
    window.__rec.push({ t: Math.round(performance.now() - t0), m: f.mouths().join('/'), react: JSON.stringify(f.lastReaction()), st: JSON.stringify(f.state()), boos, txt: (document.querySelector('.guide-peek, .peek-bubble') || {}).innerText || document.getElementById('screen').innerText.replace(/\n/g, '|').slice(0, 160), item: e ? { c: e.className, cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), op: +getComputedStyle(e).opacity.slice(0, 4) } : null });
    if (window.__rec.length < 220) requestAnimationFrame(tick);
  }; requestAnimationFrame(tick);
});
await page.mouse.move(g.src.cx, g.src.cy); await page.mouse.down();
for (let i = 1; i <= 6; i++) { await page.mouse.move(g.src.cx + (bad.cx - g.src.cx) * i / 6, g.src.cy + (bad.cy - g.src.cy) * i / 6); await page.waitForTimeout(16); }
const tUp = Date.now();
await page.mouse.up();
for (let i = 0; i < 8; i++) { await page.screenshot({ path: `${SHOTS}/WRONG-${CAT}-${W}${RM ? '-rm' : ''}-${i}.png` }); }
await page.waitForTimeout(2500);
const rec = await page.evaluate(() => window.__rec);
let prev = '';
for (const r of rec) {
  const s = `${r.m} react=${r.react} boos=[${r.boos.join(' , ')}] ${r.item ? r.item.c.replace('food-item', 'I') + '(' + r.item.cx + ',' + r.item.cy + ')op' + r.item.op : 'GONE'} st=${r.st}`;
  if (s !== prev) { console.log(String(r.t).padStart(5) + ' ' + s); prev = s; }
}
console.log('--- final text ---\n' + (await page.evaluate(() => document.getElementById('screen').innerText)).replace(/\n+/g, ' | '));
console.log('errors:', errors);
await ctx.close(); await b.close();
