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
// List the device's installed English voices, local voices first. Empty when the API
// or voices are absent (the Settings section then hides gracefully).
export function listVoices() {
  if (!available()) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  const en = voices.filter(v => /^en[-_]/i.test(v.lang) || /english/i.test(v.name || ''));
  return en
    .map(v => ({ name: v.name, lang: v.lang, local: !!v.localService }))
    .sort((a, b) => (b.local ? 1 : 0) - (a.local ? 1 : 0));   // prefer local voices in the listing
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

// Speak text. onstart/onend used for music ducking. Returns true if it will speak.
export function speak(text, { onstart, onend } = {}) {
  if (!enabled || !available() || !text) { onend && onend(); return false; }
  try {
    if (!voicesLoaded || !voice) pickVoice();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    try { if (voice && voice instanceof SpeechSynthesisVoice) u.voice = voice; } catch {}   // a non-native voice object must never abort speech
    u.lang = (voice && voice.lang) || 'en-GB';
    u.rate = 0.95;
    u.pitch = 1.05;
    if (onstart) u.onstart = onstart;
    u.onend = () => onend && onend();
    u.onerror = () => onend && onend();
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) {
    console.warn('[tts] speak failed', e);
    onend && onend();
    return false;
  }
}

export function cancel() {
  if (!available()) return;
  try { window.speechSynthesis.cancel(); } catch {}
}
