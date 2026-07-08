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
import { sfx, music } from './sfx.js';
import { noteQuest, stampJournal } from './quests.js';
import { tickGrowth, completeReveal, growthView, GROWTH_MILESTONES } from './growth.js';
import { ensureHide, currentHide, foundHide, HIDE_REWARD } from './delights.js';
import { addMeterPoints } from './rewards.js';

// Zone unlock thresholds (named constants).
export const RIVERSIDE_STARS = 40, HILLTOP_STARS = 100, BEACH_STARS = 180;
export const ZONES = [
  { key: 'meadow',    name: 'Meadow',    unlock: 0 },
  { key: 'riverside', name: 'Riverside', unlock: RIVERSIDE_STARS },
  { key: 'hilltop',   name: 'Hilltop',   unlock: HILLTOP_STARS },
  { key: 'beach',     name: 'Beach',     unlock: BEACH_STARS }
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
      // midground scenery
      const scene = el('div', { class: 't-zone-scene ' + z.key + (locked ? ' locked' : ''), html: sceneryFor(z.key, zoneW, viewH) });
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
    let count = 0;
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
      // her shiny copy shimmers in the town too (RUN4 C8)
      if (item.kind === 'boo' && ((st.shinies && st.shinies[t.item]) || 0) > 0) {
        wrap.classList.add('shiny-wrap');
        wrap.appendChild(el('span', { class: 'shiny-glint tiny', text: '✦' }));
      }
      attachItemPointer(wrap, t, item);
      ground.appendChild(wrap);
      if (item.kind === 'boo' && !item.fx && count < MAX_WANDERERS) { actors.push(makeActor(wrap, item, t)); count++; }
    }
    applyDance();
    assignRoles();
    renderGrowth();
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
    const freeNear = (t, radius) => actors
      .filter(a => !a.role && !a.dancing && ZONE_INDEX[a.place.zone] === ZONE_INDEX[t.zone] && Math.abs(a.place.x - t.x) <= radius)
      .sort((p, q) => Math.abs(p.place.x - t.x) - Math.abs(q.place.x - t.x));
    const give = (a, role) => {
      if (roleCount >= MAX_ACTIVE_ROLES) return false;
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
  }
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
    if (e.target.closest('.t-item') || e.target.closest('.t-signpost')) return; // items handle their own
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
      depth: 0, depthTarget: 0 };   // depth: px drift between depth rows (C3)
  }
  function startLoop() {
    if (REDUCED) return;              // reduced motion: static poses, no wandering
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(48, now - last); last = now;
      if (!document.hidden) stepActors(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stepActors(dt) {
    const now = performance.now();
    for (const a of actors) {
      // skip offscreen actors (cheap) — relative to the real viewport, not the wide zone
      const px = parseFloat(a.wrap.style.left) - scrollX;
      if (px < -140 || px > viewW + 140) continue;
      if (paradeUntil && a.parading) { stepParade(a, now); continue; }   // the Parade (RUN4 C9)
      if (a.dancing) continue; // dancing handled by CSS
      if (a.role) { stepRole(a, dt, now); continue; }   // activity items (RUN4 C5)
      a.t += dt;
      if (a.t >= a.next) {
        a.t = 0;
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

  // ---- day/night ambient fx ----------------------------------------------
  buildAmbient(air, night);

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
  }

  return {
    unmount() {
      if (raf) cancelAnimationFrame(raf);
      if (momRaf) cancelAnimationFrame(momRaf);
      if (routineTimer) clearInterval(routineTimer);
      clearInterval(roleTimer);
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
