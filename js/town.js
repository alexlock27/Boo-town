// js/town.js — Town 2.0: a living side-view world (spec RUN2 C3).
// Horizontally scrolling scene with three parallax layers, four star-gated zones,
// drag placement along the ground band, wandering Boos, and real-clock day/night.

import { el, clear, confetti, REDUCED, backControl } from './ui.js';
import { getState, mutate } from './state.js';
import { renderItem } from './art.js';
import { BY_ID } from '../data/catalogue.js';
import { resolveItem } from './customs.js';
import { listArtworks } from './studio.js';
import { idbGet } from './idb.js';
import { voiceBooIds, playVoice } from './voices.js';
import { checkRequestOpen, activeRequest, takeTreat } from './requests.js';
import { openChoreographer, routineFor, applyMove, STEP_MS } from './choreographer.js';
import { guideLine, speakMaybe } from './guide.js';
import { equippedArt, openDressUp, getDisplayName } from './accessories.js';
import { sfx, music, ambient } from './sfx.js';
import { noteQuest, stampJournal } from './quests.js';
import { tickGrowth, completeReveal, growthView, GROWTH_MILESTONES } from './growth.js';
import { ensureHide, currentHide, foundHide, HIDE_REWARD } from './delights.js';
import { addMeterPoints } from './rewards.js';
import { FUNFAIR_UNLOCK, RIDE_ORDER, RIDE_NAME, RIDE_X, RIDE_SEATS, tickFunfair, completeRideReveal, funfairView, funfairUnlocked, seatsFor, seatBoo, unseatBoo, isSeated, emptySeatCount, renderRide, stepRide, fairSceneryFor, funfairSilhouette } from './funfair.js';
import { BANDSTAND_X, bandTrio, getBandSongEvents, startBandWatch } from './band.js';
import { applyRarityFx, rarityRank, RARITY_TOWN_CAP } from './rarityfx.js';

// Zone unlock thresholds (named constants).
export const RIVERSIDE_STARS = 40, HILLTOP_STARS = 100, BEACH_STARS = 180;
export const ZONES = [
  { key: 'meadow',    name: 'Meadow',    unlock: 0 },
  { key: 'riverside', name: 'Riverside', unlock: RIVERSIDE_STARS },
  { key: 'hilltop',   name: 'Hilltop',   unlock: HILLTOP_STARS },
  { key: 'beach',     name: 'Beach',     unlock: BEACH_STARS },
  { key: 'funfair',   name: 'Boo Funfair', unlock: FUNFAIR_UNLOCK }   // fifth zone (RUN6 C1b)
];
const ZONE_INDEX = Object.fromEntries(ZONES.map((z, i) => [z.key, i]));
const MAX_WANDERERS = 30;

// ---- town spaciousness (RUN5 C3): every zone is a place, not a corridor -------
export const ZONE_W_VIEWPORTS = 1.7;   // each zone is 1.7 viewports wide (named constant)
const BAND_TOP = 0.62, BAND_BOTTOM = 0.92;   // usable ground runs 62%→92% of viewport height
const GROUND_FRAC = BAND_TOP;          // the grass band starts at the top of the placement band
// three depth rows: feet-line (fraction of viewH), and a size scale (smaller toward the back)
const ROW_GROUND = [0.67, 0.79, 0.91];
const ROW_SCALE = [0.80, 1.0, 1.16];
const DEPTH_ROWS = ROW_GROUND.length;
const MIN_SPACING = 0.06;              // min x-gap (zone fraction) between items in a zone+row — no piling
const WANDER_FRAC = 0.045;             // horizontal wander range as a fraction of the (wider) zone
const DEPTH_WANDER = 26;               // px a wanderer may drift between depth rows for a bit of life
const rowOf = (t) => Math.max(0, Math.min(DEPTH_ROWS - 1, (t && t.row != null) ? t.row : 1));

// ---- activity items (RUN4 C5): named constants -----------------------------
const ACT_RADIUS = 0.12;        // zone-x fraction: how near a Boo joins an activity
const MAX_ACTIVE_ROLES = 12;    // performance cap on busy actors (town rules)
const SLEEP_START = 21, SLEEP_END = 7;   // Boos near a Boo House sleep 21:00–07:00
const WAKE_MS = 45000;          // a woken Boo stays up this long (no grumpiness)
const BENCH_SIT_MS = 7000;      // bench sits are "now and then", not forever
const BENCH_COOLDOWN_MS = 9000;
const isSleepTime = (h) => h >= SLEEP_START || h < SLEEP_END;

// ---- Boo behaviour engine (RUN6 C1): a free Boo periodically picks its next act ----
const BEHAVIOUR_CHANCE = 0.55;  // fraction of re-choices that start a richer act (else micro-wander)
const GOAL_STRIDE = 0.10;       // zone-fraction/sec stride toward a goal (friend / activity / nap spot)
const VISIT_REACH_PX = 48;      // gap that counts as "arrived" beside a friend
const GREET_MS = 1700;          // how long the wave-and-heart lingers on a friend visit
const GOAL_TIMEOUT_MS = 9000;   // abandon a goal if unreached — a Boo is never stuck
const CHASE_MS = 3800;          // a butterfly (day) / firefly (night) chase
const WATCH_MS = 4200;          // a sit-and-watch spell
const NAP_MS = 22000;           // a chosen nap under a tree/house lasts a while (or until morning)
const NAP_IDS = ['deco_boohouse', 'deco_tree'];   // a Boo naps by a house or under a Bubble Tree at night
const ACT_IDS = ['deco_slide', 'deco_swings', 'deco_trampoline', 'deco_paddlepool', 'deco_bumper', 'deco_seesaw', 'deco_picnic', 'deco_bench', 'deco_pond'];

// ---- ambient life (RUN6 C1) ----
const WEATHER_PARTICLES = 14;   // per-season particle count (one particle layer; caps hold)
const STAR_GAP_MS = [16000, 40000];  // random gap between night shooting stars
const STAR_REWARD = 1;          // +1 meter, capped once per night

function seasonOf(month) {       // month 1..12
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}
function currentMonth() {
  if (typeof window !== 'undefined' && window.__bootownMonth != null) return window.__bootownMonth | 0;
  try { return new Date().getMonth() + 1; } catch { return 6; }
}
function todayKeyLocal() {
  if (typeof window !== 'undefined' && window.__bootownDay) return window.__bootownDay;
  try { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } catch { return 'x'; }
}
function weightedPick(cands) {   // cands: [ [value, weight], ... ]
  let total = 0; for (const [, w] of cands) total += w;
  let r = Math.random() * total;
  for (const [v, w] of cands) { r -= w; if (r <= 0) return v; }
  return cands[cands.length - 1][0];
}
const lerp = (a, b, k) => a + (b - a) * k;
// Activity kit renders bigger than a Boo so climbing/sitting reads properly.
const ACT_SIZE = {
  deco_slide: 150, deco_swings: 150, deco_seesaw: 160, deco_trampoline: 140,
  deco_paddlepool: 150, deco_picnic: 150, deco_bumper: 140, deco_campfire: 120
};

export function totalStars() { const s = getState(); return s ? s.stars.total : 0; }
export function unlockedZones(stars) { return ZONES.filter(z => stars >= z.unlock); }

function currentHour() {
  if (typeof window !== 'undefined' && window.__bootownHour != null) return window.__bootownHour | 0;
  try { return new Date().getHours(); } catch { return 12; }
}
const isNight = (h) => h >= 19 || h < 7;

export function mount(container, params, ctx) {
  const s = getState();
  music.play('calm');
  noteQuest('townVisit');   // daily quest: visit the town (RUN3 C4)
  ensureHide();             // hide-and-seek Boo, once per local day (RUN4 C9)
  let voiceIds = new Set();  // Boo ids with a recorded voice (RUN3 C7)
  voiceBooIds().then(s => { voiceIds = s; }).catch(() => {});
  // Occasional Boo requests (RUN3 C8): check at app open (town is an "open").
  checkRequestOpen((getState().town || []).filter(t => (t.item || '').startsWith('boo_') || (t.item || '').startsWith('custom:')).map(t => t.item));

  let holding = (params && params.place) || null;   // item id being placed
  let placeMode = !!holding;
  let scrollX = 0, worldW = 0, zoneW = 0, viewW = 0, viewH = 0, groundY = 0;
  let raf = null, actors = [], fx = [];
  let currentSeasonName = '', starTimer = null;   // ambient life (RUN6 C1)

  const root = el('div', { class: 'town2' });
  const back = backControl(() => ctx.go('hub'));
  const title = el('h2', { text: 'My Town' });
  const hint = el('span', { class: 'town-hint' });
  const header = el('header', { class: 'town-header' }, [back, title, hint]);

  const sky = el('div', { class: 't-layer t-sky' });
  const hills = el('div', { class: 't-layer t-hills' });
  const ground = el('div', { class: 't-layer t-ground' });
  const air = el('div', { class: 't-layer t-air' });   // fireflies / butterflies
  const viewport = el('div', { class: 't-viewport' }, [sky, hills, ground, air]);

  const drawer = el('div', { class: 'town-drawer' });
  root.append(header, viewport, drawer);
  container.appendChild(root);

  // Day / night tint.
  const night = isNight(currentHour());
  root.classList.toggle('night', night);

  requestAnimationFrame(() => {
    layout(); renderDrawer(); updateHint(); maybeCelebrateUnlock(); startLoop();
    // Growth milestones (RUN4 C6): spawn/queue sites, and if the Builders
    // finished while she was away, the next town open plays the reveal.
    const gt = tickGrowth();
    if (gt.readyToReveal) setTimeout(() => playGrowthReveal(gt.readyToReveal), REDUCED ? 100 : 700);
    else if (gt.spawned.length) renderPlaced();   // a fresh site fence appears
    // Funfair rides via the Boo Builders (RUN6 C1b): reveal a finished ride, else show a fresh site.
    const ft = tickFunfair();
    if (ft.readyToReveal) setTimeout(() => playFunfairReveal(ft.readyToReveal), REDUCED ? 120 : 900);
    else if (ft.spawned.length) renderFunfair();
  });
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  // ---- layout / render ----------------------------------------------------
  function layout() {
    viewH = viewport.clientHeight || 400;
    viewW = viewport.clientWidth || 600;
    // Each zone is 1.7 viewports wide (C3), so a zone is a place to roam, not a corridor.
    zoneW = viewW * ZONE_W_VIEWPORTS;
    worldW = zoneW * ZONES.length;
    groundY = viewH * GROUND_FRAC;
    for (const L of [sky, hills, ground, air]) { L.style.width = worldW + 'px'; L.style.height = viewH + 'px'; }
    renderScenery();
    renderPlaced();
    clampScroll();
    applyScroll();
  }

  function renderScenery() {
    clear(sky); clear(hills); clear(ground);
    // sky: gradient + a scatter of stars across the whole world
    sky.appendChild(el('div', { class: 't-skygrad' }));
    const starN = 90;
    const sf = document.createDocumentFragment();
    for (let i = 0; i < starN; i++) {
      const st = el('i', { class: 't-star' });
      st.style.left = (i / starN * 100).toFixed(2) + '%';
      st.style.top = (Math.abs(Math.sin(i * 12.9898) ) * 55).toFixed(1) + '%';
      st.style.setProperty('--tw', (1.5 + (i % 5) * 0.4) + 's');
      sf.appendChild(st);
    }
    sky.appendChild(el('div', { class: 't-stars' }, [])).appendChild(sf);

    const stars = totalStars();
    ZONES.forEach((z, i) => {
      const locked = stars < z.unlock;
      // midground scenery — the funfair shows its ferris-wheel silhouette while locked,
      // and its fairground (bunting, string lights, booth, popcorn) once open (C1b).
      // The unlocked funfair's scenery is drawn in the GROUND layer (renderFunfair) so it
      // stays aligned with the rides; the hills layer's parallax would slide it out of place.
      const sceneHtml = z.key === 'funfair'
        ? (locked ? `<div class="ff-silhouette">${funfairSilhouette()}</div>` : '')
        : sceneryFor(z.key, zoneW, viewH);
      const scene = el('div', { class: 't-zone-scene ' + z.key + (locked ? ' locked' : ''), html: sceneHtml });
      scene.style.left = (i * zoneW) + 'px'; scene.style.width = zoneW + 'px';
      hills.appendChild(scene);
      // ground band
      const band = el('div', { class: 't-band ' + z.key + (locked ? ' locked' : '') });
      band.style.left = (i * zoneW) + 'px'; band.style.width = zoneW + 'px';
      band.style.top = groundY + 'px'; band.style.height = (viewH - groundY) + 'px';
      ground.appendChild(band);
      if (locked) {
        // star requirement as current / required with a mini progress bar (job 5)
        const pct = Math.max(0, Math.min(100, Math.round(stars / z.unlock * 100)));
        const sign = el('div', { class: 't-signpost' }, [
          el('div', { class: 't-sign-ic', html: signSVG() }),
          el('div', { class: 't-sign-name', text: z.name }),
          el('div', { class: 't-sign-req', text: `${stars} / ${z.unlock} ⭐` }),
          el('div', { class: 't-sign-bar' }, [el('i', { style: { width: pct + '%' } })])
        ]);
        sign.style.left = (i * zoneW + zoneW / 2) + 'px';
        sign.style.top = (groundY - 150) + 'px';
        ground.appendChild(sign);
      }
    });
  }

  function renderPlaced() {
    ground.querySelectorAll('.t-item').forEach(n => n.remove());
    actors = [];
    const st = getState();
    let count = 0, fancyCount = 0;
    for (const t of st.town) {
      const item = resolveItem(t.item);
      if (!item) continue;
      const zi = ZONE_INDEX[t.zone] ?? 0;
      const x = clamp01(t.x);
      const px = zi * zoneW + x * zoneW;
      // Three depth rows (C3): items scale smaller toward the back and, being lower on
      // screen (larger y), the front rows draw ABOVE the back rows.
      const row = rowOf(t);
      const rowGroundPx = viewH * ROW_GROUND[row];
      const size = (ACT_SIZE[t.item] || 92) * ROW_SCALE[row];
      const wrap = el('div', { class: 't-item' + (item.kind === 'boo' ? ' boo' : ''), dataset: { zone: t.zone, x: String(t.x), item: t.item, row: String(row) } });
      wrap.style.left = (px - size / 2) + 'px';
      wrap.style.top = (rowGroundPx - size + 8) + 'px';
      wrap.style.zIndex = String(Math.round(rowGroundPx));
      wrap.innerHTML = renderItem(item, { size, equipArt: item.kind === 'boo' ? equippedArt(item.id) : null });
      attachItemPointer(wrap, t, item);
      ground.appendChild(wrap);
      // Shared rarity VFX (C2): full effect for the first RARITY_TOWN_CAP fancy items,
      // then a static sheen so the emitter cap holds (distant/numerous items degrade).
      const shiny = ((st.shinies && st.shinies[t.item]) || 0) > 0;
      if (rarityRank(item) > 0 || shiny) {
        const degrade = fancyCount >= RARITY_TOWN_CAP;
        applyRarityFx(wrap, item, { context: 'town', shiny, degrade });
        if (!degrade) fancyCount++;
      }
      if (item.kind === 'boo' && !item.fx && count < MAX_WANDERERS) {
        const act = makeActor(wrap, item, t);
        // a Boo currently riding a funfair ride shows ONLY on the ride, not on the ground (C1b)
        if (isSeated(t.item)) { act.riding = true; wrap.style.display = 'none'; }
        actors.push(act); count++;
      }
    }
    applyDance();
    assignRoles();
    renderGrowth();
    renderFunfair();
    renderHide();
    decorateEasels();
    renderRequestBubble();
  }

  // ---- hide-and-seek Boo (RUN4 C9): once per local day, carries if unfound ----
  function renderHide() {
    ground.querySelectorAll('.t-hide-ears').forEach(n => n.remove());
    const h = currentHide();
    if (!h) return;
    // tuck the hider away and peek its ears from behind the scenery
    const hiderWrap = [...ground.querySelectorAll('.t-item.boo')].find(w => w.dataset.item === h.boo);
    if (!hiderWrap) return;
    hiderWrap.style.display = 'none';
    const item = resolveItem(h.boo);
    const ears = el('button', { class: 't-hide-ears', 'aria-label': 'Someone is hiding here!' });
    ears.innerHTML = `<svg viewBox="0 0 60 26" width="52" height="23" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="18" rx="11" ry="14" fill="#5F4FC4" stroke="#2A1B4E" stroke-width="3"/>
      <ellipse cx="44" cy="18" rx="11" ry="14" fill="#5F4FC4" stroke="#2A1B4E" stroke-width="3"/>
      <ellipse cx="16" cy="20" rx="5" ry="8" fill="#FF9AD5" opacity="0.8"/>
      <ellipse cx="44" cy="20" rx="5" ry="8" fill="#FF9AD5" opacity="0.8"/>
    </svg>`;
    // peek just above the scenery so the ears stay visible AND tappable
    const px = pxAt(h.spot.zone, h.spot.x);
    const decoH = (ACT_SIZE[h.spot.item] || 92) * 130 / 120;
    ears.style.left = (px - 26) + 'px';
    ears.style.top = (groundY - decoH - 12) + 'px';
    // pointer pattern mirrors attachItemPointer: stop the pan from swallowing taps
    ears.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    ears.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (!foundHide()) return;
      addMeterPoints(HIDE_REWARD);   // +2 meter for spotting (C9)
      sfx.correct(); sfx.star();
      hiderWrap.style.display = '';
      const svg = hiderWrap.querySelector('svg');
      if (svg && !REDUCED) { svg.classList.remove('squeak'); void svg.offsetWidth; svg.classList.add('squeak'); }
      if (!REDUCED) confetti({ count: 30, power: 0.7, origin: pointFor(hiderWrap) });
      ears.remove();
      const line = 'Found you! Hee hee! 💜';
      const treat = el('div', { class: 'request-treat', text: line });
      hiderWrap.appendChild(treat);
      setTimeout(() => treat.remove(), 2200);
    });
    ground.appendChild(ears);
  }

  // ---- the Parade (RUN4 C9): every placed Boo marches across the town -------
  let paradeUntil = 0, paradeStart = 0, paradeConfetti = null;
  function startParade() {
    const ms = (typeof window !== 'undefined' && window.__bootownParadeMs) || 20000;
    paradeStart = performance.now();
    paradeUntil = paradeStart + ms;
    // EVERY placed Boo marches — even a hide-and-seek hider joins in (it tucks
    // itself back behind the scenery afterwards, still unfound).
    ground.querySelectorAll('.t-item.boo').forEach(w => { w.style.display = ''; });
    ground.querySelectorAll('.t-hide-ears').forEach(n => n.remove());
    actors.forEach((a, i) => { clearRole(a); a.parading = { slot: i }; });
    music.play('game');
    if (!REDUCED) {
      confetti({ count: 60, power: 0.9 });
      let bursts = 0;
      paradeConfetti = setInterval(() => { if (++bursts > 3 || performance.now() > paradeUntil) { clearInterval(paradeConfetti); return; } confetti({ count: 40, power: 0.8 }); }, Math.max(1200, ms / 5));
    }
  }
  function stepParade(a, now) {
    const ms = paradeUntil - paradeStart;
    const p = (now - paradeStart) / ms;
    if (p >= 1) {   // the parade is over: everyone returns to their spots
      actors.forEach(x => { x.parading = null; const s2 = x.wrap.querySelector('svg'); if (s2) s2.style.transform = ''; });
      paradeUntil = 0;
      music.play('calm');
      renderPlaced();   // fresh render: roles reassign, an unfound hider re-hides
      return;
    }
    const svg = a.wrap.querySelector('svg');
    if (!svg) return;
    const ownPx = parseFloat(a.wrap.style.left) + 46;
    const lineX = scrollX - 80 + (zoneW + 240) * p - a.parading.slot * 64;   // a marching line
    const t = now - paradeStart;
    const bob = -Math.abs(Math.sin((t + a.parading.slot * 130) / 220)) * 9;
    svg.style.transform = `translate(${(lineX - ownPx).toFixed(1)}px, ${bob.toFixed(1)}px)`;
  }

  // ---- town growth (RUN4 C6): milestone upgrades + the Boo Builders --------
  // Upgrades are scenery layers placed by the town itself — they sit BEHIND her
  // items and never consume space she is using.
  function pxAt(zone, x) { return ((ZONE_INDEX[zone] ?? 0) * zoneW + x * zoneW); }
  function renderGrowth() {
    ground.querySelectorAll('.t-growth').forEach(n => n.remove());
    const view = growthView();
    const night = isNight(currentHour());
    for (const m of view.upgrades) {
      const node = growthNode(m, night);
      if (node) ground.insertBefore(node, ground.firstChild);
    }
    if (view.site) ground.insertBefore(siteNode(view.site), ground.firstChild);
  }
  function growthNode(m, night) {
    const wrap = el('div', { class: `t-growth tg-${m.key}${night && m.key === 'fairylights' ? ' lit' : ''}` });
    const cx = pxAt(m.zone, m.x);
    let w = 300, h = 120, svg = '';
    const F = (x, y, hue) => `<g transform="translate(${x},${y})"><line x1="0" y1="0" x2="0" y2="-14" stroke="#4C8C3F" stroke-width="3"/><circle cx="0" cy="-18" r="6" fill="${hue}"/><circle cx="0" cy="-18" r="2.4" fill="#FFEB99"/></g>`;
    if (m.key === 'wildflowers') {
      w = zoneW * 0.7; h = 44;
      svg = ['#FF7AC6', '#C6A9F0', '#FFC93C', '#8FC7FF', '#FF8A8A', '#35D0BA', '#FF7AC6'].map((hue, i) => F(20 + i * (w - 40) / 6, 40, hue)).join('');
    } else if (m.key === 'fairylights') {
      w = zoneW * 0.6; h = 90;
      const bulbs = Array.from({ length: 9 }, (_, i) => { const x = 14 + i * (w - 28) / 8; const y = 30 + Math.sin(i / 8 * Math.PI) * 26; return `<circle class="fl-bulb" cx="${x}" cy="${y}" r="5" fill="${['#FFC93C', '#FF7AC6', '#35D0BA'][i % 3]}"/>`; }).join('');
      svg = `<path d="M8 24 Q ${w / 2} ${86} ${w - 8} 24" fill="none" stroke="#2A1B4E" stroke-width="2.5" opacity="0.7"/>` + bulbs +
        `<line x1="8" y1="24" x2="8" y2="${h}" stroke="#6E4534" stroke-width="5"/><line x1="${w - 8}" y1="24" x2="${w - 8}" y2="${h}" stroke="#6E4534" stroke-width="5"/>`;
    } else if (m.key === 'fountain') {
      w = 120; h = 110;
      svg = `<ellipse cx="60" cy="96" rx="46" ry="13" fill="#7FC7E8" stroke="#2A1B4E" stroke-width="3"/>` +
        `<rect x="50" y="58" width="20" height="34" rx="6" fill="#B8C6E8" stroke="#2A1B4E" stroke-width="3"/>` +
        `<ellipse cx="60" cy="58" rx="18" ry="6" fill="#7FC7E8" stroke="#2A1B4E" stroke-width="2.5"/>` +
        `<path class="ft-spray" d="M60 52 Q54 38 60 30 Q66 38 60 52" fill="#A6DDF2" opacity="0.9"/>` +
        `<circle class="ft-drop d1" cx="48" cy="42" r="3" fill="#A6DDF2"/><circle class="ft-drop d2" cx="72" cy="40" r="2.6" fill="#A6DDF2"/>`;
    } else if (m.key === 'paving') {
      w = zoneW * 0.6; h = 30;
      svg = Array.from({ length: 8 }, (_, i) => `<ellipse cx="${24 + i * (w - 48) / 7}" cy="${16 + (i % 2) * 6}" rx="17" ry="7" fill="#D8CBEF" stroke="#2A1B4E" stroke-width="2" opacity="0.9"/>`).join('');
    } else if (m.key === 'banner') {
      w = zoneW * 0.55; h = 70;
      const flags = Array.from({ length: 8 }, (_, i) => { const x = 16 + i * (w - 32) / 7; const y = 20 + Math.sin(i / 7 * Math.PI) * 14; return `<path d="M${x} ${y} L${x + 14} ${y} L${x + 7} ${y + 16} Z" fill="${['#FF7AC6', '#FFC93C', '#35D0BA', '#8FC7FF'][i % 4]}" stroke="#2A1B4E" stroke-width="1.5"/>`; }).join('');
      svg = `<path d="M8 20 Q ${w / 2} ${52} ${w - 8} 20" fill="none" stroke="#2A1B4E" stroke-width="2.5"/>` + flags;
    } else return null;
    wrap.style.left = (cx - w / 2) + 'px';
    wrap.style.top = (m.key === 'banner' ? groundY - 250 : m.key === 'fairylights' ? groundY - 150 : groundY - h + 6) + 'px';
    wrap.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    return wrap;
  }
  // A construction site: fence, sign, two hard-hat builder Boos, sawdust puffs.
  function siteNode(m) {
    const wrap = el('div', { class: 't-growth t-consite' });
    const cx = pxAt(m.zone, m.x);
    const w = 240, h = 130;
    wrap.style.left = (cx - w / 2) + 'px';
    wrap.style.top = (groundY - h + 10) + 'px';
    const fence = Array.from({ length: 6 }, (_, i) => `<rect x="${10 + i * 40}" y="86" width="12" height="40" rx="3" fill="#E8B04B" stroke="#2A1B4E" stroke-width="2.5"/>`).join('') +
      `<rect x="4" y="92" width="${w - 8}" height="9" rx="4" fill="#F4C96B" stroke="#2A1B4E" stroke-width="2.5"/>` +
      `<rect x="4" y="110" width="${w - 8}" height="9" rx="4" fill="#F4C96B" stroke="#2A1B4E" stroke-width="2.5"/>`;
    const sign = `<g transform="translate(${w / 2 - 34},18)"><rect x="0" y="0" width="68" height="34" rx="8" fill="#FFF8F0" stroke="#2A1B4E" stroke-width="3"/><text x="34" y="23" font-family="Fredoka,sans-serif" font-size="16" font-weight="700" fill="#2A1B4E" text-anchor="middle">🚧</text><line x1="34" y1="34" x2="34" y2="60" stroke="#2A1B4E" stroke-width="3.5"/></g>`;
    wrap.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${fence}${sign}</svg>`;
    // two hard-hat Boos hammering (CSS keyframes, transform-only)
    for (const [i, x] of [[0, 34], [1, w - 76]]) {
      const b = el('div', { class: 'cs-boo b' + i });
      b.style.left = x + 'px';
      b.innerHTML = `<svg viewBox="0 0 60 60" width="46" height="46" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="30" cy="38" rx="18" ry="16" fill="${i ? '#8F7FF0' : '#C6A9F0'}" stroke="#2A1B4E" stroke-width="3"/>
        <circle cx="24" cy="35" r="3" fill="#2A1B4E"/><circle cx="36" cy="35" r="3" fill="#2A1B4E"/>
        <path d="M22 44 Q30 49 38 44" fill="none" stroke="#2A1B4E" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M14 26 Q30 10 46 26 L46 30 L14 30 Z" fill="#FFC93C" stroke="#2A1B4E" stroke-width="3"/>
        <rect x="24" y="8" width="12" height="8" rx="3" fill="#FFC93C" stroke="#2A1B4E" stroke-width="2.5"/>
        <g class="cs-hammer"><rect x="44" y="30" width="4" height="18" rx="2" fill="#8A5A44"/><rect x="39" y="26" width="14" height="8" rx="3" fill="#9AA2B8" stroke="#2A1B4E" stroke-width="2"/></g>
      </svg>`;
      wrap.appendChild(b);
    }
    for (const i of [0, 1, 2]) {
      const d = el('div', { class: 'cs-dust d' + i, text: '💨' });
      d.style.left = (60 + i * 55) + 'px';
      wrap.appendChild(d);
    }
    return wrap;
  }

  // The reveal ceremony: fence drops, confetti, guide line, Journal stamp (C6).
  function playGrowthReveal(m) {
    sfx.fanfare();
    const ov = el('div', { class: 'overlay growth-reveal' });
    const panel = el('div', { class: 'card gr-panel' }, [
      el('h2', { class: 'gr-title', text: '🔨 Ta-daa!' }),
      el('p', { class: 'gr-line', text: guideLine('builders') }),
      el('div', { class: 'gr-scene' }, [
        el('div', { class: 'gr-upgrade', html: `<div class="gr-name">${m.name}</div>` }),
        el('div', { class: 'gr-fence' })
      ]),
      el('button', { class: 'btn big', text: 'Hooray! 🎉', onclick: () => {
        sfx.tap(); ov.remove();
        completeReveal(m.idx);
        renderPlaced();   // the upgrade appears (and any queued site starts)
      } })
    ]);
    ov.appendChild(panel);
    root.appendChild(ov);
    requestAnimationFrame(() => { ov.classList.add('show'); setTimeout(() => panel.querySelector('.gr-fence').classList.add('drop'), REDUCED ? 0 : 500); });
    confetti({ count: 110, power: 1.1 });
    speakMaybe(guideLine('builders'));
  }

  // ---- the Boo Funfair (RUN6 C1b) -----------------------------------------
  function ownedBooIds() {
    const st = getState(); const ids = [];
    for (const id of Object.keys(st.inventory || {})) { if ((st.inventory[id] || 0) > 0) { const it = resolveItem(id); if (it && it.kind === 'boo') ids.push(id); } }
    return ids;
  }
  function renderFunfair() {
    ground.querySelectorAll('.ff-ride, .ff-consite, .ff-scenery-wrap').forEach(n => n.remove());
    if (!funfairUnlocked()) return;
    const zi = ZONE_INDEX['funfair'];
    const view = funfairView();
    // fair scenery (bunting, string lights, ticket booth, popcorn cart) in the ground
    // layer so it lines up with the rides; night makes the string lights glow (C1b)
    const sc = el('div', { class: 'ff-scenery-wrap', html: fairSceneryFor(zoneW, viewH, isNight(currentHour())) });
    sc.style.left = (zi * zoneW) + 'px'; sc.style.top = '0'; sc.style.width = zoneW + 'px'; sc.style.height = viewH + 'px'; sc.style.zIndex = '1';
    ground.insertBefore(sc, ground.firstChild);
    for (const ride of view.built) {
      const box = renderRide(ride);
      const px = zi * zoneW + RIDE_X[ride] * zoneW;
      box.style.left = (px - 95) + 'px';           // RIDE_BOX/2
      box.style.top = (groundY - 152) + 'px';
      box.style.zIndex = String(Math.round(groundY));
      attachRidePointer(box, ride);
      ground.appendChild(box);
    }
    if (view.site) ground.appendChild(ffSiteNode(view.site, zi * zoneW + RIDE_X[view.site] * zoneW));
    renderBandstand(zi);
  }
  // The bandstand: a roofed stage with today's trio (drummer / keys / guitarist).
  // Tapping it opens the Boo Band; watch mode animates the trio to the band song (C1c).
  let bandBooEls = {};
  function renderBandstand(zi) {
    ground.querySelectorAll('.ff-bandstand').forEach(n => n.remove());
    bandBooEls = {};
    const trio = bandTrio();
    const box = el('div', { class: 'ff-bandstand', dataset: { ride: 'band' } });
    box.style.width = '210px'; box.style.height = '170px';
    box.style.left = (zi * zoneW + BANDSTAND_X * zoneW - 105) + 'px';
    box.style.top = (groundY - 150) + 'px';
    box.style.zIndex = String(Math.round(groundY) + 1);
    box.innerHTML = `<svg class="ff-struct" viewBox="0 0 210 170" width="210" height="170" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="118" width="174" height="14" rx="4" fill="#B98A5A" stroke="#2A1B4E" stroke-width="3"/>
      <rect x="26" y="60" width="8" height="58" fill="#8A5A44" stroke="#2A1B4E" stroke-width="2"/>
      <rect x="176" y="60" width="8" height="58" fill="#8A5A44" stroke="#2A1B4E" stroke-width="2"/>
      <path d="M8 62 L105 20 L202 62 Z" fill="#FF5C8A" stroke="#2A1B4E" stroke-width="3"/>
      ${Array.from({ length: 7 }, (_, i) => `<path d="M${20 + i * 26} 62 l13 0 l-6.5 14 z" fill="${i % 2 ? '#FFF8F0' : '#FFC93C'}"/>`).join('')}
      <rect x="88" y="8" width="34" height="16" rx="4" fill="#FFF8F0" stroke="#2A1B4E" stroke-width="2"/>
      <text x="105" y="20" font-family="Fredoka,sans-serif" font-size="11" font-weight="700" fill="#2A1B4E" text-anchor="middle">♪ BAND</text></svg>`;
    const slots = [['drummer', 52], ['keys', 105], ['guitarist', 158]];
    for (const [roleKey, x] of slots) {
      const id = trio[roleKey]; const item = resolveItem(id);
      const b = el('div', { class: 'bs-boo bs-' + roleKey });
      b.style.left = (x - 24) + 'px'; b.style.top = '74px';
      if (item) b.innerHTML = renderItem(item, { size: 48, equipArt: item.kind === 'boo' ? equippedArt(id) : null });
      bandBooEls[roleKey] = b; box.appendChild(b);
    }
    attachBandstandPointer(box);
    ground.appendChild(box);
  }
  function attachBandstandPointer(box) {
    let down = false, moved = false, sx = 0, sy = 0;
    box.addEventListener('pointerdown', e => { e.stopPropagation(); down = true; moved = false; sx = e.clientX; sy = e.clientY; box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', e => { if (down && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) moved = true; });
    box.addEventListener('pointerup', e => { e.stopPropagation(); if (down && !moved) { sfx.tap(); ctx.go('band'); } down = false; });
    box.addEventListener('pointercancel', () => { down = false; });
  }
  function onBandNote(ev) {
    if (REDUCED) return;
    const roleKey = ev.i === 'drum' ? 'drummer' : ev.i === 'key' ? 'keys' : 'guitarist';
    const b = bandBooEls[roleKey]; if (!b) return;
    b.classList.remove('bs-play'); void b.offsetWidth; b.classList.add('bs-play');
  }
  function ffSiteNode(ride, px) {
    const wrap = el('div', { class: 't-growth ff-consite' });
    const w = 200, h = 150;
    wrap.style.left = (px - w / 2) + 'px';
    wrap.style.top = (groundY - h + 24) + 'px';
    wrap.style.zIndex = String(Math.round(groundY));
    const fence = Array.from({ length: 5 }, (_, i) => `<rect x="${12 + i * 40}" y="96" width="12" height="42" rx="3" fill="#E8B04B" stroke="#2A1B4E" stroke-width="2.5"/>`).join('') +
      `<rect x="6" y="102" width="${w - 12}" height="9" rx="4" fill="#F4C96B" stroke="#2A1B4E" stroke-width="2.5"/><rect x="6" y="120" width="${w - 12}" height="9" rx="4" fill="#F4C96B" stroke="#2A1B4E" stroke-width="2.5"/>`;
    const sign = `<g transform="translate(${w / 2 - 52},14)"><rect x="0" y="0" width="104" height="40" rx="8" fill="#FFF8F0" stroke="#2A1B4E" stroke-width="3"/><text x="52" y="18" font-family="Fredoka,sans-serif" font-size="12" font-weight="700" fill="#2A1B4E" text-anchor="middle">🚧 building…</text><text x="52" y="33" font-family="Fredoka,sans-serif" font-size="12" font-weight="700" fill="#FF5C8A" text-anchor="middle">${RIDE_NAME[ride]}</text></g>`;
    wrap.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${sign}${fence}</svg>`;
    for (const [i, x] of [[0, 26], [1, w - 66]]) {
      const b = el('div', { class: 'cs-boo b' + i }); b.style.left = x + 'px';
      b.innerHTML = `<svg viewBox="0 0 60 60" width="42" height="42" xmlns="http://www.w3.org/2000/svg"><ellipse cx="30" cy="38" rx="18" ry="16" fill="${i ? '#8F7FF0' : '#C6A9F0'}" stroke="#2A1B4E" stroke-width="3"/><circle cx="24" cy="35" r="3" fill="#2A1B4E"/><circle cx="36" cy="35" r="3" fill="#2A1B4E"/><path d="M14 26 Q30 10 46 26 L46 30 L14 30 Z" fill="#FFC93C" stroke="#2A1B4E" stroke-width="3"/><g class="cs-hammer"><rect x="44" y="30" width="4" height="18" rx="2" fill="#8A5A44"/><rect x="39" y="26" width="14" height="8" rx="3" fill="#9AA2B8" stroke="#2A1B4E" stroke-width="2"/></g></svg>`;
      wrap.appendChild(b);
    }
    return wrap;
  }
  function attachRidePointer(box, ride) {
    let down = false, moved = false, sx = 0, sy = 0;
    box.addEventListener('pointerdown', e => { e.stopPropagation(); down = true; moved = false; sx = e.clientX; sy = e.clientY; box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', e => { if (down && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) moved = true; });
    box.addEventListener('pointerup', e => { e.stopPropagation(); if (down && !moved) openRidePicker(ride); down = false; });
    box.addEventListener('pointercancel', () => { down = false; });
  }
  function openRidePicker(ride) {
    sfx.tap();
    const boos = ownedBooIds();
    const ov = el('div', { class: 'overlay ride-picker', onclick: (e) => { if (e.target === ov) { ov.remove(); renderPlaced(); } } });
    const count = el('p', { class: 'rp-count' });
    const grid = el('div', { class: 'rp-grid' });
    function refresh() {
      const seats = seatsFor(ride); const taken = seats.filter(Boolean).length;
      count.textContent = `${taken} / ${RIDE_SEATS[ride]} aboard — tap a Boo to hop on or off`;
      clear(grid);
      if (!boos.length) { grid.appendChild(el('p', { class: 'rp-empty', text: 'Win some Boos first, then bring them to the fair!' })); return; }
      for (const id of boos) {
        const seated = isSeated(id);
        const onThis = seated && seated.ride === ride;
        const elsewhere = seated && seated.ride !== ride;
        const full = emptySeatCount(ride) === 0;
        const item = resolveItem(id);
        const tile = el('button', { class: 'rp-tile' + (onThis ? ' aboard' : '') + (elsewhere ? ' busy' : ''),
          disabled: (elsewhere || (!onThis && full)) ? '' : undefined,
          onclick: () => { sfx.tap(); if (onThis) unseatBoo(ride, id); else seatBoo(ride, id); refresh(); renderFunfair(); } }, [
          el('div', { class: 'rp-art', html: renderItem(item, { size: 52, equipArt: item.kind === 'boo' ? equippedArt(id) : null }) }),
          el('span', { class: 'rp-name', text: getDisplayName(id) || (item && item.name) || 'Boo' }),
          el('span', { class: 'rp-status', text: onThis ? '🎡 aboard' : elsewhere ? 'on ' + RIDE_NAME[seated.ride] : (full ? 'ride full' : 'tap to ride') })
        ]);
        grid.appendChild(tile);
      }
    }
    refresh();
    ov.appendChild(el('div', { class: 'card rp-card' }, [
      el('h3', { text: `Who's riding the ${RIDE_NAME[ride]}?` }), count, grid,
      el('button', { class: 'btn', text: 'Done', onclick: () => { ov.remove(); renderPlaced(); } })
    ]));
    root.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
  }
  function pickBoardableRide(a) {
    if (a.place.zone !== 'funfair' || !funfairUnlocked()) return null;
    const view = funfairView();
    const cands = view.built.filter(r => emptySeatCount(r) > 0 && Math.abs(RIDE_X[r] - a.place.x) < 0.5);
    cands.sort((p, q) => Math.abs(RIDE_X[p] - a.place.x) - Math.abs(RIDE_X[q] - a.place.x));
    return cands[0] || null;
  }
  function stepFunfairRides(now) {
    const rides = ground.querySelectorAll('.ff-ride');
    for (const box of rides) {
      const px = parseFloat(box.style.left) + 95 - scrollX;
      if (px < -220 || px > viewW + 220) continue;   // only the visible zone's rides animate (perf)
      stepRide(box, box.dataset.ride, now);
    }
  }
  function playFunfairReveal(ride) {
    sfx.fanfare();
    const ov = el('div', { class: 'overlay growth-reveal' });
    const panel = el('div', { class: 'card gr-panel' }, [
      el('h2', { class: 'gr-title', text: '🎡 Ta-daa!' }),
      el('p', { class: 'gr-line', text: `The ${RIDE_NAME[ride]} is ready! Hop on!` }),
      el('div', { class: 'gr-scene' }, [el('div', { class: 'gr-upgrade', html: `<div class="gr-name">${RIDE_NAME[ride]}</div>` }), el('div', { class: 'gr-fence' })]),
      el('button', { class: 'btn big', text: 'Hooray! 🎉', onclick: () => { sfx.tap(); ov.remove(); completeRideReveal(ride); renderFunfair(); scrollToZone(ZONE_INDEX['funfair']); } })
    ]);
    ov.appendChild(panel); root.appendChild(ov);
    requestAnimationFrame(() => { ov.classList.add('show'); setTimeout(() => panel.querySelector('.gr-fence').classList.add('drop'), REDUCED ? 0 : 500); });
    if (!REDUCED) confetti({ count: 110, power: 1.1 });
    speakMaybe(`The ${RIDE_NAME[ride]} is ready!`);
  }

  // ---- activity roles (RUN4 C5) -------------------------------------------
  // Every activity deco claims nearby free Boos: slide/swings/trampoline/pool/
  // bumper take one, seesaw and picnic need two, the campfire gathers a small
  // circle at night, and Boos near a Boo House curl up asleep between 21:00 and
  // 07:00. The old bench-seat and pond-paddle promises (RUN2 C3) live here too.
  // Idempotent: safe to re-run every few seconds and on every re-render.
  const benchCooldown = new Map();   // 'zone:x' -> timestamp
  function assignRoles() {
    const st = getState();
    const now = performance.now();
    const night = isSleepTime(currentHour());
    let roleCount = actors.filter(a => a.role).length;
    const wrapFor = (t) => [...ground.querySelectorAll('.t-item')].find(w => w.dataset.zone === t.zone && Math.abs(+w.dataset.x - t.x) < 0.001 && w.dataset.item === t.item);
    // Use the Boo's CURRENT position (home + wander offset) so a Boo that walked
    // UP to an activity (C1 behaviour engine) gets claimed on arrival, not just one
    // that happened to be placed beside it. Goal-pursuers aren't yanked mid-act.
    const curX = (a) => a.place.x + ((a.dx || 0) / (zoneW || 1));
    const freeNear = (t, radius) => actors
      .filter(a => !a.role && !a.dancing && !a.goal && ZONE_INDEX[a.place.zone] === ZONE_INDEX[t.zone] && Math.abs(curX(a) - t.x) <= radius)
      .sort((p, q) => Math.abs(curX(p) - t.x) - Math.abs(curX(q) - t.x));
    const give = (a, role) => {
      if (roleCount >= MAX_ACTIVE_ROLES) return false;
      a.goal = null; a.dx = 0; a.depth = 0; a.depthTarget = 0;   // claimed → drop any goal + wander offset (C1)
      a.role = Object.assign({ t: Math.random() * 500 }, role);
      a.role.offX = (role.deco.x - a.place.x) * zoneW;
      // Depth-align to the deco's row (C3): sit the Boo on the activity's baseline so
      // the role transforms (which assume a shared ground line) still read correctly.
      const dw = role.decoWrap || wrapFor(role.deco);
      if (dw) { if (a._homeTop == null) { a._homeTop = a.wrap.style.top; a._homeZ = a.wrap.style.zIndex; } a.wrap.style.top = dw.style.top; a.wrap.style.zIndex = dw.style.zIndex; }
      roleCount++;
      if (role.kind === 'sleep' && !a.wrap.querySelector('.t-zzz')) {
        a.wrap.appendChild(el('div', { class: 't-zzz', text: 'z Z z' }));
      }
      return true;
    };
    // stale roles: daytime ends sleep + campfire circles
    for (const a of actors) {
      if (!a.role) continue;
      if ((a.role.kind === 'sleep' || a.role.kind === 'campfire') && !night) clearRole(a);
      if (a.role && a.role.kind === 'sleep' && a.wakeUntil && now < a.wakeUntil) clearRole(a);
    }
    const decosOf = (id) => st.town.filter(t => t.item === id);
    // 1) night: sleep near Boo Houses (skip recently woken — rule 1, no forced naps)
    if (night) for (const t of decosOf('deco_boohouse')) {
      for (const a of freeNear(t, ACT_RADIUS)) {
        if (a.wakeUntil && now < a.wakeUntil) continue;
        give(a, { kind: 'sleep', deco: t });
      }
    }
    // 2) night: the campfire circle (up to 3 Boos warm their paws)
    if (night) for (const t of decosOf('deco_campfire')) {
      freeNear(t, ACT_RADIUS + 0.05).slice(0, 3).forEach((a, i) => give(a, { kind: 'campfire', deco: t, decoWrap: wrapFor(t), slot: i }));
    }
    // 3) two-Boo activities — only start when BOTH seats can fill
    for (const t of decosOf('deco_seesaw')) {
      const pair = freeNear(t, ACT_RADIUS).slice(0, 2);
      if (pair.length === 2) pair.forEach((a, i) => give(a, { kind: 'seesaw', deco: t, decoWrap: wrapFor(t), slot: i }));
    }
    for (const t of decosOf('deco_picnic')) {
      const pair = freeNear(t, ACT_RADIUS).slice(0, 2);
      if (pair.length === 2) pair.forEach((a, i) => give(a, { kind: 'picnic', deco: t, decoWrap: wrapFor(t), slot: i }));
    }
    // 4) one-Boo activities
    const oneBoo = [['deco_slide', 'slide'], ['deco_swings', 'swing'], ['deco_trampoline', 'bounce'], ['deco_paddlepool', 'paddle'], ['deco_bumper', 'drive'], ['deco_pond', 'pondpaddle']];
    for (const [id, kind] of oneBoo) for (const t of decosOf(id)) {
      const a = freeNear(t, ACT_RADIUS)[0];
      if (a) give(a, { kind, deco: t, decoWrap: wrapFor(t) });
    }
    // 5) the bench seats a nearby Boo now and then (RUN2 C3 debt)
    for (const t of decosOf('deco_bench')) {
      const key = t.zone + ':' + t.x;
      if ((benchCooldown.get(key) || 0) > now) continue;
      const a = freeNear(t, ACT_RADIUS)[0];
      if (a && give(a, { kind: 'sit', deco: t, decoWrap: wrapFor(t), until: now + BENCH_SIT_MS })) {
        benchCooldown.set(key, now + BENCH_SIT_MS + BENCH_COOLDOWN_MS);
      }
    }
  }
  function clearRole(a) {
    a.role = null;
    a.wrap.querySelectorAll('.t-zzz').forEach(n => n.remove());
    if (a._homeTop != null) { a.wrap.style.top = a._homeTop; a.wrap.style.zIndex = a._homeZ || ''; a._homeTop = null; a._homeZ = null; }   // restore its depth row (C3)
    const svg = a.wrap.querySelector('svg');
    if (svg) svg.style.transform = '';
  }

  // One animation step for a Boo with a role — transform-only, like everything.
  function stepRole(a, dt, now) {
    const r = a.role;
    r.t += dt;
    const svg = a.wrap.querySelector('svg');
    if (!svg) return;
    const t = r.t;
    switch (r.kind) {
      case 'sleep': {
        const breathe = 1 + Math.sin(t / 900) * 0.025;
        svg.style.transform = `translateY(9px) scale(1.06, ${(0.84 * breathe).toFixed(3)})`;
        break;
      }
      case 'swing': {
        const ang = Math.sin(t / 700) * 20, rad = ang * Math.PI / 180, L = 46;
        svg.style.transform = `translate(${(r.offX + Math.sin(rad) * L).toFixed(1)}px, ${(-30 - (1 - Math.cos(rad)) * L).toFixed(1)}px) rotate(${(ang * 0.55).toFixed(1)}deg) scale(0.82)`;
        const seat = r.decoWrap && r.decoWrap.querySelector('.sw-seat');
        if (seat) { seat.style.transformOrigin = '60px 40px'; seat.style.transform = `rotate(${ang.toFixed(1)}deg)`; }
        break;
      }
      case 'slide': {
        const C = 3600, p = (t + (r.phase || 0)) % C;
        const ladderX = r.offX - 36, endX = r.offX + 44, topY = -82;
        let x = 0, y = 0, rot = 0;
        if (p < 800) { x = lerp(0, ladderX, p / 800); }
        else if (p < 1900) { x = ladderX; y = topY * ((p - 800) / 1100); }
        else if (p < 2200) { x = ladderX; y = topY; }
        else if (p < 2900) {
          const k = (p - 2200) / 700; x = lerp(ladderX, endX, k); y = topY * (1 - k * k); rot = 16 * k;
          if (!r.wheeed) { r.wheeed = true; const w = el('div', { class: 't-wheee', text: 'wheee!' }); a.wrap.appendChild(w); setTimeout(() => w.remove(), 800); }
        }
        else { x = lerp(endX, 0, (p - 2900) / 700); r.wheeed = false; }
        svg.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(0.82)`;
        break;
      }
      case 'seesaw': {
        const s = Math.sin(t / 800);
        const side = r.slot === 0 ? -1 : 1;
        const endY = side * s * 15;                       // plank end height
        const hop = Math.max(0, side * s) * 10;           // little pop at the top
        svg.style.transform = `translate(${(r.offX + side * 52).toFixed(1)}px, ${(-32 + endY - hop).toFixed(1)}px) scale(0.8)`;
        if (r.slot === 0) {
          const plank = r.decoWrap && r.decoWrap.querySelector('.ss-plank');
          if (plank) plank.style.transform = `rotate(${(s * 8).toFixed(1)}deg)`;
        }
        break;
      }
      case 'bounce': {
        const y = -Math.abs(Math.sin(t / 480)) * 52;      // higher than the usual hop (12px)
        const squash = y > -5 ? ' scale(0.9, 0.74)' : ' scale(0.82)';
        svg.style.transform = `translate(${r.offX.toFixed(1)}px, ${(-26 + y).toFixed(1)}px)${squash}`;
        break;
      }
      case 'paddle': case 'pondpaddle': {
        const x = r.offX + Math.sin(t / 900) * 16;
        const y = (r.kind === 'paddle' ? -10 : -2) + Math.sin(t / 500) * 4;
        svg.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(Math.sin(t / 700) * 8).toFixed(1)}deg)`;
        if (r.kind === 'paddle') {
          const water = r.decoWrap && r.decoWrap.querySelector('.pp-water');
          if (water) { water.style.transformOrigin = '60px 94px'; water.style.transform = `scale(1, ${(1 + Math.sin(t / 500) * 0.06).toFixed(3)})`; }
        }
        break;
      }
      case 'picnic': {
        const side = r.slot === 0 ? -1 : 1;
        const nibble = Math.max(0, Math.sin((t + r.slot * 400) / 380)) * 0.07;
        svg.style.transform = `translate(${(r.offX + side * 30).toFixed(1)}px, 2px) rotate(${side * -4}deg) scale(0.86, ${(0.8 + nibble).toFixed(3)})`;
        break;
      }
      case 'drive': {
        const x = Math.sin(t / 1500) * 60;
        const flip = Math.cos(t / 1500) >= 0 ? 1 : -1;
        svg.style.transform = `translate(${(r.offX + x).toFixed(1)}px, -30px) scale(${flip * 0.72}, 0.72)`;
        const car = r.decoWrap && r.decoWrap.querySelector('.bc-car');
        if (car) { car.style.transformOrigin = '60px 96px'; car.style.transform = `translateX(${(x * 120 / 140).toFixed(1)}px) scaleX(${flip})`; }
        break;
      }
      case 'campfire': {
        const targets = [-46, 46, -70];   // a circle round the fire, flame visible between
        const tx = r.offX + targets[r.slot % 3];
        const arrive = Math.min(1, t / 1400);
        const sway = arrive >= 1 ? Math.sin(t / 600 + r.slot) * 3 : 0;
        const warm = arrive >= 1 ? 1 + Math.max(0, Math.sin(t / 520 + r.slot * 2)) * 0.04 : 1;
        svg.style.transform = `translate(${(lerp(0, tx, arrive)).toFixed(1)}px, 0px) rotate(${sway.toFixed(1)}deg) scale(${warm.toFixed(3)})`;
        break;
      }
      case 'sit': {
        const settle = Math.min(1, t / 600);
        const kick = settle >= 1 ? Math.sin(t / 1000) * 3 : 0;
        svg.style.transform = `translate(${(r.offX * settle).toFixed(1)}px, ${(-10 * settle).toFixed(1)}px) rotate(${kick.toFixed(1)}deg)`;
        if (r.until && now > r.until) clearRole(a);
        break;
      }
    }
  }

  // Overlay the chosen artwork onto any placed Easel (RUN3 C6).
  async function decorateEasels() {
    const artId = getState().easelArt;
    const easels = ground.querySelectorAll('.t-item[data-item="deco_easel"]');
    if (!easels.length) return;
    let png = null;
    if (artId) { const rec = await idbGet('artworks', artId).catch(() => null); png = rec && rec.png; }
    easels.forEach(wrap => {
      const slot = wrap.querySelector('.easel-slot');
      wrap.querySelectorAll('image.easel-photo').forEach(n => n.remove());
      if (slot && png) {
        const NS = 'http://www.w3.org/2000/svg';
        const img = document.createElementNS(NS, 'image');
        img.setAttribute('class', 'easel-photo');
        img.setAttribute('x', +slot.getAttribute('x') + 4); img.setAttribute('y', +slot.getAttribute('y') + 4);
        img.setAttribute('width', +slot.getAttribute('width') - 8); img.setAttribute('height', +slot.getAttribute('height') - 8);
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        img.setAttribute('href', png); img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', png);
        slot.parentNode.appendChild(img);
      }
    });
  }

  async function chooseEaselArt() {
    const arts = await listArtworks();
    const ov = el('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) ov.remove(); } });
    const grid = el('div', { class: 'easel-choose-grid' });
    if (!arts.length) grid.appendChild(el('p', { text: 'Paint or build some art in the Studio first!' }));
    arts.forEach(a => { const b = el('button', { class: 'easel-choose-tile', onclick: () => { mutate(s => { s.easelArt = a.id; }); ov.remove(); renderPlaced(); } }); b.appendChild(el('img', { src: a.png, class: 'easel-choose-img' })); grid.appendChild(b); });
    ov.appendChild(el('div', { class: 'card', style: { padding: '18px', maxWidth: '480px' } }, [el('h3', { text: 'Choose art for your easel' }), grid, el('button', { class: 'btn soft', text: 'Close', onclick: () => ov.remove() })]));
    root.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
  }

  // Dance Stage: Boos near a stage bop — or perform its saved routine on loop (RUN3 C8).
  let routineTimer = null;
  function applyDance() {
    const st = getState();
    const stages = st.town.filter(t => t.item === 'deco_stage');
    for (const a of actors) {
      const stage = stages.find(sg => (ZONE_INDEX[sg.zone] === ZONE_INDEX[a.place.zone]) && Math.abs(sg.x - a.place.x) < 0.14);
      a.dancing = !!stage;
      a.routine = stage ? routineFor(stage) : null;
      a.routineIdx = 0;
      const svg = a.wrap.querySelector('svg');
      if (svg) {
        if (a.dancing && a.routine && a.routine.length && !REDUCED) svg.classList.remove('art-dance');   // routine loop drives it
        else svg.classList.toggle('art-dance', a.dancing && !REDUCED);
      }
    }
    startRoutineLoop();
  }
  function startRoutineLoop() {
    if (routineTimer) { clearInterval(routineTimer); routineTimer = null; }
    if (REDUCED || !actors.some(a => a.dancing && a.routine && a.routine.length)) return;
    routineTimer = setInterval(() => {
      for (const a of actors) {
        if (a.dancing && a.routine && a.routine.length) { applyMove(a.wrap.querySelector('svg'), a.routine[a.routineIdx % a.routine.length]); a.routineIdx++; }
      }
    }, STEP_MS);
  }

  // Show the active request's thought bubble over its Boo, and a treat if one was just fulfilled.
  function renderRequestBubble() {
    ground.querySelectorAll('.request-bubble, .request-treat').forEach(n => n.remove());
    const a = activeRequest();
    if (a) { const w = [...ground.querySelectorAll('.t-item.boo')].find(x => x.dataset.item === a.booId); if (w) w.appendChild(el('div', { class: 'request-bubble', text: a.text })); }
    const treatBoo = takeTreat();
    if (treatBoo) { const w = [...ground.querySelectorAll('.t-item')].find(x => x.dataset.item === treatBoo); if (w) { const t = el('div', { class: 'request-treat', text: '💖 Thank you!' }); w.appendChild(t); if (!REDUCED) confetti({ count: 24, power: 0.6, origin: pointFor(w) }); setTimeout(() => t.remove(), 2200); } }
  }
  function pointFor(node) { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; }

  // ---- scrolling (momentum) ----------------------------------------------
  function applyScroll() {
    ground.style.transform = `translateX(${-scrollX}px)`;
    hills.style.transform = `translateX(${-scrollX * 0.55}px)`;
    sky.style.transform = `translateX(${-scrollX * 0.22}px)`;
    air.style.transform = `translateX(${-scrollX}px)`;
    updateZoneMusic();
  }
  // Zone audio (RUN6 C1b/C1c): the calm town loop everywhere, the fair jingle while
  // the (unlocked) funfair is on screen, and — when the bandstand itself is in view —
  // the BAND performs its song, replacing the jingle. All obey the music mute.
  let _zoneMusic = null, bandWatch = null;
  function updateZoneMusic() {
    if (!zoneW) return;
    const zi = Math.floor((scrollX + viewW / 2) / zoneW);
    let want = 'calm';
    if (ZONES[zi] && ZONES[zi].key === 'funfair' && funfairUnlocked()) {
      const bandPx = ZONE_INDEX['funfair'] * zoneW + BANDSTAND_X * zoneW - scrollX;
      want = (bandPx > -80 && bandPx < viewW + 80) ? 'band' : 'fair';
    }
    if (want === _zoneMusic) return;
    _zoneMusic = want;
    if (want === 'band') { music.stop(); startBand(); }
    else { stopBand(); music.play(want); }
  }
  function startBand() {
    stopBand();
    getBandSongEvents().then(jam => { if (_zoneMusic !== 'band') return; bandWatch = startBandWatch(jam, onBandNote); });
  }
  function stopBand() { if (bandWatch) { bandWatch.stop(); bandWatch = null; } }
  function clampScroll() { scrollX = Math.max(0, Math.min(scrollX, Math.max(0, worldW - viewW))); }
  function scrollToZone(zi, smooth = true) {
    // centre the (wide) zone in the viewport as best we can
    const target = Math.max(0, Math.min(zi * zoneW + (zoneW - viewW) / 2, worldW - viewW));
    if (!smooth || REDUCED) { scrollX = target; clampScroll(); applyScroll(); return; }
    const from = scrollX, dt0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - dt0) / 650);
      const e = 1 - Math.pow(1 - p, 3);
      scrollX = from + (target - from) * e; clampScroll(); applyScroll();
      if (p < 1) requestAnimationFrame(step);
    })(dt0);
  }

  let dragScroll = false, sx = 0, sScroll = 0, vel = 0, lastX = 0, lastT = 0, momRaf = null, movedScroll = false;
  viewport.addEventListener('pointerdown', e => {
    if (e.target.closest('.t-item') || e.target.closest('.t-signpost') || e.target.closest('.ff-ride') || e.target.closest('.ff-bandstand')) return; // items/rides/bandstand handle their own
    if (momRaf) { cancelAnimationFrame(momRaf); momRaf = null; }
    dragScroll = true; movedScroll = false; sx = e.clientX; sScroll = scrollX; vel = 0; lastX = e.clientX; lastT = performance.now();
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', e => {
    if (!dragScroll) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 4) movedScroll = true;
    scrollX = sScroll - dx; clampScroll(); applyScroll();
    const now = performance.now(); const dt = now - lastT;
    if (dt > 0) vel = (e.clientX - lastX) / dt;
    lastX = e.clientX; lastT = now;
  });
  const endScroll = (e) => {
    if (!dragScroll) return;
    dragScroll = false;
    // place-mode: a tap on empty ground places the held item here
    if (placeMode && holding && !movedScroll) { placeAtClient(e.clientX, e.clientY); return; }
    let v = vel * 16; // momentum
    if (Math.abs(v) < 0.5 || REDUCED) return;
    (function mom() {
      scrollX -= v; v *= 0.92; clampScroll(); applyScroll();
      if (Math.abs(v) > 0.4 && scrollX > 0 && scrollX < worldW - viewW) momRaf = requestAnimationFrame(mom);
    })();
  };
  viewport.addEventListener('pointerup', endScroll);
  viewport.addEventListener('pointercancel', () => { dragScroll = false; });
  viewport.addEventListener('wheel', e => { scrollX += e.deltaY + e.deltaX; clampScroll(); applyScroll(); }, { passive: true });

  // ---- placement ----------------------------------------------------------
  function clientToWorld(cx) {
    const r = viewport.getBoundingClientRect();
    return (cx - r.left) + scrollX;
  }
  function zoneAndXAt(worldX) {
    let zi = Math.floor(worldX / zoneW);
    zi = Math.max(0, Math.min(ZONES.length - 1, zi));
    const x = clamp01((worldX - zi * zoneW) / zoneW);
    return { zi, x };
  }
  function canPlaceIn(zi) { return totalStars() >= ZONES[zi].unlock; }
  // Which depth row a drop lands in — nearest of the three ground lines (C3).
  function rowAtClient(cy) {
    const r = viewport.getBoundingClientRect();
    const yf = (cy - r.top) / (r.height || 1);
    let best = 1, bd = Infinity;
    ROW_GROUND.forEach((g, i) => { const d = Math.abs(yf - g); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // Minimum spacing (C3): no piling two items on top of each other in a zone+row.
  function spotTaken(zi, x, row, except) {
    return getState().town.some(t => t !== except && (ZONE_INDEX[t.zone] ?? 0) === zi && rowOf(t) === row && Math.abs(t.x - x) < MIN_SPACING);
  }
  function spotWobble() {
    drawer.classList.remove('taken'); void drawer.offsetWidth; drawer.classList.add('taken');
    setTimeout(() => drawer.classList.remove('taken'), 600);
    hint.textContent = "That spot's taken — try a little further along!";
    if (sfx.oops) sfx.oops();
  }

  function placeAtClient(cx, cy) {
    const { zi, x } = zoneAndXAt(clientToWorld(cx));
    if (!canPlaceIn(zi)) { flashLocked(zi); return; }
    const row = rowAtClient(cy);
    if (spotTaken(zi, x, row)) { spotWobble(); return; }   // keep holding it, try again
    const id = holding;
    mutate(st => { st.town.push({ zone: ZONES[zi].key, x: +x.toFixed(3), row, item: id }); });
    holding = null; placeMode = false;
    renderPlaced(); renderDrawer(); updateHint();
    sfx.pop();
  }

  function renderDrawer() {
    clear(drawer);
    const st = getState();
    const placed = {};
    for (const t of st.town) placed[t.item] = (placed[t.item] || 0) + 1;
    const free = {};
    for (const [id, n] of Object.entries(st.inventory)) {
      const rit = resolveItem(id); if (!rit || rit.kind === "accessory") continue; // accessories are worn
      const f = n - (placed[id] || 0);
      if (f > 0) free[id] = f;
    }
    const ids = Object.keys(free);
    if (holding && !ids.includes(holding)) ids.unshift(holding);
    if (!ids.length && !holding) {
      drawer.appendChild(el('div', { class: 'drawer-empty', text: 'Win games to collect Boos, then place them here! 🌱' }));
      return;
    }
    for (const id of ids) {
      const item = resolveItem(id);
      const chip = el("button", { class: 'drawer-item' + (holding === id ? ' holding' : ''), dataset: { item: id },
        onclick: () => selectHold(id) }, [
        el('div', { class: 'drawer-art', html: renderItem(item, { size: 60, equipArt: item.kind === 'boo' ? equippedArt(item.id) : null }) }),
        free[id] > 1 ? el('span', { class: 'drawer-badge', text: 'x' + free[id] }) : null
      ]);
      makeDrawerDraggable(chip, id);
      drawer.appendChild(chip);
    }
  }
  function selectHold(id) {
    sfx.tap();
    holding = (holding === id) ? null : id;
    placeMode = !!holding;
    renderDrawer(); updateHint();
  }

  // ---- placed-item pointer: tap (squeak+menu) or drag-move ----------------
  function attachItemPointer(wrap, place, item) {
    let down = false, moved = false, dsx = 0, dsy = 0, ghost = null;
    wrap.addEventListener('pointerdown', e => {
      if (placeMode) return;
      // Taps on the popover menu belong to its buttons. Capturing them here
      // retargeted the click to the wrap, so Move / Put away / Dress up /
      // Choreograph taps NEVER fired (shipped bug since RUN2, found in RUN4 p9).
      // Stop propagation too: the document-level close-menu listener would
      // otherwise remove the menu before the button's click can fire.
      if (e.target.closest && e.target.closest('.plot-menu')) { e.stopPropagation(); return; }
      e.stopPropagation();
      down = true; moved = false; dsx = e.clientX; dsy = e.clientY;
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (!down) return;
      if (!moved && Math.hypot(e.clientX - dsx, e.clientY - dsy) > 10) {
        moved = true; wrap.classList.add('dragging');
      }
      if (moved) {
        const { zi, x } = zoneAndXAt(clientToWorld(e.clientX));
        const row = rowAtClient(e.clientY);
        const rowGroundPx = viewH * ROW_GROUND[row];
        wrap.style.left = (zi * zoneW + x * zoneW - wrap.offsetWidth / 2) + 'px';
        wrap.style.top = (rowGroundPx - wrap.offsetHeight + 8) + 'px';   // preview the depth row
        wrap.style.zIndex = String(Math.round(rowGroundPx));
        wrap.dataset._zi = zi; wrap.dataset._x = x; wrap.dataset._row = String(row);
      }
    });
    wrap.addEventListener('pointerup', e => {
      if (!down) return; down = false;
      wrap.classList.remove('dragging');
      if (moved) {
        const zi = +wrap.dataset._zi, x = +wrap.dataset._x, row = +wrap.dataset._row;
        const cur = getState().town.find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001 && rowOf(t) === rowOf(place));
        if (canPlaceIn(zi) && !spotTaken(zi, x, row, cur)) {
          mutate(st => { const t = st.town.find(t => t === cur) || st.town.find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001); if (t) { t.zone = ZONES[zi].key; t.x = +x.toFixed(3); t.row = row; } });
        } else if (canPlaceIn(zi)) {
          spotWobble();   // occupied — snap back
        }
        renderPlaced();
      } else {
        onTap(wrap, place, item);
      }
    });
    wrap.addEventListener('pointercancel', () => { down = false; wrap.classList.remove('dragging'); });
  }

  function onTap(wrap, place, item) {
    if (item.kind === 'boo') squeak(wrap, item);
    openMenu(wrap, place, item);
  }

  function wakeIfSleeping(wrap) {
    const a = actors.find(x => x.wrap === wrap);
    if (!a || !a.role || a.role.kind !== 'sleep') return false;
    // waking is gentle (rule 1): a sleepy blink, no grumpiness, up for a while
    a.wakeUntil = performance.now() + WAKE_MS;
    clearRole(a);
    const svg = wrap.querySelector('svg');
    if (svg && !REDUCED) { svg.classList.remove('sleepy-blink'); void svg.offsetWidth; svg.classList.add('sleepy-blink'); }
    return true;
  }

  function squeak(wrap, item) {
    wakeIfSleeping(wrap);
    // a tap always interrupts a chosen behaviour (C1): the Boo drops what it was doing
    const a = actors.find(x => x.wrap === wrap);
    if (a && a.goal) endGoal(a);
    // her own recorded voice plays instead of the squeak, only on tap (never ambient)
    if (voiceIds.has(item.id)) playVoice(item.id); else sfx.pop();
    noteQuest('sayHello', { count: 1 });   // daily quest: say hello to Boos (RUN3 C4)
    const svg = wrap.querySelector('svg');
    if (svg && !REDUCED) { svg.classList.remove('squeak'); void svg.offsetWidth; svg.classList.add('squeak'); }
    const heart = el('div', { class: 'pop-heart', text: '❤' }); wrap.appendChild(heart);
    setTimeout(() => heart.remove(), 900);
    const tag = el('div', { class: 'squeak-name', text: getDisplayName(item.id) }); wrap.appendChild(tag);
    setTimeout(() => tag.remove(), 1100);
  }

  let openPopover = null;
  function openMenu(wrap, place, item) {
    closeMenu();
    const btns = [];
    if (item.kind === 'boo') btns.push(el('button', { class: 'btn soft', text: 'Dress up', onclick: (e) => { e.stopPropagation(); closeMenu(); openDressUp(item, { onDone: () => renderPlaced() }); } }));
    if (item.deco === 'easel') btns.push(el('button', { class: 'btn soft', text: 'Choose art 🖼️', onclick: (e) => { e.stopPropagation(); closeMenu(); chooseEaselArt(); } }));
    if (item.deco === 'stage') {
      btns.push(el('button', { class: 'btn soft', text: 'Choreograph 💃', onclick: (e) => { e.stopPropagation(); closeMenu(); openChoreographer(place, { onDone: () => renderPlaced() }); } }));
      // the Parade (RUN4 C9): hidden while no Boos are placed; no reward — it exists to be shown off
      if (actors.length) btns.push(el('button', { class: 'btn soft', text: 'Parade 🎺', onclick: (e) => { e.stopPropagation(); closeMenu(); sfx.fanfare(); startParade(); } }));
    }
    btns.push(el('button', { class: 'btn soft', text: 'Move', onclick: (e) => { e.stopPropagation(); pickUp(place); } }));
    btns.push(el('button', { class: 'btn soft', text: 'Put away', onclick: (e) => { e.stopPropagation(); putAway(place); } }));
    const menu = el('div', { class: 'plot-menu' }, btns);
    wrap.appendChild(menu);
    openPopover = menu;
    ground.classList.add('menu-open');   // request bubbles fade so they never cover the menu
    // keep the popover fully on-screen (edge items / narrow screens): nudge it
    // horizontally and flip it below the item if it would clip the top edge
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      let dx = 0;
      if (r.left < 6) dx = 6 - r.left;
      else if (r.right > window.innerWidth - 6) dx = (window.innerWidth - 6) - r.right;
      if (dx) menu.style.transform = `translateX(calc(-50% + ${dx.toFixed(0)}px))`;
      if (r.top < 6) { menu.style.bottom = 'auto'; menu.style.top = '100%'; }
    });
    setTimeout(() => document.addEventListener('pointerdown', closeMenu, { once: true }), 0);
  }
  function closeMenu() { if (openPopover) { openPopover.remove(); openPopover = null; } ground.classList.remove('menu-open'); }

  function removePlacement(place) {
    mutate(st => { const i = st.town.findIndex(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001); if (i >= 0) st.town.splice(i, 1); });
  }
  function pickUp(place) { closeMenu(); removePlacement(place); holding = place.item; placeMode = true; renderPlaced(); renderDrawer(); updateHint(); }
  function putAway(place) { closeMenu(); sfx.tap(); removePlacement(place); renderPlaced(); renderDrawer(); updateHint(); }

  // ---- drawer drag to place ----------------------------------------------
  function makeDrawerDraggable(chip, id) {
    let dragging = false, ghost = null, sX = 0, sY = 0, moved = false;
    chip.addEventListener('pointerdown', e => { sX = e.clientX; sY = e.clientY; moved = false; dragging = true; chip.setPointerCapture(e.pointerId); });
    chip.addEventListener('pointermove', e => {
      if (!dragging) return;
      if (!moved && Math.hypot(e.clientX - sX, e.clientY - sY) > 10) {
        moved = true; holding = id; placeMode = true;
        { const rit = resolveItem(id); ghost = el('div', { class: 'drag-ghost', html: renderItem(rit, { size: 80, equipArt: rit.kind === 'boo' ? equippedArt(id) : null }) }); }
        document.body.appendChild(ghost);
      }
      if (moved && ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
    });
    chip.addEventListener('pointerup', e => {
      if (!dragging) return; dragging = false;
      if (ghost) { ghost.remove(); ghost = null; }
      if (moved) {
        const r = viewport.getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) placeAtClient(e.clientX, e.clientY);
        else { renderDrawer(); updateHint(); }
      }
    });
    chip.addEventListener('pointercancel', () => { dragging = false; if (ghost) { ghost.remove(); ghost = null; } });
  }

  function flashLocked(zi) {
    const band = ground.querySelectorAll('.t-band')[zi];
    if (band) { band.classList.remove('shake'); void band.offsetWidth; band.classList.add('shake'); }
    hint.textContent = `${ZONES[zi].name}: ${totalStars()} / ${ZONES[zi].unlock} ⭐`;
  }

  function updateHint() {
    hint.textContent = holding ? 'Tap the ground to place it! 🌱' : (placeMode ? 'Tap the ground to place it!' : 'Drag from the tray. Tap a Boo to say hi!');
  }

  // ---- zone unlock ceremony ----------------------------------------------
  function maybeCelebrateUnlock() {
    const st = getState();
    const seen = st.seen.zonesUnlocked || [];
    const nowUnlocked = unlockedZones(st.stars.total).map(z => z.key);
    const fresh = nowUnlocked.filter(k => k !== 'meadow' && !seen.includes(k));
    if (params && params.simulateUnlock) { /* tests can pass a zone to force */ }
    if (!fresh.length) return;
    const key = fresh[0];
    fresh.forEach(k => stampJournal('zone_' + k));   // Journal: each zone unlock (RUN3 C4)
    mutate(s2 => { s2.seen.zonesUnlocked = [...seen, ...fresh]; });
    const z = ZONES[ZONE_INDEX[key]];
    scrollToZone(ZONE_INDEX[key]);
    setTimeout(() => {
      sfx.fanfare();
      confetti({ count: 110, power: 1.1 });
      const line = guideLine('zoneUnlock');
      hint.textContent = `✨ ${z.name} is open! ✨`;
      speakMaybe(line);
    }, REDUCED ? 0 : 500);
  }

  // ---- actors: gentle wandering (transform-only) -------------------------
  function makeActor(wrap, item, place) {
    return { wrap, item, place, dancing: false, row: rowOf(place),
      home: 0, dx: 0, vx: 0, state: 'pause', t: 0, next: 400 + Math.random() * 1200, hopT: 0,
      depth: 0, depthTarget: 0, goal: null };   // depth: px drift between rows (C3); goal: chosen behaviour (C1)
  }
  function startLoop() {
    if (REDUCED) return;              // reduced motion: static poses, no wandering
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(48, now - last); last = now;
      if (!document.hidden) { stepActors(dt); stepFunfairRides(now); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stepActors(dt) {
    const now = performance.now();
    for (const a of actors) {
      if (a.riding) continue;   // seated on a funfair ride: animated by the ride, not the wander loop (C1b)
      // skip offscreen actors (cheap) — relative to the real viewport, not the wide zone
      const px = parseFloat(a.wrap.style.left) - scrollX;
      if (px < -140 || px > viewW + 140) continue;
      if (paradeUntil && a.parading) { stepParade(a, now); continue; }   // the Parade (RUN4 C9)
      if (a.dancing) continue; // dancing handled by CSS
      if (a.role) { stepRole(a, dt, now); continue; }   // activity items (RUN4 C5)
      a.t += dt;
      if (a.goal) { stepGoal(a, dt, now); continue; }   // a chosen behaviour (C1): visit/approach/chase/watch/nap
      if (a.t >= a.next) {
        a.t = 0;
        if (maybePickBehaviour(a, now)) continue;        // sometimes pick a richer act than a micro-wander
        const roll = Math.random();
        if (roll < 0.5) { a.state = 'pause'; a.vx = 0; a.next = 700 + Math.random() * 1600; }
        else if (roll < 0.85) { a.state = 'walk'; a.vx = (Math.random() < 0.5 ? -1 : 1) * (0.006 + Math.random() * 0.01); a.next = 500 + Math.random() * 900; }
        else { a.state = 'hop'; a.hopT = 0; a.next = 500 + Math.random() * 900; }
        // now and then drift a little between the depth rows (C3), for a living scene
        if (!a.depthLock && Math.random() < 0.4) a.depthTarget = (Math.random() * 2 - 1) * DEPTH_WANDER;
      }
      const range = zoneW * WANDER_FRAC;   // wander range scales with the wider zone (C3)
      if (a.state === 'walk') { a.dx += a.vx * dt; a.dx = Math.max(-range, Math.min(range, a.dx)); }
      a.depth += (a.depthTarget - a.depth) * Math.min(1, dt / 260);   // ease toward the target depth
      let ty = 0, flip = a.vx < 0 ? -1 : 1;
      if (a.state === 'hop') { a.hopT += dt; const p = Math.min(1, a.hopT / 420); ty = -Math.sin(p * Math.PI) * 12; if (p >= 1) a.state = 'pause'; }
      // moving toward the front (positive depth) reads slightly bigger; toward the back, smaller
      const depthScale = 1 + a.depth * 0.003;
      a.wrap.querySelector('svg').style.transform = `translate(${a.dx.toFixed(1)}px, ${(ty + a.depth).toFixed(1)}px) scale(${depthScale.toFixed(3)}) scaleX(${flip})`;
    }
  }

  // ---- Boo behaviour engine (RUN6 C1) ------------------------------------
  // A free Boo periodically chooses a richer act than a micro-wander, weighted by
  // what is placed nearby and the time of day: visit a friend (walk over, wave + a
  // little heart), walk up to and use an activity item, chase a butterfly by day /
  // firefly by night, sit and watch, or nap under a tree/house at night. Emergent,
  // never scripted; a tap always interrupts (squeak/heart/nickname, handled onTap).
  function maybePickBehaviour(a, now) {
    if (a.depthLock) return false;                 // QA depth-drift hook keeps them still (r5p4)
    if (Math.random() > BEHAVIOUR_CHANCE) return false;
    const kind = chooseBehaviourKind(a);
    if (!kind) return false;
    startBehaviour(a, kind, now);
    return !!a.goal;
  }
  function chooseBehaviourKind(a) {
    const cands = [];
    const night = isSleepTime(currentHour());
    if (pickFriend(a)) cands.push(['visit', 2.2]);
    if (pickFreeActivity(a)) cands.push(['approach', 2.6]);
    cands.push(['chase', 1.6]);
    cands.push(['watch', 1.3]);
    // a just-woken Boo stays up (no instant re-nap); mirrors the sleep-role wake rule
    const recentlyWoken = a.wakeUntil && performance.now() < a.wakeUntil;
    if (night && !recentlyWoken && pickNapSpot(a)) cands.push(['nap', 2.6]);
    if (!a.riding && pickBoardableRide(a)) cands.push(['board', 3.2]);   // funfair: hop on a ride (C1b)
    return cands.length ? weightedPick(cands) : null;
  }
  function pickFriend(a) {
    const zi = ZONE_INDEX[a.place.zone];
    const cands = actors.filter(b => b !== a && !b.dancing && !b.role
      && ZONE_INDEX[b.place.zone] === zi && Math.abs((b.place.x + (b.dx || 0) / (zoneW || 1)) - a.place.x) < 0.5);
    cands.sort((p, q) => Math.abs(p.place.x - a.place.x) - Math.abs(q.place.x - a.place.x));
    return cands[0] || null;
  }
  function occupiedDecoKeys() {
    const set = new Set();
    for (const b of actors) if (b.role && b.role.deco) set.add(b.role.deco.zone + ':' + b.role.deco.x + ':' + b.role.deco.item);
    return set;
  }
  function pickFreeActivity(a) {
    const st = getState(); const zi = ZONE_INDEX[a.place.zone]; const occ = occupiedDecoKeys();
    const cands = st.town.filter(t => ACT_IDS.includes(t.item) && (ZONE_INDEX[t.zone] ?? 0) === zi
      && Math.abs(t.x - a.place.x) < 0.55 && !occ.has(t.zone + ':' + t.x + ':' + t.item));
    cands.sort((p, q) => Math.abs(p.x - a.place.x) - Math.abs(q.x - a.place.x));
    return cands[0] || null;
  }
  function pickNapSpot(a) {
    const st = getState(); const zi = ZONE_INDEX[a.place.zone];
    const cands = st.town.filter(t => NAP_IDS.includes(t.item) && (ZONE_INDEX[t.zone] ?? 0) === zi && Math.abs(t.x - a.place.x) < 0.6);
    cands.sort((p, q) => Math.abs(p.x - a.place.x) - Math.abs(q.x - a.place.x));
    return cands[0] || null;
  }
  function startBehaviour(a, kind, now) {
    now = now || performance.now();
    if (kind === 'visit') {
      const f = pickFriend(a); if (!f) return;
      const fFrac = f.place.x + (f.dx || 0) / (zoneW || 1);
      const side = fFrac >= a.place.x ? -0.02 : 0.02;   // stand just beside, not on top of, the friend
      a.goal = { kind, friend: f, targetDx: (fFrac + side - a.place.x) * zoneW, start: now, greeted: false };
    } else if (kind === 'approach') {
      const d = pickFreeActivity(a); if (!d) return;
      a.goal = { kind, deco: d, targetDx: (d.x - a.place.x) * zoneW, start: now };
    } else if (kind === 'nap') {
      const d = pickNapSpot(a); if (!d) return;
      a.goal = { kind, spot: d, targetDx: (d.x - a.place.x) * zoneW, start: now, curled: false };
    } else if (kind === 'chase') {
      a.goal = { kind, start: now, critter: spawnChaseCritter(a), dir: Math.random() < 0.5 ? -1 : 1 };
    } else if (kind === 'watch') {
      a.goal = { kind, start: now };
    } else if (kind === 'board') {
      const r = pickBoardableRide(a); if (!r) return;
      a.goal = { kind, ride: r, targetDx: (RIDE_X[r] - a.place.x) * zoneW, start: now };
    }
  }
  function spawnChaseCritter(a) {
    const isN = isNight(currentHour());
    const c = el('div', { class: 't-chase-critter' + (isN ? ' firefly' : ''), text: isN ? '' : '🦋' });
    c._x = parseFloat(a.wrap.style.left) + a.wrap.offsetWidth / 2 + (a.dx || 0);
    c._y = parseFloat(a.wrap.style.top) - 6; c._phase = Math.random() * 6.28;
    c.style.left = c._x.toFixed(1) + 'px'; c.style.top = c._y.toFixed(1) + 'px';
    ground.appendChild(c);   // in the scrolling world, so its coords match the Boo
    return c;
  }
  function greet(a, friend) {
    spawnHeart(a.wrap); if (friend && friend.wrap) spawnHeart(friend.wrap);
    if (friend) { friend.t = 0; friend.next = Math.max(friend.next || 0, GREET_MS + 400); }   // friend pauses to wave back
  }
  function spawnHeart(wrap) { const h = el('div', { class: 'pop-heart', text: '❤' }); wrap.appendChild(h); setTimeout(() => h.remove(), 900); }
  function endGoal(a) {
    const g = a.goal;
    if (g && g.critter) { try { g.critter.remove(); } catch {} }
    a.wrap.querySelectorAll('.t-zzz').forEach(n => n.remove());
    a.goal = null; a.state = 'pause'; a.vx = 0; a.t = 0; a.next = 600 + Math.random() * 1400;
    a.home = Math.max(-zoneW * 0.45, Math.min(zoneW * 0.45, a.dx || 0));   // roam onward from here (no snap-back)
  }
  function stepGoal(a, dt, now) {
    const g = a.goal; if (!g) return;
    const svg = a.wrap.querySelector('svg'); if (!svg) return;
    const stride = GOAL_STRIDE * zoneW * dt / 1000;
    if (g.kind === 'watch') {
      const settle = Math.min(1, (now - g.start) / 500);
      svg.style.transform = `translateY(${(3 * settle).toFixed(1)}px) scale(1, ${(1 - 0.06 * settle).toFixed(3)})`;
      if (now - g.start > WATCH_MS) endGoal(a);
      return;
    }
    if (g.kind === 'chase') {
      const c = g.critter, T = now - g.start;
      if (c) {
        c._x += g.dir * 0.045 * dt + Math.sin((T + c._phase * 300) / 520) * 0.5;
        c._y += Math.sin(T / 340 + c._phase) * 0.5;
        c.style.left = c._x.toFixed(1) + 'px'; c.style.top = c._y.toFixed(1) + 'px';
      }
      const homeX = parseFloat(a.wrap.style.left) + a.wrap.offsetWidth / 2;
      const targetDx = c ? (c._x - homeX) : 0;
      const gap = targetDx - a.dx;
      a.dx += Math.sign(gap) * Math.min(Math.abs(gap), stride * 1.3);
      const hop = -Math.abs(Math.sin(T / 240)) * 10;
      svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${hop.toFixed(1)}px) scaleX(${gap < 0 ? -1 : 1})`;
      if (T > CHASE_MS) { if (c) { c.classList.add('flutter-off'); setTimeout(() => { try { c.remove(); } catch {} }, 900); } a.goal.critter = null; endGoal(a); }
      return;
    }
    // visit / approach / nap all stride toward a target offset first
    const gap = g.targetDx - a.dx;
    const flip = gap < 0 ? -1 : 1;
    if (Math.abs(gap) > 2) a.dx += Math.sign(gap) * Math.min(Math.abs(gap), stride);
    const walkHop = -Math.abs(Math.sin((now - g.start) / 200)) * 6;
    if (g.kind === 'visit') {
      if (Math.abs(a.dx - g.targetDx) < VISIT_REACH_PX && !g.greeted) { g.greeted = true; g.greetStart = now; greet(a, g.friend); }
      if (g.greeted) {
        const wave = Math.sin((now - g.greetStart) / 120) * 8;
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, 0px) rotate(${wave.toFixed(1)}deg) scaleX(${flip})`;
        if (now - g.greetStart > GREET_MS) endGoal(a);
      } else {
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${walkHop.toFixed(1)}px) scaleX(${flip})`;
        if (now - g.start > GOAL_TIMEOUT_MS) endGoal(a);
      }
      return;
    }
    if (g.kind === 'approach') {
      svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${walkHop.toFixed(1)}px) scaleX(${flip})`;
      if (Math.abs(a.dx - g.targetDx) < zoneW * 0.03) endGoal(a);   // arrived → assignRoles claims next tick
      else if (now - g.start > GOAL_TIMEOUT_MS) endGoal(a);
      return;
    }
    if (g.kind === 'board') {
      svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${walkHop.toFixed(1)}px) scaleX(${flip})`;
      if (Math.abs(a.dx - g.targetDx) < zoneW * 0.04) {   // reached the ride → hop aboard an empty seat
        const seat = seatBoo(g.ride, a.item);
        endGoal(a);
        if (seat >= 0) { a.riding = true; a.wrap.style.display = 'none'; svg.style.transform = ''; renderFunfair(); }
      } else if (now - g.start > GOAL_TIMEOUT_MS) endGoal(a);
      return;
    }
    if (g.kind === 'nap') {
      if (Math.abs(a.dx - g.targetDx) < zoneW * 0.03) {
        if (!g.curled) { g.curled = true; g.curlStart = now; if (!a.wrap.querySelector('.t-zzz')) a.wrap.appendChild(el('div', { class: 't-zzz', text: 'z Z z' })); }
        const breathe = 1 + Math.sin((now - g.curlStart) / 900) * 0.03;
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, 9px) scale(1.06, ${(0.84 * breathe).toFixed(3)})`;
        if (now - g.curlStart > NAP_MS || !isSleepTime(currentHour())) endGoal(a);
      } else {
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${walkHop.toFixed(1)}px) scaleX(${flip})`;
        if (now - g.start > GOAL_TIMEOUT_MS) endGoal(a);
      }
      return;
    }
  }

  // ---- ambient life: seasonal weather + shooting star (RUN6 C1) ----------
  function renderWeather() {
    const old = viewport.querySelector('.t-weather'); if (old) old.remove();
    if (REDUCED) return;
    const season = seasonOf(currentMonth());
    currentSeasonName = season;
    const layer = el('div', { class: 't-weather ' + season });
    if (season === 'summer') {
      if (!isNight(currentHour())) layer.appendChild(el('div', { class: 't-sunrays' }));   // sun rays are a daytime thing
    } else {
      const glyph = season === 'autumn' ? '🍂' : season === 'winter' ? '❄' : '🌸';
      for (let i = 0; i < WEATHER_PARTICLES; i++) {
        const p = el('div', { class: 't-wp', text: glyph });
        p.style.left = (Math.random() * 100).toFixed(1) + '%';
        p.style.setProperty('--fall', (7 + Math.random() * 6).toFixed(1) + 's');
        p.style.setProperty('--delay', (-Math.random() * 10).toFixed(1) + 's');
        p.style.setProperty('--drift', (Math.random() * 40 - 20).toFixed(0) + 'px');
        p.style.fontSize = (14 + Math.random() * 10).toFixed(0) + 'px';
        layer.appendChild(p);
      }
    }
    viewport.appendChild(layer);
  }
  function scheduleShootingStar() {
    if (starTimer) { clearTimeout(starTimer); starTimer = null; }
    if (REDUCED || !isNight(currentHour())) return;   // a rare treat, only at night
    const gap = STAR_GAP_MS[0] + Math.random() * (STAR_GAP_MS[1] - STAR_GAP_MS[0]);
    starTimer = setTimeout(() => { spawnShootingStar(); scheduleShootingStar(); }, gap);
  }
  function spawnShootingStar() {
    if (document.hidden) return null;
    const star = el('button', { class: 't-shooting-star', 'aria-label': 'A shooting star! Tap it!', html: '<span class="ss-head">✦</span><span class="ss-tail"></span>' });
    star.style.top = (5 + Math.random() * 24) + '%';
    star.style.left = (52 + Math.random() * 26) + '%';
    star.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    star.addEventListener('pointerup', (e) => { e.stopPropagation(); claimShootingStar(star); });
    viewport.appendChild(star);
    requestAnimationFrame(() => star.classList.add('streak'));
    setTimeout(() => { try { star.remove(); } catch {} }, REDUCED ? 400 : 2600);
    return star;
  }
  function claimShootingStar(star) {
    const dk = todayKeyLocal();
    const already = getState().seen && getState().seen.shootingStarDay === dk;
    if (!REDUCED) { sfx.star(); const r = star.getBoundingClientRect(); confetti({ count: 26, power: 0.7, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }); }
    star.classList.add('caught');
    if (!already) {
      mutate(st => { st.seen.shootingStarDay = dk; });
      addMeterPoints(STAR_REWARD);   // +1 meter, capped once per night
      hint.textContent = '✨ You caught a shooting star! +1 ✨';
    } else { hint.textContent = '✨ Pretty!'; }
    setTimeout(() => { try { star.remove(); } catch {} }, 500);
    return !already;
  }

  // ---- day/night ambient fx ----------------------------------------------
  buildAmbient(air, night);
  renderWeather();
  ambient.play(night ? 'night' : 'day');   // gentle bed under the music, obeys the mute (C1)
  scheduleShootingStar();

  // Re-check roles every few seconds: benches cycle "now and then", woken Boos
  // eventually curl back up, and day/night transitions take hold (RUN4 C5).
  const roleTimer = setInterval(() => { if (!document.hidden) assignRoles(); }, 4000);
  if (typeof window !== 'undefined') {
    window.__townDebug = () => ({ paradeUntil, now: performance.now(), parading: actors.filter(a => a.parading).length, actors: actors.length, rafAlive: !!raf });
    // RUN5 C3 QA hooks: geometry + deterministic depth-wander evidence.
    window.__town = {
      geometry: () => ({ viewW, zoneW, worldW, zones: ZONES.length, ratio: zoneW / viewW }),
      scrollX: () => scrollX,
      scrollMax: () => Math.max(0, worldW - viewW),
      actorCount: () => actors.length,
      drift: (target) => actors.forEach(a => { if (!a.role && !a.dancing) { a.depthTarget = target; a.depthLock = true; a.state = 'pause'; a.vx = 0; } }),
      // vertical (depth) offsets of free wanderers, read from their live transforms
      depthYs: () => actors.filter(a => !a.role && !a.dancing).map(a => { const m = (a.wrap.querySelector('svg').style.transform || '').match(/translate\([^,]+,\s*(-?[\d.]+)px/); return m ? +m[1] : 0; }),
      itemsByRow: () => [...ground.querySelectorAll('.t-item')].map(w => ({ row: +w.dataset.row, item: w.dataset.item, w: w.getBoundingClientRect().width, z: +w.style.zIndex || 0, top: parseFloat(w.style.top) }))
    };
    // RUN6 C1 QA hooks: drive the behaviour engine + ambient life deterministically.
    window.__townLife = {
      actorCount: () => actors.length,
      free: () => actors.filter(a => !a.role && !a.dancing && !a.goal).length,
      // force actor i into a behaviour; returns the goal kind (or a claimed role kind), else null
      force: (i, kind) => { const a = actors[i]; if (!a) return null; clearRole(a); a.goal = null; a.depthLock = false; startBehaviour(a, kind, performance.now()); return a.goal ? a.goal.kind : null; },
      goalOf: (i) => { const a = actors[i]; return a ? (a.goal ? 'goal:' + a.goal.kind : (a.role ? 'role:' + a.role.kind : 'wander')) : null; },
      transform: (i) => { const a = actors[i], s = a && a.wrap.querySelector('svg'); return s ? s.style.transform : ''; },
      heartsShown: () => ground.querySelectorAll('.pop-heart').length,
      zzzShown: () => ground.querySelectorAll('.t-zzz').length,
      chaseCritters: () => ground.querySelectorAll('.t-chase-critter').length,
      roleCount: () => actors.filter(a => a.role).length,
      tick: (ms) => { const now = performance.now(); for (const a of actors) { if (a.goal) stepGoal(a, ms, now); } },
      assignRoles: () => assignRoles(),
      // ambient life
      season: () => currentSeasonName,
      weather: () => { const l = viewport.querySelector('.t-weather'); return l ? { season: [...l.classList].find(c => ['spring', 'summer', 'autumn', 'winter'].includes(c)), particles: l.querySelectorAll('.t-wp').length, sunrays: l.querySelectorAll('.t-sunrays').length } : null; },
      renderWeather: () => renderWeather(),
      spawnStar: () => spawnShootingStar(),
      tapStar: (star) => claimShootingStar(star),
      starDay: () => (getState().seen || {}).shootingStarDay || null,
      // funfair (C1b)
      ffUnlocked: () => funfairUnlocked(),
      ffView: () => funfairView(),
      ffRides: () => [...ground.querySelectorAll('.ff-ride')].map(b => b.dataset.ride),
      ffRideSeats: (ride) => seatsFor(ride),
      ffSeatBoo: (ride, id) => seatBoo(ride, id),
      ffUnseat: (ride, id) => unseatBoo(ride, id),
      ffRerender: () => renderFunfair(),
      ffStep: (now) => stepFunfairRides(now || performance.now()),
      ffSeatTransforms: (ride) => { const b = [...ground.querySelectorAll('.ff-ride')].find(x => x.dataset.ride === ride); return b ? [...b.querySelectorAll('.ff-seat')].map(s => s.style.transform) : []; },
      ffOpenPicker: (ride) => openRidePicker(ride),
      ffReveal: (ride) => playFunfairReveal(ride),
      scrollToFunfair: () => scrollToZone(ZONE_INDEX['funfair'], false),
      hasBandstand: () => !!ground.querySelector('.ff-bandstand'),
      scrollToBandstand: () => { scrollX = ZONE_INDEX['funfair'] * zoneW + BANDSTAND_X * zoneW - viewW / 2; clampScroll(); applyScroll(); },
      scrollToFunfairGate: () => { scrollX = ZONE_INDEX['funfair'] * zoneW; clampScroll(); applyScroll(); },   // funfair centred but bandstand off-screen → jingle
      zoneMusic: () => _zoneMusic
    };
  }

  return {
    unmount() {
      if (raf) cancelAnimationFrame(raf);
      if (momRaf) cancelAnimationFrame(momRaf);
      if (routineTimer) clearInterval(routineTimer);
      clearInterval(roleTimer);
      if (starTimer) clearTimeout(starTimer);
      ambient.stop();
      stopBand();
      window.removeEventListener('resize', onResize);
      closeMenu();
    }
  };
}

function buildAmbient(air, night) {
  if (REDUCED) return;
  const n = night ? 10 : 8;
  for (let i = 0; i < n; i++) {
    const e2 = el('div', { class: night ? 't-firefly' : 't-butterfly', text: night ? '' : '🦋' });
    e2.style.left = (Math.random() * 100) + '%';
    e2.style.top = (30 + Math.random() * 45) + '%';
    e2.style.animationDelay = (Math.random() * 6) + 's';
    e2.style.animationDuration = (6 + Math.random() * 6) + 's';
    air.appendChild(e2);
  }
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ---- per-zone background scenery (inline SVG) ---------------------------
function sceneryFor(key, w, h) {
  const W = 100, H = 100; // drawn in a 100x100 viewBox, stretched to the zone
  if (key === 'riverside') {
    return svg(W, H, `
      <path d="M0 78 Q25 70 50 76 T100 74 L100 100 L0 100 Z" fill="#6FBF7A"/>
      <path d="M0 88 Q30 82 60 88 T100 86 L100 100 L0 100 Z" fill="#59A867"/>
      <path d="M0 79 Q50 86 100 79 L100 92 Q50 98 0 92 Z" fill="#7FC7E8" opacity="0.9"/>
      <ellipse cx="70" cy="85" rx="7" ry="2.2" fill="#A6DDF2"/>
      <ellipse cx="30" cy="87" rx="5" ry="1.8" fill="#A6DDF2"/>`);
  }
  if (key === 'hilltop') {
    return svg(W, H, `
      <path d="M0 82 Q22 40 44 60 Q60 74 78 44 Q92 24 100 46 L100 100 L0 100 Z" fill="#7CC98A"/>
      <path d="M0 90 Q40 70 100 88 L100 100 L0 100 Z" fill="#5FA76C"/>
      <circle cx="80" cy="24" r="9" fill="#FFE08A" opacity="0.85"/>`);
  }
  if (key === 'beach') {
    return svg(W, H, `
      <path d="M0 74 Q50 80 100 74 L100 88 Q50 94 0 88 Z" fill="#8FD3EF"/>
      <path d="M0 86 Q30 82 60 86 T100 85 L100 100 L0 100 Z" fill="#F2DDA6"/>
      <path d="M0 90 Q50 96 100 90 L100 100 L0 100 Z" fill="#E9CE8E"/>
      <path d="M0 80 Q10 78 20 80" stroke="#fff" stroke-width="1.2" fill="none" opacity="0.7"/>`);
  }
  // meadow
  return svg(W, H, `
    <path d="M0 80 Q30 66 60 78 T100 74 L100 100 L0 100 Z" fill="#8AD48F"/>
    <path d="M0 90 Q40 82 100 90 L100 100 L0 100 Z" fill="#6FBF77"/>
    <circle cx="18" cy="86" r="1.6" fill="#FF7AC6"/><circle cx="34" cy="90" r="1.6" fill="#FFD166"/><circle cx="72" cy="88" r="1.6" fill="#C6A9F0"/><circle cx="86" cy="92" r="1.6" fill="#FF7AC6"/>`);
}
function svg(w, h, inner) {
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function signSVG() {
  return `<svg viewBox="0 0 60 70" width="52" height="60"><rect x="27" y="30" width="6" height="38" fill="#8A5A44" stroke="#2A1B4E" stroke-width="2.5"/><rect x="8" y="8" width="44" height="26" rx="5" fill="#F2D6B8" stroke="#2A1B4E" stroke-width="3"/><text x="30" y="26" font-family="Fredoka,sans-serif" font-size="16" fill="#2A1B4E" text-anchor="middle">🔒</text></svg>`;
}
