// tests/r6p5-beat.mjs — RUN6 phase 5: Boo Beat, the musical rework (C3).
// Acceptance (RUN6 part D #6): melody notes scheduled exactly on correct on-time hits
// across all three tracks; a sparkle harmonic on Perfects; a soft drum thud on a miss;
// combo-fever visuals at 6 combo (frame evidence); steady mode intact.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, boo_lolly: 1, boo_chomp: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, ledger: {},
  delights: { hideDay: today, hideFound: true },
  settings: { sound: true, music: true, voice: false, content: 'light' },   // light → Boo Beat auto-starts
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function open(save, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 640 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(async () => { const s = await import('./js/sfx.js'); s.initAudio(); s.setSoundEnabled(true); s.setMusicEnabled(true); });
  await page.evaluate(() => window.BooTown.go('beat'));
  await page.waitForSelector('.beat-field');
  await page.waitForFunction(() => window.__beat && window.__beat.state().notes > 0, { timeout: 5000 });
  return { ctx, page };
}
async function tapTags(page, kind) {
  await page.evaluate(async () => { const s = await import('./js/sfx.js'); s.setAudioLog(true); });
  await page.evaluate(k => { if (k === 'wrong') window.__beat.tapWrong(); else window.__beat.tapCorrect(k); }, kind);
  await sleep(70);
  return page.evaluate(async () => { const s = await import('./js/sfx.js'); return s.getAudioLog().filter(e => e.kind === 'note' && e.bus === 'sfx').map(e => e.tag); });
}
async function waitNotes(page) { await page.waitForFunction(() => { const s = window.__beat && window.__beat.state(); return s && s.notes > 0 && !s.resolving && !s.ended; }, { timeout: 4000 }).catch(() => {}); }

// ==================== melody on hits across all three tracks ====================
console.log('== correct hits play the melody, on all three tracks ==');
for (const track of ['golden', 'neon', 'sparkle']) {
  const { ctx, page } = await open(SAVE({ seen: { beatTrack: track, introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true } }));
  assert(await page.evaluate(() => window.__beat.track()) === track, `track "${track}" selected`);
  const idx0 = await page.evaluate(() => window.__beat.melodyIdx());
  const tags = await tapTags(page, 'good');
  assert(tags.includes('melody'), `${track}: a correct on-time hit schedules a melody note`);
  assert(!tags.includes('sparkle'), `${track}: a non-Perfect hit adds no sparkle`);
  const idx1 = await page.evaluate(() => window.__beat.melodyIdx());
  assert(idx1 === idx0 + 1, `${track}: the melody advances one note per correct hit`);
  await ctx.close();
}

// ==================== sparkle harmonic on Perfects + thud on miss ====================
console.log('== perfect sparkle + miss thud ==');
{
  const { ctx, page } = await open(SAVE());
  const perfect = await tapTags(page, 'perfect');
  assert(perfect.includes('melody') && perfect.includes('sparkle'), `a Perfect hit adds the sparkle harmonic (${perfect.join(',')})`);
  await waitNotes(page);
  const miss = await tapTags(page, 'wrong');
  assert(miss.includes('thud'), `a miss lands a soft drum thud, never silence (${miss.join(',')})`);
  await ctx.close();
}

// ==================== backing never stops + ducks during TTS ====================
console.log('== backing loop + TTS ducking ==');
{
  // a Words round (its questions speak → the music ducks) with voice on
  const ctx = await browser.newContext({ viewport: { width: 900, height: 640 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({ settings: { sound: true, music: true, voice: true, content: 'full' } }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(async () => { const s = await import('./js/sfx.js'); s.initAudio(); s.setSoundEnabled(true); s.setMusicEnabled(true); s.setAudioLog(true); });
  await page.evaluate(() => window.BooTown.go('beat', { resume: { cat: 'words', level: 1, mix: false } }));
  await page.waitForSelector('.beat-field');
  await sleep(900);   // let the backing loop tick + the first spoken Words question fire
  const log = await page.evaluate(async () => { const s = await import('./js/sfx.js'); const l = s.getAudioLog(); return { backing: l.filter(e => e.kind === 'note' && /beat-drum|beat-bass/.test(e.tag || '')).length, ducks: l.filter(e => e.kind === 'duck' && e.on).length }; });
  assert(log.backing > 0, `the backing track keeps playing (${log.backing} backing notes)`);
  assert(log.ducks > 0, `the music ducks during a spoken (Words) question (${log.ducks} duck events)`);
  await ctx.close();
}

// ==================== combo fever at 6 + frame evidence ====================
console.log('== combo fever at 6 ==');
{
  const { ctx, page } = await open(SAVE());
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__beat.tapCorrect('perfect')); await waitNotes(page); }
  const fever = await page.evaluate(() => ({ fever: window.__beat.fever(), crowd: window.__beat.crowd(), combo: window.__beat.state().combo }));
  assert(fever.fever === true, `combo ${fever.combo} lights the fever`);
  assert(fever.crowd > 0, `a crowd of Boos appears in fever (${fever.crowd})`);
  assert(!!(await page.$('.beat-field.fever')), 'the highway blooms (field gains .fever)');
  // frame evidence: the crowd bounces (transform changes over time)
  const fr = [];
  for (let k = 0; k < 6; k++) { fr.push(await page.evaluate(() => { const b = document.querySelector('.beat-crowd-boo'); return b ? getComputedStyle(b).transform : 'none'; })); await sleep(120); }
  assert(new Set(fr).size >= 2, `the fever crowd bounces (${new Set(fr).size} distinct frames)`);
  // a shimmer layer joins the melody in fever
  const shimmerTags = await tapTags(page, 'good');
  assert(shimmerTags.includes('melody') && shimmerTags.includes('shimmer'), `the melody gains a shimmer layer in fever (${shimmerTags.join(',')})`);
  await page.screenshot({ path: 'screenshots/r6p5/beat-fever-900x640.png' });
  await ctx.close();
}

// ==================== screenshots: highway + phone ====================
mkdirSync('screenshots/r6p5', { recursive: true });
for (const [w, h, tag] of [[768, 1024, 'portrait'], [390, 844, 'phone']]) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.hub');
  await p.evaluate(() => window.BooTown.go('beat'));
  await p.waitForSelector('.beat-field'); await sleep(500);
  await p.evaluate(async () => { for (let i = 0; i < 4; i++) { window.__beat.tapCorrect('perfect'); await new Promise(r => setTimeout(r, 600)); } });
  await sleep(300);
  await p.screenshot({ path: `screenshots/r6p5/beat-${tag}-${w}x${h}.png` });
  await c.close();
}

// ==================== steady mode intact ====================
console.log('== steady mode intact ==');
{
  const { ctx, page } = await open(SAVE({ seen: { beatSteady: true, beatTrack: 'midnight', introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true } }));
  assert(await page.evaluate(() => window.__beat.steady()) === true, 'steady mode is on');
  assert(!!(await page.$('.beat-field.steady')), 'the field is in steady layout');
  const before = await page.evaluate(() => window.__beat.state().correct);
  await page.evaluate(() => window.__beat.tapCorrect('good'));
  await sleep(80);
  assert(await page.evaluate(() => window.__beat.state().correct) === before + 1, 'a correct hit still scores in steady mode');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
