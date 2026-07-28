// shoot-y5misc.mjs — authored rule set, phone layout, reduced motion, idle liveness. Delete when done.
import { launch, open, firstTappable, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const b = await launch();
const allErr = [];

// --- 1. authored two-predicate rule set, sampled ---
{
  const seen = new Map();
  for (let i = 0; i < 24; i++) {
    const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:twoRule', level: 1 + (i % 3) } });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ rule: document.querySelector('.feed-rule').innerText.trim(), buckets: window.__feedboos.buckets(), ib: window.__feedboos.itemBuckets(), items: [...document.querySelectorAll('.food-item')].map(e => e.innerText.trim()) }));
    seen.set(r.rule, (seen.get(r.rule) || 0) + 1);
    allErr.push(...errors);
    await ctx.close();
  }
  console.log('== twoRule authored rules seen in 24 boots ==');
  for (const [k, v] of seen) console.log(`  ${v}x  "${k}"`);
}

// --- 2. phone layout of the wordiest templates ---
for (const CAT of ['twoRule', 'shapeSides', 'compare50']) {
  const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: 3 } }, { w: 390, h: 844 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/P390-${CAT}.png` });
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const over = [...document.querySelectorAll('#screen *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className + ' @' + Math.round(e.getBoundingClientRect().left) + '-' + Math.round(e.getBoundingClientRect().right));
    const signs = [...document.querySelectorAll('.signpost')].map(s => { const r = s.getBoundingClientRect(); return `"${s.innerText.trim()}" ${Math.round(r.width)}x${Math.round(r.height)} fs${getComputedStyle(s).fontSize}`; });
    const rule = document.querySelector('.feed-rule'); const rr = rule && rule.getBoundingClientRect();
    return { hScroll: doc.scrollWidth > innerWidth, over: over.slice(0, 8), signs, rule: rule ? `"${rule.innerText.trim()}" ${Math.round(rr.width)}x${Math.round(rr.height)}` : null };
  });
  console.log(`\n== 390x844 ${CAT} ==`, JSON.stringify(m, null, 1));
  allErr.push(...errors);
  await ctx.close();
}

// --- 3. reduced motion eat ---
{
  const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:oddEven', level: 3 } }, { reduced: true });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__rec = []; const f = window.__feedboos; const t0 = performance.now();
    const tick = () => { const e = document.querySelector('.food-item'); const r = e && e.getBoundingClientRect(); window.__rec.push({ t: Math.round(performance.now() - t0), m: f.mouths().join('/'), p: f.puffing(), bo: f.bouncing(), a: f.arcing(), i: e ? e.className + '(' + Math.round(r.x + r.width / 2) + ',' + Math.round(r.y + r.height / 2) + ')' : 'GONE' }); if (window.__rec.length < 140) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  });
  await page.evaluate(() => window.__feedboos.feedCorrect());
  await page.waitForTimeout(2200);
  let prev = ''; console.log('\n== reduced motion, feedCorrect ==');
  for (const r of await page.evaluate(() => window.__rec)) { const s = `${r.m} p${+r.p} b${+r.bo} a${+r.a} ${r.i}`; if (s !== prev) { console.log('  ' + String(r.t).padStart(5) + ' ' + s); prev = s; } }
  await page.screenshot({ path: `${SHOTS}/RM-after.png` });
  allErr.push(...errors); await ctx.close();
}

// --- 4. idle liveness: 30s doing nothing ---
{
  const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:oddEven', level: 3 } });
  await page.waitForTimeout(1200);
  const shots = [];
  for (let i = 0; i < 11; i++) { shots.push(await page.screenshot({ path: `${SHOTS}/IDLE-${String(i).padStart(2, '0')}.png` })); if (i < 10) await page.waitForTimeout(3000); }
  const same = shots.map((s, i) => i === 0 ? '-' : (Buffer.compare(s, shots[i - 1]) === 0 ? 'SAME' : 'diff'));
  console.log('\n== idle 30s, frame vs previous (3s apart) ==', same.join(' '));
  const guide = await page.evaluate(() => (document.querySelector('.peek-bubble') || {}).innerText);
  console.log('  guide bubble after 30s idle:', JSON.stringify(guide));
  allErr.push(...errors); await ctx.close();
}

// --- 5. cold entry the child's way: picker -> level -> round ---
{
  const { ctx, page, errors, t0 } = await open(b, 'feedboos', {});
  const ft = await firstTappable(page, t0);
  await page.waitForTimeout(400);
  const t1 = Date.now();
  await page.evaluate(() => [...document.querySelectorAll('.picker-choice')].find(b => /Odd & even/.test(b.innerText)).click());
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelectorAll('.level-btn')[0].click());
  await page.waitForFunction(() => !!document.querySelector('.food-item'), null, { timeout: 12000 });
  console.log('\n== cold path ==  first tappable', ft, 'ms | picker->first food item', Date.now() - t1, 'ms');
  await page.screenshot({ path: `${SHOTS}/COLD-round.png` });
  allErr.push(...errors); await ctx.close();
}
console.log('\nALL ERRORS:', allErr);
await b.close();
