// tests/m3-motion.mjs — prefers-reduced-motion disables animations; audio code paths run clean.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 1, name: 'Maya', guide: { body: 'sunshine', patch: 'cocoa', acc: 'bow', name: 'Twiggy' } })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
// a tap so audio can initialise (autoplay policy)
await page.mouse.click(500, 300);
await page.waitForTimeout(300);

console.log('== reduced motion disables animations ==');
const guideAnim = await page.evaluate(() => {
  const svg = document.querySelector('.guide-art .art-idle') || document.querySelector('.art-idle');
  return svg ? getComputedStyle(svg).animationName : 'none';
});
assert(guideAnim === 'none', 'idle-bounce animation is off under reduced motion (' + guideAnim + ')');
const starAnim = await page.evaluate(() => getComputedStyle(document.querySelector('.star-field i')).animationName);
assert(starAnim === 'none', 'starfield twinkle off under reduced motion');

console.log('== confetti helper is a no-op under reduced motion ==');
const canvasAfter = await page.evaluate(async () => {
  const ui = await import('./js/ui.js');
  ui.confetti({ count: 50 });
  return !!document.getElementById('confetti-canvas');
});
assert(canvasAfter === false, 'confetti() creates no canvas under reduced motion');

console.log('== audio code paths run without errors ==');
const audioOk = await page.evaluate(async () => {
  const sfxMod = await import('./js/sfx.js');
  sfxMod.initAudio();
  ['tap', 'pop', 'correct', 'oops', 'star', 'fanfare'].forEach(k => sfxMod.sfx[k]());
  sfxMod.sfx.boxTap(0); sfxMod.sfx.boxTap(1);
  sfxMod.music.play('game'); sfxMod.music.duck(true); sfxMod.music.duck(false);
  sfxMod.music.play('calm'); sfxMod.music.stop();
  sfxMod.setSoundEnabled(false); sfxMod.setSoundEnabled(true);
  sfxMod.setMusicEnabled(false); sfxMod.setMusicEnabled(true);
  return sfxMod.isReady();
});
assert(audioOk === true, 'AudioContext initialised and all sfx/music calls ran');

await page.waitForTimeout(200);
console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors while exercising audio + motion');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
