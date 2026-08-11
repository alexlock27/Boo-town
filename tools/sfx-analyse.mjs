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

// ---- what to listen to first -----------------------------------------------------------
// This deliberately does NOT render a verdict. The first version did — it compared each new
// clip against the control range and printed "sits inside the range every shipped animal
// occupies" — and it passed the cow while the cow was still 1000Hz of cattle shed, because
// a range spanning a bumblebee and a herring gull cannot discriminate anything. A tool that
// cannot hear should not be issuing pass/fail on whether a recording is an animal.
//
// So it ranks instead: which clips carry the least evidence of being a clean animal voice,
// so a ten-minute human listen starts where it matters most. Every clip below already passed
// a licence gate and a description check; a flag is a reason to LISTEN, never a defect.
//
// The bands are wide on purpose and are advisory. The f0 estimate makes octave errors in
// both directions — the shipped cat measures 71Hz when a meow lives nearer 300–800 — so a
// band miss means "check this one", not "this one is wrong". The cow's band is the one that
// earned its place: the first two cuts of the cattle shed measured 1000Hz, and that is what
// caught them.
const BAND = {
  cow: [60, 400], dog: [50, 600], lion: [40, 400],          // unambiguously low-voiced
  sheep: [100, 900], frog: [150, 900], bee: [100, 900], cat: [60, 1000],
  duck: [150, 1400], owl: [150, 1400], blackbird: [150, 1400], seagull: [150, 1400]
};

console.log('\n== what to listen to first ==');
console.log('   This cannot hear. It ranks which clips carry the LEAST evidence of a clean');
console.log('   animal voice, so a listen pass starts where it matters. A flag is a reason to');
console.log('   check, not a verdict — every clip here passed its licence and description gates.\n');

// NEAR MISSES ARE REPORTED TOO, and that is not decoration. Any threshold picked by someone
// who has already seen the numbers can quietly land just below the thing it should have
// caught — here the sustain line is 0.25 with the owl sitting at 0.27. Printing what came
// within 20% of a threshold is what stops the cut-off from doing the arguing.
const NEAR = 0.2;
const flagged = rows.map(r => {
  const flags = [], near = [];
  const band = BAND[r.id];
  if (band && (r.f0 < band[0] || r.f0 > band[1])) flags.push(`f0 ${r.f0}Hz outside ${band[0]}-${band[1]}Hz`);
  if (r.periodicity < 0.25) flags.push(`periodicity ${r.periodicity} — closer to noise than to a voice`);
  else if (r.periodicity < 0.25 * (1 + NEAR)) near.push(`periodicity ${r.periodicity}`);
  if (r.sustain < 0.25) flags.push(`sustain ${r.sustain} — mostly silence`);
  else if (r.sustain < 0.25 * (1 + NEAR)) near.push(`sustain ${r.sustain} — ${Math.round(r.sustain * 100)}% of the clip sounds`);
  if (r.centroid > 2600) flags.push(`centroid ${r.centroid}Hz — thin or hissy`);
  else if (r.centroid > 2600 * (1 - NEAR)) near.push(`centroid ${r.centroid}Hz`);
  return { ...r, flags, near };
}).sort((a, b) => (b.flags.length - a.flags.length) || (b.near.length - a.near.length));

for (const r of flagged) {
  const tag = r.isNew ? 'NEW ' : '    ';
  if (r.flags.length) console.log(`  ${tag}${r.id.padEnd(10)} ${r.flags.length} flag(s): ${r.flags.join(' · ')}`);
  else if (r.near.length) console.log(`  ${tag}${r.id.padEnd(10)} borderline: ${r.near.join(' · ')}`);
  else console.log(`  ${tag}${r.id.padEnd(10)} no flags — measures like a clean animal voice`);
}
console.log(`\n   ${flagged.filter(r => r.flags.length).length} of ${flagged.length} clips carry at least one flag, ` +
  `${flagged.filter(r => !r.flags.length && r.near.length).length} more sit just inside a threshold.`);
console.log('   Play them at tools/sfx-listen.html (needs a local server) and say which to swap.');
