// tools/sfx-analyse.mjs — LANE B: what IS each shipped clip, measured, with controls.
//
// Local tooling, NOT shipped. Nothing on this machine can hear the files, so the question
// "did the trim find the animal, or the loudest bang near the animal?" has to be answered
// with numbers. The first attempt (inside sfx-fetch.mjs) used an autocorrelation normalised
// by total energy, which decays monotonically with lag — so its "peak" was always whichever
// END of the search range it started from, and it reported four pitches that were really
// just the 60 Hz floor and the 900 Hz ceiling. That meter was wrong and this replaces it.
//
//   node tools/sfx-analyse.mjs
//
// What it measures, per clip:
//   f0 / periodicity  NCCF (normalised cross-correlation), peak-picked as a genuine LOCAL
//                     maximum, so an endpoint can never win. Periodicity near 1 means a
//                     pitched voice; near 0 means noise, wind, water or a clank.
//   centroid          spectral centre of mass (Hz). Low = a body-sized voice (moo, woof,
//                     roar); high = hiss, splash, chirp, rattle.
//   sustain           fraction of the clip actually sounding, vs one transient in silence.
//
// THE CONTROLS ARE THE POINT. Seven recordings already ship and are already believed to be
// the animal they claim (RUN21H). Measuring the four new ones ALONGSIDE those seven turns a
// bare number into a comparison: a "cow" whose numbers sit outside the range every known
// animal voice occupies is not a cow, whatever its file was called.

import { readFileSync } from 'node:fs';

const MANIFEST = JSON.parse(readFileSync('assets/sfx/manifest.json', 'utf8'));

// 16-bit PCM mono WAV -> Float32Array (this is the only format the pipeline writes)
function readWav(path) {
  const b = readFileSync(path);
  let pos = 12, rate = 16000, dataOff = 44, dataLen = b.length - 44;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') rate = b.readUInt32LE(pos + 12);
    if (id === 'data') { dataOff = pos + 8; dataLen = size; break; }
    pos += 8 + size + (size & 1);
  }
  const n = Math.floor(dataLen / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(dataOff + i * 2) / 32768;
  return { x: out, rate };
}

// NCCF with per-lag energy normalisation, peak-picked as a LOCAL maximum.
function pitch(x, rate, fMin = 55, fMax = 1200) {
  const minLag = Math.max(2, Math.floor(rate / fMax)), maxLag = Math.floor(rate / fMin);
  const N = Math.min(x.length, Math.floor(rate * 0.6));           // up to 600ms window
  const r = new Float64Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0, e1 = 0, e2 = 0;
    for (let i = 0; i + lag < N; i++) { num += x[i] * x[i + lag]; e1 += x[i] * x[i]; e2 += x[i + lag] * x[i + lag]; }
    r[lag] = (e1 > 0 && e2 > 0) ? num / Math.sqrt(e1 * e2) : 0;
  }
  let bestLag = 0, best = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1] && r[lag] > best) { best = r[lag]; bestLag = lag; }
  }
  return { f0: bestLag ? +(rate / bestLag).toFixed(0) : 0, periodicity: +Math.max(0, best).toFixed(3) };
}

// Spectral centroid, averaged over Hann-windowed frames (naive DFT, 512-point).
function centroid(x, rate) {
  const N = 512, hop = 256;
  let num = 0, den = 0;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  for (let s = 0; s + N <= x.length; s += hop) {
    for (let k = 1; k < N / 2; k++) {
      let re = 0, im = 0;
      for (let i = 0; i < N; i++) {
        const a = 2 * Math.PI * k * i / N, v = x[s + i] * win[i];
        re += v * Math.cos(a); im -= v * Math.sin(a);
      }
      const mag = Math.sqrt(re * re + im * im), f = k * rate / N;
      num += mag * f; den += mag;
    }
  }
  return den > 0 ? Math.round(num / den) : 0;
}

function sustain(x, rate) {
  const fr = Math.round(rate * 0.02), env = [];
  for (let i = 0; i + fr <= x.length; i += fr) {
    let e = 0; for (let j = i; j < i + fr; j++) e += x[j] * x[j];
    env.push(Math.sqrt(e / fr));
  }
  const pk = Math.max(...env, 1e-9);
  return +(env.filter(v => v > pk * 0.25).length / (env.length || 1)).toFixed(2);
}

// The four this lane added; everything else is a control that already ships.
const NEW = new Set(['cow', 'dog', 'duck', 'owl']);

const rows = [];
for (const s of MANIFEST.samples) {
  const { x, rate } = readWav(s.file);
  const p = pitch(x, rate);
  rows.push({ id: s.id, isNew: NEW.has(s.id), what: s.what, seconds: s.seconds,
    f0: p.f0, periodicity: p.periodicity, centroid: centroid(x, rate), sustain: sustain(x, rate) });
}

const line = (r) => `  ${(r.isNew ? '* ' : '  ')}${r.id.padEnd(10)} f0 ${String(r.f0).padStart(5)}Hz  periodicity ${String(r.periodicity).padEnd(6)} centroid ${String(r.centroid).padStart(5)}Hz  sustain ${String(r.sustain).padEnd(5)} ${r.what}`;

console.log('== controls: the recordings already shipping (RUN21H) ==');
rows.filter(r => !r.isNew).forEach(r => console.log(line(r)));
const ctl = rows.filter(r => !r.isNew);
const range = (k) => [Math.min(...ctl.map(r => r[k])), Math.max(...ctl.map(r => r[k]))];
const [pLo, pHi] = range('periodicity'), [cLo, cHi] = range('centroid');
console.log(`\n  control range: periodicity ${pLo}–${pHi} · centroid ${cLo}–${cHi}Hz`);

console.log('\n== the four this lane added ==');
rows.filter(r => r.isNew).forEach(r => console.log(line(r)));

console.log('\n== verdict, against the controls ==');
for (const r of rows.filter(r => r.isNew)) {
  const notes = [];
  if (r.periodicity < pLo) notes.push(`periodicity ${r.periodicity} is BELOW every control (${pLo}) — less like a voice than any shipped animal`);
  if (r.centroid > cHi) notes.push(`centroid ${r.centroid}Hz is ABOVE every control (${cHi}Hz) — thinner/hissier than any shipped animal`);
  console.log(`  ${r.id.padEnd(6)} ${notes.length ? 'QUESTIONED: ' + notes.join('; ') : 'sits inside the range every shipped animal occupies'}`);
}
