// js/tts.js — speechSynthesis wrapper (spec §11.4).
// Prefer an en-GB voice, rate 0.95. Feature-detect and fail silent.
// The Peek flow in Spell Boo is the full fallback when no voice exists.

let voice = null;
let voicesLoaded = false;
let enabled = true;

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
    voices.find(v => /en-GB/i.test(v.lang)) ||
    voices.find(v => /^en[-_]/i.test(v.lang)) ||
    voices.find(v => /en/i.test(v.lang)) ||
    voices[0];
  return voice;
}

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
    if (voice) u.voice = voice;
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
