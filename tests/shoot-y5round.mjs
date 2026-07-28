// shoot-y5round.mjs — inside a Feed the Boos round. Delete when done.
import { launch, open, firstTappable, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const CAT = process.env.CAT || 'oddEven';
const LVL = +(process.env.LVL || 3);
const W = +(process.env.W || 1024), H = +(process.env.H || 768);
const b = await launch();
const { ctx, page, errors, t0 } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: LVL } }, { w: W, h: H });
const ft = await firstTappable(page, t0);
console.log('CAT', CAT, 'LVL', LVL, W + 'x' + H, '| first tappable ms:', ft);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS}/round-${CAT}-${LVL}-${W}.png` });

const g = async () => page.evaluate(() => {
  const f = window.__feedboos || {};
  const q = k => { try { return f[k] ? f[k]() : 'nohook'; } catch (e) { return 'ERR ' + e.message; } };
  return { state: q('state'), mouths: q('mouths'), rule: q('rule'), rulePulsing: q('rulePulsing'), shifts: q('shifts'), buckets: q('buckets'), itemBuckets: q('itemBuckets'), puffing: q('puffing'), bouncing: q('bouncing'), lastReaction: q('lastReaction') };
});
console.log('hooks:', await page.evaluate(() => Object.keys(window.__feedboos || {})));
console.log('state:', JSON.stringify(await g(), null, 1).slice(0, 3000));
console.log('--- text ---\n' + (await page.evaluate(() => document.getElementById('screen').innerText)).slice(0, 900));
console.log('--- dom ---\n' + await page.evaluate(() => {
  const walk = (el, d = 0) => {
    if (d > 5) return '';
    let s = '';
    for (const c of el.children) {
      if (c.tagName === 'svg' || c.closest('svg')) continue;
      const cls = c.className && typeof c.className === 'string' ? '.' + c.className.trim().split(/\s+/).join('.') : '';
      const r = c.getBoundingClientRect();
      s += '  '.repeat(d) + c.tagName.toLowerCase() + cls + `#${c.id || ''} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}]` +
        (c.dataset && Object.keys(c.dataset).length ? ' data=' + JSON.stringify(c.dataset) : '') +
        (c.children.length ? '' : ' "' + (c.textContent || '').trim().slice(0, 40) + '"') + '\n';
      s += walk(c, d + 1);
    }
    return s;
  };
  return walk(document.getElementById('screen'));
}));
console.log('errors:', errors);
await ctx.close(); await b.close();
