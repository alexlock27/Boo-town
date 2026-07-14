// tests/r6p3-band.mjs — RUN6 phase 3: the Boo Band (C1c).
// Acceptance (RUN6 part D #4): each instrument logs its scheduled notes; drums take
// simultaneous multi-touch; Play-along sparkles the authored sequence and waits
// indefinitely; a scripted jam records, replays identically by event log, saves, sets
// as band song, and the band performs it in watch mode; the 3-jam cap + hold-to-delete
// work; no microphone APIs are touched.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r6p3', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const BOOS = ['inky', 'plum', 'pippin', 'chomp', 'curly'].map(n => 'boo_' + n);

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(b => [b, 1])), boxes: 0, meter: 0, opened: 10, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 300, byGame: {} }, ledger: {},
  delights: { hideDay: today, hideFound: true },
  settings: { sound: true, music: true, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside', 'hilltop', 'beach', 'funfair'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function open(save, { screen = 'band' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(async () => { const s = await import('./js/sfx.js'); s.initAudio(); s.setSoundEnabled(true); s.setMusicEnabled(true); });
  await page.evaluate(async () => { const m = await import('./js/idb.js'); await m.idbClear('jams').catch(() => {}); });
  if (screen === 'band') { await page.evaluate(() => window.BooTown.go('band')); await page.waitForFunction(() => window.__band, { timeout: 4000 }); }
  return { ctx, page };
}

// ==================== no microphone anywhere in this feature ====================
console.log('== no microphone APIs ==');
{
  const { ctx, page } = await open(SAVE());
  const src = await page.evaluate(() => fetch('./js/band.js').then(r => r.text()));
  assert(!/getUserMedia|mediaDevices|MediaRecorder|navigator\.mediaDevices/.test(src), 'band.js references no microphone API');
  await ctx.close();
}

// ==================== each instrument logs its scheduled notes ====================
console.log('== instruments schedule notes ==');
{
  const { ctx, page } = await open(SAVE());
  const tags = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js'); sfx.setAudioLog(true);
    window.__band.hit('drum', 'kick'); window.__band.hit('key', 0); window.__band.hit('guitar', 'C');
    await new Promise(r => setTimeout(r, 80));
    return sfx.getAudioLog().filter(e => e.kind === 'note').map(e => e.tag);
  });
  assert(tags.some(t => t === 'drum:kick'), 'drums schedule a note (drum:kick logged)');
  assert(tags.some(t => t === 'key'), 'keys schedule a note (key logged)');
  assert(tags.some(t => /^guitar:C/.test(t)), 'guitar schedules chord notes (guitar:C logged)');
  await ctx.close();
}

// ==================== drums accept simultaneous multi-touch ====================
console.log('== drums multi-touch ==');
{
  const { ctx, page } = await open(SAVE());
  const distinct = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js'); sfx.setAudioLog(true);
    window.__band.setInstrument('drums');
    const pads = [...document.querySelectorAll('.drum-pad')];
    // two fingers press two pads within the same tick — independent per-pad handlers
    pads[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    pads[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 }));
    await new Promise(r => setTimeout(r, 60));
    return [...new Set(sfx.getAudioLog().filter(e => e.kind === 'note').map(e => e.tag))];
  });
  assert(distinct.filter(t => t.startsWith('drum:')).length >= 2, `two pads pressed at once both fire (${distinct.join(',')})`);
  await ctx.close();
}

// ==================== Play-along sparkles + waits indefinitely ====================
console.log('== play-along ==');
{
  const { ctx, page } = await open(SAVE());
  await page.evaluate(() => window.__band.setPlayAlong('twinkle'));
  const wanted0 = await page.evaluate(() => window.__band.nextWantedKey());
  assert(wanted0 === 0, 'play-along starts on the first Twinkle note (key 0)');
  const sparkles = await page.$$eval('.key.sparkle', ns => ns.length);
  assert(sparkles === 1, 'exactly the next key sparkles');
  await sleep(1200);   // it must NOT auto-advance
  assert(await page.evaluate(() => window.__band.songPos()) === 0, 'the sparkle waits indefinitely (no auto-advance)');
  await page.evaluate(() => window.__band.pressKey(0));   // press the wanted key
  assert(await page.evaluate(() => window.__band.songPos()) === 1, 'pressing the wanted key advances the sequence');
  await page.evaluate(() => window.__band.pressKey(5));   // a wrong key
  assert(await page.evaluate(() => window.__band.songPos()) === 1, 'a wrong key still sounds but does not advance (gentle)');
  await ctx.close();
}

// ==================== record → replay identically → save → band song → watch ====================
console.log('== record / replay / save / set as band song / watch ==');
{
  const { ctx, page } = await open(SAVE());
  // record a scripted 3-note jam
  await page.evaluate(() => window.__band.record());
  await page.evaluate(() => window.__band.hit('drum', 'kick')); await sleep(140);
  await page.evaluate(() => window.__band.hit('key', 0)); await sleep(140);
  await page.evaluate(() => window.__band.hit('guitar', 'C')); await sleep(140);
  await page.evaluate(() => window.__band.stop());
  const events = await page.evaluate(() => window.__band.events());
  assert(events.length === 3 && events[0].i === 'drum' && events[1].i === 'key' && events[2].i === 'guitar', `captured the 3-note event log in order (${events.map(e => e.i).join(',')})`);
  // replay: the playback schedules exactly those events (identity via the log)
  const replay = await page.evaluate(async (evs) => {
    const sfx = await import('./js/sfx.js'); sfx.setAudioLog(true);
    window.__band.play();
    const dur = Math.max(...evs.map(e => e.t)) + 500;
    await new Promise(r => setTimeout(r, dur));
    return sfx.getAudioLog().filter(e => e.kind === 'note' && e.bus === 'sfx').map(e => e.tag);
  }, events);
  // collapse consecutive same-instrument notes (a key = 2 envelopes, a chord = 4)
  const seq = replay.map(t => t.split(':')[0]).filter((f, i, a) => i === 0 || f !== a[i - 1]);
  assert(seq.join(',') === 'drum,key,guitar', `replay reproduces the event log in order (${seq.join(',')})`);
  // save + set as band song
  const saved = await page.evaluate(() => window.__band.save('Test Jam'));
  assert(saved && saved.ok, 'the jam saves to IndexedDB');
  await page.evaluate(id => window.__band.setBandSong(id), saved.id);
  // watch mode: the band performs it on the bandstand
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForFunction(() => window.__townLife && window.__townLife.hasBandstand());
  const watch = await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js'); sfx.setSoundEnabled(true); sfx.setMusicEnabled(true); sfx.setAudioLog(true);
    window.__townLife.scrollToBandstand();
    await new Promise(r => setTimeout(r, 1400));
    return { zone: window.__townLife.zoneMusic(), tags: [...new Set(sfx.getAudioLog().filter(e => e.kind === 'note').map(e => e.tag))] };
  });
  assert(watch.zone === 'band', 'the bandstand on screen switches the town audio to the band');
  assert(watch.tags.some(t => t === 'drum:kick') && watch.tags.some(t => /guitar/.test(t)), `watch mode performs the saved jam through the synths (${watch.tags.join(',')})`);
  await ctx.close();
}

// ==================== 3-jam cap + hold-to-delete ====================
console.log('== 3-jam cap + hold-to-delete ==');
{
  const { ctx, page } = await open(SAVE());
  async function recordAndSave(name) {
    await page.evaluate(() => window.__band.record());
    await page.evaluate(() => window.__band.hit('drum', 'kick')); await sleep(60);
    await page.evaluate(() => window.__band.stop());
    return page.evaluate(n => window.__band.save(n), name);
  }
  const s1 = await recordAndSave('One'); const s2 = await recordAndSave('Two'); const s3 = await recordAndSave('Three');
  assert(s1.ok && s2.ok && s3.ok, 'three jams save');
  const s4 = await recordAndSave('Four');
  assert(!s4.ok && s4.reason === 'full', 'a fourth jam is refused (3-jam cap)');
  assert((await page.evaluate(() => window.__band.jams())).length === 3, 'exactly three jams stored');
  // hold-to-delete: a real long press on a jam row → confirm → gone
  await page.waitForSelector('.jam-row');
  const row = await page.$('.jam-row');
  await row.scrollIntoViewIfNeeded();   // RUN9 C6: Band 2.0 adds a layers strip, so the jams list can sit below the fold
  const box = await row.boundingBox();
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(800);   // past the 650ms hold
  await page.mouse.up();
  await page.waitForSelector('.overlay .dialog', { timeout: 2000 });
  await page.click('.dialog .btn.danger');
  await sleep(200);
  assert((await page.evaluate(() => window.__band.jams())).length === 2, 'holding a jam and confirming deletes it (2 left)');
  await page.screenshot({ path: 'screenshots/r6p3/band-screen-1000x700.png' });
  await ctx.close();
}

// ==================== screenshots: both orientations + phone ====================
for (const [w, h, tag] of [[768, 1024, 'portrait'], [390, 844, 'phone']]) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.hub');
  await p.evaluate(() => window.BooTown.go('band')); await p.waitForFunction(() => window.__band);
  await sleep(300);
  await p.screenshot({ path: `screenshots/r6p3/band-${tag}-${w}x${h}.png` });
  await c.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
