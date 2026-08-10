// tests/r21g-band.mjs — RUN21G "The Band Plays Properly": every pack ACCEPT.
// Item 1: the ✨ target lives ON the wanted key (centring proved by rect measurement at
//         1024x768 / 768x1024 / 390x844); the lane is a readout; free play never wrong.
// Item 2: a finished song is a moment — one celebration, verbatim line, two routable chips,
//         play-again reset, reduced-motion parity.
// Item 3: four real strings — crossing order both directions, no skipped strings, authored
//         velocity (slow gentle / fast loud), audible retune per chord pad, plucks record
//         as {i:'pluck',v,t} into instrument:'guitar' layers, legacy {i:'guitar'} chord
//         jams play the full chord voice unchanged.
// Item 4: strum-along — Strum it 🎸 on Hits only, the wanted PAD carries the ✨, the bar
//         counter, the ≥2-string rule, sixteen correct strums → item 2's moment verbatim,
//         and free-play guitar left exactly as it was.
// Runtime: 34s measured on the reference box — budget ≤90s (board law; stated per RUN21G pack).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/r21g';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = {
  version: 6, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, boo_beam: 1 },
  stars: { total: 300, byGame: {} }, meter: 0, boxes: 0, opened: 1, pity: { commons: 0 },
  town: { areas: {} }, nicknames: {}, equips: {}, catBest: {}, ledger: {}, delights: {},
  settings: { sound: true, music: false, voice: false, content: 'full' },
  seen: {}, age: 8, ageAsked: true
};
const GUIDE_LINES = ["A whole song! The Boos want an encore!", "You played every single note. Star musician!"];

const browser = await chromium.launch();

async function scenePage(route, params, { viewport = { width: 1024, height: 768 }, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.mouse.click(Math.floor(viewport.width / 2), Math.floor(viewport.height / 2));   // audio unlock
  await page.evaluate(async () => { const m = await import('./js/sfx.js'); m.setAudioLog(true); });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params || {}]);
  await page.waitForSelector(route === 'band-guitar' ? '.p6-strings' : '.p6-key');
  return { ctx, page };
}

const clearLog = p => p.evaluate(async () => { const m = await import('./js/sfx.js'); m.getAudioLog().length = 0; });
const noteTags = p => p.evaluate(async () => { const m = await import('./js/sfx.js'); return m.getAudioLog().filter(e => e.kind === 'note').map(e => e.tag); });
const pluckSeq = tags => tags.filter(t => t.startsWith('pluck:')).filter((t, i, a) => i === 0 || t !== a[i - 1]).map(t => +t.slice(6));
const panelBox = p => p.evaluate(() => { const b = document.querySelector('.p6-strings').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });

// ✨ badge centre vs wanted-key centre, measured from the page's own rects/used values
const MEASURE = `(() => {
  const key = document.querySelector('.p6-key.wanted');
  if (!key) return null;
  const keyRect = key.getBoundingClientRect();
  const cs = getComputedStyle(key, '::after');
  const afterW = parseFloat(cs.width);
  const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
  const afterCentre = keyRect.left + key.clientLeft + parseFloat(cs.left) + m.e + afterW / 2;
  const field = document.querySelector('.band-playfield');
  return {
    idx: key.dataset.idx,
    delta: +(afterCentre - (keyRect.left + keyRect.width / 2)).toFixed(2),
    aboveField: +(field.getBoundingClientRect().top - (keyRect.top + parseFloat(cs.top))).toFixed(1),
    fieldOverflow: getComputedStyle(field).overflow
  };
})()`;

// ---------- Item 1 ----------
console.log('== Item 1: the sparkle sits ON the key (all three viewports) ==');
for (const [w, h] of [[1024, 768], [768, 1024], [390, 844]]) {
  const { ctx, page } = await scenePage('band-keys', { song: 'twinkle' }, { viewport: { width: w, height: h } });
  for (const target of [0, 3, 7]) {
    await page.evaluate(n => window.__bandScene.qaSetSongPos(n), target);
    const meas = await page.evaluate(MEASURE);
    ok(meas && Math.abs(meas.delta) <= 3, `${w}x${h} pos ${target}: ✨ centre within 3px of key ${meas && meas.idx} centre (Δ ${meas && meas.delta}px)`);
    ok(meas && meas.fieldOverflow === 'visible' && meas.aboveField > 0, `${w}x${h} pos ${target}: badge unclipped ${meas && meas.aboveField}px above the playfield`);
  }
  if (w === 1024) {
    // free play is never wrong (sound + no advance + no wobble), only at desktop — the
    // handler is viewport-independent
    await page.evaluate(() => window.__bandScene.qaSetSongPos(0));
    await clearLog(page);
    await page.click('.p6-key[data-idx="5"]');   // twinkle wants 0 (C); press A instead
    const held = await page.evaluate(() => window.__bandScene.songPosition());
    const tags = await noteTags(page);
    ok(held === 0, `wrong key does not advance (0 → ${held})`);
    ok(tags.includes('key'), 'wrong key still sings (sfx tag `key`)');
    ok(!(await page.evaluate(() => !!document.querySelector('.cel-wobble, .cel-flash-wrong'))), 'no wobble, no failure state');
    // the wanted key advances exactly once and the counter pulses within 200ms of the
    // advance (twinkle C→C: same sparkle, visible tick)
    await page.evaluate(() => {
      window.__r21gTick = new Promise(res => {
        const mo = new MutationObserver(() => {
          const c = document.querySelector('.band-lane-count');
          if (c && c.classList.contains('cel-tick')) { mo.disconnect(); res(performance.now() - window.__r21gT0); }
        });
        mo.observe(document.querySelector('.band-sparkle-lane'), { attributes: true, subtree: true, attributeFilter: ['class'], childList: true });
        setTimeout(() => { mo.disconnect(); res(-1); }, 1500);
      });
      window.__r21gT0 = performance.now();
    });
    await page.click('.p6-key[data-idx="0"]');
    const tickMs = await page.evaluate(() => window.__r21gTick);
    ok(await page.evaluate(() => window.__bandScene.songPosition()) === 1, 'wanted key advances exactly once');
    ok(tickMs >= 0 && tickMs <= 200, `counter pulses within 200ms of the press (${tickMs === -1 ? 'never' : Math.round(tickMs) + 'ms'})`);
    // AA on the two new lane texts over the real composited backdrop
    const contrast = await page.evaluate(() => {
      const parse = s => { const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
      const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
      const ratio = (F, B) => { const [l1, l2] = [lum(F), lum(B)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
      const bgs = [];
      let n = document.querySelector('.band-sparkle-lane');
      while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) bgs.push(c); n = n.parentElement; }
      const body = parse(getComputedStyle(document.body).backgroundColor); if (body && body[3] > 0) bgs.push(body);
      const html = parse(getComputedStyle(document.documentElement).backgroundColor); if (html && html[3] > 0) bgs.push(html);
      let bg = [255, 255, 255];
      for (let i = bgs.length - 1; i >= 0; i--) bg = over(bgs[i], bg);
      return {
        next: ratio(over(parse(getComputedStyle(document.querySelector('.band-lane-next')).color), bg), bg),
        count: ratio(over(parse(getComputedStyle(document.querySelector('.band-lane-count')).color), bg), bg)
      };
    });
    ok(contrast.next >= 4.5, `.band-lane-next AA (${contrast.next.toFixed(2)}:1)`);
    ok(contrast.count >= 4.5, `.band-lane-count AA (${contrast.count.toFixed(2)}:1)`);
    ok(!(await page.evaluate(() => !!document.querySelector('.band-lane-marker'))), 'the old lane marker element is gone');
  }
  await page.screenshot({ path: `${SHOTS}/keys-${w}x${h}.png` });
  await ctx.close();
}

// ---------- Item 2 ----------
console.log('== Item 2: songs end, and it\'s a moment ==');
{
  const { ctx, page } = await scenePage('band-keys', { song: 'twinkle' });
  ok((await page.evaluate(() => document.querySelector('.band-scene-status').textContent)) === 'Twinkle Twinkle — follow the ✨', 'default status: "{song} — follow the ✨"');
  await page.evaluate(() => window.__standards.reset());
  // the honest run: all 42 notes through the real key handler
  for (let guard = 0; guard < 60; guard++) {
    if (await page.evaluate(() => window.__bandScene.songDone())) break;
    const wanted = await page.evaluate(() => window.__bandScene.wantedKey());
    if (wanted < 0) break;
    await page.click(`.p6-key[data-idx="${wanted}"]`);
  }
  ok(await page.evaluate(() => window.__bandScene.songDone()), 'all 42 twinkle notes → done');
  const state = await page.evaluate(() => ({
    cels: window.__standards.celebrations(),
    statusText: document.querySelector('.band-scene-status').textContent,
    chips: [...document.querySelectorAll('.band-scene-status button')].map(b => b.textContent),
    wantedLeft: document.querySelectorAll('.p6-key.wanted').length,
    count: (document.querySelector('.band-lane-count') || {}).textContent
  }));
  ok(state.cels.length === 1, `celebration fires exactly ONCE (${state.cels.length})`);
  ok(state.cels.length && GUIDE_LINES.includes(state.cels[0].line), `guide speaks an authored L_BAND_SONGDONE line`);
  ok(state.statusText.includes('You played the whole of Twinkle Twinkle! 🎵'), 'verbatim completion line');
  ok(state.chips.join('|') === 'Play it again|More songs ✨', `both chips present (${state.chips.join(' | ')})`);
  ok(state.wantedLeft === 0 && state.count === '✨ 42 of 42', `sparkle rests, count 42 of 42 (${state.count})`);
  await page.screenshot({ path: `${SHOTS}/song-done-1024x768.png` });
  // keys stay playable while done, and nothing re-celebrates
  await clearLog(page);
  await page.click('.p6-key[data-idx="6"]');
  ok((await noteTags(page)).includes('key'), 'keys stay fully playable while done');
  ok(await page.evaluate(() => window.__standards.celebrations().length) === 1, 'free play after the end does not re-celebrate');
  // Play it again → note 1 of 42, ✨ on C
  await page.click('.band-scene-status button:has-text("Play it again")');
  const reset = await page.evaluate(() => ({ pos: window.__bandScene.songPosition(), done: window.__bandScene.songDone(), wanted: window.__bandScene.wantedKey(), count: document.querySelector('.band-lane-count').textContent }));
  ok(reset.pos === 0 && !reset.done && reset.wanted === 0 && reset.count === '✨ 1 of 42', `Play it again restores note 1 of 42, ✨ on C (${JSON.stringify(reset)})`);
  // second completion (fast-forward) → More songs ✨ routes
  await page.evaluate(() => window.__bandScene.qaSetSongPos(41));
  await page.click(`.p6-key[data-idx="${await page.evaluate(() => window.__bandScene.wantedKey())}"]`);
  ok(await page.evaluate(() => window.__standards.celebrations().length) === 2, 'a replayed song celebrates once more');
  await page.click('.band-scene-status button:has-text("More songs ✨")');
  await page.waitForSelector('.band-song-list', { timeout: 4000 });
  ok(true, 'More songs ✨ routes to band-songs');
  await ctx.close();
}
console.log('== Item 2 under reduced motion: the moment still lands ==');
{
  const { ctx, page } = await scenePage('band-keys', { song: 'twinkle' }, { reduced: true });
  await page.evaluate(() => window.__bandScene.qaSetSongPos(41));
  await page.click(`.p6-key[data-idx="${await page.evaluate(() => window.__bandScene.wantedKey())}"]`);
  const rm = await page.evaluate(() => ({
    statusText: document.querySelector('.band-scene-status').textContent,
    chips: document.querySelectorAll('.band-scene-status button').length,
    pop: document.querySelector('.band-scene-status').classList.contains('cel-pop')
  }));
  ok(rm.statusText.includes('You played the whole of Twinkle Twinkle! 🎵') && rm.chips === 2, 'reduced motion: line + both chips');
  ok(!rm.pop, 'reduced motion: no cel-pop scale beat');
  await ctx.close();
}

// ---------- Item 3 ----------
console.log('== Item 3: strings — crossing order, velocity, retune ==');
{
  const { ctx, page } = await scenePage('band-guitar', null);
  const box = await panelBox(page);
  const cx = box.x + box.w / 2;
  // ACCEPT 1: downward ≈120ms crosses all four, ascending; upward descending; flick skips none
  await clearLog(page);
  await page.mouse.move(cx, box.y + 6); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(cx, box.y + 6 + ((box.h - 12) * i) / 8); await sleep(12); }
  await page.mouse.up();
  const downSeq = pluckSeq(await noteTags(page));
  ok(downSeq.length === 4 && downSeq.every((s, i, a) => i === 0 || s > a[i - 1]), `downward drag = four ascending plucks (${downSeq.join(' → ')})`);
  await sleep(120); await clearLog(page);
  await page.mouse.move(cx, box.y + box.h - 6); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(cx, box.y + box.h - 6 - ((box.h - 12) * i) / 8); await sleep(12); }
  await page.mouse.up();
  const upSeq = pluckSeq(await noteTags(page));
  ok(upSeq.length === 4 && upSeq.every((s, i, a) => i === 0 || s < a[i - 1]), `upward drag = four descending plucks (${upSeq.join(' → ')})`);
  await sleep(120); await clearLog(page);
  await page.mouse.move(cx, box.y + 6); await page.mouse.down();
  await page.mouse.move(cx, box.y + box.h - 6, { steps: 2 });
  await page.mouse.up();
  ok(pluckSeq(await noteTags(page)).length === 4, 'a 2-step flick fires every string (fast swipes skip nothing)');
  // ACCEPT 2: velocity — authored formula: slow ≈0.85 max (asserted ≤0.9), fast ≥1.1
  const t0 = await page.evaluate(() => performance.now());
  await page.mouse.move(cx, box.y + 8); await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(cx, box.y + 8 + (200 * i) / 20); await sleep(28); }
  await page.mouse.up();
  const slowVels = await page.evaluate(t => window.__bandScene.guitar().plucks().filter(x => !x.retune && x.at > t && x.vel !== 1).map(x => x.vel), t0);
  const t1 = await page.evaluate(() => performance.now());
  await sleep(150);
  await page.mouse.move(cx, box.y + 208); await page.mouse.down();
  for (let i = 1; i <= 4; i++) { await page.mouse.move(cx, box.y + 208 - (200 * i) / 4); await sleep(14); }
  await page.mouse.up();
  const fastVels = await page.evaluate(t => window.__bandScene.guitar().plucks().filter(x => !x.retune && x.at > t && x.vel !== 1).map(x => x.vel), t1);
  ok(slowVels.length >= 1 && Math.max(...slowVels) <= 0.9, `slow drag (200px/600ms) stays gentle (max ${slowVels.length ? Math.max(...slowVels).toFixed(2) : '-'} ≤ 0.9)`);
  ok(fastVels.length >= 1 && Math.max(...fastVels) >= 1.1, `fast flick (200px/80ms) hits hard (max ${fastVels.length ? Math.max(...fastVels).toFixed(2) : '-'} ≥ 1.1)`);
  // ACCEPT 3: chord pads retune, audibly, and top string = lowest of the chord
  await clearLog(page);
  await page.click('.p6-chord:has-text("G")');
  await sleep(300);
  ok(JSON.stringify(pluckSeq(await noteTags(page))) === JSON.stringify([7, 11, 14, 19]), 'selecting G is heard low→high (7 11 14 19)');
  await clearLog(page);
  await page.mouse.click(cx, box.y + box.h / 8);
  ok(JSON.stringify(pluckSeq(await noteTags(page))) === JSON.stringify([7]), 'G: top string plucks semi 7');
  await page.click('.p6-chord:has-text("Am")');
  await sleep(300); await clearLog(page);
  await page.mouse.click(cx, box.y + box.h / 8);
  ok(JSON.stringify(pluckSeq(await noteTags(page))) === JSON.stringify([9]), 'Am: top string plucks semi 9');
  ok(await page.evaluate(() => window.__bandScene.performerPlayed()), 'the performer Boo mirrors per pluck');
  await page.screenshot({ path: `${SHOTS}/guitar-1024x768.png` });
  await ctx.close();
}
console.log('== Item 3: recording, saved jam, legacy chord playback ==');
{
  const { ctx, page } = await scenePage('band-guitar', null);
  const box = await panelBox(page);
  const cx = box.x + box.w / 2;
  await page.evaluate(() => window.__bandScene.toggleRecord());
  await sleep(150);
  for (const dir of [1, -1]) {
    const from = dir === 1 ? box.y + 6 : box.y + box.h - 6;
    const to = dir === 1 ? box.y + box.h - 6 : box.y + 6;
    await page.mouse.move(cx, from); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(cx, from + ((to - from) * i) / 8); await sleep(14); }
    await page.mouse.up();
    await sleep(180);
  }
  const pass = await page.evaluate(() => window.__bandScene.events());
  ok(pass.length === 8 && pass.every(e => e.i === 'pluck' && typeof e.v === 'number' && typeof e.t === 'number'), `8 {i:'pluck',v,t} events captured (${pass.length})`);
  await page.evaluate(() => window.__bandScene.toggleRecord());
  await sleep(400);
  const saved = await page.evaluate(async () => {
    const { idbGet } = await import('./js/idb.js');
    const jam = await idbGet('jams', window.__bandScene.savedId());
    return jam && jam.layers.map(l => ({ instrument: l.instrument, n: l.events.length }));
  });
  ok(saved && saved.length === 1 && saved[0].instrument === 'guitar' && saved[0].n === 8, `saved layer is instrument:'guitar' with the 8 plucks (${JSON.stringify(saved)})`);
  await clearLog(page);
  await page.evaluate(async () => {
    const band = await import('./js/band.js');
    const { idbGet } = await import('./js/idb.js');
    const jam = await idbGet('jams', window.__bandScene.savedId());
    const ctl = band.startBandWatch(jam);
    await new Promise(r => setTimeout(r, (jam.dur || 2000) + 400));
    ctl.stop();
  });
  const playCount = (await noteTags(page)).filter(t => t.startsWith('pluck:')).length;
  ok(playCount === 16, `watch playback fires all 8 plucks (${playCount} envTones ÷ 2)`);
  // legacy compatibility is an ACCEPT: a pre-existing {i:'guitar'} chord jam plays unchanged
  await clearLog(page);
  await page.evaluate(async () => {
    const band = await import('./js/band.js');
    const ctl = band.startBandWatch({ id: 'legacy', layers: [{ instrument: 'guitar', events: [{ t: 0, i: 'guitar', v: 'C' }, { t: 300, i: 'guitar', v: 'G' }] }], dur: 900 });
    await new Promise(r => setTimeout(r, 1300));
    ctl.stop();
  });
  const legacy = await noteTags(page);
  ok(legacy.filter(t => t === 'guitar:C').length === 4 && legacy.filter(t => t === 'guitar:G').length === 4, 'legacy {i:\'guitar\'} chords still play the FULL chord voice (4 envTones each)');
  await ctx.close();
}
console.log('== Item 3 across viewports + reduced motion ==');
for (const [w, h] of [[768, 1024], [390, 844]]) {
  const { ctx, page } = await scenePage('band-guitar', null, { viewport: { width: w, height: h } });
  const rows = await page.evaluate(() => window.__bandScene.guitar().stringRects());
  ok(rows.length === 4 && rows.every(r => r.bottom - r.top >= 64), `${w}x${h}: four string rows, every one ≥64px tall (${rows.map(r => Math.round(r.bottom - r.top)).join(',')})`);
  await page.screenshot({ path: `${SHOTS}/guitar-${w}x${h}.png` });
  await ctx.close();
}
{
  const { ctx, page } = await scenePage('band-guitar', null, { reduced: true });
  const rm = await page.evaluate(async () => {
    const row = document.querySelector('.p6-string');
    const core = row.querySelector('.p6-string-core');
    const rest = getComputedStyle(core).opacity;
    row.classList.add('plucked');
    await new Promise(r => setTimeout(r, 150));
    return { svg: getComputedStyle(row.querySelector('svg')).animationName, rest, lit: getComputedStyle(core).opacity };
  });
  ok(rm.svg === 'none' && rm.rest === '0.5' && rm.lit === '1', `reduced motion: wiggle off, core line brightness-flash rides the transition (${rm.rest} → ${rm.lit})`);
  await ctx.close();
}

// ---------- Item 4 ----------
console.log('== Item 4: Strum it 🎸 exists on Hits only, and routes ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('band-songs'));
  await page.waitForSelector('.band-song-list');
  const cards = await page.evaluate(() => [...document.querySelectorAll('.band-song-card')].map(c => ({ name: c.querySelector('h3').textContent, strum: !!c.querySelector('.band-song-strum') })));
  const LITTLE = ['Twinkle Twinkle', 'Row Your Boat', 'Old MacDonald'];
  ok(cards.filter(c => !LITTLE.includes(c.name)).every(c => c.strum), 'every Boo Pop Hit offers Strum it 🎸');
  ok(cards.filter(c => LITTLE.includes(c.name)).every(c => !c.strum), 'Little Boo Songs have no strum button and nothing explains the absence');
  await page.click('.band-song-card:has-text("Golden Boo") .band-song-strum');
  await page.waitForSelector('.p6-strings', { timeout: 4000 });
  const routed = await page.evaluate(() => ({ song: window.__bandScene.song(), mode: window.__bandScene.playAlong() }));
  ok(routed.song === 'golden' && routed.mode === 'strum', `Strum it 🎸 opens the guitar in strum-along (${JSON.stringify(routed)})`);
  await ctx.close();
}
console.log('== Item 4 ACCEPT: golden Am F C G ×16 — correct strums advance, wrong ones never do ==');
{
  const { ctx, page } = await scenePage('band-guitar', { song: 'golden' });
  const b = await panelBox(page);
  const cx = b.x + b.w / 2;
  const strum = async () => {
    await page.mouse.move(cx, b.y + 6); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(cx, b.y + 6 + ((b.h - 12) * i) / 8); await sleep(12); }
    await page.mouse.up(); await sleep(40);
  };
  const start = await page.evaluate(() => ({ total: window.__bandScene.songTotal(), want: window.__bandScene.guitar().wantedChord(), pad: document.querySelector('.p6-chord.wanted').textContent, count: document.querySelector('.band-lane-count').textContent }));
  ok(start.total === 16 && start.want === 'Am' && start.pad === 'Am', `sixteen bars, bar 1 wants Am and the pad carries the ✨ (${start.pad})`);
  ok(start.count === '♪ bar 1 of 16', `the lane reads the authored bar counter ("${start.count}")`);
  // C is selected, Am is wanted: a full strum plays and does NOT advance
  await clearLog(page);
  await strum();
  const wrong = await page.evaluate(() => window.__bandScene.songPosition());
  ok(wrong === 0, 'a strum on a non-wanted chord does not advance');
  ok((await noteTags(page)).filter(t => t.startsWith('pluck:')).length >= 8, '…but it plays every string (free strumming is never wrong)');
  // select Am; a single-string pick still does not advance (the rule is ≥2 strings)
  await page.click('.p6-chord:has-text("Am")');
  await sleep(320);
  await page.mouse.click(cx, b.y + b.h / 8);
  await sleep(60);
  ok(await page.evaluate(() => window.__bandScene.songPosition()) === 0, 'a single-string pick does not advance a bar');
  ok(await page.evaluate(() => !!document.querySelector('.p6-chord.wanted')), 'selecting a chord never clears the ✨ target');
  // sixteen correct strums → completion, exactly once
  await page.evaluate(() => window.__standards.reset());
  for (let bar = 0; bar < 16; bar++) {
    const want = await page.evaluate(() => window.__bandScene.guitar().wantedChord());
    if ((await page.evaluate(() => window.__bandScene.guitar().chord())) !== want) { await page.click(`.p6-chord:has-text("${want}")`); await sleep(320); }
    await strum();
    await sleep(110);
  }
  const end = await page.evaluate(() => ({
    done: window.__bandScene.songDone(), pos: window.__bandScene.songPosition(),
    cels: window.__standards.celebrations(),
    status: document.querySelector('.band-scene-status').textContent,
    chips: [...document.querySelectorAll('.band-scene-status button')].map(x => x.textContent),
    wantedLeft: document.querySelectorAll('.p6-chord.wanted').length,
    count: document.querySelector('.band-lane-count').textContent
  }));
  ok(end.done && end.pos === 16, `sixteen correct strums finish the song (pos ${end.pos})`);
  ok(end.cels.length === 1, `completion celebrates exactly ONCE (${end.cels.length})`);
  ok(end.cels.length && GUIDE_LINES.includes(end.cels[0].line), 'the SAME guide key as the keys ending (L_BAND_SONGDONE)');
  ok(end.status.includes('You played the whole of Golden Boo! 🎵') && end.chips.join('|') === 'Play it again|More songs ✨', 'item 2\'s moment, verbatim');
  ok(end.wantedLeft === 0 && end.count === '♪ bar 16 of 16', `sparkle rests, counter at ${end.count}`);
  await strum();
  ok(await page.evaluate(() => window.__standards.celebrations().length) === 1, 'strumming after the end does not re-celebrate');
  await page.screenshot({ path: `${SHOTS}/strum-done-1024x768.png` });
  await ctx.close();
}
console.log('== Item 4: the pad badge is centred and never lands on the pad above ==');
for (const [w, h] of [[1024, 768], [768, 1024], [390, 844]]) {
  const { ctx, page } = await scenePage('band-guitar', { song: 'golden' }, { viewport: { width: w, height: h } });
  const g = await page.evaluate(() => {
    const pad = document.querySelector('.p6-chord.wanted');
    const r = pad.getBoundingClientRect();
    const cs = getComputedStyle(pad, '::after');
    const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
    const aw = parseFloat(cs.width);
    const aLeft = r.left + pad.clientLeft + parseFloat(cs.left) + m.e;
    const pads = [...document.querySelectorAll('.p6-chord')];
    const above = pads.indexOf(pad) > 0 ? pads[pads.indexOf(pad) - 1].getBoundingClientRect() : null;
    return { delta: +(aLeft + aw / 2 - (r.left + r.width / 2)).toFixed(2), badgeTop: +(r.top + parseFloat(cs.top)).toFixed(1), padTop: +r.top.toFixed(1), aboveBottom: above ? +above.bottom.toFixed(1) : null };
  });
  ok(Math.abs(g.delta) <= 3, `${w}x${h}: ✨ centre within 3px of the pad centre (Δ ${g.delta}px)`);
  ok(g.badgeTop >= g.padTop && (g.aboveBottom === null || g.badgeTop > g.aboveBottom), `${w}x${h}: badge sits inside its own pad, clear of the pad above`);
  await page.screenshot({ path: `${SHOTS}/strum-${w}x${h}.png` });
  await ctx.close();
}
console.log('== Item 4: reduced motion, and free play untouched ==');
{
  const { ctx, page } = await scenePage('band-guitar', { song: 'golden' }, { reduced: true });
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.p6-chord.wanted'), '::after').animationName) === 'none',
    'reduced motion: the pad badge does not pulse (the app-wide `*` rule misses pseudo-elements — this needs its own name)');
  await ctx.close();
}
{
  const { ctx, page } = await scenePage('band-guitar', null);
  const free = await page.evaluate(() => {
    const bare = document.createElement('button'); document.body.appendChild(bare);
    const bareTop = getComputedStyle(bare).paddingTop; bare.remove();
    return { mode: window.__bandScene.playAlong(), lane: !!document.querySelector('.band-sparkle-lane'), wanted: document.querySelectorAll('.p6-chord.wanted').length, pad: getComputedStyle(document.querySelector('.p6-chord')).paddingTop, bare: bareTop, status: document.querySelector('.band-scene-status').textContent };
  });
  ok(free.mode === null && !free.lane && free.wanted === 0, 'free-play guitar: no mode, no lane, no target');
  ok(free.pad === free.bare, `free-play pads keep the UA default padding, no reserved strip (${free.pad} = ${free.bare})`);
  ok(free.status === 'Tap Record, then play!', 'free-play status line unchanged');
  await ctx.close();
}

await browser.close();
console.log(`\nr21g-band: ${failed ? 'FAIL' : 'ALL PASS'}`);
console.log(`RESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
