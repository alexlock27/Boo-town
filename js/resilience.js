// js/resilience.js — RUN5 C0b resilience quick-wins.
// Four small, high-value safety nets shipped together:
//   1. Oops net       — a friendly full-screen card on any uncaught error; no child
//                        ever meets a white screen. The technical message is stored
//                        for the grown-ups "last hiccup" line.
//   2. Update toast    — a hub-only prompt when a new service-worker build is waiting;
//                        tapping activates it (user-initiated only — the SW never
//                        auto-activates mid-session, per the no-skipWaiting policy).
//   3. Rolling backups — once per day of play, snapshot the save to IndexedDB, keep
//                        the last three; restorable from the grown-ups corner.
//   4. Guarded saves   — a one-time grown-up-worded toast if the save write fails, so
//                        play continues from memory and nobody is surprised later.

import { getState, mutate, exportCode, importCode, todayKey, onSaveError } from './state.js';
import { idbPut, idbGetAll, idbDelete, idbAvailable } from './idb.js';

// ============================ 1. Oops net ============================
const HICCUP_KEY = 'bootown.hiccup';
let oopsShown = false;

export function installOopsNet() {
  window.addEventListener('error', (e) => {
    const m = (e && (e.message || (e.error && e.error.message))) || 'Unknown error';
    if (/ResizeObserver loop/i.test(m)) return;   // benign, browsers spam it
    recordHiccup(m);
    showOops();
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    const m = (r && (r.message || String(r))) || 'Unknown problem';
    recordHiccup(m);
    showOops();
  });
}

function recordHiccup(msg) {
  try { localStorage.setItem(HICCUP_KEY, JSON.stringify({ msg: String(msg).slice(0, 300), at: Date.now() })); } catch {}
}
export function lastHiccup() {
  try { return JSON.parse(localStorage.getItem(HICCUP_KEY) || 'null'); } catch { return null; }
}

export function showOops() {
  if (oopsShown || (typeof document === 'undefined')) return;
  oopsShown = true;
  const root = document.createElement('div');
  root.className = 'oops-net';
  root.innerHTML =
    '<div class="oops-card">' +
      '<div class="oops-boo">' + dizzyBooSVG() + '</div>' +
      '<h2>Oops! The Boos tripped over a wire!</h2>' +
      '<p>Nothing is lost. Let\'s give it a fresh start.</p>' +
      '<button class="btn big oops-restart">Restart</button>' +
    '</div>';
  const btn = root.querySelector('.oops-restart');
  btn.addEventListener('click', () => { try { location.reload(); } catch {} });
  document.body.appendChild(root);
}

// A wobbly, dizzy little Boo — spiral eyes, tongue out. Self-contained (imports
// nothing that could itself be the thing that failed).
function dizzyBooSVG() {
  return '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">' +
    '<ellipse cx="26" cy="40" rx="15" ry="20" fill="#C6A9F0" stroke="#2A1B4E" stroke-width="4"/>' +
    '<ellipse cx="94" cy="40" rx="15" ry="20" fill="#C6A9F0" stroke="#2A1B4E" stroke-width="4"/>' +
    '<circle cx="60" cy="66" r="38" fill="#8FC7FF" stroke="#2A1B4E" stroke-width="4"/>' +
    '<path d="M40 56 q6 -6 12 0" fill="none" stroke="#2A1B4E" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M68 56 q6 -6 12 0" fill="none" stroke="#2A1B4E" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M46 52 a5 5 0 1 1 0 0.1 M46 52 q6 3 3 8" fill="none" stroke="#2A1B4E" stroke-width="2.4"/>' +
    '<path d="M74 52 a5 5 0 1 1 0 0.1 M74 52 q-6 3 -3 8" fill="none" stroke="#2A1B4E" stroke-width="2.4"/>' +
    '<ellipse cx="60" cy="82" rx="8" ry="6" fill="#FF7AC6" stroke="#2A1B4E" stroke-width="3"/>' +
    '<circle cx="30" cy="18" r="3" fill="#FFC93C"/><circle cx="96" cy="20" r="2.4" fill="#FFC93C"/><circle cx="104" cy="70" r="2.4" fill="#FFC93C"/>' +
    '</svg>';
}

// ============================ 2. Update toast ============================
let waitingWorker = null;
let updateListeners = [];

export function setWaitingWorker(w) { waitingWorker = w; updateListeners.forEach(cb => { try { cb(); } catch {} }); }
export function hasUpdateWaiting() {
  if (typeof window !== 'undefined' && window.__forceUpdateToast) return true;
  return !!waitingWorker;
}
// Register/clear a callback fired when an update becomes available (so the hub can
// show the toast if a worker finishes installing while she is sitting on the hub).
export function onUpdateWaiting(cb) { updateListeners.push(cb); return () => { updateListeners = updateListeners.filter(x => x !== cb); }; }

export function activateUpdate() {
  // Test/forced path: no real worker, just reload into the fresh build.
  if ((typeof window !== 'undefined' && window.__forceUpdateToast) && !waitingWorker) {
    try { location.reload(); } catch {}
    return;
  }
  if (waitingWorker && typeof navigator !== 'undefined' && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => { try { location.reload(); } catch {} }, { once: true });
    try { waitingWorker.postMessage('SKIP_WAITING'); } catch { location.reload(); }
  } else {
    try { location.reload(); } catch {}
  }
}

// ============================ 3. Rolling backups ============================
const BACKUP_STORE = 'backups';
export const MAX_SNAPSHOTS = 3;

// Snapshot the save at most once per local day of play. Keeps the last three.
export async function maybeRollingBackup() {
  if (!idbAvailable()) return;
  const s = getState();
  if (!s) return;
  const day = todayKey();
  if (s.seen && s.seen.lastBackupDay === day) return;
  try {
    const at = Date.now();
    await idbPut(BACKUP_STORE, { id: 'snap-' + at, day, at, code: exportCode() });
    const all = (await idbGetAll(BACKUP_STORE)).sort((a, b) => b.at - a.at);
    for (const old of all.slice(MAX_SNAPSHOTS)) await idbDelete(BACKUP_STORE, old.id);
    mutate(st => { st.seen = st.seen || {}; st.seen.lastBackupDay = day; });
  } catch (e) { console.warn('[backup] snapshot failed', e); }
}

export async function listSnapshots() {
  if (!idbAvailable()) return [];
  try { return (await idbGetAll(BACKUP_STORE)).sort((a, b) => b.at - a.at); } catch { return []; }
}
// Apply a snapshot's backup code exactly like a pasted code (validated + migrated).
export function restoreSnapshot(code) { return importCode(code); }

// ============================ 4. Guarded saves ============================
let saveToastShown = false;
export function installSaveGuard() {
  onSaveError(() => {
    if (saveToastShown) return;
    saveToastShown = true;
    showToast(
      "Heads up for a grown-up: this device can't save right now (storage may be full or blocked). She can keep playing, but brand-new progress might not stick until there's room.",
      { className: 'save-warn', autoHideMs: 0 }
    );
  });
}

// ============================ shared toast ============================
export function showToast(text, { actionLabel = '', onAction = null, autoHideMs = 6000, className = '' } = {}) {
  if (typeof document === 'undefined') return null;
  const t = document.createElement('div');
  t.className = 'boo-toast' + (className ? ' ' + className : '');
  const msg = document.createElement('span'); msg.className = 'bt-msg'; msg.textContent = text; t.appendChild(msg);
  if (actionLabel) {
    const b = document.createElement('button');
    b.className = 'btn bt-action'; b.textContent = actionLabel;
    b.addEventListener('click', () => { if (onAction) onAction(); });
    t.appendChild(b);
  }
  const close = document.createElement('button');
  close.className = 'bt-close'; close.setAttribute('aria-label', 'Dismiss'); close.textContent = '✕';
  close.addEventListener('click', () => t.remove());
  t.appendChild(close);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  if (autoHideMs > 0) setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, autoHideMs);
  return t;
}
