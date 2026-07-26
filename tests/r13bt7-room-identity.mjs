// @serial — frame-sampling: ember flicker / fairy light pixel-hash sequences (runs alone at the board's end; RUN14 U-0)
// RUN13B T7 — rooms that are rooms: each Boo House room owns its walls, floor and
// fixed built-ins. The acceptance bar is a screenshot a child could label unprompted.
//
// What is proved here:
//   • the three rooms are VISIBLY distinct: an automated pixel-difference check between
//     every room pair must exceed the stated threshold (>=18% of stage pixels differing
//     by >24 in some channel — walls, floors and built-ins all differ, so real room
//     identity lands far above it), plus eyeball sheets for the human;
//   • each room's authored built-ins render, in the hills layer BEHIND placed furniture
//     (no z-fighting: backdrop paints first, items paint over it);
//   • windows follow device time (day/dawn/dusk/night), the Bedroom dims at night with
//     curtains drawn and fairy lights glowing — with frame evidence for ember flicker
//     and fairy twinkle (6+ frames spanning 3+ seconds, pixel hashes not JS signatures);
//   • reduced-motion stills the ember and the fairy lights into static glows;
//   • the room switcher shows a palette-tinted thumbnail per room, names intact;
//   • outdoor ambience (butterflies/fireflies/weather) stays OUT of the rooms.
//
// Expected runtime: ~90s (frame sampling spans two 3.4s windows).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { createHash } from 'crypto';
import sharp from 'sharp';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run13b/t7';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;
const hash = buf => createHash('sha1').update(buf).digest('hex').slice(0, 12);

const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery',
  'boohouse_kitchen', 'boohouse_bedroom'];
const SAVE = (areas = {}) => ({
  version: 15, name: 'Ada', ageAsked: true, age: 8,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, deco_sofa: 2, deco_bed: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, stars: { total: 60, byGame: {} }, ledger: {},
  town: { areas: Object.assign(Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])), areas) },
  care: { bonds: {}, treats: 3 },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { boohouseSeeded: true, funfairOpened: 'x', introSeen: { care: true }, trophyRetro: true, townFirst: true },
  delights: {}, trophies: {}, journal: {}
});

const browser = await chromium.launch();
async function openRoom(room, { hour = 13, w = 1024, h = 768, areas = {}, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(hr => { window.__bootownHour = hr; }, hour);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE(areas)));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(r => window.BooTown.go('town', { area: 'boohouse', room: r }), room);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(350);
  return { ctx, page };
}
async function stageClip(page) {
  const r = await page.locator('.t-viewport').boundingBox();
  return { x: Math.ceil(r.x), y: Math.ceil(r.y), width: Math.floor(r.width) - 2, height: Math.floor(r.height) - 2 };
}
// Fraction of pixels differing by >24 in some RGB channel between two same-size PNGs.
async function pixelDiffFraction(pngA, pngB) {
  const a = await sharp(pngA).raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(pngB).raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return -1;
  const ch = a.info.channels, n = a.info.width * a.info.height;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    const o = i * ch;
    if (Math.abs(a.data[o] - b.data[o]) > 24 || Math.abs(a.data[o + 1] - b.data[o + 1]) > 24 || Math.abs(a.data[o + 2] - b.data[o + 2]) > 24) diff++;
  }
  return diff / n;
}
async function meanLuma(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let sum = 0; const n = info.width * info.height;
  for (let i = 0; i < n; i++) { const o = i * info.channels; sum += 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]; }
  return sum / n;
}

console.log('== each room is visibly its own place: automated pixel difference per pair ==');
const roomShots = {};   // day, per room, stage clip only
{
  for (const room of ['lounge', 'kitchen', 'bedroom']) {
    const { ctx, page } = await openRoom(room);
    const builtins = await page.evaluate(() => window.__townLife.builtins());
    const want = { lounge: ['door', 'fireplace', 'window'], kitchen: ['window', 'sink', 'shelf'], bedroom: ['fairylights', 'window'] }[room];
    ok(want.every(b => builtins.includes(b)), `${room}: authored built-ins all present (${builtins.join(', ')})`);
    roomShots[room] = await page.screenshot({ clip: await stageClip(page), path: `${SHOTS}/room-${room}-day-1024x768.png` });
    await ctx.close();
  }
  const THRESHOLD = 0.18;   // stated: >=18% of stage pixels must differ per room pair
  for (const [a, b] of [['lounge', 'kitchen'], ['lounge', 'bedroom'], ['kitchen', 'bedroom']]) {
    const f = await pixelDiffFraction(roomShots[a], roomShots[b]);
    ok(f >= THRESHOLD, `${a} vs ${b}: ${(f * 100).toFixed(1)}% of stage pixels differ (threshold ${(THRESHOLD * 100).toFixed(0)}%)`);
  }
  // the eyeball sheet: three rooms side by side, day
  const metas = await Promise.all(['lounge', 'kitchen', 'bedroom'].map(r => sharp(roomShots[r]).metadata()));
  const W = metas[0].width, H = metas[0].height;
  await sharp({ create: { width: W * 3 + 16, height: H, channels: 3, background: '#fff' } })
    .composite(['lounge', 'kitchen', 'bedroom'].map((r, i) => ({ input: roomShots[r], left: i * (W + 8), top: 0 })))
    .png().toFile(`${SHOTS}/room-sheet-day.png`);
  console.log('  eyeball sheet: room-sheet-day.png');
}

console.log('== the switcher: each room named over a thumbnail tinted in its own palette ==');
{
  const { ctx, page } = await openRoom('lounge');
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.t-room-tab')].map(b => ({
    room: b.dataset.room, label: b.textContent.trim(),
    thumbWall: (b.querySelector('.rt-thumb svg rect') || {}).getAttribute?.('fill') || null
  })));
  ok(tabs.length === 3 && tabs.every(t => t.thumbWall), 'every tab carries an SVG thumbnail');
  ok(distinct(tabs.map(t => t.thumbWall)) === 3, `the three thumbnails are tinted differently (${tabs.map(t => t.thumbWall).join(', ')})`);
  const palettes = await page.evaluate(async () => {
    const { HOUSE_ROOMS } = await import('./js/areas.js');
    return Object.fromEntries(HOUSE_ROOMS.map(r => [r.id, r.palette.wall]));
  });
  ok(tabs.every(t => t.thumbWall === palettes[t.room]), 'each thumbnail wears its own room\'s wall colour');
  ok(tabs.every(t => /lounge|kitchen|bedroom/i.test(t.label)), 'and every room is still named');
  await ctx.close();
}

console.log('== built-ins are backdrop: behind placed furniture, no z-fighting ==');
{
  // A sofa placed straight over the fireplace must paint ON TOP of it.
  const areas = { boohouse: { items: [{ zone: 'boohouse', x: .30, row: 1, item: 'deco_sofa' }], paths: [] } };
  const { ctx, page } = await openRoom('lounge', { areas });
  const layering = await page.evaluate(() => {
    const builtin = document.querySelector('[data-builtin="fireplace"]');
    const item = document.querySelector('.t-item[data-item="deco_sofa"]');
    if (!builtin || !item) return null;
    const hills = builtin.closest('.t-hills'), ground = item.closest('.t-ground');
    return {
      builtinInHills: !!hills, itemInGround: !!ground,
      hillsBeforeGround: !!(hills && ground && (hills.compareDocumentPosition(ground) & Node.DOCUMENT_POSITION_FOLLOWING)),
      builtinZ: getComputedStyle(builtin).zIndex, noPointer: getComputedStyle(builtin.parentElement).pointerEvents === 'none',
      overlap: (() => { const b = builtin.getBoundingClientRect(), s = item.getBoundingClientRect(); return s.left < b.right && s.right > b.left; })()
    };
  });
  ok(!!layering, 'the fireplace and the sofa both render');
  if (layering) {
    ok(layering.overlap, 'the sofa really does overlap the fireplace (the test means something)');
    ok(layering.builtinInHills && layering.itemInGround && layering.hillsBeforeGround,
      'built-ins live in the hills layer, items in the ground layer, hills paints first');
    ok(layering.builtinZ === 'auto', `no z-index war (builtin z-index: ${layering.builtinZ})`);
    ok(layering.noPointer, 'the built-ins layer never eats a tap (pointer-events: none)');
  }
  await ctx.close();
}

console.log('== windows follow device time ==');
{
  for (const [hour, want] of [[13, 'day'], [6, 'dawn'], [18, 'dusk'], [22, 'night']]) {
    const { ctx, page } = await openRoom('lounge', { hour });
    ok(await page.evaluate(() => window.__townLife.windowSky()) === want, `at ${hour}:00 the window shows ${want}`);
    await ctx.close();
  }
}

console.log('== the Bedroom leans darker and cosier at night ==');
{
  const day = await openRoom('bedroom', { hour: 13 });
  ok(await day.page.evaluate(() => window.__townLife.bedroomCurtains()) === 'open', 'curtains open by day');
  ok(await day.page.evaluate(() => window.__townLife.fairyLightsOn()) === 'off', 'fairy lights off by day');
  const dayWall = await day.page.screenshot({ clip: await stageClip(day.page) });
  await day.ctx.close();
  const night = await openRoom('bedroom', { hour: 22 });
  ok(await night.page.evaluate(() => window.__townLife.bedroomCurtains()) === 'drawn', 'curtains drawn at night');
  ok(await night.page.evaluate(() => window.__townLife.fairyLightsOn()) === 'on', 'fairy lights on at night');
  const nightWall = await night.page.screenshot({ clip: await stageClip(night.page), path: `${SHOTS}/room-bedroom-night-1024x768.png` });
  const dl = await meanLuma(dayWall), nl = await meanLuma(nightWall);
  ok(nl < dl * 0.88, `the night room is measurably dimmer (luma ${nl.toFixed(0)} vs ${dl.toFixed(0)} by day)`);
  // frame evidence: the fairy lights twinkle — pixel hashes over 8 frames spanning 3.4s
  const lightsBox = await night.page.evaluate(() => window.__townLife.builtinBox('fairylights'));
  const clip = { x: Math.ceil(lightsBox.x), y: Math.ceil(Math.max(0, lightsBox.y)), width: Math.floor(Math.min(1000, lightsBox.width)), height: Math.floor(lightsBox.height) };
  const frames = [];
  for (let k = 0; k < 8; k++) { frames.push(hash(await night.page.screenshot({ clip }))); await sleep(480); }
  ok(distinct(frames) >= 4, `the fairy lights really twinkle (${distinct(frames)}/8 distinct frames over 3.4s)`);
  await night.ctx.close();
}

console.log('== the Lounge fire flickers — and holds a static warm glow under reduced motion ==');
{
  const { ctx, page } = await openRoom('lounge');
  const fireBox = await page.evaluate(() => window.__townLife.builtinBox('fireplace'));
  const clip = { x: Math.ceil(fireBox.x), y: Math.ceil(fireBox.y), width: Math.floor(fireBox.width), height: Math.floor(fireBox.height) };
  const frames = [];
  for (let k = 0; k < 8; k++) { frames.push(hash(await page.screenshot({ clip }))); await sleep(480); }
  ok(distinct(frames) >= 4, `the ember flickers (${distinct(frames)}/8 distinct frames over 3.4s)`);
  await ctx.close();

  const rm = await openRoom('lounge', { reduced: true });
  const still = await rm.page.evaluate(() => {
    const flame = document.querySelector('.rm-flame'), glow = document.querySelector('.rm-glow');
    return { flameAnim: getComputedStyle(flame).animationName, glowAnim: getComputedStyle(glow).animationName, glowOpacity: parseFloat(getComputedStyle(glow).opacity) };
  });
  ok(still.flameAnim === 'none' && still.glowAnim === 'none', 'reduced motion stills the flames and the glow');
  ok(still.glowOpacity >= 0.3, `the warm glow itself stays (opacity ${still.glowOpacity})`);
  const b = await rm.page.evaluate(() => window.__townLife.builtinBox('fireplace'));
  const c2 = { x: Math.ceil(b.x), y: Math.ceil(b.y), width: Math.floor(b.width), height: Math.floor(b.height) };
  const f1 = hash(await rm.page.screenshot({ clip: c2 }));
  await sleep(1100);
  const f2 = hash(await rm.page.screenshot({ clip: c2 }));
  ok(f1 === f2, 'under reduced motion the fireplace is pixel-still');
  await rm.ctx.close();

  const rmNight = await openRoom('bedroom', { hour: 22, reduced: true });
  const fairyStill = await rmNight.page.evaluate(() => {
    const halo = document.querySelector('.rm-fairy.on .rm-fairy-halo');
    return halo ? { anim: getComputedStyle(halo).animationName, opacity: parseFloat(getComputedStyle(halo).opacity) } : null;
  });
  ok(!!fairyStill && fairyStill.anim === 'none' && fairyStill.opacity >= 0.5,
    `reduced motion holds the fairy lights in a steady glow (${fairyStill ? fairyStill.opacity : 'missing'})`);
  await rmNight.ctx.close();
}

console.log('== outdoor ambience stays outdoors ==');
{
  const { ctx, page } = await openRoom('kitchen', { hour: 13 });
  ok(await page.locator('.t-butterfly, .t-firefly').count() === 0, 'no butterflies loose in the kitchen');
  ok(await page.locator('.t-weather').count() === 0, 'no weather indoors');
  await ctx.close();
  const night = await openRoom('lounge', { hour: 22 });
  ok(await night.page.locator('.t-firefly').count() === 0, 'no fireflies in the lounge at night');
  await night.ctx.close();
  // …and the Meadow still has its ambient life (the gate is indoors-only, not a cull).
  const ctx2 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page2 = await ctx2.newPage();
  await page2.addInitScript(hr => { window.__bootownHour = hr; }, 13);
  await page2.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE()));
  await page2.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page2.waitForSelector('.hub');
  await page2.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page2.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(300);
  ok(await page2.locator('.t-butterfly').count() > 0, 'the Meadow keeps its butterflies');
  await ctx2.close();
}

console.log('== the three viewports all read (screenshot evidence) ==');
{
  for (const [w, h] of [[768, 1024], [390, 844]]) {
    for (const room of ['lounge', 'kitchen', 'bedroom']) {
      const { ctx, page } = await openRoom(room, { w, h });
      const builtins = await page.evaluate(() => window.__townLife.builtins());
      ok(builtins.length >= 2, `${room} at ${w}x${h}: built-ins render (${builtins.join(', ')})`);
      await page.screenshot({ path: `${SHOTS}/room-${room}-${w}x${h}.png` });
      await ctx.close();
    }
  }
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
