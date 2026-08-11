// tools/sfx-fetch.mjs — RUN21H B2: download, trim, normalise and encode the chosen sounds.
//
// Local tooling, NOT shipped. Run once; the outputs are committed.
//   node tools/sfx-fetch.mjs
//
// THE CHOSEN list below is the survivor of two gates, both in this folder:
//   1. tools/sfx-source.mjs  — the licence is CC0 or public domain, read from the Commons
//      API's own extmetadata. Protected core §5; not a judgement call.
//   2. tools/sfx-verify.mjs  — the file is actually the SOUND and not a person SAYING the
//      word (Commons is full of licence-clean pronunciation recordings) and not the wrong
//      animal (every "pig" hit was a guinea pig; "Lion dance percussion" is a drum troupe).
//
// PROCESSING, and why it happens in Chromium. This box has no ffmpeg and no sox, so there
// is no way to trim or re-encode on the command line. Chromium (already here for the test
// suite) decodes any format the app itself can decode, which makes it the honest tool: if
// Chromium can read it, the child's browser can. Per file it:
//   * decodes to raw samples
//   * finds the LOUDEST window of `seconds` — that is the trim, and it removes leading
//     silence without guessing where the sound starts
//   * fades 12 ms in and out so the cut never clicks
//   * normalises the peak to 0.92
//   * downmixes to mono and resamples to 16 kHz (plenty for an animal noise)
//   * writes a 16-bit PCM WAV
//
// WAV rather than the pack's OGG/Opus is a deliberate deviation, recorded in the ledger:
// no encoder exists on this machine, and WAV at 16 kHz mono keeps the whole set inside the
// 1.5 MB budget while staying decodable everywhere including iOS Safari, which does not
// decode WebM/Opus. The budget is asserted by tests/r21h-ears.mjs, not trusted.

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Resumable: upload.wikimedia.org rate-limits, so a run that loses a file to a 429 should
// not re-fetch the nine it already has. Completed entries accumulate here between runs.
const DONE = '.tmp-sfx-done.json';
const done = existsSync(DONE) ? JSON.parse(readFileSync(DONE, 'utf8')) : {};

const OUT = 'assets/sfx';
const RATE = 16000;
const PEAK = 0.92;

// LANE B ADDENDUM.
//
//   node tools/sfx-fetch.mjs --only cow,dog,duck,owl
//
// --only fetches JUST those ids and MERGES them into the existing assets/sfx/manifest.json
// rather than rebuilding it from scratch. That matters: a rebuild re-derives the whole
// manifest from CHOSEN, so one 429 on an unrelated file would silently drop a sound that is
// already shipping and already precached. Merge mode cannot do that.
//
// It also prints a SPECTRAL REPORT per file, because nothing on this machine can hear them.
// A cow's moo is a sustained, strongly harmonic voice with a low fundamental; a cattle shed's
// clank is broadband and impulsive. Reporting fundamental, harmonicity and sustain is not the
// same as listening — but it is the difference between "the trim found the loudest thing"
// and "the trim found an animal", and it is checkable by someone else later.
//
// id, the Commons file, its verified licence, and how long a clip the game wants.
export const CHOSEN = [
  // ---- LANE B: the four the RUN21H set could not have, because CC0/PD had none ----------
  // The cow is the honest risk of this set: the only ISOLATED moos on Commons
  // (File:Single Cow Moo.ogg, File:Mudchute cow 1.ogg) are both CC BY-SA, which is excluded.
  // This is a 144s cattle-shed recording from a museum — a real cattle voice is in there,
  // but so is the shed. It ships only if the spectral report says the trim found the animal.
  { id: 'cow',  title: 'File:WWS Cattleshed.ogg',                                     licence: 'CC BY 4.0', seconds: 2.0, pick: 'low', note: 'cattle in the shed at the National Museum of Agriculture' },
  { id: 'dog',  title: 'File:Woof 2 (Gravity Sound).wav',                             licence: 'CC BY 4.0', seconds: 1.4, note: 'a single dog woof' },
  // The duck came back CC0, not CC-BY — better than the brief needed. RUN21H missed it
  // because it is filed as "snatching" (Dutch snateren, to quack), not "quack".
  { id: 'duck', title: 'File:Ducks snatching.ogg',                                    licence: 'CC0',       seconds: 1.6, note: 'ducks quacking in a Belgian park' },
  // Strix aluco is the right owl: the app already prints "Twit twoo", and that is this bird.
  { id: 'owl',  title: 'File:Tawny owl calling at night in Tuntorp, Brastad, Sweden.ogg', licence: 'CC BY 4.0', seconds: 1.4, note: 'a tawny owl calling at night in Sweden' },
  { id: 'cat',       title: 'File:Maullido de gata hembra joven.ogg',      licence: 'CC0',           seconds: 1.6, note: 'meow of a young female cat' },
  { id: 'sheep',     title: 'File:Sheep bleat.ogg',                        licence: 'CC0',           seconds: 1.8, note: 'sheep bleating' },
  { id: 'horse',     title: 'File:Wiehern.ogg',                            licence: 'Public domain', seconds: 2.2, note: 'a neighing horse' },
  { id: 'lion',      title: 'File:Lion raring-sound1TamilNadu178.ogg',     licence: 'Public domain', seconds: 2.4, note: 'lion roaring in captivity' },
  { id: 'bee',       title: 'File:Bombus buzz.ogg',                        licence: 'Public domain', seconds: 2.0, note: 'bumblebee buzzing' },
  { id: 'frog',      title: 'File:Grasfrosch Paarungsrufe.OGG',            licence: 'Public domain', seconds: 2.0, note: 'common frog calling' },
  { id: 'rooster',   title: 'File:Small rooster crowing.ogg',              licence: 'Public domain', seconds: 2.2, note: 'rooster crowing' },
  { id: 'blackbird', title: 'File:Turdus merula 2.ogg',                    licence: 'Public domain', seconds: 2.6, note: 'blackbird singing in a Finnish forest' },
  { id: 'seagull',   title: 'File:Gull 2.ogg',                             licence: 'Public domain', seconds: 2.0, note: 'herring gull calling' },
  { id: 'rain',      title: 'File:Rain.ogg',                               licence: 'Public domain', seconds: 2.8, note: 'rain falling' },
  { id: 'thunder',   title: 'File:Rain and thunder.ogg',                   licence: 'Public domain', seconds: 2.6, note: 'thunder over rain' },
  { id: 'bell',      title: 'File:GlockenSMarco.ogg',                      licence: 'Public domain', seconds: 2.4, note: 'the bells of San Marco, Venice' }
];

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'BooTownSfxSourcing/1.0 (offline educational PWA; licence-verification tooling)';
let last = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function meta(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 20) {
    const wait = Math.max(0, 1700 - (Date.now() - last)); if (wait) await sleep(wait); last = Date.now();
    const url = API + '?' + new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2',
      titles: titles.slice(i, i + 20).join('|'), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata'
    });
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    const t = await r.text();
    if (!t.startsWith('{')) { await sleep(5000); i -= 20; continue; }
    for (const p of (JSON.parse(t).query.pages || [])) {
      const ii = (p.imageinfo || [])[0]; if (!ii) continue;
      const em = ii.extmetadata || {};
      const val = (k) => (em[k] && em[k].value != null ? String(em[k].value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
      out[p.title] = {
        url: ii.url, mime: ii.mime, bytes: ii.size, descUrl: ii.descriptionurl,
        licence: val('LicenseShortName') || val('License'), usageTerms: val('UsageTerms'),
        artist: val('Artist'), credit: val('Credit')
      };
    }
  }
  return out;
}

// 16-bit PCM mono WAV from a Float32Array.
function wav(samples, rate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

// LANE B — same gate as the two survey tools: CC-BY in, SA/NC/ND out, by name.
const VIRAL = /share.?alike|noncommercial|non.?commercial|no.?deriv|\bsa\b|\bnc\b|\bnd\b/i;
const OK_LICENCE = /^(cc0|public domain|pd(-|$)|cc-zero|cc[-\s]?by([-\s]|\d|$))/i;
const licenceOk = (short = '', terms = '') => {
  const s = String(short).trim(), t = String(terms).trim();
  if (VIRAL.test(s) || VIRAL.test(t)) return false;
  return OK_LICENCE.test(s) || /(creative commons zero|public domain|cc0|creative commons attribution)/i.test(t);
};

// --only cow,dog: fetch just these, and MERGE into the manifest instead of rebuilding it.
const onlyArg = (process.argv.find(a => a.startsWith('--only')) || '').split('=')[1]
  || (process.argv[process.argv.indexOf('--only') + 1] || '');
const ONLY = process.argv.includes('--only') && onlyArg && !onlyArg.startsWith('--')
  ? new Set(onlyArg.split(',').map(s => s.trim()).filter(Boolean)) : null;
const WORK = ONLY ? CHOSEN.filter(c => ONLY.has(c.id)) : CHOSEN;
if (ONLY) console.log(`--only: ${[...ONLY].join(', ')} (merging into the existing manifest)\n`);

mkdirSync(OUT, { recursive: true });
const info = await meta(WORK.map(c => c.title));

// Wikimedia rate-limits (429) anything that looks like an anonymous bot, and a headless
// Chromium's default UA is exactly that. The same descriptive User-Agent the API calls use
// gets the media through. Requests are also fetched from a Commons page rather than
// about:blank so the Origin is sane.
const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: UA });
const page = await ctx.newPage();
await page.goto('https://commons.wikimedia.org/wiki/Main_Page', { waitUntil: 'domcontentloaded' });

// In --only mode the EXISTING manifest is the base, so entries that are already shipping and
// already precached survive untouched even if this run fails entirely.
const MANIFEST_FILE = join(OUT, 'manifest.json');
const base = ONLY && existsSync(MANIFEST_FILE) ? JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) : null;
const manifest = base
  ? { ...base, samples: base.samples.filter(s => !ONLY.has(s.id)) }
  : { generated: process.env.RUN21H_STAMP || 'run21h', note: 'RUN21H B2 — every file CC0 or public domain, licence read from the Wikimedia Commons API. See tools/sfx-fetch.mjs for the two gates each file passed.', samples: [] };
let total = manifest.samples.reduce((n, s) => n + (s.bytes || 0), 0);
const spectra = [];

for (const c of WORK) {
  if (done[c.id] && existsSync(join(OUT, `${c.id}.wav`))) {
    manifest.samples.push(done[c.id]); total += done[c.id].bytes;
    console.log(`  -- ${c.id.padEnd(10)} already fetched, kept`);
    continue;
  }
  const m = info[c.title];
  if (!m) { console.log(`!! ${c.id}: no metadata for ${c.title} — SKIPPED`); continue; }
  // Re-verify the licence at download time. The survey said it was clean; if that has
  // changed, or the recorded expectation disagrees with the API, it does not ship. Full stop.
  if (!licenceOk(m.licence, m.usageTerms)) { console.log(`!! ${c.id}: licence "${m.licence}" is not CC0/PD/CC-BY — SKIPPED`); continue; }
  if (m.licence.toLowerCase().replace(/\s+/g, '') !== c.licence.toLowerCase().replace(/\s+/g, '')) {
    console.log(`!! ${c.id}: licence drift, expected "${c.licence}" got "${m.licence}" — SKIPPED`); continue;
  }

  // upload.wikimedia.org rate-limits too; space the media fetches out and retry once.
  await sleep(2500);
  const res = await page.evaluate(async ([url, seconds, rate, peak, pick]) => {
    const nap = (ms) => new Promise(r => setTimeout(r, ms));
    let r = await fetch(url);
    if (r.status === 429) { await nap(6000); r = await fetch(url); }
    if (!r.ok) return { error: 'HTTP ' + r.status };
    const ab = await r.arrayBuffer();
    const ac = new AudioContext();
    let src;
    try { src = await ac.decodeAudioData(ab); } catch (e) { return { error: 'decode: ' + e.message }; }
    // mono mixdown at the source rate
    const ch = src.numberOfChannels, len = src.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < ch; c++) { const d = src.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
    // The trim. Normally: the LOUDEST window of `seconds`, which drops leading silence
    // without guessing where the sound starts.
    //
    // pick:'low' instead scores each window by its LOW-BAND energy (a one-pole lowpass at
    // ~400 Hz). LANE B added this for the cow: in a 144-second cattle shed the loudest thing
    // is not the cow, it is the shed — gates, buckets, boots — and the first pass proved it,
    // returning a clip whose measured pitch was 1000 Hz when a moo lives near 150. A moo is
    // the lowest-frequency thing in a barn, so that is what to search for.
    const win = Math.min(len, Math.round(seconds * src.sampleRate));
    const step = Math.max(1, Math.round(src.sampleRate * 0.02));
    // A first cut scored windows by LOW-BAND ENERGY and picked exactly the same window as
    // plain loudness — because a shed's clank is loud in the bass AND everywhere else. What
    // separates a moo from a clank is not how much bass it has but how much of it IS bass.
    // So the score is bass DOMINANCE: (bass energy) x (bass share of total energy).
    let lo = null;
    if (pick === 'low') {
      const a = Math.exp(-2 * Math.PI * 400 / src.sampleRate);
      lo = new Float32Array(len);
      let y = 0;
      for (let i = 0; i < len; i++) { y = (1 - a) * mono[i] + a * y; lo[i] = y; }
    }
    let best = 0, bestE = -1;
    for (let s = 0; s + win <= len; s += step) {
      let e = 0;
      if (lo) {
        let eLo = 0, eAll = 0;
        for (let i = s; i < s + win; i += 8) { eLo += lo[i] * lo[i]; eAll += mono[i] * mono[i]; }
        e = eAll > 0 ? eLo * (eLo / eAll) : 0;
      } else {
        for (let i = s; i < s + win; i += 8) e += mono[i] * mono[i];
      }
      if (e > bestE) { bestE = e; best = s; }
    }
    const cut = mono.subarray(best, best + win);
    // resample to `rate` (linear; plenty for a 16 kHz animal noise)
    const outLen = Math.round(win * rate / src.sampleRate);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const t = i * src.sampleRate / rate, i0 = Math.floor(t), f = t - i0;
      out[i] = (cut[i0] || 0) * (1 - f) + (cut[i0 + 1] || 0) * f;
    }
    // 12 ms fades so the cut never clicks
    const fade = Math.round(rate * 0.012);
    for (let i = 0; i < fade && i < outLen; i++) { out[i] *= i / fade; out[outLen - 1 - i] *= i / fade; }
    // normalise
    let pk = 0; for (let i = 0; i < outLen; i++) pk = Math.max(pk, Math.abs(out[i]));
    if (pk > 0) { const g = peak / pk; for (let i = 0; i < outLen; i++) out[i] *= g; }
    let rms = 0; for (let i = 0; i < outLen; i++) rms += out[i] * out[i];

    // ---- spectral report (LANE B): what IS this, when nothing here can hear it? --------
    // An animal VOICE — a moo, a woof, a quack, a hoot — is periodic, so autocorrelation
    // finds a strong peak at its pitch period. A clank, a splash or wind does not. This
    // does not replace a human listen; it distinguishes "the trim found the loudest thing
    // in the file" from "the trim found an animal", which is the failure this run risks.
    const minLag = Math.floor(rate / 900), maxLag = Math.floor(rate / 60);   // 60–900 Hz
    let e0 = 0; for (let i = 0; i < outLen; i++) e0 += out[i] * out[i];
    let acBest = 0, acLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let i = 0; i + lag < outLen; i++) s += out[i] * out[i + lag];
      const norm = s / (e0 || 1);
      if (norm > acBest) { acBest = norm; acLag = lag; }
    }
    // envelope: how much of the clip is actually sounding (sustained) vs one transient
    const fr = Math.round(rate * 0.02);
    const env = [];
    for (let i = 0; i + fr <= outLen; i += fr) {
      let e = 0; for (let j = i; j < i + fr; j++) e += out[j] * out[j];
      env.push(Math.sqrt(e / fr));
    }
    const envPk = Math.max(...env, 1e-9);
    const sustain = env.filter(v => v > envPk * 0.25).length / (env.length || 1);
    // zero-crossing rate: high means hiss/noise, low means a pitched voice
    let zc = 0; for (let i = 1; i < outLen; i++) if ((out[i - 1] < 0) !== (out[i] < 0)) zc++;

    return {
      samples: Array.from(out), srcRate: src.sampleRate, srcSeconds: src.duration,
      rms: Math.sqrt(rms / outLen),
      f0: acLag ? +(rate / acLag).toFixed(1) : 0,
      harmonicity: +acBest.toFixed(3),
      sustain: +sustain.toFixed(2),
      zcr: Math.round(zc / (outLen / rate))
    };
  }, [m.url, c.seconds, RATE, PEAK, c.pick || 'loud']);

  if (res.error) { console.log(`!! ${c.id}: ${res.error} — SKIPPED`); continue; }
  const buf = wav(Float32Array.from(res.samples), RATE);
  const file = `${c.id}.wav`;
  writeFileSync(join(OUT, file), buf);
  total += buf.length;
  const entry = {
    id: c.id, file: `${OUT}/${file}`,
    source_url: m.descUrl, media_url: m.url,
    licence: m.licence, usage_terms: m.usageTerms || '',
    author: (m.artist || '').slice(0, 120),
    downloaded: new Date().toISOString().slice(0, 10),
    what: c.note,
    seconds: +(res.samples.length / RATE).toFixed(2),
    source_seconds: +res.srcSeconds.toFixed(2),
    bytes: buf.length, rms: +res.rms.toFixed(4)
  };
  manifest.samples.push(entry);
  done[c.id] = entry;
  writeFileSync(DONE, JSON.stringify(done, null, 2));
  spectra.push({ id: c.id, ...res, samples: undefined });
  console.log(`  ok ${c.id.padEnd(10)} ${String(Math.round(buf.length / 1024)).padStart(4)}KB  ${(res.samples.length / RATE).toFixed(2)}s  rms ${res.rms.toFixed(3)}  ${m.licence}`);
  console.log(`     spectral: f0 ${String(res.f0).padStart(6)}Hz · harmonicity ${res.harmonicity} · sustain ${res.sustain} · zcr ${res.zcr}/s`);
}

await browser.close();
if (ONLY) {
  manifest.generated = process.env.LANEB_STAMP || manifest.generated;
  manifest.note = 'Every file here is CC0, public domain, or CC-BY — never Share-Alike, NonCommercial or NoDerivatives. The licence is read from the Wikimedia Commons API at download time and re-checked before the file is written. CC-BY obliges the app to name the author, which the Grown-ups corner does: its "Sound credits" card is generated from THIS file at render time, so it cannot drift. Sourced by tools/sfx-source.mjs (licence gate), filtered by tools/sfx-verify.mjs (is it really that sound, or someone SAYING the word), fetched and processed by tools/sfx-fetch.mjs (loudest window, 12ms fades, peak-normalised, mono, 16kHz, 16-bit WAV).';
}
// samples keep the CHOSEN order rather than the order they happened to be fetched in
const order = CHOSEN.map(c => c.id);
manifest.samples.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
manifest.total_bytes = manifest.samples.reduce((n, s) => n + (s.bytes || 0), 0);
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${manifest.samples.length} samples, ${(manifest.total_bytes / 1024).toFixed(0)}KB total (budget 1536KB)`);

// The spectral report, gathered, so the judgement is made on numbers and can be re-checked.
if (spectra.length) {
  console.log('\n== spectral report — is each clip an ANIMAL, or just the loudest noise? ==');
  console.log('   a voice: harmonicity high (>0.3), f0 in the animal\'s range, zcr low');
  console.log('   a clank/splash/wind: harmonicity low, zcr high, sustain low');
  for (const s of spectra) {
    console.log(`   ${s.id.padEnd(6)} f0 ${String(s.f0).padStart(6)}Hz  harm ${String(s.harmonicity).padEnd(6)} sustain ${String(s.sustain).padEnd(5)} zcr ${String(s.zcr).padStart(5)}/s  rms ${s.rms.toFixed(3)}`);
  }
}
