// js/requests.js — occasional Boo requests (RUN3 C8, rebuilt by RUN19 Z2 "turn up the pulse").
//
// RUN3 shipped ONE request at a time, at least 20 hours apart, matched against a generic
// EVENT (a round ending, a box opening). Z2 keeps those six templates and adds five
// AUTHORED VERBS that each name a SPECIFIC item or a SPECIFIC other Boo at creation time —
// sit / wear / visit / dance / try. That is a different shape, so the save now holds an
// ARRAY of up to MAX_ACTIVE requests (v21 migration in state.js) instead of one object.
//
// Rules that bind (Z2 + its addendum):
//   · RECHARGE_MS = 3h since the last resolved; created at app open AND at area entry.
//   · MAX_ACTIVE = 2 overall, and never more than ONE per Boo.
//   · If the wanted item is removed or the friend put away, the request fades IMMEDIATELY
//     and SILENTLY — no message, no sad face (house law: nothing punishes, nothing is lost).
//   · Unfulfilled requests still expire blamelessly after EXPIRE_MS.
//   · Fulfilment always plays: double bounce → "Thank you!" → +2 meter → treat chime.
// Off switch stays in the grown-ups corner.

import { getState, mutate } from './state.js';
import { addMeterPoints } from './rewards.js';
import { SOCKETS } from '../data/sockets.js';
import { BY_ID } from '../data/catalogue.js';

const HOUR = 3600 * 1000;
export const RECHARGE_MS = 3 * HOUR;    // Z2: was 20h — the pulse the town was missing
export const EXPIRE_MS = 48 * HOUR;     // expire silently after 48h (unchanged)
export const REQUEST_REWARD = 2;        // +2 meter on fulfilment (unchanged)
export const MAX_ACTIVE = 2;            // Z2: two at once, at most one per Boo
export const VISIT_NEAR_X = 0.15;       // "neighbours" = within 15% of the area's x, any row
export const TRY_FRESH_MS = 24 * HOUR;  // "the new «item»" = placed within the last day

// window.__bootownNow (ms) overrides the clock for tests.
export function nowMs() { return (typeof window !== 'undefined' && window.__bootownNow != null) ? window.__bootownNow : Date.now(); }

const isBooItem = (id) => !!id && (id.startsWith('boo_') || id.startsWith('custom:'));

// ---- RUN3 C8's generic event templates (kept exactly as they were) ------------------
const MATHS = ['bubblepop', 'feedboos', 'blocks', 'bounce', 'beat', 'dash'];
export const REQUEST_TEMPLATES = [
  { id: 'spell2', text: 'I\'d love 2 stars in a spelling round!', match: (e, d) => e === 'roundEnd' && d.game === 'spellboo' && d.stars >= 2 },
  { id: 'maths', text: 'Will you play a maths game for me?', match: (e, d) => e === 'roundEnd' && MATHS.includes(d.game) },
  { id: 'threeStar', text: 'I bet you can get 3 stars!', match: (e, d) => e === 'roundEnd' && d.stars >= 3 },
  { id: 'paint', text: 'Someone should paint a picture!', match: (e) => e === 'artwork' },
  { id: 'dressUp', text: 'Could you dress up a Boo?', match: (e) => e === 'dressUp' },
  { id: 'box', text: 'Ooh, open a mystery box!', match: (e) => e === 'boxOpen' }
];
const TEMPLATE_BY_ID = Object.fromEntries(REQUEST_TEMPLATES.map(t => [t.id, t]));

// ---- Z2's five verbs ----------------------------------------------------------------
// Each names the guideLines key that carries its authored line, which system fulfils it,
// and how the request card behaves (Z2 addendum): 'jump' verbs cross a screen, 'glow'
// verbs pulse their target in this area, 'none' just says what to do.
export const REQUEST_VERBS = [
  { kind: 'sit',   line: 'request_sit',   card: 'glow' },
  { kind: 'wear',  line: 'request_wear',  card: 'jump' },
  { kind: 'visit', line: 'request_visit', card: 'none' },
  { kind: 'dance', line: 'request_dance', card: 'glow' },
  { kind: 'try',   line: 'request_try',   card: 'glow' }
];
export const VERB_BY_KIND = Object.fromEntries(REQUEST_VERBS.map(v => [v.kind, v]));

export function requestsEnabled() { const s = getState(); return !s || !s.settings || s.settings.requests !== false; }

// The live list. Everything below reads through here so a pre-v21 save (whose migration
// has already folded `active` into `actives`) and a fresh one behave identically.
export function activeRequests() {
  const s = getState();
  const a = s && s.request && s.request.actives;
  return Array.isArray(a) ? a : [];
}
// RUN3's single-request accessor, kept for every existing caller: the first active one.
export function activeRequest() { return activeRequests()[0] || null; }
export function requestFor(booId) { return activeRequests().find(r => r.booId === booId) || null; }

// ---- pure eligibility helpers (exported for the suite; no state, no DOM) -------------
// `ctx` = { areaKey, items, placedBooIds, ownedAccIds, wornAccIds, allPlaced, now }.
export function eligibleVerbs(ctx) {
  return REQUEST_VERBS.filter(v => candidatesFor(v.kind, ctx).length > 0).map(v => v.kind);
}
// Every legal (requester, target) pairing for a verb, given the context. Ordered, so a
// caller that wants determinism can take [0]; maybeCreate picks at random.
export function candidatesFor(kind, ctx) {
  const boos = (ctx.placedBooIds || []);
  const out = [];
  if (!boos.length) return out;
  if (kind === 'sit') {
    // A socketed item in THIS area. At area entry no actor has claimed anything yet, so
    // "has a free socket" is true of any socketed item present — which is why this check
    // is honest rather than a guess at live occupancy.
    for (const t of (ctx.items || [])) {
      if (!SOCKETS[t.item] || !SOCKETS[t.item].length) continue;
      for (const b of boos) out.push({ booId: b, itemId: t.item, itemX: t.x });
    }
  } else if (kind === 'wear') {
    for (const acc of (ctx.ownedAccIds || [])) {
      if ((ctx.wornAccIds || []).includes(acc)) continue;    // owned AND unworn
      for (const b of boos) out.push({ booId: b, accId: acc });
    }
  } else if (kind === 'visit') {
    // Another owned Boo placed in ANY area; fulfilment brings them together here.
    const placed = (ctx.allPlaced || []).filter(t => isBooItem(t.item));
    for (const b of boos) {
      for (const f of placed) {
        if (f.item === b) continue;
        if (f.area === ctx.areaKey && Math.abs(f.x - xOfBoo(ctx, b)) < VISIT_NEAR_X) continue;  // already neighbours
        out.push({ booId: b, targetBooId: f.item });
      }
    }
  } else if (kind === 'dance') {
    for (const b of boos) out.push({ booId: b });
  } else if (kind === 'try') {
    const now = ctx.now || 0;
    for (const t of (ctx.items || [])) {
      if (isBooItem(t.item)) continue;                       // a Boo is a friend, not a new thing
      if (!t.at || now - t.at > TRY_FRESH_MS) continue;       // "the NEW «item»"
      for (const b of boos) out.push({ booId: b, itemId: t.item, itemX: t.x });
    }
  }
  return out;
}
function xOfBoo(ctx, booId) {
  const t = (ctx.items || []).find(i => i.item === booId);
  return t ? t.x : -99;
}

// Build the creation context from the save. `areaKey` is the storage key of the area she
// is looking at (a Boo House ROOM key indoors) — null from the hub, where the five
// area-specific verbs simply have no candidates and the generic templates carry the pulse.
export function buildContext(placedBooIds, areaKey) {
  const s = getState() || {};
  const areas = (s.town && s.town.areas) || {};
  const items = (areaKey && areas[areaKey] && Array.isArray(areas[areaKey].items)) ? areas[areaKey].items : [];
  const allPlaced = [];
  for (const k of Object.keys(areas)) {
    const list = (areas[k] && areas[k].items) || [];
    for (const t of list) allPlaced.push({ ...t, area: k });
  }
  const inv = s.inventory || {};
  const ownedAccIds = Object.keys(inv).filter(id => (inv[id] || 0) > 0 && id.startsWith('acc_') && BY_ID[id]);
  const wornAccIds = [];
  for (const worn of Object.values(s.equips || {})) {
    if (!worn) continue;
    if (typeof worn === 'string') { wornAccIds.push(worn); continue; }
    for (const v of Object.values(worn)) if (typeof v === 'string') wornAccIds.push(v);
  }
  return { areaKey: areaKey || null, items, placedBooIds: placedBooIds || [], ownedAccIds, wornAccIds, allPlaced, now: nowMs() };
}

// ---- the open / area-entry trigger ---------------------------------------------------
// Called at app open (hub mount) and at AREA ENTRY (town mount) — Z2 makes both a trigger.
export function checkRequestOpen(placedBooIds, areaKey = null) {
  expireIfDue();
  pruneImpossible();
  maybeCreate(placedBooIds, areaKey);
  return activeRequest();
}

function writeActives(fn) {
  mutate(st => {
    st.request = st.request || {};
    if (!Array.isArray(st.request.actives)) st.request.actives = [];
    fn(st.request, st);
  });
}

function expireIfDue() {
  const now = nowMs();
  if (!activeRequests().some(r => now - r.createdAt >= EXPIRE_MS)) return;
  writeActives(rq => {
    rq.actives = rq.actives.filter(r => now - r.createdAt < EXPIRE_MS);
    rq.lastResolvedAt = now;                                  // silent, as it always was
  });
}

// A request whose named thing has gone fades immediately and silently (Z2 addendum).
// Kept separate from expiry so the reason is legible in the code, not just the effect.
export function pruneImpossible() {
  const live = activeRequests();
  if (!live.length) return;
  const s = getState() || {};
  const areas = (s.town && s.town.areas) || {};
  const placedIn = (area) => ((areas[area] && areas[area].items) || []);
  const anywhere = [];
  for (const k of Object.keys(areas)) for (const t of placedIn(k)) anywhere.push({ ...t, area: k });
  const stillThere = (r) => {
    if (!r.kind) return true;                                  // a RUN3 template names nothing
    if (!anywhere.some(t => t.item === r.booId)) return false;  // the asker itself was put away
    if (r.itemId) return placedIn(r.area).some(t => t.item === r.itemId && Math.abs(t.x - r.itemX) < 0.001);
    if (r.targetBooId) return anywhere.some(t => t.item === r.targetBooId);
    if (r.accId) return ((s.inventory || {})[r.accId] || 0) > 0;
    return true;
  };
  const keep = live.filter(stillThere);
  if (keep.length === live.length) return;
  writeActives(rq => { rq.actives = keep; });                   // NOT a resolve: no recharge reset
}

function maybeCreate(placedBooIds, areaKey) {
  if (!requestsEnabled()) return;
  const s = getState();
  if (!s || !s.request) return;
  const live = activeRequests();
  if (live.length >= MAX_ACTIVE) return;                        // two at once, no more
  if (nowMs() - (s.request.lastResolvedAt || 0) < RECHARGE_MS) return;
  const busy = new Set(live.map(r => r.booId));
  const boos = (placedBooIds || []).filter(id => !busy.has(id));   // one request per Boo
  if (!boos.length) return;
  const ctx = buildContext(boos, areaKey);
  // The pool is RUN3's six generic templates plus every verb that has a real target here.
  const pool = [];
  for (const t of REQUEST_TEMPLATES) pool.push({ template: t });
  for (const v of REQUEST_VERBS) {
    const cands = candidatesFor(v.kind, ctx);
    if (cands.length) pool.push({ verb: v, cands });
  }
  if (!pool.length) return;
  const pick = pool[(Math.random() * pool.length) | 0];
  const createdAt = nowMs();
  if (pick.template) {
    const booId = boos[(Math.random() * boos.length) | 0];
    writeActives(rq => { rq.actives.push({ id: pick.template.id, booId, text: pick.template.text, createdAt }); });
    return;
  }
  const c = pick.cands[(Math.random() * pick.cands.length) | 0];
  writeActives(rq => {
    rq.actives.push({
      id: pick.verb.kind, kind: pick.verb.kind, booId: c.booId,
      area: areaKey || null,
      itemId: c.itemId || null, itemX: c.itemX != null ? c.itemX : null,
      targetBooId: c.targetBooId || null, accId: c.accId || null,
      createdAt
    });
  });
}

// ---- fulfilment ----------------------------------------------------------------------
// The five verbs are matched here rather than by a `match` function on the verb, because
// each one needs to look at the SAVE (where a Boo now stands, what it is wearing) and not
// just at the event payload. Events emitted by their owning systems:
//   socketClaim {booId,itemId,area,x} · equip {booId,accId} · placement {area}
//   disco {booIds} · routine {area} · itemTap {itemId,area,x,booIds}
function verbMatches(r, event, d) {
  const s = getState() || {};
  const areas = (s.town && s.town.areas) || {};
  const itemsIn = (area) => ((areas[area] && areas[area].items) || []);
  switch (r.kind) {
    case 'sit':
      return event === 'socketClaim' && d.booId === r.booId && d.itemId === r.itemId
        && (!r.area || d.area === r.area);
    case 'wear':
      return event === 'equip' && d.booId === r.booId && d.accId === r.accId;
    case 'visit': {
      if (event !== 'placement') return false;
      // Same area, any row, within 15% x — checked against the save, so a drag that ends
      // beside the friend fulfils it whichever of the two actually moved.
      for (const k of Object.keys(areas)) {
        const list = itemsIn(k);
        const me = list.find(t => t.item === r.booId);
        const friend = list.find(t => t.item === r.targetBooId);
        if (me && friend && Math.abs(me.x - friend.x) <= VISIT_NEAR_X) return true;
      }
      return false;
    }
    case 'dance':
      // ANY visit to the Disco Hall counts — she brings everyone (Z2 addendum), so a child
      // is never asked to steer one specific Boo across town.
      if (event === 'disco') return true;
      return event === 'routine' && (!r.area || d.area === r.area);
    case 'try':
      return event === 'itemTap' && d.itemId === r.itemId && (!r.area || d.area === r.area)
        && Array.isArray(d.booIds) && d.booIds.includes(r.booId);
    default:
      return false;
  }
}

// Feed an event; every active request it fulfils is rewarded and cleared.
// Returns { fulfilled, booId, booIds } — booId is the first, for RUN3's callers.
export function noteRequest(event, data = {}) {
  const live = activeRequests();
  if (!live.length) return { fulfilled: false };
  const hit = live.filter(r => {
    if (r.kind) return verbMatches(r, event, data);
    const tmpl = TEMPLATE_BY_ID[r.id];
    return !!(tmpl && tmpl.match(event, data));
  });
  if (!hit.length) return { fulfilled: false };
  const booIds = hit.map(r => r.booId);
  addMeterPoints(REQUEST_REWARD * hit.length);
  const now = nowMs();
  writeActives(rq => {
    rq.actives = rq.actives.filter(r => !hit.includes(r));
    rq.lastResolvedAt = now;
    rq.treatFor = booIds[0];
    rq.thanking = booIds;                 // the town plays the double bounce for each
  });
  return { fulfilled: true, booId: booIds[0], booIds };
}

// The town pops a treat over the Boo that was just thanked, then clears the flag.
export function takeTreat() { const s = getState(); const b = s && s.request && s.request.treatFor; if (b) mutate(st => { st.request.treatFor = null; }); return b || null; }
// Z2: the full fulfilment ceremony needs EVERY thanked Boo, not just the first.
export function takeThanks() {
  const s = getState();
  const list = (s && s.request && s.request.thanking) || null;
  if (!list || !list.length) return [];
  mutate(st => { st.request.thanking = []; });
  return list.slice();
}

export function setRequestsEnabled(on) {
  mutate(st => {
    st.settings.requests = !!on;
    st.request = st.request || {};
    if (!on) st.request.actives = [];
  });
}
