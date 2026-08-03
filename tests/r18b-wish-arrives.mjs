// tests/r18b-wish-arrives.mjs — RUN18B Y3: the wish arrives in the world.
//
// It used to be FILED. A toast said "New wish: RAINBOW! (in your Build drawer)" and a
// decorative sprite drifted beside the well for twenty seconds and deleted itself —
// nothing she could keep, nothing she could move, nothing she had to be there for. Now it
// lands as a REAL PLACEMENT at a real free spot, and the toast is gone.
//
// Expected runtime: ~22s (measured). Not @serial — the choreography is asserted by its outcome (a
// placement, a class, a line), not by frame sampling.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18b/y3';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (over = {}) => JSON.stringify(Object.assign({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  wishes: { unlocked: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, whatsnewVersion: 'x' },
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over));

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function openMeadow(saveText = save()) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), saveText);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  // A condition-wait, with the deadline a loaded machine needs: this suite boots the whole
  // app six times over, and 20s was enough alone and not enough back-to-back. It still
  // fails if a screen genuinely never renders — it just gets the time it really needs.
  // (The r5p5-phone precedent.)
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 40000 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'town', null, { timeout: 15000 });
  await page.waitForTimeout(1100);
  return { ctx, page };
}
const wishFor = async (page, word) => {
  await page.evaluate(() => window.__townLife && window.__townLife.openWishWell());
  await page.waitForFunction(() => !!window.__wishwell, null, { timeout: 8000 });
  await page.evaluate(w => window.__wishwell.spell(w), word);
  await page.waitForTimeout(900);   // the 300ms beat plus the render
};
const meadow = (page) => page.evaluate(() => {
  const s = window.BooTown.State.getState();
  return (s.town.areas.meadow.items || []).map(i => i.item);
});

// ---- 1. a NEW wish = exactly one placement + one unlock ---------------------------------
console.log('== 1. a new wish lands in the world, once ==');
{
  const { ctx, page } = await openMeadow();
  const before = await meadow(page);
  await wishFor(page, 'rocket');
  const after = await meadow(page);
  const placed = after.filter(i => i === 'wish_rocket');
  assert(!before.includes('wish_rocket'), 'the fixture starts with no rocket');
  assert(placed.length === 1, `EXACTLY ONE placement lands in the Meadow (${placed.length})`);
  const st = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    const node = document.querySelector('.t-item[data-item="wish_rocket"]');
    return {
      unlocked: Object.keys(s.wishes.unlocked || {}),
      inDom: !!node,
      arriveClass: node ? node.className.includes('wish-arrive') : false,
      said: (document.querySelector('.wish-said') || {}).textContent || null
    };
  });
  assert(st.unlocked.filter(w => w === 'rocket').length === 1, `and exactly one unlock (${JSON.stringify(st.unlocked)})`);
  assert(st.inDom, 'the rocket is rendered in the world');
  assert(st.arriveClass, 'and it arrived with the scale-in, not by simply appearing');
  assert(st.said === 'Your wish came true!', `Twiggy says so, in the world: "${st.said}"`);
  await page.screenshot({ path: SHOTS + '/arrived.png' });
  await ctx.close();
}

// ---- 2. the toast is gone ---------------------------------------------------------------
console.log('== 2. the toast that filed it away is deleted ==');
{
  const { ctx, page } = await openMeadow();
  await wishFor(page, 'kite');
  const toast = await page.evaluate(() => ({
    any: !!document.querySelector('.wish-toast'),
    text: [...document.querySelectorAll('[class*="toast"]')].map(n => n.textContent).join(' | ')
  }));
  assert(!toast.any, 'no .wish-toast is raised');
  assert(!/Build drawer/.test(toast.text), `and nothing on screen files it away in words ("${toast.text}")`);
  const src = await page.evaluate(async () => (await fetch('./js/wishwell.js')).text());
  assert(!/showToast\s*\(/.test(src), 'the showToast CALL is gone from js/wishwell.js, not merely hidden');
  await ctx.close();
}

// ---- 3. a repeat wish never duplicates --------------------------------------------------
// RUN21A item 4 moved this pin. A duplicate grant used to be told to her by the town's own
// corner line ("Another crown! It's in your Build drawer.") — the sayInWorld call in
// grantWishIntoWorld's !wasNew branch. That call is gone. The WELL now owns the moment: it
// writes AND speaks the line in its own line slot (the p.wish-line inside .wish-head),
// replays the wishListen wobble on .wish-panel, and stays open 3.5s instead of 1.5s so the
// line can actually be read. So the same three questions — did it duplicate, was she told,
// was she told in ONE place — are asked of the new contract, at the same strictness.
console.log('== 3. wishing twice does not make two ==');
{
  const { ctx, page } = await openMeadow();
  await wishFor(page, 'crown');
  const once = (await meadow(page)).filter(i => i === 'wish_crown').length;
  // The FIRST crown is a new word, so the town DOES raise its own .wish-said. Tag it here.
  // The old `said.count === 1` passed only incidentally — that leftover line was still on
  // screen and nobody had checked whose it was. Tagging makes the intent explicit: after
  // the duplicate, any UNTAGGED .wish-said is a newly raised toast, which is exactly what
  // item 4 abolished.
  const first = await page.evaluate(() => {
    const n = document.querySelector('.wish-said');
    if (n) n.dataset.fromFirstWish = '1';
    return n ? n.textContent : null;
  });
  assert(first === 'Your wish came true!', `the FIRST (new) crown still raises the world line: "${first}"`);
  await page.evaluate(() => window.__wishwell && window.__wishwell.close());
  await page.waitForTimeout(300);
  await wishFor(page, 'crown');   // ~900ms after the duplicate submit
  const twice = (await meadow(page)).filter(i => i === 'wish_crown').length;
  const dup = await page.evaluate(() => {
    const panel = document.querySelector('.wish-panel');
    const lines = panel ? [...panel.querySelectorAll('.wish-head .wish-line')] : [];
    const all = [...document.querySelectorAll('.wish-said')];
    return {
      lineText: lines.length ? lines[lines.length - 1].textContent : null,
      lineCount: lines.length,
      listening: !!(panel && panel.classList.contains('listening')),
      wellUp: !!document.querySelector('.overlay.wish-overlay'),
      saidTotal: all.length,
      raised: all.filter(n => !n.dataset.fromFirstWish).map(n => n.textContent)
    };
  });
  assert(once === 1, `the first crown places once (${once})`);
  assert(twice === 1, `and the second wish adds NO second placement (${twice})`);
  assert(dup.raised.length === 0, `the duplicate raises NO new .wish-said toast (${JSON.stringify(dup.raised)})`);
  assert(dup.saidTotal <= 1, `only ONE line is ever on screen at a time (${dup.saidTotal})`);
  assert(dup.lineCount === 1, `the well has exactly one line slot to say it in (${dup.lineCount})`);
  assert(dup.lineText === "Ooh — another crown! It's tucked in your drawer for later.",
    `and SHE IS TOLD, in the well's own line, verbatim: "${dup.lineText}"`);
  assert(dup.listening, 'and the well sprite replays the wishListen wobble (.wish-panel.listening)');
  assert(dup.wellUp, 'the well is still up, so the line is somewhere she is already looking');
  // The linger is the point of the change: at 1500ms the OLD timer would already have shut
  // the well and taken the line with it. Wait past it and the line must still be readable.
  await page.waitForTimeout(900);   // now ~1.8s past the submit, i.e. past the old 1500ms close
  const lingered = await page.evaluate(() => {
    const panel = document.querySelector('.wish-panel');
    const line = panel && panel.querySelector('.wish-head .wish-line');
    return { wellUp: !!document.querySelector('.overlay.wish-overlay'), text: line ? line.textContent : null };
  });
  assert(lingered.wellUp && lingered.text === "Ooh — another crown! It's tucked in your drawer for later.",
    `the well LINGERS past the old 1.5s so the line can be read (up=${lingered.wellUp}, "${lingered.text}")`);
  // ...and the linger is bounded: 3.5s, then the town comes back. Not a stuck modal.
  await page.waitForFunction(() => !document.querySelector('.overlay.wish-overlay'), null, { timeout: 5000 }).catch(() => {});
  const closed = await page.evaluate(() => !document.querySelector('.overlay.wish-overlay'));
  assert(closed, 'and then hands the town back on its own — a longer beat, not a stuck well');
  await ctx.close();
}

// ---- 4. a packed area falls back to the drawer, in as many words ------------------------
console.log('== 4. a packed Meadow says so, and does not drop it silently ==');
{
  // fill row 1 across its whole width so no free spot survives MIN_SPACING
  const full = JSON.parse(save());
  full.town.areas.meadow.items = Array.from({ length: 20 }, (_, i) => ({ zone: 'meadow', x: +(0.04 + i * 0.048).toFixed(3), row: 1, item: 'deco_tree' }));
  const { ctx, page } = await openMeadow(JSON.stringify(full));
  await wishFor(page, 'whale');
  const r = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return {
      placed: (s.town.areas.meadow.items || []).filter(i => i.item === 'wish_whale').length,
      unlocked: !!(s.wishes.unlocked || {}).whale,
      said: (document.querySelector('.wish-said') || {}).textContent || null
    };
  });
  assert(r.placed === 0, 'nothing is forced into a packed row');
  assert(r.unlocked === true, 'but the wish is still UNLOCKED — she spelled it, she keeps it');
  assert(r.said === 'Your wish is in your Build drawer — the Meadow is packed!',
    `and the fallback line is the authored one, verbatim: "${r.said}"`);
  await ctx.close();
}

// ---- 5. the idle hint: unwished words only, once per visit ------------------------------
console.log('== 5. the idle hint suggests only what she has never wished for ==');
{
  // she already owns most of the lexicon; the hint must never suggest one of those
  const owned = {};
  for (const w of ['sun', 'star', 'moon', 'cloud', 'rainbow', 'rocket', 'robot', 'crown', 'cake', 'kite']) owned[w] = true;
  const { ctx, page } = await openMeadow(save({ wishes: { unlocked: owned } }));
  await page.evaluate(() => window.__townLife && window.__townLife.openWishWell());
  await page.waitForFunction(() => !!window.__wishwell, null, { timeout: 8000 });
  const r = await page.evaluate(async () => {
    const w = window.__wishwell;
    const before = w.idleHint();
    const word = w.forceIdleHint();
    const again = w.forceIdleHint();          // the cap: a second attempt must change nothing
    const state = w.idleHint();
    return { before, word, again, state, unwished: w.unwished() };
  });
  assert(r.before.shown === false, 'no hint before the idle wait');
  assert(!!r.word, `the hint chose a word ("${r.word}")`);
  assert(!['sun', 'star', 'moon', 'cloud', 'rainbow', 'rocket', 'robot', 'crown', 'cake', 'kite'].includes(r.word),
    'and it is NOT one she has already wished for');
  assert(r.unwished.includes(r.word), 'it comes from the unwished pool');
  assert(r.state.word === r.word, `ONCE per visit — a second attempt changes nothing (still "${r.state.word}")`);
  // RUN18B Y1/Y3 resolution (Dispatch, 2026-07-28): the SIGHT of the spelling keeps the
  // authored 600ms cadence, letter by letter; the SOUND is chained through Y1's queue so no
  // letter is ever cut. So the line is NOT complete the instant the hint fires.
  const partial = await page.evaluate(() => window.__wishwell.idleHint().text);
  const lettersNow = (partial.match(/[A-Z]/g) || []).length;
  assert(lettersNow < r.word.length, `the spelling is revealed a letter at a time (${lettersNow} of ${r.word.length} at the start)`);
  const expected = `Someone once wished for a ${r.word.toUpperCase().split('').join('-')}…`;
  await page.waitForFunction(want => window.__wishwell.idleHint().text === want, expected,
    { timeout: 600 * (r.word.length + 3) });
  const full = await page.evaluate(() => window.__wishwell.idleHint().text);
  assert(full === expected, `and lands on the whole word, verbatim: "${full}"`);
  await ctx.close();
}

// ---- 6. the constants, and living wishes untouched --------------------------------------
console.log('== 6. the authored constants, and the living wishes ==');
{
  const { ctx, page } = await openMeadow();
  const c = await page.evaluate(async () => {
    const w = await import('./js/wishwell.js');
    const d = await import('./data/wishes.js');
    return { idle: w.WISH_HINT_IDLE_MS, letter: w.WISH_HINT_LETTER_MS, living: d.LIVING_WISHES };
  });
  assert(c.idle === 8000, `WISH_HINT_IDLE_MS = 8000 (got ${c.idle})`);
  assert(c.letter === 600, `letters are spoken 600ms apart (got ${c.letter})`);
  assert(String(c.living) === 'butterfly,fish,frog', `the living wishes are unchanged (${c.living})`);
  // and a living wish still places like any other
  await wishFor(page, 'frog');
  const frogs = (await meadow(page)).filter(i => i === 'wish_frog').length;
  assert(frogs === 1, `a living wish arrives the same way (${frogs} frog placed)`);
  await ctx.close();
}

// ---- 7. THE MOMENT IS WITNESSABLE ------------------------------------------------------
// The mechanics were all correct and the ten seconds she actually experiences were empty:
// the item and its puff landed ~954px outside a camera that never panned, the line
// measured 0% visible in every configuration, and the well's own overlay stayed up over
// the whole thing. With the voice muted — an ordinary state — pressing WISH produced
// nothing she could perceive. (Found by the playtest critic.)
console.log('== 7. she can actually SEE it happen ==');
for (const [W, H] of [[1024, 768], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  // voice OFF on purpose: if the moment only exists in speech, it does not exist.
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save({ settings: { sound: false, music: false, voice: false, content: 'full' } }));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 40000 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'town', null, { timeout: 15000 });
  await page.waitForTimeout(1100);
  await wishFor(page, 'balloon');
  await page.waitForTimeout(1400);   // the well hands the moment over at 1500ms
  const seen = await page.evaluate(() => {
    const vis = (n) => {
      if (!n) return null;
      const r = n.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return { onScreen: false, topmost: false };
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      // The line is deliberately pointer-transparent, and elementFromPoint SKIPS such
      // elements — so asking it directly would report the thing behind and call a
      // perfectly visible caption occluded. Measure PAINT order by making it hit-testable
      // for exactly one call, then putting it back.
      const prev = n.style.pointerEvents;
      n.style.pointerEvents = 'auto';
      const top = document.elementFromPoint(cx, cy);
      n.style.pointerEvents = prev;
      return {
        onScreen: r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight,
        topmost: !!(top && (n === top || n.contains(top) || top.contains(n))),
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
      };
    };
    return {
      item: vis(document.querySelector('.t-item[data-item="wish_balloon"]')),
      line: vis(document.querySelector('.wish-said')),
      wellStillUp: !!document.querySelector('.overlay.wish-overlay')
    };
  });
  assert(seen.item && seen.item.onScreen, `${W}px: the wish lands INSIDE the camera, not off in the band (${JSON.stringify(seen.item && seen.item.rect)})`);
  assert(seen.line && seen.line.onScreen && seen.line.topmost,
    `${W}px: and "Your wish came true!" is actually visible, on top (${JSON.stringify(seen.line && seen.line.rect)})`);
  assert(!seen.wellStillUp, `${W}px: the well has got out of the way so she can reach what arrived`);
  await page.screenshot({ path: `${SHOTS}/witnessed-${W}.png` });
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
