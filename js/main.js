// js/main.js — app boot + routing between screens (spec §11.1).
// Screens are ES modules exposing mount(container, params, ctx) -> api{ unmount? }.

import * as State from './state.js';
import { initAudio, music, setSoundEnabled, setMusicEnabled } from './sfx.js';
import * as tts from './tts.js';
import { starField, clearConfetti, setBackAction, getBackAction, el, clear } from './ui.js';
import { installOopsNet, installSaveGuard, maybeRollingBackup, setWaitingWorker, showToast, listSnapshots, restoreSnapshot } from './resilience.js';
import { setHapticsEnabled } from './haptics.js';

const screenEl = document.getElementById('screen');
let current = null;
let audioInited = false;

// Lazy screen registry (dynamic import → build incrementally, lighter first paint).
const registry = {
  onboarding: () => import('./onboarding.js'),
  hub:        () => import('./hub.js?v=5'),
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
  oddboo:     () => import('./games/oddboo.js'),        // RUN10 P19
  flashboos:  () => import('./games/flashboos.js'),     // RUN10 P19
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
  band:       () => import('./band/bandroom.js'),   // RUN10 P6: Band Room
  'band-legacy': () => import('./band.js'),          // preserved RUN9 harness + watch/record compatibility
  'band-drums': () => import('./band/drums.js'),
  'band-keys': () => import('./band/keys.js'),
  'band-guitar': () => import('./band/guitar.js'),
  'band-xylophone': () => import('./band/xylophone.js'),
  'band-songs': () => import('./band/songs.js'),
  'band-jams': () => import('./band/jams.js'),
  discohall:  () => import('./discohall.js'),   // RUN10 P18: Funfair Disco Hall
  expedition:      () => import('./expedition/trail.js'),    // RUN10 P15: Boo Expedition
  expeditionpuzzle: () => import('./expedition/puzzle.js'),  // RUN10 P16: the four puzzles
  caper:      () => import('./caper/notebook.js'),           // RUN10 P17: Snaffle's First Caper
  // (RUN11 Q1: the birthday party route is retired; its code is archived under archive/.)
  booquest:   () => import('./booquest.js'),   // Boo Quest (RUN6 C6)
  grownups:   () => import('./grownups.js')
};

const ctx = { go, music, refreshAudio: applyAudioSettings };

// Every navigation takes a ticket. Screens are lazily imported, so a second go() can start
// while the first is still awaiting its module; without this guard the slower import wins
// the race and mounts ITS screen over the newer one — a fast tap during boot could land on
// the wrong screen, and it made test navigations flaky. A superseded navigation now drops
// its result instead of painting it. (RUN11.)
let navToken = 0;
export async function go(name, params = {}) {
  // Unknown / retired route → fall back to the hub gracefully (RUN11 Q1: the retired
  // birthday route must 404 to the hub, never a broken screen).
  if (!registry[name]) { console.warn('[main] unknown route', name, '→ hub'); name = 'hub'; params = {}; }
  const token = ++navToken;
  if (current && current.api && typeof current.api.unmount === 'function') {
    try { current.api.unmount(); } catch (e) { console.warn(e); }
  }
  current = null;
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
    if (token !== navToken) return;   // superseded while importing
    console.error('[main] failed to load screen', name, e);
    screenEl.innerHTML = `<div class="card" style="margin:40px auto;max-width:400px">Something went wrong loading "${name}".</div>`;
    return;
  }
  if (token !== navToken) return;     // a newer navigation owns the screen now
  const api = await mod.mount(screenEl, params, ctx);
  if (token !== navToken) {           // mount itself can await; if we lost, clean up after us
    try { if (api && typeof api.unmount === 'function') api.unmount(); } catch {}
    return;
  }
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

// Calm grown-ups restore screen (RUN8 v2 C1.3). Shown only when a save could not be
// opened AND no on-device snapshot could stand in. No blame, no child-facing wording;
// three ways back (a snapshot, a pasted code, a backup file) and a guarded fresh start.
// While this is up the corrupt bytes are NEVER overwritten (state stays null).
function showRescueScreen() {
  const root = screenEl || document.getElementById('screen');
  if (!root) return;
  clear(root);
  const msg = el('p', { class: 'rescue-msg' });
  const finish = (res) => {
    if (res && res.ok) { msg.className = 'rescue-msg ok'; msg.textContent = 'Restored! Bringing Boo Town back…'; setTimeout(() => { try { location.reload(); } catch {} }, 800); }
    else { msg.className = 'rescue-msg err'; msg.textContent = (res && res.error) || 'That did not work — try another copy.'; }
  };

  const snapWrap = el('div', { class: 'rescue-snaps' });
  const codeInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Paste a Boo Town backup code', 'aria-label': 'Paste a Boo Town backup code' });
  const codeBtn = el('button', { class: 'btn', text: 'Restore from code', onclick: () => finish(State.importCode(codeInput.value)) });
  const fileInput = el('input', { class: 'rescue-file', type: 'file', accept: '.boo,.json,.txt', 'aria-label': 'Choose a backup file', onchange: async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { finish(State.importAny(await f.text())); } catch { finish({ ok: false, error: 'That file could not be read.' }); }
  } });

  const card = el('div', { class: 'rescue-card' }, [
    el('h1', { text: 'Let’s bring Boo Town back' }),
    el('p', { class: 'rescue-lead', text: 'This tablet’s save could not be opened this time. Nothing you have backed up is lost — pick a copy to restore from.' }),
    el('h2', { class: 'rescue-sub', text: 'Safety copies on this tablet' }),
    snapWrap,
    el('h2', { class: 'rescue-sub', text: 'Have a backup elsewhere?' }),
    el('p', { class: 'rescue-hint', text: 'Paste a saved code, or choose a backup file you sent to a grown-up’s phone or chat.' }),
    el('div', { class: 'rescue-row' }, [codeInput, codeBtn]),
    el('div', { class: 'rescue-row' }, [fileInput]),
    msg,
    el('hr', {}),
    el('button', { class: 'btn soft rescue-fresh', text: 'Start Boo Town fresh instead', onclick: () => {
      const go2 = confirm('Start a brand-new Boo Town? Only do this if you have no backup to restore — current progress on this tablet cannot be opened, and starting fresh replaces it.');
      if (go2) { State.resetAll(); State.initNew('', null); location.reload(); }
    } })
  ]);
  const wrap = el('div', { class: 'rescue-net' }, [card]);
  root.appendChild(wrap);

  (async () => {
    let snaps = [];
    try { snaps = await listSnapshots(); } catch {}
    clear(snapWrap);
    if (!snaps.length) { snapWrap.appendChild(el('p', { class: 'rescue-hint', text: 'No automatic snapshots were found on this tablet.' })); return; }
    for (const sn of snaps) {
      const when = (sn && sn.day) || 'a saved day';
      snapWrap.appendChild(el('div', { class: 'rescue-snap-row' }, [
        el('span', { class: 'rescue-snap-when', text: when }),
        el('button', { class: 'btn soft', text: 'Restore this', onclick: () => finish(restoreSnapshot(sn.code)) })
      ]));
    }
  })();
}

async function boot() {
  // Resilience nets first (RUN5 C0b): catch any error before it reaches a white
  // screen, and warn once if saving is blocked.
  installOopsNet();
  installSaveGuard();
  starField(document.getElementById('starfield'), 60);
  setupHardwareBack();
  // Fail-safe loader (RUN8 v2 C1.3): never silent-fresh over recoverable data.
  const result = await State.loadOrRescue();
  const save = result.state;
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

  if (result.status === 'rescue-needed') {
    // Nothing recoverable on-device: a calm grown-ups restore screen. We never
    // autosave over the key here, so the raw bytes stay put for a manual rescue.
    showRescueScreen();
  } else {
    if (result.status === 'restored-snapshot' || result.status === 'restored-rescue') {
      setTimeout(() => showToast('Restored from a safety copy!', { className: 'restore-banner', autoHideMs: 7000 }), 700);
    }
    if (!save || !save.name) go('onboarding');
    else go('hub');
  }

  // Register the service worker only off-localhost (spec §11.6: avoids stale-cache
  // pain during dev). On GitHub Pages it registers and enables full offline use.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    if (isLocal) {
      // Clear any stale local development service workers so local code updates apply immediately
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    } else {
      // boot() is async (it awaits the fail-safe loader, which touches IndexedDB), so by the
      // time we get here the window 'load' event may ALREADY have fired — in which case a
      // plain addEventListener('load') never runs and the worker is never registered, which
      // would silently disable offline support on a real device. Register immediately if
      // loading has finished, otherwise wait for load as before. (RUN11.)
      const registerSW = () => {
        navigator.serviceWorker.register('sw.js').then((reg) => {
          if (reg.waiting) setWaitingWorker(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) setWaitingWorker(nw);
            });
          });
          const recheck = () => { try { reg.update(); } catch {} };
          document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck(); });
          window.addEventListener('focus', recheck);
        }).catch(() => {});
      };
      if (document.readyState === 'complete') registerSW();
      else window.addEventListener('load', registerSW, { once: true });
    }
  }
}

// expose for debugging / tests
window.BooTown = { go, State };

boot();
