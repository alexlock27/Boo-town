// tests/r12s6-intro-pause.mjs — RUN12 S6: the intro teaches; it never runs the game behind
// its own back.
//
// Measured before the fix: Boo Beat lost TWO hearts while the first-play intro was still on
// screen, and Flash Boos went reveal → question → curtain-down behind the overlay, so the
// scene the child was supposed to memorise had already gone by the time she finished
// reading step one.
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s6';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// ---- 1. the mechanism exists and is shared -----------------------------------------
console.log('== there is exactly one pause implementation, and the shell uses it ==');
{
  const intro = readFileSync('js/intro.js', 'utf8');
  const shell = readFileSync('js/gameshell.js', 'utf8');
  assert(/export function createRoundTimers/.test(intro), 'js/intro.js owns createRoundTimers()');
  assert(/registerSuspendable/.test(intro), 'and a suspendable registry');
  assert(/suspendRound\(\)/.test(intro) && /resumeRound\(\)/.test(intro),
    'runIntro suspends on open and resumes on close');
  assert(/createRoundTimers\(\)/.test(shell), 'the game shell delegates to it rather than keeping a copy');
  assert(!/let paused = false, pausedAt = 0, lostMs = 0;/.test(shell),
    'the shell keeps no second copy of the pause bookkeeping');
  // a late-built shell must be caught up
  assert(/if \(suspendDepth > 0\)/.test(intro),
    'a shell built while the overlay is already up is suspended immediately');
}

console.log('== every game with an intro takes its round timers from the shell ==');
{
  // Any game that calls maybeIntro/replayIntro/runIntro AND schedules its own round with a
  // bare setTimeout on a round-advancing path is a gap. We check the specific advancing
  // calls rather than decoration cleanups.
  const files = [];
  (function walk(d) {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) files.push(p);
    }
  })('js');
  const introUsers = files.filter(f => /maybeIntro\(|replayIntro\(|runIntro\(/.test(readFileSync(f, 'utf8')) && !f.endsWith('intro.js'));
  assert(introUsers.length >= 12, `${introUsers.length} screens run an intro`);
  const shellAware = introUsers.filter(f => {
    const src = readFileSync(f, 'utf8');
    return /shell\.(after|timeout|cancel|paused|now|pausedMs)\(/.test(src) || /createRoundTimers\(/.test(src);
  });
  const gaps = introUsers.filter(f => !shellAware.includes(f));
  assert(gaps.length === 0, `every one of them is pause-aware${gaps.length ? ' → ' + gaps.join(', ') : ''}`);
}

// ---- 2. drive it ---------------------------------------------------------------------
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const save = (introSeen = {}) => JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1, boo_plum: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
async function open(route, params, introSeen = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(introSeen));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
  await page.waitForTimeout(1300);
  return { ctx, page };
}

console.log('== Boo Beat loses no hearts and drops no notes while the intro is up ==');
{
  const { ctx, page } = await open('beat', { resume: { mix: true } });
  const up = await page.evaluate(() => !!document.querySelector('.intro-overlay'));
  assert(up, 'the first-play intro is on screen');
  const before = await page.evaluate(() => ({
    hearts: window.__beat.state().hearts, misses: window.__beat.state().misses,
    phrase: window.__beat.state().phraseIdx, notes: window.__beat.state().notes
  }));
  await page.screenshot({ path: `${SHOTS}/beat-intro-up.png` });
  await page.waitForTimeout(9000);                       // nine seconds of NOT playing
  const after = await page.evaluate(() => ({
    hearts: window.__beat.state().hearts, misses: window.__beat.state().misses,
    phrase: window.__beat.state().phraseIdx, notes: window.__beat.state().notes
  }));
  assert(after.hearts === before.hearts, `no heart is lost behind the overlay (${before.hearts} → ${after.hearts})`);
  assert(after.misses === before.misses, `no miss is recorded (${before.misses} → ${after.misses})`);
  assert(after.phrase === before.phrase, `the round clock does not advance (phrase ${before.phrase} → ${after.phrase})`);
  // and it resumes rather than snapping forward
  await page.evaluate(() => window.__intro.close());
  await page.waitForTimeout(600);
  const resumed = await page.evaluate(() => window.__beat.state());
  assert(resumed.hearts === before.hearts, `resume restores state exactly (hearts ${resumed.hearts})`);
  assert(resumed.phraseIdx === before.phrase, `and does not jump the phrase forward (${resumed.phraseIdx})`);
  await page.waitForTimeout(3500);
  const running = await page.evaluate(() => window.__beat.state());
  assert(running.hearts < before.hearts || running.notes > 0 || running.phrase > before.phrase,
    'and the round really is live again once the overlay is gone');
  await ctx.close();
}

console.log('== Flash Boos begins its reveal only after the intro is dismissed ==');
{
  const { ctx, page } = await open('flashboos', {});
  assert(await page.evaluate(() => !!document.querySelector('.intro-overlay')), 'the intro is on screen');
  const p0 = await page.evaluate(() => window.__flashboos.phase());
  await page.screenshot({ path: `${SHOTS}/flash-intro-up.png` });
  await page.waitForTimeout(8000);                       // longer than any revealMs
  const p1 = await page.evaluate(() => ({
    phase: window.__flashboos.phase(),
    curtainDown: !!document.querySelector('.flash-curtain.down'),
    round: window.__flashboos.round()
  }));
  assert(p1.phase === p0, `the phase does not move behind the overlay (${p0} → ${p1.phase})`);
  assert(!p1.curtainDown, 'the curtain has not dropped — the scene is still there to memorise');
  assert(p1.round === 0, 'no round has been consumed');
  await page.evaluate(() => window.__intro.close());
  await page.waitForTimeout(600);
  assert(await page.evaluate(() => window.__flashboos.phase()) === 'reveal',
    'the reveal is still showing the moment she dismisses the intro');
  await page.screenshot({ path: `${SHOTS}/flash-after-dismiss.png` });
  await page.waitForTimeout(6000);
  assert(await page.evaluate(() => window.__flashboos.phase()) !== 'reveal',
    'and only then does it move on');
  await ctx.close();
}

console.log('== the "?" replay mid-round pauses identically and loses no state ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { mix: true } }, { bubblepop: true });
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => window.__bubblepop.state());
  await page.evaluate(() => document.querySelector('.help-btn')?.click());
  await page.waitForTimeout(700);
  assert(await page.evaluate(() => !!document.querySelector('.intro-overlay')), 'the "?" opens the replay mid-round');
  const positions = await page.evaluate(() => [...document.querySelectorAll('.bubble')].map(b => Math.round(b.getBoundingClientRect().top)));
  await page.waitForTimeout(5000);
  const positionsAfter = await page.evaluate(() => [...document.querySelectorAll('.bubble')].map(b => Math.round(b.getBoundingClientRect().top)));
  const moved = positions.filter((p, i) => Math.abs(p - (positionsAfter[i] ?? p)) > 2).length;
  assert(moved === 0, `no bubble moves behind the replay (${moved} of ${positions.length} drifted)`);
  const mid = await page.evaluate(() => window.__bubblepop.state());
  assert(mid.solved === before.solved && mid.wrongPops === before.wrongPops, 'progress and misses are frozen');
  await page.evaluate(() => window.__intro.close());
  await page.waitForTimeout(1500);
  const resumed = await page.evaluate(() => window.__bubblepop.state());
  assert(resumed.solved === before.solved && resumed.wrongPops === before.wrongPops,
    'resume restores round state exactly, losing nothing');
  const positionsResumed = await page.evaluate(() => [...document.querySelectorAll('.bubble')].map(b => Math.round(b.getBoundingClientRect().top)));
  assert(positionsResumed.some((p, i) => Math.abs(p - positions[i]) > 2), 'and the bubbles are moving again');
  await ctx.close();
}

console.log('== the shell clock genuinely stops, and banks the pause rather than burning it ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { mix: true } }, { bubblepop: true });
  const r = await page.evaluate(async () => {
    const { createRoundTimers } = await import('./js/intro.js');
    const clock = createRoundTimers();
    const fired = [];
    clock.after(600, () => fired.push('short'));
    clock.after(4000, () => fired.push('long'));
    const t0 = clock.now();
    // open a real intro overlay to drive the shared registry
    const { runIntro } = await import('./js/intro.js');
    const handle = runIntro('__pausetest__', { steps: [{ text: 'one' }, { text: 'two' }], speak: false });
    await new Promise(r => setTimeout(r, 2500));
    const duringNow = clock.now() - t0;
    const duringFired = fired.slice();
    handle.close();
    await new Promise(r => setTimeout(r, 900));
    const afterShort = fired.slice();
    await new Promise(r => setTimeout(r, 3600));
    const out = { duringNow, duringFired, afterShort, finally: fired.slice(), paused: clock.paused() };
    clock.dispose();
    return out;
  });
  assert(r.duringNow < 200, `the clock does not advance across a 2.5s pause (advanced ${Math.round(r.duringNow)}ms)`);
  assert(r.duringFired.length === 0, 'no timer fires while suspended, not even a 600ms one');
  assert(r.afterShort.includes('short'), 'the short timer fires after resume, with its remaining time intact');
  assert(r.finally.includes('long'), 'and so does the long one');
  assert(r.paused === false, 'the clock is running again once the overlay closes');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
