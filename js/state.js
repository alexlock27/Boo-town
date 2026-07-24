// js/state.js — the single source of truth for the save (spec §11.2).
// One localStorage key. Debounced autosave. Persistent-storage request.
// Backup codes = base64 of the JSON with a BOO1. prefix.

import { idbGetAll, idbAvailable } from './idb.js';

// Key stays 'bootown.save.v1' (the localStorage slot name) so tablets keep their save;
// the schema version lives in the `version` field and migrates forward.
export const SAVE_KEY = 'bootown.save.v1';
export const VERSION = 11;  // v11: Lexie & Tyler birthday-party keepsakes.
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
        // earned = lifetime stars this game has credited to the total (RUN5 C0 Star Ledger).
        bubblepop: { best: 0, plays: 0, earned: 0 },
        feedboos:  { best: 0, plays: 0, earned: 0 },
        spellboo:  { best: 0, plays: 0, earned: 0 },
        blocks:    { best: 0, plays: 0, earned: 0 },
        bounce:    { best: 0, plays: 0, earned: 0 },
        beat:      { best: 0, plays: 0, earned: 0 },
        teachme:   { best: 0, plays: 0, earned: 0 },
        dash:      { best: 0, plays: 0, earned: 0 },
        clockshop: { best: 0, plays: 0, earned: 0 },
        boopop:    { best: 0, plays: 0, earned: 0 },
        detective: { best: 0, plays: 0, earned: 0 },   // Word Detective (RUN9 C3)
        booroll:   { best: 0, plays: 0, earned: 0 },   // Boo Roll (RUN9 C4)
        echoboos:  { best: 0, plays: 0, earned: 0 },   // Echo Boos (RUN9 C5)
        oddboo:    { best: 0, plays: 0, earned: 0 },
        flashboos: { best: 0, plays: 0, earned: 0 },
        // Toddler mode (RUN5 C7)
        tcount:    { best: 0, plays: 0, earned: 0 },
        tcolour:   { best: 0, plays: 0, earned: 0 },
        tshape:    { best: 0, plays: 0, earned: 0 },
        tletter:   { best: 0, plays: 0, earned: 0 },
        // Toddler mode animal games (RUN7 C4)
        tanimal:   { best: 0, plays: 0, earned: 0 },
        tpairs:    { best: 0, plays: 0, earned: 0 },
        tbigsmall: { best: 0, plays: 0, earned: 0 }
      }
    },
    meter: 0,
    boxes: 0,
    stardust: 0,
    opened: 0,
    pity: { commons: 0 },       // consecutive Common opens, for the pity rule
    inventory: {},               // itemId -> count
    town: { areas: {} },         // { areas: { areaKey: { items:[{x,row,item}], paths:[{cx,cy,style}] } } } (v6, RUN10 P1); old flat [{zone,x,item,row}] (v3-5) / [{plot,item}] (pre-v3) migrated forward
    nicknames: {},              // itemId -> nickname (owned Boos)
    equips: {},                 // Boo itemId -> {hat?,face?,feet?} accessory ids
    catBest: {},                // 'game:choice' -> best stars (per-picker badges, EXPANSION_1 §5)
    spellingMastery: {},        // word -> lifetime correct count
    ledger: {},                 // question identity -> { rights, misses, lastSeen } (RUN3 C2 Smart Mix brain)
    trickyPile: [],             // unrescued missed items carried between rounds (RUN3 C2)
    golden: null,               // parent-typed Golden Round { words:[...], choices:[...], savedAt } (RUN3 C3)
    goldenLastDouble: '',       // local-day key (YYYY-MM-DD) the daily double stars were last awarded
    quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, // 3 daily quests (RUN3 C4), no streaks
    journal: {},                // Boo Journal stamps: uniqueKey -> date (RUN3 C4)
    customs: [],                // Build-a-Boo sealed customs (RUN3 C6): [{ id, name, parts, sealed, won, wonAt? }]
    studioSeen: false,          // whether the free Easel deco has been granted with the Studio
    easelArt: '',               // artwork id displayed on the town Easel (RUN3 C6)
    request: { active: null, lastResolvedAt: 0 }, // occasional Boo requests (RUN3 C8), ≤1 active
    routines: {},               // Dance Stage choreography per stage: 'zone:x' -> [moveId] (RUN3 C8)
    age: 0,                     // her age (job 4): local save only, used only for the tier mapping
    ageAsked: false,            // the age question is asked exactly once (onboarding or one-time card)
    threeStars: {},             // 'game:cat:rank' -> 3-star round count (comfort levels, RUN4 C3)
    brave: { day: '', cats: {} },  // daily Brave-bonus claims per 'game:cat' (RUN4 C3)
    gameThrees: {},             // game -> lifetime 3-star rounds since this update (RUN4 C4 medals)
    trophies: {},               // trophy / certificate / medal key -> date earned (RUN4 C4)
    townGrowth: { done: [], pending: [], site: null },  // growth milestones + Boo Builders (RUN4 C6)
    funfair: { built: [], build: null, pending: [], seats: {} },  // Boo Funfair rides + seat riders (RUN6 C1b)
    bandSong: null,             // id of the saved jam set as the bandstand's watch-mode song (RUN6 C1c)
    quest: { node: 0, lands: {} },  // Boo Quest progress: current node in the active land + completed lands (RUN6 C6)
    booRoll: { best: {}, medals: {} },  // Boo Roll per-course best times (ms) + best medal (RUN9 C4)
    care: { bonds: {}, treats: 0 },  // RUN10 P12: friendship only rises; treats cap at five
    bloom: { max: {} },              // RUN10 P19: five child-facing petals never shrink
    wishes: { unlocked: {} },        // RUN10 P20: word -> true, one permanent Build item each
    birthdayParty: { opened: { lexie: false, tyler: false }, visits: 0 },
    shinies: {},                // itemId -> shiny copy count within the owned stack (RUN4 C8)
    shinyDrops: 0,              // Boo drops since the last shiny (the hidden mercy counter, C8)
    chest: { anchor: 0, opened: 0, welcome: false },  // Star Chest boundaries (RUN4 C8)
    delights: {},               // daily-delight flags: hide-and-seek / Boo of the Day (RUN4 C9)
    seen: {},                   // one-time flags (game intros, town first, etc.)
    settings: { sound: true, music: true, voice: true, mic: true, requests: true, content: 'light', haptics: true, voiceName: null, rollSensitivity: 1, rollInvert: false }, // content: Light/Medium/Full picker filter (C9); haptics + chosen voice (RUN9 C7/C6b); Boo Roll input tuning (RUN10 P7)
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

// ---- fail-safe loader (RUN8 v2 C1.3) ----------------------------------------
// Law: a parse/migrate failure must NEVER silently start fresh and then autosave
// over recoverable data. Instead we (a) keep the raw bytes under a rolling rescue
// key, (b) try the newest on-device IndexedDB snapshot, and only (c) fall back to a
// calm grown-ups restore screen — never overwriting the key. boot() drives this via
// loadOrRescue(); load() stays a synchronous best-effort used by tests and helpers.
export const RESCUE_PREFIX = 'bootown.rescue.';
const MAX_RESCUE = 3;
const FRESH_WINDOW_MS = 48 * 60 * 60 * 1000;   // "created under 48h old"

function rescueKeys() {
  try { return Object.keys(localStorage).filter(k => k.startsWith(RESCUE_PREFIX)).sort(); } catch { return []; }
}
// Preserve a raw save string, keeping only the newest MAX_RESCUE copies.
export function stashRescue(raw) {
  if (typeof raw !== 'string') return;
  try {
    localStorage.setItem(RESCUE_PREFIX + Date.now(), raw);
    const keys = rescueKeys();
    while (keys.length > MAX_RESCUE) { try { localStorage.removeItem(keys.shift()); } catch {} }
  } catch {}
}
export function clearRescue() { for (const k of rescueKeys()) { try { localStorage.removeItem(k); } catch {} } }
export function hasRescue() { return rescueKeys().length > 0; }

// A save that looks brand-new: no stars AND created within the last 48h (or unset).
function looksFresh(s) {
  const total = (s && s.stars && s.stars.total) || 0;
  const created = (s && s.created) || 0;
  return total === 0 && (Date.now() - created) < FRESH_WINDOW_MS;
}
// Migrate a stashed raw JSON string (rescue copy) into a state object, or null.
function stateFromRaw(raw) {
  if (typeof raw !== 'string') return null;
  try { const o = JSON.parse(raw); if (!o || typeof o !== 'object') return null; return migrate(o); } catch { return null; }
}
function newestRescueState() {
  const keys = rescueKeys();
  for (let i = keys.length - 1; i >= 0; i--) {
    let raw = null; try { raw = localStorage.getItem(keys[i]); } catch {}
    const s = stateFromRaw(raw);
    if (s) return s;
  }
  return null;
}
// Migrate a backup CODE (BOO1.<b64>) into a state object, or null.
function stateFromCode(code) {
  if (typeof code !== 'string' || !code.startsWith(BACKUP_PREFIX)) return null;
  try {
    const o = JSON.parse(b64decode(code.slice(BACKUP_PREFIX.length)));
    if (!o || typeof o !== 'object' || !('inventory' in o)) return null;
    return migrate(o);
  } catch { return null; }
}
// Newest usable IndexedDB rolling snapshot as a migrated state object, or null.
async function newestSnapshotState() {
  if (!idbAvailable()) return null;
  try {
    const all = (await idbGetAll('backups')) || [];
    all.sort((a, b) => (b.at || 0) - (a.at || 0));
    for (const snap of all) { const s = stateFromCode(snap && snap.code); if (s) return s; }
  } catch {}
  return null;
}

// Synchronous best-effort load (tests + helpers). On corruption it preserves the raw
// bytes as a rescue copy and returns null WITHOUT wiping the key — never silent-fresh.
export function load() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { raw = null; }
  if (!raw) { state = null; return null; }
  try {
    state = migrate(JSON.parse(raw));
    return state;
  } catch (e) {
    console.warn('[state] corrupt save; preserved for rescue', e);
    stashRescue(raw);
    state = null;
    return null;
  }
}

// The boot loader. Returns { status, state? }:
//   'ok'                – healthy save loaded
//   'empty'             – genuinely no save (→ onboarding)
//   'restored-snapshot' – recovered from an IndexedDB day-snapshot (show banner)
//   'restored-rescue'   – recovered from a preserved rescue copy (show banner)
//   'rescue-needed'     – nothing recoverable; show calm restore screen, DO NOT autosave
export async function loadOrRescue() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { raw = null; }

  if (!raw) {
    // localStorage empty: a fresh device, or one whose storage was cleared. Prefer an
    // on-device snapshot (IndexedDB lives in a separate bucket that can outlive a
    // localStorage clear) before assuming a brand-new player.
    const snap = await newestSnapshotState();
    if (snap && !looksFresh(snap)) { state = snap; commit(); clearRescue(); return { status: 'restored-snapshot', state }; }
    const rescued = newestRescueState();
    if (rescued && !looksFresh(rescued)) { state = rescued; commit(); clearRescue(); return { status: 'restored-rescue', state }; }
    state = null;
    return { status: 'empty' };
  }

  let parsed = null, threw = false;
  try { parsed = JSON.parse(raw); state = migrate(parsed); }
  catch (e) { threw = true; console.warn('[state] corrupt save; entering rescue', e); }

  if (threw) {
    stashRescue(raw);                                  // (a) preserve the raw bytes
    const snap = await newestSnapshotState();           // (b) newest IndexedDB snapshot
    if (snap) { state = snap; commit(); clearRescue(); return { status: 'restored-snapshot', state }; }
    const rescued = newestRescueState();                // an older rescue copy may still parse
    if (rescued) { state = rescued; commit(); return { status: 'restored-rescue', state }; }
    state = null;                                       // (c) calm screen; never autosave over the key
    return { status: 'rescue-needed' };
  }

  // Parsed cleanly. Fresh-save resurrection: if this save looks brand-new yet a rescue
  // copy or snapshot with real progress exists, a prior wipe/fresh-start slipped through —
  // restore the real progress and clear the rescue trail.
  if (looksFresh(state)) {
    const rescued = newestRescueState();
    if (rescued && !looksFresh(rescued)) { state = rescued; commit(); clearRescue(); return { status: 'restored-rescue', state }; }
    const snap = await newestSnapshotState();
    if (snap && !looksFresh(snap)) { state = snap; commit(); clearRescue(); return { status: 'restored-snapshot', state }; }
  } else if (hasRescue()) {
    clearRescue();   // healthy real save — drop any stale rescue copies
  }
  return { status: 'ok', state };
}

// Ensure a loaded object has every current field (forward-compatible defaults),
// plus shape transforms for older schema versions. Shape-detected so it is safe to
// re-run and robust to partial states. Old saves migrate losslessly.
export function migrate(obj) {
  const o = obj || {};
  // v1 giraffe guide { body, patch, acc, name } -> v3 guide object.
  if (o.guide && !o.guide.species) o.guide = migrateGuideShape(o.guide);
  // Town grid { plot, item } -> scrolling-world { zone, x, item } (Meadow, in order).
  if (Array.isArray(o.town) && o.town.some(t => t && t.plot !== undefined && t.zone === undefined)) {
    o.town = migrateTown(o.town);
  }
  // v6 (RUN10 P1): town becomes area-scoped. save.town.areas = {areaKey:{items:[],paths:[]}}.
  // Legacy flat placements [{zone,x,item,row}] (v3-5) map 1:1 by old zone key (meadow/riverside/
  // hilltop/beach/funfair only — those are the only keys the old ZONES list ever produced); x is
  // rescaled from the old 1.7-viewport zone width to the new 4-viewport area width so an item keeps
  // roughly its old ABSOLUTE position (an item near the old zone's left edge stays near the new
  // area's left edge) instead of stretching to fill the wider space. Depth row is preserved (defaults
  // to the middle row if absent, matching the old RUN5 C3 backfill). playground/boohouse/gallery have
  // no legacy zone key, so they start empty (their first-run empty-state is a render-time guide line,
  // not placed data).
  if (Array.isArray(o.town)) {
    const OLD_ZONE_W = 1.7, NEW_AREA_W = 4;   // historical constant, RUN5 C3 zone width
    const ratio = OLD_ZONE_W / NEW_AREA_W;
    const areas = {};
    for (const key of ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery']) areas[key] = { items: [], paths: [] };
    o.town.forEach((t, i) => {
      if (!t || !t.item) return;
      const zone = areas[t.zone] ? t.zone : 'meadow';
      const x = Math.max(0, Math.min(1, +((typeof t.x === 'number' ? t.x : 0) * ratio).toFixed(3)));
      const row = t.row == null ? (i % 3) : t.row;
      areas[zone].items.push({ zone, x, row, item: t.item });
    });
    o.town = { areas };
  }
  const base = freshSave();
  const merged = deepDefaults(o, base);
  // v8 (RUN10 P13): preserve every old single accessory by placing it into its
  // authored slot. The two glasses are clearly face items; the other legacy ten
  // keep the brief's default hat slot.
  if (merged.equips && typeof merged.equips === 'object') {
    for (const [booId, worn] of Object.entries(merged.equips)) {
      if (typeof worn !== 'string') continue;
      const slot = worn === 'acc_shades' || worn === 'acc_heartglasses' ? 'face' : 'hat';
      merged.equips[booId] = { [slot]: worn };
    }
  }
  // v5 (RUN4 C8): existing players get one welcome chest, and chest boundaries are
  // measured from their total at migration — no back-pay for stars earned before.
  if ((o.version || 0) < 5) {
    merged.chest = { anchor: (merged.stars && merged.stars.total) || 0, opened: 0, welcome: true };
  }
  // v6 area-scoping (above) guarantees merged.town.areas has all 8 area keys, each with
  // {items:[],paths:[]} — deepDefaults alone can't add object keys it doesn't know about,
  // so backfill any area key a pre-v6 or hand-edited save is missing.
  if (merged.town && typeof merged.town === 'object') {
    if (!merged.town.areas || typeof merged.town.areas !== 'object') merged.town.areas = {};
    for (const key of ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery']) {
      const a = merged.town.areas[key];
      if (!a || typeof a !== 'object') merged.town.areas[key] = { items: [], paths: [] };
      else { if (!Array.isArray(a.items)) a.items = []; if (!Array.isArray(a.paths)) a.paths = []; }
    }
  }
  merged.version = VERSION;
  return merged;
}

// Old 6x4 grid placements spread across the Meadow, keeping their order.
function migrateTown(town) {
  const items = town.filter(t => t && t.item).sort((a, b) => (a.plot || 0) - (b.plot || 0));
  const n = items.length || 1;
  return items.map((t, i) => ({ zone: 'meadow', x: +(0.08 + (i + 0.5) / n * 0.84).toFixed(3), item: t.item }));
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
  saveTimer = setTimeout(commit, 2000);
}

// ---- mistake ledger (RUN3 C2) ------------------------------------------------
// Every question identity (a fact key like 'tmul7:8', a word, a twin set) keeps
// { rights, misses, lastSeen }. Mastered = rights >= 3 AND rights - misses >= 2.
const MASTER_RIGHTS = 3, MASTER_MARGIN = 2;

export function recordResult(id, correct) {
  if (!state || !id) return;
  if (!state.ledger) state.ledger = {};
  const e = state.ledger[id] || { rights: 0, misses: 0, lastSeen: 0 };
  if (correct) e.rights++; else e.misses++;
  e.lastSeen = Date.now();
  state.ledger[id] = e;
  if (roundTally) roundTally.add(id);
  scheduleSave();
}

// ---- round tally (RUN4 C3) ----------------------------------------------------
// The game shell opens a tally at round start; every recorded item lands in it;
// the results screen takes it to judge a "mastered round" (>=80% items mastered).
let roundTally = null;
export function beginRoundTally() { roundTally = new Set(); }
export function takeRoundTally() { const t = roundTally; roundTally = null; return t ? [...t] : []; }
// Local-day key (YYYY-MM-DD) for once-per-day features (Golden double, daily quests).
// window.__bootownDay overrides for tests (matches the __bootownHour/Month pattern).
export function todayKey() {
  if (typeof window !== 'undefined' && window.__bootownDay) return String(window.__bootownDay);
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ledgerEntry(id) { return (state && state.ledger && state.ledger[id]) || { rights: 0, misses: 0, lastSeen: 0 }; }
export function isMastered(id) { const e = ledgerEntry(id); return e.rights >= MASTER_RIGHTS && (e.rights - e.misses) >= MASTER_MARGIN; }
// weak = has been missed more than got right (recent trouble); mastered as above; else middle.
export function ledgerClass(id) {
  const e = ledgerEntry(id);
  if (e.misses > e.rights && (e.rights + e.misses) > 0) return 'weak';
  if (e.rights >= MASTER_RIGHTS && (e.rights - e.misses) >= MASTER_MARGIN) return 'mastered';
  return 'middle';
}

// Guarded saves (RUN5 C0b): a listener fired when a write fails, so the app can warn
// a grown-up once and keep playing from memory (storage full or blocked).
let saveErrorCb = null;
export function onSaveError(cb) { saveErrorCb = cb; }

// Write immediately.
export function commit() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!state) return;
  state.lastPlayed = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[state] save failed', e);
    if (saveErrorCb) { try { saveErrorCb(e); } catch {} }   // keep playing from memory
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

// Restore from arbitrary pasted/read text: a BOO1 code, a .boo envelope, or a raw
// save object. Returns { ok:true } or { ok:false, error }. Migrates + commits on success.
export function importAny(text) {
  if (typeof text !== 'string') return { ok: false, error: 'There was nothing to read.' };
  const t = text.trim();
  if (!t) return { ok: false, error: 'There was nothing to read.' };
  if (t.startsWith(BACKUP_PREFIX)) return importCode(t);
  let obj;
  try { obj = JSON.parse(t); } catch { return { ok: false, error: 'That backup is damaged or not a Boo Town file.' }; }
  const save = obj && typeof obj.save === 'object' && obj.save ? obj.save : obj;   // .boo envelope OR a raw save
  if (!save || typeof save !== 'object' || !('inventory' in save)) return { ok: false, error: 'That file is not a Boo Town backup.' };
  state = migrate(save);
  commit();
  return { ok: true };
}

export function resetAll() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  clearRescue();   // a deliberate reset must not be silently resurrected from a rescue copy
  state = null;
}

// UTF-8 safe base64.
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(b64) {
  return decodeURIComponent(escape(atob(b64)));
}
