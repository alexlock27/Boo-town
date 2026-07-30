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
  // RUN19 + RUN20. NOT LIVE YET: this block ships under whatever stamp Alex's localhost review
  // ends up deploying, so its `version` is set at the deploy gate, not here — the branch has
  // deliberately not bumped BUILD_STAMP. Everything below is child-facing and reachable.
  {
    version: 'run20-PENDING',
    entries: [
      { icon: '🦋', title: 'Wishes come to LIFE!', blurb: 'Bees buzz, kites fly, rockets launch — every wish does something now.', route: 'town', params: { area: 'meadow' } },
      { icon: '🗺️', title: 'Every corner has a secret', blurb: 'Tap around the Meadow, the Beach, the Riverside… things happen!', route: 'worldmap' },
      { icon: '💭', title: 'Your Boos ask for things', blurb: 'Tap the little thought bubble to see what a Boo would love.', route: 'town', params: { area: 'meadow' } },
      { icon: '🛏️', title: 'Naps, seats and waiting turns', blurb: 'Boos climb into bed, take the best seat, and queue politely for the swing.', route: 'town', params: { area: 'boohouse', room: 'bedroom' } },
      { icon: '✨', title: 'Sprinkle stardust', blurb: 'Hold down on anything you have placed and make it sparkle all day.', route: 'town', params: { area: 'meadow' } },
      { icon: '🎨', title: 'Decorate your rooms', blurb: 'New wallpaper and floors for the Lounge, Kitchen and Bedroom.', route: 'shop', params: { shelf: 'house' } },
      { icon: '🪑', title: 'Put things ON things', blurb: 'Stand a lamp on a table, hang pictures higher or lower, drag the corner to resize.', route: 'town', params: { area: 'boohouse', room: 'lounge' } }
    ]
  },
  {
    // The addendum wave (same day): the Disco Hall's guest list — Alex's own ask, and the
    // one genuinely NEW thing in this follow-up (the PC rail scroll and the hidden empty
    // poster wall are polish; polish is not news).
    version: 'run19b-20260730',
    entries: [
      { icon: '💌', title: 'You pick who comes to the disco!',
        blurb: "Open “Who's coming?” at the bottom of the Disco Hall and invite your favourites.",
        route: 'discohall' }
    ]
  },
  {
    // RUN19 (the Disco rewire + the repair/explanation pass), shipping together with
    // RUN18E under one stamp. ONE entry: the Disco Hall is the only thing here that is
    // genuinely NEW to look at — the explanation panels, the Word Factory's teaching join
    // and the Joke Boo's timing are improvements to features announced below (the RUN18D
    // precedent: polish is not news, she will simply find those things better).
    version: 'run19-20260730',
    entries: [
      { icon: '🕺', title: 'The Disco Hall really dances!',
        blurb: 'Real songs, a move on every beat, a spotlight — and Routine Night.',
        route: 'discohall' }
    ]
  },
  {
    // RUN18E (The Literacy Re-pitch v2). The pack's own gate text named three entries;
    // Apostrophe Patrol is a fourth genuinely new, standalone card and CLAUDE.md's own
    // rule ("a feature nobody finds may as well not have been built") binds over an
    // incomplete list, so it is added here too.
    version: 'run18e-20260729',
    entries: [
      { icon: '🏭', title: 'The Word Factory is hiring!',
        blurb: 'Boos are queuing with word orders — build them, stamp them, keep the combo alive.',
        route: 'blendit' },
      { icon: '🔍', title: 'Twin Trouble in town',
        blurb: 'The homophone twins are swapping places. Inspector needed.',
        route: 'soundtwins' },
      { icon: '📰', title: 'Hold the front page!',
        blurb: 'Rebuild the story one line at a time and print it.',
        route: 'storyorder' },
      { icon: '✍️', title: 'Apostrophe Patrol is on the case',
        blurb: 'Flick the flying comma into place, or squeeze two words into one.',
        route: 'apostrophepatrol' }
    ]
  },
  {
    // RUN18D (Polish & presentation). Twelve packets, and TWO entries — because the pack
    // says so, and because it is right: polish is not news. A child does not want to be
    // told that the hub scrolls in one direction now, or that a wrong answer explains
    // itself, or that thirty emoji became drawings. She will simply find those things
    // better. These two are the only ones that are genuinely NEW to look at or to use.
    version: 'run18d-20260728',
    entries: [
      { icon: '🖼️', title: 'The Gallery got a proper room',
        blurb: 'Spotlights, name plates, and a Boo wandering about looking at your treasures.',
        route: 'gallerymuseum' },
      { icon: '🔤', title: 'ABC keys in Word Detective',
        blurb: 'Tap "ABC keys" and the letters line up A to Z instead of hiding.',
        route: 'detective' }
    ]
  },
  {
    // RUN18C (The Expedition, presented). The Expedition's logic had been finished since
    // RUN10 and its presentation was never built, so RUN18A shut its door rather than hand
    // a child a feature that looked broken. This run built the presentation — the party
    // select, the trail map, the four puzzles and the postcard ending — and reopened it.
    // ONE entry, exactly as _programme/RUN18C.md C5 authors it: it is one feature, and the
    // rest of the run is repairs a child would only ever notice as an absence.
    version: 'run18c-20260728',
    entries: [
      { icon: '🥾', title: 'The Boo Expedition is open!',
        blurb: 'Pick eight brave Boos and puzzle your way along the trail.',
        route: 'expedition' }
    ]
  },
  {
    // RUN18B (Repair & Respect). Sixteen packets, most of them repairs a child would only
    // notice as an absence — a hearts row that never took a heart, a clock that lied, ids
    // that did not line up. These five are the ones that hand her something NEW, exactly as
    // _programme/RUN18B.md's gate names them (Y3, Y4, Y5, Y6, Y16).
    version: 'run18b-20260728',
    entries: [
      { icon: '⭐', title: 'How Boo Town works',
        blurb: 'Three little cards on your hub tell you what stars are for. A grown-up can show them again any time.',
        route: 'hub' },
      { icon: '🌟', title: 'Your wish comes true',
        blurb: 'Spell a word at the Wish Well and it arrives in your town for keeps, on a shining gold medallion.',
        route: 'town', params: { area: 'meadow', openWishWell: true } },
      { icon: '🖼️', title: 'Flash Boos paints a picture',
        blurb: 'The Boos really sit on the bench and really hold the ball now — look hard, then answer!',
        route: 'flashboos' },
      { icon: '😋', title: 'The Boos actually eat it',
        blurb: 'Sort the food right and a Boo opens its mouth, chomps, and puffs its cheeks. And the rule can change halfway!',
        route: 'feedboos' },
      { icon: '🔊', title: 'Hear the tune again',
        blurb: 'Miss a note in Echo Boos and you can ask for the tune once more — same speed, same tune, no fuss.',
        route: 'echoboos' }
    ]
  },
  {
    // RUN18A (Stop the Bleeding) was a repair run: a softlock, an Expedition full of
    // placeholder text, a shop back button hiding behind a giraffe. None of that is news
    // — a child is not told "the thing that was broken is less broken". H3 is the one
    // packet that gives her something she did not have: a permanent front door to the
    // Joke Boo, in the Play grid, so it is no longer a landmark she has to find in a
    // four-screen-wide town. Entry authored verbatim in _programme/RUN18A.md.
    version: 'run18a-20260728',
    entries: [
      { icon: '🎤', title: 'The Joke Boo has a stage!',
        blurb: 'Tap the microphone in the Play games — 120 jokes are waiting.',
        route: 'jokeboo' }
    ]
  },
  {
    // RUN16 (Literacy & Lessons 2.0) shipped in parallel with RUN17 and could not be seen
    // from that branch, so its entries are added here at the merge — which is exactly the
    // failure X4's law exists to prevent: four whole games the children would never have
    // been told about. Ships under the merged stamp, so one card covers both runs.
    version: 'run16-17-20260727',
    entries: [
      { icon: '👂', title: 'Sound Sorter',
        blurb: 'I say a sound — like shhh! — and you find it hiding in the pictures. Twelve sounds to hunt for.',
        route: 'soundsorter' },
      { icon: '🤝', title: 'Blend It',
        blurb: 'The sounds sit apart until you tap Blend. Watch them slide into a word, then tap the picture it makes!',
        route: 'blendit' },
      { icon: '🎵', title: 'Rhyme Time',
        blurb: 'Cat, hat, mat! Find the words that chime at the end — and watch out, some only LOOK like they rhyme.',
        route: 'rhymetime' },
      { icon: '📖', title: 'Story Order',
        blurb: 'Six little stories got muddled up. Put the pictures back in order and I will read the whole thing to you.',
        route: 'storyorder' },
      { icon: '📘', title: 'Three new lessons',
        blurb: 'Sounds in words, words that sound the same, and how a story works. Every lesson now lets you have a go yourself.',
        route: 'teachme' },
      { icon: '🎢', title: 'Lift Off is finished',
        blurb: 'The Boo Roll course that said "being built" is built! All six courses are open now, and every star can be reached.',
        route: 'booroll' }
    ]
  },
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
