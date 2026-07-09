// js/funfair.js — the Boo Funfair (RUN6 C1b): a fifth town zone.
// Unlocks at 280 stars with a Carousel; the other rides arrive through the Boo
// Builders (the 24h construction pattern, mirrored from growth.js) at star
// milestones. Rides are fixed installations with looping, transform-only,
// multi-Boo animations. Seats hold owned-Boo ids; she seats them via the
// "Who's riding?" picker, and autonomous Boos may board empty seats (town.js).

import { getState, mutate } from './state.js';
import { stampJournal } from './quests.js';
import { nowMs } from './growth.js';
import { resolveItem } from './customs.js';
import { renderItem } from './art.js';
import { equippedArt } from './accessories.js';

// ---- named constants (C1b) ----
export const FUNFAIR_UNLOCK = 280;                     // total stars to open the gates
export const RIDE_ORDER = ['carousel', 'ferris', 'teacups', 'bouncy', 'helter'];
export const RIDE_MILESTONE = { ferris: 340, teacups: 400, bouncy: 460, helter: 520 };  // carousel free on unlock
export const RIDE_SEATS = { carousel: 3, ferris: 4, teacups: 4, bouncy: 3, helter: 3 };
export const RIDE_NAME = { carousel: 'Carousel', ferris: 'Ferris Wheel', teacups: 'Teacups', bouncy: 'Bouncy Castle', helter: 'Helter-Skelter' };
export const FUNFAIR_BUILD_MS = 24 * 60 * 60 * 1000;   // the Builders take 24 real hours
// where each ride sits along the funfair zone (fraction of the zone width)
export const RIDE_X = { carousel: 0.18, ferris: 0.40, teacups: 0.60, bouncy: 0.78, helter: 0.92 };
const RIDE_BOX = 190;   // px, the ride's composed box

function funfairState(s) {
  const f = (s && s.funfair) || {};
  return { built: f.built || [], build: f.build || null, pending: f.pending || [], seats: f.seats || {} };
}
export function funfairUnlocked(s = getState()) { return !!s && (s.stars.total || 0) >= FUNFAIR_UNLOCK; }

// Advance the funfair build machine (mirrors tickGrowth). Call on town + hub open.
// Carousel is free when the gates open; other rides queue at their star milestone
// and build one at a time over 24h. Returns { readyToReveal: ride|null, spawned:[] }.
export function tickFunfair() {
  const s = getState();
  if (!s) return { readyToReveal: null, spawned: [] };
  const stars = s.stars.total || 0;
  const f = funfairState(s);
  const spawned = [];
  if (stars >= FUNFAIR_UNLOCK && !f.built.includes('carousel')) { f.built.push('carousel'); }
  if (stars >= FUNFAIR_UNLOCK) {
    for (const ride of ['ferris', 'teacups', 'bouncy', 'helter']) {
      if (stars < RIDE_MILESTONE[ride]) continue;
      if (f.built.includes(ride) || f.pending.includes(ride) || (f.build && f.build.ride === ride)) continue;
      f.pending.push(ride); spawned.push(ride);
    }
    if (!f.build && f.pending.length) f.build = { ride: f.pending.shift(), startedAt: nowMs() };
  }
  const readyToReveal = (f.build && nowMs() - f.build.startedAt >= FUNFAIR_BUILD_MS) ? f.build.ride : null;
  mutate(st => { const cur = funfairState(st); st.funfair = { built: f.built, build: f.build, pending: f.pending, seats: cur.seats }; });
  return { readyToReveal, spawned };
}

export function completeRideReveal(ride) {
  mutate(st => {
    const f = funfairState(st);
    if (f.build && f.build.ride === ride) f.build = null;
    if (!f.built.includes(ride)) f.built.push(ride);
    if (!f.build && f.pending.length) f.build = { ride: f.pending.shift(), startedAt: nowMs() };
    st.funfair = f;
  });
  stampJournal('funfair_' + ride);
}

export function funfairView() {
  const s = getState();
  const f = funfairState(s || {});
  return {
    unlocked: funfairUnlocked(s),
    built: RIDE_ORDER.filter(r => f.built.includes(r)),
    site: f.build ? f.build.ride : null,
    seats: f.seats
  };
}

// ---- seats ----
export function seatsFor(ride) {
  const f = funfairState(getState());
  const n = RIDE_SEATS[ride] || 0;
  const arr = (f.seats[ride] || []).slice(0, n);
  while (arr.length < n) arr.push(null);
  return arr;
}
export function isSeated(booId) {
  const f = funfairState(getState());
  for (const ride of RIDE_ORDER) { const i = (f.seats[ride] || []).indexOf(booId); if (i >= 0) return { ride, seat: i }; }
  return null;
}
export function seatBoo(ride, booId) {   // fill first empty seat; returns index or -1
  let idx = -1;
  const seated = isSeated(booId);
  if (seated) return -1;                 // one ride at a time
  mutate(st => {
    const f = funfairState(st); const n = RIDE_SEATS[ride] || 0;
    const arr = (f.seats[ride] || []).slice(0, n); while (arr.length < n) arr.push(null);
    const i = arr.indexOf(null); if (i < 0) return;
    arr[i] = booId; idx = i; f.seats[ride] = arr; st.funfair = f;
  });
  return idx;
}
export function unseatBoo(ride, booId) {
  mutate(st => {
    const f = funfairState(st); const arr = f.seats[ride] || [];
    const i = arr.indexOf(booId); if (i >= 0) { arr[i] = null; f.seats[ride] = arr; st.funfair = f; }
  });
}
export function emptySeatCount(ride) { return seatsFor(ride).filter(x => x == null).length; }

// ---- ride structure art (sticker style; the fixed installation) ----
const S = (inner, w = RIDE_BOX, h = RIDE_BOX) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
// Each ride wraps its continuously-MOVING part in `<g class="ffm">` so it visibly RUNS
// at any hour, whether or not Boos are aboard (driven every frame in stepRide, transform-
// only; reduced-motion stills it because the ride loop is not stepped under reduced motion).
const STRUCT = {
  carousel: S(`
    <ellipse cx="95" cy="168" rx="80" ry="16" fill="#C9A9F0" stroke="#2A1B4E" stroke-width="3"/>
    <rect x="90" y="40" width="10" height="128" fill="#B98A5A" stroke="#2A1B4E" stroke-width="2.5"/>
    <g class="ffm">
      <path d="M20 60 Q95 8 170 60 Z" fill="#FF7AC6" stroke="#2A1B4E" stroke-width="3"/>
      <path d="M35 55 L58 24 M72 42 L86 18 M110 42 L104 18 M147 55 L124 22" stroke="#FFF8F0" stroke-width="7" stroke-linecap="round"/>
      <circle cx="95" cy="18" r="7" fill="#FFC93C" stroke="#2A1B4E" stroke-width="2.5"/>
      <path d="M95 11 l10 -6 v10 z" fill="#35D0BA" stroke="#2A1B4E" stroke-width="2"/>
    </g>`),
  ferris: S(`
    <line x1="55" y1="180" x2="95" y2="92" stroke="#8A8FB0" stroke-width="6" stroke-linecap="round"/>
    <line x1="135" y1="180" x2="95" y2="92" stroke="#8A8FB0" stroke-width="6" stroke-linecap="round"/>
    <g class="ffm">
      <circle cx="95" cy="92" r="76" fill="none" stroke="#35D0BA" stroke-width="6"/>
      <circle cx="95" cy="92" r="76" fill="none" stroke="#FF7AC6" stroke-width="6" stroke-dasharray="6 30"/>
      <circle cx="95" cy="92" r="12" fill="#FFC93C" stroke="#2A1B4E" stroke-width="3"/>
    </g>
    <ellipse cx="95" cy="180" rx="60" ry="12" fill="#C9A9F0" stroke="#2A1B4E" stroke-width="3"/>`),
  teacups: S(`
    <ellipse cx="95" cy="150" rx="86" ry="30" fill="#8FC7FF" stroke="#2A1B4E" stroke-width="3"/>
    <g class="ffm">
      <ellipse cx="95" cy="140" rx="78" ry="22" fill="#B6DCFF" stroke="#2A1B4E" stroke-width="2"/>
      <circle cx="95" cy="140" r="9" fill="#FFC93C" stroke="#2A1B4E" stroke-width="2.5"/>
      <circle cx="55" cy="140" r="5" fill="#FF7AC6"/><circle cx="135" cy="140" r="5" fill="#FF7AC6"/>
      <circle cx="95" cy="120" r="5" fill="#35D0BA"/><circle cx="95" cy="160" r="5" fill="#35D0BA"/>
    </g>`),
  bouncy: S(`
    <g class="ffm">
      <rect x="18" y="70" width="154" height="100" rx="16" fill="#FF9AD5" stroke="#2A1B4E" stroke-width="3"/>
      <rect x="30" y="120" width="130" height="50" fill="#FFC0E6" stroke="#2A1B4E" stroke-width="2"/>
      <path d="M18 74 Q40 44 62 74 Q84 44 106 74 Q128 44 150 74 Q168 50 172 74" fill="#FFC93C" stroke="#2A1B4E" stroke-width="3"/>
      <rect x="78" y="128" width="34" height="42" rx="6" fill="#C6A9F0" stroke="#2A1B4E" stroke-width="2.5"/>
    </g>`),
  helter: S(`
    <g class="ffm">
      <path d="M95 20 L70 150 L120 150 Z" fill="#FFD08A" stroke="#2A1B4E" stroke-width="3"/>
      <path d="M95 30 Q150 60 118 92 Q60 120 120 148" fill="none" stroke="#FF7AC6" stroke-width="10" stroke-linecap="round" opacity="0.9"/>
      <path d="M95 14 l12 -7 v11 z" fill="#35D0BA" stroke="#2A1B4E" stroke-width="2"/>
    </g>
    <ellipse cx="95" cy="166" rx="66" ry="14" fill="#C9A9F0" stroke="#2A1B4E" stroke-width="3"/>`)
};
// Continuous idle motion for each ride's `.ffm` group (SVG transform attribute, explicit
// pivot). The three wheels turn at their seats' orbit rate so a ridden ride reads coherently
// (gondolas/cups ride level while the wheel turns); the bouncy castle breathes; the helter
// tower sways. t is `now` in ms.
const DEG = 180 / Math.PI;
const RIDE_IDLE = {
  // Only the circular ferris wheel rotates cleanly in this side-on sticker style (full turn at
  // the gondolas' orbit rate). A dome/flat-platform can't do a 2D 360° without flipping, so the
  // carousel top gently bobs, the teacup platform jiggles a few degrees, the castle breathes and
  // the helter tower sways — each a visually-correct "this ride is running" cue at any hour.
  ferris:   t => `rotate(${((t / 2600) * DEG % 360).toFixed(2)} 95 92)`,
  carousel: t => `translate(0 ${(-4 * (0.5 + 0.5 * Math.sin(t / 900))).toFixed(2)})`,
  teacups:  t => `rotate(${(5 * Math.sin(t / 600)).toFixed(2)} 95 140)`,
  bouncy:   t => `translate(0 ${(-3 * (0.5 + 0.5 * Math.sin(t / 520))).toFixed(2)})`,
  helter:   t => `rotate(${(2.4 * Math.sin(t / 900)).toFixed(2)} 95 150)`
};
// where a ride's seats orbit / sit, within the RIDE_BOX (px from top-left)
const CENTER = { carousel: [95, 96], ferris: [95, 92], teacups: [95, 132], bouncy: [95, 150], helter: [95, 90] };

// Build the DOM element for a ride, with its seat riders (owned-Boo art).
export function renderRide(ride) {
  const box = document.createElement('div');
  box.className = 'ff-ride ff-' + ride;
  box.dataset.ride = ride;
  box.style.width = RIDE_BOX + 'px'; box.style.height = RIDE_BOX + 'px';
  const struct = document.createElement('div');
  struct.className = 'ff-struct'; struct.innerHTML = STRUCT[ride] || '';
  box.appendChild(struct);
  const [cx, cy] = CENTER[ride] || [95, 95];
  seatsFor(ride).forEach((booId, i) => {
    const seat = document.createElement('div');
    seat.className = 'ff-seat' + (booId ? '' : ' empty');
    seat.dataset.seat = String(i);
    seat.style.left = (cx - 24) + 'px'; seat.style.top = (cy - 24) + 'px';
    if (booId) {
      const item = resolveItem(booId);
      if (item) seat.innerHTML = renderItem(item, { size: 46, equipArt: item.kind === 'boo' ? equippedArt(booId) : null });
    }
    box.appendChild(seat);
  });
  return box;
}

// Animate one ride at time `now` (ms). Transform-only; one composed loop. The
// caller only steps rides in the visible zone (performance rule).
export function stepRide(box, ride, now) {
  const t = now;
  // The ride RUNS continuously whether or not it has riders (a fairground is never "parked"):
  // drive its moving structure at any hour. Transform-only; stilled under reduced motion
  // because the caller does not step rides then.
  const moving = box.querySelector('.ffm');
  if (moving && RIDE_IDLE[ride]) moving.setAttribute('transform', RIDE_IDLE[ride](t));
  const seats = box.querySelectorAll('.ff-seat');
  seats.forEach((seat, i) => {
    if (seat.classList.contains('empty')) return;
    let x = 0, y = 0, extra = '';
    if (ride === 'carousel') {
      const a = t / 1500 + i * (2 * Math.PI / 3);
      x = 62 * Math.cos(a); y = 16 * Math.sin(a) - 8 * Math.abs(Math.sin(t / 280 + i));
      const sc = 0.78 + 0.14 * (Math.sin(a) + 1) / 2; extra = ` scale(${sc.toFixed(3)})`;
    } else if (ride === 'ferris') {
      const a = t / 2600 + i * (Math.PI / 2);
      x = 70 * Math.cos(a); y = 70 * Math.sin(a);
      // the gondola at the top waves
      if (Math.sin(a) < -0.7) extra = ` rotate(${(Math.sin(t / 160) * 14).toFixed(1)}deg)`;
    } else if (ride === 'teacups') {
      const c = i < 2 ? 0 : 1;
      const cupA = t / 2100 + c * Math.PI;
      const cx = 44 * Math.cos(cupA), cy = 14 * Math.sin(cupA);
      const bA = t / 850 + (i % 2) * Math.PI;
      x = cx + 22 * Math.cos(bA); y = cy + 10 * Math.sin(bA);
    } else if (ride === 'bouncy') {
      x = (i - 1) * 42;
      const up = Math.abs(Math.sin(t / 380 + i * 1.4));
      y = -34 * up;
      extra = up < 0.12 ? ' scale(0.92, 0.78)' : '';
    } else if (ride === 'helter') {
      const p = ((t / 2600 + i / 3) % 1);
      const ang = p * 4 * Math.PI;
      x = 34 * Math.sin(ang) * (1 - p * 0.35);
      y = -74 + p * 96;
      extra = ` scale(0.86)`;
    }
    seat.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)${extra}`;
  });
}

// ---- fair scenery (ticket booth, bunting, string lights, popcorn cart) ----
// Returns an SVG string sized to the zone (drawn behind the rides). `night`
// makes the string lights glow.
export function fairSceneryFor(zoneW, viewH, night) {
  const w = zoneW, h = viewH;
  const bulbs = Array.from({ length: 18 }, (_, i) => {
    const x = 26 + i * (w - 52) / 17, y = h * 0.31 + Math.sin(i / 17 * Math.PI) * 30;
    return `<circle class="ff-bulb" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="7" fill="${['#FFC93C', '#FF7AC6', '#35D0BA'][i % 3]}"/>`;
  }).join('');
  const flags = Array.from({ length: 16 }, (_, i) => {
    const x = 16 + i * (w - 32) / 15, y = h * 0.19 + Math.sin(i / 15 * Math.PI) * 18;
    return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l22 0 l-11 26 z" fill="${['#FF7AC6', '#FFC93C', '#35D0BA', '#8FC7FF'][i % 4]}" stroke="#2A1B4E" stroke-width="1.5"/>`;
  }).join('');
  const boothX = w * 0.28, boothY = h * 0.40;
  const booth = `<g transform="translate(${boothX.toFixed(0)},${boothY.toFixed(0)})">
    <rect x="0" y="30" width="96" height="70" rx="8" fill="#FFF3E0" stroke="#2A1B4E" stroke-width="3"/>
    <path d="M-6 30 h108 l-10 -22 h-88 z" fill="#FF7AC6" stroke="#2A1B4E" stroke-width="3"/>
    <path d="M-6 30 h108" stroke="#FFF8F0" stroke-width="0"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${-6 + i * 18}" y="8" width="9" height="22" fill="${i % 2 ? '#FFF8F0' : '#FF7AC6'}"/>`).join('')}
    <rect x="16" y="52" width="64" height="30" rx="5" fill="#8FC7FF" stroke="#2A1B4E" stroke-width="2.5"/>
    <text x="48" y="24" font-family="Fredoka,sans-serif" font-size="15" font-weight="700" fill="#FFF8F0" text-anchor="middle">TICKETS</text></g>`;
  const cartX = w * 0.50, cartY = h * 0.50;
  const popcorn = `<g transform="translate(${cartX.toFixed(0)},${cartY.toFixed(0)})">
    <rect x="0" y="16" width="70" height="52" rx="6" fill="#FF5C8A" stroke="#2A1B4E" stroke-width="3"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${4 + i * 11}" y="16" width="6" height="52" fill="${i % 2 ? '#FFF8F0' : '#FF5C8A'}" opacity="0.9"/>`).join('')}
    <rect x="6" y="2" width="58" height="20" rx="5" fill="#FFF3E0" stroke="#2A1B4E" stroke-width="2.5"/>
    <circle cx="18" cy="6" r="6" fill="#FFF8F0"/><circle cx="30" cy="3" r="6" fill="#FFEEA6"/><circle cx="44" cy="6" r="6" fill="#FFF8F0"/><circle cx="54" cy="4" r="5" fill="#FFEEA6"/>
    <circle cx="14" cy="72" r="8" fill="#2A1B4E"/><circle cx="56" cy="72" r="8" fill="#2A1B4E"/></g>`;
  return `<svg class="ff-scenery${night ? ' night' : ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 ${(h * 0.20).toFixed(0)} Q${(w / 2).toFixed(0)} ${(h * 0.14).toFixed(0)} ${w - 8} ${(h * 0.20).toFixed(0)}" fill="none" stroke="#2A1B4E" stroke-width="2"/>${flags}
    <path d="M8 ${(h * 0.30).toFixed(0)} Q${(w / 2).toFixed(0)} ${(h * 0.24).toFixed(0)} ${w - 8} ${(h * 0.30).toFixed(0)}" fill="none" stroke="#2A1B4E" stroke-width="2" opacity="0.6"/>${bulbs}
    ${booth}${popcorn}</svg>`;
}

// The locked-zone silhouette: a ferris-wheel outline (drawn where the sign shows).
export function funfairSilhouette() {
  return `<svg viewBox="0 0 120 120" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
    <line x1="34" y1="112" x2="60" y2="58" stroke="#3A2E6E" stroke-width="5" stroke-linecap="round"/>
    <line x1="86" y1="112" x2="60" y2="58" stroke="#3A2E6E" stroke-width="5" stroke-linecap="round"/>
    <circle cx="60" cy="58" r="46" fill="none" stroke="#3A2E6E" stroke-width="5"/>
    ${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="60" y1="58" x2="${(60 + 46 * Math.cos(a)).toFixed(0)}" y2="${(58 + 46 * Math.sin(a)).toFixed(0)}" stroke="#3A2E6E" stroke-width="3"/>`; }).join('')}
    ${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<circle cx="${(60 + 46 * Math.cos(a)).toFixed(0)}" cy="${(58 + 46 * Math.sin(a)).toFixed(0)}" r="7" fill="none" stroke="#3A2E6E" stroke-width="3"/>`; }).join('')}
    <circle cx="60" cy="58" r="8" fill="#3A2E6E"/></svg>`;
}
