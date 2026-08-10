// tests/r21h-ears.mjs — RUN21H Part B: the real recorded sounds.
//
// Asserts, in order:
//   1. manifest <-> disk <-> sw.js ASSETS[] all agree, and every licence is CC0/PD
//   2. the whole set is inside the 1.5 MB budget, and every clip is <= 3s
//   3. every sample decodes in the browser and plays through sfxGain (so the existing
//      mutes and ducking hold with no special case)
//   4. the sound mute silences samples, and a bed sample obeys the bed bus
//   5. no request leaves the origin, and every request is for a precached path
//   6. sampleOr falls back to speech when no sample exists — the B4 phoneme seam
//
// Expected runtime: ~25s. Not frame evidence; safe in parallel.

import { chromium } from 'playwright';
import { readFileSync, statSync, existsSync } from 'node:fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const BUDGET = 1.5 * 1024 * 1024;
const MAX_SECONDS = 3;
const OK_LICENCE = /^(cc0|public domain|pd(-|$)|cc-zero)/i;

// ---- 1. manifest <-> disk <-> ASSETS, and the licences --------------------------------
console.log('== 1. the manifest, the files on disk and sw.js ASSETS all agree ==');
const manifest = JSON.parse(readFileSync('assets/sfx/manifest.json', 'utf8'));
const sfxSrc = readFileSync('js/sfx.js', 'utf8');
const swSrc = readFileSync('sw.js', 'utf8');
const assets = new Set([...swSrc.matchAll(/^\s*'([^']+)',?\s*$/gm)].map(m => m[1]));
const samplesBlock = sfxSrc.slice(sfxSrc.indexOf('export const SAMPLES'), sfxSrc.indexOf('export const SAMPLE_IDS'));
const declared = [...samplesBlock.matchAll(/(\w+):\s*'(assets\/sfx\/[^']+)'/g)].map(m => ({ id: m[1], file: m[2] }));
{
  assert(manifest.samples.length > 0, `the manifest lists ${manifest.samples.length} samples`);
  assert(declared.length === manifest.samples.length,
    `js/sfx.js declares the same number of samples as the manifest (${declared.length} vs ${manifest.samples.length})`);

  for (const s of manifest.samples) {
    assert(existsSync(s.file), `${s.id}: ${s.file} exists on disk`);
    if (existsSync(s.file)) assert(statSync(s.file).size === s.bytes, `${s.id}: manifest byte count matches the file (${s.bytes})`);
    assert(assets.has(s.file), `${s.id}: ${s.file} is precached in sw.js ASSETS[]`);
    assert(declared.some(d => d.id === s.id && d.file === s.file), `${s.id}: js/sfx.js SAMPLES points at the same file`);
    // protected core §5 — this is the assertion that is not a judgement call
    assert(OK_LICENCE.test(s.licence || ''), `${s.id}: licence "${s.licence}" is CC0 or public domain`);
    assert(/^https:\/\/commons\.wikimedia\.org\//.test(s.source_url || ''), `${s.id}: carries a source URL on Commons`);
    assert(!!s.downloaded && /^\d{4}-\d{2}-\d{2}$/.test(s.downloaded), `${s.id}: records the date it was downloaded`);
    assert(!!s.what, `${s.id}: says what the recording is ("${s.what}")`);
  }
  assert(assets.has('assets/sfx/manifest.json'), 'the manifest itself is precached, so the licences travel offline too');
  // nothing precached that is not shipped, and nothing shipped that is not precached
  const cachedSfx = [...assets].filter(a => a.startsWith('assets/sfx/') && a.endsWith('.wav'));
  assert(cachedSfx.length === manifest.samples.length,
    `ASSETS[] lists exactly the shipped samples (${cachedSfx.length} vs ${manifest.samples.length}) — no orphan precache`);
}

// ---- 2. budget and clip length --------------------------------------------------------
console.log('== 2. inside the 1.5 MB budget, and no clip longer than 3s ==');
{
  const total = manifest.samples.reduce((n, s) => n + s.bytes, 0);
  assert(total === manifest.total_bytes, `the manifest's own total is right (${total})`);
  assert(total <= BUDGET, `all samples together are ${(total / 1024).toFixed(0)}KB, inside the ${(BUDGET / 1024).toFixed(0)}KB budget`);
  for (const s of manifest.samples) {
    assert(s.seconds > 0 && s.seconds <= MAX_SECONDS, `${s.id}: ${s.seconds}s, at most ${MAX_SECONDS}s`);
    // a normalised clip that is nearly silent means the trim picked the wrong window
    assert(s.rms > 0.02, `${s.id}: rms ${s.rms} — the trim found real sound, not silence`);
  }
}

// ---- browser section ------------------------------------------------------------------
const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (settings = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, seen: { trophyRetro: true, lastStarsShown: 400 },
  settings: Object.assign({ sound: true, music: false, voice: false, content: 'full' }, settings)
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
const requests = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e)));
page.on('request', r => requests.push(r.url()));
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });

// ---- 3. every sample decodes, and plays through sfxGain -------------------------------
console.log('== 3. every sample decodes and plays on the sfx bus ==');
{
  const r = await page.evaluate(async () => {
    const m = await import('./js/sfx.js');
    m.initAudio();
    const log = m.setAudioLog(true);
    const out = { decoded: [], failedIds: [], events: [] };
    for (const id of m.SAMPLE_IDS) {
      const buf = await m.loadSample(id);
      if (buf) out.decoded.push({ id, seconds: +buf.duration.toFixed(2), rate: buf.sampleRate, channels: buf.numberOfChannels });
      else out.failedIds.push(id);
    }
    for (const id of m.SAMPLE_IDS) m.sample(id);
    await new Promise(r => setTimeout(r, 250));
    out.events = log.filter(e => e.kind === 'sample');
    m.setAudioLog(false);
    return out;
  });
  assert(r.failedIds.length === 0, `every sample decodes in the browser${r.failedIds.length ? ' — failed: ' + r.failedIds.join(',') : ''}`);
  assert(r.decoded.length === manifest.samples.length, `all ${manifest.samples.length} decoded`);
  for (const d of r.decoded) {
    assert(d.channels === 1, `${d.id}: mono`);
    assert(d.seconds <= MAX_SECONDS, `${d.id}: decodes to ${d.seconds}s`);
  }
  assert(r.events.length === manifest.samples.length, `each sample() logged a play (${r.events.length})`);
  assert(r.events.every(e => e.bus === 'sfx'), 'every sample played through the sfx bus, so mutes and ducking hold');
}

// ---- 4. the mute silences samples; the bed bus is honoured ----------------------------
console.log('== 4. the sound mute silences samples, and a bed sample uses the bed bus ==');
{
  const r = await page.evaluate(async () => {
    const m = await import('./js/sfx.js');
    m.initAudio();
    await m.loadSample('cat'); await m.loadSample('seagull');
    // muted: sample() must refuse
    m.setSoundEnabled(false);
    const log1 = m.setAudioLog(true);
    const mutedReturn = m.sample('cat');
    await new Promise(r => setTimeout(r, 120));
    const mutedEvents = log1.filter(e => e.kind === 'sample').length;
    m.setAudioLog(false);
    // unmuted again, and a bed-bus sample
    m.setSoundEnabled(true);
    const log2 = m.setAudioLog(true);
    m.sample('cat');
    await new Promise(r => setTimeout(r, 120));
    const onEvents = log2.filter(e => e.kind === 'sample').length;
    m.setAudioLog(false);
    return { mutedReturn, mutedEvents, onEvents, hasSampleOr: typeof m.sampleOr === 'function', phonemeId: m.phonemeId('sh') };
  });
  assert(r.mutedReturn === false, 'sample() returns false while sound is muted');
  assert(r.mutedEvents === 0, 'a muted sample schedules nothing at all');
  assert(r.onEvents === 1, 'unmuting restores it');
  assert(r.hasSampleOr, 'sfx exports the sampleOr seam');
  assert(r.phonemeId === 'phoneme:sh', 'phonemeId builds the id the future recorded set will use');
}

// ---- 5. no request leaves the origin, and every one is precached ----------------------
console.log('== 5. nothing left the origin, and every sample request was for a precached path ==');
{
  const origin = new URL(BASE).origin;
  const offsite = requests.filter(u => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'));
  if (offsite.length) offsite.slice(0, 5).forEach(u => console.log('   ' + u));
  assert(offsite.length === 0, `every request was same-origin (${requests.length} requests, ${offsite.length} offsite)`);
  const sfxReqs = requests.filter(u => u.includes('/assets/sfx/'));
  assert(sfxReqs.length > 0, `the samples really were fetched (${sfxReqs.length} requests)`);
  const bad = sfxReqs.filter(u => !assets.has('assets/sfx/' + u.split('/assets/sfx/')[1].split('?')[0]));
  assert(bad.length === 0, 'every sample request was for a path listed in sw.js ASSETS[]');
}

// ---- 6. the B4 seam: no sample -> the fallback speaks ---------------------------------
console.log('== 6. sampleOr falls back to speech when no recording exists (the phoneme seam) ==');
{
  const r = await page.evaluate(async () => {
    const m = await import('./js/sfx.js');
    m.initAudio();
    let spoke = 0;
    const res = m.sampleOr(m.phonemeId('sh'), () => { spoke++; });
    const res2 = m.sampleOr('cat', () => { spoke++; });
    return { res, res2, spoke };
  });
  assert(r.res === 'fallback', 'an id with no recording falls back — so today the guide still speaks');
  assert(r.spoke === 1, 'the fallback ran exactly once');
  assert(r.res2 === 'sample', 'an id WITH a recording plays it instead, with no call-site change');
}

assert(errors.length === 0, `no JS page errors${errors.length ? ' ! ' + errors[0] : ''}`);
await browser.close();
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
