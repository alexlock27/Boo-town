// tests/r5p6-intros.mjs — RUN5 phase 6 (C5): first-play guided intros for every game.
// Acceptance (RUN5 part D #7): every game listed in C5 shows its steps on first open
// only, skippable, replayable via "?", flags persist across reload. Also: every step
// is under 12 words, and existing players (no flags) see intros once.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// an "existing player" save — plays on record, but NO introSeen flags (they start empty)
const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 3, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: { bubblepop: { best: 3, plays: 9, earned: 20 } } },
  ledger: {}, golden: { words: [{ w: 'because' }], choices: [] },
  settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { trophyRetro: true }, trophies: {}, ageAsked: true, age: 8
}, over);

// game -> [ready selector, expected step count]
const GAMES = [
  ['bubblepop', '.start-card', 3],
  ['feedboos',  '.start-card', 3],
  ['spellboo',  '.start-card', 3],
  ['dash',      '.start-card', 3],
  ['bounce',    '.start-card', 3],
  ['beat',      '.start-card', 3],
  ['blocks',    '.start-card', 3],
  ['boopop',    '.start-card', 3],
  ['clockshop', '.start-card', 3],
  ['teachme',   '.teachme-list', 1],
  ['golden',    '.golden', 2]
];

// ---- static: every C5-authored step is under 12 words ----
// (Boo Blocks' script is exempt: C1 fixes its wording verbatim, and two of those
// lines run longer by design.)
console.log('== step length rule (<12 words) ==');
{
  const src = readFileSync(join(ROOT, 'js', 'intro.js'), 'utf8');
  const texts = [...src.matchAll(/\{ text: (['"])(.+?)\1 \}/g)].map(m => m[2]);
  assert(texts.length === 27, `collected the C5 scripts (${texts.length} steps: 8 games x3 + Teach Me x1 + Golden x2)`);
  const over = texts.filter(t => t.split(/\s+/).length > 12);
  assert(over.length === 0, 'every C5 intro step is under 12 words' + (over.length ? ` (over: ${over.join(' | ')})` : ''));
  // Blocks still carries its exact C1 script
  const blocksSrc = readFileSync(join(ROOT, 'js', 'games', 'blocks.js'), 'utf8');
  assert(blocksSrc.includes('Answer my question and you win a piece!'), "Blocks keeps its exact C1 script");
}

const browser = await chromium.launch();
async function fresh(save) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ---- every game: intro on first open, Skip, once-only, persists across reload ----
console.log('== per-game first-open + skip + once-only + reload ==');
{
  const { ctx, page } = await fresh(SAVE());
  for (const [game, ready, steps] of GAMES) {
    await page.evaluate((g) => window.BooTown.go(g), game);
    const shown = await page.waitForSelector('.intro-overlay.show', { timeout: 5000 }).then(() => true).catch(() => false);
    assert(shown, `${game}: first-ever open shows the intro`);
    if (!shown) continue;
    const info = await page.evaluate(() => ({ total: window.__intro.total, game: window.__intro.game, skip: !!document.querySelector('.intro-skip') }));
    assert(info.game === game && info.total === steps, `${game}: ${steps} step(s) (got ${info.total})`);
    assert(info.skip, `${game}: a soft Skip is present`);
    await page.click('.intro-skip');
    await page.waitForSelector('.intro-overlay', { state: 'detached', timeout: 3000 });
    // once-only: reopen → no intro
    await page.evaluate(() => window.BooTown.go('hub'));
    await page.waitForSelector('.hub');
    await page.evaluate((g) => window.BooTown.go(g), game);
    await page.waitForSelector(ready);
    await sleep(350);
    assert(!(await page.$('.intro-overlay')), `${game}: one skip and it never returns`);
    await page.evaluate(() => window.BooTown.go('hub'));
    await page.waitForSelector('.hub');
  }
  // flags persist across reload
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForSelector('.start-card');
  await sleep(350);
  assert(!(await page.$('.intro-overlay')), 'seen-flags persist across reload (no intro after reload)');
  const flags = await page.evaluate(() => window.BooTown.State.getState().seen.introSeen);
  assert(GAMES.every(([g]) => flags && flags[g]), `all ${GAMES.length} games flagged in the save`);
  await ctx.close();
}

// ---- walking the steps: Next advances, "Let's go!" finishes ----
console.log('== step walking ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('feedboos'));
  await page.waitForSelector('.intro-overlay.show');
  const s1 = await page.$eval('.intro-bubble', n => n.textContent);
  assert(/HUNGRY/.test(s1), `step 1 in the guide's voice ("${s1}")`);
  await page.click('.intro-next');
  const s2 = await page.$eval('.intro-bubble', n => n.textContent);
  assert(/Drag each food/.test(s2), 'Next advances to step 2');
  await page.click('.intro-next');
  const btn = await page.$eval('.intro-next', n => n.textContent);
  assert(/Let's go/.test(btn), 'the last step offers "Let\'s go!"');
  await page.click('.intro-next');
  await page.waitForSelector('.intro-overlay', { state: 'detached' });
  const flag = await page.evaluate(() => window.BooTown.State.getState().seen.introSeen.feedboos);
  assert(flag === true, 'finishing the steps marks the intro seen');
  await ctx.close();
}

// ---- the "?" button replays the intro mid-round ----
console.log('== "?" replay ==');
{
  const INTRO_ALL = { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 };
  const { ctx, page } = await fresh(SAVE({ seen: { trophyRetro: true, introSeen: INTRO_ALL } }));
  // straight into a round via resume (no intro — already seen)
  await page.evaluate(() => window.BooTown.go('bubblepop', { resume: { cat: 'tables', level: 1, mix: false } }));
  await page.waitForSelector('.bubble-field');
  await sleep(300);
  assert(!(await page.$('.intro-overlay')), 'no intro mid-round for a seen game');
  assert(!!(await page.$('.help-btn')), 'the "?" button joins the game shell chrome');
  await page.click('.help-btn');
  await page.waitForSelector('.intro-overlay.show', { timeout: 3000 });
  const txt = await page.$eval('.intro-bubble', n => n.textContent);
  assert(/Pop the bubble/.test(txt), '"?" replays the intro any time');
  await page.click('.intro-skip');
  await page.waitForSelector('.intro-overlay', { state: 'detached' });
  // clockshop + boopop + golden also expose "?" in their shells
  for (const [game, params, ready] of [
    ['clockshop', { resume: { level: 1 } }, '.clock-wrap'],
    ['boopop', { resume: { cat: 'make10' } }, '.bp-board'],
    ['golden', {}, '.golden-shell, .golden']
  ]) {
    await page.evaluate(({ g, p }) => window.BooTown.go(g, p), { g: game, p: params });
    if (game === 'golden') { const b = await page.$('.btn:has-text("Start")'); if (b) await b.click(); }
    await page.waitForSelector(ready, { timeout: 6000 });
    const has = !!(await page.$('.help-btn'));
    assert(has, `${game}: "?" present in the shell`);
  }
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
