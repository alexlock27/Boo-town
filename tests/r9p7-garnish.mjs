// tests/r9p7-garnish.mjs — sensor & haptic garnish + voice picker (RUN9 C7 / C6b),
// acceptance part D #7 (+ #6b). navigator.vibrate is stubbed to capture patterns; a shake
// is stubbed via devicemotion; speechSynthesis voices are stubbed for the picker.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sky', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 1, meter: 0, opened: 12, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [],
  stars: { total: 60, byGame: {} }, ledger: {}, booRoll: { best: {}, medals: {} }, delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: true, content: 'full', haptics: true }, seen: { introSeen: { boopop: 1, detective: 1, booroll: 1 }, trophyRetro: true }, trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function fresh(over, { stubVoices = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 820 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(() => { window.__vibes = []; navigator.vibrate = (p) => { window.__vibes.push(p); return true; }; });
  if (stubVoices) await page.addInitScript(() => {
    const V = [{ name: 'Daniel (UK)', lang: 'en-GB', localService: true }, { name: 'Serena (UK)', lang: 'en-GB', localService: false }, { name: 'Alex (US)', lang: 'en-US', localService: true }];
    try { window.speechSynthesis.getVoices = () => V; } catch {}
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(v => localStorage.setItem('bootown.save.v1', JSON.stringify(v)), SAVE(over));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
const vibes = (page) => page.evaluate(() => window.__vibes.slice());
const clearVibes = (page) => page.evaluate(() => { window.__vibes = []; });

// ---- 1) tick on a correct answer; never on an error; toggle silences ----
console.log('== haptic tick on correct; none on error; toggle ==');
{
  const { ctx, page } = await fresh();
  await clearVibes(page);
  await page.evaluate(async () => { const m = await import('./js/sfx.js'); m.sfx.correct(); });
  assert((await vibes(page)).length === 1, 'a correct answer fires exactly one gentle tick');
  await clearVibes(page);
  await page.evaluate(async () => { const m = await import('./js/sfx.js'); m.sfx.oops(); });
  assert((await vibes(page)).length === 0, 'a wrong answer NEVER buzzes (haptics are never used for errors)');
  await clearVibes(page);
  await page.evaluate(async () => { const m = await import('./js/haptics.js'); m.setHapticsEnabled(false); m.haptic('tick'); });
  assert((await vibes(page)).length === 0, 'the Settings toggle off silences all haptics');
  await ctx.close();
}

// ---- 2) box-open double-buzz ----
console.log('== box opening double-buzz ==');
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('ceremony'));
  await page.waitForSelector('.gift-box', { timeout: 4000 });
  await clearVibes(page);
  for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await sleep(260); }
  await sleep(400);
  const v = await vibes(page);
  assert(v.some(p => Array.isArray(p) && p.length === 3), `opening a box fires the tiny double-buzz pattern (${JSON.stringify(v)})`);
  await ctx.close();
}

// ---- 3) Boo Roll wall-hit bump ----
console.log('== Boo Roll wall-hit bump ==');
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForSelector('.roll-course-grid');
  await page.evaluate(() => window.__booroll.openCourse('roll1'));
  await page.waitForSelector('.roll-calibrate');
  await page.evaluate(() => window.__booroll.go('virtual'));
  await page.waitForSelector('.roll-canvas');
  await page.waitForFunction(() => window.__booroll.playing && window.__booroll.playing());
  await clearVibes(page);
  // drive the ball hard into the right wall
  await page.evaluate(() => window.__booroll.teleport(950, 300));
  for (let i = 0; i < 25; i++) { await page.evaluate(() => window.__booroll.setTilt(1.2, 0)); await sleep(20); }
  const v = await vibes(page);
  assert(v.some(p => Array.isArray(p) && p[0] === 10), `hitting a wall fires a gentle bump (${v.length} buzzes)`);
  await ctx.close();
}

// ---- 4) Word Detective green pulse ----
console.log('== Word Detective green pulse ==');
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('detective'));
  await page.waitForSelector('.det-modes');
  await page.click('.det-modes .btn.big');
  await page.waitForFunction(() => window.__detective);
  const target = await page.evaluate(() => window.__detective.target());
  await clearVibes(page);
  await page.evaluate(t => window.__detective.guess(t), target);   // all green
  await sleep(1600);
  const v = await vibes(page);
  assert(v.some(p => Array.isArray(p) && p[0] === 14), `a green tile fires a light pulse (${v.length} pulses on the winning row)`);
  await ctx.close();
}

// ---- 5) shake-to-shuffle in Boo Pop ----
console.log('== shake-to-shuffle (Boo Pop) ==');
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('boopop'));
  await page.waitForSelector('.start-card');
  await page.click('.level-row .level-btn');
  await page.waitForFunction(() => window.__boopop);
  await page.waitForFunction(() => !window.__boopop.state().busy, { timeout: 4000 }).catch(() => {});
  await sleep(300);
  const g0 = await page.evaluate(() => window.__boopop.grid0());
  // a gentle jiggle below the threshold does nothing
  await page.evaluate(() => window.__boopop.shake(8));
  assert(!(await page.evaluate(() => window.__boopop.shakeUsed())), 'gentle movement does NOT trigger a shuffle (thresholded)');
  // a firm shake shuffles once
  await page.evaluate(() => window.__boopop.shake(30));
  await sleep(200);
  const g1 = await page.evaluate(() => window.__boopop.grid0());
  assert(await page.evaluate(() => window.__boopop.shakeUsed()), 'a firm shake triggers the sparkle-shuffle');
  assert(g0 !== g1, 'the shake actually rearranges the board');
  const bubble = await page.$eval('.peek-bubble', n => n.textContent).catch(() => '');
  assert(/Shake it up/.test(bubble), `the guide cheers "Shake it up!" (${bubble.slice(0, 24)})`);
  // once per round: a second shake is ignored
  const g2before = await page.evaluate(() => window.__boopop.grid0());
  await page.evaluate(() => window.__boopop.shake(30));
  await sleep(150);
  assert((await page.evaluate(() => window.__boopop.grid0())) === g2before, 'the shake-shuffle is once per round (a second firm shake is ignored)');
  await ctx.close();
}

// ---- 6) voice picker (C6b) ----
console.log('== voice picker (Settings) ==');
{
  const { ctx, page } = await fresh({}, { stubVoices: true });
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.grownups');
  const names = await page.$$eval('.gu-voice-list .gv-name', ns => ns.map(n => n.textContent));
  assert(names.length === 3, `the picker lists the installed English voices (${names.length})`);
  assert(/Daniel/.test(names[0]) && !/☁/.test(names[0]), 'local voices are listed first (Daniel UK, no cloud marker)');
  // preview button speaks "Hello {name}!" (stub speechSynthesis.speak to capture it)
  await page.evaluate(() => { window.__spoke = null; window.speechSynthesis.speak = (u) => { window.__spoke = u && u.text; }; });
  await page.click('.gu-voice-list .gu-voice-row:first-child .gv-preview');
  await sleep(150);
  assert(/Hello/.test(await page.evaluate(() => window.__spoke || '')), `the preview button says "Hello {name}!" (${await page.evaluate(() => window.__spoke)})`);
  // pick the last voice; it persists to the save
  const pickName = (await page.$eval('.gu-voice-list .gu-voice-row:last-child .gv-name', n => n.textContent)).replace(/\s*☁️?$/, '').trim();
  await page.click('.gu-voice-list .gu-voice-row:last-child .gu-voice-pick');
  await sleep(150);
  const saved = await page.evaluate(() => window.BooTown.State.getState().settings.voiceName);
  assert(saved === pickName, `choosing a voice persists it (${saved})`);
  // persists across reload
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  assert(await page.evaluate(() => window.BooTown.State.getState().settings.voiceName) === pickName, 'the chosen voice survives a reload');
  await ctx.close();
}
// hides gracefully when no voices
{
  const { ctx, page } = await fresh();   // no voice stub → getVoices() empty in headless
  await page.evaluate(() => { try { window.speechSynthesis.getVoices = () => []; } catch {} });
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.grownups');
  const visible = await page.evaluate(() => { const el = document.querySelector('.gu-voice'); return el && el.style.display !== 'none' && el.querySelector('.gu-voice-pick'); });
  assert(!visible, 'the voice section hides gracefully where no voices are installed');
  await ctx.close();
}

await browser.close();
console.log('\n' + (failed ? 'r9p7-garnish: FAIL' : 'r9p7-garnish: ALL PASS'));
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
