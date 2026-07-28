// shoot-y5sfx.mjs — is there a CHOMP on every correct sort, by drag and by hook? Delete when done.
import { chromium } from 'playwright';
import { BASE, RESOLVE, save } from './shoot-y56boot.mjs';

const b = await chromium.launch({ args: [...RESOLVE, '--autoplay-policy=no-user-gesture-required'] });
async function run(mode, CAT, W, H, reduced) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save({ settings: { sound: true, music: false, voice: false, content: 'full', haptics: true } }));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const sfx = await import('/js/sfx.js');
    sfx.setAudioLog(true); sfx.initAudio(); sfx.setSoundEnabled(true);
    window.__log = () => sfx.getAudioLog();
    window.__clear = () => { sfx.setAudioLog(false); sfx.setAudioLog(true); };
  });
  await page.evaluate(([c]) => window.BooTown.go('feedboos', { resume: { cat: 't:' + c, level: 3 } }), [CAT]);
  await page.waitForFunction(() => !!document.querySelector('.food-item'), null, { timeout: 12000 });
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.__clear());
  if (mode === 'hook') await page.evaluate(() => window.__feedboos.feedCorrect());
  else if (mode === 'hookwrong') await page.evaluate(() => window.__feedboos.feedWrong());
  else {
    const g = await page.evaluate(() => {
      const ir = document.querySelector('.food-item').getBoundingClientRect();
      const fs = [...document.querySelectorAll('.feeder')].map(e => { const r = e.getBoundingClientRect(); return { b: +e.dataset.bucket, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; });
      return { src: { cx: ir.x + ir.width / 2, cy: ir.y + ir.height / 2 }, fs, want: window.__feedboos.itemBuckets()[window.__feedboos.state().idx] };
    });
    const t = mode === 'dragwrong' ? g.fs.find(f => f.b !== g.want) : g.fs.find(f => f.b === g.want);
    await page.mouse.move(g.src.cx, g.src.cy); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(g.src.cx + (t.cx - g.src.cx) * i / 6, g.src.cy + (t.cy - g.src.cy) * i / 6); await page.waitForTimeout(16); }
    await page.mouse.up();
  }
  await page.waitForTimeout(1600);
  const log = await page.evaluate(() => window.__log());
  console.log(`${mode} ${CAT} ${W}x${H}${reduced ? ' RM' : ''}: tags=[${log.map(e => e.tag).join(',')}]  chomp=${log.some(e => e.tag === 'chomp') ? 'YES' : 'NO'}  errors=${JSON.stringify(errors)}`);
  await ctx.close();
}
for (const m of ['hook', 'drag', 'hookwrong', 'dragwrong']) await run(m, 'oddEven', 1024, 768, false);
await run('drag', 'oddEven', 390, 844, false);
await run('hook', 'oddEven', 1024, 768, true);
await run('drag', 'oddEven', 1024, 768, true);
await b.close();
