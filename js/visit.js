// js/visit.js — RUN21F F6: "Visit a Town" (completes RUN21A item 11).
//
// RUN21A made the ✈️ share an honest 💌 Town Postcard: the LOOK of a town — placements,
// paths, applied room dressings, and each placed Boo's worn accessories and shininess —
// and nothing else. No name, no age, no ledger, no settings, no care, no nicknames. This
// file is the other half: the screen that OPENS one.
//
// Three promises hold the whole feature up, and they are all enforced here or in state.js:
//   1. Nothing is written. state.js's beginVisit() holds her own save object aside and
//      makes mutate/scheduleSave/commit inert for the life of the visit, so no code path in
//      the app — not a drag, not an autosave, not the pagehide flush — can reach
//      localStorage while a friend's town is on screen.
//   2. Nothing is trusted. A postcard is text a grown-up pasted from somewhere else, so
//      every field is re-typed and re-clamped below and every id must match ID_RE before it
//      is allowed anywhere near the renderer. An id the catalogue does not know renders
//      nothing (town.js: `if (!item) continue;`).
//   3. Nothing is invented. The postcard carries no names, so a visited town uses the
//      catalogue's official names (the snapshot's `nicknames` is empty, which is exactly
//      what getDisplayName falls back to). It carries no stars either, so every area on the
//      friend's map is opened rather than guessed at — see VISIT_STARS.
import { el } from './ui.js';
import { getState, migrate, beginVisit, endVisit, isVisiting } from './state.js';
import { AREA_UNLOCK_STARS, HOUSE_ROOM_KEYS } from './areas.js';
import { BY_ID } from '../data/catalogue.js';

export const POSTCARD_PREFIX = 'BTPC1.';
// Authored, verbatim (RUN21F F6).
export const WRONG_CODE_LINE = 'That looks like a backup code — Visit needs a Town Postcard.';
export const BANNER_LINE = "You're visiting a friend's town ✈️ Look, don't touch!";
export const LEAVE_LABEL = 'Leave';
// Kept in the same voice as js/state.js's own restore errors, which is where a grown-up
// will have just been told this is "a Town Postcard for visiting, not a backup".
const EMPTY_LINE = 'There was nothing to read.';
const DAMAGED_LINE = 'That postcard is damaged or incomplete.';

// Every area key the save knows about (the world map's eight, plus the Boo House's two
// extra room stores). Anything else in a postcard is dropped on the floor.
const AREA_KEYS = [...Object.keys(AREA_UNLOCK_STARS), ...HOUSE_ROOM_KEYS.filter(k => !(k in AREA_UNLOCK_STARS))];
// Ids are catalogue keys, wish ids ('wish_sun'), custom ids ('custom:ab12') and dressing
// ids. Nothing outside this shape can be a real id, so nothing outside it gets in.
const ID_RE = /^[A-Za-z0-9_:.-]{1,64}$/;
const MAX_ITEMS = 64;      // AREA_CAP is 24; this is a hostile-input ceiling, not a rule
const MAX_PATHS = 300;     // = PATH_CAP
const MAX_ROSTER = 64;
// Enough stars that every area on the friend's map is open. The postcard deliberately does
// not carry her stars (they are progress, not scenery), and a town with placements in it
// plainly had those areas open — so opening them all is the honest reading, and locking one
// would hide placements the ACCEPT says must render.
const VISIT_STARS = Math.max(...Object.values(AREA_UNLOCK_STARS));

const num = (v, lo, hi, dflt) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt);
const id = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : null);

// ---- reading the code -------------------------------------------------------------------
// Returns { ok:true, postcard } or { ok:false, error }. Never throws, never touches state.
export function readPostcard(text) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return { ok: false, error: EMPTY_LINE };
  if (!t.startsWith(POSTCARD_PREFIX)) return { ok: false, error: WRONG_CODE_LINE };
  let pc;
  // The exact inverse of worldmap.js's `btoa(encodeURIComponent(JSON.stringify(postcard)))`
  // — encodeURIComponent, not state.js's `unescape(encodeURIComponent(...))` backup pair.
  try { pc = JSON.parse(decodeURIComponent(atob(t.slice(POSTCARD_PREFIX.length)))); }
  catch { return { ok: false, error: DAMAGED_LINE }; }
  if (!pc || typeof pc !== 'object' || pc.format !== 'BOO_TOWN_POSTCARD') return { ok: false, error: DAMAGED_LINE };
  if (!pc.areas || typeof pc.areas !== 'object') return { ok: false, error: DAMAGED_LINE };
  return { ok: true, postcard: pc };
}

// ---- the in-memory town -----------------------------------------------------------------
function cleanItems(list, areaKey) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = id(raw.item);
    if (!item) continue;
    const t = { zone: areaKey, x: num(raw.x, 0, 1, 0.5), row: num(raw.row, 0, 3, 1) | 0, item };
    const scale = num(raw.scale, 0.5, 2.5, null); if (scale != null) t.scale = scale;
    const plane = typeof raw.plane === 'string' && ['floor', 'wall', 'surface', 'sky'].includes(raw.plane) ? raw.plane : null;
    if (plane) t.plane = plane;
    const y = num(raw.y, 0, 1, null); if (y != null) t.y = y;
    // A surface child names its parent by the parent's own placement key ("zone:x:item").
    // Re-keyed onto this area's key so a hand-edited postcard cannot point at another area.
    if (typeof raw.parent === 'string' && raw.parent.length <= 96) {
      const bits = raw.parent.split(':');
      const px = Number(bits[1]), pid = id(bits.slice(2).join(':'));
      if (Number.isFinite(px) && pid) t.parent = `${areaKey}:${px}:${pid}`;
    }
    const slot = id(raw.slot); if (slot) t.slot = slot;
    const portrait = id(raw.portraitBoo); if (portrait) t.portraitBoo = portrait;
    out.push(t);
  }
  return out;
}
function cleanPaths(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const c of list.slice(0, MAX_PATHS)) {
    if (!c || typeof c !== 'object') continue;
    const style = id(c.style);
    if (!style || !Number.isFinite(c.cx) || !Number.isFinite(c.cy)) continue;
    out.push({ cx: c.cx | 0, cy: c.cy | 0, style });
  }
  return out;
}
function cleanDressings(d) {
  const out = {};
  if (!d || typeof d !== 'object') return out;
  for (const [room, sel] of Object.entries(d)) {
    if (!id(room) || !sel || typeof sel !== 'object') continue;
    const room2 = {};
    for (const slot of ['walls', 'floors']) { const v = id(sel[slot]); if (v) room2[slot] = v; }
    if (Object.keys(room2).length) out[room] = room2;
  }
  return out;
}
// Which equip slot a worn id belongs in. A costume set writes `set:<setId>:<art>` into each
// of its authored slots, so the slot is recovered from the set's own `pieces` table rather
// than guessed. Anything unrecognised is dropped — the visited Boo simply wears less.
function slotForWorn(worn) {
  const m = /^set:(acc_set_[^:]+):(.+)$/.exec(worn);
  if (m) {
    const set = BY_ID[m[1]];
    if (!set || !set.pieces) return null;
    return Object.keys(set.pieces).find(k => set.pieces[k] === m[2]) || null;
  }
  const it = BY_ID[worn];
  return it && it.kind === 'accessory' && it.slot && it.slot !== 'set' ? it.slot : null;
}

// Build the whole in-memory save the visit runs on. `own` is HER save, used for one thing
// only: her device's own settings (mutes, calm motion, bigger text) must keep applying while
// she looks at somebody else's town. Nothing else of hers is carried in, and nothing at all
// is carried back out.
export function snapshotFromPostcard(pc, own = getState()) {
  const st = migrate({});   // a complete, current-shape save with nothing in it
  const areas = {};
  for (const key of AREA_KEYS) areas[key] = { items: [], paths: [] };
  for (const [key, a] of Object.entries(pc.areas || {})) {
    if (!AREA_KEYS.includes(key) || !a || typeof a !== 'object') continue;
    areas[key] = { items: cleanItems(a.items, key), paths: cleanPaths(a.paths) };
  }
  st.town = { areas };
  st.dressings = cleanDressings(pc.dressings);
  st.nicknames = {};        // a postcard carries no names: the catalogue's own names show
  st.name = '';
  st.ageAsked = true;
  st.stars.total = VISIT_STARS;
  // The Carousel is day one on EVERY save (funfair.js FUNFAIR_UNLOCK = 0), so a visited fair
  // has one. The other four ride on stars the postcard does not carry, so they are not
  // guessed at — the fair shows what is certainly there and no more.
  st.funfair = { built: ['carousel'], build: null, pending: [], seats: {}, catchup: [] };
  // The seeded landmarks (rug, lamp, wish well, joke stage) belong to HER town's first
  // visit, not to a photograph of somebody else's. Marked seen so no seeding path can fire.
  st.seen = { boohouseSeeded: true, wishWellSeeded: true, jokeStageSeeded: true, townFirst: true };
  if (own && own.settings) st.settings = JSON.parse(JSON.stringify(own.settings));
  const roster = Array.isArray(pc.roster) ? pc.roster.slice(0, MAX_ROSTER) : [];
  for (const r of roster) {
    if (!r || typeof r !== 'object') continue;
    const bid = id(r.id);
    if (!bid) continue;
    st.inventory[bid] = 1;
    if (r.shiny) st.shinies[bid] = 1;
    const worn = {};
    for (const a of (Array.isArray(r.acc) ? r.acc.slice(0, 6) : [])) {
      const accId = id(a);
      const slot = accId && slotForWorn(accId);
      if (slot) worn[slot] = accId;
    }
    if (Object.keys(worn).length) st.equips[bid] = worn;
  }
  return st;
}

// ---- the banner -------------------------------------------------------------------------
// Lives on <body>, OUTSIDE #screen, so it survives every navigation the visit can make
// (world map ↔ area ↔ room) without each screen having to draw it. `body.visiting` is what
// makes room for it — see css/styles.css.
let bannerEl = null;
let bannerResize = null;
// The banner's own height, published to the stylesheet so `.screen-root` starts exactly
// below it. It is measured rather than hard-coded because the line WRAPS on a phone (the
// authored sentence must never be cut off) and because "Bigger text" zooms the whole page:
// either can change the height, and a magic number in the CSS would then either overlap the
// screen's header or leave a stripe of nothing.
function syncBannerHeight() {
  if (!bannerEl) return;
  document.documentElement.style.setProperty('--visit-banner-h', Math.ceil(bannerEl.getBoundingClientRect().height) + 'px');
}
function showBanner(ctx) {
  if (bannerEl) return bannerEl;
  const leave = el('button', {
    class: 'btn soft visit-leave', type: 'button', text: LEAVE_LABEL, 'aria-label': LEAVE_LABEL,
    onclick: () => { if (ctx && ctx.go) ctx.go('grownups'); else leaveVisit(); }
  });
  bannerEl = el('div', { class: 'visit-banner', role: 'status' }, [
    el('span', { class: 'visit-banner-line', text: BANNER_LINE }),
    leave
  ]);
  document.body.appendChild(bannerEl);
  document.body.classList.add('visiting');
  syncBannerHeight();
  requestAnimationFrame(syncBannerHeight);   // …and again once the font has settled
  bannerResize = () => syncBannerHeight();
  window.addEventListener('resize', bannerResize);
  return bannerEl;
}
function hideBanner() {
  if (bannerResize) { window.removeEventListener('resize', bannerResize); bannerResize = null; }
  if (bannerEl) { try { bannerEl.remove(); } catch {} bannerEl = null; }
  document.body.classList.remove('visiting');
  document.documentElement.style.removeProperty('--visit-banner-h');
}
export function visitBanner() { return bannerEl; }

// ---- opening and closing a visit --------------------------------------------------------
// Returns { ok:true } or { ok:false, error }. On success the app is already looking at the
// friend's world map, with `ctx.readonly` true from here until leaveVisit().
export function startVisit(text, ctx) {
  const r = readPostcard(text);
  if (!r.ok) return r;
  let snap;
  try { snap = snapshotFromPostcard(r.postcard); }
  catch { return { ok: false, error: DAMAGED_LINE }; }
  if (!beginVisit(snap)) return { ok: false, error: DAMAGED_LINE };
  showBanner(ctx);
  if (ctx && ctx.go) ctx.go('worldmap');
  return { ok: true };
}
// The one way out. Called by the Leave button (via the router) and by the router itself for
// ANY navigation that is not town/worldmap, so a visit can never leak into a game or the
// hub — including through the phone's back gesture.
export function leaveVisit() {
  if (!isVisiting()) { hideBanner(); return false; }
  endVisit();
  hideBanner();
  return true;
}
