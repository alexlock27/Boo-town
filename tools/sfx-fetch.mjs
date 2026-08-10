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

// id, the Commons file, its verified licence, and how long a clip the game wants.
export const CHOSEN = [
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

const OK_LICENCE = /^(cc0|public domain|pd(-|$)|cc-zero)/i;

mkdirSync(OUT, { recursive: true });
const info = await meta(CHOSEN.map(c => c.title));

// Wikimedia rate-limits (429) anything that looks like an anonymous bot, and a headless
// Chromium's default UA is exactly that. The same descriptive User-Agent the API calls use
// gets the media through. Requests are also fetched from a Commons page rather than
// about:blank so the Origin is sane.
const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: UA });
const page = await ctx.newPage();
await page.goto('https://commons.wikimedia.org/wiki/Main_Page', { waitUntil: 'domcontentloaded' });

const manifest = { generated: process.env.RUN21H_STAMP || 'run21h', note: 'RUN21H B2 — every file CC0 or public domain, licence read from the Wikimedia Commons API. See tools/sfx-fetch.mjs for the two gates each file passed.', samples: [] };
let total = 0;

for (const c of CHOSEN) {
  if (done[c.id] && existsSync(join(OUT, `${c.id}.wav`))) {
    manifest.samples.push(done[c.id]); total += done[c.id].bytes;
    console.log(`  -- ${c.id.padEnd(10)} already fetched, kept`);
    continue;
  }
  const m = info[c.title];
  if (!m) { console.log(`!! ${c.id}: no metadata for ${c.title} — SKIPPED`); continue; }
  // Re-verify the licence at download time. The survey said CC0/PD; if that has changed,
  // or the recorded expectation disagrees with the API, the file does not ship. Full stop.
  if (!OK_LICENCE.test(m.licence)) { console.log(`!! ${c.id}: licence "${m.licence}" is not CC0/PD — SKIPPED`); continue; }
  if (m.licence.toLowerCase().replace(/\s+/g, '') !== c.licence.toLowerCase().replace(/\s+/g, '')) {
    console.log(`!! ${c.id}: licence drift, expected "${c.licence}" got "${m.licence}" — SKIPPED`); continue;
  }

  // upload.wikimedia.org rate-limits too; space the media fetches out and retry once.
  await sleep(2500);
  const res = await page.evaluate(async ([url, seconds, rate, peak]) => {
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
    // loudest window of `seconds` — this is the trim, and it drops leading silence
    const win = Math.min(len, Math.round(seconds * src.sampleRate));
    const step = Math.max(1, Math.round(src.sampleRate * 0.02));
    let best = 0, bestE = -1;
    for (let s = 0; s + win <= len; s += step) {
      let e = 0;
      for (let i = s; i < s + win; i += 8) e += mono[i] * mono[i];
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
    return { samples: Array.from(out), srcRate: src.sampleRate, srcSeconds: src.duration, rms: Math.sqrt(rms / outLen) };
  }, [m.url, c.seconds, RATE, PEAK]);

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
  console.log(`  ok ${c.id.padEnd(10)} ${String(Math.round(buf.length / 1024)).padStart(4)}KB  ${(res.samples.length / RATE).toFixed(2)}s  rms ${res.rms.toFixed(3)}  ${m.licence}`);
}

await browser.close();
manifest.total_bytes = total;
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${manifest.samples.length} samples, ${(total / 1024).toFixed(0)}KB total (budget 1536KB)`);
