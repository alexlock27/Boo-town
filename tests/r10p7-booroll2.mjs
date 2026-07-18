// Focused RUN10 P7 check. P8 courses/medals are intentionally out of scope.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p7', { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const SAVE = {
  version: 6, name: 'Ada',
  guide: { species: 'giraffe', body: 'lilac', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: {}, stars: { total: 0, byGame: { booroll: { best: 0, plays: 0, earned: 0 } } },
  meter: 0, boxes: 0, opened: 0, pity: { commons: 0 }, town: { areas: {} },
  nicknames: {}, equips: {}, catBest: {}, ledger: {}, delights: {},
  settings: { sound: false, music: false, voice: false, content: 'full', rollSensitivity: 1, rollInvert: false },
  seen: {}, age: 8, ageAsked: true
};
const browser = await chromium.launch();
async function open(width = 1024, height = 700, over = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), { ...SAVE, ...over });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForSelector('.roll2-start');
  return { ctx, page };
}

console.log('== P7 start card: one review course, persistent input controls ==');
{
  const { ctx, page } = await open(390, 844);
  const constants = await page.evaluate(() => window.__booroll.constants());
  ok(constants.GRAV === .55 && constants.MAX_SPEED === 15 && constants.BONK_MS === 700, 'named physics constants match P7');
  ok(await page.locator('[aria-label="Tilt sensitivity"]').count() === 1, 'sensitivity control is visible');
  ok(await page.locator('text=Invert tilt').count() === 1, 'invert toggle is visible');
  await page.screenshot({ path: 'screenshots/r10p7/start-390x844.png' });
  await ctx.close();
}

console.log('== side-view slope traces: uphill rolls back; downhill runs fast ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.__booroll.useFinger());
  await page.waitForSelector('.roll2-stage');
  const trace = await page.evaluate(() => {
    const api = window.__booroll;
    api.teleport(700); api.setTilt(0); api.velocity(4);
    const up = [];
    for (let i = 0; i < 260; i++) { api.step(16.667); if (i % 25 === 0) up.push(api.ball().vx); }
    api.teleport(2980); api.setTilt(0); api.velocity(0); api.holdPaddle(1);
    const down = [];
    for (let i = 0; i < 260; i++) { api.step(16.667); if (i % 25 === 0) down.push(api.ball().vx); }
    api.releasePaddle();
    return { up, down, endUp: up.at(-1), maxDown: Math.max(...down) };
  });
  ok(trace.endUp < 0, `uphill momentum stops and rolls back (${trace.up.map(x => x.toFixed(1)).join(' → ')})`);
  ok(trace.maxDown > 12, `downhill exceeds 0.8× MAX_SPEED (max ${trace.maxDown.toFixed(1)})`);
  await ctx.close();
}

console.log('== mechanisms: paddles move seesaw/lift, latch girder and open gate ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.__booroll.useFinger());
  const states = await page.evaluate(() => {
    const api = window.__booroll;
    const before = api.mechanisms();
    api.holdPaddle(1);
    for (let i = 0; i < 80; i++) api.step(16.667);
    const held = api.mechanisms();
    api.releasePaddle();
    for (let i = 0; i < 80; i++) api.step(16.667);
    return { before, held, released: api.mechanisms() };
  });
  ok(states.held.seesawAngle > 16, `seesaw pivots toward the held side (${states.held.seesawAngle.toFixed(1)}°)`);
  ok(states.held.liftY > 120, `lift rises toward 140px (${states.held.liftY.toFixed(1)}px)`);
  ok(states.held.girderTurns === 1, 'quarter girder rotates and latches per press');
  ok(states.held.gateOpen === true && states.released.gateOpen === false, 'gate opens only while held');
  ok(Math.abs(states.released.seesawAngle) < Math.abs(states.held.seesawAngle), 'seesaw springs back after release');
  await ctx.close();
}

console.log('== BONK rescue: dizzy → parachute → checkpoint, +2.5s ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.__booroll.useFinger());
  const phases = await page.evaluate(() => {
    const api = window.__booroll;
    api.teleport(1200); api.forceBonk();
    const a = api.state();
    api.step(701); const b = api.state();
    api.step(1401); const c = api.state();
    return [a, b, c];
  });
  ok(phases[0].phase === 'bonk', 'impact starts the dizzy BONK');
  ok(phases[1].phase === 'chute', 'BONK transitions to parachute');
  ok(phases[2].phase === 'normal', 'parachute lands back in play');
  ok(phases[2].penalty === 2500, 'clock penalty is exactly 2500ms');
  await ctx.close();
}

console.log('== phone playfield: only progress strip + readable controls ==');
{
  const { ctx, page } = await open(390, 844);
  await page.evaluate(() => window.__booroll.useFinger());
  await page.waitForSelector('.roll2-stage');
  const sizes = await page.evaluate(() => {
    const progress = document.querySelector('.roll2-progress').getBoundingClientRect();
    const paddles = [...document.querySelectorAll('.roll2-paddle')].map(n => n.getBoundingClientRect());
    return { progress, paddles };
  });
  ok(sizes.progress.height <= 30, `progress map stays compact (${sizes.progress.height.toFixed(0)}px)`);
  ok(sizes.paddles.every(r => r.width >= 80 && r.height >= 80), 'both mechanism paddles are large phone targets');
  await page.screenshot({ path: 'screenshots/r10p7/crash-course-390x844.png' });
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
