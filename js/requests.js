// js/requests.js — occasional Boo requests (RUN3 C8).
// At most one active at a time. A new one may only appear at app open, at least 20 hours
// after the last resolved. A thought bubble over one placed Boo asks something small from
// the installed feature set. Fulfilling gives +2 meter + a treat. Unfulfilled requests
// expire silently after 48 hours — no message, no sad face. Off switch in the grown-ups corner.

import { getState, mutate } from './state.js';
import { addMeterPoints } from './rewards.js';

const HOUR = 3600 * 1000;
export const RECHARGE_MS = 20 * HOUR;   // ≥20h after the last resolved
export const EXPIRE_MS = 48 * HOUR;     // expire silently after 48h
export const REQUEST_REWARD = 2;        // +2 meter on fulfilment

// window.__bootownNow (ms) overrides the clock for tests.
export function nowMs() { return (typeof window !== 'undefined' && window.__bootownNow != null) ? window.__bootownNow : Date.now(); }

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

export function requestsEnabled() { const s = getState(); return !s || !s.settings || s.settings.requests !== false; }
export function activeRequest() { const s = getState(); return (s && s.request && s.request.active) || null; }

// Called at app open (hub / town mount): expire an old one, then maybe create a new one.
export function checkRequestOpen(placedBooIds) {
  expireIfDue();
  maybeCreate(placedBooIds);
  return activeRequest();
}
function expireIfDue() {
  const s = getState(); const a = s && s.request && s.request.active;
  if (a && nowMs() - a.createdAt >= EXPIRE_MS) {
    mutate(st => { st.request.active = null; st.request.lastResolvedAt = nowMs(); });   // silent
  }
}
function maybeCreate(placedBooIds) {
  if (!requestsEnabled()) return;
  const s = getState();
  if (s.request.active) return;                                   // one active at a time
  if (nowMs() - (s.request.lastResolvedAt || 0) < RECHARGE_MS) return;   // ≥20h since last resolved
  const boos = (placedBooIds && placedBooIds.length) ? placedBooIds : [];
  if (!boos.length) return;                                       // need a placed Boo to ask
  const tmpl = REQUEST_TEMPLATES[(Math.random() * REQUEST_TEMPLATES.length) | 0];
  const booId = boos[(Math.random() * boos.length) | 0];
  mutate(st => { st.request.active = { id: tmpl.id, booId, text: tmpl.text, createdAt: nowMs() }; });
}

// Feed an event; if it fulfils the active request, reward +2 meter and clear it.
// Returns { fulfilled, booId } so the town can play a treat animation.
export function noteRequest(event, data = {}) {
  const a = activeRequest();
  if (!a) return { fulfilled: false };
  const tmpl = TEMPLATE_BY_ID[a.id];
  if (tmpl && tmpl.match(event, data)) {
    const booId = a.booId;
    addMeterPoints(REQUEST_REWARD);
    mutate(st => { st.request.active = null; st.request.lastResolvedAt = nowMs(); st.request.treatFor = booId; });
    return { fulfilled: true, booId };
  }
  return { fulfilled: false };
}

// The town pops a treat over the Boo that was just thanked, then clears the flag.
export function takeTreat() { const s = getState(); const b = s && s.request && s.request.treatFor; if (b) mutate(st => { st.request.treatFor = null; }); return b || null; }

export function setRequestsEnabled(on) { mutate(st => { st.settings.requests = !!on; if (!on) st.request.active = null; }); }
