// Focused RUN10 P10/P11 check: Blocks squeeze/Boost choreography and Echo pacing.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const ok = (condition, message) => {
  console.log(condition ? `  ✓ ${message}` : `  ✗ FAIL: ${message}`);
  if (!condition) failed = true;
};
const SAVE = (content = 'full') => ({
  version: 7, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1 }, stars: { total: 30, byGame: {} }, boxes: 0, meter: 0, opened: 1,
  pity: { commons: 0 }, town: { areas: {} }, ledger: {}, seen: { introSeen: { blocks: 1, echoboos: 1 }, trophyRetro: true },
  trophies: {}, journal: {}, care: { bonds: {}, treats: 0 }, nicknames: {}, equips: {}, catBest: {},
  settings: { sound: false, music: false, voice: false, content }, age: content === 'toddler' ? 4 : 8, ageAsked: true
});
const browser = await chromium.launch();
async function fresh(content = 'full') {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE(content));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub, .toddler-cards');
  return { ctx, page };
}

console.log('== P10 weighted bag and squeeze hysteresis ==');
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('blocks', { resume: true }));
  await page.waitForFunction(() => window.__blocks);
  const result = await page.evaluate(() => {
    const awkward = new Set(['tetS', 'tetT', 'corner', 'tetI']);
    const samples = [0, 250, 600].map(score => {
      const draws = window.__blocks.drawSamples(1200, score);
      return {
        ratio: draws.filter(x => awkward.has(x)).length / draws.length,
        triple: draws.some((x, i) => i >= 2 && x === draws[i - 1] && x === draws[i - 2])
      };
    });
    window.__blocks.forceFill(45);
    const on = window.__blocks.squeeze();
    window.__blocks.forceFill(40);
    const held = window.__blocks.squeeze();
    window.__blocks.forceFill(39);
    const off = window.__blocks.squeeze();
    return { samples, on, held, off, line: document.body.textContent.includes('Squeezy!') };
  });
  [0.25, 0.45, 0.62].forEach((target, i) => ok(Math.abs(result.samples[i].ratio - target) < .08, `tier ${i} awkward ratio tracks ${target} (${result.samples[i].ratio.toFixed(2)})`));
  ok(result.samples.every(s => !s.triple), 'weighted draw preserves no-triple-repeat');
  ok(result.on && result.held && !result.off, 'squeeze turns on at 70%, holds at 62.5%, clears below 62%');
  ok(result.line, 'the squeeze guide line is offered');
  await ctx.close();
}

console.log('== P10 Boost retry and special frames ==');
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('blocks', { resume: true }));
  await page.waitForFunction(() => window.__blocks);
  const before = await page.evaluate(() => window.__blocks.boostsLeft());
  await page.evaluate(() => window.__blocks.boost());
  await page.waitForSelector('.blk-boost-card');
  await page.evaluate(() => {
    const q = window.__blocks.boostQuestion();
    window.__blocks.boostAnswer((q.correct + 1) % q.options.length);
  });
  await page.waitForTimeout(80);
  ok(await page.evaluate(() => window.__blocks.boostsLeft()) === before, 'a wrong answer preserves the Boost use');
  await page.evaluate(() => window.__blocks.boostAnswer(window.__blocks.boostQuestion().correct));
  await page.waitForTimeout(80);
  ok(await page.evaluate(() => window.__blocks.boostsLeft()) === before - 1, 'the corrected retry consumes one use and awards the special');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__blocks.fillRowExceptLast(2); window.__blocks.rigSpecial(0, 'lineblast'); window.__blocks.place(0, 2, 7); });
  ok(await page.locator('.blk-beam').count() === 1, 'Line Blaster paints its beam frame');
  await page.waitForTimeout(320);
  await page.evaluate(() => { window.__blocks.rigSpecial(0, 'bomb'); window.__blocks.place(0, 3, 3); });
  ok(await page.locator('.blk-kapow').count() === 1, 'Sparkle Bomb paints its KA-POP frame');
  ok(await page.locator('.blk-board.blast-shake').count() === 1, 'Sparkle Bomb shakes the board');
  await ctx.close();
}

console.log('== P11 exact pace curve and separate Lightning best ==');
{
  const { ctx, page } = await fresh();
  const pace = await page.evaluate(async () => {
    const m = await import('./js/games/echoboos.js');
    return {
      standard: [1, 3, 4, 7, 50].map(len => m.echoGap(len)),
      lightning: [1, 4, 50].map(len => m.echoGap(len, { lightning: true })),
      toddler: [1, 6].map(len => m.echoGap(len, { toddler: true }))
    };
  });
  const expected = len => Math.max(250, Math.round((440 - len * 32) * Math.pow(.94, Math.floor(Math.max(0, len - 1) / 3))));
  ok(pace.standard.every((v, i) => v === expected([1,3,4,7,50][i])), `standard gaps match 440/250/32 and 0.94 curve (${pace.standard.join(', ')})`);
  ok(pace.lightning[0] === 298 && pace.lightning.at(-1) === 200, `Lightning uses its 330/200 pace (${pace.lightning.join(', ')})`);
  ok(pace.toddler[0] === 794 && pace.toddler[1] === 664, 'Toddler timings remain on the original 820/560/26 formula');
  await page.evaluate(() => window.BooTown.go('echoboos'));
  await page.waitForSelector('.echo-mode.lightning');
  ok(await page.locator('.echo-best').count() === 2, 'start card shows both independent best chips');
  await page.click('.echo-mode.lightning');
  await page.click('.start-card .btn.big');
  await page.waitForFunction(() => window.__echo && window.__echo.state().inputPhase);
  await page.evaluate(() => { window.__echo.setBestForTest(6); window.__echo.finishForTest(); });
  await page.waitForTimeout(450);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')).seen);
  ok(saved.echoBestLightning === 6 && !saved.echoBest, 'Lightning best persists separately and does not overwrite Standard');
  await ctx.close();
}

console.log('== P11 UK voice filtering and fallback copy ==');
{
  const { ctx, page } = await fresh();
  const list = await page.evaluate(async () => {
    const fake = [
      { name: 'US local', lang: 'en-US', localService: true },
      { name: 'UK cloud', lang: 'en-GB', localService: false },
      { name: 'UK local', lang: 'en-GB', localService: true }
    ];
    Object.defineProperty(window.speechSynthesis, 'getVoices', { configurable: true, value: () => fake });
    return (await import('./js/tts.js')).listVoices();
  });
  ok(list.length === 2 && list.every(v => v.lang === 'en-GB'), 'voice list contains only en-GB voices');
  ok(list[0].name === 'UK local', 'local UK voices sort first');
  await page.evaluate(() => {
    Object.defineProperty(window.speechSynthesis, 'getVoices', { configurable: true, value: () => [] });
    window.BooTown.go('grownups');
  });
  await page.waitForSelector('.gu-voice-tip');
  ok(/Install the English \(UK\) voice/.test(await page.locator('.gu-voice-tip').textContent()), 'zero UK voices shows the authored installation tip');
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
