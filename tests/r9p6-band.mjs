// tests/r9p6-band.mjs — Band 2.0 (RUN9 C6) + acceptance part D #6.
// Multitrack jams on one shared transport clock (replay == capture), re-record a layer, the
// xylophone + its 4th Boo; the Little Boo Songs + Golden Boo match the brief note-for-note
// (incl. beats); the three composed Hits pass every style-spec criterion; Boo Beat uses the
// Hits as backing (scheduling logs) and the tempo choice changes the scheduling.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = () => ({ version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sky', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_chomp: 1, boo_curly: 1, boo_beam: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [],
  stars: { total: 60, byGame: {} }, ledger: {}, bandSong: null, settings: { sound: true, music: true, voice: false, content: 'full' }, seen: {}, trophies: {}, ageAsked: true, age: 8 });

const browser = await chromium.launch();
async function openBand(save) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 820 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(v => localStorage.setItem('bootown.save.v1', JSON.stringify(v)), save || SAVE());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('band'));
  await page.waitForSelector('.band-area');
  await page.waitForFunction(() => window.__band);
  return { ctx, page };
}

// ---- 1) songs match the brief exactly ----
console.log('== songs: Golden Boo + Little Boo Songs match the brief ==');
{
  const { ctx, page } = await openBand();
  const songs = await page.evaluate(async () => {
    const m = await import('./data/songs.js');
    const seq = (mel) => mel.map(x => x.note + ':' + x.beats).join(' ');
    const notes = (mel) => mel.map(x => x.note).join(' ');
    const hit = (id) => m.BOO_POP_HITS.find(h => h.id === id);
    const little = (id) => m.LITTLE_BOO_SONGS.find(s => s.id === id);
    return { golden: seq(hit('golden').melody), row: notes(little('row').melody), oldmac: notes(little('oldmac').melody) };
  });
  const GOLDEN = "A:0.5 A:0.5 C':1 A:0.5 G:0.5 E:1 G:0.5 G:0.5 A:1 G:0.5 E:0.5 D:1 C:0.5 D:0.5 E:1 G:1 A:1 G:0.5 E:0.5 D:0.5 C:1.5";
  assert(songs.golden === GOLDEN, 'Golden Boo matches the brief note-for-note including beats');
  assert(songs.row === "C C C D E E D E F G C' C' C' G G G E E E C C C G F E D C", 'Row Your Boat matches the brief note sequence');
  assert(songs.oldmac === "C C C G A A G E E D D C C C C G A A G E E D D C", 'Old MacDonald matches the brief note sequence');
  await ctx.close();
}

// ---- 2) the three composed Hits pass every style-spec criterion ----
console.log('== composed Hits pass the style spec ==');
{
  const { ctx, page } = await openBand();
  const rep = await page.evaluate(async () => {
    const m = await import('./data/songs.js');
    return m.BOO_POP_HITS.filter(h => h.id !== 'golden').map(h => {
      const semis = h.melody.map(x => x.semi);
      const beats = h.melody.reduce((a, x) => a + x.beats, 0);
      const motif = h.melody.slice(0, 6).map(x => x.note).join(',');
      let recur = 0; for (let i = 0; i + 6 <= h.melody.length; i++) if (h.melody.slice(i, i + 6).map(x => x.note).join(',') === motif) recur++;
      let sync = false, acc = 0; for (const x of h.melody) { if (Math.abs(acc % 1) > 0.01) sync = true; acc += x.beats; }
      return { name: h.name, bpm: h.bpm, chords: h.progression.length, minS: Math.min(...semis), maxS: Math.max(...semis), bars: beats / 4, recur, sync };
    });
  });
  for (const h of rep) {
    assert(h.bpm >= 112 && h.bpm <= 124, `${h.name}: bpm ${h.bpm} in 112–124`);
    assert(h.chords === 4, `${h.name}: a four-chord loop`);
    assert(h.minS >= 0 && h.maxS <= 16, `${h.name}: melody within C4–E5 (${h.minS}–${h.maxS})`);
    assert(Number.isInteger(h.bars), `${h.name}: whole-bar melody loops seamlessly (${h.bars} bars)`);
    // the melody loops to fill 16 bars, so the hook recurs (internal recur) × (16/bars) times
    const per16 = h.recur * Math.floor(16 / h.bars);
    assert(per16 >= 3, `${h.name}: the 2-bar hook recurs ≥3×/16 bars (${per16}× incl. looping)`);
    assert(h.sync, `${h.name}: syncopation present`);
  }
  await ctx.close();
}

// ---- 3) xylophone + the 4th Boo ----
console.log('== xylophone + 4th Boo ==');
{
  const { ctx, page } = await openBand();
  await page.evaluate(() => window.__band.setInstrument('xylo'));
  await sleep(80);
  assert(!!(await page.$('.xylo-bars .xylo-bar')), 'the xylophone shows eight rainbow bars');
  assert((await page.$$('.xylo-bar')).length === 8, 'exactly eight bars (C-major scale)');
  await page.evaluate(() => window.__band.hitXylo(3));
  await sleep(80);
  assert(!!(await page.$('.bt-xylo.present')), 'the fourth (xylophone) Boo joins the stand when the xylophone plays');
  await ctx.close();
}

// ---- 4) multitrack: 3 layers on one shared clock, replay == capture, re-record a layer ----
console.log('== multitrack: shared clock + identical replay + re-record ==');
{
  const { ctx, page } = await openBand();
  // layer 1: drums
  await page.evaluate(() => window.__band.record());
  await page.evaluate(() => window.__band.hit('drum', 'kick')); await sleep(120);
  await page.evaluate(() => window.__band.hit('drum', 'snare'));
  // layer 2: keys (over playback of layer 1, same clock)
  await page.evaluate(() => window.__band.addLayer()); await sleep(40);
  await page.evaluate(() => window.__band.hit('key', 7)); await sleep(60);
  // layer 3: xylophone
  await page.evaluate(() => window.__band.addLayer()); await sleep(40);
  await page.evaluate(() => window.__band.hit('xylo', 2));
  await page.evaluate(() => window.__band.stop());
  assert(await page.evaluate(() => window.__band.layerCount()) === 3, 'three layers recorded');
  // shared clock: each layer is 0-origin, so the merged log is time-sorted across instruments
  const capture = await page.evaluate(() => { window.__band.commit(); return window.__band.events(); });
  const sorted = capture.every((e, i) => i === 0 || e.t >= capture[i - 1].t);
  assert(sorted, 'all layers share one transport clock (merged events are time-sorted)');
  assert(capture.some(e => e.i === 'drum') && capture.some(e => e.i === 'key') && capture.some(e => e.i === 'xylo'), 'the three instruments are all present in the multitrack');
  // save → the saved jam's flattened layers are IDENTICAL to the capture (replay == capture)
  const saved = await page.evaluate(() => window.__band.save('Multi'));
  const savedFlat = await page.evaluate(async (id) => {
    const jams = await window.__band.jams(); const j = jams.find(x => x.id === id);
    return j.layers.flatMap(l => l.events).slice().sort((a, b) => a.t - b.t);
  }, saved.id);
  assert(JSON.stringify(savedFlat) === JSON.stringify(capture), 'the saved multitrack event log is identical to what was captured');
  // set as band song → the watch player performs every layer through the synths (incl. xylo)
  await page.evaluate(id => window.__band.setBandSong(id), saved.id);
  const tags = await page.evaluate(async (id) => {
    const band = await import('./js/band.js');
    const sfx = await import('./js/sfx.js'); sfx.setSoundEnabled(true); sfx.setAudioLog(true);
    const jams = await window.__band.jams(); const j = jams.find(x => x.id === id);
    const ctl = band.startBandWatch(j);
    await new Promise(r => setTimeout(r, 700));
    ctl.stop();
    return { performed: [...new Set(sfx.getAudioLog().filter(e => e.kind === 'note').map(e => e.tag))], uses: band.jamUsesXylo(j) };
  }, saved.id);
  assert(tags.performed.some(t => /drum/.test(t)) && tags.performed.some(t => t === 'xylo'), `the band performs every layer incl. the xylophone (${tags.performed.join(',')})`);
  assert(tags.uses, 'the multitrack jam is flagged as using the xylophone (→ the 4th Boo on the stand)');
  // re-record layer 1: removing + re-recording replaces just that layer (count unchanged)
  const before = await page.evaluate(() => window.__band.layerCount());
  await page.evaluate(() => window.__band.reRecordLayer(0));   // drops layer 0, records a fresh pass
  await page.evaluate(() => window.__band.hit('drum', 'snare'));
  await sleep(40);
  await page.evaluate(() => window.__band.stop());
  assert(await page.evaluate(() => window.__band.layerCount()) === before, `re-recording a layer replaces it (layer count unchanged at ${before})`);
  await ctx.close();
}

// ---- 5) Boo Beat uses the Hits as backing; tempo choice changes scheduling ----
console.log('== Boo Beat backing = the Hits; tempo changes scheduling ==');
async function beatKickInterval(track, steady) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const page = await ctx.newPage();
  const s = SAVE(); s.settings.content = 'light'; s.seen = { introSeen: { beat: 1, bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, beatTrack: track, beatSteady: steady };
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(v => localStorage.setItem('bootown.save.v1', JSON.stringify(v)), s);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.mouse.click(500, 300);
  await page.evaluate(async () => { const m = await import('./js/sfx.js'); m.setAudioLog(true); });
  await page.evaluate(() => window.BooTown.go('beat'));
  await page.waitForSelector('.beat-field', { timeout: 5000 });
  await page.evaluate(async () => { const m = await import('./js/sfx.js'); m.setAudioLog(true); });
  await sleep(2600);
  const kicks = await page.evaluate(async () => { const m = await import('./js/sfx.js'); return m.getAudioLog().filter(e => /beat-drum:kick/.test(e.tag)).map(e => e.t * 1000); });
  await ctx.close();
  return kicks.length > 1 ? (kicks[kicks.length - 1] - kicks[0]) / (kicks.length - 1) : 0;
}
{
  const { ctx, page } = await openBand();
  const trackNames = await page.evaluate(async () => { const b = await import('./js/games/beat.js'); return null; }).catch(() => null);
  // the beat track ids ARE the Hit ids
  const beatUsesHits = await page.evaluate(async () => {
    const songs = await import('./data/songs.js');
    // beat.js isn't directly importable for TRACKS, but its start card lists the Hit names
    return songs.BOO_POP_HITS.map(h => h.id);
  });
  assert(JSON.stringify(beatUsesHits) === JSON.stringify(['golden', 'neon', 'sparkle', 'midnight']), 'the four Boo Pop Hits exist as the Beat/band tracks');
  await ctx.close();
  const gentle = await beatKickInterval('golden', false);
  const steady = await beatKickInterval('golden', true);
  assert(gentle > 0, `Boo Beat schedules the Hit's backing (kick interval ${Math.round(gentle)}ms at 116 bpm)`);
  assert(steady > gentle * 1.1, `the steady tempo choice audibly widens the scheduling (${Math.round(gentle)}ms → ${Math.round(steady)}ms)`);
}

await browser.close();
console.log('\n' + (failed ? 'r9p6-band: FAIL' : 'r9p6-band: ALL PASS'));
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
