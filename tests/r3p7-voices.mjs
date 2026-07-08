// tests/r3p7-voices.mjs — RUN3 phase 7: Boo voices (acceptance D16).
// Uses Chromium's fake microphone device so recording works headlessly.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }, boxes: 0, meter: 0, opened: 3, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [{ zone: 'meadow', x: 0.3, item: 'boo_inky' }], stars: { total: 60, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: null, goldenLastDouble: '', quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, journal: {}, customs: [], studioSeen: false, easelArt: '', settings: { sound: false, music: false, voice: false, mic: true }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } } };

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, permissions: ['microphone'] });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');
await page.mouse.click(512, 120); // gesture so audio can init
await page.evaluate(async () => { const m = await import('./js/voices.js'); await m.deleteAllVoices(); });

// helper: open the voice recorder for a Boo and record via the fake mic, then save with a mode
async function recordFor(booName, mode) {
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-tile.owned');
  await page.click(`.coll-tile.owned:has-text("${booName}")`);
  await page.waitForSelector('.dialog, .modal, button:has-text("Give a voice")', { timeout: 3000 }).catch(() => {});
  await page.click('button:has-text("Give a voice")');
  await page.waitForSelector('.voice-overlay');
  // record via the fake device
  await page.click('.voice-rec');
  await sleep(700);
  await page.click('.voice-rec'); // stop
  await page.waitForFunction(() => window.__voice && window.__voice.hasRecorded(), { timeout: 3000 }).catch(() => {});
  await page.evaluate((m) => window.__voice.setMode(m), mode);
  await page.click('.voice-save');
  await sleep(400);
  await page.evaluate(() => window.__voice && window.__voice.close());
}

// ---- D16: record + save + per-Boo assignment ----
console.log('== D16: record + save ==');
await recordFor('Inky', 'normal');
const rec1 = await page.evaluate(async () => { const m = await import('./js/voices.js'); return { has: await m.hasVoice('boo_inky'), count: await m.voiceCount() }; });
assert(rec1.has && rec1.count === 1, 'a recording saves and is assigned to that Boo (Inky)');

// ---- D16: all three voice modes stored ----
console.log('== D16: three voice modes ==');
await recordFor('Plum', 'squeaky');
await recordFor('Pippin', 'deep');
const modes = await page.evaluate(async () => {
  const { idbGet } = await import('./js/idb.js');
  const a = await idbGet('audio', 'voice_boo_inky'), b = await idbGet('audio', 'voice_boo_plum'), c = await idbGet('audio', 'voice_boo_pippin');
  const V = (await import('./js/voices.js')).VOICE_MODES;
  return { inky: a && a.mode, plum: b && b.mode, pippin: c && c.mode, rates: V };
});
assert(modes.inky === 'normal' && modes.plum === 'squeaky' && modes.pippin === 'deep', 'each Boo stores its chosen voice mode');
assert(modes.rates.normal === 1 && modes.rates.squeaky > 1 && modes.rates.deep < 1, 'normal/squeaky/deep map to distinct pitch rates');

// ---- D16: tap playback in the town plays the recording ----
console.log('== D16: tap playback ==');
const played = await page.evaluate(async () => { const m = await import('./js/voices.js'); const ids = await m.voiceBooIds(); const ok = await m.playVoice('boo_inky'); return { inSet: ids.has('boo_inky'), played: ok }; });
assert(played.inSet, 'the town knows which Boos have a voice');
assert(played.played, 'playing a saved recording decodes and plays (tap playback)');

// ---- D16: grown-ups mic toggle hides recording UI ----
console.log('== D16: mic toggle hides UI ==');
await page.evaluate(async () => { const st = await import('./js/state.js'); st.mutate(s => { s.settings.mic = false; }); });
await page.evaluate(() => window.BooTown.go('collection'));
await page.waitForSelector('.coll-tile.owned');
await page.click('.coll-tile.owned:has-text("Inky")');
await sleep(200);
const voiceBtnGone = await page.$$eval('button', bs => !bs.some(b => /Give a voice/.test(b.textContent)));
assert(voiceBtnGone, 'with the mic setting off, the "Give a voice" button is hidden');
// dismiss dialog
await page.keyboard.press('Escape').catch(() => {});
await page.evaluate(() => { const d = document.querySelector('.dialog-overlay, .overlay'); if (d) d.remove(); });

// ---- D16: delete-all clears IndexedDB audio ----
console.log('== D16: delete all recordings ==');
await page.evaluate(async () => { const m = await import('./js/voices.js'); await m.deleteAllVoices(); });
const afterDelete = await page.evaluate(async () => (await import('./js/voices.js')).voiceCount());
assert(afterDelete === 0, 'delete-all clears every recording from IndexedDB');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
