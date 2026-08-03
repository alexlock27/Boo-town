// data/wishlife.js — WISH LIFE (RUN20 W1).
//
// Every one of the sixty wished things gets an authored behaviour. Until now a wish was a
// sticker: she said the word, the thing appeared, and it stood there forever. "No dead props"
// is law as of RUN18, and this table is the back-fill across the whole wish catalogue.
//
// The CLASSES are the shared machinery (js/wishlife.js); this file is the table that says which
// class each wish gets and with what parameters. Keeping them apart is the point — sixty
// behaviours implemented sixty times would be sixty bugs.
//
// Lines are authored and live in data/guideLines.js; a `line` here names the key, never the
// words. Caps are per the pack: any per-item sound at most once per 20s per item, and every
// spoken line at its own stated cap.

export const WISH_CLASSES = ['SKY', 'FLYER', 'WATER', 'ROAMER', 'TAP', 'SOCKET', 'FOOD', 'GLEAM', 'SWAY'];

// SKY items anchor in the sky band and are OUTDOOR-ONLY (W1 addendum), as are the kite and the
// balloon — an indoor build drawer greys their chip with "needs the sky!".
export const SKY_BAND = { top: 0.06, bottom: 0.30 };
export const OUTDOOR_ONLY = new Set(['sun', 'star', 'moon', 'cloud', 'rainbow', 'kite', 'balloon']);
export const SKY_DRIFT_X = 0.02;      // ±2% x
export const SKY_DRIFT_MS = 12000;    // over 12s
export const SOUND_GAP_MS = 20000;    // per item: at most one sound per 20s
export const AREA_SOUND_GAP_MS = 4000; // the whole area shares one wish-sound limiter (addendum)
export const INDOOR_TIP = 'needs the sky!';

// word -> { cls, ...specifics }. Every one of the sixty is present; the suite asserts it.
export const WISH_LIFE = {
  // ---- the sky -------------------------------------------------------------------------
  sun:      { cls: 'SKY', fx: 'rays', period: 4000 },
  star:     { cls: 'SKY', fx: 'twinkle', period: 3000 },
  moon:     { cls: 'SKY', fx: 'glow', period: 5000, bands: ['dusk', 'night'] },
  cloud:    { cls: 'SKY', fx: 'drift', period: 60000, fullLoop: true },
  rainbow:  { cls: 'SKY', fx: 'shimmer', period: 6000, doubleWidth: true },
  // ---- tap verbs -----------------------------------------------------------------------
  snowman:  { cls: 'TAP', verb: 'wobble', ms: 700, seasonBonus: 'winter', neverMelts: true },
  // RUN21A-5 removed `oncePerVisit: true` here: nothing reads it any more, and a flag that
  // says the rocket flies once a visit now states the opposite of what it does. A tap
  // always launches (the only guard is in-flight) — a child's tap is never budget-gated.
  rocket:   { cls: 'TAP', verb: 'launch', ms: 1200, backMs: 2000, rise: 0.40, sfx: 'whoosh' },
  crown:    { cls: 'TAP', verb: 'crown', line: 'wishRoyal', persists: 'day' },
  egg:      { cls: 'TAP', verb: 'wobble2', ms: 900, line: 'wishEggWobble', lineCap: 'session', neverHatches: true },
  drum:     { cls: 'TAP', verb: 'band', band: 'snare' },
  guitar:   { cls: 'TAP', verb: 'band', band: 'guitar' },
  bell:     { cls: 'TAP', verb: 'ring', sfx: 'chime' },
  teapot:   { cls: 'TAP', verb: 'steam', ms: 900 },
  castle:   { cls: 'TAP', verb: 'peek', ms: 900 },
  hat:      { cls: 'TAP', verb: 'tryOn', ms: 10000 },
  wand:     { cls: 'TAP', verb: 'sparkle', ms: 700 },
  torch:    { cls: 'TAP', verb: 'lightCone', bands: ['dusk', 'night'] },
  lamp:     { cls: 'TAP', verb: 'lightCone', bands: ['dusk', 'night'] },
  ball:     { cls: 'TAP', verb: 'roll', dist: 0.15, ms: 900 },
  sock:     { cls: 'TAP', verb: 'peekaboo', ms: 900, lineCap: 'session' },
  boot:     { cls: 'TAP', verb: 'sniff', ms: 900, lineCap: 'session' },
  ladder:   { cls: 'TAP', verb: 'climb', ms: 900, tall: ['tree', 'palm', 'castle', 'wishwell', 'slide', 'wall'] },
  map:      { cls: 'TAP', verb: 'unroll', ms: 2000, line: 'wishMapX', lineCap: 'session' },
  key:      { cls: 'TAP', verb: 'jiggle', ms: 900, line: 'wishKey', lineCap: 'session' },
  present:  { cls: 'TAP', verb: 'popLid', ms: 900, pureToy: true },
  lion:     { cls: 'TAP', verb: 'stretchRoar', ms: 900, sfx: 'roar', lineCap: 'session' },
  // ---- food ----------------------------------------------------------------------------
  cake:     { cls: 'FOOD' }, apple: { cls: 'FOOD' }, pizza: { cls: 'FOOD' },
  banana:   { cls: 'FOOD' }, carrot: { cls: 'FOOD' }, cheese: { cls: 'FOOD' }, cookie: { cls: 'FOOD' },
  // ---- flyers and roamers ----------------------------------------------------------------
  balloon:  { cls: 'FLYER', target: null, bob: true, tether: true },
  butterfly:{ cls: 'FLYER', target: ['flower', 'flowerbed'] },
  bee:      { cls: 'FLYER', target: ['flower'], zigzag: true, sfx: 'buzz', sfxOn: 'land' },
  robot:    { cls: 'ROAMER', walk: 'stiff', turns: 'rightAngle', sfx: 'beep', sfxOn: 'turn' },
  crab:     { cls: 'ROAMER', walk: 'sideways', row: 2 },
  duck:     { cls: 'ROAMER', walk: 'waddle', water: 'swim' },
  frog:     { cls: 'ROAMER', walk: 'hop', seeks: 'pond', sfx: 'croak', sfxOn: 'arrive' },
  snake:    { cls: 'ROAMER', walk: 'slither' },
  zebra:    { cls: 'ROAMER', walk: 'trot', burstMs: 1000 },
  // ---- water ------------------------------------------------------------------------------
  boat:     { cls: 'WATER', bobMs: 3000, driftX: 0.05 },
  fish:     { cls: 'WATER', leapMs: 500, everyMin: 6000, everyMax: 10000 },
  whale:    { cls: 'WATER', spoutEveryMin: 8000, spoutEveryMax: 12000, scale: 1.5 },
  // ---- perches, seats and shelters --------------------------------------------------------
  owl:      { cls: 'SOCKET', seats: 1, perchPrefs: ['tree', 'palm', 'lamp'], fallback: 'ruffle', sfx: 'hoot', bands: ['dusk', 'night'] },
  mushroom: { cls: 'SOCKET', seats: 1, seatVerb: 'doubleBounce' },
  book:     { cls: 'SOCKET', seats: 1, seatVerb: 'read', tickMs: 3000 },
  umbrella: { cls: 'SOCKET', seats: 1, onlyInRain: true },
  tent:     { cls: 'SOCKET', seats: 1, nap: true, opens: true, line: 'napCamping', lineCap: 'firstNap' },
  campfire: { cls: 'SOCKET', seats: 2, flicker: true, sfx: 'crackle' },
  bench:    { cls: 'SOCKET', twin: 'deco_bench' },
  swing:    { cls: 'SOCKET', twin: 'deco_swings' },
  slide:    { cls: 'SOCKET', twin: 'deco_slide' },
  // ---- gleam and sway ----------------------------------------------------------------------
  trophy:   { cls: 'GLEAM', sweepMs: 8000 },
  medal:    { cls: 'GLEAM', sweepMs: 8000 },
  flower:   { cls: 'SWAY', flyerTarget: true },
  tree:     { cls: 'SWAY' },
  palm:     { cls: 'SWAY' },
  // ---- the kite: its own thing, anchored below and flying above ----------------------------
  kite:     { cls: 'SKY', fx: 'kite', tethered: true, hilltopAmp: 1.6 }
};

// ---- RUN21B item 2: ambient life, on its own axis ---------------------------------------
// A wish should visibly live without being tapped. This is deliberately a SEPARATE table
// from `cls` above: `cls` is the TAP DISPATCHER (town.js switches on it to choose the verb),
// so re-classing a word to give it an idle would silently delete its tap response — which
// the pack itself forbids ("Existing tap verbs unchanged"). Idle and tap are two different
// questions about the same object, so they get two different fields.
//
// FLIER: a slow figure-8 near home.  BOB: a gentle rise and fall on the water.
// STEAM: a wisp every 20-30s.        GLEAM: one sparkle pass every 25-40s.
// SWAY (flower/tree/palm) is untouched, as the pack says.
export const WISH_IDLE_CLASSES = ['FLIER', 'BOB', 'STEAM', 'GLEAM'];
export const WISH_IDLE = {
  butterfly: 'FLIER', bee: 'FLIER',
  owl:       'FLIER',                     // the pack says "owl at night" — gated at render
  boat:      'BOB', duck: 'BOB', fish: 'BOB', whale: 'BOB',
  teapot:    'STEAM', cake: 'STEAM', pizza: 'STEAM',
  crown:     'GLEAM', trophy: 'GLEAM', medal: 'GLEAM', key: 'GLEAM', lamp: 'GLEAM'
};
// Idles that only make sense after dark. The owl is the pack's own qualifier.
export const WISH_IDLE_NIGHT_ONLY = new Set(['owl']);
// The continuous idles are CSS loops; these are the episodic ones the scheduler paces.
export const WISH_IDLE_EPISODIC = { STEAM: [20000, 30000], GLEAM: [25000, 40000] };
export const WHALE_SPOUT_MS = 45000;        // "whale spouts once/45s", per the pack
export const WISH_IDLE_SCENE_PER_MIN = 8;   // scene cap: 8 wish idles a minute, shared

export const WISH_WORDS = Object.keys(WISH_LIFE);
export const lifeFor = (word) => WISH_LIFE[word] || null;
export const idleOf = (word) => WISH_IDLE[word] || null;
export const classOf = (word) => (WISH_LIFE[word] || {}).cls || null;
export const isOutdoorOnly = (word) => OUTDOOR_ONLY.has(word);
// FLYERs and ROAMERs become live actors once placed, so they are the ones RUN20's long-press
// card can catch and move.
export const CATCHABLE = new Set(Object.keys(WISH_LIFE).filter(w => ['FLYER', 'ROAMER'].includes(WISH_LIFE[w].cls)));
