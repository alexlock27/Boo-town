// js/guide.js — the giraffe guide: rendering, speech bubbles, line picking, TTS.

import { getState } from './state.js';
import { LINES } from '../data/guideLines.js';
import { renderGuide } from './art.js';
import * as tts from './tts.js';
import { music } from './sfx.js';
import { el } from './ui.js';

function subst(str) {
  const s = getState();
  const name = (s && s.name) || 'friend';
  const guide = (s && s.guide && s.guide.name) || 'Twiggy';
  return str.replace(/\{name\}/g, name).replace(/\{guide\}/g, guide);
}

// Pick a random line from a key, with substitutions.
export function guideLine(key) {
  const arr = LINES[key];
  if (!arr || !arr.length) return '';
  return subst(arr[(Math.random() * arr.length) | 0]);
}

// Deterministic pick (e.g. first-hello sequence) by index.
export function guideLineAt(key, i) {
  const arr = LINES[key];
  if (!arr || !arr.length) return '';
  return subst(arr[i % arr.length]);
}

// Render the guide SVG into a container.
export function mountGuide(container, opts = {}) {
  const s = getState();
  const guide = (s && s.guide) || { body: 'sunshine', patch: 'cocoa', acc: 'none', name: 'Twiggy' };
  container.innerHTML = renderGuide(guide, opts);
  return container.firstChild;
}

// A reusable guide+bubble block. Returns { root, bubble, sayKey, sayText }.
export function createGuideBubble({ view = 'head', size = 120, side = 'left' } = {}) {
  const s = getState();
  const guide = (s && s.guide) || { body: 'sunshine', patch: 'cocoa', acc: 'none', name: 'Twiggy' };
  const art = el('div', { class: 'guide-art', html: renderGuide(guide, { view, size }) });
  const bubble = el('div', { class: 'speech-bubble', html: '' });
  const root = el('div', { class: 'guide-block ' + side }, side === 'left' ? [art, bubble] : [bubble, art]);

  function show(text, { voice = true } = {}) {
    bubble.innerHTML = '';
    bubble.appendChild(el('span', { text }));
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    bubble.style.visibility = 'visible';
    speakMaybe(text, voice);
  }
  return {
    root, bubble, art,
    say(key, opts) { const t = guideLine(key); show(t, opts); return t; },
    sayText(text, opts) { show(text, opts); return text; },
    hide() { bubble.style.visibility = 'hidden'; }
  };
}

// Speak a line if voice is on; duck the music while speaking.
export function speakMaybe(text, voice = true) {
  const s = getState();
  const voiceOn = voice && s && s.settings && s.settings.voice;
  if (!voiceOn) return;
  music.duck(true);
  const ok = tts.speak(text, {
    onstart: () => music.duck(true),
    onend: () => music.duck(false)
  });
  if (!ok) music.duck(false);
}
