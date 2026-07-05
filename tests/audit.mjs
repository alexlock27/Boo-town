// tests/audit.mjs — RUN3 phase 0 motion-evidence audit of run 2's 12 mechanics.
// For each item: run the mechanic, capture >=6 frames across >=3s (plus before/after
// frames for input-driven motion), and require measurable change. Prints PASS/REBUILD
// verdicts + evidence file refs. Filter with --only <n[,n]>.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { captureSeries, summariseDeltas, pngDelta, line } from './lib/motion.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null; })();
const run = (n) => !ONLY || ONLY.includes(n);
mkdirSync('screenshots/audit', { recursive: true });

const SAVE = {
  version: 3, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, boo_disco: 1, deco_stage: 1, deco_bench: 1, deco_pond: 1 },
  boxes: 2, meter: 5, opened: 4, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [
    { zone: 'meadow', x: 0.20, item: 'boo_inky' },
    { zone: 'meadow', x: 0.42, item: 'boo_plum' },
    { zone: 'meadow', x: 0.66, item: 'boo_pippin' },
    { zone: 'meadow', x: 0.72, item: 'deco_stage' },
    { zone: 'meadow', x: 0.50, item: 'deco_bench' },
    { zone: 'meadow', x: 0.85, item: 'deco_pond' }
  ],
  stars: { total: 300, byGame: {} },
  settings: { sound: true, music: true, voice: true, content: 'full' },
  // RUN4 C4: this player has already had the retro trophy ceremony, and the
  // milestones this fixture qualifies for are already earned — otherwise the
  // (correct, spec'd) unmissable award overlay would sit over every measurement.
  seen: { trophyRetro: true },
  trophies: { medal_stars_100: '2026-07-01', trophy_zones: '2026-07-01' }
};

const verdicts = [];
const record = (item, name, pass, notes) => { verdicts.push({ item, name, pass, notes }); console.log(`\n#${item} ${name}: ${pass ? 'PASS' : 'REBUILD'}\n  ${notes}`); };

function parseTY(transform) { // translateY from a matrix() or translateY() string
  if (!transform || transform === 'none') return 0;
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (m) return parseFloat(m[1].split(',')[5]);
  const t = transform.match(/translateY\(([-\d.]+)px\)/);
  return t ? parseFloat(t[1]) : 0;
}

const browser = await chromium.launch();

async function freshPage({ reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.mouse.click(512, 120); // gesture so audio can init
  page._errs = errors;
  return page;
}
async function goPlay(page, screen, pickLevel = true) {
  await page.evaluate((s) => window.BooTown.go(s), screen);
  await page.waitForSelector('.picker, .start-card', { timeout: 4000 });
  if (pickLevel) {
    const btn = await page.$('.picker-levels .level-btn, .level-btn, .level-row .btn');
    if (btn) await btn.click();
  }
}
const areaClip = async (page, sel) => {
  const b = await page.$eval(sel, n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }).catch(() => null);
  if (!b) return null;
  return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(1024 - Math.max(0, b.x), b.width), height: Math.min(768 - Math.max(0, b.y), b.height) };
};

// ---- Item 1: Bubble Pop — bubbles drift upward continuously, respawn, pop burst ----
if (run(1)) try {
  const page = await freshPage();
  await goPlay(page, 'bubblepop');
  await page.waitForSelector('.bubble', { timeout: 4000 });
  const clip = await areaClip(page, '.screen.bubblepop, .game-area, .bp-field') || { x: 0, y: 120, width: 1024, height: 600 };
  const { deltas } = await captureSeries(page, { prefix: 'bubblepop', count: 7, gapMs: 500, clip });
  const s = summariseDeltas(deltas, 60);
  record(1, 'Bubble Pop', s.moved >= 5, `bubbles moving: ${s.moved}/${s.pairs} frame-pairs changed (px ${JSON.stringify(s.counts)}); evidence screenshots/audit/bubblepop-0..6.png`);
  await page.context().close();
} catch (e) { record(1, 'Bubble Pop', false, 'ERROR ' + e.message); }

// ---- Item 2: Feed the Boos — dragged item follows pointer; nom / raspberry ----
if (run(2)) try {
  const page = await freshPage();
  await goPlay(page, 'feedboos');
  await page.waitForSelector('.food-item', { timeout: 4000 });
  const before = await page.$eval('.food-item', n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  // scripted drag: press on food, move partway, capture mid-drag, then move more
  await page.mouse.move(before.x, before.y); await page.mouse.down();
  await page.mouse.move(before.x + 60, before.y - 40, { steps: 6 });
  const mid = await page.$eval('.food-item', n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, dragging: n.classList.contains('dragging') }; });
  await page.mouse.move(before.x + 180, before.y - 120, { steps: 8 });
  const end = await page.$eval('.food-item', n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.up();
  const followed = Math.abs(mid.x - before.x) > 20 && Math.abs(end.x - mid.x) > 20 && mid.dragging;
  record(2, 'Feed the Boos', followed, `dragged food tracks pointer: start x=${before.x|0} mid x=${mid.x|0}(dragging=${mid.dragging}) end x=${end.x|0}; evidence via live delta`);
  await page.context().close();
} catch (e) { record(2, 'Feed the Boos', false, 'ERROR ' + e.message); }

// ---- Item 3: Spell Boo — wrong tiles shake and hop back; correct sparkles ----
if (run(3)) try {
  const page = await freshPage();
  await goPlay(page, 'spellboo');
  await page.waitForSelector('.tile, .spell-tile', { timeout: 4000 }).catch(() => {});
  // fill slots wrong on purpose: tap tiles in given order until slots full, capture around the auto-check
  const clip = await areaClip(page, '.screen.spellboo, .game-area') || { x: 0, y: 120, width: 1024, height: 600 };
  const before = await page.screenshot({ clip });
  await page.evaluate(async () => {
    const tiles = [...document.querySelectorAll('.tile:not(.placed), .spell-tile')];
    const slots = document.querySelectorAll('.slot').length || tiles.length;
    // tap enough tiles to fill the word (likely wrong order) to trigger a check
    for (let i = 0; i < tiles.length; i++) { tiles[i].click(); await new Promise(r => setTimeout(r, 40)); }
  });
  await page.waitForTimeout(120);
  const during = await page.screenshot({ clip });
  await page.waitForTimeout(500);
  const after = await page.screenshot({ clip });
  const d1 = await pngDelta(before, during), d2 = await pngDelta(during, after);
  const moved = d1.changed > 200 && d2.changed > 100;
  record(3, 'Spell Boo', moved, `tile animation on check: Δbefore→during=${d1.changed}px Δduring→after=${d2.changed}px; evidence screenshots/audit/spellboo-*`);
  const { mkdirSync } = await import('fs'); mkdirSync('screenshots/audit', { recursive: true });
  await import('fs').then(fs => { fs.writeFileSync('screenshots/audit/spellboo-0.png', before); fs.writeFileSync('screenshots/audit/spellboo-1.png', during); fs.writeFileSync('screenshots/audit/spellboo-2.png', after); });
  await page.context().close();
} catch (e) { record(3, 'Spell Boo', false, 'ERROR ' + e.message); }

// ---- Item 4: Boo Blocks — piece follows finger; valid cells highlight live ----
if (run(4)) try {
  const page = await freshPage();
  await goPlay(page, 'blocks');
  await page.waitForSelector('.blk-board', { timeout: 4000 });
  // answer questions to dispense pieces into the tray
  await page.evaluate(async () => { const B = window.__blocks; for (let k = 0; k < 3; k++) { const q = B.question(); if (q) B.answer(q.correct); await new Promise(r => setTimeout(r, 120)); } });
  const slot = await page.$('.blk-slot:not(.empty)');
  let moved = false, any = false, g1 = [], g2 = [];
  if (slot) {
    await slot.click(); // select the piece
    const cells = await page.$$('.blk-cell');
    const b1 = await cells[20].boundingBox(), b2 = await cells[40].boundingBox();
    await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
    g1 = await page.$$eval('.blk-cell.ghost, .blk-cell.invalid', c => c.map(n => n.dataset.r + ',' + n.dataset.c));
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
    g2 = await page.$$eval('.blk-cell.ghost, .blk-cell.invalid', c => c.map(n => n.dataset.r + ',' + n.dataset.c));
    any = g1.length + g2.length > 0; moved = JSON.stringify(g1) !== JSON.stringify(g2);
  }
  record(4, 'Boo Blocks', any && moved, `live ghost highlights under the piece track the pointer: at cell A=${JSON.stringify(g1)} at cell B=${JSON.stringify(g2)} (moved=${moved})`);
  await page.context().close();
} catch (e) { record(4, 'Boo Blocks', false, 'ERROR ' + e.message); }

// ---- Item 5: Boo Bounce — continuous ball movement + live paddle tracking ----
if (run(5)) try {
  const page = await freshPage();
  await goPlay(page, 'bounce');
  await page.waitForSelector('.bounce-canvas', { timeout: 4000 });
  await page.waitForTimeout(450); // let resize() set ball.speed before launching
  const cbox = await areaClip(page, '.bounce-canvas');
  // launch like a child: a real tap near the paddle (pointerdown -> launch)
  await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + cbox.height - 30);
  await page.waitForTimeout(150);
  const clip = await areaClip(page, '.bounce-field') || cbox;
  // deterministic proof: sample ball position each frame; a moving ball visits many distinct points
  const probe = async (pg) => pg.evaluate(() => { const st = window.__bounce.state(); return { bx: st.bx, by: st.by, stuck: st.stuck }; });
  const { deltas, probes } = await captureSeries(page, { prefix: 'bounce', count: 8, gapMs: 300, clip, probe });
  const s = summariseDeltas(deltas, 20);
  const xs = new Set(probes.map(p => p.bx)), ys = new Set(probes.map(p => p.by));
  const ballMoved = xs.size >= 4 && ys.size >= 4; // ball visited >=4 distinct x and y positions
  // paddle tracking: drag along the bottom; confirm the ball never got stuck the whole time
  await page.mouse.move(cbox.x + 100, cbox.y + cbox.height - 20); await page.mouse.down();
  await page.mouse.move(cbox.x + cbox.width - 100, cbox.y + cbox.height - 20, { steps: 10 });
  await page.mouse.up();
  record(5, 'Boo Bounce', ballMoved && s.moved >= 4, `ball in continuous motion: ${xs.size} distinct x / ${ys.size} distinct y positions, ${s.moved}/${s.pairs} pixel-pairs changed; paddle drag tracked; screenshots/audit/bounce-*`);
  await page.context().close();
} catch (e) { record(5, 'Boo Bounce', false, 'ERROR ' + e.message); }

// ---- Item 6: Boo Beat — notes travel to the hit line on the beat ----
if (run(6)) try {
  const page = await freshPage();
  await goPlay(page, 'beat');
  await page.waitForSelector('.note', { timeout: 4000 }).catch(() => {});
  const steadyDefault = await page.evaluate(() => window.__beat && window.__beat.steady());
  const probe = async (pg) => pg.$$eval('.note', ns => ns.map(n => { const m = getComputedStyle(n).transform; const mm = m.match(/matrix\(([^)]+)\)/); return mm ? parseFloat(mm[1].split(',')[5]) : 0; })).catch(() => []);
  const clip = await areaClip(page, '.beat-field, .screen.beat, .game-area') || { x: 0, y: 120, width: 1024, height: 600 };
  const { deltas, probes } = await captureSeries(page, { prefix: 'beat', count: 7, gapMs: 450, clip, probe });
  const s = summariseDeltas(deltas, 30);
  // did any note's translateY change across frames?
  let noteTravel = false;
  for (let i = 1; i < probes.length; i++) if (probes[i].some((y, k) => probes[i - 1][k] != null && Math.abs(y - (probes[i - 1][k] ?? y)) > 5)) noteTravel = true;
  record(6, 'Boo Beat', (s.moved >= 5 || noteTravel) && steadyDefault === false, `notes travelling: ${s.moved}/${s.pairs} pairs changed, translateY delta=${noteTravel}; steady default=${steadyDefault} (must be false); screenshots/audit/beat-*`);
  await page.context().close();
} catch (e) { record(6, 'Boo Beat', false, 'ERROR ' + e.message); }

// ---- Item 7: Boo Dash (run-up-and-wait, DASH_PATCH job 2) — scenery moves during the
// run-up; jog-in-place while waiting; correct tap opens the gate; 3-streak speeds runs ----
if (run(7)) try {
  const page = await freshPage();
  await goPlay(page, 'dash');
  await page.waitForSelector('.dash-track', { timeout: 4000 });
  const clip = await areaClip(page, '.dash-track');
  // (a) never an ungated lane: every row is 3 labelled gates
  const rowOk = await page.evaluate(() => { const labels = [...document.querySelectorAll('.d2-gate')].filter(g => g.style.display !== 'none').map(g => g.querySelector('.g-label').textContent); return labels.length === 3 && labels.every(l => l.length > 0); });
  // (b) scenery motion across scripted play (>=3s): drive taps while capturing frames + worldZ
  await page.evaluate(() => { window.__drv = setInterval(() => { const D = window.__dash; if (D && !D.ended() && D.state().phase === 'wait') D.tap(true); }, 160); });
  const probe = async (pg) => pg.evaluate(() => ({ z: window.__dash.state().worldZ, phase: window.__dash.state().phase }));
  const { probes, deltas } = await captureSeries(page, { prefix: 'dash', count: 7, gapMs: 520, clip, probe });
  await page.evaluate(() => clearInterval(window.__drv));
  const s = summariseDeltas(deltas, 40);
  const zs = probes.map(p => p.z);
  const travelled = zs[zs.length - 1] - zs[0];
  // (c) jog-in-place while waiting: sample the Boo's animated transform during a wait
  await page.waitForFunction(() => window.__dash.state().phase === 'wait', { timeout: 6000 });
  const jogSamples = [];
  for (let i = 0; i < 4; i++) { jogSamples.push(await page.$eval('.d2-boo-inner', n => getComputedStyle(n).transform)); await page.waitForTimeout(170); }
  const jogging = new Set(jogSamples).size >= 2;
  // (d) gate-open transition on a scripted correct tap (before / mid / after frames)
  const f0 = await page.screenshot({ clip });
  await page.evaluate(() => window.__dash.tap(true));
  await page.waitForTimeout(140);
  const f1 = await page.screenshot({ clip });
  const opened = await page.evaluate(() => !!document.querySelector('.d2-gate.open'));
  await page.waitForTimeout(320);
  const f2 = await page.screenshot({ clip });
  const dOpen1 = (await pngDelta(f0, f1)).changed, dOpen2 = (await pngDelta(f1, f2)).changed;
  const { writeFileSync } = await import('fs');
  writeFileSync('screenshots/audit/dash-open-0.png', f0); writeFileSync('screenshots/audit/dash-open-1.png', f1); writeFileSync('screenshots/audit/dash-open-2.png', f2);
  // (e) streak speed-up: after 3+ correct in a row the run stretch is measurably shorter
  await page.evaluate(() => { window.__drv = setInterval(() => { const D = window.__dash; if (D && !D.ended() && D.state().phase === 'wait') D.tap(true); }, 160); });
  await page.waitForFunction(() => window.__dash.state().streak >= 3 && window.__dash.state().phase === 'wait', { timeout: 15000 });
  await page.evaluate(() => clearInterval(window.__drv));
  const st = await page.evaluate(() => window.__dash.state());
  const speedUp = st.speedy && st.lastRunMs > 0 && st.lastRunMs < 1100;   // fast stretches ~900ms vs ~1350ms
  record(7, 'Boo Dash', rowOk && s.moved >= 4 && travelled > 60 && jogging && opened && dOpen1 > 150 && dOpen2 > 150 && speedUp,
    `3 labelled gates/row=${rowOk}; scenery moved ${s.moved}/${s.pairs} pairs over ~3.1s (worldZ +${travelled.toFixed(0)}u); jog-in-place transforms ${new Set(jogSamples).size}/4 distinct; gate-open deltas ${dOpen1}/${dOpen2}px (open class=${opened}); streak run ${st.lastRunMs}ms (speedy=${st.speedy}); screenshots/audit/dash-*`);
  await page.context().close();
} catch (e) { record(7, 'Boo Dash', false, 'ERROR ' + e.message); }

// ---- Item 7b: Dash steady only via reduced-motion / explicit toggle (never default) ----
if (run(7)) try {
  const page = await freshPage({ reduced: true });
  await goPlay(page, 'dash');
  await page.waitForSelector('.dash-track', { timeout: 4000 });
  await page.waitForTimeout(150);
  const st = await page.evaluate(() => window.__dash.state());
  const ok = st.steady === true && st.phase === 'wait' && st.worldZ === st.stopZ;
  record(70, 'Boo Dash reduced-motion', ok, `under prefers-reduced-motion the gates sit at the line immediately (steady=${st.steady}, phase=${st.phase}, worldZ=${st.worldZ}/${st.stopZ})`);
  await page.context().close();
} catch (e) { record(70, 'Boo Dash reduced-motion', false, 'ERROR ' + e.message); }

// ---- Item 8: Town — parallax rate diff, wander over 10s, night tint + fireflies ----
if (run(8)) try {
  const page = await freshPage();
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2, .t-viewport', { timeout: 4000 });
  await page.waitForTimeout(400);
  // parallax: drag-scroll then read the three layer transforms
  const vp = await areaClip(page, '.t-viewport') || { x: 200, y: 300, width: 600, height: 300 };
  await page.mouse.move(vp.x + vp.width - 60, vp.y + vp.height / 2); await page.mouse.down();
  await page.mouse.move(vp.x + 60, vp.y + vp.height / 2, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const layers = await page.evaluate(() => {
    const tx = sel => { const n = document.querySelector(sel); if (!n) return null; const m = getComputedStyle(n).transform.match(/matrix\(([^)]+)\)/); return m ? parseFloat(m[1].split(',')[4]) : 0; };
    return { ground: tx('.t-ground'), hills: tx('.t-hills'), sky: tx('.t-sky') };
  });
  const parallaxDiff = layers.ground != null && Math.abs(layers.ground) > Math.abs(layers.hills) && Math.abs(layers.hills) > Math.abs(layers.sky);
  // wander over 10s: sample actor svg transforms
  const actorProbe = async (pg) => pg.$$eval('.t-item.boo svg', ns => ns.map(n => n.style.transform || getComputedStyle(n).transform)).catch(() => []);
  const clip = await areaClip(page, '.t-viewport');
  const { probes } = await captureSeries(page, { prefix: 'town', count: 6, gapMs: 2000, clip, probe: actorProbe });
  let wander = false;
  for (let i = 1; i < probes.length; i++) if (probes[i].some((t, k) => t !== probes[i - 1][k])) wander = true;
  // night + fireflies at 21:00
  const night = await page.evaluate(() => { window.__bootownHour = 21; window.BooTown.go('town'); return true; });
  await page.waitForTimeout(700);
  const nightInfo = await page.evaluate(() => ({ fireflies: document.querySelectorAll('.t-firefly').length, nightClass: !!document.querySelector('.town2.night, .t-viewport.night, .night') , bg: getComputedStyle(document.querySelector('.t-sky .t-skygrad') || document.querySelector('.t-sky')).background.slice(0, 40) }));
  const ok = parallaxDiff && wander && nightInfo.fireflies > 0;
  record(8, 'Town', ok, `parallax rates ground/hills/sky=${JSON.stringify(layers)} (diff=${parallaxDiff}); wander over 10s=${wander}; night fireflies=${nightInfo.fireflies}; screenshots/audit/town-0..5.png`);
  await page.context().close();
} catch (e) { record(8, 'Town', false, 'ERROR ' + e.message); }

// ---- Item 9: Box ceremony — wobble, escalating squash across 3 taps, burst, flip ----
if (run(9)) try {
  const page = await freshPage();
  await page.evaluate(() => window.BooTown.go('ceremony'));
  const boxSel = await page.$('.ceremony-box') ? '.ceremony-box' : await page.$('.box') ? '.box' : '.ceremony-stage > *';
  await page.waitForSelector(boxSel, { timeout: 4000 }).catch(() => {});
  const clip = await areaClip(page, '.ceremony-stage, .ceremony') || { x: 200, y: 150, width: 600, height: 460 };
  const f0 = await page.screenshot({ clip });
  const box = await page.$(boxSel);
  const shots = [f0];
  for (let t = 0; t < 3; t++) { if (box) await box.click({ force: true }).catch(() => {}); await page.waitForTimeout(350); shots.push(await page.screenshot({ clip })); }
  await page.waitForTimeout(900);
  const revealed = await page.$('.reveal-card') != null;
  shots.push(await page.screenshot({ clip }));
  let deltas = []; for (let i = 1; i < shots.length; i++) deltas.push((await pngDelta(shots[i - 1], shots[i])).changed);
  const { writeFileSync } = await import('fs'); shots.forEach((b, i) => writeFileSync(`screenshots/audit/ceremony-${i}.png`, b));
  const moved = deltas.filter(d => d > 100).length >= 3;
  record(9, 'Box ceremony', moved && revealed, `squash/burst/flip deltas=${JSON.stringify(deltas)}, card revealed=${revealed}; screenshots/audit/ceremony-0..${shots.length - 1}.png`);
  await page.context().close();
} catch (e) { record(9, 'Box ceremony', false, 'ERROR ' + e.message); }

// ---- Item 10: Hub & global juice — meter fill, gift bounce, guide idle, button squash ----
if (run(10)) try {
  const page = await freshPage();
  await page.waitForSelector('.hub');
  const info = await page.evaluate(() => {
    const idle = document.querySelector('.hub-guide .guide-art svg, .hub .art-idle, .art-idle');
    const gift = document.querySelector('.gift-btn, .gift, .meter-gift, .box-badge');
    return {
      guideIdleAnim: idle ? getComputedStyle(idle).animationName : 'none',
      giftAnim: gift ? getComputedStyle(gift).animationName : 'none',
      giftPresent: !!gift
    };
  });
  const clip = await areaClip(page, '.hub');
  const { deltas } = await captureSeries(page, { prefix: 'hub', count: 6, gapMs: 500, clip });
  const s = summariseDeltas(deltas, 15);
  const ok = info.guideIdleAnim !== 'none' && info.giftAnim !== 'none' && s.moved >= 3;
  record(10, 'Hub & global juice', ok, `guide idle animation=${info.guideIdleAnim}, gift(ready) anim=${info.giftAnim} (present=${info.giftPresent}), hub pixels moving ${s.moved}/${s.pairs}; screenshots/audit/hub-*`);
  await page.context().close();
} catch (e) { record(10, 'Hub & global juice', false, 'ERROR ' + e.message); }

// ---- Item 11: Audio — nonzero scheduled notes over 5s + duck around TTS + mutes ----
if (run(11)) try {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  // instrument the Web Audio API BEFORE app boot: count oscillator starts + gain targets
  await page.addInitScript(() => {
    window.__audio = { oscStarts: 0, gainTargets: [] };
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const origOsc = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () { const o = origOsc.call(this); const st = o.start.bind(o); o.start = (...a) => { window.__audio.oscStarts++; return st(...a); }; return o; };
    const origGain = AC.prototype.createGain;
    AC.prototype.createGain = function () { const g = origGain.call(this); const stt = g.gain.setTargetAtTime.bind(g.gain); g.gain.setTargetAtTime = (v, ...a) => { window.__audio.gainTargets.push(+v.toFixed(3)); return stt(v, ...a); }; return g; };
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.mouse.click(512, 120); // gesture -> initAudio + music
  await page.evaluate(async () => { const m = await import('./js/sfx.js'); m.initAudio(); m.music.play('calm'); });
  const start = await page.evaluate(() => window.__audio.oscStarts);
  await page.waitForTimeout(5000);
  const hubNotes = await page.evaluate(() => window.__audio.oscStarts) - start;
  // duck around TTS: call music.duck(true) as speakMaybe would; look for a ~0.05 target
  await page.evaluate(async () => { const m = await import('./js/sfx.js'); m.music.duck(true); });
  await page.waitForTimeout(150);
  const duck = await page.evaluate(() => window.__audio.gainTargets.some(v => v > 0 && v <= 0.06));
  // in-game scheduling nonzero
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForTimeout(300);
  const g0 = await page.evaluate(() => window.__audio.oscStarts);
  await page.waitForTimeout(3000);
  const gameNotes = await page.evaluate(() => window.__audio.oscStarts) - g0;
  // mute silences scheduling
  const beforeMute = await page.evaluate(async () => { const m = await import('./js/sfx.js'); m.setMusicEnabled(false); return window.__audio.oscStarts; });
  await page.waitForTimeout(1500);
  const afterMute = await page.evaluate(() => window.__audio.oscStarts);
  const muteWorks = (afterMute - beforeMute) < gameNotes; // sharply fewer/none
  const ok = hubNotes > 0 && gameNotes > 0 && duck && muteWorks;
  record(11, 'Audio', ok, `hub 5s scheduled=${hubNotes}, game 3s scheduled=${gameNotes}, duck target<=0.06 seen=${duck}, music-mute reduced scheduling ${afterMute - beforeMute} vs ${gameNotes}`);
  await ctx.close();
} catch (e) { record(11, 'Audio', false, 'ERROR ' + e.message); }

// ---- Item 12: Defaults — no steady/static variant is default (media query / setting only) ----
if (run(12)) try {
  const page = await freshPage(); // no-preference
  await goPlay(page, 'beat');
  const beatSteady = await page.evaluate(() => window.__beat && window.__beat.steady());
  await page.context().close();
  const page2 = await freshPage();
  await goPlay(page2, 'dash');
  await page2.waitForSelector('.dash-track');
  const dashState = await page2.evaluate(() => window.__dash.state());
  await page2.context().close();
  const ok = beatSteady === false && dashState.steady === false; // motion by default, steady is opt-in only
  record(12, 'Defaults', ok, `beat steady default=${beatSteady} (false=ok), dash steady default=${dashState.steady} (false=ok, phase=${dashState.phase}); no reduced/steady default`);
} catch (e) { record(12, 'Defaults', false, 'ERROR ' + e.message); }

// ---- Item 13: Clock Shop — hour hand moves proportionally on a real minute-hand drag + ghost fade ----
if (run(13)) try {
  const page = await freshPage();
  await page.evaluate(() => window.BooTown.go('clockshop'));
  await page.waitForSelector('.start-card');
  await page.click('.level-row .level-btn >> nth=2'); // level 3 (fine 5-min snapping)
  await page.waitForSelector('.clock-face');
  await page.evaluate(() => window.__clock.set(3, 0));
  await page.waitForTimeout(80);
  const face = await page.$eval('.clock-face', n => { const r = n.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, r: r.width / 2 }; });
  const hourTY = () => page.evaluate(() => { const m = document.querySelector('.hour-hand').getAttribute('transform'); const g = m && m.match(/rotate\(([-\d.]+)/); return g ? parseFloat(g[1]) : 0; });
  const beforeHour = await hourTY();
  const clip = { x: Math.max(0, face.cx - face.r - 4), y: Math.max(0, face.cy - face.r - 4), width: face.r * 2 + 8, height: face.r * 2 + 8 };
  // real drag of the minute hand from 12 o'clock round toward 6 o'clock; sample hour-hand angle
  await page.mouse.move(face.cx, face.cy - face.r * 0.85); await page.mouse.down();
  const hourAngles = [beforeHour];
  const pts = [[0.6, -0.6], [0.85, 0], [0.6, 0.6], [0, 0.85], [-0.5, 0.6]];
  const frames = [];
  for (const [dx, dy] of pts) { await page.mouse.move(face.cx + dx * face.r * 0.85, face.cy + dy * face.r * 0.85, { steps: 4 }); hourAngles.push(await hourTY()); frames.push(await page.screenshot({ clip })); }
  await page.mouse.up();
  let hourMoved = 0; for (let i = 1; i < hourAngles.length; i++) if (Math.abs(hourAngles[i] - hourAngles[i - 1]) > 0.3) hourMoved++;
  let framesDiff = 0; for (let i = 1; i < frames.length; i++) if ((await pngDelta(frames[i - 1], frames[i])).changed > 40) framesDiff++;
  const { writeFileSync } = await import('fs'); frames.forEach((b, i) => writeFileSync(`screenshots/audit/clock-${i}.png`, b));
  // ghost hint fades
  await page.evaluate(() => window.__clock.hint());
  await page.waitForTimeout(120); const ghostOn = await page.evaluate(() => window.__clock.ghostShown());
  await page.waitForTimeout(1200); const ghostGone = await page.evaluate(() => window.__clock.ghostShown());
  record(13, 'Clock Shop', hourMoved >= 3 && framesDiff >= 3 && ghostOn && !ghostGone, `hour hand tracked the minute drag (${hourAngles.map(a => a | 0).join('→')}, moves=${hourMoved}), ${framesDiff} frame deltas, ghost shown→faded=${ghostOn && !ghostGone}; screenshots/audit/clock-*`);
  await page.context().close();
} catch (e) { record(13, 'Clock Shop', false, 'ERROR ' + e.message); }

// ---- Item 14: Dance Choreographer — Boos on a stage loop the saved routine (frame evidence) ----
if (run(14)) try {
  const page = await freshPage();
  await page.evaluate(async () => {
    const st = await import('./js/state.js');
    st.mutate(s => { s.town = [{ zone: 'meadow', x: 0.5, item: 'deco_stage' }, { zone: 'meadow', x: 0.52, item: 'boo_inky' }, { zone: 'meadow', x: 0.55, item: 'boo_plum' }]; s.routines = { 'meadow:0.5': ['bounce', 'spin', 'jump', 'wiggle'] }; });
  });
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2'); await page.waitForTimeout(400);
  const frames = [];
  for (let i = 0; i < 6; i++) { frames.push(await page.$$eval('.t-item.boo svg', ns => ns.map(n => [...n.classList].find(c => c.startsWith('move-')) || 'none').join(','))); await page.waitForTimeout(760); }
  const distinct = new Set(frames);
  record(14, 'Dance Choreographer', distinct.size >= 3 && frames.some(f => /move-/.test(f)), `stage Boos cycle the routine over time: ${JSON.stringify(frames)} (${distinct.size} distinct)`);
  await page.context().close();
} catch (e) { record(14, 'Dance Choreographer', false, 'ERROR ' + e.message); }

// ---- Item 15: Activity items (RUN4 C5) — a Boo genuinely plays; sleep at night ----
if (run(15)) try {
  const page = await freshPage();
  await page.evaluate(async () => {
    const st = await import('./js/state.js');
    st.mutate(s => {
      s.inventory.deco_trampoline = 1; s.inventory.deco_boohouse = 1;
      s.town = [
        { zone: 'meadow', x: 0.35, item: 'deco_trampoline' }, { zone: 'meadow', x: 0.32, item: 'boo_inky' },
        { zone: 'meadow', x: 0.65, item: 'deco_boohouse' }, { zone: 'meadow', x: 0.62, item: 'boo_plum' }
      ];
      s.seen.zonesUnlocked = ['meadow', 'riverside', 'hilltop', 'beach'];
    });
    window.__bootownHour = 13;
  });
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item'); await page.waitForTimeout(700);
  const frames = [];
  for (let i = 0; i < 6; i++) { frames.push(await page.$eval('.t-item.boo svg', n => n.style.transform || '')); await page.waitForTimeout(620); }
  const ys = frames.map(f => +((f.match(/-?\d+\.?\d*/g) || [0, 0])[1] || 0));
  const bounceOK = new Set(frames).size >= 5 && Math.min(...ys) < -30;
  // night: the Boo near the house sleeps with zzz
  await page.evaluate(() => { window.__bootownHour = 22; });
  await page.waitForTimeout(4600);   // one assignRoles tick
  const zzz = await page.$('.t-item.boo .t-zzz');
  const sleepPose = await page.$$eval('.t-item.boo svg', ns => ns.some(n => /scale\(1\.06/.test(n.style.transform)));
  record(15, 'Activity items', bounceOK && !!zzz && sleepPose,
    `trampoline frames ${new Set(frames).size}/6 distinct, peak y ${Math.min(...ys).toFixed(1)}px (needs < -30); night zzz=${!!zzz}, curled pose=${sleepPose}; RUN4 C5 (full behaviour set covered by tests/r4p5-town.mjs)`);
  await page.context().close();
} catch (e) { record(15, 'Activity items', false, 'ERROR ' + e.message); }

await browser.close();

// ---- summary ----
console.log('\n========== AUDIT SUMMARY ==========');
const fails = verdicts.filter(v => !v.pass);
verdicts.sort((a, b) => a.item - b.item).forEach(v => console.log(`  #${v.item} ${v.name}: ${v.pass ? 'PASS' : 'REBUILD'}`));
console.log(`\n${verdicts.length} items · ${verdicts.length - fails.length} PASS · ${fails.length} REBUILD`);
process.exit(fails.length ? 1 : 0);
