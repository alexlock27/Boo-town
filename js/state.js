// js/state.js — the single source of truth for the save (spec §11.2).
// One localStorage key. Debounced autosave. Persistent-storage request.
// Backup codes = base64 of the JSON with a BOO1. prefix.

// Key stays 'bootown.save.v1' (the localStorage slot name) so tablets keep their save;
// the schema version lives in the `version` field and migrates forward.
export const SAVE_KEY = 'bootown.save.v1';
export const VERSION = 5;   // v5 (RUN4): comfort levels + Brave claims, medal counters, trophies, town growth, shinies, the Star Chest, daily delights. Lossless via deepDefaults; chest anchor set in migrate().
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
    opened: 0,
    pity: { commons: 0 },       // consecutive Common opens, for the pity rule
    inventory: {},              // itemId -> count
    town: [],                   // [{ zone, x, item }] (v3); old [{ plot, item }] migrated in phase 3
    nicknames: {},              // itemId -> nickname (owned Boos)
    equips: {},                 // Boo itemId -> accessory itemId
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
    shinies: {},                // itemId -> shiny copy count within the owned stack (RUN4 C8)
    shinyDrops: 0,              // Boo drops since the last shiny (the hidden mercy counter, C8)
    chest: { anchor: 0, opened: 0, welcome: false },  // Star Chest boundaries (RUN4 C8)
    delights: {},               // daily-delight flags: hide-and-seek / Boo of the Day (RUN4 C9)
    seen: {},                   // one-time flags (game intros, town first, etc.)
    settings: { sound: true, music: true, voice: true, mic: true, requests: true, content: 'light' }, // content: Light/Medium/Full picker filter (C9), default Light
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
  // Town grid { plot, item } -> scrolling-world { zone, x, item } (Meadow, in order).
  if (Array.isArray(o.town) && o.town.some(t => t && t.plot !== undefined && t.zone === undefined)) {
    o.town = migrateTown(o.town);
  }
  const base = freshSave();
  const merged = deepDefaults(o, base);
  // v5 (RUN4 C8): existing players get one welcome chest, and chest boundaries are
  // measured from their total at migration — no back-pay for stars earned before.
  if ((o.version || 0) < 5) {
    merged.chest = { anchor: (merged.stars && merged.stars.total) || 0, opened: 0, welcome: true };
  }
  // RUN5 C3: town gains three depth rows. Existing placements keep their x (a zone
  // fraction — they spread proportionally into the now-wider zones), and get a depth
  // row spread across the three so nothing piles. Nothing is lost.
  if (Array.isArray(merged.town)) merged.town.forEach((t, i) => { if (t && typeof t === 'object' && t.row == null) t.row = i % 3; });
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
  saveTimer = setTimeout(commit, 400);
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
