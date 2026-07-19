// js/sfx.js — all audio synthesised with the Web Audio API. No audio files (spec §3).
// Sound effects + gentle music loops, separate mutes, ducking while the guide speaks.
// Everything is feature-detected and wrapped so a missing/blocked context never throws.

import { haptic } from './haptics.js';   // a gentle tick on correct answers (RUN9 C7)

let ctx = null;
let master = null;     // master gain
let sfxGain = null;    // effects bus
let musicGain = null;  // music bus (ducked while guide speaks)
let ambientGain = null;// ambient bed bus (day chirps / night crickets, under the music) (RUN6 C1)
let soundOn = true;
let musicOn = true;
let started = false;

let currentLoop = null;  // 'calm' | 'game' | null
let schedTimer = null;
let nextNoteTime = 0;
let step = 0;

let ambientLoop = null;  // 'day' | 'night' | null
let ambientTimer = null;
let ambientNext = 0;

// ---- instrumentation (test-only): prove note scheduling, ducking, mute obedience ----
let audioLog = null;     // null = off; array = capturing
export function setAudioLog(on) { audioLog = on ? [] : null; return audioLog; }
export function getAudioLog() { return audioLog || []; }
function logEvent(ev) { if (audioLog) audioLog.push(ev); }

// Create the context lazily on the first user gesture (autoplay policy).
export function initAudio() {
  if (ctx) { resume(); return true; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();  master.gain.value = 0.9;  master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = musicOn ? 0.18 : 0; musicGain.connect(master);
    ambientGain = ctx.createGain(); ambientGain.gain.value = musicOn ? 0.10 : 0; ambientGain.connect(master);
    started = true;
    resume();
    return true;
  } catch (e) {
    console.warn('[sfx] audio unavailable', e);
    ctx = null;
    return false;
  }
}

function resume() { try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch {} }
export function isReady() { return !!ctx; }

// ---- settings ----
export function setSoundEnabled(on) {
  soundOn = !!on;
}
export function setMusicEnabled(on) {
  musicOn = !!on;
  if (musicGain && ctx) {
    try { musicGain.gain.setTargetAtTime(musicOn ? 0.18 : 0, ctx.currentTime, 0.05); } catch {}
  }
  if (ambientGain && ctx) {
    try { ambientGain.gain.setTargetAtTime(musicOn ? 0.10 : 0, ctx.currentTime, 0.05); } catch {}
  }
  logEvent({ kind: 'mute', target: 'music', on: musicOn });
  if (musicOn && currentLoop) startScheduler(); else if (!musicOn) stopScheduler();   // muting stops scheduling (silent + no waste)
  if (musicOn && ambientLoop) startAmbient(); else if (!musicOn) stopAmbient();
}
export function getSoundEnabled() { return soundOn; }
export function getMusicEnabled() { return musicOn; }

// ---- one-shot effects ----
function envTone(freq, t0, dur, type = 'sine', peak = 0.5, bus = sfxGain, tag = null) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(bus);
  o.start(t0); o.stop(t0 + dur + 0.02);
  if (audioLog) logEvent({ kind: 'note', t: t0, freq: Math.round(freq), dur, bus: bus === musicGain ? 'music' : bus === ambientGain ? 'ambient' : 'sfx', tag });
}

function play(fn) {
  if (!soundOn) return;
  if (!ctx) { if (!initAudio()) return; }
  resume();
  try { fn(ctx.currentTime); } catch (e) { console.warn('[sfx] play error', e); }
}

export const sfx = {
  tap()   { play(t => envTone(520, t, 0.08, 'triangle', 0.28)); },
  pop()   { play(t => { envTone(660, t, 0.09, 'sine', 0.4); envTone(990, t + 0.02, 0.12, 'sine', 0.25); }); },
  correct() { play(t => { envTone(587, t, 0.12, 'triangle', 0.4); envTone(880, t + 0.09, 0.16, 'triangle', 0.4); }); try { haptic('tick'); } catch {} },   // gentle tick (RUN9 C7)
  oops()  { play(t => {
      // soft descending friendly wobble (never harsh)
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(300, t + 0.28);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.32);
    }); },
  star()  { play(t => { [784, 1047, 1319].forEach((f, i) => envTone(f, t + i * 0.09, 0.18, 'triangle', 0.34)); }); },
  fanfare() { play(t => {
      [523, 659, 784, 1047].forEach((f, i) => envTone(f, t + i * 0.11, 0.3, 'triangle', 0.4));
      envTone(1568, t + 0.44, 0.5, 'sine', 0.3);
    }); },
  // rising note per box tap (step 0,1,2)
  boxTap(step = 0) { play(t => { const f = 440 * Math.pow(2, step / 4); envTone(f, t, 0.16, 'triangle', 0.4); envTone(f * 1.5, t + 0.02, 0.14, 'sine', 0.2); }); },
  // Spell Boo (RUN6 C5): a soft ascending chime as each letter lands, and a brighter
  // per-letter ping during the bounce-spell.
  chime(step = 0) { play(t => envTone(523.25 * Math.pow(2, (step % 8) / 12), t, 0.22, 'sine', 0.22, sfxGain, 'chime')); },
  ping(step = 0) { play(t => { const f = 659.25 * Math.pow(2, (step % 10) / 12); envTone(f, t, 0.3, 'triangle', 0.26, sfxGain, 'ping'); envTone(f * 2, t, 0.18, 'sine', 0.1, sfxGain, 'ping'); }); },
  // Pond fishing (RUN10 P3): a happy little triplet on a catch...
  giggle() { play(t => { [700, 880, 660, 940].forEach((f, i) => envTone(f, t + i * 0.07, 0.09, 'triangle', 0.3, sfxGain, 'giggle')); }); },
  whirr() { play(t => { [180, 240, 210].forEach((f, i) => envTone(f, t + i * .045, .08, 'sawtooth', .07, sfxGain, 'wheel-whirr')); }); },
  // ...and a trombone-ish descending wobble for the comedy boot.
  trombone() { play(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.26, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.68);
      if (audioLog) logEvent({ kind: 'note', t, freq: 220, dur: 0.65, bus: 'sfx', tag: 'trombone' });
    }); }
};

// ---- background music (two gentle loops) ----
const SCALE = { // pentatonic-ish, dreamy
  calm: [0, 3, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3],
  game: [0, 4, 7, 12, 7, 9, 7, 4, 0, 4, 7, 9],
  // a jaunty distant fairground waltz (RUN6 C1b) — bright major arpeggios
  fair: [0, 4, 7, 12, 7, 4, 9, 5, 0, 7, 12, 16]
};
const ROOT = 261.63; // C4
const STEP_DUR = { calm: 0.42, game: 0.3, fair: 0.34 };

function midiToFreq(semi) { return ROOT * Math.pow(2, semi / 12); }

function startScheduler() {
  if (!ctx || !musicOn || !currentLoop) return;
  if (schedTimer) return;
  nextNoteTime = ctx.currentTime + 0.1;
  schedTimer = setInterval(scheduleAhead, 60);
}
function stopScheduler() {
  if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
}

function scheduleAhead() {
  if (!ctx || !currentLoop) return;
  const dur = STEP_DUR[currentLoop];
  const seq = SCALE[currentLoop];
  while (nextNoteTime < ctx.currentTime + 0.2) {
    const semi = seq[step % seq.length];
    // sparkle note
    envTone(midiToFreq(semi + 12), nextNoteTime, dur * 0.9, 'triangle', 0.18, musicGain);
    // soft pad chord on the downbeat
    if (step % 4 === 0) {
      envTone(midiToFreq(semi), nextNoteTime, dur * 3.6, 'sine', 0.12, musicGain);
      envTone(midiToFreq(semi + 7), nextNoteTime, dur * 3.6, 'sine', 0.09, musicGain);
    }
    step++;
    nextNoteTime += dur;
  }
}

export const music = {
  play(which) {
    if (!ctx) { if (!initAudio()) return; }
    resume();
    if (currentLoop === which) return;
    currentLoop = which;
    step = 0;
    if (musicOn) startScheduler();
  },
  stop() { currentLoop = null; stopScheduler(); },
  // duck volume while the guide speaks, then restore
  duck(on) {
    logEvent({ kind: 'duck', on: !!on });
    if (!musicGain || !ctx) return;
    try { musicGain.gain.setTargetAtTime(on ? 0.05 : (musicOn ? 0.18 : 0), ctx.currentTime, 0.08); } catch {}
    if (ambientGain) { try { ambientGain.gain.setTargetAtTime(on ? 0.03 : (musicOn ? 0.10 : 0), ctx.currentTime, 0.08); } catch {} }
  }
};

// ---- ambient sound bed (RUN6 C1): sparse birdsong by day, crickets by night, ----
// under the music, obeying the music mute. Instrumented for headless audio evidence.
export const ambient = {
  play(kind) {  // 'day' | 'night' | null
    if (!ctx) { if (!initAudio()) return; }
    resume();
    if (ambientLoop === kind) return;
    ambientLoop = kind;
    if (kind && musicOn) startAmbient(); else stopAmbient();
  },
  stop() { ambientLoop = null; stopAmbient(); }
};
function startAmbient() {
  if (!ctx || !ambientLoop || !musicOn) return;
  if (ambientTimer) return;
  ambientNext = ctx.currentTime + 0.2;
  ambientTimer = setInterval(scheduleAmbient, 120);
}
function stopAmbient() { if (ambientTimer) { clearInterval(ambientTimer); ambientTimer = null; } }
function scheduleAmbient() {
  if (!ctx || !ambientLoop || !musicOn) return;
  while (ambientNext < ctx.currentTime + 0.4) {
    if (ambientLoop === 'day') {
      // sparse, gentle birdsong: a couple of quick high triangle chirps
      const base = 1800 + Math.random() * 900;
      envTone(base, ambientNext, 0.06, 'triangle', 0.05, ambientGain, 'ambient-chirp');
      if (Math.random() < 0.5) envTone(base * 1.12, ambientNext + 0.08, 0.05, 'triangle', 0.04, ambientGain, 'ambient-chirp');
      ambientNext += 0.7 + Math.random() * 1.4;
    } else {
      // night crickets: soft rhythmic high pulses
      envTone(2600, ambientNext, 0.03, 'square', 0.02, ambientGain, 'ambient-cricket');
      envTone(2600, ambientNext + 0.06, 0.03, 'square', 0.02, ambientGain, 'ambient-cricket');
      ambientNext += 0.5 + Math.random() * 0.6;
    }
  }
}

// ---- Boo Band voices (RUN6 C1c): synthesised drums / piano / guitar, no files, ----
// no microphone. They ride the effects bus (obey the sound mute) and log for evidence.
function noiseHit(t0, dur, type, peak, freq, q) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * (dur + 0.02));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t0); src.stop(t0 + dur + 0.02);
}
function pitchDrum(t, f0, f1, dur, peak) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
}
const DRUMS = {
  kick:   t => pitchDrum(t, 140, 48, 0.18, 0.7),
  snare:  t => { noiseHit(t, 0.16, 'highpass', 0.32, 1400); pitchDrum(t, 220, 180, 0.12, 0.2); },
  hihat:  t => noiseHit(t, 0.05, 'highpass', 0.18, 7000),
  cymbal: t => noiseHit(t, 0.5, 'highpass', 0.16, 6000),
  tom1:   t => pitchDrum(t, 200, 120, 0.24, 0.4),
  tom2:   t => pitchDrum(t, 150, 90, 0.26, 0.4)
};
export const DRUM_PADS = ['kick', 'snare', 'hihat', 'cymbal', 'tom1', 'tom2'];
export const KEY_SEMIS = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];   // ten white keys C4→E5
const CHORD = { C: [0, 4, 7, 12], G: [7, 11, 14, 19], Am: [9, 12, 16, 21], F: [5, 9, 12, 17] };
export const GUITAR_CHORDS = ['C', 'G', 'Am', 'F'];
// Xylophone (RUN9 C6): eight rainbow bars, a C-major scale, a bright bell-like tone.
export const XYLO_SEMIS = [0, 2, 4, 5, 7, 9, 11, 12];   // C D E F G A B C'
export const band = {
  drum(pad) { play(t => { (DRUMS[pad] || DRUMS.kick)(t); logEvent({ kind: 'note', t, freq: 0, dur: 0.2, bus: 'sfx', tag: 'drum:' + pad }); }); },
  key(semi) { play(t => { const f = 261.63 * Math.pow(2, semi / 12); envTone(f, t, 0.9, 'triangle', 0.30, sfxGain, 'key'); envTone(f * 2, t, 0.5, 'sine', 0.09, sfxGain, 'key'); }); },
  guitar(chord) { play(t => { (CHORD[chord] || CHORD.C).forEach((s, i) => envTone(196 * Math.pow(2, s / 12), t + i * 0.06, 0.7, 'sawtooth', 0.13, sfxGain, 'guitar:' + chord)); }); },
  // bright bell-like mallet tone: a high sine fundamental + an octave shimmer, quick decay
  xylo(idx) { play(t => { const semi = XYLO_SEMIS[idx % XYLO_SEMIS.length]; const f = 523.25 * Math.pow(2, semi / 12); envTone(f, t, 0.55, 'sine', 0.30, sfxGain, 'xylo'); envTone(f * 2, t + 0.005, 0.30, 'sine', 0.10, sfxGain, 'xylo'); envTone(f * 3, t + 0.005, 0.15, 'triangle', 0.05, sfxGain, 'xylo'); }); }
};

// ---- Boo Beat voices (RUN6 C3): the melody her correct hits perform, plus a soft ----
// backing (drums+bass on the music bus, so it ducks during TTS) and a miss thud.
export const beatvoice = {
  backingDrum(pad) { play(t => { (DRUMS[pad] || DRUMS.kick)(t); logEvent({ kind: 'note', t, freq: 0, dur: 0.2, bus: 'music', tag: 'beat-drum:' + pad }); }); },
  bass(freq) { play(t => envTone(freq, t, 0.3, 'sawtooth', 0.12, musicGain, 'beat-bass')); },
  melody(semi, { sparkle = false, shimmer = false } = {}) {
    play(t => {
      const f = 392 * Math.pow(2, semi / 12);   // a bright lead around G4
      envTone(f, t, 0.5, 'triangle', 0.30, sfxGain, 'melody');
      if (sparkle) envTone(f * 2, t + 0.01, 0.4, 'sine', 0.16, sfxGain, 'sparkle');    // Perfect harmonic
      if (shimmer) envTone(f * 1.5, t + 0.05, 0.5, 'triangle', 0.09, sfxGain, 'shimmer'); // combo-fever layer
    });
  },
  thud() { play(t => { pitchDrum(t, 110, 60, 0.16, 0.4); logEvent({ kind: 'note', t, freq: 0, dur: 0.16, bus: 'sfx', tag: 'thud' }); }); },
  // off-beat chord stab (RUN9 C6 addendum backing): a short soft triad on the music bus
  stab(chord) { play(t => { (CHORD[chord] || CHORD.C).slice(0, 3).forEach(s => envTone(261.63 * Math.pow(2, s / 12), t, 0.16, 'triangle', 0.07, musicGain, 'beat-stab:' + chord)); }); }
};

// ---- Toddler Animal Sounds voices (RUN7 C4): a synthesised, clearly-distinct ----
// cartoon call per animal. No files; on the effects bus; obeys the sound mute; each
// logs a single note tagged `animal:<key>` so headless tests can prove distinctness.
function glideTone(t0, f0, f1, dur, type, peak) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur * 0.9);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(sfxGain); o.start(t0); o.stop(t0 + dur + 0.03);
}
export const ANIMAL_KEYS = ['cow', 'cat', 'dog', 'duck', 'sheep', 'owl', 'bee', 'snake', 'frog', 'lion'];
export const ANIMAL_WORDS = { cow: 'Moo', cat: 'Meow', dog: 'Woof', duck: 'Quack', sheep: 'Baa', owl: 'Twit twoo', bee: 'Buzz', snake: 'Sssss', frog: 'Ribbit', lion: 'ROAR' };
export const animal = {
  call(key) {
    play(t => {
      switch (key) {
        case 'cow':   glideTone(t, 300, 150, 0.62, 'sine', 0.42); break;
        case 'cat':   glideTone(t, 520, 940, 0.18, 'triangle', 0.32); glideTone(t + 0.18, 940, 470, 0.30, 'triangle', 0.30); break;
        case 'dog':   pitchDrum(t, 260, 130, 0.14, 0.5); pitchDrum(t + 0.22, 240, 118, 0.16, 0.5); break;
        case 'duck':  glideTone(t, 540, 360, 0.13, 'sawtooth', 0.24); glideTone(t + 0.17, 520, 360, 0.13, 'sawtooth', 0.24); break;
        case 'sheep': glideTone(t, 470, 430, 0.16, 'sawtooth', 0.26); glideTone(t + 0.16, 430, 470, 0.34, 'sawtooth', 0.24); break;
        case 'owl':   glideTone(t, 720, 700, 0.16, 'sine', 0.30); glideTone(t + 0.30, 500, 780, 0.42, 'sine', 0.30); break;
        case 'bee':   glideTone(t, 150, 138, 0.60, 'sawtooth', 0.30); break;
        case 'snake': noiseHit(t, 0.60, 'highpass', 0.20, 5200); break;
        case 'frog':  pitchDrum(t, 190, 120, 0.12, 0.42); pitchDrum(t + 0.17, 150, 96, 0.15, 0.42); break;
        case 'lion':  noiseHit(t, 0.52, 'lowpass', 0.28, 520, 2); glideTone(t, 165, 88, 0.70, 'sawtooth', 0.36); break;
        default:      glideTone(t, 400, 300, 0.4, 'sine', 0.30);
      }
      logEvent({ kind: 'note', t, freq: 0, dur: 0.5, bus: 'sfx', tag: 'animal:' + key });
    });
  }
};

// Pause loops when the tab is hidden (spec §11.3).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopScheduler(); stopAmbient(); }
    else { if (currentLoop && musicOn) startScheduler(); if (ambientLoop && musicOn) startAmbient(); }
  });
}
