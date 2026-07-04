// data/spellingBanks.js — themed spelling word banks (EXPANSION_1.md §3.1).
// Content is parent-approved as written: do not add/remove/reword words. UK spellings.
// Shape: { id, name, words: [{ w, t, clue? }] }. Homophones carry a clue sentence.
// The Big List (statutory) lives in spelling.js; this file is the new themed banks.

export const BANKS = [
  { id: 'prefixesUnDisMisRe', name: 'Prefixes un, dis, mis, re', words: [
      { w: 'unhappy', t: 1 }, { w: 'unfair', t: 1 }, { w: 'unlock', t: 1 }, { w: 'untie', t: 1 },
      { w: 'disagree', t: 1 }, { w: 'dislike', t: 1 }, { w: 'disobey', t: 1 }, { w: 'disappear', t: 1 },
      { w: 'misbehave', t: 1 }, { w: 'mislead', t: 1 }, { w: 'misspell', t: 1 },
      { w: 'redo', t: 1 }, { w: 'refresh', t: 1 }, { w: 'return', t: 1 }, { w: 'reappear', t: 1 }, { w: 'rebuild', t: 1 }
  ]},
  { id: 'prefixesInIlImIr', name: 'Prefixes in, il, im, ir', words: [
      { w: 'inactive', t: 2 }, { w: 'incorrect', t: 2 }, { w: 'invisible', t: 2 },
      { w: 'illegal', t: 2 },
      { w: 'impossible', t: 2 }, { w: 'impatient', t: 2 }, { w: 'imperfect', t: 2 },
      { w: 'irregular', t: 2 }
  ]},
  { id: 'prefixesSuperAntiAutoInterSub', name: 'Prefixes super, anti, auto, inter, sub', words: [
      { w: 'supermarket', t: 2 }, { w: 'superstar', t: 2 }, { w: 'superhero', t: 2 },
      { w: 'antiseptic', t: 2 }, { w: 'anticlockwise', t: 2 },
      { w: 'autograph', t: 2 }, { w: 'automatic', t: 2 },
      { w: 'interact', t: 2 }, { w: 'international', t: 2 },
      { w: 'submarine', t: 2 }, { w: 'subheading', t: 2 }, { w: 'subway', t: 2 }
  ]},
  { id: 'lyFamily', name: 'The ly family', words: [
      { w: 'sadly', t: 2 }, { w: 'completely', t: 2 }, { w: 'usually', t: 2 }, { w: 'finally', t: 2 },
      { w: 'comically', t: 2 }, { w: 'happily', t: 2 }, { w: 'angrily', t: 2 }, { w: 'gently', t: 2 },
      { w: 'simply', t: 2 }, { w: 'humbly', t: 2 }, { w: 'nobly', t: 2 }, { w: 'basically', t: 2 },
      { w: 'frantically', t: 2 }, { w: 'dramatically', t: 2 }
  ]},
  { id: 'ousFamily', name: 'The ous family', words: [
      { w: 'poisonous', t: 2 }, { w: 'dangerous', t: 2 }, { w: 'mountainous', t: 2 }, { w: 'famous', t: 2 },
      { w: 'various', t: 2 }, { w: 'tremendous', t: 2 }, { w: 'enormous', t: 2 }, { w: 'jealous', t: 2 },
      { w: 'humorous', t: 2 }, { w: 'glamorous', t: 2 }, { w: 'vigorous', t: 2 }, { w: 'serious', t: 2 },
      { w: 'obvious', t: 2 }, { w: 'curious', t: 2 }, { w: 'courageous', t: 2 }, { w: 'outrageous', t: 2 }
  ]},
  { id: 'tionSionSsionCian', name: 'tion, sion, ssion, cian', words: [
      { w: 'action', t: 3 }, { w: 'invention', t: 3 }, { w: 'injection', t: 3 }, { w: 'hesitation', t: 3 },
      { w: 'completion', t: 3 }, { w: 'station', t: 3 }, { w: 'division', t: 3 }, { w: 'invasion', t: 3 },
      { w: 'confusion', t: 3 }, { w: 'decision', t: 3 }, { w: 'collision', t: 3 }, { w: 'television', t: 3 },
      { w: 'extension', t: 3 }, { w: 'expansion', t: 3 }, { w: 'tension', t: 3 }, { w: 'expression', t: 3 },
      { w: 'discussion', t: 3 }, { w: 'confession', t: 3 }, { w: 'permission', t: 3 }, { w: 'admission', t: 3 },
      { w: 'musician', t: 3 }, { w: 'electrician', t: 3 }, { w: 'magician', t: 3 }, { w: 'politician', t: 3 },
      { w: 'mathematician', t: 3 }, { w: 'optician', t: 3 }
  ]},
  { id: 'chSoundsLikeK', name: 'ch that sounds like k', words: [
      { w: 'scheme', t: 2 }, { w: 'chorus', t: 2 }, { w: 'chemist', t: 2 }, { w: 'echo', t: 2 },
      { w: 'character', t: 2 }, { w: 'school', t: 2 }, { w: 'stomach', t: 2 }, { w: 'anchor', t: 2 }
  ]},
  { id: 'chSoundsLikeSh', name: 'ch that sounds like sh', words: [
      { w: 'chef', t: 3 }, { w: 'chalet', t: 3 }, { w: 'machine', t: 3 }, { w: 'brochure', t: 3 }, { w: 'parachute', t: 3 }
  ]},
  { id: 'gueAndQue', name: 'gue and que', words: [
      { w: 'league', t: 3 }, { w: 'tongue', t: 3 }, { w: 'antique', t: 3 }, { w: 'unique', t: 3 },
      { w: 'catalogue', t: 3 }, { w: 'cheque', t: 3 }
  ]},
  { id: 'silentIshSc', name: 'Silent-ish sc', words: [
      { w: 'science', t: 3 }, { w: 'scene', t: 3 }, { w: 'discipline', t: 3 }, { w: 'fascinate', t: 3 },
      { w: 'crescent', t: 3 }, { w: 'scissors', t: 3 }, { w: 'muscle', t: 3 }
  ]},
  { id: 'eiEighEy', name: 'ei, eigh, ey', words: [
      { w: 'vein', t: 2 }, { w: 'weigh', t: 2 }, { w: 'eight', t: 2 }, { w: 'eighth', t: 2 },
      { w: 'neighbour', t: 2 }, { w: 'they', t: 2 }, { w: 'obey', t: 2 }, { w: 'grey', t: 2 }, { w: 'survey', t: 2 }
  ]},
  { id: 'ouSoundsLikeU', name: 'ou that sounds like u', words: [
      { w: 'young', t: 1 }, { w: 'touch', t: 1 }, { w: 'double', t: 1 }, { w: 'trouble', t: 1 },
      { w: 'country', t: 1 }, { w: 'cousin', t: 1 }
  ]},
  { id: 'tureFamily', name: 'The ture family', words: [
      { w: 'picture', t: 1 }, { w: 'nature', t: 1 }, { w: 'creature', t: 1 }, { w: 'furniture', t: 1 },
      { w: 'adventure', t: 1 }, { w: 'capture', t: 1 }, { w: 'future', t: 1 }, { w: 'mixture', t: 1 }
  ]},
  { id: 'doubleOrNotEndings', name: 'Double-or-not endings', words: [
      { w: 'forgetting', t: 3 }, { w: 'forgotten', t: 3 }, { w: 'beginning', t: 3 }, { w: 'beginner', t: 3 },
      { w: 'preferred', t: 3 }, { w: 'gardening', t: 3 }, { w: 'gardener', t: 3 }, { w: 'limiting', t: 3 }, { w: 'limited', t: 3 }
  ]},
  { id: 'homophones', name: 'Homophones', words: [
      { w: 'piece', t: 2, clue: 'I ate the last ___ of cake' },
      { w: 'peace', t: 2, clue: 'We want world ___' },
      { w: 'plane', t: 2, clue: 'The ___ landed at the airport' },
      { w: 'plain', t: 2, clue: 'The bread was ___ and simple' },
      { w: 'brake', t: 2, clue: 'Use the ___ to slow down' },
      { w: 'break', t: 2, clue: 'Try not to ___ the window' },
      { w: 'great', t: 2, clue: 'That magic trick was ___' },
      { w: 'grate', t: 2, clue: '___ the cheese for the pizza' },
      { w: 'meet', t: 2, clue: 'We ___ at the park at noon' },
      { w: 'meat', t: 2, clue: 'Lions eat ___' },
      { w: 'mail', t: 2, clue: 'The ___ arrives each morning' },
      { w: 'male', t: 2, clue: 'A ___ lion has a big mane' },
      { w: 'hear', t: 2, clue: 'I can ___ music playing' },
      { w: 'here', t: 2, clue: 'Come over ___ right now' },
      { w: 'whether', t: 2, clue: 'I wonder ___ it will rain' },
      { w: 'weather', t: 2, clue: 'The ___ is sunny today' },
      { w: 'Whose', t: 2, clue: '___ coat is this on the floor' },
      { w: "Who's", t: 2, clue: '___ coming to the party' },
      { w: 'accept', t: 2, clue: 'Please ___ this little gift' },
      { w: 'except', t: 2, clue: 'Everyone came ___ my cousin' },
      { w: 'affect', t: 2, clue: "The rain didn't ___ our fun" },
      { w: 'effect', t: 2, clue: 'The medicine had a good ___' }
  ]}
];
