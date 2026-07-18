// js/town.js — Town 4.0: a single area scene, reached from the world map (RUN10 P1).
// One area per mount (world width = AREA_W_VIEWPORTS viewports), three parallax layers,
// drag placement along the ground band, wandering Boos, real-clock day/night. Multi-area
// navigation lives in worldmap.js; this file only ever renders one already-unlocked area.

import { el, clear, confetti, REDUCED, backControl } from './ui.js';
import { getState, mutate } from './state.js';
import { AREAS, AREA_W_VIEWPORTS, areaByKey } from './areas.js';
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
import { SOCKETS, HIDE_POINTS } from '../data/sockets.js';
import { createDrawer } from './drawer.js';
import { personalityOf, personalityMult, SHY_GREET_DIST_PX, CATCHPHRASES, CATCHPHRASE_RATE } from '../data/personalities.js';
import { openCare, bondLevel, isBestFriend, heartBadge, trickFor, renderBffPortrait } from './care.js';

// Area list, positions and unlock thresholds now live in js/areas.js (RUN10 P1) — the
// world map is the only place that knows about all 8 areas at once. town.js mounts ONE
// already-unlocked area at a time; see mount() for the per-mount single-area ZONES shim
// (kept as `ZONES`/`ZONE_INDEX` internally so the rest of this file's zone-comparison code
// — written for the old 5-zone continuous world — needs no further changes: with exactly
// one entry, every `ZONE_INDEX[...] === zi` comparison and `zi * zoneW` offset still holds).
const MAX_WANDERERS = 30;

// ---- interior scenes (RUN10 P4): the Boo House ----
// Only kind:'interior' areas mounted BY town.js (the Gallery is its own dedicated
// screen — see js/gallerymuseum.js). A room is snug: 1.5 viewports, not 4.
const INTERIOR_W_VIEWPORTS = 1.5;
const INTERIOR_WALL_FRAC = 0.55;   // room backdrop: wall band = top 55%, floor band = the rest
const WALL_ROW = 3;                // sentinel row value for wall-hung items (floor uses 0-2)
const WALL_Y_FRAC = 0.30;          // wall items hang at a fixed height, no depth variation
const ITEM_SCALE_MIN = 0.70, ITEM_SCALE_MAX = 1.60, ITEM_SCALE_STEP = 0.15;
const itemScaleOf = (t) => Math.max(ITEM_SCALE_MIN, Math.min(ITEM_SCALE_MAX, Number(t && t.scale) || 1));
const HOUSE_STARTER_STOCK = { deco_rug: 1, deco_tablelamp: 1 };

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
const NAP_IDS = ['deco_boohouse', 'deco_tree', 'deco_bed'];   // a Boo naps by a house, under a Bubble Tree, or (preferred, RUN10 P4) in a placed bed
const ACT_IDS = ['deco_slide', 'deco_swings', 'deco_trampoline', 'deco_paddlepool', 'deco_bumper', 'deco_seesaw', 'deco_picnic', 'deco_bench', 'deco_pond'];
// role kind per activity item — generic socket loop below (RUN10 P2)
const KIND_FOR = { deco_slide: 'slide', deco_swings: 'swing', deco_trampoline: 'bounce', deco_paddlepool: 'paddle', deco_bumper: 'drive', deco_seesaw: 'seesaw', deco_picnic: 'picnic', deco_bench: 'sit', deco_pond: 'fish' };
// Personality weight keys (RUN10 P5) for the generic 'approach' goal — keyed by WHICH
// activity item was actually found, since 'approach' itself covers every ACT_IDS member.
const ACT_MULT_KEY = { deco_trampoline: 'trampoline', deco_bench: 'bench', deco_slide: 'slide', deco_swings: 'swings', deco_seesaw: 'seesaw' };
// Hide-and-seek 2.0 (RUN10 P5): a giggle + wiggle every 8-14s so the hider reads as
// alive, not just a static sticker peeking out.
const HIDE_WIGGLE_MIN_MS = 8000, HIDE_WIGGLE_MAX_MS = 14000;
const SETTLE_MS = 180;           // arrival settle: drop + squash (RUN10 P2)
const SHRUG_MS = 300;            // no free socket → a small shrug, then wander off (RUN10 P2)
const SEESAW_PERIOD_MS = 2200;   // seesaw pivot loop (RUN10 P2, was ~5000ms)
// items whose socket cools down after a visit rather than instantly refilling (RUN10 P3: pond joins the bench)
const COOLDOWN_ITEMS = new Set(['deco_bench', 'deco_pond']);
const FISH_HOLD_MIN = 6000, FISH_HOLD_MAX = 10000;   // hold time before the splash burst (RUN10 P3)
const FISH_DIP_CHANCE = 0.6;      // odds the bobber visibly dips once during the hold
const FISH_CATCH_MS = 2000;       // sparkling fish arc
const FISH_BOOT_MS = 2200;        // comedy boot: slow lift + drips
const FISH_CATCH_CHANCE = 0.85;   // 85% catch / 15% comedy boot
const FISH_COOLDOWN_MS = 9000;    // matches the bench's cooldown feel

// ---- Town 4.0 capacity (RUN10 P2) ----
export const AREA_CAP = 24;      // items per area; a full area refuses drops with a guide line
// ---- Town 4.0 build mode (RUN10 P3) ----
export const PATH_CAP = 300;      // path cells per area
const PATH_CELL = 0.05;           // grid cell size: 5% of the area's width, square within the ground band
// Landscape items are a Build-mode toybox, not a collectible — always available in the
// drawer regardless of `inventory` (never granted/decremented there), so a fresh save's
// inventory stays exactly what she's actually won.
const LANDSCAPE_IDS = Object.values(BY_ID).filter(it => it.kind === 'landscape').map(it => it.id);
const LANDSCAPE_STOCK = 999;

// ---- ambient life (RUN6 C1) ----
const WEATHER_PARTICLES = 14;   // per-season particle count (one particle layer; caps hold)
const STAR_GAP_MS = [16000, 40000];  // random gap between night shooting stars
const STAR_REWARD = 1;          // +1 meter, capped once per night

// ---- zone identity (RUN7 C2): every zone is a distinct PLACE -------------------
// Signature scenery + zone-only behaviours. All scenery is drawn as backdrop/mid-layer
// that NEVER occupies the placement band; behaviours are self-contained vignettes.
const BRIDGE_X = 0.5;           // the little wooden bridge sits mid-zone (riverside)
const WINDMILL_X = 0.7;         // the windmill turns on the hill crest (hilltop)
const PALM_X = 0.10, PALM2_X = 0.92, HUT_X = 0.75;   // two palms bookend the beach (RUN10 P1: palm×2)
const KITE_MS = 6000;           // a Boo flies a kite for a spell (hilltop)
const PADDLE_MS = 4200;         // paddling at the bank / in the shallows (riverside / beach)
const SKIM_MS = 2600;           // a stone skim + plink (riverside)
const BRIDGE_SIT_MS = 5200;     // sitting on the bridge (riverside)
const SANDCASTLE_MS = 3600;     // patting up a sandcastle (beach)
const SANDCASTLE_FADE_MS = 22000;  // …which fades later (C2)
const SUNBATHE_MS = 6000;       // sunbathing on a towel (beach)
const ZONE_BEHAVIOURS = {       // which zone-only acts a Boo may pick, by zone + weight
  riverside: [['paddle', 1.9], ['bridgesit', 1.5], ['skim', 1.3]],
  hilltop:   [['kite', 2.2]],
  beach:     [['shallow', 1.9], ['sandcastle', 1.7], ['sunbathe', 1.3]]
};

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
  deco_paddlepool: 150, deco_picnic: 150, deco_bumper: 140, deco_campfire: 120,
  // furniture (RUN10 P4)
  deco_bed: 150, deco_sofa: 165, deco_rug: 210, deco_table: 120, deco_tablelamp: 105,
  deco_wardrobe: 145, deco_bookshelf: 145, deco_bathtub: 145, deco_bffportrait: 120
};

export function totalStars() { const s = getState(); return s ? s.stars.total : 0; }

function currentHour() {
  if (typeof window !== 'undefined' && window.__bootownHour != null) return window.__bootownHour | 0;
  try { return new Date().getHours(); } catch { return 12; }
}
const isNight = (h) => h >= 19 || h < 7;

export function mount(container, params, ctx) {
  const s = getState();
  // RUN10 P1: town.js renders ONE area per mount — the world map is what knows about
  // all 8 areas and their unlock state. Defaults to the Meadow (always unlocked, always
  // the natural "put a new item somewhere" destination for ceremony/onboarding callers
  // that don't specify an area).
  const areaKey = (params && params.area) || 'meadow';
  const AREA = areaByKey(areaKey);
  // Interior scene mode (RUN10 P4): only the Boo House reaches town.js as kind:'interior'
  // — the Gallery is routed to its own screen (js/gallerymuseum.js) from the world map.
  const isInterior = AREA.kind === 'interior';
  // Single-area "zones" shim: every zone-comparison helper below was written for the old
  // 5-zone continuous world and reads ZONES/ZONE_INDEX from the enclosing closure. With
  // exactly one entry here (index 0, unlock 0 — already-unlocked by construction, since
  // the map is the only way in), all that code keeps working unchanged.
  const ZONES = [{ key: AREA.key, name: AREA.name, unlock: 0 }];
  const ZONE_INDEX = { [AREA.key]: 0 };
  music.play('calm');
  noteQuest('townVisit');   // daily quest: visit the town (RUN3 C4)
  // Hide-and-seek Boo, once per local day (RUN4 C9): picks across ALL areas (delights.js),
  // so renderHide() below only shows something on the area it actually landed in — graceful
  // no-op elsewhere. A world-map "someone's hiding over here" chip is P5's job.
  ensureHide();
  let voiceIds = new Set();  // Boo ids with a recorded voice (RUN3 C7)
  voiceBooIds().then(s => { voiceIds = s; }).catch(() => {});
  // Occasional Boo requests (RUN3 C8): check at app open (town is an "open").
  checkRequestOpen(areaItems(getState()).filter(t => (t.item || '').startsWith('boo_') || (t.item || '').startsWith('custom:')).map(t => t.item));

  // Area-scoped item storage (RUN10 P1): save.town.areas[AREA.key] = {items:[],paths:[]}.
  // Every item carries a redundant `.zone` field (always === AREA.key) so the zone-
  // comparison code throughout this file needs no further changes.
  function areaItems(st) {
    if (!st.town.areas[AREA.key]) st.town.areas[AREA.key] = { items: [], paths: [] };
    return st.town.areas[AREA.key].items;
  }

  let holding = (params && params.place) || null;   // item id being placed
  let holdingScale = 1;
  let placeMode = !!holding;
  let scrollX = 0, worldW = 0, zoneW = 0, viewW = 0, viewH = 0, groundY = 0;
  let raf = null, actors = [], fx = [];
  let currentSeasonName = '', starTimer = null;   // ambient life (RUN6 C1)
  // ---- build mode (RUN10 P3) ----
  let buildMode = false, buildTool = 'place', pathStyle = 'stone';
  let pendingPaths = null, pathCommitTimer = null, painting = false;

  const root = el('div', { class: 'town2 area-' + AREA.key + ' entering' });
  const back = backControl(() => ctx.go('worldmap'));
  const title = el('h2', { text: AREA.name });
  const hammerBtn = el('button', { class: 'icon-btn town-hammer-btn', 'aria-label': 'Build mode', onclick: () => toggleBuildMode(), html: '🔨' });
  const header = el('header', { class: 'town-header' }, [back, title, hammerBtn]);
  const hint = el('div', { class: 'town-hint-bar' });

  const sky = el('div', { class: 't-layer t-sky' });
  const hills = el('div', { class: 't-layer t-hills' });
  const ground = el('div', { class: 't-layer t-ground' });
  const air = el('div', { class: 't-layer t-air' });   // fireflies / butterflies
  const buildGrid = el('div', { class: 't-build-grid' });
  air.appendChild(buildGrid);   // never cleared by renderScenery/renderPlaced, like the drop-ghost
  const viewport = el('div', { class: 't-viewport' }, [sky, hills, ground, air]);

  // Build-mode tool row (right edge, vertical, RUN10 P3): Place | Paths | Erase, plus a
  // secondary path-style strip (stone/sand/flower) that only shows while Paths is picked.
  const BUILD_TOOLS = [
    { id: 'place', label: '✋', title: 'Place' },
    { id: 'paths', label: '🛤️', title: 'Paths' },
    { id: 'erase', label: '🧹', title: 'Erase' }
  ];
  const toolBtns = BUILD_TOOLS.map(td => el('button', {
    class: 't-tool-btn' + (buildTool === td.id ? ' sel' : ''), text: td.label, type: 'button', 'aria-label': td.title,
    onclick: () => selectBuildTool(td.id)
  }));
  const toolRow = el('div', { class: 't-tool-row' }, toolBtns);
  toolRow.addEventListener('pointerdown', e => e.stopPropagation());
  const PATH_STYLES = [
    { id: 'stone', label: '🪨', title: 'Stone path' },
    { id: 'sand', label: '🏖️', title: 'Sand path' },
    { id: 'flower', label: '🌸', title: 'Flower path' }
  ];
  const styleBtns = PATH_STYLES.map(sd => el('button', {
    class: 't-tool-btn t-style-btn' + (pathStyle === sd.id ? ' sel' : ''), text: sd.label, type: 'button', 'aria-label': sd.title,
    onclick: () => selectPathStyle(sd.id)
  }));
  const pathStyleRow = el('div', { class: 't-path-style-row' }, styleBtns);
  pathStyleRow.addEventListener('pointerdown', e => e.stopPropagation());
  viewport.append(toolRow, pathStyleRow);

  // Town drawer (RUN10 P2): js/drawer.js tabs [Boos | Rides & fun | Decorations | Special],
  // plus a Build-only Landscape tab (RUN10 P3, tab button hidden outside build mode).
  // `item.act` (catalogue.js) marks the playground/activity decos; ultra-rarity decos are
  // the "Special" showpieces.
  const DRAWER_TABS_SPEC = [
    { id: 'boos', label: 'Boos', test: (it) => it.kind === 'boo' },
    { id: 'rides', label: 'Rides & fun', test: (it) => it.kind === 'deco' && !!it.act },
    { id: 'deco', label: 'Decorations', test: (it) => it.kind === 'deco' && !it.act && it.rarity !== 'ultra' },
    { id: 'furniture', label: 'Furniture', test: (it) => it.kind === 'furniture' },
    { id: 'special', label: 'Special', test: (it) => it.kind === 'deco' && !it.act && it.rarity === 'ultra' },
    { id: 'landscape', label: 'Landscape', test: (it) => it.kind === 'landscape' }
  ];
  const drawerStrips = {};
  const drawerTabsNodes = DRAWER_TABS_SPEC.map(spec => {
    const strip = el('div', { class: 'town-drawer-strip' });
    attachStripMomentum(strip);
    drawerStrips[spec.id] = strip;
    return { id: spec.id, label: spec.label, node: strip };
  });
  const drawerApi = createDrawer({ tabs: drawerTabsNodes, initial: 0, ariaLabel: 'Town items' });
  const drawer = drawerApi.root;   // kept as `drawer` — existing wobble/capacity-tint code targets it
  drawer.classList.add('town-drawer');   // scope the .taken shake CSS to this drawer instance
  updateBuildUI();   // hides the Landscape tab + build tool rows until the hammer is tapped
  root.append(header, hint, viewport, drawer);
  container.appendChild(root);

  // Day / night tint.
  const night = isNight(currentHour());
  root.classList.toggle('night', night);

  // Entry crossfade (P1): the map badge scales up into this scene, 300ms.
  requestAnimationFrame(() => { requestAnimationFrame(() => root.classList.remove('entering')); });

  // The Boo House starts with a rug + table lamp pre-placed (RUN10 P4) — a one-time seed,
  // not a grant (they aren't added to inventory, so they don't count as "collected" until
  // she wins her own copy from a box).
  if (AREA.key === 'boohouse' && !((getState().seen || {}).boohouseSeeded)) {
    mutate(st => {
      st.seen = st.seen || {};
      st.seen.boohouseSeeded = true;
      const items = areaItems(st);
      items.push({ zone: 'boohouse', x: 0.36, row: 1, item: 'deco_rug', scale: 1.2 });
      items.push({ zone: 'boohouse', x: 0.64, row: 1, item: 'deco_tablelamp', scale: 1 });
    });
  }

  requestAnimationFrame(() => {
    layout(); renderDrawer(); updateHint(); startLoop();
    if (params && params.enterPan) setTimeout(() => panAcrossZone(0, 1600), REDUCED ? 0 : 200);
    // Growth milestones (RUN4 C6): spawn/queue sites, and if the Builders
    // finished while she was away, the next town open plays the reveal.
    const gt = tickGrowth();
    if (gt.readyToReveal) setTimeout(() => playGrowthReveal(gt.readyToReveal), REDUCED ? 100 : 700);
    else if (gt.spawned.length) renderPlaced();   // a fresh site fence appears
    // Funfair rides via the Boo Builders (RUN6 C1b): reveal a finished ride, else render the
    // (always-open, RUN7 C1) fair so its day-one Carousel/scenery/bandstand show on the first mount.
    const ft = tickFunfair();
    if (ft.readyToReveal) setTimeout(() => playFunfairReveal(ft.readyToReveal), REDUCED ? 120 : 900);
    else renderFunfair();
  });
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  // ---- layout / render ----------------------------------------------------
  function layout() {
    viewH = viewport.clientHeight || 400;
    viewW = viewport.clientWidth || 600;
    // Each outdoor area is AREA_W_VIEWPORTS (4) viewports wide (RUN10 P1) — room to roam,
    // not a corridor. A room is snug instead (RUN10 P4): INTERIOR_W_VIEWPORTS (1.5).
    zoneW = viewW * (isInterior ? INTERIOR_W_VIEWPORTS : AREA_W_VIEWPORTS);
    worldW = zoneW * ZONES.length;   // ZONES.length is always 1 now: worldW === zoneW === the area
    groundY = viewH * GROUND_FRAC;
    for (const L of [sky, hills, ground, air]) { L.style.width = worldW + 'px'; L.style.height = viewH + 'px'; }
    const cell = zoneW * PATH_CELL;
    buildGrid.style.width = worldW + 'px'; buildGrid.style.height = viewH + 'px';
    buildGrid.style.backgroundSize = cell + 'px ' + cell + 'px';
    renderScenery();
    renderPlaced();
    clampScroll();
    applyScroll();
  }
  // Ground-band grid geometry (RUN10 P3): cells are square within the placement band,
  // 5% of the area's width in x and matched to that same px size in y.
  function cellGeom() {
    const bandTopPx = viewH * BAND_TOP, bandBotPx = viewH * BAND_BOTTOM;
    // Cells are 5% of each axis's OWN extent — 5% of the area's width across, 5% of the
    // (much shorter) placement band down — so the grid reads as a fine brush, not one
    // giant square: ~20 columns x ~20 rows, comfortably above the 300-cell cap.
    return { bandTopPx, bandBotPx, cellW: zoneW * PATH_CELL, cellH: (bandBotPx - bandTopPx) * PATH_CELL };
  }
  function pathCellEl(c) {
    const { bandTopPx, cellW, cellH } = cellGeom();
    const e = el('div', { class: 't-path-cell path-' + c.style, dataset: { cx: String(c.cx), cy: String(c.cy) } });
    e.style.left = (c.cx * cellW) + 'px';
    e.style.top = (bandTopPx + c.cy * cellH) + 'px';
    e.style.width = Math.ceil(cellW) + 'px';
    e.style.height = Math.ceil(cellH) + 'px';
    return e;
  }
  // The saved list while not actively editing, or the in-memory batch while build mode
  // holds one (RUN10 P3: painting doesn't hit the save on every cell — see commitPaths).
  function currentPaths() {
    if (pendingPaths) return pendingPaths;
    const a = getState().town.areas[AREA.key];
    return (a && a.paths) || [];
  }
  function renderPaths() {
    ground.querySelectorAll('.t-path-cell').forEach(n => n.remove());
    const frag = document.createDocumentFragment();
    for (const c of currentPaths()) frag.appendChild(pathCellEl(c));
    ground.appendChild(frag);
  }
  function redrawPathCell(cx, cy) {
    ground.querySelectorAll(`.t-path-cell[data-cx="${cx}"][data-cy="${cy}"]`).forEach(n => n.remove());
    const rec = pendingPaths.find(c => c.cx === cx && c.cy === cy);
    if (rec) ground.appendChild(pathCellEl(rec));
  }
  function loadPendingPaths() {
    const a = getState().town.areas[AREA.key];
    pendingPaths = a && Array.isArray(a.paths) ? a.paths.slice() : [];
  }
  // Flushes the in-memory batch to the save. Also the setInterval(commitPaths, 10000)
  // callback itself — must NOT touch pathCommitTimer, or the first auto-commit would
  // cancel its own repeat and every commit after it would silently stop happening.
  function commitPaths() {
    if (!pendingPaths) return;
    const toSave = pendingPaths;
    mutate(st => { areaItems(st); st.town.areas[AREA.key].paths = toSave.slice(); });
  }
  function pathCapWobble() {
    drawer.classList.remove('taken'); void drawer.offsetWidth; drawer.classList.add('taken');
    setTimeout(() => drawer.classList.remove('taken'), 600);
    const line = guideLine('L_PATH_FULL');
    hint.textContent = line;
    speakMaybe(line);
    if (sfx.oops) sfx.oops();
  }
  function paintCell(cx, cy) {
    const i = pendingPaths.findIndex(c => c.cx === cx && c.cy === cy);
    if (buildTool === 'erase') {
      if (i >= 0) { pendingPaths.splice(i, 1); redrawPathCell(cx, cy); }
      return;
    }
    if (i >= 0) {
      if (pendingPaths[i].style === pathStyle) pendingPaths.splice(i, 1);   // toggle-erase: same cell, same style
      else pendingPaths[i].style = pathStyle;
      redrawPathCell(cx, cy);
      return;
    }
    if (pendingPaths.length >= PATH_CAP) { pathCapWobble(); return; }
    pendingPaths.push({ cx, cy, style: pathStyle });
    redrawPathCell(cx, cy);
  }
  function cellAtClient(cx, cy) {
    const r = viewport.getBoundingClientRect();
    const worldX = (cx - r.left) + scrollX;
    const localY = cy - r.top;
    const { bandTopPx, bandBotPx, cellW, cellH } = cellGeom();
    return { cx: Math.floor(worldX / cellW), cy: Math.floor((localY - bandTopPx) / cellH), inBand: localY >= bandTopPx && localY <= bandBotPx };
  }
  function paintAtClient(cx, cy) {
    const cell = cellAtClient(cx, cy);
    if (!cell.inBand) return;
    paintCell(cell.cx, cell.cy);
  }

  // ---- build mode toggle (RUN10 P3) ----------------------------------------
  function toggleBuildMode() {
    sfx.tap();
    buildMode = !buildMode;
    if (buildMode) {
      loadPendingPaths();
      pathCommitTimer = setInterval(commitPaths, 10000);   // "commit on exit or every 10s" (spec)
      buildTool = 'place';
      toolBtns.forEach((b, i) => b.classList.toggle('sel', BUILD_TOOLS[i].id === buildTool));
      drawerApi.showTab(isInterior ? 'furniture' : 'boos');
      drawerApi.open();
    } else {
      if (pathCommitTimer) { clearInterval(pathCommitTimer); pathCommitTimer = null; }
      commitPaths();
      pendingPaths = null;
      holding = null; placeMode = false;
      renderDrawer();
    }
    updateBuildUI();
    renderPlaced();
    updateHint();
  }
  function selectBuildTool(id) {
    sfx.tap();
    buildTool = id;
    toolBtns.forEach((b, i) => b.classList.toggle('sel', BUILD_TOOLS[i].id === id));
    updateBuildUI();
  }
  function selectPathStyle(id) {
    sfx.tap();
    pathStyle = id;
    styleBtns.forEach((b, i) => b.classList.toggle('sel', PATH_STYLES[i].id === id));
  }
  function updateBuildUI() {
    root.classList.toggle('building', buildMode);
    hammerBtn.classList.toggle('active', buildMode);
    hammerBtn.setAttribute('aria-label', buildMode ? 'Exit build mode' : 'Build mode');
    pathStyleRow.style.display = (buildMode && buildTool === 'paths') ? '' : 'none';
    // Landscape is a Build-only, outdoor-only toybox (RUN10 P3/P4) — hidden whenever
    // either condition isn't met (e.g. build mode toggled on inside the Boo House).
    const tabs = [...drawer.querySelectorAll('.bd-tabs .bd-tab')];
    const landscapeVisible = buildMode && AREA.kind === 'outdoor';
    const landscapeTabBtn = tabs[DRAWER_TABS_SPEC.findIndex(spec => spec.id === 'landscape')];
    if (landscapeTabBtn) landscapeTabBtn.style.display = landscapeVisible ? '' : 'none';
    if (!landscapeVisible && drawerApi.activeTab() === 'landscape') drawerApi.showTab('deco');
    const furnitureVisible = AREA.kind === 'interior';
    const furnitureTabBtn = tabs[DRAWER_TABS_SPEC.findIndex(spec => spec.id === 'furniture')];
    if (furnitureTabBtn) furnitureTabBtn.style.display = furnitureVisible ? '' : 'none';
    if (!furnitureVisible && drawerApi.activeTab() === 'furniture') drawerApi.showTab('deco');
  }

  function renderScenery() {
    clear(sky); clear(hills); clear(ground);
    if (isInterior) { renderInteriorScenery(); renderPaths(); return; }
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
    renderPaths();   // ground layer, above grass, below row-0 items (RUN10 P3) — renderScenery wipes ground
  }

  // Room backdrop (RUN10 P4): a wall band (top 55%) + a floor band, no sky/hills/signpost —
  // the Boo House is always unlocked and is never a "place to discover", it's home.
  function renderInteriorScenery() {
    const wallH = viewH * INTERIOR_WALL_FRAC;
    const wall = el('div', { class: 't-interior-wall' });
    wall.style.width = worldW + 'px'; wall.style.height = wallH + 'px';
    hills.appendChild(wall);
    const bunting = el('div', { class: 't-interior-bunting', 'aria-hidden': 'true', html: '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>' });
    bunting.style.left = (worldW * 0.08) + 'px';
    bunting.style.width = (worldW * 0.46) + 'px';
    hills.appendChild(bunting);
    const windowEl = el('div', { class: 't-interior-window' });
    windowEl.style.left = (worldW * 0.5 - 46) + 'px'; windowEl.style.top = (wallH * 0.28) + 'px';
    windowEl.append(el('i', { class: 't-window-cross' }), el('i', { class: 't-window-curtain left' }), el('i', { class: 't-window-curtain right' }));
    hills.appendChild(windowEl);
    const shelf = el('div', { class: 't-interior-shelf', 'aria-hidden': 'true', html: '<i></i><i></i><i></i><i></i>' });
    shelf.style.left = (worldW * 0.72) + 'px';
    shelf.style.top = (wallH * 0.28) + 'px';
    hills.appendChild(shelf);
    const door = el('div', { class: 't-interior-door', 'aria-hidden': 'true' });
    door.style.left = (worldW * 0.08) + 'px';
    door.style.top = (wallH * 0.22) + 'px';
    hills.appendChild(door);
    const skirting = el('div', { class: 't-interior-skirting', 'aria-hidden': 'true' });
    skirting.style.top = (wallH - 7) + 'px';
    skirting.style.width = worldW + 'px';
    hills.appendChild(skirting);
    const floor = el('div', { class: 't-interior-floor' });
    floor.style.left = '0'; floor.style.top = wallH + 'px';
    floor.style.width = worldW + 'px'; floor.style.height = (viewH - wallH) + 'px';
    ground.appendChild(floor);
  }

  function renderPlaced() {
    ground.querySelectorAll('.t-item').forEach(n => n.remove());
    // clear any orphaned zone-behaviour props (RUN7 C2) so a re-render never leaves them stranded
    ground.querySelectorAll('.t-kite-wrap, .t-skip-stone, .t-skim-ring, .t-sandcastle, .t-towel').forEach(n => n.remove());
    actors = [];
    // Every actor object is being rebuilt below, so any socket occupancy pointing at the
    // OLD (now orphaned) actor objects would otherwise stay "taken" forever — self-heal
    // in socketArrFor() only catches an actor whose OWN role no longer matches, and an
    // orphaned actor's role is untouched, so it never trips. assignRoles() (called at the
    // end of this function) re-claims every still-valid seat fresh.
    socketUse.clear();
    const st = getState();
    let count = 0, fancyCount = 0;
    for (const t of areaItems(st)) {
      const item = resolveItem(t.item);
      if (!item) continue;
      const zi = ZONE_INDEX[t.zone] ?? 0;
      const x = clamp01(t.x);
      const px = zi * zoneW + x * zoneW;
      // Wall-hung items (RUN10 P4): a fixed row, no depth variation, drawn behind the
      // floor's own items (lower z) — a bookshelf never blocks a Boo standing in front of it.
      const onWall = t.row === WALL_ROW;
      const row = onWall ? WALL_ROW : rowOf(t);
      const rowGroundPx = onWall ? viewH * WALL_Y_FRAC : viewH * ROW_GROUND[row];
      const baseSize = onWall ? (ACT_SIZE[t.item] || 92) : (ACT_SIZE[t.item] || 92) * ROW_SCALE[row];
      const size = baseSize * itemScaleOf(t);
      const wrap = el('div', { class: 't-item' + (item.kind === 'boo' ? ' boo' : '') + (onWall ? ' on-wall' : '') + (item.kind === 'boo' && isBestFriend(item.id, st) ? ' care-bff' : ''), dataset: { zone: t.zone, x: String(t.x), item: t.item, row: String(row) } });
      wrap.dataset.scale = String(itemScaleOf(t));
      wrap.style.left = (px - size / 2) + 'px';
      wrap.style.top = (rowGroundPx - size + 8) + 'px';
      wrap.style.zIndex = onWall ? '1' : String(Math.round(rowGroundPx));
      // Table lamp (RUN10 P4): glows 21:00-07:00, same one-render-time-check pattern as
      // growth.js's fairy lights.
      if (t.item === 'deco_tablelamp' && isNight(currentHour())) wrap.classList.add('lit');
      wrap.innerHTML = t.item === 'deco_bffportrait' && t.portraitBoo
        ? renderBffPortrait(t.portraitBoo, size)
        : renderItem(item, { size, equipArt: item.kind === 'boo' ? equippedArt(item.id) : null });
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
    renderZoneScenery();   // zone identity (RUN7 C2): distinct backdrop per zone, behind items
    renderGrowth();
    renderFunfair();
    renderHide();
    decorateEasels();
    renderRequestBubble();
  }

  // ---- hide-and-seek Boo 2.0 (RUN10 P5): a specific hidePoint, giggle+wiggle alive ----
  let hideWiggleTimer = null;
  function renderHide() {
    ground.querySelectorAll('.t-hide-peek').forEach(n => n.remove());
    if (hideWiggleTimer) { clearTimeout(hideWiggleTimer); hideWiggleTimer = null; }
    const h = currentHide();
    if (!h) return;
    if ((ZONE_INDEX[h.spot.zone] ?? -1) < 0) return;   // hiding in a different area than this mount (graceful no-op)
    const hiderWrap = [...ground.querySelectorAll('.t-item.boo')].find(w => w.dataset.item === h.boo);
    if (!hiderWrap) return;
    hiderWrap.style.display = 'none';
    const hp = HIDE_POINTS[h.spot.item] || { x: 0, row: 1, peek: 'ears' };
    const zi = ZONE_INDEX[h.spot.zone] ?? 0;
    const row = hp.row != null ? hp.row : 1;
    const itemPx = zi * zoneW + clamp01(h.spot.x) * zoneW;
    const rowGroundPx = viewH * ROW_GROUND[row];
    const itemH = (ACT_SIZE[h.spot.item] || 92) * ROW_SCALE[row] * 130 / 120;
    const hiderItem = resolveItem(h.boo);
    if (!hiderItem) { hiderWrap.style.display = ''; return; }
    const peekKind = ['ears', 'tail', 'feet'].includes(hp.peek) ? hp.peek : 'ears';
    const peek = el('button', {
      class: `t-hide-peek peek-${peekKind}`,
      'aria-label': `${getDisplayName(h.boo)} is hiding here`,
      html: `<span class="t-hide-peek-art">${renderItem(hiderItem, { size: 64, equipArt: equippedArt(h.boo) })}</span>`
    });
    const peekW = 64, peekH = 64;
    const offX = (hp.x || 0) * itemH;
    peek.style.left = (itemPx + offX - peekW / 2) + 'px';
    const hostTop = rowGroundPx - itemH + 8;
    peek.style.top = (peekKind === 'feet'
      ? rowGroundPx - 44
      : peekKind === 'tail'
        ? hostTop + itemH * 0.42 - peekH / 2
        : hostTop - 18) + 'px';
    // The artwork is clipped so it still LOOKS tucked behind the host, while the generous
    // 64px touch target sits above it and remains reliably tappable on a phone.
    peek.style.zIndex = String(Math.max(2, Math.round(rowGroundPx) + 1));
    // pointer pattern mirrors attachItemPointer: stop the pan from swallowing taps
    peek.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    peek.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (!foundHide()) return;
      addMeterPoints(HIDE_REWARD);   // +2 meter for spotting (C9)
      sfx.correct(); sfx.star();
      hiderWrap.style.display = '';
      const svg = hiderWrap.querySelector('svg');
      if (svg && !REDUCED) { svg.classList.remove('squeak'); void svg.offsetWidth; svg.classList.add('squeak'); }
      if (!REDUCED) confetti({ count: 30, power: 0.7, origin: pointFor(hiderWrap) });
      if (hideWiggleTimer) { clearTimeout(hideWiggleTimer); hideWiggleTimer = null; }
      peek.remove();
      const line = 'Found you! Hee hee! 💜';
      const treat = el('div', { class: 'request-treat', text: line });
      hiderWrap.appendChild(treat);
      setTimeout(() => treat.remove(), 2200);
    });
    ground.appendChild(peek);
    if (!REDUCED) scheduleHideWiggle(peek);
  }
  let hideWiggleDelay = 0;
  function scheduleHideWiggle(peek) {
    hideWiggleDelay = HIDE_WIGGLE_MIN_MS + Math.random() * (HIDE_WIGGLE_MAX_MS - HIDE_WIGGLE_MIN_MS);
    hideWiggleTimer = setTimeout(() => fireHideWiggle(peek), hideWiggleDelay);
  }
  function fireHideWiggle(peek) {
    if (!peek.isConnected) return;
    sfx.giggle();
    peek.classList.remove('hide-wiggle'); void peek.offsetWidth; peek.classList.add('hide-wiggle');
    scheduleHideWiggle(peek);
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
    if (AREA.key !== 'meadow') return;   // every growth milestone is zone:'meadow' (growth.js) — RUN10 P1 scoping
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
  // ---- zone identity scenery (RUN7 C2) -----------------------------------
  // Each distinct zone draws its signature backdrop in the GROUND layer, behind the
  // placed items (low z-index, pointer-events none) so it never blocks placement and
  // stays aligned with the Boos and their zone behaviours (no parallax drift).
  function renderZoneScenery() {
    ground.querySelectorAll('.t-zone-props').forEach(n => n.remove());
    const stars = totalStars();
    const night = isNight(currentHour());
    ZONES.forEach((z, i) => {
      if (z.key === 'meadow' || z.key === 'funfair') return;   // meadow = baseline, funfair = own theming
      if (stars < z.unlock) return;                            // locked zones show only their signpost
      const html = zoneScenery(z.key, zoneW, viewH, night);
      if (!html) return;
      const wrap = el('div', { class: 't-zone-props ' + z.key + (night ? ' night' : ''), html });
      wrap.style.left = (i * zoneW) + 'px'; wrap.style.top = '0';
      wrap.style.width = zoneW + 'px'; wrap.style.height = viewH + 'px'; wrap.style.zIndex = '2';
      ground.insertBefore(wrap, ground.firstChild);
    });
  }

  function renderFunfair() {
    ground.querySelectorAll('.ff-ride, .ff-consite, .ff-scenery-wrap').forEach(n => n.remove());
    if (AREA.key !== 'funfair') return;   // RUN10 P1: the fair only ever renders inside its own area
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

  // ---- funfair grand-opening (RUN7 C1) -----------------------------------
  // The fair is open from the start on every save; her FIRST visit plays a one-time
  // ceremony: two gates swing open, confetti, the guide announces the fair is OPEN.
  // Fires once ever (seen.funfairOpened), and never stacks (grandOpeningShown guard).
  let grandOpeningShown = false;
  function maybeGrandOpening() {
    if (grandOpeningShown) return;
    const st = getState();
    if (st.seen && st.seen.funfairOpened) { grandOpeningShown = true; return; }
    grandOpeningShown = true;
    mutate(s2 => { s2.seen = s2.seen || {}; s2.seen.funfairOpened = todayKeyLocal(); });
    stampJournal('funfair_open');            // Journal: the fair opened (RUN3 C4 pattern)
    playFunfairGrandOpening();
  }
  function playFunfairGrandOpening() {
    sfx.fanfare();
    const ov = el('div', { class: 'overlay funfair-grand' });
    const panel = el('div', { class: 'fg-panel' }, [
      el('div', { class: 'fg-gates' }, [
        el('div', { class: 'fg-gate left', html: fairGateSVG('left') }),
        el('div', { class: 'fg-gate right', html: fairGateSVG('right') }),
        el('div', { class: 'fg-behind' }, [
          el('div', { class: 'fg-ferris', html: funfairSilhouette() }),
          el('div', { class: 'fg-title', text: 'The Boo Funfair' }),
          el('div', { class: 'fg-open', text: 'is OPEN!' })
        ])
      ]),
      el('button', { class: 'btn big fg-go', text: "Let's go! 🎡", onclick: () => { sfx.tap(); ov.remove(); scrollToZone(ZONE_INDEX['funfair']); } })
    ]);
    ov.appendChild(panel); root.appendChild(ov);
    requestAnimationFrame(() => { ov.classList.add('show'); setTimeout(() => ov.classList.add('open'), REDUCED ? 0 : 650); });
    if (!REDUCED) { confetti({ count: 120, power: 1.15 }); setTimeout(() => confetti({ count: 70, power: 0.9 }), 700); }
    speakMaybe('The Boo Funfair is OPEN!');
  }
  function fairGateSVG(side) {
    const flip = side === 'right' ? 'scale(-1,1) translate(-120,0)' : '';
    return `<svg viewBox="0 0 120 220" width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><g transform="${flip}">
      <rect x="8" y="18" width="104" height="196" rx="8" fill="#FF5C8A" stroke="#2A1B4E" stroke-width="4"/>
      <rect x="20" y="30" width="80" height="184" rx="6" fill="#FFC0E6" stroke="#2A1B4E" stroke-width="3"/>
      ${Array.from({ length: 5 }, (_, i) => `<circle cx="60" cy="${52 + i * 36}" r="7" fill="${['#FFC93C', '#35D0BA', '#8FC7FF'][i % 3]}" stroke="#2A1B4E" stroke-width="2.5"/>`).join('')}
      <path d="M0 18 Q60 -14 120 18" fill="none" stroke="#FFC93C" stroke-width="6"/></g></svg>`;
  }

  // ---- activity roles (RUN4 C5) -------------------------------------------
  // Every activity deco claims nearby free Boos: slide/swings/trampoline/pool/
  // bumper take one, seesaw and picnic need two, the campfire gathers a small
  // circle at night, and Boos near a Boo House curl up asleep between 21:00 and
  // 07:00. The old bench-seat and pond-paddle promises (RUN2 C3) live here too.
  // Idempotent: safe to re-run every few seconds and on every re-render.
  const benchCooldown = new Map();   // 'zone:x:item' -> timestamp
  // ---- activity sockets (RUN10 P2): each placed item's seats, tracked by instance ----
  const socketUse = new Map();       // 'zone:x:item' -> array of actor|null, length = SOCKETS[item].length
  function itemKeyOf(t) { return t.zone + ':' + t.x + ':' + t.item; }
  function socketArrFor(t) {
    const sockets = SOCKETS[t.item]; if (!sockets) return null;
    const key = itemKeyOf(t);
    let arr = socketUse.get(key);
    if (!arr || arr.length !== sockets.length) { arr = new Array(sockets.length).fill(null); socketUse.set(key, arr); }
    // self-heal: an actor that no longer holds this exact socket frees the slot (role
    // cleared, re-rendered, or reassigned elsewhere without going through releaseSocket)
    for (let i = 0; i < arr.length; i++) {
      const own = arr[i];
      if (own && (!own.role || own.role.socketArrKey !== key || own.role.socketIdx !== i)) arr[i] = null;
    }
    return arr;
  }
  function releaseSocket(a) {
    if (!a.role || !a.role.socketArrKey) return;
    const arr = socketUse.get(a.role.socketArrKey);
    if (arr && arr[a.role.socketIdx] === a) arr[a.role.socketIdx] = null;
  }
  // Hoisted to mount level (not just assignRoles' sweep) so stepGoal's arrival handler
  // can also claim a socket the instant a Boo reaches an activity (RUN10 P2).
  const wrapFor = (t) => [...ground.querySelectorAll('.t-item')].find(w => w.dataset.zone === t.zone && Math.abs(+w.dataset.x - t.x) < 0.001 && w.dataset.item === t.item);
  // Use the Boo's CURRENT position (home + wander offset) so a Boo that walked
  // UP to an activity (C1 behaviour engine) gets claimed on arrival, not just one
  // that happened to be placed beside it. Goal-pursuers aren't yanked mid-act.
  const curX = (a) => a.place.x + ((a.dx || 0) / (zoneW || 1));
  const freeNear = (t, radius) => actors
    .filter(a => !a.role && !a.dancing && !a.goal && ZONE_INDEX[a.place.zone] === ZONE_INDEX[t.zone] && Math.abs(curX(a) - t.x) <= radius)
    .sort((p, q) => Math.abs(curX(p) - t.x) - Math.abs(curX(q) - t.x));
  const give = (a, role) => {
    if (actors.filter(x => x.role).length >= MAX_ACTIVE_ROLES) return false;
    a.goal = null; a.dx = 0; a.depth = 0; a.depthTarget = 0;   // claimed → drop any goal + wander offset (C1)
    a.role = Object.assign({ t: Math.random() * 500 }, role);
    // Socket offset (RUN10 P2): x = fraction of the item's rendered WIDTH from its
    // centre, so multi-seat items (seesaw, trampoline, picnic...) seat riders apart
    // instead of stacking them on the item's own centre point.
    const itemRow = rowOf(role.deco);
    const itemW = (ACT_SIZE[role.deco.item] || 92) * ROW_SCALE[itemRow];
    const sockX = role.socket ? role.socket.x * itemW : 0;
    a.role.offX = (role.deco.x - a.place.x) * zoneW + sockX;
    // Depth-align to the SOCKET's row (may differ from the item's own row, e.g. the
    // trampoline's middle socket sits one row further back) so the role transforms
    // (which assume a shared ground line) still read correctly.
    const dw = role.decoWrap || wrapFor(role.deco);
    if (dw) {
      if (a._homeTop == null) { a._homeTop = a.wrap.style.top; a._homeZ = a.wrap.style.zIndex; }
      const socketRow = (role.socket && role.socket.row != null) ? role.socket.row : itemRow;
      // yFrac: fraction of the ITEM's rendered height the seat surface sits above its own
      // ground line (fine-tuned per item against real screenshots — see data/sockets.js).
      // Row-independent (unlike a raw px yNudge) since it scales with the item's own size.
      const itemH = itemW * 130 / 120;   // every deco shares one 120x130 viewBox (art.js)
      const yNudge = role.socket && role.socket.yFrac ? role.socket.yFrac * itemH : 0;
      const rowGroundPx = viewH * ROW_GROUND[socketRow];
      a.wrap.style.top = (rowGroundPx - a.wrap.offsetHeight + 8 + yNudge) + 'px';
      a.wrap.style.zIndex = String(Math.round(rowGroundPx));
    }
    if (role.kind === 'sleep' && !a.wrap.querySelector('.t-zzz')) {
      a.wrap.appendChild(el('div', { class: 't-zzz', text: 'z Z z' }));
    }
    // Arrival settle (RUN10 P2): 180ms ease drop + one squash, via a one-shot CSS class
    // on the outer wrap (composes fine with the per-frame role transform on the svg).
    if (!REDUCED) { a.wrap.classList.remove('role-settle'); void a.wrap.offsetWidth; a.wrap.classList.add('role-settle'); }
    return true;
  };
  // Claim ANY free socket on a placed activity item, or return false (RUN10 P2). Used
  // both by assignRoles' periodic sweep and by stepGoal's arrival handler (a Boo that
  // just walked up claims immediately instead of waiting for the next tick).
  function tryClaimActivity(a, t) {
    const sockets = SOCKETS[t.item]; if (!sockets) return false;
    const arr = socketArrFor(t); if (!arr) return false;
    const i = arr.findIndex(x => !x); if (i < 0) return false;
    const socketArrKey = itemKeyOf(t);
    const ok = give(a, { kind: KIND_FOR[t.item], deco: t, decoWrap: wrapFor(t), socket: sockets[i], socketArrKey, socketIdx: i, slot: i });
    if (ok) arr[i] = a;
    return ok;
  }
  // No free socket → a small shrug (300ms), then back to free wandering (RUN10 P2). The
  // shrug plays on the outer wrap (not the svg) so it composes with, rather than fights,
  // the wander loop's own per-frame transform on the svg once wandering resumes.
  function shrugAndEndGoal(a) {
    if (!REDUCED) { a.wrap.classList.remove('t-shrug'); void a.wrap.offsetWidth; a.wrap.classList.add('t-shrug'); }
    a.goal = null; a.dx = 0; a.next = SHRUG_MS + Math.random() * 200;
  }
  function assignRoles() {
    const st = getState();
    const now = performance.now();
    const night = isSleepTime(currentHour());
    // stale roles: daytime ends sleep + campfire circles
    for (const a of actors) {
      if (!a.role) continue;
      if ((a.role.kind === 'sleep' || a.role.kind === 'campfire') && !night) clearRole(a);
      if (a.role && a.role.kind === 'sleep' && a.wakeUntil && now < a.wakeUntil) clearRole(a);
    }
    const decosOf = (id) => areaItems(st).filter(t => t.item === id);
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
    // 3) socket-driven activities (RUN10 P2): every ACT_IDS item claims one free socket
    // per nearby free Boo. Sockets fill independently — a lone seesaw rider just sits
    // still (stepRole checks sibling occupancy before it pivots); no more "only start
    // when both seats can fill at once".
    for (const id of ACT_IDS) {
      const sockets = SOCKETS[id]; if (!sockets) continue;
      const kind = KIND_FOR[id];
      for (const t of decosOf(id)) {
        if (COOLDOWN_ITEMS.has(id)) {
          const key = itemKeyOf(t);
          if ((benchCooldown.get(key) || 0) > now) continue;
        }
        const arr = socketArrFor(t); if (!arr) continue;
        const dw = wrapFor(t);
        const socketArrKey = itemKeyOf(t);
        for (let i = 0; i < sockets.length; i++) {
          if (arr[i]) continue;
          const a = freeNear(t, ACT_RADIUS)[0];
          if (!a) break;   // no more free Boos nearby this tick
          const role = { kind, deco: t, decoWrap: dw, socket: sockets[i], socketArrKey, socketIdx: i, slot: i };
          if (id === 'deco_bench') role.until = now + BENCH_SIT_MS;
          if (give(a, role)) {
            arr[i] = a;
            if (id === 'deco_bench') benchCooldown.set(socketArrKey, now + BENCH_SIT_MS + BENCH_COOLDOWN_MS);
          }
        }
      }
    }
  }
  function clearRole(a) {
    releaseSocket(a);   // RUN10 P2: free the seat for the next Boo
    a.role = null;
    a.wrap.querySelectorAll('.t-zzz, .t-rod').forEach(n => n.remove());
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
        // RUN10 P2: only pivots once BOTH sockets are seated (a lone rider just sits);
        // ±8°, 2.2s period. r.offX already carries the socket's seat offset.
        const arr = r.socketArrKey ? socketUse.get(r.socketArrKey) : null;
        const bothSeated = arr && arr.filter(Boolean).length >= 2;
        const flip = r.socket && r.socket.flip != null ? r.socket.flip : (r.slot === 0 ? 1 : -1);
        if (bothSeated) {
          const s = Math.sin(t * 2 * Math.PI / SEESAW_PERIOD_MS);
          const endY = flip * s * 15;                       // plank end height
          const hop = Math.max(0, flip * s) * 10;           // little pop at the top
          svg.style.transform = `translate(${r.offX.toFixed(1)}px, ${(-32 + endY - hop).toFixed(1)}px) scale(0.8)`;
          if (flip === 1) {
            const plank = r.decoWrap && r.decoWrap.querySelector('.ss-plank');
            if (plank) plank.style.transform = `rotate(${(s * 8).toFixed(1)}deg)`;
          }
        } else {
          svg.style.transform = `translate(${r.offX.toFixed(1)}px, -32px) scale(0.8)`;   // waiting for a partner
        }
        break;
      }
      case 'bounce': {
        const y = -Math.abs(Math.sin(t / 480)) * 52;      // higher than the usual hop (12px)
        const squash = y > -5 ? ' scale(0.9, 0.74)' : ' scale(0.82)';
        svg.style.transform = `translate(${r.offX.toFixed(1)}px, ${(-26 + y).toFixed(1)}px)${squash}`;
        break;
      }
      case 'paddle': {
        const x = r.offX + Math.sin(t / 900) * 16;
        const y = -10 + Math.sin(t / 500) * 4;
        svg.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(Math.sin(t / 700) * 8).toFixed(1)}deg)`;
        const water = r.decoWrap && r.decoWrap.querySelector('.pp-water');
        if (water) { water.style.transformOrigin = '60px 94px'; water.style.transform = `scale(1, ${(1 + Math.sin(t / 500) * 0.06).toFixed(3)})`; }
        break;
      }
      // Pond fishing (RUN10 P3): hold 6-10s (a bobber dip 60% of the time), then a splash
      // burst — 85% a sparkling fish arc, 15% a comedy boot. All timings/outcome are rolled
      // ONCE on arrival and stored on the role, so a re-render never re-rolls mid-act.
      case 'fish': {
        if (r.holdMs == null) {
          r.holdMs = FISH_HOLD_MIN + Math.random() * (FISH_HOLD_MAX - FISH_HOLD_MIN);
          r.willDip = Math.random() < FISH_DIP_CHANCE;
          r.dipAt = r.willDip ? r.holdMs * (0.35 + Math.random() * 0.4) : -1;
          r.outcome = Math.random() < FISH_CATCH_CHANCE ? 'catch' : 'boot';
          r.phase = 'hold';
          if (!a.wrap.querySelector('.t-rod')) a.wrap.appendChild(el('div', { class: 't-rod' }, [el('div', { class: 't-bobber' })]));
        }
        if (r.phase === 'hold') {
          const dipping = r.willDip && Math.abs(t - r.dipAt) < 220;
          // A patient, breathing sway while she waits — not just the rod-tip's own dip —
          // so a fishing Boo reads as alive even before anything bites.
          const bob = Math.sin(t / 900) * 4;
          svg.style.transform = `translate(${r.offX.toFixed(1)}px, ${(-4 + bob).toFixed(1)}px) rotate(${(Math.sin(t / 1400) * 3).toFixed(1)}deg) scale(0.86)`;
          const bobber = a.wrap.querySelector('.t-bobber');
          if (bobber) bobber.style.transform = `translateY(${dipping ? 9 : Math.sin(t / 600) * 2}px)`;
          if (t >= r.holdMs) {
            r.phase = 'burst'; r.burstStart = t;
            if (r.outcome === 'catch') sfx.giggle(); else sfx.trombone();
          }
        } else if (r.phase === 'burst') {
          const bt = t - r.burstStart;
          if (r.outcome === 'catch') {
            const p = Math.min(1, bt / FISH_CATCH_MS);
            const arc = -Math.sin(p * Math.PI) * 74;
            svg.style.transform = `translate(${r.offX.toFixed(1)}px, ${(-4 + arc).toFixed(1)}px) rotate(${(p * 340).toFixed(0)}deg) scale(0.86)`;
            if (bt >= FISH_CATCH_MS) { benchCooldown.set(r.socketArrKey, now + FISH_COOLDOWN_MS); clearRole(a); }
          } else {
            const p = Math.min(1, bt / FISH_BOOT_MS);
            svg.style.transform = `translate(${r.offX.toFixed(1)}px, ${(-4 - p * 42).toFixed(1)}px) rotate(${(p * 22 - 11).toFixed(1)}deg) scale(0.86)`;
            if (!r.dripped && p > 0.28) { r.dripped = true; spawnDrips(a.wrap); }
            if (bt >= FISH_BOOT_MS) { benchCooldown.set(r.socketArrKey, now + FISH_COOLDOWN_MS); clearRole(a); }
          }
        }
        break;
      }
      case 'picnic': {
        // r.offX already carries the socket's seat offset (RUN10 P2) — side only leans the pose.
        const side = r.slot === 0 ? -1 : 1;
        const nibble = Math.max(0, Math.sin((t + r.slot * 400) / 380)) * 0.07;
        svg.style.transform = `translate(${r.offX.toFixed(1)}px, 2px) rotate(${side * -4}deg) scale(0.86, ${(0.8 + nibble).toFixed(3)})`;
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

  // Comedy boot drips (RUN10 P3 fishing): three little drops, staggered, fading as they fall.
  function spawnDrips(wrap) {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!wrap.isConnected) return;
        const d = el('div', { class: 't-drip' });
        wrap.appendChild(d);
        setTimeout(() => d.remove(), 700);
      }, i * 220);
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
    const stages = areaItems(st).filter(t => t.item === 'deco_stage');
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
    // First time the (always-open) funfair is centred, play its grand opening (RUN7 C1).
    if (ZONES[zi] && ZONES[zi].key === 'funfair') maybeGrandOpening();
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
  // Zone-unlock reveal (RUN7 C2): pan across the whole new zone so the unlock reads as
  // DISCOVERING a new place — its distinct scenery slides past left→right.
  function panAcrossZone(zi, ms = 2200) {
    const left = Math.max(0, Math.min(zi * zoneW, worldW - viewW));
    const right = Math.max(0, Math.min(zi * zoneW + (zoneW - viewW), worldW - viewW));
    if (REDUCED) { scrollX = Math.min(right, left + (right - left) / 2); clampScroll(); applyScroll(); return; }
    scrollX = left; clampScroll(); applyScroll();
    const dt0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - dt0) / ms);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // ease-in-out across the zone
      scrollX = left + (right - left) * e; clampScroll(); applyScroll();
      if (p < 1) requestAnimationFrame(step);
    })(dt0);
  }

  let dragScroll = false, sx = 0, sScroll = 0, vel = 0, lastX = 0, lastT = 0, momRaf = null, movedScroll = false;
  viewport.addEventListener('pointerdown', e => {
    if (e.target.closest('.t-item') || e.target.closest('.t-signpost') || e.target.closest('.ff-ride') || e.target.closest('.ff-bandstand')) return; // items/rides/bandstand handle their own
    if (buildMode && (buildTool === 'paths' || buildTool === 'erase')) {
      painting = true;
      viewport.setPointerCapture(e.pointerId);
      paintAtClient(e.clientX, e.clientY);
      return;
    }
    if (momRaf) { cancelAnimationFrame(momRaf); momRaf = null; }
    dragScroll = true; movedScroll = false; sx = e.clientX; sScroll = scrollX; vel = 0; lastX = e.clientX; lastT = performance.now();
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', e => {
    if (painting) { paintAtClient(e.clientX, e.clientY); return; }
    if (!dragScroll) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 4) movedScroll = true;
    scrollX = sScroll - dx; clampScroll(); applyScroll();
    const now = performance.now(); const dt = now - lastT;
    if (dt > 0) vel = (e.clientX - lastX) / dt;
    lastX = e.clientX; lastT = now;
  });
  const endScroll = (e) => {
    if (painting) { painting = false; return; }
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
  viewport.addEventListener('pointercancel', () => { dragScroll = false; painting = false; });
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
    return areaItems(getState()).some(t => t !== except && (ZONE_INDEX[t.zone] ?? 0) === zi && rowOf(t) === row && Math.abs(t.x - x) < MIN_SPACING);
  }
  // Wall-hung items (RUN10 P4) live in their own lane — never compared against floor rows.
  function wallSpotTaken(x, except) {
    return areaItems(getState()).some(t => t !== except && t.row === WALL_ROW && Math.abs(t.x - x) < MIN_SPACING);
  }
  function spotWobble() {
    drawer.classList.remove('taken'); void drawer.offsetWidth; drawer.classList.add('taken');
    setTimeout(() => drawer.classList.remove('taken'), 600);
    hint.textContent = "That spot's taken — try a little further along!";
    if (sfx.oops) sfx.oops();
  }
  // Capacity (RUN10 P2): a full area refuses new drops with a soft red tint + guide line.
  function areaFull(except) {
    const n = areaItems(getState()).filter(t => t !== except).length;
    return n >= AREA_CAP;
  }
  function areaFullWobble() {
    drawer.classList.remove('taken'); void drawer.offsetWidth; drawer.classList.add('taken');
    setTimeout(() => drawer.classList.remove('taken'), 600);
    const line = guideLine('L_AREA_FULL');
    hint.textContent = line;
    speakMaybe(line);
    if (sfx.oops) sfx.oops();
  }
  // Outdoor-only items (landscape + rides) refuse indoors; furniture refuses outdoors
  // (RUN10 P4). Same wobble, two directions, two lines.
  function notIndoorsWobble() {
    drawer.classList.remove('taken'); void drawer.offsetWidth; drawer.classList.add('taken');
    setTimeout(() => drawer.classList.remove('taken'), 600);
    const line = guideLine('L_NOT_INDOORS');
    hint.textContent = line;
    speakMaybe(line);
    if (sfx.oops) sfx.oops();
  }
  function notOutdoorsWobble() {
    drawer.classList.remove('taken'); void drawer.offsetWidth; drawer.classList.add('taken');
    setTimeout(() => drawer.classList.remove('taken'), 600);
    const line = guideLine('L_NOT_OUTDOORS');
    hint.textContent = line;
    speakMaybe(line);
    if (sfx.oops) sfx.oops();
  }
  // Illegal-drop preview (RUN10 P2): while dragging, find the nearest legal spot (same
  // row first, then other rows) so a ghost ring can show WHERE it would land instead.
  function nearestLegalSpot(zi, x, row, except) {
    if (areaFull(except)) return null;
    const STEP = MIN_SPACING * 0.6;
    for (let d = 0; d <= 0.5; d += STEP) {
      const cands = d === 0 ? [x] : [x - d, x + d];
      for (const cand of cands) {
        if (cand < 0 || cand > 1) continue;
        if (!spotTaken(zi, cand, row, except)) return { x: cand, row };
      }
    }
    for (let r2 = 0; r2 < DEPTH_ROWS; r2++) {
      if (r2 !== row && !spotTaken(zi, x, r2, except)) return { x, row: r2 };
    }
    return null;
  }
  function nearestLegalWallSpot(x, except) {
    if (areaFull(except)) return null;
    const STEP = MIN_SPACING * 0.6;
    for (let d = 0; d <= 0.5; d += STEP) {
      const cands = d === 0 ? [x] : [x - d, x + d];
      for (const cand of cands) {
        if (cand >= 0.05 && cand <= 0.95 && !wallSpotTaken(cand, except)) return cand;
      }
    }
    return null;
  }
  const dropGhost = el('div', { class: 'drop-ghost' });
  air.appendChild(dropGhost);   // the air layer is never cleared by renderScenery/renderPlaced
  function showDropPreview(dragEl, zi, x, row, except) {
    const legal = !areaFull(except) && !spotTaken(zi, x, row, except);
    dragEl.classList.toggle('invalid-drop', !legal);
    if (legal) { dropGhost.classList.remove('show'); return; }
    const spot = nearestLegalSpot(zi, x, row, except);
    if (!spot) { dropGhost.classList.remove('show'); return; }
    const rowGroundPx = viewH * ROW_GROUND[spot.row];
    dropGhost.style.left = (zi * zoneW + spot.x * zoneW) + 'px';
    dropGhost.style.top = rowGroundPx + 'px';
    dropGhost.classList.add('show');
  }
  function hideDropPreview(dragEl) { if (dragEl) dragEl.classList.remove('invalid-drop'); dropGhost.classList.remove('show'); }

  function placeAtClient(cx, cy) {
    const { zi, x } = zoneAndXAt(clientToWorld(cx));
    if (!canPlaceIn(zi)) { flashLocked(zi); return; }
    const heldItem = resolveItem(holding);
    if (heldItem) {
      // Outdoor-only: landscape (Build toybox) and rides (any activity item, `act`) —
      // furniture is indoor-only (RUN10 P4). Both directions, both ways.
      const outdoorOnly = heldItem.kind === 'landscape' || !!heldItem.act;
      const indoorOnly = heldItem.kind === 'furniture';
      if (outdoorOnly && AREA.kind !== 'outdoor') { notIndoorsWobble(); return; }
      if (indoorOnly && AREA.kind !== 'interior') { notOutdoorsWobble(); return; }
    }
    if (areaFull()) { areaFullWobble(); return; }
    // Wall-hung furniture (RUN10 P4): its own single-row lane, no depth-row Y choice.
    if (heldItem && heldItem.wall) {
      const wallX = wallSpotTaken(x) ? nearestLegalWallSpot(x) : x;
      if (wallX == null) { spotWobble(); return; }
      const id = holding;
      mutate(st => { areaItems(st).push({ zone: ZONES[zi].key, x: +wallX.toFixed(3), row: WALL_ROW, item: id, scale: holdingScale }); });
      holdingScale = 1;
      holding = null; placeMode = false;
      renderPlaced(); renderDrawer(); updateHint();
      sfx.pop();
      return;
    }
    const row = rowAtClient(cy);
    const landing = spotTaken(zi, x, row) ? nearestLegalSpot(zi, x, row) : { x, row };
    if (!landing) { spotWobble(); return; }
    const id = holding;
    mutate(st => { areaItems(st).push({ zone: ZONES[zi].key, x: +landing.x.toFixed(3), row: landing.row, item: id, scale: holdingScale }); });
    holdingScale = 1;
    holding = null; placeMode = false;
    renderPlaced(); renderDrawer(); updateHint();
    if (landing.x !== x || landing.row !== row) hint.textContent = 'Tucked into the nearest free spot!';
    sfx.pop();
  }

  function renderDrawer() {
    const st = getState();
    const placed = {};
    for (const t of areaItems(st)) placed[t.item] = (placed[t.item] || 0) + 1;
    const free = {};
    for (const [id, n] of Object.entries(st.inventory)) {
      const rit = resolveItem(id); if (!rit || rit.kind === "accessory") continue; // accessories are worn
      if (rit.kind === 'furniture' && !isInterior) continue;
      const f = n - (placed[id] || 0);
      if (f > 0) free[id] = f;
    }
    if (isInterior) {
      for (const item of Object.values(BY_ID).filter(it => it.kind === 'furniture')) {
        const total = (st.inventory[item.id] || 0) + (HOUSE_STARTER_STOCK[item.id] || 0);
        const available = total - (placed[item.id] || 0);
        if (available > 0) free[item.id] = available;
        else delete free[item.id];
      }
    }
    // Landscape items live in the Build toybox, not `inventory` (RUN10 P3) — always
    // available, independent of what she's actually won.
    for (const id of LANDSCAPE_IDS) free[id] = LANDSCAPE_STOCK - (placed[id] || 0);
    const ids = Object.keys(free);
    if (holding && !ids.includes(holding)) ids.unshift(holding);
    const tabButtons = drawer.querySelectorAll('.bd-tabs .bd-tab');
    for (const strip of Object.values(drawerStrips)) clear(strip);
    // Landscape items don't count toward "she hasn't collected anything yet" — that empty
    // state is about Boos/decorations she's still working to win.
    const nonLandscapeIds = ids.filter(id => { const it = resolveItem(id); return !it || it.kind !== 'landscape'; });
    if (!nonLandscapeIds.length && !holding) {
      DRAWER_TABS_SPEC.forEach((spec, i) => {
        drawerStrips[spec.id].appendChild(el('div', { class: 'drawer-empty', text: 'Win games to collect Boos, then place them here! 🌱' }));
        if (tabButtons[i]) tabButtons[i].textContent = spec.label;
      });
      return;
    }
    const counts = DRAWER_TABS_SPEC.map(() => 0);
    for (const id of ids) {
      const item = resolveItem(id);
      const chip = el("button", { class: 'drawer-item' + (holding === id ? ' holding' : ''), dataset: { item: id },
        onclick: () => selectHold(id) }, [
        el('div', { class: 'drawer-art', html: renderItem(item, { size: 60, equipArt: item.kind === 'boo' ? equippedArt(item.id) : null }) }),
        free[id] > 1 ? el('span', { class: 'drawer-badge', text: 'x' + free[id] }) : null
      ]);
      // drag-to-lift is delegated to the strip's own pointer handler (attachStripMomentum,
      // RUN10 P2) — it decides scroll-vs-lift by gesture direction since chips tile edge-to-edge
      const ti = DRAWER_TABS_SPEC.findIndex(spec => spec.test(item));
      const spec = DRAWER_TABS_SPEC[ti] || DRAWER_TABS_SPEC[2];   // fall back to Decorations
      drawerStrips[spec.id].appendChild(chip);
      counts[ti >= 0 ? ti : 2]++;
    }
    DRAWER_TABS_SPEC.forEach((spec, i) => {
      if (!drawerStrips[spec.id].children.length) drawerStrips[spec.id].appendChild(el('div', { class: 'drawer-empty', text: 'Nothing here yet!' }));
      if (tabButtons[i]) tabButtons[i].textContent = spec.label + (counts[i] ? ` (${counts[i]})` : '');
    });
  }
  function selectHold(id) {
    sfx.tap();
    holding = (holding === id) ? null : id;
    holdingScale = 1;
    placeMode = !!holding;
    renderDrawer(); updateHint();
    // close the tray so it stops covering the ground once she's picked something (RUN10 P2)
    if (holding) drawerApi.close();
  }
  // Horizontal momentum scroll for a drawer tab's chip strip (RUN10 P2): velocity fling,
  // decel 0.94/frame — matches the camera's own momentum feel (town.js scrollX, 0.92/frame).
  // A drag that starts on a chip could mean either "flick the sticker-book strip" or
  // "pick this one up to place it" — chips tile the strip edge-to-edge, so there is no
  // reliably-empty area to grab. Decided by GESTURE DIRECTION once the drag clears a
  // 10px threshold (mobile-icon-grid convention): horizontal = scroll, vertical(-up) =
  // lift. One delegated listener on the strip owns both (RUN10 P2).
  function attachStripMomentum(strip) {
    let phase = 'idle';   // idle -> deciding -> scroll | lift
    let sx = 0, sy = 0, startScroll = 0, vel = 0, lastX = 0, lastT = 0, raf = null, downChip = null;
    strip.addEventListener('pointerdown', e => {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      phase = 'deciding'; sx = e.clientX; sy = e.clientY; startScroll = strip.scrollLeft; vel = 0; lastX = e.clientX; lastT = performance.now();
      downChip = e.target.closest ? e.target.closest('.drawer-item') : null;
      // capture: once a lift is underway the pointer travels well outside the strip's own
      // box (up into the world) — without capture the browser would stop routing events here
      try { strip.setPointerCapture(e.pointerId); } catch {}
    });
    strip.addEventListener('pointermove', e => {
      if (phase === 'idle') return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (phase === 'deciding') {
        if (Math.hypot(dx, dy) < 10) return;
        if (!downChip || Math.abs(dx) > Math.abs(dy)) phase = 'scroll';
        else { phase = 'lift'; beginChipLift(downChip, downChip.dataset.item); }
      }
      if (phase === 'scroll') {
        strip.scrollLeft = startScroll - dx;
        const now = performance.now(); const dt = now - lastT;
        if (dt > 0) vel = (e.clientX - lastX) / dt;
        lastX = e.clientX; lastT = now;
      } else if (phase === 'lift') {
        updateChipLift(e.clientX, e.clientY);
      }
    });
    const end = (e) => {
      if (phase === 'scroll') {
        let v = vel * 16;
        if (Math.abs(v) >= 0.5 && !REDUCED) (function mom() { strip.scrollLeft -= v; v *= 0.94; if (Math.abs(v) > 0.4) raf = requestAnimationFrame(mom); })();
      } else if (phase === 'lift') {
        endChipLift(e.clientX, e.clientY);
      }
      phase = 'idle'; downChip = null;
    };
    strip.addEventListener('pointerup', end);
    strip.addEventListener('pointercancel', () => { if (phase === 'lift') cancelChipLift(); phase = 'idle'; downChip = null; });
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
    const onWall = !!item.wall;
    wrap.addEventListener('pointermove', e => {
      if (!down) return;
      if (!moved && Math.hypot(e.clientX - dsx, e.clientY - dsy) > 10) {
        moved = true; wrap.classList.add('dragging');
      }
      if (moved) {
        const { zi, x } = zoneAndXAt(clientToWorld(e.clientX));
        // Wall items (RUN10 P4) never leave the wall row — only x moves.
        const row = onWall ? WALL_ROW : rowAtClient(e.clientY);
        const rowGroundPx = onWall ? viewH * WALL_Y_FRAC : viewH * ROW_GROUND[row];
        wrap.style.left = (zi * zoneW + x * zoneW - wrap.offsetWidth / 2) + 'px';
        wrap.style.top = (rowGroundPx - wrap.offsetHeight + 8) + 'px';   // preview the depth row
        wrap.style.zIndex = onWall ? '1' : String(Math.round(rowGroundPx));
        wrap.dataset._zi = zi; wrap.dataset._x = x; wrap.dataset._row = String(row);
        if (!onWall) {
          const cur = areaItems(getState()).find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001 && rowOf(t) === rowOf(place));
          showDropPreview(wrap, zi, x, row, cur);   // illegal-drop tint + nearest-legal ghost (RUN10 P2)
        }
      }
    });
    wrap.addEventListener('pointerup', e => {
      if (!down) return; down = false;
      wrap.classList.remove('dragging');
      hideDropPreview(wrap);
      if (moved) {
        const zi = +wrap.dataset._zi, x = +wrap.dataset._x, row = +wrap.dataset._row;
        const cur = onWall
          ? areaItems(getState()).find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001 && t.row === WALL_ROW)
          : areaItems(getState()).find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001 && rowOf(t) === rowOf(place));
        const taken = onWall ? wallSpotTaken(x, cur) : spotTaken(zi, x, row, cur);
        const landing = onWall
          ? { x: taken ? nearestLegalWallSpot(x, cur) : x, row: WALL_ROW }
          : (taken ? nearestLegalSpot(zi, x, row, cur) : { x, row });
        if (canPlaceIn(zi) && landing && landing.x != null) {
          mutate(st => { const items = areaItems(st); const t = items.find(t => t === cur) || items.find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001); if (t) { t.zone = ZONES[zi].key; t.x = +landing.x.toFixed(3); t.row = landing.row; } });
          if (taken) hint.textContent = 'Tucked into the nearest free spot!';
        } else if (canPlaceIn(zi)) {
          spotWobble();   // occupied — snap back
        }
        renderPlaced();
      } else {
        onTap(wrap, place, item);
      }
    });
    wrap.addEventListener('pointercancel', () => { down = false; wrap.classList.remove('dragging'); hideDropPreview(wrap); });
  }

  function onTap(wrap, place, item) {
    if (item.kind === 'boo') {
      squeak(wrap, item);
      showCareArc(wrap, place, item);
      return;
    }
    if (item.id === 'deco_pond') spawnPondRipple(wrap);   // tap the pond anytime (RUN10 P3)
    openMenu(wrap, place, item);
  }

  let careArcTimer = null;
  function clearCareArc() {
    ground.querySelectorAll('.town-care-arc').forEach(n => n.remove());
    if (careArcTimer) clearTimeout(careArcTimer);
    careArcTimer = null;
    ground.classList.remove('care-open');
  }
  function showCareArc(wrap, place, item) {
    clearCareArc();
    ground.classList.add('care-open');
    const actions = [
      ['feed', '🍪', 'Treat'],
      ['brush', '🪮', 'Brush'],
      ['teeth', '🪥', 'Teeth'],
      ['play', '🙈', 'Play']
    ];
    const arc = el('div', { class: 'town-care-arc', 'aria-label': `Care for ${getDisplayName(item.id)}` });
    actions.forEach(([id, icon, label], i) => {
      const button = el('button', {
        class: `town-care-action action-${id}`,
        'aria-label': `${label} ${getDisplayName(item.id)}`,
        style: { '--i': i },
        onclick: e => {
          e.stopPropagation();
          const hasHideSpot = [...ground.querySelectorAll('.t-item:not(.boo)')].some(other => {
            const a = wrap.getBoundingClientRect(), b = other.getBoundingClientRect();
            return Math.hypot((a.left + a.width / 2) - (b.left + b.width / 2), (a.top + a.height / 2) - (b.top + b.height / 2)) <= 200;
          });
          clearCareArc();
          openCare(item, { startAction: id, hasHideSpot, onDone: () => renderPlaced() });
        }
      }, [el('span', { text: icon }), el('small', { text: label })]);
      button.addEventListener('pointerdown', e => e.stopPropagation());
      arc.appendChild(button);
    });
    const manage = el('button', {
      class: 'town-care-manage',
      text: '•••',
      'aria-label': `Move or dress ${getDisplayName(item.id)}`,
      onclick: e => { e.stopPropagation(); clearCareArc(); openMenu(wrap, place, item); }
    });
    manage.addEventListener('pointerdown', e => e.stopPropagation());
    arc.appendChild(manage);
    wrap.appendChild(arc);
    careArcTimer = setTimeout(clearCareArc, 4000);
  }

  // Three ripple rings, 900ms, tappable any time — not tied to fishing (RUN10 P3).
  function spawnPondRipple(wrap) {
    for (let i = 0; i < 3; i++) {
      const ring = el('div', { class: 't-ripple' });
      ring.style.animationDelay = (i * 150) + 'ms';
      wrap.appendChild(ring);
      setTimeout(() => ring.remove(), 900 + i * 150 + 60);
    }
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
    // a tap always interrupts a chosen behaviour (C1) — including a claimed activity
    // socket (RUN10 P2): the Boo drops what it was doing and the seat frees for the next.
    const a = actors.find(x => x.wrap === wrap);
    if (a && a.goal) endGoal(a);
    if (a && a.role && a.role.kind !== 'sleep') clearRole(a);
    // her own recorded voice plays instead of the squeak, only on tap (never ambient)
    if (voiceIds.has(item.id)) playVoice(item.id); else sfx.pop();
    noteQuest('sayHello', { count: 1 });   // daily quest: say hello to Boos (RUN3 C4)
    const svg = wrap.querySelector('svg');
    const careLevel = bondLevel(item.id);
    const doesTrick = careLevel >= 2 && Math.random() < 0.3;
    if (svg && !REDUCED) {
      const anim = doesTrick ? `care-trick-${trickFor(item.id)}` : 'squeak';
      svg.classList.remove('squeak', 'care-trick-spin', 'care-trick-backflip', 'care-trick-moonwalk', 'care-trick-star-jump');
      void svg.offsetWidth;
      svg.classList.add(anim);
    }
    const heart = el('div', { class: 'pop-heart', text: '❤' }); wrap.appendChild(heart);
    setTimeout(() => heart.remove(), 900);
    const tag = el('div', { class: 'squeak-name', text: getDisplayName(item.id) + heartBadge(item.id) }); wrap.appendChild(tag);
    setTimeout(() => tag.remove(), 1100);
    // Personality catchphrase (RUN10 P5): 20% of taps, spoken via a guide-style bubble on
    // the Boo herself, not the guide's own avatar — it's HER line, not the guide's.
    if (item.kind === 'boo' && Math.random() < CATCHPHRASE_RATE) {
      const phrase = CATCHPHRASES[personalityOf(item.id)];
      if (phrase) {
        const bubble = el('div', { class: 'catchphrase-bubble', text: phrase }); wrap.appendChild(bubble);
        speakMaybe(phrase);
        setTimeout(() => bubble.remove(), 2200);
      }
    }
  }

  let openPopover = null;
  function setPlacementScale(place, mode) {
    const current = itemScaleOf(place);
    const next = mode === 'reset'
      ? 1
      : Math.max(ITEM_SCALE_MIN, Math.min(ITEM_SCALE_MAX, current + mode * ITEM_SCALE_STEP));
    mutate(st => {
      const items = areaItems(st);
      const target = items.find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001 && t.row === place.row);
      if (target) target.scale = +next.toFixed(2);
    });
    closeMenu();
    renderPlaced();
    hint.textContent = `${resolveItem(place.item)?.name || getDisplayName(place.item)} size: ${Math.round(next * 100)}%`;
    sfx.tap();
  }
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
    if (buildMode) {
      btns.push(el('button', { class: 'btn soft size-btn', 'aria-label': 'Make smaller', text: '− Size', disabled: itemScaleOf(place) <= ITEM_SCALE_MIN, onclick: (e) => { e.stopPropagation(); setPlacementScale(place, -1); } }));
      btns.push(el('button', { class: 'btn soft size-reset', 'aria-label': 'Reset size', text: `${Math.round(itemScaleOf(place) * 100)}%`, onclick: (e) => { e.stopPropagation(); setPlacementScale(place, 'reset'); } }));
      btns.push(el('button', { class: 'btn soft size-btn', 'aria-label': 'Make bigger', text: 'Size +', disabled: itemScaleOf(place) >= ITEM_SCALE_MAX, onclick: (e) => { e.stopPropagation(); setPlacementScale(place, 1); } }));
    }
    btns.push(el('button', { class: 'btn soft', text: 'Move', onclick: (e) => { e.stopPropagation(); pickUp(place); } }));
    if (item.id !== 'deco_bffportrait') btns.push(el('button', { class: 'btn soft', text: 'Put away', onclick: (e) => { e.stopPropagation(); putAway(place); } }));
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
    mutate(st => { const items = areaItems(st); const i = items.findIndex(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001); if (i >= 0) items.splice(i, 1); });
  }
  function pickUp(place) { closeMenu(); holdingScale = itemScaleOf(place); removePlacement(place); holding = place.item; placeMode = true; renderPlaced(); renderDrawer(); updateHint(); }
  function putAway(place) { closeMenu(); sfx.tap(); removePlacement(place); renderPlaced(); renderDrawer(); updateHint(); }

  // ---- drawer drag to place (delegated from attachStripMomentum, RUN10 P2) ----------
  const LIFT = 70;   // px the dragged item floats ABOVE the fingertip (blocks.js pattern)
  let liftGhost = null;
  function beginChipLift(chip, id) {
    holding = id; placeMode = true;
    holdingScale = 1;
    const rit = resolveItem(id);
    liftGhost = el('div', { class: 'drag-ghost', html: renderItem(rit, { size: 80, equipArt: rit.kind === 'boo' ? equippedArt(id) : null }) });
    document.body.appendChild(liftGhost);
  }
  function updateChipLift(cx, cy) {
    if (!liftGhost) return;
    const ly = cy - LIFT;
    liftGhost.style.left = cx + 'px'; liftGhost.style.top = ly + 'px';
    const r = viewport.getBoundingClientRect();
    if (ly >= r.top && ly <= r.bottom) { const { zi, x } = zoneAndXAt(clientToWorld(cx)); showDropPreview(liftGhost, zi, x, rowAtClient(ly)); }
    else hideDropPreview(liftGhost);
  }
  function endChipLift(cx, cy) {
    hideDropPreview(liftGhost);
    if (liftGhost) { liftGhost.remove(); liftGhost = null; }
    const ly = cy - LIFT;
    const r = viewport.getBoundingClientRect();
    if (ly >= r.top && ly <= r.bottom) placeAtClient(cx, ly);
    else { renderDrawer(); updateHint(); }
  }
  function cancelChipLift() {
    hideDropPreview(liftGhost);
    if (liftGhost) { liftGhost.remove(); liftGhost = null; }
  }

  function flashLocked(zi) {
    const band = ground.querySelectorAll('.t-band')[zi];
    if (band) { band.classList.remove('shake'); void band.offsetWidth; band.classList.add('shake'); }
    hint.textContent = `${ZONES[zi].name}: ${totalStars()} / ${ZONES[zi].unlock} ⭐`;
  }

  function updateHint() {
    hint.textContent = holding
      ? 'Tap the ground — I’ll find the nearest free spot!'
      : buildMode
        ? 'Drag to move. Tap an item for size controls.'
        : (placeMode ? 'Tap the ground to place it!' : 'Drag from the tray. Tap a Boo to say hi!');
  }

  // Zone-unlock ceremony (RUN10 P1): detecting a fresh star-threshold crossing and
  // announcing it now happens on the world map (worldmap.js), which pans INTO the
  // newly-unlocked area's scenery before you ever reach this screen. panAcrossZone
  // stays here as the entrance-pan primitive worldmap.js's navigation calls into
  // (params.enterPan, see mount() above) and as a QA hook (__town.panAcross).

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
      // Build mode pauses living behaviours (RUN10 P3): the loop keeps ticking so a resume
      // is instant, but skips stepping — the CSS transition on .t-item svg (see styles.css)
      // eases the freeze/resume rather than a hard cut.
      if (!document.hidden && !buildMode) { stepActors(dt); stepFunfairRides(now); }
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
      // at bedtime, near a house, drop a non-nap act so the sleep role can take over (C1)
      if (a.goal && a.goal.kind !== 'nap' && isSleepTime(currentHour()) && nearBoohouse(a) && !(a.wakeUntil && now < a.wakeUntil)) endGoal(a);
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
    // near a house at bedtime → leave it for the sleep role, don't pick a competing act
    if (isSleepTime(currentHour()) && nearBoohouse(a) && !(a.wakeUntil && now < a.wakeUntil)) return false;
    if (Math.random() > BEHAVIOUR_CHANCE) return false;
    const kind = chooseBehaviourKind(a);
    if (!kind) return false;
    startBehaviour(a, kind, now);
    return !!a.goal;
  }
  // Every free Boo has a stable temperament (RUN10 P5: data/personalities.js, hashed from
  // her own id) that multiplies the base weight of the acts she leans toward — the SAME
  // choice table, just tilted, so two Boos placed side by side genuinely behave differently.
  function chooseBehaviourKind(a) {
    const cands = [];
    const night = isSleepTime(currentHour());
    const booId = a.item && a.item.id;
    if (pickFriend(a)) cands.push(['visit', 2.2 * personalityMult(booId, 'visit')]);
    const freeAct = pickFreeActivity(a);
    if (freeAct) {
      const key = ACT_MULT_KEY[freeAct.item];
      cands.push(['approach', 2.6 * (key ? personalityMult(booId, key) : 1)]);
    }
    cands.push(['chase', 1.6 * personalityMult(booId, 'chase')]);
    cands.push(['watch', 1.3 * personalityMult(booId, 'watch')]);
    // a just-woken Boo stays up (no instant re-nap); mirrors the sleep-role wake rule
    const recentlyWoken = a.wakeUntil && performance.now() < a.wakeUntil;
    if (night && !recentlyWoken && pickNapSpot(a)) cands.push(['nap', 2.6 * personalityMult(booId, 'nap')]);
    if (!a.riding && pickBoardableRide(a)) cands.push(['board', 3.2]);   // funfair: hop on a ride (C1b)
    // musical (RUN10 P5): drawn to a placed Dance Stage, or the funfair bandstand while
    // already standing in the funfair — a genuine walk-there-and-watch goal, not a label.
    const music = pickMusicTarget(a);
    if (music) cands.push(['musicwatch', 1.2 * personalityMult(booId, music.kind)]);
    // zone-only behaviours (RUN7 C2): daytime acts tied to the zone she's standing in
    if (!night) { const zb = ZONE_BEHAVIOURS[a.place.zone]; if (zb) for (const [k, wt] of zb) cands.push([k, wt]); }
    return cands.length ? weightedPick(cands) : null;
  }
  // The nearest thing worth dancing near: a placed Dance Stage anywhere in the area, else
  // (only while standing in the funfair, once it's open) the bandstand itself.
  function pickMusicTarget(a) {
    const zi = ZONE_INDEX[a.place.zone];
    const stage = areaItems(getState()).find(t => t.item === 'deco_stage' && (ZONE_INDEX[t.zone] ?? 0) === zi);
    if (stage) return { x: stage.x, kind: 'danceStage' };
    if (AREA.key === 'funfair' && funfairUnlocked()) return { x: BANDSTAND_X, kind: 'fairBand' };
    return null;
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
    const cands = areaItems(st).filter(t => ACT_IDS.includes(t.item) && (ZONE_INDEX[t.zone] ?? 0) === zi
      && Math.abs(t.x - a.place.x) < 0.55 && !occ.has(t.zone + ':' + t.x + ':' + t.item));
    cands.sort((p, q) => Math.abs(p.x - a.place.x) - Math.abs(q.x - a.place.x));
    return cands[0] || null;
  }
  function pickNapSpot(a) {
    const st = getState(); const zi = ZONE_INDEX[a.place.zone];
    const cands = areaItems(st).filter(t => NAP_IDS.includes(t.item) && (ZONE_INDEX[t.zone] ?? 0) === zi && Math.abs(t.x - a.place.x) < 0.6);
    // A placed bed is the preferred nap spot (RUN10 P4) — beats distance.
    cands.sort((p, q) => {
      const bp = p.item === 'deco_bed' ? 0 : 1, bq = q.item === 'deco_bed' ? 0 : 1;
      if (bp !== bq) return bp - bq;
      return Math.abs(p.x - a.place.x) - Math.abs(q.x - a.place.x);
    });
    return cands[0] || null;
  }
  // Near a Boo House at bedtime the sleep ROLE (assignRoles) has priority — a Boo there
  // settles to sleep rather than wandering off chasing fireflies (keeps nights cosy).
  function nearBoohouse(a) {
    const st = getState(); const zi = ZONE_INDEX[a.place.zone];
    return areaItems(st).some(t => t.item === 'deco_boohouse' && (ZONE_INDEX[t.zone] ?? 0) === zi && Math.abs(t.x - a.place.x) <= ACT_RADIUS);
  }
  function startBehaviour(a, kind, now) {
    now = now || performance.now();
    if (kind === 'visit') {
      const f = pickFriend(a); if (!f) return;
      const fFrac = f.place.x + (f.dx || 0) / (zoneW || 1);
      // shy (RUN10 P5): stands SHY_GREET_DIST_PX further BACK than everyone else — the
      // standoff point moves AWAY from the friend, whichever side the friend is on.
      const shyPad = personalityOf(a.item && a.item.id) === 'shy' ? SHY_GREET_DIST_PX / (zoneW || 1) : 0;
      const baseSide = fFrac >= a.place.x ? -0.02 : 0.02;
      const side = baseSide + (fFrac >= a.place.x ? -shyPad : shyPad);
      a.goal = { kind, friend: f, targetDx: (fFrac + side - a.place.x) * zoneW, start: now, greeted: false };
    } else if (kind === 'approach') {
      const d = pickFreeActivity(a); if (!d) return;
      a.goal = { kind, deco: d, targetDx: (d.x - a.place.x) * zoneW, start: now };
    } else if (kind === 'musicwatch') {
      const m = pickMusicTarget(a); if (!m) return;
      a.goal = { kind, start: now, targetDx: (m.x - a.place.x) * zoneW };
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
    } else if (kind === 'paddle' || kind === 'shallow') {
      a.goal = { kind, start: now, splashT: 0, colour: kind === 'shallow' ? '#BFE9FF' : '#CFEFFB' };
    } else if (kind === 'skim') {
      a.goal = { kind, start: now, stone: spawnSkipStone(a), plinks: 0 };
    } else if (kind === 'bridgesit') {
      a.goal = { kind, targetDx: (BRIDGE_X - a.place.x) * zoneW, start: now, sat: false };
    } else if (kind === 'kite') {
      a.goal = { kind, start: now, kite: spawnKite(a) };
    } else if (kind === 'sandcastle') {
      a.goal = { kind, targetDx: ((Math.random() * 0.05 - 0.025)) * zoneW, start: now, built: false, castle: null };
    } else if (kind === 'sunbathe') {
      a.goal = { kind, targetDx: ((Math.random() * 0.05 - 0.025)) * zoneW, start: now, lying: false, towel: null };
    }
  }
  // ---- zone-behaviour prop spawners (RUN7 C2) ----
  function spawnSplash(a, colour) {
    const base = a.wrap;
    for (let i = 0; i < 4; i++) {
      const d = el('div', { class: 't-splash' });
      d.style.setProperty('--sx', ((Math.random() * 2 - 1) * 26).toFixed(0) + 'px');
      d.style.setProperty('--sy', (-16 - Math.random() * 20).toFixed(0) + 'px');
      d.style.background = colour; d.style.animationDelay = (i * 40) + 'ms';
      base.appendChild(d); setTimeout(() => { try { d.remove(); } catch {} }, 700);
    }
  }
  function spawnSkipStone(a) {
    const stone = el('div', { class: 't-skip-stone' });
    stone._x0 = parseFloat(a.wrap.style.left) + a.wrap.offsetWidth * 0.5;
    stone._y0 = parseFloat(a.wrap.style.top) + a.wrap.offsetHeight * 0.4;
    stone._dir = a.place.x < BRIDGE_X ? 1 : -1;   // skim toward the open water
    stone.style.left = stone._x0 + 'px'; stone.style.top = stone._y0 + 'px';
    ground.appendChild(stone);
    return stone;
  }
  function spawnKite(a) {
    const wrap = el('div', { class: 't-kite-wrap' });
    wrap.innerHTML = `<svg width="260" height="240" viewBox="0 0 260 240" style="overflow:visible">
      <line class="tk-string" x1="0" y1="0" x2="0" y2="0" stroke="#EADFA0" stroke-width="1.5"/>
      <g class="tk-kite"><path d="M0 -20 L16 0 L0 22 L-16 0 Z" fill="#FF7AC6" stroke="#C0568F" stroke-width="2"/><path d="M0 -20 L0 22 M-16 0 L16 0" stroke="#C0568F" stroke-width="1.4"/>
      <path class="tk-tail" d="M0 22 q6 10 -2 18 q-8 8 2 18 q8 8 -1 16" fill="none" stroke="#FFC93C" stroke-width="2.4"/>
      <path d="M0 26 l4 4 -4 4 -4 -4 z" fill="#35D0BA"/><path d="M-1 44 l4 4 -4 4 -4 -4 z" fill="#8FC7FF"/></g></svg>`;
    ground.appendChild(wrap);
    return wrap;
  }
  function spawnSandcastle(a) {
    const c = el('div', { class: 't-sandcastle' });
    const cx = parseFloat(a.wrap.style.left) + a.wrap.offsetWidth + (a.dx || 0) + 24;   // beside the Boo, on the sand
    const cy = parseFloat(a.wrap.style.top) + a.wrap.offsetHeight - 12;
    c.style.left = (cx - 32) + 'px'; c.style.top = (cy - 42) + 'px';
    c.style.zIndex = String(Math.round(cy) + 6);   // in front, so she reads as patting it up
    c.innerHTML = `<svg width="64" height="52" viewBox="0 0 64 52"><g fill="#E8C784" stroke="#C79A54" stroke-width="2.5">
      <rect x="5" y="22" width="12" height="26"/><rect x="26" y="14" width="12" height="34"/><rect x="47" y="22" width="12" height="26"/><rect x="2" y="42" width="60" height="8"/></g>
      <path d="M5 22 l6 -10 6 10 z M26 14 l6 -10 6 10 z M47 22 l6 -10 6 10 z" fill="#FF9AD5" stroke="#C0568F" stroke-width="1.8"/>
      <path d="M11 12 v-8 l5 4 z M32 4 v-8 l5 4 z M53 12 v-8 l5 4 z" fill="#35D0BA"/></svg>`;
    ground.appendChild(c);
    requestAnimationFrame(() => c.classList.add('rise'));
    // it fades later (C2) — a gentle, then removed
    setTimeout(() => { c.classList.add('fade'); setTimeout(() => { try { c.remove(); } catch {} }, 1600); }, SANDCASTLE_FADE_MS);
    return c;
  }
  function spawnTowel(a) {
    const t = el('div', { class: 't-towel' });
    t.innerHTML = `<svg width="86" height="30" viewBox="0 0 86 30"><g>
      <rect x="2" y="6" width="82" height="20" rx="4" fill="#FF7AC6" stroke="#C0568F" stroke-width="2"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${6 + i * 13}" y="6" width="6" height="20" fill="${i % 2 ? '#FFF3E0' : '#FFC93C'}" opacity="0.8"/>`).join('')}</g></svg>`;
    a.wrap.insertBefore(t, a.wrap.firstChild);   // behind the Boo, so she lies on top of it
    return t;
  }
  function stepSkim(a, g, now) {
    const st = g.stone; if (!st) return;
    const T = now - g.start;
    if (T < 320) return;                        // wind-up before the throw
    const p = Math.min(1, (T - 320) / (SKIM_MS - 320));
    const dist = 220 * p;
    const skips = 3;
    const phase = (p * skips) % 1;
    const hop = Math.sin(phase * Math.PI) * (26 * (1 - p));   // decaying skip arcs
    st.style.left = (st._x0 + st._dir * dist) + 'px';
    st.style.top = (st._y0 - hop) + 'px';
    const skipIdx = Math.floor(p * skips);
    if (skipIdx > g.plinks && p < 0.98) { g.plinks = skipIdx; sfx.pop(); ring(st._x0 + st._dir * dist, st._y0); }
  }
  function ring(x, y) {
    const r = el('div', { class: 't-skim-ring' });
    r.style.left = x + 'px'; r.style.top = y + 'px'; ground.appendChild(r);
    setTimeout(() => { try { r.remove(); } catch {} }, 650);
  }
  function stepKite(a, g, now) {
    const wrap = g.kite; if (!wrap) return;
    const T = now - g.start;
    const handX = parseFloat(a.wrap.style.left) + a.wrap.offsetWidth * 0.62 + (a.dx || 0);
    const handY = parseFloat(a.wrap.style.top) + a.wrap.offsetHeight * 0.4;
    const kiteX = handX + 96 + Math.sin(T / 900) * 22;
    const kiteY = handY - 150 + Math.sin(T / 620) * 16;
    wrap.style.left = handX + 'px'; wrap.style.top = handY + 'px';
    const svg = wrap.querySelector('svg'), line = wrap.querySelector('.tk-string'), kite = wrap.querySelector('.tk-kite');
    const kx = kiteX - handX, ky = kiteY - handY;
    if (line) { line.setAttribute('x2', kx.toFixed(0)); line.setAttribute('y2', ky.toFixed(0)); }
    if (kite) kite.setAttribute('transform', `translate(${kx.toFixed(0)} ${ky.toFixed(0)}) rotate(${(Math.sin(T / 500) * 12).toFixed(1)})`);
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
    if (g && g.kite) { try { g.kite.remove(); } catch {} }         // put the kite away (C2)
    if (g && g.towel) { try { g.towel.remove(); } catch {} }       // fold up the towel (C2)
    if (g && g.stone) { try { g.stone.remove(); } catch {} }       // the stone sinks (C2)
    // NOTE: a sandcastle deliberately LINGERS and fades on its own timer (C2) — not removed here.
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
      if (Math.abs(a.dx - g.targetDx) < zoneW * 0.03) {
        // arrived: claim a free socket right away — none free → a small shrug (RUN10 P2)
        const deco = g.deco; const claimed = tryClaimActivity(a, deco);
        endGoal(a);
        if (!claimed) shrugAndEndGoal(a);
      }
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
    if (g.kind === 'musicwatch') {
      if (Math.abs(a.dx - g.targetDx) < zoneW * 0.03) {
        if (!g.arrived) { g.arrived = true; g.arriveStart = now; }
        const sway = Math.sin((now - g.arriveStart) / 500) * 4;
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${sway.toFixed(1)}px) rotate(${(sway * 0.6).toFixed(1)}deg)`;
        if (now - g.arriveStart > WATCH_MS) endGoal(a);
      } else {
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${walkHop.toFixed(1)}px) scaleX(${flip})`;
        if (now - g.start > GOAL_TIMEOUT_MS) endGoal(a);
      }
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
    // ---- zone-only behaviours (RUN7 C2) ----
    if (g.kind === 'paddle' || g.kind === 'shallow') {
      const T = now - g.start;
      const bob = Math.abs(Math.sin(T / 200)) * 7;
      svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${bob.toFixed(1)}px) scale(1, ${(1 - bob / 90).toFixed(3)})`;
      g.splashT += dt; if (g.splashT > 360) { g.splashT = 0; spawnSplash(a, g.colour); }
      if (T > PADDLE_MS) endGoal(a);
      return;
    }
    if (g.kind === 'skim') {
      const T = now - g.start;
      stepSkim(a, g, now);
      const lean = T < 300 ? -(T / 300) * 12 : (T < 560 ? -12 + ((T - 300) / 260) * 20 : 8 - (T - 560) / 400 * 8);
      svg.style.transform = `translate(${a.dx.toFixed(1)}px, 0px) rotate(${lean.toFixed(1)}deg)`;
      if (T > SKIM_MS) endGoal(a);
      return;
    }
    if (g.kind === 'kite') {
      const T = now - g.start;
      stepKite(a, g, now);
      svg.style.transform = `translate(${a.dx.toFixed(1)}px, 0px) rotate(${(-6 + Math.sin(T / 700) * 3).toFixed(1)}deg)`;
      if (T > KITE_MS) endGoal(a);
      return;
    }
    if (g.kind === 'bridgesit') {
      if (Math.abs(a.dx - g.targetDx) > 4 && !g.sat) {
        a.dx += Math.sign(g.targetDx - a.dx) * Math.min(Math.abs(g.targetDx - a.dx), stride);
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${walkHop.toFixed(1)}px) scaleX(${flip})`;
        if (now - g.start > GOAL_TIMEOUT_MS) endGoal(a);
      } else {
        if (!g.sat) { g.sat = true; g.satStart = now; }
        const lift = -viewH * 0.115;
        const sway = Math.sin((now - g.satStart) / 620) * 4;
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${lift.toFixed(1)}px) rotate(${sway.toFixed(1)}deg)`;
        if (now - g.satStart > BRIDGE_SIT_MS) endGoal(a);
      }
      return;
    }
    if (g.kind === 'sandcastle') {
      if (Math.abs(a.dx - g.targetDx) > 4 && !g.built) {
        a.dx += Math.sign(g.targetDx - a.dx) * Math.min(Math.abs(g.targetDx - a.dx), stride);
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${walkHop.toFixed(1)}px) scaleX(${flip})`;
      } else {
        if (!g.built) { g.built = true; g.buildStart = now; g.castle = spawnSandcastle(a); }
        const pat = Math.abs(Math.sin((now - g.buildStart) / 150)) * 6;
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${pat.toFixed(1)}px) scale(1, ${(1 - pat / 80).toFixed(3)})`;
        if (now - g.buildStart > SANDCASTLE_MS) endGoal(a);
      }
      return;
    }
    if (g.kind === 'sunbathe') {
      if (Math.abs(a.dx - g.targetDx) > 4 && !g.lying) {
        a.dx += Math.sign(g.targetDx - a.dx) * Math.min(Math.abs(g.targetDx - a.dx), stride);
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, ${walkHop.toFixed(1)}px) scaleX(${flip})`;
      } else {
        if (!g.lying) { g.lying = true; g.lieStart = now; g.towel = spawnTowel(a); }
        const breathe = Math.sin((now - g.lieStart) / 1100) * 0.03;
        svg.style.transform = `translate(${a.dx.toFixed(1)}px, 16px) rotate(74deg) scale(${(1 + breathe).toFixed(3)})`;
        if (now - g.lieStart > SUNBATHE_MS) endGoal(a);
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
      goalTargetDx: (i) => { const a = actors[i]; return a && a.goal ? a.goal.targetDx : null; },
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
      ffOpened: () => !!(getState().seen || {}).funfairOpened,
      ffGrandOpen: () => maybeGrandOpening(),   // force the grand-opening check
      ffGrandShown: () => !!root.querySelector('.funfair-grand'),
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
      scrollToFunfair: () => scrollToZone(ZONE_INDEX['funfair'] ?? 0, false),
      scrollToZone: (key) => scrollToZone(ZONE_INDEX[key] ?? 0, false),   // pan to any zone (C2 QA)
      zoneProps: (key) => { const n = ground.querySelector('.t-zone-props.' + key); return n ? { has: true, kids: n.querySelectorAll('*').length } : { has: false }; },
      panAcross: (key) => panAcrossZone(ZONE_INDEX[key] ?? 0),            // unlock-pan test hook (C2)
      // read a scenery element's live transform (for animation frame evidence)
      sceneryXf: (sel) => { const n = ground.querySelector(sel); return n ? (getComputedStyle(n).transform || '') : null; },
      sceneryAnimated: (sel) => { const n = ground.querySelector(sel); return n ? getComputedStyle(n).animationName !== 'none' : false; },
      hasBandstand: () => !!ground.querySelector('.ff-bandstand'),
      scrollToBandstand: () => { scrollX = (ZONE_INDEX['funfair'] ?? 0) * zoneW + BANDSTAND_X * zoneW - viewW / 2; clampScroll(); applyScroll(); },
      scrollToFunfairGate: () => { scrollX = (ZONE_INDEX['funfair'] ?? 0) * zoneW; clampScroll(); applyScroll(); },   // funfair centred but bandstand off-screen → jingle
      zoneMusic: () => _zoneMusic,
      area: () => AREA.key,   // RUN10 P1 QA hook: which area this mount is rendering
      // RUN10 P1: an area is 4 viewports wide, so a single "centred" scroll no longer
      // shows the whole area (e.g. the funfair's 5 rides span x 0.18-0.92) — tests that
      // need a specific spot in view should scroll to it directly.
      scrollToFrac: (x) => { scrollX = Math.max(0, Math.min(x * zoneW - viewW / 2, worldW - viewW)); clampScroll(); applyScroll(); },
      // RUN10 P3 QA hooks: build mode, path painting, landscape restriction, fishing.
      buildMode: () => buildMode,
      toggleBuild: () => toggleBuildMode(),
      buildTool: () => buildTool,
      setBuildTool: (id) => selectBuildTool(id),
      pathStyleSel: () => pathStyle,
      setPathStyle: (id) => selectPathStyle(id),
      paths: () => currentPaths().slice(),
      paintCellAt: (cx, cy) => paintCell(cx, cy),
      paintClient: (cx, cy) => paintAtClient(cx, cy),
      cellGeom: () => cellGeom(),
      gridOpacity: () => getComputedStyle(buildGrid).opacity,
      commitPathsNow: () => commitPaths(),
      pathCellCount: () => ground.querySelectorAll('.t-path-cell').length,
      pathCellZ: (sel) => { const n = ground.querySelector(sel || '.t-path-cell'); return n ? getComputedStyle(n).zIndex : null; },
      itemZ: (sel) => { const n = ground.querySelector(sel); return n ? (n.style.zIndex || getComputedStyle(n).zIndex) : null; },
      ripple: (sel) => { const w = ground.querySelector(sel || '.t-item[data-item="deco_pond"]'); if (w) spawnPondRipple(w); },
      rippleCount: () => ground.querySelectorAll('.t-ripple').length,
      // force actor i onto the pond's fish socket with a deterministic outcome, skipping
      // the 6-10s hold's randomness — a real full-frame run of the state machine, just fast
      forceFish: (i, outcome, holdMs) => {
        const a = actors[i]; if (!a) return null;
        const pond = areaItems(getState()).find(t => t.item === 'deco_pond');
        if (!pond) return null;
        clearRole(a);
        const ok = tryClaimActivity(a, pond);
        if (!ok) return null;
        a.role.holdMs = holdMs != null ? holdMs : 60;
        a.role.willDip = false; a.role.dipAt = -1;
        a.role.outcome = outcome === 'boot' ? 'boot' : 'catch';
        a.role.phase = 'hold';
        if (!a.wrap.querySelector('.t-rod')) a.wrap.appendChild(el('div', { class: 't-rod' }, [el('div', { class: 't-bobber' })]));
        return true;
      },
      dripCount: () => ground.querySelectorAll('.t-drip').length,
      // RUN10 P4 QA hooks: interiors (the Boo House).
      isInterior: () => isInterior,
      napSpotItem: (i) => { const a = actors[i]; return a && a.goal && a.goal.spot ? a.goal.spot.item : null; },
      wallItems: () => areaItems(getState()).filter(t => t.row === WALL_ROW).map(t => t.item),
      floorItems: () => areaItems(getState()).filter(t => t.row !== WALL_ROW).map(t => t.item),
      lampLit: (sel) => { const n = ground.querySelector(sel || '.t-item[data-item="deco_tablelamp"]'); return n ? n.classList.contains('lit') : null; },
      lampGlowOpacity: (sel) => { const n = ground.querySelector((sel || '.t-item[data-item="deco_tablelamp"]') + ' .lamp-glow'); return n ? getComputedStyle(n).opacity : null; },
      // Force-hold any item id directly (bypasses the drawer UI) — for exercising a
      // placement guard regardless of whether that item's tab happens to be reachable
      // in the current area (e.g. Landscape is hidden indoors by design).
      forceHold: (id) => { holding = id; placeMode = true; renderDrawer(); },
      placeAt: (fx, fy) => { const r = viewport.getBoundingClientRect(); placeAtClient(r.left + r.width * fx, r.top + r.height * fy); },
      // RUN10 P5 QA hooks: personalities + hide-and-seek 2.0.
      personalityOf: (booId) => personalityOf(booId),
      // Taps once (the real squeak() path, 20% catchphrase odds) and reports whether the
      // bubble showed THIS time — cleans it up immediately rather than waiting its own
      // 2200ms lifetime, so a test can sample hundreds of taps quickly.
      // Returns the catchphrase bubble's exact text if this tap showed one, else null.
      tapAndSample: (i) => {
        const a = actors[i]; if (!a) return null;
        a.wrap.querySelectorAll('.catchphrase-bubble').forEach(n => n.remove());
        squeak(a.wrap, a.item);
        const bubble = a.wrap.querySelector('.catchphrase-bubble');
        const text = bubble ? bubble.textContent : null;
        a.wrap.querySelectorAll('.catchphrase-bubble, .pop-heart, .squeak-name').forEach(n => n.remove());
        return text;
      },
      careArcCount: () => ground.querySelectorAll('.town-care-arc').length,
      openCareFor: (i, action) => {
        const actor = actors[i];
        if (!actor) return false;
        openCare(actor.item, { startAction: action, onDone: () => renderPlaced() });
        return true;
      },
      hidePeekEl: () => ground.querySelector('.t-hide-peek'),
      hidePeekBBox: () => { const n = ground.querySelector('.t-hide-peek'); return n ? n.getBoundingClientRect() : null; },
      hideItemBBox: () => { const h = currentHide(); if (!h) return null; const n = [...ground.querySelectorAll('.t-item')].find(w => w.dataset.item === h.spot.item && w.dataset.zone === h.spot.zone); return n ? n.getBoundingClientRect() : null; },
      hideWiggleDelay: () => hideWiggleDelay,
      forceHideWiggle: () => { const peek = ground.querySelector('.t-hide-peek'); if (!peek) return null; if (hideWiggleTimer) clearTimeout(hideWiggleTimer); fireHideWiggle(peek); return hideWiggleDelay; },
      hideWiggling: () => { const n = ground.querySelector('.t-hide-peek'); return n ? n.classList.contains('hide-wiggle') : false; },
      // Sample chooseBehaviourKind(a) n times without side effects (it only READS the
      // candidate-picker helpers; startBehaviour is what actually sets a.goal) — the
      // chi-square-vs-uniform proof for personality weighting.
      behaviourSample: (i, n) => {
        const a = actors[i]; if (!a) return null;
        const savedGoal = a.goal, savedRole = a.role;
        a.goal = null; a.role = null;
        const counts = {};
        for (let k = 0; k < n; k++) { const kind = chooseBehaviourKind(a); if (kind) counts[kind] = (counts[kind] || 0) + 1; }
        a.goal = savedGoal; a.role = savedRole;
        return counts;
      }
    };
  }

  return {
    unmount() {
      if (raf) cancelAnimationFrame(raf);
      if (momRaf) cancelAnimationFrame(momRaf);
      if (routineTimer) clearInterval(routineTimer);
      clearInterval(roleTimer);
      if (starTimer) clearTimeout(starTimer);
      if (pathCommitTimer) clearInterval(pathCommitTimer);
      commitPaths();   // build mode edits commit on exit, whichever comes first (RUN10 P3)
      if (hideWiggleTimer) clearTimeout(hideWiggleTimer);
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

// ---- zone identity: the distinct near backdrop per zone (RUN7 C2) --------
// Drawn in the GROUND layer at real pixels so objects keep their shape and stay
// aligned with the Boos. Everything sits ABOVE the placement band (y < h*0.62) or is
// thin decoration at the bank — the band itself (0.62→1.0) stays clear for placement.
// Animation classes (.rv-*/.hl-*/.bc-*) are transform/opacity-only; reduced-motion stills them.
function zoneScenery(key, w, h, night) {
  if (key === 'riverside')  return riversideScenery(w, h, night);
  if (key === 'hilltop')    return hilltopScenery(w, h, night);
  if (key === 'beach')      return beachScenery(w, h, night);
  if (key === 'playground') return playgroundScenery(w, h, night);
  return '';
}
function rSVG(w, h, inner) {
  return `<svg class="t-zsvg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0">${inner}</svg>`;
}

function riversideScenery(w, h, night) {
  const top = h * 0.30, bot = h * 0.42, mid = (top + bot) / 2;   // river band y 30-42% (RUN10 P1)
  const water = night ? '#2C567A' : '#7FC7E8', deep = night ? '#20405E' : '#5FA9D0', foam = night ? '#B6D4E8' : '#EAF6FF';
  // drifting ripple lines (two staggered layers) + shimmer sparkles on the water
  const ripples = (cls, ys, dur, dist) => ys.map((yy, i) =>
    `<path class="rv-drift ${cls}" style="--d:${dist}px;--t:${dur}s;--dl:${(-i * 1.7).toFixed(1)}s" d="M-40 ${yy} q ${w * 0.12} -6 ${w * 0.24} 0 t ${w * 0.24} 0 t ${w * 0.24} 0 t ${w * 0.24} 0 t ${w * 0.24} 0 t ${w * 0.24} 0" fill="none" stroke="${foam}" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>`).join('');
  const shimmer = Array.from({ length: 7 }, (_, i) => {
    const x = (i + 0.5) / 7 * w + (i % 2 ? 30 : -30), yy = top + 14 + (i % 3) * (bot - top - 24) / 2;
    return `<ellipse class="rv-shimmer" style="--dl:${(-i * 0.6).toFixed(1)}s" cx="${x.toFixed(0)}" cy="${yy.toFixed(0)}" rx="16" ry="3" fill="${foam}" opacity="0.5"/>`;
  }).join('');
  // lily pads (one flowered) floating on the water
  const lily = [[0.30, mid + 8], [0.62, top + 16], [0.78, mid + 2]].map(([fx, yy], i) =>
    `<g class="rv-lily" style="--dl:${(-i).toFixed(1)}s"><ellipse cx="${(fx * w).toFixed(0)}" cy="${yy.toFixed(0)}" rx="20" ry="8" fill="${night ? '#3E7A54' : '#5FB86E'}" stroke="#2A6B3E" stroke-width="2"/><path d="M${(fx * w).toFixed(0)} ${yy.toFixed(0)} l9 -3" stroke="#2A6B3E" stroke-width="2"/>${i === 1 ? `<circle cx="${(fx * w + 2).toFixed(0)}" cy="${(yy - 4).toFixed(0)}" r="5" fill="#FF7AC6"/><circle cx="${(fx * w + 2).toFixed(0)}" cy="${(yy - 4).toFixed(0)}" r="2" fill="#FFF3B0"/>` : ''}</g>`).join('');
  // reeds swaying at the near bank
  const reeds = [0.08, 0.20, 0.9, 0.44].map((fx, i) => {
    const bx = fx * w, by = bot + 10;
    return `<g class="rv-reed" style="--dl:${(-i * 0.7).toFixed(1)}s">${[0, 6, -6].map((o, k) => `<path d="M${(bx + o).toFixed(0)} ${by.toFixed(0)} q ${o < 0 ? -8 : 8} -${28 + k * 6} ${o < 0 ? -3 : 3} -${44 + k * 8}" fill="none" stroke="${night ? '#3E7A54' : '#4FA85E'}" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="${(bx + o + (o < 0 ? -3 : 3)).toFixed(0)}" cy="${(by - 44 - k * 8).toFixed(0)}" rx="3" ry="8" fill="${night ? '#6B5A3A' : '#B98A4A'}"/>`).join('')}</g>`;
  }).join('');
  // a small wooden arched bridge spanning the river mid-zone
  const bx = BRIDGE_X * w, deck = top - 4, span = Math.min(150, w * 0.13);
  const bridge = `<g class="rv-bridge">
    <path d="M${(bx - span).toFixed(0)} ${(bot + 6).toFixed(0)} Q${bx.toFixed(0)} ${(deck - 34).toFixed(0)} ${(bx + span).toFixed(0)} ${(bot + 6).toFixed(0)}" fill="none" stroke="#7A4F2A" stroke-width="9"/>
    <path d="M${(bx - span).toFixed(0)} ${(deck - 2).toFixed(0)} Q${bx.toFixed(0)} ${(deck - 40).toFixed(0)} ${(bx + span).toFixed(0)} ${(deck - 2).toFixed(0)}" fill="none" stroke="#A9743F" stroke-width="12" stroke-linecap="round"/>
    <path d="M${(bx - span).toFixed(0)} ${(deck + 8).toFixed(0)} Q${bx.toFixed(0)} ${(deck - 30).toFixed(0)} ${(bx + span).toFixed(0)} ${(deck + 8).toFixed(0)}" fill="none" stroke="#8A5A32" stroke-width="6"/>
    ${Array.from({ length: 7 }, (_, i) => { const t = i / 6; const px = bx - span + t * span * 2; const py = deck - 40 * Math.sin(Math.PI * t) - 2; return `<line x1="${px.toFixed(0)}" y1="${py.toFixed(0)}" x2="${px.toFixed(0)}" y2="${(py - 16).toFixed(0)}" stroke="#7A4F2A" stroke-width="3"/>`; }).join('')}
    <path d="M${(bx - span).toFixed(0)} ${(deck - 18).toFixed(0)} Q${bx.toFixed(0)} ${(deck - 54).toFixed(0)} ${(bx + span).toFixed(0)} ${(deck - 18).toFixed(0)}" fill="none" stroke="#A9743F" stroke-width="4"/></g>`;
  const dfly = night ? '' : [[0.35, top - 26, 3], [0.66, top - 40, 5]].map(([fx, yy, dl]) =>
    `<g class="rv-dragonfly" style="--dl:${-dl}s;left:${(fx * w).toFixed(0)}px;top:${yy.toFixed(0)}px"><ellipse cx="0" cy="0" rx="10" ry="2" fill="#6AA9C9"/><ellipse class="rv-wing" cx="-2" cy="-4" rx="7" ry="3" fill="#BFE6F5" opacity="0.8"/><ellipse class="rv-wing" cx="-2" cy="4" rx="7" ry="3" fill="#BFE6F5" opacity="0.8"/></g>`).join('');
  return rSVG(w, h, `
    <rect x="0" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${(bot - top).toFixed(0)}" fill="${water}"/>
    <rect x="0" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="7" fill="${deep}" opacity="0.7"/>
    <rect x="0" y="${(bot - 6).toFixed(0)}" width="${w.toFixed(0)}" height="6" fill="${deep}" opacity="0.5"/>
    ${ripples('a', [top + 22, mid + 6, bot - 14], 9, 60)}${ripples('b', [top + 40, mid + 22], 13, -50)}
    ${shimmer}${lily}${bridge}${reeds}`)
    // dragonflies + paper boat live OUTSIDE the svg as positioned DOM (their own drift anims)
    + dfly
    + (night ? '' : `<div class="rv-boat" style="--d:${(w + 120).toFixed(0)}px;top:${(top + 6).toFixed(0)}px"><svg viewBox="0 0 54 34" width="46" height="30"><path d="M4 20 h46 l-8 12 h-30 z" fill="#FFF3E0" stroke="#C97B4A" stroke-width="2"/><path d="M27 20 v-16 l14 12 z" fill="#FF9AD5" stroke="#C0568F" stroke-width="1.6"/></svg></div>`);
}

function hilltopScenery(w, h, night) {
  const grass = night ? '#3E6E4A' : '#7CC98A', grass2 = night ? '#2F5A3A' : '#5FA76C';
  const crestX = WINDMILL_X * w, crestY = h * 0.44;
  // faster, closer clouds drifting across the sky
  const clouds = night ? '' : [[0.10, h * 0.14, 1.0, 26], [0.5, h * 0.09, 1.25, 20], [0.8, h * 0.2, 0.8, 32]].map(([fx, yy, sc, dur], i) =>
    `<div class="hl-cloud" style="--d:${(w * 0.5).toFixed(0)}px;--t:${dur}s;--dl:${(-i * 5)}s;left:${(fx * w).toFixed(0)}px;top:${yy.toFixed(0)}px;transform:scale(${sc})"><svg viewBox="0 0 90 40" width="90" height="40"><g fill="#FFFFFF" opacity="0.9"><ellipse cx="28" cy="26" rx="24" ry="14"/><ellipse cx="52" cy="20" rx="22" ry="16"/><ellipse cx="68" cy="27" rx="18" ry="12"/></g></svg></div>`).join('');
  // the big rounded hill rising to the crest, a gentle rise across the whole zone
  const hill = `<path d="M0 ${(h * 0.66).toFixed(0)} Q${(w * 0.28).toFixed(0)} ${(h * 0.60).toFixed(0)} ${(crestX - 120).toFixed(0)} ${(crestY + 40).toFixed(0)} Q${crestX.toFixed(0)} ${(crestY - 8).toFixed(0)} ${(crestX + 120).toFixed(0)} ${(crestY + 46).toFixed(0)} Q${(w * 0.9).toFixed(0)} ${(h * 0.62).toFixed(0)} ${w.toFixed(0)} ${(h * 0.6).toFixed(0)} L${w.toFixed(0)} ${h.toFixed(0)} L0 ${h.toFixed(0)} Z" fill="${grass}"/>
    <path d="M0 ${(h * 0.72).toFixed(0)} Q${(w * 0.5).toFixed(0)} ${(h * 0.66).toFixed(0)} ${w.toFixed(0)} ${(h * 0.7).toFixed(0)} L${w.toFixed(0)} ${h.toFixed(0)} L0 ${h.toFixed(0)} Z" fill="${grass2}" opacity="0.65"/>`;
  // the windmill on the crest: tower + slowly turning sails
  const ty = crestY + 4;
  const windmill = `<g>
    <path d="M${(crestX - 20).toFixed(0)} ${(ty + 66).toFixed(0)} L${(crestX - 12).toFixed(0)} ${ty.toFixed(0)} L${(crestX + 12).toFixed(0)} ${ty.toFixed(0)} L${(crestX + 20).toFixed(0)} ${(ty + 66).toFixed(0)} Z" fill="#EFE3C8" stroke="#8A6B3A" stroke-width="2.5"/>
    <path d="M${(crestX - 15).toFixed(0)} ${(ty + 6).toFixed(0)} h30 l-4 -14 h-22 z" fill="#C0568F" stroke="#8A3A66" stroke-width="2"/>
    <rect x="${(crestX - 6).toFixed(0)}" y="${(ty + 34).toFixed(0)}" width="12" height="16" rx="2" fill="#8A5A32"/>
    <g class="hl-blades">
      ${[0, 90, 180, 270].map(a => `<g transform="rotate(${a} ${crestX.toFixed(1)} ${(ty + 2).toFixed(1)})"><path d="M${crestX.toFixed(0)} ${(ty + 2).toFixed(0)} l-6 -46 l12 0 z" fill="#FFF8F0" stroke="#8A6B3A" stroke-width="2"/></g>`).join('')}
      <circle cx="${crestX.toFixed(0)}" cy="${(ty + 2).toFixed(0)}" r="5" fill="#8A6B3A"/>
    </g></g>`;
  return rSVG(w, h, `${hill}${windmill}`) + clouds;
}

function beachScenery(w, h, night) {
  const seaTop = h * 0.26, seaBot = h * 0.38;   // sea band y 26-38% (RUN10 P1)
  const sea = night ? '#2C567A' : '#4FB3D9', sea2 = night ? '#21415E' : '#3C97C2';
  // rolling foam edge: a wavy white band that rolls sideways at the shore line
  const foamPath = (dl, op) => `<path class="bc-foam" style="--d:${(w * 0.16).toFixed(0)}px;--dl:${dl}s" d="M-30 ${seaBot.toFixed(0)} q 26 -9 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="${op}"/>`;
  const shells = [[0.20, 0.80, '#FF9AD5'], [0.32, 0.90, '#FFC93C'], [0.48, 0.83, '#8FC7FF'], [0.60, 0.92, '#FF9AD5'], [0.76, 0.86, '#FFC0A0'], [0.85, 0.79, '#C6A9F0']].map(([fx, fy, c]) =>
    `<g transform="translate(${(fx * w).toFixed(0)} ${(fy * h).toFixed(0)})"><path d="M0 6 C-9 6 -9 -6 0 -6 C9 -6 9 6 0 6 Z" fill="${c}" stroke="#B06A8A" stroke-width="1.4"/><path d="M0 -6 V6 M-5 -3 L-4 5 M5 -3 L4 5" stroke="#B06A8A" stroke-width="1"/></g>`).join('');
  const onePalm = (px) => `<g class="bc-palm">
    <path d="M${px.toFixed(0)} ${(h * 0.7).toFixed(0)} q -10 -60 -2 -110" fill="none" stroke="#9A6B3A" stroke-width="11" stroke-linecap="round"/>
    ${[[-1, -8], [-1, 18], [1, -8], [1, 18], [0, -34]].map(([dir, ang]) => `<path d="M${(px - 4).toFixed(0)} ${(h * 0.7 - 108).toFixed(0)} q ${dir * 44} ${ang < 0 ? -10 : 20} ${dir * 74} ${28 + Math.abs(ang)}" fill="none" stroke="${night ? '#3E7A54' : '#4FA85E'}" stroke-width="9" stroke-linecap="round"/>`).join('')}
    <circle cx="${(px - 4).toFixed(0)}" cy="${(h * 0.7 - 108).toFixed(0)}" r="7" fill="#8A5A32"/>
    <circle cx="${(px + 6).toFixed(0)}" cy="${(h * 0.7 - 98).toFixed(0)}" r="5" fill="#7A4A22"/><circle cx="${(px - 12).toFixed(0)}" cy="${(h * 0.7 - 96).toFixed(0)}" r="5" fill="#7A4A22"/></g>`;
  const palm = onePalm(PALM_X * w) + onePalm(PALM2_X * w);   // palm×2 (RUN10 P1)
  const hx = HUT_X * w, hy = h * 0.5;
  const hut = `<g>
    <rect x="${(hx - 34).toFixed(0)}" y="${(hy + 6).toFixed(0)}" width="68" height="54" rx="4" fill="#F2DDA6" stroke="#8A6B3A" stroke-width="3"/>
    <path d="M${(hx - 46).toFixed(0)} ${(hy + 8).toFixed(0)} L${hx.toFixed(0)} ${(hy - 24).toFixed(0)} L${(hx + 46).toFixed(0)} ${(hy + 8).toFixed(0)} Z" fill="#FF7AC6" stroke="#B0447E" stroke-width="3"/>
    ${Array.from({ length: 5 }, (_, i) => `<rect x="${(hx - 44 + i * 18).toFixed(0)}" y="${(hy - 2).toFixed(0)}" width="9" height="10" fill="${i % 2 ? '#FFF8F0' : '#FF7AC6'}" opacity="0.85"/>`).join('')}
    <rect x="${(hx - 12).toFixed(0)}" y="${(hy + 26).toFixed(0)}" width="24" height="34" rx="3" fill="#8FC7FF" stroke="#8A6B3A" stroke-width="2.5"/></g>`;
  return rSVG(w, h, `
    <rect x="0" y="${seaTop.toFixed(0)}" width="${w.toFixed(0)}" height="${(seaBot - seaTop).toFixed(0)}" fill="${sea}"/>
    <rect x="0" y="${seaTop.toFixed(0)}" width="${w.toFixed(0)}" height="8" fill="${sea2}" opacity="0.7"/>
    ${Array.from({ length: 3 }, (_, i) => `<path class="bc-swell" style="--dl:${(-i * 1.4).toFixed(1)}s" d="M0 ${(seaTop + 22 + i * 30).toFixed(0)} q ${(w * 0.25).toFixed(0)} -8 ${(w * 0.5).toFixed(0)} 0 t ${(w * 0.5).toFixed(0)} 0" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.28"/>`).join('')}
    ${foamPath(0, 0.9)}${foamPath(-2.5, 0.5)}${palm}${hut}${shells}`);
}

// The Playground (RUN10 P1, new area): a soft-play tiled ground pattern, a low fence
// backdrop, and cheerful bunting strung across the top — a distinct place, not a re-skin.
function playgroundScenery(w, h, night) {
  const tileColours = night ? ['#3E6E7A', '#3E5E7A'] : ['#7FD3D9', '#8FC7EF'];
  const tileY = h * 0.60, tileH = h * 0.06, tileW = 46;
  const tiles = Array.from({ length: Math.ceil(w / tileW) + 1 }, (_, i) =>
    `<rect x="${(i * tileW).toFixed(0)}" y="${tileY.toFixed(0)}" width="${(tileW - 2).toFixed(0)}" height="${tileH.toFixed(0)}" rx="4" fill="${tileColours[i % 2]}" opacity="0.85"/>`).join('');
  const fenceY = h * 0.50;
  const fence = Array.from({ length: Math.ceil(w / 60) + 1 }, (_, i) =>
    `<rect x="${(i * 60).toFixed(0)}" y="${(fenceY - 20).toFixed(0)}" width="8" height="34" rx="2" fill="#F4C96B" stroke="#8A6B3A" stroke-width="2"/>`).join('') +
    `<rect x="0" y="${(fenceY - 8).toFixed(0)}" width="${w.toFixed(0)}" height="7" rx="3" fill="#EFA84C" opacity="0.9"/>`;
  const buntingY = h * 0.16;
  const flags = Array.from({ length: 10 }, (_, i) => {
    const x = (i + 0.5) / 10 * w, y = buntingY + Math.sin(i / 9 * Math.PI) * 18;
    return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l14 0 l-7 16 z" fill="${['#FF7AC6', '#FFC93C', '#35D0BA', '#8FC7FF'][i % 4]}" stroke="#2A1B4E" stroke-width="1.5"/>`;
  }).join('');
  const bunting = `<path d="M0 ${buntingY.toFixed(0)} Q ${(w / 2).toFixed(0)} ${(buntingY + 30).toFixed(0)} ${w.toFixed(0)} ${buntingY.toFixed(0)}" fill="none" stroke="#2A1B4E" stroke-width="2.5" opacity="0.7"/>${flags}`;
  return rSVG(w, h, `${fence}${tiles}${bunting}`);
}

function signSVG() {
  return `<svg viewBox="0 0 60 70" width="52" height="60"><rect x="27" y="30" width="6" height="38" fill="#8A5A44" stroke="#2A1B4E" stroke-width="2.5"/><rect x="8" y="8" width="44" height="26" rx="5" fill="#F2D6B8" stroke="#2A1B4E" stroke-width="3"/><text x="30" y="26" font-family="Fredoka,sans-serif" font-size="16" fill="#2A1B4E" text-anchor="middle">🔒</text></svg>`;
}
