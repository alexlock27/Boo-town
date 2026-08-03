// tests/r21f7-beds.mjs — RUN21F F7: per-area ambient beds.
// ACCEPT: each area audibly distinct in a capture; muting music/sfx behaves per the existing
// contract; speech ducks; total CPU impact <2ms/frame. Audio behaviour is proven by
// INSTRUMENTATION LOGS (house evidence standard), never by ear: setAudioLog() captures every
// scheduled bed event with its bus and tag, bedInfo() reports the live bus gain and layers,
// and a `bedtick` line times the scheduler itself so the CPU claim carries a real number.
// Expected runtime: ~70s (three 12-second cap windows run in parallel contexts).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'boohouse_kitchen', 'boohouse_bedroom', 'gallery'];
const SAVE = {
  version: 23, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 },
  stars: { total: 400, byType: {}, spent: {} },
  town: { areas: Object.fromEntries(AREA_KEYS.map(k => [k, { items: k === 'meadow' ? [{ item: 'boo_inky', x: 0.12, row: 2 }] : [], paths: [] }])) },
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
  // The beds need a live AudioContext; the app makes one on the first gesture.
  await page.evaluate(async () => { const s = await import('./js/sfx.js'); s.initAudio(); s.setMusicEnabled(true); });
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
const bedInfo = page => page.evaluate(async () => (await import('./js/sfx.js')).bedInfo());

// ==================== 1. every area gets its own bed, and they differ ====================
console.log('== each area mounts a distinct bed ==');
{
  const { ctx, page } = await openApp();
  const seen = {};
  for (const area of ['beach', 'riverside', 'hilltop', 'meadow', 'playground']) {
    await goArea(page, area);
    await sleep(400);
    const info = await bedInfo(page);
    seen[area] = info;
    assert(info.area === area, `${area}: its bed starts with the area mount (${JSON.stringify(info.layers)})`);
    assert(info.layers.length > 0, `${area}: the bed has at least one synthesis layer`);
  }
  // "audibly distinct in a capture" — no two beds share a synthesis signature.
  const sigs = Object.entries(seen).map(([a, i]) => `${a}=${i.layers.join('+')}`);
  const shapes = Object.values(seen).map(i => i.layers.join('+'));
  assert(new Set(shapes).size === 5, `all five beds are distinct: ${sigs.join(' · ')}`);
  const washes = ['beach', 'riverside', 'hilltop'];
  assert(washes.every(a => seen[a].nodes > 0), `the three wash beds run continuous nodes (${washes.map(a => a + ':' + seen[a].nodes).join(' ')})`);
  assert(seen.meadow.scheduling && seen.playground.scheduling, 'the two event-only beds run their schedulers');

  // ---- house rooms stay quiet; the Funfair keeps its jingle rules ----
  for (const [area, room] of [['funfair', null], ['boohouse', 'lounge'], ['boohouse', 'kitchen'], ['boohouse', 'bedroom'], ['gallery', null]]) {
    await goArea(page, area, room);
    await sleep(300);
    const info = await bedInfo(page);
    assert(info.area === null && info.nodes === 0 && !info.scheduling,
      `${room ? area + '/' + room : area}: no bed at all (${JSON.stringify(info)})`);
  }
  // ---- and the bed stops when the area unmounts ----
  await goArea(page, 'beach');
  await sleep(300);
  assert((await bedInfo(page)).area === 'beach', 'back on the beach, the bed is running again');
  await page.evaluate(() => window.BooTown.go('hub'));
  await sleep(600);
  const off = await bedInfo(page);
  assert(off.area === null && off.nodes === 0 && !off.scheduling, `leaving the area stops the bed (${JSON.stringify(off)})`);
  await ctx.close();
}

// ==================== 2. level, mutes and ducking ====================
console.log('== level, the mute contract, and ducking under speech ==');
{
  const { ctx, page } = await openApp();
  await goArea(page, 'hilltop');
  await sleep(700);
  const lvl = await bedInfo(page);
  assert(lvl.gain > 0 && lvl.gain <= 0.12, `the bed bus sits at ${lvl.gain} (pack cap: <= 0.12)`);

  // speech ducks it (the same music.duck() the guide already calls)
  const ducked = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.music.duck(true);
    await new Promise(r => setTimeout(r, 600));
    return s.bedInfo().gain;
  });
  assert(Math.abs(ducked - 0.04) < 0.005, `speech ducks the bed to ${ducked} (pack: 0.04)`);
  const restored = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.music.duck(false);
    await new Promise(r => setTimeout(r, 600));
    return s.bedInfo().gain;
  });
  assert(Math.abs(restored - 0.12) < 0.005, `and it comes back up to ${restored} when the guide stops`);

  // muting MUSIC silences the bed and stops its scheduling — the existing ambient contract
  const muted = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.setMusicEnabled(false);
    s.setAudioLog(true);
    await new Promise(r => setTimeout(r, 900));
    const log = s.getAudioLog();
    return { gain: s.bedInfo().gain, nodes: s.bedInfo().nodes, scheduling: s.bedInfo().scheduling,
      events: log.filter(e => e.kind === 'note' && e.bus === 'bed').length };
  });
  assert(muted.gain === 0, `muting music takes the bed bus to ${muted.gain}`);
  assert(!muted.scheduling && muted.nodes === 0, 'and tears the bed down rather than playing to a closed gain');
  assert(muted.events === 0, `no bed events are scheduled while music is muted (${muted.events})`);
  const back = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.setMusicEnabled(true);
    await new Promise(r => setTimeout(r, 500));
    return s.bedInfo();
  });
  assert(back.gain > 0 && back.nodes > 0, `un-muting music brings the bed back (${back.gain}, ${back.nodes} nodes)`);

  // muting SFX leaves it alone — the sfx mute governs effects, ambience rides the music bus
  const sfxMuted = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    s.setSoundEnabled(false);
    await new Promise(r => setTimeout(r, 400));
    const info = s.bedInfo();
    s.setSoundEnabled(true);
    return info;
  });
  assert(sfxMuted.area === 'hilltop' && sfxMuted.gain > 0,
    'muting sound effects leaves the ambience alone, exactly as the day/night bed already behaves');
  await ctx.close();
}

// ==================== 3. the sparse events fire, and stay inside their caps ==============
console.log('== sparse events: they happen, and never faster than the pack allows ==');
{
  // 12 seconds each, run in parallel contexts (one module singleton per page).
  const WINDOW = 12000;
  const CAP = { beach: { tag: 'bed:beach:gull', perMin: 2 }, meadow: { tag: 'bed:meadow:birdsong', perMin: 3 }, playground: { tag: 'bed:playground:babble', perMin: 2 } };
  const runs = await Promise.all(Object.keys(CAP).map(async area => {
    const { ctx, page } = await openApp();
    await page.evaluate(async () => { (await import('./js/sfx.js')).setAudioLog(true); });
    await goArea(page, area);
    await sleep(WINDOW);
    const log = await page.evaluate(async () => (await import('./js/sfx.js')).getAudioLog());
    await ctx.close();
    return { area, log };
  }));
  for (const { area, log } of runs) {
    const { tag, perMin } = CAP[area];
    const mine = log.filter(e => e.kind === 'note' && e.tag === tag);
    const other = log.filter(e => e.kind === 'note' && e.bus === 'bed' && e.tag && e.tag !== tag);
    assert(mine.length >= 1, `${area}: the bed's own voice is heard within ${WINDOW / 1000}s (${mine.length} × ${tag})`);
    // minGap is 30s (beach/playground) or 20s (meadow), so a 12s window can hold exactly one.
    const allowed = Math.max(1, Math.ceil(perMin * (WINDOW / 60000)));
    assert(mine.length <= allowed, `${area}: ${mine.length} in ${WINDOW / 1000}s honours the <=${perMin}/min cap`);
    assert(other.length === 0, `${area}: no other area's voice leaks into it (${other.length})`);
  }
  // three-note motif: the meadow's birdsong logs its head note and schedules exactly 3
  const meadow = runs.find(r => r.area === 'meadow').log.filter(e => e.kind === 'note' && e.bus === 'bed');
  assert(meadow.length >= 1 && meadow.every(e => e.freq >= 2000),
    `meadow birdsong sits in the bird register (${meadow.map(e => e.freq).join(',')} Hz)`);
}

// ==================== 4. CPU: the bed costs nothing per frame ====================
console.log('== CPU impact ==');
{
  const { ctx, page } = await openApp();
  await page.evaluate(async () => { (await import('./js/sfx.js')).setAudioLog(true); });
  const sample = () => page.evaluate(() => new Promise(res => {
    const d = []; let last = performance.now(); let n = 0;
    (function f(now) { d.push(now - last); last = now; if (++n < 240) requestAnimationFrame(f); else res(d.slice(1)); })(last);
  }));
  await goArea(page, 'beach');           // wash + event scheduler: the busiest bed
  await sleep(500);
  const withBed = await sample();
  const ticks = await page.evaluate(async () => {
    const s = await import('./js/sfx.js');
    const t = s.getAudioLog().filter(e => e.kind === 'bedtick');
    s.setAudioLog(true);
    return { n: t.length, total: t.reduce((a, e) => a + e.ms, 0) };
  });
  await page.evaluate(async () => { (await import('./js/sfx.js')).bed.stop(); });
  await sleep(500);
  const without = await sample();
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const p95 = a => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
  const dMean = mean(withBed) - mean(without), dP95 = p95(withBed) - p95(without);
  // The scheduler's own main-thread cost, spread over the frames of the same window.
  const perFrame = ticks.n ? ticks.total / withBed.length : 0;
  console.log(`    frames: bed on mean ${mean(withBed).toFixed(2)}ms p95 ${p95(withBed).toFixed(2)}ms · bed off mean ${mean(without).toFixed(2)}ms p95 ${p95(without).toFixed(2)}ms`);
  console.log(`    scheduler: ${ticks.n} ticks, ${ticks.total.toFixed(3)}ms total → ${perFrame.toFixed(4)}ms/frame`);
  assert(Math.abs(dMean) < 2, `mean frame time moves ${dMean.toFixed(2)}ms with the bed running (<2ms)`);
  assert(Math.abs(dP95) < 2, `p95 frame time moves ${dP95.toFixed(2)}ms with the bed running (<2ms)`);
  assert(perFrame < 2, `the bed scheduler costs ${perFrame.toFixed(4)}ms/frame of main-thread time (<2ms)`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
