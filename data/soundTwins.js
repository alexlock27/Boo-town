// data/soundTwins.js — Sound Twins mode content (RUN3 C1).
// Every blank-sentence is REUSED VERBATIM from EXPANSION_1.md: §26 (theirThereTheyre),
// §27 (toTooTwo) and §3.1 homophone clue sentences. Do not invent new sentences.
// The one-line twin explanations are the guide's teaching lines the spec asks for.
//
// Shape: { id, level, options:[lowercase spellings], items:[{ s: sentence-with-___, a: answer }] }
// Levels: 1 = the everyday triples, 2 = the classic homophone pairs, 3 = accept/except & affect/effect.

export const TWIN_SETS = [
  { id: 'theirThereTheyre', level: 1, options: ['their', 'there', "they're"], items: [
      { s: '___ dog is called Max', a: 'their' },
      { s: 'The Boos love ___ little houses', a: 'their' },
      { s: '___ favourite colour is purple', a: 'their' },
      { s: 'Put the box over ___', a: 'there' },
      { s: 'Is anybody ___?', a: 'there' },
      { s: 'We went ___ yesterday', a: 'there' },
      { s: '___ late for school!', a: "they're" },
      { s: '___ my best friends', a: "they're" },
      { s: '___ going to love this', a: "they're" }
  ]},
  { id: 'toTooTwo', level: 1, options: ['to', 'too', 'two'], items: [
      { s: 'We walked ___ the shop', a: 'to' },
      { s: 'Give it ___ me', a: 'to' },
      { s: 'She wants ___ play', a: 'to' },
      { s: 'Can I come ___?', a: 'too' },
      { s: "That's ___ funny!", a: 'too' },
      { s: "It's ___ hot today", a: 'too' },
      { s: 'I have ___ sisters', a: 'two' },
      { s: '___ Boos sat on the wall', a: 'two' },
      { s: '___ plus one is three', a: 'two' }
  ]},
  { id: 'hearHere', level: 1, options: ['hear', 'here'], items: [
      { s: 'I can ___ music playing', a: 'hear' },
      { s: 'Come over ___ right now', a: 'here' }
  ]},
  { id: 'whoseWhos', level: 2, options: ['whose', "who's"], items: [
      { s: '___ coat is this on the floor', a: 'whose' },
      { s: '___ coming to the party', a: "who's" }
  ]},
  { id: 'whetherWeather', level: 2, options: ['whether', 'weather'], items: [
      { s: 'I wonder ___ it will rain', a: 'whether' },
      { s: 'The ___ is sunny today', a: 'weather' }
  ]},
  { id: 'peacePiece', level: 2, options: ['peace', 'piece'], items: [
      { s: 'We want world ___', a: 'peace' },
      { s: 'I ate the last ___ of cake', a: 'piece' }
  ]},
  { id: 'plainPlane', level: 2, options: ['plain', 'plane'], items: [
      { s: 'The bread was ___ and simple', a: 'plain' },
      { s: 'The ___ landed at the airport', a: 'plane' }
  ]},
  { id: 'brakeBreak', level: 2, options: ['brake', 'break'], items: [
      { s: 'Use the ___ to slow down', a: 'brake' },
      { s: 'Try not to ___ the window', a: 'break' }
  ]},
  { id: 'greatGrate', level: 2, options: ['great', 'grate'], items: [
      { s: 'That magic trick was ___', a: 'great' },
      { s: '___ the cheese for the pizza', a: 'grate' }
  ]},
  { id: 'meetMeat', level: 2, options: ['meet', 'meat'], items: [
      { s: 'We ___ at the park at noon', a: 'meet' },
      { s: 'Lions eat ___', a: 'meat' }
  ]},
  { id: 'mailMale', level: 2, options: ['mail', 'male'], items: [
      { s: 'The ___ arrives each morning', a: 'mail' },
      { s: 'A ___ lion has a big mane', a: 'male' }
  ]},
  { id: 'acceptExcept', level: 3, options: ['accept', 'except'], items: [
      { s: 'Please ___ this little gift', a: 'accept' },
      { s: 'Everyone came ___ my cousin', a: 'except' }
  ]},
  { id: 'affectEffect', level: 3, options: ['affect', 'effect'], items: [
      { s: "The rain didn't ___ our fun", a: 'affect' },
      { s: 'The medicine had a good ___', a: 'effect' }
  ]},
  // RUN18E Part C — the missing homophone twin sets, authored for Twin Trouble (L3).
  // Level 4 keeps them a step past spellboo's own Sound Twins levels while still reusing
  // the same engine and picker; verbatim from _programme/RUN18E.md Appendix A Part C.
  { id: 'mainMane', level: 4, options: ['main', 'mane'], items: [
      { s: 'The lion shook his golden ___', a: 'mane' },
      { s: 'We walked down the ___ street', a: 'main' },
      { s: 'The ___ thing is to have fun', a: 'main' },
      { s: "She brushed the pony's ___", a: 'mane' }
  ]},
  { id: 'missedMist', level: 4, options: ['missed', 'mist'], items: [
      { s: 'I ___ the bus this morning', a: 'missed' },
      { s: 'The hill was hidden in ___', a: 'mist' },
      { s: 'She ___ her friend at the gate', a: 'missed' },
      { s: 'Morning ___ hung over the pond', a: 'mist' }
  ]},
  { id: 'groanGrown', level: 4, options: ['groan', 'grown'], items: [
      { s: "The Boos ___ at Dad's joke", a: 'groan' },
      { s: "Look how much you've ___!", a: 'grown' },
      { s: 'He let out a long ___', a: 'groan' },
      { s: 'The sunflower has ___ so tall', a: 'grown' }
  ]},
  { id: 'sceneSeen', level: 4, options: ['scene', 'seen'], items: [
      { s: 'Have you ___ my other sock?', a: 'seen' },
      { s: "The play's first ___ is in a forest", a: 'scene' },
      { s: "I've never ___ a shooting star", a: 'seen' },
      { s: 'Paint a snowy ___ for the wall', a: 'scene' }
  ]},
  { id: 'fairFare', level: 4, options: ['fair', 'fare'], items: [
      { s: "That's not ___ — it's my turn!", a: 'fair' },
      { s: 'The bus ___ is two pounds', a: 'fare' },
      { s: 'We won a goldfish at the ___', a: 'fair' },
      { s: 'How much is the train ___?', a: 'fare' }
  ]},
  { id: 'medalMeddle', level: 4, options: ['medal', 'meddle'], items: [
      { s: 'She won a gold ___ for swimming', a: 'medal' },
      { s: "Don't ___ with my things!", a: 'meddle' },
      { s: 'The ___ shone on its ribbon', a: 'medal' },
      { s: 'Snaffle loves to ___ in everything', a: 'meddle' }
  ]},
  { id: 'berryBury', level: 4, options: ['berry', 'bury'], items: [
      { s: 'The dog wants to ___ his bone', a: 'bury' },
      { s: 'Pick the reddest ___ on the bush', a: 'berry' },
      { s: 'Pirates ___ their treasure', a: 'bury' },
      { s: 'A black___ pie for tea', a: 'berry' }
  ]},
  { id: 'knotNot', level: 4, options: ['knot', 'not'], items: [
      { s: 'Tie a strong ___ in the rope', a: 'knot' },
      { s: 'That is ___ my hat', a: 'not' },
      { s: 'My shoelace has a ___ in it', a: 'knot' },
      { s: "It's ___ raining any more", a: 'not' }
  ]},
  { id: 'heelHeal', level: 4, options: ['heel', 'heal'], items: [
      { s: 'My sock has a hole at the ___', a: 'heel' },
      { s: 'The cut will ___ in a few days', a: 'heal' },
      { s: 'Stand on your ___ and wobble', a: 'heel' },
      { s: 'Rest helps a poorly Boo ___', a: 'heal' }
  ]},
  { id: 'ballBawl', level: 4, options: ['ball', 'bawl'], items: [
      { s: 'Kick the ___ to me!', a: 'ball' },
      { s: 'The baby started to ___', a: 'bawl' },
      { s: 'A beach ___ blew into the sea', a: 'ball' },
      { s: "Don't ___ — it's only a scratch", a: 'bawl' }
  ]}
];

// One-line guide explanations of the right twin, shown after a wrong pick.
export const TWIN_EXPLAIN = {
  'their': "'Their' means it belongs to them.",
  'there': "'There' is a place, like here and there.",
  "they're": "'They're' is short for 'they are'.",
  'to': "'To' goes with a verb or shows direction: to run, to the shop.",
  'too': "'Too' means also, or very much.",
  'two': "'Two' is the number 2.",
  'hear': "'Hear' is what you do with your ears.",
  'here': "'Here' means this place.",
  'whose': "'Whose' asks who something belongs to.",
  "who's": "'Who's' is short for 'who is'.",
  'whether': "'Whether' means if — whether or not.",
  'weather': "'Weather' is the sun, rain and wind.",
  'peace': "'Peace' means calm and quiet.",
  'piece': "'Piece' is a bit of something: a piece of cake.",
  'plain': "'Plain' means simple, or flat land.",
  'plane': "'Plane' is an aeroplane.",
  'brake': "'Brake' is what stops a bike or car.",
  'break': "'Break' means to snap, or a little rest.",
  'great': "'Great' means really good or big.",
  'grate': "'Grate' means to shred, like cheese.",
  'meet': "'Meet' means to come together.",
  'meat': "'Meat' is food that comes from animals.",
  'mail': "'Mail' is post and letters.",
  'male': "'Male' means a boy or a man.",
  'accept': "'Accept' means to take something offered to you.",
  'except': "'Except' means apart from.",
  'affect': "'Affect' means to change something (it's a doing word).",
  'effect': "'Effect' is the result (it's a naming word).",
  'main': "'Main' means the biggest or most important.",
  'mane': "'Mane' is the long hair on a lion or horse's neck.",
  'missed': "'Missed' means you didn't catch it in time.",
  'mist': "'Mist' is a thin, low cloud you can see through.",
  'groan': "'Groan' is a long, low sound of annoyance.",
  'grown': "'Grown' means got bigger.",
  'scene': "'Scene' is a part of a play or story, or a view.",
  'seen': "'Seen' is what your eyes have done.",
  'fair': "'Fair' means right and equal, or a funfair.",
  'fare': "'Fare' is the money you pay for a ride.",
  'medal': "'Medal' is a prize you wear.",
  'meddle': "'Meddle' means to interfere in something.",
  'berry': "'Berry' is a small soft fruit.",
  'bury': "'Bury' means to hide something under the ground.",
  'knot': "'Knot' is a tangle you tie in string or rope.",
  'not': "'Not' means the opposite, or 'no'.",
  'heel': "'Heel' is the back of your foot.",
  'heal': "'Heal' means to get better.",
  'ball': "'Ball' is a round thing you kick or throw.",
  'bawl': "'Bawl' means to cry loudly."
};

// RUN19 explanation pass (Alex, 2026-07-30): a RIGHT answer teaches too — confirm the
// win, say why the twin in place is right, then contrast it with the other twin(s), in
// the tone of Alex's own example ("Well Done! Yes, you use effect when… you would use
// affect when…"). Composed HERE from the authored TWIN_EXPLAIN lines, never in the game.
export function twinSet(id) { return TWIN_SETS.find(s => s.id === id); }
export function twinRightLine(setId, rightWord) {
  const set = twinSet(setId);
  const others = set ? set.options.filter(o => o !== rightWord) : [];
  const contrast = others.map(o => TWIN_EXPLAIN[o]).filter(Boolean).join(' ');
  return `Well done! Yes — ${TWIN_EXPLAIN[rightWord] || ''} ${contrast}`.trim();
}
export function twinCaughtLine(setId, answer, culprit) {
  return `Well done — you caught '${culprit}'! ${TWIN_EXPLAIN[answer] || ''} ${TWIN_EXPLAIN[culprit] || ''}`.trim();
}

// All Sound Twins levels present (for the picker).
export const TWIN_LEVELS = [...new Set(TWIN_SETS.map(s => s.level))].sort();

// Flatten a level's sets into pickable items, each tagged with its set + options.
export function twinItemsForLevel(level) {
  const out = [];
  for (const set of TWIN_SETS) {
    if (set.level !== level) continue;
    for (const it of set.items) out.push({ setId: set.id, options: set.options, sentence: it.s, answer: it.a });
  }
  return out;
}
