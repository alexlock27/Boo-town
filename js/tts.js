// js/tts.js — speechSynthesis wrapper (spec §11.4).
// Prefer an en-GB voice, rate 0.95. Feature-detect and fail silent.
// The Peek flow in Spell Boo is the full fallback when no voice exists.

let voice = null;
let voicesLoaded = false;
let enabled = true;
let preferredName = null;   // her chosen voice (RUN9 C6b), persisted in the save

export function available() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function setEnabled(on) { enabled = !!on; if (!enabled) cancel(); }
export function isEnabled() { return enabled; }

function pickVoice() {
  if (!available()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  voicesLoaded = true;
  voice =
    (preferredName && voices.find(v => v.name === preferredName)) ||   // her chosen voice wins
    voices.find(v => /en-GB/i.test(v.lang)) ||
    voices.find(v => /^en[-_]/i.test(v.lang)) ||
    voices.find(v => /en/i.test(v.lang)) ||
    voices[0];
  return voice;
}

// ---- voice picker support (RUN9 C6b) ----
// RUN10 P11: the grown-up picker is deliberately UK-only, with local voices first.
export function listVoices() {
  if (!available()) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  const en = voices.filter(v => /^en[-_]GB$/i.test(v.lang || ''));
  return en
    .map(v => ({ name: v.name, lang: v.lang, local: !!v.localService }))
    .sort((a, b) => Number(b.local) - Number(a.local) || a.name.localeCompare(b.name));
}
export function setVoiceByName(name) {
  preferredName = name || null;
  if (!available()) return false;
  const voices = window.speechSynthesis.getVoices() || [];
  const v = name && voices.find(x => x.name === name);
  if (v) { voice = v; voicesLoaded = true; return true; }
  pickVoice();
  return false;
}
export function getVoiceName() { return voice ? voice.name : (preferredName || null); }

if (available()) {
  pickVoice();
  try { window.speechSynthesis.onvoiceschanged = pickVoice; } catch {}
}

// ---- THE SPEECH QUEUE (RUN18B Y1) -----------------------------------------------------
//
// Every speak() used to begin with speechSynthesis.cancel(). Two lines issued close
// together therefore produced ONE line: the second killed the first mid-word. That is the
// whole bug — a guide who is interrupted by herself, constantly, on every screen that says
// two things in a row.
//
// So: a FIFO queue. An utterance plays to its END; queued lines follow in order. Each
// utterance carries the screen that asked for it, so leaving a screen takes that screen's
// speech with it and nothing leaks across a navigation. Exactly one caller is allowed to
// pre-empt — the Interrupting Boo, whose entire joke is the interruption.
export const QUEUE_MAX = 4;            // oldest NON-PLAYING utterance is dropped beyond this
export const UNMOUNT_SILENCE_MS = 150; // a screen's speech must be gone this fast

let queue = [];        // [{ id, text, ownerScreen, onstart, onend }]
let playing = null;    // the entry currently speaking (also queue[0] while it plays)
let nextId = 1;

// Test seam: the suite stubs window.speechSynthesis, so everything below goes through
// this rather than caching a reference at module load.
const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : null);

function finish(entry, why) {
  if (!entry || entry.done) return;
  entry.done = true;
  queue = queue.filter(e => e !== entry);
  if (playing === entry) playing = null;
  try { entry.onend && entry.onend(why); } catch (e) { console.warn('[tts] onend threw', e); }
  pump();
}

function pump() {
  if (playing || !queue.length) return;
  if (!enabled || !available()) { const e = queue[0]; finish(e, 'disabled'); return; }
  const entry = queue[0];
  playing = entry;
  try {
    if (!voicesLoaded || !voice) pickVoice();
    const u = new SpeechSynthesisUtterance(String(entry.text));
    try { if (voice && voice instanceof SpeechSynthesisVoice) u.voice = voice; } catch {}   // a non-native voice object must never abort speech
    u.lang = (voice && voice.lang) || 'en-GB';
    u.rate = 0.95;
    u.pitch = 1.05;
    entry.utterance = u;
    u.onstart = () => { try { entry.onstart && entry.onstart(); } catch {} };
    u.onend = () => finish(entry, 'end');
    u.onerror = () => finish(entry, 'error');
    synth().speak(u);
  } catch (e) {
    console.warn('[tts] speak failed', e);
    finish(entry, 'error');
  }
}

// Speak text. onstart/onend are still used for music ducking, and still fire exactly once
// each per utterance. RETURNS AN ID (was: a boolean) — callers that only checked
// truthiness keep working, because an id is always truthy and 0 is never issued.
export function speak(text, { onstart, onend, ownerScreen = null, interrupt = false } = {}) {
  if (!enabled || !available() || !text) { onend && onend('skipped'); return 0; }
  const entry = { id: nextId++, text: String(text), ownerScreen, onstart, onend, done: false };

  // The ONE pre-emption: the Interrupting Boo. `interrupt` may be `true` (cut whatever is
  // speaking) or the ID OF THE UTTERANCE TO CUT.
  //
  // The id form exists because the screen and the voice do not share a clock. The joke
  // advances on a 520ms timer; a punchline takes 2.4-2.9s to say, so by the time the
  // interruption fires, the line it means to cut is routinely still QUEUED rather than
  // playing. Cancelling "whatever is playing" then cut the wrong line and let the
  // interrupted one speak in full AFTER the punchline — the joke told backwards. Naming
  // the target makes the pre-emption true whichever side the drift falls on.
  if (interrupt) {
    const targetId = typeof interrupt === 'number' ? interrupt : null;
    const target = targetId ? queue.find(e => e.id === targetId) : playing;
    const was = playing;
    queue.unshift(entry);
    // the line being interrupted never speaks — whether it had started or was still waiting
    if (target && target !== entry) {
      if (target === was && available()) { try { synth().cancel(); } catch {} }
      finish(target, 'interrupted');
    }
    // and if something else was mid-word, the punchline still lands on top of it
    if (was && was !== target && !was.done) { if (available()) { try { synth().cancel(); } catch {} } finish(was, 'interrupted'); }
    if (!playing) pump();
    return entry.id;
  }

  queue.push(entry);
  // Beyond QUEUE_MAX, drop the OLDEST NON-PLAYING line: a child who has run ahead cares
  // about what is being said now and what comes next, not about a backlog from ten taps
  // ago. The playing utterance is never dropped mid-word.
  while (queue.length > QUEUE_MAX) {
    const victim = queue.find(e => e !== playing);
    if (!victim) break;
    finish(victim, 'dropped');
  }
  pump();
  return entry.id;
}

// Cancel everything, from anyone. Existing callers (screen unmounts, round ends) keep
// their old meaning.
export function cancel() {
  const all = queue.slice();
  queue = [];
  const was = playing;
  playing = null;
  if (available()) { try { synth().cancel(); } catch {} }
  for (const e of all) { if (e !== was) { e.done = true; try { e.onend && e.onend('cancelled'); } catch {} } }
  if (was) { was.done = true; try { was.onend && was.onend('cancelled'); } catch {} }
}

// Cancel only what a given screen asked for — its playing utterance AND its queued ones —
// leaving anything another screen owns alone. This is what makes navigation silent without
// every screen having to remember to hush itself.
export function cancelOwner(screen) {
  if (!screen) return 0;
  const mine = queue.filter(e => e.ownerScreen === screen);
  if (!mine.length) return 0;
  const wasPlayingMine = playing && playing.ownerScreen === screen;
  // Remove them ALL before firing a single callback. finish() pumps, and pumping in the
  // middle of a cancel hands the NEXT of this screen's queued lines to the engine — the
  // exact thing being cancelled. (Caught by r18b-speech: three lines were cancelled and
  // all three had still been spoken.)
  queue = queue.filter(e => e.ownerScreen !== screen);
  if (wasPlayingMine) {
    playing = null;
    if (available()) { try { synth().cancel(); } catch {} }
  }
  for (const e of mine) {
    if (e.done) continue;
    e.done = true;
    try { e.onend && e.onend('cancelled'); } catch (err) { console.warn('[tts] onend threw', err); }
  }
  pump();
  return mine.length;
}

// ---- who is asking ---------------------------------------------------------------------
// The router sets this to the screen it is about to mount, BEFORE mount() runs. Reading
// the DOM's own screen marker instead would be a beat too late: it is only written after
// mount() returns, so anything a screen says while it is building was tagged with the
// screen she just LEFT — and then cancelled the moment it was spoken.
let ownerScreen = null;
export function setOwnerScreen(name) { ownerScreen = name || null; }
export function currentOwnerScreen() { return ownerScreen; }

// QA/diagnostics only — the suite reads this to prove the queue's shape.
export function queueState() {
  return { length: queue.length, playing: playing ? playing.id : null, ids: queue.map(e => e.id), owners: queue.map(e => e.ownerScreen) };
}
