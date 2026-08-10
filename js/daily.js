// js/daily.js — "Today in Boo Town" (RUN21J): three tiny daily doings, ticked
// automatically as she plays, and the Daily Delivery — a wrapped parcel in the
// Meadow holding one item from the curated pool she doesn't own yet.
//
// THE NO-GUILT LAW IS THE SUBJECT OF THIS FILE, not just a constraint on it.
// There are no streaks, no missed-day copy, and no reference to yesterday in any
// branch: a new device-local day simply starts fresh (roll-on-read, the same
// no-timer pattern Sprinkle and the caper clue counter use), and an unclaimed
// item was never removed from the pool in the first place, so nothing is ever
// lost, mourned or counted. Keep it that way.
//
// Hooks (one per doing, called from the seams the pack names):
//   • noteDailyPlay()        — js/results.js, the single results/win seam
//   • noteDailyVisit(area)   — js/town.js mount (any area not yet visited today)
//   • noteDailyCare()        — js/care.js complete(), any finished care action
// Each returns the L_DAILY_DONE line when THAT tick completed all three (the
// caller shows it on its own surface), else null. Completion also speaks the
// line (tts queues, never cuts) and dispatches 'bootown:dailydone' on window so
// a mounted Meadow can pop the parcel in live.

import { getState, mutate, commit, todayKey } from './state.js';
import { grantItem } from './rewards.js';
import { addShinyCopy } from './shiny.js';
import { BY_ID } from '../data/catalogue.js';
import { guideLine, speakMaybe } from './guide.js';
import { el } from './ui.js';
import { sfx } from './sfx.js';
import { DAILY_POOL, DAILY_COPY, PARCEL_SPOT } from '../data/daily.js';

export { PARCEL_SPOT };

function freshDay(day) {
  return { day, doings: { play: false, visit: false, care: false }, visited: [], delivered: false };
}

// True when the stored field is today's, with the shape freshSave promises.
// Anything else — absent, another day, or a hand-edited shape — reads as a
// fresh day; ticking self-heals it in the save (never at load, never lossily:
// the field only ever describes TODAY, so there is nothing old to preserve).
function isLive(d, day) {
  return !!(d && typeof d === 'object' && d.day === day
    && d.doings && typeof d.doings === 'object' && Array.isArray(d.visited));
}

function ensureToday(st) {   // call inside mutate()
  if (!isLive(st.daily, todayKey())) st.daily = freshDay(todayKey());
}

// Read-only view of today. Never mutates — a fresh day shows fresh without
// writing anything, so simply LOOKING at the card never touches the save.
export function dayView() {
  const day = todayKey();
  const d = getState().daily;
  const live = isLive(d, day);
  const doings = {
    play: !!(live && d.doings.play),
    visit: !!(live && d.doings.visit),
    care: !!(live && d.doings.care)
  };
  const allDone = doings.play && doings.visit && doings.care;
  const delivered = !!(live && d.delivered);
  return {
    day, doings, allDone, delivered,
    visited: live ? d.visited.slice() : [],
    due: allDone && !delivered
  };
}

// ---- the three ticks -------------------------------------------------------

function tick(fn) {
  let completedNow = false, changed = false;
  mutate(st => {
    ensureToday(st);
    const d = st.daily;
    const before = JSON.stringify(d.doings);
    const doneBefore = d.doings.play && d.doings.visit && d.doings.care;
    fn(d);
    changed = JSON.stringify(d.doings) !== before;
    const doneAfter = d.doings.play && d.doings.visit && d.doings.care;
    if (!doneBefore && doneAfter && !d.delivered) completedNow = true;
  });
  commit();
  // Any tick at all tells the card to redraw. Boo Care opens as an OVERLAY over a
  // still-mounted hub, so without this the card behind it keeps the state it was built
  // with: she looks after a Boo, is told a parcel arrived, closes the sheet, and the card
  // underneath still says she hasn't looked after a Boo — and offers no way to the parcel.
  if (changed) emit('bootown:dailytick');
  return completedNow ? announceDone() : null;
}

function emit(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined)); }
  catch { /* no window (tests import this module headless) */ }
}

export function noteDailyPlay() {
  return tick(d => { d.doings.play = true; });
}

export function noteDailyVisit(areaKey) {
  if (!areaKey) return null;
  return tick(d => {
    if (!d.visited.includes(areaKey)) d.visited.push(areaKey);
    d.doings.visit = true;   // any area not yet visited today counts, the first included
  });
}

export function noteDailyCare() {
  return tick(d => { d.doings.care = true; });
}

// The witnessed moment (announced-moments law): the line is spoken here — tts
// QUEUES utterances, so a screen's own line follows rather than being cut — and
// the event lets a mounted Meadow pop the parcel in with motion. The caller
// also gets the line back to show on its own surface.
function announceDone() {
  const line = guideLine('L_DAILY_DONE');
  speakMaybe(line);
  emit('bootown:dailydone', { line });
  return line;
}

// ---- the Daily Pool + the recycle mechanic ---------------------------------

// Stable hash of the date string (djb2). Same day → same pick, everywhere.
export function dayHash(day) {
  let h = 5381;
  for (let i = 0; i < day.length; i++) h = ((h << 5) + h + day.charCodeAt(i)) >>> 0;
  return h;
}

function ownedEntry(st, e) {
  if (e.shiny) return ((st.shinies || {})[e.id] || 0) > 0;
  return ((st.inventory || {})[e.id] || 0) > 0;
}

// The unowned subset — the ONLY state the pool has. An unclaimed day needs no
// bookkeeping to "return" an item: it was never taken out.
export function eligiblePool(st = getState()) {
  return DAILY_POOL.filter(e => BY_ID[e.id] && !ownedEntry(st, e));
}

// Today's parcel contents: the deterministic pick from the unowned subset, or
// the surprise box when the whole pool is owned (booquest's chest reward path).
export function todaysParcel() {
  const pool = eligiblePool();
  if (!pool.length) return { box: true };
  const e = pool[dayHash(todayKey()) % pool.length];
  return { id: e.id, shiny: !!e.shiny };
}

// Claim: grant FIRST, then navigate (the caller routes to the ceremony) — so a
// closed tablet mid-reveal can never lose the item (saves-are-never-lost law).
export function claimParcel() {
  if (!dayView().due) return null;
  const pick = todaysParcel();
  mutate(st => { ensureToday(st); st.daily.delivered = true; });
  if (pick.box) {
    // Pool exhausted: the parcel holds a free surprise box — the same three-line
    // reward path as booquest's chest node, which is the seam the pack names.
    mutate(st => { st.boxes = (st.boxes || 0) + 1; });
    commit();
    return { box: true };
  }
  grantItem(pick.id);
  if (pick.shiny) addShinyCopy(pick.id);
  commit();
  return { id: pick.id, shiny: pick.shiny, item: BY_ID[pick.id] };
}

// True when the Meadow should be showing the parcel right now.
export function parcelDue() {
  return dayView().due;
}

// ---- the hub card ----------------------------------------------------------

// Same factory contract as createWhatsNewCard: returns a node for hub-specials.
// It is a CARD, not a door — it adds nothing to the 8-primary-buttons tally.
//
// It REDRAWS ITSELF on 'bootown:dailytick', because Boo Care (and anything else the hub
// opens as an overlay) ticks a doing while this very card is still on screen behind it.
// The listener is on the card's own lifetime: hub.js throws the node away on navigation,
// so the check below drops the listener the first time it fires for a detached card.
export function createTodayCard(ctx) {
  const DOINGS = [
    { key: 'play', icon: '🎲' },
    { key: 'visit', icon: '👋' },
    { key: 'care', icon: '💛' }
  ];
  const card = el('div', { class: 'card daily-card' });
  const draw = () => {
    const v = dayView();
    const exhausted = eligiblePool().length === 0;
    const sub = !v.allDone ? DAILY_COPY.subFresh
      : v.delivered ? DAILY_COPY.allDoneClaimed
        : exhausted ? DAILY_COPY.allDoneBox : DAILY_COPY.allDone;
    card.className = 'card daily-card' + (v.due ? ' due' : '');
    card.innerHTML = '';
    card.append(
      el('div', { class: 'daily-head' }, [
        el('span', { class: 'daily-gift', text: '🎁' }),
        el('h3', { class: 'daily-title', text: DAILY_COPY.title })
      ]),
      el('div', { class: 'daily-rows' }, DOINGS.map(d => el('div', { class: 'daily-row' + (v.doings[d.key] ? ' done' : '') }, [
        el('span', { class: 'daily-ic', text: v.doings[d.key] ? '✅' : d.icon }),
        el('span', { class: 'daily-label', text: DAILY_COPY.doings[d.key] })
      ]))),
      el('p', { class: 'daily-sub', text: sub })
    );
    // "Show me!" goes straight to the thing (the What's New law): only when the
    // parcel is actually waiting, straight to the Meadow where it is.
    if (v.due) card.appendChild(el('button', {
      class: 'btn daily-go', text: 'Show me!',
      onclick: () => { sfx.tap(); ctx.go('town', { area: 'meadow' }); }
    }));
  };
  draw();
  const onTick = () => {
    if (!card.isConnected) { try { window.removeEventListener('bootown:dailytick', onTick); } catch {} return; }
    draw();
  };
  try { window.addEventListener('bootown:dailytick', onTick); } catch {}
  return card;
}
