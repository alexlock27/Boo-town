// data/whatsnew.js — what arrived since she last looked (RUN17 X4).
//
// ============================== STANDING REQUIREMENT ==============================
// EVERY future run appends a block here as part of its deploy gate, with `version` set to
// the BUILD_STAMP it ships under. That is now house law — see CLAUDE.md, "Working loop".
// The app has grown enormously and the children have no other way to discover it: a
// feature nobody finds may as well not have been built.
// =================================================================================
//
// Shape: { version, entries: [{ title, blurb, route, params?, icon }] }
// NEWEST FIRST. The newest block's `version` is what the hub compares against
// seen.whatsnewVersion, so appending a block at the top IS the trigger for the card.
//
// Writing rules for entries, learned the hard way from every other bit of copy in here:
//   • Written FOR A CHILD. "You can buy things with your stars now", not "economy update".
//   • `route` must be a real key in js/main.js's registry, and `params` must be what that
//     screen actually accepts — the "Show me!" button routes straight there, and
//     tests/r17x4-whatsnew.mjs resolves every one of them.
//   • Never advertise anything a grown-up has to switch on. The Feelings Corner is
//     deliberately ABSENT from this file: it is a quiet corner someone opts into, not a
//     feature to sell to a child (RUN17 G17).

export const WHATSNEW = [
  {
    version: 'run17-heart-20260727',
    entries: [
      { icon: '🎭', title: 'The Joke Boo',
        blurb: 'A Boo in the Meadow with 120 jokes. Knock knock ones, animal ones, silly ones and Boo ones. Keep your favourites in your Journal!',
        route: 'jokeboo' }
    ]
  },
  {
    version: 'run15-v6-20260726',
    entries: [
      { icon: '🛍️', title: 'The Boo Shop',
        blurb: 'Your stars can buy things now! There is a stall in the Meadow full of lamps, swings, plants and treasures.',
        route: 'shop' },
      { icon: '🎓', title: 'Lesson Stars',
        blurb: 'Finishing a lesson earns its own kind of star — and the shop has a special shelf that only those can reach.',
        route: 'teachme' }
    ]
  },
  {
    version: 'run14-u3-20260726',
    entries: [
      { icon: '🎿', title: 'Six Boo Roll courses',
        blurb: 'Tilt and roll your way through lifts, ramps and springy things. Go carefully — or do not!',
        route: 'booroll' },
      { icon: '🥁', title: 'Boo Beat plays better',
        blurb: 'The notes feel fairer and the whole highway lights up when you get a run of them right.',
        route: 'beat' }
    ]
  },
  {
    version: 'run13b-t8-20260726',
    entries: [
      { icon: '🛏️', title: 'Three real rooms',
        blurb: 'Your Boo House has a Lounge, a Kitchen and a Bedroom now, and each one looks properly like itself.',
        route: 'town', params: { area: 'boohouse' } },
      { icon: '🌸', title: 'The town got dressed',
        blurb: 'Every area has flowers, shells, long grass and a sky that changes with the real time of day.',
        route: 'worldmap' }
    ]
  },
  {
    // The big catch-up: everything built while nobody had a way to be told about it.
    version: 'catchup-20260727',
    entries: [
      { icon: '🗺️', title: 'A whole world map',
        blurb: 'Boo Town is not one field any more. There is a map, and new places open up as you earn stars.',
        route: 'worldmap' },
      { icon: '🏡', title: 'The Boo House',
        blurb: 'Your Boos have a house you can walk into and fill with furniture.',
        route: 'town', params: { area: 'boohouse' } },
      { icon: '🖼️', title: 'The Gallery',
        blurb: 'Every Boo you meet gets a portrait on the wall. It fills itself up as you go.',
        route: 'gallerymuseum' },
      { icon: '💖', title: 'Boo Care',
        blurb: 'Brush them, feed them a treat, play peekaboo. The more you do together, the better friends you become.',
        route: 'collection' },
      { icon: '🎡', title: 'The funfair',
        blurb: 'A carousel, a big wheel and more, built for you by the Boo Builders.',
        route: 'town', params: { area: 'funfair' } },
      { icon: '🎸', title: 'The Band Room',
        blurb: 'Drums, keys, guitar and xylophone. Play them, record a jam, and keep it.',
        route: 'band' },
      { icon: '🪩', title: 'The Disco Hall',
        blurb: 'Lights, a floor full of Boos, and dancing that does not stop.',
        route: 'discohall' },
      { icon: '🧭', title: 'The Boo Expedition',
        blurb: 'A long trail with puzzles along the way and a party of Boos who come with you.',
        route: 'expedition' },
      { icon: '🔍', title: "Snaffle's Caper",
        blurb: 'Somebody has been up to mischief. Collect clues in your notebook and work out who.',
        route: 'caper' },
      { icon: '🔮', title: 'The Wish Well',
        blurb: 'Spell a wish and watch the well make it appear. Every wish you spell is yours to keep.',
        route: 'town', params: { area: 'meadow', openWishWell: true } },
      { icon: '👀', title: 'Odd Boo Out',
        blurb: 'One of these Boos is not like the others. Can you spot which?',
        route: 'oddboo' },
      { icon: '⚡', title: 'Flash Boos',
        blurb: 'Look hard, then they hide. How much did you remember?',
        route: 'flashboos' },
      { icon: '🧠', title: 'Your Brain Bloom',
        blurb: 'A flower in your Trophy Room that grows a new petal for each thing you practise.',
        route: 'collection' },
      { icon: '💾', title: 'Safety copies',
        blurb: 'A grown-up can keep a copy of your whole town somewhere safe, so nothing can ever get lost.',
        route: 'grownups' }
    ]
  }
];

// The version the app is currently offering news for. Appending a block at the top of
// WHATSNEW is what makes the card appear.
export const LATEST_VERSION = WHATSNEW.length ? WHATSNEW[0].version : '';

// Every entry newer than what she has already seen, newest first. A save that has never
// seen the card gets the whole catch-up, which is exactly the point of this feature.
export function entriesSince(seenVersion) {
  const out = [];
  for (const block of WHATSNEW) {
    if (block.version === seenVersion) break;
    for (const e of block.entries) out.push({ ...e, version: block.version });
  }
  return out;
}
