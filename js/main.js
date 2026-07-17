// js/main.js — app boot + routing between screens (spec §11.1).
// Screens are ES modules exposing mount(container, params, ctx) -> api{ unmount? }.

import * as State from './state.js';
import { initAudio, music, setSoundEnabled, setMusicEnabled } from './sfx.js';
import * as tts from './tts.js';
import { starField, clearConfetti, setBackAction, getBackAction } from './ui.js';
import { installOopsNet, installSaveGuard, maybeRollingBackup, setWaitingWorker } from './resilience.js';
import { setHapticsEnabled } from './haptics.js';

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
  bounce:     () => import('./games/bounce.js'),
  beat:       () => import('./games/beat.js'),
  teachme:    () => import('./games/teachme.js'),
  dash:       () => import('./games/dash.js'),
  clockshop:  () => import('./games/clockshop.js'),
  boopop:     () => import('./games/boopop.js'),
  detective:  () => import('./games/detective.js'),   // Word Detective (RUN9 C3)
  booroll:    () => import('./games/booroll.js'),      // Boo Roll (RUN9 C4)
  echoboos:   () => import('./games/echoboos.js'),     // Echo Boos (RUN9 C5)
  golden:     () => import('./golden.js'),
  toddlergame: () => import('./toddler.js'),   // Toddler mode's four games (RUN5 C7)
  studio:     () => import('./studio.js'),
  paint:      () => import('./paint.js'),
  collage:    () => import('./collage.js'),
  buildaboo:  () => import('./buildaboo.js'),
  gallery:    () => import('./gallery.js'),
  results:    () => import('./results.js'),
  ceremony:   () => import('./ceremony.js'),
  collection: () => import('./collection.js'),
  editguide:  () => import('./editguide.js'),
  town:       () => import('./town.js'),
  worldmap:   () => import('./worldmap.js'),   // Town 4.0: the world map (RUN10 P1)
  gallerymuseum: () => import('./gallerymuseum.js'),   // the museum Gallery (RUN10 P4; distinct from studio gallery.js)
  band:       () => import('./band.js'),   // the Boo Band (RUN6 C1c)
  bandroom:   () => import('./band/bandroom.js'), // RUN10 P6 scene chooser
  banddrums:  () => import('./band/drums.js'),
  bandkeys:   () => import('./band/keys.js'),
  bandguitar: () => import('./band/guitar.js'),
  bandxylo:   () => import('./band/xylophone.js'),
  bandsongs:  () => import('./band/songs.js'),
  bandjams:   () => import('./band/jams.js'),
  booquest:   () => import('./booquest.js'),   // Boo Quest (RUN6 C6)
  expedition: () => import('./expedition/trail.js'),
  expeditionpuzzle: () => import('./expedition/puzzle.js'),
  grownups:   () => import('./grownups.js')
};

const ctx = { go, music, refreshAudio: applyAudioSettings };

export async function go(name, params = {}) {
  if (current && current.api && typeof current.api.unmount === 'function') {
    try { current.api.unmount(); } catch (e) { console.warn(e); }
  }
  State.commit(); // flush any pending debounced save before leaving a screen
  clearConfetti(); // don't let celebration particles linger across a navigation
  // A first-play intro is tied to its game; never let it bleed onto the next screen.
  document.querySelectorAll('.intro-overlay').forEach(o => o.remove());
  setBackAction(null); // each screen's back control re-registers its own handler (RUN4 C1)
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
  try { setHapticsEnabled(s.settings.haptics !== false); } catch {}   // RUN9 C7
  try { if (s.settings.voiceName) tts.setVoiceByName(s.settings.voiceName); } catch {}   // RUN9 C6b
}

// Android hardware/gesture back (RUN4 C1): keep one sentinel entry behind the app
// so back always pops to it, and the popstate handler immediately re-pushes the
// guard and runs the current screen's back action instead. Back therefore
// navigates in-app one level (same handler as the on-screen control), does
// nothing at the hub (no action registered), and never leaves the page. The
// entries live in session history, so the behaviour survives reloads and the
// installed-app context. While a modal overlay is open, back is ignored so the
// leave-round confirm can never stack.
function setupHardwareBack() {
  try {
    if (!history.state || history.state.boo !== 1) {
      history.replaceState({ boo: 0 }, '');
      history.pushState({ boo: 1 }, '');
    }
    window.addEventListener('popstate', () => {
      if (history.state && history.state.boo === 1) return; // forward nav back onto the guard
      history.pushState({ boo: 1 }, '');
      if (document.querySelector('.overlay')) return;       // a dialog is awaiting an answer
      const act = getBackAction();
      if (act) { try { act(); } catch (e) { console.warn(e); } }
    });
  } catch (e) { console.warn('[main] history guard unavailable', e); }
}

function boot() {
  // Resilience nets first (RUN5 C0b): catch any error before it reaches a white
  // screen, and warn once if saving is blocked.
  installOopsNet();
  installSaveGuard();
  starField(document.getElementById('starfield'), 60);
  setupHardwareBack();
  const save = State.load();
  applyAudioSettings();
  // Rolling save snapshot, at most once per day of play (RUN5 C0b).
  if (save && save.name) { maybeRollingBackup().catch(() => {}); }

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
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // Update toast (RUN5 C0b): surface a waiting build so the hub can offer it.
        // The worker still waits (no auto-activation) until she taps to accept.
        if (reg.waiting) setWaitingWorker(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) setWaitingWorker(nw);
          });
        });
        // RUN5 C0b (update discovery): the browser only re-checks sw.js on a hard
        // navigation, so an app that is merely backgrounded and resumed can sit on an
        // old build without noticing a deploy. Re-check when the app returns to the
        // foreground — DETECTION ONLY: a new build installs to `waiting` and the hub
        // offers the toast; it never auto-activates (that stays user-initiated,
        // honouring the no-skipWaiting policy from hotfix 1). Same-origin and cheap.
        const recheck = () => { try { reg.update(); } catch {} };
        document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck(); });
        window.addEventListener('focus', recheck);
      }).catch(() => {});
    });
  }
}

// expose for debugging / tests
window.BooTown = { go, State };

boot();
