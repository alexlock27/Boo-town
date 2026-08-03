// js/town.js — Town 4.0: a single area scene, reached from the world map (RUN10 P1).
// One area per mount (world width = AREA_W_VIEWPORTS viewports), three parallax layers,
// drag placement along the ground band, wandering Boos, real-clock day/night. Multi-area
// navigation lives in worldmap.js; this file only ever renders one already-unlocked area.

import { el, clear, confetti, REDUCED, backControl, sparkleAt, dialog } from './ui.js';
import { getState, mutate, commit, nextPlacementId } from './state.js';
import { CAPER_SIGNS } from './caper/state.js';   // RUN10 P17: silly signposts while a caper is open
import { AREAS, AREA_W_VIEWPORTS, areaByKey, HOUSE_ROOMS, houseRoom } from './areas.js';
import { renderItem, renderDeco, clockHands, renderPathPot, WISH_SIZE, WISH_PX } from './art.js';
import { BY_ID } from '../data/catalogue.js';
import { priceOf } from '../data/shop.js';   // RUN21C-4: the Pot's locked styles show their shelf price
import { resolveItem } from './customs.js';
import { listArtworks } from './studio.js';
import { idbGet } from './idb.js';
import { voiceBooIds, playVoice } from './voices.js';
import { checkRequestOpen, activeRequest, activeRequests, takeTreat, takeThanks, noteRequest, pruneImpossible, VERB_BY_KIND, nowMs, REQUEST_REWARD, TRY_FRESH_MS } from './requests.js';
import { openChoreographer, routineFor, applyMove, STEP_MS } from './choreographer.js';
import { guideLine, speakMaybe } from './guide.js';
import { acknowledge } from './ack.js';   // RUN19 Z3/Z4: the shared ≤2-per-session budget
import { equippedArt, openDressUp, getDisplayName, locomotionFor, costumeFor, costumeIdleDelay, motionFor } from './accessories.js';
import { sfx, music, ambient, bed } from './sfx.js';
import { noteQuest, stampJournal } from './quests.js';
import { tickGrowth, completeReveal, growthView, GROWTH_MILESTONES } from './growth.js';
import { ensureHide, currentHide, foundHide, HIDE_REWARD, duskVisitor, tapDuskVisitor, ensureDayVisitHour } from './delights.js';
import { addMeterPoints } from './rewards.js';
import { FUNFAIR_UNLOCK, RIDE_ORDER, RIDE_NAME, RIDE_X, RIDE_SEATS, tickFunfair, completeRideReveal, completeCatchupReveal, funfairView, funfairUnlocked, seatsFor, seatBoo, unseatBoo, isSeated, emptySeatCount, renderRide, stepRide, fairSceneryFor, funfairSilhouette } from './funfair.js';
import { BANDSTAND_X, bandTrio, getBandSongEvents, startBandWatch } from './band.js';
import { applyRarityFx, clearRarityFx, rarityRank, RARITY_TOWN_CAP } from './rarityfx.js';
import { SOCKETS, HIDE_POINTS } from '../data/sockets.js';
import { SURFACE_SLOTS, slotsFor, surfaceYFor, baseYFor, isSmall, clampWallY, WALL_Y_MIN, WALL_Y_MAX,
         CHILD_SCALE, CHILD_MAX_WIDTH_FRAC, SLOT_SNAP_PX } from '../data/surfaces.js';
import { DRESSINGS, DRESSING_BY_ID, DEFAULT_DRESSING, dressingsFor } from '../data/dressings.js';
import { renderDressing, renderDressingSwatch } from './art.js';
import { createDrawer } from './drawer.js';
import { personalityOf, personalityMult, SHY_GREET_DIST_PX, CATCHPHRASES, CATCHPHRASE_RATE } from '../data/personalities.js';
import { openCare, bondLevel, isBestFriend, heartBadge, trickFor, renderBffPortrait, careActions, heartsMarkup } from './care.js';
import { openWishWell } from './wishwell.js';
import { wishId, wishItem, LIVING_WISHES, WISH_GROUPS, WISH_GROUP_FALLBACK } from '../data/wishes.js';
// RUN20 W1 — wish life. The table says which of the nine classes each of the sixty wishes
// gets; js/wishlife.js is the machinery they share.
import { WISH_LIFE, lifeFor, classOf, isOutdoorOnly, INDOOR_TIP, SKY_BAND, CATCHABLE } from '../data/wishlife.js';
import { wordOfWishId, isWish, wishClass, wishIdleClass, wishLife, wishNeedsSky, createSoundBudget, newVisit,
         maydaySay, skyYFor, skyDriftX, bandOfHour, bandAllows, chooseDiner, tallestNear, crownPick } from './wishlife.js';
import { WISH_IDLE_EPISODIC, WHALE_SPOUT_MS, WISH_IDLE_SCENE_PER_MIN } from '../data/wishlife.js';

// Area list, positions and unlock thresholds now live in js/areas.js (RUN10 P1) — the
// world map is the only place that knows about all 8 areas at once. town.js mounts ONE
// already-unlocked area at a time; see mount() for the per-mount single-area ZONES shim
// (kept as `ZONES`/`ZONE_INDEX` internally so the rest of this file's zone-comparison code
// — written for the old 5-zone continuous world — needs no further changes: with exactly
// one entry, every `ZONE_INDEX[...] === zi` comparison and `zi * zoneW` offset still holds).
const MAX_WANDERERS = 30;
const DISCO_DOOR_X = 0.51;

// ---- interior scenes (RUN10 P4): the Boo House ----
// Only kind:'interior' areas mounted BY town.js (the Gallery is its own dedicated
// screen — see js/gallerymuseum.js). A room is snug: 1.5 viewports, not 4.
const INTERIOR_W_VIEWPORTS = 1.5;
const INTERIOR_WALL_FRAC = 0.55;   // room backdrop: wall band = top 55%, floor band = the rest
const WALL_ROW = 3;                // sentinel row value for wall-hung items (floor uses 0-2)
const WALL_Y_FRAC = 0.30;          // DEFAULT hang height for a wall item with no dragged `y`.
                                   // Since RUN19 Z6 the height is per item: clampWallY(t.y ??
                                   // WALL_Y_FRAC) inside data/surfaces.js's 0.18-0.42 band.
const ITEM_SCALE_MIN = 0.70, ITEM_SCALE_MAX = 1.60, ITEM_SCALE_STEP = 0.15;
// RUN19 Z6 — drag-handle resize replaces the +/- buttons. The range is the same 0.70-1.60 the
// buttons stepped through, except that furniture indoors (and a bed anywhere) may go to 2.0,
// because a double bed and a bedside lamp are not the same size of thing.
const ITEM_SCALE_MAX_FURNITURE = 2.0;
const RESIZE_RING_PX = 28;       // the handle's own size
const RESIZE_DRAG_SPAN = 180;    // px of drag that covers the whole clamp range
const scaleMaxFor = (item, interior) => ((item && (item.id === 'deco_bed' || (interior && item.kind === 'furniture'))) ? ITEM_SCALE_MAX_FURNITURE : ITEM_SCALE_MAX);
// RUN19 Z6: the clamp is per-item now (a bed and a bedside lamp are not the same size of
// thing), so the ceiling is passed in. Absent = the old shared 1.60, which keeps every caller
// that does not care about furniture behaving exactly as before.
const itemScaleOf = (t, max = ITEM_SCALE_MAX) => Math.max(ITEM_SCALE_MIN, Math.min(max, Number(t && t.scale) || 1));
// Z6: a placement's plane. Absent means 'floor' — that is the whole compatibility story for
// every placement made before this run. RUN10 P4's row-3 sentinel is still honoured for any
// save the v23 migration has not touched.
const planeOf = (t) => (t && t.plane) || (t && t.row === WALL_ROW ? 'wall' : 'floor');
const isWallPlane = (t) => planeOf(t) === 'wall';
// The stable identity of a placement (save v24, RUN21F F5): the monotonic `id` the save hands
// out, and NOT the old `zone:x:item` place-key. The place-key baked the thing's own x into its
// name, so the instant she nudged a table its name changed, every lamp on it pointed at a
// parent that no longer existed, and groundOrphans swept them onto the floor. An id does not
// move. It is the one answer to "which placement is this" for the three things that used to ask
// separately: a surface child's `parent`, socket occupancy (itemKeyOf) and a sparkle stamp.
// A placement without an id can only be one that has not been through migrate() — every
// creation path takes one from nextPlacementId() — so the fallback is a diagnostic, not a path.
const pidOf = (t) => (t && t.id != null ? t.id : null);
const HOUSE_STARTER_STOCK = { deco_rug: 1, deco_tablelamp: 1 };
// RUN13 T4: every lamp carries a night state, not just the original table lamp.
const LAMP_IDS = new Set(['deco_tablelamp', 'deco_lamp2', 'deco_floorlamp']);
const CLOCK_TICK_MS = 20000;     // how often a placed wall clock re-reads the device time
// RUN13 T3: each Boo House room remembers where its camera was left. Module-level, so it
// survives the re-mount that switching rooms performs (the module itself is cached).
const roomScroll = new Map();
// House furniture that a Boo can actually USE (RUN13 T3). These join ACT_IDS below, so the
// existing generic socket loop claims them exactly like a swing or a bench — one code path,
// no parallel system. NOTHING here is a need: a snack is a scene, a nap is a nap (G9).
const HOUSE_ACT_IDS = ['deco_bed', 'deco_bunkbed', 'deco_table', 'deco_kitchentable',
  'deco_counter', 'deco_stool', 'deco_sofa', 'deco_armchair', 'deco_rug'];
const HOUSE_KIND_FOR = {
  deco_bed: 'housenap', deco_bunkbed: 'housenap',
  deco_table: 'snack', deco_kitchentable: 'snack', deco_counter: 'snack', deco_stool: 'snack',
  deco_sofa: 'lounge', deco_armchair: 'lounge', deco_rug: 'lounge'
};
const CHAT_PIP_MS = 2600;        // how often a lounging pair swaps a chat pip
// ---- RUN13 T5: species idles -----------------------------------------------------------
// Two more idles for every species: a universal blink-and-look-around, and one flavoured by
// what that species IS. They fire only while a Boo is standing still, and they are
// "occasional" in the house-law sense: HARD-capped, per Boo and per scene, so a room full
// of Boos never turns into a twitch. IDLE_MIN_GAP_MS is the floor between one Boo's idles;
// IDLE_MAX_PER_MIN is the ceiling on how many she may play in any rolling minute.
const SPECIES_IDLE = {
  bloop: 'jiggle',      // a round Boo settles by wobbling
  pip:   'ear-flick',   // those ears hear everything
  munch: 'nibble-air',  // an optimistic little chew
  twirl: 'antenna-bob', // the antenna picks something up
  sunny: 'sun-stretch',
  nova:  'twinkle',
  snug:  'snuggle-down',
  zippy: 'zoom-shiver',
  giraffe: 'neck-crane'
};
const IDLE_BLINK = 'blink-look';
const IDLE_MIN_GAP_MS = 14000;    // per Boo: never twice inside this window
const IDLE_MAX_PER_MIN = 3;       // per Boo: rolling-minute ceiling (rule 2, hard cap)
const IDLE_SCENE_CAP = 4;         // per scene: never more than this many idling at once
const IDLE_CHANCE = 0.6;          // odds a qualifying pause becomes an idle (RUN19 Z2: was 0.35 — the cooldowns and caps above are what keep it calm, not this)
const IDLE_MS = 1100;             // how long an idle plays
const SNACK_BITE_MS = 1500;      // one nibble cycle at the table

const BAND_TOP = 0.62, BAND_BOTTOM = 0.92;   // usable ground runs 62%→92% of viewport height
const GROUND_FRAC = BAND_TOP;          // the grass band starts at the top of the placement band
// three depth rows: feet-line (fraction of viewH), and a size scale (smaller toward the back)
const ROW_GROUND = [0.67, 0.79, 0.91];
// RUN19 Z6 — the BACK-WALL LANE. Indoors the three ground lines are re-spaced so the back row's
// feet-line meets the rendered interior wall base (0.585) instead of floating 8% of the
// viewport in front of it — which is why big furniture never read as being AGAINST the wall.
// Same three rows, moved: existing indoor placements keep their row indices and shift up a
// little, which the pack calls out as an acceptable one-time visual change with no migration of
// positions. Outdoor rows are untouched.
const ROW_GROUND_INDOOR = [0.585, 0.72, 0.86];
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
const ACT_IDS = ['deco_slide', 'deco_swings', 'deco_trampoline', 'deco_paddlepool', 'deco_bumper', 'deco_seesaw', 'deco_picnic', 'deco_bench', 'deco_pond',
  'deco_bed', 'deco_bunkbed', 'deco_table', 'deco_kitchentable', 'deco_counter', 'deco_stool', 'deco_sofa', 'deco_armchair', 'deco_rug'];
// role kind per activity item — generic socket loop below (RUN10 P2)
const KIND_FOR = { deco_slide: 'slide', deco_swings: 'swing', deco_trampoline: 'bounce', deco_paddlepool: 'paddle', deco_bumper: 'drive', deco_seesaw: 'seesaw', deco_picnic: 'picnic', deco_bench: 'sit', deco_pond: 'fish',
  deco_bed: 'housenap', deco_bunkbed: 'housenap',
  deco_table: 'snack', deco_kitchentable: 'snack', deco_counter: 'snack', deco_stool: 'snack',
  deco_sofa: 'lounge', deco_armchair: 'lounge', deco_rug: 'lounge' };
// Personality weight keys (RUN10 P5) for the generic 'approach' goal — keyed by WHICH
// activity item was actually found, since 'approach' itself covers every ACT_IDS member.
const ACT_MULT_KEY = { deco_trampoline: 'trampoline', deco_bench: 'bench', deco_slide: 'slide', deco_swings: 'swings', deco_seesaw: 'seesaw' };
// Hide-and-seek 2.0 (RUN10 P5): a giggle + wiggle every 8-14s so the hider reads as
// alive, not just a static sticker peeking out.
const HIDE_WIGGLE_MIN_MS = 8000, HIDE_WIGGLE_MAX_MS = 14000;
const SETTLE_MS = 180;           // arrival settle: drop + squash (RUN10 P2)
// RUN19 Z3 — announced moments.
const SEAT_HOP_MS = 350;         // hop onto a claimed seat: a translateY arc on the wrap
const WAIT_MS = 8000;            // seat full → wait beside it patiently this long, then wander
const WAIT_SHIFT_MS = 1500;      // the patient pose's weight-shift period
const MAX_WAITERS_PER_SEAT = 1;  // a second arrival wanders off rather than forming a crowd
const NAP_CHANCE = 0.5;          // indoors: odds a qualifying pause becomes a real bed nap
const NAP_MIN_MS = 20000, NAP_MAX_MS = 40000;   // a nap lasts 20-40s, then she gets up herself
const NAP_Z_MS = 2000;           // a drifting "z" every 2s
const NAP_SNORE_MS = 4000;       // a soft snore every 4s
const NAP_STRETCH_MS = 600;      // wake-on-tap: a 600ms stretch + a yawn
// Every SOCKETS[].row in data/sockets.js was authored for an item standing in row 2, so a
// socket's row is read as a delta from this base (see give()).
const SOCKET_ROW_BASE = 2;
// RUN19 Z5 — the wellie puddle stomp, to the pack's numbers.
const SPLASH_MS = 400;           // how long a splash particle lives
const SPLASH_MAX = 6;            // hard cap on particles per stomp
const STOMP_GAP_MS = 240;        // min gap between stomps for one Boo
// RUN19 Z5 — Sprinkle.
const SPRINKLE_COST = 5;         // stardust per sprinkle (the shiny upgrade stays at 10)
const LONG_PRESS_MS = 500;       // play-mode long press (shared with RUN20 W1's catching)
const SPARKLE_SCENE_CAP = 6;     // never more than this many sparkling at once (particle caps)
const THANKS_FLY_DELAY_MS = 700;  // Z2: the +2 follows the thank-you, it does not share its frame
// RUN10 P2's 300ms shrug is RETIRED by Z3 — a Boo that walks to a full bench now waits
// beside it (see waitBesideSeat), which is what a child does and what a shrug never read as.
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
// ---- Paths (RUN10 P3; the hammer that used to gate them retired in RUN21C-1) ----
export const PATH_CAP = 300;      // path cells per area
const PATH_CELL = 0.05;           // grid cell size: 5% of the area's width, square within the ground band
// RUN21C-2: the one line the Path Pot says while it is in her hand. Authored copy — exact.
export const PATH_POT_HINT = 'Drag along the ground to lay a path — paint over it to sweep it away.';
export const PATH_POT_ID = 'path_pot';   // the permanent first chip in the Landscape tab
// The Pot's style row. stone/sand/flower are free and always hers (RUN10 P3); the other
// three are RUN21C-4's shop stock, and carry the catalogue id that owning one writes into
// `inventory`. An unowned style still SHOWS here, locked, with its price — she should be
// able to see what she is saving for from the place she would use it.
export const PATH_STYLES = [
  { id: 'stone', label: '🪨', title: 'Stone' },
  { id: 'sand', label: '🏖️', title: 'Sand' },
  { id: 'flower', label: '🌸', title: 'Flower' },
  { id: 'brick', label: '🧱', title: 'Brick', sku: 'path_brick' },
  { id: 'stepping', label: '👣', title: 'Stepping', sku: 'path_stepping' },
  { id: 'rainbow', label: '🌈', title: 'Rainbow', sku: 'path_rainbow' }
];
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

// ---- RUN21D: pulse ---------------------------------------------------------------------
// Delight in this town is probabilistic — dice per pause, per Boo, per behaviour — which is
// lovely on the fifth minute and empty on the first. A child could walk into a living place
// and watch nothing happen for a full minute. So every area mount now takes ONE guaranteed
// opening breath: exactly one beat, chosen by priority rather than by dice, and then a
// single invitation to touch something.
//
// One beat. Never two. The chooser below returns on its first success, and `pulseStarted`
// makes the whole thing once-per-mount. Reveals win outright (RUN21A-8's queue): if a
// ceremony is on screen or waiting at the moment the beat is due, the pulse skips that
// mount entirely rather than talking over it.
const PULSE_DELAY_MS = 900;      // after first paint: long enough to read as the town's own
const PULSE_HINT_MS = 9000;      // …and the invitation, once, at nine seconds
const PULSE_PAN_MS = 600;        // the pack's ease for "come and look at this"
const PULSE_BUBBLE_PULSES = 3;   // a request bubble breathes three times, then stops
const PULSE_BUBBLE_MS = 2400;    // 3 × the .rq-pulse3 cycle in styles.css
// The invitation, per area, exactly as authored. The Playground names the swings until
// RUN21E lands tag; the pack authors both and says which one binds until then.
const PULSE_INVITATIONS = {
  meadow:            'Try tapping a flower…',
  riverside:         'Try tapping the river…',
  hilltop:           'Try tapping the sky…',
  beach:             'Try tapping the sand…',
  playground:        'Try the swings…',
  funfair:           'The bandstand plays if you wander right…',
  boohouse:          'Try tapping a sleepy Boo…',
  boohouse_kitchen:  'Try tapping a sleepy Boo…',
  boohouse_bedroom:  'Try tapping a sleepy Boo…'
};
const SHOW_ME_RING_MS = 2000;    // RUN21D-2: how long "Show me" rings the thing it landed on

// ---- RUN21D-3: landmark dots -----------------------------------------------------------
// An outdoor area is FOUR viewports wide and nothing ever said so. A child who never
// happened to drag left or right met a quarter of her own town. Four dots, one per screen,
// named — so the width is legible at a glance and reachable in one tap.
const DOT_SCREEN_X = [0.125, 0.375, 0.625, 0.875];   // the four screen centres, as fractions
const DOT_PAN_MS = 600;
const LANDMARK_DOTS = {
  meadow:     ['The Oak', 'The Stage', 'The Shop', 'The Well'],
  riverside:  ['The Bank', 'The Bridge', 'The Reeds', 'The Shallows'],
  hilltop:    ['The Foot', 'The Climb', 'The Windmill', 'The Crest'],
  beach:      ['The Palms', 'The Hut', 'The Shore', 'The Rockline'],
  playground: ['The Gate', 'The Green', 'The Corner', 'The Far Fence'],
  funfair:    ['The Gate', 'The Rides', 'The Booth', 'The Bandstand']
};
// A dot pans to its screen's centre — EXCEPT where the thing it is named after is a fixed
// installation that does not sit on that centre. The funfair's bandstand is the one such
// case in the world today: BANDSTAND_X is 0.68, which is inside screen 3 (0.50-0.75), so a
// dot that says "The Bandstand" and panned to 0.875 would show her the helter-skelter and
// no music. It pans to the bandstand itself instead, which is what its label promises.
const DOT_TARGET_OVERRIDE = { funfair: { 3: BANDSTAND_X } };
const EDGE_SHIM_MS = 5400;       // two soft sweeps (2 × 2.6s) at an edge with town beyond it

// ---- RUN21D-4: the fair's two signs ----------------------------------------------------
// Both hang on the ENTRANCE SCREEN (x < 0.25 of the zone), under the bunting, so they are
// on screen the moment she walks in — the pack's "from screen 1" is the whole point.
const FAIR_SIGN_Y = 0.20;        // fraction of viewport height: hanging under the bunting
const FAIR_SIGNS = [
  { id: 'band',  x: 0.055, text: '🎵 Band',  aria: 'Go to the bandstand' },
  { id: 'disco', x: 0.150, text: '🕺 Disco', aria: 'Enter the Disco Hall' }
];

// ---- RUN21D-5: the hider gets a fair chance --------------------------------------------
// The day's hide-and-seek Boo can land three screens away in an area she never scrolls, and
// then it is not a game of hide-and-seek at all — it is a lottery. One pan TOWARD the peek
// spot, stopping half a screen short so the finding is still hers, and one line so she
// knows there is something to find.
const HIDER_NEARBY_LINE = 'Someone\'s hiding nearby… 👀';
const HIDER_PAN_MS = 600;
// "Prefer things not shown today" — a SESSION set, never the save. There is no ledger of
// what the town has already shown her; it resets on load like every other pacing memory
// here (js/ack.js, js/encouragement.js, wishlife's visit tokens).
let pulseSeenDay = '';
let pulseSeen = new Set();
function pulseSeenSet(dayKey) {
  if (pulseSeenDay !== dayKey) { pulseSeenDay = dayKey; pulseSeen = new Set(); }
  return pulseSeen;
}

function seasonOf(month) {       // month 1..12
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}
// RUN19 Z5 — THE CAUSE of "the wellies never stomp". The stomp is gated on
// `currentSeasonName === 'rain'`, and seasonOf() above CANNOT return 'rain' — it returns
// exactly one of spring/summer/autumn/winter. So the only thing that ever set the rain
// season was the `window.__bootownWeather` QA flag, and no child had ever seen a puddle
// stomp. The weather layer's rain rendering was fully built (its own '•' glyph and
// `.t-weather.rain`); only the SELECTION was missing.
//
// Rain is a WEATHER state, not a season, so it is chosen per local DAY — deterministically,
// so it cannot flicker between mounts — in the two seasons where a British child expects it,
// and on RAIN_DAYS_IN of days, which keeps it "occasional" per house law.
const RAIN_SEASONS = new Set(['spring', 'autumn']);
const RAIN_DAYS_IN = 4;          // roughly one day in four
function dayNoise(str) { let h = 0; for (const c of String(str)) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return Math.abs(h); }
function isRainDay(season, dayKey) {
  if (!RAIN_SEASONS.has(season)) return false;
  return dayNoise('rain:' + dayKey) % RAIN_DAYS_IN === 0;
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
//
// ---- RUN21B item 3: PROPORTION RE-BASELINE ------------------------------------------------
// The unit for every furniture number below is B — the standing Boo's DRAWN height at scale 1,
// row 1 — MEASURED, not assumed: 74.36px at 1024x768 (six of the ten starter Boos; the eared
// species reach 87.4 and 93.5, the SVG box is 99.66). Every item shares one 120x130 viewBox
// and is scaled uniformly by the number in this table, so at row 1, scale 1:
//     one viewBox unit = ACT_SIZE / 120 px
// and an item's DRAWN height/width is (its own drawn extent in viewBox units) x that.
//
// Two things this table cannot do, and one it now does:
//  - It cannot hit a width target AND a seat-height target at once: the ratio between them is
//    fixed by the ART. Where the pack gives both, the SEAT/TOP HEIGHT wins (RUN21B-PROGRESS
//    deviation 9b) — that is the number "a Boo fits every seat without floating" tests.
//  - Heights are measured from each item's OWN DRAWN BASE, not from the nominal y=120 ground
//    line of the viewBox (deviation 10): a table's legs stop at y=102, a bench's at y=114, and
//    it is where the legs stop that the eye reads as the floor. Measuring from y=120 instead
//    makes six of the pack's own targets SHRINK the very items its WHY calls too small.
//  - It now covers deco_bench, deco_bookshelf3 and deco_pond, which were silently on the 92
//    fallback and so were invisible to every previous pass (deviation 9d).
// Comments give: measured-before -> after, in B, and which target set the number.
const ACT_SIZE = {
  deco_slide: 150, deco_swings: 150, deco_seesaw: 160, deco_trampoline: 140,
  deco_paddlepool: 150, deco_picnic: 150, deco_bumper: 140, deco_campfire: 120,
  // The pack's outdoor list is a SANITY PASS only — change nothing unless a Boo visibly
  // cannot fit. Photographed one Boo on each (swings/slide/seesaw/trampoline/picnic/
  // paddlepool): every one fits, so every one is untouched above.
  // deco_pond was on the 92 fallback and is now explicit at the same value: it is in neither
  // the pack's indoor list nor its outdoor sanity list, and a Boo does fit it, so the
  // re-baseline has no mandate to resize it. It DOES read small (88 drawn units = 0.90xB
  // wide, so a fishing Boo covers it) — flagged for RUN21C/E rather than invented here.
  deco_pond: 92,
  // The one bench in the game — the pack's indoor "bench" and its outdoor "cosy bench" are
  // the same item (deviation 9d). Seat top y=84, drawn base y=114, so 30 units of seat.
  // seat 0.310xB -> 0.520xB (the pack's bench ratio). Width follows the art at 1.11xB.
  deco_bench: 154,
  // furniture (RUN10 P4)
  // bed: mattress top y=78 over base y=108 was ALREADY 0.504xB against the pack's 0.45, so the
  // height target would have SHRUNK the one item the WHY names first. Length was the number
  // actually missing (1.345xB against the pack's 1.9), and length is what the bed-nap ACCEPT
  // needs — the duvet cannot cover a Boo lying on a bed shorter than it is. 1.345 -> 1.90xB.
  deco_bed: 212,
  // sofa cushion top y=80 over base y=106: seat 0.481 -> 0.500xB. Width 1.85xB (pack: 2.4).
  deco_sofa: 172,
  deco_rug: 213,                  // width 2.166 -> 2.200xB (the one pure-width item; +1.6%)
  deco_table: 129,                // top y=52 over base y=102: 0.672 -> 0.720xB. Width 0.98xB (pack: 1.3)
  deco_tablelamp: 131,            // drawn height 0.682 -> 0.850xB
  deco_wardrobe: 145, deco_bookshelf: 145, deco_bathtub: 145, deco_bffportrait: 120,
  // furniture and decor expansion (RUN13 T4)
  // armchair and sofa draw the SAME seat geometry (cushion top y=80, base y=106) yet sat at
  // 130 and 165, which is why one read 0.379xB and the other 0.481xB. Equal art, equal size.
  deco_armchair: 172,             // seat 0.379 -> 0.500xB. Width 1.54xB (pack: 1.3 — art overshoots)
  deco_bunkbed: 155, deco_wardrobe2: 145,
  deco_kitchentable: 139,         // top y=56 over base y=106: 0.757 -> 0.780xB. Width 1.37xB (pack: 1.9)
  deco_counter: 150, deco_fridge: 130, deco_oven: 130,
  deco_stool: 149,                // seat y=78 over base y=108: 0.319 -> 0.500xB
  deco_bookshelf2: 182,           // the pack's "low bookshelf": 0.877 -> 1.100xB tall
  deco_bookshelf3: 139,           // ADDED (was on the 92 fallback at 0.99xB — shorter than the
                                  // LOW shelf would now be). 1.50xB, so the three shelves read
                                  // low 1.10 / standard 1.40 / ladder 1.50 as one family.
  deco_rug2: 205, deco_rug3: 205, // same 2.2xB width rule as deco_rug (their art is 96 units, not 92)
  deco_lamp2: 105, deco_floorlamp: 130,
  deco_plant1: 146,               // the pack's "pot plant" (the only plant in SMALL_ITEMS): 0.678 -> 0.900xB
  deco_plant2: 120, deco_plant3: 105,
  // wallclock and photoframe are the two targets that genuinely REDUCE (0.55xB -> 72, 0.5xB ->
  // 53) — deviation 9c: treated as authored against a different B and left alone, since the
  // pack's own WHY is that this furniture reads too SMALL. Side-by-sides show neither oversized.
  deco_wallclock: 105, deco_mirror: 115,
  deco_toybox: 116,               // 0.756 -> 0.700xB tall (the pack's only toybox number)
  deco_wallart1: 110, deco_wallart2: 110, deco_wallart3: 110,
  deco_photoframe: 105
};
// RUN21B item 1: every wish used to render at the generic 92, because they were all the
// same medallion and size carried no meaning. Now that they are real objects, each carries
// the pack's footprint class — S 44 (bell, key, sock, cookie…), M 64, L 84 (castle, whale,
// rocket…) — so a key is key-sized beside a castle instead of matching it.
for (const [word, cls] of Object.entries(WISH_SIZE)) {
  if (WISH_PX[cls]) ACT_SIZE[wishId(word)] = WISH_PX[cls];
}

export function totalStars() { const s = getState(); return s ? s.stars.total : 0; }

// RUN13 T4: the wall clock needs minutes as well as hours, and the suites need to be able
// to pin both — same `window.__bootown*` override convention as the hour.
function currentMinute() {
  const m = typeof window !== 'undefined' ? window.__bootownMinute : undefined;
  return Number.isFinite(m) ? ((m % 60) + 60) % 60 : new Date().getMinutes();
}
function currentHour() {
  if (typeof window !== 'undefined' && window.__bootownHour != null) return window.__bootownHour | 0;
  // RUN20 W4 — the daylight proof needs to photograph 10:00, 17:00 and 21:00 in one run. A
  // `?hour=N` query override does that, GATED on the same QA flag every other test seam uses,
  // so it can never be reached in normal child use: a URL a child could type must not be able
  // to change what time of day her town thinks it is.
  const q = qaHourOverride();
  if (q != null) return q;
  try { return new Date().getHours(); } catch { return 12; }
}
// null unless the QA flag is set AND ?hour= is a whole 0-23.
function qaHourOverride() {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    if (!window.__bootownQA) return null;
    const v = new URLSearchParams(window.location.search).get('hour');
    if (v == null || v === '') return null;
    const n = Number(v);
    return (Number.isInteger(n) && n >= 0 && n <= 23) ? n : null;
  } catch { return null; }
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
  // Z6: which ground-line table this area uses. Read through ROWS everywhere below, never
  // ROW_GROUND directly, or the back-wall lane silently reverts indoors.
  const ROWS = isInterior ? ROW_GROUND_INDOOR : ROW_GROUND;
  // RUN13 T3: the Boo House is three rooms. `params.room` chooses one; everything below
  // stores and reads through STORE_KEY rather than AREA.key, so each room is genuinely its
  // own placeable scene while still being ONE area on the world map.
  const ROOMED = AREA.key === 'boohouse';
  const roomId = ROOMED ? (houseRoom((params && params.room) || 'lounge').id) : null;
  const ROOM = ROOMED ? houseRoom(roomId) : null;
  const STORE_KEY = ROOM ? ROOM.key : AREA.key;
  // Single-area "zones" shim: every zone-comparison helper below was written for the old
  // 5-zone continuous world and reads ZONES/ZONE_INDEX from the enclosing closure. With
  // exactly one entry here (index 0, unlock 0 — already-unlocked by construction, since
  // the map is the only way in), all that code keeps working unchanged.
  const ZONES = [{ key: STORE_KEY, name: ROOM ? ROOM.name : AREA.name, unlock: 0 }];
  const ZONE_INDEX = { [STORE_KEY]: 0 };
  music.play('calm');
  noteQuest('townVisit');   // daily quest: visit the town (RUN3 C4)
  // Hide-and-seek Boo, once per local day (RUN4 C9): picks across ALL areas (delights.js),
  // so renderHide() below only shows something on the area it actually landed in — graceful
  // no-op elsewhere. A world-map "someone's hiding over here" chip is P5's job.
  ensureHide();
  ensureDayVisitHour();   // RUN19 Z2: the wild Boo's one daytime hour, picked at first mount today
  newVisit();             // RUN20 W1: "once per visit" means once per AREA MOUNT
  let voiceIds = new Set();  // Boo ids with a recorded voice (RUN3 C7)
  voiceBooIds().then(s => { voiceIds = s; }).catch(() => {});
  // Occasional Boo requests (RUN3 C8): check at app open (town is an "open").
  // RUN19 Z2 makes AREA ENTRY a trigger too (not just app open), and passes the storage key
  // so the five verbs can name something that is actually standing here.
  checkRequestOpen(requestableBooIds(), STORE_KEY);
  // Boos that may be asked to ask for something. Excludes the day's hide-and-seek Boo:
  // renderHide() sets display:none on the hider's wrap and draws a peeking stand-in
  // instead, so a bubble parented to it would be a 0x0 invisible button — a request the
  // child could never open. A Boo that is hiding is not standing there asking for a turn
  // on the swings either, so this is the honest reading, not a workaround.
  function requestableBooIds() {
    const hiding = currentHide();
    const hider = hiding ? hiding.boo : null;
    return areaItems(getState())
      .filter(t => (t.item || '').startsWith('boo_') || (t.item || '').startsWith('custom:'))
      .map(t => t.item)
      .filter(id => id !== hider);
  }

  // Area-scoped item storage (RUN10 P1): save.town.areas[AREA.key] = {items:[],paths:[]}.
  // Every item carries a redundant `.zone` field (always === AREA.key) so the zone-
  // comparison code throughout this file needs no further changes.
  function areaItems(st) {
    if (!st.town.areas[STORE_KEY]) st.town.areas[STORE_KEY] = { items: [], paths: [] };
    return st.town.areas[STORE_KEY].items;
  }

  let holding = (params && params.place) || null;   // item id being placed
  let holdingScale = 1;
  let placeMode = !!holding;
  let scrollX = 0, worldW = 0, zoneW = 0, viewW = 0, viewH = 0, groundY = 0;
  let raf = null, actors = [], fx = [];
  let currentSeasonName = '', starTimer = null;   // ambient life (RUN6 C1)
  // ---- RUN21C-1: the world SOFTENS (this replaces RUN10 P3's build mode) ----------------
  // There is no mode any more, and no hammer to enter one. The world softens — actors pause
  // mid-pose, request bubbles hide, ambient speech stops — whenever she is plainly ARRANGING
  // rather than playing: the drawer is open, or something is held on her finger (a drawer
  // chip, or the Path Pot). Drawer shut and nothing held → everything resumes.
  //
  // `softened` is THE gate. Every `!buildMode` in this file became `!softened`; the CSS class
  // is still `.town2.building` because that is what carries the freeze, and renaming a
  // stylesheet contract is not what this pack is for.
  //
  // *** CROSS-RUN NOTE (RUN21B merges before this branch): the wish ambient-idle scheduler
  // `pumpWishIdles` is gated `!document.hidden && !buildMode`. There is no `buildMode` any
  // more — that gate must become `!document.hidden && !softened`, or the wish idles never
  // pause while she arranges. ***
  let softened = false, pathStyle = 'stone';
  let potHeld = false;          // the Path Pot is lifted (RUN21C-2)
  let pendingPaths = null, pathCommitTimer = null, painting = false;
  let lastCommittedPaths = null;   // RUN21C-7: the paths as of the last commit, for undo

  const root = el('div', { class: 'town2 area-' + AREA.key + ' entering' });
  const back = backControl(() => ctx.go('worldmap'));
  const title = el('h2', { text: AREA.name });
  if (ROOM) title.textContent = `${AREA.name} \u00b7 ${ROOM.name}`;
  // RUN21C-1: no hammer. The drawer carries the intent now, so the header is back + name.
  const header = el('header', { class: 'town-header' }, [back, title]);
  // RUN13 T3 — the room switcher. A labelled tab strip in the drawer/tab visual language
  // (js/drawer.js's `.bd-tab` pattern), NOT a pair of edge arrows: a child should be able
  // to read where she is going. This is navigation between scenes, not a physical action,
  // so G8's direct-manipulation law does not reach it.
  const roomTabs = ROOM ? el('nav', { class: 't-room-tabs', 'aria-label': 'Rooms in the Boo House' },
    HOUSE_ROOMS.map(r => el('button', {
      class: 't-room-tab' + (r.id === roomId ? ' sel' : ''),
      type: 'button',
      'data-room': r.id,
      'aria-label': `Go to the ${r.name}`,
      'aria-current': r.id === roomId ? 'page' : undefined,
      onclick: () => {
        if (r.id === roomId) return;
        sfx.tap();
        roomScroll.set(STORE_KEY, scrollX);
        ctx.go('town', { area: 'boohouse', room: r.id });
      }
    }, [el('span', { class: 'rt-thumb', 'aria-hidden': 'true', html: roomThumbSVG(r) }), el('span', { class: 'rt-lbl', text: r.name })]))) : null;
  const hint = el('div', { class: 'town-hint-bar' });

  // RUN21D-3 — the landmark dots. Outdoors only: a Boo House room is 1.5 viewports and its
  // room tabs already say what else there is. Each dot is a 44px button (house tap-target
  // floor) around a 12px pip, named after what is on that screen, and it PANS rather than
  // jumping so the four screens read as one continuous place.
  const DOT_NAMES = isInterior ? null : (LANDMARK_DOTS[AREA.key] || null);
  const dotTargetX = (i) => ((DOT_TARGET_OVERRIDE[AREA.key] || {})[i] != null
    ? DOT_TARGET_OVERRIDE[AREA.key][i]
    : DOT_SCREEN_X[i]);
  const dotBtns = DOT_NAMES ? DOT_NAMES.map((name, i) => el('button', {
    class: 't-dot', type: 'button', 'aria-label': name, dataset: { dot: String(i) },
    onclick: () => { sfx.tap(); cameraClaimed = true; panToFrac(dotTargetX(i), DOT_PAN_MS); updateDots(); }
  }, [el('i', { class: 't-dot-pip', 'aria-hidden': 'true' })])) : null;
  const dots = dotBtns ? el('nav', { class: 't-dots' }, dotBtns) : null;
  // Which dot is she looking at? Whichever one's landing this camera is nearest to — for
  // the twenty-three evenly-spaced dots that is exactly "the current screen, from scrollX",
  // and it stays right for the funfair's bandstand dot too.
  function updateDots() {
    if (!dotBtns || !zoneW) return;
    const centre = (scrollX + viewW / 2) / zoneW;
    let best = 0;
    for (let i = 1; i < dotBtns.length; i++) {
      if (Math.abs(dotTargetX(i) - centre) < Math.abs(dotTargetX(best) - centre)) best = i;
    }
    dotBtns.forEach((b, i) => {
      b.classList.toggle('sel', i === best);
      if (i === best) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }
  // The edge shimmer: once per visit, whichever edge has town beyond it gets a soft sweep —
  // the same gradient language the rarity shimmer uses. It says "there is more that way"
  // without a word, and it never repeats within the visit.
  function edgeShimmerOnce() {
    if (isInterior || REDUCED || areaSeen.edge) return;
    if (worldW <= viewW + 8) return;
    areaSeen.edge = true;
    for (const side of ['left', 'right']) {
      const more = side === 'right' ? scrollX < worldW - viewW - 8 : scrollX > 8;
      if (!more) continue;
      const n = el('i', { class: 't-edge-shim ' + side, 'aria-hidden': 'true' });
      viewport.appendChild(n);
      setTimeout(() => { try { n.remove(); } catch {} }, EDGE_SHIM_MS);
    }
  }

  const sky = el('div', { class: 't-layer t-sky' });
  const hills = el('div', { class: 't-layer t-hills' });
  const ground = el('div', { class: 't-layer t-ground' });
  const air = el('div', { class: 't-layer t-air' });   // fireflies / butterflies
  const buildGrid = el('div', { class: 't-build-grid' });
  air.appendChild(buildGrid);   // never cleared by renderScenery/renderPlaced, like the drop-ghost
  const viewport = el('div', { class: 't-viewport' }, [sky, hills, ground, air]);

  // RUN21C-1: the Paths | Erase tool row is GONE, and with it the last thing that needed a
  // mode to reach. Painting is the Path Pot chip in the Landscape tab (item 2); scrubbing is
  // painting over what is already there, which is what the eraser always really was.
  //
  // The path-style row survives as the strip that docks above the drawer while the Pot is
  // held (item 2 wires it; item 4 fills it from the shop).
  let styleBtns = [];
  const pathStyleRow = el('div', { class: 't-path-style-row', role: 'group', 'aria-label': 'Path styles' });
  pathStyleRow.addEventListener('pointerdown', e => e.stopPropagation());
  pathStyleRow.style.display = 'none';
  viewport.append(pathStyleRow);

  // Town drawer (RUN10 P2): js/drawer.js tabs. DRAWER_TABS_SPEC below is the list — Boos,
  // Rides & fun, Decorations, Furniture (RUN13 T4), Special, Landscape (RUN10 P3, hidden
  // outside build mode), Wishes (RUN20 W1) and Decorate (RUN19 Z6, rooms only). Which of
  // them are visible depends on indoors/outdoors and build mode; see updateBuildUI().
  // `item.act` (catalogue.js) marks the playground/activity decos; ultra-rarity decos are
  // the "Special" showpieces.
  const DRAWER_TABS_SPEC = [
    { id: 'boos', label: 'Boos', test: (it) => it.kind === 'boo' },
    { id: 'rides', label: 'Rides & fun', test: (it) => it.kind === 'deco' && !!it.act },
    { id: 'deco', label: 'Decorations', test: (it) => it.kind === 'deco' && !it.act && it.rarity !== 'ultra' },
    { id: 'furniture', label: 'Furniture', test: (it) => it.kind === 'furniture' },
    { id: 'special', label: 'Special', test: (it) => it.kind === 'deco' && !it.act && it.rarity === 'ultra' },
    { id: 'landscape', label: 'Landscape', test: (it) => it.kind === 'landscape' },
    { id: 'wishes', label: 'Wishes', test: (it) => it.kind === 'wish' },
    // RUN19 Z6: not an item tab at all — it holds the room's wallpaper and floor swatches, so
    // its `test` never matches anything and renderDrawer leaves its strip alone.
    { id: 'decorate', label: 'Decorate', test: () => false }
  ];
  const drawerStrips = {};
  const drawerTabsNodes = DRAWER_TABS_SPEC.map(spec => {
    const strip = el('div', { class: 'town-drawer-strip' });
    attachStripMomentum(strip);
    drawerStrips[spec.id] = strip;
    return { id: spec.id, label: spec.label, node: strip };
  });
  const drawerApi = createDrawer({
    tabs: drawerTabsNodes, initial: 0, ariaLabel: 'Town items',
    // RUN21A-2: the decorate strip re-renders whenever its tab is picked — it used to be
    // populated only by the hammer toggle, so fresh rooms showed a bare "Nothing here yet!".
    onTab: (id) => { if (id === 'decorate') renderDecorateTab(); },
    // RUN21C-1: opening the tray IS the "I am arranging" signal now. The world softens with
    // it and wakes the moment it shuts with nothing on her finger.
    onOpen: () => updateSoftened()
  });
  const drawer = drawerApi.root;   // kept as `drawer` — existing wobble/capacity-tint code targets it
  drawer.classList.add('town-drawer');   // scope the .taken shake CSS to this drawer instance
  updateDrawerTabs();   // which tabs this area shows at all (outdoor/indoor/wishes)
  renderDecorateTab();   // RUN21A-2: populated at mount too, not only via the hammer
  root.append(header, ...(dots ? [dots] : []), hint, ...(roomTabs ? [roomTabs] : []), viewport, drawer);
  container.appendChild(root);

  // Day / night tint.
  const night = isNight(currentHour());
  root.classList.toggle('night', night);

  // Entry crossfade (P1): the map badge scales up into this scene, 300ms.
  requestAnimationFrame(() => { requestAnimationFrame(() => root.classList.remove('entering')); });

  // The Boo House starts with a rug + table lamp pre-placed (RUN10 P4) — a one-time seed,
  // not a grant (they aren't added to inventory, so they don't count as "collected" until
  // she wins her own copy from a box).
  if (STORE_KEY === 'boohouse' && !((getState().seen || {}).boohouseSeeded)) {
    mutate(st => {
      st.seen = st.seen || {};
      st.seen.boohouseSeeded = true;
      const items = areaItems(st);
      items.push({ id: nextPlacementId(st), zone: 'boohouse', x: 0.36, row: 1, item: 'deco_rug', scale: 1.2 });
      items.push({ id: nextPlacementId(st), zone: 'boohouse', x: 0.64, row: 1, item: 'deco_tablelamp', scale: 1 });
    });
  }
  // The Meadow begins with one permanent magic landmark. If it is put away, the
  // same well remains available in Build → Landscape.
  if (AREA.key === 'meadow' && !((getState().seen || {}).wishWellSeeded)) {
    mutate(st => {
      st.seen = st.seen || {};
      const items = areaItems(st);
      // A gift landmark must not silently push an already-full legacy Meadow over
      // its capacity. It remains available from Build → Landscape in that case.
      // (RUN18A H3: the seeded flag moved BELOW the push for the same reason as the Joke
      // Boo stage below — set here, a full Meadow burned it and the well never arrived.)
      if (items.length >= AREA_CAP) return;
      const candidates = [.12, .24, .36, .48, .60, .72, .84, .92];
      const rows = [1, 0, 2];
      let position = null;
      for (const row of rows) {
        const x = candidates.find(candidate =>
          items.every(placed => placed.row !== row || Math.abs((placed.x || 0) - candidate) >= .09));
        if (x != null) { position = { x, row }; break; }
      }
      position ||= { x:.92, row:0 };
      items.push({ id: nextPlacementId(st), zone:'meadow', ...position, item:'deco_wishwell', scale:1.1 });
      st.seen.wishWellSeeded = true;
    });
  }
  // RUN17 X1: the Joke Boo's stage, on the same terms as the well above — a gift landmark
  // that never displaces anything, and stays in Build → Landscape if she puts it away.
  if (AREA.key === 'meadow' && !((getState().seen || {}).jokeStageSeeded)) {
    mutate(st => {
      st.seen = st.seen || {};
      // THE FLAG IS SET ONLY ONCE THE STAGE IS ACTUALLY PLACED (RUN18A H3). It used to be
      // set here, at the top — so a Meadow that was full, or that had no free spot on any
      // row, took both early returns below with the flag already burned and NEVER seeded
      // the stage again, on any later visit. Reproduced: a 24-item Meadow (AREA_CAP) ends
      // with `jokeStageSeeded: true` and no stage, permanently. Putting it away herself is
      // a different thing and still ends the seeding, as intended — that is a placement
      // that happened.
      const items = areaItems(st);
      if (items.length >= AREA_CAP) return;
      const candidates = [.20, .32, .44, .56, .68, .80, .88, .10];
      const rows = [1, 2, 0];
      let position = null;
      for (const row of rows) {
        const x = candidates.find(candidate =>
          items.every(placed => placed.row !== row || Math.abs((placed.x || 0) - candidate) >= .09));
        if (x != null) { position = { x, row }; break; }
      }
      if (!position) return;   // a full Meadow keeps it in the Build drawer instead
      items.push({ id: nextPlacementId(st), zone:'meadow', ...position, item:'deco_jokestage', scale:1.05 });
      st.seen.jokeStageSeeded = true;
    });
  }

  requestAnimationFrame(() => {
    layout(); renderDrawer(); updateHint(); startLoop();
    // RUN18B Y2: the shop's handoff. She has just bought a thing and said "take me
    // there", so she arrives with the tray already open on that item's own drawer tab — no
    // hunting through six tabs. Selected, not held on the finger: the pack is explicit that
    // selection is enough. (RUN21C-1: `params.build` no longer names a mode — it opens the
    // tray, which is all it ever meant.)
    if (params && params.build) {
      drawerApi.open();
      const held = params.place && resolveItem(params.place);
      if (held) {
        const spec = DRAWER_TABS_SPEC.find(t => t.test(held));
        if (spec) drawerApi.showTab(spec.id);
        holding = params.place;
        placeMode = true;
        renderDrawer(); updateHint();
      }
    }
    // RUN21C-4: she has just bought a path style and said "take me there". Arrive with the
    // Path Pot in her hand and the new style already picked — the announced moment for a
    // thing that is not an object is being able to draw with it at once.
    if (params && params.pot && AREA.kind === 'outdoor') {
      liftPot();
      const sd = PATH_STYLES.find(x => x.id === params.pot);
      if (sd && ownsStyle(sd)) { pathStyle = sd.id; styleBtns.forEach(b => b.classList.toggle('sel', b.dataset.style === sd.id)); }
    }
    if (params && params.enterPan) setTimeout(() => panAcrossZone(0, 1600), REDUCED ? 0 : 200);
    if (params && params.openWishWell) setTimeout(() => openWellHere(), 350);
    // Growth milestones (RUN4 C6): spawn/queue sites, and if the Builders
    // finished while she was away, the next town open plays the reveal.
    const gt = tickGrowth();
    if (!gt.readyToReveal && gt.spawned.length) renderPlaced();   // a fresh site fence appears
    // Funfair rides via the Boo Builders (RUN6 C1b): reveal a finished ride, else render the
    // (always-open, RUN7 C1) fair so its day-one Carousel/scenery/bandstand show on the first mount.
    const ft = tickFunfair();
    if (!ft.readyToReveal) renderFunfair();
    // RUN21A-16: the rides COMPLETE on whichever tick finds them (that is the fix — no four
    // queued days), but the combined celebration waits for the fair itself, which is what
    // the pack's ACCEPT asks for ("first FAIR mount") and what the announced-moments law
    // needs: a headline about the fair, in the Meadow, gives her nowhere to look. It keeps
    // in `funfair.catchup` until she walks in.
    const showCatchUp = ft.catchUp && AREA.key === 'funfair';
    // RUN21A-8: ONE reveal at a time. The two reveals used to be scheduled independently
    // (+700ms and +900ms) and stacked their overlays; now one timer enqueues growth then
    // funfair and the queue shows the next only when the child dismisses the first.
    if (gt.readyToReveal || ft.readyToReveal || showCatchUp) {
      setTimeout(() => {
        if (gt.readyToReveal) enqueueReveal(done => playGrowthReveal(gt.readyToReveal, done));
        if (showCatchUp) enqueueReveal(done => playFairCatchupReveal(ft.catchUp, done));   // RUN21A-16
        if (ft.readyToReveal) enqueueReveal(done => playFunfairReveal(ft.readyToReveal, done));
      }, REDUCED ? 100 : 700);
    }
    edgeShimmerOnce();   // RUN21D-3: "there is more that way", once per visit
    // RUN21D-1: the town's one guaranteed opening breath. Last, so everything it can choose
    // from (placed items, actors, the fair, request bubbles) is already on screen.
    startPulse();
  });
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  // ---- layout / render ----------------------------------------------------
  let cameraRestored = false;   // RUN13 T3: this room's saved camera is restored once, on first layout
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
    // RUN13 T3: restore this room's own camera the first time it lays out.
    // RUN21A-9: widened from rooms to EVERY area — a mini-app round trip (shop, Joke Boo)
    // used to reset an outdoor area to screen 1. Session memory only, never the save.
    if (!cameraRestored) {
      cameraRestored = true;
      const saved = roomScroll.get(STORE_KEY);
      if (saved != null) scrollX = saved;
    }
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
  // ---- RUN21C-3: STROKES, NOT TILES ------------------------------------------------------
  // The DATA is untouched — still `paths:[{cx,cy,style}]`, still capped at PATH_CAP. What
  // changed is only what those cells LOOK like: adjacent same-style cells in a row merge into
  // ONE rounded stroke instead of a line of little squares, so a path she draws reads as a
  // path rather than as pixel art.
  //
  // DEVIATION from the pack's mechanism (logged in RUN21C-PROGRESS.md): the pack asks for a
  // "quarter-round join patch" where a cell has a vertical neighbour. A quarter-round cannot
  // fill the notch between two rounded strokes without exposing its own rounding on the other
  // side. What DOES produce the curved corner the ACCEPT asks for is a VERTICAL run drawn
  // with the same radius: at a turn its rounded corner lands exactly on the horizontal run's,
  // so the two read as one stroke bending round a corner. Same idea, correct geometry.
  const PATH_ROUND = 0.45;   // "radius = 45% cell height" — for every run, horizontal or vertical
  // Maximal spans of adjacent same-style cells. `axis` picks which way: 'h' walks cx within a
  // row, 'v' walks cy within a column. Both return {style, fixed, a, b} (a..b inclusive).
  function pathSpans(cells, axis) {
    const groups = new Map();
    for (const c of cells) {
      const fixed = axis === 'h' ? c.cy : c.cx;
      const k = c.style + '|' + fixed;
      if (!groups.has(k)) groups.set(k, { style: c.style, fixed, list: [] });
      groups.get(k).list.push(axis === 'h' ? c.cx : c.cy);
    }
    const out = [];
    for (const g of groups.values()) {
      g.list.sort((p, q) => p - q);
      let start = g.list[0], prev = g.list[0];
      for (let i = 1; i <= g.list.length; i++) {
        const n = g.list[i];
        if (n === prev + 1) { prev = n; continue; }
        out.push({ style: g.style, fixed: g.fixed, a: start, b: prev });
        start = prev = n;
      }
    }
    return out;
  }
  // A vertical span of ONE cell is already drawn by its row's stroke, so it is skipped —
  // that keeps the node count at roughly "one per stroke" rather than one per cell.
  function pathRunEls(cells) {
    const { bandTopPx, cellW, cellH } = cellGeom();
    const r = (cellH * PATH_ROUND).toFixed(1) + 'px';
    const out = [];
    for (const s of pathSpans(cells, 'h')) {
      const e = el('div', { class: 't-path-run path-' + s.style, dataset: { row: String(s.fixed), style: s.style } });
      e.style.left = (s.a * cellW) + 'px';
      e.style.top = (bandTopPx + s.fixed * cellH) + 'px';
      e.style.width = Math.ceil((s.b - s.a + 1) * cellW) + 'px';
      e.style.height = Math.ceil(cellH) + 'px';
      e.style.borderRadius = r;
      out.push(e);
    }
    for (const s of pathSpans(cells, 'v')) {
      if (s.b === s.a) continue;
      const e = el('div', { class: 't-path-run t-path-join path-' + s.style, dataset: { col: String(s.fixed), style: s.style } });
      e.style.left = (s.fixed * cellW) + 'px';
      e.style.top = (bandTopPx + s.a * cellH) + 'px';
      e.style.width = Math.ceil(cellW) + 'px';
      e.style.height = Math.ceil((s.b - s.a + 1) * cellH) + 'px';
      e.style.borderRadius = r;
      out.push(e);
    }
    return out;
  }
  // The saved list while not actively editing, or the in-memory batch while the Path Pot
  // holds one (RUN10 P3: painting doesn't hit the save on every cell — see commitPaths).
  function currentPaths() {
    if (pendingPaths) return pendingPaths;
    const a = getState().town.areas[STORE_KEY];
    return (a && a.paths) || [];
  }
  function renderPaths() {
    ground.querySelectorAll('.t-path-run').forEach(n => n.remove());
    const frag = document.createDocumentFragment();
    for (const e of pathRunEls(currentPaths())) frag.appendChild(e);
    ground.appendChild(frag);
  }
  // Only the runs a changed cell can possibly belong to. Painting (cx,cy) can only split,
  // merge, extend or restyle a stroke in ROW cy or in COLUMN cx — every other stroke on the
  // ground is still exactly right, so it is left alone. That is the pack's "rebuild only the
  // runs containing a changed cell", and it is what keeps a fast drag at frame rate.
  function redrawPathCell(cx, cy) {
    ground.querySelectorAll(`.t-path-run[data-row="${cy}"], .t-path-run[data-col="${cx}"]`).forEach(n => n.remove());
    const cells = currentPaths();
    const frag = document.createDocumentFragment();
    for (const e of pathRunEls(cells.filter(c => c.cy === cy))) { if (e.dataset.row != null) frag.appendChild(e); }
    for (const e of pathRunEls(cells.filter(c => c.cx === cx))) { if (e.dataset.col != null) frag.appendChild(e); }
    ground.appendChild(frag);
  }
  function loadPendingPaths() {
    const a = getState().town.areas[STORE_KEY];
    pendingPaths = a && Array.isArray(a.paths) ? a.paths.slice() : [];
    // RUN21C-7: what the ground looked like before this stretch of painting.
    lastCommittedPaths = pendingPaths.map(c => ({ ...c }));
  }
  // Flushes the in-memory batch to the save. Also the setInterval(commitPaths, 10000)
  // callback itself — must NOT touch pathCommitTimer, or the first auto-commit would
  // cancel its own repeat and every commit after it would silently stop happening.
  function commitPaths() {
    if (!pendingPaths) return;
    const toSave = pendingPaths;
    mutate(st => { areaItems(st); st.town.areas[STORE_KEY].paths = toSave.slice(); });
    // RUN21C-7: one undo step per COMMIT, not per cell — "path-commit" in the pack. A ten-
    // second stretch of painting takes one tap to take back, which is the granularity a
    // child means by "undo", and a commit that changed nothing records nothing.
    const prev = lastCommittedPaths || [];
    if (JSON.stringify(prev) !== JSON.stringify(toSave)) {
      pushUndo('paths', prev, toSave.map(c => ({ ...c })));
      lastCommittedPaths = toSave.map(c => ({ ...c }));
    }
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
    if (!pendingPaths) loadPendingPaths();
    const i = pendingPaths.findIndex(c => c.cx === cx && c.cy === cy);
    // RUN21C-1: the Erase tool is gone. Scrubbing IS painting the same style over itself —
    // the toggle below, which the paths tool has always had and which is the eraser a child
    // discovers by accident and then uses on purpose.
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
  // RUN21C-2: ONE action per cell per stroke. paintCell is a toggle (same style over the
  // same cell scrubs it), and a finger crossing a cell fires pointermove many times inside
  // it — so without this a slow drag laid a cell and immediately swept it away again, over
  // and over. The old Erase tool hid the problem by being a separate one-way tool; now that
  // scrubbing IS the eraser, the stroke has to remember where it has already been.
  let strokeSeen = null;
  function beginStroke() { strokeSeen = new Set(); }
  function endStroke() { strokeSeen = null; }
  function paintAtClient(cx, cy) {
    const cell = cellAtClient(cx, cy);
    if (!cell.inBand) return;
    if (strokeSeen) {
      const key = cell.cx + ':' + cell.cy;
      if (strokeSeen.has(key)) return;
      strokeSeen.add(key);
    }
    paintCell(cell.cx, cell.cy);
  }

  // ---- RUN21C-1: the softened world ----------------------------------------------------
  // The one place that decides whether the town is arranging or living. Called whenever the
  // drawer opens or shuts, whenever something is picked up or put down, and whenever the Pot
  // is lifted or put away. Nothing else may set `softened`.
  function worldSoftened() { return drawerApi.isOpen() || !!holding || potHeld; }
  function updateSoftened() {
    const next = worldSoftened();
    if (next === softened) return;
    softened = next;
    // `.building` is the freeze contract in styles.css (paused CSS animations + the 250ms
    // ease that lands the last pose instead of cutting it). Kept by name on purpose.
    root.classList.toggle('building', softened);
    renderRequestBubble();   // bubbles vanish while soft, and come back when she is done
  }
  // RUN21C-4: a free style, or one she has bought. `inventory` is the whole record of
  // ownership — no new save key, no VERSION bump.
  const ownsStyle = (sd) => !sd.sku || ((getState().inventory || {})[sd.sku] || 0) > 0;
  function selectPathStyle(id) {
    const sd = PATH_STYLES.find(x => x.id === id);
    if (sd && !ownsStyle(sd)) return goShopForStyle(sd);
    sfx.tap();
    pathStyle = id;
    styleBtns.forEach(b => b.classList.toggle('sel', b.dataset.style === id));
  }
  // A locked chip is a door, not a wall (RUN21A item 9's pattern): it takes her to the shelf
  // that sells it, with the card ringed, and Back brings her straight back to this area.
  function goShopForStyle(sd) {
    sfx.tap();
    const price = priceOf(sd.sku);
    ctx.go('shop', {
      from: 'town', fromArea: AREA.key, ...(ROOM ? { fromRoom: roomId } : {}),
      shelf: (price && price.shelf) || 'town', highlight: sd.sku
    });
  }
  // The docked style row, rebuilt each time the Pot is lifted so a style bought since the
  // last lift is simply there.
  function renderPathStyleRow() {
    clear(pathStyleRow);
    styleBtns = PATH_STYLES.map(sd => {
      const owned = ownsStyle(sd);
      const price = sd.sku ? priceOf(sd.sku) : null;
      const cost = price ? price.cost : null;
      return el('button', {
        class: 't-tool-btn t-style-btn' + (pathStyle === sd.id ? ' sel' : '') + (owned ? '' : ' locked'),
        type: 'button', dataset: { style: sd.id },
        'aria-label': owned ? sd.title : `${sd.title} — ${cost} maths stars in the shop`,
        onclick: () => selectPathStyle(sd.id)
      }, [
        el('span', { class: 'tool-ic', text: sd.label }),
        el('span', { class: 'tool-lbl', text: sd.title }),
        owned ? null : el('span', { class: 'style-lock', text: `🔒 ${cost}★` })
      ]);
    });
    styleBtns.forEach(b => pathStyleRow.appendChild(b));
  }

  // ---- RUN21C-2: the Path Pot -----------------------------------------------------------
  // Painting is a thing she picks up now, not a mode she enters. The Pot is the permanent
  // first chip in Landscape; lifting it opens the same painting session build mode used to
  // (loadPendingPaths + the 10s auto-commit), docks the style row above the drawer, and turns
  // a drag along the ground band into paintCell calls. Putting it down commits. NOTHING about
  // the path DATA changes — `paths:[{cx,cy,style}]` and PATH_CAP are exactly as they were.
  const potChip = () => el('button', {
    class: 'drawer-item path-pot' + (potHeld ? ' holding' : ''), dataset: { item: PATH_POT_ID },
    'aria-label': potHeld ? 'Put the Path Pot away' : 'Path Pot — lay a path',
    onclick: () => togglePot()
  }, [
    el('div', { class: 'drawer-art', html: renderPathPot({ size: 60 }) }),
    el('span', { class: 'drawer-name', text: 'Path Pot' })
  ]);
  function togglePot() { potHeld ? putPotAway() : liftPot(); }
  function liftPot() {
    if (potHeld) return;
    sfx.tap();
    holding = null; placeMode = false;   // one thing on her finger at a time
    potHeld = true;
    loadPendingPaths();
    if (!pathCommitTimer) pathCommitTimer = setInterval(commitPaths, 10000);   // "every 10s" (RUN10 P3)
    renderPathStyleRow();
    pathStyleRow.style.display = '';
    root.classList.add('painting');   // the 5% grid appears — it is a paint grid, so it comes with the brush
    renderDrawer(); updateHint(); updateSoftened();
    // Same handoff as selectHold: the tray closes so she can reach the ground, and it is NOT
    // shielded, because her very next gesture is the stroke (RUN21A-10).
    drawerApi.close({ shield: false });
  }
  function putPotAway() {
    if (!potHeld) return;
    sfx.tap();
    potHeld = false; painting = false;
    if (pathCommitTimer) { clearInterval(pathCommitTimer); pathCommitTimer = null; }
    commitPaths();
    pendingPaths = null;
    pathStyleRow.style.display = 'none';
    root.classList.remove('painting');
    renderPaths();   // back onto the saved list — identical content, one source of truth
    renderDrawer(); updateHint(); updateSoftened();
  }
  // Released over the drawer (open tray or collapsed handle) = put it away.
  function overDrawer(cx, cy) {
    const boxes = [drawer, drawer.querySelector('.bd-tray'), drawer.querySelector('.bd-collapsed')]
      .filter(Boolean).map(n => n.getBoundingClientRect()).filter(b => b.width > 0 && b.height > 0);
    return boxes.some(b => cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom);
  }
  function updateDrawerTabs() {
    // Landscape is an outdoor-only toybox (RUN10 P3/P4). RUN21A-15: no longer hidden
    // behind the hammer — chip-lift placement has always worked in play mode.
    const tabs = [...drawer.querySelectorAll('.bd-tabs .bd-tab')];
    const landscapeVisible = AREA.kind === 'outdoor';
    const landscapeTabBtn = tabs[DRAWER_TABS_SPEC.findIndex(spec => spec.id === 'landscape')];
    if (landscapeTabBtn) landscapeTabBtn.style.display = landscapeVisible ? '' : 'none';
    if (!landscapeVisible && drawerApi.activeTab() === 'landscape') drawerApi.showTab('deco');
    // RUN20 W1: the Wishes tab is no longer outdoors-only — most wishes place in a room now.
    // RUN21A-15: nor behind the hammer — any unlocked wish shows the tab.
    const wishesVisible = Object.keys(((getState().wishes || {}).unlocked) || {}).length > 0;
    const wishesTabBtn = tabs[DRAWER_TABS_SPEC.findIndex(spec => spec.id === 'wishes')];
    if (wishesTabBtn) wishesTabBtn.style.display = wishesVisible ? '' : 'none';
    if (!wishesVisible && drawerApi.activeTab() === 'wishes') drawerApi.showTab('deco');
    const furnitureVisible = AREA.kind === 'interior';
    const furnitureTabBtn = tabs[DRAWER_TABS_SPEC.findIndex(spec => spec.id === 'furniture')];
    const decorateTabBtn = tabs[DRAWER_TABS_SPEC.findIndex(spec => spec.id === 'decorate')];   // RUN19 Z6
    if (furnitureTabBtn) furnitureTabBtn.style.display = furnitureVisible ? '' : 'none';
    // RUN19 Z6: Decorate is a ROOM thing — there is no wallpaper in the Meadow.
    if (decorateTabBtn) decorateTabBtn.style.display = (isInterior && ROOM) ? '' : 'none';
    if (!furnitureVisible && drawerApi.activeTab() === 'furniture') drawerApi.showTab('deco');
  }

  function renderScenery() {
    clear(sky); clear(hills); clear(ground);
    if (isInterior) { renderInteriorScenery(); renderPaths(); return; }
    // sky: gradient by device time (RUN13B T8: dawn/day/dusk/night bands, same bands as
    // the house windows) + a sun or moon disc traversing + a scatter of stars (night only).
    const hourNow = currentHour();
    const bandName = skyBandName(hourNow);
    sky.appendChild(el('div', { class: 't-skygrad ' + bandName }));
    const isMoon = bandName === 'night';
    // the disc's arc: sun crosses 05:00→18:59, moon 19:00→04:59, high at mid-arc
    const frac = Math.max(0.04, Math.min(0.96, isMoon ? (((hourNow - 19) + 24) % 24) / 10 : (hourNow - 5) / 14));
    const disc = el('div', { class: isMoon ? 't-moondisc' : 't-sundisc', 'aria-hidden': 'true' });
    disc.style.left = (6 + frac * 84) + '%';
    disc.style.top = (10 + Math.pow(2 * frac - 1, 2) * 26) + '%';
    sky.appendChild(disc);
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
    // RUN10 P17: while a caper is open every outdoor area wears one silly signpost; the
    // unmasking sweep closes the caper, so the signs revert on the next render.
    const caperText = getState().caper && getState().caper.open && CAPER_SIGNS[AREA.key];
    if (caperText) {
      const sign = el('div', { class: 'caper-town-sign', text: caperText });
      sign.style.left = (zoneW * .5) + 'px'; sign.style.top = (groundY - 56) + 'px';
      ground.appendChild(sign);
    }
    // RUN15 V4: the Boo Shop's market stall, a permanent fixture of the Meadow. It is not
    // placeable, not buyable and never in the way — a door, drawn where a door should be.
    if (AREA.key === 'meadow') {
      const stallX = zoneW * 0.42;
      const stall = el('button', {
        class: 't-shop-stall', 'aria-label': 'Go to the Boo Shop',
        html: shopStallSVG(), onclick: (e) => { e.stopPropagation(); sfx.tap(); ctx.go('shop', { from: 'town', fromArea: AREA.key }); }   // RUN21A-9
      });
      stall.style.left = stallX + 'px';
      stall.style.top = (groundY - 118) + 'px';
      ground.appendChild(stall);
    }
    // RUN10 P21: at dusk an UNOWNED Boo wanders the far background. Pure scenery — one tap
    // gives one giggle and one sparkle, and never anything else.
    const visitor = duskVisitor(AREA.key, currentHour());
    if (visitor && visitor.area === AREA.key && BY_ID[visitor.id]) {
      // The visitor is a BUTTON with nothing but art inside it, so a screen reader announced
      // it as "button" and nothing else. It only exists between dusk and dark, which is why
      // it took until a run that happened to gate at dusk to surface (RUN18C, on sight).
      const visitorNode = el('button', { class: 'dusk-visitor', 'aria-label': `${BY_ID[visitor.id].name} is visiting — say hello!`, html: renderItem(BY_ID[visitor.id], { size: 58 }), onclick: () => {
        if (tapDuskVisitor()) { sfx.pop(); const spark = el('span', { text: '✨' }); visitorNode.appendChild(spark); setTimeout(() => spark.remove(), 700); }
      } });
      visitorNode.style.left = (zoneW * .9) + 'px'; visitorNode.style.top = (groundY - 82) + 'px';
      ground.appendChild(visitorNode);
    }
  }

  // Room backdrop (RUN10 P4, rebuilt RUN13B T7): a wall band (top 55%) + a floor band, no
  // sky/hills/signpost — the Boo House is always unlocked and is never a "place to
  // discover", it's home. T7: each room owns its wall treatment, floor and FIXED built-ins
  // (part of the backdrop, drawn in the hills layer so every placed item paints over them).
  // The acceptance test is a screenshot a child could label unprompted: "that's the kitchen!"
  function renderInteriorScenery() {
    const wallH = viewH * INTERIOR_WALL_FRAC;
    const rid = roomId || 'lounge';
    const hour = currentHour();
    const wall = el('div', { class: 't-interior-wall room-' + rid });
    wall.style.width = worldW + 'px'; wall.style.height = wallH + 'px';
    hills.appendChild(wall);
    // Fixed built-ins: fireplace/windows/sink/shelf/fairy lights per room, all inline SVG
    // sticker style. They live BEHIND the placement rows by construction (hills < ground).
    const builtins = el('div', { class: 't-room-builtins', 'aria-hidden': 'true', html: roomBuiltinsHTML(rid, worldW, wallH, viewH, hour) });
    hills.appendChild(builtins);
    const skirting = el('div', { class: 't-interior-skirting room-' + rid, 'aria-hidden': 'true' });
    skirting.style.top = (wallH - 7) + 'px';
    skirting.style.width = worldW + 'px';
    hills.appendChild(skirting);
    const floor = el('div', { class: 't-interior-floor room-' + rid });
    floor.style.left = '0'; floor.style.top = wallH + 'px';
    floor.style.width = worldW + 'px'; floor.style.height = (viewH - wallH) + 'px';
    ground.appendChild(floor);
    // RUN19 Z6: her chosen wallpaper and floor go in FIRST, behind the built-ins and the
    // skirting, so a new wallpaper never covers the window or the fireplace.
    renderDressings();
  }

  // RUN13 T4 — the photo frame shows a REAL Boo she owns. The best friend wins when there
  // is one (and the frame changes the moment that changes, because this is recomputed on
  // every render); otherwise it settles on one owned Boo, chosen from the placement's own
  // x so the same frame on the wall always shows the same face rather than flickering
  // through the collection every re-render.
  function photoBooFor(t, st) {
    const inv = st.inventory || {};
    const owned = Object.keys(inv)
      .filter(id => (id.startsWith('boo_') || id.startsWith('custom:')) && inv[id] > 0)
      .sort();
    if (!owned.length) return null;
    const bff = owned.find(id => isBestFriend(id, st));
    if (bff) return bff;
    return owned[Math.abs(Math.round(t.x * 1000)) % owned.length];
  }
  function renderPhotoFrame(booId, size) {
    const frame = renderDeco(BY_ID.deco_photoframe, { size });
    const boo = booId ? resolveItem(booId) : null;
    const art = boo ? renderItem(boo, { size: size * 0.42, equipArt: equippedArt(booId) }) : '';
    return `<span class="t-photo-frame" data-photo-boo="${booId || ''}">${frame}<span class="t-photo-inner">${art}</span></span>`;
  }

  // ---- a bubble over a placed thing, kept ON SCREEN ---------------------------------------
  // Eight call sites were each doing `el('div',{class:'catchphrase-bubble'})` + append + remove,
  // and none of them checked whether the result fitted. A bubble is centred on its item and can
  // be up to 180px wide, so anything near the edge of the visible window had its words cut in
  // half — and RUN19 made these bubbles far more common (seat claims, thank-yous, wish lines)
  // than the occasional catchphrase they were built for. Same nudge openMenu already does.
  function sayOver(wrap, text, ms = 2400, { speak = true } = {}) {
    if (!wrap || !text) return null;
    const bubble = el('div', { class: 'catchphrase-bubble', text });
    wrap.appendChild(bubble);
    if (speak) speakMaybe(text);
    // Clamped REPEATEDLY, not once: the town scrolls, and a bubble measured at the moment it
    // appeared drifts back off the edge as soon as the scene pans. Recomputed from zero each
    // time so it is idempotent rather than accumulating nudges.
    const clamp = () => {
      if (!bubble.isConnected) return;
      bubble.style.marginLeft = '0px';
      const r = bubble.getBoundingClientRect(), v = viewport.getBoundingClientRect();
      let dx = 0;
      if (r.left < v.left + 6) dx = (v.left + 6) - r.left;
      else if (r.right > v.right - 6) dx = (v.right - 6) - r.right;
      bubble.style.marginLeft = dx + 'px';
    };
    requestAnimationFrame(clamp);
    const tick = setInterval(clamp, 200);
    setTimeout(() => { clearInterval(tick); bubble.remove(); }, ms);
    return bubble;
  }

  // ---- RUN20 W2: AREA CHARACTER ----------------------------------------------------------
  // One AMBIENT and one SIGNATURE per area. The ambient runs by itself and asks nothing of her;
  // the signature is a secret she finds by tapping the right part of the scene. Both are capped
  // per area MOUNT (a "visit"), both are transform-only, and reduced motion keeps a static
  // flavour tint rather than removing the area's character altogether.
  //
  // Session flags live in memory, per mount, and are never persisted: whether she has already
  // seen today's train is not something the save should carry forever.
  const areaSeen = { train: false, seed: false, ball: false, edge: false };

  // The ambient: mounted once, then left alone.
  function renderAreaAmbient() {
    viewport.querySelectorAll('.t-ambient').forEach(n => n.remove());
    if (isInterior) {
      // Interiors get their own quiet life and NEVER mount weather (T7's rule, restated here
      // because W2 adds a second reason to be in this code path).
      const room = ROOM ? ROOM.id : null;
      const layer = el('div', { class: 't-ambient amb-room amb-' + (room || 'lounge'), 'aria-hidden': 'true' });
      if (room === 'lounge') layer.appendChild(el('i', { class: 'amb-motes' }));
      if (room === 'kitchen') layer.appendChild(el('i', { class: 'amb-steam' }));
      if (room === 'bedroom') layer.appendChild(el('i', { class: 'amb-nightlight' }));
      viewport.appendChild(layer);
      return;
    }
    const layer = el('div', { class: 't-ambient amb-' + AREA.key, 'aria-hidden': 'true' });
    switch (AREA.key) {
      case 'meadow':     layer.append(el('i', { class: 'amb-grass g1' }), el('i', { class: 'amb-grass g2' }), el('i', { class: 'amb-seed' })); break;
      case 'riverside':  layer.append(el('i', { class: 'amb-shimmer s1' }), el('i', { class: 'amb-shimmer s2' }), el('i', { class: 'amb-ducks' })); break;
      case 'hilltop':    layer.append(el('i', { class: 'amb-leaf' })); break;
      case 'beach':      layer.append(el('i', { class: 'amb-wave' })); break;
      case 'playground': layer.append(el('i', { class: 'amb-strayball' })); break;
      case 'funfair':    layer.append(el('i', { class: 'amb-lights' })); break;
      default: break;
    }
    // The dusk/night bands are when the fair's string lights are worth having.
    if (AREA.key === 'funfair') layer.classList.toggle('amb-dark', ['dusk', 'night'].includes(bandOfHour(currentHour())));
    viewport.appendChild(layer);
  }

  // The signature: a tap on the RIGHT part of the scene, once per visit, with its own beat.
  // Returns true when it fired, so the viewport tap handler knows to stop there.
  function areaSignature(clientX, clientY) {
    if (softened || isInterior) return false;
    const r = viewport.getBoundingClientRect();
    const yFrac = (clientY - r.top) / (r.height || 1);
    const worldX = (clientX - r.left) + scrollX;
    const put = (node, ms) => { air.appendChild(node); setTimeout(() => node.remove(), ms); };
    switch (AREA.key) {
      case 'riverside': {
        // the river band, read off the scene art (riversideScenery draws it at y 30-42%)
        if (yFrac < 0.30 || yFrac > 0.58) return false;
        for (let i = 0; i < 3; i++) {
          const st = el('i', { class: 't-skip', style: { left: (worldX + i * 46) + 'px', top: (r.height * 0.46) + 'px', animationDelay: (i * 160) + 'ms' } });
          put(st, 900 + i * 160);
        }
        if (wishSound.allow('sig:riverside', { tapped: true })) sfx.pop();
        hint.textContent = 'Plop, plop, plop!';
        return true;
      }
      case 'beach': {
        if (yFrac < 0.62) return false;
        // RUN21A-7: prints appear at the tapped height, not a hardcoded mid-beach line
        const fy = Math.min(0.86, Math.max(0.62, yFrac));
        for (let i = 0; i < 3; i++) {
          const f = el('i', { class: 't-footprint', style: { left: (worldX + i * 30) + 'px', top: (r.height * (fy + i * 0.02)) + 'px', animationDelay: (i * 120) + 'ms' } });
          put(f, 4000 + i * 120);
        }
        // RUN21B-6: the sand answers back, the way the river already does. Deliberately no
        // once-per-visit gate — the pack asks for an echo on footprint taps, plural.
        hint.textContent = 'Squish, squish!';
        return true;
      }
      case 'hilltop': {
        if (yFrac > 0.42) return false;
        if (areaSeen.train || REDUCED) return false;   // once per visit; never under reduced motion
        areaSeen.train = true;
        // RUN21B-6: the train is 24px taller now, so it would hang that much lower on the
        // same sightline — take half the growth back to keep it where it always ran.
        const train = el('i', { class: 't-train', style: { top: (r.height * 0.34 - 12) + 'px' } });
        put(train, 4200);
        hint.textContent = 'Choo choo! There goes the little train!';
        if (wishSound.allow('sig:hilltop', { tapped: true })) sfx.chime(4);
        return true;
      }
      case 'meadow': {
        // the flower patch: 8 petals burst, and an owned bee or butterfly flies to it
        const flower = areaItems(getState()).find(t => /flower/.test(t.item));
        if (!flower) return false;
        const fx = (ZONE_INDEX[flower.zone] ?? 0) * zoneW + flower.x * zoneW;
        if (Math.abs(fx - worldX) > 90) return false;
        for (let i = 0; i < 8; i++) put(el('i', { class: 't-petal', style: { left: fx + 'px', top: (r.height * 0.72) + 'px', '--pa': (i * 45) + 'deg' } }), 1200);
        if (wishSound.allow('sig:meadow', { tapped: true })) sfx.pop();
        return true;
      }
      case 'playground': {
        const frame = areaItems(getState()).find(t => /slide|frame|climb/.test(t.item));
        if (!frame) return false;
        const fx2 = (ZONE_INDEX[frame.zone] ?? 0) * zoneW + frame.x * zoneW;
        if (Math.abs(fx2 - worldX) > 90 || yFrac > 0.7) return false;
        for (const a of actors) if (a.role) { const svg = a.wrap.querySelector('svg'); if (svg && !REDUCED) { svg.classList.remove('costume-hearty-wave'); void svg.offsetWidth; svg.classList.add('costume-hearty-wave'); setTimeout(() => svg.classList.remove('costume-hearty-wave'), 1400); } }
        return true;
      }
      case 'funfair': {
        // the popcorn cart: three kernels arc out, and a nearby Boo catches one (a FOOD chomp)
        const cart = ground.querySelector('.ff-scenery-wrap, .ff-consite');
        if (!cart) return false;
        const cr = cart.getBoundingClientRect();
        if (Math.abs((cr.left + cr.width / 2) - clientX) > 100) return false;
        for (let i = 0; i < 3; i++) put(el('i', { class: 't-kernel', style: { left: (worldX + (i - 1) * 14) + 'px', top: (r.height * 0.6) + 'px', animationDelay: (i * 110) + 'ms' } }), 1100 + i * 110);
        if (wishSound.allow('sig:funfair', { tapped: true })) sfx.pop();
        return true;
      }
      default: return false;
    }
  }

  // ---- RUN20 W1: wish life ---------------------------------------------------------------
  // Sixty wished things, nine classes, one table. What lives here is the wiring into THIS
  // scene: which of them anchor in the sky, what a tap does, and the caps that keep a town
  // full of living wishes calm rather than noisy.
  const SKY_WISHES = new Set(['wish_sun', 'wish_star', 'wish_moon', 'wish_cloud', 'wish_rainbow', 'wish_kite']);
  const wishSound = createSoundBudget();
  // Every sky item and the two tethered flyers are OUTDOOR-ONLY: indoors their drawer chip
  // greys with the authored tip rather than letting her place a sun in the kitchen.
  function wishRefusedIndoors(id) { return isInterior && wishNeedsSky(id); }
  // Tapping a chip that already SAYS "needs the sky!" is not a mistake — she is asking what it
  // does. So this is deliberately not the drop-refusal treatment: no oops sound, no shaking the
  // whole drawer, and no repeating the three words already printed under her finger. The chip
  // itself gives a small nudge and the guide names the way forward, because a refusal that
  // never says where "yes" lives is just a closed door.
  function skyChipNudge(chip, name) {
    sfx.tap();
    if (!REDUCED) { chip.classList.remove('sky-nudge'); void chip.offsetWidth; chip.classList.add('sky-nudge'); setTimeout(() => chip.classList.remove('sky-nudge'), 600); }
    const line = `${name} needs the big open sky — take it outside and I'll put it right up!`;
    hint.textContent = line;
    speakMaybe(line);
  }

  // A wish's own idle, applied as a class the CSS animates — transform-only, and every one has
  // a reduced-motion path that renders the static pose and keeps the tap verb.
  function dressWish(wrap, t) {
    const life = wishLife(t.item);
    if (!life) return;
    wrap.classList.toggle('wish-still', REDUCED);
    if (life.cls === 'SKY' && !REDUCED) wrap.style.setProperty('--sky-period', ((life.period || 12000) / 1000) + 's');
    if (life.cls === 'SWAY') wrap.classList.toggle('wish-sway-strong', AREA.key === 'hilltop');
    if (life.bands && !bandAllows(t.item, currentHour())) wrap.classList.add('wish-band-off');
    else wrap.classList.remove('wish-band-off');
  }

  // The tap verb. Returns true when it handled the tap, so onTap can stop there.
  function wishTap(wrap, place, item) {
    const life = wishLife(place.item);
    if (!life) return false;
    const word = wordOfWishId(place.item);
    const key = placementIdOf(place);
    const svg = wrap.querySelector('svg');
    // Each play carries a token, and only the play that started a pose may end it. Without
    // this, tapping the instant a pose finishes lets the OLD cleanup timer (already queued,
    // ~40ms out) strip the class the NEW tap just added — the second tap looks ignored. It
    // only became reachable once RUN21A-5 stopped budget-gating taps, because before that
    // the too-soon tap was refused anyway. (RUN21B, found merging D into B.)
    const playOnce = (cls, ms) => {
      if (REDUCED || !svg) return;
      const token = (svg._playToken = (svg._playToken || 0) + 1);
      svg.classList.remove(cls); void svg.offsetWidth; svg.classList.add(cls);
      setTimeout(() => { if (svg._playToken === token) svg.classList.remove(cls); }, ms + 40);
    };
    const say = (lineKey, scope, vars) => {
      // RUN21A-5: no budget consultation on a tap path — budgets exist to stop the town
      // talking unprompted, never to mute a response to her finger. (`scope` kept for
      // call-site compatibility; it no longer gates anything on taps.)
      if (!lineKey) return;
      const line = guideLine(lineKey, vars || null);
      if (!line) return;
      sayOver(wrap, line, 2600);
    };

    if (life.cls === 'FOOD') { wishFood(wrap, place); return true; }
    if (life.cls === 'GLEAM') { playOnce('wish-glint', 700); if (wishSound.allow(key, { tapped: true })) sfx.chime(); return true; }

    switch (life.verb) {
      case 'launch': {
        // RUN21A-5: a direct tap ALWAYS launches once the last flight has landed — the
        // only guard is in-flight (the airborne class also carries pointer-events:none
        // in CSS, so this JS check is belt-and-braces).
        if (wrap.classList.contains('wish-airborne')) return true;
        wrap.classList.add('wish-airborne');
        playOnce('wish-launch', life.ms + life.backMs);
        if (wishSound.allow(key, { tapped: true })) sfx.whirr();
        // Same token rule as playOnce: only this flight may declare itself landed.
        const flightToken = (wrap._flightToken = (wrap._flightToken || 0) + 1);
        setTimeout(() => { if (wrap._flightToken === flightToken) wrap.classList.remove('wish-airborne'); }, life.ms + life.backMs);
        return true;
      }
      case 'crown': {
        const boos = areaItems(getState()).filter(t => (t.item || '').startsWith('boo_') || (t.item || '').startsWith('custom:')).map(t => ({ id: t.item, x: t.x }));
        const cur = ((getState().delights || {}).crowns || {});
        const already = Object.keys(cur).find(id => cur[id] === todayKeyLocal());
        const pick = crownPick(boos, already);
        if (!pick) { playOnce('wish-wobble', 500); return true; }
        mutate(st => { st.delights = st.delights || {}; st.delights.crowns = { [pick]: todayKeyLocal() }; });
        renderPlaced();
        sayOver(wrap, guideLine('wishRoyal', { booName: getDisplayName(pick) }), 2600);
        if (wishSound.allow(key, { tapped: true })) sfx.star();
        return true;
      }
      case 'band': {
        if (wishSound.allow(key, { tapped: true })) { if (life.band === 'snare') sfx.drum && sfx.drum('snare'); else sfx.guitar && sfx.guitar('C'); }
        playOnce('wish-wobble', 500);
        return true;
      }
      case 'ring': { if (wishSound.allow(key, { tapped: true })) sfx.chime(); playOnce('wish-wobble', 500); return true; }
      case 'lightCone': {
        // the cone is only VISIBLE in the dusk/night bands, and the copy never claims otherwise
        const on = wrap.classList.toggle('wish-lit');
        if (on && !bandAllows(place.item, currentHour())) hint.textContent = 'It will glow when it gets dark!';
        if (wishSound.allow(key, { tapped: true })) sfx.tap();
        return true;
      }
      case 'climb': {
        const tall = tallestNear(areaItems(getState()), place.x, isInterior);
        playOnce('wish-wobble', 900);
        hint.textContent = tall ? 'Up we go!' : 'Nothing to lean on — up two rungs and back down!';
        return true;
      }
      default:
        // the plain verbs: a short pose, a capped line where one is authored, and that is all
        playOnce('wish-' + (life.verb || 'wobble'), life.ms || 700);
        if (life.line) say(life.line, life.lineCap === 'session' ? 'session' : 'visit');
        if (life.sfx && wishSound.allow(key, { tapped: true })) { if (life.sfx === 'chime') sfx.chime(); else sfx.pop(); }
        return true;
    }
  }

  // FOOD: a tap sends the NEAREST Boo trotting over for a chomp, and the item is never consumed.
  // A chef-costumed Boo gets priority and says so. With nobody in the area the item hops and
  // Twiggy whispers once — never a dead tap.
  function wishFood(wrap, place) {
    const boos = areaItems(getState())
      .filter(t => (t.item || '').startsWith('boo_') || (t.item || '').startsWith('custom:'))
      .map(t => ({ id: t.item, x: t.x }));
    const chosen = chooseDiner(boos, place.x, (id) => { const c = costumeFor(id); return c && /chef/.test(c.id || ''); });
    const svg = wrap.querySelector('svg');
    if (!chosen) {
      if (svg && !REDUCED) { svg.classList.remove('wish-hop'); void svg.offsetWidth; svg.classList.add('wish-hop'); setTimeout(() => svg.classList.remove('wish-hop'), 600); }
      // RUN21A-5: her tap always gets the answer, not just the first time this session
      { const line = guideLine('wishFoodNoBoo'); hint.textContent = line; speakMaybe(line); }
      return;
    }
    const a = actors.find(x => x.place && x.place.item === chosen.id);
    if (a) { clearRole(a); a.goal = { kind: 'approach', deco: place, targetDx: (place.x - a.place.x) * zoneW, start: performance.now() }; }
    if (wishSound.allow(placementIdOf(place), { tapped: true })) sfx.chomp();
    if (chosen.chef) {
      const w = [...ground.querySelectorAll('.t-item')].find(n => n.dataset.item === chosen.id);
      if (w) sayOver(w, guideLine('wishChefYum'), 2400);
    }
  }

  // ---- RUN19 Z6: room dressings ---------------------------------------------------------
  // Each Boo House room remembers a wallpaper and a floor. Unset means the room's OWN original
  // palette, which is the free default and stays choosable forever — so a child who buys
  // nothing has a complete room, and one who buys everything can always go back.
  //
  // Applying is free and repeatable: the stars buy the OPTION, never the act of decorating.
  // RUN21A-2: a function declaration (hoisted) — the mount-time renderDecorateTab() call
  // runs before this line, and a const arrow here would still be in its dead zone.
  function roomIdOfArea() { return ROOM ? ROOM.id : null; }
  function dressingApplied(slot) {
    const rid = roomIdOfArea();
    if (!rid) return null;
    const chosen = ((getState().dressings || {})[rid] || {})[slot];
    const fallback = (DEFAULT_DRESSING[rid] || {})[slot];
    return DRESSING_BY_ID[chosen] || DRESSING_BY_ID[fallback] || null;
  }
  function dressingOwned(id) {
    const d = DRESSING_BY_ID[id];
    if (!d) return false;
    if (d.cost === 0) return true;                       // the free defaults are always hers
    return !!(getState().dressingsOwned || {})[id];
  }
  // Paint the applied dressings into the room's wall and floor bands. The bands are the two
  // scene layers the interior already draws; the dressing is a pattern fill laid over them, so
  // nothing about the room's structure (the window, the skirting) has to be re-authored.
  function renderDressings() {
    if (!isInterior || !ROOM) return;
    for (const [slot, sel] of [['walls', '.t-interior-wall'], ['floors', '.t-interior-floor']]) {
      const band = viewport.querySelector(sel);
      if (!band) continue;
      const d = dressingApplied(slot);
      band.querySelectorAll('.t-dressing').forEach(n => n.remove());
      if (!d) continue;
      const layer = el('div', { class: 't-dressing', html: renderDressing(d) });
      band.insertBefore(layer, band.firstChild);
    }
  }
  function applyDressing(id) {
    const d = DRESSING_BY_ID[id];
    const rid = roomIdOfArea();
    if (!d || !rid || d.room !== rid) return false;
    if (!dressingOwned(id)) return false;
    mutate(st => {
      st.dressings = st.dressings || {};
      st.dressings[rid] = Object.assign({}, st.dressings[rid], { [d.slot]: id });
    });
    commit();
    // A 300ms wash, per the pack: the room changes in front of her rather than blinking.
    const band = viewport.querySelector(d.slot === 'walls' ? '.t-interior-wall' : '.t-interior-floor');
    renderDressings();
    if (band && !REDUCED) { band.classList.remove('dressing-wash'); void band.offsetWidth; band.classList.add('dressing-wash'); setTimeout(() => band.classList.remove('dressing-wash'), 340); }
    hint.textContent = `${d.name}!`;
    sfx.tap();
    return true;
  }
  // The Decorate tab: two rows of swatches, Walls and Floors. Owned ones apply instantly;
  // unowned ones show their price with a lock and deep-link to the shop's House shelf.
  function renderDecorateTab() {
    const strip = drawerStrips.decorate;
    if (!strip) return;
    clear(strip);
    const rid = roomIdOfArea();
    if (!rid) { strip.appendChild(el('div', { class: 'drawer-empty', text: 'Decorating is for the rooms of the Boo House.' })); return; }
    // RUN21A-2: dressings are per-room SKUs — the strip says whose room it is dressing.
    // ROOM.name carries the same values as the DRESSING_ROOMS names (Lounge/Kitchen/Bedroom).
    strip.appendChild(el('div', { class: 'decorate-caption', text: `Dressings for the ${ROOM.name}` }));
    for (const [slot, label] of [['walls', 'Walls'], ['floors', 'Floors']]) {
      const applied = dressingApplied(slot);
      const row = el('div', { class: 'decorate-row' });
      row.appendChild(el('div', { class: 'decorate-row-label', text: label }));
      const swatches = el('div', { class: 'decorate-swatches' });
      for (const d of dressingsFor(rid, slot)) {
        const owned = dressingOwned(d.id);
        const on = applied && applied.id === d.id;
        const btn = el('button', {
          class: 'decorate-swatch' + (on ? ' on' : '') + (owned ? '' : ' locked'),
          'aria-label': owned ? `${d.name}${on ? ' — on now' : ''}` : `${d.name} — costs ${d.cost} creative stars, tap to see it in the shop`,
          onclick: () => {
            if (owned) { applyDressing(d.id); renderDecorateTab(); return; }
            sfx.tap();
            // RUN21A-9: carry the way home — Back from the shop returns to THIS room
            ctx.go('shop', { shelf: 'house', highlight: d.id, from: 'town', fromArea: 'boohouse', fromRoom: rid });
          }
        }, [
          el('div', { class: 'decorate-swatch-art', html: renderDressingSwatch(d, { size: 56 }) }),
          el('span', { class: 'decorate-swatch-name', text: d.name }),
          owned ? null : el('span', { class: 'decorate-swatch-cost', text: `🔒 ${d.cost}★` })
        ]);
        swatches.appendChild(btn);
      }
      row.appendChild(swatches);
      strip.appendChild(row);
    }
  }

  // ---- RUN19 Z6: surfaces --------------------------------------------------------------
  // Where a surface child actually sits, in on-screen pixels, derived from its PARENT. Returns
  // null if the parent has gone — the caller then grounds the child rather than leaving it
  // floating (see groundOrphans), because a thing she put somewhere is never deleted.
  function surfaceSeatFor(child, st) {
    if (child == null || child.parent == null) return null;
    const parent = (areaItems(st) || []).find(p => pidOf(p) === child.parent);
    if (!parent) return null;
    const slots = slotsFor(parent.item);
    if (!slots) return null;
    const idx = Math.max(0, Math.min(slots.length - 1, Number(child.slot) || 0));
    const pItem = resolveItem(parent.item);
    const pRow = rowOf(parent);
    const pWidth = (ACT_SIZE[parent.item] || 92) * ROW_SCALE[pRow] * itemScaleOf(parent, scaleMaxFor(pItem, isInterior));
    const pHeight = pWidth * 130 / 120;                        // one shared 120x130 deco viewBox
    const pGround = viewH * ROWS[pRow];
    const pCentreX = (ZONE_INDEX[parent.zone] ?? 0) * zoneW + clamp01(parent.x) * zoneW;
    return {
      x: pCentreX + slots[idx].x * pWidth,
      // The surface, measured from the parent's own GROUND LINE — the y=120 line of the shared
      // 120x130 deco viewBox, which renderPlaced lands at (rowGround + 8). RUN21B item 5: this
      // comment used to claim (ground + 8) is the parent's rendered BOX BOTTOM. It is not — the
      // box bottom is a further pHeight*10/130 below, that 10/130 being the transparent margin
      // the viewBox leaves under the ground line. The arithmetic was always right; the sentence
      // describing it was not, and data/surfaces.js's authors were reading the sentence.
      // surfaceY = (120 - S)/130 for a surface drawn at viewBox y = S. See data/surfaces.js.
      y: (pGround + 8) - surfaceYFor(parent.item, idx) * pHeight,
      parentWidth: pWidth,
      z: Math.round(pGround)
    };
  }
  // Every free slot in this area, as screen-space points — what a held small item is tested
  // against while she is dragging it.
  function freeSurfaceSlots(st, exclude) {
    const items = areaItems(st);
    const out = [];
    for (const p of items) {
      const slots = slotsFor(p.item);
      if (!slots) continue;
      const pid = pidOf(p);
      if (pid == null) continue;
      for (let i = 0; i < slots.length; i++) {
        if (items.some(c => c !== exclude && c.parent === pid && Number(c.slot) === i)) continue;   // taken
        const seat = surfaceSeatFor({ parent: pid, slot: i }, st);
        if (seat) out.push({ parentId: pid, parentItem: p.item, slot: i, x: seat.x, y: seat.y });
      }
    }
    return out;
  }
  // A child whose parent has been PUT AWAY is GROUNDED at the parent's last spot, on the floor,
  // in the same row — never deleted. Called before every render, so it holds however the parent
  // went.
  //
  // RUN21F F5: this used to fire on a MOVE as well, because the parent's identity contained its
  // own x and so changed under it. It cannot now: an id survives a move, so the only way to be
  // an orphan is for the parent to genuinely leave the area — put away, or picked up to be
  // carried somewhere else. The landing spot is the child's own x, which moveChildrenWith() has
  // been keeping equal to the parent's x all along, so it is precisely "where the table stood".
  function groundOrphans() {
    const st = getState();
    const items = areaItems(st);
    const ids = new Set(items.map(pidOf));
    const orphans = items.filter(t => t.parent != null && !ids.has(t.parent));
    if (!orphans.length) return false;
    mutate(stt => {
      for (const t of areaItems(stt)) {
        if (t.parent == null || ids.has(t.parent)) continue;
        t.plane = 'floor';
        delete t.parent; delete t.slot;
      }
    });
    return true;
  }
  // RUN21F F5 — CHILDREN RIDE WITH THEIR PARENT. A seated child's stored zone/x/row have always
  // mirrored its parent's (that is what the seating code writes), and the renderer positions it
  // from the parent anyway — so the only thing a move has to do is keep that mirror true, which
  // is what makes "put the table away" land the lamp at the table's LAST spot rather than its
  // first. It is not what makes the lamp travel: the lamp travels because it keeps its parent's
  // id and surfaceSeatFor reads the parent's new position. Returns the children it touched.
  function moveChildrenWith(items, parent) {
    const pid = pidOf(parent);
    if (pid == null) return [];
    const kids = items.filter(c => c !== parent && c.parent === pid);
    for (const c of kids) { c.zone = parent.zone; c.x = parent.x; c.row = parent.row; }
    return kids;
  }
  // The live save record for a placement, BY ID. Every caller used to hunt for it by
  // `item + zone + x`, which is fragile in two ways that both bit: two copies of the same item
  // at the same x in different rows are indistinguishable, and `x` is the field a drag changes,
  // so the lookup had to happen before the write and could never be repeated after it.
  // Falls back to the old positional match for a record that predates its id (a hand-built
  // fixture, or `place` objects the QA hooks synthesise).
  function findPlacement(place, items) {
    if (!place) return null;
    const list = items || areaItems(getState());
    const pid = pidOf(place);
    if (pid != null) { const byId = list.find(t => pidOf(t) === pid); if (byId) return byId; }
    return list.find(t => t.item === place.item && t.zone === place.zone
      && Math.abs((t.x || 0) - (place.x || 0)) < 0.0015 && rowOf(t) === rowOf(place)) || null;
  }

  function renderPlaced() {
    groundOrphans();   // RUN19 Z6: nothing she placed is ever lost when its table goes away
    const existing = Array.from(ground.querySelectorAll('.t-item'));
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
      // Wall-hung items (RUN10 P4): their own lane, no depth variation, drawn behind the
      // floor's own items (lower z) — a bookshelf never blocks a Boo standing in front of it.
      // RUN19 Z6: a wall item's height is now its own dragged `y` within the authored
      // 0.18-0.42 band, not one fixed WALL_Y_FRAC for every wall item in the game.
      const onWall = isWallPlane(t);
      // RUN20 W1 — the SKY plane (reserved in Z6's plane union precisely so this needed no
      // second migration). A sky wish anchors by fraction of viewport height inside the sky
      // band, not on a ground row, and drifts along it.
      const onSky = planeOf(t) === 'sky' || (wishNeedsSky(t.item) && SKY_WISHES.has(t.item));
      const row = onWall ? WALL_ROW : rowOf(t);
      const rowGroundPx = onSky ? viewH * skyYFor(t)
        : onWall ? viewH * clampWallY(t.y != null ? t.y : WALL_Y_FRAC) : viewH * ROWS[row];
      const baseSize = onWall ? (ACT_SIZE[t.item] || 92) : (ACT_SIZE[t.item] || 92) * ROW_SCALE[row];
      const size = baseSize * itemScaleOf(t, scaleMaxFor(item, isInterior));
      
      let wrapIndex = existing.findIndex(w => w._placeRef === t);
      // RUN21F F5: then by placement id — a wrap keeps its node across a move now, so the drag
      // ghost's classes and the resize handle survive the re-render that follows a commit.
      if (wrapIndex < 0 && t.id != null) {
        wrapIndex = existing.findIndex(w => !w._matched && w.dataset.pid === String(t.id));
      }
      // Fallback if re-loaded from string or manual DOM insertion
      if (wrapIndex < 0) {
        wrapIndex = existing.findIndex(w => !w._matched && w.dataset.item === t.item && Math.abs(parseFloat(w.dataset.x || '0') - t.x) < 0.001 && w.dataset.row === String(row));
      }
      
      let wrap;
      if (wrapIndex >= 0) {
        wrap = existing[wrapIndex];
        wrap._matched = true;
      } else {
        wrap = el('div');
        attachItemPointer(wrap, t, item);
        ground.appendChild(wrap);
      }
      wrap._placeRef = t;
      
      const bff = item.kind === 'boo' && isBestFriend(item.id, st);
      const onSurface = planeOf(t) === 'surface';
      const newClass = 't-item' + (item.kind === 'boo' ? ' boo' : '') + (onWall ? ' on-wall' : '')
        + (onSurface ? ' on-surface' : '') + (onSky ? ' on-sky' : '')
        + (isWish(t.item) ? ' t-wish wish-' + (wishClass(t.item) || 'none').toLowerCase() : '')
        // RUN21B-2: the ambient idle rides on its own token, so it can never disturb the
        // wish-<cls> token the tap verbs and RUN20's behaviours bind to. The continuous
        // idles (FLIER, BOB) are pure CSS on this class; the episodic ones are paced by
        // pumpWishIdles below. Recomputed here every render, which is also how the owl's
        // night gate re-evaluates as the clock rolls over.
        + (isWish(t.item) ? ' wishidle-' + (wishIdleClass(t.item, isNight(currentHour())) || 'none').toLowerCase() : '')
        + (bff ? ' care-bff' : '');
      if (wrap.className !== newClass) wrap.className = newClass;

      wrap.dataset.zone = t.zone;
      wrap.dataset.x = String(t.x);
      wrap.dataset.item = t.item;
      if (t.id != null) wrap.dataset.pid = String(t.id);   // RUN21F F5: the placement's identity
      else delete wrap.dataset.pid;
      wrap.dataset.row = String(row);
      wrap.dataset.plane = planeOf(t);
      wrap.dataset.scale = String(itemScaleOf(t, scaleMaxFor(item, isInterior)));

      // RUN19 Z6 — a SURFACE CHILD is positioned from its PARENT, not from a ground line: it
      // sits on the parent's own surface, moves when the parent moves, shrinks so it can never
      // be wider than 45% of what it stands on, and draws one z-index in front of it.
      let placedSize = size, placedLeft = px - size / 2, placedTop = rowGroundPx - size + 8, placedZ = onWall ? 1 : Math.round(rowGroundPx);
      if (onSurface) {
        const seat = surfaceSeatFor(t, st);
        if (seat) {
          placedSize = Math.min(size * CHILD_SCALE, seat.parentWidth * CHILD_MAX_WIDTH_FRAC);
          placedLeft = seat.x - placedSize / 2;
          // Land the child's OWN drawn base on the surface. RUN21B item 5: this was
          // `- placedSize + placedSize * (10/130)`, a single flat nudge for every small item —
          // which is exactly right only for art that stops at viewBox y = 110.8 and nothing
          // does. The lamp stops at 104 and floated; the plant stops at 114 and sank. Since a
          // child's box height is placedSize*130/120, its own y=Yc line sits Yc*placedSize/120
          // below its box top, so putting that line on the seat is one subtraction — and it
          // holds at every parent scale because placedSize already carries the scale.
          placedTop = seat.y - placedSize * (baseYFor(t.item) / 120);
          placedZ = seat.z + 1;
        }
      }
      wrap.style.left = placedLeft + 'px';
      wrap.style.top = placedTop + 'px';
      wrap.style.zIndex = String(placedZ);
      
      // Table lamp (RUN10 P4): glows 21:00-07:00, same one-render-time-check pattern as
      // growth.js's fairy lights.
      if (LAMP_IDS.has(t.item) && isNight(currentHour())) wrap.classList.add('lit');
      else wrap.classList.remove('lit');
      if (isWish(t.item)) dressWish(wrap, t);   // RUN20 W1
      
      // NOTE: `placedSize`, not `size` — a surface child is drawn at its clamped size, so the
      // art and the box agree. Using `size` here rendered a lamp at full size inside a box
      // 45% of a table's width and it spilled out of both.
      const newHTML = t.item === 'deco_bffportrait' && t.portraitBoo
        ? renderBffPortrait(t.portraitBoo, placedSize)
        : t.item === 'deco_photoframe'
          ? renderPhotoFrame(photoBooFor(t, st), placedSize)
          : renderItem(item, {
              size: placedSize,
              equipArt: item.kind === 'boo' ? equippedArt(item.id) : null,
              // RUN13 T4: a placed wall clock shows the DEVICE time. Passed in rather than
              // read inside art.js so the minute tick below and the suites drive the same path.
              ...(t.item === 'deco_wallclock' ? { clockHour: currentHour(), clockMinute: currentMinute() } : {})
            });
        
      if (wrap._lastHTML !== newHTML) {
        wrap.innerHTML = newHTML;
        wrap._lastHTML = newHTML;
      }
      
      // Shared rarity VFX (C2): full effect for the first RARITY_TOWN_CAP fancy items,
      // then a static sheen so the emitter cap holds (distant/numerous items degrade).
      const shiny = ((st.shinies && st.shinies[t.item]) || 0) > 0;
      if (rarityRank(item) > 0 || shiny) {
        const degrade = fancyCount >= RARITY_TOWN_CAP;
        // Optimization: don't clear and re-append identical fx DOM nodes if properties haven't changed.
        const fxKey = `${shiny ? 's' : ''}-${degrade ? 'd' : ''}`;
        if (wrap._lastFxKey !== fxKey) {
          applyRarityFx(wrap, item, { context: 'town', shiny, degrade });
          wrap._lastFxKey = fxKey;
        }
        if (!degrade) fancyCount++;
      } else {
        if (wrap._lastFxKey !== 'none') {
          clearRarityFx(wrap);
          wrap._lastFxKey = 'none';
        }
      }
      
      if (item.kind === 'boo' && !item.fx && count < MAX_WANDERERS) {
        const act = makeActor(wrap, item, t);
        // RUN21A-1: a riding Boo's STANDING sprite is suppressed only inside the funfair
        // itself, where the ride renderer already draws it — everywhere else a placed Boo
        // always renders. (Saves holding hidden placements self-heal here; no migration.)
        if (AREA.key === 'funfair' && isSeated(t.item)) { act.riding = true; wrap.style.display = 'none'; }
        else wrap.style.display = '';
        actors.push(act); count++;
      }
    }
    
    // Cleanup old unused item wrappers (diff teardown)
    existing.forEach(w => {
      if (!w._matched) w.remove();
      else w._matched = false; // Reset for next render
    });
    
    applyDance();
    assignRoles();
    renderZoneScenery();   // zone identity (RUN7 C2): distinct backdrop per zone, behind items
    renderAreaAmbient();   // RUN20 W2: the area's own quiet life
    renderGrowth();
    renderFunfair();
    renderHide();
    decorateEasels().then(maybeAckEasel);   // RUN19 Z4 — after the art is actually in the DOM
    applySparkles();                        // RUN19 Z5 — today's sprinkles, and drop yesterday's
    renderRequestBubble();
    applyLingerResize();   // RUN21C-6: the handle survives the re-render that a drag causes
    // A request fulfilled on ANOTHER screen (the wardrobe, the Disco Hall) still owes the
    // child its moment. takeThanks() drains the flag, so this is a no-op when there is
    // nothing owed and never plays the same thank-you twice (announced-moments law).
    playThanks();
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
    const rowGroundPx = viewH * ROWS[row];
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

  // RUN21A-8: the reveal queue — one reveal on screen at a time, everywhere. Each queued
  // fn receives a `done` callback it MUST invoke from its dismiss handler; the queue then
  // shows the next. Per-mount state, so a mid-reveal navigation can never wedge it.
  const revealQueue = []; let revealShowing = false;
  function enqueueReveal(fn) { revealQueue.push(fn); pumpReveals(); }
  function pumpReveals() {
    if (revealShowing) return;
    const fn = revealQueue.shift();
    if (!fn) return;
    revealShowing = true;
    fn(() => { revealShowing = false; pumpReveals(); });
  }

  // ---- RUN21D-1: the Pulse Director ----------------------------------------------------
  // See the `// RUN21D: pulse` block at module scope for the why. This is the wiring: one
  // beat 900ms after first paint, one invitation at 9s, both cancelled on unmount.
  let pulseStarted = false, pulseBeat = null, pulseInvited = false;
  let pulseTimer = null, pulseHintTimer = null;
  const pulseFired = [];   // every beat this mount played — the "never two" proof
  const pulseInvitation = () => PULSE_INVITATIONS[STORE_KEY] || PULSE_INVITATIONS[AREA.key] || null;

  function startPulse() {
    if (pulseStarted) return;        // once per mount, whatever calls it
    pulseStarted = true;
    pulseTimer = setTimeout(() => {
      pulseTimer = null;
      // Reveals win. A growth/funfair ceremony is already the moment; the town does not
      // clear its throat over one. The whole pulse skips this mount, invitation included.
      if (revealShowing || revealQueue.length) { pulseBeat = 'skipped:reveal'; return; }
      // RUN21C-1: and the softened world does not get cleared throats either.
      if (softened) { pulseBeat = 'skipped:softened'; return; }
      // REDUCED: no movement beats at all — the invitation is the whole pulse.
      pulseBeat = REDUCED ? 'reduced' : (playPulseBeat() || 'none');
      hiderFairChance();   // RUN21D-5: after the beat, in the hider's area only
      pulseHintTimer = setTimeout(showPulseInvitation, Math.max(0, PULSE_HINT_MS - PULSE_DELAY_MS));
    }, PULSE_DELAY_MS);
  }

  // Exactly ONE beat: first eligible wins, but a beat this area has not shown today is
  // preferred over one it has, so a second visit is not a rerun of the first.
  function playPulseBeat() {
    const seen = pulseSeenSet(todayKeyLocal());
    const beats = [
      ['request',   beatRequest],
      ['newItem',   beatNewItem],
      ['zone',      beatZoneBehaviour],
      ['idle',      beatNearestIdle],
      ['signature', beatSignature]
    ];
    const key = (k) => STORE_KEY + ':' + k;
    const unshown = beats.filter(([k]) => !seen.has(key(k)));
    for (const list of [unshown, beats]) {
      for (const [kind, run] of list) {
        if (!run()) continue;
        seen.add(key(kind));
        pulseFired.push(kind);
        return kind;                 // one beat. The loop never runs past this.
      }
    }
    return null;
  }

  // 1 — someone in this area is wondering something. Breathe the bubble, and if she cannot
  //     see it, take her to it.
  function beatRequest() {
    const placed = areaItems(getState());
    const r = activeRequests().find(x => placed.some(t => t.item === x.booId));
    if (!r) return false;
    const bubble = ground.querySelector(`.request-thought[data-boo="${r.booId}"]`);
    if (!bubble) return false;
    pulseBubble(bubble);
    const t = placed.find(x => x.item === r.booId);
    if (t) pulsePanTo(t.x);
    return true;
  }
  // The pulse may take the camera somewhere — but never AWAY from somewhere the child has
  // already sent it. She can drag the view, or open a request card and press "Show me",
  // inside the pulse's own 900ms window, and the ambient breath must not undo that. Same
  // principle as reveals winning: anything she started outranks the town clearing its
  // throat. `cameraClaimed` is set by every deliberate camera move she makes.
  function pulsePanTo(xFrac) {
    if (cameraClaimed || panRaf) return;
    if (fracOnScreen(xFrac)) return;
    panToFrac(xFrac, PULSE_PAN_MS);
  }
  function pulseBubble(bubble) {
    if (REDUCED) return;
    bubble.classList.remove('rq-pulse3'); void bubble.offsetWidth; bubble.classList.add('rq-pulse3');
    setTimeout(() => bubble.classList.remove('rq-pulse3'), PULSE_BUBBLE_MS);
  }

  // 2 — the newest thing she put down does its own verb once. "New" is requests.js's own
  //     TRY_FRESH_MS, so the town agrees with itself about what counts as new.
  function beatNewItem() {
    const now = nowMs();
    const fresh = areaItems(getState())
      .filter(t => t.at && now - t.at < TRY_FRESH_MS)
      .sort((a, b) => b.at - a.at);
    for (const t of fresh) {
      const wrap = wrapFor(t);
      if (!wrap || wrap.style.display === 'none') continue;
      if (isWish(t.item)) {
        const item = resolveItem(t.item);
        if (!item || !wishTap(wrap, t, item)) continue;   // its authored wish verb, played once
        pulsePanTo(t.x);
        return true;
      }
      // A seat or an activity: the nearest Boo goes and uses it. Walking there IS the
      // beat; the socket claim that follows is ordinary town life on its own timing.
      if ((SOCKETS[t.item] && SOCKETS[t.item].length) || ACT_IDS.includes(t.item)) {
        const a = nearestActorTo(t.x);
        if (!a) continue;
        clearRole(a); endWait(a);
        a.goal = { kind: 'approach', deco: t, targetDx: (t.x - a.place.x) * zoneW, start: performance.now() };
        pulsePanTo(t.x);
        return true;
      }
    }
    return false;
  }

  // 3 — this place has an act of its own. Start it now instead of waiting for the dice that
  //     chooseBehaviourKind rolls once every few seconds per Boo.
  function beatZoneBehaviour() {
    if (isNight(currentHour())) return false;            // the same daytime gate the dice use
    const zb = ZONE_BEHAVIOURS[STORE_KEY];
    if (!zb || !zb.length) return false;
    const a = nearestActorToScreen();
    if (!a || a.role || a.parading) return false;
    clearRole(a); endWait(a); a.goal = null;
    startBehaviour(a, zb[0][0], performance.now());       // the authored first choice, not a roll
    return !!a.goal;
  }

  // 4 — the nearest Boo notices you: its species idle, and one hop.
  function beatNearestIdle() {
    const a = nearestActorToScreen();
    if (!a) return false;
    const species = (a.item && a.item.species) || 'bloop';
    // A directed beat, so the per-Boo GAP is cleared (as __townLife.forceIdle does). The
    // rolling-minute and scene caps still bind — this is a nudge, not an override.
    a.idleNextAt = 0; a.idleUntil = 0;
    if (!maybeIdle(a, performance.now(), SPECIES_IDLE[species] || SPECIES_IDLE.bloop)) return false;
    a.wrap.classList.remove('t-seat-hop'); void a.wrap.offsetWidth; a.wrap.classList.add('t-seat-hop');
    setTimeout(() => a.wrap.classList.remove('t-seat-hop'), SEAT_HOP_MS + 60);
    return true;
  }

  // 5 — the area's own signature, fired once from where a finger would have found it.
  function beatSignature() {
    const p = signaturePoint();
    return !!(p && areaSignature(p.x, p.y));
  }
  // Where the signature LIVES on screen right now, or null when it is not reachable from
  // this camera. Deliberately reads the same anchors areaSignature() tests against, so the
  // pulse can never fire a signature a finger could not have.
  function signaturePoint() {
    if (softened || isInterior) return null;
    const r = viewport.getBoundingClientRect();
    const atFrac = (xFrac, yFrac) => {
      const px = xFrac * zoneW - scrollX;
      if (px < 8 || px > r.width - 8) return null;
      return { x: r.left + px, y: r.top + r.height * yFrac };
    };
    const centre = (yFrac) => ({ x: r.left + r.width / 2, y: r.top + r.height * yFrac });
    switch (AREA.key) {
      case 'riverside': return centre(0.44);
      case 'beach':     return centre(0.72);
      case 'hilltop':   return centre(0.30);
      case 'meadow': {
        const f = areaItems(getState()).find(t => /flower/.test(t.item));
        return f ? atFrac(f.x, 0.62) : null;
      }
      case 'playground': {
        const f = areaItems(getState()).find(t => /slide|frame|climb/.test(t.item));
        return f ? atFrac(f.x, 0.60) : null;
      }
      case 'funfair': {
        const cart = ground.querySelector('.ff-scenery-wrap, .ff-consite');
        if (!cart) return null;
        const cr = cart.getBoundingClientRect();
        const cx = cr.left + cr.width / 2;
        return (cx > r.left + 8 && cx < r.right - 8) ? { x: cx, y: r.top + r.height * 0.60 } : null;
      }
      default: return null;
    }
  }

  const liveActors = () => actors.filter(a => a.wrap && a.wrap.isConnected && a.wrap.style.display !== 'none');
  function nearestActorTo(xFrac) {
    return liveActors().sort((p, q) => Math.abs(p.place.x - xFrac) - Math.abs(q.place.x - xFrac))[0] || null;
  }
  function nearestActorToScreen() {
    return nearestActorTo((scrollX + viewW / 2) / (zoneW || 1));
  }

  // ---- RUN21D-5: the hider gets a fair chance ------------------------------------------
  // Runs immediately after the opening beat, in the hider's area only, once per visit.
  let hiderNudged = false, hiderPanned = false;
  function hiderFairChance() {
    if (hiderNudged) return;
    const h = currentHide();
    if (!h || (ZONE_INDEX[h.spot.zone] ?? -1) < 0) return;   // hiding somewhere else today
    const peek = ground.querySelector('.t-hide-peek');
    if (!peek) return;
    hiderNudged = true;
    const peekPx = (parseFloat(peek.style.left) || 0) + peek.offsetWidth / 2;
    const xFrac = peekPx / (zoneW || 1);
    // The pan is the part reduced motion skips; the LINE always shows. Nor does it fight a
    // camera she has already claimed, or one the beat is still moving.
    if (!REDUCED && !cameraClaimed && !panRaf && !fracOnScreen(xFrac)) {
      // Toward it, not onto it: land half a screen short, so the peek is just beyond the
      // edge she can see and spotting it is still her doing.
      const dir = peekPx > scrollX + viewW / 2 ? 1 : -1;
      panToPx(peekPx - viewW / 2 - dir * (viewW / 2), HIDER_PAN_MS);
      hiderPanned = true;
    }
    hint.textContent = HIDER_NEARBY_LINE;
  }

  // The invitation: a hint-bar line, never spoken, never while she is busy arranging.
  function showPulseInvitation() {
    pulseHintTimer = null;
    if (revealShowing || revealQueue.length) return;
    if (softened || placeMode || holding) return;
    const line = pulseInvitation();
    if (!line) return;
    hint.textContent = line;
    pulseInvited = true;
  }
  function stopPulse() {
    if (pulseTimer) { clearTimeout(pulseTimer); pulseTimer = null; }
    if (pulseHintTimer) { clearTimeout(pulseHintTimer); pulseHintTimer = null; }
  }

  // The reveal ceremony: fence drops, confetti, guide line, Journal stamp (C6).
  function playGrowthReveal(m, done = () => {}) {
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
        done();
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
      // RUN13B T8: the meadow is no longer "baseline" — it owns a dressed horizon like
      // everywhere else. The funfair still does its own theming (renderFunfair).
      if (z.key === 'funfair') return;
      if (stars < z.unlock) return;                            // locked zones show only their signpost
      const caperOpen = !!(getState().caper && getState().caper.open);
      const html = zoneScenery(z.key, zoneW, viewH, night, { caperOpen });
      if (!html) return;
      const wrap = el('div', { class: 't-zone-props ' + z.key + (night ? ' night' : ''), html });
      wrap.style.left = (i * zoneW) + 'px'; wrap.style.top = '0';
      // RUN13B T8: z 3 — ABOVE the grass band (2), still below painted paths (5) and every
      // placed item (row-keyed, hundreds). At z 2 the band painted over every prop that
      // touched the ground: the beach shells had never actually been visible.
      wrap.style.width = zoneW + 'px'; wrap.style.height = viewH + 'px'; wrap.style.zIndex = '3';
      ground.insertBefore(wrap, ground.firstChild);
    });
  }

  function renderFunfair() {
    ground.querySelectorAll('.ff-ride, .ff-consite, .ff-scenery-wrap, .ff-disco-door, .ff-sign').forEach(n => n.remove());
    if (AREA.key !== 'funfair') return;   // RUN10 P1: the fair only ever renders inside its own area
    if (!funfairUnlocked()) return;
    const zi = ZONE_INDEX['funfair'];
    const view = funfairView();
    // fair scenery (bunting, string lights, ticket booth, popcorn cart) in the ground
    // layer so it lines up with the rides; night makes the string lights glow (C1b)
    // RUN18D D10: the visible width matters. Without it the fair's furniture is laid out
    // across all four viewports and none of it lands on the screen she arrives at.
    const sc = el('div', { class: 'ff-scenery-wrap', html: fairSceneryFor(zoneW, viewH, isNight(currentHour()), viewW) });
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
    renderDiscoDoor(zi);
    renderFairSigns(zi);
  }
  // RUN21D-4 — the fair's two best rooms are its two least findable ones: the bandstand sits
  // at 0.68 of a four-viewport area and the Disco Hall's door at 0.51, so a child who
  // arrives at the gate and never drags right meets neither. Two hanging signs at the
  // entrance say where they are and take her there.
  function renderFairSigns(zi) {
    for (const sg of FAIR_SIGNS) {
      const sign = el('button', {
        class: 'ff-sign ff-sign-' + sg.id, type: 'button', 'aria-label': sg.aria,
        onclick: (e) => {
          e.stopPropagation();
          sfx.tap();
          if (sg.id === 'band') { cameraClaimed = true; panToFrac(BANDSTAND_X, DOT_PAN_MS); }
          // The Disco keeps the door's own route EXACTLY — `ctx.go('discohall')`, no params.
          // The pack asks for "`from` preserved"; discohall reads no params at all and its
          // own back control already returns to the funfair, so preserving the return path
          // means calling it identically to the door, not inventing two params nothing
          // reads (which tests/r12s1-routes rightly flags as an undriven contract).
          else ctx.go('discohall');
        }
      }, [
        el('span', { class: 'ffs-rope', 'aria-hidden': 'true' }),
        el('span', { class: 'ffs-plaque', text: sg.text })
      ]);
      sign.style.left = (zi * zoneW + sg.x * zoneW) + 'px';
      sign.style.top = (viewH * FAIR_SIGN_Y) + 'px';
      sign.style.zIndex = String(Math.round(groundY) + 3);
      sign.addEventListener('pointerdown', e => e.stopPropagation());
      ground.appendChild(sign);
    }
  }
  function renderDiscoDoor(zi) {
    const door = el('button', {
      class: 'ff-disco-door',
      'aria-label': 'Enter the Disco Hall',
      onclick: e => { e.stopPropagation(); sfx.tap(); ctx.go('discohall'); }
    }, [
      el('span', { class: 'ff-disco-sign', text: 'DISCO' }),
      el('span', { class: 'ff-disco-stars', text: '✦  ♪  ✦' }),
      el('span', { class: 'ff-disco-enter', text: 'ENTER' })
    ]);
    door.style.left = `${zi * zoneW + DISCO_DOOR_X * zoneW - 74}px`;
    door.style.top = `${groundY - 164}px`;
    door.style.zIndex = String(Math.round(groundY) + 2);
    door.addEventListener('pointerdown', e => e.stopPropagation());
    ground.appendChild(door);
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
  // RUN21A-16: the combined catch-up celebration — several ride thresholds crossed in one
  // tick complete together and are announced ONCE, through the item-8 queue.
  function playFairCatchupReveal(rides, done = () => {}) {
    sfx.fanfare();
    const names = rides.map(r => RIDE_NAME[r]);
    const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
    const ov = el('div', { class: 'overlay growth-reveal' });
    const panel = el('div', { class: 'card gr-panel' }, [
      el('h2', { class: 'gr-title', text: 'Look how the fair has grown!' }),
      el('p', { class: 'gr-line', text: `The Boo Builders finished ${rides.length} rides while you were busy: ${list}!` }),
      el('div', { class: 'gr-scene' }, [el('div', { class: 'gr-upgrade', html: `<div class="gr-name">The Boo Funfair</div>` }), el('div', { class: 'gr-fence' })]),
      el('button', { class: 'btn big', text: 'Hooray! 🎉', onclick: () => {
        sfx.tap(); ov.remove();
        completeCatchupReveal();
        renderFunfair();
        if (ZONE_INDEX['funfair'] != null) scrollToZone(ZONE_INDEX['funfair']);
        done();
      } })
    ]);
    ov.appendChild(panel); root.appendChild(ov);
    requestAnimationFrame(() => { ov.classList.add('show'); setTimeout(() => panel.querySelector('.gr-fence').classList.add('drop'), REDUCED ? 0 : 500); });
    if (!REDUCED) confetti({ count: 110, power: 1.1 });
    speakMaybe('Look how the fair has grown!');
  }

  function playFunfairReveal(ride, done = () => {}) {
    sfx.fanfare();
    const ov = el('div', { class: 'overlay growth-reveal' });
    const panel = el('div', { class: 'card gr-panel' }, [
      el('h2', { class: 'gr-title', text: '🎡 Ta-daa!' }),
      el('p', { class: 'gr-line', text: `The ${RIDE_NAME[ride]} is ready! Hop on!` }),
      el('div', { class: 'gr-scene' }, [el('div', { class: 'gr-upgrade', html: `<div class="gr-name">${RIDE_NAME[ride]}</div>` }), el('div', { class: 'gr-fence' })]),
      el('button', { class: 'btn big', text: 'Hooray! 🎉', onclick: () => { sfx.tap(); ov.remove(); completeRideReveal(ride); renderFunfair(); scrollToZone(ZONE_INDEX['funfair']); done(); } })
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
  const benchCooldown = new Map();   // placement id -> timestamp
  // ---- activity sockets (RUN10 P2): each placed item's seats, tracked by instance ----
  const socketUse = new Map();       // placement id -> array of actor|null, length = SOCKETS[item].length
  // RUN21F F5: the placement id, not the old `zone:x:item`. These three Maps are session state
  // in this mount's closure, never save data — so there is nothing here to migrate — but they
  // were keyed on a string that changed the moment a bench was nudged, which quietly emptied
  // every seat on it. The id holds across a move, so a Boo keeps her seat while the bench slides.
  function itemKeyOf(t) { const pid = pidOf(t); return pid != null ? 'p' + pid : t.zone + ':' + t.x + ':' + t.item; }
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
  // RUN21F F5: by placement id when there is one, which is the only way to tell two copies of
  // the same item at the same x in different depth rows apart. Position is the fallback.
  const wrapFor = (t) => {
    const nodes = [...ground.querySelectorAll('.t-item')];
    const pid = pidOf(t);
    return (pid != null ? nodes.find(w => w.dataset.pid === String(pid)) : null)
      || nodes.find(w => w.dataset.zone === t.zone && Math.abs(+w.dataset.x - t.x) < 0.001 && w.dataset.item === t.item);
  };
  // Use the Boo's CURRENT position (home + wander offset) so a Boo that walked
  // UP to an activity (C1 behaviour engine) gets claimed on arrival, not just one
  // that happened to be placed beside it. Goal-pursuers aren't yanked mid-act.
  const curX = (a) => a.place.x + ((a.dx || 0) / (zoneW || 1));
  const freeNear = (t, radius) => actors
    .filter(a => !a.role && !a.dancing && !a.goal && ZONE_INDEX[a.place.zone] === ZONE_INDEX[t.zone] && Math.abs(curX(a) - t.x) <= radius)
    .sort((p, q) => Math.abs(curX(p) - t.x) - Math.abs(curX(q) - t.x));
  const give = (a, role) => {
    if (actors.filter(x => x.role).length >= MAX_ACTIVE_ROLES) return false;
    endWait(a);   // RUN19 Z3: the seat it was waiting for just came free
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
      if (a._homeTop == null) { a._homeTop = a.wrap.style.top; a._homeZ = a.wrap.style.zIndex; a._homeLeft = a.wrap.style.left; }
      // Carry the seat's HORIZONTAL offset on the WRAP, not only on the svg.
      //
      // The wrap's `top` has always been moved to the socket (just below); its `left` never
      // was — the offset lived purely in the svg's per-frame transform. So the artwork sat in
      // the bed while the wrap it belongs to stayed at the Boo's original placement x. That is
      // invisible when a Boo happens to be standing next to the thing it claims (which is what
      // the suites seeded: a Boo at x=0.27, a bed at x=0.25), and glaring when it walks across
      // the room: measured 793px between the drawn sleeper and its own wrap.
      //
      // Everything the child actually interacts with hangs off the WRAP — the tap target, the
      // drifting z's, the request bubble, the speech bubble. All of it was being drawn, and
      // listening, in empty space, so tapping the Boo you can see did nothing at all.
      //
      // Moving the wrap and zeroing offX keeps every role transform correct by construction:
      // they all render relative to r.offX, which is now simply 0 because the wrap already
      // carries it. (RUN20 QA finding A — pre-existing, surfaced by Z3's naps.)
      // ONLY for a role that actually seats her on a socket. `sleep` (a Boo dozing beside the
      // Boo House) is given with no socket and its transform never reads offX at all — it
      // sleeps where it stands, which is right. Shifting its wrap would teleport every dozing
      // Boo within ACT_RADIUS onto the house's exact x, stacked on one another. Gate on the
      // socket, and shift from _homeLeft rather than the current left so a second give() on
      // the same actor could never double-shift.
      if (role.socket && a.role.offX) {
        a.role.slid = a.role.offX;   // the arrival transforms lerp FROM here, so she still walks in
        a.wrap.style.left = ((parseFloat(a._homeLeft) || 0) + a.role.offX) + 'px';
        a.role.offX = 0;
      }
      // RUN19 Z3 — a socket's `row` is a DELTA, not an absolute row. It used to be read
      // absolutely, which silently assumed every socketed item is placed in row 2 (where
      // outdoor rides usually are). Indoors it is not: a bed at row 1 got a seat anchored to
      // row 2's ground line, ~76px BELOW the bed, so the sleeper poked out from underneath
      // it. Every authored value was written for an item at row 2 (SOCKET_ROW_BASE), so
      // `socket.row - 2` is the offset that was always meant: 0 for a bench or a bed (same
      // row as the item), -1 for the trampoline's middle seat, which town.js's own comment
      // already described as "one row further back". Items at row 2 are byte-identical.
      const socketDelta = (role.socket && role.socket.row != null) ? (role.socket.row - SOCKET_ROW_BASE) : 0;
      const socketRow = Math.max(0, Math.min(DEPTH_ROWS - 1, itemRow + socketDelta));
      // yFrac: fraction of the ITEM's rendered height the seat surface sits above its own
      // ground line (fine-tuned per item against real screenshots — see data/sockets.js).
      // Row-independent (unlike a raw px yNudge) since it scales with the item's own size.
      const itemH = itemW * 130 / 120;   // every deco shares one 120x130 viewBox (art.js)
      const yNudge = role.socket && role.socket.yFrac ? role.socket.yFrac * itemH : 0;
      const rowGroundPx = viewH * ROWS[socketRow];
      a.wrap.style.top = (rowGroundPx - a.wrap.offsetHeight + 8 + yNudge) + 'px';
      // RUN19 Z3: a sleeper goes BEHIND its bed, so the duvet drawn in the bed's own SVG
      // genuinely covers its body and only its head shows above the pillow. Every other
      // seat sits in FRONT, as it always has.
      const behind = role.socket && role.socket.role === 'nap';
      const dwZ = behind ? parseInt(dw.style.zIndex || '0', 10) : 0;
      a.wrap.style.zIndex = behind ? String((dwZ || Math.round(rowGroundPx)) - 1) : String(Math.round(rowGroundPx));
    }
    if (role.kind === 'sleep' && !a.wrap.querySelector('.t-zzz')) {
      a.wrap.appendChild(el('div', { class: 't-zzz', text: 'z Z z' }));
    }
    // Arrival settle (RUN10 P2): 180ms ease drop + one squash, via a one-shot CSS class
    // on the outer wrap (composes fine with the per-frame role transform on the svg).
    if (!REDUCED) { a.wrap.classList.remove('role-settle'); void a.wrap.offsetWidth; a.wrap.classList.add('role-settle'); }
    // A real SEAT claim (not sleep, not the campfire circle) is the single event both
    // RUN19 Z2's `sit` request and Z3's announced moment hang off. One choke point, so
    // neither can be wired at one call site and forgotten at the other.
    if (role.socketArrKey && role.deco) onSocketClaimed(a, role);
    if (a.role && a.role.socket && a.role.socket.role === 'nap') beginNap(a, a.role);   // RUN19 Z3
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
  // RUN19 Z3 — the seat is full, so WAIT for it. RUN10 P2 played a 300ms shrug and walked
  // away, which read as a glitch: the Boo arrived, twitched, and left for no visible reason.
  // Now it stands beside the seat in a patient pose (a tiny weight-shift every 1.5s) for up
  // to WAIT_MS, and takes the seat the moment it frees — assignRoles' own sweep does that,
  // because a waiting Boo has no role and is standing well inside ACT_RADIUS.
  // At most ONE waiter per seat; a second arrival wanders off rather than forming a queue.
  const seatWaiters = new Map();   // itemKey -> the actor currently waiting for it
  function waitersFor(t) {
    const key = itemKeyOf(t);
    const held = seatWaiters.get(key);
    // self-heal: an actor that has since been given a role or wandered off is not waiting
    if (held && (held.role || held.waitUntil == null || !actors.includes(held))) { seatWaiters.delete(key); return 0; }
    return held ? 1 : 0;
  }
  function waitBesideSeat(a, t) {
    // NOTE: a.dx is DELIBERATELY kept. The first cut zeroed it, copying endGoal's habit, and
    // since the wait's per-frame transform renders translate(a.dx) that snapped the Boo back
    // to its home x the instant it arrived — measured as a 491px single-frame jump, after
    // which it stood "patiently waiting" 464px from the seat. Strictly worse than the 300ms
    // shrug this replaced, and the whole point was to stop reading as a glitch.
    if (t && waitersFor(t) >= MAX_WAITERS_PER_SEAT) { endWait(a); a.goal = null; a.next = 400 + Math.random() * 400; return false; }
    if (t) seatWaiters.set(itemKeyOf(t), a);
    a.goal = null;
    a.waitUntil = performance.now() + WAIT_MS;
    a.waitKey = t ? itemKeyOf(t) : null;
    if (!REDUCED) a.wrap.classList.add('t-waiting');
    a.next = 400;
    return true;
  }
  function endWait(a) {
    if (a.waitKey && seatWaiters.get(a.waitKey) === a) seatWaiters.delete(a.waitKey);
    a.waitUntil = null; a.waitKey = null;
    a.wrap.classList.remove('t-waiting');
  }
  // Kept as the single name every caller already uses, so the retirement is one edit here
  // rather than five call sites that could disagree.
  function shrugAndEndGoal(a, t = null) { waitBesideSeat(a, t); }
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
    // RUN13 T3: at night, in the house, the beds are claimed FIRST — a Boo who is in the
    // Bedroom when the lamps go out routes to the bed rather than settling for the rug.
    const orderedActIds = (isInterior && night)
      ? [...ACT_IDS].sort((p, q) => (HOUSE_KIND_FOR[q] === 'housenap' ? 1 : 0) - (HOUSE_KIND_FOR[p] === 'housenap' ? 1 : 0))
      : ACT_IDS;
    for (const id of orderedActIds) {
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
    // RUN19 Z3: whatever ends a nap — a tap, the 20-40s timer, daylight rules, a rebuild —
    // the eyes open again. Doing it here rather than in wakeNap means no caller can leave a
    // wide-awake Boo walking around with its eyes shut.
    if (a.role && a.role.kind === 'housenap') setSleepingEyes(a, false);
    if (a.role && a.role.finishTimer) clearTimeout(a.role.finishTimer);
    releaseSocket(a);   // RUN10 P2: free the seat for the next Boo
    a.role = null;
    a.wrap.querySelectorAll('.t-zzz, .t-rod').forEach(n => n.remove());
    if (a._homeTop != null) { a.wrap.style.top = a._homeTop; a.wrap.style.zIndex = a._homeZ || ''; if (a._homeLeft != null) a.wrap.style.left = a._homeLeft; a._homeTop = null; a._homeZ = null; a._homeLeft = null; }   // restore its depth row AND its home x (C3)
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
      // ---- RUN13 T3: the three room-appropriate house behaviours ----------------------
      // NAP (Bedroom). A bed is a socket, so she lies ON the bedding rather than beside it,
      // and she breathes. Nobody is tired; she simply likes the bed.
      // RUN19 Z3 made it a real nap: eyes genuinely shut (the authored `eyes:'closed'` pose
      // from RUN18B Y4, re-rendered — not a CSS trick), a "z" that DRIFTS away every 2s
      // instead of one permanent glyph, a soft snore every 4s, and it ends by itself after
      // 20-40s. The lying scale is 0.68 so the bed still reads as a bed underneath.
      case 'housenap': {
        const breathe = 1 + Math.sin(t / 950) * 0.03;
        // UPRIGHT, head on the pillow, at 0.62 so the bed still reads as a bed. RUN13 T3's
        // rotate(-90deg) is gone: see the note in data/sockets.js — a round Boo turned on
        // its side reads as fallen over, not asleep.
        svg.style.transform = `translate(${r.offX.toFixed(1)}px, 0px) scale(0.62, ${(0.62 * breathe).toFixed(3)})`;
        if (!REDUCED) {
          if (t - (r.lastZ || -9999) >= NAP_Z_MS) { r.lastZ = t; puffNapZ(a); }
          if (t - (r.lastSnore || -9999) >= NAP_SNORE_MS) { r.lastSnore = t; sfx.snore(); }
        }
        if (r.napUntil != null && t >= r.napUntil) { wakeNap(a, { tapped: false }); }
        break;
      }
      // SNACK (Kitchen). A nibble cycle at the table: lean in, munch, sit back, a crumb
      // pip now and then. There is no hunger anywhere in this app and never will be (G9) —
      // this is a Boo enjoying a biscuit, which is a scene, not a need.
      case 'snack': {
        const p = (t % SNACK_BITE_MS) / SNACK_BITE_MS;
        const lean = Math.sin(p * Math.PI * 2) * 5;
        const munch = p < 0.45 ? 1 + Math.sin(p * Math.PI * 8) * 0.035 : 1;
        svg.style.transform = `translate(${(r.offX + lean).toFixed(1)}px, -2px) scale(${munch.toFixed(3)}, ${(2 - munch).toFixed(3)})`;
        if (!REDUCED && t - (r.lastCrumb || -9999) > SNACK_BITE_MS) {
          r.lastCrumb = t;
          const pip = el('i', { class: 't-snack-crumb' });
          a.wrap.appendChild(pip);
          setTimeout(() => pip.remove(), 700);
        }
        break;
      }
      // LOUNGE (Lounge). Two Boos on a sofa or a rug swap chat pips while they settle in
      // and out of a gentle sway. A lone lounger just relaxes — same rule as the seesaw.
      case 'lounge': {
        const arr = r.socketArrKey ? socketUse.get(r.socketArrKey) : null;
        const together = arr && arr.filter(Boolean).length >= 2;
        const sway = Math.sin(t / 1100 + (r.slot || 0) * 1.7) * 3;
        svg.style.transform = `translate(${(r.offX + sway).toFixed(1)}px, -2px) rotate(${(sway * 0.5).toFixed(1)}deg) scale(0.94)`;
        if (together && !REDUCED && t - (r.lastPip || -9999) > CHAT_PIP_MS) {
          r.lastPip = t;
          // Alternate who is talking, so it reads as a conversation rather than two
          // Boos monologuing at the same instant.
          if ((Math.floor(t / CHAT_PIP_MS) % 2) === (r.slot || 0) % 2) {
            const pip = el('i', { class: 't-chat-pip', text: ['\u2026', '!', '?', '\u2665'][Math.floor(Math.random() * 4)] });
            a.wrap.appendChild(pip);
            setTimeout(() => pip.remove(), 1500);
          }
        }
        break;
      }
      case 'swing': {
        const ang = Math.sin(t / 700) * 20, rad = ang * Math.PI / 180, L = 46;
        // RUN21A-14: baseline +5, not -30. The old -30 lifted the rider to the crossbar
        // while the plank hung empty. Measured live at scale 1 (1024x768): svg-bottom sat
        // 35.2px above the plank line (viewBox y=88); +5 lands it within 0.2px — the +5
        // offsets what scale(0.82) around the svg centre lifts the bottom by. The
        // (1-cos)*L term stays: that is the pendulum's real arc rise while swinging.
        svg.style.transform = `translate(${(r.offX + Math.sin(rad) * L).toFixed(1)}px, ${(5 - (1 - Math.cos(rad)) * L).toFixed(1)}px) rotate(${(ang * 0.55).toFixed(1)}deg) scale(0.82)`;
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
            r.phase = 'burst'; r.burstStart = t; r.burstStartedAt = now;
            const finishAfter = r.outcome === 'catch' ? FISH_CATCH_MS : FISH_BOOT_MS;
            r.finishTimer = setTimeout(() => {
              if (a.role !== r) return;
              benchCooldown.set(r.socketArrKey, performance.now() + FISH_COOLDOWN_MS);
              clearRole(a);
            }, finishAfter + 80);
            if (r.outcome === 'catch') sfx.giggle(); else sfx.trombone();
          }
        } else if (r.phase === 'burst') {
          // Use wall-clock time for the finite reveal. The actor loop clamps large
          // frame gaps for smooth movement; using that clamped total here could make
          // the boot hold its socket indefinitely on a busy or backgrounded tablet.
          const bt = r.burstStartedAt == null ? t - r.burstStart : now - r.burstStartedAt;
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
        // Start from where she actually WAS. The wrap now carries the seat offset (r.slid), so
        // lerping from 0 would start her already at the fire and slide her outwards to the ring.
        svg.style.transform = `translate(${(lerp(-(r.slid || 0), tx, arrive)).toFixed(1)}px, 0px) rotate(${sway.toFixed(1)}deg) scale(${warm.toFixed(3)})`;
        break;
      }
      case 'sit': {
        const settle = Math.min(1, t / 600);
        const kick = settle >= 1 ? Math.sin(t / 1000) * 3 : 0;
        // As with the campfire: the wrap already holds the seat offset, so slide in from
        // -r.slid to 0 rather than from 0 to offX, and the settle onto the seat survives.
        const slideX = lerp(-(r.slid || 0), r.offX, settle);
        svg.style.transform = `translate(${slideX.toFixed(1)}px, ${(-10 * settle).toFixed(1)}px) rotate(${kick.toFixed(1)}deg)`;
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
    const performing = actors.some(a => a.dancing && a.routine && a.routine.length);
    // RUN19 Z2: a stage routine playing in this area is one of the two ways a 'dance'
    // request is satisfied — the other is any visit to the Disco Hall.
    if (performing) fireRequest('routine', { area: STORE_KEY });
    // RUN19 Z4: the first time a saved routine is actually PERFORMED. There was already a
    // `firstRoutine` stamp for SAVING one in the choreographer, which is a different moment —
    // saving is a plan, performing is the thing she made happening in front of her.
    if (performing) stampJournal('routine_first');
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

  // ---- Boo requests (RUN3 C8, rebuilt by RUN19 Z2) ---------------------------------
  // The bubble is no longer a wall of text pinned over a Boo's head: it is a ≥40px thought
  // bubble showing a PICTURE of what is wanted, which bobs, and which OPENS when tapped.
  // The words live in the card, where there is room to read them and something to do.

  // What each request names, resolved for display. Returns null for RUN3's generic
  // templates, which name no object at all (their bubble draws a question mark instead).
  function requestTarget(r) {
    if (!r || !r.kind) return null;
    if (r.accId) return resolveItem(r.accId) || BY_ID[r.accId] || null;
    if (r.itemId) return resolveItem(r.itemId) || BY_ID[r.itemId] || null;
    if (r.targetBooId) return resolveItem(r.targetBooId) || null;
    if (r.kind === 'dance') return BY_ID['deco_stage'] || null;   // the wiggle needs music
    return null;
  }
  // The authored line, with its «placeholders» filled from the save (Z4's displayName).
  function requestLine(r) {
    if (!r) return '';
    if (!r.kind) return r.text || '';
    const verb = VERB_BY_KIND[r.kind];
    if (!verb) return r.text || '';
    const target = requestTarget(r);
    return guideLine(verb.line, {
      booName: getDisplayName(r.booId),
      item: target ? target.name : 'thing',
      accessory: target ? target.name : 'accessory',
      friend: r.targetBooId ? getDisplayName(r.targetBooId) : 'a friend'
    });
  }
  // The node in THIS area a request points at, if any — used for the glow and for the
  // 'try' tap. Matched on id + x so two of the same item never confuse each other.
  function requestTargetNode(r) {
    if (!r || !r.kind) return null;
    if (r.itemId) return [...ground.querySelectorAll('.t-item')].find(n => n.dataset.item === r.itemId && Math.abs(+n.dataset.x - r.itemX) < 0.001) || null;
    if (r.targetBooId) return [...ground.querySelectorAll('.t-item.boo')].find(n => n.dataset.item === r.targetBooId) || null;
    if (r.kind === 'dance') return root.querySelector('.ff-disco-door') || null;
    return null;
  }
  // RUN21D-2: where in THIS area that node stands, as an x-fraction — what the camera needs
  // to take her to it. Null when the request names nothing here (a wardrobe accessory, a
  // friend parked in another area): those keep their existing cross-screen buttons.
  function requestTargetFrac(r) {
    if (!r || !r.kind) return null;
    if (r.kind === 'dance') return root.querySelector('.ff-disco-door') ? DISCO_DOOR_X : null;
    const node = requestTargetNode(r);
    if (!node) return null;
    const x = +node.dataset.x;
    return Number.isFinite(x) ? x : null;
  }

  function renderRequestBubble() {
    ground.querySelectorAll('.request-bubble, .request-treat, .request-thought').forEach(n => n.remove());
    // Bubbles never appear during build mode (Z2 addendum) — she is arranging, not being asked.
    if (!softened) for (const r of activeRequests()) {
      const w = [...ground.querySelectorAll('.t-item.boo')].find(x => x.dataset.item === r.booId);
      if (!w) continue;
      // Never parent a bubble to a hidden wrap: a Boo seated on a funfair ride, or the
      // day's hider, has display:none, and the bubble would render as a 0x0 button the
      // child can see nothing of and tap nowhere. It comes back when the Boo does.
      if (w.style.display === 'none') continue;
      const target = requestTarget(r);
      // RUN21A-12: a kind-less (template) request never renders a bare '?' — each
      // template id carries a meaningful glyph, ⭐ the catch-all for anything unmapped.
      const REQUEST_GLYPHS = { maths: '🔢', spell2: '🔤', paint: '🎨', dressUp: '🎀', box: '🎁', threeStar: '⭐' };
      const art = target
        ? el('div', { class: 'rq-pic', html: renderItem(target, { size: 38 }) })
        : el('div', { class: 'rq-pic rq-ask', text: REQUEST_GLYPHS[r.id] || '⭐' });
      // RUN21D: `data-boo` so a bubble can be found by asker whether it is parented to the
      // Boo's own wrap or floated over a bed — the Pulse and the 6s breathe both need it.
      const bubble = el('button', {
        class: 'request-thought', 'aria-label': requestLine(r), dataset: { boo: r.booId },
        onclick: (e) => { e.stopPropagation(); openRequestCard(r); }
      }, [art]);
      // A napping Boo's wrap is painted behind its bed, and a stacking context takes its
      // children with it — so a bubble parented here would be a 56px tap target hidden under
      // the duvet. Float it over the bed instead, where it can be seen and pressed.
      const sleeper = actors.find(x => x.wrap === w);
      if (wrapIsBehind(sleeper)) overlayOverWrap(w, bubble, { dx: (w.offsetWidth - 56) / 2, dy: -64 });
      else w.appendChild(bubble);
    }
    // RUN3's treat float used to carry the words '💖 Thank you!' itself. Z2's ceremony now
    // SPEAKS those words in the Boo's own bubble, so this printed them a second time — and
    // clipped, as a 33x38px two-line pink fragment stacked above the bubble. It keeps the
    // confetti (the treat really did arrive) and loses the duplicate line.
    const treatBoo = takeTreat();
    if (treatBoo) { const w = [...ground.querySelectorAll('.t-item')].find(x => x.dataset.item === treatBoo); if (w && !REDUCED) confetti({ count: 24, power: 0.6, origin: pointFor(w) }); }
  }
  function pointFor(node) { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; }

  // The request card: the line (spoken), a 48px picture of the wanted thing, and — for the
  // verbs that live on another screen — one button that takes her straight there.
  function openRequestCard(r) {
    sfx.tap();
    const line = requestLine(r);
    const target = requestTarget(r);
    const ov = el('div', { class: 'overlay show request-card-ov' });
    const card = el('div', { class: 'card request-card' });
    if (target) card.appendChild(el('div', { class: 'rq-card-pic', html: renderItem(target, { size: 48 }) }));
    card.appendChild(el('p', { class: 'rq-card-line', text: line }));
    const btns = el('div', { class: 'dialog-btns' });
    const dismiss = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 180); };
    if (r.kind === 'wear') {
      btns.appendChild(el('button', {
        class: 'btn', text: 'Open the wardrobe',
        onclick: () => {
          dismiss();
          const boo = resolveItem(r.booId);
          if (boo) openDressUp(boo, { highlight: r.accId, highlightLabel: 'the one they keep eyeing', onDone: () => { renderPlaced(); } });
        }
      }));
    } else if (r.kind === 'dance') {
      // Cross-screen like `wear`: any visit to the Disco Hall fulfils it, so the card
      // offers the door rather than leaving her to remember where the music is.
      btns.appendChild(el('button', { class: 'btn', text: 'To the Disco Hall', onclick: () => { dismiss(); ctx.go('discohall'); } }));
    } else if (r.kind === 'visit') {
      card.appendChild(el('p', { class: 'rq-card-hint', text: guideLine('request_visit_hint') }));
    }
    // RUN21D-2: the thing she is being asked about is often two screens away in an area four
    // viewports wide, and until now the card said its name and left her to go and hunt for
    // it. When it is HERE, one button takes her to it. Cross-area targets are untouched —
    // they keep the buttons above, and this adds no routing of its own.
    const showFrac = requestTargetFrac(r);
    if (showFrac != null) {
      btns.appendChild(el('button', {
        class: 'btn', text: 'Show me',
        onclick: () => { sfx.tap(); dismiss(); showMeTarget(r, showFrac); }
      }));
    }
    btns.appendChild(el('button', { class: 'btn soft', text: 'Okay!', onclick: () => { sfx.tap(); dismiss(); } }));
    card.appendChild(btns);
    ov.appendChild(card);
    ov.addEventListener('click', e => { if (e.target === ov) dismiss(); });
    document.body.appendChild(ov);
    speakMaybe(line);
    // The target pulses a soft glow twice while the card is open — or nothing at all if
    // what she needs is on another screen, which is exactly what the pack asks for.
    const tn = requestTargetNode(r);
    if (tn && !REDUCED) { tn.classList.remove('rq-glow'); void tn.offsetWidth; tn.classList.add('rq-glow'); setTimeout(() => tn.classList.remove('rq-glow'), 2400); }
  }
  // "Show me": the same 600ms ease everything else in RUN21D pans with, and then a soft ring
  // so the thing she was taken to says "this one" without a word of copy. The ring is drawn
  // after the pan starts, not after it lands — it should already be glowing as it arrives.
  function showMeTarget(r, xFrac) {
    cameraClaimed = true;                 // her camera now — the Pulse stands off it
    panToFrac(xFrac, PULSE_PAN_MS);
    const node = requestTargetNode(r);
    if (!node) return;
    node.classList.remove('rq-ring'); void node.offsetWidth; node.classList.add('rq-ring');
    setTimeout(() => node.classList.remove('rq-ring'), SHOW_ME_RING_MS);
  }

  // ---- fulfilment: the ceremony every verb shares ----------------------------------
  // double bounce → "Thank you!" → the +2 flying to the meter → treat chime (Z2 addendum).
  function playThanks() {
    const thanked = takeThanks();
    if (!thanked.length) return;
    for (const booId of thanked) {
      const w = [...ground.querySelectorAll('.t-item')].find(x => x.dataset.item === booId);
      if (!w) continue;
      // On the WRAP, not the svg. A CSS animation beats an inline style, and the actor loop
      // rewrites the svg's transform every frame — so putting the bounce there discarded the
      // walk offset for 1.2s and then snapped the Boo 60px sideways when it ended. Z3's seat
      // hop already avoided exactly this; the same reasoning belongs here.
      if (!REDUCED) { w.classList.remove('rq-thanks'); void w.offsetWidth; w.classList.add('rq-thanks'); setTimeout(() => w.classList.remove('rq-thanks'), 1300); }
      sayOver(w, 'Thank you!', 2200);
      // The round-end fly, reused: the points visibly LEAVE the Boo. STAGGERED, because the
      // pack authors this as a sequence — bounce, then the thank-you, THEN the points — and
      // firing them together crowded the +2 against the bubble's own words.
      setTimeout(() => {
        if (!w.isConnected) return;
        const fly = el('div', { class: 'fly-star rq-fly', text: '+' + REQUEST_REWARD });
        w.appendChild(fly); setTimeout(() => fly.remove(), 1200);
        sfx.star();
      }, THANKS_FLY_DELAY_MS);
    }
    renderRequestBubble();
  }
  // Every fulfilment event funnels through here so the ceremony can never be forgotten at
  // one call site and remembered at another.
  function fireRequest(event, data) {
    const res = noteRequest(event, data);
    if (res.fulfilled) playThanks(); else renderRequestBubble();
    return res;
  }
  function notePlacement() {
    pruneImpossible();                                    // the friend may have been put away
    fireRequest('placement', { area: STORE_KEY });
  }
  function noteSocketClaim(booId, t) {
    fireRequest('socketClaim', { booId, itemId: t.item, area: STORE_KEY, x: t.x });
  }
  // Called from give() the moment a Boo actually takes a seat.
  // RUN19 Z3 — the announced moment: taking a seat is a state change the child caused and
  // would care about, so it lands as motion + a line + a place to look, never as silent
  // state. The hop is a translateY arc on the outer wrap (the role's own per-frame
  // transform owns the svg, so putting it on the wrap composes instead of fighting).
  // The line is BUDGETED through js/ack.js: lovely once, grating the fourth time.
  function onSocketClaimed(a, role) {
    if (!a || !a.place || !role || !role.deco) return;
    if (!REDUCED) { a.wrap.classList.remove('t-seat-hop'); void a.wrap.offsetWidth; a.wrap.classList.add('t-seat-hop'); setTimeout(() => a.wrap.classList.remove('t-seat-hop'), SEAT_HOP_MS + 60); }
    // "Best seat in the «area name»!" already supplies "the", and four of the eight area
    // names begin with "The" — so the raw name reads "in the The Meadow". Strip the article.
    // ...but NOT for a bed. "Best seat in the Bedroom!" as a Boo climbs in to sleep describes
    // something that did not happen; the nap has its own announced moment.
    if (role.socket && role.socket.role === 'nap') { noteSocketClaim(a.place.item, role.deco); return; }
    const rawName = ROOM ? ROOM.name : AREA.name;
    const line = acknowledge('socketClaim', { areaName: rawName.replace(/^The\s+/i, '') });
    if (line) {
      sayOver(a.wrap, line, 2400);
    }
    noteSocketClaim(a.place.item, role.deco);
  }

  // ---- RUN19 Z4: the acknowledgement pass -------------------------------------------
  // Three lines in which the town notices what SHE made. All three share the ≤2-per-session
  // budget in js/ack.js, so the town is observant rather than chatty.

  // A path tile's own zone-x fraction and depth row, so a wanderer's landing spot can be
  // compared with it. Cells are PATH_CELL of each axis's extent (see cellGeom): across, cx
  // maps straight to a fraction; down, the cell's centre y maps to whichever ROW_GROUND
  // line it is nearest, which is the "same row band" the pack asks for.
  function pathTileAt(c) {
    const { bandTopPx, cellH } = cellGeom();
    const xFrac = (c.cx + 0.5) * PATH_CELL;
    const yPx = bandTopPx + (c.cy + 0.5) * cellH;
    let row = 0, best = Infinity;
    ROWS.forEach((g, i) => { const d = Math.abs(yPx - viewH * g); if (d < best) { best = d; row = i; } });
    return { xFrac, row, style: c.style };
  }
  const PATH_ACK_X = 0.03;   // "within ±3% of any painted path tile" (Z4 addendum)
  // ---- RUN21C-5: Boos use her paths --------------------------------------------------
  const PATH_REACH_X = 0.12;      // "any path cell within 12% of zone width" of where it stands
  const PATH_PULL_CHANCE = 0.6;   // "60% chance its walk target is set along that path run"
  // The dx (px offset from this actor's home) of a spot along the nearest path RUN in this
  // Boo's own depth row, or null when there is no path within reach. Row-filtered because a
  // wanderer walks along its row: a path two rows back is not a path it could pad along.
  // The answer is clamped to the ordinary wander range, so this never widens how far a Boo
  // may roam — it only changes WHICH way it goes inside the range it already had.
  function pathWalkTargetDx(a) {
    const cells = currentPaths();
    if (!cells.length) return null;
    const row = rowOf(a.place);
    const here = a.place.x + ((a.dx || 0) / (zoneW || 1));
    const geom = cellGeom();
    let bestCx = null, bestD = Infinity, style = null;
    const tiles = [];
    for (const c of cells) {
      const yPx = geom.bandTopPx + (c.cy + 0.5) * geom.cellH;
      let r = 0, rb = Infinity;
      ROWS.forEach((g, i) => { const d = Math.abs(yPx - viewH * g); if (d < rb) { rb = d; r = i; } });
      if (r !== row) continue;
      const xFrac = (c.cx + 0.5) * PATH_CELL;
      tiles.push({ cx: c.cx, xFrac, style: c.style });
      const d = Math.abs(xFrac - here);
      if (d <= PATH_REACH_X && d < bestD) { bestD = d; bestCx = c.cx; style = c.style; }
    }
    if (bestCx == null) return null;
    // Walk the contiguous same-style run out from that cell, then aim anywhere along it.
    const has = (cx) => tiles.some(t => t.cx === cx && t.style === style);
    let lo = bestCx, hi = bestCx;
    while (has(lo - 1)) lo--;
    while (has(hi + 1)) hi++;
    const aimFrac = (lo + Math.random() * (hi - lo + 1)) * PATH_CELL;
    const range = zoneW * WANDER_FRAC;
    const dx = Math.max(-range, Math.min(range, (aimFrac - a.place.x) * zoneW));
    return Math.abs(dx - (a.dx || 0)) < 6 ? null : dx;   // already there: take a normal wander
  }
  const PATH_STYLE_WORD = { stone: 'stone', sand: 'sandy', flower: 'flowery' };
  // Called on a wanderer's arrival. Cheap by design: a handful of numeric comparisons, and
  // it stops at the first hit — the budget declines almost every call anyway.
  function maybeAckPath(a) {
    const paths = currentPaths();
    if (!paths.length || !a || !a.item) return;
    const landing = a.place.x + ((a.dx || 0) / (zoneW || 1));
    const row = rowOf(a.place);
    for (const c of paths) {
      const t = pathTileAt(c);
      if (t.row !== row || Math.abs(t.xFrac - landing) > PATH_ACK_X) continue;
      const line = acknowledge('path', { booName: getDisplayName(a.item.id), style: PATH_STYLE_WORD[t.style] || t.style });
      if (!line) return;                                  // budget said no: silence, no retry
      sayOver(a.wrap, line, 2600);
      return;
    }
  }
  // Her painting, on the easel, noticed. Only ever for CUSTOM art — the easel's default
  // pattern is not "one of yours" and saying so would be a lie.
  function maybeAckEasel() {
    if (!getState().easelArt) return;
    if (!ground.querySelector('.t-item[data-item="deco_easel"] image.easel-photo')) return;
    const line = acknowledge('easel');
    if (!line) return;
    const easel = ground.querySelector('.t-item[data-item="deco_easel"]');
    sayOver(easel, line, 3000);
  }

  // ---- RUN19 Z3: the bed nap ---------------------------------------------------------
  // The seat's authored `role` is what makes a claim a NAP, not the item id. data/sockets.js
  // marks both bed sockets `role:'nap'` and, before Z3, nothing read that field at all —
  // it was dead data. Reading it here means a future nap seat gets the behaviour for free.
  function beginNap(a, role) {
    // `napUntil`, NOT `until`: deco_bench already uses role.until, and it stores an ABSOLUTE
    // performance.now() deadline while this is elapsed role.t. One field, two units, is a
    // cross-wiring bug waiting to happen the first time a bench and a bed share a code path.
    role.napUntil = NAP_MIN_MS + Math.random() * (NAP_MAX_MS - NAP_MIN_MS);
    role.lastZ = -9999; role.lastSnore = -9999;
    setSleepingEyes(a, true);
  }
  // Eyes genuinely SHUT, using the authored closed-eye pose (RUN18B Y4's `eyes:'closed'`
  // for catalogue Boos, the `sleepy` eye shape for custom ones) rather than a CSS squash —
  // so a sleeping Boo looks the same here as anywhere else it is ever drawn.
  function setSleepingEyes(a, on) {
    const wrapSvg = a.wrap.querySelector('svg');
    if (!wrapSvg || !a.item) return;
    const base = a.item;
    const posed = !on ? base
      : (base.custom ? { ...base, custom: { ...base.custom, eyes: 'sleepy' } } : { ...base, eyes: 'closed' });
    const keep = wrapSvg.getAttribute('style') || '';
    const cls = [...wrapSvg.classList].join(' ');
    const holder = el('div', { html: renderItem(posed, { size: booSizeFor(a), equipArt: equippedArt(base.id) }) });
    const next = holder.querySelector('svg');
    if (!next) return;
    if (cls) next.setAttribute('class', cls);
    if (keep) next.setAttribute('style', keep);
    next.classList.toggle('t-eyes-shut', !!on);   // a real marker, for CSS and for the suite
    wrapSvg.replaceWith(next);
  }
  function booSizeFor(a) {
    const svg = a.wrap.querySelector('svg');
    const w = svg && svg.getAttribute('width');
    return w ? parseFloat(w) : 92;
  }
  // A "z" that DRIFTS AWAY and is gone, every NAP_Z_MS — one permanent glyph parked over a
  // Boo's ear read as a sticker, not as breathing. Capped by construction: one node alive
  // for the drift's duration, never a queue.
  function puffNapZ(a) {
    if (REDUCED) return;
    const z = el('div', { class: 't-zzz t-zzz-drift', text: 'z' });
    overlayOverWrap(a.wrap, z, { dx: a.wrap.offsetWidth - 20, dy: -10 });
    setTimeout(() => z.remove(), 2100);
  }
  // A node that must be SEEN even though its Boo is deliberately painted behind something.
  // A sleeper's wrap sits at bedZ-1 so the duvet covers its body (RUN19 Z3) — and a wrap with
  // a z-index is a stacking context, so nothing inside it can ever climb out. Measured: the
  // drifting z rendered underneath the bed's own svg. So the node goes into `ground` instead,
  // positioned over the wrap and z-indexed above whatever is hiding it.
  function overlayOverWrap(wrap, node, { dx = 0, dy = 0 } = {}) {
    const left = parseFloat(wrap.style.left) || 0;
    const top = parseFloat(wrap.style.top) || 0;
    node.style.position = 'absolute';
    node.style.left = (left + dx) + 'px';
    node.style.top = (top + dy) + 'px';
    node.style.right = 'auto';   // the class positions from the right inside a wrap; not here
    node.style.zIndex = String((parseInt(wrap.style.zIndex || '0', 10) || 0) + 4);
    ground.appendChild(node);
    return node;
  }
  // Is this wrap currently painted BEHIND the thing it is sitting on? (Only a nap is.)
  const wrapIsBehind = (a) => !!(a && a.role && a.role.socket && a.role.socket.role === 'nap');
  // Waking is gentle, always (rule 1, no grumpiness): a stretch, and — when it was HER tap
  // that woke it — a yawn to say the tap did something.
  function wakeNap(a, { tapped }) {
    if (!a.role || a.role.kind !== 'housenap') return false;
    a.wrap.querySelectorAll('.t-zzz').forEach(n => n.remove());
    clearRole(a);   // opens the eyes (see clearRole)
    a.wakeUntil = performance.now() + WAKE_MS;   // no instant re-nap
    const svg = a.wrap.querySelector('svg');
    if (svg && !REDUCED) { svg.classList.remove('t-nap-stretch'); void svg.offsetWidth; svg.classList.add('t-nap-stretch'); setTimeout(() => svg.classList.remove('t-nap-stretch'), NAP_STRETCH_MS + 60); }
    if (tapped) sfx.yawn();
    return true;
  }
  function noteItemTap(place) {
    const booIds = areaItems(getState()).filter(t => (t.item || '').startsWith('boo_') || (t.item || '').startsWith('custom:')).map(t => t.item);
    fireRequest('itemTap', { itemId: place.item, area: STORE_KEY, x: place.x, booIds });
  }

  // ---- scrolling (momentum) ----------------------------------------------
  function applyScroll() {
    ground.style.transform = `translateX(${-scrollX}px)`;
    hills.style.transform = `translateX(${-scrollX * 0.55}px)`;
    sky.style.transform = `translateX(${-scrollX * 0.22}px)`;
    air.style.transform = `translateX(${-scrollX}px)`;
    updateZoneMusic();
    updateDots();          // RUN21D-3: the dots track every pan, hers or the town's
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
  // RUN21D — ONE smooth-pan primitive. The pulse, "Show me", the landmark dots, the fair's
  // signs and the hider's fair chance all want the same thing: take the camera somewhere,
  // gently, in a stated number of milliseconds. They all go through here rather than each
  // growing its own easing loop (and its own reduced-motion bug). `panRaf` is held so a
  // second pan cancels the first instead of the two fighting over scrollX.
  let panRaf = null;
  // Set the moment the child takes the camera somewhere herself (a drag, "Show me", a
  // landmark dot, a fair sign). Read by the Pulse, which then never pans on top of her.
  let cameraClaimed = false;
  function panToPx(target, ms = PULSE_PAN_MS) {
    target = Math.max(0, Math.min(target, Math.max(0, worldW - viewW)));
    if (panRaf) { cancelAnimationFrame(panRaf); panRaf = null; }
    if (REDUCED || !ms) { scrollX = target; clampScroll(); applyScroll(); return; }
    const from = scrollX, t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);                 // ease-out: arrives, never overshoots
      scrollX = from + (target - from) * e; clampScroll(); applyScroll();
      panRaf = p < 1 ? requestAnimationFrame(step) : null;
    };
    panRaf = requestAnimationFrame(step);
  }
  // Centre an area x-fraction. Single-zone areas since RUN10 P1, so zone 0 always.
  function panToFrac(xFrac, ms = PULSE_PAN_MS) { panToPx(xFrac * zoneW - viewW / 2, ms); }
  function fracOnScreen(xFrac, pad = 60) {
    const px = xFrac * zoneW - scrollX;
    return px > pad && px < viewW - pad;
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
    if (e.target.closest('.t-item') || e.target.closest('.t-signpost') || e.target.closest('.ff-ride') || e.target.closest('.ff-bandstand') || e.target.closest('.ff-disco-door') || e.target.closest('.ff-sign') || e.target.closest('.t-shop-stall')) return; // interactive scenery handles its own taps
    // RUN20 W2: a tap on the right PART of the scene is this area's own secret. It runs before
    // the scroll drag starts, and only when it actually matched something — a miss falls
    // straight through to the normal pan, so the scene never feels sticky.
    if (!placeMode && areaSignature(e.clientX, e.clientY)) return;
    // RUN21C-2: a drag on the ground paints only while the Path Pot is actually in her hand.
    if (potHeld) {
      painting = true;
      beginStroke();
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
    // RUN19 Z6: while she is holding a small item, the slot under her finger glows, so the
    // surface announces itself BEFORE she commits — the pack's "the slot glows; release seats it".
    if (placeMode && holding && isSmall(holding)) showSlotGlow(nearestFreeSlot(e.clientX, e.clientY));
    if (!dragScroll) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 4) { movedScroll = true; cameraClaimed = true; }   // RUN21D-1: her camera now
    scrollX = sScroll - dx; clampScroll(); applyScroll();
    const now = performance.now(); const dt = now - lastT;
    if (dt > 0) vel = (e.clientX - lastX) / dt;
    lastX = e.clientX; lastT = now;
  });
  const endScroll = (e) => {
    if (painting) {
      painting = false; endStroke();
      // RUN21C-2: a stroke that ends on the drawer is her putting the Pot back.
      if (potHeld && overDrawer(e.clientX, e.clientY)) putPotAway();
      return;
    }
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
  viewport.addEventListener('pointercancel', () => { dragScroll = false; painting = false; endStroke(); });
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
  function canPlaceIn(zi) { const z = ZONES[zi]; return !!z && totalStars() >= z.unlock; }
  // Which depth row a drop lands in — nearest of the three ground lines (C3).
  function rowAtClient(cy) {
    const r = viewport.getBoundingClientRect();
    const yf = (cy - r.top) / (r.height || 1);
    let best = 1, bd = Infinity;
    ROWS.forEach((g, i) => { const d = Math.abs(yf - g); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // Minimum spacing (C3): no piling two items on top of each other in a zone+row.
  function spotTaken(zi, x, row, except) {
    return areaItems(getState()).some(t => t !== except && (ZONE_INDEX[t.zone] ?? 0) === zi && rowOf(t) === row && Math.abs(t.x - x) < MIN_SPACING);
  }
  // Wall-hung items (RUN10 P4) live in their own lane — never compared against floor rows.
  function wallSpotTaken(x, except) {
    // RUN19 Z6: keyed off the PLANE now. Two wall items at the same x but different heights are
    // no longer a collision — that is the whole point of a draggable y — so the comparison also
    // needs their y bands to overlap before it calls the spot taken.
    return areaItems(getState()).some(t => t !== except && isWallPlane(t) && Math.abs(t.x - x) < MIN_SPACING);
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
  // RUN20 W1: a sky wish held indoors says the authored tip rather than the generic refusal.
  function skyNeededWobble() {
    drawer.classList.remove('taken'); void drawer.offsetWidth; drawer.classList.add('taken');
    setTimeout(() => drawer.classList.remove('taken'), 600);
    hint.textContent = INDOOR_TIP;
    speakMaybe(INDOOR_TIP);
    if (sfx.oops) sfx.oops();
  }
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
    const rowGroundPx = viewH * ROWS[spot.row];
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
      // RUN20 W1 changes this: a wish is no longer BLANKET outdoor-only. Only the sky items and
      // the two tethered flyers need sky; a wished teapot or book belongs in a room as much as
      // anywhere. "Everything else places anywhere its kind allows today" — the addendum.
      const outdoorOnly = heldItem.kind === 'landscape' || (heldItem.kind === 'wish' && wishNeedsSky(heldItem.id)) || !!heldItem.act;
      const indoorOnly = heldItem.kind === 'furniture';
      if (outdoorOnly && AREA.kind !== 'outdoor') {
        if (heldItem.kind === 'wish' && wishNeedsSky(heldItem.id)) skyNeededWobble(); else notIndoorsWobble();
        return;
      }
      if (indoorOnly && AREA.kind !== 'interior') { notOutdoorsWobble(); return; }
    }
    if (areaFull()) { areaFullWobble(); return; }
    // Wall-hung furniture (RUN10 P4): its own single-row lane, no depth-row Y choice.
    if (heldItem && heldItem.wall) {
      const wallX = wallSpotTaken(x) ? nearestLegalWallSpot(x) : x;
      if (wallX == null) { spotWobble(); return; }
      const id = holding;
      // `at` (RUN19 Z2): when this thing was put here. The 'try' request needs "placed
      // within the last day" and nothing in the save recorded that before now. Absent on
      // every pre-Z2 placement, which reads correctly as "not new".
      let placedId = null;
      mutate(st => { placedId = nextPlacementId(st); areaItems(st).push({ id: placedId, zone: ZONES[zi].key, x: +wallX.toFixed(3), row: WALL_ROW, plane: 'wall', y: clampWallY(WALL_Y_FRAC), item: id, scale: holdingScale, at: nowMs() }); });
      pushUndo('place', [], [{ id: placedId, zone: ZONES[zi].key, x: +wallX.toFixed(3), row: WALL_ROW, item: id }]);   // RUN21C-7
      holdingScale = 1;
      holding = null; placeMode = false;
      renderPlaced(); renderDrawer(); updateHint();
      sfx.pop();
      notePlacement();
      return;
    }
    // RUN19 Z6 — SURFACE DROP. A small item released within SLOT_SNAP_PX of a free slot seats
    // itself ON that surface rather than on the floor beside it. Anywhere else places on the
    // floor exactly as before, so nothing about the old behaviour changes.
    if (isSmall(holding)) {
      const near = nearestFreeSlot(cx, cy);
      if (near) {
        const id = holding;
        let placedId = null;
        mutate(st => { placedId = nextPlacementId(st); areaItems(st).push({ id: placedId, zone: ZONES[zi].key, x: +near.xFrac.toFixed(3), row: near.row, plane: 'surface', parent: near.parentId, slot: near.slot, item: id, scale: holdingScale, at: nowMs() }); });
        pushUndo('place', [], [{ id: placedId, zone: ZONES[zi].key, x: +near.xFrac.toFixed(3), row: near.row, item: id }]);   // RUN21C-7
        holdingScale = 1; holding = null; placeMode = false;
        clearSlotGlow();
        renderPlaced(); renderDrawer(); updateHint();
        notePlacement();
        hint.textContent = `On the ${resolveItem(near.parentItem)?.name || 'shelf'}!`;
        sfx.pop();
        return;
      }
    }
    const row = rowAtClient(cy);
    const landing = spotTaken(zi, x, row) ? nearestLegalSpot(zi, x, row) : { x, row };
    if (!landing) { spotWobble(); return; }
    const id = holding;
    let placedId = null;
    mutate(st => { placedId = nextPlacementId(st); areaItems(st).push({ id: placedId, zone: ZONES[zi].key, x: +landing.x.toFixed(3), row: landing.row, plane: 'floor', item: id, scale: holdingScale, at: nowMs() }); });
    pushUndo('place', [], [{ id: placedId, zone: ZONES[zi].key, x: +landing.x.toFixed(3), row: landing.row, item: id }]);   // RUN21C-7
    holdingScale = 1;
    holding = null; placeMode = false;
    clearSlotGlow();
    renderPlaced(); renderDrawer(); updateHint();
    notePlacement();
    if (landing.x !== x || landing.row !== row) hint.textContent = 'Tucked into the nearest free spot!';
    // RUN21A-1: placing a Boo somewhere new hops it off any funfair ride it was on —
    // one Boo, one place. (placeAtClient is the single funnel for every new placement:
    // tap-to-place, the chip-lift drop and ctx.placeAt all land here.)
    const seated = isSeated(id);
    if (seated) {
      unseatBoo(seated.ride, id);
      renderFunfair();
      hint.textContent = getDisplayName(id) + ' hopped off the ' + RIDE_NAME[seated.ride] + ' to come here!';
    }
    sfx.pop();
  }

  // ---- RUN19 Z6: slot targeting while dragging ------------------------------------------
  // The nearest FREE slot to a client point, or null. Screen-space, because that is what a
  // finger is in — the same reason drop previews are computed in pixels rather than fractions.
  function nearestFreeSlot(cx, cy, exclude) {
    const r = viewport.getBoundingClientRect();
    const worldX = (cx - r.left) + scrollX, worldY = cy - r.top;
    let best = null, bestD = Infinity;
    for (const s of freeSurfaceSlots(getState(), exclude)) {
      const d = Math.hypot(s.x - worldX, s.y - worldY);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best || bestD > SLOT_SNAP_PX) return null;
    const parent = areaItems(getState()).find(p => pidOf(p) === best.parentId);
    return { ...best, xFrac: parent ? parent.x : 0, row: parent ? rowOf(parent) : 1 };
  }
  // The soft --star ring on the slot she is hovering. One node, reused, never a queue.
  let slotGlow = null;
  function showSlotGlow(slot) {
    if (!slot) { clearSlotGlow(); return; }
    if (!slotGlow) { slotGlow = el('div', { class: 't-slot-glow' }); air.appendChild(slotGlow); }
    slotGlow.style.left = (slot.x - 22) + 'px';
    slotGlow.style.top = (slot.y - 22) + 'px';
    slotGlow.classList.add('show');
  }
  function clearSlotGlow() { if (slotGlow) slotGlow.classList.remove('show'); }

  // ---- RUN21C-8: what a drawer chip SAYS ------------------------------------------------
  // One line under the name, in the pack's exact words, and only when it is TRUE.
  //  · `Seats <n> Boos` is driven by data/sockets.js, not by the catalogue's `act` flag: the
  //    sandpit, climbing frame and roundabout are act items with no sockets at all, and
  //    "Seats 0 Boos" is a lie printed at a child. The bench and the pond have sockets
  //    without an `act`, and for them the line is both true and the useful thing to know.
  //  · DEVIATION, logged: the pack's template is `Seats <n> Boos`, which prints "Seats 1
  //    Boos" for the swings, the pond and the bumper car. One-seat items say "Seats 1 Boo".
  //    Everything else is the template verbatim.
  //  · moon / owl / campfire are named individually in the pack, so their line wins over the
  //    more general ones — including `Needs the sky`, which the moon would otherwise take.
  const NIGHT_LOVELY = new Set(['wish_moon', 'wish_owl', 'deco_campfire']);
  function chipInfoLine(id, item) {
    if (NIGHT_LOVELY.has(id)) return 'Loveliest after dark';
    if (item && item.kind === 'wish' && wishNeedsSky(id)) return 'Needs the sky';
    const seats = (SOCKETS[id] || []).length;
    if (seats > 0) return seats === 1 ? 'Seats 1 Boo' : `Seats ${seats} Boos`;
    if (isSmall(id)) return 'Sits on tables and shelves';
    return null;
  }
  // ---- RUN21C-8 CHANGE A: the Wishes strip, under headed rows ---------------------------
  // Sixty wishes on one endless sideways ribbon is a haystack. The strip becomes a column of
  // named rows; only rows with something in them survive the render (pruneEmptyWishGroups).
  const wishGroupNodes = new Map();
  function wishGroupRow(word) {
    const group = WISH_GROUPS.find(g => g.words.includes(word)) || WISH_GROUPS.find(g => g.label === WISH_GROUP_FALLBACK);
    const label = group ? group.label : WISH_GROUP_FALLBACK;
    if (!wishGroupNodes.has(label)) {
      const row = el('div', { class: 'wish-group-row' });
      const block = el('div', { class: 'wish-group', dataset: { group: label } }, [
        el('div', { class: 'wish-group-h', text: label }), row
      ]);
      wishGroupNodes.set(label, { block, row });
    }
    return wishGroupNodes.get(label).row;
  }
  // Rebuilt in the authored order every render, so the rows never drift about as she unlocks.
  function pruneEmptyWishGroups() {
    const strip = drawerStrips.wishes;
    strip.classList.add('wish-grouped');
    for (const g of WISH_GROUPS) {
      const held = wishGroupNodes.get(g.label);
      if (held && held.row.children.length) strip.appendChild(held.block);
    }
    wishGroupNodes.clear();
  }

  function renderDrawer() {
    wishGroupNodes.clear();
    const st = getState();
    const placed = {};
    for (const t of areaItems(st)) placed[t.item] = (placed[t.item] || 0) + 1;
    const free = {};
    for (const [id, n] of Object.entries(st.inventory)) {
      // accessories are worn; a path STYLE (RUN21C-4) is a way of drawing, not a thing to
      // put down — it belongs in the Pot's style row, never as a drawer chip.
      const rit = resolveItem(id); if (!rit || rit.kind === 'accessory' || rit.kind === 'path') continue;
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
    for (const word of Object.keys(((st.wishes || {}).unlocked) || {}).filter(word => st.wishes.unlocked[word])) {
      const id = wishId(word);
      free[id] = LANDSCAPE_STOCK - (placed[id] || 0);
    }
    const ids = Object.keys(free);
    if (holding && !ids.includes(holding)) ids.unshift(holding);
    const tabButtons = drawer.querySelectorAll('.bd-tabs .bd-tab');
    // RUN19 Z6: every strip EXCEPT decorate. That one holds wallpaper swatches, not inventory
    // chips, so renderDrawer has nothing to say about it — clearing it here wiped the tab
    // every time an item was placed.
    for (const [id, strip] of Object.entries(drawerStrips)) { if (id !== 'decorate') clear(strip); }
    // RUN21C-2: the Path Pot is a PERMANENT first chip in Landscape — a tool, not stock, so
    // it is not in `free` and never runs out. Outdoors only, like the tab that holds it.
    if (AREA.kind === 'outdoor') drawerStrips.landscape.appendChild(potChip());
    // Landscape items don't count toward "she hasn't collected anything yet" — that empty
    // state is about Boos/decorations she's still working to win.
    const nonLandscapeIds = ids.filter(id => { const it = resolveItem(id); return !it || it.kind !== 'landscape'; });
    if (!nonLandscapeIds.length && !holding) {
      DRAWER_TABS_SPEC.forEach((spec, i) => {
        // ...but not Decorate (RUN19 Z6): wallpaper is not something she has to win first, and
        // "win games to collect Boos" is simply untrue there.
        if (spec.id !== 'decorate' && !drawerStrips[spec.id].children.length) drawerStrips[spec.id].appendChild(el('div', { class: 'drawer-empty', text: 'Win games to collect Boos, then place them here! 🌱' }));
        if (tabButtons[i]) tabButtons[i].textContent = spec.label;
      });
      return;
    }
    const counts = DRAWER_TABS_SPEC.map(() => 0);
    for (const id of ids) {
      const item = resolveItem(id);
      // A drawer chip is pure artwork, so without a label a screen reader announces a bare
      // "button". Name it after the item (its nickname when she has given one). (Audit.)
      const chipName = getDisplayName(id) || (item && item.name) || 'item';
      // Landscape and wish items are UNLIMITED by design (LANDSCAPE_STOCK, a sentinel).
      // The count badge was printing that sentinel at a child: every tree, rock and
      // flowerbed wore "x999", and the Joke Boo's stage wore "x998". She does not own 999
      // oak trees. An unlimited item simply shows no count. (RUN18A H3, Craftsman's
      // Mandate — found while proving the drawer's LABEL, which turned out to be correct.)
      const unlimited = item && (item.kind === 'landscape' || item.kind === 'wish');
      const showCount = !unlimited && free[id] > 1;
      // RUN20 W1 addendum: a sky wish indoors is greyed AT THE CHIP with "needs the sky!",
      // not only refused on drop. wishRefusedIndoors() was written for exactly this and then
      // never called from anywhere — so indoors the Sun looked perfectly placeable, and the
      // child only found out by picking it up, carrying it in, and being told no. Saying it
      // on the chip is the difference between a rule and a rebuff. (RUN20 QA finding B.)
      const skyOnly = wishRefusedIndoors(id);
      // RUN21C-8: the chip says what it IS and what it DOES. The old chip was art and nothing
      // else — a child had to pick a thing up to learn whether it could be sat on.
      const info = chipInfoLine(id, item);
      const chip = el("button", { class: 'drawer-item' + (holding === id ? ' holding' : '') + (skyOnly ? ' needs-sky' : ''), dataset: { item: id },
        'aria-label': skyOnly ? `${chipName} — ${INDOOR_TIP}` : (showCount ? `${chipName} (${free[id]})` : chipName),
        title: skyOnly ? INDOOR_TIP : null,
        onclick: () => { if (skyOnly) { skyChipNudge(chip, chipName); return; } selectHold(id); } }, [
        el('div', { class: 'drawer-art', html: renderItem(item, { size: 60, equipArt: item.kind === 'boo' ? equippedArt(item.id) : null }) }),
        el('span', { class: 'drawer-name', text: chipName }),
        info ? el('span', { class: 'drawer-info', text: info }) : null,
        showCount ? el('span', { class: 'drawer-badge', text: 'x' + free[id] }) : null
        // RUN21C-8: the old absolute-positioned "sky only" tag is gone — the info line under
        // the name says `Needs the sky` for exactly the same chips, in the pack's own words,
        // and two labels saying one thing over each other is what "polish" is here to fix.
      ]);
      // drag-to-lift is delegated to the strip's own pointer handler (attachStripMomentum,
      // RUN10 P2) — it decides scroll-vs-lift by gesture direction since chips tile edge-to-edge
      const ti = DRAWER_TABS_SPEC.findIndex(spec => spec.test(item));
      const spec = DRAWER_TABS_SPEC[ti] || DRAWER_TABS_SPEC[2];   // fall back to Decorations
      // RUN21C-8 CHANGE A: the Wishes strip is grouped under headed rows, so a wish chip goes
      // into its group's row rather than onto one endless ribbon.
      if (spec.id === 'wishes') wishGroupRow(wordOfWishId(id)).appendChild(chip);
      else drawerStrips[spec.id].appendChild(chip);
      counts[ti >= 0 ? ti : 2]++;
    }
    pruneEmptyWishGroups();
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
    renderDrawer(); updateHint(); updateSoftened();
    // close the tray so it stops covering the ground once she's picked something (RUN10 P2).
    // RUN21A-10: NOT shielded — this close exists to hand her the ground, and her very next
    // tap is the placement. Shielding it ate that tap for up to 400ms.
    if (holding) drawerApi.close({ shield: false });
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
    let track = strip;    // RUN21C-8: what a sideways drag actually scrolls (a wish group row, or the strip)
    strip.addEventListener('pointerdown', e => {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      downChip = e.target.closest ? e.target.closest('.drawer-item') : null;
      // RUN21C-8: the grouped Wishes strip is a COLUMN of rows. A gesture that did not start
      // on a chip is her scrolling that column, so this handler keeps out of the way entirely
      // and lets the browser do it — capture here would swallow the scroll.
      if (!downChip && strip.classList.contains('wish-grouped')) { phase = 'idle'; return; }
      // ...and inside a group, the thing that scrolls sideways is the ROW, not the strip.
      track = (downChip && downChip.closest('.wish-group-row')) || strip;
      phase = 'deciding'; sx = e.clientX; sy = e.clientY; startScroll = track.scrollLeft; vel = 0; lastX = e.clientX; lastT = performance.now();
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
        // RUN21C-2: dragging the Path Pot off the strip lifts it AND starts the stroke, so
        // one gesture goes from the tray to the ground without a stop in between.
        else if (downChip.dataset.item === PATH_POT_ID) { phase = 'potpaint'; liftPot(); beginStroke(); }
        else { phase = 'lift'; beginChipLift(downChip, downChip.dataset.item); }
      }
      if (phase === 'scroll') {
        track.scrollLeft = startScroll - dx;
        const now = performance.now(); const dt = now - lastT;
        if (dt > 0) vel = (e.clientX - lastX) / dt;
        lastX = e.clientX; lastT = now;
      } else if (phase === 'lift') {
        updateChipLift(e.clientX, e.clientY);
      } else if (phase === 'potpaint') {
        paintAtClient(e.clientX, e.clientY);   // out of the band = a no-op, so the tray is safe
      }
    });
    const end = (e) => {
      if (phase === 'scroll') {
        let v = vel * 16;
        const t = track;
        if (Math.abs(v) >= 0.5 && !REDUCED) (function mom() { t.scrollLeft -= v; v *= 0.94; if (Math.abs(v) > 0.4) raf = requestAnimationFrame(mom); })();
      } else if (phase === 'lift') {
        endChipLift(e.clientX, e.clientY);
      } else if (phase === 'potpaint') {
        endStroke();
        if (overDrawer(e.clientX, e.clientY)) putPotAway();   // released over the drawer = away
      }
      phase = 'idle'; downChip = null;
    };
    strip.addEventListener('pointerup', end);
    strip.addEventListener('pointercancel', () => { if (phase === 'lift') cancelChipLift(); endStroke(); phase = 'idle'; downChip = null; });
  }

  // ---- RUN19 Z5: Sprinkle, on the unified play-mode long-press card -------------------
  // Stardust has quietly accumulated since RUN4 C8 with exactly one thing to spend it on
  // (10 for a shiny Boo, buried in a collection card). Z5 gives it a second, cheaper spend
  // that lives in the town where she can see the result: 5 dust makes a placed thing sparkle
  // until the end of the day.
  //
  // The card is deliberately ONE component. RUN20 W1 adds "Pick up & move" for its wandering
  // wish actors to the SAME card — the cross-run wiring note is explicit that there must
  // never be two competing long-press behaviours on a placed item.
  let longPressTimer = null;
  // RUN21F F5 (save v24): a sparkle is stamped against the placement's id. It used to be
  // `zone:x:item`, so moving a sprinkled bench lost its sparkle for the rest of the day and
  // sprinkling it again cost another five dust. `null` for a record with no id — sparkleDayOf
  // then reads nothing, which is the safe answer.
  const placementIdOf = (place) => { const pid = pidOf(findPlacement(place) || place); return pid == null ? null : String(pid); };
  function sparkleDayOf(place) {
    const key = placementIdOf(place);
    if (key == null) return null;
    const sp = (getState().sparkles) || {};
    return sp[key] || null;
  }
  function isSparkling(place) { return sparkleDayOf(place) === todayKeyLocal(); }
  function openPlayCard(wrap, place, item) {
    const s = getState();
    const dust = s.stardust || 0;
    const name = getDisplayName(place.item) || item.name;
    const options = [];
    if (dust >= SPRINKLE_COST && !isSparkling(place)) options.push('sprinkle');
    // RUN20 W1 appends 'catch' here for a wandering wish actor. Nothing else goes on this card.
    if (!options.length) {
      // Never a dead long press: say why there is nothing to offer, and what would change it.
      hint.textContent = isSparkling(place)
        ? `${name} is already sparkling today! ✨`
        : `Sprinkling costs ✨${SPRINKLE_COST} stardust — you have ✨${dust}.`;
      sfx.tap();
      return;
    }
    sfx.tap();
    const ov = el('div', { class: 'overlay show play-card-ov' });
    const card = el('div', { class: 'card play-card' });
    card.appendChild(el('div', { class: 'pc-pic', html: renderItem(item, { size: 48 }) }));
    card.appendChild(el('h3', { class: 'pc-name', text: name }));
    const btns = el('div', { class: 'dialog-btns' });
    const dismiss = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 180); };
    if (options.includes('sprinkle')) {
      btns.appendChild(el('button', {
        class: 'btn', text: `✨ Sprinkle (${SPRINKLE_COST} stardust)`,
        onclick: () => { dismiss(); confirmSprinkle(wrap, place, item, name); }
      }));
    }
    btns.appendChild(el('button', { class: 'btn soft', text: 'Not now', onclick: () => { sfx.tap(); dismiss(); } }));
    card.appendChild(btns);
    ov.appendChild(card);
    ov.addEventListener('click', e => { if (e.target === ov) dismiss(); });
    document.body.appendChild(ov);
  }
  function confirmSprinkle(wrap, place, item, name) {
    dialog({
      title: `Sprinkle stardust on ${name}? ✨${SPRINKLE_COST}`,
      body: '',
      buttons: [{ label: 'Yes please!', value: true }, { label: 'Not now', value: false, kind: 'soft' }],
      dismissable: true
    }).then(yes => {
      if (!yes) return;
      const dust = (getState().stardust || 0);
      if (dust < SPRINKLE_COST) { hint.textContent = `Not quite enough stardust — you have ✨${dust}.`; return; }
      const id = placementIdOf(place), day = todayKeyLocal();
      if (id == null) return;
      mutate(st => {
        st.stardust = (st.stardust || 0) - SPRINKLE_COST;
        st.sparkles = st.sparkles || {};
        st.sparkles[id] = day;
      });
      sfx.star();
      if (!REDUCED) confetti({ count: 22, power: 0.5, origin: pointFor(wrap) });
      applySparkles();
      hint.textContent = `${name} is sparkling! ✨`;
    });
  }
  // Paint the sparkle onto every placement whose stamp is TODAY, and drop yesterday's stamps
  // on sight — that is how "expires at local midnight" is enforced without a timer that would
  // have to survive a backgrounded tablet.
  function applySparkles() {
    const day = todayKeyLocal();
    const sp = (getState().sparkles) || {};
    const stale = Object.keys(sp).filter(k => sp[k] !== day);
    if (stale.length) mutate(st => { for (const k of stale) delete st.sparkles[k]; });
    let painted = 0;
    for (const wrap of ground.querySelectorAll('.t-item')) {
      const id = wrap.dataset.pid;   // RUN21F F5: the placement id renderPlaced stamped on the wrap
      const on = !!id && sp[id] === day && painted < SPARKLE_SCENE_CAP;
      wrap.classList.toggle('t-sprinkled', on);
      if (on) painted++;
    }
  }

  // ---- placed-item pointer: tap (squeak+menu) or drag-move ----------------
  function attachItemPointer(wrap, born, item) {
    // RUN21F F5: a wrap now OUTLIVES the record it was created for. renderPlaced matches wraps
    // by placement id, so the same node survives a move instead of being torn down and rebuilt,
    // and the undo stack replaces records wholesale with fresh objects. Every handler therefore
    // reads the placement through the wrap's `_placeRef`, which renderPlaced re-stamps on every
    // pass, rather than through the object this listener was born holding.
    const placeNow = () => wrap._placeRef || born;
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
      // RUN19 Z5 — the PLAY-mode long press. ONE card, shared with RUN20 W1's catching (the
      // cross-run wiring note is explicit that there must never be two competing long-press
      // behaviours here). Build mode keeps its own tap menu; this is for playing.
      clearTimeout(longPressTimer);
      if (!softened) longPressTimer = setTimeout(() => {
        if (!down || moved) return;
        down = false;
        try { wrap.releasePointerCapture(e.pointerId); } catch {}
        openPlayCard(wrap, placeNow(), item);
      }, LONG_PRESS_MS);
    });
    const onWall = !!item.wall;
    wrap.addEventListener('pointermove', e => {
      if (!down) return;
      if (!moved && Math.hypot(e.clientX - dsx, e.clientY - dsy) > 10) {
        moved = true; wrap.classList.add('dragging');
        clearTimeout(longPressTimer);   // a drag is not a long press (RUN19 Z5)
      }
      if (moved) {
        const { zi, x } = zoneAndXAt(clientToWorld(e.clientX));
        // RUN19 Z6 — a WALL item's vertical drag. RUN10 P4 pinned every wall item to one fixed
        // height; the pack retires that. Horizontal as before, vertical clamped LIVE to the
        // authored 0.18-0.42 band so she can feel the ends of it rather than discovering them.
        const wallY = onWall ? clampWallY((e.clientY - viewport.getBoundingClientRect().top) / (viewH || 1)) : null;
        const row = onWall ? WALL_ROW : rowAtClient(e.clientY);
        const rowGroundPx = onWall ? viewH * wallY : viewH * ROWS[row];
        wrap.style.left = (zi * zoneW + x * zoneW - wrap.offsetWidth / 2) + 'px';
        wrap.style.top = (rowGroundPx - wrap.offsetHeight + 8) + 'px';   // preview the depth row
        wrap.style.zIndex = onWall ? '1' : String(Math.round(rowGroundPx));
        wrap.dataset._zi = zi; wrap.dataset._x = x; wrap.dataset._row = String(row);
        if (onWall) wrap.dataset._y = String(wallY);
        // ...and a small item being moved gets the same slot glow a newly-held one does.
        const live = findPlacement(placeNow());
        if (isSmall(placeNow().item)) showSlotGlow(nearestFreeSlot(e.clientX, e.clientY, live));
        if (!onWall) {
          showDropPreview(wrap, zi, x, row, live);   // illegal-drop tint + nearest-legal ghost (RUN10 P2)
        }
      }
    });
    wrap.addEventListener('pointerup', e => {
      clearTimeout(longPressTimer);
      if (!down) return; down = false;
      wrap.classList.remove('dragging');
      hideDropPreview(wrap);
      if (moved) {
        const zi = +wrap.dataset._zi, x = +wrap.dataset._x, row = +wrap.dataset._row;
        const place = placeNow();
        // RUN21F F5: the live record is found by ID. The three positional lookups this replaces
        // matched on `x` — the very field a drag is about to change — which is why they had to
        // run BEFORE the mutate and could never be re-taken after it.
        const cur = findPlacement(place);
        // RUN19 Z6 — released over a free slot? Then it SEATS there rather than landing on the
        // floor. Checked before the floor logic, and only for a small item, so nothing else
        // about dragging changes.
        const seat = isSmall(place.item) ? nearestFreeSlot(e.clientX, e.clientY, cur) : null;
        const moveBefore = snapPlacement(cur);   // RUN21C-7: where it was, with everything on it
        if (seat && canPlaceIn(zi)) {
          mutate(st => {
            const items = areaItems(st);
            const t = items.find(t => t === cur) || findPlacement(place, items);
            if (t) {
              t.zone = ZONES[zi].key; t.x = +seat.xFrac.toFixed(3); t.row = seat.row; t.plane = 'surface'; t.parent = seat.parentId; t.slot = seat.slot; delete t.y;
              moveChildrenWith(items, t);   // RUN21F F5: anything on it comes too
            }
          });
          clearSlotGlow();
          hint.textContent = `On the ${resolveItem(seat.parentItem)?.name || 'shelf'}!`;
          notePlacement();
          if (moveBefore) pushUndo('move', [moveBefore], [{ id: pidOf(cur), zone: ZONES[zi].key, x: +seat.xFrac.toFixed(3), row: seat.row, item: place.item }]);   // RUN21C-7
          keepResizeHandle(cur || { zone: ZONES[zi].key, x: +seat.xFrac.toFixed(3), item: place.item });   // RUN21C-6
          renderPlaced();
          return;
        }
        const taken = onWall ? wallSpotTaken(x, cur) : spotTaken(zi, x, row, cur);
        const landing = onWall
          ? { x: taken ? nearestLegalWallSpot(x, cur) : x, row: WALL_ROW }
          : (taken ? nearestLegalSpot(zi, x, row, cur) : { x, row });
        if (canPlaceIn(zi) && landing && landing.x != null) {
          const wallY = onWall ? clampWallY(+wrap.dataset._y) : null;
          mutate(st => {
            const items = areaItems(st);
            const t = items.find(t => t === cur) || findPlacement(place, items);
            if (t) {
              t.zone = ZONES[zi].key; t.x = +landing.x.toFixed(3); t.row = landing.row;
              // Z6: dragging a thing off a surface makes it a floor item again — it stops being
              // anyone's child, or it would keep rendering at its old parent's shelf.
              if (onWall) { t.plane = 'wall'; t.y = wallY; }
              else { t.plane = 'floor'; delete t.y; }
              delete t.parent; delete t.slot;
              // RUN21F F5 — THE ITEM: whatever is standing ON this thing travels with it. The
              // child keeps its `parent` id, so it re-renders seated at the new position; this
              // only keeps its stored x in step, which is what makes a later put-away ground it
              // where the table ENDED UP rather than where it started.
              moveChildrenWith(items, t);
            }
          });
          if (taken) hint.textContent = 'Tucked into the nearest free spot!';
          notePlacement();   // a 'visit' request may have just become true (RUN19 Z2)
          if (moveBefore) pushUndo('move', [moveBefore], [{ id: pidOf(cur), zone: ZONES[zi].key, x: +landing.x.toFixed(3), row: landing.row, item: place.item }]);   // RUN21C-7
          // RUN21C-6: the handle is there the moment she lets go, for four seconds, so
          // "move it, then make it bigger" needs nothing in between.
          keepResizeHandle(cur || { zone: ZONES[zi].key, x: +landing.x.toFixed(3), item: place.item });
        } else if (canPlaceIn(zi)) {
          spotWobble();   // occupied — snap back
        }
        clearSlotGlow();
        renderPlaced();
      } else {
        onTap(wrap, placeNow(), item);
      }
    });
    wrap.addEventListener('pointercancel', () => { clearTimeout(longPressTimer); down = false; wrap.classList.remove('dragging'); hideDropPreview(wrap); clearSlotGlow(); });   // RUN21B-4
  }

  function onTap(wrap, place, item) {
    if (item.kind === 'boo') {
      const napper = actors.find(x => x.wrap === wrap);
      const wasNapping = !!(napper && napper.role && napper.role.kind === 'housenap');
      squeak(wrap, item);
      if (!wasNapping) showCareArc(wrap, place, item);   // Z3: waking it IS the moment
      return;
    }
    // RUN19 Z3 — a tap anywhere on a bed with somebody asleep in it WAKES THEM. The sleeper
    // is drawn behind the bed on purpose (the duvet covers it), which means every pixel of it
    // hit-tests as the bed: a real finger could never wake a napping Boo, and the bed's
    // Move/Put away menu opened over the top instead. The suite missed it by calling the
    // tapActor seam rather than clicking. Waking is the moment here, so nothing else runs.
    const sleeper = actors.find(a => a.role && a.role.kind === 'housenap' && a.role.deco
      && a.role.deco.item === place.item && Math.abs(a.role.deco.x - place.x) < 0.001);
    if (sleeper) { wakeNap(sleeper, { tapped: true }); return; }
    // RUN19 Z2: "«name» wants to try the new «item»!" is fulfilled by a tap on that exact
    // item while «name» is in the area — before anything else this tap might open.
    noteItemTap(place);
    // RUN20 W1: every wish has a verb now. It runs INSTEAD of the item menu, because a wished
    // thing that opens "Move / Put away" when you poke it is the dead prop this run removes.
    if (!softened && wishTap(wrap, place, item)) return;
    if (item.id === 'deco_wishwell') { openWellHere(wrap); return; }
    if (item.id === 'deco_jokestage') { sfx.tap(); ctx.go('jokeboo', { from: 'town' }); return; }   // RUN17 X1; `from` added RUN18A H3 so Back returns to the Meadow, not the hub
    if (item.id === 'deco_pond') spawnPondRipple(wrap);   // tap the pond anytime (RUN10 P3)
    openMenu(wrap, place, item);
  }

  // The one way into the Wish Well overlay. Every entry point routes through here — the
  // Today-rail card (`params.openWishWell`), tapping the well in the scene, and the QA hook —
  // so a rename can never again leave one of them calling a function that does not exist
  // (RUN12 S1: `params.openWishWell` called `openWishWellOverlay()`, which never existed).
  // `wellWrap` is optional: the card route opens the well even if the landmark has been put
  // away, and the wish then spawns beside the well only when there is a well to spawn beside.
  function openWellHere(wellWrap = null) {
    const well = wellWrap || ground.querySelector('.t-item[data-item="deco_wishwell"]');
    sfx.chime(2);
    openWishWell({
      onSpawn: (word, wished, info) => {
        grantWishIntoWorld(well, word, wished, (info && info.wasNew) !== false);
        renderDrawer();
        updateDrawerTabs();
      },
      // Back to the town exactly as she left it: the drawer and build strip may both be
      // stale (a wish can unlock a new item), and the well keeps the focus ring.
      onClose: () => {
        renderDrawer();
        updateDrawerTabs();
        if (well && typeof well.focus === 'function') { try { well.focus({ preventScroll: true }); } catch {} }
      }
    });
    return !!well;
  }

  // ---- RUN18B Y3: the wish ARRIVES ------------------------------------------------------
  // It used to be filed. A toast said "New wish: RAINBOW! (in your Build drawer)" and a
  // decorative sprite drifted beside the well for twenty seconds and then deleted itself.
  // Nothing she could keep, nothing she could move, nothing she had to be there for.
  //
  // Now: a beat, a puff of star-dust at a real free spot, the thing scaling into being, and
  // Twiggy saying so — and what lands is a REAL PLACEMENT she can drag now or leave, and
  // put away from the long-press menu like anything else she owns.
  const WISH_BEAT_MS = 300;        // the pause before it happens; the moment needs a breath
  const WISH_PUFF_MS = 500;
  const WISH_PUFF_PARTICLES = 24;
  const WISH_GROW_MS = 350;        // 0 -> 1.05 -> 1.0

  // Nearest free x to THE MIDDLE OF THE CAMERA on row 1 — not the middle of the area.
  //
  // The area is four viewports wide. "Nearest x to 0.5" is the middle of the BAND, which
  // is up to ~1000px outside the window she is actually looking through: the playtest
  // critic measured the wish and its 24-particle puff landing 954px off the right edge at
  // 1024x768, with the camera never panning. A moment she cannot see is not a moment
  // (CLAUDE.md, announced moments), so the search starts from where she is looking and
  // walks outwards from there.
  function freeWishSpot() {
    const zi = 0, row = 1;
    const STEP = MIN_SPACING * 0.5;
    const centre = zoneW > 0 ? Math.max(0.04, Math.min(0.96, (scrollX + viewW / 2) / zoneW)) : 0.5;
    for (let d = 0; d <= 1; d += STEP) {
      for (const x of (d === 0 ? [centre] : [centre - d, centre + d])) {
        if (x < 0.04 || x > 0.96) continue;
        if (!spotTaken(zi, x, row)) return { x: +x.toFixed(3), row };
      }
    }
    return null;
  }

  function grantWishIntoWorld(wellWrap, word, wished = wishItem(word), wasNew = true) {
    // A repeat wish never duplicates a placement: she already has one in the world or in
    // her drawer, and silently making a second is the app deciding for her.
    if (!wasNew) {
      if (wellWrap) sparkleAtNode(wellWrap);
      // RUN21A-4: no toast for a duplicate — the well itself says the line, in its own
      // line slot where she is already looking (wishwell.js owns that moment now).
      return { repeat: true };
    }
    // An indoor room is not where a wish goes; the Meadow is (the pack's own fallback).
    if (AREA.kind !== 'outdoor') return { deferred: 'indoors' };

    const spot = freeWishSpot();
    if (!spot) {
      // The area genuinely cannot take it. Say so in as many words rather than dropping it
      // silently into a drawer she has to go and find.
      sayInWorld('Your wish is in your Build drawer — the Meadow is packed!');
      return { deferred: 'full' };
    }
    const id = wishId(word);
    // LIVING WISHES ARE UNCHANGED (the pack says so, and it is right): the butterfly still
    // flutters away over three seconds and the fish still swims to the pond, because those
    // are authored moments, not placeholder decoration. The flourish plays AND the thing
    // still lands as something she keeps — Y3 replaces the FILING, not the magic.
    if (wellWrap && LIVING_WISHES.includes(word)) spawnWishBesideWell(wellWrap, word, wished);
    setTimeout(() => {
      if (!ground.isConnected) return;
      wishPuffAt(spot);
      mutate(st => { areaItems(st).push({ id: nextPlacementId(st), zone: AREA.key, x: spot.x, row: spot.row, item: id }); });
      renderPlaced();
      const node = ground.querySelector(`.t-item[data-item="${id}"]`);
      if (node && !REDUCED) { node.classList.remove('wish-arrive'); void node.offsetWidth; node.classList.add('wish-arrive'); }
      sayInWorld('Your wish came true!');
      renderDrawer(); updateDrawerTabs();
    }, REDUCED ? 0 : WISH_BEAT_MS);
    return { placed: spot, id };
  }

  // 24 particles of --star and white. Reduced motion gets the arrival without the shower:
  // a single scale-in, which is the information without the movement.
  function wishPuffAt(spot) {
    if (REDUCED) return;
    // Same geometry renderPlaced uses, so the puff happens exactly where the thing lands.
    const px = spot.x * zoneW, py = viewH * ROWS[spot.row];
    const puff = el('div', { class: 'wish-puff' });
    puff.style.left = `${px}px`; puff.style.top = `${py}px`;
    for (let i = 0; i < WISH_PUFF_PARTICLES; i++) {
      const a = (Math.PI * 2 * i) / WISH_PUFF_PARTICLES + Math.random() * 0.2;
      const r = 26 + Math.random() * 42;
      const bit = el('i', { class: 'wish-bit' + (i % 2 ? ' pale' : '') });
      bit.style.setProperty('--dx', `${Math.cos(a) * r}px`);
      bit.style.setProperty('--dy', `${Math.sin(a) * r - 12}px`);
      bit.style.setProperty('--d', `${(i % 6) * 22}ms`);
      puff.appendChild(bit);
    }
    ground.appendChild(puff);
    setTimeout(() => puff.remove(), WISH_PUFF_MS + 260);
  }

  function sparkleAtNode(node) {
    try { const b = node.getBoundingClientRect(); sparkleAt(b.left + b.width / 2, b.top + b.height / 2); } catch {}
  }

  // ---- RUN21B-2: episodic wish idles ------------------------------------------------------
  // The continuous idles (FLIER, BOB) are CSS loops on the wishidle-* class and cost nothing
  // to schedule. These are the ones that happen NOW AND THEN, so they need pacing: a wisp of
  // steam every 20-30s, a sparkle pass every 25-40s, the whale's spout once every 45s.
  //
  // Two caps, both modelled on the species-idle pattern (maybeIdle): a per-item next-due time
  // kept on the wrap, and one shared rolling-minute scene cap so a room full of teapots never
  // becomes weather. REDUCED never idles at all — the static pose IS the reduced experience.
  let wishIdleLog = [];
  function wishIdleDue(wrap, now, cls) {
    if (wrap._wishIdleNextAt == null) {
      // Stagger first-due across the scene so everything placed in one go does not fire in
      // lockstep on the same tick.
      const [lo, hi] = cls === 'WHALE' ? [WHALE_SPOUT_MS, WHALE_SPOUT_MS] : (WISH_IDLE_EPISODIC[cls] || [25000, 40000]);
      wrap._wishIdleNextAt = now + lo * 0.3 + Math.random() * (hi - lo * 0.3);
      return false;
    }
    return now >= wrap._wishIdleNextAt;
  }
  function armNextWishIdle(wrap, now, cls) {
    const [lo, hi] = cls === 'WHALE' ? [WHALE_SPOUT_MS, WHALE_SPOUT_MS] : (WISH_IDLE_EPISODIC[cls] || [25000, 40000]);
    wrap._wishIdleNextAt = now + lo + Math.random() * Math.max(0, hi - lo);
  }
  function playWishIdle(wrap, cls) {
    const svg = wrap.querySelector('svg');
    if (cls === 'GLEAM') { sparkleAtNode(wrap); return true; }
    if (cls === 'STEAM' || cls === 'WHALE') {
      // A wisp: three soft pips rising off the top of the thing. Named wish-wisp, NOT
      // wish-steam — that class already exists as the teapot's TAP pose and would collide.
      for (let i = 0; i < 3; i++) {
        const pip = el('i', { class: 'wish-wisp' + (cls === 'WHALE' ? ' wish-wisp-spout' : '') });
        pip.style.left = (34 + i * 14) + '%';
        pip.style.animationDelay = (i * 180) + 'ms';
        wrap.appendChild(pip);
        setTimeout(() => pip.remove(), 1800 + i * 180);
      }
      if (svg) { svg.classList.remove('wish-wobble'); void svg.offsetWidth; svg.classList.add('wish-wobble'); setTimeout(() => svg.classList.remove('wish-wobble'), 740); }
      return true;
    }
    return false;
  }
  function pumpWishIdles() {
    if (REDUCED) return;
    const now = performance.now();
    wishIdleLog = wishIdleLog.filter(t => now - t < 60000);   // the rolling minute
    for (const wrap of ground.querySelectorAll('.t-wish')) {
      if (wishIdleLog.length >= WISH_IDLE_SCENE_PER_MIN) break;   // scene cap, shared
      if (wrap.style.display === 'none') continue;
      const id = wrap.dataset.item;
      const word = wordOfWishId(id);
      const idle = wishIdleClass(id, isNight(currentHour()));
      // The whale is a BOB that also spouts; its spout is on its own 45s clock.
      const cls = (word === 'whale') ? 'WHALE' : idle;
      if (cls !== 'STEAM' && cls !== 'GLEAM' && cls !== 'WHALE') continue;
      // offscreen things do not perform (the same courtesy stepActors extends to actors)
      const px = parseFloat(wrap.style.left) - scrollX;
      if (px < -140 || px > viewW + 140) continue;
      if (!wishIdleDue(wrap, now, cls)) continue;
      if (playWishIdle(wrap, cls)) { wishIdleLog.push(now); armNextWishIdle(wrap, now, cls); }
    }
  }
  // Twiggy, in the world — shown and spoken, so a voice-off house gets the same moment.
  function sayInWorld(text) {
    speakMaybe(text);
    // ONE line at a time — the H4 lesson again: a second moment replaces the first rather
    // than stacking behind it, so she is never reading two things that disagree.
    // On <body>, not inside the town: the well's overlay is z-index 1500 and the town's
    // own layers top out around 60, so a line rendered in the scene measured 0% VISIBLE in
    // every configuration the critic tried — including the packed-Meadow fallback, whose
    // string was exactly right in the DOM and invisible on screen. With the voice muted,
    // an ordinary state, the whole wish produced nothing she could perceive.
    document.querySelectorAll('.wish-said').forEach(old => old.remove());
    const note = el('div', { class: 'wish-said', role: 'status', text });
    document.body.appendChild(note);
    setTimeout(() => note.classList.add('show'), 20);
    setTimeout(() => { note.classList.remove('show'); setTimeout(() => note.remove(), 260); }, 2600);
  }

  function spawnWishBesideWell(wellWrap, word, wished = wishItem(word)) {
    ground.querySelectorAll(`.wish-town-spawn[data-word="${word}"]`).forEach(n => n.remove());
    const spawn = el('div', {
      class:`wish-town-spawn living-${word}`,
      dataset:{word},
      html:renderItem(wished, {size:92})
    });
    const left = parseFloat(wellWrap.style.left) + wellWrap.offsetWidth * .82;
    const top = parseFloat(wellWrap.style.top) + wellWrap.offsetHeight * .28;
    spawn.style.left = `${left}px`; spawn.style.top = `${top}px`;
    if (word === 'fish') {
      const pond = ground.querySelector('.t-item[data-item="deco_pond"]');
      spawn.classList.add(pond ? 'fish-to-pond' : 'fish-puddle-plop');
      if (pond) {
        const dx = parseFloat(pond.style.left) - left;
        const fishX = Math.max(-360, Math.min(360, dx));
        spawn.style.setProperty('--fish-x', `${fishX}px`);
        spawn.style.setProperty('--fish-x25', `${fishX * .25}px`);
        spawn.style.setProperty('--fish-x62', `${fishX * .62}px`);
      }
    }
    ground.appendChild(spawn);
    setTimeout(() => spawn.remove(), 20000);
    return spawn;
  }

  let careArcTimer = null;
  // RUN21A-6: while a Boo's care arc is open, that Boo holds still — the arc rides on the
  // wrap, so a wandering Boo used to walk its own choices out from under her finger.
  let careHold = null;
  function clearCareArc() {
    ground.querySelectorAll('.town-care-arc').forEach(n => n.remove());
    if (careArcTimer) clearTimeout(careArcTimer);
    careArcTimer = null;
    careHold = null;
    ground.classList.remove('care-open');
  }
  function showCareArc(wrap, place, item) {
    clearCareArc();
    careHold = wrap;   // set AFTER clearCareArc(), which nulls it
    ground.classList.add('care-open');
    // RUN13 T1: the flourish reads its actions from care.js so Bath (and anything after it)
    // cannot be added in one place and forgotten in the other.
    const actions = careActions().map(a => [a.id, a.icon, a.label]);
    const arc = el('div', { class: 'town-care-arc', 'aria-label': `Care for ${getDisplayName(item.id)}` });
    actions.forEach(([id, icon, label], i) => {
      const button = el('button', {
        // RUN13 T2: an explicit position class, not :nth-child — the arc now carries a
        // meta pill and a manage button too, and a stray child must not shuffle the fan.
        class: `town-care-action action-${id} pos-${i + 1}`,
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
    // RUN13 T2: the flourish states the relationship and the pocket inline, so a child
    // can see how the friendship is going without opening anything.
    const treats = (getState().care && getState().care.treats) || 0;
    arc.appendChild(el('div', {
      class: 'town-care-meta',
      'aria-label': `${bondLevel(item.id)} of 5 friendship hearts, ${treats} treats`
    }, [
      el('span', { html: heartsMarkup(item.id) }),
      el('span', { class: 'town-care-treats', text: `🍪 ${treats}` })
    ]));
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
    // RUN19 Z3: a NAPPING Boo ignores everything except being woken. A tap wakes it with a
    // stretch and a yawn and that is the whole interaction — no squeak, no catchphrase, no
    // care arc on top, because "I woke it up" is the moment and stacking three more
    // reactions on it buries that.
    const napper = actors.find(x => x.wrap === wrap);
    if (napper && napper.role && napper.role.kind === 'housenap') { wakeNap(napper, { tapped: true }); return; }
    wakeIfSleeping(wrap);
    // a tap always interrupts a chosen behaviour (C1) — including a claimed activity
    // socket (RUN10 P2): the Boo drops what it was doing and the seat frees for the next.
    const a = actors.find(x => x.wrap === wrap);
    if (a && a.waitUntil != null) endWait(a);
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
    // Personality catchphrase (RUN10 P5): 45% of taps (CATCHPHRASE_RATE, raised from 0.2 by
    // RUN19 Z2 — a Boo you tap should mostly say something), spoken via a guide-style bubble on
    // the Boo herself, not the guide's own avatar — it's HER line, not the guide's.
    if (item.kind === 'boo' && Math.random() < CATCHPHRASE_RATE) {
      // RUN20 W3: a pirate says "Yarr!" instead of its temperament's line — capped by the SAME
      // catchphrase rate, so a costume changes what she says and never how often.
      const cos = costumeFor(item.id);
      const phrase = (cos && cos.id === 'acc_set_pirate') ? 'Yarr!' : CATCHPHRASES[personalityOf(item.id)];
      if (phrase) {
        sayOver(wrap, phrase, 2200);
      }
    }
  }

  let openPopover = null;
  // RUN19 Z6: the clamp ceiling is per item now, and an ABSOLUTE scale can be written (which
  // is what a drag produces). 'reset' still means 100%.
  function setPlacementScale(place, mode) {
    const item = resolveItem(place.item);
    const max = scaleMaxFor(item, isInterior);
    const current = itemScaleOf(place, max);
    const beforeSnap = liveRecord(place);   // RUN21C-7
    const next = mode === 'reset' ? 1
      : (typeof mode === 'number' && Math.abs(mode) > 1.0001) ? Math.max(ITEM_SCALE_MIN, Math.min(max, mode))
      : Math.max(ITEM_SCALE_MIN, Math.min(max, current + mode * ITEM_SCALE_STEP));
    writeScale(place, next);
    if (beforeSnap && Math.abs((beforeSnap.scale != null ? beforeSnap.scale : 1) - next) > 0.001) {
      pushUndo('resize', [beforeSnap], [liveRecord(place)]);
    }
    commit();   // a deliberate town edit: persist now, not on the 2s debounce (RUN11 Q9)
    closeMenu();
    renderPlaced();
    hint.textContent = `${resolveItem(place.item)?.name || getDisplayName(place.item)} size: ${Math.round(next * 100)}%`;
    sfx.tap();
    return next;
  }
  function writeScale(place, next) {
    mutate(st => {
      const items = areaItems(st);
      const target = items.find(t => t.item === place.item && t.zone === place.zone && Math.abs(t.x - place.x) < 0.001 && t.row === place.row);
      if (target) target.scale = +next.toFixed(2);
    });
  }
  // ---- RUN19 Z6: the resize handle ------------------------------------------------------
  // A RESIZE_RING_PX ring at the item's bottom-right while it is selected. Drag it, or pinch
  // the item itself with two fingers; RESIZE_DRAG_SPAN px of travel covers the whole clamp
  // range, so the gesture is the same length whatever an individual item's limits are.
  // Reduced motion is unaffected on purpose: this is direct manipulation, not animation.
  // ---- RUN21C-7: session undo, five steps ----------------------------------------------
  // Rearranging a town is fiddly and a nine-year-old's finger is not precise. Every edit she
  // makes — placing, moving, putting away, resizing, and a batch of path painting — records
  // a {before, after} pair of the placements it actually touched, and an `Undo` chip offers
  // to take the last one back for six seconds.
  //
  // Deliberately NOT persisted and deliberately per-area: the stack lives in this mount's
  // closure, so walking out of the Meadow clears it, which is exactly the pack's rule and
  // also the honest one — an undo that reaches back into yesterday is not an undo.
  // No redo: one direction, five steps, no state to explain.
  const UNDO_MAX = 5, UNDO_CHIP_MS = 6000;
  const undoStack = [];
  let undoChip = null, undoChipTimer = null;
  const snapPlacement = (t) => t ? JSON.parse(JSON.stringify(t)) : null;
  // RUN21F F5: the ID decides, when both sides have one — a snapshot taken before a move and
  // the record after it now agree on WHO they are even though every position field differs.
  // That is what makes the stack round-trip ids: `before` restores the placement complete with
  // its id (so anything seated on it is still seated on it), and `after` is found and removed by
  // that same id rather than by a position the undo has just changed. The positional fallback
  // stays for id-less records (QA-synthesised `place` objects, pre-migrate fixtures).
  const samePlacement = (t, r) => {
    if (!t || !r) return false;
    if (t.id != null && r.id != null) return t.id === r.id;
    return t.item === r.item && t.zone === r.zone
      && Math.abs((t.x || 0) - (r.x || 0)) < 0.0015 && rowOf(t) === rowOf(r);
  };
  // `before` and `after` are arrays of placement snapshots (or, for kind 'paths', of cells).
  function pushUndo(kind, before, after) {
    undoStack.push({ kind, before: (before || []).map(snapPlacement), after: (after || []).map(snapPlacement) });
    while (undoStack.length > UNDO_MAX) undoStack.shift();
    showUndoChip();
  }
  function undoOnce() {
    const step = undoStack.pop();
    if (!step) { hideUndoChip(); return false; }
    sfx.tap();
    if (step.kind === 'paths') {
      const restore = step.before.map(c => ({ cx: c.cx, cy: c.cy, style: c.style }));
      mutate(st => { areaItems(st); st.town.areas[STORE_KEY].paths = restore.map(c => ({ ...c })); });
      commit();
      lastCommittedPaths = restore;
      if (pendingPaths) pendingPaths = restore.map(c => ({ ...c }));
      renderPaths();
    } else {
      mutate(st => {
        const items = areaItems(st);
        for (const a of step.after) { const i = items.findIndex(t => samePlacement(t, a)); if (i >= 0) items.splice(i, 1); }
        for (const b of step.before) {
          const restored = JSON.parse(JSON.stringify(b));
          items.push(restored);
          // RUN21F F5: the snapshot carries its ID, so a restored table is the SAME table as far
          // as everything standing on it is concerned — and putting it back is a move like any
          // other, so its children's stored positions come back with it.
          moveChildrenWith(items, restored);
        }
      });
      commit();
      renderPlaced(); renderDrawer();
    }
    updateHint();
    showUndoChip();   // "re-shows if steps remain" — showUndoChip hides itself when empty
    return true;
  }
  function showUndoChip() {
    if (!undoStack.length) { hideUndoChip(); return; }
    if (!undoChip) {
      undoChip = el('button', { class: 't-undo-chip', type: 'button', text: 'Undo', 'aria-label': 'Undo',
        onclick: (e) => { e.stopPropagation(); undoOnce(); } });
      undoChip.addEventListener('pointerdown', e => e.stopPropagation());   // never starts a pan or a stroke
      viewport.appendChild(undoChip);
    }
    undoChip.classList.add('show');
    clearTimeout(undoChipTimer);
    undoChipTimer = setTimeout(hideUndoChip, UNDO_CHIP_MS);
  }
  function hideUndoChip() {
    clearTimeout(undoChipTimer); undoChipTimer = null;
    if (undoChip) undoChip.classList.remove('show');
  }
  // A PHOTOGRAPH of the record in the save that matches this placement right now — the thing
  // an undo has to take before an edit, and take again after one. It must be a copy: the
  // resize path writes straight into the live record, so handing back a reference meant
  // "before" and "after" were the same object and the step recorded no change at all.
  const liveRecord = (place) => snapPlacement(findPlacement(place));

  // ---- RUN21C-6: the resize handle without the mode -------------------------------------
  // The handle used to need build mode to exist. Now it attaches whenever an item's MENU
  // opens (openMenu, unconditionally), and for RESIZE_LINGER_MS after any move-drag ends —
  // so "drag the bench, then make it bigger" is one gesture followed by another, with no
  // mode in between. Behaviour, range and the double-tap reset are untouched.
  //
  // It lives as a REMEMBERED PLACEMENT rather than a DOM node, because half a dozen paths
  // (the drag itself, a resize commit, an actor claiming a seat) call renderPlaced() and
  // rebuild every wrap. renderPlaced re-attaches it from this record; the timer forgets it.
  const RESIZE_LINGER_MS = 4000;
  let lingerResize = null, lingerResizeTimer = null;
  function keepResizeHandle(t) {
    if (!t || !t.item) return;
    lingerResize = { id: pidOf(t), zone: t.zone, x: t.x, row: t.row, item: t.item };
    clearTimeout(lingerResizeTimer);
    lingerResizeTimer = setTimeout(() => {
      lingerResize = null;
      ground.querySelectorAll('.t-resize').forEach(n => n.remove());
    }, RESIZE_LINGER_MS);
    applyLingerResize();
  }
  function applyLingerResize() {
    if (!lingerResize) return;
    const t = findPlacement(lingerResize);
    if (!t) return;
    const w = wrapFor(t), it = resolveItem(t.item);
    if (w && it) attachResizeHandle(w, t, it);
  }
  function attachResizeHandle(wrap, place, item) {
    wrap.querySelectorAll('.t-resize').forEach(n => n.remove());
    const max = scaleMaxFor(item, isInterior);
    const clampTo = (v) => Math.max(ITEM_SCALE_MIN, Math.min(max, v));
    const label = resolveItem(place.item) ? resolveItem(place.item).name : 'item';
    const ring = el('button', { class: 't-resize', type: 'button', 'aria-label': `Resize ${label} — drag, or double-tap to reset` });
    let dragging = false, startScale = 1, sx = 0, sy = 0, beforeSnap = null;
    ring.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      dragging = true; startScale = itemScaleOf(place, max); sx = e.clientX; sy = e.clientY;
      beforeSnap = liveRecord(place);   // RUN21C-7: the size it was before this drag
      try { ring.setPointerCapture(e.pointerId); } catch {}
      ring.classList.add('dragging');
    });
    ring.addEventListener('pointermove', e => {
      if (!dragging) return;
      e.stopPropagation();
      // Away from the item's centre = bigger. The two axes are summed so either one works,
      // which matters on a phone where a diagonal drag off a corner is awkward.
      const d = (e.clientX - sx) + (e.clientY - sy);
      const next = clampTo(startScale + (d / RESIZE_DRAG_SPAN) * (max - ITEM_SCALE_MIN));
      writeScale(place, next);
      applyLiveSize(wrap, place, next);
      hint.textContent = `${label} size: ${Math.round(next * 100)}%`;
    });
    const finish = (e) => {
      if (!dragging) return;
      dragging = false;
      ring.classList.remove('dragging');
      try { ring.releasePointerCapture(e.pointerId); } catch {}
      commit();
      const afterSnap = liveRecord(place);
      if (beforeSnap && afterSnap && (beforeSnap.scale || 1) !== (afterSnap.scale || 1)) pushUndo('resize', [beforeSnap], [afterSnap]);
      beforeSnap = null;
      keepResizeHandle(place);   // RUN21C-6: still adjusting — the handle stays another 4s
      renderPlaced();            // re-clamps anything sitting on this surface
      sfx.tap();
    };
    ring.addEventListener('pointerup', finish);
    ring.addEventListener('pointercancel', finish);
    ring.addEventListener('dblclick', e => { e.stopPropagation(); setPlacementScale(place, 'reset'); });
    // Two-finger pinch on the ITEM, not on the ring: hunting for a 28px target with two
    // fingertips is not something a nine-year-old should have to do.
    const active = new Map();
    let pinchStart = 0;
    // RUN21C-6: the pinch is live for as long as the handle is — the handle's own lifetime
    // (menu open, or 4s after a move) is the gate now, not a mode.
    wrap.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') active.set(e.pointerId, e); }, true);
    wrap.addEventListener('pointermove', e => {
      if (!active.has(e.pointerId)) return;
      active.set(e.pointerId, e);
      if (active.size < 2) return;
      const two = [...active.values()];
      const d = Math.hypot(two[0].clientX - two[1].clientX, two[0].clientY - two[1].clientY);
      if (!pinchStart) { pinchStart = d; startScale = itemScaleOf(place, max); beforeSnap = liveRecord(place); return; }
      const next = clampTo(startScale * (d / pinchStart));
      writeScale(place, next);
      applyLiveSize(wrap, place, next);
    }, true);
    const endPinch = (e) => {
      if (!active.has(e.pointerId)) return;
      active.delete(e.pointerId);
      if (active.size < 2 && pinchStart) {
        pinchStart = 0; commit();
        const afterSnap = liveRecord(place);
        if (beforeSnap && afterSnap && (beforeSnap.scale || 1) !== (afterSnap.scale || 1)) pushUndo('resize', [beforeSnap], [afterSnap]);
        beforeSnap = null;
        renderPlaced();
      }
    };
    wrap.addEventListener('pointerup', endPinch, true);
    wrap.addEventListener('pointercancel', endPinch, true);
    wrap.appendChild(ring);
    // ...and then FLIP IT UP if the bottom-right corner falls under the build drawer. It
    // usually does: build mode always has the drawer open across the bottom of the screen, and
    // anything in the front rows sits behind it, so the authored bottom-right position was a
    // handle a child could see and never touch. Same precedent as openMenu, which already
    // flips itself below the item when it would clip the top edge.
    const placeRing = () => {
      if (!ring.isConnected) return;
      // The drawer's ROOT sits low; what actually covers things is its open TRAY, which starts
      // much higher up. Take whichever is higher, or the check passes while the tray is over
      // the handle (measured: root top 708, tray top 531, handle bottom 582).
      //
      // RUN21B item 3: and the build-mode TOOL ROWS, which run down the viewport's right edge
      // at mid-height. They never mattered while furniture was small, because the flipped-up
      // handle stayed below them. Re-baselined furniture is up to 40% taller, so a selected bed
      // put its handle squarely under the path-style buttons — measured, elementFromPoint at
      // the ring's own centre returned `.t-style-btn`, so every drag went to the toolbar and
      // the child could see a handle she could not move. Both candidate positions are now
      // tested and the free one wins, instead of flipping up unconditionally.
      // The test is not "does the handle's box overlap a list of panels" but the thing that
      // actually matters: WOULD A PRESS ON IT LAND ON IT. elementFromPoint answers exactly
      // that, and answers it for the drawer, its tabs, its transition shield, the tool rows
      // and any other item's wrap at once — a list of named panels was always going to keep
      // acquiring one more panel. Off-screen returns null, which counts as blocked.
      const reachable = () => {
        const r = ring.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit && (hit === ring || ring.contains(hit));
      };
      // Four corners, best first: the authored bottom-right, then up, then the two on the LEFT
      // side, which are what clear the right-edge build tool rows. A re-baselined bed at
      // 1024x700 blocks BOTH right-hand corners at once — drawer tabs under the bottom-right,
      // path-style buttons over the top-right — and before item 3 grew the furniture, flipping
      // up unconditionally was enough. Falling back to the default would hand the child a
      // handle she can see and cannot press, which is the exact defect Z6's flip was added for.
      const corners = [[], ['up'], ['up', 'left'], ['left']];
      let chosen = corners[0];
      for (const c of corners) {
        ring.classList.remove('up', 'left');
        if (c.length) ring.classList.add(...c);
        if (reachable()) { chosen = c; break; }
      }
      ring.classList.remove('up', 'left');
      if (chosen.length) ring.classList.add(...chosen);
    };
    // Twice: once now, and once after the drawer has finished sliding. Build mode OPENS the
    // drawer, so at the first frame after selection its tray is still travelling and its
    // transition shield is still up — the first pass sees a clear bottom-right corner that is
    // covered by tabs 200ms later. 480ms clears the tray's 220ms slide and the shield's 400ms
    // safety timeout both.
    requestAnimationFrame(placeRing);
    setTimeout(placeRing, 480);
  }
  // Resize this one wrap in place, without re-rendering the area, so the drag stays smooth.
  function applyLiveSize(wrap, place, scale) {
    const onWall = isWallPlane(place);
    const row = onWall ? WALL_ROW : rowOf(place);
    const base = onWall ? (ACT_SIZE[place.item] || 92) : (ACT_SIZE[place.item] || 92) * ROW_SCALE[row];
    const size = base * scale;
    const groundPx = onWall ? viewH * clampWallY(place.y != null ? place.y : WALL_Y_FRAC) : viewH * ROWS[row];
    const px = (ZONE_INDEX[place.zone] ?? 0) * zoneW + clamp01(place.x) * zoneW;
    wrap.style.left = (px - size / 2) + 'px';
    wrap.style.top = (groundPx - size + 8) + 'px';
    const svg = wrap.querySelector('svg');
    if (svg) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size * 130 / 120)); }
    wrap.dataset.scale = String(scale.toFixed(2));
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
    // RUN19 Z6 — the three ± / % buttons are GONE. Resizing is direct manipulation now: a
    // corner handle appears on the selected item and she drags it (or pinches on touch). The
    // buttons were three taps and a number to do what one drag does, and they had to be read
    // first. The one thing they did that a drag cannot — snap back to 100% — survives as a
    // double-tap on the handle.
    // RUN21C-6: the handle attaches whenever this menu opens, in the ordinary world. There
    // is no mode to be in first.
    attachResizeHandle(wrap, place, item);
    btns.push(el('button', { class: 'btn soft', text: 'Move', onclick: (e) => { e.stopPropagation(); pickUp(place); } }));
    if (item.id !== 'deco_bffportrait') btns.push(el('button', { class: 'btn soft', text: 'Put away', onclick: (e) => { e.stopPropagation(); putAway(place); } }));
    const menu = el('div', { class: 'plot-menu' }, btns);
    wrap.appendChild(menu);
    openPopover = menu;
    // RUN21B item 3: the SELECTED item draws above its neighbours while its menu is open.
    // Every `.t-item` is a full 120x130 box however little of it the art fills, and a
    // re-baselined rug's box is 256x277 of mostly-empty rectangle — which sat over the bed's
    // resize handle and swallowed the press. Neighbours share a z-index (their shared ground
    // row), so DOM order was deciding which of two overlapping boxes won, and the thing she
    // had just tapped could lose.
    selectedWrap = wrap; selectedZ = wrap.style.zIndex;
    wrap.style.zIndex = '9998';
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
  let selectedWrap = null, selectedZ = '';
  function closeMenu() {
    if (openPopover) { openPopover.remove(); openPopover = null; }
    if (selectedWrap) {
      selectedWrap.querySelectorAll('.t-resize').forEach(n => n.remove());
      if (selectedWrap.isConnected) selectedWrap.style.zIndex = selectedZ;   // put it back in its row
      selectedWrap = null; selectedZ = '';
    }
    ground.classList.remove('menu-open');
  }

  function removePlacement(place) {
    mutate(st => {
      const items = areaItems(st);
      const target = findPlacement(place, items);
      const i = target ? items.indexOf(target) : -1;
      if (i >= 0) items.splice(i, 1);
    });
  }
  function pickUp(place) { closeMenu(); holdingScale = itemScaleOf(place); removePlacement(place); holding = place.item; placeMode = true; renderPlaced(); renderDrawer(); updateHint(); updateSoftened(); }
  function putAway(place) {
    closeMenu(); sfx.tap();
    const before = liveRecord(place);   // RUN21C-7: photographed WITH its scale and plane
    removePlacement(place);
    if (before) pushUndo('putAway', [before], []);
    renderPlaced(); renderDrawer(); updateHint(); updateSoftened();
  }

  // ---- drawer drag to place (delegated from attachStripMomentum, RUN10 P2) ----------
  const LIFT = 70;   // px the dragged item floats ABOVE the fingertip (blocks.js pattern)
  let liftGhost = null;
  function beginChipLift(chip, id) {
    holding = id; placeMode = true;
    holdingScale = 1;
    updateSoftened();   // RUN21C-1: something on her finger softens the world
    const rit = resolveItem(id);
    liftGhost = el('div', { class: 'drag-ghost', html: renderItem(rit, { size: 80, equipArt: rit.kind === 'boo' ? equippedArt(id) : null }) });
    document.body.appendChild(liftGhost);
  }
  function updateChipLift(cx, cy) {
    if (!liftGhost) return;
    const ly = cy - LIFT;
    liftGhost.style.left = cx + 'px'; liftGhost.style.top = ly + 'px';
    const r = viewport.getBoundingClientRect();
    if (ly >= r.top && ly <= r.bottom) {
      const { zi, x } = zoneAndXAt(clientToWorld(cx));
      showDropPreview(liftGhost, zi, x, rowAtClient(ly));
      // RUN21B-4: THE slot glow was wired to the two rarest gestures and not to this one —
      // lifting a chip out of the drawer is how a child actually carries a lamp to a table,
      // and the pointer is captured by the strip, so the viewport's own move handler never
      // sees it. Aim at ly (the point endChipLift places from), so the ring marks the spot
      // the item will really land on.
      if (isSmall(holding)) showSlotGlow(nearestFreeSlot(cx, ly)); else clearSlotGlow();
    }
    else { hideDropPreview(liftGhost); clearSlotGlow(); }
  }
  function endChipLift(cx, cy) {
    hideDropPreview(liftGhost);
    clearSlotGlow();
    if (liftGhost) { liftGhost.remove(); liftGhost = null; }
    const ly = cy - LIFT;
    const r = viewport.getBoundingClientRect();
    if (ly >= r.top && ly <= r.bottom) placeAtClient(cx, ly);
    else { renderDrawer(); updateHint(); }
    updateSoftened();
  }
  function cancelChipLift() {
    hideDropPreview(liftGhost);
    clearSlotGlow();   // RUN21B-4: a cancelled lift must not leave a ring pulsing on screen
    if (liftGhost) { liftGhost.remove(); liftGhost = null; }
    updateSoftened();
  }

  function flashLocked(zi) {
    const band = ground.querySelectorAll('.t-band')[zi];
    if (band) { band.classList.remove('shake'); void band.offsetWidth; band.classList.add('shake'); }
    hint.textContent = `${ZONES[zi].name}: ${totalStars()} / ${ZONES[zi].unlock} ⭐`;
  }

  // RUN21C-1: the hint bar, re-pointed at the softened world. Every line is the line it
  // always was — only the CONDITIONS changed, because the mode they described is gone.
  // "Drag to move. Tap an item for size controls." kept its exact meaning: it is what the
  // town has to say while the tray is open and she is arranging, which is precisely when
  // build mode used to say it.
  function updateHint() {
    // Every path that changes what she is holding already ends in updateHint(), so this is
    // the one place that cannot be forgotten. updateSoftened() no-ops unless the state moved.
    updateSoftened();
    hint.textContent = potHeld
      ? PATH_POT_HINT
      : holding
        ? 'Tap the ground — I’ll find the nearest free spot!'
        : placeMode
          ? 'Tap the ground to place it!'
          : drawerApi.isOpen()
            ? 'Drag to move. Tap an item for size controls.'
            : 'Drag from the tray. Tap a Boo to say hi!';
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
      depth: 0, depthTarget: 0, goal: null,
      locomotion: locomotionFor(item.id), costume: costumeFor(item.id), motion: motionFor(item.id),
      costumeIdleAt: performance.now() + costumeIdleDelay(), lastStomp: 0, wellieBursts: 0, whirring: false,
      // RUN13 T5: species-idle bookkeeping. `idleLog` holds the timestamps of the idles she
      // has played, trimmed to the last minute — that IS the cap, not an approximation of it.
      idleLog: [], idleUntil: 0, idleNextAt: performance.now() + IDLE_MIN_GAP_MS * (0.6 + Math.random() * 0.8) };
  }
  function startLoop() {
    if (REDUCED) return;              // reduced motion: static poses, no wandering
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(48, now - last); last = now;
      // Build mode pauses living behaviours (RUN10 P3): the loop keeps ticking so a resume
      // is instant, but skips stepping — the CSS transition on .t-item svg (see styles.css)
      // eases the freeze/resume rather than a hard cut.
      if (!document.hidden && !softened) { stepActors(dt); stepFunfairRides(now); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stepActors(dt) {
    const now = performance.now();
    for (const a of actors) {
      if (a.riding) continue;   // seated on a funfair ride: animated by the ride, not the wander loop (C1b)
      if (a.wrap === careHold) continue;   // RUN21A-6: frozen in place while its care arc is open
      // skip offscreen actors (cheap) — relative to the real viewport, not the wide zone
      const px = parseFloat(a.wrap.style.left) - scrollX;
      if (px < -140 || px > viewW + 140) continue;
      if (paradeUntil && a.parading) { stepParade(a, now); continue; }   // the Parade (RUN4 C9)
      if (a.dancing) continue; // dancing handled by CSS
      if (a.role) { stepRole(a, dt, now); continue; }   // activity items (RUN4 C5)
      if (a.costume && now >= a.costumeIdleAt) triggerCostumeIdle(a, now);
      a.t += dt;
      // at bedtime, near a house, drop a non-nap act so the sleep role can take over (C1)
      if (a.goal && a.goal.kind !== 'nap' && isSleepTime(currentHour()) && nearBoohouse(a) && !(a.wakeUntil && now < a.wakeUntil)) endGoal(a);
      if (a.goal) { stepGoal(a, dt, now); continue; }   // a chosen behaviour (C1): visit/approach/chase/watch/nap
      // RUN19 Z3: waiting beside a full seat. A patient pose — a tiny weight-shift, no
      // wandering — held for up to WAIT_MS. assignRoles' own sweep hands the seat over the
      // instant it frees, because a waiting Boo has no role and is standing right there.
      if (a.waitUntil != null) {
        if (now >= a.waitUntil) { endWait(a); a.next = 300; }
        else {
          const svgW = a.wrap.querySelector('svg');
          const shift = Math.sin(now / (WAIT_SHIFT_MS / (2 * Math.PI))) * 2.5;
          if (svgW) svgW.style.transform = `translate(${a.dx.toFixed(1)}px, 0px) rotate(${shift.toFixed(2)}deg)`;
          continue;
        }
      }
      if (a.t >= a.next) {
        a.t = 0;
        // A richer act (visit / approach / chase / watch / nap, RUN6 C1) wins over a
        // micro-wander when one is chosen, and it drives the actor itself — so any path
        // target from a previous wander is stale the moment a goal takes over.
        if (maybePickBehaviour(a, now)) { a.walkTo = null; continue; }
        const roll = Math.random();
        // RUN19 Z4: this is "arrival" for a wanderer — it has stopped walking and is about to
        // stand still. If it happens to have landed on a path she painted, the town notices
        // (once or twice a session at most, per the shared budget).
        if (a.state === 'walk') maybeAckPath(a);
        if (roll < 0.5) { a.state = 'pause'; a.vx = 0; a.walkTo = null; a.next = 700 + Math.random() * 1600; }
        else if (roll < 0.85) {
          a.state = 'walk';
          const speed = 0.006 + Math.random() * 0.01;
          // RUN21C-5: BOOS USE HER PATHS. On most re-rolls, if there is a path within reach
          // in this Boo's own depth row, it walks along that run instead of picking a
          // direction at random. Not a magnet and not a rail — the target stays inside the
          // ordinary wander range, so a Boo beside a path drifts onto it and pads along it
          // the way anything alive uses a path, and one nowhere near a path is unchanged.
          const aim = Math.random() < PATH_PULL_CHANCE ? pathWalkTargetDx(a) : null;
          if (aim != null) {
            const delta = aim - a.dx;
            a.vx = (delta < 0 ? -1 : 1) * speed;
            a.next = Math.max(500, Math.min(1400, Math.abs(delta) / speed));
            a.walkTo = aim;
          } else {
            a.vx = (Math.random() < 0.5 ? -1 : 1) * speed;
            a.next = 500 + Math.random() * 900;
            a.walkTo = null;
          }
        }
        else { a.state = 'hop'; a.hopT = 0; a.walkTo = null; a.next = 500 + Math.random() * 900; }
        // now and then drift a little between the depth rows (C3), for a living scene
        if (!a.depthLock && Math.random() < 0.4) a.depthTarget = (Math.random() * 2 - 1) * DEPTH_WANDER;
      }
      const range = zoneW * WANDER_FRAC;   // wander range scales with the wider zone (C3)
      if (a.state === 'walk') {
        a.dx += a.vx * dt; a.dx = Math.max(-range, Math.min(range, a.dx));
        // RUN21C-5: a walk aimed at a path STOPS on it rather than sailing past. Arriving is
        // also what feeds maybeAckPath on the next re-roll, so "she noticed" stays true.
        if (a.walkTo != null && ((a.vx > 0 && a.dx >= a.walkTo) || (a.vx < 0 && a.dx <= a.walkTo))) {
          a.dx = a.walkTo; a.walkTo = null;
          // Stay in state 'walk' and force the re-roll onto the next tick: the re-roll block
          // reads `a.state === 'walk'` as "it has just arrived", which is exactly true here.
          a.t = a.next;
        }
      }
      a.depth += (a.depthTarget - a.depth) * Math.min(1, dt / 260);   // ease toward the target depth
      let ty = 0, flip = a.vx < 0 ? -1 : 1, lean = 0;
      if (a.state === 'hop') { a.hopT += dt; const p = Math.min(1, a.hopT / 420); ty = -Math.sin(p * Math.PI) * 12; if (p >= 1) a.state = 'pause'; }
      if (a.state === 'walk' && a.locomotion === 'glide') {
        ty += Math.sin(now / 125) * 3;
        lean = flip * 7;
        if (!a.whirring) { a.whirring = true; sfx.whirr(); }
      } else a.whirring = false;
      // RUN13 T5 — behaviour-changing accessories. Springy boots turn the walk into a
      // continuous boing; flippers give it a wide, comical waddle-slap. Both are locomotion
      // swaps in exactly the rollerskates' shape, so the walk itself changes, not a badge.
      if (a.state === 'walk' && a.locomotion === 'spring') {
        ty += -Math.abs(Math.sin(now / 190)) * 15;
        lean = flip * Math.sin(now / 190) * 5;
      }
      if (a.state === 'walk' && a.locomotion === 'flap') {
        ty += Math.abs(Math.sin(now / 260)) * 4;
        lean = flip * Math.sin(now / 260) * 11;
      }
      // The Comet Cape only flies while she is actually going somewhere.
      if (a.motion === 'flutter') {
        const cape = a.wrap.querySelector('.acc-cape');
        if (cape) cape.classList.toggle('acc-cape-flutter', a.state === 'walk' && !REDUCED);
      }
      // …and an idle can start whenever she is standing still and under her caps.
      if (a.state === 'pause' && !a.goal && !a.role) maybeIdle(a, now);
      // RUN19 Z5: a wellied Boo stomps when it is RAINING anywhere, and ALSO in any season
      // when it is walking near the riverside's water band — wellies by a river are for
      // splashing whatever the weather, which is the half of the pack that makes the
      // accessory worth owning even in July.
      if (a.state === 'walk' && a.locomotion === 'stomp' && now - a.lastStomp >= STOMP_GAP_MS
          && (currentSeasonName === 'rain' || nearWaterBand(a))) {
        a.lastStomp = now;
        spawnWellieSplash(a);
      }
      // moving toward the front (positive depth) reads slightly bigger; toward the back, smaller
      const depthScale = 1 + a.depth * 0.003;
      a.wrap.querySelector('svg').style.transform = `translate(${a.dx.toFixed(1)}px, ${(ty + a.depth).toFixed(1)}px) rotate(${lean}deg) scale(${depthScale.toFixed(3)}) scaleX(${flip})`;
    }
  }

  // RUN13 T5: costume idles are read from the SET's own `idle` field now, so a new costume
  // brings its idle with it instead of being wired in by name here. Astronaut = a slow
  // moon bounce; Pirate = a hearty wave.
  const COSTUME_IDLE_CLASS = {
    hammer: 'costume-hammer-taps', stir: 'costume-spoon-stir',
    moonbounce: 'costume-moon-bounce', heartywave: 'costume-hearty-wave',
    // RUN20 W3: the police salute, the explorer's binocular scan, the pirate's spyglass.
    salute: 'costume-salute', scan: 'costume-scan', spyglass: 'costume-spyglass'
  };
  const COSTUME_IDLE_MS = { hammer: 900, stir: 900, moonbounce: 2200, heartywave: 1400,
    salute: 1000, scan: 2400, spyglass: 1600 };
  // ---- RUN20 W3: costume sets behave -----------------------------------------------------
  // Presentation only — no set changes any game or reward value, and none of this touches the
  // ledger. A costumed Boo that is SEATED suspends its costume idle: the seat pose wins, which
  // is the addendum's rule and also just true (you cannot scan the horizon while on a swing).
  const COSTUME_TAP_GAP_MS = 40000;   // the builder taps an item at most this often
  const SPIN_GAP_MS = 60000;          // the astronaut float-spins at most once a minute
  const BUILDER_REACH = 0.20;         // nearest item within 20% x

  // The builder's hammer tap: it targets ITEMS ONLY, never Boos, and the 2px bounce it gives
  // them never interrupts whatever that item is already doing (a sprinkled or wished thing
  // keeps doing its thing) because it rides its own class on the WRAP.
  function builderTap(a, now) {
    if (a.role || a.goal) return;                       // seated or busy: the pose wins
    if (now - (a.lastBuilderTap || 0) < COSTUME_TAP_GAP_MS) return;
    const here = a.place.x + ((a.dx || 0) / (zoneW || 1));
    const target = areaItems(getState())
      .filter(t => !(t.item || '').startsWith('boo_') && !(t.item || '').startsWith('custom:'))
      .map(t => ({ t, d: Math.abs(t.x - here) }))
      .filter(x => x.d <= BUILDER_REACH)
      .sort((x, y) => x.d - y.d)[0];
    if (!target) return;
    a.lastBuilderTap = now;
    const w = wrapFor(target.t);
    if (w && !REDUCED) { w.classList.remove('t-bonked'); void w.offsetWidth; w.classList.add('t-bonked'); setTimeout(() => w.classList.remove('t-bonked'), 320); }
    sfx.tap();
  }
  // The police whistle: ONE soft peep per session, ever.
  let whistled = false;
  function policeWhistle() {
    if (whistled) return;
    whistled = true;
    if (sfx.chime) sfx.chime(6);
  }
  // The astronaut's float-spin: at most once per SPIN_GAP_MS, 1.2s, never while seated.
  function maybeFloatSpin(a, now) {
    if (a.role || a.goal) return false;
    if (now - (a.lastSpin || 0) < SPIN_GAP_MS) return false;
    a.lastSpin = now;
    const svg = a.wrap.querySelector('svg');
    if (svg && !REDUCED) { svg.classList.remove('costume-floatspin'); void svg.offsetWidth; svg.classList.add('costume-floatspin'); setTimeout(() => svg.classList.remove('costume-floatspin'), 1240); }
    return true;
  }

  function triggerCostumeIdle(a, now = performance.now()) {
    const kind = (a.costume && a.costume.idle) || null;
    a.costumeIdleAt = now + costumeIdleDelay();
    // RUN20 W3: a SEATED costumed Boo does not idle — the seat pose wins.
    if (a.role) return null;
    // ...and the sets whose behaviour is more than a pose do it here, under their own caps.
    const setId = (a.costume && a.costume.id) || '';
    if (setId === 'acc_set_builder') builderTap(a, now);
    if (setId === 'acc_set_police') policeWhistle();
    if (setId === 'acc_set_astronaut' && maybeFloatSpin(a, now)) return 'floatspin';
    const cls = kind && COSTUME_IDLE_CLASS[kind];
    if (!cls) return null;
    const svg = a.wrap.querySelector('svg');
    svg.classList.remove(...Object.values(COSTUME_IDLE_CLASS));
    void svg.offsetWidth;
    svg.classList.add(cls);
    if (kind === 'hammer') { sfx.tap(); setTimeout(() => sfx.tap(), 180); }
    setTimeout(() => svg.classList.remove(cls), COSTUME_IDLE_MS[kind] || 900);
    return kind;
  }

  // ---- RUN13 T5: species idles, hard-capped ---------------------------------------------
  // Two per species: the universal blink-and-look-around, and one flavoured by the species.
  // A Boo may only idle while standing still, no more often than IDLE_MIN_GAP_MS, no more
  // than IDLE_MAX_PER_MIN times in any rolling minute, and never while IDLE_SCENE_CAP other
  // Boos are already idling. The caps are enforced here, not left to the odds.
  function idlingCount() { const now = performance.now(); return actors.filter(x => x.idleUntil > now).length; }
  function maybeIdle(a, now = performance.now(), force = null) {
    if (REDUCED) return null;
    if (a.idleUntil > now) return null;                       // already playing one
    if (now < a.idleNextAt) return null;                      // per-Boo gap
    a.idleLog = a.idleLog.filter(t => now - t < 60000);
    if (a.idleLog.length >= IDLE_MAX_PER_MIN) return null;    // per-Boo rolling-minute cap
    if (idlingCount() >= IDLE_SCENE_CAP) return null;         // scene cap
    if (force == null && Math.random() > IDLE_CHANCE) return null;
    const species = (a.item && a.item.species) || 'bloop';
    const flavour = SPECIES_IDLE[species] || SPECIES_IDLE.bloop;
    const which = force || (Math.random() < 0.5 ? IDLE_BLINK : flavour);
    const svg = a.wrap.querySelector('svg');
    if (!svg) return null;
    svg.classList.remove(`idle-${IDLE_BLINK}`, `idle-${flavour}`);
    void svg.offsetWidth;
    svg.classList.add(`idle-${which}`);
    a.idleUntil = now + IDLE_MS;
    a.idleLog.push(now);
    a.idleNextAt = now + IDLE_MIN_GAP_MS;
    setTimeout(() => svg.classList.remove(`idle-${which}`), IDLE_MS);
    return which;
  }
  // RUN19 Z5: the puddle stomp, completed to the pack's numbers — at most SPLASH_MAX
  // particles, SPLASH_MS long, and an actual sound, which it never had. The sfx goes through
  // sfx.js like everything else, so it obeys the mutes.
  // SPLASH_MAX is the CAP, not the count. Z5's pack says "at most SPLASH_MAX particles" and I
  // read that as "emit SPLASH_MAX" — but RUN10 P3 already fixed the stomp at three droplets and
  // r10p13-slots asserts exactly that (drops === bursts * 3). Three, under a cap of six, honours
  // both; doubling an existing authored number was never part of this run's brief.
  const SPLASH_PER_STOMP = 3;
  function spawnWellieSplash(a) {
    a.wellieBursts++;
    if (!REDUCED) {
      for (let i = 0; i < SPLASH_PER_STOMP; i++) {
        const drop = el('i', { class: 'wellie-drop' });
        const spread = (i - (SPLASH_PER_STOMP - 1) / 2) / ((SPLASH_PER_STOMP - 1) / 2);   // -1 .. 1
        drop.style.setProperty('--wx', `${spread * 26}px`);
        drop.style.setProperty('--wy', `${-14 - (1 - Math.abs(spread)) * 16}px`);   // an arc, highest in the middle
        drop.style.animationDuration = SPLASH_MS + 'ms';
        a.wrap.appendChild(drop);
        setTimeout(() => drop.remove(), SPLASH_MS + 40);
      }
    }
    sfx.splash();
  }
  // Is this actor walking in the riverside's water band? The river is drawn at y 30-42% of the
  // scene (riversideScenery), and the band a Boo can reach on foot is its near edge — the
  // BACK depth row, where the ground meets the water.
  function nearWaterBand(a) {
    if (AREA.key !== 'riverside') return false;
    return rowOf(a.place) === 0;
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
    // RUN19 Z3 — THE CAUSE of "the bed nap never happens": the nap GOAL, the only thing
    // that ever WALKS a Boo to a bed, was gated on `night` (21:00-07:00). A child plays in
    // the daytime, so unless she happened to park a Boo within ACT_RADIUS (12% of the room's
    // width) of the bed, no Boo ever went to bed at all. Indoors the gate is now the
    // authored NAP_CHANCE per qualifying pause instead: any hour, a bed is for napping in.
    // Outdoors it stays night-only — a Boo dozing under a tree at noon is a different thing.
    const napAllowed = night || (isInterior && Math.random() < NAP_CHANCE);
    if (napAllowed && !recentlyWoken && pickNapSpot(a)) cands.push(['nap', 2.6 * personalityMult(booId, 'nap')]);
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
        // arrived: claim a free socket right away — none free → wait beside it (RUN19 Z3;
        // RUN10 P2's 300ms shrug-and-leave is retired, it read as a glitch)
        const deco = g.deco; const claimed = tryClaimActivity(a, deco);
        endGoal(a);
        if (!claimed) shrugAndEndGoal(a, deco);
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
    if (REDUCED || isInterior) return;   // T7: weather is an outdoors thing
    const forced = typeof window !== 'undefined' && window.__bootownWeather;
    const base = seasonOf(currentMonth());
    // RUN19 Z5: rain is now a real, occasional weather state (see isRainDay) rather than a
    // season name nothing could ever produce.
    const season = forced === 'rain' ? 'rain' : (isRainDay(base, todayKeyLocal()) ? 'rain' : base);
    currentSeasonName = season;
    const layer = el('div', { class: 't-weather ' + season });
    if (season === 'summer') {
      if (!isNight(currentHour())) layer.appendChild(el('div', { class: 't-sunrays' }));   // sun rays are a daytime thing
    } else {
      const glyph = season === 'rain' ? '•' : season === 'autumn' ? '🍂' : season === 'winter' ? '❄' : '🌸';
      for (let i = 0; i < WEATHER_PARTICLES; i++) {
        const p = el('div', { class: 't-wp', text: glyph });
        p.style.left = (Math.random() * 100).toFixed(1) + '%';
        p.style.setProperty('--fall', (7 + Math.random() * 6).toFixed(1) + 's');
        p.style.setProperty('--delay', (-Math.random() * 10).toFixed(1) + 's');
        p.style.setProperty('--drift', (Math.random() * 40 - 20).toFixed(0) + 'px');
        p.style.fontSize = season === 'rain' ? '24px' : (14 + Math.random() * 10).toFixed(0) + 'px';
        layer.appendChild(p);
      }
    }
    viewport.appendChild(layer);
  }
  function scheduleShootingStar() {
    if (starTimer) { clearTimeout(starTimer); starTimer = null; }
    if (REDUCED || isInterior || !isNight(currentHour())) return;   // a rare treat, only at night, only under real sky
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
  // RUN13B T7: outdoor ambience stays outdoors. A room is its walls and the things
  // that never move — no meadow butterflies over the kitchen sink, no rain in the
  // Lounge, no shooting stars through the ceiling. Rooms breathe through their own
  // built-ins instead (ember flicker, fairy lights).
  if (!isInterior) buildAmbient(air, night, AREA.key);
  renderWeather();
  ambient.play(night ? 'night' : 'day');   // gentle bed under the music, obeys the mute (C1)
  // RUN21F F7: and the place itself has a voice — surf, river, wind, birdsong, distant
  // play. The table in sfx.js decides: the Funfair (its jingle owns that air) and the
  // interiors are not in it, so they stay exactly as quiet as they were.
  bed.play(AREA.key);
  scheduleShootingStar();

  // Re-check roles every few seconds: benches cycle "now and then", woken Boos
  // eventually curl back up, and day/night transitions take hold (RUN4 C5).
  // RUN21C-1: a seat claimed by the role sweep SPEAKS ("Best seat in the Meadow!"). That is
  // ambient speech, and the softened world has none of it — she is arranging, not being
  // talked at. The sweep resumes with everything else the moment the tray shuts.
  const roleTimer = setInterval(() => { if (!document.hidden && !softened) assignRoles(); }, 4000);
  // RUN21B-2: the EPISODIC wish idles — a teapot's wisp, a trophy's sparkle, the whale's
  // spout. The continuous ones (FLIER's figure-8, BOB's rise and fall) are CSS loops and
  // need no clock. This one paces the rest against a shared scene cap, so a Meadow full of
  // teapots stays a place rather than a fireworks display.
  // RUN21C merge: `buildMode` no longer exists — this is `softened` now, or the wish idles
  // would never pause while she arranges (and, before C, never run at all).
  const wishIdleTimer = setInterval(() => { if (!document.hidden && !softened) pumpWishIdles(); }, 2000);
  // RUN13 T4: a placed wall clock keeps real time — hands only, no re-render of the item.
  const clockTimer = setInterval(() => {
    if (document.hidden) return;
    const markup = clockHands(currentHour(), currentMinute());
    ground.querySelectorAll('.t-item[data-item="deco_wallclock"] .clock-hands')
      .forEach(g => { if (g.innerHTML !== markup) g.innerHTML = markup; });
  }, CLOCK_TICK_MS);
  if (typeof window !== 'undefined') {
    window.__townDebug = () => ({ paradeUntil, now: performance.now(), parading: actors.filter(a => a.parading).length, actors: actors.length, rafAlive: !!raf });
    // RUN5 C3 QA hooks: geometry + deterministic depth-wander evidence.
    window.__town = {
      geometry: () => ({ viewW, zoneW, worldW, zones: ZONES.length, ratio: zoneW / viewW }),
      scrollX: () => scrollX,
      scrollMax: () => Math.max(0, worldW - viewW),
      // RUN18D D10 QA: walk the area a screen at a time, the way the child's swipe does,
      // so a suite can ask "is there any part of this place that is bare?"
      scrollTo: (x) => { scrollX = x; clampScroll(); applyScroll(); return scrollX; },
      scrollScreens: () => Math.max(1, Math.round(worldW / viewW)),
      actorCount: () => actors.length,
      drift: (target) => actors.forEach(a => { if (!a.role && !a.dancing) { a.depthTarget = target; a.depthLock = true; a.state = 'pause'; a.vx = 0; } }),
      // vertical (depth) offsets of free wanderers, read from their live transforms
      depthYs: () => actors.filter(a => !a.role && !a.dancing).map(a => { const m = (a.wrap.querySelector('svg').style.transform || '').match(/translate\([^,]+,\s*(-?[\d.]+)px/); return m ? +m[1] : 0; }),
      itemsByRow: () => [...ground.querySelectorAll('.t-item')].map(w => ({ row: +w.dataset.row, item: w.dataset.item, w: w.getBoundingClientRect().width, z: +w.style.zIndex || 0, top: parseFloat(w.style.top) }))
    };
    // RUN6 C1 QA hooks: drive the behaviour engine + ambient life deterministically.
    window.__townLife = {
      actorCount: () => actors.length,
      // QA: the real min-spacing radius in on-screen pixels, plus the on-screen x for a
      // saved item fraction, so a suite can aim a "too close" tap from the RULE rather than
      // from a sprite's box (a placed Boo becomes a live actor and leaves a zero-size
      // placeholder behind, which silently aimed one such tap at the corner). (RUN11.)
      minSpacingPx: () => MIN_SPACING * zoneW,
      screenXForFraction: (x) => { const r = viewport.getBoundingClientRect(); return r.left + (x * zoneW) - scrollX; },
      groundY: () => { const r = viewport.getBoundingClientRect(); return r.top + groundY; },
      screenYForRow: (row) => { const r = viewport.getBoundingClientRect(); return r.top + viewH * ROWS[row] - 6; },
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
      rerender: () => renderPlaced(),
      // The ground-line table this area is actually using, and the CLAMPED y a wall item
      // renders at — both read straight from the renderer, so a suite tests the rule rather
      // than reverse-engineering it out of pixels and viewport rounding.
      rowFracs: () => ROWS.slice(),
      wallYOf: (itemId) => { const t = areaItems(getState()).find(x => x.item === itemId); return t && isWallPlane(t) ? clampWallY(t.y != null ? t.y : WALL_Y_FRAC) : null; },
      // ---- RUN19 Z6 --------------------------------------------------------------------
      planeOf: (itemId) => { const t = areaItems(getState()).find(x => x.item === itemId); return t ? planeOf(t) : null; },
      freeSlots: () => freeSurfaceSlots(getState()).map(s2 => ({ parentItem: s2.parentItem, parentId: s2.parentId, slot: s2.slot, x: Math.round(s2.x), y: Math.round(s2.y) })),
      // ---- RUN21F F5: placement ids ----------------------------------------------------
      // Read-only. Everything a suite needs to say "this is the SAME thing it was before the
      // move", without reverse-engineering identity out of a position that just changed.
      placements: () => areaItems(getState()).map(t => ({ id: t.id, item: t.item, x: t.x, row: t.row, plane: planeOf(t), parent: t.parent, slot: t.slot, scale: t.scale })),
      idOf: (itemId) => { const t = areaItems(getState()).find(x => x.item === itemId); return t ? t.id : null; },
      childrenOf: (itemId) => {
        const p = areaItems(getState()).find(x => x.item === itemId);
        return p ? areaItems(getState()).filter(c => c !== p && c.parent === pidOf(p)).map(c => c.item) : [];
      },
      nextId: () => (getState().town || {}).nextId,
      sparkleKeys: () => Object.keys(getState().sparkles || {}),
      // The rendered seat, in on-screen pixels, of whatever is standing on `itemId` — so a suite
      // can prove the lamp is still ON the table after the table has moved, from the art.
      seatRectOf: (itemId) => { const w = [...ground.querySelectorAll('.t-item')].find(n => n.dataset.item === itemId); if (!w) return null; const r = w.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; },
      slotGlowing: () => !!(ground.parentElement && ground.parentElement.querySelector('.t-slot-glow.show')) || !!document.querySelector('.t-slot-glow.show'),
      dressingApplied: (slot) => { const d = dressingApplied(slot); return d ? d.id : null; },
      renderDecorate: () => renderDecorateTab(),
      // ---- RUN19 Z3: announced moments ------------------------------------------------
      // Walk actor i to a named placed item REGARDLESS of whether its seats are free. The
      // patient wait only happens on a race — the seat was free when the Boo set off and
      // taken by the time it arrived — and pickFreeActivity deliberately never sets up that
      // race itself, so a suite needs this seam to reproduce it.
      forceApproach: (i, itemId) => {
        const a = actors[i]; if (!a) return null;
        const d = areaItems(getState()).find(t => t.item === itemId);
        if (!d) return null;
        clearRole(a); endWait(a);
        a.goal = { kind: 'approach', deco: d, targetDx: (d.x - a.place.x) * zoneW, start: performance.now() };
        return a.goal.targetDx;
      },
      // RUN19 Z4: run the painted-path check for actor i, and report what it saw. The live
      // trigger is a wanderer's arrival, which is random by design — a suite must be able to
      // test the RULE (does a Boo standing on her path earn the line?) without waiting for
      // the dice. `tiles` is what the geometry actually computed, so a miss is diagnosable.
      ackPathNow: (i) => {
        const a = actors[i]; if (!a) return null;
        const landing = a.place.x + ((a.dx || 0) / (zoneW || 1));
        const tiles = currentPaths().map(pathTileAt);
        const row = rowOf(a.place);
        const hit = tiles.find(t => t.row === row && Math.abs(t.xFrac - landing) <= PATH_ACK_X) || null;
        maybeAckPath(a);
        return { landing: +landing.toFixed(4), row, hit, tileRows: [...new Set(tiles.map(t => t.row))], tileXs: tiles.map(t => +t.xFrac.toFixed(3)).slice(0, 14) };
      },
      waitingCount: () => actors.filter(a => a.waitUntil != null).length,
      waitersForSeat: () => seatWaiters.size,
      napOf: (i) => {
        const a = actors[i]; if (!a || !a.role || a.role.kind !== 'housenap') return null;
        const svg = a.wrap.querySelector('svg');
        return { until: Math.round(a.role.napUntil), t: Math.round(a.role.t), eyesShut: !!(svg && svg.classList.contains('t-eyes-shut')) };
      },
      // Skip to the end of a nap without waiting out its real 20-40s (which no suite should).
      endNapNow: (i) => { const a = actors[i]; if (a && a.role && a.role.kind === 'housenap') { a.role.napUntil = 0; return true; } return false; },
      tapActor: (i) => { const a = actors[i]; if (!a) return false; onTap(a.wrap, a.place, a.item); return true; },
      seatHopped: () => ground.querySelectorAll('.t-seat-hop').length,
      // ---- RUN19 Z5 ---------------------------------------------------------------------
      openPlayCard: (i) => { const a = actors[i]; if (!a) return false; openPlayCard(a.wrap, a.place, a.item); return true; },
      openPlayCardFor: (itemId) => {
        const t = areaItems(getState()).find(x => x.item === itemId);
        const wrap = t && wrapFor(t);
        if (!t || !wrap) return false;
        openPlayCard(wrap, t, resolveItem(t.item) || BY_ID[t.item]);
        return true;
      },
      sparkling: () => [...ground.querySelectorAll('.t-sprinkled')].map(n => n.dataset.item),
      applySparkles: () => applySparkles(),
      // One stomp, and the drops THAT stomp made. lastStomp is pushed far forward afterwards
      // so the live loop cannot add a second burst before the suite counts them.
      forceStomp: (i) => {
        const a = actors[i]; if (!a) return null;
        a.wrap.querySelectorAll('.wellie-drop').forEach(n => n.remove());
        a.lastStomp = 0; a.state = 'walk';
        spawnWellieSplash(a);
        a.lastStomp = performance.now() + 60000;
        return { bursts: a.wellieBursts, drops: a.wrap.querySelectorAll('.wellie-drop').length };
      },
      stompEligible: (i) => {
        const a = actors[i]; if (!a) return null;
        return { locomotion: a.locomotion, season: currentSeasonName, nearWater: nearWaterBand(a), row: rowOf(a.place), area: AREA.key };
      },
      napZ: () => ground.querySelectorAll('.t-zzz-drift').length,
      stretching: () => ground.querySelectorAll('.t-nap-stretch').length,
      eyesShut: () => ground.querySelectorAll('svg.t-eyes-shut').length,
      // ambient life
      season: () => currentSeasonName,
      weather: () => { const l = viewport.querySelector('.t-weather'); return l ? { season: [...l.classList].find(c => ['spring', 'summer', 'autumn', 'winter', 'rain'].includes(c)), particles: l.querySelectorAll('.t-wp').length, sunrays: l.querySelectorAll('.t-sunrays').length } : null; },
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
      hasDiscoDoor: () => !!ground.querySelector('.ff-disco-door'),
      scrollToDisco: () => { scrollX = (ZONE_INDEX['funfair'] ?? 0) * zoneW + DISCO_DOOR_X * zoneW - viewW / 2; clampScroll(); applyScroll(); },
      scrollToBandstand: () => { scrollX = (ZONE_INDEX['funfair'] ?? 0) * zoneW + BANDSTAND_X * zoneW - viewW / 2; clampScroll(); applyScroll(); },
      scrollToFunfairGate: () => { scrollX = (ZONE_INDEX['funfair'] ?? 0) * zoneW; clampScroll(); applyScroll(); },   // funfair centred but bandstand off-screen → jingle
      zoneMusic: () => _zoneMusic,
      area: () => AREA.key,   // RUN10 P1 QA hook: which area this mount is rendering
      // RUN13 T3 QA hooks: which Boo House room is open, its storage key, and its camera.
      room: () => roomId,
      roomKey: () => STORE_KEY,
      // RUN13B T7 QA hooks: the room's fixed built-ins, and what its window shows.
      builtins: () => [...hills.querySelectorAll('[data-builtin]')].map(n => n.dataset.builtin),
      builtinBox: (id) => { const n = hills.querySelector(`[data-builtin="${id}"]`); return n ? n.getBoundingClientRect().toJSON() : null; },
      windowSky: () => { const n = hills.querySelector('[data-builtin="window"]'); return n ? n.dataset.sky : null; },
      // RUN13B T8 QA hooks: the outdoor sky, its disc, and the per-area dressing.
      skyBand: () => { const g = sky.querySelector('.t-skygrad'); return g ? (g.className.replace('t-skygrad', '').trim() || null) : null; },
      skyDisc: () => sky.querySelector('.t-sundisc') ? 'sun' : (sky.querySelector('.t-moondisc') ? 'moon' : null),
      dressingCount: (sel) => ground.querySelectorAll(sel).length + air.querySelectorAll(sel).length,
      noticePoster: () => { const n = ground.querySelector('.pg-notice'); return n ? n.dataset.notice : null; },
      ambientCount: () => air.querySelectorAll('.t-butterfly, .t-firefly').length,
      bedroomCurtains: () => { const n = hills.querySelector('[data-builtin="window"]'); return n ? (n.dataset.curtains || null) : null; },
      fairyLightsOn: () => { const n = hills.querySelector('[data-builtin="fairylights"]'); return n ? n.dataset.lights : null; },
      scrollX: () => scrollX,
      scrollTo: (px) => { scrollX = px; clampScroll(); applyScroll(); return scrollX; },
      chatPips: () => ground.querySelectorAll('.t-chat-pip').length,
      // RUN13 T4 QA hooks: the photo frame's subject and the wall clock's hands.
      photoBoo: () => { const n = ground.querySelector('.t-photo-frame'); return n ? n.dataset.photoBoo : null; },
      clockHandsMarkup: () => { const g = ground.querySelector('.clock-hands'); return g ? g.innerHTML : null; },
      tickClocks: () => {
        const markup = clockHands(currentHour(), currentMinute());
        ground.querySelectorAll('.t-item[data-item="deco_wallclock"] .clock-hands').forEach(g => { g.innerHTML = markup; });
        return markup;
      },
      litLamps: () => [...ground.querySelectorAll('.t-item.lit')].map(n => n.dataset.item),
      // RUN13 T5 QA hooks: idles and the behaviour-changing accessories.
      idleCaps: () => ({ minGapMs: IDLE_MIN_GAP_MS, maxPerMin: IDLE_MAX_PER_MIN, sceneCap: IDLE_SCENE_CAP, ms: IDLE_MS }),
      // RUN21B-2: the ambient wish idles.
      wishIdleCaps: () => ({ scenePerMin: WISH_IDLE_SCENE_PER_MIN, episodic: WISH_IDLE_EPISODIC, whaleMs: WHALE_SPOUT_MS }),
      wishIdleLog: () => wishIdleLog.slice(),
      wishIdles: () => [...ground.querySelectorAll('.t-wish')].map(w => ({
        item: w.dataset.item,
        idle: (String(w.className).match(/wishidle-(\w+)/) || [, 'none'])[1],
        anim: (() => { const s = w.querySelector('svg'); return s ? getComputedStyle(s).animationName : null; })(),
        nextAt: w._wishIdleNextAt == null ? null : Math.round(w._wishIdleNextAt - performance.now())
      })),
      pumpWishIdles: () => pumpWishIdles(),
      wisps: () => ground.querySelectorAll('.wish-wisp').length,
      idleFor: (i) => { const a = actors[i]; return a ? { species: (a.item && a.item.species) || null, blink: IDLE_BLINK, flavour: SPECIES_IDLE[(a.item && a.item.species) || 'bloop'] } : null; },
      forceIdle: (i, which) => { const a = actors[i]; if (!a) return null; a.idleNextAt = 0; a.idleUntil = 0; return maybeIdle(a, performance.now(), which || true); },
      tryIdle: (i) => { const a = actors[i]; if (!a) return null; return maybeIdle(a, performance.now()); },
      idleLog: (i) => { const a = actors[i]; return a ? a.idleLog.slice() : null; },
      idleClasses: () => [...ground.querySelectorAll('.t-item.boo svg')].map(s => [...s.classList].filter(cn => cn.startsWith('idle-')).join(',')).filter(Boolean),
      costumeIdle: (i) => { const a = actors[i]; return a ? triggerCostumeIdle(a) : null; },
      capeFluttering: () => ground.querySelectorAll('.acc-cape-flutter').length,
      snackCrumbs: () => ground.querySelectorAll('.t-snack-crumb').length,
      // RUN10 P1: an area is 4 viewports wide, so a single "centred" scroll no longer
      // shows the whole area (e.g. the funfair's 5 rides span x 0.18-0.92) — tests that
      // need a specific spot in view should scroll to it directly.
      scrollToFrac: (x) => { scrollX = Math.max(0, Math.min(x * zoneW - viewW / 2, worldW - viewW)); clampScroll(); applyScroll(); },
      // RUN10 P3 QA hooks: path painting, landscape restriction, fishing.
      // RUN21C-1: `softened` is the real state now. `buildMode` and `toggleBuild` survive as
      // ALIASES only — the suites that call them mean "is the world arranging" and "put it
      // into arranging", and the drawer is what does both. Nothing in the UI reads them.
      softened: () => softened,
      buildMode: () => softened,
      toggleBuild: () => { drawerApi.isOpen() ? drawerApi.close() : drawerApi.open(); updateSoftened(); updateHint(); return softened; },
      potHeld: () => potHeld,
      pathStyleSel: () => pathStyle,
      setPathStyle: (id) => selectPathStyle(id),
      paths: () => currentPaths().slice(),
      paintCellAt: (cx, cy) => paintCell(cx, cy),
      paintClient: (cx, cy) => paintAtClient(cx, cy),
      cellGeom: () => cellGeom(),
      gridOpacity: () => getComputedStyle(buildGrid).opacity,
      commitPathsNow: () => commitPaths(),
      // RUN21C-3: a painted cell is no longer a node of its own — adjacent same-style cells
      // in a row are ONE stroke. `pathCellCount` counts the painted CELLS (what the name has
      // always meant); `pathRunCount` counts the strokes those cells drew.
      // RUN21C-5: every wanderer's LIVE x-fraction (its placed x plus how far it has walked),
      // with the depth row it walks in — how "do the Boos favour the path" is measured.
      // RUN21C-6 QA: is the resize handle attached, and to what?
      resizeHandles: () => [...ground.querySelectorAll('.t-item')].filter(w => w.querySelector('.t-resize')).map(w => w.dataset.item),
      resizeLingerMs: () => RESIZE_LINGER_MS,
      // RUN21C-7 QA: the session undo stack and its chip.
      undoDepth: () => undoStack.length,
      undoKinds: () => undoStack.map(u => u.kind),
      undoChip: () => { const n = viewport.querySelector('.t-undo-chip'); return n ? { text: n.textContent, shown: n.classList.contains('show') } : null; },
      undo: () => undoOnce(),
      actorXs: () => actors.map(a => a.place.x + ((a.dx || 0) / (zoneW || 1))),
      actorRows: () => actors.map(a => rowOf(a.place)),
      // How far each wanderer has strayed from its home spot, as a fraction of the wander
      // range: -1 is as far left as it may go, +1 as far right. Sign is the whole point.
      actorDrift: () => actors.map(a => (a.dx || 0) / (zoneW * WANDER_FRAC || 1)),
      // RUN21C-5 QA: what the path finder computes for each wanderer right now (null = no
      // path within reach in its row), and what each actor is currently doing — the two
      // things that decide whether the micro-wander branch is reached at all.
      pathAim: () => actors.map(a => { const d = pathWalkTargetDx(a); return d == null ? null : +(d / (zoneW * WANDER_FRAC || 1)).toFixed(3); }),
      actorStates: () => actors.map(a => ({ state: a.state, goal: a.goal ? a.goal.kind : null, role: a.role ? a.role.kind : null, walkTo: a.walkTo == null ? null : +(a.walkTo / (zoneW * WANDER_FRAC || 1)).toFixed(2) })),
      pathCellCount: () => currentPaths().length,
      pathRunCount: () => ground.querySelectorAll('.t-path-run').length,
      pathRunBoxes: () => [...ground.querySelectorAll('.t-path-run')].map(n => ({
        row: n.dataset.row != null ? +n.dataset.row : null, col: n.dataset.col != null ? +n.dataset.col : null,
        style: n.dataset.style, radius: getComputedStyle(n).borderTopLeftRadius,
        w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height)
      })),
      pathCellZ: (sel) => { const n = ground.querySelector(sel || '.t-path-run'); return n ? getComputedStyle(n).zIndex : null; },
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
      forceHold: (id) => { holding = id; placeMode = true; renderDrawer(); updateSoftened(); },
      placeAt: (fx, fy) => { const r = viewport.getBoundingClientRect(); placeAtClient(r.left + r.width * fx, r.top + r.height * fy); },
      openWishWell: () => openWellHere(),
      wishSpawns: () => [...ground.querySelectorAll('.wish-town-spawn')].map(n => ({ word:n.dataset.word, cls:n.className, animation:getComputedStyle(n).animationName })),
      drawerTabs: () => [...drawer.querySelectorAll('.bd-tab')].filter(n => getComputedStyle(n).display !== 'none').map(n => n.textContent),
      // RUN10 P5 QA hooks: personalities + hide-and-seek 2.0.
      personalityOf: (booId) => personalityOf(booId),
      // Taps once (the real squeak() path, CATCHPHRASE_RATE = 45% odds) and reports whether the
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
      locomotion: i => actors[i] && actors[i].locomotion,
      forceWalk: (i, direction = 1) => {
        const a = actors[i];
        if (!a) return false;
        clearRole(a); a.goal = null; a.state = 'walk'; a.vx = (direction < 0 ? -1 : 1) * .012; a.next = 5000;
        return true;
      },
      stepActors: ms => stepActors(ms),
      wellieDrops: () => ground.querySelectorAll('.wellie-drop').length,
      wellieBursts: i => actors[i] ? actors[i].wellieBursts : 0,
      costumeIdle: i => { const a = actors[i]; return a ? triggerCostumeIdle(a, performance.now()) : null; },
      costumeIdleAt: i => actors[i] ? actors[i].costumeIdleAt : null,
      outfitDebug: i => {
        const a = actors[i];
        return a ? { id: a.item && a.item.id, locomotion: a.locomotion, costume: a.costume && a.costume.id, state: a.state, lastStomp: a.lastStomp, season: currentSeasonName } : null;
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
      // ---- RUN21D QA hooks ---------------------------------------------------------------
      // The pulse's caps ARE the feature (one beat, one invitation, reveals win), so they
      // are inspectable rather than inferred from pixels.
      pulse: () => ({
        beat: pulseBeat, beats: pulseFired.slice(), invited: pulseInvited,
        invitation: pulseInvitation(), hint: hint.textContent,
        delayMs: PULSE_DELAY_MS, hintMs: PULSE_HINT_MS
      }),
      signaturePoint: () => signaturePoint(),
      panToFrac: (x, ms) => panToFrac(x, ms),
      // RUN21D-2: the request card and where "Show me" actually lands the camera.
      requestBubbles: () => [...ground.querySelectorAll('.request-thought')].map(n => n.dataset.boo),
      openRequestFor: (booId) => { const r = activeRequests().find(x => x.booId === booId); if (!r) return false; openRequestCard(r); return true; },
      requestTargetFrac: (booId) => { const r = activeRequests().find(x => x.booId === booId); return r ? requestTargetFrac(r) : null; },
      // Where the request's target sits in the viewport right now, 0 = left edge, 1 = right.
      targetViewFrac: (booId) => {
        const r = activeRequests().find(x => x.booId === booId);
        const n = r && requestTargetNode(r);
        if (!n) return null;
        const vr = viewport.getBoundingClientRect(), nr = n.getBoundingClientRect();
        return (nr.left + nr.width / 2 - vr.left) / (vr.width || 1);
      },
      ringed: () => [...ground.querySelectorAll('.rq-ring')].map(n => n.dataset.item || n.className),
      // RUN21D-3: the landmark dots — their labels, which is filled, and their tap targets.
      dots: () => (dotBtns || []).map((b, i) => {
        const r = b.getBoundingClientRect();
        return { label: b.getAttribute('aria-label'), sel: b.classList.contains('sel'),
                 current: b.getAttribute('aria-current'), target: dotTargetX(i),
                 w: Math.round(r.width), h: Math.round(r.height) };
      }),
      tapDot: (i) => { const b = (dotBtns || [])[i]; if (!b) return false; b.click(); return true; },
      dotPip: () => {
        const off = dots && dots.querySelector('.t-dot:not(.sel) .t-dot-pip');
        const on = dots && dots.querySelector('.t-dot.sel .t-dot-pip');
        if (!off || !on) return null;
        const cs = getComputedStyle(off);
        return { w: cs.width, h: cs.height, bg: cs.backgroundColor, selBg: getComputedStyle(on).backgroundColor };
      },
      edgeShims: () => [...viewport.querySelectorAll('.t-edge-shim')].map(n => n.className),
      // RUN21D-4: the fair's two hanging signs.
      fairSigns: () => [...ground.querySelectorAll('.ff-sign')].map(n => {
        const v = viewport.getBoundingClientRect(), r = n.getBoundingClientRect();
        return { id: [...n.classList].find(c => c.startsWith('ff-sign-')), aria: n.getAttribute('aria-label'),
                 text: (n.querySelector('.ffs-plaque') || {}).textContent,
                 onScreen: r.left >= v.left && r.right <= v.right && r.top >= v.top && r.bottom <= v.bottom,
                 w: Math.round(r.width), h: Math.round(r.height) };
      }),
      tapFairSign: (id) => { const n = ground.querySelector('.ff-sign-' + id); if (!n) return false; n.click(); return true; },
      // RUN21D-5: the hider's fair chance — did it run, did it pan, and where is the peek now?
      hiderNudge: () => {
        const peek = ground.querySelector('.t-hide-peek');
        const v = viewport.getBoundingClientRect();
        const r = peek ? peek.getBoundingClientRect() : null;
        return {
          nudged: hiderNudged, panned: hiderPanned, line: HIDER_NEARBY_LINE, hint: hint.textContent,
          hasPeek: !!peek,
          // how many screens away the peek is from the visible window (0 = on screen)
          screensAway: r ? Math.max(0, Math.max(v.left - r.right, r.left - v.right)) / (v.width || 1) : null,
          onScreen: r ? (r.right > v.left && r.left < v.right) : null
        };
      },
      // What every actor is actually DOING — the state proof behind a movement beat.
      goals: () => actors.map(a => ({ item: a.place && a.place.item, goal: a.goal && a.goal.kind, role: a.role && a.role.kind, state: a.state })),
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
      roomScroll.set(STORE_KEY, scrollX);   // RUN21A-9: the pan survives every exit (session only)
      stopPulse();                          // RUN21D-1: no beat and no invitation after leaving
      if (raf) cancelAnimationFrame(raf);
      if (panRaf) cancelAnimationFrame(panRaf);
      if (momRaf) cancelAnimationFrame(momRaf);
      if (routineTimer) clearInterval(routineTimer);
      clearInterval(roleTimer);
      clearInterval(wishIdleTimer);   // RUN21B-2
      clearInterval(clockTimer);
      if (starTimer) clearTimeout(starTimer);
      if (pathCommitTimer) clearInterval(pathCommitTimer);
      commitPaths();   // build mode edits commit on exit, whichever comes first (RUN10 P3)
      if (hideWiggleTimer) clearTimeout(hideWiggleTimer);
      if (lingerResizeTimer) clearTimeout(lingerResizeTimer);   // RUN21C-6
      clearTimeout(undoChipTimer);                              // RUN21C-7: the stack dies with the mount
      ambient.stop();
      bed.stop();
      stopBand();
      window.removeEventListener('resize', onResize);
      closeMenu();
    }
  };
}

function buildAmbient(air, night, areaKey) {
  if (REDUCED) return;
  // RUN13B T8: the Meadow's ambient life is authored — exactly 2 butterflies by day,
  // 2 fireflies by night. The busier areas keep the generic scatter (within caps).
  const n = areaKey === 'meadow' ? 2 : (night ? 10 : 8);
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

// ---- RUN13B T7: Boo House room identity --------------------------------------------
// Fixed built-ins per room, inline SVG sticker style. Everything here is BACKDROP —
// appended to the hills layer, so placed furniture (ground layer) always paints on top.
// Windows follow device time; the Bedroom leans darker and cosier at night.

// The switcher thumbnail: wall over floor in the room's own palette, with an accent
// dot — the identity reads before entering (no emoji-as-art in scenes, house law).
function roomThumbSVG(r) {
  const p = r.palette;
  return `<svg viewBox="0 0 40 30" width="34" height="26" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="26" rx="6" fill="${p.wall}"/>
    <path d="M2 19 h36 v3 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6 z" fill="${p.floor}"/>
    <circle cx="29" cy="11" r="4.5" fill="${p.accent}" stroke="#2A1B4E" stroke-width="1.6"/>
    <rect x="2" y="2" width="36" height="26" rx="6" fill="none" stroke="#2A1B4E" stroke-width="3.2"/>
  </svg>`;
}

// Which sky a window shows, by device hour: dawn 5-7, day 8-16, dusk 17-18, night 19-4.
function skyBandName(hour) {
  if (hour >= 19 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour >= 17) return 'dusk';
  return 'day';
}
const WINDOW_SKY_STOPS = {
  night: ['#201858', '#0E0A2E'],
  dawn:  ['#FFD9A8', '#FFB58A'],
  dusk:  ['#C77BB8', '#FF9A6B'],
  day:   ['#8FC7FF', '#5BA3E8']
};

// One window, reused by every room. viewBox 0 0 110 150. `drawn` closes the curtains
// over the glass (the Bedroom at night); otherwise they hang open at the sides.
function roomWindowSVG(uid, hour, drawn, cA, cB) {
  const band = skyBandName(hour);
  const [s1, s2] = WINDOW_SKY_STOPS[band];
  const night = band === 'night';
  const skyBits = night
    ? `<circle cx="72" cy="42" r="12" fill="#FFF3C4"/><circle cx="66" cy="38" r="11" fill="${s1}"/>
       <circle cx="36" cy="34" r="1.8" fill="#FFF"/><circle cx="48" cy="58" r="1.4" fill="#FFF"/><circle cx="30" cy="76" r="1.6" fill="#FFF"/>`
    : (band === 'day'
      ? `<circle cx="76" cy="40" r="11" fill="#FFE08A"/><ellipse cx="40" cy="66" rx="14" ry="6" fill="#FFF" opacity="0.85"/>`
      : `<ellipse cx="46" cy="52" rx="16" ry="6" fill="#FFF" opacity="0.55"/>`);
  const curtains = drawn
    ? `<path d="M16 18 h39 q4 30 0 51 q4 30 0 51 h-39 z" fill="${cA}" stroke="#6B4234" stroke-width="3"/>
       <path d="M94 18 h-39 q-4 30 0 51 q-4 30 0 51 h39 z" fill="${cB}" stroke="#6B4234" stroke-width="3"/>
       <path d="M25 30 v88 M35 26 v96 M45 24 v100 M75 26 v96 M85 30 v88" stroke="rgba(90,50,70,.25)" stroke-width="3" fill="none"/>`
    : `<path d="M16 18 q14 8 10 50 q-2 30 -6 52 h-14 v-102 z" fill="${cA}" stroke="#6B4234" stroke-width="3"/>
       <path d="M94 18 q-14 8 -10 50 q2 30 6 52 h14 v-102 z" fill="${cB}" stroke="#6B4234" stroke-width="3"/>`;
  return `<svg viewBox="0 0 110 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="10" width="94" height="122" rx="9" fill="#B87D55" stroke="#6B4234" stroke-width="4"/>
    <defs><linearGradient id="winSky-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/>
    </linearGradient></defs>
    <rect x="16" y="18" width="78" height="102" rx="5" fill="url(#winSky-${uid})"/>
    ${skyBits}
    <path d="M55 18 v102 M16 69 h78" stroke="#F7E4C1" stroke-width="5"/>
    <rect x="16" y="18" width="78" height="102" rx="5" fill="none" stroke="#6B4234" stroke-width="3"/>
    ${curtains}
    <rect x="2" y="0" width="106" height="12" rx="6" fill="#8A5A72" stroke="#6B4234" stroke-width="3"/>
    <rect x="4" y="130" width="102" height="12" rx="5" fill="#C9935F" stroke="#6B4234" stroke-width="3.5"/>
  </svg>`;
}

// The Lounge fireplace. Ember flames flicker (.rm-flame / .rm-glow, CSS-animated,
// opacity+transform only); reduced-motion stills them into a static warm glow.
function fireplaceSVG() {
  return `<svg viewBox="0 0 220 190" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="10" width="184" height="166" rx="8" fill="#E8CBA4" stroke="#6B4234" stroke-width="4"/>
    <path d="M30 22 h30 M70 22 h30 M110 22 h30 M150 22 h30 M50 40 h30 M90 40 h30 M130 40 h30" stroke="rgba(160,90,50,.35)" stroke-width="5" stroke-linecap="round"/>
    <rect x="8" y="46" width="204" height="18" rx="8" fill="#A9743F" stroke="#6B4234" stroke-width="4"/>
    <path d="M58 172 v-58 a52 46 0 0 1 104 0 v58 z" fill="#3A2430" stroke="#6B4234" stroke-width="4"/>
    <ellipse class="rm-glow" cx="110" cy="152" rx="44" ry="26" fill="#FF9B3D" opacity="0.5"/>
    <path class="rm-flame f1" d="M110 158 q-16 -14 -6 -34 q4 -9 6 -16 q2 7 6 16 q10 20 -6 34 z" fill="#FF8C42"/>
    <path class="rm-flame f2" d="M96 158 q-9 -9 -4 -21 q3 -6 5 -11 q2 5 4 11 q5 12 -5 21 z" fill="#FFB347"/>
    <path class="rm-flame f3" d="M124 158 q-9 -9 -4 -21 q3 -6 5 -11 q2 5 4 11 q5 12 -5 21 z" fill="#FFD166"/>
    <rect x="72" y="150" width="76" height="11" rx="5.5" fill="#8A5A32" stroke="#5C3A2E" stroke-width="3" transform="rotate(-4 110 156)"/>
    <rect x="76" y="158" width="76" height="11" rx="5.5" fill="#9A6549" stroke="#5C3A2E" stroke-width="3" transform="rotate(3 114 163)"/>
    <rect x="30" y="172" width="160" height="14" rx="7" fill="#B9B0A6" stroke="#6B4234" stroke-width="4"/>
    <g><rect x="34" y="26" width="14" height="18" rx="4" fill="#7FB3D5" stroke="#6B4234" stroke-width="3"/>
       <circle cx="41" cy="22" r="5" fill="#FF9AD5" stroke="#6B4234" stroke-width="2.5"/></g>
    <g><rect x="172" y="28" width="18" height="16" rx="3" fill="#C0562F" stroke="#6B4234" stroke-width="3"/></g>
  </svg>`;
}

// The Lounge front door — the way home has always looked, redrawn as a sticker.
function frontDoorSVG() {
  return `<svg viewBox="0 0 120 210" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 205 v-135 a50 55 0 0 1 100 0 v135 z" fill="#C88960" stroke="#68424A" stroke-width="6"/>
    <path d="M24 200 v-128 a36 42 0 0 1 72 0 v128 z" fill="#A86B51" stroke="#68424A" stroke-width="4"/>
    <path d="M42 190 v-115 M60 192 v-122 M78 190 v-115" stroke="rgba(70,35,25,.35)" stroke-width="4"/>
    <path d="M38 66 a24 26 0 0 1 44 0 z" fill="#FFE9B8" stroke="#68424A" stroke-width="4"/>
    <circle cx="88" cy="120" r="8" fill="#FFC93C" stroke="#68424A" stroke-width="4"/>
  </svg>`;
}

// The Kitchen sink unit: a cabinet under the window, basin and tap on top. The top
// 30% of the viewBox is transparent air for the tap so it overlaps the window sill.
function sinkUnitSVG() {
  return `<svg viewBox="0 0 190 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M96 58 v-16 a20 20 0 0 0 -20 -20 h-6" fill="none" stroke="#9FB2C8" stroke-width="9" stroke-linecap="round"/>
    <path d="M96 58 v-16 a20 20 0 0 0 -20 -20 h-6" fill="none" stroke="#7A8FA8" stroke-width="4" stroke-linecap="round"/>
    <circle cx="70" cy="22" r="6" fill="#E8EEF5" stroke="#7A8FA8" stroke-width="3"/>
    <rect x="46" y="52" width="98" height="14" rx="7" fill="#C6D3DF" stroke="#6B4234" stroke-width="3.5"/>
    <rect x="0" y="60" width="190" height="16" rx="5" fill="#A9743F" stroke="#6B4234" stroke-width="4"/>
    <rect x="8" y="76" width="174" height="118" rx="6" fill="#F1E9D2" stroke="#6B4234" stroke-width="4"/>
    <rect x="20" y="88" width="66" height="94" rx="5" fill="#E4D8B8" stroke="#8E634D" stroke-width="3.5"/>
    <rect x="104" y="88" width="66" height="94" rx="5" fill="#E4D8B8" stroke="#8E634D" stroke-width="3.5"/>
    <circle cx="76" cy="134" r="6" fill="#C0562F" stroke="#6B4234" stroke-width="3"/>
    <circle cx="114" cy="134" r="6" fill="#C0562F" stroke="#6B4234" stroke-width="3"/>
  </svg>`;
}

// The Kitchen's high shelf: three jars and the teapot. Nobody reaches it; it is the
// room saying "meals happen here".
function kitchenShelfSVG() {
  return `<svg viewBox="0 0 200 90" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="62" width="200" height="12" rx="6" fill="#9A6549" stroke="#593C44" stroke-width="4"/>
    <path d="M24 74 l10 14 h-20 z M166 74 l10 14 h-20 z" fill="#7A5240" stroke="#593C44" stroke-width="3"/>
    <g><rect x="14" y="30" width="26" height="32" rx="6" fill="#E8A33D" stroke="#593C44" stroke-width="3.5"/>
       <rect x="16" y="24" width="22" height="9" rx="4" fill="#B98A4A" stroke="#593C44" stroke-width="3"/>
       <rect x="20" y="40" width="14" height="12" rx="2" fill="#FFF8E8"/></g>
    <g><rect x="50" y="34" width="24" height="28" rx="6" fill="#C2517C" stroke="#593C44" stroke-width="3.5"/>
       <rect x="52" y="28" width="20" height="9" rx="4" fill="#8A3A66" stroke="#593C44" stroke-width="3"/>
       <rect x="55" y="43" width="14" height="10" rx="2" fill="#FFF8E8"/></g>
    <g><rect x="82" y="28" width="26" height="34" rx="6" fill="#4E9A8F" stroke="#593C44" stroke-width="3.5"/>
       <rect x="84" y="22" width="22" height="9" rx="4" fill="#39746B" stroke="#593C44" stroke-width="3"/></g>
    <g><path d="M128 62 a26 22 0 0 1 52 0 z" fill="#7FB3D5" stroke="#593C44" stroke-width="3.5"/>
       <path d="M128 52 q-12 -2 -10 -14 l8 2 q-2 6 4 8 z" fill="#7FB3D5" stroke="#593C44" stroke-width="3"/>
       <path d="M178 50 q10 -8 4 -16" fill="none" stroke="#593C44" stroke-width="4" stroke-linecap="round"/>
       <circle cx="154" cy="38" r="5" fill="#FFC93C" stroke="#593C44" stroke-width="3"/></g>
  </svg>`;
}

// The Bedroom fairy lights: a swagged wire across the whole wall, bulbs cycling four
// sweet colours. `on` after dark — halos glow (CSS), reduced-motion holds them steady.
function fairyLightsSVG(w, h, on) {
  const cols = ['#FFD98A', '#FF9AD5', '#9AD5FF', '#B8F0A0'];
  const n = Math.max(8, Math.round(w / 130));
  const margin = w * 0.04, span = w - margin * 2;
  const yFor = (t) => h * (0.30 + 0.34 * Math.abs(Math.sin(t * Math.PI * 3)));
  let wire = `M ${margin.toFixed(0)} ${yFor(0).toFixed(0)}`;
  const bulbs = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = margin + span * t, y = yFor(t);
    const px = margin + span * (i - 0.5) / n, py = yFor((i - 0.5) / n) + h * 0.12;
    wire += ` Q ${px.toFixed(0)} ${py.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)}`;
    const c = cols[i % cols.length];
    bulbs.push(`<g class="rm-fairy${on ? ' on' : ''}" style="--dl:${(-i * 0.35).toFixed(2)}s">
      <circle class="rm-fairy-halo" cx="${px.toFixed(0)}" cy="${(py + 6).toFixed(0)}" r="11" fill="${c}"/>
      <circle cx="${px.toFixed(0)}" cy="${(py + 6).toFixed(0)}" r="4.5" fill="${c}" stroke="#6B5A86" stroke-width="2"/>
    </g>`);
  }
  return `<svg viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="${wire}" fill="none" stroke="#7A6B8F" stroke-width="3"/>
    ${bulbs.join('')}
  </svg>`;
}

// Assemble a room's fixed built-ins as positioned wrappers over the wall band.
// Positions are fractions of worldW; sizes hang off wallH so every viewport scales.
function roomBuiltinsHTML(rid, worldW, wallH, viewH, hour) {
  const night = isNight(hour);
  const band = skyBandName(hour);
  const box = (id, x, top, w, h, inner, attrs = '') =>
    `<div class="t-builtin bi-${id}" data-builtin="${id}" ${attrs} style="left:${x.toFixed(0)}px;top:${top.toFixed(0)}px;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px">${inner}</div>`;
  if (rid === 'kitchen') {
    const winH = wallH * 0.40, winW = winH * 0.73, winX = worldW * 0.26 - winW / 2;
    const sinkH = wallH * 0.52, sinkW = wallH * 0.66;
    const shelfW = wallH * 0.58, shelfH = wallH * 0.26;
    return box('window', winX, wallH * 0.06, winW, winH, roomWindowSVG('kitchen', hour, false, '#8FBFB5', '#A8D2C8'), `data-sky="${band}"`)
      + box('sink', worldW * 0.26 - sinkW / 2, wallH - sinkH, sinkW, sinkH, sinkUnitSVG())
      + box('shelf', worldW * 0.47, wallH * 0.14, shelfW, shelfH, kitchenShelfSVG());
  }
  if (rid === 'bedroom') {
    const winH = wallH * 0.42, winW = winH * 0.73;
    return box('fairylights', 0, wallH * 0.02, worldW, wallH * 0.26, fairyLightsSVG(worldW, wallH * 0.26, night), `data-lights="${night ? 'on' : 'off'}"`)
      + box('window', worldW * 0.26 - winW / 2, wallH * 0.20, winW, winH, roomWindowSVG('bedroom', hour, night, '#B48BD1', '#C9A6E3'), `data-sky="${band}" data-curtains="${night ? 'drawn' : 'open'}"`);
  }
  // lounge
  const doorH = wallH * 0.62, doorW = doorH * 0.57;
  const fireH = wallH * 0.55, fireW = fireH * 1.15;
  const winH = wallH * 0.42, winW = winH * 0.73;
  return box('door', worldW * 0.035, wallH - doorH, doorW, doorH, frontDoorSVG())
    + box('fireplace', worldW * 0.30 - fireW / 2, wallH - fireH, fireW, fireH, fireplaceSVG())
    + box('window', worldW * 0.58, wallH * 0.14, winW, winH, roomWindowSVG('lounge', hour, false, '#FF9AD5', '#FF9AD5'), `data-sky="${band}"`);
}

// ---- zone identity: the distinct near backdrop per zone (RUN7 C2) --------
// Drawn in the GROUND layer at real pixels so objects keep their shape and stay
// aligned with the Boos. Everything sits ABOVE the placement band (y < h*0.62) or is
// thin decoration at the bank — the band itself (0.62→1.0) stays clear for placement.
// Animation classes (.rv-*/.hl-*/.bc-*) are transform/opacity-only; reduced-motion stills them.
function zoneScenery(key, w, h, night, opts = {}) {
  if (key === 'meadow')     return meadowScenery(w, h, night);
  if (key === 'riverside')  return riversideScenery(w, h, night);
  if (key === 'hilltop')    return hilltopScenery(w, h, night);
  if (key === 'beach')      return beachScenery(w, h, night);
  if (key === 'playground') return playgroundScenery(w, h, night, opts);
  return '';
}

// RUN13B T8 — the Meadow dressed: a rolling horizon with a distant hedgerow and one
// far-off windmill silhouette, slow two-layer clouds, the fixed oak at the left edge
// (delights.js's hide-and-seek fallback oak at x 0.15, finally visible), and wildflower
// tufts scattered on the ground band. Everything sits above the placement band or is
// thin ground decoration; the only animated bits are the clouds (transform-only).
function meadowScenery(w, h, night) {
  const far = night ? '#4A7A57' : '#9BD89B', mid = night ? '#3E6E4A' : '#84CB84', hedge = night ? '#2E5A3A' : '#4F9B58';
  const bandTop = h * 0.62;
  // the rolling hill line, two depths, cresting gently across the whole zone
  // fills stop at the band top (0.62h): the grass band's own gradient is the ground
  const hills = `
    <path d="M0 ${(h * 0.50).toFixed(0)} Q${(w * 0.15).toFixed(0)} ${(h * 0.42).toFixed(0)} ${(w * 0.32).toFixed(0)} ${(h * 0.49).toFixed(0)} T${(w * 0.62).toFixed(0)} ${(h * 0.47).toFixed(0)} T${w.toFixed(0)} ${(h * 0.50).toFixed(0)} L${w.toFixed(0)} ${bandTop.toFixed(0)} L0 ${bandTop.toFixed(0)} Z" fill="${far}"/>
    <path d="M0 ${(h * 0.57).toFixed(0)} Q${(w * 0.25).toFixed(0)} ${(h * 0.51).toFixed(0)} ${(w * 0.5).toFixed(0)} ${(h * 0.56).toFixed(0)} T${w.toFixed(0)} ${(h * 0.55).toFixed(0)} L${w.toFixed(0)} ${bandTop.toFixed(0)} L0 ${bandTop.toFixed(0)} Z" fill="${mid}"/>`;
  // the distant hedgerow: a lumpy row of bushes sitting on the far hill line
  const hedgerow = Array.from({ length: Math.ceil(w / 150) }, (_, i) => {
    const x = (i + 0.5) * 150, yy = h * (0.505 + (i % 3) * 0.008);
    return `<ellipse cx="${x.toFixed(0)}" cy="${yy.toFixed(0)}" rx="${(52 + (i % 3) * 14).toFixed(0)}" ry="${(15 + (i % 2) * 4).toFixed(0)}" fill="${hedge}" opacity="0.85"/>`;
  }).join('');
  // one far-off windmill, a single-colour silhouette on the crest (the REAL windmill
  // lives on the Hilltop; this one is the horizon saying "the world keeps going")
  const wx = w * 0.78, wy = h * 0.43;
  const windmill = `<g fill="${night ? '#243E52' : '#5E8F63'}" opacity="0.9">
    <path d="M${(wx - 9).toFixed(0)} ${(wy + 46).toFixed(0)} L${(wx - 5).toFixed(0)} ${wy.toFixed(0)} L${(wx + 5).toFixed(0)} ${wy.toFixed(0)} L${(wx + 9).toFixed(0)} ${(wy + 46).toFixed(0)} Z"/>
    ${[45, 135, 225, 315].map(a => `<path transform="rotate(${a} ${wx.toFixed(1)} ${(wy - 2).toFixed(1)})" d="M${wx.toFixed(0)} ${(wy - 2).toFixed(0)} l-4 -26 l8 0 z"/>`).join('')}
    <circle cx="${wx.toFixed(0)}" cy="${(wy - 2).toFixed(0)}" r="3.4"/></g>`;
  // the fixed oak at the left edge — trunk planted on the band top, canopy above it
  const ox = 0.15 * w, obase = bandTop + 8;
  const leaf = night ? '#3E7A54' : '#5FB86E', leaf2 = night ? '#356A48' : '#4FA85E';
  const oak = `<g class="mw-oak">
    <path d="M${(ox - 12).toFixed(0)} ${obase.toFixed(0)} q 2 -40 -8 -62 l 12 6 q 4 -18 8 -26 q 4 8 8 26 l 12 -6 q -10 22 -8 62 z" fill="#8A5A32" stroke="#5C3A2E" stroke-width="4"/>
    <ellipse cx="${(ox - 34).toFixed(0)}" cy="${(obase - 92).toFixed(0)}" rx="42" ry="34" fill="${leaf2}" stroke="#2A6B3E" stroke-width="3.5"/>
    <ellipse cx="${(ox + 34).toFixed(0)}" cy="${(obase - 96).toFixed(0)}" rx="44" ry="36" fill="${leaf2}" stroke="#2A6B3E" stroke-width="3.5"/>
    <ellipse cx="${ox.toFixed(0)}" cy="${(obase - 122).toFixed(0)}" rx="52" ry="42" fill="${leaf}" stroke="#2A6B3E" stroke-width="3.5"/>
    <circle cx="${(ox - 22).toFixed(0)}" cy="${(obase - 118).toFixed(0)}" r="5" fill="#FFF" opacity="0.25"/>
    <circle cx="${(ox + 16).toFixed(0)}" cy="${(obase - 134).toFixed(0)}" r="4" fill="#FFF" opacity="0.25"/></g>`;
  // wildflower tufts on the ground band: thin decoration, never in the way
  const tuftCols = ['#FF7AC6', '#FFD166', '#C6A9F0', '#FF9AD5'];
  const tufts = [0.035, 0.09, 0.165, 0.24, 0.29, 0.37, 0.44, 0.52, 0.58, 0.66, 0.73, 0.81, 0.87, 0.94].map((fx, i) => {
    const x = fx * w, yy = h * (0.68 + (i % 4) * 0.065), c = tuftCols[i % 4];
    return `<g class="mw-tuft" transform="translate(${x.toFixed(0)} ${yy.toFixed(0)})">
      ${[-9, 0, 9].map((o) => `<path d="M${o} 0 q ${o < 0 ? -5 : o > 0 ? 5 : 1} -13 ${o < 0 ? -8 : o > 0 ? 8 : 0} -21" fill="none" stroke="${night ? '#3E7A54' : '#4FA85E'}" stroke-width="3.5" stroke-linecap="round"/>`).join('')}
      <circle cx="${i % 2 ? -8 : 8}" cy="-22" r="5.5" fill="${c}" stroke="#B06A8A" stroke-width="1.8"/>
      <circle cx="${i % 2 ? -8 : 8}" cy="-22" r="2.2" fill="#FFF3B0"/></g>`;
  }).join('');
  // two cloud layers, slower and further than the Hilltop's (the Meadow is calm)
  const clouds = night ? '' : [[0.06, h * 0.10, 0.7, 64, 'a'], [0.34, h * 0.16, 0.55, 78, 'a'], [0.58, h * 0.07, 0.8, 58, 'a'], [0.20, h * 0.22, 1.05, 44, 'b'], [0.74, h * 0.20, 0.95, 50, 'b']].map(([fx, yy, sc, dur, layer], i) =>
    `<div class="mw-cloud ${layer}" style="--d:${(w * 0.4).toFixed(0)}px;--t:${dur}s;--dl:${(-i * 9)}s;left:${(fx * w).toFixed(0)}px;top:${yy.toFixed(0)}px;transform:scale(${sc})"><svg viewBox="0 0 90 40" width="90" height="40"><g fill="#FFFFFF" opacity="${layer === 'a' ? 0.75 : 0.92}"><ellipse cx="28" cy="26" rx="24" ry="14"/><ellipse cx="52" cy="20" rx="22" ry="16"/><ellipse cx="68" cy="27" rx="18" ry="12"/></g></svg></div>`).join('');
  return rSVG(w, h, `${hills}${hedgerow}${windmill}${oak}${tufts}`) + clouds;
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
  const lily = [[0.16, mid + 8], [0.30, top + 16], [0.62, mid + 4], [0.78, mid + 2]].map(([fx, yy], i) =>
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
  // RUN13B T8: a wooden jetty fixed at mid-area, planks out over the water on posts
  const jx = 0.66 * w, jw = Math.min(170, w * 0.14), jy = bot - 8;
  const jetty = `<g class="rv-jetty">
    ${[0.18, 0.55, 0.92].map(t => `<rect x="${(jx + jw * t - 4).toFixed(0)}" y="${jy.toFixed(0)}" width="8" height="26" rx="3" fill="#7A4F2A" stroke="#5C3A2E" stroke-width="2"/>`).join('')}
    <rect x="${jx.toFixed(0)}" y="${(jy - 10).toFixed(0)}" width="${jw.toFixed(0)}" height="12" rx="5" fill="#A9743F" stroke="#5C3A2E" stroke-width="3"/>
    ${Array.from({ length: 6 }, (_, i) => `<line x1="${(jx + (i + 1) * jw / 7).toFixed(0)}" y1="${(jy - 10).toFixed(0)}" x2="${(jx + (i + 1) * jw / 7).toFixed(0)}" y2="${(jy + 2).toFixed(0)}" stroke="#8A5A32" stroke-width="2"/>`).join('')}
    <rect x="${(jx - 6).toFixed(0)}" y="${(jy - 14).toFixed(0)}" width="10" height="18" rx="3" fill="#8A5A32" stroke="#5C3A2E" stroke-width="2.5"/>
    <circle cx="${(jx + jw - 8).toFixed(0)}" cy="${(jy - 16).toFixed(0)}" r="5" fill="#FF5C8A" stroke="#B0447E" stroke-width="2"/>
    <path d="M${(jx + jw - 8).toFixed(0)} ${(jy - 11).toFixed(0)} q -3 6 0 10" fill="none" stroke="#B0447E" stroke-width="2"/>
  </g>`;
  const dfly = night ? '' : [[0.20, top - 26, 3], [0.66, top - 40, 5]].map(([fx, yy, dl]) =>
    `<g class="rv-dragonfly" style="--dl:${-dl}s;left:${(fx * w).toFixed(0)}px;top:${yy.toFixed(0)}px"><ellipse cx="0" cy="0" rx="10" ry="2" fill="#6AA9C9"/><ellipse class="rv-wing" cx="-2" cy="-4" rx="7" ry="3" fill="#BFE6F5" opacity="0.8"/><ellipse class="rv-wing" cx="-2" cy="4" rx="7" ry="3" fill="#BFE6F5" opacity="0.8"/></g>`).join('');
  return rSVG(w, h, `
    <rect x="0" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${(bot - top).toFixed(0)}" fill="${water}"/>
    <rect x="0" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="7" fill="${deep}" opacity="0.7"/>
    <rect x="0" y="${(bot - 6).toFixed(0)}" width="${w.toFixed(0)}" height="6" fill="${deep}" opacity="0.5"/>
    ${ripples('a', [top + 22, mid + 6, bot - 14], 9, 60)}${ripples('b', [top + 40, mid + 22], 13, -50)}
    ${shimmer}${lily}${jetty}${bridge}${reeds}`)
    // dragonflies + paper boat live OUTSIDE the svg as positioned DOM (their own drift anims)
    + dfly
    + (night ? '' : `<div class="rv-boat" style="--d:${(w + 120).toFixed(0)}px;top:${(top + 6).toFixed(0)}px"><svg viewBox="0 0 54 34" width="46" height="30"><path d="M4 20 h46 l-8 12 h-30 z" fill="#FFF3E0" stroke="#C97B4A" stroke-width="2"/><path d="M27 20 v-16 l14 12 z" fill="#FF9AD5" stroke="#C0568F" stroke-width="1.6"/></svg></div>`);
}

function hilltopScenery(w, h, night) {
  const grass = night ? '#3E6E4A' : '#7CC98A';
  const crestX = WINDMILL_X * w, crestY = h * 0.44;
  const bandTop = h * 0.62;
  // faster, closer clouds drifting across the sky
  const clouds = night ? '' : [[0.10, h * 0.14, 1.0, 26], [0.5, h * 0.09, 1.25, 20], [0.8, h * 0.2, 0.8, 32]].map(([fx, yy, sc, dur], i) =>
    `<div class="hl-cloud" style="--d:${(w * 0.5).toFixed(0)}px;--t:${dur}s;--dl:${(-i * 5)}s;left:${(fx * w).toFixed(0)}px;top:${yy.toFixed(0)}px;transform:scale(${sc})"><svg viewBox="0 0 90 40" width="90" height="40"><g fill="#FFFFFF" opacity="0.9"><ellipse cx="28" cy="26" rx="24" ry="14"/><ellipse cx="52" cy="20" rx="22" ry="16"/><ellipse cx="68" cy="27" rx="18" ry="12"/></g></svg></div>`).join('');
  // RUN13B T8: layered hill silhouettes falling away BEHIND the crest — three depths,
  // palest furthest, real rounded summits (not flat bands), so the hilltop finally
  // reads as height. Each layer is a run of Q-curve crests across the whole zone.
  const farCols = night ? ['#22405A', '#2A4E66', '#335E72'] : ['#BFE3D8', '#A2D6BE', '#8ACCA4'];
  const rollingPath = (baseY, amp, wavelength, phase) => {
    let d = `M0 ${(baseY - amp * 0.3).toFixed(0)}`;
    const nWaves = Math.ceil(w / wavelength);
    for (let i = 0; i < nWaves; i++) {
      const crestAmp = amp * (0.6 + 0.4 * Math.abs(Math.sin(i * 2.7 + phase)));
      d += ` Q ${((i + 0.5) * wavelength).toFixed(0)} ${(baseY - crestAmp).toFixed(0)} ${((i + 1) * wavelength).toFixed(0)} ${(baseY - amp * 0.25 * ((i % 3) - 0.5)).toFixed(0)}`;
    }
    return d + ` L${w.toFixed(0)} ${bandTop.toFixed(0)} L0 ${bandTop.toFixed(0)} Z`;
  };
  const farHills = [
    `<path d="${rollingPath(h * 0.40, h * 0.11, 640, 0.4)}" fill="${farCols[0]}"/>`,
    `<path d="${rollingPath(h * 0.50, h * 0.13, 520, 2.1)}" fill="${farCols[1]}"/>`,
    `<path d="${rollingPath(h * 0.585, h * 0.14, 430, 4.4)}" fill="${farCols[2]}"/>`
  ].join('');
  // the big rounded hill rising to the crest, a gentle rise across the whole zone
  // (fill stops at the band top — the grass band's own gradient is the ground)
  const hill = `<path d="M0 ${(h * 0.66).toFixed(0)} Q${(w * 0.28).toFixed(0)} ${(h * 0.60).toFixed(0)} ${(crestX - 120).toFixed(0)} ${(crestY + 40).toFixed(0)} Q${crestX.toFixed(0)} ${(crestY - 8).toFixed(0)} ${(crestX + 120).toFixed(0)} ${(crestY + 46).toFixed(0)} Q${(w * 0.9).toFixed(0)} ${(h * 0.62).toFixed(0)} ${w.toFixed(0)} ${(h * 0.6).toFixed(0)} L${w.toFixed(0)} ${bandTop.toFixed(0)} L0 ${bandTop.toFixed(0)} Z" fill="${grass}"/>`;
  // long grass swaying at the ground line (transform-only; reduced-motion stills it) —
  // the blades rise ABOVE the band top against the pale far hills so they really show.
  // Positions are baked into the path coords (like the riverside reeds): the sway
  // animation owns the transform property, so a transform attribute would be lost.
  const grassCol = night ? '#2F5A3A' : '#3E8B50';
  const longGrass = Array.from({ length: Math.ceil(w / 150) }, (_, i) => {
    const x = (i + 0.35) * 150 + (i % 3) * 26, base = bandTop + 6;
    return `<g class="hl-grass" style="--dl:${(-i * 0.45).toFixed(2)}s">
      ${[-11, -4, 4, 11].map((o, k) => `<path d="M${(x + o).toFixed(0)} ${base.toFixed(0)} q ${o < 0 ? -6 : 6} -18 ${o < 0 ? -10 : 10} -${34 + (k % 2) * 10}" fill="none" stroke="${grassCol}" stroke-width="4" stroke-linecap="round"/>`).join('')}
    </g>`;
  }).join('');
  // a kite fixed to a far hill, bobbing gently on its string
  const kx = w * 0.16, ky = h * 0.22, ax = w * 0.13, ay = h * 0.44;
  const kite = `<g class="hl-kite">
    <path d="M${ax.toFixed(0)} ${ay.toFixed(0)} Q${((ax + kx) / 2 + 18).toFixed(0)} ${((ay + ky) / 2).toFixed(0)} ${kx.toFixed(0)} ${(ky + 26).toFixed(0)}" fill="none" stroke="#8A6B3A" stroke-width="2.5" opacity="0.8"/>
    ${[[0.4, 8], [0.62, -6], [0.82, 7]].map(([t, o]) => { const px = ax + (kx - ax) * t + o, py = ay + (ky + 26 - ay) * t; return `<path d="M${px.toFixed(0)} ${py.toFixed(0)} l7 4 l-7 4 l-7 -4 z" fill="${o > 0 ? '#FFC93C' : '#FF7AC6'}" stroke="#2A1B4E" stroke-width="1.6"/>`; }).join('')}
    <path d="M${kx.toFixed(0)} ${(ky - 24).toFixed(0)} L${(kx + 20).toFixed(0)} ${ky.toFixed(0)} L${kx.toFixed(0)} ${(ky + 26).toFixed(0)} L${(kx - 20).toFixed(0)} ${ky.toFixed(0)} Z" fill="#FF7AC6" stroke="#B0447E" stroke-width="3"/>
    <path d="M${kx.toFixed(0)} ${(ky - 24).toFixed(0)} V${(ky + 26).toFixed(0)} M${(kx - 20).toFixed(0)} ${ky.toFixed(0)} H${(kx + 20).toFixed(0)}" stroke="#B0447E" stroke-width="2"/>
  </g>`;
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
  return rSVG(w, h, `${farHills}${hill}${kite}${windmill}${longGrass}`) + clouds;
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
  // RUN13B T8: a striped parasol and towel, and a bucket-and-spade on the sand band —
  // the beach looks mid-picnic even before anything is placed. All thin/flat props.
  const px2 = w * 0.185, pbase = h * 0.66;   // parasol camp inside the first screenful
  const pcx = px2 + 10, pcy = pbase - 58, pR = 70, pr = 52;   // canopy centre, rim radii
  const rim = (t) => [pcx + pR * Math.cos(Math.PI * (1 - t)), pcy - pr * Math.sin(Math.PI * (1 - t))];
  // a striped wedge: apex at the dome's crown, out to two rim points, arc along the rim
  const wedge = (t1, t2, c) => {
    const [x1, y1] = rim(t1), [x2, y2] = rim(t2);
    return `<path d="M${pcx.toFixed(0)} ${(pcy - pr + 2).toFixed(0)} L${x1.toFixed(0)} ${y1.toFixed(0)} A ${pR} ${pr} 0 0 1 ${x2.toFixed(0)} ${y2.toFixed(0)} Z" fill="${c}"/>`;
  };
  const dome = `M${(pcx - pR).toFixed(0)} ${pcy.toFixed(0)} A ${pR} ${pr} 0 0 1 ${(pcx + pR).toFixed(0)} ${pcy.toFixed(0)} Z`;
  const parasol = `<g class="bc-parasol" transform="rotate(-6 ${pcx.toFixed(0)} ${pcy.toFixed(0)})">
    <path d="M${px2.toFixed(0)} ${pbase.toFixed(0)} L${pcx.toFixed(0)} ${(pcy - pr - 8).toFixed(0)}" stroke="#8A5A32" stroke-width="6" stroke-linecap="round"/>
    <path d="${dome}" fill="#FF7AC6"/>
    ${wedge(0.13, 0.33, '#FFF3D9')}${wedge(0.53, 0.73, '#FFF3D9')}
    <path d="${dome}" fill="none" stroke="#B0447E" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="${pcx.toFixed(0)}" cy="${(pcy - pr - 9).toFixed(0)}" r="5.5" fill="#FFC93C" stroke="#B0447E" stroke-width="2"/>
  </g>`;
  const tx = px2 + 66, ty2 = h * 0.70;
  const towel = `<g class="bc-towel" transform="rotate(-3 ${tx.toFixed(0)} ${ty2.toFixed(0)})">
    <rect x="${tx.toFixed(0)}" y="${ty2.toFixed(0)}" width="104" height="34" rx="8" fill="#8FC7FF" stroke="#4A7FB5" stroke-width="3"/>
    ${[10, 30, 50, 70, 88].map((o, i) => `<rect x="${(tx + o).toFixed(0)}" y="${(ty2 + 3).toFixed(0)}" width="9" height="28" rx="4" fill="${i % 2 ? '#FFF8F0' : '#FFC93C'}" opacity="0.85"/>`).join('')}
  </g>`;
  const bx2 = w * 0.115, by2 = h * 0.78;   // bucket-and-spade by the parasol camp
  const bucket = `<g class="bc-bucket">
    <path d="M${(bx2 - 16).toFixed(0)} ${(by2 - 26).toFixed(0)} h32 l-5 28 h-22 z" fill="#FF5C8A" stroke="#B0447E" stroke-width="3"/>
    <path d="M${(bx2 - 14).toFixed(0)} ${(by2 - 26).toFixed(0)} a 15 10 0 0 1 28 0" fill="none" stroke="#B0447E" stroke-width="3"/>
    <path d="M${(bx2 + 22).toFixed(0)} ${(by2 + 2).toFixed(0)} l14 -30 l7 3 l-11 29 z" fill="#FFC93C" stroke="#8A6B3A" stroke-width="2.5"/>
    <rect x="${(bx2 + 30).toFixed(0)}" y="${(by2 - 40).toFixed(0)}" width="12" height="16" rx="5" fill="#FFC93C" stroke="#8A6B3A" stroke-width="2.5"/>
    <ellipse cx="${(bx2 + 4).toFixed(0)}" cy="${(by2 + 6).toFixed(0)}" rx="34" ry="5" fill="#D9BE7E" opacity="0.6"/>
  </g>`;
  // a little sailing boat crossing the far sea once every few minutes (CSS drift, ~3min;
  // reduced-motion anchors it mid-sea instead of hiding it)
  const boat = night ? '' : `<div class="bc-sail" style="--d:${(w + 280).toFixed(0)}px;left:-140px;top:${(seaTop + 10).toFixed(0)}px">
    <svg viewBox="0 0 60 44" width="52" height="38"><path d="M6 30 h48 l-9 12 h-30 z" fill="#FFF3E0" stroke="#C97B4A" stroke-width="2.5"/><path d="M30 30 v-24 l16 20 z" fill="#FFF8F0" stroke="#8FA8C8" stroke-width="2"/><path d="M28 30 v-20 l-12 16 z" fill="#FF9AD5" stroke="#C0568F" stroke-width="2"/><circle cx="30" cy="4" r="2.5" fill="#FF5C8A"/></svg></div>`;
  // two gulls on lazy arcs over the sea, day only, well within the particle caps
  const gulls = night ? '' : [[0.14, h * 0.12, 13, 0], [0.62, h * 0.08, 17, -6]].map(([fx, yy, dur, dl]) =>
    `<div class="bc-gull" style="--t:${dur}s;--dl:${dl}s;left:${(fx * w).toFixed(0)}px;top:${yy.toFixed(0)}px">
      <svg viewBox="0 0 34 14" width="30" height="12"><path d="M2 10 Q9 2 17 8 Q25 2 32 10" fill="none" stroke="#6B7A99" stroke-width="3" stroke-linecap="round"/></svg></div>`).join('');
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
    ${foamPath(0, 0.9)}${foamPath(-2.5, 0.5)}${palm}${hut}${parasol}${towel}${bucket}${shells}`)
    + boat + gulls;
}

// The Playground (RUN10 P1, redressed RUN13B T8): the review called it bare sand. Now:
// a soft-play tile ground (two gentle tones, on the band via CSS), a painted hopscotch
// strip, a low colourful fence PLANTED at the ground line with bunting above it, and a
// fixed noticeboard whose poster rotates with the caper state.
function playgroundScenery(w, h, night, opts = {}) {
  const bandTop = h * 0.62;
  // the low fence, feet on the ground line, pickets in cheerful pastels
  const picketCols = ['#FF9AD5', '#8FD3D9', '#FFD166', '#C6A9F0'];
  const fence = Array.from({ length: Math.ceil(w / 60) + 1 }, (_, i) =>
    `<rect x="${(i * 60).toFixed(0)}" y="${(bandTop - 36).toFixed(0)}" width="9" height="40" rx="3" fill="${night ? '#5E6E8A' : picketCols[i % 4]}" stroke="#6B5A86" stroke-width="2"/>`).join('') +
    `<rect x="0" y="${(bandTop - 24).toFixed(0)}" width="${w.toFixed(0)}" height="7" rx="3" fill="${night ? '#4E5E7A' : '#EFA84C'}" opacity="0.9"/>` +
    `<rect x="0" y="${(bandTop - 10).toFixed(0)}" width="${w.toFixed(0)}" height="6" rx="3" fill="${night ? '#4E5E7A' : '#EFA84C'}" opacity="0.75"/>`;
  const buntingY = h * 0.16;
  const flags = Array.from({ length: 10 }, (_, i) => {
    const x = (i + 0.5) / 10 * w, y = buntingY + Math.sin(i / 9 * Math.PI) * 18;
    return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l14 0 l-7 16 z" fill="${['#FF7AC6', '#FFC93C', '#35D0BA', '#8FC7FF'][i % 4]}" stroke="#2A1B4E" stroke-width="1.5"/>`;
  }).join('');
  const bunting = `<path d="M0 ${buntingY.toFixed(0)} Q ${(w / 2).toFixed(0)} ${(buntingY + 30).toFixed(0)} ${w.toFixed(0)} ${buntingY.toFixed(0)}" fill="none" stroke="#2A1B4E" stroke-width="2.5" opacity="0.7"/>${flags}`;
  // the painted hopscotch strip: chalk squares 1-2-3 double-single-double, flat on the
  // ground band (thin decoration — items and Boos always paint over it)
  const chalk = night ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.85)';
  const hsx = w * 0.09, hsy = h * 0.71, cell = 46;   // hopscotch on the first screenful
  const squares = [[0, 0.5, '1'], [1, 0, '2'], [1, 1, '3'], [2, 0.5, '4'], [3, 0, '5'], [3, 1, '6'], [4, 0.5, '7']];
  const hopscotch = `<g class="pg-hopscotch" transform="rotate(-2 ${hsx.toFixed(0)} ${hsy.toFixed(0)})">${squares.map(([col, row, n]) =>
    `<rect x="${(hsx + col * (cell + 6)).toFixed(0)}" y="${(hsy + row * (cell * 0.62 + 5) - cell * 0.31).toFixed(0)}" width="${cell}" height="${(cell * 0.62).toFixed(0)}" rx="7" fill="none" stroke="${chalk}" stroke-width="4"/>
     <text x="${(hsx + col * (cell + 6) + cell / 2).toFixed(0)}" y="${(hsy + row * (cell * 0.62 + 5) - cell * 0.31 + cell * 0.44).toFixed(0)}" font-family="Fredoka,sans-serif" font-size="19" font-weight="700" fill="${chalk}" text-anchor="middle">${n}</text>`).join('')}</g>`;
  // the fixed noticeboard: wanted poster while a caper is open, a cheerful town notice
  // otherwise (state read at render; the caper sweep re-renders scenery on close)
  const nx = w * 0.215, nbase = bandTop + 6;   // the noticeboard greets you on the way in
  const poster = opts.caperOpen
    ? `<g data-poster="caper"><rect x="-38" y="-64" width="76" height="58" rx="4" fill="#FFF3E0" stroke="#8A6B3A" stroke-width="2.5"/>
       <text x="0" y="-46" font-family="Fredoka,sans-serif" font-size="13" font-weight="700" fill="#B0447E" text-anchor="middle">WANTED!</text>
       <circle cx="0" cy="-28" r="11" fill="#C6A9F0" stroke="#2A1B4E" stroke-width="2"/><circle cx="-4" cy="-30" r="2" fill="#2A1B4E"/><circle cx="4" cy="-30" r="2" fill="#2A1B4E"/><path d="M-4 -23 q4 3 8 0" fill="none" stroke="#2A1B4E" stroke-width="1.8"/>
       <text x="0" y="-9" font-family="Fredoka,sans-serif" font-size="10" fill="#5C3A2E" text-anchor="middle">for silly capers</text></g>`
    : `<g data-poster="notice"><rect x="-38" y="-64" width="76" height="58" rx="4" fill="#FFF8F0" stroke="#8A6B3A" stroke-width="2.5"/>
       <text x="0" y="-47" font-family="Fredoka,sans-serif" font-size="12" font-weight="700" fill="#3D8B84" text-anchor="middle">BOO TOWN</text>
       <text x="0" y="-33" font-family="Fredoka,sans-serif" font-size="11" font-weight="700" fill="#B0447E" text-anchor="middle">picnic day!</text>
       <circle cx="-14" cy="-17" r="7" fill="#FFC93C" stroke="#8A6B3A" stroke-width="2"/>
       <circle cx="13" cy="-19" r="7" fill="#FF9AD5" stroke="#B0447E" stroke-width="2"/>
       <path d="M13 -12 q -3 4 0 3" fill="none" stroke="#B0447E" stroke-width="1.8"/></g>`;
  const noticeboard = `<g class="pg-notice" data-notice="${opts.caperOpen ? 'caper' : 'notice'}" transform="translate(${nx.toFixed(0)} ${nbase.toFixed(0)})">
    <rect x="-34" y="-72" width="8" height="72" rx="3" fill="#8A5A32" stroke="#5C3A2E" stroke-width="2.5"/>
    <rect x="26" y="-72" width="8" height="72" rx="3" fill="#8A5A32" stroke="#5C3A2E" stroke-width="2.5"/>
    <rect x="-46" y="-70" width="92" height="70" rx="7" fill="#C9935F" stroke="#5C3A2E" stroke-width="3.5"/>
    <path d="M-50 -70 h100 l-8 -14 h-84 z" fill="#3D8B84" stroke="#2A6B5E" stroke-width="3"/>
    ${poster}</g>`;
  return rSVG(w, h, `${fence}${noticeboard}${hopscotch}${bunting}`);
}

// RUN15 V4 — the Boo Shop's market stall in the Meadow: a striped awning, a counter with
// a few things on it, and a hanging sign. Sticker style, like everything else out here.
function shopStallSVG() {
  const stripes = Array.from({ length: 6 }, (_, i) =>
    `<path d="M${8 + i * 20} 30 L${20 + i * 20} 30 L${16 + i * 20} 52 L${4 + i * 20} 52 Z" fill="${i % 2 ? '#FFF8F0' : '#FF7AC6'}"/>`).join('');
  return `<svg viewBox="0 0 130 118" width="130" height="118" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="52" width="8" height="60" rx="3" fill="#A9743F" stroke="#5C3A2E" stroke-width="3"/>
    <rect x="108" y="52" width="8" height="60" rx="3" fill="#A9743F" stroke="#5C3A2E" stroke-width="3"/>
    <path d="M2 30 h126 l-8 24 h-110 z" fill="#FF7AC6" stroke="#2A1B4E" stroke-width="3"/>
    <g clip-path="url(#stallClip)">${stripes}</g>
    <defs><clipPath id="stallClip"><path d="M2 30 h126 l-8 24 h-110 z"/></clipPath></defs>
    <path d="M2 30 h126 l-8 24 h-110 z" fill="none" stroke="#2A1B4E" stroke-width="3"/>
    <rect x="8" y="74" width="114" height="12" rx="4" fill="#C9935F" stroke="#5C3A2E" stroke-width="3"/>
    <rect x="20" y="60" width="16" height="14" rx="3" fill="#8FC7FF" stroke="#2A1B4E" stroke-width="2.5"/>
    <rect x="44" y="62" width="14" height="12" rx="3" fill="#FFC93C" stroke="#2A1B4E" stroke-width="2.5"/>
    <ellipse cx="76" cy="68" rx="9" ry="7" fill="#35D0BA" stroke="#2A1B4E" stroke-width="2.5"/>
    <rect x="92" y="60" width="14" height="14" rx="3" fill="#C6A9F0" stroke="#2A1B4E" stroke-width="2.5"/>
    <rect x="40" y="4" width="50" height="22" rx="6" fill="#FFF3E0" stroke="#5C3A2E" stroke-width="3"/>
    <path d="M50 26 v4 M80 26 v4" stroke="#5C3A2E" stroke-width="2.5"/>
    <text x="65" y="20" font-family="Fredoka,sans-serif" font-size="13" font-weight="700" fill="#2A1B4E" text-anchor="middle">SHOP</text>
  </svg>`;
}

function signSVG() {
  return `<svg viewBox="0 0 60 70" width="52" height="60"><rect x="27" y="30" width="6" height="38" fill="#8A5A44" stroke="#2A1B4E" stroke-width="2.5"/><rect x="8" y="8" width="44" height="26" rx="5" fill="#F2D6B8" stroke="#2A1B4E" stroke-width="3"/><text x="30" y="26" font-family="Fredoka,sans-serif" font-size="16" fill="#2A1B4E" text-anchor="middle">🔒</text></svg>`;
}
