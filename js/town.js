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
const GROUND_FRAC = 0.80;   // ground line as a fraction of viewport height

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
  let voiceIds = new Set();  // Boo ids with a recorded voice (RUN3 C7)
  voiceBooIds().then(s => { voiceIds = s; }).catch(() => {});
  // Occasional Boo requests (RUN3 C8): check at app open (town is an "open").
  checkRequestOpen((getState().town || []).filter(t => (t.item || '').startsWith('boo_') || (t.item || '').startsWith('custom:')).map(t => t.item));

  let holding = (params && params.place) || null;   // item id being placed
  let placeMode = !!holding;
  let scrollX = 0, worldW = 0, zoneW = 0, viewH = 0, groundY = 0;
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

  requestAnimationFrame(() => { layout(); renderDrawer(); updateHint(); maybeCelebrateUnlock(); startLoop(); });
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  // ---- layout / render ----------------------------------------------------
  function layout() {
    viewH = viewport.clientHeight || 400;
    zoneW = viewport.clientWidth || 600;
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
      const size = ACT_SIZE[t.item] || 92;   // activity kit is bigger than a Boo (RUN4 C5)
      const wrap = el('div', { class: 't-item' + (item.kind === 'boo' ? ' boo' : ''), dataset: { zone: t.zone, x: String(t.x), item: t.item } });
      wrap.style.left = (px - size / 2) + 'px';
      wrap.style.top = (groundY - size + 8) + 'px';
      wrap.innerHTML = renderItem(item, { size, equipArt: item.kind === 'boo' ? equippedArt(item.id) : null });
      attachItemPointer(wrap, t, item);
      ground.appendChild(wrap);
      if (item.kind === 'boo' && !item.fx && count < MAX_WANDERERS) { actors.push(makeActor(wrap, item, t)); count++; }
    }
    applyDance();
    assignRoles();
    decorateEasels();
    renderRequestBubble();
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
  function clampScroll() { scrollX = Math.max(0, Math.min(scrollX, Math.max(0, worldW - zoneW))); }
  function scrollToZone(zi, smooth = true) {
    const target = Math.max(0, Math.min(zi * zoneW, worldW - zoneW));
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
      if (Math.abs(v) > 0.4 && scrollX > 0 && scrollX < worldW - zoneW) momRaf = requestAnimationFrame(mom);
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

  function placeAtClient(cx, cy) {
    const { zi, x } = zoneAndXAt(clientToWorld(cx));
    if (!canPlaceIn(zi)) { flashLocked(zi); return; }
    const id = holding;
    mutate(st => { st.town.push({ zone: ZONES[zi].key, x: +x.toFixed(3), item: id }); });
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
        wrap.style.left = (zi * zoneW + x * zoneW - wrap.offsetWidth / 2) + 'px';
        wrap.dataset._zi = zi; wrap.dataset._x = x;
      }
    });
    wrap.addEventListener('pointerup', e => {
      if (!down) return; down = false;
      wrap.classList.remove('dragging');
      if (moved) {
        const zi = +wrap.dataset._zi, x = +wrap.dataset._x;
        if (canPlaceIn(zi)) {
          mutate(st => { const t = st.town.find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001); if (t) { t.zone = ZONES[zi].key; t.x = +x.toFixed(3); } });
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
    if (item.deco === 'stage') btns.push(el('button', { class: 'btn soft', text: 'Choreograph 💃', onclick: (e) => { e.stopPropagation(); closeMenu(); openChoreographer(place, { onDone: () => renderPlaced() }); } }));
    btns.push(el('button', { class: 'btn soft', text: 'Move', onclick: (e) => { e.stopPropagation(); pickUp(place); } }));
    btns.push(el('button', { class: 'btn soft', text: 'Put away', onclick: (e) => { e.stopPropagation(); putAway(place); } }));
    const menu = el('div', { class: 'plot-menu' }, btns);
    wrap.appendChild(menu);
    openPopover = menu;
    setTimeout(() => document.addEventListener('pointerdown', closeMenu, { once: true }), 0);
  }
  function closeMenu() { if (openPopover) { openPopover.remove(); openPopover = null; } }

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
    return { wrap, item, place, dancing: false,
      home: 0, dx: 0, vx: 0, state: 'pause', t: 0, next: 400 + Math.random() * 1200, hopT: 0 };
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
      // skip offscreen actors (cheap)
      const px = parseFloat(a.wrap.style.left) - scrollX;
      if (px < -140 || px > zoneW + 140) continue;
      if (a.dancing) continue; // dancing handled by CSS
      if (a.role) { stepRole(a, dt, now); continue; }   // activity items (RUN4 C5)
      a.t += dt;
      if (a.t >= a.next) {
        a.t = 0;
        const roll = Math.random();
        if (roll < 0.5) { a.state = 'pause'; a.vx = 0; a.next = 700 + Math.random() * 1600; }
        else if (roll < 0.85) { a.state = 'walk'; a.vx = (Math.random() < 0.5 ? -1 : 1) * (0.006 + Math.random() * 0.01); a.next = 500 + Math.random() * 900; }
        else { a.state = 'hop'; a.hopT = 0; a.next = 500 + Math.random() * 900; }
      }
      if (a.state === 'walk') { a.dx += a.vx * dt; a.dx = Math.max(-26, Math.min(26, a.dx)); }
      let ty = 0, flip = a.vx < 0 ? -1 : 1;
      if (a.state === 'hop') { a.hopT += dt; const p = Math.min(1, a.hopT / 420); ty = -Math.sin(p * Math.PI) * 12; if (p >= 1) a.state = 'pause'; }
      a.wrap.querySelector('svg').style.transform = `translate(${a.dx.toFixed(1)}px, ${ty.toFixed(1)}px) scaleX(${flip})`;
    }
  }

  // ---- day/night ambient fx ----------------------------------------------
  buildAmbient(air, night);

  // Re-check roles every few seconds: benches cycle "now and then", woken Boos
  // eventually curl back up, and day/night transitions take hold (RUN4 C5).
  const roleTimer = setInterval(() => { if (!document.hidden) assignRoles(); }, 4000);

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
