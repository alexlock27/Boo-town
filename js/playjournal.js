// js/playjournal.js — RUN21F F10B: the play journal.
//
// A grown-up watching a play session wants to know afterwards what she actually did:
// which screens she opened, how long she stayed, what she tapped. That is a QA
// instrument, not a feature, so it lives entirely behind the SAME QA flag every other
// test seam in this app uses — `window.__bootownQA` (js/town.js's `?hour=` override is
// gated on it too). With that flag unset there is no toggle, no listener, no entry and
// nothing in the DOM: the whole thing is invisible, which is the point.
//
// Three properties are structural rather than promised:
//   • OFF BY DEFAULT and NEVER PERSISTED — the switch is a module-level boolean. There is
//     no settings key, no localStorage write, no save migration. A reload starts off,
//     always, and there is no way to leave it on for a child.
//   • NOTHING LEAVES THE DEVICE — the download is a Blob and an object URL. No fetch, no
//     XHR, no form; house law's zero-network rule holds by construction.
//   • NOTHING SENSITIVE IS READ — labels come from aria-label / data-item / short button
//     text only. Input and textarea values are never touched.
//
// Not to be confused with quests.js `stampJournal`, which persists milestone day-keys into
// the save. This one is a volatile session log and shares nothing with it.

export const JOURNAL_LABEL = 'Session notes for grown-ups';
export const DOWNLOAD_LABEL = 'Download notes';

const MAX_ENTRIES = 2000;      // a bounded session log; a child cannot out-tap this
const LABEL_MAX = 48;

let on = false;                // the switch. Module-level, volatile, off on every load.
let entries = [];              // the notes themselves — memory only
let startedAt = 0;
let openScreen = null;         // { name, at, index } — the screen currently being dwelt in
let tapHook = null;            // the capture-phase listener, only while on

export function qaAvailable() {
  return typeof window !== 'undefined' && !!window.__bootownQA;
}
export function journalOn() { return on && qaAvailable(); }

export function setJournalOn(next) {
  const want = !!next && qaAvailable();
  if (want === on) return on;
  on = want;
  if (on) {
    entries = [];
    startedAt = Date.now();
    openScreen = null;
    installTapHook();
    push({ kind: 'session', event: 'start' });
    // Whatever screen she is on when the notes start is the first screen of the session.
    const now = typeof document !== 'undefined' && document.getElementById('screen');
    if (now && now.dataset && now.dataset.screen) noteScreen(now.dataset.screen);
  } else {
    closeScreen();
    removeTapHook();
    push({ kind: 'session', event: 'stop' });
  }
  return on;
}

function push(entry) {
  if (!on) return null;
  if (entries.length >= MAX_ENTRIES) return null;
  const e = { at: Date.now() - startedAt, ...entry };
  entries.push(e);
  return e;
}

function closeScreen() {
  if (!openScreen) return;
  const e = entries[openScreen.index];
  if (e) e.dwellMs = Date.now() - openScreen.at;
  openScreen = null;
}

// Called by js/main.js's go() — the one router every screen change passes through.
export function noteScreen(name, params) {
  if (!journalOn()) return;
  closeScreen();
  const entry = push({ kind: 'screen', name, params: safeParams(params), dwellMs: 0 });
  if (entry) openScreen = { name, at: Date.now(), index: entries.length - 1 };
}

function safeParams(p) {
  if (!p || typeof p !== 'object') return undefined;
  const out = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function installTapHook() {
  if (tapHook || typeof document === 'undefined') return;
  tapHook = (ev) => {
    if (!on) return;
    try { push({ kind: 'tap', target: describe(ev.target), screen: currentScreenName() }); } catch {}
  };
  // Capture phase, passive: it observes and never interferes with a tap the child makes.
  document.addEventListener('pointerdown', tapHook, { capture: true, passive: true });
}
function removeTapHook() {
  if (!tapHook || typeof document === 'undefined') return;
  document.removeEventListener('pointerdown', tapHook, { capture: true });
  tapHook = null;
}

function currentScreenName() {
  const n = typeof document !== 'undefined' && document.getElementById('screen');
  return (n && n.dataset && n.dataset.screen) || null;
}

// A short, safe description of what was tapped. Never reads input/textarea values.
function describe(node) {
  if (!node || node.nodeType !== 1) return 'page';
  const el2 = node.closest ? (node.closest('button, a, [role="button"], .t-item, .t-boo, [data-item]') || node) : node;
  const tag = (el2.tagName || 'node').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return tag;
  const label = el2.getAttribute && (el2.getAttribute('aria-label') || el2.getAttribute('data-item'))
    || (el2.dataset && el2.dataset.item)
    || (el2.textContent || '').trim().replace(/\s+/g, ' ');
  const cls = (el2.className && typeof el2.className === 'string') ? el2.className.split(/\s+/)[0] : '';
  const text = String(label || '').slice(0, LABEL_MAX);
  return text ? `${tag}${cls ? '.' + cls : ''}: ${text}` : `${tag}${cls ? '.' + cls : ''}`;
}

// The notes as they stand, with the open screen's dwell brought up to date.
export function journalSnapshot() {
  const list = entries.map(e => ({ ...e }));
  if (openScreen && list[openScreen.index]) list[openScreen.index].dwellMs = Date.now() - openScreen.at;
  const screens = list.filter(e => e.kind === 'screen');
  return {
    app: 'Boo Town session notes',
    startedAt: startedAt ? new Date(startedAt).toISOString() : null,
    durationMs: startedAt ? Date.now() - startedAt : 0,
    screensVisited: screens.length,
    taps: list.filter(e => e.kind === 'tap').length,
    dwellByScreen: screens.reduce((acc, e) => { acc[e.name] = (acc[e.name] || 0) + (e.dwellMs || 0); return acc; }, {}),
    entries: list
  };
}

// A Blob and an object URL: the notes never touch the network, and the anchor that
// carries them is removed in the same tick it is clicked.
export function downloadNotes() {
  if (!qaAvailable() || typeof document === 'undefined') return false;
  const data = journalSnapshot();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boo-town-session-notes-${stamp}.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 4000);
  return true;
}

// Test seam: everything that could possibly be a trace, in one call.
export function journalTrace() {
  return {
    qa: qaAvailable(),
    on,
    entries: entries.length,
    listening: !!tapHook,
    startedAt
  };
}
