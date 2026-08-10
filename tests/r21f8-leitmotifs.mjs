// tests/r21f8-leitmotifs.mjs — RUN21F F8: region leitmotifs.
// ACCEPT: five loops audition offline; engine loops them seamlessly; sign-off gate respected
// (the gate itself is procedural — this suite proves the audible half). Audio behaviour is
// proven by INSTRUMENTATION LOGS (house standard), never by ear: every scheduled note tags
// 'lm:<area>:<voice>', lmInfo() reports the live loop/gain/scheduler, and 'lmtick' lines
// time the scheduler so the CPU claim carries a real number. Section 0 validates the
// AUTHORED DATA deterministically (pentatonic law, 8 bars, voice cap, registers, craft).
// Expected runtime: ~65s (the 25-second seamless-loop capture is the long pole).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

// ==================== 0. the authored data obeys the pack ====================
console.log('== the authored loops obey the pack (deterministic, no browser) ==');
const { LEITMOTIFS } = await import(new URL('../data/leitmotifs.js', import.meta.url));
const ROOT_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LM_AREAS = ['meadow', 'riverside', 'hilltop', 'beach', 'playground'];
{
  const keys = Object.keys(LEITMOTIFS).sort();
  assert(keys.join(',') === [...LM_AREAS].sort().join(','), `exactly the five outdoor areas have tunes (${keys.join(', ')})`);
  const openings = {};
  for (const area of LM_AREAS) {
    const s = LEITMOTIFS[area];
    if (!s) continue;
    const beatMs = 60000 / s.bpm;
    assert(s.bpm >= 76 && s.bpm <= 92, `${area}: ${s.bpm} bpm is inside the pack's 76-92`);
    assert(s.bars === 8 && Math.abs(s.durMs - 32 * beatMs) < 1, `${area}: exactly 8 bars of 4/4 (${(s.durMs / 1000).toFixed(1)}s)`);
    const voices = [...new Set(s.events.map(e => e.i))];
    assert(voices.length <= 3 && voices.every(v => ['lead', 'pad', 'bass'].includes(v)),
      `${area}: ${voices.length} voices (<=3): ${voices.join('+')}`);
    // strict pentatonic major on the area's root — the law, checked note by note
    const pcs = [0, 2, 4, 7, 9].map(x => (x + ROOT_SEMI[s.root]) % 12);
    const off = s.events.filter(e => !pcs.includes(((e.v % 12) + 12) % 12));
    assert(off.length === 0, `${area}: every one of ${s.events.length} notes is ${s.root} major pentatonic${off.length ? ' — VIOLATORS v=' + off.map(e => e.v).join(',') : ''}`);
    // registers per voice; nothing crosses the loop seam
    assert(s.events.every(e => e.i !== 'lead' || (e.v >= 0 && e.v <= 16)), `${area}: lead stays C4..E5`);
    assert(s.events.every(e => e.i !== 'bass' || (e.v >= -12 && e.v <= 0)), `${area}: bass stays C3..C4`);
    assert(s.events.every(e => e.i !== 'pad' || (e.v >= -12 && e.v <= 12)), `${area}: pad stays C3..C5`);
    assert(s.events.every(e => e.t >= 0 && e.t + e.d <= s.durMs + 2), `${area}: no note crosses the loop seam`);
    const sorted = [...s.events].sort((a, b) => a.t - b.t);
    assert(s.events.every((e, i) => i === 0 || s.events[i - 1].t <= e.t), `${area}: events are time-sorted`);
    // lead and bass strictly monophonic; pad at most a dyad
    for (const voice of ['lead', 'bass']) {
      const line = sorted.filter(e => e.i === voice);
      const overlaps = line.filter((e, i) => i > 0 && line[i - 1].t + line[i - 1].d > e.t + 2);
      assert(overlaps.length === 0, `${area}: ${voice} is monophonic (${overlaps.length} overlaps)`);
    }
    // Polyphony is how many notes SOUND AT ONCE, sampled at every onset — not how many
    // partners a note overlaps. (An 8-beat drone under two consecutive dyad halves
    // overlaps two partners while only ever being one of two sounding.)
    let maxPad = 0;
    for (const t of [...new Set(sorted.map(e => e.t))]) {
      maxPad = Math.max(maxPad, sorted.filter(e => e.i === 'pad' && e.t <= t + 1 && e.t + e.d > t + 1).length);
    }
    assert(maxPad <= 2, `${area}: the pad never exceeds a dyad (max ${maxPad} sounding at once)`);
    // CONTINUITY LAW: about silence, not onsets — a held drone is sounding. Union the note
    // intervals and look for a hole, the bar-8-into-bar-1 seam included.
    const iv = sorted.map(e => [e.t, Math.min(s.durMs, e.t + e.d)]).sort((a, b) => a[0] - b[0]);
    const cov = []; let cur = null;
    for (const [a, b] of iv) { if (cur && a <= cur[1] + 1) cur[1] = Math.max(cur[1], b); else { cur = [a, b]; cov.push(cur); } }
    const holes = cov.slice(1).map((c, i) => [cov[i][1], c[0]]).filter(([a, b]) => b - a > 1);
    const wrapGap = (s.durMs - cov[cov.length - 1][1]) + cov[0][0];
    assert(holes.length === 0, `${area}: not one silent hole in the loop${holes.length ? ' — ' + JSON.stringify(holes) : ''}`);
    assert(wrapGap < 0.5 * beatMs, `${area}: the seam is continuous (${(wrapGap / beatMs).toFixed(2)} beats of silence across it)`);
    // craft floor: >=3 lead durations; the peak lands in bars 4-7, never bar 1
    const lead = sorted.filter(e => e.i === 'lead');
    assert(new Set(lead.map(e => Math.round(e.d / 10))).size >= 3, `${area}: the lead uses >=3 distinct durations`);
    const peak = lead.reduce((m, e) => e.v > m.v ? e : m, lead[0]);
    assert(peak.t >= 12 * beatMs - 2 && peak.t <= 28 * beatMs + 2,
      `${area}: the melodic peak (v=${peak.v}) lands at beat ${(peak.t / beatMs).toFixed(1)} (bars 4-7)`);
    openings[area] = lead.slice(0, 5).map((e, i, a) => i ? e.v - a[i - 1].v : 0).slice(1).join(',');
  }
  // five identifiable tunes: distinct roots, distinct tempi, distinct opening gestures
  const roots = LM_AREAS.map(a => LEITMOTIFS[a].root), bpms = LM_AREAS.map(a => LEITMOTIFS[a].bpm);
  assert(new Set(roots).size === 5, `five distinct roots (${roots.join(' ')})`);
  assert(new Set(bpms).size === 5, `five distinct tempi (${bpms.join(' ')})`);
  assert(new Set(Object.values(openings)).size === 5,
    `five distinct opening gestures (${Object.entries(openings).map(([a, o]) => a + ':[' + o + ']').join(' ')})`);
}

// ==================== 0b. the voices SUSTAIN (a held note must stay audible) =============
// envTone ramps peak → silence across a note's whole duration: right for a chirp, fatal
// for a drone. Measured on hilltop's 6.32s drone, that envelope is 27dB down at 3s and
// 46dB down at 5s — the loop would have holes in it exactly where the music breathes,
// which is what the continuity law exists to prevent. The leitmotif voices therefore use
// a hold-then-release envelope. Guarded here at source, because the failure is inaudible
// to every other assertion in this file: the notes are still scheduled, just silent.
console.log('== the leitmotif voices sustain rather than pluck ==');
{
  const src = await (await fetch(BASE + '/js/sfx.js')).text();
  const region = src.slice(src.indexOf('function lmTone'), src.indexOf('export function lmInfo'));
  assert(region.length > 200, 'the leitmotif voice builder lmTone() is present');
  assert(/setValueAtTime\(\s*body\s*,/.test(region), 'a held note holds its level (setValueAtTime(body, hold)) before releasing');
  assert(/exponentialRampToValueAtTime\(\s*0\.0001\s*,\s*t0 \+ dur\s*\)/.test(region), 'and releases to silence exactly at the note\'s end, never across the seam');
  const at = src.indexOf('function lmNote');
  const lmNote = src.slice(at, src.indexOf('// Test seam', at));   // F7's bedInfo has a '// Test seam' too — search FROM lmNote
  assert(!/\benvTone\(/.test(lmNote), 'lmNote() does NOT fall back to envTone\'s pluck envelope');
  assert((lmNote.match(/lmTone\(/g) || []).length >= 4, 'every leitmotif voice goes through lmTone');
}

// ==================== browser fixtures ====================
const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'boohouse_kitchen', 'boohouse_bedroom', 'gallery'];
const SAVE = {
  version: 23, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 },
  stars: { total: 400, byType: {}, spent: {} },
  town: { areas: Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])) },
  wishes: { unlocked: {} },
  funfair: { built: [], build: null, pending: [], seats: {} },
  delights: { hideDay: today, hideFound: true },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x' },
  settings: { sound: true, music: true, voice: false, content: 'full', requests: false }
};
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function openApp() {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(() => { window.__bootownHour = 13; });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 30000 });
  await page.evaluate(async () => { const s = await import('./js/sfx.js'); s.initAudio(); s.setMusicEnabled(true); s.setAudioLog(true); });
  return { ctx, page };
}
async function goArea(page, area, room = null) {
  await page.evaluate(p => window.BooTown.go('town', p), room ? { area, room } : { area });
  await page.waitForSelector('.town2', { timeout: 15000 });
  await page.waitForFunction(() => window.__townLife, { timeout: 8000 });
  await sleep(450);
  const btn = await page.$('.overlay.growth-reveal .btn');
  if (btn) { await btn.click(); await sleep(300); }
}
const lmInfo = page => page.evaluate(async () => (await import('./js/sfx.js')).lmInfo());
const takeLog = page => page.evaluate(async () => { const s = await import('./js/sfx.js'); const l = s.getAudioLog(); s.setAudioLog(true); return l; });

// ==================== 1. the right tune, in the right place, and nowhere else =============
console.log('== each area mounts ITS tune; funfair and interiors are untouched ==');
{
  const { ctx, page } = await openApp();
  for (const area of LM_AREAS) {
    await takeLog(page);
    await goArea(page, area);
    await sleep(1600);
    const info = await lmInfo(page);
    const log = await takeLog(page);
    const starts = log.filter(e => e.kind === 'leitmotif');
    const mine = log.filter(e => e.kind === 'note' && e.tag && e.tag.startsWith('lm:' + area + ':'));
    const foreign = log.filter(e => e.kind === 'note' && e.tag && e.tag.startsWith('lm:') && !e.tag.startsWith('lm:' + area + ':'));
    assert(info.area === area && info.scheduling, `${area}: its leitmotif is running with the mount`);
    assert(info.bpm === LEITMOTIFS[area].bpm, `${area}: at its own tempo (${info.bpm} bpm)`);
    assert(starts.length >= 1 && starts[starts.length - 1].area === area, `${area}: the log records ITS loop starting`);
    assert(mine.length >= 2, `${area}: notes tagged lm:${area}:* are scheduled (${mine.length} in 1.6s)`);
    assert(mine.every(e => e.bus === 'music'), `${area}: every note rides the music bus`);
    assert(foreign.length === 0, `${area}: no other area's tune leaks in (${foreign.length})`);
  }
  // funfair keeps its jingle rules; interiors keep plain calm — no leitmotif anywhere
  for (const [area, room] of [['funfair', null], ['boohouse', 'lounge'], ['boohouse', 'kitchen'], ['boohouse', 'bedroom'], ['gallery', null]]) {
    await takeLog(page);
    await goArea(page, area, room);
    await sleep(700);
    const info = await lmInfo(page);
    const log = await takeLog(page);
    const lmNotes = log.filter(e => e.kind === 'note' && e.tag && e.tag.startsWith('lm:'));
    assert(info.area === null && !info.scheduling, `${room ? area + '/' + room : area}: no leitmotif (loop: ${info.loop})`);
    assert(lmNotes.length === 0, `${room ? area + '/' + room : area}: zero leitmotif notes scheduled`);
    if (area === 'funfair') assert(info.loop === 'fair' || info.loop === null, `funfair: the jingle owns the air (loop: ${info.loop})`);
    if (area === 'boohouse') assert(info.loop === 'calm', `${area}/${room}: plain calm indoors (loop: ${info.loop})`);
  }
  // switching areas switches tunes cleanly
  await goArea(page, 'beach');
  await sleep(600);
  await takeLog(page);
  await goArea(page, 'riverside');
  await sleep(1200);
  const swLog = await takeLog(page);
  const after = swLog.filter(e => e.kind === 'note' && e.tag && e.tag.startsWith('lm:'));
  const lastStart = swLog.filter(e => e.kind === 'leitmotif').pop();
  assert(lastStart && lastStart.area === 'riverside', 'beach → riverside: the new loop is riverside\'s');
  const tail = after.slice(-Math.min(6, after.length));
  assert(tail.every(e => e.tag.startsWith('lm:riverside:')), 'after the switch, every fresh note is riverside\'s');
  await ctx.close();
}

// ==================== 2. the 8-bar loop is genuinely seamless ====================
console.log('== seamless looping across the bar-32 boundary (25s capture) ==');
{
  const { ctx, page } = await openApp();
  await goArea(page, 'playground');   // fastest loop: 92 bpm → 20.9s, so 25s crosses the seam
  const spec = LEITMOTIFS.playground;
  await takeLog(page);
  const T = 25000;
  await sleep(T);
  const log = await takeLog(page);
  const onsets = log.filter(e => e.kind === 'note' && e.tag && e.tag.startsWith('lm:playground:')).map(e => e.t).sort((a, b) => a - b);
  const beatMs = 60000 / spec.bpm;
  let maxGap = 0;
  for (let i = 1; i < onsets.length; i++) maxGap = Math.max(maxGap, (onsets[i] - onsets[i - 1]) * 1000);
  const expected = spec.events.length * (T / spec.durMs);
  assert(onsets.length > spec.events.length, `the capture crossed the seam (${onsets.length} onsets > one pass's ${spec.events.length})`);
  assert(onsets.length > expected * 0.8 && onsets.length < expected * 1.2,
    `onset count ${onsets.length} ≈ expected ${expected.toFixed(0)} for ${T / 1000}s of continuous loop`);
  assert(maxGap < 2.5 * beatMs,
    `max onset gap ${(maxGap / beatMs).toFixed(2)} beats over 25s — no loop-boundary silence (a band-watch-style +900ms gap would read ${((2.5 * beatMs + 900) / beatMs).toFixed(1)})`);

  // ---- and the scheduler itself is near-free (240 frames sampled) ----
  const frames = await page.evaluate(() => new Promise(res => {
    const d = []; let last = performance.now(); let n = 0;
    (function f(now) { d.push(now - last); last = now; if (++n < 240) requestAnimationFrame(f); else res(d.slice(1)); })(last);
  }));
  const ticks = (await takeLog(page)).filter(e => e.kind === 'lmtick');
  const total = ticks.reduce((a, e) => a + e.ms, 0);
  const perFrame = ticks.length ? total / frames.length : 0;
  console.log(`    scheduler: ${ticks.length} ticks, ${total.toFixed(3)}ms total → ${perFrame.toFixed(4)}ms/frame`);
  assert(perFrame < 2, `the leitmotif scheduler costs ${perFrame.toFixed(4)}ms/frame of main-thread time (<2ms)`);
  await ctx.close();
}

// ==================== 3. mutes, ducking, and re-entry ====================
console.log('== the mute contract, ducking under speech, and re-entry ==');
{
  const { ctx, page } = await openApp();
  await goArea(page, 'meadow');
  await sleep(800);
  const lvl = await lmInfo(page);
  assert(Math.abs(lvl.gain - 0.18) < 0.01, `the tune sits at the existing music volume (${lvl.gain}, bus 0.18)`);

  // music mute → zero nodes' worth of scheduling: gain 0, scheduler stopped, no notes
  const muted = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.setMusicEnabled(false);
    s.setAudioLog(true);
    await new Promise(r => setTimeout(r, 1000));
    return { info: s.lmInfo(), notes: s.getAudioLog().filter(e => e.kind === 'note' && e.bus === 'music').length };
  });
  assert(muted.info.gain === 0, `muting music takes the bus to ${muted.info.gain}`);
  assert(!muted.info.scheduling, 'and stops the leitmotif scheduler (silent + no waste)');
  assert(muted.notes === 0, `zero notes scheduled while muted (${muted.notes})`);
  const back = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.setMusicEnabled(true);
    s.setAudioLog(true);
    await new Promise(r => setTimeout(r, 1200));
    return { info: s.lmInfo(), notes: s.getAudioLog().filter(e => e.kind === 'note' && e.tag && e.tag.startsWith('lm:meadow:')).length };
  });
  assert(back.info.scheduling && back.notes >= 1, `un-muting resumes the tune (${back.notes} notes in 1.2s)`);
  // …and resumes it from a FRESH clock. The loop start is an audio-clock time; left stale
  // across a long mute it sits far in the past, and the scheduler would catch up by
  // dumping a bar's worth of notes into one instant. Proven by spread, not by reading code.
  const spread = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.setMusicEnabled(false);
    await new Promise(r => setTimeout(r, 4000));    // a long silence: the clock goes stale
    s.setAudioLog(true);
    s.setMusicEnabled(true);
    await new Promise(r => setTimeout(r, 1500));
    const ts = s.getAudioLog().filter(e => e.kind === 'note' && e.tag && e.tag.startsWith('lm:')).map(e => e.t).sort((a, b) => a - b);
    return { n: ts.length, span: ts.length > 1 ? (ts[ts.length - 1] - ts[0]) : 0, clumped: ts.filter((t, i) => i > 0 && t - ts[i - 1] < 0.001).length };
  });
  assert(spread.n > 0 && spread.span > 0.4,
    `after a 4s mute the tune resumes spread over time, not in a clump (${spread.n} notes across ${spread.span.toFixed(2)}s)`);
  assert(spread.clumped < spread.n / 2, `no catch-up burst of simultaneous notes (${spread.clumped} of ${spread.n})`);

  // sfx mute leaves the music alone — the existing contract, unchanged
  const sfxMuted = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.setSoundEnabled(false);
    await new Promise(r => setTimeout(r, 400));
    const info = s.lmInfo();
    s.setSoundEnabled(true);
    return info;
  });
  assert(sfxMuted.area === 'meadow' && sfxMuted.scheduling, 'muting sound effects leaves the tune playing');

  // speech ducks the music bus exactly as it always has (0.18 → 0.05 → 0.18)
  const ducked = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.music.duck(true);
    await new Promise(r => setTimeout(r, 600));
    return s.lmInfo().gain;
  });
  assert(Math.abs(ducked - 0.05) < 0.005, `speech ducks the tune to ${ducked} (music bus duck: 0.05)`);
  const restored = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.music.duck(false);
    await new Promise(r => setTimeout(r, 600));
    return s.lmInfo().gain;
  });
  assert(Math.abs(restored - 0.18) < 0.005, `and it comes back up to ${restored} when the guide stops`);

  // re-entry cannot double the scheduler or the tune (module-level timer, F7 precedent)
  await page.evaluate(() => window.BooTown.go('hub'));
  await sleep(400);
  await goArea(page, 'meadow');
  await goArea(page, 'meadow');   // and a second mount of the same area
  await takeLog(page);
  await sleep(2000);
  const re = await takeLog(page);
  const leads = re.filter(e => e.kind === 'note' && e.tag === 'lm:meadow:lead').map(e => e.t).sort((a, b) => a - b);
  const spec = LEITMOTIFS.meadow;
  const leadCount = spec.events.filter(e => e.i === 'lead').length;
  const maxExpected = Math.ceil(leadCount * (2000 / spec.durMs) * 1.5) + 2;
  assert((await lmInfo(page)).scheduling, 're-entering the area: the tune is running');
  assert(leads.length > 0 && leads.length <= maxExpected,
    `…and exactly one of it (${leads.length} lead notes in 2s; a doubled scheduler would read ~${2 * Math.round(leadCount * 2000 / spec.durMs)})`);
  const dup = leads.filter((t, i) => i > 0 && (t - leads[i - 1]) * 1000 < 30);
  assert(dup.length === 0, `no simultaneous duplicate lead notes (${dup.length})`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
