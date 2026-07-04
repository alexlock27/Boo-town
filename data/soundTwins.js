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
  'effect': "'Effect' is the result (it's a naming word)."
};

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
