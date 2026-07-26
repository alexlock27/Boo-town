// tests/r12s2-tricky-fair.mjs â€” RUN12 S2: the Tricky Pile is fair.
//
// A child who pauses to think must never be punished for thinking. An UNATTEMPTED question
// (a note passing the line, a bubble floating away, a round ending mid-question) is a
// non-event: it reaches neither the Tricky Pile nor the wrong-answer ledger. Only a question
// she actually answered wrongly does.
//
// This is the suite that did not exist when the bug shipped: nothing ever drove a round in
// which the player simply does not play.
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  âœ— FAIL:', m); } else console.log('  âœ“', m); };

// ---- 1. the contract is structural, not a convention -------------------------------
console.log('== the collector API makes an unattempted record impossible ==');
{
  const src = readFileSync('js/trickypile.js', 'utf8');
  assert(/addAttempted\s*\(/.test(src), 'the collector exposes addAttempted()');
  assert(/noteUnattempted\s*\(/.test(src), 'the collector exposes noteUnattempted()');
  assert(!/^\s*add\s*\(item\)/m.test(src), 'there is no generic add() left to call by accident');
  const body = src.slice(src.indexOf('noteUnattempted'), src.indexOf('noteUnattempted') + 120);
  assert(!/items\.push|trickyPile/.test(body), 'noteUnattempted() records nothing');
}

console.log('== no game can reach the pile except through addAttempted ==');
{
  function walk(dir) {
    const out = [];
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (n.endsWith('.js')) out.push(p);
    }
    return out;
  }
  const offenders = [];
  for (const f of walk('js')) {
    if (f.endsWith('trickypile.js')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/collector\.(\w+)\s*\(/g)) {
      if (!['addAttempted', 'noteUnattempted', 'items', 'unattemptedCount'].includes(m[1])) offenders.push(`${f}: collector.${m[1]}()`);
    }
  }
  assert(offenders.length === 0, `every collector call site uses the fair API${offenders.length ? ' â†’ ' + offenders.join(', ') : ''}`);
}

// ---- 2. drive real rounds -----------------------------------------------------------
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1, boo_plum: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  ledger: {}, trickyPile: [],
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { beat: true, bubblepop: true, dash: true, bounce: true, feedboos: true, spellboo: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
async function open(route, params) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(500);
  return { ctx, page };
}
const ledgerMisses = (page) => page.evaluate(() =>
  Object.values(window.BooTown.State.getState().ledger || {}).reduce((n, e) => n + (e.misses || 0), 0));
const pile = (page) => page.evaluate(() => ({
  tricky: (window.__tricky ? window.__tricky.items() : []).length,
  unattempted: window.__tricky ? window.__tricky.unattemptedCount() : -1,
  persisted: (window.BooTown.State.getState().trickyPile || []).length
}));

console.log('== Boo Beat: a round where she never taps records nothing ==');
{
  const { ctx, page } = await open('beat', { resume: { mix: true } });
  const before = await ledgerMisses(page);
  // six expiries: three questions, each expiring twice (the first expiry re-asks)
  await page.evaluate(async () => {
    window.__beat.rush(true);
    // RUN14 U2: a question trio now lands on the musical phrase, so a fixed sleep no
    // longer lines up with "the next question is askable". Wait for the state instead.
    const ready = async () => {
      for (let i = 0; i < 200; i++) {
        const st = window.__beat.state();
        if (!st.resolving && st.notes > 0) return true;
        await new Promise(r => setTimeout(r, 50));
      }
      return false;
    };
    for (let i = 0; i < 6; i++) { if (!await ready()) break; window.__beat.missNow(); }
  });
  await page.waitForTimeout(600);
  const after = await ledgerMisses(page);
  const p = await pile(page);
  const st = await page.evaluate(() => window.__beat.state());
  assert(p.unattempted >= 3, `the expiry path ran (${p.unattempted} unattempted notes)`);
  assert(p.tricky === 0, `ZERO tricky items from a round she never played (${p.tricky})`);
  assert(after === before, `ZERO wrong-answer ledger entries (${before} â†’ ${after})`);
  assert(p.persisted === 0, 'nothing was persisted into save.trickyPile');
  assert(st.misses >= 3, `star maths unchanged: misses still counted (${st.misses})`);
  await ctx.close();
}

console.log('== Boo Beat: two genuine wrong answers record exactly those two ==');
{
  const { ctx, page } = await open('beat', { resume: { mix: true } });
  const before = await ledgerMisses(page);
  // two questions, each tapped wrongly twice (the first wrong tap re-asks)
  await page.evaluate(async () => {
    window.__beat.rush(true);
    // RUN14 U2: a question trio now lands on the musical phrase, so a fixed sleep no
    // longer lines up with "the next question is askable". Wait for the state instead.
    const ready = async () => {
      for (let i = 0; i < 200; i++) {
        const st = window.__beat.state();
        if (!st.resolving && st.notes > 0) return true;
        await new Promise(r => setTimeout(r, 50));
      }
      return false;
    };
    for (let i = 0; i < 4; i++) { if (!await ready()) break; window.__beat.tapWrong(); }
  });
  await page.waitForTimeout(600);
  const after = await ledgerMisses(page);
  const p = await pile(page);
  const st = await page.evaluate(() => window.__beat.state());
  assert(p.tricky === 2, `exactly the two attempted-wrong questions are in the pile (${p.tricky})`);
  assert(after - before === 2, `exactly two wrong-answer ledger entries (${after - before})`);
  assert(p.unattempted === 0, 'no expiry was recorded on a fully-attempted round');
  assert(st.misses >= 2, `star maths unchanged: misses counted the same way (${st.misses})`);
  await ctx.close();
}

console.log('== Boo Beat: a mixed round keeps only the attempted wrong ones ==');
{
  const { ctx, page } = await open('beat', { resume: { mix: true } });
  const before = await ledgerMisses(page);
  await page.evaluate(async () => {
    window.__beat.rush(true);
    // RUN14 U2: a question trio now lands on the musical phrase, so a fixed sleep no
    // longer lines up with "the next question is askable". Wait for the state instead.
    const ready = async () => {
      for (let i = 0; i < 200; i++) {
        const st = window.__beat.state();
        if (!st.resolving && st.notes > 0) return true;
        await new Promise(r => setTimeout(r, 50));
      }
      return false;
    };
    const step = async (fn) => { await ready(); fn(); await new Promise(r => setTimeout(r, 120)); };
    await step(() => window.__beat.tapWrong());   // Q1 first wrong -> re-ask
    await step(() => window.__beat.tapWrong());   // Q1 second wrong -> RECORDED
    await step(() => window.__beat.missNow());    // Q2 first expiry -> re-ask
    await step(() => window.__beat.missNow());    // Q2 second expiry -> NOT recorded
  });
  await page.waitForTimeout(600);
  const p = await pile(page);
  assert(p.tricky === 1, `one attempted-wrong question in the pile (${p.tricky})`);
  assert(p.unattempted === 1, `one expiry noted and discarded (${p.unattempted})`);
  assert((await ledgerMisses(page)) - before === 1, 'exactly one ledger miss');
  await ctx.close();
}

console.log('== Bubble Pop: bubbles that escape are never charged ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { mix: true } });
  const before = await ledgerMisses(page);
  await page.waitForTimeout(9000);            // let bubbles drift and recycle, untouched
  const p = await pile(page);
  assert(p.tricky === 0, `an escaped bubble adds nothing to the pile (${p.tricky})`);
  assert((await ledgerMisses(page)) === before, 'an escaped bubble adds no ledger miss');
  await ctx.close();
}

console.log('== Bubble Pop: a wrong pop still counts, exactly once ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { mix: true } });
  const before = await ledgerMisses(page);
  await page.evaluate(() => window.__bubblepop.popWrong());
  await page.waitForTimeout(800);
  const p = await pile(page);
  const wrongPops = await page.evaluate(() => window.__bubblepop.state().wrongPops);
  assert(wrongPops === 1, `the fixture really did pop a wrong bubble (${wrongPops})`);
  assert(p.tricky === 1, `a genuinely wrong pop lands in the pile (${p.tricky})`);
  assert((await ledgerMisses(page)) - before === 1, 'and records exactly one ledger miss');
  await ctx.close();
}

console.log('== Boo Bounce: losing balls and clearing walls charges nothing ==');
{
  const { ctx, page } = await open('bounce', { resume: { cat: 'add', level: 1, mix: false } });
  const before = await ledgerMisses(page);
  const p0 = await pile(page);
  assert(p0.tricky === 0 && p0.unattempted === 0, 'the round starts with a clean pile');
  // losing the ball is not an answer; neither is incidental brick destruction
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i++) { window.__bounce.loseBall(); await new Promise(r => setTimeout(r, 400)); }
  });
  await page.waitForTimeout(600);
  const p1 = await pile(page);
  assert(p1.tricky === 0, `three lost balls add nothing to the pile (${p1.tricky})`);
  assert((await ledgerMisses(page)) === before, 'three lost balls add no ledger miss');
  // and a genuinely wrong brick â€” an aimed shot at the wrong answer â€” still counts
  await page.evaluate(() => window.__bounce.breakWrong());
  await page.waitForTimeout(500);
  const p2 = await pile(page);
  assert(p2.tricky === 1, `an aimed hit on a wrong brick does count (${p2.tricky})`);
  assert((await ledgerMisses(page)) - before === 1, 'and records exactly one ledger miss');
  await ctx.close();
}

console.log('== Boo Dash: a bonk counts, a passing gate does not ==');
{
  const { ctx, page } = await open('dash', { resume: { cat: 'add', level: 1, mix: false } });
  const before = await ledgerMisses(page);
  await page.waitForTimeout(7000);            // let gate rows sweep past untouched
  const p0 = await pile(page);
  assert(p0.tricky === 0, `gates passing untapped add nothing to the pile (${p0.tricky})`);
  assert((await ledgerMisses(page)) === before, 'gates passing untapped add no ledger miss');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
