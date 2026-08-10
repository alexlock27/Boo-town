// data/daily.js — "Today in Boo Town" (RUN21J): the Daily Pool + the card copy.
//
// THE POOL RULE (the recycle mechanic, RUN21J pack): today's parcel item is a
// deterministic pick from the UNOWNED subset of this list — nothing is tracked,
// nothing expires, and a missed day loses nothing: the item simply comes round
// again on a later day. Because of that, this list must only ever contain
// EXISTING catalogue items that are NOT auto-granted anywhere (onboarding first
// picks, quest grants, wish unlocks, auto-placed landmarks are all excluded —
// verified against every inventory write site in js/ at authoring time).
//
// Curated for "delightful and seldom-owned": box-only ultras (the costume sets
// and feet accessories are permanently unbuyable — the strongest "a parcel is
// the only way" signal), the special shelf's top-value tier, and rare items
// with a real verb (act/fx/locomotion — the no-dead-props law is inherited from
// the catalogue, so everything here already does something when placed or worn).
// No seasonal items: an out-of-season grant reads as a glitch, not a gift.
//
// `shiny: true` entries grant a SHINY copy by id — already-supported machinery
// (grantItem + addShinyCopy, the exact pairing js/rewards.js uses for shiny box
// drops). Shiny entries are Boos only, because every shiny read site is
// Boo-gated. A shiny entry is "owned" once she has any shiny copy of that Boo,
// so it recycles independently of the plain Boo.

export const DAILY_POOL = [
  // — town decorations (all with a verb: act or fx) —
  { id: 'deco_stage' },        // ultra · Dance Stage · makes nearby Boos bop
  { id: 'deco_fountain' },     // ultra · Star Fountain
  { id: 'deco_campfire' },     // ultra · Campfire · night gathering
  { id: 'deco_lamp' },         // rare · Fairy Lamp · glows
  { id: 'deco_bumper' },       // rare · Bumper Car · Boos drive it
  { id: 'deco_trampoline' },   // rare · Trampoline · Boos bounce

  // — Boo House furniture —
  { id: 'deco_projectorlamp' },   // ultra · Star Projector Lamp (special shelf)
  { id: 'deco_telescope' },       // ultra · Telescope (special shelf)
  { id: 'deco_grandbookshelf' },  // ultra · Grand Bookshelf (special shelf, wall)
  { id: 'deco_bookshelf' },       // ultra · Bookshelf (box-only, wall)
  { id: 'deco_sofa' },            // rare · Squashy Sofa
  { id: 'deco_floorlamp' },       // rare · Floor Lamp · has a night state
  { id: 'deco_bunkbed' },         // rare · Bunk Beds · nappable
  { id: 'deco_rug3' },            // rare · Star Rug

  // — dress-up (sets and feet are unbuyable in the shop, ever) —
  { id: 'acc_set_pirate' },       // ultra · Pirate Costume · spyglass idle
  { id: 'acc_set_astronaut' },    // ultra · Astronaut Costume · low-gravity walk
  { id: 'acc_set_chef' },         // ultra · Chef Costume
  { id: 'acc_set_explorer' },     // ultra · Explorer Costume
  { id: 'acc_set_builder' },      // ultra · Builder Costume
  { id: 'acc_set_police' },       // ultra · Police Costume
  { id: 'acc_starcape' },         // ultra · Comet Cape · flutters at a run
  { id: 'acc_rollerskates' },     // ultra · Roller Skates · glide locomotion
  { id: 'acc_springboots' },      // rare · Springy Boots · spring locomotion

  // — a couple of Boos (plus two shiny variants, by-id shiny grants) —
  { id: 'boo_prism' },            // ultra · Prism · hue-shift fx
  { id: 'boo_starnova' },         // ultra · Star Nova · twinkle fx
  { id: 'boo_disco' },            // ultra · Disco Sunny · shimmer fx
  { id: 'boo_comet', shiny: true },   // rare Boo, SHINY copy
  { id: 'boo_gigi', shiny: true }     // rare Boo, SHINY copy
];

// The parcel's fixed Meadow spot: placement-grammar coordinates (x = fraction of
// the area's 4-viewport width, row = depth row 2 = the front ground row). x=0.15
// keeps it on camera at default scroll — the pack requires x ≤ 0.25 because
// anything much past that is off the right edge of screen 1.
export const PARCEL_SPOT = { x: 0.15, row: 2 };

// Card copy — the pack authors these verbatim; do not "improve" them.
export const DAILY_COPY = {
  title: 'Today in Boo Town',
  doings: {
    play: 'Play any game',
    visit: 'Say hello somewhere new',
    care: 'Look after a Boo'
  },
  subFresh: 'Three little doings. No hurry — the day is long.',
  allDone: 'All done for today! Your parcel is waiting in the Meadow 🎁',
  // Authored here (the pack asks only that "the card says so warmly"):
  // the whole pool is owned, so the parcel holds a surprise box instead.
  allDoneBox: "All done for today! You've collected every parcel treasure — so today's parcel has a surprise box inside. It's waiting in the Meadow 🎁",
  // After the parcel is claimed. Never references yesterday or tomorrow.
  allDoneClaimed: 'All done for today! Wasn’t that a lovely parcel? ✨'
};
