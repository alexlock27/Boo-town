// js/backup.js — RUN8 v2 C2: on-device export ("Keep a copy") and OS-share ("Send a
// copy") of a .boo backup envelope. Everything stays local; the only thing that ever
// leaves the app is a file the grown-up explicitly hands to the OS share sheet — which
// house law permits and which is not an app network request. No fetch/XHR anywhere here.

import { getState, exportCode, mutate, readSaveText, adoptSave, BACKUP_PREFIX } from './state.js';
import { idbGetAll, idbPut, idbAvailable } from './idb.js';
import { snapshotNow } from './resilience.js';

export const BOO_FORMAT = 'boo-backup';
export const BOO_FORMAT_VERSION = 1;

// The live deployed build stamp, read from the service-worker cache name (single source
// of truth — no duplicated constant). 'unknown' off a service worker (e.g. localhost).
export async function currentBuildStamp() {
  try {
    if (typeof caches === 'undefined') return 'unknown';
    const keys = await caches.keys();
    const c = keys.find(k => k.startsWith('bootown-'));
    return c ? c.slice('bootown-'.length) : 'unknown';
  } catch { return 'unknown'; }
}

// A tiny preview block so a restore screen can show what a file holds without parsing
// the whole save.
export function backupSummary(save) {
  const s = save || getState() || {};
  const inv = s.inventory || {};
  const uniqueBoos = Object.keys(inv).filter(k => k.startsWith('boo_') && inv[k] > 0).length;
  return {
    name: s.name || '',
    stars: (s.stars && s.stars.total) || 0,
    uniqueBoos,
    trophies: s.trophies ? Object.keys(s.trophies).length : 0
  };
}

export function canShareFiles() {
  try {
    if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
    const probe = new File(['{}'], 'probe.boo', { type: 'application/json' });
    return navigator.canShare({ files: [probe] });
  } catch { return false; }
}

function dateStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function safeName(name) {
  const n = (name || '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return n || 'boo';
}
export function backupFilename(save, when = new Date()) {
  return `bootown-backup-${safeName((save || getState() || {}).name)}-${dateStamp(when)}.boo`;
}

// Build the full .boo envelope. createdAtMs is injected (tests pass a fixed value; the
// UI passes Date.now()). Optionally embeds creations (gallery art + jams) and, only
// under its own explicit flag, voice recordings (a child's voice).
export async function buildEnvelope({ includeCreations = false, includeVoices = false, createdAtMs = Date.now() } = {}) {
  const save = getState();
  if (!save) return null;
  const buildStamp = await currentBuildStamp();
  let snapshot = null;
  if (idbAvailable()) {
    try {
      const snaps = (await idbGetAll('backups')) || [];
      snaps.sort((a, b) => (b.at || 0) - (a.at || 0));
      snapshot = snaps[0] || null;
    } catch {}
  }
  const envelope = {
    format: BOO_FORMAT,
    formatVersion: BOO_FORMAT_VERSION,
    createdAt: createdAtMs,
    buildStamp,
    summary: backupSummary(save),
    save,                       // the full localStorage save
    snapshot                    // the latest rolling snapshot (id, day, at, code) or null
  };
  if (includeCreations && idbAvailable()) {
    try { envelope.artworks = (await idbGetAll('artworks')) || []; } catch { envelope.artworks = []; }
    try { envelope.jams = (await idbGetAll('jams')) || []; } catch { envelope.jams = []; }
  }
  if (includeVoices && idbAvailable()) {
    try { envelope.voices = (await idbGetAll('audio')) || []; } catch { envelope.voices = []; }
  }
  return envelope;
}

export async function buildBackupFile(opts = {}) {
  const envelope = await buildEnvelope(opts);
  if (!envelope) return null;
  const json = JSON.stringify(envelope);
  const filename = backupFilename(envelope.save, new Date(envelope.createdAt));
  return { envelope, json, filename, size: new Blob([json]).size };
}

export function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

// Record that a backup happened (either path, either variant) — drives the C4 reminder.
export function markBackedUp(at = Date.now()) { mutate(s => { s.lastBackupAt = at; }); }

// "Keep a copy on this tablet": download the file to the device's own file storage
// (Downloads on Android, the Files app on iOS) — outside the browser storage bucket, so
// it survives cleared browser data and deleted app icons.
export async function keepCopy(opts = {}) {
  const file = await buildBackupFile(opts);
  if (!file) return { ok: false, error: 'There is nothing to back up yet.' };
  try {
    const blob = new Blob([file.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    markBackedUp();
    return { ok: true, filename: file.filename, size: file.size };
  } catch (e) { return { ok: false, error: 'This tablet would not save the file.' }; }
}

// "Send a copy off this tablet": hand the same file to the OS share sheet (Web Share API
// with files). This is a user-initiated OS action, not an app network request.
export async function sendCopy(opts = {}) {
  const file = await buildBackupFile(opts);
  if (!file) return { ok: false, error: 'There is nothing to back up yet.' };
  try {
    const f = new File([file.json], file.filename, { type: 'application/json' });
    if (!canShareFiles()) return { ok: false, error: 'This device cannot share files. Use "Keep a copy" instead.' };
    await navigator.share({ files: [f], title: 'Boo Town backup', text: 'A Boo Town safety copy. Keep it somewhere safe.' });
    markBackedUp();
    return { ok: true, filename: file.filename, size: file.size };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, aborted: true };
    return { ok: false, error: 'The share sheet did not open.' };
  }
}

// The universal fallback: the pasteable code, now with a matching summary line for preview.
export function backupCodeWithSummary() {
  const save = getState();
  if (!save) return { code: '', summary: null };
  return { code: exportCode(), summary: backupSummary(save) };
}

// ---- Restore (RUN8 v2 C3) --------------------------------------------------
// A preview block for a candidate save, shown before anything is applied.
export function previewFor(save, envelope) {
  const sum = backupSummary(save);
  // For a .boo file the meaningful date is when the backup was made; else last played.
  const when = (envelope && envelope.createdAt) || (save && save.lastPlayed) || (save && save.created) || 0;
  return {
    ...sum,
    savedDate: when ? dateStamp(new Date(when)) : 'unknown',
    creations: !!(envelope && ((envelope.artworks && envelope.artworks.length) || (envelope.jams && envelope.jams.length))),
    voices: !!(envelope && envelope.voices && envelope.voices.length)
  };
}

// Inspect pasted text or a file's text WITHOUT applying it. Returns
// { ok, save, envelope, preview } or { ok:false, error }.
export function inspectText(text) {
  const r = readSaveText(text);
  if (!r.ok) return r;
  return { ok: true, save: r.save, envelope: r.envelope, preview: previewFor(r.save, r.envelope) };
}
// Inspect a rolling snapshot record ({ code, ... }).
export function inspectSnapshot(snap) {
  if (!snap || !snap.code) return { ok: false, error: 'That snapshot could not be read.' };
  const r = inspectText(snap.code);
  if (r.ok && snap.label) r.preview.savedDate = snap.label;
  return r;
}

// Apply an inspection: first auto-snapshot the CURRENT state (undo point), then adopt the
// new save and, from a full envelope, return artworks / jams / voices to their stores.
export async function restoreInspected(inspect) {
  if (!inspect || !inspect.ok || !inspect.save) return { ok: false, error: 'There was nothing to restore.' };
  try { await snapshotNow('before restore, ' + dateStamp()); } catch {}
  const res = adoptSave(inspect.save);
  if (!res.ok) return res;
  const env = inspect.envelope;
  if (env && idbAvailable()) {
    try { for (const a of (env.artworks || [])) await idbPut('artworks', a); } catch {}
    try { for (const j of (env.jams || [])) await idbPut('jams', j); } catch {}
    try { for (const v of (env.voices || [])) await idbPut('audio', v); } catch {}
  }
  return { ok: true };
}
