// js/main.js — app boot + routing between screens (spec §11.1).
// Screens are ES modules exposing mount(container, params, ctx) -> api{ unmount? }.

import * as State from './state.js';
import { initAudio, music, setSoundEnabled, setMusicEnabled } from './sfx.js';
import * as tts from './tts.js';
import { starField, clearConfetti, setBackAction, getBackAction, backActionGuarded, setCalmMotion, setBiggerText, el, clear } from './ui.js';
import { installOopsNet, installSaveGuard, maybeRollingBackup, setWaitingWorker, showToast, listSnapshots, restoreSnapshot } from './resilience.js';
import { setHapticsEnabled } from './haptics.js';
import { qaSuspendRound, qaResumeRound } from './intro.js';

const screenEl = document.getElementById('screen');
let current = null;
let audioInited = false;

// Lazy screen registry (dynamic import → build incrementally, lighter first paint).
const registry = {
  onboarding: () => import('./onboarding.js'),
  hub:        () => import('./hub.js?v=9'),
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
  soundsorter: () => import('./games/soundsorter.js'),  // Sound Sorter (RUN16 W1)
  blendit:    () => import('./games/blendit.js?v=3'),       // Blend It (RUN16 W2)
  rhymetime:  () => import('./games/rhymetime.js?v=2'),     // Rhyme Time (RUN16 W3)
  storyorder: () => import('./games/storyorder.js?v=2'),    // Story Order (RUN16 W4)
  soundtwins: () => import('./games/soundtwins.js?v=4'),    // Twin Trouble (RUN18E L3)
  apostrophepatrol: () => import('./games/apostrophepatrol.js?v=3'),   // Apostrophe Patrol (RUN18E L4)
  shop:       () => import('./shop.js'),         // the Boo Shop (RUN15 V4)
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
  discohall:  () => import('./discohall.js?v=3'),   // RUN10 P18: Funfair Disco Hall
  expedition:      () => import('./expedition/trail.js'),    // RUN10 P15: Boo Expedition
  expeditionpuzzle: () => import('./expedition/puzzle.js'),  // RUN10 P16: the four puzzles
  caper:      () => import('./caper/notebook.js'),           // RUN10 P17: Snaffle's First Caper
  // (RUN11 Q1: the birthday party route is retired; its code is archived under archive/.)
  booquest:   () => import('./booquest.js'),   // Boo Quest (RUN6 C6)
  jokeboo:    () => import('./jokeboo.js?v=2'),    // the Joke Boo's stage (RUN17 X1)
  feelings:   () => import('./feelings.js'),   // the Feelings Corner (RUN17 X3; gated, off by default)
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
  // RUN18B Y1: a screen's speech leaves with the screen. Cancelled BEFORE unmount so a
  // line cannot start in the gap, and by owner rather than wholesale so an utterance
  // another screen legitimately owns is untouched. Navigation never leaks speech.
  if (current && current.name) { try { tts.cancelOwner(current.name); } catch (e) { console.warn(e); } }
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
  // RUN18B Y1: whatever this screen says while it is BUILDING belongs to it. dataset.screen
  // is only written after mount() returns, so tagging from the DOM would credit the screen
  // she just left — and the cancel that just ran would eat the new screen's first line.
  tts.setOwnerScreen(name);
  const api = await mod.mount(screenEl, params, ctx);
  if (token !== navToken) {           // mount itself can await; if we lost, clean up after us
    try { if (api && typeof api.unmount === 'function') api.unmount(); } catch {}
    return;
  }
  current = { name, api };
  screenEl.dataset.screen = name;
  recordNav(name, params);
}
ctx.go = go;

// ---- in-app history (RUN18B Y11) ---------------------------------------------
// Every go() records a { name, params } entry and pushes ONE history entry, so the phone's
// back gesture, the browser's back button and the on-screen "‹" all move through the same
// stack, in-app, with no reload and no network.
//
// Two things it deliberately does NOT do:
//  - it never touches the URL. Hash routing would make a refresh land deep inside a game
//    and would offer links to screens that make no sense alone; the pack asks a refresh to
//    behave exactly as today, and today that is the hub.
//  - it never puts `params` INSIDE the history entry. The results screen carries a live
//    `replay` callback and a function cannot survive history's structured clone. The
//    history entry holds a depth; this stack, in memory, holds the rest. A reload therefore
//    starts a fresh stack at the hub — the same screen it opens today.
const navStack = [];
let navDepth = -1;
let navOnce = null;          // 'replace' for the ONE go() a popstate causes
const NAV_MAX = 60;          // a session's stack, bounded; a child cannot out-tap this

// A signature for "the same place, with the same arguments". Functions are dropped (results
// carries a live `replay`); anything that cannot be serialised at all gets a value that can
// never match, so an unknown shape is treated as a NEW place rather than silently folded
// onto an old one.
let sigSeq = 0;
function paramSig(p) {
  if (!p) return '';
  try { return JSON.stringify(p, (k, v) => (typeof v === 'function' ? undefined : v)) || ''; }
  catch { return '?' + (++sigSeq); }
}

function recordNav(name, params) {
  const mode = navOnce; navOnce = null;
  try {
    if (mode === 'replace' && navStack[navDepth]) {
      navStack[navDepth] = { name, params };
      history.replaceState({ boo: navDepth }, '');
      return;
    }
    // GOING BACK POPS. The shared "‹" is a plain go('hub') — it cannot know it is a backward
    // move — so without this the stack GREW on the way back and the phone's back gesture
    // then walked her FORWARDS into the screens she had just left: back out of a round and
    // one more back dropped her into it again. Arriving at a screen that is already open
    // below her therefore pops to it and drops everything in front, exactly as a stack-based
    // navigator does. (RUN18B Y11, found by the playtest critic.)
    const sig = paramSig(params);
    for (let i = navDepth; i >= 0; i--) {
      const e = navStack[i];
      if (!e || e.name !== name || paramSig(e.params) !== sig) continue;
      navStack[i] = { name, params };
      navStack.length = i + 1;
      navDepth = i;
      history.replaceState({ boo: navDepth }, '');
      return;
    }
    navStack.length = navDepth + 1;              // a new branch drops anything forward of here
    navStack.push({ name, params });
    // Bound the memory a long session can hold WITHOUT renumbering: a history entry stores
    // an absolute depth, so shifting the array would repoint old entries at the wrong
    // screens. Entries that age out are emptied in place and simply become unreachable.
    for (let i = 0; i < navStack.length - NAV_MAX; i++) navStack[i] = null;
    navDepth = navStack.length - 1;
    history.pushState({ boo: navDepth }, '');
  } catch (e) { console.warn('[main] history unavailable', e); }
}
// Undo a back we are not honouring, WITHOUT pushing: a push would silently destroy her
// forward branch, so back-back-forward would stop working. Stepping forward returns to the
// entry we were already on, and the popstate that follows hits the `to === navDepth` guard.
function syncHistory() { try { history.forward(); } catch {} }

function setupHistory() {
  try { history.replaceState({ boo: -1 }, ''); } catch (e) { console.warn('[main] history guard unavailable', e); }
  window.addEventListener('popstate', (e) => {
    const to = (e.state && typeof e.state.boo === 'number') ? e.state.boo : -1;
    if (to === navDepth) return;
    // A dialog is awaiting an answer: back must never stack a second one on top of it.
    if (document.querySelector('.overlay')) { syncHistory(); return; }
    // Off the bottom of the stack — the entry behind the app itself. Put ours back: back at
    // the hub does nothing, and back NEVER leaves the page (RUN4 C1, kept).
    if (to < 0 || to >= navStack.length || !navStack[to]) { syncHistory(); return; }
    // Going back INTO a round in play: the screen's own guarded control asks first. History
    // is restored before the question, so "Keep playing" costs her nothing — she is still on
    // the screen her history says she is on.
    if (to < navDepth && backActionGuarded()) {
      syncHistory();
      const act = getBackAction();
      if (act) { try { act(); } catch (err) { console.warn(err); } }
      return;
    }
    const target = navStack[to];
    navDepth = to;
    navOnce = 'replace';       // we are already AT this entry; do not push another
    go(target.name, target.params);
  });
}

// RUN18B Y15: the Comfort & access switches, applied at boot and again whenever they change,
// so the first painted frame already honours them.
export function applyComfortSettings() {
  const s = State.getState();
  if (!s || !s.settings) return;
  setCalmMotion(s.settings.calmMotion === true);
  setBiggerText(s.settings.biggerText === true);
}

export function applyAudioSettings() {
  const s = State.getState();
  if (!s) return;
  setSoundEnabled(s.settings.sound);
  setMusicEnabled(s.settings.music);
  tts.setEnabled(s.settings.voice);
  try { setHapticsEnabled(s.settings.haptics !== false); } catch {}   // RUN9 C7
  try { if (s.settings.voiceName) tts.setVoiceByName(s.settings.voiceName); } catch {}   // RUN9 C6b
}

// (RUN4 C1's single-sentinel hardware-back guard was replaced by the real in-app history
// stack above in RUN18B Y11. Its guarantees are kept: back moves one level in-app, does
// nothing at the hub, asks before leaving a round, and never leaves the page.)

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
  setupHistory();
  // Fail-safe loader (RUN8 v2 C1.3): never silent-fresh over recoverable data.
  const result = await State.loadOrRescue();
  const save = result.state;
  applyAudioSettings();
  applyComfortSettings();
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

// expose for debugging / tests. qaHoldOrganic/qaReleaseOrganic (RUN14 U-0) let a QA
// reachability walk hold the app's organic timers still — same lever an intro overlay
// uses — so long multi-screen walks are deterministic instead of probabilistic.
window.BooTown = { go, State, qaHoldOrganic: qaSuspendRound, qaReleaseOrganic: qaResumeRound,
  // RUN18B Y11 QA: the in-app history stack, so a suite can prove back/forward routed
  // rather than reloaded.
  nav: () => ({ depth: navDepth, stack: navStack.map(e => e && e.name), guarded: backActionGuarded() }) };

boot();
