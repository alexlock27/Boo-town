// js/sfx.js — all audio synthesised with the Web Audio API. No audio files (spec §3).
// Sound effects + gentle music loops, separate mutes, ducking while the guide speaks.
// Everything is feature-detected and wrapped so a missing/blocked context never throws.

let ctx = null;
let master = null;     // master gain
let sfxGain = null;    // effects bus
let musicGain = null;  // music bus (ducked while guide speaks)
let soundOn = true;
let musicOn = true;
let started = false;

let currentLoop = null;  // 'calm' | 'game' | null
let schedTimer = null;
let nextNoteTime = 0;
let step = 0;

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
  if (musicOn && currentLoop) startScheduler();
}
export function getSoundEnabled() { return soundOn; }
export function getMusicEnabled() { return musicOn; }

// ---- one-shot effects ----
function envTone(freq, t0, dur, type = 'sine', peak = 0.5, bus = sfxGain) {
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
  correct() { play(t => { envTone(587, t, 0.12, 'triangle', 0.4); envTone(880, t + 0.09, 0.16, 'triangle', 0.4); }); },
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
  boxTap(step = 0) { play(t => { const f = 440 * Math.pow(2, step / 4); envTone(f, t, 0.16, 'triangle', 0.4); envTone(f * 1.5, t + 0.02, 0.14, 'sine', 0.2); }); }
};

// ---- background music (two gentle loops) ----
const SCALE = { // pentatonic-ish, dreamy
  calm: [0, 3, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3],
  game: [0, 4, 7, 12, 7, 9, 7, 4, 0, 4, 7, 9]
};
const ROOT = 261.63; // C4
const STEP_DUR = { calm: 0.42, game: 0.3 };

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
    if (!musicGain || !ctx) return;
    try { musicGain.gain.setTargetAtTime(on ? 0.05 : (musicOn ? 0.18 : 0), ctx.currentTime, 0.08); } catch {}
  }
};

// Pause loops when the tab is hidden (spec §11.3).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopScheduler();
    else if (currentLoop && musicOn) startScheduler();
  });
}
