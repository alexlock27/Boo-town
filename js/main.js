// js/main.js — app boot + routing between screens (spec §11.1).
// Screens are ES modules exposing mount(container, params, ctx) -> api{ unmount? }.

import * as State from './state.js';
import { initAudio, music, setSoundEnabled, setMusicEnabled } from './sfx.js';
import * as tts from './tts.js';
import { starField } from './ui.js';

const screenEl = document.getElementById('screen');
let current = null;
let audioInited = false;

// Lazy screen registry (dynamic import → build incrementally, lighter first paint).
const registry = {
  onboarding: () => import('./onboarding.js'),
  hub:        () => import('./hub.js'),
  bubblepop:  () => import('./games/bubblepop.js'),
  feedboos:   () => import('./games/feedboos.js'),
  spellboo:   () => import('./games/spellboo.js'),
  blocks:     () => import('./games/blocks.js'),
  results:    () => import('./results.js'),
  ceremony:   () => import('./ceremony.js'),
  collection: () => import('./collection.js'),
  editguide:  () => import('./editguide.js'),
  town:       () => import('./town.js'),
  grownups:   () => import('./grownups.js')
};

const ctx = { go, music, refreshAudio: applyAudioSettings };

export async function go(name, params = {}) {
  if (current && current.api && typeof current.api.unmount === 'function') {
    try { current.api.unmount(); } catch (e) { console.warn(e); }
  }
  State.commit(); // flush any pending debounced save before leaving a screen
  screenEl.innerHTML = '';
  screenEl.scrollTop = 0;
  let mod;
  try {
    mod = await registry[name]();
  } catch (e) {
    console.error('[main] failed to load screen', name, e);
    screenEl.innerHTML = `<div class="card" style="margin:40px auto;max-width:400px">Something went wrong loading "${name}".</div>`;
    return;
  }
  const api = await mod.mount(screenEl, params, ctx);
  current = { name, api };
  screenEl.dataset.screen = name;
}
ctx.go = go;

export function applyAudioSettings() {
  const s = State.getState();
  if (!s) return;
  setSoundEnabled(s.settings.sound);
  setMusicEnabled(s.settings.music);
  tts.setEnabled(s.settings.voice);
}

function boot() {
  starField(document.getElementById('starfield'), 60);
  const save = State.load();
  applyAudioSettings();

  // Audio can only start after a user gesture (autoplay policy).
  const first = () => {
    if (audioInited) return;
    audioInited = true;
    initAudio();
    applyAudioSettings();
  };
  document.addEventListener('pointerdown', first, { once: false });

  if (!save || !save.name) go('onboarding');
  else go('hub');

  // Register the service worker only off-localhost (spec §11.6: avoids stale-cache
  // pain during dev). On GitHub Pages it registers and enables full offline use.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isLocal) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

// expose for debugging / tests
window.BooTown = { go, State };

boot();
