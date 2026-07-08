// tests/r6p7-juice.mjs — RUN6 phase 7: the juice & identity pass (C5).
// Acceptance (RUN6 part D #8): per-game frame + audio evidence of every named effect;
// the golden bubble caps at twice per round; nom-streak drumming at 4; the Spell Boo
// word bounce-spells with per-letter pings.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r6p7', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [], stars: { total: 60, byGame: {} }, ledger: {}, spellingMastery: {}, delights: { hideDay: today, hideFound: true },
  settings: { sound: true, music: false, voice: false, content: 'full' },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function open(save, go) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 680 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(async () => { const s = await import('./js/sfx.js'); s.initAudio(); s.setSoundEnabled(true); });
  await page.evaluate(go);
  return { ctx, page };
}

// ==================== Bubble Pop ====================
console.log('== Bubble Pop: glassy, droplets, backdrop, golden bubble ==');
{
  const { ctx, page } = await open(SAVE(), () => window.BooTown.go('bubblepop', { resume: { cat: 'tables', level: 1 } }));
  await page.waitForSelector('.bubble-field');
  await page.waitForFunction(() => window.__bubblepop);
  assert(!!(await page.$('.bubble-field.bp-glass')), 'bubbles are glassy (bp-glass)');
  assert(await page.evaluate(() => window.__bubblepop.state().sky) === 'bp-sky-1', 'level 1 shows the day-sky backdrop');
  // droplets on a correct pop
  await page.evaluate(() => { window.__bubblepop.forceGolden(); });
  await sleep(120);
  await page.screenshot({ path: 'screenshots/r6p7/bubblepop-900x680.png' });
  await page.evaluate(() => window.__bubblepop.popCorrect());
  await sleep(60);
  assert(await page.evaluate(() => window.__bubblepop.droplets()) > 0, 'a pop bursts into droplets (frame evidence)');
  await ctx.close();
}
{
  // random golden OFF from the very first layout (forceGolden bypasses it) so the cap/meter maths is exact
  const ctx = await browser.newContext({ viewport: { width: 900, height: 680 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(() => { window.__bubblepopNoGolden = true; });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(async () => { const s = await import('./js/sfx.js'); s.initAudio(); s.setSoundEnabled(true); });
  await page.evaluate(() => window.BooTown.go('bubblepop', { resume: { cat: 'tables', level: 3 } }));
  await page.waitForSelector('.bubble-field');
  await page.waitForFunction(() => window.__bubblepop);
  assert(await page.evaluate(() => window.__bubblepop.state().sky) === 'bp-sky-3', 'level 3 shows the starry backdrop');
  // streak of 3+ (the third pop triggers the sparkle trail)
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__bubblepop.popCorrect()); await sleep(360); }
  assert(await page.evaluate(() => window.__bubblepop.state().streak) >= 3, 'a run of correct pops builds a streak (trail kicks in at 3)');
  // golden bubble: +1 meter, capped twice per round
  const g = await page.evaluate(async () => {
    const S = window.BooTown.State; const before = S.getState().meter; let pops = 0;
    for (let k = 0; k < 4; k++) {
      const forced = window.__bubblepop.forceGolden();
      window.__bubblepop.popCorrect();
      if (forced) pops++;
      await new Promise(r => setTimeout(r, 360));
    }
    return { attempts: pops, meterGain: S.getState().meter - before, goldenCount: window.__bubblepop.state().goldenCount };
  });
  assert(g.goldenCount === 2, `the golden bubble pays at most twice per round (${g.goldenCount})`);
  assert(g.meterGain === 2, `two golden pops add exactly +2 meter (${g.meterGain})`);
  await ctx.close();
}

// ==================== Feed the Boos ====================
console.log('== Feed the Boos: chew, arc-nom, varied reactions, drumming at 4 ==');
{
  const { ctx, page } = await open(SAVE(), () => window.BooTown.go('feedboos', { resume: { cat: 'maths', level: 1 } }));
  await page.waitForSelector('.feeders');
  await page.waitForFunction(() => window.__feedboos);
  assert(await page.evaluate(() => window.__feedboos.chewing()) >= 2, 'the Boos idle-chew (feed-chew)');
  // a fed item arcs into the mouth
  await page.evaluate(() => window.__feedboos.feedCorrect());
  await sleep(60);
  assert(await page.evaluate(() => window.__feedboos.arcing()), 'a fed item arcs through the air (frame evidence)');
  await page.waitForFunction(() => !window.__feedboos.state().locked, { timeout: 2000 });   // let the first arc finish
  // varied wrong reactions over several misses
  const reactions = new Set();
  for (let i = 0; i < 10; i++) { await page.evaluate(() => window.__feedboos.feedWrong()); const r = await page.evaluate(() => window.__feedboos.lastReaction()); if (r) reactions.add(r); await sleep(120); }
  assert([...reactions].every(r => ['raspberry', 'headshake', 'sigh'].includes(r)) && reactions.size >= 2, `wrong deliveries get varied friendly reactions (${[...reactions].join(',')})`);
  await page.screenshot({ path: 'screenshots/r6p7/feedboos-900x680.png' });
  await ctx.close();
}
{
  // nom-streak of 4 → both Boos drum the table
  const { ctx, page } = await open(SAVE(), () => window.BooTown.go('feedboos', { resume: { cat: 'maths', level: 1 } }));
  await page.waitForSelector('.feeders');
  await page.waitForFunction(() => window.__feedboos);
  let drummed = false;
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__feedboos.feedCorrect());
    if (await page.evaluate(() => window.__feedboos.drumming())) drummed = true;
    await page.waitForFunction(() => !window.__feedboos.state().locked, { timeout: 2000 }).catch(() => {});
    if (await page.evaluate(() => window.__feedboos.drumming())) drummed = true;
  }
  assert(drummed, 'a nom-streak of 4 sets both Boos drumming the table');
  await ctx.close();
}

// ==================== Spell Boo ====================
console.log('== Spell Boo: chimes, bounce-spell + pings, proud word card ==');
{
  const { ctx, page } = await open(SAVE(), () => window.BooTown.go('spellboo', { resume: { cat: 'big', level: 1 } }));
  await page.waitForSelector('.spell-stage');
  await page.waitForFunction(() => window.__spell && window.__spell.word && window.__spell.word());
  const word = await page.evaluate(() => window.__spell.word());
  assert(!!(await page.$('.tile')), 'tiles are chunky sticker tiles');
  // typing the letters sounds ascending chimes (one per placed letter)
  const chimes = await page.evaluate(async () => {
    const s = await import('./js/sfx.js'); s.setAudioLog(true);
    window.__spell.typeCorrect();
    await new Promise(r => setTimeout(r, 200));
    return s.getAudioLog().filter(e => e.kind === 'note' && e.tag === 'chime').length;
  });
  assert(chimes >= word.length, `each placed letter sounds a chime (${chimes} chimes for a ${word.length}-letter word)`);
  // correct → bounce-spell with per-letter pings + the proud word card
  const done = await page.evaluate(async () => {
    const s = await import('./js/sfx.js'); s.setAudioLog(true);
    await new Promise(r => setTimeout(r, 700));
    return { pings: s.getAudioLog().filter(e => e.kind === 'note' && e.tag === 'ping').length, lb: document.querySelectorAll('.slot.lb').length, card: !!document.querySelector('.spell-wordcard') };
  });
  assert(done.pings >= word.length, `the word bounce-spells with a per-letter ping (${done.pings} pings)`);
  assert(done.lb >= 1, 'the letters bounce as they spell (slot .lb frames)');
  assert(done.card, 'the guide holds the spelled word up proudly (word card)');
  await page.screenshot({ path: 'screenshots/r6p7/spell-wordcard-900x680.png' });
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
