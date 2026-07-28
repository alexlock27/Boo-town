// shoot-y5shift.mjs — does the rule MOVING mid-round read? Delete when done.
import { launch, open, makeShots } from './shoot-y56boot.mjs';
const SHOTS = makeShots('screenshots/y5critic');
const W = +(process.env.W || 1024), H = +(process.env.H || 768);
const CAT = process.env.CAT || 'compare50';
const LVL = +(process.env.LVL || 3);
const b = await launch();
const { ctx, page, errors } = await open(b, 'feedboos', { resume: { cat: 't:' + CAT, level: LVL } }, { w: W, h: H });
await page.waitForTimeout(1300);

// watch every mutation of the rule card + signposts + guide bubble
await page.evaluate(() => {
  window.__log = [];
  const t0 = performance.now();
  const snap = () => {
    const rc = document.querySelector('.feed-rule');
    const gb = document.querySelector('.peek-bubble, .guide-bubble, .gb-text');
    return {
      t: Math.round(performance.now() - t0),
      rule: rc ? rc.innerText.trim() : null,
      ruleCls: rc ? rc.className : null,
      rulePulse: window.__feedboos.rulePulsing(),
      shifts: window.__feedboos.shifts(),
      buckets: window.__feedboos.buckets().join(' / '),
      signs: [...document.querySelectorAll('.signpost')].map(s => s.innerText.trim()).join(' / '),
      idx: window.__feedboos.state().idx,
      item: (document.querySelector('.food-item') || {}).innerText,
      guide: gb ? gb.innerText.trim() : '',
      ruleBox: rc ? (r => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`)(rc.getBoundingClientRect()) : null
    };
  };
  window.__snap = snap;
  let prev = '';
  setInterval(() => { const s = snap(); const k = JSON.stringify(s); const k2 = k.replace(/"t":\d+,/, ''); if (k2 !== prev) { window.__log.push(s); prev = k2; } }, 30);
});

console.log('start:', JSON.stringify(await page.evaluate(() => window.__snap())));
await page.screenshot({ path: `${SHOTS}/SHIFT-${CAT}-${LVL}-${W}-start.png` });

for (let i = 0; i < 12; i++) {
  const before = await page.evaluate(() => window.__snap());
  await page.evaluate(() => window.__feedboos.feedCorrect());
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__snap());
  console.log(`item ${before.idx + 1} "${before.item}" [${before.buckets}] rule="${before.rule}" -> after idx=${after.idx} shifts=${after.shifts} buckets=[${after.buckets}] rule="${after.rule}" signs=[${after.signs}]`);
  if (before.buckets !== after.buckets || before.rule !== after.rule) {
    await page.screenshot({ path: `${SHOTS}/SHIFT-${CAT}-${LVL}-${W}-at${after.idx}.png` });
  }
  if (after.idx === before.idx) break;
}
console.log('\n--- mutation log (rule card / signposts / guide) ---');
for (const s of await page.evaluate(() => window.__log)) {
  console.log(String(s.t).padStart(6), `idx=${s.idx} shifts=${s.shifts} pulse=${s.rulePulse} buckets=[${s.buckets}] signs=[${s.signs}] rule="${s.rule}" cls="${s.ruleCls}" box=${s.ruleBox} guide="${s.guide}"`);
}
console.log('errors:', errors);
await ctx.close(); await b.close();
