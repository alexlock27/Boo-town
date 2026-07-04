// js/state.js — the single source of truth for the save (spec §11.2).
// One localStorage key. Debounced autosave. Persistent-storage request.
// Backup codes = base64 of the JSON with a BOO1. prefix.

// Key stays 'bootown.save.v1' (the localStorage slot name) so tablets keep their save;
// the schema version lives in the `version` field and migrates forward.
export const SAVE_KEY = 'bootown.save.v1';
export const VERSION = 3;
export const BACKUP_PREFIX = 'BOO1.';

function freshSave() {
  return {
    version: VERSION,
    name: '',
    // Run-2 guide shape (5 species on one rig). See art.js normalizeGuide.
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
    stars: {
      total: 0,
      byGame: {
        bubblepop: { best: 0, plays: 0 },
        feedboos:  { best: 0, plays: 0 },
        spellboo:  { best: 0, plays: 0 }
      }
    },
    meter: 0,
    boxes: 0,
    opened: 0,
    pity: { commons: 0 },       // consecutive Common opens, for the pity rule
    inventory: {},              // itemId -> count
    town: [],                   // [{ zone, x, item }] (v3); old [{ plot, item }] migrated in phase 3
    nicknames: {},              // itemId -> nickname (owned Boos)
    equips: {},                 // Boo itemId -> accessory itemId
    spellingMastery: {},        // word -> lifetime correct count
    seen: {},                   // one-time flags (game intros, town first, etc.)
    settings: { sound: true, music: true, voice: true },
    created: 0,
    lastPlayed: 0
  };
}

let state = null;
let persistRequested = false;
let saveTimer = null;
let persistResult = null;

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

// Load (and migrate) the save, or return null if there is none.
export function load() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { raw = null; }
  if (!raw) { state = null; return null; }
  try {
    const parsed = JSON.parse(raw);
    state = migrate(parsed);
    return state;
  } catch (e) {
    console.warn('[state] corrupt save, ignoring', e);
    state = null;
    return null;
  }
}

// Ensure a loaded object has every current field (forward-compatible defaults),
// plus shape transforms for older schema versions. Shape-detected so it is safe to
// re-run and robust to partial states. Old saves migrate losslessly.
function migrate(obj) {
  const o = obj || {};
  // v1 giraffe guide { body, patch, acc, name } -> v3 guide object.
  if (o.guide && !o.guide.species) o.guide = migrateGuideShape(o.guide);
  const base = freshSave();
  const merged = deepDefaults(o, base);
  merged.version = VERSION;
  return merged;
}

// Map the old giraffe-only guide to the new 5-species shape without losing anything.
function migrateGuideShape(old) {
  return {
    species: 'giraffe',
    body: old.body || 'sunshine',
    pattern: old.patch ? 'spots' : 'none',   // old giraffes always had patches
    patternColour: old.patch || 'cocoa',
    eyes: 'round',
    acc: old.acc || 'none',
    name: old.name || 'Twiggy'
  };
}

function deepDefaults(src, def) {
  if (Array.isArray(def)) return Array.isArray(src) ? src : def;
  if (def && typeof def === 'object') {
    const out = {};
    const keys = new Set([...Object.keys(def), ...(src && typeof src === 'object' ? Object.keys(src) : [])]);
    for (const k of keys) {
      if (k in def) out[k] = deepDefaults(src ? src[k] : undefined, def[k]);
      else out[k] = src[k]; // preserve extra keys
    }
    return out;
  }
  return src === undefined ? def : src;
}

export function getState() { return state; }

export function initNew(name, guide) {
  state = freshSave();
  state.name = (name || '').slice(0, 16);
  if (guide) state.guide = guide;
  state.created = Date.now();
  state.lastPlayed = Date.now();
  commit();
  return state;
}

// Mutate then schedule a debounced save.
export function mutate(fn) {
  if (!state) return;
  fn(state);
  scheduleSave();
}

export function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(commit, 400);
}

// Write immediately.
export function commit() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!state) return;
  state.lastPlayed = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[state] save failed', e);
  }
  requestPersist();
}

// Ask the browser to keep our storage (once).
async function requestPersist() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (navigator.storage && navigator.storage.persist) {
      persistResult = await navigator.storage.persist();
      console.log('[state] storage.persist ->', persistResult);
    }
  } catch (e) {
    console.warn('[state] persist error', e);
  }
}

export function persistStatus() { return persistResult; }

// Flush on the way out so nothing is lost.
if (typeof window !== 'undefined') {
  const flush = () => { if (state && saveTimer) commit(); };
  window.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
}

// ---- backup / restore (grown-ups corner) --------------------------------
export function exportCode() {
  if (!state) return '';
  const json = JSON.stringify(state);
  return BACKUP_PREFIX + b64encode(json);
}

// Returns { ok:true } or { ok:false, error }.
export function importCode(code) {
  if (typeof code !== 'string') return { ok: false, error: 'No code' };
  const trimmed = code.trim();
  if (!trimmed.startsWith(BACKUP_PREFIX)) return { ok: false, error: 'That does not look like a Boo Town code.' };
  let obj;
  try {
    obj = JSON.parse(b64decode(trimmed.slice(BACKUP_PREFIX.length)));
  } catch {
    return { ok: false, error: 'The code is damaged or incomplete.' };
  }
  if (!obj || typeof obj !== 'object' || !('meter' in obj) || !('inventory' in obj)) {
    return { ok: false, error: 'That code is not a valid save.' };
  }
  state = migrate(obj);
  commit();
  return { ok: true };
}

export function resetAll() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  state = null;
}

// UTF-8 safe base64.
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(b64) {
  return decodeURIComponent(escape(atob(b64)));
}
