// shoot-y5explore.mjs — cold look at Feed the Boos. Delete when done.
import { launch, open, firstTappable, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const b = await launch();

const { ctx, page, errors, t0 } = await open(b, 'feedboos');
const ft = await firstTappable(page, t0);
console.log('first tappable ms:', ft);
await page.waitForTimeout(1200);
await page.screenshot({ path: SHOTS + '/00-cold-1024.png' });

console.log('--- hooks present ---');
console.log(await page.evaluate(() => Object.keys(window.__feedboos || {})));
console.log('--- state ---');
console.log(JSON.stringify(await page.evaluate(() => {
  const f = window.__feedboos || {};
  const g = k => { try { return f[k](); } catch (e) { return 'ERR ' + e.message; } };
  return { state: g('state'), mouths: g('mouths'), rule: g('rule'), rulePulsing: g('rulePulsing'), shifts: g('shifts'), buckets: g('buckets'), itemBuckets: g('itemBuckets'), puffing: g('puffing'), bouncing: g('bouncing'), lastReaction: g('lastReaction'), feedCorrect: typeof f.feedCorrect, feedWrong: typeof f.feedWrong };
}), null, 1).slice(0, 4000));

console.log('--- screen text ---');
console.log((await page.evaluate(() => document.getElementById('screen').innerText)).slice(0, 1500));

console.log('--- dom skeleton ---');
console.log(await page.evaluate(() => {
  const walk = (el, d = 0) => {
    if (d > 4) return '';
    let s = '';
    for (const c of el.children) {
      const cls = c.className && typeof c.className === 'string' ? '.' + c.className.trim().split(/\s+/).join('.') : '';
      const r = c.getBoundingClientRect();
      s += '  '.repeat(d) + c.tagName.toLowerCase() + cls + ` [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}]` + (c.children.length ? '' : ' "' + (c.textContent || '').trim().slice(0, 30) + '"') + '\n';
      s += walk(c, d + 1);
    }
    return s;
  };
  return walk(document.getElementById('screen'));
}));

console.log('errors:', errors);
await ctx.close();
await b.close();
